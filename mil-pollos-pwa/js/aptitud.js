// =============================================================================
// aptitud.js – Aptitud Psicofísica Module
// =============================================================================

import { AptitudDB, WorkerDB, EvaluacionDB } from './db.js';
import { showToast, confirmDialog, createModal, openModal, closeModal } from './app.js';
import { formatDate } from './charts.js';

const TIPOS_EVAL = ['Pre-empleo', 'Pre-vacacional', 'Post-vacacional', 'Periódica', 'Post-incapacidad', 'Egreso'];

export async function renderAptitud(container) {
  const [workers, aptitudes] = await Promise.all([
    WorkerDB.getAll(),
    getAllAptitudes()
  ]);
  const workerMap = {};
  workers.forEach(w => { workerMap[w.id] = w; });

  const stats = {
    apto: aptitudes.filter(a => a.resultado === 'Apto').length,
    restricciones: aptitudes.filter(a => a.resultado === 'Apto con Restricciones').length,
    noApto: aptitudes.filter(a => a.resultado === 'No Apto').length
  };

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Aptitud Psicofísica</h2>
        <p class="page-subtitle">${aptitudes.length} certificados registrados</p>
      </div>
      <div class="toolbar">
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input type="text" id="apt-search" placeholder="Buscar trabajador..." />
        </div>
        <button class="btn btn-primary" id="add-apt-btn">➕ Nueva Aptitud</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stat-grid animate-stagger" style="grid-template-columns:repeat(3,1fr);margin-bottom:var(--space-5)">
      <div class="stat-card success">
        <div class="stat-icon">✅</div>
        <div class="stat-value">${stats.apto}</div>
        <div class="stat-label">Aptos</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-icon">⚠️</div>
        <div class="stat-value">${stats.restricciones}</div>
        <div class="stat-label">Con Restricciones</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-icon">❌</div>
        <div class="stat-value">${stats.noApto}</div>
        <div class="stat-label">No Aptos</div>
      </div>
    </div>

    <div class="card">
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Trabajador</th>
              <th>Tipo Evaluación</th>
              <th>Fecha</th>
              <th>Resultado</th>
              <th>Restricciones</th>
              <th>Válido Hasta</th>
              <th>Médico</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="apt-tbody">
            ${renderAptRows(aptitudes, workerMap)}
          </tbody>
        </table>
      </div>
      ${aptitudes.length === 0 ? emptyState('✅', 'Sin registros de aptitud', 'Registre el primer certificado de aptitud psicofísica') : ''}
    </div>
  `;

  document.getElementById('add-apt-btn').addEventListener('click', () => showAptModal(null, workers));
  document.getElementById('apt-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = q ? aptitudes.filter(a => {
      const w = workerMap[a.workerId] || {};
      return (`${w.nombre} ${w.apellido} ${w.cedula}`).toLowerCase().includes(q);
    }) : aptitudes;
    document.getElementById('apt-tbody').innerHTML = renderAptRows(filtered, workerMap);
    bindAptActions(filtered, workers, workerMap);
  });

  bindAptActions(aptitudes, workers, workerMap);
}

async function getAllAptitudes() {
  const { db } = await import('./db.js');
  return await db.aptitudes.orderBy('fecha').reverse().toArray();
}

function renderAptRows(aptitudes, workerMap) {
  if (!aptitudes.length) return '';
  return aptitudes.map(a => {
    const w = workerMap[a.workerId] || {};
    const cls = a.resultado === 'Apto' ? 'apt-apto' : a.resultado === 'No Apto' ? 'apt-no-apto' : 'apt-restric';
    const expired = a.valido_hasta && a.valido_hasta < new Date().toISOString().slice(0,10);
    return `
      <tr>
        <td>
          <div class="font-semibold">${w.apellido || ''}, ${w.nombre || '-'}</div>
          <div class="text-xs text-muted">${w.cedula || ''}</div>
        </td>
        <td>${a.tipo_evaluacion || '-'}</td>
        <td>${formatDate(a.fecha)}</td>
        <td><span class="badge ${cls}">${a.resultado || '-'}</span></td>
        <td class="text-sm">${a.restricciones || '—'}</td>
        <td>${a.valido_hasta ? `<span class="badge ${expired ? 'badge-red' : 'badge-green'}">${formatDate(a.valido_hasta)}</span>` : '-'}</td>
        <td class="text-muted text-sm">${a.medico || '-'}</td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-ghost btn-icon sm" data-action="edit-apt" data-id="${a.id}" title="Editar">✏️</button>
            <button class="btn btn-ghost btn-icon sm" data-action="del-apt" data-id="${a.id}" title="Eliminar" style="color:var(--color-danger)">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function bindAptActions(aptitudes, workers, workerMap) {
  document.querySelectorAll('[data-action="edit-apt"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = aptitudes.find(x => x.id === Number(btn.dataset.id));
      if (a) showAptModal(a, workers);
    });
  });
  document.querySelectorAll('[data-action="del-apt"]').forEach(btn => {
    btn.addEventListener('click', () => {
      confirmDialog('¿Eliminar este certificado de aptitud?', async () => {
        await AptitudDB.delete(Number(btn.dataset.id));
        showToast('Eliminado', 'Certificado eliminado', 'success');
        const all = await getAllAptitudes();
        document.getElementById('apt-tbody').innerHTML = renderAptRows(all, workerMap);
        bindAptActions(all, workers, workerMap);
      });
    });
  });
}

