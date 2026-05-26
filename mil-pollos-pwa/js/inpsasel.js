// =============================================================================
// inpsasel.js – INPSASEL Medical History
// =============================================================================

import { InpsaselDB, WorkerDB } from './db.js';
import { showToast, createModal, openModal, closeModal } from './app.js';
import { formatDate } from './charts.js';

export async function renderInpsasel(container) {
  const workers = await WorkerDB.getAll();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Historia Médica INPSASEL</h2>
        <p class="page-subtitle">Formato oficial de historia médica ocupacional</p>
      </div>
    </div>
    <div class="card mb-5">
      <div class="card-header">
        <div>
          <div class="card-title">Buscar Trabajador</div>
          <div class="card-subtitle">Seleccione un trabajador para ver o crear su historia INPSASEL</div>
        </div>
      </div>
      <div class="search-bar" style="max-width:500px">
        <span class="search-icon">🔍</span>
        <input type="text" id="inps-search" placeholder="Nombre, apellido o cédula..." />
      </div>
      <div id="inps-worker-list" class="mt-4" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-3)">
        ${workers.slice(0, 12).map(w => workerCard(w)).join('')}
      </div>
    </div>
  `;

  document.getElementById('inps-search').addEventListener('input', async (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = q ? workers.filter(w =>
      (`${w.nombre} ${w.apellido} ${w.cedula}`).toLowerCase().includes(q)
    ) : workers.slice(0, 12);
    document.getElementById('inps-worker-list').innerHTML = filtered.map(w => workerCard(w)).join('');
    bindWorkerCardClicks(filtered);
  });

  bindWorkerCardClicks(workers.slice(0, 12));
}

function workerCard(w) {
  return `
    <div class="worker-card" data-worker-id="${w.id}">
      <div class="worker-avatar">${((w.nombre?.[0] || '') + (w.apellido?.[0] || '')).toUpperCase()}</div>
      <div class="worker-info">
        <div class="worker-name">${w.apellido}, ${w.nombre}</div>
        <div class="worker-meta">${w.cedula} · ${w.cargo || '-'}</div>
      </div>
      <span style="font-size:20px">📂</span>
    </div>
  `;
}

function bindWorkerCardClicks(workers) {
  document.querySelectorAll('.worker-card').forEach(card => {
    card.addEventListener('click', async () => {
      const w = workers.find(x => x.id === Number(card.dataset.workerId));
      if (w) {
        const historia = await InpsaselDB.getByWorker(w.id);
        showInpsaselModal(w, historia);
      }
    });
  });
}

function showInpsaselModal(worker, historia) {
  const h = historia || {};
  const age = worker.fecha_nacimiento ? calcAge(worker.fecha_nacimiento) : '';

  const body = `
    <div style="background:var(--surface-2);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-5)">
      <div class="flex gap-4 items-center">
        <div class="worker-avatar" style="width:52px;height:52px;font-size:20px">${initials(worker)}</div>
        <div>
          <div class="font-bold text-lg">${worker.apellido}, ${worker.nombre}</div>
          <div class="text-muted">C.I. ${worker.cedula} · ${worker.sexo || '-'} · ${age ? age + ' años' : ''}</div>
          <div class="text-muted">${worker.cargo || ''} · ${worker.departamento || ''}</div>
        </div>
      </div>
    </div>

    <div class="tabs" id="inps-tabs">
      <button class="tab-btn active" data-tab="datos">Datos Personales</button>
      <button class="tab-btn" data-tab="antecedentes">Antecedentes</button>
      <button class="tab-btn" data-tab="ocupacional">Historial Ocupacional</button>
      <button class="tab-btn" data-tab="sistemas">Revisión por Sistemas</button>
      <button class="tab-btn" data-tab="examen">Examen Físico</button>
    </div>

    <!-- DATOS PERSONALES -->
    <div class="tab-panel active" id="tab-datos">
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Fecha de Historia</label>
          <input class="form-input" id="h-fecha" type="date" value="${h.fecha || today()}" /></div>
        <div class="form-group"><label class="form-label">Estado Civil</label>
          <select class="form-select" id="h-edo-civil">
            ${['Soltero/a','Casado/a','Divorciado/a','Viudo/a','Unión Libre'].map(e =>
              `<option ${h.estado_civil === e ? 'selected' : ''}>${e}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Nivel de Instrucción</label>
          <select class="form-select" id="h-instruccion">
            ${['Primaria','Secundaria','TSU','Universitario','Postgrado','Sin instrucción'].map(e =>
              `<option ${h.instruccion === e ? 'selected' : ''}>${e}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Teléfono</label>
          <input class="form-input" id="h-tel" type="tel" value="${h.telefono || worker.telefono || ''}" /></div>
        <div class="form-group form-full"><label class="form-label">Dirección de Habitación</label>
          <textarea class="form-textarea" id="h-dir" rows="2">${h.direccion || worker.direccion || ''}</textarea></div>
        <div class="form-group form-full"><label class="form-label">Motivo de Consulta</label>
          <textarea class="form-textarea" id="h-motivo" rows="2">${h.motivo || ''}</textarea></div>
      </div>
    </div>

    <!-- ANTECEDENTES -->
    <div class="tab-panel" id="tab-antecedentes">
      <div class="form-grid">
        <div class="form-group form-full">
          <label class="form-label">Antecedentes Personales Patológicos</label>
          <textarea class="form-textarea" id="h-ap-patol" rows="3" placeholder="Enfermedades previas, cirugías, hospitalizaciones...">${h.ant_personales_patol || ''}</textarea>
        </div>
        <div class="form-group form-full">
          <label class="form-label">Antecedentes Familiares</label>
          <textarea class="form-textarea" id="h-af" rows="3" placeholder="HTA, DM, cardiopatías, neoplasias en familiares directos...">${h.ant_familiares || ''}</textarea>
        </div>
        <div class="form-group form-full">
          <label class="form-label">Alergias</label>
          <textarea class="form-textarea" id="h-alergias" rows="2" placeholder="Medicamentos, alimentos, sustancias...">${h.alergias || ''}</textarea>
        </div>
        <div class="form-group form-full">
          <label class="form-label">Medicamentos actuales</label>
          <textarea class="form-textarea" id="h-medicamentos" rows="2">${h.medicamentos || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Tabaquismo</label>
          <select class="form-select" id="h-tabaco">
            ${['No','Ex-fumador','Fumador activo'].map(o => `<option ${h.tabaquismo === o ? 'selected' : ''}>${o}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Alcohol</label>
          <select class="form-select" id="h-alcohol">
            ${['No','Ocasional','Frecuente','Dependiente'].map(o => `<option ${h.alcohol === o ? 'selected' : ''}>${o}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>

    <!-- HISTORIAL OCUPACIONAL -->
    <div class="tab-panel" id="tab-ocupacional">
      <div class="form-grid">
        <div class="form-group form-full">
          <label class="form-label">Cargo actual</label>
          <input class="form-input" id="h-cargo-actual" value="${h.cargo_actual || worker.cargo || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Años en el cargo</label>
          <input class="form-input" id="h-anos-cargo" type="number" value="${h.anos_cargo || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Jornada de trabajo</label>
          <select class="form-select" id="h-jornada">
            ${['Diurna','Nocturna','Mixta','Rotativa'].map(o => `<option ${h.jornada === o ? 'selected' : ''}>${o}</option>`).join('')}
          </select>
        </div>
        <div class="form-group form-full">
          <label class="form-label">Descripción de tareas / Exposición a agentes</label>
          <textarea class="form-textarea" id="h-tareas" rows="3">${h.tareas || ''}</textarea>
        </div>
        <div class="form-group form-full">
          <label class="form-label">Accidentes de trabajo previos</label>
          <textarea class="form-textarea" id="h-accidentes" rows="2">${h.accidentes || ''}</textarea>
        </div>
        <div class="form-group form-full">
          <label class="form-label">Enfermedades ocupacionales diagnosticadas</label>
          <textarea class="form-textarea" id="h-enf-ocup" rows="2">${h.enfermedades_ocup || ''}</textarea>
        </div>
        <div class="form-group form-full">
          <label class="form-label">Empleos anteriores relevantes</label>
          <textarea class="form-textarea" id="h-empleos-prev" rows="3">${h.empleos_anteriores || ''}</textarea>
        </div>
      </div>
    </div>

    <!-- REVISIÓN POR SISTEMAS -->
    <div class="tab-panel" id="tab-sistemas">
      <div class="form-grid">
        ${['Cardiovascular','Respiratorio','Digestivo','Genitourinario','Nervioso / Neurológico','Músculo-esquelético','Dermatológico','Endocrino / Metabólico','Psicológico / Mental'].map(s => `
          <div class="form-group form-full">
            <label class="form-label">${s}</label>
            <textarea class="form-textarea" id="h-sis-${s.replace(/[^a-z]/gi,'_').toLowerCase()}" rows="2" placeholder="Sin alteraciones / hallazgos...">${h.sistemas?.[s] || ''}</textarea>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- EXAMEN FÍSICO -->
    <div class="tab-panel" id="tab-examen">
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Peso (kg)</label><input class="form-input" id="h-peso" type="number" value="${h.peso || ''}" step="0.1" /></div>
        <div class="form-group"><label class="form-label">Talla (cm)</label><input class="form-input" id="h-talla" type="number" value="${h.talla || ''}" /></div>
        <div class="form-group"><label class="form-label">IMC</label><input class="form-input" id="h-imc" type="text" value="${h.imc || ''}" readonly /></div>
        <div class="form-group"><label class="form-label">PA (mmHg)</label><input class="form-input" id="h-pa" type="text" value="${h.pa || ''}" placeholder="120/80" /></div>
        <div class="form-group"><label class="form-label">FC (lpm)</label><input class="form-input" id="h-fc" type="number" value="${h.fc || ''}" /></div>
        <div class="form-group"><label class="form-label">FR (rpm)</label><input class="form-input" id="h-fr" type="number" value="${h.fr || ''}" /></div>
        <div class="form-group"><label class="form-label">T° (°C)</label><input class="form-input" id="h-temp" type="number" value="${h.temperatura || ''}" step="0.1" /></div>
        <div class="form-group"><label class="form-label">SpO₂ (%)</label><input class="form-input" id="h-spo2" type="number" value="${h.spo2 || ''}" /></div>
        <div class="form-group form-full">
          <label class="form-label">Descripción del Examen Físico General</label>
          <textarea class="form-textarea" id="h-examen-gral" rows="3">${h.examen_general || ''}</textarea>
        </div>
        <div class="form-group form-full">
          <label class="form-label">Paraclínicos / Exámenes de Laboratorio</label>
          <textarea class="form-textarea" id="h-paraclínicos" rows="3">${h.paraclínicos || ''}</textarea>
        </div>
        <div class="form-group form-full">
          <label class="form-label">Diagnósticos y Conclusiones</label>
          <textarea class="form-textarea" id="h-conclusiones" rows="3">${h.conclusiones || ''}</textarea>
        </div>
        <div class="form-group form-full">
          <label class="form-label">Médico Evaluador</label>
          <input class="form-input" id="h-medico" type="text" value="${h.medico || ''}" />
        </div>
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-outline" onclick="closeModal('inps-modal')">Cancelar</button>
    <button class="btn btn-primary" id="save-inps-btn">💾 Guardar Historia</button>
  `;

  createModal('inps-modal', '📂 Historia Médica INPSASEL', body, footer, 'modal-xl');
  openModal('inps-modal');

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // Auto-IMC
  const p = document.getElementById('h-peso'), t = document.getElementById('h-talla');
  function autoIMC() {
    const peso = parseFloat(p.value), talla = parseFloat(t.value)/100;
    if (peso && talla) document.getElementById('h-imc').value = (peso/(talla*talla)).toFixed(1);
  }
  p.addEventListener('input', autoIMC);
  t.addEventListener('input', autoIMC);

  document.getElementById('save-inps-btn').addEventListener('click', async () => {
    const sistemas = {};
    ['Cardiovascular','Respiratorio','Digestivo','Genitourinario','Nervioso / Neurológico','Músculo-esquelético','Dermatológico','Endocrino / Metabólico','Psicológico / Mental'].forEach(s => {
      const el = document.getElementById(`h-sis-${s.replace(/[^a-z]/gi,'_').toLowerCase()}`);
      if (el) sistemas[s] = el.value.trim();
    });

    const data = {
      workerId: worker.id,
      cedula: worker.cedula,
      workerNombre: `${worker.apellido}, ${worker.nombre}`,
      fecha: document.getElementById('h-fecha').value,
      estado_civil: document.getElementById('h-edo-civil').value,
      instruccion: document.getElementById('h-instruccion').value,
      telefono: document.getElementById('h-tel').value,
      direccion: document.getElementById('h-dir').value,
      motivo: document.getElementById('h-motivo').value,
      ant_personales_patol: document.getElementById('h-ap-patol').value,
      ant_familiares: document.getElementById('h-af').value,
      alergias: document.getElementById('h-alergias').value,
      medicamentos: document.getElementById('h-medicamentos').value,
      tabaquismo: document.getElementById('h-tabaco').value,
      alcohol: document.getElementById('h-alcohol').value,
      cargo_actual: document.getElementById('h-cargo-actual').value,
      anos_cargo: document.getElementById('h-anos-cargo').value,
      jornada: document.getElementById('h-jornada').value,
      tareas: document.getElementById('h-tareas').value,
      accidentes: document.getElementById('h-accidentes').value,
      enfermedades_ocup: document.getElementById('h-enf-ocup').value,
      empleos_anteriores: document.getElementById('h-empleos-prev').value,
      sistemas,
      peso: document.getElementById('h-peso').value,
      talla: document.getElementById('h-talla').value,
      imc: document.getElementById('h-imc').value,
      pa: document.getElementById('h-pa').value,
      fc: document.getElementById('h-fc').value,
      fr: document.getElementById('h-fr').value,
      temperatura: document.getElementById('h-temp').value,
      spo2: document.getElementById('h-spo2').value,
      examen_general: document.getElementById('h-examen-gral').value,
      'paraclínicos': document.getElementById('h-paraclínicos').value,
      conclusiones: document.getElementById('h-conclusiones').value,
      medico: document.getElementById('h-medico').value
    };

    if (historia?.id) {
      await InpsaselDB.update(historia.id, data);
    } else {
      await InpsaselDB.add(data);
    }
    showToast('Guardado', 'Historia INPSASEL guardada correctamente', 'success');
    closeModal('inps-modal');
  });
}

function initials(w) { return ((w.nombre?.[0] || '') + (w.apellido?.[0] || '')).toUpperCase(); }
function calcAge(d) {
  const b = new Date(d), n = new Date();
  return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
}
function today() { return new Date().toISOString().slice(0, 10); }
