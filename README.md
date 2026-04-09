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
| ![Dashboard](/screens/dashboard_light.jpg?raw=true "Dashboard") | ![Dashboard Dark](/screens/dashboard_dark.jpg?raw=true "Dashboard Dark mode") |
| ![Flips](/screens/flips_light.jpg?raw=true "Flips") | ![Flips Dark](/screens/flips_dark.jpg?raw=true "Flips Dark mode") |
| ![Add Flip](/screens/flips_add_light.jpg?raw=true "Add Flip") | ![Add Flip Dark](/screens/flips_add_dark.jpg?raw=true "Add Flip Dark mode") |
| ![Flip Detail](/screens/flips_detail_light.jpg?raw=true "Flip Detail") | ![Flip Detail Dark](/screens/flips_detail_dark.jpg?raw=true "Flip Detail Dark Mode") |
| ![Collection](/screens/collection_light.jpg?raw=true "Collection") | ![Collection Dark](/screens/collection_dark.jpg?raw=true "Collection Dark Mode") |
| ![Add to Collection](/screens/collection_add_light.jpg?raw=true "Add to Collection") | ![Add to Collection Dark](/screens/collection_add_dark.jpg?raw=true "Add to Collection Dark Mode") |
| ![Collection Detail](/screens/collection_detail_light.jpg?raw=true "Collection detail") | ![Collection Detail Dark](/screens/collection_detail_dark.jpg?raw=true "Collection detail Dark Mode") |
| ![Equipment](/screens/equipment_light.jpg?raw=true "Equipment") | ![Equipment Dark](/screens/equipment_dark.jpg?raw=true "Equipment Dark Mode") |
| ![Inventory](/screens/inventory_light.jpg?raw=true "Inventory") | ![Inventory Dark](/screens/inventory_dark.jpg?raw=true "Inventory Dark Mode") |
| ![Settings](/screens/settings_light.jpg?raw=true "Settings") | ![Settings Dark](/screens/settings_dark.jpg?raw=true "Settings Dark Mode") |

---



## Features

| Section | Description |
|---|---|
| **Dashboard** | P&L overview, recent flips, inventory value, and equipment at a glance |
| **Flips** | Track watches bought to resell — purchase price, sale price, hours worked, ROI |
| **Collection** | Personal watches with service/intervention diary and cost tracking |
| **Inventory** | Parts, oils, gaskets — with quantity and value per item |
| **Equipment** | Tools and instruments with total value |
| **Settings** | Purchase goal, language, and full JSON export/import |

### Flip Log
Each flip has a detailed log with **date + description + optional cost**. Log entries contribute to the net profit calculation and can optionally add parts to inventory automatically.

### Collection Log
Each watch in the collection has a service diary (revisions, part replacements, etc.) with optional cost per entry.

### Export / Import
Full JSON backup and restore via Dashboard or Settings. The export includes all tables; import overwrites everything.

### Internationalisation
UI language is switchable from Settings. Translations live in `lang/it.json` and `lang/en.json`.

---

## Quick Start

**Requirements:** Docker and Docker Compose.

```bash
git clone https://github.com/YOUR_USERNAME/mainplate.git
cd mainplate
docker compose up --build
```

Open → **http://localhost:5000**

Run in background:
```bash
docker compose up --build -d
docker compose down   # to stop
```

Data is persisted in a Docker volume (`mainplate_data`). The database survives container restarts and rebuilds.

Full reset (deletes all data):
```bash
docker compose down -v
```

---

## Configuration

Environment variables (set in `docker-compose.yml`):

| Variable | Default | Description |
|---|---|---|
| `DATA_DIR` | `/app/data` | Path where the SQLite database is stored |
| `SECRET_KEY` | `mainplate-secret` | Flask session secret — change in production |

Example override in `docker-compose.yml`:
```yaml
environment:
  - DATA_DIR=/app/data
  - SECRET_KEY=your-secret-here
```

---

## Tech Stack

- **Backend:** Python 3.12, Flask 3.0, Gunicorn
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
│   ├── en.json              # default language
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
│   ├── collection_dashboard.html
│   ├── inventory.html
│   ├── equipment.html
│   ├── settings.html
│   └── macros.html
└── static/
    ├── css/
    │   ├── tailwind.css
    │   ├── daisyui.css
    │   └── style.css
    ├── js/
    │   └── main.js
    └── img/
        ├── logo.svg
        └── favicon.svg
```

---

## Adding a Language

1. Copy `lang/en.json` to `lang/xx.json` (e.g. `de.json`)
2. Translate the values (leave the keys as-is)
3. Restart the container — the new language will appear in Settings

---

## License

MIT — do whatever you want with it.
