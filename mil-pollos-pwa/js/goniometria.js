// =============================================================================
// goniometria.js – Goniometry Module
// =============================================================================

import { GoniometriaDB, WorkerDB } from './db.js';
import { showToast, confirmDialog, createModal, openModal, closeModal } from './app.js';
import { formatDate } from './charts.js';

const SEGMENTS = [
  { id: 'columna_cervical', label: 'Columna Cervical', movements: ['Flexión', 'Extensión', 'Lat. Derecha', 'Lat. Izquierda', 'Rot. Derecha', 'Rot. Izquierda'] },
  { id: 'columna_lumbar',   label: 'Columna Lumbar',   movements: ['Flexión', 'Extensión', 'Lat. Derecha', 'Lat. Izquierda'] },
  { id: 'hombro_der',       label: 'Hombro Derecho',   bilateral: false, movements: ['Flexión', 'Extensión', 'Abducción', 'Aducción', 'Rot. Interna', 'Rot. Externa'] },
  { id: 'hombro_izq',       label: 'Hombro Izquierdo', bilateral: false, movements: ['Flexión', 'Extensión', 'Abducción', 'Aducción', 'Rot. Interna', 'Rot. Externa'] },
  { id: 'codo_der',         label: 'Codo Derecho',     movements: ['Flexión', 'Extensión', 'Pronación', 'Supinación'] },
  { id: 'codo_izq',         label: 'Codo Izquierdo',   movements: ['Flexión', 'Extensión', 'Pronación', 'Supinación'] },
  { id: 'muneca_der',       label: 'Muñeca Derecha',   movements: ['Flexión', 'Extensión', 'Desv. Radial', 'Desv. Cubital'] },
  { id: 'muneca_izq',       label: 'Muñeca Izquierda', movements: ['Flexión', 'Extensión', 'Desv. Radial', 'Desv. Cubital'] },
  { id: 'cadera_der',       label: 'Cadera Derecha',   movements: ['Flexión', 'Extensión', 'Abducción', 'Aducción'] },
  { id: 'cadera_izq',       label: 'Cadera Izquierda', movements: ['Flexión', 'Extensión', 'Abducción', 'Aducción'] },
  { id: 'rodilla_der',      label: 'Rodilla Derecha',  movements: ['Flexión', 'Extensión'] },
  { id: 'rodilla_izq',      label: 'Rodilla Izquierda',movements: ['Flexión', 'Extensión'] },
  { id: 'tobillo_der',      label: 'Tobillo Derecho',  movements: ['Flexión Plantar', 'Flexión Dorsal', 'Inversión', 'Eversión'] },
  { id: 'tobillo_izq',      label: 'Tobillo Izquierdo',movements: ['Flexión Plantar', 'Flexión Dorsal', 'Inversión', 'Eversión'] },
];

export async function renderGoniometria(container) {
  const [workers, gonios] = await Promise.all([
    WorkerDB.getAll(),
    getAllGonios()
  ]);
  const wm = {};
  workers.forEach(w => { wm[w.id] = w; });

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Goniometrías</h2>
        <p class="page-subtitle">${gonios.length} evaluaciones registradas</p>
      </div>
      <div class="toolbar">
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input type="text" id="gon-search" placeholder="Buscar trabajador..." />
        </div>
        <button class="btn btn-primary" id="add-gon-btn">➕ Nueva Goniometría</button>
      </div>
    </div>
    <div class="card">
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr><th>Trabajador</th><th>Fecha</th><th>Segmentos Evaluados</th><th>Observaciones</th><th>Médico</th><th>Acciones</th></tr>
          </thead>
          <tbody id="gon-tbody">${renderGonRows(gonios, wm)}</tbody>
        </table>
      </div>
      ${gonios.length === 0 ? emptyState('📐', 'Sin evaluaciones goniométricas', 'Registre la primera evaluación de rangos articulares') : ''}
    </div>
  `;

  document.getElementById('add-gon-btn').addEventListener('click', () => showGonModal(null, workers));
  document.getElementById('gon-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const f = q ? gonios.filter(g => {
      const w = wm[g.workerId] || {};
      return (`${w.nombre} ${w.apellido} ${w.cedula}`).toLowerCase().includes(q);
    }) : gonios;
    document.getElementById('gon-tbody').innerHTML = renderGonRows(f, wm);
    bindGonActions(f, workers, wm);
  });
  bindGonActions(gonios, workers, wm);
}

async function getAllGonios() {
  const { db } = await import('./db.js');
  return await db.goniometrias.orderBy('fecha').reverse().toArray();
}

function renderGonRows(gonios, wm) {
  if (!gonios.length) return '';
  return gonios.map(g => {
    const w = wm[g.workerId] || {};
    const segs = g.segmentos ? Object.keys(g.segmentos).length : 0;
    return `
      <tr>
        <td><div class="font-semibold">${w.apellido || ''}, ${w.nombre || '-'}</div><div class="text-xs text-muted">${w.cedula || ''}</div></td>
        <td>${formatDate(g.fecha)}</td>
        <td><span class="badge badge-blue">${segs} segmentos</span></td>
        <td class="text-sm">${truncate(g.observaciones || '-', 45)}</td>
        <td class="text-muted text-sm">${g.medico || '-'}</td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-ghost btn-icon sm" data-action="view-gon" data-id="${g.id}" title="Ver detalle">👁️</button>
            <button class="btn btn-ghost btn-icon sm" data-action="del-gon" data-id="${g.id}" title="Eliminar" style="color:var(--color-danger)">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function bindGonActions(gonios, workers, wm) {
  document.querySelectorAll('[data-action="view-gon"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const g = gonios.find(x => x.id === Number(btn.dataset.id));
      if (g) showGonDetail(g, wm[g.workerId] || {});
    });
  });
  document.querySelectorAll('[data-action="del-gon"]').forEach(btn => {
    btn.addEventListener('click', () => {
      confirmDialog('¿Eliminar esta goniometría?', async () => {
        await GoniometriaDB.delete(Number(btn.dataset.id));
        showToast('Eliminado', 'Evaluación eliminada', 'success');
        const all = await getAllGonios();
        document.getElementById('gon-tbody').innerHTML = renderGonRows(all, wm);
        bindGonActions(all, workers, wm);
      });
    });
  });
}

