from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, Response, send_from_directory
import sqlite3, os, json, datetime, uuid, zipfile, io
from PIL import Image
import werkzeug.serving

werkzeug.serving.WSGIRequestHandler.address_string = lambda self: self.client_address[0]

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'mainplate-secret')
DATA_DIR = os.environ.get('DATA_DIR', '/app/data')
os.makedirs(DATA_DIR, exist_ok=True)
DB = os.path.join(DATA_DIR, 'mainplate.db')
IMAGE_DIR = os.path.join(DATA_DIR, 'images')
os.makedirs(IMAGE_DIR, exist_ok=True)

IMAGE_MAX_PX = 2400
IMAGE_QUALITY = 85
ALLOWED_MIME = {'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'}


# ── LANG ────────────────────────────────────────────────────
LANG_DIR = os.path.join(os.path.dirname(__file__), 'lang')
TRANSLATIONS = {}

def load_translations():
    global TRANSLATIONS
    TRANSLATIONS = {}
    if os.path.exists(LANG_DIR):
        for f in os.listdir(LANG_DIR):
            if f.endswith('.json'):
                lang_code = f[:-5]
                with open(os.path.join(LANG_DIR, f), 'r', encoding='utf-8') as file:
                    try: TRANSLATIONS[lang_code] = json.load(file)
                    except: TRANSLATIONS[lang_code] = {}

load_translations()

from flask import g

@app.before_request
def load_language():
    conn = get_db()
    lang_row = conn.execute("SELECT value FROM settings WHERE key='language'").fetchone()
    conn.close()
    g.lang = lang_row['value'] if lang_row else 'en'

def _(key):
    try:
        lang = getattr(g, 'lang', 'en')
        return TRANSLATIONS.get(lang, {}).get(key, key)
    except:
        return TRANSLATIONS.get('en', {}).get(key, key)

# ── DB ──────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    conn.execute('PRAGMA journal_mode = WAL')
    conn.execute('PRAGMA synchronous = NORMAL')
    return conn

def init_db():
    conn = get_db(); c = conn.cursor()
    c.executescript('''
    CREATE TABLE IF NOT EXISTS flips (id INTEGER PRIMARY KEY AUTOINCREMENT, brand TEXT NOT NULL, model TEXT NOT NULL, reference TEXT, year INTEGER, status TEXT DEFAULT 'Acquired', paid REAL DEFAULT 0, sold REAL DEFAULT 0, hours REAL DEFAULT 0, notes TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS flip_log (id INTEGER PRIMARY KEY AUTOINCREMENT, flip_id INTEGER NOT NULL REFERENCES flips(id) ON DELETE CASCADE, log_date TEXT NOT NULL, description TEXT NOT NULL, cost REAL DEFAULT 0, category TEXT DEFAULT '', add_to_inventory INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, color TEXT DEFAULT '#888888');
    CREATE TABLE IF NOT EXISTS parts (id INTEGER PRIMARY KEY AUTOINCREMENT, flip_id INTEGER REFERENCES flips(id) ON DELETE SET NULL, log_id INTEGER REFERENCES flip_log(id) ON DELETE CASCADE, name TEXT NOT NULL, category TEXT, quantity INTEGER DEFAULT 1, value REAL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS equipment (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, value REAL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS collection (id INTEGER PRIMARY KEY AUTOINCREMENT, brand TEXT NOT NULL, model TEXT NOT NULL, reference TEXT, year INTEGER, acquired TEXT, purchase_price REAL DEFAULT 0, sold_date TEXT, sold_price REAL DEFAULT 0, notes TEXT DEFAULT '', is_deleted INTEGER DEFAULT 0, is_wishlist INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS collection_log (id INTEGER PRIMARY KEY AUTOINCREMENT, watch_id INTEGER NOT NULL REFERENCES collection(id) ON DELETE CASCADE, log_date TEXT NOT NULL, description TEXT NOT NULL, cost REAL DEFAULT 0, category TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS images (id INTEGER PRIMARY KEY AUTOINCREMENT, entity_type TEXT NOT NULL, entity_id INTEGER NOT NULL, filename TEXT NOT NULL, sort_order INTEGER DEFAULT 0);
    ''')
    conn.commit()

def q(sql, params=(), one=False):
    conn = get_db()
    data = conn.execute(sql,params).fetchone() if one else conn.execute(sql,params).fetchall()
    conn.close(); return data

def run(sql, params=()):
    conn = get_db(); cur = conn.execute(sql,params); conn.commit()
    lid = cur.lastrowid; conn.close(); return lid

def get_settings():
    return {r['key']:r['value'] for r in q('SELECT * FROM settings')}

def get_all_categories():
    """Return all categories from the DB (the single source of truth)."""
    return [dict(r) for r in q('SELECT * FROM categories ORDER BY name')]

def get_images(entity_type, entity_id):
    """Return ordered images for a flip or collection watch."""
    rows = q('SELECT * FROM images WHERE entity_type=? AND entity_id=? ORDER BY sort_order, id',
             (entity_type, entity_id))
    return [dict(r) | {'url': f'/uploads/{r["filename"]}'} for r in rows]

