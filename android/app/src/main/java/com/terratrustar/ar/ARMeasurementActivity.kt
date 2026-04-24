package com.terratrustar.ar

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.PointF
import android.graphics.drawable.GradientDrawable
import android.opengl.GLES11Ext
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.opengl.Matrix
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.Gravity
import android.view.MotionEvent
import android.view.Surface
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.ar.core.Anchor
import com.google.ar.core.ArCoreApk
import com.google.ar.core.Config
import com.google.ar.core.Coordinates2d
import com.google.ar.core.DepthPoint
import com.google.ar.core.Frame
import com.google.ar.core.Plane
import com.google.ar.core.Point
import com.google.ar.core.PointCloud
import com.google.ar.core.Session
import com.google.ar.core.TrackingState
import com.google.ar.core.exceptions.CameraNotAvailableException
import com.google.ar.core.exceptions.NotYetAvailableException
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.util.Locale
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.sqrt

class ARMeasurementActivity : AppCompatActivity(), GLSurfaceView.Renderer {

    companion object {
        private const val TAG = "TerraTrustAR"
        private const val MAX_ACCUMULATED_POINTS = 16000
        private const val MIN_DEPTH_TRUNK_POINTS = 120
        private const val MIN_SLAM_TRUNK_POINTS = 35

        const val EXTRA_MODE = "mode"
        const val EXTRA_TIER = "tier"
        const val EXTRA_MEASUREMENT_JSON = "measurement_json"
        const val EXTRA_HEIGHT_METRES = "height_metres"
        const val EXTRA_ERROR_MESSAGE = "error_message"

        const val MODE_DIAMETER = "diameter"
        const val MODE_HEIGHT = "height"
    }

    private enum class MeasurementMode {
        DIAMETER,
        HEIGHT,
    }

    private data class WorldRay(
        val origin: FloatArray,
        val direction: FloatArray,
    )

    private lateinit var rootView: FrameLayout
    private lateinit var glSurfaceView: GLSurfaceView
    private lateinit var statusTextView: TextView
    private lateinit var helperTextView: TextView
    private lateinit var progressBar: ProgressBar

    private val backgroundRenderer = CameraBackgroundRenderer()

    private var session: Session? = null
    private var installRequested = false
    private var viewportChanged = false
    private var viewportWidth = 0
    private var viewportHeight = 0

    private lateinit var measurementMode: MeasurementMode
    private var requestedTier = 1
    private var measurementStartedAt = 0L
    private var measurementCompleted = false
    private val slamPointCloud = mutableListOf<FloatArray>()
    private val depthPointCloud = mutableListOf<FloatArray>()
    private var lastRawDepthTimestamp = -1L

    @Volatile
    private var pendingTap: PointF? = null

    private var baseAnchor: Anchor? = null

    private var lastStatusText: String? = null
    private var lastHelperText: String? = null
    private var lastProgressValue: Int? = null
    private var wasProgressVisible = false
    private var waitingForInstall = false
    private var cameraUnavailableWhileCreatingSession = false
    private val resumeHandler = Handler(Looper.getMainLooper())
    private var cameraResumeAttempts = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        supportActionBar?.hide()

        measurementMode = when (intent.getStringExtra(EXTRA_MODE)) {
            MODE_HEIGHT -> MeasurementMode.HEIGHT
            else -> MeasurementMode.DIAMETER
        }
        requestedTier = intent.getIntExtra(EXTRA_TIER, 1).coerceIn(1, 2)

