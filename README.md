## Mainplate — Watch Flip & Collection Tracker

<img src="app/static/img/logo_mainplate.png" width="100">

A self-hosted web app for watch enthusiasts and watchmakers to track personal collection, flips, parts inventory, and equipment — all in one place.


https://github.com/user-attachments/assets/6549cc5b-02ca-4963-b349-016421ed3a0d


Built with Flask + SQLite, runs entirely in Docker with no external dependencies.

![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.0-lightgrey?logo=flask)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-DaisyUI-38bdf8?logo=tailwindcss)

---

## Screens

| Light Mode | Dark Mode |
|:----------:|:---------:|
| ![Dashboard](screens/dashboard.jpg "Dashboard") | ![Dashboard Dark](screens/dashboard_dark.jpg "Dashboard Dark mode") |
| ![Flips](screens/flips.jpg "Flips") | ![Flips Dark](screens/flips_dark.jpg "Flips Dark mode") |
| ![Flips](screens/flips_add.jpg "Add Flips") | ![Flips Dark](screens/flips_add_dark.jpg "Add Flips Dark mode") |
| ![Flips](screens/flips_detail.jpg "Flips Detail") | ![Flips Dark](screens/flips_detail_dark.jpg "Flips Detail Dark mode") |
| ![Collection](screens/collection.jpg "Collection") | ![Collection Dark](screens/collection_dark.jpg "Collection Dark Mode") |
| ![Collection](screens/collection_add.jpg "Add Collection") | ![Collection Dark](screens/collection_add_dark.jpg "Add Collection Dark Mode") |
| ![Equipment](screens/equipment.jpg "Equipment") | ![Equipment Dark](screens/equipment_dark.jpg "Equipment Dark Mode") |
| ![Inventory](screens/inventory.jpg "Inventory") | ![Inventory Dark](screens/inventory_dark.jpg "Inventory Dark Mode") |
| ![Settings](screens/settings.jpg "Settings") | ![Settings Dark](screens/settings_dark.jpg "Settings Dark Mode") |

---

## Features

| Section | Description |
|---|---|
| **Dashboard** | P&L overview, recent flips, inventory value, and equipment at a glance |
| **Flips** | Track watches bought to resell — purchase price, sale price, hours worked, ROI |
| **Collection** | Personal watches with wishlist, service/intervention diary, sold tracking, and cost breakdown |
| **Inventory** | Parts, oils, gaskets — with quantity and value per item |
| **Equipment** | Tools and instruments with total value |
| **Settings** | Language, currency, date format, hourly rate, categories, and full ZIP backup/restore |

---

### Financial Tracking & ROI

Every flip is a complete financial record. Mainplate calculates total cost from the purchase price, every log entry expense, and labor hours billed at your configured hourly rate. Profit and **ROI %** are computed automatically once the flip is marked as sold — giving you a real picture of whether a job was worth your time.

The **Dashboard** aggregates everything: total capital deployed, realised profit, average ROI across all sold flips, and open inventory value. The **Collection** section tracks the same for personal watches — purchase price + service costs vs. eventual sale price, with a **gain/loss** figure per watch.

---

### Flip Status Workflow

Each flip moves through a four-stage lifecycle: **Acquired → In Progress → For Sale → Sold**. Stages are colour-coded throughout the UI. Only "Sold" flips contribute to the profit and ROI calculations, so your pipeline and closed deals are always kept separate.

---

### Photo Gallery

Every flip and every collection watch supports **multiple photos**. Images are processed on upload (resized to max 2400 px on the long side, saved as JPEG at 85% quality) using Pillow. Accepted formats: JPEG, PNG, WebP, GIF, HEIC/HEIF. Transparent images are flattened before conversion. Photos are displayed as thumbnails in the list views and in a full lightbox gallery on the detail page, with **drag-to-reorder** support.

---

### Flip Log with Automatic Inventory Sync

Each flip has a detailed log with **date + description + optional cost + category**. Log entries contribute to the net profit calculation. Ticking the **"Add to inventory"** checkbox on a log entry automatically creates or updates the corresponding part in the Inventory section — quantity is incremented and cost is added. Deleting or editing the log entry keeps the inventory record in sync.

---

### Timegrapher

Each flip has a **timegrapher readings log** to record the movement's timing across the six standard positions (DU, DD, 3U, 6U, 9U, 12U), plus overall amplitude and beat error. Multiple readings are stored per flip — useful to compare before/after a service — with the latest reading shown as a summary at the top.

The **delta** (max − min spread across all positions) is computed automatically and colour-coded: green below 10 s/d, yellow 10–20 s/d, red above 20 s/d.

Each cell also carries **per-field diagnostic warnings** that highlight anomalies directly in the table:

| Field | Condition | Level |
|---|---|---|
| DU / DD | diff > 1 s/d | warning — check balance staff pivots |
| Amplitude | < 180° | error — service the movement urgently |
| Amplitude | 180–220° | warning — check lubrication and power reserve |
| Amplitude | > 320° | warning — overbanking risk, check escapement |
| Beat error | > 1.0 ms | error — movement may stop in position |
| Beat error | 0.5–1.0 ms | warning — adjust the lever |
| 3U / 9U | diff > 15 s/d | warning — possible balance wheel poise issue |
| 6U / 12U | diff > 15 s/d | warning — check lever or hairspring |

---

### Collection Log

Each watch in the collection has a service diary (revisions, part replacements, etc.) with optional cost and category per entry. All service costs roll up into the total cost basis for gain/loss tracking.

---

### Wishlist