def _save_image(file_storage):
    """Process uploaded file with Pillow, save as JPEG, return filename."""
    img = Image.open(file_storage.stream)
    # Palette images with byte transparency must become RGBA before any further
    # processing — otherwise Pillow emits a UserWarning and the transparency is lost.
    if img.mode == 'P' and 'transparency' in img.info:
        img = img.convert('RGBA')
    # Flatten transparency onto black background before converting to RGB.
    # A direct .convert('RGB') on RGBA/PA/LA composites onto black by default,
    # which causes fringing artifacts on semi-transparent edges.
    if img.mode in ('RGBA', 'LA', 'PA'):
        background = Image.new('RGB', img.size, (0, 0, 0))
        mask = img.split()[-1] if img.mode != 'PA' else img.convert('RGBA').split()[-1]
        background.paste(img.convert('RGB'), mask=mask)
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    # Resize if larger than IMAGE_MAX_PX on long side
    w, h = img.size
    if max(w, h) > IMAGE_MAX_PX:
        factor = IMAGE_MAX_PX / max(w, h)
        img = img.resize((int(w * factor), int(h * factor)), Image.LANCZOS)
    filename = uuid.uuid4().hex + '.jpg'
    img.save(os.path.join(IMAGE_DIR, filename), 'JPEG', quality=IMAGE_QUALITY, optimize=True)
    return filename

@app.context_processor
def inject_globals():
    """Inject categories and date_format into every template automatically."""
    s = get_settings()
    lang = s.get('language', 'en')
    
    def _(key):
        return TRANSLATIONS.get(lang, {}).get(key, key)
        
    return dict(
        categories_all=get_all_categories(),
        date_format=s.get('date_format','DD-MM-YYYY'),
        hourly_rate_global=float(s.get('hourly_rate','0') or 0),
        currency_symbol=s.get('currency_symbol','{{ currency_symbol }}'),
        _=_
    )

def today(): return datetime.date.today().isoformat()

def fmt_date(iso_date, date_format='DD-MM-YYYY'):
    if not iso_date: return ''
    try:
        d = datetime.date.fromisoformat(str(iso_date))
        if date_format == 'MM-DD-YYYY': return d.strftime('%m-%d-%Y')
        if date_format == 'YYYY-MM-DD': return iso_date
        return d.strftime('%d-%m-%Y')
    except: return str(iso_date)

app.jinja_env.filters['fmtdate'] = fmt_date

# ── Stats helpers ───────────────────────────────────────────
def flip_stats(hourly_rate=0):
    flips = q('SELECT * FROM flips ORDER BY id DESC')
    enriched = []
    for f in flips:
        lc = q('SELECT COALESCE(SUM(cost),0) as s FROM flip_log WHERE flip_id=?',(f['id'],),one=True)['s']
        labor = f['hours'] * hourly_rate
        tc = f['paid'] + lc + labor
        profit = (f['sold']-tc) if f['status']=='Sold' else None
        roi = (profit/tc*100) if (profit is not None and tc) else None
        enriched.append(dict(f)|{'log_cost':lc,'labor_cost':labor,'total_cost':tc,'profit':profit,'roi':roi})
    sold_e = [f for f in enriched if f['status']=='Sold']
    total_hours = sum(f['hours'] for f in enriched)
    return dict(flips=enriched, sold_count=len(sold_e), flip_count=len(enriched),
        total_profit=sum(f['profit'] for f in sold_e if f['profit'] is not None),
        capital=sum(f['total_cost'] for f in enriched),
        avg_roi=(sum(f['roi'] for f in sold_e if f['roi'] is not None)/len(sold_e)) if sold_e else 0,
        total_hours=total_hours, hourly_rate=hourly_rate,
        imputed_labor=total_hours*hourly_rate)

def collection_stats(date_format='DD-MM-YYYY'):
    watches = q('SELECT * FROM collection WHERE is_deleted=0 AND is_wishlist=0 ORDER BY acquired DESC, id DESC')
    enriched = []
    for w in watches:
        logs = q('SELECT * FROM collection_log WHERE watch_id=? ORDER BY log_date DESC',(w['id'],))
        sc = sum(l['cost'] for l in logs)
        wd = dict(w)
        for k,v in [('purchase_price',0),('sold_price',0),('sold_date','')]:
            wd.setdefault(k,v)
        is_sold = bool(wd['sold_price'] and wd['sold_date'])
        gain = (wd['sold_price']-(wd['purchase_price']+sc)) if is_sold else None
        enriched.append(wd|{'logs':logs,'service_cost':sc,'total_cost':wd['purchase_price']+sc,
            'is_sold':is_sold,'gain':gain,
            'fmt_acquired':fmt_date(wd.get('acquired',''),date_format),
            'fmt_sold_date':fmt_date(wd.get('sold_date',''),date_format)})
    active = [w for w in enriched if not w['is_sold']]
    sold   = [w for w in enriched if w['is_sold']]
    brands = {}
    for w in active: brands[w['brand']] = brands.get(w['brand'],0)+1
    return dict(watches=enriched, active_watches=active, sold_watches=sold,
        total_purchase=sum(w['purchase_price'] for w in active),
        total_service=sum(w['service_cost'] for w in active),
        total_invested=sum(w['total_cost'] for w in active),
        watch_count=len(active), active_count=len(active),
        sold_count_coll=len(sold), brands=brands)

# ── Inventory sync helpers ──────────────────────────────────
def _upsert_part(name, cat, cost):
    ex = q('SELECT id,quantity,value FROM parts WHERE name=? AND category=?',(name,cat or ''),one=True)
    if ex: run('UPDATE parts SET quantity=quantity+1,value=value+? WHERE id=?',(cost,ex['id']))
    else:  run('INSERT INTO parts (name,category,quantity,value) VALUES (?,?,1,?)',(name,cat or '',cost))