function showGonDetail(g, worker) {
  const segs = g.segmentos || {};
  let segHTML = '';
  SEGMENTS.forEach(seg => {
    const vals = segs[seg.id];
    if (!vals) return;
    segHTML += `
      <div class="mb-4">
        <div class="font-semibold text-sm mb-2" style="color:var(--brand-green-400)">${seg.label}</div>
        <div class="goniomet-grid">
          ${seg.movements.map(m => `
            <div class="goniomet-cell">
              <label>${m}</label>
              <div style="font-size:var(--font-size-lg);font-weight:700;color:var(--text-primary)">${vals[m] || '-'}°</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

  const body = `
    <div class="mb-4">
      <h3 class="font-bold text-lg">${worker.apellido || ''}, ${worker.nombre || '-'}</h3>
      <p class="text-muted">C.I.: ${worker.cedula || '-'} · Fecha: ${formatDate(g.fecha)}</p>
    </div>
    <div class="separator"></div>
    ${segHTML || '<p class="text-muted">Sin datos de segmentos</p>'}
    ${g.observaciones ? `<div class="mt-4"><strong class="text-muted text-sm">Observaciones:</strong><p>${g.observaciones}</p></div>` : ''}
  `;

  createModal('gon-detail', '📐 Detalle Goniométrico', body, '', 'modal-xl');
  openModal('gon-detail');
}

async function showGonModal(gon, workers) {
  const wOpts = workers.map(w =>
    `<option value="${w.id}" ${gon?.workerId === w.id ? 'selected' : ''}>${w.apellido}, ${w.nombre} (${w.cedula})</option>`
  ).join('');

  const segInputs = SEGMENTS.map(seg => `
    <div class="card mb-4">
      <div class="card-header" style="margin-bottom:var(--space-3)">
        <span class="font-semibold">${seg.label}</span>
      </div>
      <div class="goniomet-grid">
        ${seg.movements.map(m => `
          <div class="goniomet-cell">
            <label>${m} (°)</label>
            <input type="number" id="gon-${seg.id}-${m.replace(/[^a-zA-Z0-9]/g, '_')}" min="0" max="360"
              value="${gon?.segmentos?.[seg.id]?.[m] || ''}" />
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  const body = `
    <div class="form-grid mb-5">
      <div class="form-group form-full">
        <label class="form-label">Trabajador <span class="required">*</span></label>
        <select class="form-select" id="gon-worker"><option value="">Seleccionar...</option>${wOpts}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Fecha <span class="required">*</span></label>
        <input class="form-input" id="gon-fecha" type="date" value="${gon?.fecha || today()}" />
      </div>
      <div class="form-group">
        <label class="form-label">Médico</label>
        <input class="form-input" id="gon-medico" value="${gon?.medico || ''}" />
      </div>
    </div>
    <div style="max-height:50vh;overflow-y:auto;padding-right:4px">
      ${segInputs}
    </div>
    <div class="form-group mt-4">
      <label class="form-label">Observaciones Generales</label>
      <textarea class="form-textarea" id="gon-obs" rows="2">${gon?.observaciones || ''}</textarea>
    </div>
  `;

  const footer = `
    <button class="btn btn-outline" onclick="closeModal('gon-modal')">Cancelar</button>
    <button class="btn btn-primary" id="save-gon-btn">➕ Registrar</button>
  `;

  createModal('gon-modal', '📐 Nueva Goniometría', body, footer, 'modal-xl');
  openModal('gon-modal');

  document.getElementById('save-gon-btn').addEventListener('click', async () => {
    const workerId = Number(document.getElementById('gon-worker').value);
    const fecha = document.getElementById('gon-fecha').value;
    if (!workerId || !fecha) {
      showToast('Campos requeridos', 'Complete trabajador y fecha', 'warning');
      return;
    }

    const segmentos = {};
    SEGMENTS.forEach(seg => {
      const vals = {};
      seg.movements.forEach(m => {
        const id = `gon-${seg.id}-${m.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const v = document.getElementById(id)?.value;
        if (v !== '' && v !== undefined) vals[m] = Number(v);
      });
      if (Object.keys(vals).length) segmentos[seg.id] = vals;
    });

    const worker = workers.find(w => w.id === workerId) || {};
    await GoniometriaDB.add({
      workerId, cedula: worker.cedula || '',
      workerNombre: `${worker.apellido}, ${worker.nombre}`,
      fecha, segmentos,
      medico: document.getElementById('gon-medico').value.trim(),
      observaciones: document.getElementById('gon-obs').value.trim()
    });

    showToast('Registrado', 'Goniometría registrada', 'success');
    closeModal('gon-modal');
    const all = await getAllGonios();
    const wm = {};
    workers.forEach(w => { wm[w.id] = w; });
    document.getElementById('gon-tbody').innerHTML = renderGonRows(all, wm);
    bindGonActions(all, workers, wm);
  });
}

function truncate(s, n) { return s.length > n ? s.slice(0, n) + '...' : s; }
function today() { return new Date().toISOString().slice(0, 10); }
function emptyState(i, t, d) { return `<div class="empty-state"><div class="empty-icon">${i}</div><div class="empty-title">${t}</div><div class="empty-desc">${d}</div></div>`; }
