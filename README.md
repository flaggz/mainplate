# Mainplate — Watch Flip & Collection Tracker

A self-hosted web app to track watch flips (buy/sell), personal collection, parts inventory, and equipment — all in one place.

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
| ![Dashboard](/screens/dashboard.jpg "Dashboard") | ![Dashboard Dark](/screens/dashboard_dark.jpg "Dashboard Dark mode") |
| ![Flips](/screens/flips.jpg "Flips") | ![Flips Dark](/screens/flips_dark.jpg "Flips Dark mode") |
| ![Collection](/screens/collection.jpg "Collection") | ![Collection Dark](/screens/collection_dark.jpg "Collection Dark Mode") |
| ![Equipment](/screens/equipment.jpg "Equipment") | ![Equipment Dark](/screens/equipment_dark.jpg "Equipment Dark Mode") |
| ![Inventory](/screens/inventory.jpg "Inventory") | ![Inventory Dark](/screens/inventory_dark.jpg "Inventory Dark Mode") |
| ![Settings](/screens/settings.jpg "Settings") | ![Settings Dark](/screens/settings_dark.jpg "Settings Dark Mode") |

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

### Photo Gallery
Every flip and every collection watch supports **multiple photos**. Images are processed on upload (resized to max 2400 px on the long side, saved as JPEG at 85% quality) using Pillow. Photos are displayed as thumbnails in the list views and in a full gallery on the detail page, with drag-to-reorder support.

### Flip Log
Each flip has a detailed log with **date + description + optional cost + category**. Log entries contribute to the net profit calculation and can optionally add parts to inventory automatically.

### Collection Log
Each watch in the collection has a service diary (revisions, part replacements, etc.) with optional cost and category per entry.

### Wishlist
The collection page includes a dedicated **Wishlist** tab for watches you want to acquire. Wishlist entries support the same fields as owned watches and can be promoted to the active collection at any time.

### Sold Watches
Watches in the collection can be marked as sold with a sale date and sale price. Sold items move to a dedicated tab with a **gain/loss** calculation (sale price minus purchase + service costs).

### Categories
Log entry categories are managed from Settings with a **name + color** per category. The same category list is shared across flip logs, collection logs, and inventory, ensuring consistency throughout the app.

### Inline Editing
Flips and collection watches can be edited directly **inline in the list table** without navigating to a separate page, keeping the workflow fast.

### Export / Import
Full backup and restore from Settings or Dashboard. The export is a **ZIP archive** containing `data.json` (all tables) plus the `images/` directory. Import accepts both the new ZIP format and the legacy plain-JSON format.

### Internationalisation
UI language is switchable from Settings. Translations live in `lang/it.json` and `lang/en.json`.

---

## Quick Start

**Requirements:** Docker and Docker Compose.

```bash
git clone https://github.com/flaggz/mainplate.git
cd mainplate
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
mainplate/
├── app.py                   # Flask app, all routes and DB logic
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── lang/
│   ├── en.json              # default language: English
│   ├── es.json              # Spanish translation
│   ├── fr.json              # Franch translation
│   ├── de.json              # German translation
│   └── it.json              # Italian translations
├── templates/
│   ├── base.html
│   ├── dashboard.html
│   ├── flips.html
│   ├── flip_form.html
│   ├── flip_detail.html
│   ├── collection.html
│   ├── collection_form.html
│   ├── collection_detail.html
│   ├── inventory.html
│   ├── equipment.html
│   ├── settings.html
│   └── macros.html
└── static/
    ├── css/
    │   ├── tailwind.css
    │   └── style.css
    ├── js/
    │   └── main.js
    └── img/
        ├── logo.svg
        └── favicon.svg
```

---

## Adding a Language

1. Copy `lang/en.json` to `lang/xx.json` (e.g. `jp.json`)
2. Translate the values (leave the keys as-is)
3. Restart the container — the new language will appear in Settings

---

## License

CC BY-NC-SA 4.0
