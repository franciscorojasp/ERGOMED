// =============================================================================
// consultas.js – Medical Consultations / Progress Notes
// =============================================================================

import { ConsultaDB, WorkerDB } from './db.js';
import { showToast, confirmDialog, createModal, openModal, closeModal } from './app.js';
import { formatDate } from './charts.js';

const TIPOS_CONSULTA = ['Consulta General', 'Urgencia', 'Control', 'Primera Vez', 'Seguimiento'];

export async function renderConsultas(container) {
  const [workers, consultas] = await Promise.all([
    WorkerDB.getAll(),
    ConsultaDB.getAllConsultas ? ConsultaDB.getAllConsultas() : getAllConsultas()
  ]);

  const workerMap = {};
  workers.forEach(w => { workerMap[w.id] = w; });

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Consultas Médicas</h2>
        <p class="page-subtitle">${consultas.length} consultas registradas</p>
      </div>
      <div class="toolbar">
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input type="text" id="con-search" placeholder="Buscar trabajador..." />
        </div>
        <button class="btn btn-primary" id="add-con-btn">➕ Nueva Consulta</button>
      </div>
    </div>

    <div class="card">
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Trabajador</th>
              <th>Tipo</th>
              <th>Fecha</th>
              <th>Motivo</th>
              <th>Diagnóstico</th>
              <th>Médico</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="con-tbody">
            ${renderConsultaRows(consultas, workerMap)}
          </tbody>
        </table>
      </div>
      ${consultas.length === 0 ? emptyState('📋', 'Sin consultas registradas', 'Registre la primera consulta médica') : ''}
    </div>
  `;

  document.getElementById('add-con-btn').addEventListener('click', () => showConsultaModal(null, workers));

  document.getElementById('con-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = q ? consultas.filter(c => {
      const w = workerMap[c.workerId] || {};
      return (`${w.nombre} ${w.apellido} ${w.cedula}`).toLowerCase().includes(q);
    }) : consultas;
    document.getElementById('con-tbody').innerHTML = renderConsultaRows(filtered, workerMap);
    bindConsultaActions(filtered, workers, workerMap);
  });

  bindConsultaActions(consultas, workers, workerMap);
}

async function getAllConsultas() {
  const { db } = await import('./db.js');
  return await db.consultas.orderBy('fecha').reverse().toArray();
}

function renderConsultaRows(consultas, workerMap) {
  if (!consultas.length) return '';
  return consultas.map(c => {
    const w = workerMap[c.workerId] || {};
    return `
      <tr>
        <td><span class="badge badge-blue">#${c.numero_consulta || '-'}</span></td>
        <td>
          <div class="font-semibold">${w.apellido || ''}, ${w.nombre || '-'}</div>
          <div class="text-xs text-muted">${w.cedula || ''}</div>
        </td>
        <td><span class="badge badge-gray">${c.tipo || 'General'}</span></td>
        <td>${formatDate(c.fecha)}</td>
        <td class="text-sm">${truncate(c.motivo || '-', 40)}</td>
        <td class="text-sm">${truncate(c.diagnostico || '-', 40)}</td>
        <td class="text-muted text-sm">${c.medico || '-'}</td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-ghost btn-icon sm" data-action="view-con" data-id="${c.id}" title="Ver detalle">👁️</button>
            <button class="btn btn-ghost btn-icon sm" data-action="edit-con" data-id="${c.id}" title="Editar">✏️</button>
            <button class="btn btn-ghost btn-icon sm" data-action="del-con"  data-id="${c.id}" title="Eliminar" style="color:var(--color-danger)">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function bindConsultaActions(consultas, workers, workerMap) {
  document.querySelectorAll('[data-action="view-con"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = consultas.find(x => x.id === Number(btn.dataset.id));
      if (c) showConsultaDetail(c, workerMap[c.workerId] || {});
    });
  });
  document.querySelectorAll('[data-action="edit-con"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = consultas.find(x => x.id === Number(btn.dataset.id));
      if (c) showConsultaModal(c, workers);
    });
  });
  document.querySelectorAll('[data-action="del-con"]').forEach(btn => {
    btn.addEventListener('click', () => {
      confirmDialog('¿Eliminar esta consulta médica?', async () => {
        await ConsultaDB.delete(Number(btn.dataset.id));
        showToast('Eliminado', 'Consulta eliminada', 'success');
        const all = await getAllConsultas();
        const wm = {};
        workers.forEach(w => { wm[w.id] = w; });
        document.getElementById('con-tbody').innerHTML = renderConsultaRows(all, wm);
        bindConsultaActions(all, workers, wm);
      });
    });
  });
}