The collection page includes a dedicated **Wishlist** tab for watches you want to acquire. Wishlist entries support the same fields as owned watches and can be promoted to the active collection at any time.

---

### Sold Watches

Watches in the collection can be marked as sold with a sale date and sale price. Sold items move to a dedicated tab with a **gain/loss** calculation (sale price minus purchase + service costs).

---

### Categories

Log entry categories are managed from Settings with a **name + color** per category. A built-in color picker with live hex preview makes it easy to assign distinct colours. The same category list is shared across flip logs, collection logs, and inventory, ensuring consistency throughout the app.

---

### Watch Lookup

When adding a new flip or collection watch, a **Chrono24 search** field appears at the top of the form. Type a brand, model, or reference number and select a result to auto-fill brand, model, reference, year, and market price. If a photo is available, it is downloaded and attached automatically. Search is debounced (500 ms) and results are cached per session. The feature degrades gracefully if Chrono24 is unreachable.

---

### Inline Editing & Sorting

Flips and collection watches can be edited directly **inline in the list table** without navigating to a separate page, keeping the workflow fast. All tables support **clickable column headers** for sorting — ascending/descending toggle with smart type detection: numeric, date (all three common formats), and text. Destructive actions use an **inline Yes/No confirmation popover** that auto-dismisses after 5 seconds, avoiding disruptive modal dialogs.

---

### Dark Mode

A built-in **light/dark theme toggle** is available from every page. Your preference is saved to localStorage and applied immediately on load — no flash of unstyled content.

---

### Export / Import

Full backup and restore from Settings or Dashboard. The export is a **ZIP archive** containing `data.json` (all tables) plus the `images/` directory. Import accepts both the new ZIP format and the legacy plain-JSON format. ZIP files are detected automatically by magic bytes — no extension guessing.

---

### Internationalisation

UI language is switchable from Settings. Translations live in `lang/en.json` and are also available in Italian, German, French, and Spanish (`lang/it.json`, `de.json`, `fr.json`, `es.json`). Number formatting adapts to locale (e.g. Italian `1.234,56` vs. standard `1234.56`).

---

## Quick Start

**Requirements:** Docker and Docker Compose.

```bash
git clone https://github.com/flaggz/mainplate.git
cd mainplate/app
docker compose up --build
```

Open → **http://localhost:5000**

Run in background:
```bash
docker compose up --build -d
docker compose down   # to stop
```

Data is persisted in a Docker volume (`mainplate_data`). The database and uploaded images survive container restarts and rebuilds.

Full reset (deletes all data):
```bash
docker compose down -v
```

### Local CSS build (Tailwind + DaisyUI)

If you edit styles or templates and want to rebuild frontend CSS locally (without relying on CDN), run these commands from the project root:

```bash
npm install
npm run build:css
```

Watch mode while working on UI:

```bash
npm run watch:css
```

This compiles `app/static/css/input.css` into `app/static/css/tailwind.css`.

---

## Configuration

Environment variables (set in `docker-compose.yml`):

| Variable | Default | Description |
|---|---|---|
| `DATA_DIR` | `/app/data` | Path where the SQLite database and uploaded images are stored |
| `SECRET_KEY` | `mainplate-secret` | Flask session secret — change in production |

Example override in `docker-compose.yml`:
```yaml
environment:
  - DATA_DIR=/app/data
  - SECRET_KEY=your-secret-here
```

In-app settings (saved to the database via the Settings page):

| Setting | Description |
|---|---|
| **Language** | UI language (`en`, `it`, or any custom translation) |
| **Currency symbol** | Symbol shown next to monetary values (e.g. `€`, `$`, `£`) |
| **Date format** | `DD-MM-YYYY`, `MM-DD-YYYY`, or `YYYY-MM-DD` |
| **Hourly rate** | Labor cost per hour, added to flip cost calculations |

---

## Tech Stack

- **Backend:** Python 3.12, Flask 3.0, Gunicorn
- **Image processing:** Pillow (resize, JPEG optimisation, transparency flatten)
- **Database:** SQLite with WAL mode (via Python stdlib)
- **Frontend:** Tailwind CSS + DaisyUI, vanilla JS (Ajax interactions, no framework)
- **Container:** Docker + Docker Compose (single service, named volume)

---

## Project Structure

```
app/
├── app.py                        # Flask app, all routes and DB logic
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── lang/
│   ├── en.json                   # default language
│   ├── it.json
│   ├── de.json
│   ├── es.json
│   └── fr.json
├── templates/
│   ├── base.html
│   ├── dashboard.html
│   ├── flips.html
│   ├── flip_form.html
│   ├── flip_detail.html
│   ├── collection.html
│   ├── collection_form.html
│   ├── collection_detail.html
│   ├── collection_dashboard.html
│   ├── inventory.html
│   ├── equipment.html
│   ├── settings.html
│   └── macros.html
└── static/
    ├── css/
    │   ├── tailwind.css
    │   ├── input.css
    │   ├── daisyui.css
    │   └── style.css
    ├── js/
    │   ├── apexcharts.min.js
    │   └── main.js
    └── img/
        ├── logo_mainplate.png
        ├── favicon.svg
        ├── favicon.ico
        ├── favicon-96x96.png
        ├── apple-touch-icon.png
        ├── site.webmanifest
        ├── web-app-manifest-192x192.png
        └── web-app-manifest-512x512.png
```

---

## Adding a Language

1. Copy `lang/en.json` to `lang/xx.json` (e.g. `de.json`)
2. Translate the values (leave the keys as-is)
3. Restart the container — the new language will appear in Settings

---

## License

CC BY-NC-SA 4.0