def _sync_part(oname,ocat,ocost,nname,ncat,ncost):
    ex = q('SELECT id,quantity,value FROM parts WHERE name=? AND category=?',(oname,ocat or ''),one=True)
    if ex:
        if oname==nname and (ocat or '')==(ncat or ''):
            run('UPDATE parts SET value=? WHERE id=?',(max(0,ex['value']-ocost+ncost),ex['id']))
        else: _remove_part(oname,ocat,ocost); _upsert_part(nname,ncat,ncost)

def _remove_part(name, cat, cost):
    ex = q('SELECT id,quantity,value FROM parts WHERE name=? AND category=?',(name,cat or ''),one=True)
    if not ex: return
    nq,nv = max(0,ex['quantity']-1),max(0,ex['value']-cost)
    if nq==0: run('DELETE FROM parts WHERE id=?',(ex['id'],))
    else: run('UPDATE parts SET quantity=?,value=? WHERE id=?',(nq,nv,ex['id']))

# ══════════════════════════════════════════════════════════
# DASHBOARD
# ══════════════════════════════════════════════════════════
@app.route('/')
def dashboard():
    s=get_settings(); hr=float(s.get('hourly_rate','0') or 0)
    df=s.get('date_format','DD-MM-YYYY')
    stats=flip_stats(hr); cs=collection_stats(df)
    return render_template('dashboard.html',**stats,
        collection_watches=cs['active_watches'],
        collection_total_purchase=cs['total_purchase'],
        collection_total_service=cs['total_service'],
        collection_total_invested=cs['total_invested'],
        collection_count=cs['watch_count'],
        collection_active_count=cs['active_count'],
        collection_sold_count=cs['sold_count_coll'],
        date_format=df,
        parts=q('SELECT * FROM parts ORDER BY id DESC LIMIT 6'),
        parts_count=q('SELECT COUNT(*) as c FROM parts',one=True)['c'],
        equipment=q('SELECT * FROM equipment ORDER BY id DESC LIMIT 6'),
        equip_count=q('SELECT COUNT(*) as c FROM equipment',one=True)['c'],
        parts_value=q('SELECT COALESCE(SUM(value),0) as s FROM parts',one=True)['s'],
        equip_value=q('SELECT COALESCE(SUM(value),0) as s FROM equipment',one=True)['s'],
        settings=s, active='dashboard')

# ══════════════════════════════════════════════════════════
# FLIPS
# ══════════════════════════════════════════════════════════
@app.route('/flips')
def flips():
    s=get_settings(); hr=float(s.get('hourly_rate','0') or 0)
    return render_template('flips.html',**flip_stats(hr),active='flips')

@app.route('/flips/add',methods=['GET','POST'])
def add_flip():
    if request.method=='POST':
        f=request.form
        fid=run('INSERT INTO flips (brand,model,reference,year,status,paid,sold,hours,notes) VALUES (?,?,?,?,?,?,?,?,?)',
            (f['brand'],f['model'],f.get('reference',''),f.get('year') or None,
             f.get('status','Acquired'),float(f.get('paid',0) or 0),
             float(f.get('sold',0) or 0),float(f.get('hours',0) or 0),f.get('notes','')))
        flash(_('Flip aggiunto!'), 'success'); return redirect(url_for('flip_detail',fid=fid))
    return render_template('flip_form.html',flip=None,active='flips')

@app.route('/flips/<int:fid>', methods=['GET','POST'])
def flip_detail(fid):
    if request.method == 'POST':
        f=request.form
        run('UPDATE flips SET brand=?,model=?,reference=?,year=?,status=?,paid=?,sold=?,hours=?,notes=? WHERE id=?',
            (f['brand'],f['model'],f.get('reference',''),f.get('year') or None,
             f.get('status','Acquired'),float(f.get('paid',0) or 0),
             float(f.get('sold',0) or 0),float(f.get('hours',0) or 0),f.get('notes',''),fid))
        flash(_('Flip aggiornato!'), 'success')
        return redirect(url_for('flip_detail',fid=fid))
    
    flip=q('SELECT * FROM flips WHERE id=?',(fid,),one=True)
    if not flip: return redirect(url_for('flips'))
    s=get_settings(); hr=float(s.get('hourly_rate','0') or 0)
    log=q('SELECT * FROM flip_log WHERE flip_id=? ORDER BY log_date DESC,id DESC',(fid,))
    lc=sum(e['cost'] for e in log)
    labor=flip['hours']*hr; tc=flip['paid']+lc+labor
    profit=(flip['sold']-tc) if flip['status']=='Sold' else None
    roi=(profit/tc*100) if (profit is not None and tc) else None
    return render_template('flip_detail.html',flip=flip,log=log,
        log_cost=lc,labor_cost=labor,total_cost=tc,profit=profit,roi=roi,
        hourly_rate=hr,today=today(),categories=get_all_categories(),
        date_format=s.get('date_format','DD-MM-YYYY'),active='flips',
        images=get_images('flip',fid))



@app.route('/flips/<int:fid>/delete',methods=['POST'])
def delete_flip(fid):
    run('DELETE FROM flips WHERE id=?',(fid,)); flash(_('Flip eliminato.'), 'info')
    return redirect(url_for('flips'))

