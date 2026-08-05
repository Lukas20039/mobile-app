Grisu NÖ — Architektur und Funktionsweise
=========================================

Technische Dokumentation der App: Aufbau, Datenquellen und die Eigenheiten, die man kennen
muss, um sie zu warten. Die Android-Modernisierung von 2026 ist separat in
[MODERNIZATION.md](MODERNIZATION.md) beschrieben, das Setup im [README](README.md).

Was die App macht
-----------------

Grisu NÖ zeigt laufende Feuerwehreinsätze in Niederösterreich. Die Daten stammen aus der
**WASTL** (Warn- und Alarmstufenliste), betrieben von mehreren öffentlichen Stellen und
bereitgestellt über die Freiwillige Feuerwehr Krems. Die App ist ein reiner Client — sie hat
kein eigenes Backend und keine eigene Datenhaltung außer einem lokalen Cache.

Technologie
-----------

| Schicht | Technologie |
|---|---|
| UI-Framework | Ionic 1.3.1 (auf AngularJS 1.5.3) |
| Routing | AngularJS UI-Router 0.2.13 |
| Native Wrapper | Apache Cordova, cordova-android 15 |
| Plugin-Zugriff aus Angular | ngCordova 0.1.27-alpha |
| Karten | Leaflet 0.7.7 + angular-leaflet-directive 0.10.0 |
| Diagramme | Chart.js 1.0.2 + angular-chart.js 0.8.1 |
| Sonstiges | moment.js, angular-xml (x2js), angular-md5 |
| Web-Abhängigkeiten | bower → `www/lib/` |
| CSS | SASS → `www/css/` (Ionic-Theme, dunkel) |
| Build | gulp 5, Cordova CLI |

Der Frontend-Stack ist bewusst nicht modernisiert worden. Ionic 1 und AngularJS 1.5 laufen im
aktuellen Android-WebView unverändert; ein Rewrite war nicht Teil der Aufgabe.

Bildschirme und Navigation
--------------------------

Vier Tabs (`templates/tabs.html`), darunter Detailansichten. Alle Zustände sind in `www/js/app.js`
definiert.

| State | URL | Template | Controller |
|---|---|---|---|
| `tabs` *(abstract)* | `/tab` | `tabs.html` | – |
| `tabs.overview` | `/overview` | `overview.html` | `overviewTabController` |
| `tabs.overview-incidents` | `/overview-incidents/:districtName/:id` | `incidents.html` | `incidentsListController` |
| `tabs.overview-history` | `/overview-history` | `history.html` | `historyController` |
| `tabs.overview-incident` | `/overview-incident/:districtId/:incidentId` | `incident.html` | `incidentController` |
| `tabs.overview-extended-incident` | `/overview-extended-incident/:districtId/:extendedIncidentId/:isHistoricIncident` | `extended-incident.html` | `extendedIncidentController` |
| `tabs.districts` | `/districts` | `districts.html` | `districtsTabController` |
| `tabs.districts-incidents` | `/district-incidents/:id` | `incidents.html` | `incidentsListController` |
| `tabs.districts-incident` | `/district-incident/:districtId/:incidentId` | `incident.html` | `incidentController` |
| `tabs.districts-extended-incident` | `/district-extended-incident/…` | `extended-incident.html` | `extendedIncidentController` |
| `tabs.water` | `/water` | `water.html` | `waterTabController` |
| `tabs.statistics` | `/statistics` | `statistics.html` | `statisticsTabController` |

Die Einsatzliste, die Einsatz-Detailansicht und die erweiterte Detailansicht existieren
**doppelt** — einmal unter `overview-*`, einmal unter `districts-*`. Grund: UI-Router braucht
getrennte Zustände, damit der Zurück-Button in den jeweiligen Tab zurückführt. Template und
Controller sind identisch, nur der State-Name unterscheidet sich.

Die vier Tabs:

- **Übersicht** — Landeszähler, anklickbare NÖ-Karte (Inline-SVG, Bezirke als `<path>`), Zugang
  zu Einstellungen, Info und (bei erweiterten Daten) Meldungen und Einsatzhistorie.
