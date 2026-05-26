// =============================================================================
// formatos.js – Generate & Print Medical Forms
// =============================================================================

import { WorkerDB, EvaluacionDB, AptitudDB, ReposooDB, ReferenciaDB } from './db.js';
import { createModal, openModal, closeModal, showToast } from './app.js';
import { formatDate } from './charts.js';

const FORMATOS = [
  { id: 'reposo',          icon: '🛏️', label: 'Reposo Médico',               desc: 'Genera el certificado médico de reposo' },
  { id: 'referencia',      icon: '📨', label: 'Referencia a Especialista',    desc: 'Genera la hoja de referencia a especialista' },
  { id: 'aptitud',         icon: '✅', label: 'Aptitud Psicofísica',          desc: 'Genera el certificado de aptitud psicofísica' },
  { id: 'evaluacion',      icon: '🩺', label: 'Certificado Evaluación Médica',desc: 'Genera el certificado de evaluación médica' },
  { id: 'control_pa',      icon: '💗', label: 'Control Presión Arterial',     desc: 'Genera el formato de control de presión arterial' },
  { id: 'diario',          icon: '📋', label: 'Consulta Diaria',              desc: 'Genera el formato de consulta médica diaria' },
  { id: 'goniometria_fmt', icon: '📐', label: 'Goniometría',                  desc: 'Genera el formato de evaluación goniométrica' },
  { id: 'historia_inps',   icon: '📂', label: 'Historia INPSASEL',            desc: 'Genera el formato de historia médica INPSASEL' },
];

export async function renderFormatos(container) {
  const workers = await WorkerDB.getAll();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Generar Formatos</h2>
        <p class="page-subtitle">Imprima los formatos oficiales pre-llenados con los datos del trabajador</p>
      </div>
    </div>

    <!-- Worker selector -->
    <div class="card mb-6">
      <div class="card-title mb-4">👤 Seleccionar Trabajador (opcional)</div>
      <div class="flex gap-4 flex-wrap">
        <div class="form-group" style="flex:1;min-width:250px">
          <label class="form-label">Trabajador</label>
          <select class="form-select" id="fmt-worker">
            <option value="">Sin trabajador (formato en blanco)</option>
            ${workers.map(w => `<option value="${w.id}">${w.apellido}, ${w.nombre} (${w.cedula})</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="min-width:200px">
          <label class="form-label">Fecha del Formato</label>
          <input class="form-input" id="fmt-fecha" type="date" value="${today()}" />
        </div>
      </div>
    </div>

    <!-- Format cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-4)">
      ${FORMATOS.map(f => `
        <div class="card" style="cursor:pointer;transition:all 0.2s" 
             id="fmt-card-${f.id}"
             onmouseenter="this.style.borderColor='rgba(149,213,178,0.4)';this.style.transform='translateY(-3px)'"
             onmouseleave="this.style.borderColor='';this.style.transform=''">
          <div class="flex items-center gap-3 mb-3">
            <span style="font-size:36px">${f.icon}</span>
            <div>
              <div class="font-bold" style="font-size:var(--font-size-md)">${f.label}</div>
              <div class="text-xs text-muted">${f.desc}</div>
            </div>
          </div>
          <div class="flex gap-2 mt-4">
            <button class="btn btn-primary w-full" data-fmt="${f.id}">🖨️ Generar e Imprimir</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  document.querySelectorAll('[data-fmt]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const workerId = Number(document.getElementById('fmt-worker').value);
      const fecha    = document.getElementById('fmt-fecha').value;
      const worker   = workerId ? workers.find(w => w.id === workerId) : null;
      await generateFormat(btn.dataset.fmt, worker, fecha);
    });
  });
}

