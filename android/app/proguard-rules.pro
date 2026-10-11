# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Keep the native WebView bridge methods callable from JavaScript.
-keepclassmembers class com.souqhamad.app.MainActivity$NativeBridge {
   @android.webkit.JavascriptInterface <methods>;
}

# Keep the app shell entry points and WebView clients stable under R8.
-keep class com.souqhamad.app.MainActivity { *; }
-keep class com.souqhamad.app.SouqHamadWebViewClient { *; }
-keep class com.souqhamad.app.SouqHamadWebChromeClient { *; }
-keep class com.souqhamad.app.NativeGoogleSignIn { *; }
-keep class com.souqhamad.app.NativePushRegistrar { *; }

# Capacitor plugins and runtime use generated metadata and reflection.
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepattributes RuntimeVisibleAnnotations,RuntimeVisibleParameterAnnotations,Signature,InnerClasses,EnclosingMethod

# Keep Firebase Messaging and Google sign-in credential classes used by the native shell.
-keep class com.google.firebase.messaging.** { *; }
-keep class androidx.credentials.** { *; }
-keep class com.google.android.libraries.identity.googleid.** { *; }

# Preserve file-provider classes used for camera/gallery uploads.
-keep class androidx.core.content.FileProvider { *; }

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