- **Bezirke** — durchsuchbare Liste aller Bezirke mit Einsatzzahl und BAZ-Online-Status.
- **Statistik** — Balken- und Tortendiagramme über drei Zeitfenster.
- **Wasser** — Leaflet-Karte mit Wasserentnahmestellen im Umkreis der eigenen Position.

Code-Aufbau
-----------

```
www/
├── index.html                    Bootstrap; lädt alle Skripte, startet Angular auf deviceready
├── js/
│   ├── app.js                    Modul-Definition, Ionic-Config, Routing, .run()-Block
│   ├── controllers/              ein Controller pro Bildschirm
│   ├── factories/                dataService, geoService, storageService, screenshotService
│   └── services/                 util, cordovaHttp (Shim), nativeHttpBackend (Decorator)
├── templates/                    Ionic-Views, Modals und Popover
├── img/                          Marker-Icons für die Karten
└── lib/                          bower-Abhängigkeiten (nicht eingecheckt)
scss/ionic.app.scss               Theme; importiert Ionics SCSS, danach App-Styles
local-plugins/                    eigenes Cordova-Plugin (Screenshot)
resources/                        Icons und Launcher-Grafiken
hooks/                            Cordova-Hook: setzt Plattform-CSS-Klasse
```

Bootstrap-Besonderheit: `index.html` startet Angular **manuell**, erst nach Cordovas
`deviceready`-Event. Im Browser (`ionic serve`) wird sofort gebootet. Deshalb dürfen Plugins
niemals auf Modul-Ebene angesprochen werden, nur innerhalb von `$ionicPlatform.ready()`.

Services
--------

### `dataService` — alle WASTL-Zugriffe

Die einzige Stelle, die mit der WASTL spricht. Enthält die URL-Konfiguration, die
Bezirks-ID-auf-Kartenklasse-Zuordnung und einen 60-Sekunden-Cache für Hauptdaten und BAZ-Info
(`isCacheAlive`). Methoden: `getMainData`, `getActiveIncidents`, `getIncidentData`,
`getInfoScreenData`, `getInfoScreenHistory`, `getInfoMessages`, `getInfoscreenConfig`,
`getBazInfo`, `postVoting`, `getConfig`.

`processMainData` reichert die Serverantwort an: Zähler für Einsätze, Feuerwehren und aktive
Bezirke sowie `mapColorStates`, die Liste der einzufärbenden Kartenbezirke.

### `geoService` — Karten und Positionen

Standard-Kartenlayer (`getStandardLayers`), Geokodierung, Hydrantensuche, aktuelle Position über
`$cordovaGeolocation`, sowie das Zeichnen von Markern, Distanzkreisen und Legende auf die
Leaflet-Karte.

### `storageService` — lokale Einstellungen

Dünner Wrapper um `localStorage` mit JSON-Varianten. Drei Schlüssel:

| Schlüssel | Inhalt |
|---|---|
| `settings` | Mein Bezirk, „Direkt in Bezirk springen", Distanzen, Hydranten, erweiterte Daten |
| `magicCookie` | `{ value, active }` — manuell eingetragene Infoscreen-Session |
| `messages` | MD5-Hashes gelesener Infomeldungen, für die „NEU"-Markierung |

### `util` — Dialoge und Refresh-Muster

`genericRefresh(scope, promise, callback, options)` ist das zentrale Muster: es kapselt
Ladeanzeige, Ionic-Refresher, Fehlerdialog und Auflösung. Fast jeder Controller lädt darüber.
Dazu Fehler-/Erfolgsdialoge und WASTL-Datumsformatierung.

### `screenshotService` und `cordova-plugin-grisu-screenshot`

`navigator.screenshot.save(cb, format, quality, filename)`. Das Plugin liegt unter
`local-plugins/` im Repo, weil das ursprüngliche aufgegeben wurde; Details in
[MODERNIZATION.md](MODERNIZATION.md).