# ── Ajax add/delete routes ──────────────────────────────────
@app.route('/api/flips',methods=['POST'])
def api_add_flip():
    d=request.json; s=get_settings(); hr=float(s.get('hourly_rate','0') or 0)
    fid=run('INSERT INTO flips (brand,model,reference,year,status,paid,sold,hours,notes) VALUES (?,?,?,?,?,?,?,?,?)',
        (d['brand'],d['model'],d.get('reference',''),d.get('year') or None,
         d.get('status','Acquired'),float(d.get('paid',0) or 0),
         float(d.get('sold',0) or 0),float(d.get('hours',0) or 0),d.get('notes','')))
    f=q('SELECT * FROM flips WHERE id=?',(fid,),one=True)
    labor=f['hours']*hr
    return jsonify(id=fid,brand=f['brand'],model=f['model'],
        reference=f['reference'] or '',year=f['year'] or '',status=f['status'],
        paid=f['paid'],sold=f['sold'],hours=f['hours'],log_cost=0,
        labor_cost=labor,total_cost=f['paid']+labor,profit=None,roi=None)

@app.route('/api/flips/<int:fid>',methods=['DELETE'])
def api_delete_flip_ajax(fid):
    run('DELETE FROM flips WHERE id=?',(fid,)); return jsonify(ok=True)

@app.route('/api/collection',methods=['POST'])
def api_add_collection():
    d=request.json; s=get_settings(); df=s.get('date_format','DD-MM-YYYY')
    wid=run('INSERT INTO collection (brand,model,reference,year,acquired,purchase_price,sold_date,sold_price,notes,is_wishlist) VALUES (?,?,?,?,?,?,?,?,?,?)',
        (d['brand'],d['model'],d.get('reference',''),d.get('year') or None,
         d.get('acquired',''),float(d.get('purchase_price',0) or 0),
         d.get('sold_date',''),float(d.get('sold_price',0) or 0),d.get('notes',''),int(d.get('is_wishlist',0))))
    w=q('SELECT * FROM collection WHERE id=?',(wid,),one=True)
    wd=dict(w)
    for k,v in [('purchase_price',0),('sold_price',0),('sold_date','')]: wd.setdefault(k,v)
    return jsonify(id=wid,brand=wd['brand'],model=wd['model'],
        reference=wd['reference'] or '',year=wd['year'] or '',
        acquired=wd['acquired'] or '',fmt_acquired=fmt_date(wd.get('acquired',''),df),
        purchase_price=wd['purchase_price'],service_cost=0,total_cost=wd['purchase_price'],
        is_sold=False,sold_date='',fmt_sold_date='',sold_price=0,notes=wd['notes'],is_wishlist=wd['is_wishlist'])

@app.route('/api/collection/<int:wid>',methods=['GET'])
def api_get_collection(wid):
    w=q('SELECT * FROM collection WHERE id=?',(wid,),one=True)
    if not w: return jsonify(error="Not found"), 404
    return jsonify(dict(w))

@app.route('/api/collection/<int:wid>',methods=['POST'])
def api_edit_collection_ajax(wid):
    d=request.json; s=get_settings(); df=s.get('date_format','DD-MM-YYYY')
    run('UPDATE collection SET brand=?,model=?,reference=?,year=?,acquired=?,purchase_price=?,sold_date=?,sold_price=?,notes=?,is_wishlist=? WHERE id=?',
        (d['brand'],d['model'],d.get('reference',''),d.get('year') or None,
         d.get('acquired',''),float(d.get('purchase_price',0) or 0),
         d.get('sold_date',''),float(d.get('sold_price',0) or 0),d.get('notes',''),int(d.get('is_wishlist',0)),wid))
    w=q('SELECT * FROM collection WHERE id=?',(wid,),one=True)
    wd=dict(w)
    for k,v in [('purchase_price',0),('sold_price',0),('sold_date','')]: wd.setdefault(k,v)
    sc=q('SELECT COALESCE(SUM(cost),0) as s FROM collection_log WHERE watch_id=?',(wid,),one=True)['s']
    tc=wd['purchase_price']+sc
    is_sold=bool(wd.get('sold_date'))
    return jsonify(id=wid,brand=wd['brand'],model=wd['model'],
        reference=wd['reference'] or '',year=wd['year'] or '',
        acquired=wd['acquired'] or '',fmt_acquired=fmt_date(wd.get('acquired',''),df),
        purchase_price=wd['purchase_price'],service_cost=sc,total_cost=tc,
        is_sold=is_sold,sold_date=wd['sold_date'] or '',fmt_sold_date=fmt_date(wd.get('sold_date',''),df),sold_price=wd['sold_price'],notes=wd['notes'],is_wishlist=wd['is_wishlist'],gain=wd['sold_price']-tc if is_sold else 0)

@app.route('/api/collection/<int:wid>',methods=['DELETE'])
def api_delete_collection_ajax(wid):
    run('DELETE FROM collection WHERE id=?',(wid,)); return jsonify(ok=True)