async function showConsultaModal(con, workers) {
  const isEdit = !!con;
  const wOptions = workers.map(w =>
    `<option value="${w.id}" ${con?.workerId === w.id ? 'selected' : ''}>${w.apellido}, ${w.nombre} (${w.cedula})</option>`
  ).join('');

  const body = `
    <div class="form-grid">
      <div class="form-group form-full">
        <label class="form-label">Trabajador <span class="required">*</span></label>
        <select class="form-select" id="con-worker">
          <option value="">Seleccionar trabajador...</option>
          ${wOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Tipo de Consulta</label>
        <select class="form-select" id="con-tipo">
          ${TIPOS_CONSULTA.map(t => `<option value="${t}" ${con?.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Fecha <span class="required">*</span></label>
        <input class="form-input" id="con-fecha" type="date" value="${con?.fecha || today()}" />
      </div>
      <div class="form-group form-full">
        <label class="form-label">Motivo de Consulta / Subjetivo (S)</label>
        <textarea class="form-textarea" id="con-motivo" rows="2" placeholder="¿Qué le trae a consulta?">${con?.motivo || ''}</textarea>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Examen Físico / Objetivo (O)</label>
        <textarea class="form-textarea" id="con-objetivo" rows="3" placeholder="Hallazgos al examen físico, signos vitales...">${con?.objetivo || ''}</textarea>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Diagnóstico / Apreciación (A) <span class="required">*</span></label>
        <textarea class="form-textarea" id="con-diag" rows="2" placeholder="Diagnóstico presuntivo o definitivo con CIE-10...">${con?.diagnostico || ''}</textarea>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Plan / Indicaciones (P)</label>
        <textarea class="form-textarea" id="con-plan" rows="3" placeholder="Tratamiento, indicaciones, medicamentos, paraclínicos...">${con?.plan || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Médico</label>
        <input class="form-input" id="con-medico" type="text" value="${con?.medico || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Próxima cita</label>
        <input class="form-input" id="con-proxima" type="date" value="${con?.proxima_cita || ''}" />
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-outline" onclick="closeModal('con-modal')">Cancelar</button>
    <button class="btn btn-primary" id="save-con-btn">${isEdit ? '💾 Actualizar' : '➕ Registrar'}</button>
  `;

  createModal('con-modal', isEdit ? '✏️ Editar Consulta' : '📋 Nueva Consulta Médica', body, footer, 'modal-lg');
  openModal('con-modal');

  document.getElementById('save-con-btn').addEventListener('click', async () => {
    const workerId   = Number(document.getElementById('con-worker').value);
    const fecha      = document.getElementById('con-fecha').value;
    const diagnostico= document.getElementById('con-diag').value.trim();

    if (!workerId || !fecha || !diagnostico) {
      showToast('Campos requeridos', 'Complete trabajador, fecha y diagnóstico', 'warning');
      return;
    }

    const worker = workers.find(w => w.id === workerId) || {};
    const numero = isEdit ? con.numero_consulta : await ConsultaDB.getNextNumber(workerId);
    const data = {
      workerId,
      cedula:         worker.cedula || '',
      workerNombre:   `${worker.apellido}, ${worker.nombre}`,
      tipo:           document.getElementById('con-tipo').value,
      fecha, numero_consulta: numero,
      motivo:         document.getElementById('con-motivo').value.trim(),
      objetivo:       document.getElementById('con-objetivo').value.trim(),
      diagnostico,
      plan:           document.getElementById('con-plan').value.trim(),
      medico:         document.getElementById('con-medico').value.trim(),
      proxima_cita:   document.getElementById('con-proxima').value
    };

    if (isEdit) {
      await ConsultaDB.update(con.id, data);
      showToast('Actualizado', 'Consulta actualizada', 'success');
    } else {
      await ConsultaDB.add(data);
      showToast('Registrado', `Consulta #${numero} registrada`, 'success');
    }

    closeModal('con-modal');
    const all = await getAllConsultas();
    const wm = {};
    workers.forEach(w => { wm[w.id] = w; });
    document.getElementById('con-tbody').innerHTML = renderConsultaRows(all, wm);
    bindConsultaActions(all, workers, wm);
  });
}

function showConsultaDetail(c, worker) {
  const body = `
    <div class="flex gap-4 items-start mb-4">
      <div>
        <h3 style="font-size:var(--font-size-xl);font-weight:700">${worker.apellido || ''}, ${worker.nombre || '-'}</h3>
        <p class="text-muted">C.I.: ${worker.cedula || '-'} · ${formatDate(c.fecha)}</p>
        <p class="text-muted">Consulta #${c.numero_consulta || '-'} · ${c.tipo || 'General'}</p>
      </div>
    </div>
    <div class="separator"></div>
    ${soapSection('S – Subjetivo / Motivo', c.motivo)}
    ${soapSection('O – Objetivo / Examen Físico', c.objetivo)}
    ${soapSection('A – Apreciación / Diagnóstico', c.diagnostico)}
    ${soapSection('P – Plan / Indicaciones', c.plan)}
    ${c.proxima_cita ? `<div class="mt-4"><span class="badge badge-gold">📅 Próxima cita: ${formatDate(c.proxima_cita)}</span></div>` : ''}
    ${c.medico ? `<div class="mt-2 text-muted text-sm">Dr./Dra. ${c.medico}</div>` : ''}
  `;

  createModal('con-detail', '📋 Detalle de Consulta', body, '', 'modal-lg');
  openModal('con-detail');
}

function soapSection(title, content) {
  return `
    <div class="mt-4">
      <div class="font-semibold text-sm" style="color:var(--brand-green-400);margin-bottom:4px">${title}</div>
      <p style="color:var(--text-secondary);white-space:pre-wrap">${content || '<span class="text-muted">No registrado</span>'}</p>
    </div>
  `;
}

function truncate(str, n) { return str.length > n ? str.slice(0, n) + '...' : str; }
function today() { return new Date().toISOString().slice(0, 10); }
function emptyState(icon, title, desc) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-title">${title}</div><div class="empty-desc">${desc}</div></div>`;
}