### `cordovaHttp` und `nativeHttpBackend` — Netzwerk auf Android

Zwei Bausteine, die es ohne die Modernisierung nicht gäbe:

- **`nativeHttpBackend.js`** dekoriert `$httpBackend` und leitet **Cross-Origin**-Requests über
  den nativen HTTP-Stack. Nötig, weil cordova-android die App unter `https://localhost`
  ausliefert und die WASTL-Endpunkte keine CORS-Header senden — ohne das lädt die App **keine
  Daten**. Same-Origin-Requests (insbesondere `templateUrl`) bleiben auf XHR.
- **`cordovaHttp.js`** stellt das Angular-Modul `cordovaHTTP` bereit, das früher ein
  eingestelltes Plugin mitbrachte. Wird nur für den Magic-Cookie-Pfad gebraucht.

Datenquellen
------------

Basis-URLs stehen in `dataService`, die Geo-URLs in `geoService`. **Alle Endpunkte sind
HTTPS** — Android blockiert Cleartext seit Version 9, und die App braucht bewusst keine
Ausnahme.

| Zweck | Endpunkt |
|---|---|
| Hauptdaten (Bezirke, Zähler, Statistik) | `infoscreen.florian10.info/OWS/wastlMobile/getMainData.ashx` |
| Aktive Einsätze eines Bezirks | `…/wastlMobile/getEinsatzAktiv.ashx?id=bezirk_<k>` |
| Einzelner Einsatz | `…/wastlMobile/` (siehe `getIncidentData`) |
| Erweiterte Einsatzdaten | `…/Infoscreen/Einsatz.ashx` |
| Erweiterte Daten, Demo | `…/Infoscreen/demo.ashx?demo=3` |
| Einsatzhistorie | `…/Infoscreen/historic.ashx` |
| Infomeldungen | `…/Infoscreen/info.ashx` |
| Infoscreen-Konfiguration | `…/Infoscreen/config.ashx` |
| Einsatz-Rückmeldung (POST) | `…/Infoscreen/rsvp.ashx` |
| BAZ-Online-Status (**XML**) | `atlas.feuerwehr-krems.at/CodePages/Wastl/GetDaten/GetWastlMainS3.asp` |
| Wasserentnahmestellen | `secure.florian10.info/ows/infoscreen/geo/umkreis.ashx` |
| Geokodierung | `maps.googleapis.com/maps/api/geocode/json` ⚠️ *siehe Bekannte Probleme* |

Kartenlayer: basemap.at (`maps.wien.gv.at`), OpenStreetMap, Google Satellit/Gelände,
OpenFireMap-Hydranten-Overlay ⚠️.

Die BAZ-Info kommt als **XML**. Umgewandelt wird sie nicht im `dataService`, sondern global vom
`xmlHttpInterceptor` aus `angular-xml`, der in `app.js` registriert ist und jede Antwort mit
XML-Content-Type transparent nach JSON konvertiert.

Das Datenmodell und seine Fallen
--------------------------------

`getMainData.ashx` liefert pro Bezirk vier kurze Felder. Deren Bedeutung ist die häufigste
Fehlerquelle bei dieser App:

| Feld | Bedeutung |
|---|---|
| `k` | Bezirks-ID, z. B. `01`, `061`. Leer = LWZ (Landeswarnzentrale), nicht auf der Karte |
| `t` | Anzeigename, z. B. „BAZ Wr. Neustadt" |
| `f` | Anzahl **ausgerückter Feuerwehren** |
| `z` | Warnstufe → Kartenfarbe |
| `e` | Anzahl Einsätze — **wird von der API nicht mehr gefüllt, immer 0** |

> [!] **Die Kartenfarbe zählt Feuerwehren, nicht Einsätze.**
> `z` ist ausschließlich eine WASTL-Einteilung von `f`:
> `f = 0` → grau, `1–2` → gelb, `3–5` → orange, `≥ 6` → **rot**.
> Ein roter Bezirk sagt „hier sind mindestens 6 Feuerwehren ausgerückt" — nicht „hier sind
> N Einsätze". Die Legende unter der Übersichtskarte stellt das inzwischen klar.

