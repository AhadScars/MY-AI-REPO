# Sweet Pop

Standalone Candy Crush–style match-3 Android game.

## Features
- **Match-3 gameplay** with cascades, combos, and progressive levels
- **Realistic physics** — springy falls, bounce settle, pop scale, particle bursts
- **Clean modern UI** — glass panels, gradient candy, score progress
- **Immersive sound** — procedural plucks/chimes (no asset pack required)
- **App icon** — adaptive candy launcher icon
- **Offline APK** — zero network permissions

## Build (Windows)

```bat
cd sweet-pop
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
gradlew.bat assembleRelease
```

Signed APK:

`app\build\outputs\apk\release\app-release.apk`

Copy to desktop as `SweetPop.apk`.

## Play
1. Install the APK on Android 7.0+
2. Tap **Play**
3. Swipe or tap-adjacent candies to swap
4. Match 3+ of the same color; cascades score combos
5. Reach the target score before moves run out