async function generateFormat(formatId, worker, fecha) {
  let html = '';

  const empresa = {
    nombre:   'AVÍCOLA GUACARA, C.A.',
    marca:    'MIL POLLOS',
    rif:      '',
    direccion:'Guacara, Estado Carabobo, Venezuela',
    telefono: ''
  };

  const header = `
    <div class="print-header">
      <div class="print-company">
        <h1>${empresa.marca}</h1>
        <p>${empresa.nombre}</p>
        <p>${empresa.direccion}</p>
        <p>Departamento de Salud Ocupacional</p>
      </div>
      <div style="text-align:right">
        <p style="font-size:10pt;color:#555">Fecha: ${formatDate(fecha)}</p>
      </div>
    </div>
  `;

  const workerInfo = worker ? `
    <div class="print-box">
      <h3>Datos del Trabajador</h3>
      <div class="print-row">
        <div class="print-field"><label>Apellidos y Nombres</label><div class="value">${worker.apellido}, ${worker.nombre}</div></div>
        <div class="print-field"><label>Cédula de Identidad</label><div class="value">${worker.cedula}</div></div>
      </div>
      <div class="print-row">
        <div class="print-field"><label>Cargo</label><div class="value">${worker.cargo || ''}</div></div>
        <div class="print-field"><label>Departamento</label><div class="value">${worker.departamento || ''}</div></div>
        <div class="print-field"><label>Fecha de Ingreso</label><div class="value">${formatDate(worker.fecha_ingreso) || ''}</div></div>
      </div>
    </div>
  ` : `
    <div class="print-box">
      <h3>Datos del Trabajador</h3>
      <div class="print-row">
        <div class="print-field"><label>Apellidos y Nombres</label><div class="value">&nbsp;</div></div>
        <div class="print-field"><label>Cédula de Identidad</label><div class="value">&nbsp;</div></div>
      </div>
      <div class="print-row">
        <div class="print-field"><label>Cargo</label><div class="value">&nbsp;</div></div>
        <div class="print-field"><label>Departamento</label><div class="value">&nbsp;</div></div>
        <div class="print-field"><label>Fecha de Ingreso</label><div class="value">&nbsp;</div></div>
      </div>
    </div>
  `;

  const signatures = `
    <div class="print-signatures">
      <div class="print-sig-line">
        <div class="line">&nbsp;</div>
        <p><strong>Firma del Trabajador</strong></p>
        <p>C.I.: ${worker?.cedula || '________________'}</p>
      </div>
      <div class="print-sig-line">
        <div class="line">&nbsp;</div>
        <p><strong>Médico Ocupacional</strong></p>
        <p>MSAS Nº ________________</p>
      </div>
      <div class="print-sig-line">
        <div class="line">&nbsp;</div>
        <p><strong>Sello Húmedo</strong></p>
      </div>
    </div>
  `;

  switch (formatId) {
    case 'reposo':
      html = buildReposo(header, workerInfo, worker, fecha, signatures);
      break;
    case 'referencia':
      html = buildReferencia(header, workerInfo, worker, fecha, signatures);
      break;
    case 'aptitud':
      html = buildAptitud(header, workerInfo, worker, fecha, signatures);
      break;
    case 'evaluacion':
      html = buildEvaluacion(header, workerInfo, worker, fecha, signatures);
      break;
    case 'control_pa':
      html = buildControlPA(header, workerInfo, worker, fecha, signatures);
      break;
    case 'diario':
      html = buildDiario(header, workerInfo, worker, fecha, signatures);
      break;
    case 'goniometria_fmt':
      html = buildGoniometria(header, workerInfo, worker, fecha, signatures);
      break;
    case 'historia_inps':
      html = buildHistoriaInpsasel(header, workerInfo, worker, fecha);
      break;
  }

  printHTML(html);
}