Weil `e` tot ist, nimmt der Landeszähler „Aktuelle Einsätze" **`h1.s`**. `h1`, `h2` und `h3`
enthalten nach Alarmstufe und Einsatzart aufgeschlüsselte Zählungen über drei Zeitfenster
(`h1` = aktuell aktiv); der Statistik-Tab speist seine Diagramme aus `h1.v`, `h2.v`, `h3.v`.

Alarmstufen erscheinen als Kürzel: `B*` Brand, `T*` technisch, `S*` Schadstoff, `D*`
dienstlich/administrativ, `U*` Übung, `Z*` Zivilschutz, `SOF*` Sonderdienste. Die Ziffer ist die
Stufe. Das Theme färbt `T1–T3` blau, `B1–B4` rot, `S1–S3` grün.

Erweiterte Einsatzdaten (Freischaltung)
---------------------------------------

Zusätzlich zu den öffentlichen Daten kann die App den **WASTL-Infoscreen der FF Krems** anzeigen:
genauer Einsatzort, Rückmeldefunktion, Bemerkungen und Historie. Das ist nur für Mitglieder
einer Feuerwehr gedacht, die diesen Infoscreen verwendet, und wird **server-seitig** gesteuert.

`Einsatz.ashx` antwortet immer mit einem `CurrentState`:

| `CurrentState` | Bedeutung | Verhalten der App |
|---|---|---|
| `token` | Noch kein Code registriert | zeigt den Code in den Einstellungen an |
| `waiting` | Code liegt beim Server und wartet auf Freigabe | zeigt weiterhin den Code an |
| `data` | Freigeschaltet | erweiterte Daten in `EinsatzData` werden verwendet |

Der Ablauf:

1. In den Einstellungen „Erweiterte Einsatzdaten" aktivieren → `updateToken()` fragt
   `Einsatz.ashx` ab und zeigt den `Token` als **Code** an (antippen kopiert ihn in die
   Zwischenablage).
2. Der Server merkt sich den Code über das Cookie **`xFFK_InfoScrCookie_TokenID`** (rund ein
   Jahr gültig). Die Session bleibt also über App-Neustarts erhalten.
3. Ein Verantwortlicher für den Infoscreen der eigenen Feuerwehr schaltet den Code frei.
   Danach wechselt `CurrentState` auf `data`.

Es gibt **keinen** Weg, das clientseitig zu umgehen — `CurrentState` kommt vollständig vom
Server, und im Code existiert keine Stelle, die den Zustand überschreiben könnte.

**Magic Cookie** ist der zweite, versteckte Pfad: ein Popover, in das eine bereits bestehende
`xFFK_InfoScrCookie_SessionID` eingetragen und aktiviert werden kann. Ist das gesetzt, schickt
`getInfoScreenData` sie als manuellen `Cookie`-Header über den nativen HTTP-Stack — deshalb muss
der Header-Merge des HTTP-Plugins explizit gesetzte Header bevorzugen. Erreichbar ist das
Popover derzeit nur über ein **Easter Egg: elfmal auf das Info-Feld tippen**
(`onEasterEggClicked`, `easterEggClickCount > 10`).

Native Plugins
--------------

Die App spricht Plugins fast immer über ngCordova-Wrapper an. Entscheidend ist deshalb nicht die
Plugin-Version, sondern das **globale Objekt**, das ein Plugin belegt:

| Plugin | Global | Verwendung in der App |
|---|---|---|
| `cordova-plugin-device` | `device` | Android-Version für Versionsweichen |
| `cordova-plugin-statusbar` | `window.StatusBar` | heller Statusbar-Text |
| `cordova-plugin-geolocation` | `navigator.geolocation` | `$cordovaGeolocation` im `geoService` |
| `cordova-plugin-inappbrowser` | `cordova.InAppBrowser.open` | externe Links via `$window.open(url, '_system')` |
| `cordova-plugin-android-permissions` | `cordova.plugins.permissions` | Storage-Permission (nur Android 6–9) |
| `cordova-clipboard` | `cordova.plugins.clipboard` | Code in die Zwischenablage |
| `cordova-plugin-x-toast` | `window.plugins.toast` | kurze Hinweise |
| `cordova-plugin-advanced-http` | `cordova.plugin.http` | nativer HTTP-Stack (CORS, Magic Cookie) |
| `cordova-plugin-grisu-screenshot` | `navigator.screenshot` | Screenshot der Karte |

