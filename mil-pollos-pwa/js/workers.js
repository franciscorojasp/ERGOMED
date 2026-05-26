// =============================================================================
// workers.js – Worker Directory Module
// =============================================================================

import { WorkerDB } from './db.js';
import { showToast, confirmDialog, createModal, openModal, closeModal, parseExcelWorkers } from './app.js';
import { formatDate } from './charts.js';
import { navigate } from './app.js';

const DEPARTAMENTOS = ['Producción', 'Procesamiento', 'Almacén', 'Administración', 'Mantenimiento', 'Calidad', 'Logística', 'Seguridad', 'Gerencia', 'Otro'];

export async function renderWorkers(container) {
  const workers = await WorkerDB.getAll();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Directorio de Trabajadores</h2>
        <p class="page-subtitle">${workers.length} trabajadores registrados</p>
      </div>
      <div class="toolbar">
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input type="text" id="worker-search" placeholder="Buscar por nombre, cédula, cargo..." />
        </div>
        <button class="btn btn-outline" id="import-excel-btn">📥 Importar Excel</button>
        <input type="file" id="excel-file-input" accept=".xlsx,.xls" class="hidden" />
        <button class="btn btn-primary" id="add-worker-btn">➕ Nuevo Trabajador</button>
      </div>
    </div>

    <div class="card">
      <div class="table-wrapper">
        <table class="data-table" id="workers-table">
          <thead>
            <tr>
              <th>Cédula</th>
              <th>Nombre Completo</th>
              <th>Cargo</th>
              <th>Departamento</th>
              <th>Fecha Ingreso</th>
              <th>Estatus</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="workers-tbody">
            ${renderWorkerRows(workers)}
          </tbody>
        </table>
      </div>
      ${workers.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">👥</div>
          <div class="empty-title">Sin trabajadores registrados</div>
          <div class="empty-desc">Agregue trabajadores manualmente o importe desde Excel</div>
          <button class="btn btn-primary" id="add-first-worker">➕ Agregar Trabajador</button>
        </div>
      ` : ''}
    </div>
  `;

  // Event listeners
  document.getElementById('add-worker-btn')?.addEventListener('click', () => showWorkerModal());
  document.getElementById('add-first-worker')?.addEventListener('click', () => showWorkerModal());

  document.getElementById('worker-search').addEventListener('input', async (e) => {
    const q = e.target.value.trim();
    const results = q ? await WorkerDB.search(q) : await WorkerDB.getAll();
    document.getElementById('workers-tbody').innerHTML = renderWorkerRows(results);
    bindWorkerRowActions();
  });

  document.getElementById('import-excel-btn').addEventListener('click', () => {
    document.getElementById('excel-file-input').click();
  });

  document.getElementById('excel-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const rows = await parseExcelWorkers(file);
      let imported = 0;
      for (const row of rows) {
        const cedula = String(row['Cedula'] || row['cédula'] || row['cedula'] || row['CI'] || '').trim();
        if (!cedula) continue;
        const existing = await WorkerDB.getByCedula(cedula);
        if (!existing) {
          await WorkerDB.add({
            cedula,
            nombre:         String(row['Nombre'] || row['nombre'] || '').trim(),
            apellido:       String(row['Apellido'] || row['apellido'] || '').trim(),
            cargo:          String(row['Cargo'] || row['cargo'] || '').trim(),
            departamento:   String(row['Departamento'] || row['departamento'] || '').trim(),
            fecha_ingreso:  String(row['Fecha Ingreso'] || row['fecha_ingreso'] || '').trim(),
            sexo:           String(row['Sexo'] || row['sexo'] || '').trim(),
            fecha_nacimiento: String(row['Fecha Nacimiento'] || '').trim(),
            telefono:       String(row['Telefono'] || row['teléfono'] || '').trim(),
            status:         'Activo'
          });
          imported++;
        }
      }
      showToast('Importación completada', `${imported} trabajadores importados`, 'success');
      const all = await WorkerDB.getAll();
      document.getElementById('workers-tbody').innerHTML = renderWorkerRows(all);
      bindWorkerRowActions();
    } catch (err) {
      showToast('Error al importar', err.message, 'error');
    }
    e.target.value = '';
  });

  bindWorkerRowActions();
}

