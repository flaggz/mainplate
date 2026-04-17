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
                    const stripped = s => s.replace(/[^\d.-]/g, '').replace(/\.(?=.*\.)/g, '');
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
            showFlash(window.I18N.updated);
            refreshTotal(type);
        })
        .catch(() => showFlash(window.I18N.error_saving, 'info'));
}

function ajaxDelete(type, id, btn) {
    inlineConfirm(btn, '', () => {
        const url = type === 'part' ? `/api/parts/${id}` : `/api/equipment/${id}`;
        const row = document.getElementById(`${type}-row-${id}`);
        const edit = document.getElementById(`${type}-edit-${id}`);
        animateOut(row, () => {
            fetch(url, { method: 'DELETE' })
                .then(r => r.json())
                .then(() => { row.remove(); if (edit) edit.remove(); showFlash(window.I18N.entry_deleted, 'info'); refreshTotal(type); })
                .catch(() => { row.style.opacity = '1'; row.style.transform = ''; showFlash(window.I18N.error, 'info'); });
        });
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
            showFlash(window.I18N.part_added); refreshTotal('part');
        }).catch(() => showFlash(window.I18N.error, 'info'));
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
            showFlash(window.I18N.tool_added); refreshTotal('equip');
        }).catch(() => showFlash(window.I18N.error, 'info'));
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
            showFlash(window.I18N.updated);
        }).catch(() => showFlash(window.I18N.error, 'info'));
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
            <td><div class="flex gap-3 justify-end">
                <button class="btn btn-primary btn-outline btn-sm gap-1 !uppercase" onclick="toggleLogEdit('flip',${data.id})"><svg class="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2c0 7 3 9 3 15"/><path d="M15 2c0 7-3 9-3 15"/><line x1="8" y1="7" x2="16" y2="7"/></svg>${window.I18N.edit}</button>
                <button class="btn btn-error btn-outline btn-sm gap-1 !uppercase" onclick="deleteFlipLogConfirm(${data.id},${flipId},this)"><svg class="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="12" r="8"/><path d="M18 12h4M20 10v4"/><line x1="7" y1="9" x2="13" y2="15"/><line x1="13" y1="9" x2="7" y2="15"/></svg>${window.I18N.delete}</button>
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
            showFlash(inv ? window.I18N.entry_added_inventory : window.I18N.entry_added);
        }).catch(() => showFlash(window.I18N.error, 'info'));
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
                showFlash(window.I18N.entry_deleted, 'info');
            }).catch(() => { row.style.opacity = '1'; row.style.transform = ''; showFlash(window.I18N.error, 'info'); });
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
            showFlash(window.I18N.entry_added);
        }).catch(() => showFlash(window.I18N.error, 'info'));
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
                showFlash(window.I18N.entry_deleted, 'info');
            }).catch(() => { row.style.opacity = '1'; row.style.transform = ''; showFlash(window.I18N.error, 'info'); });
    });
}