Prüfen lässt sich das nach `cordova prepare` in
`platforms/android/app/src/main/assets/www/cordova_plugins.js` — die `clobbers`-Einträge sind
maßgeblich, nicht die READMEs.

Bekannte Probleme
-----------------

Drei davon liegen außerhalb der App und lassen sich hier nicht beheben.

### Einsatzliste kommt phasenweise leer zurück *(Upstream)*

`getEinsatzAktiv.ashx` liefert zeitweise ein leeres Array für Einsätze, die nachweislich noch
laufen. Über 8 Minuten gemessen: in **14 von 25 Abfragen null Einsätze**, obwohl vier seit
Stunden aktiv waren. Die Listen mehrerer unabhängiger Bezirke kippen gleichzeitig in
~90-Sekunden-Blöcken. Das ist die Ursache für „Bezirk ist rot, aber beim Antippen keine
Einsätze" — die **Farbe ist korrekt, die leere Liste ist falsch**. Messreihe in
[MODERNIZATION.md](MODERNIZATION.md).

Möglicher Ausgleich in der App, bisher nicht umgesetzt: `f > 0` **und** leere Liste ist ein
erkennbar schlechter Response — die App könnte erneut abfragen oder die vorherige Liste behalten,
statt „keine Einsätze vorhanden" anzuzeigen.

### Geokodierung ohne API-Key ⚠️ *(offen)*

`geocodeAddress` nutzt die Google-Geocoding-API **ohne Key**. Die Antwort ist heute
`REQUEST_DENIED` mit leerem `results`. Der Code fängt das still ab (`results.length === 0` →
`return`), es gibt also keinen Fehlerdialog — aber die Folge ist:

- Der Einsatzort wird **nicht** auf der Karte zentriert oder markiert.
- Distanz und Route zum Einsatzort funktionieren nicht.

Betrifft `incidentController` und `extendedIncidentController`. Behebbar durch einen
Google-API-Key oder durch Umstellung auf einen schlüsselfreien Geocoder (z. B. Nominatim,
dessen Nutzungsbedingungen dann zu beachten sind).

### OpenFireMap-Overlay tot *(Upstream)*

`openfiremap.org/hytiles` antwortet für jedes Tile mit 404. Am Gerät bestätigt: 0 von 8 Tiles.
Leaflet zeigt einfach ein leeres Overlay, die App bleibt funktionsfähig.

### `e`-Feld nicht mehr gefüllt *(Upstream, in der App umgangen)*

Siehe oben — der Landeszähler nimmt jetzt `h1.s`.

Wartungshinweise
----------------

- **Keine Plugin-Aufrufe außerhalb von `$ionicPlatform.ready()`** — vor `deviceready` existieren
  die Globals nicht.
- **`www/lib/` und `www/css/` sind generiert** und nicht eingecheckt. Nach einem frischen
  Checkout `npx gulp install` ausführen, sonst startet die App mit leerem Bildschirm.
- **Neue Cross-Origin-Endpunkte** brauchen nichts Zusätzliches — `nativeHttpBackend` greift
  automatisch. Aber sie müssen **HTTPS** sein.
- **Neue Views** immer als Paar anlegen, wenn sie aus beiden Tabs erreichbar sein sollen
  (`overview-*` und `districts-*`).
- **Bezirks-IDs sind Strings mit führender Null** (`01`, nicht `1`) und teils dreistellig
  (`061`). Nie als Zahl behandeln.
- `angular.isUndefinedOrNull` wird in `app.js` global an `angular` gehängt und überall verwendet.
