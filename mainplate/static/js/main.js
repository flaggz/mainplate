// ===== MAINPLATE — main.js =====

// ── Theme ──────────────────────────────────────────────────
function toggleTheme() {
    const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('mp-theme', t);
}

// ── Mobile nav ─────────────────────────────────────────────
function toggleMobileNav() {
    document.getElementById('navLinks').classList.toggle('open');
}

// ── Flash messages ─────────────────────────────────────────
function showFlash(msg, type = 'success') {
    const zone = document.getElementById('ajax-flash-zone');
    if (!zone) return;
    const alertClass = type === 'success' ? 'alert-success' : 'alert-info';
    const el = document.createElement('div');
    el.className = `alert ${alertClass} shadow-lg`;
    el.innerHTML = `<span>${msg}</span><button class="btn btn-sm btn-ghost" onclick="this.parentElement.remove()">✕</button>`;
    el.style.opacity = '0'; el.style.transform = 'translateY(-8px)';
    zone.appendChild(el);
    requestAnimationFrame(() => {
        el.style.transition = 'opacity 1s, transform 1s';
        el.style.opacity = '1'; el.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
        el.style.transition = 'opacity 1s';
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 1050);
    }, 4500);
}

// ── Number formatting ──────────────────────────────────────
function fmtNum(v) { return Math.round(parseFloat(v) || 0).toLocaleString('it'); }
function fmtDec(v) { return (parseFloat(v) || 0).toLocaleString('it', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// Parse numbers that may use , or . as decimal separator
function parseNum(s) {
    if (!s) return NaN;
    const str = s.toString().replace(/[^\d,.-]/g, '');
    // Handle Italian format: 1.234,56 or plain 1234.56
    if (str.includes(',') && str.includes('.')) {
        // e.g. 1.234,56 → remove dots, replace comma
        return parseFloat(str.replace(/\./g, '').replace(',', '.'));
    } else if (str.includes(',')) {
        return parseFloat(str.replace(',', '.'));
    }
    return parseFloat(str) || 0;
}

// Parse numeric input fields — accept both , and .
function parseInputNum(val) {
    return parseFloat((val || '').toString().replace(',', '.')) || 0;
}

// ── Row animation helpers ──────────────────────────────────
function animateIn(el) {
    el.style.opacity = '0'; el.style.transform = 'translateY(-6px)';
    requestAnimationFrame(() => {
        el.style.transition = 'opacity 1s ease, transform 1s ease';
        el.style.opacity = '1'; el.style.transform = 'translateY(0)';
        setTimeout(() => { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; }, 220);
    });
}

function animateOut(el, cb) {
    el.style.transition = 'opacity 1s ease, transform 1s ease';
    el.style.opacity = '0'; el.style.transform = 'translateX(8px)';
    setTimeout(() => { if (cb) cb(); }, 1050);
}

function animateFlash(el) {
    el.style.transition = 'background 1s';
    el.style.background = 'var(--nav-active-bg)';
    setTimeout(() => { el.style.transition = 'background 1s'; el.style.background = ''; }, 150);
}

// ── Table sorting ──────────────────────────────────────────
function initSortable(table) {
    if (!table || table._sortInited) return;
    table._sortInited = true;
    const state = { col: null, dir: 1 };
    table.querySelectorAll('th.sortable-th[data-col]').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
            const col = parseInt(th.dataset.col);
            state.dir = (state.col === col) ? state.dir * -1 : 1;
            state.col = col;
            table.querySelectorAll('th').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
            th.classList.add(state.dir === 1 ? 'sort-asc' : 'sort-desc');
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            // Collect pairs of [dataRow, optional editRow] — keep them together during sort
            const allRows = Array.from(tbody.rows);
            // Build pairs: each data/clickable/sold row + its immediately following edit-row (if any)
            const pairs = [];
            for (let i = 0; i < allRows.length; i++) {
                const r = allRows[i];
                if (r.classList.contains('data-row') || r.classList.contains('clickable-row') || r.classList.contains('sold-row') || (r.id && r.id.includes('-row-'))) {
                    const next = allRows[i + 1];
                    const editRow = (next && next.classList.contains('edit-row')) ? next : null;
                    pairs.push({ row: r, editRow });
                    if (editRow) i++; // skip edit row in outer loop
                }
                // Non-data, non-edit rows (total-row, dash-more-row) are left at end — not moved
            }
            pairs.sort((a, b) => {
                // Prefer data-sort attribute for explicit sort keys (e.g. category cell)
                const cellA = a.row.cells[col];
                const cellB = b.row.cells[col];
                const av = (cellA?.dataset?.sort ?? cellA?.innerText ?? '').toString().trim().replace(/\s+/g, ' ');
                const bv = (cellB?.dataset?.sort ?? cellB?.innerText ?? '').toString().trim().replace(/\s+/g, ' ');
                const dateRe = /^\d{2}[.\-\/]\d{2}[.\-\/]\d{4}$|^\d{4}[.\-\/]\d{2}[.\-\/]\d{2}$/;
                if (dateRe.test(av) && dateRe.test(bv)) {
                    const norm = s => { const p = s.split(/[.\-\/]/); return p.length === 3 ? (p[2].length === 4 ? `${p[2]}-${p[1]}-${p[0]}` : s) : s; };
                    return norm(av) < norm(bv) ? -state.dir : norm(av) > norm(bv) ? state.dir : 0;
                }

                if (th.classList.contains('num')) {
                    const stripped = s => s.replace(/[^\d,.-]/g, '').replace(/\.(?=.*\.)/g, '').replace(',', '.');
                    const an = parseFloat(stripped(av)) || 0;
                    const bn = parseFloat(stripped(bv)) || 0;
                    return (an - bn) * state.dir;
                }

                return av.localeCompare(bv, 'it', { sensitivity: 'base', numeric: true }) * state.dir;
            });
            // Find the first non-data-row to insertBefore (total-row, dash-more-row stay at end)
            const anchor = Array.from(tbody.rows).find(r =>
                !r.classList.contains('data-row') && !r.classList.contains('clickable-row') &&
                !r.classList.contains('sold-row') && !r.classList.contains('edit-row') && !(r.id && r.id.includes('-row-'))
            ) || null;
            pairs.forEach(({ row, editRow }) => {
                tbody.insertBefore(row, anchor);
                if (editRow) tbody.insertBefore(editRow, anchor);
                row.classList.remove('sort-flash'); void row.offsetWidth; row.classList.add('sort-flash');
            });
        });
    });
}

// ── Category select HTML (from window.CUSTOM_CATEGORIES) ──
function buildCatOptions(selected = '') {
    const cats = window.CUSTOM_CATEGORIES || [];
    return '<option value="">—</option>' +
        cats.map(c => `<option value="${c.name}"${c.name === selected ? ' selected' : ''}>${c.name}</option>`).join('');
}

