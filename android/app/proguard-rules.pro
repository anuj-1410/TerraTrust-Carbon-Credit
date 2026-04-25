# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# ARCore classes are accessed via the Google Play Services installer/runtime and
# should not be aggressively stripped in release builds.
-keep class com.google.ar.core.** { *; }
-keep class com.google.ar.sceneform.** { *; }
-dontwarn com.google.ar.core.**

# TensorFlow Lite reflection and native loading paths need stable class names.
-keep class org.tensorflow.lite.** { *; }
-keep class org.tensorflow.lite.support.** { *; }
-dontwarn org.tensorflow.lite.**