// ── Export / Import DB ─────────────────────────────────────
function exportDB() { window.location.href = '/api/export'; }
function importDB(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        if (!confirm(window.I18N.confirm_import)) return;
        fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: e.target.result })
            .then(r => r.json())
            .then(d => {
                if (d.ok) { showFlash(window.I18N.import_done); setTimeout(() => location.reload(), 1200); }
                else showFlash((window.I18N.error || 'Error') + ': ' + d.error, 'info');
            })
            .catch(() => showFlash(window.I18N.import_error, 'info'));
    };
    reader.readAsArrayBuffer(file); input.value = '';
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
const _catOriginals = {};

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
            showFlash(window.I18N.category_updated);
            // Also add to window.CUSTOM_CATEGORIES for live selects
            if (!window.CUSTOM_CATEGORIES) window.CUSTOM_CATEGORIES = [];
            window.CUSTOM_CATEGORIES.push({ id, name, color });
        }).catch(() => showFlash(window.I18N.error, 'info'));
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
                showFlash(window.I18N.category_deleted, 'info');
            }).catch(() => { row.style.opacity = '1'; row.style.transform = ''; showFlash(window.I18N.error, 'info'); });
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
        grid.querySelectorAll('.widget').forEach(w => { widths[w.dataset.id] = w.classList.contains('col-span-full') ? 'full' : 'half'; });
        localStorage.setItem(KEY, JSON.stringify({ order, widths }));
    }

    function loadLayout() {
        const grid = document.getElementById('widget-grid');
        if (!grid) return;
        try {
            const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (!saved) return;
            const isMobile = window.innerWidth < 768;
            grid.querySelectorAll('.widget').forEach(w => {
                const id = w.dataset.id;
                if (!isMobile && saved.widths?.[id] === 'full') {
                    w.classList.add('col-span-full');
                    w.querySelectorAll('.flip-card-grid, .coll-card-grid').forEach(g => { g.classList.remove('grid-cols-2', 'md:grid-cols-3'); g.classList.add('grid-cols-3', 'md:grid-cols-6'); });
                } else {
                    w.classList.remove('col-span-full');
                    w.querySelectorAll('.flip-card-grid, .coll-card-grid').forEach(g => { g.classList.remove('grid-cols-3', 'md:grid-cols-6'); g.classList.add('grid-cols-2', 'md:grid-cols-3'); });
                }
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
    if (window.innerWidth < 768) return;
    const w = document.querySelector(`.widget[data-id="${id}"]`);
    if (!w) return;
    w.classList.toggle('col-span-full');
    w.querySelectorAll('.flip-card-grid, .coll-card-grid').forEach(g => {
        const isFull = w.classList.contains('col-span-full');
        g.classList.toggle('grid-cols-2', !isFull);
        g.classList.toggle('md:grid-cols-3', !isFull);
        g.classList.toggle('grid-cols-3', isFull);
        g.classList.toggle('md:grid-cols-6', isFull);
    });
    w.querySelectorAll('table').forEach(t => initSortable(t));
    const grid = document.getElementById('widget-grid');
    if (grid) {
        const order = [...grid.querySelectorAll('.widget')].map(w2 => w2.dataset.id);
        const widths = {};
        grid.querySelectorAll('.widget').forEach(w2 => { widths[w2.dataset.id] = w2.classList.contains('col-span-full') ? 'full' : 'half'; });
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

    // Apply timegrapher diagnostic warnings to existing rows
    document.querySelectorAll('#tg-tbody .data-row').forEach(tr => {
        _applyTgWarnings(tr, _tgReadData(tr));
    });

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
let _activeConfirmDismiss = null;

function inlineConfirm(btn, msg, onConfirm) {
    // Dismiss any existing confirm popover (restores the hidden button)
    if (_activeConfirmDismiss) { _activeConfirmDismiss(); _activeConfirmDismiss = null; }
    btn.style.display = 'none';
    const pop = document.createElement('span');
    pop.className = 'confirm-popover inline-flex items-center gap-2';
    const yesLabel = (window.I18N && window.I18N.yes) ? window.I18N.yes : 'yes';
    const noLabel  = (window.I18N && window.I18N.no)  ? window.I18N.no  : 'no';
    pop.innerHTML = `${msg} <button class="confirm-yes btn btn-success btn-outline btn-sm gap-1 uppercase">${yesLabel}</button><button class="confirm-no btn btn-error btn-outline btn-sm gap-1 uppercase">${noLabel}</button>`;
    btn.parentNode.insertBefore(pop, btn.nextSibling);
    const dismiss = () => { pop.remove(); btn.style.display = ''; _activeConfirmDismiss = null; };
    pop.querySelector('.confirm-yes').onclick = () => { dismiss(); onConfirm(); };
    pop.querySelector('.confirm-no').onclick = () => dismiss();
    _activeConfirmDismiss = dismiss;
    // Auto-dismiss after 5s
    setTimeout(() => { if (pop.isConnected) dismiss(); }, 5000);
}

// ── Delete flip (ajax, inline confirm) ─────────────────────
function deleteFlipConfirm(fid, btn) {
    inlineConfirm(btn, "", () => {
        const row = document.getElementById(`flip-row-${fid}`);
        animateOut(row, () => {
            fetch(`/api/flips/${fid}`, { method: 'DELETE' })
                .then(r => r.json())
                .then(() => { row.remove(); showFlash(window.I18N.flip_deleted, 'info'); })
                .catch(() => { row.style.opacity = '1'; row.style.transform = ''; showFlash(window.I18N.error, 'info'); });
        });
    });
}

// Called from flip_detail page
function deleteFlip(fid, btn) {
    inlineConfirm(btn, window.I18N.confirm_delete, () => {
        fetch(`/api/flips/${fid}`, { method: 'DELETE' })
            .then(r => r.json())
            .then(() => { window.location = '/flips'; })
            .catch(() => showFlash(window.I18N.error, 'info'));
    });
}

// ── Delete flip log (inline confirm) ──────────────────────
function deleteFlipLogConfirm(lid, flipId, btn) {
    inlineConfirm(btn, '', () => deleteFlipLog(lid, flipId));
}

// ── Timegrapher ────────────────────────────────────────────
function _tgFmt(v) { return v !== null && v !== undefined ? (v >= 0 ? '+' : '') + parseFloat(v).toFixed(1) : '—'; }
function _tgFmtPlain(v, digits, suffix) { return v !== null && v !== undefined ? parseFloat(v).toFixed(digits) + (suffix || '') : '—'; }

function _tgReadData(tr) {
    const D = tr.dataset;
    const f = s => s !== '' && s !== undefined ? parseFloat(s) : null;
    return { du: f(D.du), dd: f(D.dd), p3: f(D.p3), p6: f(D.p6),
             p9: f(D.p9), p12: f(D.p12), amplitude: f(D.amplitude),
             beat_error: f(D.beatError) };
}

function _tgWarnings(d) {
    const w = {du:[],dd:[],p3:[],p6:[],p9:[],p12:[],amplitude:[],beat_error:[]};
    const v = x => x !== null && x !== undefined;
    const I = window.I18N;
    if (v(d.du) && v(d.dd) && Math.abs(d.du - d.dd) > 1) {
        const diff = Math.abs(d.du - d.dd).toFixed(1);
        const m = I.tg_warn_du_dd.replace('{0}', diff);
        w.du.push({level:'warning', msg:m}); w.dd.push({level:'warning', msg:m});
    }
    if (v(d.amplitude)) {
        if (d.amplitude < 180)
            w.amplitude.push({level:'error', msg:I.tg_warn_amp_critical});
        else if (d.amplitude < 220)
            w.amplitude.push({level:'warning', msg:I.tg_warn_amp_low});
        else if (d.amplitude > 320)
            w.amplitude.push({level:'warning', msg:I.tg_warn_amp_high});
    }
    if (v(d.beat_error)) {
        const be = Math.abs(d.beat_error).toFixed(1);
        if (Math.abs(d.beat_error) > 1.0)
            w.beat_error.push({level:'error',   msg:I.tg_warn_be_high.replace('{0}', be)});
        else if (Math.abs(d.beat_error) > 0.5)
            w.beat_error.push({level:'warning', msg:I.tg_warn_be_medium.replace('{0}', be)});
    }
    if (v(d.p3) && v(d.p9) && Math.abs(d.p3 - d.p9) > 15) {
        const diff = Math.abs(d.p3 - d.p9).toFixed(1);
        const m = I.tg_warn_p3_p9.replace('{0}', diff);
        w.p3.push({level:'warning', msg:m}); w.p9.push({level:'warning', msg:m});
    }
    if (v(d.p6) && v(d.p12) && Math.abs(d.p6 - d.p12) > 15) {
        const diff = Math.abs(d.p6 - d.p12).toFixed(1);
        const m = I.tg_warn_p6_p12.replace('{0}', diff);
        w.p6.push({level:'warning', msg:m}); w.p12.push({level:'warning', msg:m});
    }
    return w;
}

function _applyTgWarnings(tr, d) {
    const w = _tgWarnings(d);
    const map = {du:1, dd:2, p3:3, p6:4, p9:5, p12:6, amplitude:7, beat_error:8};
    for (const [key, idx] of Object.entries(map)) {
        const td = tr.cells[idx];
        if (!td) continue;
        td.querySelectorAll('.tg-warn').forEach(el => el.remove());
        const warns = w[key];
        if (!warns || warns.length === 0) continue;
        const level = warns.some(x => x.level === 'error') ? 'error' : 'warning';
        const tip = warns.map(x => x.msg).join(' | ');
        const icon = document.createElement('span');
        icon.className = `tg-warn tooltip tooltip-top ${level === 'error' ? 'text-error' : 'text-warning'} ml-1 cursor-help text-xs`;
        icon.setAttribute('data-tip', tip);
        icon.textContent = '⚠';
        td.appendChild(icon);
    }
}

function toggleTgEdit(id) {
    const er = document.getElementById(`tg-edit-${id}`);
    if (!er) return;
    const isHidden = er.classList.contains('hidden');
    document.querySelectorAll('[id^="tg-edit-"]').forEach(r => r.classList.add('hidden'));
    if (isHidden) { er.classList.remove('hidden'); animateIn(er); er.querySelector('input')?.focus(); }
}

function addTgReading(flipId) {
    const date = document.getElementById('tg-date')?.value;
    const payload = { reading_date: date };
    for (const key of ['du','dd','p3','p6','p9','p12']) {
        const v = document.getElementById(`tg-${key}`)?.value;
        payload[key] = v !== '' ? parseFloat(v) : null;
    }
    const amp = document.getElementById('tg-amp')?.value;
    const be = document.getElementById('tg-be')?.value;
    payload.amplitude = amp !== '' ? parseFloat(amp) : null;
    payload.beat_error = be !== '' ? parseFloat(be) : null;

    fetch(`/api/flips/${flipId}/timegrapher`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(data => {
        const emptyRow = document.getElementById('tg-empty-row');
        if (emptyRow) emptyRow.remove();
        const tbody = document.getElementById('tg-tbody');
        const dc = data.delta_class || '';
        const deltaCell = data.delta !== null && data.delta !== undefined
            ? `<span class="font-bold font-mono ${dc}">${parseFloat(data.delta).toFixed(1)}</span>` : '<span class="opacity-40">—</span>';
        const tr = document.createElement('tr');
        tr.id = `tg-row-${data.id}`; tr.className = 'data-row hover';
        tr.innerHTML = `
            <td class="whitespace-nowrap">${data.fmt_reading_date || data.reading_date}</td>
            <td class="text-right font-mono">${_tgFmt(data.du)}</td>
            <td class="text-right font-mono">${_tgFmt(data.dd)}</td>
            <td class="text-right font-mono">${_tgFmt(data.p3)}</td>
            <td class="text-right font-mono">${_tgFmt(data.p6)}</td>
            <td class="text-right font-mono">${_tgFmt(data.p9)}</td>
            <td class="text-right font-mono">${_tgFmt(data.p12)}</td>
            <td class="text-right">${_tgFmtPlain(data.amplitude, 0, '°')}</td>
            <td class="text-right">${_tgFmtPlain(data.beat_error, 1, '')}</td>
            <td class="text-right">${deltaCell}</td>
            <td><div class="flex gap-2 justify-end">
                <button class="btn btn-primary btn-outline btn-sm gap-1 uppercase" onclick="toggleTgEdit(${data.id})"><svg class="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2c0 7 3 9 3 15"/><path d="M15 2c0 7-3 9-3 15"/><line x1="8" y1="7" x2="16" y2="7"/></svg>${window.I18N.edit}</button>
                <button class="btn btn-error btn-outline btn-sm gap-1 uppercase" onclick="deleteTgConfirm(${data.id},${flipId},this)"><svg class="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="12" r="8"/><path d="M18 12h4M20 10v4"/><line x1="7" y1="9" x2="13" y2="15"/><line x1="13" y1="9" x2="7" y2="15"/></svg>${window.I18N.delete}</button>
            </div></td>`;
        const er = document.createElement('tr');
        er.id = `tg-edit-${data.id}`; er.className = 'edit-row hidden bg-base-200';
        const positions = [['DU','du'],['DD','dd'],['3U','p3'],['6U','p6'],['9U','p9'],['12U','p12']];
        const posInputs = positions.map(([pos, key]) =>
            `<div class="flex flex-col gap-0.5"><span class="text-[9px] uppercase opacity-40">${pos}</span>
            <input type="number" step="0.1" name="${key}" value="${data[key] ?? ''}" placeholder="—" class="input input-bordered input-sm w-16 text-right font-mono"></div>`
        ).join('');
        er.innerHTML = `<td colspan="11" class="p-3"><form class="flex flex-wrap gap-2 items-end" onsubmit="submitTgEdit(event,${data.id},${flipId})">
            <div class="flex flex-col gap-0.5"><span class="text-[9px] uppercase opacity-40">Date</span>
            <input type="date" name="reading_date" value="${data.reading_date}" class="input input-bordered input-sm w-36"></div>
            ${posInputs}
            <div class="flex flex-col gap-0.5"><span class="text-[9px] uppercase opacity-40">Amp °</span>
            <input type="number" step="1" name="amplitude" value="${data.amplitude ?? ''}" placeholder="—" class="input input-bordered input-sm w-16 text-right"></div>
            <div class="flex flex-col gap-0.5"><span class="text-[9px] uppercase opacity-40">BE ms</span>
            <input type="number" step="0.1" name="beat_error" value="${data.beat_error ?? ''}" placeholder="—" class="input input-bordered input-sm w-16 text-right"></div>
            <div class="flex gap-2 pt-3.5">
                <button type="submit" class="btn btn-primary btn-sm">Salva</button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="toggleTgEdit(${data.id})">Annulla</button>
            </div></form></td>`;
        tbody.insertBefore(tr, tbody.firstChild);
        tbody.insertBefore(er, tr.nextSibling);
        Object.assign(tr.dataset, {
            du: data.du ?? '', dd: data.dd ?? '', p3: data.p3 ?? '',
            p6: data.p6 ?? '', p9: data.p9 ?? '', p12: data.p12 ?? '',
            amplitude: data.amplitude ?? '', beatError: data.beat_error ?? ''
        });
        _applyTgWarnings(tr, data);
        animateIn(tr);
        // Reset tfoot inputs
        for (const key of ['du','dd','p3','p6','p9','p12']) { const el = document.getElementById(`tg-${key}`); if (el) el.value = ''; }
        const ampEl = document.getElementById('tg-amp'); if (ampEl) ampEl.value = '';
        const beEl = document.getElementById('tg-be'); if (beEl) beEl.value = '';
        showFlash(window.I18N.entry_added);
    }).catch(() => showFlash(window.I18N.error, 'info'));
}

function submitTgEdit(event, tid, flipId) {
    event.preventDefault();
    const fd = new FormData(event.target);
    const payload = {};
    for (const [k, v] of fd.entries()) {
        if (['du','dd','p3','p6','p9','p12','amplitude','beat_error'].includes(k))
            payload[k] = v !== '' ? parseFloat(v) : null;
        else payload[k] = v;
    }
    fetch(`/api/timegrapher/${tid}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(data => {
        const vr = document.getElementById(`tg-row-${tid}`);
        if (vr) {
            const dc = data.delta_class || '';
            const deltaCell = data.delta !== null && data.delta !== undefined
                ? `<span class="font-bold font-mono ${dc}">${parseFloat(data.delta).toFixed(1)}</span>` : '<span class="opacity-40">—</span>';
            vr.cells[0].textContent = data.fmt_reading_date || data.reading_date;
            vr.cells[1].innerHTML = _tgFmt(data.du);
            vr.cells[2].innerHTML = _tgFmt(data.dd);
            vr.cells[3].innerHTML = _tgFmt(data.p3);
            vr.cells[4].innerHTML = _tgFmt(data.p6);
            vr.cells[5].innerHTML = _tgFmt(data.p9);
            vr.cells[6].innerHTML = _tgFmt(data.p12);
            vr.cells[7].textContent = _tgFmtPlain(data.amplitude, 0, '°');
            vr.cells[8].textContent = _tgFmtPlain(data.beat_error, 2, '');
            vr.cells[9].innerHTML = deltaCell;
            Object.assign(vr.dataset, {
                du: data.du ?? '', dd: data.dd ?? '', p3: data.p3 ?? '',
                p6: data.p6 ?? '', p9: data.p9 ?? '', p12: data.p12 ?? '',
                amplitude: data.amplitude ?? '', beatError: data.beat_error ?? ''
            });
            _applyTgWarnings(vr, data);
            animateFlash(vr);
        }
        document.getElementById(`tg-edit-${tid}`)?.classList.add('hidden');
        showFlash(window.I18N.updated);
    }).catch(() => showFlash(window.I18N.error, 'info'));
}

function deleteTgConfirm(tid, flipId, btn) {
    inlineConfirm(btn, '', () => {
        const row = document.getElementById(`tg-row-${tid}`);
        const edit = document.getElementById(`tg-edit-${tid}`);
        animateOut(row, () => {
            fetch(`/api/timegrapher/${tid}`, { method: 'DELETE' })
            .then(r => r.json())
            .then(() => {
                row.remove(); if (edit) edit.remove();
                const tbody = document.getElementById('tg-tbody');
                if (tbody && !tbody.querySelector('.data-row')) {
                    const empty = document.createElement('tr');
                    empty.id = 'tg-empty-row';
                    empty.innerHTML = '<td colspan="11" class="text-center opacity-40 py-6">No data</td>';
                    tbody.insertBefore(empty, tbody.firstChild);
                }
                showFlash(window.I18N.entry_deleted, 'info');
            }).catch(() => { row.style.opacity = '1'; row.style.transform = ''; showFlash(window.I18N.error, 'info'); });
        });
    });
}

// ── Delete collection watch (ajax, inline confirm) ─────────
function deleteCollConfirm(wid, btn) {
    inlineConfirm(btn, '', () => {
        const row = document.getElementById(`coll-row-${wid}`);
        animateOut(row, () => {
            fetch(`/api/collection/${wid}`, { method: 'DELETE' })
                .then(r => r.json())
                .then(() => { row.remove(); showFlash(window.I18N.watch_deleted, 'info'); })
                .catch(() => { row.style.opacity = '1'; row.style.transform = ''; showFlash(window.I18N.error, 'info'); });
        });
    });
}

// ── Delete category (inline confirm, skip save if unchanged) ─
function deleteCat(id) {
    const row = document.getElementById(`cat-row-${id}`);
    inlineConfirm(row.querySelector('.action-link.danger'), '', () => {
        animateOut(row, () => {
            fetch(`/api/categories/${id}`, { method: 'DELETE' })
                .then(r => r.json())
                .then(() => {
                    row.remove();
                    if (window.CUSTOM_CATEGORIES)
                        window.CUSTOM_CATEGORIES = window.CUSTOM_CATEGORIES.filter(c => c.id !== id);
                    showFlash(window.I18N.category_deleted, 'info');
                }).catch(() => { row.style.opacity = '1'; row.style.transform = ''; showFlash(window.I18N.error, 'info'); });
        });
    });
}

// Track original category values on page load to skip no-op saves
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[id^="cat-name-"]').forEach(inp => {
        const id = inp.id.replace('cat-name-', '');
        _catOriginals[id] = { name: inp.value, color: document.getElementById(`cat-color-${id}`)?.value || '' };
    });
});

function saveCatRow(id) {
    clearTimeout(_catTimers[id]);
    _catTimers[id] = setTimeout(() => {
        const name = (document.getElementById(`cat-name-${id}`)?.value || '').trim().toUpperCase();
        const color = document.getElementById(`cat-color-${id}`)?.value || '#888888';
        if (!name) return;
        const orig = _catOriginals[id];
        if (orig && orig.name === name && orig.color === color) return;
        fetch(`/api/categories/${id}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, color })
        })
            .then(r => r.json())
            .then(() => {
                _catOriginals[id] = { name, color };
                updateCatPreview(id);
                showFlash(window.I18N.category_updated);
            })
            .catch(() => showFlash(window.I18N.error, 'info'));
    }, 400);
}

// ── Chrono24 Watch Lookup ──────────────────────────────────
let _lookupTimer = null;
const _lookupCache = {};

function watchLookupSearch(query, prefix) {
    clearTimeout(_lookupTimer);
    const resultsEl = document.getElementById(prefix + '-lookup-results');
    if (!resultsEl) return;
    if (!query || query.trim().length < 3) {
        resultsEl.classList.add('hidden');
        resultsEl.innerHTML = '';
        return;
    }
    resultsEl.classList.remove('hidden');
    resultsEl.innerHTML = `<div class="p-3 text-sm opacity-60">${window.I18N.lookup_searching || 'searching…'}</div>`;
    _lookupTimer = setTimeout(() => {
        fetch('/api/watch-lookup?q=' + encodeURIComponent(query.trim()))
            .then(r => r.json())
            .then(data => {
                if (!resultsEl) return;
                if (data.error && (!data.results || !data.results.length)) {
                    const msg = data.error === 'deps_missing'
                        ? 'Dipendenze mancanti — rebuild Docker con --build'
                        : (window.I18N.lookup_unavailable || 'lookup unavailable') + (data.error !== 'lookup_unavailable' ? ` (${data.error})` : '');
                    resultsEl.innerHTML = `<div class="p-3 text-sm opacity-60">${msg}</div>`;
                    return;
                }
                if (!data.results || !data.results.length) {
                    resultsEl.innerHTML = `<div class="p-3 text-sm opacity-60">${window.I18N.lookup_no_results || 'no results'}</div>`;
                    return;
                }
                _lookupCache[prefix] = data.results;
                resultsEl.innerHTML = data.results.map((r, i) => {
                    const thumb = r.image_url
                        ? `<img src="${r.image_url}" class="w-10 h-10 object-cover rounded shrink-0" onerror="this.style.display='none'">`
                        : `<div class="w-10 h-10 bg-base-200 rounded shrink-0"></div>`;
                    const price = r.price ? `<span class="text-xs opacity-60 ml-2">${window.CURRENCY || '€'}${r.price}</span>` : '';
                    const sub = [r.reference, r.year].filter(Boolean).join(' · ');
                    return `<button type="button"
                        class="flex items-center gap-3 w-full text-left px-3 py-2 hover:bg-base-200 transition-colors"
                        onclick="fillFromLookup(${i}, '${prefix}')">
                        ${thumb}
                        <div class="min-w-0 flex-1">
                            <div class="font-semibold text-sm truncate">${r.brand} ${r.model}${price}</div>
                            ${sub ? `<div class="text-xs opacity-60 truncate">${sub}</div>` : ''}
                        </div>
                    </button>`;
                }).join('<div class="border-t border-base-200"></div>');
            })
            .catch(() => {
                if (resultsEl) resultsEl.innerHTML = `<div class="p-3 text-sm opacity-60">${window.I18N.lookup_unavailable || 'lookup unavailable'}</div>`;
            });
    }, 500);
}

function fillFromLookup(idx, prefix) {
    const r = (_lookupCache[prefix] || [])[idx];
    if (!r) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined && val !== '') el.value = val; };
    set(prefix + '-brand', r.brand);
    set(prefix + '-model', r.model);
    set(prefix + '-ref', r.reference);
    set(prefix + '-year', r.year);
    if (r.price) {
        const priceId = prefix === 'nc' ? 'nc-price' : 'nf-paid';
        set(priceId, r.price.replace(/[^\d.,]/g, '').replace(',', '.'));
    }
    const imgHidden = document.getElementById(prefix + '-lookup-img');
    if (imgHidden) imgHidden.value = r.image_url || '';
    const inputEl = document.getElementById(prefix + '-lookup-input');
    if (inputEl) inputEl.value = [r.brand, r.model].filter(Boolean).join(' ');
    const resultsEl = document.getElementById(prefix + '-lookup-results');
    if (resultsEl) { resultsEl.classList.add('hidden'); resultsEl.innerHTML = ''; }
    document.getElementById(prefix + '-brand')?.focus();
}

