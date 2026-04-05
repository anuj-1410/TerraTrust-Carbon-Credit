package com.terratrustar.security

import android.net.Uri
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.Locale

class HashModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "HashModule"

    @ReactMethod
    fun sha256Utf8(input: String, promise: Promise) {
        try {
            promise.resolve(sha256Hex(input.toByteArray(StandardCharsets.UTF_8)))
        } catch (error: Exception) {
            promise.reject("HASH_UTF8_ERROR", error.message, error)
        }
    }

    @ReactMethod
    fun sha256Base64(base64: String, promise: Promise) {
        try {
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            promise.resolve(sha256Hex(bytes))
        } catch (error: Exception) {
            promise.reject("HASH_BASE64_ERROR", error.message, error)
        }
    }

    @ReactMethod
    fun readFileAsBase64(fileUriOrPath: String, promise: Promise) {
        try {
            val normalizedPath = normalizeFilePath(fileUriOrPath)
            val bytes = File(normalizedPath).readBytes()
            promise.resolve(Base64.encodeToString(bytes, Base64.NO_WRAP))
        } catch (error: Exception) {
            promise.reject("READ_FILE_BASE64_ERROR", error.message, error)
        }
    }

    private fun normalizeFilePath(fileUriOrPath: String): String {
        if (!fileUriOrPath.startsWith("file://")) {
            return fileUriOrPath
        }

        return Uri.parse(fileUriOrPath).path ?: fileUriOrPath.removePrefix("file://")
    }

    private fun sha256Hex(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
        val builder = StringBuilder(digest.size * 2)
        for (byte in digest) {
            builder.append(String.format(Locale.US, "%02x", byte.toInt() and 0xff))
        }
        return builder.toString()
    }
}