function renderWorkerRows(workers) {
  if (!workers || workers.length === 0) return '';
  return workers.map(w => `
    <tr>
      <td><span class="font-semibold">${w.cedula}</span></td>
      <td>
        <div class="flex items-center gap-2">
          <div class="worker-avatar" style="width:32px;height:32px;font-size:12px">${initials(w)}</div>
          <div>
            <div class="font-semibold">${w.apellido || ''}, ${w.nombre || ''}</div>
            <div class="text-xs text-muted">${w.sexo || ''} ${w.fecha_nacimiento ? '· ' + formatDate(w.fecha_nacimiento) : ''}</div>
          </div>
        </div>
      </td>
      <td>${w.cargo || '-'}</td>
      <td>${w.departamento || '-'}</td>
      <td>${formatDate(w.fecha_ingreso) || '-'}</td>
      <td><span class="badge ${w.status === 'Activo' ? 'badge-green' : 'badge-gray'}">${w.status || 'Activo'}</span></td>
      <td>
        <div class="flex gap-1">
          <button class="btn btn-ghost btn-icon sm" title="Ver historial" data-action="view" data-id="${w.id}">👁️</button>
          <button class="btn btn-ghost btn-icon sm" title="Editar" data-action="edit" data-id="${w.id}">✏️</button>
          <button class="btn btn-ghost btn-icon sm" title="Eliminar" data-action="delete" data-id="${w.id}" style="color:var(--color-danger)">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function bindWorkerRowActions() {
  document.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const w = await WorkerDB.getById('workers', Number(btn.dataset.id));
      if (w) showWorkerModal(w);
    });
  });

  document.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      confirmDialog('¿Eliminar este trabajador y todos sus registros?', async () => {
        await WorkerDB.delete(Number(btn.dataset.id));
        showToast('Eliminado', 'Trabajador eliminado correctamente', 'success');
        const all = await WorkerDB.getAll();
        document.getElementById('workers-tbody').innerHTML = renderWorkerRows(all);
        bindWorkerRowActions();
      });
    });
  });

  document.querySelectorAll('[data-action="view"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const w = await WorkerDB.getById('workers', Number(btn.dataset.id));
      showWorkerProfile(w);
    });
  });
}

function showWorkerModal(worker = null) {
  const isEdit = !!worker;
  const body = `
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Cédula <span class="required">*</span></label>
        <input class="form-input" id="w-cedula" type="text" value="${worker?.cedula || ''}" placeholder="V-12345678" />
      </div>
      <div class="form-group">
        <label class="form-label">Nombre <span class="required">*</span></label>
        <input class="form-input" id="w-nombre" type="text" value="${worker?.nombre || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Apellido <span class="required">*</span></label>
        <input class="form-input" id="w-apellido" type="text" value="${worker?.apellido || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Fecha de Nacimiento</label>
        <input class="form-input" id="w-fnac" type="date" value="${worker?.fecha_nacimiento || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Sexo</label>
        <select class="form-select" id="w-sexo">
          <option value="">Seleccionar...</option>
          <option value="Masculino" ${worker?.sexo === 'Masculino' ? 'selected' : ''}>Masculino</option>
          <option value="Femenino"  ${worker?.sexo === 'Femenino'  ? 'selected' : ''}>Femenino</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Cargo</label>
        <input class="form-input" id="w-cargo" type="text" value="${worker?.cargo || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Departamento</label>
        <select class="form-select" id="w-depto">
          <option value="">Seleccionar...</option>
          ${DEPARTAMENTOS.map(d => `<option value="${d}" ${worker?.departamento === d ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Fecha de Ingreso</label>
        <input class="form-input" id="w-fingreso" type="date" value="${worker?.fecha_ingreso || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Teléfono</label>
        <input class="form-input" id="w-telefono" type="tel" value="${worker?.telefono || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Estatus</label>
        <select class="form-select" id="w-status">
          <option value="Activo"   ${(!worker || worker.status === 'Activo')   ? 'selected' : ''}>Activo</option>
          <option value="Inactivo" ${worker?.status === 'Inactivo'             ? 'selected' : ''}>Inactivo</option>
          <option value="Egresado" ${worker?.status === 'Egresado'             ? 'selected' : ''}>Egresado</option>
        </select>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Dirección</label>
        <textarea class="form-textarea" id="w-direccion" rows="2">${worker?.direccion || ''}</textarea>
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-outline" onclick="closeModal('worker-modal')">Cancelar</button>
    <button class="btn btn-primary" id="save-worker-btn">${isEdit ? '💾 Guardar Cambios' : '➕ Agregar'}</button>
  `;

  createModal('worker-modal', isEdit ? '✏️ Editar Trabajador' : '➕ Nuevo Trabajador', body, footer);
  openModal('worker-modal');

  document.getElementById('save-worker-btn').addEventListener('click', async () => {
    const cedula  = document.getElementById('w-cedula').value.trim();
    const nombre  = document.getElementById('w-nombre').value.trim();
    const apellido= document.getElementById('w-apellido').value.trim();

    if (!cedula || !nombre || !apellido) {
      showToast('Campos requeridos', 'Complete los campos obligatorios', 'warning');
      return;
    }

    const data = {
      cedula,
      nombre,
      apellido,
      fecha_nacimiento: document.getElementById('w-fnac').value,
      sexo:             document.getElementById('w-sexo').value,
      cargo:            document.getElementById('w-cargo').value.trim(),
      departamento:     document.getElementById('w-depto').value,
      fecha_ingreso:    document.getElementById('w-fingreso').value,
      telefono:         document.getElementById('w-telefono').value.trim(),
      status:           document.getElementById('w-status').value,
      direccion:        document.getElementById('w-direccion').value.trim()
    };

    if (isEdit) {
      await WorkerDB.update(worker.id, data);
      showToast('Actualizado', 'Datos del trabajador actualizados', 'success');
    } else {
      await WorkerDB.add(data);
      showToast('Registrado', 'Trabajador agregado correctamente', 'success');
    }

    closeModal('worker-modal');
    const all = await WorkerDB.getAll();
    document.getElementById('workers-tbody').innerHTML = renderWorkerRows(all);
    bindWorkerRowActions();
    // Update subtitle
    document.querySelector('.page-subtitle').textContent = `${all.length} trabajadores registrados`;
  });
}

function showWorkerProfile(worker) {
  const age = worker.fecha_nacimiento ? calcAge(worker.fecha_nacimiento) : '-';
  const body = `
    <div class="flex gap-4 items-start mb-6">
      <div class="worker-avatar" style="width:64px;height:64px;font-size:24px;flex-shrink:0">${initials(worker)}</div>
      <div>
        <h3 style="font-size:var(--font-size-xl);font-weight:700">${worker.apellido}, ${worker.nombre}</h3>
        <p class="text-muted">C.I.: ${worker.cedula}</p>
        <p class="text-muted">Edad: ${age} años · ${worker.sexo || ''}</p>
        <span class="badge ${worker.status === 'Activo' ? 'badge-green' : 'badge-gray'} mt-2">${worker.status}</span>
      </div>
    </div>
    <div class="separator"></div>
    <div class="form-grid">
      ${profileField('Cargo', worker.cargo)}
      ${profileField('Departamento', worker.departamento)}
      ${profileField('Fecha de Ingreso', formatDate(worker.fecha_ingreso))}
      ${profileField('Teléfono', worker.telefono)}
    </div>
    ${worker.direccion ? `<div class="mt-4"><strong class="text-muted text-sm">Dirección:</strong><p>${worker.direccion}</p></div>` : ''}
    <div class="separator"></div>
    <div class="flex gap-2 flex-wrap">
      <button class="btn btn-outline btn-sm" onclick="closeModal('worker-profile');navigate('evaluaciones')">🩺 Evaluaciones</button>
      <button class="btn btn-outline btn-sm" onclick="closeModal('worker-profile');navigate('consultas')">📋 Consultas</button>
      <button class="btn btn-outline btn-sm" onclick="closeModal('worker-profile');navigate('reposos')">🛏️ Reposos</button>
      <button class="btn btn-outline btn-sm" onclick="closeModal('worker-profile');navigate('presion')">💗 Presión Arterial</button>
    </div>
  `;

  createModal('worker-profile', '👤 Perfil del Trabajador', body, '', 'modal-lg');
  openModal('worker-profile');
  window.navigate = navigate;
}

function profileField(label, value) {
  return `
    <div class="form-group">
      <label class="form-label">${label}</label>
      <p style="color:var(--text-primary);font-size:var(--font-size-base)">${value || '-'}</p>
    </div>
  `;
}

function initials(w) {
  return ((w.nombre?.[0] || '') + (w.apellido?.[0] || '')).toUpperCase() || '?';
}

function calcAge(dob) {
  const birth = new Date(dob);
  const now = new Date();
  return now.getFullYear() - birth.getFullYear() - (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
}