function printHTML(html) {
  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Mil Pollos – Formato Médico</title>
      <link rel="stylesheet" href="${window.location.href.replace(/[^/]*$/, '')}css/print.css" media="all">
      <style>
        body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; margin: 15mm 20mm; }
        .print-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 2px solid #1B4332; padding-bottom: 8mm; margin-bottom: 8mm; }
        .print-company h1 { color:#1B4332; font-size:16pt; margin:0 0 2mm 0; }
        .print-company p { font-size:9pt; color:#555; margin:0; }
        .print-form-title { font-size:14pt; font-weight:bold; color:#1B4332; text-align:center; text-transform:uppercase; letter-spacing:1px; margin:6mm 0; padding:3mm; border:2px solid #1B4332; border-radius:4px; }
        .print-box { border:1px solid #888; padding:4mm; margin-bottom:4mm; border-radius:2px; }
        .print-box h3 { font-size:9pt; font-weight:bold; text-transform:uppercase; color:#1B4332; margin:0 0 3mm 0; border-bottom:1px solid #ccc; padding-bottom:1mm; }
        .print-row { display:flex; gap:4mm; margin-bottom:4mm; }
        .print-field { flex:1; border-bottom:1px solid #666; padding-bottom:1mm; }
        .print-field label { display:block; font-size:8pt; color:#555; font-weight:bold; text-transform:uppercase; margin-bottom:1mm; }
        .print-field .value { font-size:10pt; min-height:14pt; }
        .print-section { background:#1B4332; color:white; padding:2mm 4mm; font-size:9pt; font-weight:bold; text-transform:uppercase; margin:5mm 0 3mm 0; border-radius:2px; }
        .print-signatures { display:flex; justify-content:space-around; margin-top:15mm; }
        .print-sig-line { width:60mm; text-align:center; }
        .print-sig-line .line { border-top:1px solid #000; margin-bottom:2mm; }
        .print-sig-line p { font-size:8pt; color:#333; margin:0; }
        .print-table { width:100%; border-collapse:collapse; font-size:9pt; }
        .print-table th { background:#1B4332; color:white; padding:2mm 3mm; text-align:left; }
        .print-table td { padding:2mm 3mm; border:1px solid #ccc; }
        .print-table tr:nth-child(even) td { background:#f9f9f9; }
        .blank-line { border-bottom:1px solid #999; min-height:14pt; margin:2mm 0; }
        .check-row { display:flex; gap:8mm; margin:2mm 0; }
        .check-item { display:flex; align-items:center; gap:2mm; font-size:9pt; }
        .check-box { width:10pt; height:10pt; border:1px solid #333; display:inline-block; }
      </style>
    </head>
    <body onload="window.print()">
      ${html}
    </body>
    </html>
  `);
  win.document.close();
}

// ---- Individual format builders ----

function buildReposo(header, workerInfo, worker, fecha, sigs) {
  return `
    ${header}
    <div class="print-form-title">Certificado de Reposo Médico</div>
    ${workerInfo}
    <div class="print-box">
      <h3>Datos del Reposo</h3>
      <div class="print-row">
        <div class="print-field"><label>Fecha de Inicio</label><div class="value blank-line">&nbsp;</div></div>
        <div class="print-field"><label>Fecha de Fin</label><div class="value blank-line">&nbsp;</div></div>
        <div class="print-field"><label>Días de Reposo</label><div class="value blank-line">&nbsp;</div></div>
      </div>
    </div>
    <div class="print-box">
      <h3>Diagnóstico (CIE-10)</h3>
      <div class="blank-line">&nbsp;</div>
      <div class="blank-line">&nbsp;</div>
    </div>
    <div class="print-box">
      <h3>Observaciones / Indicaciones</h3>
      <div class="blank-line">&nbsp;</div>
      <div class="blank-line">&nbsp;</div>
      <div class="blank-line">&nbsp;</div>
    </div>
    <div class="print-box">
      <h3>Tipo de Reposo</h3>
      <div class="check-row">
        ${['Domiciliario','Hospitalario','Post-quirúrgico'].map(t=>`<div class="check-item"><div class="check-box"></div><span>${t}</span></div>`).join('')}
      </div>
    </div>
    ${sigs}
    <p style="font-size:8pt;text-align:center;color:#888;margin-top:10mm">El incumplimiento de este reposo podría afectar su recuperación. LOPCYMAT - INPSASEL</p>
  `;
}

function buildReferencia(header, workerInfo, worker, fecha, sigs) {
  const especialidades = ['Medicina Interna', 'Traumatología', 'Cardiología', 'Neumología', 'Neurología', 'Dermatología', 'Oftalmología', 'ORL', 'Gastroenterología', 'Psiquiatría', 'Fisioterapia', 'Otra'];
  return `
    ${header}
    <div class="print-form-title">Referencia a Especialista</div>
    ${workerInfo}
    <div class="print-box">
      <h3>Datos de la Referencia</h3>
      <div class="print-row">
        <div class="print-field"><label>Especialidad Solicitada</label><div class="blank-line">&nbsp;</div></div>
        <div class="print-field"><label>Urgencia</label>
          <div class="check-row">${['Normal','Media','Alta'].map(u=>`<div class="check-item"><div class="check-box"></div><span>${u}</span></div>`).join('')}</div>
        </div>
      </div>
    </div>
    <div class="print-box">
      <h3>Motivo de Referencia / Resumen Clínico</h3>
      <div class="blank-line">&nbsp;</div><div class="blank-line">&nbsp;</div><div class="blank-line">&nbsp;</div>
    </div>
    <div class="print-box">
      <h3>Diagnóstico Presuntivo</h3>
      <div class="blank-line">&nbsp;</div><div class="blank-line">&nbsp;</div>
    </div>
    <div class="print-box">
      <h3>Exámenes Paraclínicos Adjuntos</h3>
      <div class="blank-line">&nbsp;</div><div class="blank-line">&nbsp;</div>
    </div>
    ${sigs}
  `;
}

function buildAptitud(header, workerInfo, worker, fecha, sigs) {
  return `
    ${header}
    <div class="print-form-title">Certificado de Aptitud Psicofísica</div>
    ${workerInfo}
    <div class="print-box">
      <h3>Tipo de Evaluación</h3>
      <div class="check-row">
        ${['Pre-empleo','Pre-vacacional','Post-vacacional','Periódica','Post-incapacidad','Egreso'].map(t=>`<div class="check-item"><div class="check-box"></div><span>${t}</span></div>`).join('')}
      </div>
    </div>
    <div class="print-box">
      <h3>Signos Vitales</h3>
      <div class="print-row">
        <div class="print-field"><label>Peso (kg)</label><div class="blank-line">&nbsp;</div></div>
        <div class="print-field"><label>Talla (cm)</label><div class="blank-line">&nbsp;</div></div>
        <div class="print-field"><label>IMC</label><div class="blank-line">&nbsp;</div></div>
        <div class="print-field"><label>PA (mmHg)</label><div class="blank-line">&nbsp;</div></div>
        <div class="print-field"><label>FC (lpm)</label><div class="blank-line">&nbsp;</div></div>
        <div class="print-field"><label>SpO₂ (%)</label><div class="blank-line">&nbsp;</div></div>
      </div>
    </div>
    <div class="print-box">
      <h3>Resultado de la Aptitud</h3>
      <div class="check-row">
        ${['APTO/A','APTO/A CON RESTRICCIONES','NO APTO/A'].map(r=>`<div class="check-item"><div class="check-box"></div><span style="font-weight:bold">${r}</span></div>`).join('')}
      </div>
    </div>
    <div class="print-box">
      <h3>Restricciones / Condiciones (si aplica)</h3>
      <div class="blank-line">&nbsp;</div><div class="blank-line">&nbsp;</div>
    </div>
    <div class="print-box">
      <h3>Diagnóstico / Observaciones</h3>
      <div class="blank-line">&nbsp;</div><div class="blank-line">&nbsp;</div>
    </div>
    <div class="print-row">
      <div class="print-field"><label>Válido Hasta</label><div class="blank-line">&nbsp;</div></div>
    </div>
    ${sigs}
  `;
}

function buildEvaluacion(header, workerInfo, worker, fecha, sigs) {
  return `
    ${header}
    <div class="print-form-title">Certificado de Evaluación Médica</div>
    ${workerInfo}
    <div class="print-box">
      <h3>Tipo de Evaluación</h3>
      <div class="check-row">
        ${['Pre-empleo','Pre-vacacional','Post-vacacional','Periódica'].map(t=>`<div class="check-item"><div class="check-box"></div><span>${t}</span></div>`).join('')}
      </div>
    </div>
    <div class="print-box">
      <h3>Signos Vitales y Antropometría</h3>
      <div class="print-row">
        <div class="print-field"><label>Peso (kg)</label><div class="blank-line">&nbsp;</div></div>
        <div class="print-field"><label>Talla (cm)</label><div class="blank-line">&nbsp;</div></div>
        <div class="print-field"><label>IMC</label><div class="blank-line">&nbsp;</div></div>
        <div class="print-field"><label>PA (mmHg)</label><div class="blank-line">&nbsp;</div></div>
      </div>
      <div class="print-row">
        <div class="print-field"><label>FC (lpm)</label><div class="blank-line">&nbsp;</div></div>
        <div class="print-field"><label>FR (rpm)</label><div class="blank-line">&nbsp;</div></div>
        <div class="print-field"><label>T° (°C)</label><div class="blank-line">&nbsp;</div></div>
        <div class="print-field"><label>SpO₂ (%)</label><div class="blank-line">&nbsp;</div></div>
      </div>
    </div>
    <div class="print-box">
      <h3>Diagnóstico / Hallazgos Clínicos</h3>
      <div class="blank-line">&nbsp;</div><div class="blank-line">&nbsp;</div><div class="blank-line">&nbsp;</div>
    </div>
    <div class="print-box">
      <h3>Plan / Indicaciones</h3>
      <div class="blank-line">&nbsp;</div><div class="blank-line">&nbsp;</div>
    </div>
    ${sigs}
  `;
}

function buildControlPA(header, workerInfo, worker, fecha, sigs) {
  const rows = Array(10).fill(null).map((_,i) => `
    <tr>
      <td>${i===0 ? formatDate(fecha) : ''}</td>
      <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
    </tr>
  `).join('');
  return `
    ${header}
    <div class="print-form-title">Control de Presión Arterial</div>
    ${workerInfo}
    <table class="print-table">
      <thead>
        <tr><th>Fecha / Hora</th><th>PA Sistólica</th><th>PA Diastólica</th><th>FC (lpm)</th><th>Clasificación</th><th>Observaciones</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${sigs}
  `;
}

function buildDiario(header, workerInfo, worker, fecha, sigs) {
  return `
    ${header}
    <div class="print-form-title">Consulta Médica Diaria</div>
    <div class="print-row"><div class="print-field"><label>Número de Consulta</label><div class="blank-line">&nbsp;</div></div>
    <div class="print-field"><label>Tipo</label><div class="blank-line">&nbsp;</div></div></div>
    ${workerInfo}
    <div class="print-section">S – SUBJETIVO / MOTIVO DE CONSULTA</div>
    <div class="blank-line">&nbsp;</div><div class="blank-line">&nbsp;</div>
    <div class="print-section">O – OBJETIVO / EXAMEN FÍSICO</div>
    <div class="print-row">
      <div class="print-field"><label>PA</label><div class="blank-line">&nbsp;</div></div>
      <div class="print-field"><label>FC</label><div class="blank-line">&nbsp;</div></div>
      <div class="print-field"><label>FR</label><div class="blank-line">&nbsp;</div></div>
      <div class="print-field"><label>T°</label><div class="blank-line">&nbsp;</div></div>
      <div class="print-field"><label>SpO₂</label><div class="blank-line">&nbsp;</div></div>
    </div>
    <div class="blank-line">&nbsp;</div><div class="blank-line">&nbsp;</div>
    <div class="print-section">A – APRECIACIÓN / DIAGNÓSTICO (CIE-10)</div>
    <div class="blank-line">&nbsp;</div><div class="blank-line">&nbsp;</div>
    <div class="print-section">P – PLAN / INDICACIONES</div>
    <div class="blank-line">&nbsp;</div><div class="blank-line">&nbsp;</div><div class="blank-line">&nbsp;</div>
    ${sigs}
  `;
}

function buildGoniometria(header, workerInfo, worker, fecha, sigs) {
  const segRows = [
    ['Columna Cervical', ['Flexión','Extensión','Lat. Der.','Lat. Izq.','Rot. Der.','Rot. Izq.']],
    ['Columna Lumbar',   ['Flexión','Extensión','Lat. Der.','Lat. Izq.']],
    ['Hombro',           ['Flexión','Extensión','Abducción','Aducción','Rot. Int.','Rot. Ext.']],
    ['Codo',             ['Flexión','Extensión','Pronación','Supinación']],
    ['Muñeca',           ['Flexión','Extensión','D. Radial','D. Cubital']],
    ['Cadera',           ['Flexión','Extensión','Abducción','Aducción']],
    ['Rodilla',          ['Flexión','Extensión']],
    ['Tobillo',          ['F. Plantar','F. Dorsal','Inversión','Eversión']],
  ].map(([seg, movs]) => `
    <tr>
      <td><strong>${seg}</strong></td>
      ${movs.map(m => `<td style="text-align:center"><small>${m}</small><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>`).join('')}
      ${Array(8-movs.length).fill('<td></td>').join('')}
    </tr>
  `).join('');

  return `
    ${header}
    <div class="print-form-title">Evaluación Goniométrica</div>
    ${workerInfo}
    <div class="print-row">
      <div class="print-field"><label>Miembro Dominante</label>
        <div class="check-row"><div class="check-item"><div class="check-box"></div><span>Derecho</span></div><div class="check-item"><div class="check-box"></div><span>Izquierdo</span></div></div>
      </div>
    </div>
    <table class="print-table" style="margin-top:4mm">
      <thead>
        <tr><th>Segmento</th><th>Mov. 1</th><th>Mov. 2</th><th>Mov. 3</th><th>Mov. 4</th><th>Mov. 5</th><th>Mov. 6</th><th>Izq.</th><th>Der.</th></tr>
      </thead>
      <tbody>${segRows}</tbody>
    </table>
    <div class="print-box" style="margin-top:4mm">
      <h3>Observaciones</h3>
      <div class="blank-line">&nbsp;</div><div class="blank-line">&nbsp;</div>
    </div>
    ${sigs}
  `;
}

function buildHistoriaInpsasel(header, workerInfo, worker, fecha) {
  return `
    ${header}
    <div class="print-form-title">Historia Médica Ocupacional – INPSASEL</div>
    ${workerInfo}
    <div class="print-row">
      <div class="print-field"><label>Estado Civil</label><div class="blank-line">&nbsp;</div></div>
      <div class="print-field"><label>Nivel de Instrucción</label><div class="blank-line">&nbsp;</div></div>
      <div class="print-field"><label>Teléfono</label><div class="blank-line">&nbsp;</div></div>
    </div>
    <div class="print-box"><label>Dirección:</label><div class="blank-line">&nbsp;</div></div>

    <div class="print-section">Antecedentes Personales Patológicos</div>
    <div class="blank-line">&nbsp;</div><div class="blank-line">&nbsp;</div>

    <div class="print-section">Antecedentes Familiares</div>
    <div class="blank-line">&nbsp;</div><div class="blank-line">&nbsp;</div>

    <div class="print-section">Alergias / Medicamentos</div>
    <div class="blank-line">&nbsp;</div>

    <div class="print-section">Historial Ocupacional</div>
    <div class="print-row">
      <div class="print-field"><label>Cargo Actual</label><div class="blank-line">&nbsp;</div></div>
      <div class="print-field"><label>Años en el Cargo</label><div class="blank-line">&nbsp;</div></div>
      <div class="print-field"><label>Jornada</label><div class="blank-line">&nbsp;</div></div>
    </div>
    <div class="blank-line">&nbsp;</div>

    <div class="print-section">Revisión por Sistemas</div>
    ${['Cardiovascular','Respiratorio','Digestivo','Músculo-esquelético','Neurológico','Psicológico'].map(s=>`
      <div class="print-row"><div class="print-field"><label>${s}</label><div class="blank-line">&nbsp;</div></div></div>
    `).join('')}

    <div class="print-section">Examen Físico / Signos Vitales</div>
    <div class="print-row">
      <div class="print-field"><label>Peso</label><div class="blank-line">&nbsp;</div></div>
      <div class="print-field"><label>Talla</label><div class="blank-line">&nbsp;</div></div>
      <div class="print-field"><label>IMC</label><div class="blank-line">&nbsp;</div></div>
      <div class="print-field"><label>PA</label><div class="blank-line">&nbsp;</div></div>
      <div class="print-field"><label>FC</label><div class="blank-line">&nbsp;</div></div>
    </div>

    <div class="print-section">Diagnóstico y Conclusiones</div>
    <div class="blank-line">&nbsp;</div><div class="blank-line">&nbsp;</div>

    <div class="print-signatures">
      <div class="print-sig-line"><div class="line">&nbsp;</div><p><strong>Firma del Trabajador</strong></p></div>
      <div class="print-sig-line"><div class="line">&nbsp;</div><p><strong>Médico Ocupacional</strong></p><p>MSAS Nº ___________</p></div>
      <div class="print-sig-line"><div class="line">&nbsp;</div><p><strong>Sello Húmedo</strong></p></div>
    </div>
  `;
}

function today() { return new Date().toISOString().slice(0, 10); }
