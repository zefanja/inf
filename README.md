# Informatik – Arbeitsblätter

Materialien liegen im Ordner [`src/`](src/). Jeder **Unterordner** wird auf der
Indexseite zu einer Überschrift, jede Datei darin zu einer Kachel (Titel wird aus
`<title>` bzw. `<h1>` der HTML-Datei gelesen).

## Lokale Vorschau

```bash
node build.mjs        # baut dist/
# oder: npm run build
```

Danach `dist/index.html` im Browser öffnen (bzw. `npx serve dist`).

## Veröffentlichung

Bei jedem Push auf `main` baut GitHub Actions (`.github/workflows/deploy.yml`) den
`dist/`-Ordner und veröffentlicht ihn auf GitHub Pages.

Einmalig einrichten: **Repo → Settings → Pages → Source: „GitHub Actions“**.

`dist/` wird automatisch erzeugt und ist per `.gitignore` ausgeschlossen – nicht
committen.
