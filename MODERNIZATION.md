Android Modernization (2026)
============================

This document records what was changed to make the app build and run on current Android
versions (14 / 15 / 16). The app ID `at.lex.grisu.noe` and the feature set are unchanged;
the Ionic 1.3.1 / AngularJS 1.5.3 frontend was deliberately **not** rewritten.

Target versions
---------------

| Component            | Before                  | After                     |
|----------------------|-------------------------|---------------------------|
| cordova-android      | (unpinned, ~5.x era)    | **15.1.0**                |
| Cordova CLI          | global, unpinned        | **13.0.0** (devDependency)|
| `minSdkVersion`      | 14 (Android 4.0)        | **24** (Android 7.0)      |
| `targetSdkVersion`   | not set (→ legacy)      | **36** (Android 16)       |
| `compileSdkVersion`  | not set                 | **36**                    |
| Java                 | 7/8                     | **JDK 21** (Temurin)      |
| Gradle               | n/a                     | **8.14.2** (AGP 8.10.1)   |
| App version          | 1.3.0                   | **1.4.0** (versionCode 10400) |
| Node.js              | 4.x                     | 20+ (built on 24.1.0)     |
| gulp                 | 3.9.1                   | **5.0.1**                 |

`minSdkVersion` is 24 rather than 23 because the replacement screenshot plugin uses
`PixelCopy`, which is API 24+. Android 6 is a rounding error in the install base, so the
trade was worth a working screenshot feature.

Plugin changes
--------------

The old plugin list lived only in `gulpfile.js` and pulled five plugins straight from
GitHub master branches. Those are now pinned npm releases, and the plugin set is recorded
in `package.json` (`cordova.plugins`) so a checkout is reproducible.

| Old                                                | New                                      | Why |
|----------------------------------------------------|------------------------------------------|-----|
| `cordova-plugin-whitelist@1.2.2`                   | **removed**                              | Folded into the platform since cordova-android 4; installing it now breaks the build. |
| `cordova-plugin-console@1.0.3`                     | **removed**                              | Deprecated and unnecessary; `console` is native in the modern WebView. |
| `cordova-plugin-splashscreen@3.2.2`                | **removed**                              | Declares `cordova-android >=3.6.0 <11.0.0`, i.e. incompatible. cordova-android 13+ implements the Android 12 SplashScreen API natively via `AndroidWindowSplashScreen*` preferences. |
| `robertklein/cordova-ios-security` (master)        | **removed**                              | Abandoned, iOS-only, not needed for the Android build. |
| `cordova-plugin-device@1.1.2`                       | `cordova-plugin-device@3.0.0`             | |
| `cordova-plugin-statusbar@2.1.3`                    | `cordova-plugin-statusbar@4.0.0`          | |
| `cordova-plugin-geolocation@2.2.0`                  | `cordova-plugin-geolocation@5.0.0`        | |
| `cordova-plugin-inappbrowser@1.4.0`                 | `cordova-plugin-inappbrowser@6.0.0`       | |
| `cordova-plugin-android-permissions@0.10.0`         | `cordova-plugin-android-permissions@1.1.5`| |
| `VersoSolutions/CordovaClipboard` (master)          | `cordova-clipboard@1.3.0`                 | Maintained fork, same `cordova.plugins.clipboard` global, so ngCordova's `$cordovaClipboard` still works. |
| `EddyVerbruggen/Toast-PhoneGap-Plugin#2.5.2`        | `cordova-plugin-x-toast@2.7.3`            | Same plugin, published release; same `window.plugins.toast` global for `$cordovaToast`. |
| `wymsee/cordova-HTTP#v1.2.0`                        | `cordova-plugin-advanced-http@3.3.1`      | Abandoned; replaced by the maintained successor. Needs a shim, see below. |
| `gitawego/cordova-screenshot#v0.1.5`                | `local-plugins/cordova-plugin-grisu-screenshot` | Abandoned and incompatible with scoped storage. Rewritten, see below. |

`cordova-plugin-file@8.1.3` is pulled in automatically as a dependency of
`cordova-plugin-advanced-http`.

### HTTP plugin shim

`dataService` calls `cordovaHTTP.get(url, params, headers)` and relies on the Angular
module `cordovaHTTP` that the old wymsee plugin provided. `cordova-plugin-advanced-http`
ships no Angular integration, so `www/js/services/cordovaHttp.js` now registers that module
and wraps `cordova.plugin.http`. Two properties of advanced-http make this a drop-in:

