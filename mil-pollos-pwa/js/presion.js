// =============================================================================
// presion.js – Blood Pressure Control Module
// =============================================================================

import { PresionDB, WorkerDB } from './db.js';
import { showToast, confirmDialog, createModal, openModal, closeModal } from './app.js';
import { formatDate, getBPCategory } from './charts.js';

export async function renderPresion(container) {
  const [workers, readings] = await Promise.all([
    WorkerDB.getAll(),
    PresionDB.getAll ? PresionDB.getAll() : []
  ]);

  const allReadings = [];
  for (const w of workers) {
    const wReadings = await PresionDB.getByWorker(w.id);
    wReadings.forEach(r => allReadings.push({ ...r, worker: w }));
  }
  allReadings.sort((a, b) => b.fecha.localeCompare(a.fecha));

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Control de Presión Arterial</h2>
        <p class="page-subtitle">${allReadings.length} registros de presión arterial</p>
      </div>
      <div class="toolbar">
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input type="text" id="pa-search" placeholder="Buscar trabajador..." />
        </div>
        <button class="btn btn-primary" id="add-pa-btn">➕ Nuevo Registro</button>
      </div>
    </div>

    <div class="card">
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Trabajador</th>
              <th>Fecha/Hora</th>
              <th>PA (mmHg)</th>
              <th>FC (lpm)</th>
              <th>Clasificación</th>
              <th>Observaciones</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="pa-tbody">
            ${renderPARows(allReadings)}
          </tbody>
        </table>
      </div>
      ${allReadings.length === 0 ? emptyState('💗', 'Sin registros de presión arterial', 'Registre la primera toma de presión arterial') : ''}
    </div>
  `;

  document.getElementById('add-pa-btn').addEventListener('click', () => showPAModal(null, workers));

  document.getElementById('pa-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = q ? allReadings.filter(r =>
      (`${r.worker?.nombre} ${r.worker?.apellido} ${r.worker?.cedula}`).toLowerCase().includes(q)
    ) : allReadings;
    document.getElementById('pa-tbody').innerHTML = renderPARows(filtered);
    bindPAActions(filtered, workers);
  });

  bindPAActions(allReadings, workers);
}

function renderPARows(readings) {
  if (!readings.length) return '';
  return readings.map(r => {
    const cat = getBPCategory(r.sistolica, r.diastolica);
    return `
      <tr>
        <td>
          <div class="font-semibold">${r.worker?.apellido || ''}, ${r.worker?.nombre || '-'}</div>
          <div class="text-xs text-muted">${r.worker?.cedula || ''}</div>
        </td>
        <td>${formatDate(r.fecha)} ${r.hora ? r.hora : ''}</td>
        <td>
          <div class="bp-reading">
            <span class="bp-sys">${r.sistolica}</span>
            <span class="bp-sep">/</span>
            <span class="bp-dia">${r.diastolica}</span>
          </div>
        </td>
        <td>${r.fc || '-'}</td>
        <td><span class="bp-category ${cat.cls}">${cat.label}</span></td>
        <td class="text-muted text-sm">${r.observaciones || '-'}</td>
        <td>
          <button class="btn btn-ghost btn-icon sm" data-action="del-pa" data-id="${r.id}" title="Eliminar" style="color:var(--color-danger)">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function bindPAActions(readings, workers) {
  document.querySelectorAll('[data-action="del-pa"]').forEach(btn => {
    btn.addEventListener('click', () => {
      confirmDialog('¿Eliminar este registro de presión arterial?', async () => {
        await PresionDB.delete(Number(btn.dataset.id));
        showToast('Eliminado', 'Registro eliminado', 'success');
        const wList = await WorkerDB.getAll();
        const all = [];
        for (const w of wList) {
          const r = await PresionDB.getByWorker(w.id);
          r.forEach(x => all.push({ ...x, worker: w }));
        }
        all.sort((a, b) => b.fecha.localeCompare(a.fecha));
        document.getElementById('pa-tbody').innerHTML = renderPARows(all);
        bindPAActions(all, wList);
      });
    });
  });
}

async function showPAModal(pa, workers) {
  const wOptions = workers.map(w =>
    `<option value="${w.id}">${w.apellido}, ${w.nombre} (${w.cedula})</option>`
  ).join('');

  const body = `
    <div class="form-grid">
      <div class="form-group form-full">
        <label class="form-label">Trabajador <span class="required">*</span></label>
        <select class="form-select" id="pa-worker">
          <option value="">Seleccionar trabajador...</option>
          ${wOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Fecha <span class="required">*</span></label>
        <input class="form-input" id="pa-fecha" type="date" value="${today()}" />
      </div>
      <div class="form-group">
        <label class="form-label">Hora</label>
        <input class="form-input" id="pa-hora" type="time" value="${currentTime()}" />
      </div>
      <div class="form-group">
        <label class="form-label">Sistólica (mmHg) <span class="required">*</span></label>
        <input class="form-input" id="pa-sis" type="number" placeholder="120" min="60" max="300" />
      </div>
      <div class="form-group">
        <label class="form-label">Diastólica (mmHg) <span class="required">*</span></label>
        <input class="form-input" id="pa-dia" type="number" placeholder="80" min="40" max="200" />
      </div>
      <div class="form-group">
        <label class="form-label">FC (lpm)</label>
        <input class="form-input" id="pa-fc" type="number" placeholder="75" />
      </div>
      <div class="form-group" id="pa-cat-container" style="align-self:end">
        <div id="pa-cat-display" class="p-4 rounded" style="background:var(--surface-2);text-align:center">
          <div class="text-muted text-sm">Clasificación</div>
          <div id="pa-cat-label" class="font-bold text-lg mt-1">—</div>
        </div>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Observaciones</label>
        <textarea class="form-textarea" id="pa-obs" rows="2"></textarea>
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-outline" onclick="closeModal('pa-modal')">Cancelar</button>
    <button class="btn btn-primary" id="save-pa-btn">➕ Registrar</button>
  `;

  createModal('pa-modal', '💗 Registro de Presión Arterial', body, footer);
  openModal('pa-modal');

  // Live classification
  function updateCat() {
    const sys = Number(document.getElementById('pa-sis').value);
    const dia = Number(document.getElementById('pa-dia').value);
    if (sys && dia) {
      const cat = getBPCategory(sys, dia);
      document.getElementById('pa-cat-label').textContent = cat.label;
      document.getElementById('pa-cat-label').className = `font-bold text-lg mt-1 bp-category ${cat.cls}`;
    }
  }
  document.getElementById('pa-sis').addEventListener('input', updateCat);
  document.getElementById('pa-dia').addEventListener('input', updateCat);

  document.getElementById('save-pa-btn').addEventListener('click', async () => {
    const workerId  = Number(document.getElementById('pa-worker').value);
    const sistolica = Number(document.getElementById('pa-sis').value);
    const diastolica= Number(document.getElementById('pa-dia').value);
    const fecha     = document.getElementById('pa-fecha').value;

    if (!workerId || !sistolica || !diastolica || !fecha) {
      showToast('Campos requeridos', 'Complete trabajador, fecha y presiones', 'warning');
      return;
    }

    const worker = workers.find(w => w.id === workerId) || {};
    await PresionDB.add({
      workerId,
      cedula: worker.cedula || '',
      workerNombre: `${worker.apellido}, ${worker.nombre}`,
      fecha,
      hora:         document.getElementById('pa-hora').value,
      sistolica,
      diastolica,
      fc:           document.getElementById('pa-fc').value,
      observaciones:document.getElementById('pa-obs').value.trim()
    });

    showToast('Registrado', 'Toma de presión arterial registrada', 'success');
    closeModal('pa-modal');

    const wList = await WorkerDB.getAll();
    const all = [];
    for (const w of wList) {
      const r = await PresionDB.getByWorker(w.id);
      r.forEach(x => all.push({ ...x, worker: w }));
    }
    all.sort((a, b) => b.fecha.localeCompare(a.fecha));
    document.getElementById('pa-tbody').innerHTML = renderPARows(all);
    bindPAActions(all, wList);
  });
}

function today() { return new Date().toISOString().slice(0, 10); }
function currentTime() { return new Date().toTimeString().slice(0, 5); }
function emptyState(icon, title, desc) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-title">${title}</div><div class="empty-desc">${desc}</div></div>`;
}
