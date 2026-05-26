// =============================================================================
// reposos.js – Medical Rest Module
// =============================================================================

import { ReposooDB, WorkerDB } from './db.js';
import { showToast, confirmDialog, createModal, openModal, closeModal } from './app.js';
import { formatDate, calcDays } from './charts.js';

const DIAGNOSES_CIE10 = [
  'J00 – Rinofaringitis aguda (resfriado común)',
  'J06.9 – Infección aguda de las vías respiratorias superiores',
  'J11.1 – Gripe con otras manifestaciones respiratorias',
  'M54.5 – Lumbalgia',
  'M54.2 – Cervicalgia',
  'M75.1 – Síndrome del manguito rotador',
  'K29.0 – Gastroenteritis aguda',
  'R51 – Cefalea',
  'I10 – Hipertensión esencial',
  'S00-S99 – Traumatismos',
  'Z00.0 – Examen médico general',
  'Otro (especificar)'
];

export async function renderReposos(container) {
  const [workers, reposos] = await Promise.all([
    WorkerDB.getAll(),
    ReposooDB.getAll()
  ]);

  const workerMap = {};
  workers.forEach(w => { workerMap[w.id] = w; });
  const today = new Date().toISOString().slice(0,10);
  const vigentes = reposos.filter(r => r.fecha_fin >= today);
  const vencidos  = reposos.filter(r => r.fecha_fin < today);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Reposos Médicos</h2>
        <p class="page-subtitle">${reposos.length} reposos registrados · <span style="color:var(--color-danger)">${vigentes.length} vigentes</span></p>
      </div>
      <div class="toolbar">
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input type="text" id="rep-search" placeholder="Buscar trabajador..." />
        </div>
        <select class="form-select" id="rep-status-filter" style="width:auto">
          <option value="all">Todos</option>
          <option value="vigente">Vigentes</option>
          <option value="vencido">Vencidos</option>
        </select>
        <button class="btn btn-primary" id="add-rep-btn">➕ Nuevo Reposo</button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="stat-grid animate-stagger" style="grid-template-columns:repeat(3,1fr);margin-bottom:var(--space-5)">
      <div class="stat-card danger">
        <div class="stat-icon">🛏️</div>
        <div class="stat-value">${vigentes.length}</div>
        <div class="stat-label">Reposos Vigentes</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-value">${vencidos.length}</div>
        <div class="stat-label">Reposos Vencidos</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-icon">📅</div>
        <div class="stat-value">${reposos.reduce((sum, r) => sum + (calcDays(r.fecha_inicio, r.fecha_fin) || 0), 0)}</div>
        <div class="stat-label">Días Totales de Reposo</div>
      </div>
    </div>

    <div class="card">
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Trabajador</th>
              <th>Diagnóstico</th>
              <th>Fecha Inicio</th>
              <th>Fecha Fin</th>
              <th>Días</th>
              <th>Estado</th>
              <th>Médico</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="rep-tbody">
            ${renderReposoRows(reposos, workerMap)}
          </tbody>
        </table>
      </div>
      ${reposos.length === 0 ? emptyState('🛏️', 'Sin reposos registrados', 'Registre el primer reposo médico') : ''}
    </div>
  `;

  document.getElementById('add-rep-btn').addEventListener('click', () => showReposoModal(null, workers));

  function applyFilters() {
    const q    = document.getElementById('rep-search').value.toLowerCase();
    const st   = document.getElementById('rep-status-filter').value;
    const today2 = new Date().toISOString().slice(0,10);
    const filtered = reposos.filter(r => {
      const w = workerMap[r.workerId] || {};
      const matchQ = !q || (`${w.nombre} ${w.apellido} ${w.cedula}`).toLowerCase().includes(q);
      const vigente = r.fecha_fin >= today2;
      const matchS = st === 'all' || (st === 'vigente' && vigente) || (st === 'vencido' && !vigente);
      return matchQ && matchS;
    });
    document.getElementById('rep-tbody').innerHTML = renderReposoRows(filtered, workerMap);
    bindReposoActions(filtered, workers, workerMap);
  }

  document.getElementById('rep-search').addEventListener('input', applyFilters);
  document.getElementById('rep-status-filter').addEventListener('change', applyFilters);
  bindReposoActions(reposos, workers, workerMap);
}

function renderReposoRows(reposos, workerMap) {
  if (!reposos.length) return '';
  const today = new Date().toISOString().slice(0,10);
  return reposos.map(r => {
    const w = workerMap[r.workerId] || {};
    const vigente = r.fecha_fin >= today;
    const dias = calcDays(r.fecha_inicio, r.fecha_fin);
    return `
      <tr>
        <td>
          <div class="font-semibold">${w.apellido || ''}, ${w.nombre || r.cedula || '-'}</div>
          <div class="text-xs text-muted">${w.cedula || ''}</div>
        </td>
        <td class="text-sm">${r.diagnostico || '-'}</td>
        <td>${formatDate(r.fecha_inicio)}</td>
        <td>${formatDate(r.fecha_fin)}</td>
        <td><span class="badge ${dias > 7 ? 'badge-red' : 'badge-gold'}">${dias} días</span></td>
        <td><span class="badge ${vigente ? 'badge-red' : 'badge-gray'}">${vigente ? '🔴 Vigente' : '✅ Vencido'}</span></td>
        <td class="text-muted text-sm">${r.medico || '-'}</td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-ghost btn-icon sm" data-action="edit-rep" data-id="${r.id}" title="Editar">✏️</button>
            <button class="btn btn-ghost btn-icon sm" data-action="del-rep" data-id="${r.id}" title="Eliminar" style="color:var(--color-danger)">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function bindReposoActions(reposos, workers, workerMap) {
  document.querySelectorAll('[data-action="edit-rep"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const r = reposos.find(x => x.id === Number(btn.dataset.id));
      if (r) showReposoModal(r, workers);
    });
  });
  document.querySelectorAll('[data-action="del-rep"]').forEach(btn => {
    btn.addEventListener('click', () => {
      confirmDialog('¿Eliminar este reposo médico?', async () => {
        await ReposooDB.delete(Number(btn.dataset.id));
        showToast('Eliminado', 'Reposo eliminado correctamente', 'success');
        const all = await ReposooDB.getAll();
        document.getElementById('rep-tbody').innerHTML = renderReposoRows(all, workerMap);
        bindReposoActions(all, workers, workerMap);
      });
    });
  });
}

