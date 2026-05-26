// =============================================================================
// morbilidad.js – Morbidity Reports (Monthly / Quarterly / Annual)
// =============================================================================

import { ConsultaDB, ReposooDB, WorkerDB } from './db.js';
import { formatDate } from './charts.js';

const MONTHS_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export async function renderMorbilidad(container) {
  const currentYear = new Date().getFullYear();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Morbilidad</h2>
        <p class="page-subtitle">Reportes y estadísticas de morbilidad ocupacional</p>
      </div>
      <div class="toolbar">
        <select class="form-select" id="morb-year" style="width:auto">
          ${[currentYear, currentYear-1, currentYear-2].map(y => `<option value="${y}">${y}</option>`).join('')}
        </select>
        <button class="btn btn-outline" onclick="window.print()">🖨️ Imprimir</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="mensual">Mensual</button>
      <button class="tab-btn" data-tab="trimestral">Trimestral</button>
      <button class="tab-btn" data-tab="anual">Anual</button>
    </div>

    <div class="tab-panel active" id="tab-mensual">
      <div class="form-group" style="max-width:200px;margin-bottom:var(--space-5)">
        <label class="form-label">Mes</label>
        <select class="form-select" id="morb-mes">
          ${MONTHS_FULL.map((m, i) => `<option value="${i+1}" ${i === new Date().getMonth() ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
      </div>
      <div id="mensual-content"><div class="empty-state"><div class="spinner"></div></div></div>
    </div>

    <div class="tab-panel" id="tab-trimestral">
      <div class="form-group" style="max-width:200px;margin-bottom:var(--space-5)">
        <label class="form-label">Trimestre</label>
        <select class="form-select" id="morb-trim">
          <option value="1">1er Trimestre (Ene-Mar)</option>
          <option value="2">2do Trimestre (Abr-Jun)</option>
          <option value="3">3er Trimestre (Jul-Sep)</option>
          <option value="4">4to Trimestre (Oct-Dic)</option>
        </select>
      </div>
      <div id="trimestral-content"></div>
    </div>

    <div class="tab-panel" id="tab-anual">
      <div id="anual-content"></div>
    </div>
  `;

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
      refreshCurrentTab();
    });
  });

  // Year change
  document.getElementById('morb-year').addEventListener('change', refreshCurrentTab);
  document.getElementById('morb-mes').addEventListener('change', loadMensual);
  document.getElementById('morb-trim').addEventListener('change', loadTrimestral);

  await loadMensual();

  async function refreshCurrentTab() {
    const active = document.querySelector('.tab-btn.active').dataset.tab;
    if (active === 'mensual') await loadMensual();
    else if (active === 'trimestral') await loadTrimestral();
    else await loadAnual();
  }

  async function getConsultas() {
    const { db } = await import('./db.js');
    return await db.consultas.toArray();
  }
  async function getReposos() { return await ReposooDB.getAll(); }
  async function getWorkers() { return await WorkerDB.getAll(); }

  async function loadMensual() {
    const year = Number(document.getElementById('morb-year').value);
    const mes  = Number(document.getElementById('morb-mes').value);
    const content = document.getElementById('mensual-content');
    content.innerHTML = '<div class="empty-state"><div class="spinner"></div><p class="text-muted mt-2">Cargando...</p></div>';

    const [consultas, reposos, workers] = await Promise.all([getConsultas(), getReposos(), getWorkers()]);
    const prefix = `${year}-${String(mes).padStart(2,'0')}`;

    const consFilter = consultas.filter(c => c.fecha?.startsWith(prefix));
    const repFilter  = reposos.filter(r => r.fecha_inicio?.startsWith(prefix));

    const wm = {};
    workers.forEach(w => { wm[w.id] = w; });

    const diagMap = {};
    consFilter.forEach(c => {
      const d = c.diagnostico || 'Sin especificar';
      diagMap[d] = (diagMap[d] || 0) + 1;
    });

    const diagRows = Object.entries(diagMap)
      .sort((a,b) => b[1]-a[1])
      .map(([diag, cnt], i) => `
        <tr>
          <td>${i+1}</td>
          <td>${diag}</td>
          <td><span class="badge badge-blue">${cnt}</span></td>
          <td>${((cnt/consFilter.length)*100 || 0).toFixed(1)}%</td>
        </tr>
      `).join('');

    const totalDiasRep = repFilter.reduce((s,r) => {
      const dias = calcDays(r.fecha_inicio, r.fecha_fin);
      return s + (dias || 0);
    }, 0);

    content.innerHTML = `
      <div class="stat-grid animate-stagger" style="grid-template-columns:repeat(4,1fr);margin-bottom:var(--space-5)">
        <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-value">${consFilter.length}</div><div class="stat-label">Consultas</div></div>
        <div class="stat-card accent"><div class="stat-icon">🛏️</div><div class="stat-value">${repFilter.length}</div><div class="stat-label">Reposos emitidos</div></div>
        <div class="stat-card danger"><div class="stat-icon">📅</div><div class="stat-value">${totalDiasRep}</div><div class="stat-label">Días de ausentismo</div></div>
        <div class="stat-card info"><div class="stat-icon">🧬</div><div class="stat-value">${Object.keys(diagMap).length}</div><div class="stat-label">Diagnósticos distintos</div></div>
      </div>

      <div class="charts-grid">
        <div class="card">
          <div class="card-header"><div class="card-title">📊 Distribución por Diagnóstico – ${MONTHS_FULL[mes-1]} ${year}</div></div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead><tr><th>#</th><th>Diagnóstico / Patología</th><th>Casos</th><th>% del Total</th></tr></thead>
              <tbody>${diagRows || '<tr><td colspan="4" class="text-center text-muted">Sin datos en este período</td></tr>'}</tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-title mb-4">🍕 Distribución</div>
          <div class="chart-container" style="height:250px"><canvas id="morb-pie-chart"></canvas></div>
        </div>
      </div>

      <div class="card mt-4">
        <div class="card-header"><div class="card-title">📋 Detalle de Consultas – ${MONTHS_FULL[mes-1]} ${year}</div></div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>Trabajador</th><th>Cargo</th><th>Fecha</th><th>Diagnóstico</th><th>Plan</th></tr></thead>
            <tbody>
              ${consFilter.length === 0 ? '<tr><td colspan="5" class="text-center text-muted">Sin consultas en este período</td></tr>' :
                consFilter.map(c => {
                  const w = wm[c.workerId] || {};
                  return `<tr>
                    <td>${w.apellido || ''}, ${w.nombre || c.cedula || '-'}</td>
                    <td class="text-muted text-sm">${w.cargo || '-'}</td>
                    <td>${formatDate(c.fecha)}</td>
                    <td class="text-sm">${c.diagnostico || '-'}</td>
                    <td class="text-sm text-muted">${truncate(c.plan || '-', 50)}</td>
                  </tr>`;
                }).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Pie chart
    if (typeof Chart !== 'undefined' && Object.keys(diagMap).length > 0) {
      const top5 = Object.entries(diagMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
      const otros = consFilter.length - top5.reduce((s,[,v])=>s+v,0);
      const labels = top5.map(([k])=>k.slice(0,25));
      const data = top5.map(([,v])=>v);
      if (otros > 0) { labels.push('Otros'); data.push(otros); }

      new Chart(document.getElementById('morb-pie-chart'), {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{ data, backgroundColor: ['#40916C','#F5A623','#52a8e0','#e05252','#9b59b6','#374840'], borderWidth: 0 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#b5c4bb', font: { size: 11 } } },
            tooltip: { backgroundColor: 'rgba(26,38,30,0.95)', titleColor: '#f5faf7', bodyColor: '#b5c4bb' }
          }
        }
      });
    }
  }

  async function loadTrimestral() {
    const year = Number(document.getElementById('morb-year').value);
    const trim = Number(document.getElementById('morb-trim').value);
    const startMes = (trim-1)*3 + 1;
    const endMes   = trim*3;
    const content  = document.getElementById('trimestral-content');
    const [consultas, workers] = await Promise.all([getConsultas(), getWorkers()]);
    const wm = {};
    workers.forEach(w => { wm[w.id] = w; });

    const monthData = [];
    for (let m = startMes; m <= endMes; m++) {
      const prefix = `${year}-${String(m).padStart(2,'0')}`;
      const cnt = consultas.filter(c => c.fecha?.startsWith(prefix)).length;
      monthData.push({ mes: MONTHS_FULL[m-1], cnt });
    }

    const total = monthData.reduce((s,x)=>s+x.cnt,0);
    content.innerHTML = `
      <div class="stat-grid animate-stagger" style="grid-template-columns:repeat(4,1fr);margin-bottom:var(--space-5)">
        ${monthData.map(d => `<div class="stat-card"><div class="stat-icon">📅</div><div class="stat-value">${d.cnt}</div><div class="stat-label">Consultas ${d.mes}</div></div>`).join('')}
        <div class="stat-card accent"><div class="stat-icon">📊</div><div class="stat-value">${total}</div><div class="stat-label">Total Trimestre</div></div>
      </div>
      <div class="card">
        <div class="card-title mb-4">📈 Consultas por mes – Trimestre ${trim} · ${year}</div>
        <div class="chart-container"><canvas id="morb-trim-chart"></canvas></div>
      </div>
    `;

    if (typeof Chart !== 'undefined') {
      new Chart(document.getElementById('morb-trim-chart'), {
        type: 'bar',
        data: {
          labels: monthData.map(d=>d.mes),
          datasets: [{ label: 'Consultas', data: monthData.map(d=>d.cnt),
            backgroundColor: 'rgba(64,145,108,0.7)', borderColor: '#52B788', borderWidth: 1, borderRadius: 8 }]
        },
        options: { responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{display:false} },
          scales:{ x:{grid:{color:'rgba(149,213,178,0.06)'},ticks:{color:'#8fa096'}}, y:{grid:{color:'rgba(149,213,178,0.06)'},ticks:{color:'#8fa096'},beginAtZero:true} }
        }
      });
    }
  }

  async function loadAnual() {
    const year = Number(document.getElementById('morb-year').value);
    const content = document.getElementById('anual-content');
    const [consultas, reposos, workers] = await Promise.all([getConsultas(), getReposos(), getWorkers()]);

    const byMonth = Array(12).fill(0);
    const yearStr = String(year);
    consultas.filter(c=>c.fecha?.startsWith(yearStr)).forEach(c=>{
      const m = parseInt(c.fecha.slice(5,7))-1;
      if (m>=0&&m<12) byMonth[m]++;
    });
    const total = byMonth.reduce((s,v)=>s+v,0);
    const repTotal = reposos.filter(r=>r.fecha_inicio?.startsWith(yearStr)).length;

    const diagMap = {};
    consultas.filter(c=>c.fecha?.startsWith(yearStr)).forEach(c=>{
      const d = c.diagnostico || 'Sin especificar';
      diagMap[d] = (diagMap[d] || 0) + 1;
    });
    const top10 = Object.entries(diagMap).sort((a,b)=>b[1]-a[1]).slice(0,10);

    content.innerHTML = `
      <div class="stat-grid animate-stagger" style="grid-template-columns:repeat(3,1fr);margin-bottom:var(--space-5)">
        <div class="stat-card accent"><div class="stat-icon">📋</div><div class="stat-value">${total}</div><div class="stat-label">Total Consultas ${year}</div></div>
        <div class="stat-card danger"><div class="stat-icon">🛏️</div><div class="stat-value">${repTotal}</div><div class="stat-label">Reposos ${year}</div></div>
        <div class="stat-card"><div class="stat-icon">📍</div><div class="stat-value">${(total/12).toFixed(1)}</div><div class="stat-label">Promedio mensual</div></div>
      </div>
      <div class="card mb-5">
        <div class="card-title mb-4">📈 Consultas mensuales – Año ${year}</div>
        <div class="chart-container"><canvas id="morb-anual-chart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title mb-4">🏆 Top 10 Diagnósticos – ${year}</div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>Rango</th><th>Diagnóstico</th><th>Casos</th><th>% del Total</th></tr></thead>
            <tbody>
              ${top10.map(([d,n],i) => `
                <tr>
                  <td><span class="badge badge-gold">#${i+1}</span></td>
                  <td>${d}</td>
                  <td><span class="badge badge-blue">${n}</span></td>
                  <td>${((n/total)*100||0).toFixed(1)}%</td>
                </tr>
              `).join('') || '<tr><td colspan="4" class="text-center text-muted">Sin datos</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;

    if (typeof Chart !== 'undefined') {
      new Chart(document.getElementById('morb-anual-chart'), {
        type: 'line',
        data: {
          labels: MONTHS_SHORT,
          datasets: [{
            label: 'Consultas', data: byMonth,
            borderColor: '#52B788', backgroundColor: 'rgba(82,183,136,0.1)',
            fill: true, tension: 0.4, pointBackgroundColor: '#52B788', pointRadius: 5
          }]
        },
        options: { responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{display:false}, tooltip:{backgroundColor:'rgba(26,38,30,0.95)',titleColor:'#f5faf7',bodyColor:'#b5c4bb'} },
          scales:{ x:{grid:{color:'rgba(149,213,178,0.06)'},ticks:{color:'#8fa096'}}, y:{grid:{color:'rgba(149,213,178,0.06)'},ticks:{color:'#8fa096'},beginAtZero:true} }
        }
      });
    }
  }

  // Load other tabs lazily
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === 'trimestral') btn.addEventListener('click', loadTrimestral, { once: true });
    if (btn.dataset.tab === 'anual')      btn.addEventListener('click', loadAnual,      { once: true });
  });
}

function calcDays(s, e) {
  if (!s || !e) return 0;
  return Math.max(0, Math.round((new Date(e) - new Date(s)) / 86400000));
}

function truncate(s, n) { return s.length > n ? s.slice(0, n) + '...' : s; }
