# Trainingstagebuch

Ein einfaches, modernes Trainingstagebuch als **PWA** (Progressive Web App) – gebaut für Ultimate-Frisbee-Training. Kein Framework, kein Build-Schritt, kein Backend. Alle Daten bleiben lokal auf dem Handy (localStorage) und können als JSON-Backup exportiert/importiert werden.

## Funktionen

- **Monatskalender** (Wochenstart Montag) mit farbigen Punkten pro Kategorie, „Heute“-Button, Vor/Zurück-Buttons und Wischen zum Monatswechsel
- **Tag antippen** → Bottom Sheet mit 8 farbigen Kategorie-Chips; Auswahl wird sofort gespeichert (2 Taps reichen)
- **Details pro Einheit**: zu jeder geloggten Kategorie kann im Tag-Sheet ein freier Text (z. B. „30 min Joggen“, „Scrim mit Team“) erfasst werden – wird sofort gespeichert
- **Letzte 12 Monate**: Balkendiagramm, Balkenhöhe = Anzahl Trainingseinheiten im Monat, gestapelt und farbcodiert nach Kategorie
- **Legende** und **Monatsübersicht** (Trainingstage pro Kategorie + Gesamtzahl)
- **Backup**: Daten als JSON exportieren und wieder importieren (mit Bestätigung vor dem Überschreiben)
- **Komplett offline** nutzbar (Service Worker), installierbar über Chrome
- Hell-/Dunkelmodus folgt automatisch der Systemeinstellung

### Kategorien

Werfen (blau), Ausdauer (grün), Field Workout – Cuts, Agility (orange), Ultimate Training (gelb), Stretching/Mobility (pink), Beinkraft (lila), Oberkörper Kraft (rot), Sonstiges (grau).

Alle Kategorien und Farben sind zentral im Array `TYPES` ganz oben in `app.js` definiert und lassen sich dort leicht ändern.

### Datenformat

```
{ "JJJJ-MM-TT": [ einheit, ... ], ... }
```

Eine Einheit ist entweder nur die Kategorie-ID (`"werfen"`) oder ein Objekt mit Detail-Text (`{ "t": "werfen", "n": "Lang wirft" }`). Alte Backups ohne Details bleiben vollständig kompatibel; Details werden beim Export mitgesichert.

## Projektstruktur

```
index.html              App-Seite
style.css               Styles (Mobile-first, Light/Dark)
app.js                  Logik + Datenmodell
manifest.webmanifest    PWA-Manifest (Name, Icons, Farben)
service-worker.js       Offline-Cache
icons/                  App-Icons (192, 512, maskable)
make_icons.py           Icon-Generator (optional, nur zum Neuerzeugen)
test.html               Logik-Tests (nur für Entwicklung, nicht nötig für die App)
```

## Lokal testen

Einen kleinen Webserver im Projektordner starten (die App braucht HTTP für den Service Worker):

```bash
# Variante 1: Python
python -m http.server 8000

# Variante 2: Node
npx serve .
```

Dann im Browser (am PC oder im Netzwerk am Handy) öffnen: <http://localhost:8000>

> Direkt per Doppelklick (`file://`) funktioniert die App auch, aber der Service Worker und damit die Offline-/Installations-Funktion ist erst über HTTP aktiv.

Die Logik-Tests ausführen (headless Edge oder einfach im Browser öffnen):

```bash
msedge --headless --disable-gpu --dump-dom test.html
```

## Kostenlos auf GitHub Pages deployen

1. Auf <https://github.com> anmelden (oder kostenlosen Account erstellen) und oben rechts **New repository** wählen.
2. Name z. B. `trainingstagebuch`, Sichtbarkeit **Public** (Private geht auf GitHub Pages nur in der Bezahl-Version), ohne README anlegen → **Create repository**.
3. Den Projektordner hochladen – per Kommandozeile:

   ```bash
   cd D:\Dev\Trainingstagebuch
   git init
   git add .
   git commit -m "Trainingstagebuch"
   git branch -M main
   git remote add origin https://github.com/<DEIN-NAME>/trainingstagebuch.git
   git push -u origin main
   ```

   (oder in der GitHub-Weboberfläche „uploading an existing file“ nutzen)
4. In GitHub unter **Settings → Pages** die Source **Deploy from a branch** wählen, Branch **main** und Ordner **/ (root)** → **Save**.
5. Nach 1–2 Minuten ist die App online unter:
   `https://<DEIN-NAME>.github.io/trainingstagebuch/`
   Wichtig: `start_url` und Pfade in der App sind relativ, deshalb funktioniert das Unterverzeichnis ohne Anpassungen.

## Auf dem Android-Handy installieren (Chrome)

1. Die GitHub-Pages-Adresse in **Chrome** auf dem Handy öffnen.
2. Menü (⋮) → **Zum Startbildschirm hinzufügen** tippen (manchmal auch unter „Installieren/App installieren“).
3. Bestätigen – das Symbol „Training“ erscheint auf dem Startbildschirm und öffnet die App im Vollbild (Stand-Alone-Modus).
4. Einmal Internet haben lassen, bis alles geladen ist – danach läuft alles **offline** weiter.

> Hinweis: Falls Chrome das Installieren nicht anbietet, Seite einmal neu laden und kurz warten; der Service Worker muss beim ersten Besuch fertig installiert sein. Nach einem App-Update auf GitHub wird die neue Version beim nächsten Online-Start automatisch geladen.

## Backup: Exportieren & Importieren

1. Zahnrad-Symbol (⚙) oben rechts antippen.
2. **Daten exportieren** → lädt eine Datei `trainingstagebuch-backup-JJJJ-MM-TT.json` in den Download-Ordner (inkl. aller Detail-Texte).
3. Diese Datei z. B. in der Cloud sichern oder auf ein neues Gerät übertragen.
4. Auf dem neuen Gerät: ⚙ → **Daten importieren** → JSON-Datei wählen → **Überschreiben** bestätigen.

Die Daten liegen zusätzlich unter dem Schlüssel `trainingstagebuch.v1` im localStorage des Browsers. Beim „Seiten-Daten löschen“ in Chrome gehen sie verloren – deshalb regelmäßig exportieren!

## Änderungen an Kategorien oder Farben

In `app.js` das Array `TYPES` anpassen (ID, Anzeigename, Hex-Farbe). Schon gespeicherte Einheiten behalten ihre IDs; beim Entfernen einer Kategorie bleiben die Einträge in alten Tagen erhalten, werden aber in der App ignoriert.
