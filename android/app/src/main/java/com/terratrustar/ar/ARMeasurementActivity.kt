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
import com.google.ar.core.HitResult
import com.google.ar.core.Plane
import com.google.ar.core.Point
import com.google.ar.core.PointCloud
import com.google.ar.core.Pose
import com.google.ar.core.Session
import com.google.ar.core.TrackingState
import com.google.ar.core.exceptions.CameraNotAvailableException
import com.google.ar.core.exceptions.NotYetAvailableException
import org.json.JSONObject
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.util.Locale
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sqrt

class ARMeasurementActivity : AppCompatActivity(), GLSurfaceView.Renderer {

    companion object {
        private const val TAG = "TerraTrustAR"
        private const val MAX_PREVIEW_POINTS = 5000
        private const val MAX_CAPTURE_POINTS = 7000
        private const val TIER1_CAPTURE_DURATION_MS = 3000L
        private const val TIER2_CAPTURE_TIMEOUT_MS = 12000L
        private const val TIER2_MIN_SCAN_SPAN_M = 0.18f
        private const val TIER2_TARGET_SCAN_SPAN_M = 0.22f
        private const val TIER1_MAX_HOLD_DRIFT_M = 0.035f

        const val EXTRA_MODE = "mode"
        const val EXTRA_TIER = "tier"
        const val EXTRA_MEASUREMENT_JSON = "measurement_json"
        const val EXTRA_HEIGHT_METRES = "height_metres"
        const val EXTRA_ERROR_MESSAGE = "error_message"
        const val EXTRA_ERROR_CODE = "error_code"

        const val MODE_DIAMETER = "diameter"
        const val MODE_HEIGHT = "height"

        const val ERROR_CAMERA_IN_USE = "CAMERA_IN_USE"
        const val ERROR_AR_UNAVAILABLE = "AR_UNAVAILABLE"
        const val ERROR_LOW_CONFIDENCE = "LOW_CONFIDENCE"
        const val ERROR_INSUFFICIENT_POINTS = "INSUFFICIENT_POINTS"
        const val ERROR_INSUFFICIENT_SCAN_MOTION = "INSUFFICIENT_SCAN_MOTION"
        const val ERROR_HEIGHT_SURFACE_NOT_FOUND = "HEIGHT_SURFACE_NOT_FOUND"
        const val ERROR_HEIGHT_OUT_OF_RANGE = "HEIGHT_OUT_OF_RANGE"
    }

    private enum class MeasurementMode {
        DIAMETER,
        HEIGHT,
    }

    private enum class DiameterStage {
        WARMUP,
        LOCK,
        CAPTURE,
    }

    private data class WorldRay(
        val origin: FloatArray,
        val direction: FloatArray,
    )

    private data class HeightPreview(
        val heightMetres: Float,
        val topWorldPoint: FloatArray,
        val isHitBased: Boolean = false,
        val sourceLabel: String = "Guided estimate",
    )

    private data class HeightHitCandidate(
        val kind: HeightBaseHitKind,
        val hitResult: HitResult,
    )

    private lateinit var rootView: FrameLayout
    private lateinit var glSurfaceView: GLSurfaceView
    private lateinit var overlayView: MeasurementOverlayView
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
    private var measurementCompleted = false

    private var lastStatusText: String? = null
    private var lastHelperText: String? = null
    private var lastProgressValue: Int? = null
    private var wasProgressVisible = false
    private var waitingForInstall = false
    private var cameraUnavailableWhileCreatingSession = false
    private val resumeHandler = Handler(Looper.getMainLooper())
    private var cameraResumeAttempts = 0

    private var diameterStage = DiameterStage.WARMUP
    private var stageStartedAt = 0L
    private var previewStableSince = 0L
    private var captureStartedAt = 0L
    private var captureStartPose: Pose? = null
    private var depthWarmupFrames = 0
    private var lastRawDepthTimestamp = -1L
    private val previewPoints = mutableListOf<TrunkMeasurementEngine.WorldPoint>()
    private val capturePoints = mutableListOf<TrunkMeasurementEngine.WorldPoint>()
    private var previewFit: TrunkMeasurementEngine.PreviewFit? = null
    private var lockedPreviewFit: TrunkMeasurementEngine.PreviewFit? = null
    private var tier2MinLateral = 0f
    private var tier2MaxLateral = 0f
    private var lastScanDistanceM = 0f
    private var lastScanDurationMs = 0L

    private val heightTapLock = Any()
    private val pendingHeightTaps = ArrayDeque<PointF>()
    @Volatile
    private var heightAimPoint: PointF? = null
    private var heightStep = HeightMeasurementStep.STEP_1_BASE_TARGET
    private var latestHeightTapFeedback: MeasurementOverlayView.TapFeedback? = null

    private var baseAnchor: Anchor? = null
    private var currentHeightPreview: HeightPreview? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        supportActionBar?.hide()

        measurementMode = when (intent.getStringExtra(EXTRA_MODE)) {
            MODE_HEIGHT -> MeasurementMode.HEIGHT
            else -> MeasurementMode.DIAMETER
        }
        requestedTier = intent.getIntExtra(EXTRA_TIER, 1).coerceIn(1, 2)
        heightStep = HeightMeasurementStep.STEP_1_BASE_TARGET

        buildLayout()
        resetDiameterState()