// ── Parts/Equipment inline edit ────────────────────────────
function toggleEditRow(type, id) {
    const er = document.getElementById(`${type}-edit-${id}`);
    const isHidden = er.classList.contains('hidden');
    document.querySelectorAll(`[id^="${type}-edit-"]`).forEach(r => r.classList.add('hidden'));
    if (isHidden) {
        // Refresh category options from current CUSTOM_CATEGORIES
        if (type === 'part') {
            const sel = er.querySelector('select[name="category"]');
            if (sel) { const cur = sel.value; sel.innerHTML = buildCatOptions(cur || sel.dataset.current || ''); }
        }
        er.classList.remove('hidden');
        animateIn(er);
        const inp = er.querySelector('input');
        if (inp) { inp.focus(); inp.select(); }
    }
}

function submitEdit(event, type, id) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    // Normalise numeric fields
    data.value = parseInputNum(data.value);
    data.quantity = parseInt(data.quantity) || 1;
    const url = type === 'part' ? `/api/parts/${id}` : `/api/equipment/${id}`;
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(r => r.json())
        .then(() => {
            const vr = document.getElementById(`${type}-row-${id}`);
            const er = document.getElementById(`${type}-edit-${id}`);
            if (type === 'part') {
                vr.cells[0].textContent = data.name;
                vr.cells[1].innerHTML = data.category ? `<span class="badge badge-outline badge-sm" data-cat="${data.category || ""}">${data.category}</span>` : '<span class="muted">—</span>';
                vr.cells[2].textContent = data.quantity;
                vr.cells[3].textContent = `€${fmtDec(data.value)}`;
            } else {
                vr.cells[0].textContent = data.name;
                vr.cells[1].textContent = `€${fmtDec(data.value)}`;
            }
            er.classList.add('hidden');
            animateFlash(vr);
            showFlash('Aggiornato!');
            refreshTotal(type);
        })
        .catch(() => showFlash('Errore nel salvataggio.', 'info'));
}

function ajaxDelete(type, id) {
    const url = type === 'part' ? `/api/parts/${id}` : `/api/equipment/${id}`;
    const row = document.getElementById(`${type}-row-${id}`);
    const edit = document.getElementById(`${type}-edit-${id}`);
    animateOut(row, () => {
        fetch(url, { method: 'DELETE' })
            .then(r => r.json())
            .then(() => { row.remove(); if (edit) edit.remove(); showFlash('Eliminato.', 'info'); refreshTotal(type); })
            .catch(() => { row.style.opacity = '1'; row.style.transform = ''; showFlash('Errore.', 'info'); });
    });
}

function refreshTotal(type) {
    if (type === 'part') {
        let t = 0;
        document.querySelectorAll('#parts-tbody .data-row').forEach(r => { t += parseNum(r.cells[3]?.textContent) || 0; });
        const lbl = document.getElementById('parts-total-label');
        if (lbl) lbl.textContent = `€${fmtDec(t)} valore totale`;
    } else {
        let t = 0;
        document.querySelectorAll('#equip-tbody .data-row').forEach(r => { t += parseNum(r.cells[1]?.textContent) || 0; });
        const cell = document.getElementById('equip-total-cell');
        if (cell) cell.innerHTML = `<strong>€${fmtDec(t)}</strong>`;
        const lbl = document.getElementById('equip-total-label');
        if (lbl) lbl.textContent = `€${fmtDec(t)} totale`;
    }
}

// ── Ajax Add Part ──────────────────────────────────────────
function ajaxAddPart() {
    const name = document.getElementById('new-part-name').value.trim();
    const cat = document.getElementById('new-part-cat').value;
    const qty = document.getElementById('new-part-qty').value;
    const val = parseInputNum(document.getElementById('new-part-val').value);
    if (!name) { document.getElementById('new-part-name').focus(); return; }
    fetch('/api/parts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category: cat, quantity: qty, value: val })
    })
        .then(r => r.json())
        .then(data => {
            const tbody = document.getElementById('parts-tbody');
            const id = data.id;
            const vr = document.createElement('tr'); vr.id = `part-row-${id}`; vr.className = 'data-row';
            vr.innerHTML = `<td>${name}</td>
            <td>${cat ? `<span class="badge badge-outline badge-sm" data-cat="${data.category || ""}">${cat}</span>` : '<span class="muted">—</span>'}</td>
            <td class="num">${qty}</td><td class="num">€${fmtDec(val)}</td>
            <td><div class="flex gap-3 justify-end text-sm">
                <button class="link link-primary link-hover" onclick="toggleEditRow('part',${id})">Edit</button>
                <button class="link link-error link-hover" onclick="ajaxDelete('part',${id})">Delete</button>
            </div></td>`;
            const er = document.createElement('tr'); er.id = `part-edit-${id}`; er.className = 'edit-row hidden';
            er.innerHTML = `<td colspan="5" class="p-4"><form class="flex flex-col md:flex-row gap-4 items-center w-full" onsubmit="submitEdit(event,'part',${id})">
                <input type="text" name="name" value="${name}" required class="input input-bordered input-sm flex-1">
                <select name="category" data-current="${cat}" class="select select-bordered select-sm">${buildCatOptions(cat)}</select>
                <input type="number" name="quantity" value="${qty}" min="1" class="input input-bordered input-sm w-20">
                <input type="number" step="0.01" name="value" value="${val}" min="0" class="input input-bordered input-sm w-24">
            <div class="flex gap-2">
                <button type="submit" class="btn btn-primary btn-sm">Salva</button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="toggleEditRow('part',${id})">Annulla</button>
            </div></form></td>`;
            tbody.appendChild(vr); tbody.appendChild(er);
            animateIn(vr);
            document.getElementById('new-part-name').value = '';
            document.getElementById('new-part-qty').value = '1';
            document.getElementById('new-part-val').value = '0';
            document.getElementById('new-part-name').focus();
            showFlash('Parte aggiunta!'); refreshTotal('part');
        }).catch(() => showFlash('Errore.', 'info'));
}

