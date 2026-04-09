# Mainplate — Watch Tracker

App locale per tracciare flip di orologi, collezione personale, inventario parti e attrezzatura.

**Stack:** Python 3.12 · Flask · Gunicorn · SQLite · Docker

---

## Avvio rapido

```bash
docker compose up --build
```

→ **http://localhost:5000**

In background:
```bash
docker compose up --build -d
docker compose down   # per fermare
```

Il container si chiama `mainplate`. Il DB persiste nel volume Docker `mainplate_data`.

Reset completo (cancella tutti i dati):
```bash
docker compose down -v
```

---

## Sezioni

| Sezione | Descrizione |
|---|---|
| **Dashboard** | KPI P&L, flip recenti, inventario e attrezzatura a colpo d'occhio |
| **Flips** | Orologi comprati per rivendere — P&L, ROI, ore lavorate |
| **Collezione** | Orologi personali con log revisioni e interventi |
| **Inventario** | Parti, oli, guarnizioni con quantità e valore |
| **Attrezzatura** | Strumenti con valore totale |
| **Impostazioni** | Obiettivo prossimo acquisto + Export/Import JSON |

### Log per Flip
Ogni flip ha un log voci con **data + descrizione + costo opzionale**.  
Le spese si sommano al costo di acquisto nel calcolo del profitto netto.

### Log per Collezione
Ogni orologio in collezione ha un diario interventi (revisioni, sostituzioni, ecc.) con costo opzionale.

### Export / Import
Dashboard → pulsanti **Export** / **Import** — oppure Impostazioni.  
Il JSON contiene tutte le tabelle. L'import sovrascrive tutto.

---

## Struttura

```
mainplate/
├── app.py
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── templates/
│   ├── base.html
│   ├── dashboard.html
│   ├── flips.html · flip_form.html · flip_detail.html
│   ├── collection.html · collection_form.html · collection_detail.html
│   ├── inventory.html · equipment.html · settings.html
└── static/
    ├── css/style.css
    ├── js/main.js
    └── img/logo.svg
```