        buildLayout()
        postOverlayState(
            if (measurementMode == MeasurementMode.DIAMETER) {
                if (requestedTier == 1) {
                    "Hold still for 3 seconds..."
                } else {
                    "Move left and right slowly..."
                }
            } else {
                "Tap the base of the tree"
            },
            if (measurementMode == MeasurementMode.DIAMETER) {
                "Keep the tree trunk centred in the reticle."
            } else {
                "Tap once near the base, then tap once near the top."
            },
            if (measurementMode == MeasurementMode.DIAMETER) 0 else null,
        )
    }

    override fun onResume() {
        super.onResume()
        scheduleSessionResumeAttempt(150)
    }

    override fun onPause() {
        resumeHandler.removeCallbacksAndMessages(null)
        try {
            session?.pause()
        } catch (_: Exception) {
        }

        glSurfaceView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        resumeHandler.removeCallbacksAndMessages(null)
        baseAnchor?.detach()
        baseAnchor = null

        try {
            session?.close()
        } catch (_: Exception) {
        }
        session = null

        super.onDestroy()
    }

    override fun onBackPressed() {
        if (!measurementCompleted) {
            // Pass no EXTRA_ERROR_MESSAGE so ARModule.kt treats this as a
            // user-initiated cancellation (silent reset, no 'failed' alert).
            measurementCompleted = true
            setResult(Activity.RESULT_CANCELED)
        }
        super.onBackPressed()
    }

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        GLES20.glClearColor(0f, 0f, 0f, 1f)
        backgroundRenderer.createOnGlThread()
    }

    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        viewportWidth = width
        viewportHeight = height
        viewportChanged = true
        GLES20.glViewport(0, 0, width, height)
    }

    override fun onDrawFrame(gl: GL10?) {
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)

        val arSession = session ?: return
        if (measurementCompleted) {
            return
        }

        if (viewportChanged) {
            arSession.setDisplayGeometry(getDisplayRotation(), viewportWidth, viewportHeight)
            viewportChanged = false
        }

        try {
            arSession.setCameraTextureName(backgroundRenderer.textureId)
            val frame = arSession.update()
            backgroundRenderer.draw(frame)

            if (frame.camera.trackingState != TrackingState.TRACKING) {
                postOverlayState(
                    "Point the phone at the tree",
                    "Move slowly until AR tracking locks.",
                    if (measurementMode == MeasurementMode.DIAMETER) 0 else null,
                )
                return
            }

            when (measurementMode) {
                MeasurementMode.DIAMETER -> handleDiameterFrame(frame)
                MeasurementMode.HEIGHT -> handleHeightFrame(frame)
            }
        } catch (exception: CameraNotAvailableException) {
            finishWithError("Camera became unavailable. Please try again.")
        } catch (exception: Exception) {
            finishWithError(exception.message ?: "AR measurement failed.")
        }
    }

    private fun buildLayout() {
        rootView = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
            setOnTouchListener { _, motionEvent ->
                if (
                    measurementMode == MeasurementMode.HEIGHT &&
                    motionEvent.action == MotionEvent.ACTION_UP &&
                    !measurementCompleted
                ) {
                    pendingTap = PointF(motionEvent.x, motionEvent.y)
                    true
                } else {
                    false
                }
            }
        }

        glSurfaceView = GLSurfaceView(this).apply {
            preserveEGLContextOnPause = true
            setEGLContextClientVersion(2)
            setRenderer(this@ARMeasurementActivity)
            renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
        }

        statusTextView = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 18f
            gravity = Gravity.CENTER
            setPadding(dp(16), dp(12), dp(16), dp(8))
        }

        helperTextView = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 14f
            gravity = Gravity.CENTER
            setPadding(dp(20), dp(8), dp(20), dp(24))
        }

        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progress = 0
            visibility = View.GONE
        }

        rootView.addView(
            glSurfaceView,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ),
        )
        rootView.addView(buildReticleOverlay())
        rootView.addView(
            statusTextView,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.TOP,
            ),
        )
        rootView.addView(
            progressBar,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(6),
                Gravity.BOTTOM,
            ).apply {
                marginStart = dp(24)
                marginEnd = dp(24)
                bottomMargin = dp(88)
            },
        )
        rootView.addView(
            helperTextView,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM,
            ),
        )

        setContentView(rootView)
    }

    private fun buildReticleOverlay(): View {
        val overlay = FrameLayout(this).apply {
            isClickable = false
            isFocusable = false
        }

        val horizontal = View(this).apply { setBackgroundColor(Color.WHITE) }
        val vertical = View(this).apply { setBackgroundColor(Color.WHITE) }
        val circle = View(this).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setStroke(dp(2), Color.WHITE)
                setColor(Color.TRANSPARENT)
            }
        }

        overlay.addView(
            horizontal,
            FrameLayout.LayoutParams(dp(72), dp(2), Gravity.CENTER),
        )
        overlay.addView(
            vertical,
            FrameLayout.LayoutParams(dp(2), dp(72), Gravity.CENTER),
        )
        overlay.addView(
            circle,
            FrameLayout.LayoutParams(dp(40), dp(40), Gravity.CENTER),
        )

        return overlay
    }

    private fun ensureSession(): Boolean {
        if (session != null) {
            waitingForInstall = false
            cameraUnavailableWhileCreatingSession = false
            return true
        }

        try {
            when (ArCoreApk.getInstance().requestInstall(this, !installRequested)) {
                ArCoreApk.InstallStatus.INSTALL_REQUESTED -> {
                    installRequested = true
                    waitingForInstall = true
                    return false
                }

                ArCoreApk.InstallStatus.INSTALLED -> {
                    installRequested = false
                    waitingForInstall = false
                }
            }

            // Create ARCore Session - this will attempt to access the camera
            val createdSession = try {
                Session(this)
            } catch (exception: CameraNotAvailableException) {
                cameraUnavailableWhileCreatingSession = true
                return false
            } catch (exception: SecurityException) {
                finishWithError("Camera permission denied. Please grant camera access.")
                return false
            }

            configureSession(createdSession)
            session = createdSession
            cameraUnavailableWhileCreatingSession = false
            return true
        } catch (exception: Exception) {
            finishWithError(exception.message ?: "ARCore is unavailable on this device.")
            return false
        }
    }

    private fun scheduleSessionResumeAttempt(delayMs: Long) {
        resumeHandler.postDelayed({
            if (measurementCompleted || isFinishing || isDestroyed) {
                return@postDelayed
            }

            if (!ensureSession()) {
                when {
                    waitingForInstall -> Unit
                    cameraUnavailableWhileCreatingSession && cameraResumeAttempts < 8 -> {
                        cameraResumeAttempts += 1
                        scheduleSessionResumeAttempt(150)
                    }
                    cameraUnavailableWhileCreatingSession -> {
                        finishWithError("Camera is still in use. Please wait a moment and try again.")
                    }
                }
                return@postDelayed
            }

            glSurfaceView.onResume()

            try {
                session?.resume()
                cameraResumeAttempts = 0
            } catch (_: CameraNotAvailableException) {
                if (cameraResumeAttempts < 8) {
                    cameraResumeAttempts += 1
                    scheduleSessionResumeAttempt(150)
                } else {
                    finishWithError("Camera became unavailable. Please try again.")
                }
            } catch (exception: Exception) {
                finishWithError(exception.message ?: "Unable to start AR measurement.")
            }
        }, delayMs)
    }

    private fun configureSession(arSession: Session) {
        val config = Config(arSession).apply {
            focusMode = Config.FocusMode.AUTO
            depthMode = if (
                requestedTier == 1
            ) {
                when {
                    arSession.isDepthModeSupported(Config.DepthMode.RAW_DEPTH_ONLY) ->
                        Config.DepthMode.RAW_DEPTH_ONLY
                    arSession.isDepthModeSupported(Config.DepthMode.AUTOMATIC) ->
                        Config.DepthMode.AUTOMATIC
                    else -> Config.DepthMode.DISABLED
                }
            } else {
                Config.DepthMode.DISABLED
            }
            planeFindingMode = if (measurementMode == MeasurementMode.HEIGHT) {
                Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL
            } else {
                Config.PlaneFindingMode.DISABLED
            }
            instantPlacementMode = Config.InstantPlacementMode.DISABLED
        }

        arSession.configure(config)
    }

    private fun handleDiameterFrame(frame: Frame) {
        if (measurementStartedAt == 0L) {
            measurementStartedAt = SystemClock.elapsedRealtime()
            slamPointCloud.clear()
            depthPointCloud.clear()
            lastRawDepthTimestamp = -1L
        }

        val durationMs = if (requestedTier == 1) 3000L else 5000L
        val elapsedMs = SystemClock.elapsedRealtime() - measurementStartedAt
        val progress = ((elapsedMs * 100) / durationMs).toInt().coerceIn(0, 100)

        postOverlayState(
            if (requestedTier == 1) {
                "Hold still for 3 seconds..."
            } else {
                "Move left and right slowly..."
            },
            if (requestedTier == 1) {
                "Keep the trunk centred in the reticle."
            } else {
                "Move the phone in a small left-right arc while keeping the trunk centred."
            },
            progress,
        )

        if (requestedTier == 1) {
            try {
                depthPointCloud.addAll(collectDepthPoints(frame))
                if (depthPointCloud.size > MAX_ACCUMULATED_POINTS) {
                    depthPointCloud.subList(0, depthPointCloud.size - MAX_ACCUMULATED_POINTS).clear()
                }
            } catch (_: NotYetAvailableException) {
                // Depth is still warming up; keep collecting until duration elapses.
            }
        } else {
            collectSlamPointCloud(frame)
        }

        if (elapsedMs < durationMs) {
            return
        }

        val resultJson = if (requestedTier == 1) {
            val depthPoints = depthPointCloud.toList()
            val filteredDepthPoints = filterDepthPointsForTrunk(depthPoints)
            Log.d(TAG, "Tier1 depth points raw=${depthPoints.size} filtered=${filteredDepthPoints.size}")
            if (filteredDepthPoints.size < MIN_DEPTH_TRUNK_POINTS) {
                finishWithError("Not enough depth data. Keep the trunk centred and try again. points=${filteredDepthPoints.size}")
                return
            }
            fitCylinder(filteredDepthPoints, 1, depthPoints.size)
        } else {
            val slamPoints = slamPointCloud.toList()
            val filteredSlamPoints = filterDepthPointsForTrunk(slamPoints)
            Log.d(TAG, "Tier2 SLAM points raw=${slamPoints.size} filtered=${filteredSlamPoints.size}")
            if (filteredSlamPoints.size < MIN_SLAM_TRUNK_POINTS) {
                finishWithError("Not enough AR tracking data. Move slowly while keeping the trunk centred. points=${filteredSlamPoints.size}")
                return
            }
            fitCylinder(filteredSlamPoints, 2, slamPoints.size)
        }

        if (resultJson == null) {
            finishWithError("Move closer to the tree and hold steady, then try again.")
            return
        }

        finishWithDiameterMeasurement(resultJson)
    }

    private fun handleHeightFrame(frame: Frame) {
        postOverlayState(
            if (baseAnchor == null) {
                "Tap the base of the tree"
            } else {
                "Tap the top of the tree"
            },
            if (baseAnchor == null) {
                "Tap near the tree trunk base to place the first anchor."
            } else {
                "Tilt up and tap near the top of the tree canopy."
            },
            null,
        )

        val tap = pendingTap ?: return
        pendingTap = null

        if (baseAnchor != null) {
            val heightMetres = estimateHeightFromTopTap(frame, tap)
            if (heightMetres == null || heightMetres < 0.5f || heightMetres > 80f) {
                postOverlayState(
                    "Height looks unusual",
                    "Keep the base centred below the top, then tap the canopy top again.",
                    null,
                )
                return
            }

            finishWithHeightMeasurement(heightMetres)
            return
        }

        val hitResult = frame.hitTest(tap.x, tap.y).firstOrNull { result ->
            when (val trackable = result.trackable) {
                is Plane -> trackable.isPoseInPolygon(result.hitPose)
                is Point -> true
                is DepthPoint -> true
                else -> false
            }
        }

        if (hitResult == null) {
            postOverlayState(
                "Tap the base of the tree",
                "No tracked surface was detected at the base. Move slowly and tap again.",
                null,
            )
            return
        }

        val anchor = hitResult.createAnchor()
        baseAnchor?.detach()
        baseAnchor = anchor
        postOverlayState(
            "Base marked",
            "Aim at the top of the tree and tap the canopy top.",
            null,
        )
    }

    private fun collectDepthPoints(frame: Frame): List<FloatArray> {
        val depthImage = frame.acquireRawDepthImage16Bits()
        val confidenceImage = frame.acquireRawDepthConfidenceImage()
        try {
            if (depthImage.timestamp == lastRawDepthTimestamp || depthImage.timestamp != frame.timestamp) {
                return emptyList()
            }
            lastRawDepthTimestamp = depthImage.timestamp

            val width = depthImage.width
            val height = depthImage.height
            val depthBuffer = depthImage.planes[0].buffer.duplicate().order(ByteOrder.nativeOrder())
            val depthPlane = depthImage.planes[0]
            val confidencePlane = confidenceImage.planes[0]
            val confidenceBuffer = confidencePlane.buffer.duplicate()
            val intrinsics = frame.camera.imageIntrinsics
            val imageWidth = intrinsics.imageDimensions[0].toFloat().coerceAtLeast(1f)
            val imageHeight = intrinsics.imageDimensions[1].toFloat().coerceAtLeast(1f)
            val scaleX = width.toFloat() / imageWidth
            val scaleY = height.toFloat() / imageHeight
            val fx = intrinsics.focalLength[0] * scaleX
            val fy = intrinsics.focalLength[1] * scaleY
            val cx = intrinsics.principalPoint[0] * scaleX
            val cy = intrinsics.principalPoint[1] * scaleY

            val xStart = (width * 0.35f).toInt()
            val xEnd = (width * 0.65f).toInt()
            val yStart = (height * 0.20f).toInt()
            val yEnd = (height * 0.80f).toInt()

            val points = mutableListOf<FloatArray>()
            for (y in yStart until yEnd) {
                for (x in xStart until xEnd) {
                    val confidenceOffset = y * confidencePlane.rowStride + x * confidencePlane.pixelStride
                    val confidence = confidenceBuffer.get(confidenceOffset).toInt() and 0xFF
                    if (confidence < 128) {
                        continue
                    }

                    val depthOffset = y * depthPlane.rowStride + x * depthPlane.pixelStride
                    val depthMillimetres = depthBuffer.getShort(depthOffset).toInt() and 0xFFFF
                    if (depthMillimetres <= 0 || depthMillimetres >= 10000) {
                        continue
                    }

                    val depthMetres = depthMillimetres / 1000.0f
                    val worldX = (x - cx) * depthMetres / fx
                    val worldY = (y - cy) * depthMetres / fy
                    points.add(floatArrayOf(worldX, worldY, depthMetres))
                }
            }

            return points
        } finally {
            confidenceImage.close()
            depthImage.close()
        }
    }

    private fun collectSlamPointCloud(frame: Frame) {
        val pointCloud: PointCloud = frame.acquirePointCloud()
        try {
            val pointBuffer = pointCloud.points
            pointBuffer.rewind()
            val cameraPose = frame.camera.pose

            while (pointBuffer.remaining() >= 4) {
                val x = pointBuffer.get()
                val y = pointBuffer.get()
                val z = pointBuffer.get()
                val confidence = pointBuffer.get()
                if (confidence <= 0.3f) {
                    continue
                }

                val cameraPoint = cameraPose.inverse().transformPoint(floatArrayOf(x, y, z))
                val depthMetres = -cameraPoint[2]
                if (depthMetres < 0.5f || depthMetres > 5.0f) {
                    continue
                }

                val horizontalRatio = abs(cameraPoint[0] / depthMetres)
                val verticalRatio = abs(cameraPoint[1] / depthMetres)
                if (horizontalRatio <= 0.28f && verticalRatio <= 0.65f) {
                    slamPointCloud.add(floatArrayOf(cameraPoint[0], cameraPoint[1], depthMetres))
                }
            }

            if (slamPointCloud.size > MAX_ACCUMULATED_POINTS) {
                slamPointCloud.subList(0, slamPointCloud.size - MAX_ACCUMULATED_POINTS).clear()
            }
        } finally {
            pointCloud.close()
        }
    }

    private fun filterDepthPointsForTrunk(points: List<FloatArray>): List<FloatArray> {
        if (points.size < MIN_SLAM_TRUNK_POINTS) {
            return points
        }

        val sortedDepths = points.map { it[2] }.sorted()
        val medianDepth = sortedDepths[sortedDepths.size / 2]
        val depthWindow = 0.35f
        val xWindow = (medianDepth * 0.45f).coerceIn(0.12f, 0.85f)
        val yWindow = (medianDepth * 0.85f).coerceIn(0.18f, 1.6f)

        val filtered = points.filter { point ->
            abs(point[2] - medianDepth) <= depthWindow &&
                abs(point[0]) <= xWindow &&
                abs(point[1]) <= yWindow
        }

        return if (filtered.size >= MIN_SLAM_TRUNK_POINTS) filtered else points
    }

    private fun fitCylinder(
        points: List<FloatArray>,
        tierUsed: Int,
        rawPointCount: Int = points.size,
    ): String? {
        val minimumPoints = if (tierUsed == 1) MIN_DEPTH_TRUNK_POINTS else MIN_SLAM_TRUNK_POINTS
        if (points.size < minimumPoints) {
            return null
        }

        val sortedX = points.map { it[0] }.sorted()
        val sortedY = points.map { it[1] }.sorted()
        val sortedDepth = points.map { it[2] }.sorted()
        val leftEdge = percentile(sortedX, 0.05f)
        val rightEdge = percentile(sortedX, 0.95f)
        val medianX = percentile(sortedX, 0.50f)
        val diameterMetres = (rightEdge - leftEdge) * 1.04f
        if (diameterMetres < 0.05f || diameterMetres > 2.0f) {
            return null
        }

        val verticalCoverage = percentile(sortedY, 0.90f) - percentile(sortedY, 0.10f)
        val depthSpread = percentile(sortedDepth, 0.90f) - percentile(sortedDepth, 0.10f)
        val leftWidth = abs(medianX - leftEdge)
        val rightWidth = abs(rightEdge - medianX)
        val symmetryScore =
            (1f - (abs(leftWidth - rightWidth) / max(diameterMetres, 0.05f))).coerceIn(0f, 1f)
        val countTarget = if (tierUsed == 1) 700f else 90f
        val countScore = (points.size.toFloat() / countTarget).coerceIn(0f, 1f)
        val depthScore = (1f - (depthSpread / 0.85f)).coerceIn(0f, 1f)
        val coverageScore = (verticalCoverage / 0.60f).coerceIn(0f, 1f)
        val confidence =
            (0.52f + countScore * 0.18f + depthScore * 0.14f + coverageScore * 0.08f + symmetryScore * 0.08f)
                .coerceIn(0.50f, 0.96f)

        val diameterCentimetres = diameterMetres * 100f
        return """{"diameter_cm":${String.format(Locale.US, "%.1f", diameterCentimetres)},"confidence":${String.format(Locale.US, "%.3f", confidence)},"tier_used":$tierUsed,"point_count":${points.size},"raw_point_count":$rawPointCount,"filtered_point_count":${points.size},"fit_method":"vertical_trunk_width"}"""
    }

    private fun percentile(sortedValues: List<Float>, percentile: Float): Float {
        if (sortedValues.isEmpty()) {
            return 0f
        }

        val index = (((sortedValues.size - 1) * percentile).toInt())
            .coerceIn(0, sortedValues.size - 1)
        return sortedValues[index]
    }

    private fun estimateHeightFromTopTap(frame: Frame, tap: PointF): Float? {
        val basePose = baseAnchor?.pose ?: return null
        val ray = createWorldRay(frame, tap) ?: return null
        val base = floatArrayOf(basePose.tx(), basePose.ty(), basePose.tz())
        val wx = ray.origin[0] - base[0]
        val wy = ray.origin[1] - base[1]
        val wz = ray.origin[2] - base[2]
        val rayDotUp = ray.direction[1]
        val rayDotOffset =
            ray.direction[0] * wx +
                ray.direction[1] * wy +
                ray.direction[2] * wz
        val denom = 1f - rayDotUp * rayDotUp
        if (denom < 0.0005f) {
            return null
        }

        val rayDistance = ((rayDotUp * wy) - rayDotOffset) / denom
        if (rayDistance <= 0f) {
            return null
        }

        val heightMetres = wy + rayDotUp * rayDistance
        val closestRayPoint = floatArrayOf(
            ray.origin[0] + ray.direction[0] * rayDistance,
            ray.origin[1] + ray.direction[1] * rayDistance,
            ray.origin[2] + ray.direction[2] * rayDistance,
        )
        val closestVerticalPoint = floatArrayOf(base[0], base[1] + heightMetres, base[2])
        val missDistance = distance(closestRayPoint, closestVerticalPoint)
        val phoneBaseDistance = sqrt(wx * wx + wz * wz)
        val allowedMiss = (phoneBaseDistance * 0.35f + 0.45f).coerceIn(0.75f, 2.5f)
        if (missDistance > allowedMiss) {
            return null
        }

        return heightMetres
    }

    private fun createWorldRay(frame: Frame, tap: PointF): WorldRay? {
        if (viewportWidth <= 0 || viewportHeight <= 0) {
            return null
        }

        val projection = FloatArray(16)
        val view = FloatArray(16)
        val viewProjection = FloatArray(16)
        val inverseViewProjection = FloatArray(16)
        frame.camera.getProjectionMatrix(projection, 0, 0.1f, 100f)
        frame.camera.getViewMatrix(view, 0)
        Matrix.multiplyMM(viewProjection, 0, projection, 0, view, 0)
        if (!Matrix.invertM(inverseViewProjection, 0, viewProjection, 0)) {
            return null
        }

        val ndcX = (tap.x / viewportWidth.toFloat()) * 2f - 1f
        val ndcY = 1f - (tap.y / viewportHeight.toFloat()) * 2f
        val near = worldFromClip(inverseViewProjection, ndcX, ndcY, -1f) ?: return null
        val far = worldFromClip(inverseViewProjection, ndcX, ndcY, 1f) ?: return null
        val direction = normalised(
            floatArrayOf(
                far[0] - near[0],
                far[1] - near[1],
                far[2] - near[2],
            ),
        ) ?: return null

        return WorldRay(near, direction)
    }

    private fun worldFromClip(
        inverseViewProjection: FloatArray,
        x: Float,
        y: Float,
        z: Float,
    ): FloatArray? {
        val clip = floatArrayOf(x, y, z, 1f)
        val world = FloatArray(4)
        Matrix.multiplyMV(world, 0, inverseViewProjection, 0, clip, 0)
        if (abs(world[3]) < 0.000001f) {
            return null
        }

        return floatArrayOf(
            world[0] / world[3],
            world[1] / world[3],
            world[2] / world[3],
        )
    }

    private fun normalised(vector: FloatArray): FloatArray? {
        val length = sqrt(
            vector[0] * vector[0] +
                vector[1] * vector[1] +
                vector[2] * vector[2],
        )
        if (length < 0.000001f) {
            return null
        }

        return floatArrayOf(vector[0] / length, vector[1] / length, vector[2] / length)
    }

    private fun distance(first: FloatArray, second: FloatArray): Float {
        val dx = first[0] - second[0]
        val dy = first[1] - second[1]
        val dz = first[2] - second[2]
        return sqrt(dx * dx + dy * dy + dz * dz)
    }

    private fun finishWithDiameterMeasurement(resultJson: String) {
        if (measurementCompleted) {
            return
        }

        measurementCompleted = true
        runOnUiThread {
            val intent = Intent().putExtra(EXTRA_MEASUREMENT_JSON, resultJson)
            setResult(Activity.RESULT_OK, intent)
            finish()
        }
    }

    private fun finishWithHeightMeasurement(heightMetres: Float) {
        if (measurementCompleted) {
            return
        }

        measurementCompleted = true
        runOnUiThread {
            val intent = Intent().putExtra(EXTRA_HEIGHT_METRES, heightMetres.toDouble())
            setResult(Activity.RESULT_OK, intent)
            finish()
        }
    }

    private fun finishWithError(message: String) {
        if (measurementCompleted) {
            return
        }

        measurementCompleted = true
        runOnUiThread {
            val intent = Intent().putExtra(EXTRA_ERROR_MESSAGE, message)
            setResult(Activity.RESULT_CANCELED, intent)
            finish()
        }
    }

    private fun postOverlayState(status: String, helper: String, progress: Int?) {
        val isProgressVisible = progress != null
        val nextProgressValue = progress?.coerceIn(0, 100)
        if (
            lastStatusText == status &&
            lastHelperText == helper &&
            lastProgressValue == nextProgressValue &&
            wasProgressVisible == isProgressVisible
        ) {
            return
        }

        lastStatusText = status
        lastHelperText = helper
        lastProgressValue = nextProgressValue
        wasProgressVisible = isProgressVisible

        runOnUiThread {
            statusTextView.text = status
            helperTextView.text = helper
            if (nextProgressValue == null) {
                progressBar.visibility = View.GONE
            } else {
                progressBar.visibility = View.VISIBLE
                progressBar.progress = nextProgressValue
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun getDisplayRotation(): Int {
        return display?.rotation ?: windowManager.defaultDisplay.rotation ?: Surface.ROTATION_0
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }

    private class CameraBackgroundRenderer {
        val textureId: Int
            get() = cameraTextureId

        private val quadVertices: FloatBuffer = allocateFloatBuffer(
            floatArrayOf(
                -1f, -1f,
                1f, -1f,
                -1f, 1f,
                1f, 1f,
            ),
        )
        private val quadTextureCoordinates: FloatBuffer = allocateFloatBuffer(
            floatArrayOf(
                0f, 1f,
                1f, 1f,
                0f, 0f,
                1f, 0f,
            ),
        )
        private val transformedTextureCoordinates: FloatBuffer = allocateFloatBuffer(
            floatArrayOf(
                0f, 1f,
                1f, 1f,
                0f, 0f,
                1f, 0f,
            ),
        )

        private var shaderProgram = 0
        private var cameraTextureId = -1
        private var positionAttribute = 0
        private var textureCoordinateAttribute = 0

        fun createOnGlThread() {
            val textures = IntArray(1)
            GLES20.glGenTextures(1, textures, 0)
            cameraTextureId = textures[0]
            GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, cameraTextureId)
            GLES20.glTexParameteri(
                GLES11Ext.GL_TEXTURE_EXTERNAL_OES,
                GLES20.GL_TEXTURE_WRAP_S,
                GLES20.GL_CLAMP_TO_EDGE,
            )
            GLES20.glTexParameteri(
                GLES11Ext.GL_TEXTURE_EXTERNAL_OES,
                GLES20.GL_TEXTURE_WRAP_T,
                GLES20.GL_CLAMP_TO_EDGE,
            )
            GLES20.glTexParameteri(
                GLES11Ext.GL_TEXTURE_EXTERNAL_OES,
                GLES20.GL_TEXTURE_MIN_FILTER,
                GLES20.GL_LINEAR,
            )
            GLES20.glTexParameteri(
                GLES11Ext.GL_TEXTURE_EXTERNAL_OES,
                GLES20.GL_TEXTURE_MAG_FILTER,
                GLES20.GL_LINEAR,
            )

            val vertexShader = loadShader(
                GLES20.GL_VERTEX_SHADER,
                """
                    attribute vec4 a_Position;
                    attribute vec2 a_TexCoord;
                    varying vec2 v_TexCoord;
                    void main() {
                        gl_Position = a_Position;
                        v_TexCoord = a_TexCoord;
                    }
                """.trimIndent(),
            )
            val fragmentShader = loadShader(
                GLES20.GL_FRAGMENT_SHADER,
                """
                    #extension GL_OES_EGL_image_external : require
                    precision mediump float;
                    uniform samplerExternalOES sTexture;
                    varying vec2 v_TexCoord;
                    void main() {
                        gl_FragColor = texture2D(sTexture, v_TexCoord);
                    }
                """.trimIndent(),
            )

            shaderProgram = GLES20.glCreateProgram()
            GLES20.glAttachShader(shaderProgram, vertexShader)
            GLES20.glAttachShader(shaderProgram, fragmentShader)
            GLES20.glLinkProgram(shaderProgram)

            positionAttribute = GLES20.glGetAttribLocation(shaderProgram, "a_Position")
            textureCoordinateAttribute = GLES20.glGetAttribLocation(shaderProgram, "a_TexCoord")
        }

        fun draw(frame: Frame) {
            if (frame.hasDisplayGeometryChanged()) {
                quadVertices.position(0)
                transformedTextureCoordinates.position(0)
                frame.transformCoordinates2d(
                    Coordinates2d.OPENGL_NORMALIZED_DEVICE_COORDINATES,
                    quadVertices,
                    Coordinates2d.TEXTURE_NORMALIZED,
                    transformedTextureCoordinates,
                )
            }

            GLES20.glDisable(GLES20.GL_DEPTH_TEST)
            GLES20.glDepthMask(false)
            GLES20.glUseProgram(shaderProgram)

            quadVertices.position(0)
            transformedTextureCoordinates.position(0)

            GLES20.glVertexAttribPointer(
                positionAttribute,
                2,
                GLES20.GL_FLOAT,
                false,
                0,
                quadVertices,
            )
            GLES20.glVertexAttribPointer(
                textureCoordinateAttribute,
                2,
                GLES20.GL_FLOAT,
                false,
                0,
                transformedTextureCoordinates,
            )
            GLES20.glEnableVertexAttribArray(positionAttribute)
            GLES20.glEnableVertexAttribArray(textureCoordinateAttribute)

            GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
            GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, cameraTextureId)
            GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)

            GLES20.glDisableVertexAttribArray(positionAttribute)
            GLES20.glDisableVertexAttribArray(textureCoordinateAttribute)
            GLES20.glDepthMask(true)
            GLES20.glEnable(GLES20.GL_DEPTH_TEST)
        }

        private fun loadShader(type: Int, source: String): Int {
            val shader = GLES20.glCreateShader(type)
            GLES20.glShaderSource(shader, source)
            GLES20.glCompileShader(shader)
            return shader
        }

        private fun allocateFloatBuffer(values: FloatArray): FloatBuffer {
            return ByteBuffer
                .allocateDirect(values.size * 4)
                .order(ByteOrder.nativeOrder())
                .asFloatBuffer()
                .apply {
                    put(values)
                    position(0)
                }
        }
    }
}