async function showReposoModal(rep, workers) {
  const isEdit = !!rep;
  const wOptions = workers.map(w =>
    `<option value="${w.id}" ${rep?.workerId === w.id ? 'selected' : ''}>${w.apellido}, ${w.nombre} (${w.cedula})</option>`
  ).join('');

  const diagOptions = DIAGNOSES_CIE10.map(d =>
    `<option value="${d}" ${rep?.diagnostico === d ? 'selected' : ''}>${d}</option>`
  ).join('');

  const body = `
    <div class="form-grid">
      <div class="form-group form-full">
        <label class="form-label">Trabajador <span class="required">*</span></label>
        <select class="form-select" id="rep-worker">
          <option value="">Seleccionar trabajador...</option>
          ${wOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Fecha Inicio <span class="required">*</span></label>
        <input class="form-input" id="rep-fecha-inicio" type="date" value="${rep?.fecha_inicio || today()}" />
      </div>
      <div class="form-group">
        <label class="form-label">Fecha Fin <span class="required">*</span></label>
        <input class="form-input" id="rep-fecha-fin" type="date" value="${rep?.fecha_fin || ''}" />
      </div>
      <div class="form-group form-full">
        <label class="form-label">Diagnóstico <span class="required">*</span></label>
        <select class="form-select" id="rep-diag-sel">
          <option value="">Seleccionar diagnóstico...</option>
          ${diagOptions}
        </select>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Diagnóstico personalizado (si seleccionó "Otro")</label>
        <input class="form-input" id="rep-diag-custom" type="text" value="${!DIAGNOSES_CIE10.includes(rep?.diagnostico || '') ? (rep?.diagnostico || '') : ''}" placeholder="Especificar diagnóstico..." />
      </div>
      <div class="form-group">
        <label class="form-label">Médico que emite</label>
        <input class="form-input" id="rep-medico" type="text" value="${rep?.medico || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Nº de Reposo</label>
        <input class="form-input" id="rep-numero" type="text" value="${rep?.numero || ''}" />
      </div>
      <div class="form-group form-full">
        <label class="form-label">Observaciones</label>
        <textarea class="form-textarea" id="rep-obs" rows="2">${rep?.observaciones || ''}</textarea>
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-outline" onclick="closeModal('rep-modal')">Cancelar</button>
    <button class="btn btn-primary" id="save-rep-btn">${isEdit ? '💾 Actualizar' : '➕ Registrar'}</button>
  `;

  createModal('rep-modal', isEdit ? '✏️ Editar Reposo' : '🛏️ Nuevo Reposo Médico', body, footer);
  openModal('rep-modal');

  document.getElementById('save-rep-btn').addEventListener('click', async () => {
    const workerId     = Number(document.getElementById('rep-worker').value);
    const fecha_inicio = document.getElementById('rep-fecha-inicio').value;
    const fecha_fin    = document.getElementById('rep-fecha-fin').value;
    const diagSel      = document.getElementById('rep-diag-sel').value;
    const diagCustom   = document.getElementById('rep-diag-custom').value.trim();
    const diagnostico  = diagSel === 'Otro (especificar)' ? diagCustom : (diagSel || diagCustom);

    if (!workerId || !fecha_inicio || !fecha_fin || !diagnostico) {
      showToast('Campos requeridos', 'Complete todos los campos obligatorios', 'warning');
      return;
    }

    const worker = workers.find(w => w.id === workerId) || {};
    const data = {
      workerId,
      cedula:       worker.cedula || '',
      workerNombre: `${worker.apellido}, ${worker.nombre}`,
      fecha_inicio, fecha_fin, diagnostico,
      medico:       document.getElementById('rep-medico').value.trim(),
      numero:       document.getElementById('rep-numero').value.trim(),
      observaciones:document.getElementById('rep-obs').value.trim()
    };

    if (isEdit) {
      await ReposooDB.update(rep.id, data);
      showToast('Actualizado', 'Reposo actualizado', 'success');
    } else {
      await ReposooDB.add(data);
      showToast('Registrado', 'Reposo registrado correctamente', 'success');
    }

    closeModal('rep-modal');
    const all = await ReposooDB.getAll();
    const wm = {};
    workers.forEach(w => { wm[w.id] = w; });
    document.getElementById('rep-tbody').innerHTML = renderReposoRows(all, wm);
    bindReposoActions(all, workers, wm);
  });
}

function today() { return new Date().toISOString().slice(0, 10); }
function emptyState(icon, title, desc) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-title">${title}</div><div class="empty-desc">${desc}</div></div>`;
}