// ── Ajax Add Equipment ─────────────────────────────────────
function ajaxAddEquip() {
    const name = document.getElementById('new-equip-name').value.trim();
    const val = parseInputNum(document.getElementById('new-equip-val').value);
    if (!name) { document.getElementById('new-equip-name').focus(); return; }
    fetch('/api/equipment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, value: val })
    })
        .then(r => r.json())
        .then(data => {
            const tbody = document.getElementById('equip-tbody');
            const id = data.id;
            const vr = document.createElement('tr'); vr.id = `equip-row-${id}`; vr.className = 'data-row';
            vr.innerHTML = `<td>${name}</td><td class="num">€${fmtDec(val)}</td>
            <td><div class="flex justify-end gap-3 text-sm">
                <button class="link link-primary link-hover" onclick="toggleEditRow('equip',${id})">Edit</button>
                <button class="link link-error link-hover" onclick="ajaxDelete('equip',${id})">Delete</button>
            </div></td>`;
            const er = document.createElement('tr'); er.id = `equip-edit-${id}`; er.className = 'edit-row hidden';
            er.innerHTML = `<td colspan="3" class="p-4"><form class="flex flex-col sm:flex-row gap-4 items-center justify-between" onsubmit="submitEdit(event,'equip',${id})">
                <div class="flex gap-4 flex-1 w-full sm:w-auto">
                    <input type="text" name="name" value="${name}" required class="input input-bordered input-sm flex-1">
                    <input type="number" step="0.01" name="value" value="${val}" min="0" class="input input-bordered input-sm w-32 text-right">
                </div>
            <div class="flex gap-2">
                <button type="submit" class="btn btn-primary btn-sm">Salva</button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="toggleEditRow('equip',${id})">Annulla</button>
            </div></form></td>`;
            tbody.appendChild(vr); tbody.appendChild(er);
            animateIn(vr);
            document.getElementById('new-equip-name').value = '';
            document.getElementById('new-equip-val').value = '0';
            document.getElementById('new-equip-name').focus();
            showFlash('Strumento aggiunto!'); refreshTotal('equip');
        }).catch(() => showFlash('Errore.', 'info'));
}

// ── Log edit (flip & collection) ───────────────────────────
function toggleLogEdit(type, id) {
    const prefix = type === 'flip' ? 'log' : 'clog';
    const er = document.getElementById(`${prefix}-edit-${id}`);
    const isHidden = er.classList.contains('hidden');
    document.querySelectorAll(`[id^="${prefix}-edit-"]`).forEach(r => r.classList.add('hidden'));
    if (isHidden) {
        // Refresh category select
        const sel = er.querySelector('select[name="category"]');
        if (sel) { const cur = sel.value || sel.dataset.current || ''; sel.innerHTML = buildCatOptions(cur); }
        er.classList.remove('hidden');
        animateIn(er);
        er.querySelector('input')?.focus();
    }
}

function submitLogEdit(event, type, id, parentId) {
    event.preventDefault();
    const fd = new FormData(event.target);
    const data = Object.fromEntries(fd);
    data.add_to_inventory = fd.has('add_to_inventory');
    data.cost = parseInputNum(data.cost);
    const url = type === 'flip' ? `/api/flip_log/${id}` : `/api/collection_log/${id}`;
    const prefix = type === 'flip' ? 'log' : 'clog';
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(r => r.json())
        .then(d => {
            const vr = document.getElementById(`${prefix}-row-${id}`);
            vr.cells[0].textContent = d.fmt_log_date || d.log_date;
            vr.cells[1].textContent = d.description;
            vr.cells[2].innerHTML = d.category ? `<span class="badge badge-outline badge-sm" data-cat="${data.category || ""}">${d.category}</span>` : '<span class="muted">—</span>';
            vr.cells[3].innerHTML = parseFloat(d.cost) > 0 ? `€${fmtDec(d.cost)}` : '<span class="muted">—</span>';
            if (type === 'flip' && vr.cells[4]) {
                vr.cells[4].innerHTML = d.add_to_inventory ? '<span class="inv-check">✓</span>' : '<span class="muted">—</span>';
            }
            document.getElementById(`${prefix}-edit-${id}`).classList.add('hidden');
            animateFlash(vr);
            if (type === 'flip') {
                document.getElementById('log-cost-total').textContent = `€${fmtDec(d.log_cost)}`;
                document.getElementById('total-cost-val').textContent = `€${fmtDec(d.total_cost)}`;
            } else {
                document.getElementById('clog-cost-total').textContent = `€${fmtDec(d.service_cost)}`;
            }
            showFlash('Aggiornato!');
        }).catch(() => showFlash('Errore.', 'info'));
}

// ── Flip Log add/delete ────────────────────────────────────
function addFlipLog(flipId) {
    const date = document.getElementById('log-date').value;
    const desc = document.getElementById('log-desc').value.trim();
    const cat = document.getElementById('log-cat').value;
    const cost = parseInputNum(document.getElementById('log-cost').value);
    const inv = document.getElementById('log-inv').checked;
    if (!desc) { document.getElementById('log-desc').focus(); return; }
    fetch(`/api/flips/${flipId}/log`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_date: date, description: desc, category: cat, cost, add_to_inventory: inv })
    })
        .then(r => r.json())
        .then(data => {
            const tbody = document.getElementById('log-tbody');
            const catBadge = data.category ? `<span class="badge badge-outline badge-sm" data-cat="${data.category || ""}">${data.category}</span>` : '<span class="muted">—</span>';
            const costCell = parseFloat(data.cost) > 0 ? `€${fmtDec(data.cost)}` : '<span class="muted">—</span>';
            const invCell = inv ? '<span class="inv-check">✓</span>' : '<span class="muted">—</span>';
            const tr = document.createElement('tr'); tr.id = `log-row-${data.id}`; tr.className = 'data-row';
            tr.innerHTML = `<td>${data.fmt_log_date || data.log_date}</td><td>${data.description}</td><td>${catBadge}</td>
            <td class="num">${costCell}</td><td>${invCell}</td>
            <td><div class="flex gap-3 justify-end text-sm">
                <button class="link link-primary link-hover" onclick="toggleLogEdit('flip',${data.id})">Edit</button>
                <button class="link link-error link-hover" onclick="deleteFlipLog(${data.id},${flipId})">Del</button>
            </div></td>`;
            const er = document.createElement('tr'); er.id = `log-edit-${data.id}`; er.className = 'edit-row hidden';
            er.innerHTML = `<td colspan="6" class="p-4"><form class="flex flex-col lg:flex-row gap-4 items-center w-full" onsubmit="submitLogEdit(event,'flip',${data.id},${flipId})">
                <input type="date" name="log_date" value="${data.log_date}" class="input input-bordered input-sm">
                <input type="text" name="description" value="${data.description}" required class="input input-bordered input-sm flex-1">
                <select name="category" class="select select-bordered select-sm" data-current="${data.category}">${buildCatOptions(data.category)}</select>
                <input type="number" step="0.01" name="cost" value="${data.cost}" min="0" class="input input-bordered input-sm w-24 text-right">
                <label class="cursor-pointer label gap-2"><input type="checkbox" class="checkbox checkbox-sm" name="add_to_inventory"${inv ? ' checked' : ''}> <span class="label-text">Inv.</span></label>
            <div class="flex gap-2">
                <button type="submit" class="btn btn-primary btn-sm">Salva</button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="toggleLogEdit('flip',${data.id})">Annulla</button>
            </div></form></td>`;
            tbody.insertBefore(tr, tbody.firstChild);
            tbody.insertBefore(er, tr.nextSibling);
            animateIn(tr);
            document.getElementById('log-desc').value = ''; document.getElementById('log-cost').value = '0'; document.getElementById('log-inv').checked = false;
            document.getElementById('log-cost-total').textContent = `€${fmtDec(data.log_cost)}`;
            document.getElementById('total-cost-val').textContent = `€${fmtDec(data.total_cost)}`;
            showFlash(inv ? 'Voce aggiunta e inserita in inventario!' : 'Voce aggiunta!');
        }).catch(() => showFlash('Errore.', 'info'));
}