# Flip log API
@app.route('/api/flips/<int:fid>/log',methods=['POST'])
def api_add_flip_log(fid):
    d=request.json; add_inv=bool(d.get('add_to_inventory',False))
    cat=d.get('category',''); cost=float(d.get('cost',0) or 0); desc=d['description']
    lid=run('INSERT INTO flip_log (flip_id,log_date,description,cost,category,add_to_inventory) VALUES (?,?,?,?,?,?)',
            (fid,d.get('log_date',today()),desc,cost,cat,int(add_inv)))
    if add_inv and desc: _upsert_part(desc,cat,cost)
    e=q('SELECT * FROM flip_log WHERE id=?',(lid,),one=True)
    lc=q('SELECT COALESCE(SUM(cost),0) as s FROM flip_log WHERE flip_id=?',(fid,),one=True)['s']
    flip=q('SELECT paid FROM flips WHERE id=?',(fid,),one=True)
    return jsonify(id=lid,log_date=e['log_date'],fmt_log_date=fmt_date(e['log_date'], get_settings().get('date_format','DD-MM-YYYY')),description=e['description'],
        cost=e['cost'],category=e['category'],add_to_inventory=bool(e['add_to_inventory']),
        log_cost=lc,total_cost=flip['paid']+lc)

@app.route('/api/flip_log/<int:lid>',methods=['POST'])
def api_edit_flip_log(lid):
    d=request.json; old_e=q('SELECT * FROM flip_log WHERE id=?',(lid,),one=True)
    nc=float(d.get('cost',0) or 0); ncat=d.get('category','')
    ndesc=d['description']; ninv=bool(d.get('add_to_inventory',False))
    run('UPDATE flip_log SET log_date=?,description=?,cost=?,category=?,add_to_inventory=? WHERE id=?',
        (d['log_date'],ndesc,nc,ncat,int(ninv),lid))
    was=bool(old_e['add_to_inventory'])
    if was and ninv:      _sync_part(old_e['description'],old_e['category'],old_e['cost'],ndesc,ncat,nc)
    elif was and not ninv: _remove_part(old_e['description'],old_e['category'],old_e['cost'])
    elif not was and ninv: _upsert_part(ndesc,ncat,nc)
    e=q('SELECT * FROM flip_log WHERE id=?',(lid,),one=True)
    lc=q('SELECT COALESCE(SUM(cost),0) as s FROM flip_log WHERE flip_id=?',(e['flip_id'],),one=True)['s']
    flip=q('SELECT paid FROM flips WHERE id=?',(e['flip_id'],),one=True)
    return jsonify(ok=True,log_date=e['log_date'],fmt_log_date=fmt_date(e['log_date'], get_settings().get('date_format','DD-MM-YYYY')),description=e['description'],
        cost=e['cost'],category=e['category'],add_to_inventory=bool(e['add_to_inventory']),
        log_cost=lc,total_cost=flip['paid']+lc)

@app.route('/api/flip_log/<int:lid>',methods=['DELETE'])
def api_delete_flip_log(lid):
    e=q('SELECT * FROM flip_log WHERE id=?',(lid,),one=True)
    if e['add_to_inventory']: _remove_part(e['description'],e['category'],e['cost'])
    run('DELETE FROM flip_log WHERE id=?',(lid,))
    lc=q('SELECT COALESCE(SUM(cost),0) as s FROM flip_log WHERE flip_id=?',(e['flip_id'],),one=True)['s']
    flip=q('SELECT paid FROM flips WHERE id=?',(e['flip_id'],),one=True)
    return jsonify(ok=True,log_cost=lc,total_cost=flip['paid']+lc)

# ══════════════════════════════════════════════════════════
# COLLECTION
# ══════════════════════════════════════════════════════════
@app.route('/collection', methods=['GET', 'POST'])
def collection():
    if request.method == 'POST':
        f = request.form
        run('INSERT INTO collection (brand,model,reference,year,acquired,purchase_price,sold_price,sold_date,notes,is_wishlist) VALUES (?,?,?,?,?,?,?,?,?,?)',
            (f['brand'], f['model'], f.get('reference',''), f.get('year') or None,
             f.get('acquired',''), float(f.get('purchase_price',0) or 0),
             float(f.get('sold_price',0) or 0), f.get('sold_date',''), f.get('notes',''), int(f.get('is_wishlist', 0))))
        flash(_('Orologio aggiunto!'), 'success')
        return redirect(url_for('collection'))

    active_watches = [dict(w) for w in q("""
        SELECT c.*, COALESCE(SUM(l.cost), 0) as service_cost
        FROM collection c
        LEFT JOIN collection_log l ON c.id = l.watch_id
        WHERE c.is_deleted=0 AND c.is_wishlist=0 AND (c.sold_price=0 OR c.sold_price IS NULL)
        GROUP BY c.id ORDER BY c.acquired DESC, c.id DESC
    """)]
    sold_watches = [dict(w) for w in q("""
        SELECT c.*, COALESCE(SUM(l.cost), 0) as service_cost
        FROM collection c
        LEFT JOIN collection_log l ON c.id = l.watch_id
        WHERE c.is_deleted=0 AND c.is_wishlist=0 AND c.sold_price>0
        GROUP BY c.id ORDER BY c.sold_date DESC
    """)]
    wishlist = q("SELECT * FROM collection WHERE is_deleted=0 AND is_wishlist=1 ORDER BY id DESC")

    total_purchase = 0
    total_service = 0

    for w in active_watches:
        w['total_cost'] = w['purchase_price'] + w['service_cost']
        total_purchase += w['purchase_price']
        total_service += w['service_cost']

    for w in sold_watches:
        w['total_cost'] = w['purchase_price'] + w['service_cost']
        w['gain'] = w['sold_price'] - w['total_cost']

    return render_template('collection.html',
        active_watches=active_watches,
        sold_watches=sold_watches,
        wishlist=wishlist,
        watch_count=len(active_watches) + len(sold_watches),
        active_count=len(active_watches),
        sold_count_coll=len(sold_watches),
        total_purchase=total_purchase,
        total_service=total_service,
        total_invested=total_purchase + total_service,
        active='collection'
    )

