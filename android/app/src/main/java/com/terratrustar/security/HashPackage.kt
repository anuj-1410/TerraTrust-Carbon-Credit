package com.terratrustar.security

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class HashPackage : ReactPackage {

    @Deprecated("Required by the ReactPackage compatibility API.")
    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): List<NativeModule> {
        return listOf(HashModule(reactContext))
    }

    @Deprecated("Required by the ReactPackage compatibility API.")
    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): List<ViewManager<*, *>> {
        return emptyList()
    }
}
