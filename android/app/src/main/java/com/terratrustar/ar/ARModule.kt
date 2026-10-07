package com.terratrustar.ar

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Handler
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.ar.core.ArCoreApk
import com.google.ar.core.Config
import com.google.ar.core.Session
import com.google.ar.core.exceptions.CameraNotAvailableException
import com.google.ar.core.exceptions.UnavailableApkTooOldException
import com.google.ar.core.exceptions.UnavailableArcoreNotInstalledException
import com.google.ar.core.exceptions.UnavailableDeviceNotCompatibleException
import com.google.ar.core.exceptions.UnavailableSdkTooOldException
import com.google.ar.core.exceptions.UnavailableUserDeclinedInstallationException
import org.tensorflow.lite.Interpreter
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel
import java.util.Locale

class ARModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "TerraTrustAR"
        private const val DIAMETER_MEASUREMENT_REQUEST_CODE = 44001
        private const val HEIGHT_MEASUREMENT_REQUEST_CODE = 44002
        private const val ARCORE_AVAILABILITY_MAX_ATTEMPTS = 4
        private const val ARCORE_AVAILABILITY_RETRY_DELAY_MS = 150L
        private const val SPECIES_MODEL_FILENAME = "species_model.tflite"
        private const val SPECIES_MANIFEST_FILENAME = "species_model_manifest.json"
        private const val SPECIES_INPUT_SIZE = 224
        private const val SPECIES_NOT_APPROVED_LABEL = "NOT_APPROVED"
    }

    override fun getName(): String = "ARModule"

    private val tfliteInterpreter: Interpreter? by lazy {
        createInterpreterOrNull()
    }

    private data class SpeciesModelManifest(
        val labelOrder: List<String>,
        val uiFallbackThreshold: Float,
        val hardAcceptanceThreshold: Float,
        val notApprovedIndex: Int,
    )

    private val defaultSpeciesLabelOrder = listOf(
        SPECIES_NOT_APPROVED_LABEL,
        "amla",
        "bamboo",
        "casuarina",
        "drumstick",
        "eucalyptus",
        "indian_rosewood",
        "mango",
        "neem",
        "pongamia",
        "subabul",
        "teak",
    )

    private val speciesDisplayNameByLabel = mapOf(
        SPECIES_NOT_APPROVED_LABEL to "Not Approved",
        "amla" to "Amla",
        "bamboo" to "Bamboo",
        "casuarina" to "Casuarina",
        "drumstick" to "Drumstick",
        "eucalyptus" to "Eucalyptus",
        "indian_rosewood" to "Indian Rosewood",
        "mango" to "Mango",
        "neem" to "Neem",
        "pongamia" to "Pongamia",
        "subabul" to "Subabul",
        "teak" to "Teak",
    )

    private val speciesModelManifest: SpeciesModelManifest by lazy {
        loadSpeciesManifestOrDefault()
    }

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
            val modelBuffer = loadModelFromAssets(SPECIES_MODEL_FILENAME)
            Interpreter(modelBuffer, Interpreter.Options().apply { setNumThreads(4) })
        } catch (error: Exception) {
            Log.w(TAG, "Species model unavailable: ${error.message}")
            null
        }
    }

    private fun loadTextAsset(filename: String): String =
        reactContext.assets.open(filename).bufferedReader(Charsets.UTF_8).use { reader ->
            reader.readText()
        }

    private fun loadSpeciesManifestOrDefault(): SpeciesModelManifest {
        val fallbackManifest = SpeciesModelManifest(
            labelOrder = defaultSpeciesLabelOrder,
            uiFallbackThreshold = 0.60f,
            hardAcceptanceThreshold = 0.80f,
            notApprovedIndex = 0,
        )

        return try {
            val manifestJson = JSONObject(loadTextAsset(SPECIES_MANIFEST_FILENAME))
            val labelsJson = manifestJson.optJSONArray("label_order")
            val parsedLabelOrder = buildList {
                if (labelsJson != null) {
                    for (index in 0 until labelsJson.length()) {
                        val label = labelsJson.optString(index).trim()
                        if (label.isNotEmpty()) {
                            add(label)
                        }
                    }
                }
            }

            val labelOrder = if (parsedLabelOrder.isNotEmpty()) {
                parsedLabelOrder
            } else {
                fallbackManifest.labelOrder
            }

            SpeciesModelManifest(
                labelOrder = labelOrder,
                uiFallbackThreshold = manifestJson
                    .optDouble(
                        "confidence_ui_fallback_threshold",
                        fallbackManifest.uiFallbackThreshold.toDouble(),
                    )
                    .toFloat(),
                hardAcceptanceThreshold = manifestJson
                    .optDouble(
                        "confidence_hard_acceptance_threshold",
                        fallbackManifest.hardAcceptanceThreshold.toDouble(),
                    )
                    .toFloat(),
                notApprovedIndex = manifestJson
                    .optInt("not_approved_index", fallbackManifest.notApprovedIndex)
                    .coerceIn(0, labelOrder.lastIndex),
            )
        } catch (error: Exception) {
            Log.w(TAG, "Species manifest unavailable: ${error.message}")
            fallbackManifest
        }
    }

    private fun getSpeciesDisplayName(modelLabel: String): String {
        return speciesDisplayNameByLabel[modelLabel]
            ?: modelLabel
                .split('_')
                .filter { it.isNotBlank() }
                .joinToString(" ") { part ->
                    part.replaceFirstChar { character ->
                        if (character.isLowerCase()) {
                            character.titlecase(Locale.US)
                        } else {
                            character.toString()
                        }
                    }
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

    // Retain the legacy bridge entry point, using the same visible and validated
    // capture pipeline. The Activity resolves actual depth support at startup.
    @ReactMethod
    fun measureCylinder(promise: Promise) {
        launchDiameterMeasurement(1, promise)
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

            val manifest = speciesModelManifest
            val scaled = Bitmap.createScaledBitmap(
                bitmap,
                SPECIES_INPUT_SIZE,
                SPECIES_INPUT_SIZE,
                true,
            )
            bitmap.recycle()

            // Match the exported TFLite contract: resize to 224x224 and divide by 255.
            val inputBuffer = ByteBuffer.allocateDirect(
                1 * SPECIES_INPUT_SIZE * SPECIES_INPUT_SIZE * 3 * 4,
            )
            inputBuffer.order(ByteOrder.nativeOrder())

            val pixels = IntArray(SPECIES_INPUT_SIZE * SPECIES_INPUT_SIZE)
            scaled.getPixels(
                pixels,
                0,
                SPECIES_INPUT_SIZE,
                0,
                0,
                SPECIES_INPUT_SIZE,
                SPECIES_INPUT_SIZE,
            )
            scaled.recycle()

            for (pixel in pixels) {
                val r = (pixel shr 16 and 0xFF) / 255.0f
                val g = (pixel shr 8 and 0xFF) / 255.0f
                val b = (pixel and 0xFF) / 255.0f
                inputBuffer.putFloat(r)
                inputBuffer.putFloat(g)
                inputBuffer.putFloat(b)
            }

            inputBuffer.rewind()

            val outputWidth =
                interpreter.getOutputTensor(0).shape().lastOrNull()
                    ?: manifest.labelOrder.size
            val outputArray = Array(1) { FloatArray(outputWidth) }
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

            val rawLabel = manifest.labelOrder.getOrElse(maxIdx) { "unknown_$maxIdx" }
            val speciesName = getSpeciesDisplayName(rawLabel)
            val rejectedLabel = manifest.labelOrder.getOrNull(manifest.notApprovedIndex)
            val isApprovedSpecies =
                rawLabel != SPECIES_NOT_APPROVED_LABEL &&
                    rawLabel != rejectedLabel &&
                    speciesDisplayNameByLabel.containsKey(rawLabel)

            val status = when {
                !isApprovedSpecies -> "REJECTED"
                maxConf < manifest.uiFallbackThreshold -> "LOW_CONFIDENCE"
                maxConf < manifest.hardAcceptanceThreshold -> "MEDIUM_CONFIDENCE"
                else -> "ACCEPTED"
            }
            val uiAction = when (status) {
                "ACCEPTED" -> "proceed"
                "REJECTED" -> "retake"
                else -> "manual_selection"
            }

            val scoresJson = JSONArray()
            scores.forEach { score ->
                scoresJson.put(score.toDouble())
            }

            val response = JSONObject()
            response.put("species", speciesName)
            response.put("raw_label", rawLabel)
            response.put("confidence", maxConf.toDouble())
            response.put("approved", isApprovedSpecies)
            response.put("status", status)
            response.put("ui_action", uiAction)
            response.put("all_scores", scoresJson)

            promise.resolve(response.toString())
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