@app.route('/collection/add',methods=['GET','POST'])
def add_collection():
    if request.method=='POST':
        f=request.form
        wid=run('INSERT INTO collection (brand,model,reference,year,acquired,purchase_price,sold_price,sold_date,notes,is_wishlist) VALUES (?,?,?,?,?,?,?,?,?,?)',
            (f['brand'],f['model'],f.get('reference',''),f.get('year') or None,
             f.get('acquired',''),float(f.get('purchase_price',0) or 0),
             float(f.get('sold_price',0) or 0),f.get('sold_date',''),f.get('notes',''),
             int(f.get('is_wishlist', 0))))
        flash(_('Orologio aggiunto!'), 'success')
        return redirect(url_for('collection_detail',wid=wid))
    return render_template('collection_form.html',watch=None,active='collection')

@app.route('/collection/<int:wid>')
def collection_detail(wid):
    _w=q('SELECT * FROM collection WHERE id=?',(wid,),one=True)
    if not _w: return redirect(url_for('collection'))
    watch=dict(_w)
    for k,v in [('purchase_price',0),('sold_price',0),('sold_date','')]: watch.setdefault(k,v)
    logs=q('SELECT * FROM collection_log WHERE watch_id=? ORDER BY log_date DESC,id DESC',(wid,))
    sc=sum(l['cost'] for l in logs)
    s=get_settings()
    return render_template('collection_detail.html',watch=watch,logs=logs,
        service_cost=sc,today=today(),categories=get_all_categories(),
        date_format=s.get('date_format','DD-MM-YYYY'),active='collection',
        images=get_images('collection',wid))

@app.route('/collection/<int:wid>/edit',methods=['GET','POST'])
def edit_collection(wid):
    _w=q('SELECT * FROM collection WHERE id=?',(wid,),one=True)
    watch=dict(_w)
    for k,v in [('purchase_price',0),('sold_price',0),('sold_date','')]: watch.setdefault(k,v)
    if request.method=='POST':
        f=request.form
        run('UPDATE collection SET brand=?,model=?,reference=?,year=?,acquired=?,purchase_price=?,sold_price=?,sold_date=?,notes=?,is_wishlist=? WHERE id=?',
            (f['brand'],f['model'],f.get('reference',''),f.get('year') or None,
             f.get('acquired',''),float(f.get('purchase_price',0) or 0),
             float(f.get('sold_price',0) or 0),f.get('sold_date',''),f.get('notes',''),f.get('is_wishlist', 0),wid))
        flash(_('Orologio aggiornato!'), 'success')
        return redirect(url_for('collection_detail',wid=wid))
    return render_template('collection_form.html',watch=watch,active='collection')

@app.route('/collection/<int:wid>/delete',methods=['POST'])
def delete_collection(wid):
    run('DELETE FROM collection WHERE id=?',(wid,))
    flash(_('Orologio eliminato dalla collezione.'), 'info')
    return redirect(url_for('collection'))

@app.route('/api/collection/<int:wid>/log',methods=['POST'])
def api_add_collection_log(wid):
    d=request.json
    lid=run('INSERT INTO collection_log (watch_id,log_date,description,cost,category) VALUES (?,?,?,?,?)',
            (wid,d.get('log_date',today()),d['description'],float(d.get('cost',0) or 0),d.get('category','')))
    e=q('SELECT * FROM collection_log WHERE id=?',(lid,),one=True)
    sc=q('SELECT COALESCE(SUM(cost),0) as s FROM collection_log WHERE watch_id=?',(wid,),one=True)['s']
    return jsonify(id=lid,log_date=e['log_date'],fmt_log_date=fmt_date(e['log_date'], get_settings().get('date_format','DD-MM-YYYY')),description=e['description'],
        cost=e['cost'],category=e['category'],service_cost=sc)

@app.route('/api/collection_log/<int:lid>',methods=['POST'])
def api_edit_collection_log(lid):
    d=request.json
    run('UPDATE collection_log SET log_date=?,description=?,cost=?,category=? WHERE id=?',
        (d['log_date'],d['description'],float(d.get('cost',0) or 0),d.get('category',''),lid))
    e=q('SELECT * FROM collection_log WHERE id=?',(lid,),one=True)
    sc=q('SELECT COALESCE(SUM(cost),0) as s FROM collection_log WHERE watch_id=?',(e['watch_id'],),one=True)['s']
    return jsonify(ok=True,log_date=e['log_date'],fmt_log_date=fmt_date(e['log_date'], get_settings().get('date_format','DD-MM-YYYY')),description=e['description'],
        cost=e['cost'],category=e['category'],service_cost=sc)

@app.route('/api/collection_log/<int:lid>',methods=['DELETE'])
def api_delete_collection_log(lid):
    e=q('SELECT watch_id FROM collection_log WHERE id=?',(lid,),one=True)
    run('DELETE FROM collection_log WHERE id=?',(lid,))
    sc=q('SELECT COALESCE(SUM(cost),0) as s FROM collection_log WHERE watch_id=?',(e['watch_id'],),one=True)['s']
    return jsonify(ok=True,service_cost=sc)

