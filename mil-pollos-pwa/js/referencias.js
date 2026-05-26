// =============================================================================
// referencias.js – Specialist References Module
// =============================================================================

import { ReferenciaDB, WorkerDB } from './db.js';
import { showToast, confirmDialog, createModal, openModal, closeModal } from './app.js';
import { formatDate } from './charts.js';

const ESPECIALIDADES = ['Medicina Interna', 'Traumatología y Ortopedia', 'Cardiología', 'Neumología',
  'Neurología', 'Dermatología', 'Oftalmología', 'Otorrinolaringología', 'Gastroenterología',
  'Urología', 'Ginecología', 'Psiquiatría', 'Fisioterapia y Rehabilitación', 'Odontología', 'Otra'];

export async function renderReferencias(container) {
  const [workers, refs] = await Promise.all([
    WorkerDB.getAll(),
    getAllReferencias()
  ]);
  const wm = {};
  workers.forEach(w => { wm[w.id] = w; });

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Referencias a Especialistas</h2>
        <p class="page-subtitle">${refs.length} referencias registradas</p>
      </div>
      <div class="toolbar">
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input type="text" id="ref-search" placeholder="Buscar trabajador o especialidad..." />
        </div>
        <button class="btn btn-primary" id="add-ref-btn">➕ Nueva Referencia</button>
      </div>
    </div>
    <div class="card">
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr><th>Trabajador</th><th>Especialidad</th><th>Fecha</th><th>Urgencia</th><th>Motivo</th><th>Estado</th><th>Resultado</th><th>Acciones</th></tr>
          </thead>
          <tbody id="ref-tbody">${renderRefRows(refs, wm)}</tbody>
        </table>
      </div>
      ${refs.length === 0 ? emptyState('📨', 'Sin referencias registradas', 'Emita la primera referencia a especialista') : ''}
    </div>
  `;

  document.getElementById('add-ref-btn').addEventListener('click', () => showRefModal(null, workers));
  document.getElementById('ref-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const f = q ? refs.filter(r => {
      const w = wm[r.workerId] || {};
      return (`${w.nombre} ${w.apellido} ${w.cedula} ${r.especialidad}`).toLowerCase().includes(q);
    }) : refs;
    document.getElementById('ref-tbody').innerHTML = renderRefRows(f, wm);
    bindRefActions(f, workers, wm);
  });
  bindRefActions(refs, workers, wm);
}

async function getAllReferencias() {
  const { db } = await import('./db.js');
  return await db.referencias.orderBy('fecha').reverse().toArray();
}

function renderRefRows(refs, wm) {
  if (!refs.length) return '';
  return refs.map(r => {
    const w = wm[r.workerId] || {};
    const urgCls = r.urgencia === 'Alta' ? 'badge-red' : r.urgencia === 'Media' ? 'badge-gold' : 'badge-gray';
    const statusCls = r.status === 'Respondida' ? 'badge-green' : 'badge-blue';
    return `
      <tr>
        <td><div class="font-semibold">${w.apellido || ''}, ${w.nombre || '-'}</div><div class="text-xs text-muted">${w.cedula || ''}</div></td>
        <td>${r.especialidad || '-'}</td>
        <td>${formatDate(r.fecha)}</td>
        <td><span class="badge ${urgCls}">${r.urgencia || 'Normal'}</span></td>
        <td class="text-sm">${truncate(r.motivo || '-', 40)}</td>
        <td><span class="badge ${statusCls}">${r.status || 'Pendiente'}</span></td>
        <td class="text-sm">${truncate(r.resultado || '-', 35)}</td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-ghost btn-icon sm" data-action="edit-ref" data-id="${r.id}" title="Editar">✏️</button>
            <button class="btn btn-ghost btn-icon sm" data-action="del-ref" data-id="${r.id}" title="Eliminar" style="color:var(--color-danger)">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function bindRefActions(refs, workers, wm) {
  document.querySelectorAll('[data-action="edit-ref"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = refs.find(x => x.id === Number(btn.dataset.id));
      if (r) showRefModal(r, workers);
    });
  });
  document.querySelectorAll('[data-action="del-ref"]').forEach(btn => {
    btn.addEventListener('click', () => {
      confirmDialog('¿Eliminar esta referencia?', async () => {
        await ReferenciaDB.delete(Number(btn.dataset.id));
        showToast('Eliminado', 'Referencia eliminada', 'success');
        const all = await getAllReferencias();
        document.getElementById('ref-tbody').innerHTML = renderRefRows(all, wm);
        bindRefActions(all, workers, wm);
      });
    });
  });
}