document.addEventListener('click', (e) => {
    ['nc', 'nf'].forEach(p => {
        const wrap = document.getElementById(p + '-lookup-input')?.closest('.relative');
        const results = document.getElementById(p + '-lookup-results');
        if (results && wrap && !wrap.contains(e.target)) {
            results.classList.add('hidden');
        }
    });
});

// ── Inline add flip ────────────────────────────────────────
function toggleAddFlipForm() {
    const wrap = document.getElementById('add-flip-form-wrap');
    if (!wrap) return;
    const isHidden = wrap.classList.contains('hidden');
    if (isHidden) {
        wrap.classList.remove('hidden');
        animateIn(wrap);
        document.getElementById('nf-brand')?.focus();
        document.getElementById('add-flip-btn').textContent = I18N_CANCEL;
    } else {
        wrap.classList.add('hidden');
        document.getElementById('add-flip-btn').textContent = I18N_NEW_FLIP;
        const li = document.getElementById('nf-lookup-input'); if (li) li.value = '';
        const limg = document.getElementById('nf-lookup-img'); if (limg) limg.value = '';
        const lr = document.getElementById('nf-lookup-results'); if (lr) { lr.classList.add('hidden'); lr.innerHTML = ''; }
    }
}

function ajaxAddFlip() {
    const brand = document.getElementById('nf-brand')?.value.trim();
    const model = document.getElementById('nf-model')?.value.trim();
    if (!brand || !model) { showFlash(window.I18N.brand_model_required, 'info'); return; }
    const data = {
        brand, model,
        reference: document.getElementById('nf-ref')?.value.trim() || '',
        year: document.getElementById('nf-year')?.value || null,
        status: document.getElementById('nf-status')?.value || 'Acquired',
        paid: parseInputNum(document.getElementById('nf-paid')?.value),
        sold: parseInputNum(document.getElementById('nf-sold')?.value),
        hours: parseInputNum(document.getElementById('nf-hours')?.value),
        notes: document.getElementById('nf-notes')?.value.trim() || '',
        image_url: document.getElementById('nf-lookup-img')?.value || '',
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
            <td><span class="badge ${badgeClass}">${(window.I18N.statuses || {})[f.status] || f.status}</span></td>
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
                <button class="action-link danger" onclick="deleteFlipConfirm(${f.id},this)">${window.I18N.delete}</button>
            </div></td>`;
            tbody.insertBefore(tr, tbody.firstChild);
            animateIn(tr);
            // Reset form
            ['nf-brand', 'nf-model', 'nf-ref', 'nf-year', 'nf-notes', 'nf-lookup-input', 'nf-lookup-img'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
            ['nf-paid', 'nf-sold', 'nf-hours'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '0';
            });
            toggleAddFlipForm();
            showFlash(`"${f.brand} ${f.model}" ` + (window.I18N.entry_added || 'added!'));
        }).catch(() => showFlash(window.I18N.error_adding, 'info'));
}

// ── Inline add collection watch ────────────────────────────
window.currentEditCollId = null;

function toggleAddCollForm() {
    const wrap = document.getElementById('add-coll-form-wrap');
    if (!wrap) return;
    if (wrap.classList.contains('hidden')) {
        window.currentEditCollId = null;
        ['nc-brand', 'nc-model', 'nc-ref', 'nc-year', 'nc-acquired', 'nc-sold-date', 'nc-notes', 'nc-lookup-input', 'nc-lookup-img'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        ['nc-price', 'nc-sold-price'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '0';
        });
        const lr = document.getElementById('nc-lookup-results'); if (lr) { lr.classList.add('hidden'); lr.innerHTML = ''; }
        const wl = document.getElementById('nc-wishlist');
        if (wl) wl.checked = false;
        if (window.updateWishlistBtnUI) window.updateWishlistBtnUI();

        const title = wrap.querySelector('.form-section-title');
        if (title) title.textContent = "Aggiungi Orologio (Form Veloce)";
        const saveBtn = wrap.querySelector('.btn-primary');
        if (saveBtn) saveBtn.textContent = window.I18N.add;

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
            if (formTitle) formTitle.textContent = "Modifica Orologio";

            let saveBtn = wrap.querySelector('.btn-primary');
            if (saveBtn) saveBtn.textContent = "Salva";

            animateIn(wrap);
            window.scrollTo({ top: wrap.offsetTop - 20, behavior: 'smooth' });
        });
}

function ajaxAddCollection() {
    const brand = document.getElementById('nc-brand')?.value.trim();
    const model = document.getElementById('nc-model')?.value.trim();
    if (!brand || !model) { showFlash(window.I18N.brand_model_required, 'info'); return; }
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
        image_url: window.currentEditCollId ? '' : (document.getElementById('nc-lookup-img')?.value || ''),
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
                tr.onclick = function (e) { if (!e.defaultPrevented) window.location = '/collection/' + w.id; };
                tr.innerHTML = `
                <td class="p-2">
                    <div class="img-thumb-cell w-10 h-10 rounded overflow-hidden" data-thumb-type="collection" data-thumb-id="${w.id}">
                        <div class="w-full h-full bg-base-200"></div>
                    </div>
                </td>
                <td><div class="font-semibold">${w.brand} ${w.model}</div><div class="text-xs opacity-70">${w.reference || ''}</div></td>
                <td class="text-right">${w.purchase_price > 0 ? (window.CURRENCY || '€') + fmtNum(w.purchase_price) : '<span class="opacity-50">—</span>'}</td>
                <td class="text-sm opacity-80 max-w-sm"><div class="truncate">${w.notes || ''}</div></td>
                <td onclick="event.preventDefault(); event.stopPropagation();">
                    <div class="flex gap-3 text-sm justify-end">
                        <button class="btn btn-primary btn-outline btn-sm uppercase" onclick="openWishlistInlineEdit(${w.id})">Edit</button>
                        <button class="btn btn-error btn-outline btn-sm uppercase" onclick="deleteCollConfirm(${w.id},this)">Del</button>
                    </div>
                </td>`;
            } else if (targetTable === 'coll-sold-tbody') {
                tr.onclick = function (e) { if (!e.defaultPrevented) window.location = '/collection/' + w.id; };
                let gainClass = (w.gain || 0) >= 0 ? 'green' : 'red';
                tr.innerHTML = `
                <td class="p-2"><div class="img-thumb-cell w-10 h-10 rounded overflow-hidden" data-thumb-type="collection" data-thumb-id="${w.id}"><div class="w-full h-full bg-base-200"></div></div></td>
                <td><div class="font-semibold">${w.brand} ${w.model}</div><div class="text-xs opacity-70">${w.reference || ''}${w.year ? ' · ' + w.year : ''}</div></td>
                <td class="text-sm whitespace-nowrap">${w.fmt_sold_date || w.sold_date || '—'}</td>
                <td class="text-right">${(window.CURRENCY || '€')}${fmtNum(w.total_cost)}</td>
                <td class="text-right">${(window.CURRENCY || '€')}${fmtNum(w.sold_price)}</td>
                <td class="text-right"><span class="${gainClass}">${(window.CURRENCY || '€')}${fmtNum(w.gain || 0)}</span></td>
                <td onclick="event.preventDefault(); event.stopPropagation();">
                    <div class="flex gap-3 text-sm justify-end">
                        <button class="btn btn-primary btn-outline btn-sm uppercase" onclick="openCollInlineEdit(${w.id})">Edit</button>
                        <button class="btn btn-error btn-outline btn-sm uppercase" onclick="deleteCollConfirm(${w.id},this)">Del</button>
                    </div>
                </td>`;
            } else {
                tr.onclick = function (e) { if (!e.defaultPrevented) window.location = '/collection/' + w.id; };
                tr.innerHTML = `
                <td class="p-2"><div class="img-thumb-cell w-10 h-10 rounded overflow-hidden" data-thumb-type="collection" data-thumb-id="${w.id}"><div class="w-full h-full bg-base-200"></div></div></td>
                <td><div class="font-semibold">${w.brand} ${w.model}</div><div class="text-xs opacity-70">${w.reference || ''}${w.year ? ' · ' + w.year : ''}</div></td>
                <td class="text-sm whitespace-nowrap">${w.fmt_acquired || w.acquired || '—'}</td>
                <td class="text-right">${w.purchase_price > 0 ? (window.CURRENCY || '€') + fmtNum(w.purchase_price) : '<span class="opacity-50">—</span>'}</td>
                <td class="text-right">${w.service_cost > 0 ? '<span class="text-error">' + (window.CURRENCY || '€') + fmtNum(w.service_cost) + '</span>' : '<span class="opacity-50">—</span>'}</td>
                <td class="text-right">${(window.CURRENCY || '€')}${fmtNum(w.total_cost)}</td>
                <td><span class="opacity-50">—</span></td>
                <td onclick="event.preventDefault(); event.stopPropagation();">
                    <div class="flex gap-3 text-sm">
                        <button class="btn btn-primary btn-outline btn-sm uppercase" onclick="openCollInlineEdit(${w.id})">Edit</button>
                        <button class="btn btn-error btn-outline btn-sm uppercase" onclick="deleteCollConfirm(${w.id},this)">Del</button>
                    </div>
                </td>`;
            }

            if (!tr.parentNode) {
                const tbody = document.getElementById(targetTable);
                const empty = document.getElementById(targetTable.replace('tbody', 'empty'));
                if (empty) empty.remove();
                if (tbody) tbody.insertBefore(tr, tbody.firstChild);
            }

            toggleAddCollForm();
            animateIn(tr);
            showFlash(`"${w.brand} ${w.model}" ` + (isEdit ? window.I18N.updated : window.I18N.entry_added));

            // To be 100% accurate on KPIs and since we don't have them in API response, 
            // a fast quiet reload will refresh numbers
            if (isEdit || wasInTable !== targetTable) {
                setTimeout(() => location.reload(), 600);
            }
        }).catch(() => showFlash(window.I18N.error_saving, 'info'));
}


// ── Lightbox ────────────────────────────────────────────────
let _lbImages = [], _lbIdx = 0;

function openLightbox(images, index) {
    _lbImages = images; _lbIdx = index;
    _lbShow();
    const _lbEl = document.getElementById('lightbox');
    _lbEl.classList.remove('hidden');
    _lbEl.classList.add('flex');
    document.addEventListener('keydown', _lbKey);
    document.getElementById('lightbox').addEventListener('click', _lbBgClick);
}

function closeLightbox() {
    const _lbEl = document.getElementById('lightbox');
    _lbEl.classList.add('hidden');
    _lbEl.classList.remove('flex');
    document.removeEventListener('keydown', _lbKey);
}

function navLightbox(delta) {
    _lbIdx = (_lbIdx + delta + _lbImages.length) % _lbImages.length;
    _lbShow();
}

function _lbShow() {
    document.getElementById('lb-img').src = _lbImages[_lbIdx].url;
    document.getElementById('lb-counter').textContent = (_lbIdx + 1) + ' / ' + _lbImages.length;
}

function _lbKey(e) {
    if (e.key === 'ArrowLeft')  navLightbox(-1);
    if (e.key === 'ArrowRight') navLightbox(1);
    if (e.key === 'Escape')     closeLightbox();
}

function _lbBgClick(e) {
    if (e.target === document.getElementById('lightbox')) closeLightbox();
}

// ── ImageManager ────────────────────────────────────────────
const ImageManager = (() => {
    let _type, _id, _images = [];

    function init(type, id, initialImages) {
        _type = type; _id = id; _images = initialImages || [];
        _renderGallery();
        _setupDropZone();
    }

    function _renderGallery() {
        const grid = document.getElementById('img-grid');
        if (!grid) return;
        grid.innerHTML = '';

        _images.forEach((img, idx) => {
            const tile = document.createElement('div');
            tile.className = 'group aspect-square relative rounded overflow-hidden cursor-pointer';
            tile.draggable = true;
            tile.dataset.idx = idx;
            tile.innerHTML = `<img src="${img.url}" loading="lazy" alt="" class="absolute inset-0 w-full h-full object-cover object-center block">
                <button class="img-tile-del absolute top-0.5 right-0.5 bg-black/60 text-white border-none rounded-full w-5 h-5 text-[11px] cursor-pointer hidden group-hover:flex items-center justify-center" title="Elimina" onclick="ImageManager.deleteImage(${img.id}, event)">&#x2715;</button>`;
            tile.addEventListener('click', (e) => {
                if (!e.target.classList.contains('img-tile-del')) openLightbox(_images, idx);
            });
            _initTileDrag(tile);
            grid.appendChild(tile);
        });

        const dz = document.createElement('div');
        dz.className = 'img-drop-zone aspect-square min-w-20 flex flex-col items-center justify-center border-2 border-dashed border-base-content/30 rounded cursor-pointer text-xs text-base-content/40 transition-colors hover:border-primary hover:bg-primary/10';
        dz.id = 'img-drop-zone';
        dz.innerHTML = `<span class="text-2xl mb-0.5">&#x1F4F7;</span><span>${window.I18N.add}</span>`;
        dz.addEventListener('click', () => document.getElementById('img-file-input').click());
        dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('!border-primary', '!bg-primary/10'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('!border-primary', '!bg-primary/10'));
        dz.addEventListener('drop', e => {
            e.preventDefault(); dz.classList.remove('!border-primary', '!bg-primary/10');
            uploadFiles(e.dataTransfer.files);
        });
        grid.appendChild(dz);

        _updateHero();
    }

    function _updateHero() {
        const heroWrap = document.getElementById('img-hero-wrap');
        if (!heroWrap) return;
        if (_images.length > 0) {
            heroWrap.innerHTML = `<img class="aspect-square w-full object-cover object-center rounded-lg cursor-pointer" src="${_images[0].url}" alt="" onclick="openLightbox(ImageManager.getImages(), 0)">`;
        } else {
            heroWrap.innerHTML = `<div class="aspect-square w-full flex items-center justify-center bg-base-200 rounded-lg text-base-content/30 text-5xl">&#x1F4F7;</div>`;
        }
    }

    function _setupDropZone() {
        const input = document.getElementById('img-file-input');
        if (!input) return;
        input.addEventListener('change', () => { uploadFiles(input.files); input.value = ''; });

        const hero = document.getElementById('img-hero-wrap');
        if (hero) {
            hero.addEventListener('dragover', e => { e.preventDefault(); });
            hero.addEventListener('drop', e => { e.preventDefault(); uploadFiles(e.dataTransfer.files); });
        }
    }

    function uploadFiles(files) {
        if (!files || !files.length) return;
        const fd = new FormData();
        Array.from(files).forEach(f => fd.append('images', f));
        fetch(`/api/images/upload/${_type}/${_id}`, { method: 'POST', body: fd })
            .then(r => r.json())
            .then(d => {
                if (d.ok) { _images.push(...d.images); _renderGallery(); showFlash(window.I18N.photos_added); }
                else showFlash(window.I18N.upload_error, 'error');
            })
            .catch(() => showFlash(window.I18N.upload_error, 'error'));
    }

    function deleteImage(iid, e) {
        if (e) { e.stopPropagation(); }
        if (!confirm(window.I18N.confirm_delete_photo)) return;
        fetch(`/api/images/${iid}`, { method: 'DELETE' })
            .then(r => r.json())
            .then(d => {
                if (d.ok) { _images = _images.filter(i => i.id !== iid); _renderGallery(); }
            });
    }

    function _initTileDrag(tile) {
        tile.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', tile.dataset.idx);
            tile.style.opacity = '0.5';
        });
        tile.addEventListener('dragend', () => { tile.style.opacity = ''; });
        tile.addEventListener('dragover', e => { e.preventDefault(); tile.classList.add('outline', 'outline-2', 'outline-primary', 'outline-offset-2'); });
        tile.addEventListener('dragleave', () => tile.classList.remove('outline', 'outline-2', 'outline-primary', 'outline-offset-2'));
        tile.addEventListener('drop', e => {
            e.preventDefault(); tile.classList.remove('outline', 'outline-2', 'outline-primary', 'outline-offset-2');
            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
            const toIdx = parseInt(tile.dataset.idx);
            if (fromIdx === toIdx) return;
            const moved = _images.splice(fromIdx, 1)[0];
            _images.splice(toIdx, 0, moved);
            _renderGallery();
            _images.forEach((img, i) => {
                fetch(`/api/images/${img.id}/sort`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sort_order: i })
                });
            });
        });
    }

    function getImages() { return _images; }

    return { init, uploadFiles, deleteImage, getImages };
})();

// ── Thumbnail loading ────────────────────────────────────────
function loadThumbnails(type, ids) {
    if (!ids || !ids.length) return;
    fetch(`/api/images/first/${type}?ids=${ids.join(',')}`)
        .then(r => r.json())
        .then(data => {
            document.querySelectorAll(`[data-thumb-type="${type}"]`).forEach(cell => {
                const id = cell.dataset.thumbId;
                if (data[id]) {
                    cell.innerHTML = '';
                    cell.style.backgroundImage = `url('${data[id].url}')`;
                    cell.style.backgroundSize = 'cover';
                    cell.style.backgroundPosition = 'center';
                }
            });
        });
}