# ══════════════════════════════════════════════════════════
# CATEGORIES (single source of truth for all dropdowns)
# ══════════════════════════════════════════════════════════
@app.route('/api/categories',methods=['GET'])
def api_list_categories(): return jsonify(get_all_categories())

@app.route('/api/categories',methods=['POST'])
def api_add_category():
    d=request.json; name=d.get('name','').strip().upper()
    if not name: return jsonify(ok=False,error='Nome richiesto'),400
    try:
        cid=run('INSERT INTO categories (name,color) VALUES (?,?)',(name,d.get('color','#888888')))
        return jsonify(id=cid,name=name,color=d.get('color','#888888'))
    except Exception as e: return jsonify(ok=False,error=str(e)),400

@app.route('/api/categories/<int:cid>',methods=['POST'])
def api_edit_category(cid):
    d=request.json
    run('UPDATE categories SET name=?,color=? WHERE id=?',
        (d.get('name','').strip().upper(),d.get('color','#888888'),cid))
    return jsonify(ok=True)

@app.route('/api/categories/<int:cid>',methods=['DELETE'])
def api_delete_category(cid):
    run('DELETE FROM categories WHERE id=?',(cid,)); return jsonify(ok=True)

# ══════════════════════════════════════════════════════════
# IMAGES
# ══════════════════════════════════════════════════════════
@app.route('/uploads/<path:filename>')
def serve_image(filename):
    """Serve uploaded images from DATA_DIR/images/."""
    return send_from_directory(IMAGE_DIR, filename)

@app.route('/api/images/upload/<entity_type>/<int:eid>', methods=['POST'])
def api_upload_image(entity_type, eid):
    if entity_type not in ('flip', 'collection'):
        return jsonify(ok=False, error='Invalid type'), 400
    files = request.files.getlist('images')
    if not files:
        return jsonify(ok=False, error='No files'), 400
    results = []
    max_order = q('SELECT COALESCE(MAX(sort_order),0) as m FROM images WHERE entity_type=? AND entity_id=?',
                  (entity_type, eid), one=True)['m']
    for i, f in enumerate(files):
        try:
            filename = _save_image(f)
            iid = run('INSERT INTO images (entity_type, entity_id, filename, sort_order) VALUES (?,?,?,?)',
                      (entity_type, eid, filename, max_order + i + 1))
            results.append({'id': iid, 'url': f'/uploads/{filename}', 'filename': filename,
                            'sort_order': max_order + i + 1})
        except Exception as e:
            return jsonify(ok=False, error=str(e)), 400
    return jsonify(ok=True, images=results)

@app.route('/api/images/<int:iid>', methods=['DELETE'])
def api_delete_image(iid):
    row = q('SELECT filename FROM images WHERE id=?', (iid,), one=True)
    if not row:
        return jsonify(ok=False, error='Not found'), 404
    run('DELETE FROM images WHERE id=?', (iid,))
    filepath = os.path.join(IMAGE_DIR, row['filename'])
    if os.path.exists(filepath):
        os.remove(filepath)
    return jsonify(ok=True)

@app.route('/api/images/<int:iid>/sort', methods=['POST'])
def api_sort_image(iid):
    d = request.json
    run('UPDATE images SET sort_order=? WHERE id=?', (int(d.get('sort_order', 0)), iid))
    return jsonify(ok=True)

@app.route('/api/images/<entity_type>/<int:eid>', methods=['GET'])
def api_list_images(entity_type, eid):
    return jsonify(get_images(entity_type, eid))

@app.route('/api/images/first/<entity_type>', methods=['GET'])
def api_images_first(entity_type):
    ids_str = request.args.get('ids', '')
    if not ids_str:
        return jsonify({})
    try:
        ids = [int(x) for x in ids_str.split(',') if x.strip()]
    except ValueError:
        return jsonify({})
    if not ids:
        return jsonify({})
    ph = ','.join('?' * len(ids))
    rows = q(
        f'SELECT i.entity_id, i.id, i.filename '
        f'FROM images i '
        f'WHERE i.entity_type=? AND i.entity_id IN ({ph}) '
        f'AND NOT EXISTS ('
        f'  SELECT 1 FROM images i2 '
        f'  WHERE i2.entity_type=i.entity_type AND i2.entity_id=i.entity_id '
        f'  AND (i2.sort_order < i.sort_order OR (i2.sort_order=i.sort_order AND i2.id < i.id))'
        f')',
        [entity_type] + ids
    )
    return jsonify({str(r['entity_id']): {'id': r['id'], 'url': f"/uploads/{r['filename']}"} for r in rows})

# ══════════════════════════════════════════════════════════
# INVENTORY
# ══════════════════════════════════════════════════════════
@app.route('/inventory')
def inventory():
    parts=q('SELECT * FROM parts ORDER BY category,name')
    pv=q('SELECT COALESCE(SUM(value),0) as s FROM parts',one=True)['s']
    log_parts=q('''SELECT fl.description as name,fl.category,COUNT(*) as qty,
                   SUM(fl.cost) as total_cost,f.brand,f.model,fl.flip_id
                   FROM flip_log fl JOIN flips f ON fl.flip_id=f.id
                   WHERE fl.add_to_inventory=1
                   GROUP BY fl.description,fl.category,fl.flip_id
                   ORDER BY fl.description''')
    return render_template('inventory.html',parts=parts,parts_value=pv,
        log_parts=log_parts,categories=get_all_categories(),active='inventory')

