// =============================================================================
// evaluaciones.js – Evaluaciones Médicas Module
// =============================================================================

import { EvaluacionDB, WorkerDB, AptitudDB } from './db.js';
import { showToast, confirmDialog, createModal, openModal, closeModal } from './app.js';
import { formatDate } from './charts.js';

const TIPOS_EVAL = ['Pre-empleo', 'Pre-vacacional', 'Post-vacacional', 'Periódica', 'Post-incapacidad', 'Egreso'];
const TIPO_BADGE = {
  'Pre-empleo':       'badge-blue',
  'Pre-vacacional':   'badge-gold',
  'Post-vacacional':  'badge-green',
  'Periódica':        'badge-gray',
  'Post-incapacidad': 'badge-red',
  'Egreso':           'badge-gray'
};

export async function renderEvaluaciones(container) {
  const [evals, workers] = await Promise.all([
    EvaluacionDB.getRecent(200),
    WorkerDB.getAll()
  ]);

  const workerMap = {};
  workers.forEach(w => { workerMap[w.id] = w; });

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Evaluaciones Médicas</h2>
        <p class="page-subtitle">${evals.length} evaluaciones registradas</p>
      </div>
      <div class="toolbar">
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input type="text" id="eval-search" placeholder="Buscar por trabajador o tipo..." />
        </div>
        <select class="form-select" id="eval-tipo-filter" style="width:auto">
          <option value="">Todos los tipos</option>
          ${TIPOS_EVAL.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
        <button class="btn btn-primary" id="add-eval-btn">➕ Nueva Evaluación</button>
      </div>
    </div>

    <div class="card">
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Trabajador</th>
              <th>Cédula</th>
              <th>Tipo</th>
              <th>Fecha</th>
              <th>Médico</th>
              <th>Resultado</th>
              <th>Aptitud</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="eval-tbody">
            ${renderEvalRows(evals, workerMap)}
          </tbody>
        </table>
      </div>
      ${evals.length === 0 ? emptyState('🩺', 'Sin evaluaciones registradas', 'Registre la primera evaluación médica') : ''}
    </div>
  `;

  document.getElementById('add-eval-btn').addEventListener('click', () => showEvalModal(null, workers));
  document.getElementById('eval-search').addEventListener('input', () => filterEvals(evals, workerMap));
  document.getElementById('eval-tipo-filter').addEventListener('change', () => filterEvals(evals, workerMap));

  bindEvalActions(evals, workers, workerMap);
}

function filterEvals(evals, workerMap) {
  const q = document.getElementById('eval-search').value.toLowerCase();
  const tipo = document.getElementById('eval-tipo-filter').value;
  const filtered = evals.filter(e => {
    const w = workerMap[e.workerId];
    const matchQ = !q || (w && (`${w.nombre} ${w.apellido} ${w.cedula}`).toLowerCase().includes(q)) || (e.tipo || '').toLowerCase().includes(q);
    const matchT = !tipo || e.tipo === tipo;
    return matchQ && matchT;
  });
  document.getElementById('eval-tbody').innerHTML = renderEvalRows(filtered, workerMap);
  bindEvalActions(filtered, [], workerMap);
}

function renderEvalRows(evals, workerMap) {
  if (!evals.length) return '';
  return evals.map(e => {
    const w = workerMap[e.workerId] || {};
    const aptClass = e.aptitud === 'Apto' ? 'apt-apto' : e.aptitud === 'No Apto' ? 'apt-no-apto' : e.aptitud ? 'apt-restric' : '';
    return `
      <tr>
        <td><span class="font-semibold">${w.apellido || ''}, ${w.nombre || '-'}</span></td>
        <td>${w.cedula || e.cedula || '-'}</td>
        <td><span class="badge ${TIPO_BADGE[e.tipo] || 'badge-gray'}">${e.tipo || '-'}</span></td>
        <td>${formatDate(e.fecha)}</td>
        <td class="text-muted">${e.medico || '-'}</td>
        <td class="text-muted text-sm">${e.diagnostico || '-'}</td>
        <td>${e.aptitud ? `<span class="badge ${aptClass}">${e.aptitud}</span>` : '-'}</td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-ghost btn-icon sm" data-action="edit-eval" data-id="${e.id}" title="Editar">✏️</button>
            <button class="btn btn-ghost btn-icon sm" data-action="del-eval" data-id="${e.id}" title="Eliminar" style="color:var(--color-danger)">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function bindEvalActions(evals, workers, workerMap) {
  document.querySelectorAll('[data-action="edit-eval"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const e = await EvaluacionDB.getAll().then(all => all.find(x => x.id === Number(btn.dataset.id)));
      if (e) {
        const ws = workers.length ? workers : await WorkerDB.getAll();
        showEvalModal(e, ws);
      }
    });
  });
  document.querySelectorAll('[data-action="del-eval"]').forEach(btn => {
    btn.addEventListener('click', () => {
      confirmDialog('¿Eliminar esta evaluación médica?', async () => {
        await EvaluacionDB.delete(Number(btn.dataset.id));
        showToast('Eliminado', 'Evaluación eliminada', 'success');
        const ws = await WorkerDB.getAll();
        const all = await EvaluacionDB.getRecent(200);
        const wm = {};
        ws.forEach(w => { wm[w.id] = w; });
        document.getElementById('eval-tbody').innerHTML = renderEvalRows(all, wm);
        bindEvalActions(all, ws, wm);
      });
    });
  });
}