- its default `responseType` is `text`, so `response.data` stays a string and the existing
  `angular.fromJson(response.data)` calls are unaffected;
- its header merge gives precedence to explicitly passed headers, which is what keeps the
  WASTL "magic cookie" (a manually set `Cookie` header) working instead of being overwritten
  by the plugin's own cookie jar.

The browser-side `cordovaHTTP` mock that used to live inline in `index.html` is gone — the
shim covers both the device and `ionic serve` cases.

### Screenshot plugin

`gitawego/cordova-screenshot` wrote directly to external storage, which scoped storage
(Android 10+) broke and Android 13 finished off. `cordova-plugin-screenshot` on npm is an
unrelated BlackBerry 10 plugin, so there is no drop-in replacement.

`local-plugins/cordova-plugin-grisu-screenshot` is a small vendored replacement that keeps
the original JS contract exactly — `navigator.screenshot.save(cb, format, quality, filename)`
with `cb(error, { filePath })` — so `www/js/factories/screenshotService.js` is untouched.
Implementation notes:

- captures with `PixelCopy`, because drawing a hardware-accelerated WebView into a software
  `Canvas` yields blank output;
- stores through `MediaStore` on API 29+, which needs **no** runtime permission, and falls
  back to a plain file write plus a media-scanner notification below that;
- declares `WRITE_EXTERNAL_STORAGE` with `android:maxSdkVersion="28"` so the permission does
  not leak onto modern devices.

Display / edge-to-edge
----------------------

Android 15+ forces edge-to-edge layout for `targetSdk >= 35`, which would push the Ionic 1
header bars under the status bar. Rather than rewriting the Ionic 1 layout with
`env(safe-area-inset-*)`, the native inset handling is used:

- `AndroidEdgeToEdge=false` (set explicitly, not left to the default) makes
  `CordovaActivity.createViews` apply the system-bar and display-cutout insets as margins on
  the WebView itself, so the web layout keeps its original geometry;
- `StatusBarOverlaysWebView=false` because `cordova-plugin-statusbar` 4.0.0 otherwise
  defaults it to `true` and would undo that insetting;
- `StatusBarBackgroundColor=#CD0200` matches the app's `.bar-red` header.

`viewport-fit=cover` was still added to the viewport meta tag so that
`env(safe-area-inset-*)` reports real values if anyone flips `AndroidEdgeToEdge` on later.

CORS: the one that only showed up on the device
-----------------------------------------------

This was the blocker that no amount of static checking would have caught, and it broke *all*
data loading.

cordova-android >= 10 no longer serves the app from `file://`. It uses a `WebViewAssetLoader`
under the origin `https://localhost`. Every request to the WASTL API is therefore a genuine
cross-origin XHR, and since those endpoints send no `Access-Control-Allow-Origin` header the
WebView blocks every one of them:

```
Access to XMLHttpRequest at 'https://infoscreen.florian10.info/OWS/wastlMobile/getMainData.ashx'
from origin 'https://localhost' has been blocked by CORS policy
```

Under the old `file://` origin CORS was not enforced, which is why the app worked before.

The fix is `www/js/services/nativeHttpBackend.js`: an `$httpBackend` decorator that routes
requests through `cordova-plugin-advanced-http`. The native HTTP stack is not subject to CORS,
so this restores the data flow without touching a single call site.

It deliberately delegates **only** absolute `http(s)` URLs pointing somewhere other than the
app's own origin. Same-origin requests — above all AngularJS `templateUrl` loads — must stay on
the normal XHR backend, because they are served by the asset loader and are not reachable over
a real socket. Routing those natively would break every view.

Two details that matter:

- the `$httpBackend` signature is `(method, url, post, callback, headers, timeout, ...)` —
  `callback` comes *before* `headers`;
- the POST in `dataService.postVoting` builds its own urlencoded body, so the request uses
  advanced-http's `utf8` serializer to pass the string through verbatim instead of
  re-serializing it.

Because the native bridge callback runs outside Angular's digest, the decorator triggers
`$rootScope.$apply()` after completing a request.

Network / HTTPS
---------------

Android 9+ blocks cleartext HTTP by default. Every in-app endpoint was audited and moved to
HTTPS, so the app needs **no** cleartext exemption:

| Endpoint | Change |
|----------|--------|
| `infoscreen.florian10.info` (main data) | already HTTPS, unchanged |
| `atlas.feuerwehr-krems.at` (BAZ info) | http → **https**; the plain-HTTP port no longer accepts connections at all |
| `tile.openstreetmap.org` | http → **https** |
| `mt0-3.google.com` (satellite / terrain) | http → https, then **removed entirely** — see below |
| `maps.wien.gv.at` (basemap.at) | http → **https**, and the `{s}` subdomain sharding was removed because `maps1`–`maps4` no longer resolve (only `maps.wien.gv.at` does) |
| `openfiremap.org/hytiles` (hydrant overlay) | http → **https** |

### Tile licensing

Two licence problems inherited from the original were fixed:

- The stylesheet hid the Leaflet attribution control outright
  (`.leaflet-control-attribution { display: none; }`), and no layer set an `attribution` option.
  OpenStreetMap requires attribution under the ODbL and basemap.at is CC BY 4.0, so this was a
  violation of both. Every layer now carries an `attribution` and the control is merely styled
  compactly.
- Satellite and terrain were served from `mt0-3.google.com/vt`, an **internal** Google endpoint
  rather than the licensed Maps API — using it breaks the Google Maps Terms of Service. Both are
  now basemap.at layers (`bmaporthofoto30cm` and `bmapgelaende`): official Austrian data under
  CC BY 4.0 and a better fit for this app's coverage area. The orthophoto has no place labels,
  unlike the former Google hybrid layer.

**Known upstream breakage:** the OpenFireMap hydrant tile service answers `404` with an HTML
error body for every tile, over both HTTP and HTTPS. This is a dead upstream service, not a
regression from this migration. Leaflet degrades to an empty overlay, so the app is
unaffected beyond the overlay showing nothing.

Other app-code changes
----------------------

- `www/js/app.js`: the storage-permission prompt is now limited to Android 6–9. From
  Android 10 `WRITE_EXTERNAL_STORAGE` has no effect, and on Android 13+ the permission does
  not exist, so requesting it produced a permanent denial and a pointless dialog. The dead
  `version < 4.4` map-disable branch was dropped along with `minSdkVersion 14`.
- `www/js/controllers/overviewTabController.js`: `hideSplashscreen()` now checks that
  `navigator.splashscreen` exists before calling it, since the splashscreen plugin is gone.
  The call is guarded rather than deleted so a future iOS build that still ships the plugin
  keeps working.
- `gulpfile.js`: ported to gulp 5 (`gulp.series` instead of array task deps), `gulp-util`
  replaced by `fancy-log` + `ansi-colors`, dart-sass instead of the dead libsass binding, and
  `ionic plugin add` replaced by `npx cordova plugin add` (the modern Ionic CLI dropped that
  subcommand).

Build environment
-----------------

Not committed to the repo; created under `../toolchain/` with `../toolchain/env.sh` to source:

- Temurin **JDK 21.0.12** — cordova-android 15 requires JDK 21; the system JDK is 26, which
  it rejects.
- Android **cmdline-tools 13114758**, `platforms;android-36`, `build-tools;36.0.0`,
  `platform-tools`.
- **Gradle 8.14.2** — cordova needs a system Gradle to bootstrap its wrapper.

Data bugs found during device testing
-------------------------------------

Two findings that are unrelated to the Android migration but surfaced while testing on a
device.

### "Aktuelle Einsätze" always showed 0

The overview summed the per-district field `e` from `getMainData.ashx`. That field is no longer
populated by the WASTL API — it is `0` for every district — so the counter permanently read 0
while the same payload reported 31 active incidents state-wide in `h1.s`.

`processMainData` now prefers `h1.s` and only falls back to summing `e` if `h1` is absent.

### Red district with an empty incident list

A long-standing complaint: a district is coloured red, but tapping it shows "Zurzeit sind keine
Einsätze vorhanden." Measured against the live API:

- The colour is **not** an incident count. `getMainData.ashx` returns `z`, which is purely a
  WASTL classification of `f`, the number of dispatched fire brigades:
  `f=0` → grey, `1–2` → yellow, `3–5` → orange, `≥6` → red.
- The list comes from a different endpoint, `getEinsatzAktiv.ashx?id=bezirk_XX`, and **that
  endpoint intermittently returns an empty array for incidents that are demonstrably still
  active**. Observed: lists for several *independent* districts flip between empty and populated
  simultaneously in roughly 90-second blocks, while `f` stays constant. Within one such window
  the response is perfectly stable (12 of 12 identical requests over 24 s on the same backend),
  so it is a server-side refresh cycle, not per-request load balancing and not real incident
  churn.