function deleteFlipLog(lid, flipId) {
    const row = document.getElementById(`log-row-${lid}`);
    const edit = document.getElementById(`log-edit-${lid}`);
    animateOut(row, () => {
        fetch(`/api/flip_log/${lid}`, { method: 'DELETE' })
            .then(r => r.json())
            .then(data => {
                row.remove(); if (edit) edit.remove();
                document.getElementById('log-cost-total').textContent = `€${fmtDec(data.log_cost)}`;
                document.getElementById('total-cost-val').textContent = `€${fmtDec(data.total_cost)}`;
                showFlash('Eliminato.', 'info');
            }).catch(() => { row.style.opacity = '1'; row.style.transform = ''; showFlash('Errore.', 'info'); });
    });
}

// ── Collection Log add/delete ──────────────────────────────
function addCollLog(watchId) {
    const date = document.getElementById('clog-date').value;
    const desc = document.getElementById('clog-desc').value.trim();
    const cat = document.getElementById('clog-cat').value;
    const cost = parseInputNum(document.getElementById('clog-cost').value);
    if (!desc) { document.getElementById('clog-desc').focus(); return; }
    fetch(`/api/collection/${watchId}/log`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_date: date, description: desc, category: cat, cost })
    })
        .then(r => r.json())
        .then(data => {
            const tbody = document.getElementById('clog-tbody');
            const catBadge = data.category ? `<span class="badge badge-outline badge-sm" data-cat="${data.category || ""}">${data.category}</span>` : '<span class="muted">—</span>';
            const costCell = parseFloat(data.cost) > 0 ? `€${fmtDec(data.cost)}` : '<span class="muted">—</span>';
            const tr = document.createElement('tr'); tr.id = `clog-row-${data.id}`; tr.className = 'data-row';
            tr.innerHTML = `<td>${data.fmt_log_date || data.log_date}</td><td>${data.description}</td><td>${catBadge}</td>
            <td class="num">${costCell}</td>
            <td><div class="flex gap-3 justify-end text-sm">
                <button class="link link-primary link-hover" onclick="toggleLogEdit('coll',${data.id})">Edit</button>
                <button class="link link-error link-hover" onclick="deleteCollLog(${data.id},${watchId})">Del</button>
            </div></td>`;
            const er = document.createElement('tr'); er.id = `clog-edit-${data.id}`; er.className = 'edit-row hidden';
            er.innerHTML = `<td colspan="5" class="p-4"><form class="flex flex-col lg:flex-row gap-4 items-center w-full" onsubmit="submitLogEdit(event,'coll',${data.id},${watchId})">
                <input type="date" name="log_date" value="${data.log_date}" class="input input-bordered input-sm">
                <input type="text" name="description" value="${data.description}" required class="input input-bordered input-sm flex-1">
                <select name="category" class="select select-bordered select-sm" data-current="${data.category}">${buildCatOptions(data.category)}</select>
                <input type="number" step="0.01" name="cost" value="${data.cost}" min="0" class="input input-bordered input-sm w-24 text-right">
            <div class="flex gap-2">
                <button type="submit" class="btn btn-primary btn-sm">Salva</button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="toggleLogEdit('coll',${data.id})">Annulla</button>
            </div></form></td>`;
            tbody.insertBefore(tr, tbody.firstChild);
            tbody.insertBefore(er, tr.nextSibling);
            animateIn(tr);
            document.getElementById('clog-desc').value = ''; document.getElementById('clog-cost').value = '0';
            document.getElementById('clog-cost-total').textContent = `€${fmtDec(data.service_cost)}`;
            showFlash('Voce aggiunta!');
        }).catch(() => showFlash('Errore.', 'info'));
}

function deleteCollLog(lid, watchId) {
    const row = document.getElementById(`clog-row-${lid}`);
    const edit = document.getElementById(`clog-edit-${lid}`);
    animateOut(row, () => {
        fetch(`/api/collection_log/${lid}`, { method: 'DELETE' })
            .then(r => r.json())
            .then(data => {
                row.remove(); if (edit) edit.remove();
                document.getElementById('clog-cost-total').textContent = `€${fmtDec(data.service_cost)}`;
                showFlash('Eliminato.', 'info');
            }).catch(() => { row.style.opacity = '1'; row.style.transform = ''; showFlash('Errore.', 'info'); });
    });
}

// ── Export / Import DB ─────────────────────────────────────
function exportDB() { window.location.href = '/api/export'; }
function importDB(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        if (!confirm('Sovrascrivere tutti i dati con il backup selezionato?')) return;
        fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: e.target.result })
            .then(r => r.json())
            .then(d => {
                if (d.ok) { showFlash('Import completato! Ricarico…'); setTimeout(() => location.reload(), 1200); }
                else showFlash('Errore: ' + d.error, 'info');
            })
            .catch(() => showFlash("Errore durante l'import.", 'info'));
    };
    reader.readAsText(file); input.value = '';
}

// ── Categories (Settings page) ─────────────────────────────
function activateCatRow(id) { document.getElementById(`cat-name-${id}`)?.focus(); }

function updateCatPreview(id) {
    const color = document.getElementById(`cat-color-${id}`)?.value || '#888';
    const name = document.getElementById(`cat-name-${id}`)?.value.trim().toUpperCase() || '';
    const prev = document.getElementById(`cat-preview-${id}`);
    if (!prev) return;
    prev.style.background = color + '20'; prev.style.color = color; prev.style.borderColor = color + '40';
    if (name) prev.textContent = name;
}

function catKeydown(event, id) {
    if (event.key === 'Enter') { event.preventDefault(); saveCatRow(id); }
}

