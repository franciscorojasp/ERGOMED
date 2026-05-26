// =============================================================================
// app.js – Main Application: Router, Auth, Navigation
// Mil Pollos – Salud Ocupacional
// =============================================================================

import { UserDB, StatsDB, SettingsDB, WorkerDB } from './db.js';
import { renderDashboard } from './charts.js';
import { renderWorkers } from './workers.js';
import { renderEvaluaciones } from './evaluaciones.js';
import { renderAptitud } from './aptitud.js';
import { renderPresion } from './presion.js';
import { renderReposos } from './reposos.js';
import { renderReferencias } from './referencias.js';
import { renderGoniometria } from './goniometria.js';
import { renderInpsasel } from './inpsasel.js';
import { renderConsultas } from './consultas.js';
import { renderMorbilidad } from './morbilidad.js';
import { renderFormatos } from './formatos.js';

// =============================================================================
// Global State
// =============================================================================
export const AppState = {
  currentUser: null,
  currentRoute: 'dashboard',
  sidebarCollapsed: false
};

// =============================================================================
// Auth helpers
// =============================================================================
const ROLE_LABELS = {
  medico:         { label: 'Médico',        color: '#52B788' },
  enfermera:      { label: 'Enfermera',     color: '#52a8e0' },
  administracion: { label: 'Administración',color: '#F5A623' },
  admin:          { label: 'Administrador', color: '#e05252' }
};

function hashPassword(pwd) {
  // Simple hash for local storage (not for production server use)
  let hash = 0;
  for (let i = 0; i < pwd.length; i++) {
    hash = ((hash << 5) - hash) + pwd.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

async function ensureDefaultAdmin() {
  const count = await UserDB.count();
  if (count === 0) {
    await UserDB.add({
      username: 'admin',
      password: hashPassword('admin123'),
      nombre: 'Administrador',
      apellido: 'Sistema',
      role: 'admin',
      email: ''
    });
  }
}

async function login(username, password) {
  const user = await UserDB.getByUsername(username.trim().toLowerCase());
  if (!user) return { success: false, message: 'Usuario no encontrado' };
  if (user.password !== hashPassword(password)) return { success: false, message: 'Contraseña incorrecta' };
  AppState.currentUser = user;
  sessionStorage.setItem('milpollos_user', JSON.stringify({ id: user.id, username: user.username, role: user.role, nombre: user.nombre }));
  return { success: true, user };
}

function logout() {
  AppState.currentUser = null;
  sessionStorage.removeItem('milpollos_user');
  showLogin();
}

function restoreSession() {
  const saved = sessionStorage.getItem('milpollos_user');
  if (saved) {
    AppState.currentUser = JSON.parse(saved);
    return true;
  }
  return false;
}

// =============================================================================
// Route definitions
// =============================================================================
const ROUTES = [
  { id: 'dashboard',      label: 'Dashboard',          icon: '📊', section: 'principal',    render: renderDashboard },
  { id: 'trabajadores',   label: 'Trabajadores',       icon: '👥', section: 'principal',    render: renderWorkers },
  { id: 'evaluaciones',   label: 'Evaluaciones Médicas',icon: '🩺', section: 'clinico',      render: renderEvaluaciones },
  { id: 'aptitud',        label: 'Aptitud Psicofísica', icon: '✅', section: 'clinico',      render: renderAptitud },
  { id: 'consultas',      label: 'Consultas Médicas',  icon: '📋', section: 'clinico',      render: renderConsultas },
  { id: 'presion',        label: 'Presión Arterial',   icon: '💗', section: 'clinico',      render: renderPresion },
  { id: 'reposos',        label: 'Reposos',            icon: '🛏️', section: 'clinico',      render: renderReposos },
  { id: 'referencias',    label: 'Referencias',        icon: '📨', section: 'clinico',      render: renderReferencias },
  { id: 'goniometria',    label: 'Goniometrías',       icon: '📐', section: 'clinico',      render: renderGoniometria },
  { id: 'inpsasel',       label: 'Historia INPSASEL',  icon: '📂', section: 'clinico',      render: renderInpsasel },
  { id: 'morbilidad',     label: 'Morbilidad',         icon: '📈', section: 'estadisticas', render: renderMorbilidad },
  { id: 'formatos',       label: 'Generar Formatos',   icon: '🖨️', section: 'herramientas', render: renderFormatos },
];

const SECTIONS = {
  principal:    'Principal',
  clinico:      'Módulos Clínicos',
  estadisticas: 'Estadísticas',
  herramientas: 'Herramientas'
};

// =============================================================================
// Navigation
// =============================================================================
export function navigate(routeId) {
  const route = ROUTES.find(r => r.id === routeId);
  if (!route) return;

  AppState.currentRoute = routeId;

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.route === routeId);
  });

  // Update header
  const headerCenter = document.querySelector('.header-center h2');
  const headerSub    = document.querySelector('.header-center p');
  if (headerCenter) headerCenter.textContent = route.label;
  if (headerSub)    headerSub.textContent = route.icon + ' ' + SECTIONS[route.section];

  // Render content
  const content = document.getElementById('content');
  content.innerHTML = '';
  content.classList.remove('animate-fade-in-up');
  void content.offsetWidth; // force reflow
  content.classList.add('animate-fade-in-up');

  route.render(content);

  // Close mobile sidebar
  closeMobileSidebar();
}

