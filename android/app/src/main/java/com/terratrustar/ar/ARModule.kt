package com.terratrustar.ar

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.ar.core.ArCoreApk
import com.google.ar.core.Config
import com.google.ar.core.Frame
import com.google.ar.core.Session
import com.google.ar.core.exceptions.CameraNotAvailableException
import com.google.ar.core.exceptions.UnavailableApkTooOldException
import com.google.ar.core.exceptions.UnavailableArcoreNotInstalledException
import com.google.ar.core.exceptions.UnavailableDeviceNotCompatibleException
import com.google.ar.core.exceptions.UnavailableSdkTooOldException
import com.google.ar.core.exceptions.UnavailableUserDeclinedInstallationException
import org.tensorflow.lite.Interpreter
import java.io.File
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel
import kotlin.math.sqrt
import kotlin.random.Random
import java.util.Locale

class ARModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "TerraTrustAR"
        private const val DIAMETER_MEASUREMENT_REQUEST_CODE = 44001
        private const val HEIGHT_MEASUREMENT_REQUEST_CODE = 44002
        private const val ARCORE_AVAILABILITY_MAX_ATTEMPTS = 4
        private const val ARCORE_AVAILABILITY_RETRY_DELAY_MS = 150L
    }

    override fun getName(): String = "ARModule"

    private val tfliteInterpreter: Interpreter? by lazy {
        createInterpreterOrNull()
    }

    private val approvedSpecies = listOf(
        "Teak", "Eucalyptus", "Neem", "Mango", "Bamboo",
        "Pongamia", "Subabul", "Casuarina", "Indian Rosewood",
        "Drumstick", "Amla"
    )

    private var pendingDiameterPromise: Promise? = null
    private var pendingHeightPromise: Promise? = null

    private val activityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(
            activity: Activity,
            requestCode: Int,
            resultCode: Int,
            data: Intent?
        ) {
            when (requestCode) {
                DIAMETER_MEASUREMENT_REQUEST_CODE -> {
                    val promise = pendingDiameterPromise ?: return
                    pendingDiameterPromise = null
                    if (resultCode == Activity.RESULT_OK) {
                        val measurementJson = data?.getStringExtra(ARMeasurementActivity.EXTRA_MEASUREMENT_JSON)
                        if (measurementJson.isNullOrBlank()) {
                            promise.reject("MEASUREMENT_ERROR", "AR diameter measurement returned no result.")
                        } else {
                            promise.resolve(measurementJson)
                        }
                    } else {
                        val errorCode = data?.getStringExtra(ARMeasurementActivity.EXTRA_ERROR_CODE)
                        val errorMsg = data?.getStringExtra(ARMeasurementActivity.EXTRA_ERROR_MESSAGE)
                        if (errorMsg.isNullOrBlank()) {
                            // No error message = user pressed back — signal a cancellation so the
                            // React Native layer can handle it silently (no 'failed' alert shown).
                            promise.reject("MEASUREMENT_CANCELLED", "AR diameter measurement was cancelled.")
                        } else {
                            promise.reject(errorCode ?: "MEASUREMENT_ERROR", errorMsg)
                        }
                    }
                }

                HEIGHT_MEASUREMENT_REQUEST_CODE -> {
                    val promise = pendingHeightPromise ?: return
                    pendingHeightPromise = null
                    if (resultCode == Activity.RESULT_OK) {
                        val heightMetres = data?.getDoubleExtra(
                            ARMeasurementActivity.EXTRA_HEIGHT_METRES,
                            Double.NaN,
                        ) ?: Double.NaN
                        if (heightMetres.isNaN()) {
                            promise.reject("HEIGHT_CAPTURE_FAILED", "AR height measurement returned no result.")
                        } else {
                            promise.resolve(
                                """{"height_m":${String.format(Locale.US, "%.2f", heightMetres)}}"""
                            )
                        }
                    } else {
                        val errorCode = data?.getStringExtra(ARMeasurementActivity.EXTRA_ERROR_CODE)
                        val errorMsg = data?.getStringExtra(ARMeasurementActivity.EXTRA_ERROR_MESSAGE)
                        if (errorMsg.isNullOrBlank()) {
                            // No error message = user pressed back — treat as a cancellation, not a failure
                            promise.reject("HEIGHT_CAPTURE_CANCELLED", "AR height measurement was cancelled.")
                        } else {
                            promise.reject(errorCode ?: "HEIGHT_CAPTURE_FAILED", errorMsg)
                        }
                    }
                }
            }
        }
    }

    init {
        reactContext.addActivityEventListener(activityEventListener)
    }

    private fun loadModelFromAssets(filename: String): MappedByteBuffer {
        val fileDescriptor = reactContext.assets.openFd(filename)
        if (fileDescriptor.declaredLength <= 0L) {
            throw IllegalStateException("Species model asset is empty.")
        }

        val inputStream = FileInputStream(fileDescriptor.fileDescriptor)
        val fileChannel = inputStream.channel
        val startOffset = fileDescriptor.startOffset
        val declaredLength = fileDescriptor.declaredLength
        return fileChannel.map(FileChannel.MapMode.READ_ONLY, startOffset, declaredLength)
    }

    private fun createInterpreterOrNull(): Interpreter? {
        return try {
            val modelBuffer = loadModelFromAssets("species_model.tflite")
            Interpreter(modelBuffer, Interpreter.Options().apply { setNumThreads(4) })
        } catch (error: Exception) {
            Log.w(TAG, "Species model unavailable: ${error.message}")
            null
        }
    }

    // ---- T011: checkDepthSupport ----

    @ReactMethod
    fun checkDepthSupport(promise: Promise) {
        val arCore = ArCoreApk.getInstance()
        var availability = arCore.checkAvailability(reactContext)

        try {
            var attempts = 0
            while (
                availability.isTransient &&
                attempts < ARCORE_AVAILABILITY_MAX_ATTEMPTS
            ) {
                Thread.sleep(ARCORE_AVAILABILITY_RETRY_DELAY_MS)
                availability = arCore.checkAvailability(reactContext)
                attempts += 1
            }

            if (availability.isTransient) {
                Log.d(TAG, "ARCore availability still transient (${availability.name}); support=CHECKING")
                promise.resolve("CHECKING")
                return
            }

            when (availability) {
                ArCoreApk.Availability.SUPPORTED_NOT_INSTALLED -> {
                    Log.d(TAG, "ARCore availability=${availability.name} support=ARCORE_INSTALL_REQUIRED")
                    promise.resolve("ARCORE_INSTALL_REQUIRED")
                    return
                }

                ArCoreApk.Availability.SUPPORTED_APK_TOO_OLD -> {
                    Log.d(TAG, "ARCore availability=${availability.name} support=ARCORE_UPDATE_REQUIRED")
                    promise.resolve("ARCORE_UPDATE_REQUIRED")
                    return
                }

                ArCoreApk.Availability.UNSUPPORTED_DEVICE_NOT_CAPABLE -> {
                    Log.d(TAG, "ARCore availability=${availability.name} support=UNSUPPORTED")
                    promise.resolve("UNSUPPORTED")
                    return
                }

                ArCoreApk.Availability.UNKNOWN_ERROR,
                ArCoreApk.Availability.UNKNOWN_TIMED_OUT -> {
                    Log.d(TAG, "ARCore availability=${availability.name} support=TEMPORARY_UNAVAILABLE")
                    promise.resolve("TEMPORARY_UNAVAILABLE")
                    return
                }

                else -> Unit
            }

            val session = Session(reactContext)
            try {
                val isDepthSupported =
                    session.isDepthModeSupported(Config.DepthMode.RAW_DEPTH_ONLY)
                val support = if (isDepthSupported) "FULL_DEPTH" else "SLAM_ONLY"
                Log.d(TAG, "ARCore availability=${availability.name} support=$support")
                promise.resolve(support)
            } finally {
                session.close()
            }
        } catch (exception: CameraNotAvailableException) {
            Log.d(TAG, "ARCore session camera transient (${exception.javaClass.simpleName}); support=TEMPORARY_UNAVAILABLE")
            promise.resolve("TEMPORARY_UNAVAILABLE")
        } catch (exception: SecurityException) {
            Log.d(TAG, "ARCore detection blocked by camera permission (${exception.javaClass.simpleName}); support=CAMERA_PERMISSION_REQUIRED")
            promise.resolve("CAMERA_PERMISSION_REQUIRED")
        } catch (exception: UnavailableArcoreNotInstalledException) {
            Log.d(TAG, "ARCore install needed (${exception.javaClass.simpleName}); support=ARCORE_INSTALL_REQUIRED")
            promise.resolve("ARCORE_INSTALL_REQUIRED")
        } catch (exception: UnavailableApkTooOldException) {
            Log.d(TAG, "ARCore update needed (${exception.javaClass.simpleName}); support=ARCORE_UPDATE_REQUIRED")
            promise.resolve("ARCORE_UPDATE_REQUIRED")
        } catch (exception: UnavailableSdkTooOldException) {
            Log.d(TAG, "ARCore SDK update needed (${exception.javaClass.simpleName}); support=ARCORE_UPDATE_REQUIRED")
            promise.resolve("ARCORE_UPDATE_REQUIRED")
        } catch (exception: UnavailableUserDeclinedInstallationException) {
            Log.d(TAG, "ARCore install declined (${exception.javaClass.simpleName}); support=ARCORE_INSTALL_REQUIRED")
            promise.resolve("ARCORE_INSTALL_REQUIRED")
        } catch (exception: UnavailableDeviceNotCompatibleException) {
            Log.d(TAG, "ARCore not compatible (${exception.javaClass.simpleName}); support=UNSUPPORTED")
            promise.resolve("UNSUPPORTED")
        } catch (exception: Exception) {
            Log.d(TAG, "ARCore detection failed (${exception.javaClass.simpleName}); support=TEMPORARY_UNAVAILABLE")
            promise.resolve("TEMPORARY_UNAVAILABLE")
        }
    }

    @ReactMethod
    fun moveTaskToBack(promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity
            if (activity == null) {
                promise.resolve(false)
                return
            }

            promise.resolve(activity.moveTaskToBack(true))
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun launchDiameterMeasurement(tier: Int, promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "AR diameter measurement requires an active screen.")
            return
        }

        if (pendingDiameterPromise != null || pendingHeightPromise != null) {
            promise.reject("MEASUREMENT_IN_PROGRESS", "Another AR measurement is already running.")
            return
        }

        pendingDiameterPromise = promise
        val intent = Intent(activity, ARMeasurementActivity::class.java).apply {
            putExtra(ARMeasurementActivity.EXTRA_MODE, ARMeasurementActivity.MODE_DIAMETER)
            putExtra(ARMeasurementActivity.EXTRA_TIER, tier)
        }

        activity.runOnUiThread {
            try {
                activity.startActivityForResult(intent, DIAMETER_MEASUREMENT_REQUEST_CODE)
            } catch (exception: Exception) {
                pendingDiameterPromise = null
                // Check if this is a camera-specific error
                val errorMessage = exception.message ?: "Unable to open AR diameter measurement."
                if (errorMessage.contains("camera", ignoreCase = true)) {
                    promise.reject("CAMERA_IN_USE", "Camera access failed: $errorMessage")
                } else {
                    promise.reject("MEASUREMENT_ERROR", errorMessage)
                }
            }
        }
    }

    @ReactMethod
    fun launchHeightMeasurement(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "AR height measurement requires an active screen.")
            return
        }

        if (pendingDiameterPromise != null || pendingHeightPromise != null) {
            promise.reject("MEASUREMENT_IN_PROGRESS", "Another AR measurement is already running.")
            return
        }

        pendingHeightPromise = promise
        val intent = Intent(activity, ARMeasurementActivity::class.java).apply {
            putExtra(ARMeasurementActivity.EXTRA_MODE, ARMeasurementActivity.MODE_HEIGHT)
        }

        activity.runOnUiThread {
            try {
                activity.startActivityForResult(intent, HEIGHT_MEASUREMENT_REQUEST_CODE)
            } catch (exception: Exception) {
                pendingHeightPromise = null
                // Check if this is a camera-specific error
                val errorMessage = exception.message ?: "Unable to open AR height measurement."
                if (errorMessage.contains("camera", ignoreCase = true)) {
                    promise.reject("CAMERA_IN_USE", "Camera access failed: $errorMessage")
                } else {
                    promise.reject("HEIGHT_INIT_FAILED", errorMessage)
                }
            }
        }
    }

    // ---- T012: measureCylinder Tier 1 (RAW_DEPTH_ONLY) ----
    // ---- T013: measureCylinder Tier 2 (SLAM) ----

    @ReactMethod
    fun measureCylinder(promise: Promise) {
        try {
            val availability = ArCoreApk.getInstance().checkAvailability(reactContext)
            if (availability.isUnsupported) {
                promise.reject("AR_UNSUPPORTED", "ARCore is not supported on this device.")
                return
            }

            val session = Session(reactContext)
            val config = Config(session)
            val isDepthSupported = session.isDepthModeSupported(Config.DepthMode.RAW_DEPTH_ONLY)
            val tierUsed: Int

            if (isDepthSupported) {
                // Tier 1: RAW_DEPTH_ONLY
                config.depthMode = Config.DepthMode.RAW_DEPTH_ONLY
                tierUsed = 1
                session.configure(config)
                measureWithDepth(session, tierUsed, promise)
            } else {
                // Tier 2: SLAM - accumulate frames for 5 seconds
                config.depthMode = Config.DepthMode.DISABLED
                tierUsed = 2
                session.configure(config)
                measureWithSLAM(session, tierUsed, promise)
            }
        } catch (e: Exception) {
            promise.reject("MEASURE_ERROR", "Measurement failed: ${e.message}")
        }
    }

    private fun measureWithDepth(session: Session, tierUsed: Int, promise: Promise) {
        try {
            session.resume()
            // Allow time for depth frame acquisition
            Thread.sleep(3000)

            val frame: Frame = session.update()
            val depthImage = frame.acquireRawDepthImage16Bits()

            val width = depthImage.width
            val height = depthImage.height
            val buffer = depthImage.planes[0].buffer

            // Filter to centre 30% width x 60% height of frame
            val xStart = (width * 0.35).toInt()
            val xEnd = (width * 0.65).toInt()
            val yStart = (height * 0.20).toInt()
            val yEnd = (height * 0.80).toInt()

            val points = mutableListOf<FloatArray>()
            val intrinsics = frame.camera.imageIntrinsics
            val fx = intrinsics.focalLength[0]
            val fy = intrinsics.focalLength[1]
            val cx = intrinsics.principalPoint[0]
            val cy = intrinsics.principalPoint[1]

            for (y in yStart until yEnd) {
                for (x in xStart until xEnd) {
                    val depthMm = buffer.getShort((y * width + x) * 2).toInt() and 0xFFFF
                    if (depthMm > 0 && depthMm < 10000) {
                        val depthM = depthMm / 1000.0f
                        val px = (x - cx) * depthM / fx
                        val py = (y - cy) * depthM / fy
                        points.add(floatArrayOf(px, py, depthM))
                    }
                }
            }

            depthImage.close()
            session.pause()
            session.close()

            val result = ransacCylinderFit(points, tierUsed)
            if (result != null) {
                promise.resolve(result)
            } else {
                promise.reject("LOW_CONFIDENCE", "Move closer to the tree and hold still, then try again.")
            }
        } catch (e: Exception) {
            try { session.close() } catch (_: Exception) {}
            promise.reject("MEASURE_ERROR", "Measurement failed: ${e.message}")
        }
    }

    private fun measureWithSLAM(session: Session, tierUsed: Int, promise: Promise) {
        val handlerThread = HandlerThread("SLAMAccumulation")
        handlerThread.start()
        val handler = Handler(handlerThread.looper)

        handler.post {
            try {
                session.resume()
                val allPoints = mutableListOf<FloatArray>()
                val startTime = System.currentTimeMillis()

                // Accumulate depth frames for 5 seconds
                while (System.currentTimeMillis() - startTime < 5000) {
                    try {
                        val frame = session.update()
                        val pointCloud = frame.acquirePointCloud()
                        val pointBuffer = pointCloud.points
                        while (pointBuffer.hasRemaining()) {
                            val x = pointBuffer.get()
                            val y = pointBuffer.get()
                            val z = pointBuffer.get()
                            val confidence = pointBuffer.get()
                            if (confidence > 0.3f) {
                                allPoints.add(floatArrayOf(x, y, z))
                            }
                        }
                        pointCloud.close()
                    } catch (_: Exception) {
                        // Frame not ready, continue accumulating
                    }
                    Thread.sleep(100)
                }

                session.pause()
                session.close()

                val result = ransacCylinderFit(allPoints, tierUsed)
                if (result != null) {
                    promise.resolve(result)
                } else {
                    promise.reject("LOW_CONFIDENCE", "Move closer to the tree and hold still, then try again.")
                }
            } catch (e: Exception) {
                try { session.close() } catch (_: Exception) {}
                promise.reject("MEASURE_ERROR", "Measurement failed: ${e.message}")
            } finally {
                handlerThread.quitSafely()
            }
        }
    }

    private fun ransacCylinderFit(points: List<FloatArray>, tierUsed: Int): String? {
        if (points.size < 50) return null

        var bestInliers = 0
        var bestRadius = 0.0f
        val totalPoints = points.size
        val epsilon = 0.02f // 2cm tolerance
        val iterations = 100

        for (i in 0 until iterations) {
            // Select 3 random points
            val idx1 = Random.nextInt(totalPoints)
            var idx2 = Random.nextInt(totalPoints)
            while (idx2 == idx1) idx2 = Random.nextInt(totalPoints)
            var idx3 = Random.nextInt(totalPoints)
            while (idx3 == idx1 || idx3 == idx2) idx3 = Random.nextInt(totalPoints)

            val p1 = points[idx1]
            val p2 = points[idx2]
            val p3 = points[idx3]

            // Axis from p1 to p2 (vertical trunk direction)
            val axisX = p2[0] - p1[0]
            val axisY = p2[1] - p1[1]
            val axisZ = p2[2] - p1[2]
            val axisLen = sqrt(axisX * axisX + axisY * axisY + axisZ * axisZ)
            if (axisLen < 0.01f) continue

            val ax = axisX / axisLen
            val ay = axisY / axisLen
            val az = axisZ / axisLen

            // Radius from p3 to the axis line
            val v3x = p3[0] - p1[0]
            val v3y = p3[1] - p1[1]
            val v3z = p3[2] - p1[2]
            val dot = v3x * ax + v3y * ay + v3z * az
            val projX = v3x - dot * ax
            val projY = v3y - dot * ay
            val projZ = v3z - dot * az
            val radius = sqrt(projX * projX + projY * projY + projZ * projZ)

            if (radius < 0.025f || radius > 1.0f) continue // 2.5cm to 100cm radius

            // Count inliers
            var inliers = 0
            for (p in points) {
                val vx = p[0] - p1[0]
                val vy = p[1] - p1[1]
                val vz = p[2] - p1[2]
                val d = vx * ax + vy * ay + vz * az
                val px = vx - d * ax
                val py = vy - d * ay
                val pz = vz - d * az
                val dist = sqrt(px * px + py * py + pz * pz)
                if (kotlin.math.abs(dist - radius) < epsilon) {
                    inliers++
                }
            }

            if (inliers > bestInliers) {
                bestInliers = inliers
                bestRadius = radius
            }
        }

        val confidence = bestInliers.toFloat() / totalPoints.toFloat()
        if (confidence < 0.7f || bestInliers < 50) return null

        val diameterCm = bestRadius * 2 * 100 // metres to cm
        return """{"diameter_cm":${String.format("%.1f", diameterCm)},"confidence":${String.format("%.3f", confidence)},"tier_used":$tierUsed,"point_count":$totalPoints}"""
    }

    // ---- T014: runSpeciesInference ----

    @ReactMethod
    fun runSpeciesInference(imageSource: String, promise: Promise) {
        try {
            val interpreter = tfliteInterpreter
            if (interpreter == null) {
                promise.reject("MODEL_UNAVAILABLE", "Species model is missing or invalid on this build.")
                return
            }

            val imageBytes = resolveImageBytes(imageSource)
            val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
                ?: run {
                    promise.reject("DECODE_ERROR", "Failed to decode image.")
                    return
                }

            val scaled = Bitmap.createScaledBitmap(bitmap, 224, 224, true)
            bitmap.recycle()

            // Prepare input tensor: [1][224][224][3] normalized to [-1, 1]
            val inputBuffer = ByteBuffer.allocateDirect(1 * 224 * 224 * 3 * 4)
            inputBuffer.order(ByteOrder.nativeOrder())

            val pixels = IntArray(224 * 224)
            scaled.getPixels(pixels, 0, 224, 0, 0, 224, 224)
            scaled.recycle()

            for (pixel in pixels) {
                val r = ((pixel shr 16 and 0xFF) / 127.5f) - 1.0f
                val g = ((pixel shr 8 and 0xFF) / 127.5f) - 1.0f
                val b = ((pixel and 0xFF) / 127.5f) - 1.0f
                inputBuffer.putFloat(r)
                inputBuffer.putFloat(g)
                inputBuffer.putFloat(b)
            }

            // Output tensor: [1][11]
            val outputArray = Array(1) { FloatArray(11) }
            interpreter.run(inputBuffer, outputArray)

            val scores = outputArray[0]
            var maxIdx = 0
            var maxConf = scores[0]
            for (i in 1 until scores.size) {
                if (scores[i] > maxConf) {
                    maxConf = scores[i]
                    maxIdx = i
                }
            }

            val speciesName = approvedSpecies[maxIdx]
            val scoresStr = scores.joinToString(",") { String.format("%.4f", it) }
            promise.resolve("""{"species":"$speciesName","confidence":${String.format("%.4f", maxConf)},"all_scores":[$scoresStr]}""")
        } catch (e: Exception) {
            promise.reject("INFERENCE_ERROR", "Species identification failed: ${e.message}")
        }
    }

    private fun resolveImageBytes(imageSource: String): ByteArray {
        val normalizedPath = if (imageSource.startsWith("file://")) {
            Uri.parse(imageSource).path ?: imageSource.removePrefix("file://")
        } else {
            imageSource
        }

        val sourceFile = File(normalizedPath)
        return if (sourceFile.exists()) {
            sourceFile.readBytes()
        } else {
            Base64.decode(imageSource, Base64.DEFAULT)
        }
    }
}