const _catTimers = {};
function saveCatRow(id) {
    clearTimeout(_catTimers[id]);
    _catTimers[id] = setTimeout(() => {
        const name = (document.getElementById(`cat-name-${id}`)?.value || '').trim().toUpperCase();
        const color = document.getElementById(`cat-color-${id}`)?.value || '#888888';
        if (!name) return;
        fetch(`/api/categories/${id}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, color })
        })
            .then(r => r.json())
            .then(() => { updateCatPreview(id); showFlash('Categoria aggiornata!'); })
            .catch(() => showFlash('Errore.', 'info'));
    }, 400);
}

function updateNewCatPreview() {
    const c = document.getElementById('new-cat-color')?.value || '#4a90d9';
    const n = document.getElementById('new-cat-name')?.value.trim().toUpperCase() || 'ANTEPRIMA';
    const p = document.getElementById('new-cat-preview');
    if (!p) return;
    p.style.background = c + '20'; p.style.color = c; p.style.borderColor = c + '40'; p.textContent = n;
}

function addCat() {
    const name = document.getElementById('new-cat-name')?.value.trim().toUpperCase();
    const color = document.getElementById('new-cat-color')?.value || '#4a90d9';
    if (!name) { document.getElementById('new-cat-name')?.focus(); return; }
    fetch('/api/categories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color })
    })
        .then(r => r.json())
        .then(data => {
            if (data.error) { showFlash(data.error, 'info'); return; }
            const tbody = document.getElementById('cat-tbody');
            const empty = document.getElementById('cat-empty');
            if (empty) empty.remove();
            const id = data.id;
            const tr = document.createElement('tr'); tr.id = `cat-row-${id}`; tr.className = 'cat-row data-row';
            tr.innerHTML = `
            <td class="p-2" onclick="activateCatRow(${id})">
                <input type="text" class="input input-sm input-ghost w-full uppercase font-medium focus:input-bordered focus:bg-base-100" id="cat-name-${id}" value="${name}"
                     onblur="saveCatRow(${id})" onkeydown="catKeydown(event,${id})">
            </td>
            <td class="p-2">
                <div class="w-10 h-8 rounded overflow-hidden border border-base-300">
                <input type="color" class="w-[150%] h-[150%] -m-2 cursor-pointer" id="cat-color-${id}" value="${color}"
                oninput="updateCatPreview(${id})" onchange="saveCatRow(${id})"></div></td>
            <td class="p-2"><span class="badge badge-outline" id="cat-preview-${id}"
                style="background-color:${color}20;color:${color};border-color:${color}40">${name}</span></td>
            <td class="p-2"><div class="flex justify-end"><button class="link link-error link-hover text-sm" onclick="deleteCat(${id})">Delete</button></div></td>`;
            tbody.appendChild(tr);
            animateIn(tr);
            document.getElementById('new-cat-name').value = '';
            document.getElementById('new-cat-color').value = '#4a90d9';
            updateNewCatPreview();
            showFlash(`Categoria "${name}" aggiunta!`);
            // Also add to window.CUSTOM_CATEGORIES for live selects
            if (!window.CUSTOM_CATEGORIES) window.CUSTOM_CATEGORIES = [];
            window.CUSTOM_CATEGORIES.push({ id, name, color });
        }).catch(() => showFlash('Errore.', 'info'));
}

function deleteCat(id) {
    const row = document.getElementById(`cat-row-${id}`);
    animateOut(row, () => {
        fetch(`/api/categories/${id}`, { method: 'DELETE' })
            .then(r => r.json())
            .then(() => {
                row.remove();
                if (window.CUSTOM_CATEGORIES)
                    window.CUSTOM_CATEGORIES = window.CUSTOM_CATEGORIES.filter(c => c.id !== id);
                showFlash('Eliminata.', 'info');
            }).catch(() => { row.style.opacity = '1'; row.style.transform = ''; showFlash('Errore.', 'info'); });
    });
}

// ── Dashboard widget drag & drop ───────────────────────────
(function initWidgets() {
    const KEY = 'mp-widget-layout';

    function saveLayout() {
        const grid = document.getElementById('widget-grid');
        if (!grid) return;
        const order = [...grid.querySelectorAll('.widget')].map(w => w.dataset.id);
        const widths = {};
        grid.querySelectorAll('.widget').forEach(w => { widths[w.dataset.id] = w.classList.contains('full-width') ? 'full' : 'half'; });
        localStorage.setItem(KEY, JSON.stringify({ order, widths }));
    }

    function loadLayout() {
        const grid = document.getElementById('widget-grid');
        if (!grid) return;
        try {
            const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (!saved) return;
            grid.querySelectorAll('.widget').forEach(w => {
                const id = w.dataset.id;
                if (saved.widths?.[id] === 'full') w.classList.add('full-width');
                else w.classList.remove('full-width');
            });
            if (saved.order) saved.order.forEach(id => {
                const w = grid.querySelector(`[data-id="${id}"]`);
                if (w) grid.appendChild(w);
            });
        } catch (e) { }
    }

    function initDrag() {
        const grid = document.getElementById('widget-grid');
        if (!grid) return;
        let dragged = null;
        grid.querySelectorAll('.widget').forEach(widget => {
            const handle = widget.querySelector('.drag-handle');
            if (!handle) return;
            handle.addEventListener('mousedown', () => widget.setAttribute('draggable', 'true'));
            handle.addEventListener('mouseup', () => widget.setAttribute('draggable', 'false'));
            widget.addEventListener('dragstart', e => { dragged = widget; setTimeout(() => widget.classList.add('dragging'), 0); e.dataTransfer.effectAllowed = 'move'; });
            widget.addEventListener('dragend', () => { widget.classList.remove('dragging'); grid.querySelectorAll('.widget').forEach(w => w.classList.remove('drag-over')); dragged = null; saveLayout(); });
            widget.addEventListener('dragover', e => { e.preventDefault(); if (widget !== dragged) { grid.querySelectorAll('.widget').forEach(w => w.classList.remove('drag-over')); widget.classList.add('drag-over'); } });
            widget.addEventListener('drop', e => { e.preventDefault(); widget.classList.remove('drag-over'); if (dragged && dragged !== widget) { const ws = [...grid.querySelectorAll('.widget')]; const fi = ws.indexOf(dragged), ti = ws.indexOf(widget); if (fi < ti) grid.insertBefore(dragged, widget.nextSibling); else grid.insertBefore(dragged, widget); } });
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        applyCategoryColors();
        loadLayout(); initDrag();
    });
})();

function toggleWidgetWidth(id) {
    const w = document.querySelector(`.widget[data-id="${id}"]`);
    if (!w) return;
    w.classList.toggle('full-width');
    w.querySelectorAll('table').forEach(t => initSortable(t));
    const grid = document.getElementById('widget-grid');
    if (grid) {
        const order = [...grid.querySelectorAll('.widget')].map(w2 => w2.dataset.id);
        const widths = {};
        grid.querySelectorAll('.widget').forEach(w2 => { widths[w2.dataset.id] = w2.classList.contains('full-width') ? 'full' : 'half'; });
        localStorage.setItem('mp-widget-layout', JSON.stringify({ order, widths }));
    }
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    applyCategoryColors();

    // Auto-dismiss server flash
    document.querySelectorAll('.flash').forEach(el => {
        setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 4000);
    });

    // Init sortable on all tables
    document.querySelectorAll('table').forEach(t => initSortable(t));

    // Enter keys for add rows
    const binds = [
        ['new-part-name', ajaxAddPart],
        ['new-equip-name', ajaxAddEquip],
    ];
    binds.forEach(([id, fn]) => {
        document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fn(); } });
    });

    // Log add rows
    const logDesc = document.getElementById('log-desc');
    if (logDesc) {
        const btn = document.querySelector('[onclick^="addFlipLog"]');
        if (btn) {
            const fid = btn.getAttribute('onclick').match(/\d+/)?.[0];
            if (fid) logDesc.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addFlipLog(parseInt(fid)); } });
        }
    }
    const clogDesc = document.getElementById('clog-desc');
    if (clogDesc) {
        const btn = document.querySelector('[onclick^="addCollLog"]');
        if (btn) {
            const wid = btn.getAttribute('onclick').match(/\d+/)?.[0];
            if (wid) clogDesc.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addCollLog(parseInt(wid)); } });
        }
    }

    // New cat preview live
    document.getElementById('new-cat-name')?.addEventListener('input', updateNewCatPreview);
    document.getElementById('new-cat-color')?.addEventListener('input', updateNewCatPreview);
});

// ── Category color application ─────────────────────────────
// Apply colors to cat-badge elements that have data-cat attribute
// Colors come from window.CUSTOM_CATEGORIES
function applyCategoryColors() {
    if (!window.CUSTOM_CATEGORIES) return;
    const map = {};
    window.CUSTOM_CATEGORIES.forEach(c => { map[c.name] = c.color; });
    document.querySelectorAll('.badge[data-cat]').forEach(el => {
        const color = map[el.dataset.cat];
        if (color) {
            el.style.background = color + '20';
            el.style.color = color;
            el.style.borderColor = color + '40';
        }
    });
    // Also plain cat-badge without data-cat: try to match text
    document.querySelectorAll('.badge:not([data-cat])').forEach(el => {
        const name = el.textContent.trim();
        const color = map[name];
        if (color) {
            el.style.background = color + '20';
            el.style.color = color;
            el.style.borderColor = color + '40';
        }
    });
}

// ── Inline confirmation (tooltip style) ───────────────────
function inlineConfirm(btn, msg, onConfirm) {
    // Remove any existing confirm popover
    document.querySelectorAll('.confirm-popover').forEach(p => p.remove());
    const pop = document.createElement('span');
    pop.className = 'confirm-popover';
    pop.innerHTML = `${msg} <button class="confirm-yes">Sì</button><button class="confirm-no">No</button>`;
    btn.parentNode.insertBefore(pop, btn.nextSibling);
    pop.querySelector('.confirm-yes').onclick = () => { pop.remove(); onConfirm(); };
    pop.querySelector('.confirm-no').onclick = () => pop.remove();
    // Auto-dismiss after 5s
    setTimeout(() => pop.remove(), 5000);
}

// ── Delete flip (ajax, inline confirm) ─────────────────────
function deleteFlipConfirm(fid, btn) {
    inlineConfirm(btn, 'Eliminare?', () => {
        const row = document.getElementById(`flip-row-${fid}`);
        animateOut(row, () => {
            fetch(`/api/flips/${fid}`, { method: 'DELETE' })
                .then(r => r.json())
                .then(() => { row.remove(); showFlash('Flip eliminato.', 'info'); })
                .catch(() => { row.style.opacity = '1'; row.style.transform = ''; showFlash('Errore.', 'info'); });
        });
    });
}

// Called from flip_detail page
function deleteFlip(fid, btn) {
    inlineConfirm(btn, 'Eliminare questo flip?', () => {
        fetch(`/api/flips/${fid}`, { method: 'DELETE' })
            .then(r => r.json())
            .then(() => { window.location = '/flips'; })
            .catch(() => showFlash('Errore.', 'info'));
    });
}

// ── Delete flip log (inline confirm) ──────────────────────
function deleteFlipLogConfirm(lid, flipId, btn) {
    inlineConfirm(btn, 'Eliminare?', () => deleteFlipLog(lid, flipId));
}

// ── Delete collection watch (ajax, inline confirm) ─────────
function deleteCollConfirm(wid, btn) {
    inlineConfirm(btn, 'Eliminare?', () => {
        const row = document.getElementById(`coll-row-${wid}`);
        animateOut(row, () => {
            fetch(`/api/collection/${wid}`, { method: 'DELETE' })
                .then(r => r.json())
                .then(() => { row.remove(); showFlash('Orologio eliminato.', 'info'); })
                .catch(() => { row.style.opacity = '1'; row.style.transform = ''; showFlash('Errore.', 'info'); });
        });
    });
}

// ── Delete category (inline confirm, skip save if unchanged) ─
function deleteCat(id) {
    const row = document.getElementById(`cat-row-${id}`);
    inlineConfirm(row.querySelector('.action-link.danger'), 'Eliminare?', () => {
        animateOut(row, () => {
            fetch(`/api/categories/${id}`, { method: 'DELETE' })
                .then(r => r.json())
                .then(() => {
                    row.remove();
                    if (window.CUSTOM_CATEGORIES)
                        window.CUSTOM_CATEGORIES = window.CUSTOM_CATEGORIES.filter(c => c.id !== id);
                    showFlash('Eliminata.', 'info');
                }).catch(() => { row.style.opacity = '1'; row.style.transform = ''; showFlash('Errore.', 'info'); });
        });
    });
}

// Override saveCatRow to track original values and skip if unchanged
(function () {
    const _originals = {};
    const origSave = window.saveCatRow;
    // Track original values on page load
    document.addEventListener('DOMContentLoaded', () => {
        applyCategoryColors();

        document.querySelectorAll('[id^="cat-name-"]').forEach(inp => {
            const id = inp.id.replace('cat-name-', '');
            const color = document.getElementById(`cat-color-${id}`)?.value || '';
            _originals[id] = { name: inp.value, color };
        });
    });
    window.saveCatRow = function (id) {
        clearTimeout(window._catTimers?.[id]);
        window._catTimers = window._catTimers || {};
        window._catTimers[id] = setTimeout(() => {
            const name = (document.getElementById(`cat-name-${id}`)?.value || '').trim().toUpperCase();
            const color = document.getElementById(`cat-color-${id}`)?.value || '#888888';
            if (!name) return;
            // Skip if nothing changed
            const orig = _originals[id];
            if (orig && orig.name === name && orig.color === color) return;
            fetch(`/api/categories/${id}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, color })
            })
                .then(r => r.json())
                .then(() => {
                    _originals[id] = { name, color }; // update original
                    updateCatPreview(id);
                    showFlash('Categoria aggiornata!');
                })
                .catch(() => showFlash('Errore.', 'info'));
        }, 400);
    };
})();

