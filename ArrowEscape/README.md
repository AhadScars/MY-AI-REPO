# Arrow Escape — Android

A polished **2D arrow puzzle** game for Android with colorful graphics, smooth animations, and satisfying gameplay.

## Gameplay

- Each level is a **2D shape** made of blocks
- Every block has an arrow: **↑ ↓ ← →**
- **Tap** an arrow to make it fly in that direction
- It only leaves if the path is **completely clear**
- Blocked path = **crash** = lose **1 heart**
- **3 hearts** per level — clear all arrows to win

### Controls

| Gesture | Action |
|---------|--------|
| Tap | Remove arrow |
| Drag | Pan board |
| Pinch | Zoom |

## Features

- 40+ object shapes (hearts, stars, chess pieces, letters, vehicles…)
- 200 procedurally generated solvable levels
- Themed color palettes that unlock as you progress
- Fly-away / crash / confetti particle animations
- Screen shake, heart pulse, button press feedback
- Coins, XP, stars, statistics, settings
- Local save progress

## Build

### Requirements

- Android Studio Ladybug+ or JDK 17
- Android SDK 36

### Debug APK

```bash
cd ArrowEscape
./gradlew assembleDebug
```

APK output:

```
app/build/outputs/apk/debug/app-debug.apk
```

### Release

```bash
./gradlew assembleRelease
```

## Project structure

```
app/src/main/java/com/digihub/arrowescape/
  MainActivity.kt          Menu, level select, stats
  GameActivity.kt          HUD + overlays
  game/
    GameView.kt            Canvas 2D renderer + input + animations
    LevelGenerator.kt      Solvable puzzle generation
    SoundManager.kt        SFX
  data/
    Constants.kt           Themes, dirs, rewards
    SaveData.kt            SharedPreferences progress
```

## Tech

- Kotlin
- Custom `View` + Canvas 2D (no game engine dependency)
- Material 3 UI
- minSdk 24 / targetSdk 36

## License

MIT