@app.route('/api/parts',methods=['POST'])
def api_add_part():
    d=request.json
    pid=run('INSERT INTO parts (name,category,quantity,value) VALUES (?,?,?,?)',
            (d['name'],d.get('category',''),int(d.get('quantity',1) or 1),float(d.get('value',0) or 0)))
    return jsonify(id=pid)

@app.route('/api/parts/<int:pid>',methods=['POST'])
def api_edit_part(pid):
    d=request.json
    run('UPDATE parts SET name=?,category=?,quantity=?,value=? WHERE id=?',
        (d['name'],d.get('category',''),int(d.get('quantity',1) or 1),float(d.get('value',0) or 0),pid))
    return jsonify(ok=True)

@app.route('/api/parts/<int:pid>',methods=['DELETE'])
def api_delete_part(pid): run('DELETE FROM parts WHERE id=?',(pid,)); return jsonify(ok=True)

# ══════════════════════════════════════════════════════════
# EQUIPMENT
# ══════════════════════════════════════════════════════════
@app.route('/equipment')
def equipment():
    items=q('SELECT * FROM equipment ORDER BY name')
    total=q('SELECT COALESCE(SUM(value),0) as s FROM equipment',one=True)['s']
    return render_template('equipment.html',equipment=items,total=total,active='equipment')

@app.route('/api/equipment',methods=['POST'])
def api_add_equipment():
    d=request.json
    eid=run('INSERT INTO equipment (name,value) VALUES (?,?)',(d['name'],float(d.get('value',0) or 0)))
    return jsonify(id=eid)

@app.route('/api/equipment/<int:eid>',methods=['POST'])
def api_edit_equipment(eid):
    d=request.json
    run('UPDATE equipment SET name=?,value=? WHERE id=?',(d['name'],float(d.get('value',0) or 0),eid))
    return jsonify(ok=True)

@app.route('/api/equipment/<int:eid>',methods=['DELETE'])
def api_delete_equipment(eid): run('DELETE FROM equipment WHERE id=?',(eid,)); return jsonify(ok=True)

# ══════════════════════════════════════════════════════════
# SETTINGS + IMPORT/EXPORT
# ══════════════════════════════════════════════════════════
@app.route('/settings',methods=['GET','POST'])
def settings():
    if request.method == 'POST':
        for k in ['date_format', 'hourly_rate', 'language', 'currency_symbol']:
            v = request.form.get(k, '')
            if v != '':
                run('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=?', (k, v, v))
        flash(_('Settings saved successfully'), 'success')
        return redirect(url_for('settings'))
    
    langs = [f[:-5] for f in os.listdir(LANG_DIR) if f.endswith('.json')] if os.path.exists(LANG_DIR) else ['en']
    return render_template('settings.html', settings=get_settings(), categories=get_all_categories(), active='settings', langs=langs)

@app.route('/api/export')
def api_export():
    """Export all data as a ZIP: data.json + images/ directory."""
    conn = get_db()
    tables = ['flips','flip_log','categories','parts','equipment',
              'collection','collection_log','settings','images']
    data = {t: [dict(r) for r in conn.execute(f'SELECT * FROM {t}').fetchall()]
            for t in tables}
    conn.close()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('data.json', json.dumps(data, indent=2, ensure_ascii=False))
        for row in data.get('images', []):
            fpath = os.path.join(IMAGE_DIR, row['filename'])
            if os.path.exists(fpath):
                zf.write(fpath, f'images/{row["filename"]}')
    return Response(buf.getvalue(), mimetype='application/zip',
        headers={'Content-Disposition': 'attachment; filename=mainplate_backup_'+today()+'.zip'})

@app.route('/api/import', methods=['POST'])
def api_import():
    """Import from ZIP (new format) or plain JSON (legacy format)."""
    try:
        raw = request.data
        # Detect ZIP vs JSON by magic bytes
        if raw[:2] == b'PK':
            buf = io.BytesIO(raw)
            with zipfile.ZipFile(buf, 'r') as zf:
                data = json.loads(zf.read('data.json'))
                for name in zf.namelist():
                    if name.startswith('images/') and name != 'images/':
                        fname = os.path.basename(name)
                        dest = os.path.join(IMAGE_DIR, fname)
                        with zf.open(name) as src, open(dest, 'wb') as dst:
                            dst.write(src.read())
        else:
            data = json.loads(raw)

        conn = get_db(); c = conn.cursor()
        for t in ['flip_log','collection_log','images','flips','categories',
                  'parts','equipment','collection','settings']:
            if t in data: c.execute(f'DELETE FROM {t}')
        for t in ['flips','collection','categories','parts','equipment',
                  'settings','flip_log','collection_log','images']:
            if t not in data or not data[t]: continue
            cols = list(data[t][0].keys()); ph = ','.join('?' * len(cols))
            for row in data[t]:
                c.execute(f'INSERT OR REPLACE INTO {t} ({",".join(cols)}) VALUES ({ph})',
                          [row[c2] for c2 in cols])
        conn.commit(); conn.close()
        return jsonify(ok=True)
    except Exception as e:
        return jsonify(ok=False, error=str(e)), 400

init_db()
if __name__=='__main__': app.run(host='0.0.0.0',port=5000,debug=False)
