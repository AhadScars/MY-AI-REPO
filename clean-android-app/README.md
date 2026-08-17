# Smart Calculator (Android)

Offline smart calculator with a clean, **legitimate** APK profile:

- **No dangerous permissions** (no internet, SMS, accessibility, overlay, etc.)
- Release-signed APK (not debug)
- Modern `targetSdk 36`
- Pure math UI: `+ − × ÷`, `%`, `√`, `x²`, `1/x`, memory (MC/MR/M+/M−), history

## APK location

After a successful release build:

```
app/build/outputs/apk/release/app-release.apk
```

Also copied to project root as `SmartCalculator.apk` when using `build-release.bat`.

## Install on phone

1. Copy `SmartCalculator.apk` / `app-release.apk` to your phone.
2. Open the file → **Install**.
3. First time from Files/Chrome/WhatsApp, Android may ask to **Allow from this source** once. That is normal OS security for **any** app not from Play Store — it is not a virus.

### About “virus” / Play Protect warnings

| What you control | Effect |
|------------------|--------|
| No malware permissions / no shady APIs | Much lower risk of real scanner flags |
| Release signature | Better than debug APKs |
| Offline calculator only | Looks like a normal utility |

| What you **cannot** fully remove for sideload | Why |
|-----------------------------------------------|-----|
| “Install unknown apps” / “Install anyway” | Android blocks unknown sources by default |
| First-time Play Protect scan | Google scans new sideloaded APKs |

**There is no safe way** to make a random APK install with zero prompts on every phone.  
Publishing on **Google Play** is the path to “installs like a normal app.”

This project is **not** a guide to bypass antivirus or hide malicious behavior.

## Build (Windows)

```bat
build-release.bat
```

Or in Android Studio: open this folder → **Build → Generate Signed Bundle / APK**.

## Requirements

- Android Studio + JDK 17
- Android SDK (see `local.properties`)
