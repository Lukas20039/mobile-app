Grisu NÖ - Mobile App [![MIT License][license-image]][license-url] [![Build Status][travis-image]][travis-url] [![Join the chat][chat-image]][chat-url]
============

[![Apple App Store][app-store-image]][app-store-url] [![Google Play Store][play-store-image]][play-store-url]

The already existing mobile web-app (http://mobile.leitstelle122.at/) of WASTL - shortened for "<strong>Wa</strong>rn- und
Alarm<strong>st</strong>ufen<strong>l</strong>iste" in German - is used to display several realtime information of currently running fire
brigade incidents in Lower Austria. The incident data is kindly provided by the voluntary fire department "Freiwillige Feuerwehr Krems".
WASTL is a project by several public sector entities:

> Die Warn- und Alarmstufenliste ist ein gemeinsames Projekt des NÖ Landesfeuerwehrverbandes, der NÖ Landesregierung, des
Bundesrechenzentrums, des Bezirksfeuerwehrkommandos Krems, des Magistrates der Stadt Krems sowie der Freiwilligen Feuerwehr Krems.

This project aims to build a modern mobile web-app based on the [Ionic framework](http://ionicframework.com/) to improve the functionality
of the existing solution. The new resulting mobile app should be available in several app stores for different mobile platforms to have a
native look and feel.

Documentation
-------------

| Document | Contents |
|---|---|
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | How the app is built: screens and routing, services, every WASTL endpoint and what its fields mean, the extended-incident unlock flow, native plugins, known issues, maintenance notes. Start here. |
| **[MODERNIZATION.md](MODERNIZATION.md)** | The 2026 Android modernization: cordova-android 15 / targetSdk 36, plugin replacements, the CORS fix, and the on-device verification results. |

Two things worth knowing before reading the code:

- **The district colour on the overview map counts dispatched fire brigades, not incidents.**
  A red district means at least six brigades are out. See
  [the data model section](ARCHITECTURE.md#das-datenmodell-und-seine-fallen).
- **`www/lib/` and `www/css/` are generated** and not checked in. Without `npx gulp install` the
  app starts with a blank screen.

Contributing
------------

You want to contribute? Great! Thanks for being awesome! Please see the project related
[issues](https://github.com/Grisu-NOE/mobile-app/issues) before you start coding. Pull requests are always welcome!

### Coding guidelines

- 4 spaces for indentation
- 140 character max. line length
- In general, try to make your code blend in with the surrounding code.

### Setup of development environment

See [MODERNIZATION.md](MODERNIZATION.md) for the 2026 Android modernization (cordova-android 15,
targetSdk 36) and the reasoning behind the plugin changes.

Prerequisites for an Android build:

- [node.js](https://nodejs.org/) 20 or newer
- **JDK 21** (cordova-android 15 requires it and rejects newer JDKs)
- Android SDK: `platforms;android-36`, `build-tools;36.0.0`, `platform-tools`
- **Gradle 8.14.2+** on the `PATH` (Cordova needs it to bootstrap its own wrapper)

Then:

- Go to project root folder
- Install node dependencies: `npm install`
- Install web and Cordova dependencies: `npx gulp install`
  - If bower fails on `git://` URLs, scope the rewrite to that process rather than editing your
    global git config:
    `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0="url.https://.insteadOf" GIT_CONFIG_VALUE_0="git://" npx bower install`
- Add platforms
  - `npx cordova platform add ios` (works only on macOS; the iOS side has **not** been modernized)
  - `npx cordova platform add android`
- Build: `npx cordova build android --debug`
- ENJOY!

### Useful commands and hints
- Show app log in console when debugging app on Android device with USB
  - `adb logcat -s CordovaLog:D` or `adb logcat -s chromium:D`
- Start Google Chrome with disabled web security to retrieve data from remote servers
  - see http://stackoverflow.com/a/6083677/1296333
- Watch SASS changes and compile / move it immediately
  - `gulp sass:watch`
- Start web server and open browser. It also watches for code changes.
  - `ionic serve`
- Emulate an iOS device with Mac OSX
  - List available emulators: `<PROJECT_ROOT>/platforms/ios/cordova/lib/list-emulator-images`
  - Start emulator: `ionic emulate ios --target="<TARGET>"` e.g.: `ionic emulate ios --target="iPad (Retina)"`

Licencing
---------

Grisu NÖ is licenced under the [MIT License (MIT)](LICENSE).

[license-image]: http://img.shields.io/badge/license-MIT-blue.svg?style=flat
[license-url]: LICENSE

[travis-url]: https://travis-ci.org/Grisu-NOE/mobile-app
[travis-image]: https://travis-ci.org/Grisu-NOE/mobile-app.svg?branch=master

[chat-image]: https://badges.gitter.im/Join%20Chat.svg
[chat-url]: https://gitter.im/Grisu-NOE/mobile-app?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge

[app-store-url]: https://itunes.apple.com/at/app/grisu-no-feuerwehr-wastl/id961696829?mt=8&uo=4
[app-store-image]: http://cust234.vereinsmeier.com/files/img/Grisu-NOe/app-store.png

[play-store-url]: https://play.google.com/store/apps/details?id=at.lex.grisu.noe
[play-store-image]: http://cust234.vereinsmeier.com/files/img/Grisu-NOe/google-play.png