- Confirmed by timestamps: during a window in which Wr. Neustadt's list came back empty at
  `f=14`, the list moments later contained four incidents that had started at 11:01, 11:34,
  12:25 and 14:16 — i.e. they were active the whole time. The colour was right; the empty list
  was the wrong information.
- Quantified over 8 minutes, polling district 21 every 20 s: `f` stayed at 14 while the list
  length went `0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,1,1,1,1,1,1,1,5`. **In 14 of 25 polls (~56 %) the
  endpoint reported zero incidents while at least four were demonstrably active**; it returned
  the full set in only ~12 % of polls. When a new incident started at 15:41, `f` rose from 14 to
  16 shortly after — so `f` tracks reality correctly and promptly.

So this is an upstream defect, not an app bug. What the app *can* do is stop implying that the
colour counts incidents, so a legend under the overview map now states that the colouring
reflects dispatched fire brigades, with the thresholds above.

A further mitigation is possible but not implemented: when `f > 0` and the list comes back
empty, that combination is known to be a bad response, so the app could retry or keep the
previous list instead of rendering "keine Einsätze vorhanden".

Building
--------

```sh
source ../toolchain/env.sh      # JAVA_HOME, ANDROID_HOME, GRADLE_HOME
npm install
npx bower install               # or: npx gulp install
npx gulp sass
npx cordova build android --debug
```

If bower fails on `git://` URLs, scope the rewrite to that one process instead of editing
the global git config:

```sh
GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0="url.https://.insteadOf" GIT_CONFIG_VALUE_0="git://" \
  npx bower install
```

Verification performed
----------------------

- `npx gulp lint` (jshint) passes.
- Debug APK builds: `BUILD SUCCESSFUL`.
- APK manifest asserts `package=at.lex.grisu.noe`, `minSdkVersion=24`, `targetSdkVersion=36`,
  `versionName=1.4.0`; storage permissions capped at `maxSdkVersion=28`; no
  `usesCleartextTraffic`.
- APK is signed with the Android debug key (`apksigner verify --print-certs`).
- `at.lex.grisu.noe.screenshot.GrisuScreenshot` is present in the dex.
- All 35 assets referenced by `index.html`, plus every `templateUrl` in `app.js`, are present
  under `assets/www/` in the APK.

### On-device verification

Smoke-tested on a **OnePlus CPH2653, Android 16 (API 36)** — the same API level as `targetSdk`.
Interactive steps were driven over the Chrome DevTools Protocol
(`adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`) rather than by tapping
coordinates, so each result is reproducible.

- App installs and launches, no crash; `Apache Cordova native platform version 15.1.0 is
  starting`, WebView 150.0.7871.181.
- **Live data loads:** `Main data loaded from server`, overview shows real counters
  (`Ausgerückte Feuerwehren: 53`, `Aktive Bezirke: 11`) and the Lower Austria SVG map colours
  its districts by live warn state.
- **Insets are correct** on a real device: status bar tinted `#CD0200`, web content starts
  below it, gesture bar area respected. This validates the `AndroidEdgeToEdge=false` approach —
  no safe-area CSS was needed.
- **All plugin globals resolve at runtime:** `navigator.screenshot`, `cordova.plugin.http`,
  `cordova.plugins.clipboard`, `window.plugins.toast`, `window.StatusBar`, `device` →
  `Android 16`.
- **Map tiles:** of 16 tiles on the water tab, the 8 from `maps.wien.gv.at` all loaded and the
  8 from `openfiremap.org` all failed — confirming both the HTTPS/subdomain fix and the dead
  upstream overlay.
- **Screenshot plugin works end to end** with no storage permission granted: returned
  `Pictures/Grisu/<name>.jpg`, the file exists (1.06 MB JPEG), is registered in MediaStore
  (`relative_path=Pictures/Grisu/`, so it appears in the gallery), and the pulled image shows
  real captured content — i.e. PixelCopy did not return a blank frame.
- **Geolocation, hydrant markers and the Leaflet map** all render correctly on the water tab.

**Still unverified:** the clipboard/toast paths (`$cordovaClipboard`, `$cordovaToast`), the
`postVoting` POST — which needs an unlocked WASTL infoscreen code — and the InAppBrowser
external-link handling. iOS was not touched at all.