async function showRefModal(ref, workers) {
  const isEdit = !!ref;
  const wOpts = workers.map(w =>
    `<option value="${w.id}" ${ref?.workerId === w.id ? 'selected' : ''}>${w.apellido}, ${w.nombre} (${w.cedula})</option>`
  ).join('');
  const espOpts = ESPECIALIDADES.map(e =>
    `<option value="${e}" ${ref?.especialidad === e ? 'selected' : ''}>${e}</option>`
  ).join('');

  const body = `
    <div class="form-grid">
      <div class="form-group form-full">
        <label class="form-label">Trabajador <span class="required">*</span></label>
        <select class="form-select" id="ref-worker"><option value="">Seleccionar...</option>${wOpts}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Especialidad <span class="required">*</span></label>
        <select class="form-select" id="ref-esp"><option value="">Seleccionar...</option>${espOpts}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Fecha <span class="required">*</span></label>
        <input class="form-input" id="ref-fecha" type="date" value="${ref?.fecha || today()}" />
      </div>
      <div class="form-group">
        <label class="form-label">Urgencia</label>
        <select class="form-select" id="ref-urg">
          ${['Normal','Media','Alta'].map(u => `<option ${ref?.urgencia === u ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Estado</label>
        <select class="form-select" id="ref-status">
          ${['Pendiente','Respondida','Cancelada'].map(s => `<option ${ref?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Motivo de Referencia</label>
        <textarea class="form-textarea" id="ref-motivo" rows="2">${ref?.motivo || ''}</textarea>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Resultado / Respuesta del Especialista</label>
        <textarea class="form-textarea" id="ref-resultado" rows="3">${ref?.resultado || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Médico que Refiere</label>
        <input class="form-input" id="ref-medico" type="text" value="${ref?.medico || ''}" />
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-outline" onclick="closeModal('ref-modal')">Cancelar</button>
    <button class="btn btn-primary" id="save-ref-btn">${isEdit ? '💾 Actualizar' : '➕ Registrar'}</button>
  `;

  createModal('ref-modal', isEdit ? '✏️ Editar Referencia' : '📨 Nueva Referencia a Especialista', body, footer);
  openModal('ref-modal');

  document.getElementById('save-ref-btn').addEventListener('click', async () => {
    const workerId = Number(document.getElementById('ref-worker').value);
    const esp = document.getElementById('ref-esp').value;
    const fecha = document.getElementById('ref-fecha').value;
    if (!workerId || !esp || !fecha) {
      showToast('Campos requeridos', 'Complete trabajador, especialidad y fecha', 'warning');
      return;
    }
    const worker = workers.find(w => w.id === workerId) || {};
    const data = {
      workerId, cedula: worker.cedula || '',
      workerNombre: `${worker.apellido}, ${worker.nombre}`,
      especialidad: esp, fecha,
      urgencia: document.getElementById('ref-urg').value,
      status: document.getElementById('ref-status').value,
      motivo: document.getElementById('ref-motivo').value.trim(),
      resultado: document.getElementById('ref-resultado').value.trim(),
      medico: document.getElementById('ref-medico').value.trim()
    };
    if (isEdit) { await ReferenciaDB.update(ref.id, data); showToast('Actualizado', 'Referencia actualizada', 'success'); }
    else { await ReferenciaDB.add(data); showToast('Registrado', 'Referencia registrada', 'success'); }
    closeModal('ref-modal');
    const all = await getAllReferencias();
    const wm = {};
    workers.forEach(w => { wm[w.id] = w; });
    document.getElementById('ref-tbody').innerHTML = renderRefRows(all, wm);
    bindRefActions(all, workers, wm);
  });
}

function truncate(s, n) { return s.length > n ? s.slice(0, n) + '...' : s; }
function today() { return new Date().toISOString().slice(0, 10); }
function emptyState(i, t, d) { return `<div class="empty-state"><div class="empty-icon">${i}</div><div class="empty-title">${t}</div><div class="empty-desc">${d}</div></div>`; }
