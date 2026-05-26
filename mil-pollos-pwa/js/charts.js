// =============================================================================
// charts.js – Dashboard & Morbidity Charts (Chart.js)
// Mil Pollos – Salud Ocupacional
// =============================================================================

import { StatsDB, WorkerDB, EvaluacionDB, ReposooDB, ConsultaDB } from './db.js';
import { navigate } from './app.js';

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// =============================================================================
// Dashboard
// =============================================================================
export async function renderDashboard(container) {
  const stats = await StatsDB.getDashboardStats();
  const currentYear = new Date().getFullYear();
  const morbData = await StatsDB.getMorbilityByMonth(currentYear);
  const recentEvals = await EvaluacionDB.getRecent(5);
  const repososVig = await ReposooDB.getVigentes();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Dashboard</h2>
        <p class="page-subtitle">Resumen de salud ocupacional – ${new Date().toLocaleDateString('es-VE', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}</p>
      </div>
      <div class="toolbar">
        <button class="btn btn-primary" onclick="window.navigate('evaluaciones')">
          ➕ Nueva Evaluación
        </button>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="stat-grid animate-stagger">
      <div class="stat-card" onclick="navigate('trabajadores')" style="cursor:pointer">
        <div class="stat-icon">👥</div>
        <div class="stat-value">${stats.totalWorkers}</div>
        <div class="stat-label">Trabajadores Activos</div>
      </div>
      <div class="stat-card accent" onclick="navigate('evaluaciones')" style="cursor:pointer">
        <div class="stat-icon">🩺</div>
        <div class="stat-value">${stats.totalEvaluaciones}</div>
        <div class="stat-label">Evaluaciones Registradas</div>
      </div>
      <div class="stat-card danger" onclick="navigate('reposos')" style="cursor:pointer">
        <div class="stat-icon">🛏️</div>
        <div class="stat-value">${stats.repososVigentes}</div>
        <div class="stat-label">Reposos Vigentes</div>
      </div>
      <div class="stat-card info" onclick="navigate('consultas')" style="cursor:pointer">
        <div class="stat-icon">📋</div>
        <div class="stat-value">${stats.totalConsultas}</div>
        <div class="stat-label">Consultas Registradas</div>
      </div>
    </div>

    <!-- Charts -->
    <div class="charts-grid">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">📈 Morbilidad ${currentYear}</div>
            <div class="card-subtitle">Consultas registradas por mes</div>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="morbChart"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🩺 Evaluaciones Recientes</div>
        </div>
        ${recentEvals.length === 0
          ? `<div class="empty-state" style="padding:var(--space-8)">
              <div class="empty-icon">🩺</div>
              <p class="text-muted text-sm">No hay evaluaciones registradas</p>
            </div>`
          : `<div style="display:flex;flex-direction:column;gap:var(--space-3)">
              ${recentEvals.map(e => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-3);background:var(--surface-2);border-radius:var(--radius-md)">
                  <div>
                    <div class="text-sm font-semibold">${e.workerNombre || 'Trabajador'}</div>
                    <div class="text-xs text-muted">${e.tipo || ''} – ${formatDate(e.fecha)}</div>
                  </div>
                  <span class="badge badge-green">${e.tipo || 'N/A'}</span>
                </div>
              `).join('')}
            </div>`
        }
      </div>
    </div>

    <!-- Reposos vigentes alert -->
    ${repososVig.length > 0 ? `
    <div class="card mt-4" style="border-color:rgba(224,82,82,0.3);background:rgba(224,82,82,0.05)">
      <div class="card-header">
        <div class="card-title">🛏️ Reposos Médicos Vigentes (${repososVig.length})</div>
        <button class="btn btn-outline btn-sm" onclick="navigate('reposos')">Ver todos</button>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>Trabajador</th><th>Diagnóstico</th><th>Fecha Inicio</th><th>Fecha Fin</th><th>Días</th></tr></thead>
          <tbody>
            ${repososVig.map(r => `
              <tr>
                <td>${r.workerNombre || r.cedula || '-'}</td>
                <td>${r.diagnostico || '-'}</td>
                <td>${formatDate(r.fecha_inicio)}</td>
                <td>${formatDate(r.fecha_fin)}</td>
                <td><span class="badge badge-red">${calcDays(r.fecha_inicio, r.fecha_fin)} días</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}
  `;

  // Bind navigate
  window.navigate = navigate;

  // Chart
  const ctx = document.getElementById('morbChart');
  if (ctx && typeof Chart !== 'undefined') {
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: MONTHS,
        datasets: [{
          label: 'Consultas',
          data: morbData,
          backgroundColor: 'rgba(64, 145, 108, 0.7)',
          borderColor: 'rgba(82, 183, 136, 1)',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(26, 38, 30, 0.95)',
            titleColor: '#f5faf7',
            bodyColor: '#b5c4bb',
            borderColor: 'rgba(149, 213, 178, 0.2)',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(149, 213, 178, 0.06)' },
            ticks: { color: '#8fa096' }
          },
          y: {
            grid: { color: 'rgba(149, 213, 178, 0.06)' },
            ticks: { color: '#8fa096', stepSize: 1 },
            beginAtZero: true
          }
        }
      }
    });
  }
}

// =============================================================================
// Helpers
// =============================================================================
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return dateStr; }
}

export function calcDays(start, end) {
  if (!start || !end) return '-';
  const s = new Date(start), e = new Date(end);
  return Math.max(0, Math.round((e - s) / 86400000));
}

export function getBPCategory(sys, dia) {
  if (sys < 120 && dia < 80)  return { label: 'Óptima',    cls: 'bp-optimal' };
  if (sys < 130 && dia < 85)  return { label: 'Normal',    cls: 'bp-normal' };
  if (sys < 140 && dia < 90)  return { label: 'Normal Alta',cls: 'bp-elevated' };
  if (sys < 160 && dia < 100) return { label: 'HTA Grado I', cls: 'bp-hta1' };
  return { label: 'HTA Grado II', cls: 'bp-hta2' };
}