// =============================================================================
// Sidebar
// =============================================================================
function buildSidebar() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';

  const sections = {};
  ROUTES.forEach(route => {
    if (!sections[route.section]) sections[route.section] = [];
    sections[route.section].push(route);
  });

  Object.entries(sections).forEach(([sectionId, routes]) => {
    const label = document.createElement('div');
    label.className = 'nav-section-label';
    label.textContent = SECTIONS[sectionId];
    nav.appendChild(label);

    routes.forEach(route => {
      const item = document.createElement('div');
      item.className = 'nav-item' + (route.id === AppState.currentRoute ? ' active' : '');
      item.dataset.route = route.id;
      item.title = route.label;
      item.innerHTML = `
        <span class="nav-icon">${route.icon}</span>
        <span class="nav-label">${route.label}</span>
      `;
      item.addEventListener('click', () => navigate(route.id));
      nav.appendChild(item);
    });
  });
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  AppState.sidebarCollapsed = !AppState.sidebarCollapsed;
  sidebar.classList.toggle('collapsed', AppState.sidebarCollapsed);
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('active');
  }
}

function openMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  sidebar.classList.add('mobile-open');
  if (overlay) overlay.classList.add('active');
}

// =============================================================================
// User Menu
// =============================================================================
function buildUserInfo() {
  const user = AppState.currentUser;
  if (!user) return;

  const avatar = document.querySelector('.user-avatar');
  if (avatar) {
    const initials = ((user.nombre || 'U')[0] + (user.apellido || 'S')[0]).toUpperCase();
    avatar.textContent = initials;
    avatar.title = `${user.nombre || user.username} (${ROLE_LABELS[user.role]?.label || user.role})`;
  }
}

// =============================================================================
// Login Screen
// =============================================================================
function showLogin() {
  const loginScreen = document.getElementById('login-screen');
  const app = document.getElementById('app');
  loginScreen.classList.remove('hidden');
  app.classList.add('hidden');
}

function showApp() {
  const loginScreen = document.getElementById('login-screen');
  const app = document.getElementById('app');
  loginScreen.classList.add('hidden');
  app.classList.remove('hidden');
  buildSidebar();
  buildUserInfo();
  navigate('dashboard');
}

// =============================================================================
// Toast Notifications
// =============================================================================
export function showToast(title, message, type = 'info', duration = 4000) {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const container = document.getElementById('toast-container');

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-msg">${message}</div>` : ''}
    </div>
    <span class="toast-close" onclick="this.parentElement.remove()">✕</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'none';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// =============================================================================
// Modal helpers
// =============================================================================
export function openModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

export function closeModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
}

export function createModal(id, title, bodyHTML, footerHTML, size = '') {
  // Remove existing
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = id;
  overlay.innerHTML = `
    <div class="modal ${size}">
      <div class="modal-header">
        <span class="modal-title">${title}</span>
        <button class="btn btn-ghost btn-icon" onclick="window.closeModal('${id}')">✕</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
    </div>
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(id); });
  document.body.appendChild(overlay);
  return overlay;
}

// Expose globally for onclick handlers
window.closeModal = closeModal;
window.openModal = openModal;

// =============================================================================
// Confirm Dialog
// =============================================================================
export function confirmDialog(message, onConfirm) {
  const id = 'confirm-dialog';
  const body = `<p style="color:var(--text-secondary);font-size:var(--font-size-md)">${message}</p>`;
  const footer = `
    <button class="btn btn-outline" onclick="closeModal('${id}')">Cancelar</button>
    <button class="btn btn-danger" id="confirm-yes-btn">Confirmar</button>
  `;
  createModal(id, '⚠️ Confirmación', body, footer);
  openModal(id);
  document.getElementById('confirm-yes-btn').addEventListener('click', () => {
    closeModal(id);
    onConfirm();
  });
}

// =============================================================================
// Excel Import Helper (SheetJS)
// =============================================================================
export function parseExcelWorkers(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

// =============================================================================
// Bootstrap
// =============================================================================
async function init() {
  // Register service worker
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (e) { console.warn('SW registration failed:', e); }
  }

  // Ensure default admin exists
  await ensureDefaultAdmin();

  // Sidebar toggle
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      openMobileSidebar();
    } else {
      toggleSidebar();
    }
  });

  // Sidebar overlay click
  const overlay = document.querySelector('.sidebar-overlay');
  if (overlay) overlay.addEventListener('click', closeMobileSidebar);

  // Login form
  const loginForm = document.getElementById('login-form');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Ingresando...';

    const result = await login(username, password);

    if (result.success) {
      showToast('Bienvenido', `Hola, ${result.user.nombre || result.user.username}`, 'success');
      showApp();
    } else {
      showToast('Error de acceso', result.message, 'error');
      btn.disabled = false;
      btn.innerHTML = 'Ingresar';
    }
  });

  // Logout button
  document.getElementById('logout-btn').addEventListener('click', () => {
    confirmDialog('¿Desea cerrar la sesión actual?', logout);
  });

  // Check session
  if (restoreSession()) {
    showApp();
  } else {
    showLogin();
  }
}

document.addEventListener('DOMContentLoaded', init);
