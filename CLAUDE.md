# Grisu NÖ — Claude Code Projekt-Kontext

Privater Fork der Feuerwehr-App "Grisu NÖ" (WASTL-Einsatzdaten NÖ). Modernisiert für
Android 16 (targetSdk 36). Doku: `ARCHITECTURE.md` (Architektur, Datenmodell, Fallen),
`MODERNIZATION.md` (2026-Modernisierung).

## Stack (NICHT modernisieren!)

- Ionic 1.3.1 / AngularJS 1.5.3 (UI), UI-Router 0.2.13, ngCordova
- Apache Cordova 13, cordova-android 15.1.0, JDK 21, Gradle 8.14.2
- Karten: Leaflet 0.7.7. Charts: Chart.js 1.0.2. CSS: SASS → `www/css/` (generiert)

## Build & Test (wichtig!)

```sh
source ../toolchain/env.sh        # JAVA_HOME/ANDROID_HOME/GRADLE_HOME (liegt NEBEN dem Repo)
npx gulp sass                     # nach scss-Änderungen
npx gulp lint                     # JSHint — MUSS fehlerfrei sein
npx cordova build android --debug # APK → platforms/android/.../app-debug.apk
```

- `www/lib/` und `www/css/` sind **generiert** (nicht eingecheckt). Nach frischem Checkout:
  `npm install && GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0="url.https://.insteadOf" GIT_CONFIG_VALUE_0="git://" npx bower install && npx gulp sass`
- Emulator (nur bei Bedarf): `~/projects/toolchain/android-sdk/emulator/emulator -avd grisu_test -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -memory 2048 -cores 2 -no-snapshot` — danach `adb install -r <apk>`
- WebView-Testing über CDP: `adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof at.lex.grisu.noe)` → `node cdp_eval.js '<js>'` (liegt im Repo-Root, gitignored)
- Konsole/Fehler: `adb logcat -d -s chromium:V CordovaLog:V`
- APK nach dem Build nach `dist/Grisu-<version>-debug.apk` kopieren (Version im Namen!)

## Code-Konventionen

- 4 Spaces, max. 140 Zeichen pro Zeile
- Plugin-Globals (`window.cordova.*`, `navigator.*`) NIE auf Modul-Ebene — nur innerhalb
  von `$ionicPlatform.ready()` bzw. in Controllern/Factories mit `$window`-Guard
- Bestehende Muster nutzen: `storageService` (getObject/setObject), `util.genericRefresh`,
  ngCordova-Wrapper. AngularJS 1.x: bei ng-model in Modals/Popovers **immer dot-notation**
  auf ein Objekt, das auf dem Controller-Scope initialisiert ist (Kind-Scope-Falle!)
- UI-Texte auf Deutsch (österreichisch). Bezirks-IDs sind Strings mit führender Null (`01`, `061`)

## Kritische Fallen (schon gebaut — nicht brechen!)

- **CORS:** Die App läuft unter `https://localhost` (WebViewAssetLoader). Cross-Origin-
  Requests laufen über `nativeHttpBackend` (www/js/services/nativeHttpBackend.js) auf den
  nativen HTTP-Stack (cordova-plugin-advanced-http). Neue Endpoints müssen HTTPS sein.
- **Cookie-Jar:** Vor Requests mit explizitem `Cookie`-Header muss
  `cordova.plugin.http.removeCookies(url, cb)` laufen, sonst gewinnt das alte Jar-Cookie
  (siehe `getInfoScreenDataWithCookie` in dataService.js). Session-Cookie:
  `xFFK_InfoScrCookie_TokenID` (Server-seitig generierter Code, ~1 Jahr gültig).
- **Infoscreen-Token:** `infoscreenToken` in localStorage; wird als TokenID-Cookie
  mitgesendet, damit der Code Neuinstallationen überlebt. Error 1002 = unbekannter Code.

## Feature-Workflow (User-Vorgabe!)

1. Feature spezifizieren (kurze Spec mit Ziel + Akzeptanzkriterien)
2. Coding-Agent setzt um (Konventionen oben), Testing-Agent testet E2E im Emulator,
   Review-Agent reviewed — siehe `.claude/agents/`
3. **NICHT committen!** APK bauen → nach `dist/Grisu-<version>-debug.apk` kopieren → dem
   User senden. Erst nach dessen "Go" committen + auf main pushen.
4. Signatur: eigener Keystore (build.json gitignored). Autor: Lukas Grundtner.