// ── Inline add flip ────────────────────────────────────────
function toggleAddFlipForm() {
    const wrap = document.getElementById('add-flip-form-wrap');
    if (!wrap) return;
    const isHidden = wrap.classList.contains('hidden');
    if (isHidden) {
        wrap.classList.remove('hidden');
        animateIn(wrap);
        document.getElementById('nf-brand')?.focus();
        document.getElementById('add-flip-btn').textContent = '✕ ' + (window.I18N_CANCEL || 'Cancel');
    } else {
        wrap.classList.add('hidden');
        document.getElementById('add-flip-btn').textContent = '+ ' + (window.I18N_NEW_FLIP || 'New Flip');
    }
}

function ajaxAddFlip() {
    const brand = document.getElementById('nf-brand')?.value.trim();
    const model = document.getElementById('nf-model')?.value.trim();
    if (!brand || !model) { showFlash('Brand e Modello sono obbligatori.', 'info'); return; }
    const data = {
        brand, model,
        reference: document.getElementById('nf-ref')?.value.trim() || '',
        year: document.getElementById('nf-year')?.value || null,
        status: document.getElementById('nf-status')?.value || 'Acquired',
        paid: parseInputNum(document.getElementById('nf-paid')?.value),
        sold: parseInputNum(document.getElementById('nf-sold')?.value),
        hours: parseInputNum(document.getElementById('nf-hours')?.value),
        notes: document.getElementById('nf-notes')?.value.trim() || '',
    };
    fetch('/api/flips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(r => r.json())
        .then(f => {
            const tbody = document.getElementById('flips-tbody');
            const empty = document.getElementById('flips-empty');
            if (empty) empty.remove();
            const hr = window.HOURLY_RATE || 0;
            const labor = f.hours * hr;
            const tc = f.paid + f.log_cost + labor;
            const tr = document.createElement('tr');
            tr.id = `flip-row-${f.id}`; tr.className = 'clickable-row';
            tr.setAttribute('onclick', `window.location='/flips/${f.id}'`);
            const badgeClass = `badge-${(f.status || '').toLowerCase().replace(/ /g, '-')}`;
            tr.innerHTML = `
            <td><div class="watch-name">${f.brand} ${f.model}</div><div class="watch-ref">${f.reference}${f.year ? ' · ' + f.year : ''}</div></td>
            <td><span class="badge ${badgeClass}">${f.status}</span></td>
            <td class="num">€${fmtNum(f.paid)}</td>
            <td class="num"><span class="muted">—</span></td>
            <td class="num"><span class="muted">—</span></td>
            <td class="num">€${fmtNum(tc)}</td>
            <td class="num"><span class="muted">—</span></td>
            <td class="num"><span class="muted">—</span></td>
            <td class="num"><span class="muted">—</span></td>
            <td class="num">${fmtNum(f.hours)}h</td>
            <td onclick="event.stopPropagation()"><div class="row-actions">
                <a href="/flips/${f.id}/edit" class="action-link">Edit</a>
                <button class="action-link danger" onclick="deleteFlipConfirm(${f.id},this)">Del</button>
            </div></td>`;
            tbody.insertBefore(tr, tbody.firstChild);
            animateIn(tr);
            // Reset form
            ['nf-brand', 'nf-model', 'nf-ref', 'nf-year', 'nf-notes'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
            ['nf-paid', 'nf-sold', 'nf-hours'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '0';
            });
            toggleAddFlipForm();
            showFlash(`Flip "${f.brand} ${f.model}" aggiunto!`);
        }).catch(() => showFlash('Errore durante aggiunta.', 'info'));
}

// ── Inline add collection watch ────────────────────────────
window.currentEditCollId = null;

function toggleAddCollForm() {
    const wrap = document.getElementById('add-coll-form-wrap');
    if (!wrap) return;
    if (wrap.classList.contains('hidden')) {
        window.currentEditCollId = null;
        ['nc-brand', 'nc-model', 'nc-ref', 'nc-year', 'nc-acquired', 'nc-sold-date', 'nc-notes'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        ['nc-price', 'nc-sold-price'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '0';
        });
        const wl = document.getElementById('nc-wishlist');
        if (wl) wl.checked = false;
        if (window.updateWishlistBtnUI) window.updateWishlistBtnUI();

        const title = wrap.querySelector('.form-section-title');
        if (title) title.textContent = window.I18N_ADD_WATCH_FORM || 'Add Watch (Quick Form)';
        const saveBtn = wrap.querySelector('.btn-primary');
        if (saveBtn) saveBtn.textContent = window.I18N_ADD || 'Add';

        wrap.classList.remove('hidden');
        animateIn(wrap);
        document.getElementById('nc-brand')?.focus();
    } else {
        wrap.classList.add('hidden');
        window.currentEditCollId = null;
    }
}

function openEditColl(wid) {
    fetch('/api/collection/' + wid)
        .then(r => r.json())
        .then(w => {
            if (w.error) return;
            window.currentEditCollId = wid;

            document.getElementById('nc-brand').value = w.brand || '';
            document.getElementById('nc-model').value = w.model || '';
            document.getElementById('nc-ref').value = w.reference || '';
            document.getElementById('nc-year').value = w.year || '';
            document.getElementById('nc-acquired').value = w.acquired || '';
            document.getElementById('nc-price').value = w.purchase_price > 0 ? w.purchase_price : 0;
            document.getElementById('nc-sold-date').value = w.sold_date || '';
            document.getElementById('nc-sold-price').value = w.sold_price > 0 ? w.sold_price : 0;
            document.getElementById('nc-notes').value = w.notes || '';

            const wl = document.getElementById('nc-wishlist');
            if (wl) {
                wl.checked = w.is_wishlist === 1;
                if (window.updateWishlistBtnUI) window.updateWishlistBtnUI();
            }

            const wrap = document.getElementById('add-coll-form-wrap');
            wrap.classList.remove('hidden');
            let formTitle = wrap.querySelector('.form-section-title');
            if (formTitle) formTitle.textContent = window.I18N_EDIT_WATCH_FORM || 'Edit Watch';

            let saveBtn = wrap.querySelector('.btn-primary');
            if (saveBtn) saveBtn.textContent = window.I18N_SAVE || 'Save';

            animateIn(wrap);
            window.scrollTo({ top: wrap.offsetTop - 20, behavior: 'smooth' });
        });
}

function ajaxAddCollection() {
    const brand = document.getElementById('nc-brand')?.value.trim();
    const model = document.getElementById('nc-model')?.value.trim();
    if (!brand || !model) { showFlash('Brand e Modello sono obbligatori.', 'info'); return; }
    const data = {
        brand, model,
        reference: document.getElementById('nc-ref')?.value.trim() || '',
        year: document.getElementById('nc-year')?.value || null,
        acquired: document.getElementById('nc-acquired')?.value || '',
        purchase_price: parseInputNum(document.getElementById('nc-price')?.value),
        sold_date: document.getElementById('nc-sold-date')?.value || '',
        sold_price: parseInputNum(document.getElementById('nc-sold-price')?.value),
        notes: document.getElementById('nc-notes')?.value.trim() || '',
        is_wishlist: document.getElementById('nc-wishlist')?.checked ? 1 : 0,
    };

    let url = '/api/collection';
    let method = 'POST';
    const isEdit = !!window.currentEditCollId;
    if (isEdit) {
        url = '/api/collection/' + window.currentEditCollId;
    }

    fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(r => r.json())
        .then(w => {
            let tr = document.getElementById(`coll-row-${w.id}`);
            let wasInTable = tr ? tr.closest('tbody')?.id : null;
            let targetTable = '';

            if (w.is_wishlist) {
                targetTable = 'coll-wishlist-tbody';
            } else if (w.is_sold) {
                targetTable = 'coll-sold-tbody';
            } else {
                targetTable = 'coll-active-tbody';
            }

            if (!tr) {
                tr = document.createElement('tr');
                tr.id = `coll-row-${w.id}`;
            } else if (wasInTable !== targetTable) {
                tr.remove();
            }

            tr.className = 'data-row clickable-row' + (w.is_sold ? ' sold-row' : '');

            if (targetTable === 'coll-wishlist-tbody') {
                tr.onclick = function (e) { if (!e.defaultPrevented) openEditColl(w.id); };
                tr.innerHTML = `
                <td><div class="watch-name">${w.brand} ${w.model}</div><div class="watch-ref">${w.reference || ''}</div></td>
                <td class="num">${w.purchase_price > 0 ? '€' + fmtNum(w.purchase_price) : '<span class="muted">—</span>'}</td>
                <td>${w.notes || ''}</td>
                <td onclick="event.preventDefault(); event.stopPropagation();"><div class="row-actions">
                    <button class="action-link" onclick="openEditColl(${w.id})">Edit</button>
                    <button class="action-link danger" onclick="deleteCollConfirm(${w.id},this)">Del</button>
                </div></td>`;
            } else if (targetTable === 'coll-sold-tbody') {
                tr.onclick = function (e) { if (!e.defaultPrevented) window.location = '/collection/' + w.id; };
                let gainClass = (w.gain || 0) >= 0 ? 'green' : 'red';
                tr.innerHTML = `
                <td><div class="watch-name">${w.brand} ${w.model}</div><div class="watch-ref">${w.reference || ''}${w.year ? ' · ' + w.year : ''}</div></td>
                <td style="font-size:12px">${w.fmt_sold_date || w.sold_date || '—'}</td>
                <td class="num">€${fmtNum(w.total_cost)}</td>
                <td class="num">€${fmtNum(w.sold_price)}</td>
                <td class="num"><span class="${gainClass}">€${fmtNum(w.gain || 0)}</span></td>
                <td onclick="event.preventDefault(); event.stopPropagation();"><div class="row-actions">
                    <button class="action-link" onclick="openEditColl(${w.id})">Edit</button>
                    <button class="action-link danger" onclick="deleteCollConfirm(${w.id},this)">Del</button>
                </div></td>`;
            } else {
                tr.onclick = function (e) { if (!e.defaultPrevented) window.location = '/collection/' + w.id; };
                tr.innerHTML = `
                <td><div class="watch-name">${w.brand} ${w.model}</div><div class="watch-ref">${w.reference || ''}${w.year ? ' · ' + w.year : ''}</div></td>
                <td style="font-size:12px">${w.fmt_acquired || w.acquired || '—'}</td>
                <td class="num">${w.purchase_price > 0 ? '€' + fmtNum(w.purchase_price) : '<span class="muted">—</span>'}</td>
                <td class="num">${w.service_cost > 0 ? '<span class="red">€' + fmtNum(w.service_cost) + '</span>' : '<span class="muted">—</span>'}</td>
                <td class="num">€${fmtNum(w.total_cost)}</td>
                <td><span class="muted">—</span></td>
                <td onclick="event.preventDefault(); event.stopPropagation();"><div class="row-actions">
                    <button class="action-link" onclick="openEditColl(${w.id})">Edit</button>
                    <button class="action-link danger" onclick="deleteCollConfirm(${w.id},this)">Del</button>
                </div></td>`;
            }

            if (!tr.parentNode) {
                const tbody = document.getElementById(targetTable);
                const empty = document.getElementById(targetTable.replace('tbody', 'empty'));
                if (empty) empty.remove();
                if (tbody) tbody.insertBefore(tr, tbody.firstChild);
            }

            toggleAddCollForm();
            animateIn(tr);
            showFlash(`"${w.brand} ${w.model}" ${isEdit ? 'aggiornato' : 'aggiunto'}!`);

            // To be 100% accurate on KPIs and since we don't have them in API response, 
            // a fast quiet reload will refresh numbers
            if (isEdit || wasInTable !== targetTable) {
                setTimeout(() => location.reload(), 600);
            }
        }).catch(() => showFlash('Errore salvataggio.', 'info'));
}

// ── Apply colors on load ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    applyCategoryColors();

    applyCategoryColors();
});

document.addEventListener('DOMContentLoaded', () => {
    applyCategoryColors();

    document.querySelectorAll('th[data-col]').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
            const table = th.closest('table');
            const tbody = table.querySelector('tbody') || table;
            const colIdx = parseInt(th.dataset.col);
            const isAsc = th.dataset.dir !== 'asc';

            table.querySelectorAll('th').forEach(h => h.dataset.dir = '');
            th.dataset.dir = isAsc ? 'asc' : 'desc';

            const rows = Array.from(tbody.querySelectorAll('tr:not(.total-row):not(.add-row):not(.dash-more-row):not(.empty-row)'));

            rows.sort((a, b) => {
                let valA = cellA.dataset.sort || cellA.textContent.trim();
                let valB = cellB.dataset.sort || cellB.textContent.trim();
                // Usa ordinamento naturale (numeric: true) per risolvere i problemi "Bergeon" e "Quantità"
                return isAsc ? vA.localeCompare(vB, undefined, { numeric: true })
                    : vB.localeCompare(vA, undefined, { numeric: true });
            });

            rows.forEach(r => tbody.appendChild(r));
        });
    });
});