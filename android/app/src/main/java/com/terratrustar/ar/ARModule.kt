package com.terratrustar.ar

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ARModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ARModule"

    @ReactMethod
    fun checkMockLocation(promise: Promise) {
        // TODO: Implement mock GPS detection — block audit start if true
        promise.resolve(false)
    }

    @ReactMethod
    fun startARSession(tier: Int, promise: Promise) {
        // TODO: Implement ARCore session start for given tier (1, 2, or 3)
        promise.resolve(null)
    }

    @ReactMethod
    fun getArTier(promise: Promise) {
        // TODO: Detect hardware capability and return AR tier
        // 1 = RAW_DEPTH_ONLY (ToF sensor), 2 = SLAM, 3 = MANUAL
        promise.resolve(3) // Default to manual until hardware detection is implemented
    }
}