        postOverlayState(
            if (measurementMode == MeasurementMode.DIAMETER) {
                "Opening AR measurement..."
            } else {
                "Opening AR height measurement..."
            },
            "TerraTrust is starting the AR camera.",
            null,
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
        synchronized(heightTapLock) {
            pendingHeightTaps.clear()
        }
        heightAimPoint = null
        latestHeightTapFeedback = null

        try {
            session?.close()
        } catch (_: Exception) {
        }
        session = null

        super.onDestroy()
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (!measurementCompleted) {
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
                overlayView.render(
                    MeasurementOverlayView.State(
                        heightStep =
                            if (measurementMode == MeasurementMode.HEIGHT) {
                                heightStep
                            } else {
                                null
                            },
                        stageBadge =
                            if (measurementMode == MeasurementMode.DIAMETER) {
                                "Tracking scene"
                            } else {
                                heightStageBadge()
                            },
                        activeAimPoint = heightAimPoint?.let { PointF(it.x, it.y) },
                        tapFeedbacks = activeTapFeedbacks(),
                    ),
                )
                postOverlayState(
                    if (measurementMode == MeasurementMode.DIAMETER) {
                        "Point the phone at the tree"
                    } else {
                        "Move slowly until tracking locks"
                    },
                    if (measurementMode == MeasurementMode.DIAMETER) {
                        "Center the trunk and move slightly so TerraTrust can lock onto it."
                    } else {
                        "Move slightly so TerraTrust can detect the tree base and top."
                    },
                    if (measurementMode == MeasurementMode.DIAMETER) 0 else null,
                )
                return
            }

            when (measurementMode) {
                MeasurementMode.DIAMETER -> handleDiameterFrame(frame)
                MeasurementMode.HEIGHT -> handleHeightFrame(frame)
            }
        } catch (exception: CameraNotAvailableException) {
            finishWithError(ERROR_CAMERA_IN_USE, "Camera became unavailable. Please try again.")
        } catch (exception: Exception) {
            Log.e(TAG, "AR measurement failed", exception)
            finishWithError(ERROR_AR_UNAVAILABLE, exception.message ?: "AR measurement failed.")
        }
    }

    private fun buildLayout() {
        rootView = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
        }

        val heightTouchListener =
            View.OnTouchListener { _, motionEvent ->
                if (measurementMode != MeasurementMode.HEIGHT || measurementCompleted) {
                    return@OnTouchListener false
                }

                when (motionEvent.actionMasked) {
                    MotionEvent.ACTION_DOWN,
                    MotionEvent.ACTION_MOVE -> {
                        heightAimPoint = PointF(motionEvent.x, motionEvent.y)
                        true
                    }

                    MotionEvent.ACTION_UP -> {
                        val tapPoint = PointF(motionEvent.x, motionEvent.y)
                        heightAimPoint = tapPoint
                        enqueueHeightTap(tapPoint)
                        true
                    }

                    MotionEvent.ACTION_CANCEL -> {
                        heightAimPoint = null
                        true
                    }

                    else -> false
                }
            }

        glSurfaceView = GLSurfaceView(this).apply {
            preserveEGLContextOnPause = true
            setEGLContextClientVersion(2)
            setRenderer(this@ARMeasurementActivity)
            renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
            setOnTouchListener(heightTouchListener)
        }

        overlayView =
            MeasurementOverlayView(this).apply {
                setOnTouchListener(heightTouchListener)
            }

        statusTextView = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 18f
            gravity = Gravity.CENTER
            setPadding(dp(22), dp(14), dp(22), dp(14))
            background =
                GradientDrawable().apply {
                    setColor(Color.parseColor("#C0111720"))
                    cornerRadius = dp(20).toFloat()
                }
        }

        helperTextView = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 14f
            gravity = Gravity.CENTER
            setPadding(dp(22), dp(14), dp(22), dp(14))
            background =
                GradientDrawable().apply {
                    setColor(Color.parseColor("#B3101720"))
                    cornerRadius = dp(18).toFloat()
                }
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
        rootView.addView(
            overlayView,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ),
        )
        rootView.addView(
            statusTextView,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.TOP or Gravity.CENTER_HORIZONTAL,
            ).apply {
                topMargin = dp(28)
                marginStart = dp(20)
                marginEnd = dp(20)
            },
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
                bottomMargin = dp(96)
            },
        )
        rootView.addView(
            helperTextView,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL,
            ).apply {
                bottomMargin = dp(24)
                marginStart = dp(20)
                marginEnd = dp(20)
            },
        )

        setContentView(rootView)
    }

    private fun enqueueHeightTap(point: PointF) {
        synchronized(heightTapLock) {
            if (pendingHeightTaps.size >= 4) {
                pendingHeightTaps.removeFirst()
            }
            pendingHeightTaps.addLast(PointF(point.x, point.y))
        }
    }

    private fun pollHeightTap(): PointF? {
        synchronized(heightTapLock) {
            if (pendingHeightTaps.isEmpty()) {
                return null
            }
            return pendingHeightTaps.removeFirst()
        }
    }

    private fun showHeightTapFeedback(
        point: PointF,
        isSuccess: Boolean,
        label: String,
    ) {
        latestHeightTapFeedback =
            MeasurementOverlayView.TapFeedback(
                point = PointF(point.x, point.y),
                isSuccess = isSuccess,
                label = label,
            )
    }

    private fun activeTapFeedbacks(): List<MeasurementOverlayView.TapFeedback> {
        val feedback = latestHeightTapFeedback ?: return emptyList()
        return if (SystemClock.elapsedRealtime() - feedback.createdAtMs <= 520L) {
            listOf(feedback)
        } else {
            emptyList()
        }
    }

    private fun heightStageBadge(): String {
        return when (heightStep) {
            HeightMeasurementStep.STEP_1_BASE_TARGET -> "Step 1 of 2"
            HeightMeasurementStep.STEP_1_BASE_LOCKED -> "Base locked"
            HeightMeasurementStep.STEP_2_TOP_PREVIEW -> "Step 2 of 2"
            HeightMeasurementStep.STEP_2_TOP_CONFIRMED -> "Height locked"
            HeightMeasurementStep.STEP_ERROR_RETRY ->
                if (baseAnchor == null) {
                    "Base retry"
                } else {
                    "Top retry"
                }
        }
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

            val createdSession = try {
                Session(this)
            } catch (exception: CameraNotAvailableException) {
                cameraUnavailableWhileCreatingSession = true
                return false
            } catch (exception: SecurityException) {
                finishWithError(ERROR_AR_UNAVAILABLE, "Camera permission denied. Please grant camera access.")
                return false
            }

            configureSession(createdSession)
            session = createdSession
            cameraUnavailableWhileCreatingSession = false
            return true
        } catch (exception: Exception) {
            finishWithError(ERROR_AR_UNAVAILABLE, exception.message ?: "ARCore is unavailable on this device.")
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
                        finishWithError(ERROR_CAMERA_IN_USE, "Camera is still in use. Please wait a moment and try again.")
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
                    finishWithError(ERROR_CAMERA_IN_USE, "Camera became unavailable. Please try again.")
                }
            } catch (exception: Exception) {
                finishWithError(ERROR_AR_UNAVAILABLE, exception.message ?: "Unable to start AR measurement.")
            }
        }, delayMs)
    }

    private fun configureSession(arSession: Session) {
        val config = Config(arSession).apply {
            focusMode = Config.FocusMode.AUTO
            depthMode = when (measurementMode) {
                MeasurementMode.DIAMETER -> {
                    if (
                        requestedTier == 1 &&
                        arSession.isDepthModeSupported(Config.DepthMode.RAW_DEPTH_ONLY)
                    ) {
                        Config.DepthMode.RAW_DEPTH_ONLY
                    } else {
                        Config.DepthMode.DISABLED
                    }
                }

                MeasurementMode.HEIGHT -> {
                    when {
                        arSession.isDepthModeSupported(Config.DepthMode.AUTOMATIC) ->
                            Config.DepthMode.AUTOMATIC
                        arSession.isDepthModeSupported(Config.DepthMode.RAW_DEPTH_ONLY) ->
                            Config.DepthMode.RAW_DEPTH_ONLY
                        else -> Config.DepthMode.DISABLED
                    }
                }
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
        val now = SystemClock.elapsedRealtime()
        if (stageStartedAt == 0L) {
            stageStartedAt = now
        }

        val freshPoints = if (requestedTier == 1) {
            try {
                collectDepthPoints(frame)
            } catch (_: NotYetAvailableException) {
                emptyList()
            }
        } else {
            collectSlamPoints(frame)
        }

        if (requestedTier == 1 && freshPoints.isNotEmpty()) {
            depthWarmupFrames += 1
        }

        appendPoints(previewPoints, freshPoints, MAX_PREVIEW_POINTS)
        previewFit =
            TrunkMeasurementEngine.previewFit(
                points = previewPoints,
                tierUsed = requestedTier,
                scanDistanceM = lastScanDistanceM,
            )
        if (previewFit != null) {
            lockedPreviewFit = previewFit
            if (previewStableSince == 0L) {
                previewStableSince = now
            }
        } else {
            previewStableSince = 0L
        }

        when (diameterStage) {
            DiameterStage.WARMUP -> handleDiameterWarmup(now, frame)
            DiameterStage.LOCK -> handleDiameterLock(now, frame)
            DiameterStage.CAPTURE -> handleDiameterCapture(now, frame, freshPoints)
        }
    }

    private fun handleDiameterWarmup(now: Long, frame: Frame) {
        val hasPreview = previewFit != null
        val enoughWarmup = if (requestedTier == 1) depthWarmupFrames >= 3 else previewPoints.size >= 45
        val helper =
            if (requestedTier == 1) {
                "Center the trunk and move slightly so TerraTrust can lock the depth map."
            } else {
                "Center the trunk and move slightly to start the SLAM trunk lock."
            }
        postOverlayState(
            if (hasPreview) "Trunk detected" else "Find the trunk",
            helper,
            if (requestedTier == 1) min(35, depthWarmupFrames * 10) else min(30, previewPoints.size / 3),
        )
        renderDiameterOverlay(
            frame,
            showMotionGuide = false,
            motionProgress = 0f,
            stageBadge = if (hasPreview) "Locking trunk" else "Scan the trunk",
        )

        if (hasPreview && enoughWarmup && now - previewStableSince >= 650L) {
            diameterStage = DiameterStage.LOCK
            stageStartedAt = now
        }
    }

    private fun handleDiameterLock(now: Long, frame: Frame) {
        if (previewFit == null && lockedPreviewFit == null) {
            diameterStage = DiameterStage.WARMUP
            stageStartedAt = now
            return
        }

        postOverlayState(
            "Trunk detected",
            if (requestedTier == 1) {
                "Hold still while TerraTrust captures the trunk depth."
            } else {
                "Move left and right to scan the trunk across the reticle."
            },
            0,
        )
        renderDiameterOverlay(
            frame,
            showMotionGuide = requestedTier == 2,
            motionProgress = 0f,
            stageBadge = if (requestedTier == 1) "Get ready to hold" else "Get ready to scan",
        )

        if (now - stageStartedAt >= 350L) {
            beginDiameterCapture(now, frame.camera.pose)
            diameterStage = DiameterStage.CAPTURE
        }
    }

    private fun handleDiameterCapture(
        now: Long,
        frame: Frame,
        freshPoints: List<TrunkMeasurementEngine.WorldPoint>,
    ) {
        val activePreview = previewFit ?: lockedPreviewFit
        val clusteredPoints = filterPointsForActivePreview(freshPoints, activePreview)
        appendPoints(capturePoints, clusteredPoints, MAX_CAPTURE_POINTS)

        if (requestedTier == 1) {
            handleTier1Capture(now, frame)
            return
        }

        val referencePose = captureStartPose ?: frame.camera.pose.also { captureStartPose = it }
        val lateralOffset = lateralOffsetMeters(frame.camera.pose, referencePose)
        tier2MinLateral = min(tier2MinLateral, lateralOffset)
        tier2MaxLateral = max(tier2MaxLateral, lateralOffset)
        lastScanDistanceM = tier2MaxLateral - tier2MinLateral
        lastScanDurationMs = now - captureStartedAt
        val motionProgress = (lastScanDistanceM / TIER2_TARGET_SCAN_SPAN_M).coerceIn(0f, 1f)

        postOverlayState(
            if (motionProgress >= 1f) "Checking trunk fit" else "Scan the trunk",
            "Move left and right until the progress bar fills while keeping the trunk centered.",
            (motionProgress * 100f).toInt(),
        )
        renderDiameterOverlay(
            frame,
            showMotionGuide = true,
            motionProgress = motionProgress,
            stageBadge = if (motionProgress >= 1f) "Checking fit" else "Scan left and right",
        )

        if (lastScanDurationMs > 9000L && lastScanDistanceM < TIER2_MIN_SCAN_SPAN_M) {
            finishWithError(
                ERROR_INSUFFICIENT_SCAN_MOTION,
                "Move farther left and right while keeping the trunk centered, then try again.",
            )
            return
        }

        if (motionProgress >= 1f && capturePoints.size >= 70) {
            val fit =
                TrunkMeasurementEngine.fitVerticalCylinder(
                    points = capturePoints,
                    tierUsed = 2,
                    rawPointCount = capturePoints.size,
                    scanDistanceM = lastScanDistanceM,
                    scanDurationMs = lastScanDurationMs,
                )
            if (fit != null) {
                finishWithDiameterMeasurement(fit)
                return
            }
        }

        if (lastScanDurationMs >= TIER2_CAPTURE_TIMEOUT_MS) {
            if (capturePoints.size < 70) {
                finishWithError(
                    ERROR_INSUFFICIENT_POINTS,
                    "TerraTrust did not capture enough trunk points. Move closer and try again.",
                )
            } else {
                finishWithError(
                    ERROR_LOW_CONFIDENCE,
                    "TerraTrust could not confirm a tree trunk. Try a larger upright trunk and scan again.",
                )
            }
        }
    }

    private fun handleTier1Capture(now: Long, frame: Frame) {
        val referencePose = captureStartPose ?: frame.camera.pose.also { captureStartPose = it }
        val movement = translationDistanceMeters(frame.camera.pose, referencePose)
        if (movement > TIER1_MAX_HOLD_DRIFT_M) {
            beginDiameterCapture(now, frame.camera.pose)
            postOverlayState(
                "Hold still for 3 seconds",
                "TerraTrust lost the stable hold. Keep the phone steady on the trunk.",
                0,
            )
            renderDiameterOverlay(
                frame,
                showMotionGuide = false,
                motionProgress = 0f,
                stageBadge = "Re-lock trunk",
            )
            return
        }

        lastScanDistanceM = movement
        lastScanDurationMs = now - captureStartedAt
        val progress = (lastScanDurationMs.toFloat() / TIER1_CAPTURE_DURATION_MS).coerceIn(0f, 1f)

        postOverlayState(
            "Hold still for 3 seconds",
            "Keep the trunk centered while TerraTrust captures a stable depth fit.",
            (progress * 100f).toInt(),
        )
        renderDiameterOverlay(
            frame,
            showMotionGuide = false,
            motionProgress = progress,
            stageBadge = "Hold still",
        )

        if (lastScanDurationMs >= TIER1_CAPTURE_DURATION_MS) {
            val fit =
                TrunkMeasurementEngine.fitVerticalCylinder(
                    points = capturePoints,
                    tierUsed = 1,
                    rawPointCount = capturePoints.size,
                    scanDistanceM = lastScanDistanceM,
                    scanDurationMs = lastScanDurationMs,
                )
            if (fit != null) {
                finishWithDiameterMeasurement(fit)
                return
            }

            if (capturePoints.size < 180) {
                finishWithError(
                    ERROR_INSUFFICIENT_POINTS,
                    "TerraTrust did not capture enough trunk depth. Move closer to the trunk and try again.",
                )
            } else {
                finishWithError(
                    ERROR_LOW_CONFIDENCE,
                    "TerraTrust could not confirm a tree trunk. Hold the phone on a larger upright trunk and try again.",
                )
            }
        }
    }

    private fun beginDiameterCapture(now: Long, cameraPose: Pose) {
        capturePoints.clear()
        captureStartedAt = now
        captureStartPose = cameraPose
        tier2MinLateral = 0f
        tier2MaxLateral = 0f
        lastScanDistanceM = 0f
        lastScanDurationMs = 0L
    }

    private fun renderDiameterOverlay(
        frame: Frame,
        showMotionGuide: Boolean,
        motionProgress: Float,
        stageBadge: String,
    ) {
        val activeFit = previewFit ?: lockedPreviewFit
        if (activeFit == null) {
            overlayView.render(
                MeasurementOverlayView.State(
                    reticleLocked = false,
                    showMotionGuide = showMotionGuide,
                    motionGuideProgress = motionProgress,
                    stageBadge = stageBadge,
                ),
            )
            return
        }

        val projection = FloatArray(16)
        val view = FloatArray(16)
        frame.camera.getProjectionMatrix(projection, 0, 0.1f, 100f)
        frame.camera.getViewMatrix(view, 0)

        val cylinderHeight = max(0.32f, (activeFit.yMax - activeFit.yMin) + 0.12f)
        val yMin = activeFit.centerY - cylinderHeight / 2f
        val yMax = activeFit.centerY + cylinderHeight / 2f
        val topCircle =
            projectCircle(
                centerX = activeFit.centerX,
                centerZ = activeFit.centerZ,
                y = yMax,
                radius = activeFit.radiusM,
                view = view,
                projection = projection,
            )
        val bottomCircle =
            projectCircle(
                centerX = activeFit.centerX,
                centerZ = activeFit.centerZ,
                y = yMin,
                radius = activeFit.radiusM,
                view = view,
                projection = projection,
            )
        val sides =
            listOf(0f, 90f, 180f, 270f).mapNotNull { angleDegrees ->
                val angle = Math.toRadians(angleDegrees.toDouble()).toFloat()
                val x = activeFit.centerX + kotlin.math.cos(angle) * activeFit.radiusM
                val z = activeFit.centerZ + kotlin.math.sin(angle) * activeFit.radiusM
                val start = projectWorldPoint(floatArrayOf(x, yMin, z), view, projection)
                val end = projectWorldPoint(floatArrayOf(x, yMax, z), view, projection)
                if (start != null && end != null) start to end else null
            }

        overlayView.render(
            MeasurementOverlayView.State(
                reticleLocked = true,
                topCircle = topCircle,
                bottomCircle = bottomCircle,
                cylinderSides = sides,
                showMotionGuide = showMotionGuide,
                motionGuideProgress = motionProgress,
                stageBadge = stageBadge,
            ),
        )
    }

    private fun handleHeightFrame(frame: Frame) {
        val projection = FloatArray(16)
        val view = FloatArray(16)
        frame.camera.getProjectionMatrix(projection, 0, 0.1f, 100f)
        frame.camera.getViewMatrix(view, 0)
        val tap = pollHeightTap()

        if (baseAnchor == null) {
            heightStep = HeightMeasurementStep.STEP_1_BASE_TARGET

            if (tap != null) {
                val selectedBaseHit = selectBaseHit(frame, tap)
                if (selectedBaseHit == null) {
                    heightStep = HeightMeasurementWorkflow.nextStepForBaseCapture(success = false)
                    currentHeightPreview = null
                    showHeightTapFeedback(tap, isSuccess = false, label = "Try again")
                    postOverlayState(
                        "Step 1 of 2 — Mark the base",
                        "No tracked base point was found. Move slightly and tap the ground or trunk base again.",
                        null,
                    )
                    renderHeightOverlay(view, projection)
                    return
                }

                baseAnchor?.detach()
                baseAnchor = selectedBaseHit.hitResult.createAnchor()
                currentHeightPreview = null
                heightAimPoint = null
                heightStep = HeightMeasurementWorkflow.nextStepForBaseCapture(success = true)
                showHeightTapFeedback(
                    tap,
                    isSuccess = true,
                    label =
                        if (selectedBaseHit.kind == HeightBaseHitKind.DEPTH_POINT) {
                            "Base locked"
                        } else {
                            "Base marked"
                        },
                )
                postOverlayState(
                    "Base marked",
                    "TerraTrust locked the base. Touch the canopy top and lift your finger to confirm the height.",
                    null,
                )
                renderHeightOverlay(view, projection)
                return
            }

            postOverlayState(
                "Step 1 of 2 — Mark the base",
                "Tap the ground or trunk base to start the height measurement.",
                null,
            )
            renderHeightOverlay(view, projection)
            return
        }

        if (heightStep == HeightMeasurementStep.STEP_1_BASE_LOCKED) {
            heightStep = HeightMeasurementStep.STEP_2_TOP_PREVIEW
        } else if (heightStep == HeightMeasurementStep.STEP_ERROR_RETRY) {
            heightStep = HeightMeasurementWorkflow.stepAfterRetry(baseLocked = true)
        }

        currentHeightPreview = estimateHeightPreview(frame)
        if (currentHeightPreview != null) {
            postOverlayState(
                "Step 2 of 2 — Mark the top",
                if (currentHeightPreview?.isHitBased == true) {
                    "Touch the canopy top and lift your finger when the blue line matches the tree."
                } else {
                    "Touch near the canopy top. TerraTrust is showing a guided preview line."
                },
                null,
            )
        } else {
            postOverlayState(
                "Step 2 of 2 — Mark the top",
                "Touch near the canopy top and move slightly until the blue preview line appears.",
                null,
            )
        }
        renderHeightOverlay(view, projection)

        if (tap == null) {
            return
        }

        val finalPreview = estimateHeightFromTap(frame, tap)
        if (finalPreview == null) {
            heightStep = HeightMeasurementWorkflow.nextStepForTopAttempt(success = false)
            showHeightTapFeedback(tap, isSuccess = false, label = "Try again")
            postOverlayState(
                "Top point not locked",
                "Keep the touch point on the canopy top and try again when the blue line looks right.",
                null,
            )
            currentHeightPreview = estimateHeightPreview(frame)
            renderHeightOverlay(view, projection)
            return
        }

        heightStep = HeightMeasurementWorkflow.nextStepForTopAttempt(success = true)
        currentHeightPreview = finalPreview
        showHeightTapFeedback(tap, isSuccess = true, label = "Height locked")
        renderHeightOverlay(view, projection)
        finishWithHeightMeasurement(finalPreview.heightMetres)
    }

    private fun renderHeightOverlay(view: FloatArray, projection: FloatArray) {
        val basePose = baseAnchor?.pose
        if (basePose == null) {
            overlayView.render(
                MeasurementOverlayView.State(
                    heightStep = heightStep,
                    stageBadge = heightStageBadge(),
                    activeAimPoint = heightAimPoint?.let { PointF(it.x, it.y) },
                    tapFeedbacks = activeTapFeedbacks(),
                ),
            )
            return
        }

        val baseWorld = floatArrayOf(basePose.tx(), basePose.ty(), basePose.tz())
        val baseMarker = projectWorldPoint(baseWorld, view, projection)
        val preview = currentHeightPreview
        val projectedTopMarker =
            preview?.let { heightPreview ->
                projectWorldPoint(heightPreview.topWorldPoint, view, projection)
            }
        val topMarker =
            if (heightStep == HeightMeasurementStep.STEP_2_TOP_CONFIRMED) {
                projectedTopMarker
            } else {
                null
            }
        val ghostTopMarker =
            if (heightStep != HeightMeasurementStep.STEP_2_TOP_CONFIRMED) {
                projectedTopMarker
            } else {
                null
            }
        val heightLine =
            if (baseMarker != null && (topMarker != null || ghostTopMarker != null)) {
                baseMarker to (topMarker ?: ghostTopMarker!!)
            } else {
                null
            }

        overlayView.render(
            MeasurementOverlayView.State(
                reticleLocked = preview != null,
                baseMarker = baseMarker,
                topMarker = topMarker,
                ghostTopMarker = ghostTopMarker,
                heightLine = heightLine,
                heightLabel = preview?.let { "${String.format(Locale.US, "%.1f", it.heightMetres)} m" },
                heightStep = heightStep,
                stageBadge = heightStageBadge(),
                activeAimPoint = heightAimPoint?.let { PointF(it.x, it.y) },
                tapFeedbacks = activeTapFeedbacks(),
            ),
        )
    }

    private fun estimateHeightPreview(frame: Frame): HeightPreview? {
        val aimPoint = heightAimPoint ?: return null
        return estimateHeightFromTap(frame, aimPoint)
    }

    private fun estimateHeightFromTap(frame: Frame, tap: PointF): HeightPreview? {
        val basePose = baseAnchor?.pose ?: return null
        val sceneHitPreview = estimateHeightFromSceneHit(frame, tap)
        if (sceneHitPreview != null) {
            return sceneHitPreview
        }

        val ray = createWorldRay(frame, tap) ?: return null
        val base = floatArrayOf(basePose.tx(), basePose.ty(), basePose.tz())
        val rayEstimate =
            HeightMeasurementMath.estimateHeightFromRay(
                baseWorldPoint = base,
                rayOrigin = ray.origin,
                rayDirection = ray.direction,
            ) ?: return null

        return HeightPreview(
            heightMetres = rayEstimate.heightMetres,
            topWorldPoint = rayEstimate.topWorldPoint,
            isHitBased = false,
            sourceLabel = "Guided preview",
        )
    }

    private fun selectBaseHit(frame: Frame, tap: PointF): HeightHitCandidate? {
        val candidates =
            frame.hitTest(tap.x, tap.y)
                .mapNotNull(::mapBaseHitCandidate)
        val bestKind =
            HeightMeasurementWorkflow.selectBestBaseHitKind(
                candidates.map { it.kind },
            ) ?: return null

        return candidates.firstOrNull { it.kind == bestKind }
    }

    private fun mapBaseHitCandidate(result: HitResult): HeightHitCandidate? {
        return when (val trackable = result.trackable) {
            is DepthPoint -> HeightHitCandidate(HeightBaseHitKind.DEPTH_POINT, result)
            is Plane ->
                if (trackable.isPoseInPolygon(result.hitPose)) {
                    HeightHitCandidate(
                        if (trackable.type == Plane.Type.HORIZONTAL_UPWARD_FACING) {
                            HeightBaseHitKind.HORIZONTAL_PLANE
                        } else {
                            HeightBaseHitKind.OTHER_PLANE
                        },
                        result,
                    )
                } else {
                    null
                }

            is Point -> HeightHitCandidate(HeightBaseHitKind.FEATURE_POINT, result)
            else -> null
        }
    }

    private fun estimateHeightFromSceneHit(frame: Frame, tap: PointF): HeightPreview? {
        val basePose = baseAnchor?.pose ?: return null
        val baseWorld = floatArrayOf(basePose.tx(), basePose.ty(), basePose.tz())
        val candidates =
            frame.hitTest(tap.x, tap.y)
                .mapNotNull(::mapBaseHitCandidate)

        val bestHit =
            candidates.firstOrNull {
                it.kind == HeightBaseHitKind.DEPTH_POINT &&
                    isValidTopHitPose(it.hitResult.hitPose, baseWorld)
            } ?: candidates.firstOrNull {
                it.kind == HeightBaseHitKind.FEATURE_POINT &&
                    isValidTopHitPose(it.hitResult.hitPose, baseWorld)
            } ?: candidates.firstOrNull {
                (it.kind == HeightBaseHitKind.HORIZONTAL_PLANE || it.kind == HeightBaseHitKind.OTHER_PLANE) &&
                    isValidTopHitPose(it.hitResult.hitPose, baseWorld)
            } ?: return null

        val hitPose = bestHit.hitResult.hitPose
        val hitWorldPoint = floatArrayOf(hitPose.tx(), hitPose.ty(), hitPose.tz())
        val heightMetres = abs(hitWorldPoint[1] - baseWorld[1])
        if (heightMetres < 0.5f || heightMetres > 80f) {
            return null
        }

        return HeightPreview(
            heightMetres = heightMetres,
            topWorldPoint = hitWorldPoint,
            isHitBased = true,
            sourceLabel =
                if (bestHit.kind == HeightBaseHitKind.DEPTH_POINT) {
                    "Depth locked"
                } else {
                    "Scene hit"
                },
        )
    }

    private fun isValidTopHitPose(
        pose: Pose,
        baseWorldPoint: FloatArray,
    ): Boolean {
        val heightMetres = abs(pose.ty() - baseWorldPoint[1])
        if (heightMetres < 0.5f || heightMetres > 80f) {
            return false
        }

        val horizontalDistance =
            distanceXZ(
                pose.tx(),
                pose.tz(),
                baseWorldPoint[0],
                baseWorldPoint[2],
            )
        val maxHorizontalDistance = max(1.2f, heightMetres * 0.55f)
        return horizontalDistance <= maxHorizontalDistance
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
        val direction =
            normalised(
                floatArrayOf(
                    far[0] - near[0],
                    far[1] - near[1],
                    far[2] - near[2],
                ),
            ) ?: return null

        return WorldRay(origin = near, direction = direction)
    }

    private fun collectDepthPoints(frame: Frame): List<TrunkMeasurementEngine.WorldPoint> {
        val depthImage = frame.acquireRawDepthImage16Bits()
        val confidenceImage = frame.acquireRawDepthConfidenceImage()
        try {
            if (depthImage.timestamp == lastRawDepthTimestamp) {
                return emptyList()
            }
            lastRawDepthTimestamp = depthImage.timestamp

            val depthPlane = depthImage.planes[0]
            val confidencePlane = confidenceImage.planes[0]
            val depthBuffer = depthPlane.buffer.duplicate().order(ByteOrder.LITTLE_ENDIAN)
            val confidenceBuffer = confidencePlane.buffer.duplicate()
            val width = depthImage.width
            val height = depthImage.height

            val roiView = floatArrayOf(0.40f, 0.20f, 0.60f, 0.80f)
            val roiTexture = FloatArray(4)
            frame.transformCoordinates2d(
                Coordinates2d.VIEW_NORMALIZED,
                roiView,
                Coordinates2d.TEXTURE_NORMALIZED,
                roiTexture,
            )

            val xStart =
                (min(roiTexture[0], roiTexture[2]).coerceIn(0f, 1f) * width).toInt().coerceIn(0, width - 1)
            val xEnd =
                (max(roiTexture[0], roiTexture[2]).coerceIn(0f, 1f) * width).toInt().coerceIn(xStart + 1, width)
            val yStart =
                (min(roiTexture[1], roiTexture[3]).coerceIn(0f, 1f) * height).toInt().coerceIn(0, height - 1)
            val yEnd =
                (max(roiTexture[1], roiTexture[3]).coerceIn(0f, 1f) * height).toInt().coerceIn(yStart + 1, height)

            val intrinsics = frame.camera.textureIntrinsics
            val imageWidth = intrinsics.imageDimensions[0].toFloat().coerceAtLeast(1f)
            val imageHeight = intrinsics.imageDimensions[1].toFloat().coerceAtLeast(1f)
            val fx = intrinsics.focalLength[0] * width.toFloat() / imageWidth
            val fy = intrinsics.focalLength[1] * height.toFloat() / imageHeight
            val cx = intrinsics.principalPoint[0] * width.toFloat() / imageWidth
            val cy = intrinsics.principalPoint[1] * height.toFloat() / imageHeight
            val cameraMatrix = FloatArray(16)
            frame.camera.pose.toMatrix(cameraMatrix, 0)
            val previewCenter = previewFit ?: lockedPreviewFit
            val sampleStep = if ((xEnd - xStart) * (yEnd - yStart) > 70000) 3 else 2

            val cameraPoint = FloatArray(4)
            val worldPoint = FloatArray(4)
            val points = mutableListOf<TrunkMeasurementEngine.WorldPoint>()
            for (y in yStart until yEnd step sampleStep) {
                for (x in xStart until xEnd step sampleStep) {
                    val confidenceOffset =
                        y * confidencePlane.rowStride + x * confidencePlane.pixelStride
                    val confidence = confidenceBuffer.get(confidenceOffset).toInt() and 0xFF
                    if (confidence < 150) {
                        continue
                    }

                    val depthOffset = y * depthPlane.rowStride + x * depthPlane.pixelStride
                    val depthMillimetres = depthBuffer.getShort(depthOffset).toInt() and 0xFFFF
                    if (depthMillimetres <= 0 || depthMillimetres > 4500) {
                        continue
                    }

                    val depthMetres = depthMillimetres / 1000f
                    cameraPoint[0] = depthMetres * (x - cx) / fx
                    cameraPoint[1] = depthMetres * (cy - y) / fy
                    cameraPoint[2] = -depthMetres
                    cameraPoint[3] = 1f
                    Matrix.multiplyMV(worldPoint, 0, cameraMatrix, 0, cameraPoint, 0)

                    if (previewCenter != null) {
                        val horizontalDistance =
                            distanceXZ(
                                worldPoint[0],
                                worldPoint[2],
                                previewCenter.centerX,
                                previewCenter.centerZ,
                            )
                        if (horizontalDistance > max(0.22f, previewCenter.radiusM * 2.2f)) {
                            continue
                        }
                    }

                    points.add(
                        TrunkMeasurementEngine.WorldPoint(
                            x = worldPoint[0],
                            y = worldPoint[1],
                            z = worldPoint[2],
                            confidence = confidence / 255f,
                        ),
                    )
                }
            }

            return points
        } finally {
            confidenceImage.close()
            depthImage.close()
        }
    }

    private fun collectSlamPoints(frame: Frame): List<TrunkMeasurementEngine.WorldPoint> {
        val pointCloud: PointCloud = frame.acquirePointCloud()
        try {
            val previewCenter = previewFit ?: lockedPreviewFit
            val cameraPose = frame.camera.pose
            val pointBuffer = pointCloud.points
            pointBuffer.rewind()
            val points = mutableListOf<TrunkMeasurementEngine.WorldPoint>()

            while (pointBuffer.remaining() >= 4) {
                val worldX = pointBuffer.get()
                val worldY = pointBuffer.get()
                val worldZ = pointBuffer.get()
                val confidence = pointBuffer.get()
                if (confidence < 0.35f) {
                    continue
                }

                val cameraPoint = cameraPose.inverse().transformPoint(floatArrayOf(worldX, worldY, worldZ))
                val depthMetres = -cameraPoint[2]
                if (depthMetres < 0.6f || depthMetres > 4.5f) {
                    continue
                }

                val horizontalRatio = abs(cameraPoint[0] / depthMetres)
                val verticalRatio = abs(cameraPoint[1] / depthMetres)
                if (horizontalRatio > 0.26f || verticalRatio > 0.62f) {
                    continue
                }

                if (previewCenter != null) {
                    val horizontalDistance = distanceXZ(worldX, worldZ, previewCenter.centerX, previewCenter.centerZ)
                    if (horizontalDistance > max(0.22f, previewCenter.radiusM * 2.2f)) {
                        continue
                    }
                }

                points.add(
                    TrunkMeasurementEngine.WorldPoint(
                        x = worldX,
                        y = worldY,
                        z = worldZ,
                        confidence = confidence,
                    ),
                )
            }

            return points
        } finally {
            pointCloud.close()
        }
    }

    private fun filterPointsForActivePreview(
        points: List<TrunkMeasurementEngine.WorldPoint>,
        activePreview: TrunkMeasurementEngine.PreviewFit?,
    ): List<TrunkMeasurementEngine.WorldPoint> {
        if (activePreview == null) {
            return points
        }

        val horizontalWindow = max(0.22f, activePreview.radiusM * 2.3f)
        val yMin = activePreview.centerY - 0.7f
        val yMax = activePreview.centerY + 0.7f
        return points.filter { point ->
            point.y in yMin..yMax &&
                distanceXZ(point.x, point.z, activePreview.centerX, activePreview.centerZ) <= horizontalWindow
        }
    }

    private fun appendPoints(
        target: MutableList<TrunkMeasurementEngine.WorldPoint>,
        newPoints: List<TrunkMeasurementEngine.WorldPoint>,
        maxSize: Int,
    ) {
        if (newPoints.isEmpty()) {
            return
        }

        target.addAll(newPoints)
        if (target.size > maxSize) {
            target.subList(0, target.size - maxSize).clear()
        }
    }

    private fun resetDiameterState() {
        diameterStage = DiameterStage.WARMUP
        stageStartedAt = 0L
        previewStableSince = 0L
        captureStartedAt = 0L
        captureStartPose = null
        depthWarmupFrames = 0
        lastRawDepthTimestamp = -1L
        previewPoints.clear()
        capturePoints.clear()
        previewFit = null
        lockedPreviewFit = null
        tier2MinLateral = 0f
        tier2MaxLateral = 0f
        lastScanDistanceM = 0f
        lastScanDurationMs = 0L
    }

    private fun finishWithDiameterMeasurement(fit: TrunkMeasurementEngine.CylinderFit) {
        if (measurementCompleted) {
            return
        }

        Log.d(
            TAG,
            "Diameter success tier=${fit.tierUsed} diameter=${fit.diameterCm}cm confidence=${fit.confidence} inliers=${fit.inlierCount} residual=${fit.residualCm}cm span=${fit.scanDistanceM}",
        )
        measurementCompleted = true
        runOnUiThread {
            val json =
                JSONObject().apply {
                    put("diameter_cm", roundToDecimals(fit.diameterCm, 1))
                    put("confidence", roundToDecimals(fit.confidence, 3))
                    put("tier_used", fit.tierUsed)
                    put("point_count", fit.pointCount)
                    put("raw_point_count", fit.rawPointCount)
                    put("filtered_point_count", fit.filteredPointCount)
                    put("inlier_count", fit.inlierCount)
                    put("residual_cm", roundToDecimals(fit.residualCm, 1))
                    put("scan_distance_m", roundToDecimals(fit.scanDistanceM, 2))
                    put("scan_duration_ms", fit.scanDurationMs)
                    put("fit_method", fit.fitMethod)
                }.toString()
            val intent = Intent().putExtra(EXTRA_MEASUREMENT_JSON, json)
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

    private fun finishWithError(errorCode: String, message: String) {
        if (measurementCompleted) {
            return
        }

        Log.w(TAG, "Measurement failed code=$errorCode message=$message")
        measurementCompleted = true
        runOnUiThread {
            val intent =
                Intent()
                    .putExtra(EXTRA_ERROR_CODE, errorCode)
                    .putExtra(EXTRA_ERROR_MESSAGE, message)
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

    private fun projectCircle(
        centerX: Float,
        centerZ: Float,
        y: Float,
        radius: Float,
        view: FloatArray,
        projection: FloatArray,
    ): List<PointF> {
        val points = mutableListOf<PointF>()
        val segments = 18
        for (index in 0 until segments) {
            val angle = Math.PI * 2.0 * index.toDouble() / segments.toDouble()
            val x = centerX + kotlin.math.cos(angle).toFloat() * radius
            val z = centerZ + kotlin.math.sin(angle).toFloat() * radius
            val projected = projectWorldPoint(floatArrayOf(x, y, z), view, projection) ?: continue
            points.add(projected)
        }
        return points
    }

    private fun projectWorldPoint(
        worldPoint: FloatArray,
        view: FloatArray,
        projection: FloatArray,
    ): PointF? {
        if (viewportWidth <= 0 || viewportHeight <= 0) {
            return null
        }

        val worldVector = floatArrayOf(worldPoint[0], worldPoint[1], worldPoint[2], 1f)
        val cameraVector = FloatArray(4)
        val clipVector = FloatArray(4)
        Matrix.multiplyMV(cameraVector, 0, view, 0, worldVector, 0)
        if (cameraVector[2] >= -0.05f) {
            return null
        }

        Matrix.multiplyMV(clipVector, 0, projection, 0, cameraVector, 0)
        if (abs(clipVector[3]) < 0.00001f) {
            return null
        }

        val ndcX = clipVector[0] / clipVector[3]
        val ndcY = clipVector[1] / clipVector[3]
        return PointF(
            ((ndcX + 1f) * 0.5f) * viewportWidth.toFloat(),
            ((1f - ndcY) * 0.5f) * viewportHeight.toFloat(),
        )
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
        val length =
            sqrt(
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

    private fun distanceXZ(x: Float, z: Float, centerX: Float, centerZ: Float): Float {
        val dx = x - centerX
        val dz = z - centerZ
        return sqrt(dx * dx + dz * dz)
    }

    private fun translationDistanceMeters(first: Pose, second: Pose): Float {
        val dx = first.tx() - second.tx()
        val dy = first.ty() - second.ty()
        val dz = first.tz() - second.tz()
        return sqrt(dx * dx + dy * dy + dz * dz)
    }

    private fun lateralOffsetMeters(currentPose: Pose, referencePose: Pose): Float {
        val referenceMatrix = FloatArray(16)
        referencePose.toMatrix(referenceMatrix, 0)
        val dx = currentPose.tx() - referencePose.tx()
        val dy = currentPose.ty() - referencePose.ty()
        val dz = currentPose.tz() - referencePose.tz()
        val rightX = referenceMatrix[0]
        val rightY = referenceMatrix[1]
        val rightZ = referenceMatrix[2]
        return dx * rightX + dy * rightY + dz * rightZ
    }

    private fun roundToDecimals(value: Float, decimals: Int): Double {
        val factor = 10.0.pow(decimals.toDouble())
        return kotlin.math.round(value.toDouble() * factor) / factor
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

        private val quadVertices: FloatBuffer =
            allocateFloatBuffer(
                floatArrayOf(
                    -1f, -1f,
                    1f, -1f,
                    -1f, 1f,
                    1f, 1f,
                ),
            )
        private val quadTextureCoordinates: FloatBuffer =
            allocateFloatBuffer(
                floatArrayOf(
                    0f, 1f,
                    1f, 1f,
                    0f, 0f,
                    1f, 0f,
                ),
            )
        private val transformedTextureCoordinates: FloatBuffer =
            allocateFloatBuffer(
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

            val vertexShader =
                loadShader(
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
            val fragmentShader =
                loadShader(
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