async function showEvalModal(ev, workers) {
  const isEdit = !!ev;
  const wOptions = workers.map(w =>
    `<option value="${w.id}" data-cedula="${w.cedula}" ${ev?.workerId === w.id ? 'selected' : ''}>${w.apellido}, ${w.nombre} (${w.cedula})</option>`
  ).join('');

  const body = `
    <div class="form-grid">
      <div class="form-group form-full">
        <label class="form-label">Trabajador <span class="required">*</span></label>
        <select class="form-select" id="ev-worker">
          <option value="">Seleccionar trabajador...</option>
          ${wOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Tipo de Evaluación <span class="required">*</span></label>
        <select class="form-select" id="ev-tipo">
          <option value="">Seleccionar...</option>
          ${TIPOS_EVAL.map(t => `<option value="${t}" ${ev?.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Fecha <span class="required">*</span></label>
        <input class="form-input" id="ev-fecha" type="date" value="${ev?.fecha || today()}" />
      </div>
      <div class="form-group">
        <label class="form-label">Médico Evaluador</label>
        <input class="form-input" id="ev-medico" type="text" value="${ev?.medico || ''}" placeholder="Dr./Dra. ..." />
      </div>
      <div class="form-group">
        <label class="form-label">Peso (kg)</label>
        <input class="form-input" id="ev-peso" type="number" value="${ev?.peso || ''}" step="0.1" />
      </div>
      <div class="form-group">
        <label class="form-label">Talla (cm)</label>
        <input class="form-input" id="ev-talla" type="number" value="${ev?.talla || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">IMC</label>
        <input class="form-input" id="ev-imc" type="text" readonly value="${ev?.imc || ''}" placeholder="Calculado automáticamente" />
      </div>
      <div class="form-group">
        <label class="form-label">PA (mmHg)</label>
        <input class="form-input" id="ev-pa" type="text" value="${ev?.pa || ''}" placeholder="120/80" />
      </div>
      <div class="form-group">
        <label class="form-label">FC (lpm)</label>
        <input class="form-input" id="ev-fc" type="number" value="${ev?.fc || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">FR (rpm)</label>
        <input class="form-input" id="ev-fr" type="number" value="${ev?.fr || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">T° (°C)</label>
        <input class="form-input" id="ev-temp" type="number" value="${ev?.temperatura || ''}" step="0.1" />
      </div>
      <div class="form-group">
        <label class="form-label">SpO₂ (%)</label>
        <input class="form-input" id="ev-spo2" type="number" value="${ev?.spo2 || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Aptitud</label>
        <select class="form-select" id="ev-aptitud">
          <option value="">Seleccionar...</option>
          <option value="Apto" ${ev?.aptitud === 'Apto' ? 'selected' : ''}>Apto</option>
          <option value="Apto con Restricciones" ${ev?.aptitud === 'Apto con Restricciones' ? 'selected' : ''}>Apto con Restricciones</option>
          <option value="No Apto" ${ev?.aptitud === 'No Apto' ? 'selected' : ''}>No Apto</option>
        </select>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Diagnóstico / Observaciones</label>
        <textarea class="form-textarea" id="ev-diag" rows="3">${ev?.diagnostico || ''}</textarea>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Indicaciones / Plan</label>
        <textarea class="form-textarea" id="ev-plan" rows="3">${ev?.plan || ''}</textarea>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Restricciones (si aplica)</label>
        <textarea class="form-textarea" id="ev-restricciones" rows="2">${ev?.restricciones || ''}</textarea>
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-outline" onclick="closeModal('eval-modal')">Cancelar</button>
    <button class="btn btn-primary" id="save-eval-btn">${isEdit ? '💾 Actualizar' : '➕ Registrar'}</button>
  `;

  createModal('eval-modal', isEdit ? '✏️ Editar Evaluación' : '🩺 Nueva Evaluación Médica', body, footer, 'modal-lg');
  openModal('eval-modal');

  // Auto-calc IMC
  const pesoEl = document.getElementById('ev-peso');
  const tallaEl = document.getElementById('ev-talla');
  const imcEl   = document.getElementById('ev-imc');
  function calcIMC() {
    const p = parseFloat(pesoEl.value);
    const t = parseFloat(tallaEl.value) / 100;
    if (p && t) imcEl.value = (p / (t * t)).toFixed(1);
  }
  pesoEl.addEventListener('input', calcIMC);
  tallaEl.addEventListener('input', calcIMC);

  document.getElementById('save-eval-btn').addEventListener('click', async () => {
    const workerId = Number(document.getElementById('ev-worker').value);
    const tipo     = document.getElementById('ev-tipo').value;
    const fecha    = document.getElementById('ev-fecha').value;

    if (!workerId || !tipo || !fecha) {
      showToast('Campos requeridos', 'Seleccione trabajador, tipo y fecha', 'warning');
      return;
    }

    const worker = workers.find(w => w.id === workerId) || {};
    const data = {
      workerId,
      cedula:       worker.cedula || '',
      workerNombre: `${worker.apellido || ''}, ${worker.nombre || ''}`,
      tipo, fecha,
      medico:       document.getElementById('ev-medico').value.trim(),
      peso:         document.getElementById('ev-peso').value,
      talla:        document.getElementById('ev-talla').value,
      imc:          document.getElementById('ev-imc').value,
      pa:           document.getElementById('ev-pa').value,
      fc:           document.getElementById('ev-fc').value,
      fr:           document.getElementById('ev-fr').value,
      temperatura:  document.getElementById('ev-temp').value,
      spo2:         document.getElementById('ev-spo2').value,
      aptitud:      document.getElementById('ev-aptitud').value,
      diagnostico:  document.getElementById('ev-diag').value.trim(),
      plan:         document.getElementById('ev-plan').value.trim(),
      restricciones:document.getElementById('ev-restricciones').value.trim()
    };

    if (isEdit) {
      await EvaluacionDB.update(ev.id, data);
      showToast('Actualizado', 'Evaluación actualizada correctamente', 'success');
    } else {
      await EvaluacionDB.add(data);
      showToast('Registrado', 'Evaluación registrada correctamente', 'success');
    }

    closeModal('eval-modal');
    const all = await EvaluacionDB.getRecent(200);
    const wm = {};
    workers.forEach(w => { wm[w.id] = w; });
    document.getElementById('eval-tbody').innerHTML = renderEvalRows(all, wm);
    bindEvalActions(all, workers, wm);
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyState(icon, title, desc) {
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <div class="empty-title">${title}</div>
      <div class="empty-desc">${desc}</div>
    </div>
  `;
}
