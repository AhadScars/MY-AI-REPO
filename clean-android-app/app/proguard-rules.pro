# Keep app classes used by reflection / view binding
-keepclassmembers class * {
    @androidx.annotation.Keep *;
}
# Do not strip useful crash info
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
