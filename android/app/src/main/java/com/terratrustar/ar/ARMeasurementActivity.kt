package com.terratrustar.ar

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.PointF
import android.graphics.drawable.GradientDrawable
import android.opengl.GLES11Ext
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.os.Bundle
import android.os.SystemClock
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
import kotlin.math.sqrt
import kotlin.random.Random

class ARMeasurementActivity : AppCompatActivity(), GLSurfaceView.Renderer {

    companion object {
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

    @Volatile
    private var pendingTap: PointF? = null

    private var baseAnchor: Anchor? = null

    private var lastStatusText: String? = null
    private var lastHelperText: String? = null
    private var lastProgressValue: Int? = null
    private var wasProgressVisible = false

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

        if (!ensureSession()) {
            return
        }

        glSurfaceView.onResume()

        try {
            session?.resume()
        } catch (exception: CameraNotAvailableException) {
            finishWithError("Camera became unavailable. Please try again.")
        } catch (exception: Exception) {
            finishWithError(exception.message ?: "Unable to start AR measurement.")
        }
    }

    override fun onPause() {
        try {
            session?.pause()
        } catch (_: Exception) {
        }

        glSurfaceView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
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
            return true
        }

        try {
            when (ArCoreApk.getInstance().requestInstall(this, !installRequested)) {
                ArCoreApk.InstallStatus.INSTALL_REQUESTED -> {
                    installRequested = true
                    return false
                }

                ArCoreApk.InstallStatus.INSTALLED -> {
                    installRequested = false
                }
            }

            val createdSession = Session(this)
            configureSession(createdSession)
            session = createdSession
            return true
        } catch (exception: Exception) {
            finishWithError(exception.message ?: "ARCore is unavailable on this device.")
            return false
        }
    }

    private fun configureSession(arSession: Session) {
        val config = Config(arSession).apply {
            focusMode = Config.FocusMode.AUTO
            depthMode = if (
                requestedTier == 1 &&
                arSession.isDepthModeSupported(Config.DepthMode.RAW_DEPTH_ONLY)
            ) {
                Config.DepthMode.RAW_DEPTH_ONLY
            } else {
                Config.DepthMode.DISABLED
            }
            planeFindingMode = if (measurementMode == MeasurementMode.HEIGHT) {
                Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL
            } else {
                Config.PlaneFindingMode.DISABLED
            }
        }

        arSession.configure(config)
    }

    private fun handleDiameterFrame(frame: Frame) {
        if (measurementStartedAt == 0L) {
            measurementStartedAt = SystemClock.elapsedRealtime()
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

        if (requestedTier == 2) {
            collectSlamPointCloud(frame)
        }

        if (elapsedMs < durationMs) {
            return
        }

        val resultJson = if (requestedTier == 1) {
            try {
                val depthPoints = collectDepthPoints(frame)
                if (depthPoints.size < 50) {
                    finishWithError("Not enough depth data. Move closer and try again.")
                    return
                }
                fitCylinder(depthPoints, 1)
            } catch (_: NotYetAvailableException) {
                finishWithError("Depth data is not ready yet. Hold steady and try again.")
                return
            }
        } else {
            if (slamPointCloud.size < 50) {
                finishWithError("Not enough AR tracking data. Move slowly and try again.")
                return
            }
            fitCylinder(slamPointCloud, 2)
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
                if (baseAnchor == null) {
                    "Tap the base of the tree"
                } else {
                    "Tap the top of the tree"
                },
                "No AR surface was detected there. Tap again more precisely.",
                null,
            )
            return
        }

        val anchor = hitResult.createAnchor()
        if (baseAnchor == null) {
            baseAnchor?.detach()
            baseAnchor = anchor
            postOverlayState(
                "Base marked",
                "Now tap near the top of the tree.",
                null,
            )
            return
        }

        val heightMetres = abs(anchor.pose.ty() - (baseAnchor?.pose?.ty() ?: 0f))
        if (heightMetres < 0.5f || heightMetres > 80f) {
            anchor.detach()
            postOverlayState(
                "Height looks unusual",
                "Tap again more precisely at the top of the tree.",
                null,
            )
            return
        }

        finishWithHeightMeasurement(heightMetres)
    }

    private fun collectDepthPoints(frame: Frame): List<FloatArray> {
        val depthImage = frame.acquireRawDepthImage16Bits()
        try {
            val width = depthImage.width
            val height = depthImage.height
            val depthBuffer = depthImage.planes[0].buffer.duplicate().order(ByteOrder.nativeOrder())
            val intrinsics = frame.camera.imageIntrinsics
            val fx = intrinsics.focalLength[0]
            val fy = intrinsics.focalLength[1]
            val cx = intrinsics.principalPoint[0]
            val cy = intrinsics.principalPoint[1]

            val xStart = (width * 0.35f).toInt()
            val xEnd = (width * 0.65f).toInt()
            val yStart = (height * 0.20f).toInt()
            val yEnd = (height * 0.80f).toInt()

            val points = mutableListOf<FloatArray>()
            for (y in yStart until yEnd) {
                for (x in xStart until xEnd) {
                    val depthMillimetres = depthBuffer.getShort((y * width + x) * 2).toInt() and 0xFFFF
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
            depthImage.close()
        }
    }

    private fun collectSlamPointCloud(frame: Frame) {
        val pointCloud: PointCloud = frame.acquirePointCloud()
        try {
            val pointBuffer = pointCloud.points
            pointBuffer.rewind()

            while (pointBuffer.remaining() >= 4) {
                val x = pointBuffer.get()
                val y = pointBuffer.get()
                val z = pointBuffer.get()
                val confidence = pointBuffer.get()
                if (confidence > 0.3f) {
                    slamPointCloud.add(floatArrayOf(x, y, z))
                }
            }
        } finally {
            pointCloud.close()
        }
    }

    private fun fitCylinder(points: List<FloatArray>, tierUsed: Int): String? {
        if (points.size < 50) {
            return null
        }

        var bestInliers = 0
        var bestRadius = 0.0f
        val totalPoints = points.size
        val epsilon = 0.02f

        repeat(100) {
            val firstIndex = Random.nextInt(totalPoints)
            var secondIndex = Random.nextInt(totalPoints)
            while (secondIndex == firstIndex) {
                secondIndex = Random.nextInt(totalPoints)
            }
            var thirdIndex = Random.nextInt(totalPoints)
            while (thirdIndex == firstIndex || thirdIndex == secondIndex) {
                thirdIndex = Random.nextInt(totalPoints)
            }

            val firstPoint = points[firstIndex]
            val secondPoint = points[secondIndex]
            val thirdPoint = points[thirdIndex]

            val axisX = secondPoint[0] - firstPoint[0]
            val axisY = secondPoint[1] - firstPoint[1]
            val axisZ = secondPoint[2] - firstPoint[2]
            val axisLength = sqrt(axisX * axisX + axisY * axisY + axisZ * axisZ)
            if (axisLength < 0.01f) {
                return@repeat
            }

            val normalisedAxisX = axisX / axisLength
            val normalisedAxisY = axisY / axisLength
            val normalisedAxisZ = axisZ / axisLength

            val offsetX = thirdPoint[0] - firstPoint[0]
            val offsetY = thirdPoint[1] - firstPoint[1]
            val offsetZ = thirdPoint[2] - firstPoint[2]
            val axisProjection = offsetX * normalisedAxisX + offsetY * normalisedAxisY + offsetZ * normalisedAxisZ
            val projectedX = offsetX - axisProjection * normalisedAxisX
            val projectedY = offsetY - axisProjection * normalisedAxisY
            val projectedZ = offsetZ - axisProjection * normalisedAxisZ
            val radius = sqrt(projectedX * projectedX + projectedY * projectedY + projectedZ * projectedZ)

            if (radius < 0.025f || radius > 1.0f) {
                return@repeat
            }

            var inlierCount = 0
            for (point in points) {
                val pointOffsetX = point[0] - firstPoint[0]
                val pointOffsetY = point[1] - firstPoint[1]
                val pointOffsetZ = point[2] - firstPoint[2]
                val pointProjection =
                    pointOffsetX * normalisedAxisX +
                        pointOffsetY * normalisedAxisY +
                        pointOffsetZ * normalisedAxisZ
                val distanceX = pointOffsetX - pointProjection * normalisedAxisX
                val distanceY = pointOffsetY - pointProjection * normalisedAxisY
                val distanceZ = pointOffsetZ - pointProjection * normalisedAxisZ
                val distance = sqrt(distanceX * distanceX + distanceY * distanceY + distanceZ * distanceZ)
                if (abs(distance - radius) < epsilon) {
                    inlierCount += 1
                }
            }

            if (inlierCount > bestInliers) {
                bestInliers = inlierCount
                bestRadius = radius
            }
        }

        if (bestInliers < 50 || bestRadius == 0.0f) {
            return null
        }

        val confidence = bestInliers.toFloat() / totalPoints.toFloat()
        val diameterCentimetres = bestRadius * 2 * 100
        return """{"diameter_cm":${String.format(Locale.US, "%.1f", diameterCentimetres)},"confidence":${String.format(Locale.US, "%.3f", confidence)},"tier_used":$tierUsed,"point_count":$totalPoints}"""
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