async function showAptModal(apt, workers) {
  const isEdit = !!apt;
  const wOptions = workers.map(w =>
    `<option value="${w.id}" ${apt?.workerId === w.id ? 'selected' : ''}>${w.apellido}, ${w.nombre} (${w.cedula})</option>`
  ).join('');

  const body = `
    <div class="form-grid">
      <div class="form-group form-full">
        <label class="form-label">Trabajador <span class="required">*</span></label>
        <select class="form-select" id="apt-worker">
          <option value="">Seleccionar trabajador...</option>
          ${wOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Tipo de Evaluación</label>
        <select class="form-select" id="apt-tipo">
          <option value="">Seleccionar...</option>
          ${TIPOS_EVAL.map(t => `<option value="${t}" ${apt?.tipo_evaluacion === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Fecha <span class="required">*</span></label>
        <input class="form-input" id="apt-fecha" type="date" value="${apt?.fecha || today()}" />
      </div>
      <div class="form-group form-full">
        <label class="form-label">Resultado <span class="required">*</span></label>
        <div class="flex gap-3" style="flex-wrap:wrap">
          ${['Apto', 'Apto con Restricciones', 'No Apto'].map(r => `
            <label class="form-check" style="background:var(--surface-2);padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);border:1px solid var(--border-color);cursor:pointer">
              <input type="radio" name="apt-resultado" value="${r}" ${apt?.resultado === r || (!apt && r === 'Apto') ? 'checked' : ''} />
              <span>${r}</span>
            </label>
          `).join('')}
        </div>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Restricciones / Condiciones</label>
        <textarea class="form-textarea" id="apt-restricciones" rows="2" placeholder="Ej: No levantamiento de cargas > 10kg, evitar posturas forzadas...">${apt?.restricciones || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Válido Hasta</label>
        <input class="form-input" id="apt-valido" type="date" value="${apt?.valido_hasta || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Médico Evaluador</label>
        <input class="form-input" id="apt-medico" type="text" value="${apt?.medico || ''}" />
      </div>
      <div class="form-group form-full">
        <label class="form-label">Observaciones</label>
        <textarea class="form-textarea" id="apt-obs" rows="2">${apt?.observaciones || ''}</textarea>
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-outline" onclick="closeModal('apt-modal')">Cancelar</button>
    <button class="btn btn-primary" id="save-apt-btn">${isEdit ? '💾 Actualizar' : '➕ Registrar'}</button>
  `;

  createModal('apt-modal', isEdit ? '✏️ Editar Aptitud' : '✅ Nueva Aptitud Psicofísica', body, footer);
  openModal('apt-modal');

  document.getElementById('save-apt-btn').addEventListener('click', async () => {
    const workerId = Number(document.getElementById('apt-worker').value);
    const fecha    = document.getElementById('apt-fecha').value;
    const resultado= document.querySelector('input[name="apt-resultado"]:checked')?.value || '';

    if (!workerId || !fecha || !resultado) {
      showToast('Campos requeridos', 'Complete trabajador, fecha y resultado', 'warning');
      return;
    }

    const worker = workers.find(w => w.id === workerId) || {};
    const data = {
      workerId,
      cedula:           worker.cedula || '',
      workerNombre:     `${worker.apellido}, ${worker.nombre}`,
      tipo_evaluacion:  document.getElementById('apt-tipo').value,
      fecha, resultado,
      restricciones:    document.getElementById('apt-restricciones').value.trim(),
      valido_hasta:     document.getElementById('apt-valido').value,
      medico:           document.getElementById('apt-medico').value.trim(),
      observaciones:    document.getElementById('apt-obs').value.trim()
    };

    if (isEdit) {
      await AptitudDB.update(apt.id, data);
      showToast('Actualizado', 'Aptitud actualizada', 'success');
    } else {
      await AptitudDB.add(data);
      showToast('Registrado', 'Certificado de aptitud registrado', 'success');
    }

    closeModal('apt-modal');
    const all = await getAllAptitudes();
    const wm = {};
    workers.forEach(w => { wm[w.id] = w; });
    document.getElementById('apt-tbody').innerHTML = renderAptRows(all, wm);
    bindAptActions(all, workers, wm);
  });
}

function today() { return new Date().toISOString().slice(0, 10); }
function emptyState(icon, title, desc) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-title">${title}</div><div class="empty-desc">${desc}</div></div>`;
}
