// =============================================================================
// db.js – IndexedDB Layer (Dexie.js)
// Mil Pollos – Salud Ocupacional
// =============================================================================

const db = new Dexie('MilPollosSaludDB');

db.version(1).stores({
  // Users / Auth
  users: '++id, username, role',

  // Workers
  workers: '++id, cedula, nombre, apellido, cargo, departamento, status',

  // Medical Evaluations
  evaluaciones: '++id, workerId, tipo, fecha, medico',

  // Aptitud Psicofísica
  aptitudes: '++id, workerId, evaluacionId, resultado, fecha',

  // Blood Pressure Control
  presion_arterial: '++id, workerId, fecha, sistolica, diastolica',

  // Reposos (Medical Rest)
  reposos: '++id, workerId, fecha_inicio, fecha_fin, cedula',

  // References to Specialists
  referencias: '++id, workerId, especialidad, fecha, urgencia',

  // Goniometries
  goniometrias: '++id, workerId, fecha, region',

  // INPSASEL Medical History
  historia_inpsasel: '++id, workerId, fecha',

  // Medical Consultations / Progress Notes
  consultas: '++id, workerId, fecha, tipo, numero_consulta',

  // Morbidity Records
  morbilidad: '++id, mes, anio, tipo',

  // App Settings
  settings: 'key',

  // Audit Log
  audit_log: '++id, tabla, accion, fecha, usuario'
});

// =============================================================================
// Generic CRUD helpers
// =============================================================================

const CRUD = {
  async getAll(table) {
    return await db[table].toArray();
  },

  async getById(table, id) {
    return await db[table].get(id);
  },

  async add(table, data) {
    const id = await db[table].add({ ...data, createdAt: new Date().toISOString() });
    return { id, ...data };
  },

  async update(table, id, data) {
    await db[table].update(id, { ...data, updatedAt: new Date().toISOString() });
    return { id, ...data };
  },

  async delete(table, id) {
    await db[table].delete(id);
    return true;
  },

  async search(table, field, value) {
    return await db[table].where(field).equalsIgnoreCase(String(value)).toArray();
  },

  async filter(table, filterFn) {
    return await db[table].filter(filterFn).toArray();
  },

  async count(table) {
    return await db[table].count();
  }
};

// =============================================================================
// Specialized queries
// =============================================================================

const WorkerDB = {
  async getAll() {
    return await db.workers.orderBy('apellido').toArray();
  },
  async getByCedula(cedula) {
    return await db.workers.where('cedula').equals(String(cedula)).first();
  },
  async search(query) {
    const q = query.toLowerCase();
    return await db.workers.filter(w =>
      w.nombre?.toLowerCase().includes(q) ||
      w.apellido?.toLowerCase().includes(q) ||
      w.cedula?.toLowerCase().includes(q) ||
      w.cargo?.toLowerCase().includes(q) ||
      w.departamento?.toLowerCase().includes(q)
    ).toArray();
  },
  async add(data) { return CRUD.add('workers', data); },
  async update(id, data) { return CRUD.update('workers', id, data); },
  async delete(id) { return CRUD.delete('workers', id); },
  async count() { return CRUD.count('workers'); }
};

const EvaluacionDB = {
  async getByWorker(workerId) {
    return await db.evaluaciones.where('workerId').equals(workerId).reverse().sortBy('fecha');
  },
  async add(data) { return CRUD.add('evaluaciones', data); },
  async update(id, data) { return CRUD.update('evaluaciones', id, data); },
  async delete(id) { return CRUD.delete('evaluaciones', id); },
  async getRecent(limit = 10) {
    return await db.evaluaciones.orderBy('fecha').reverse().limit(limit).toArray();
  }
};

const AptitudDB = {
  async getByWorker(workerId) {
    return await db.aptitudes.where('workerId').equals(workerId).reverse().sortBy('fecha');
  },
  async add(data) { return CRUD.add('aptitudes', data); },
  async update(id, data) { return CRUD.update('aptitudes', id, data); },
  async delete(id) { return CRUD.delete('aptitudes', id); }
};

const PresionDB = {
  async getByWorker(workerId) {
    return await db.presion_arterial.where('workerId').equals(workerId).sortBy('fecha');
  },
  async getLatest(workerId) {
    const all = await db.presion_arterial.where('workerId').equals(workerId).reverse().sortBy('fecha');
    return all[0] || null;
  },
  async add(data) { return CRUD.add('presion_arterial', data); },
  async delete(id) { return CRUD.delete('presion_arterial', id); }
};

const ReposooDB = {
  async getAll() { return await db.reposos.orderBy('fecha_inicio').reverse().toArray(); },
  async getByWorker(workerId) {
    return await db.reposos.where('workerId').equals(workerId).reverse().sortBy('fecha_inicio');
  },
  async getVigentes() {
    const today = new Date().toISOString().slice(0,10);
    return await db.reposos.filter(r => r.fecha_fin >= today).toArray();
  },
  async add(data) { return CRUD.add('reposos', data); },
  async update(id, data) { return CRUD.update('reposos', id, data); },
  async delete(id) { return CRUD.delete('reposos', id); }
};

const ReferenciaDB = {
  async getByWorker(workerId) {
    return await db.referencias.where('workerId').equals(workerId).reverse().sortBy('fecha');
  },
  async add(data) { return CRUD.add('referencias', data); },
  async update(id, data) { return CRUD.update('referencias', id, data); },
  async delete(id) { return CRUD.delete('referencias', id); }
};

const GoniometriaDB = {
  async getByWorker(workerId) {
    return await db.goniometrias.where('workerId').equals(workerId).reverse().sortBy('fecha');
  },
  async add(data) { return CRUD.add('goniometrias', data); },
  async update(id, data) { return CRUD.update('goniometrias', id, data); },
  async delete(id) { return CRUD.delete('goniometrias', id); }
};

const InpsaselDB = {
  async getByWorker(workerId) {
    return await db.historia_inpsasel.where('workerId').equals(workerId).first();
  },
  async add(data) { return CRUD.add('historia_inpsasel', data); },
  async update(id, data) { return CRUD.update('historia_inpsasel', id, data); }
};

const ConsultaDB = {
  async getByWorker(workerId) {
    return await db.consultas.where('workerId').equals(workerId).reverse().sortBy('fecha');
  },
  async getNextNumber(workerId) {
    const all = await db.consultas.where('workerId').equals(workerId).toArray();
    return all.length + 1;
  },
  async add(data) { return CRUD.add('consultas', data); },
  async update(id, data) { return CRUD.update('consultas', id, data); },
  async delete(id) { return CRUD.delete('consultas', id); }
};

const MorbilidadDB = {
  async getByPeriod(mes, anio) {
    return await db.morbilidad.filter(m => m.mes === mes && m.anio === anio).toArray();
  },
  async add(data) { return CRUD.add('morbilidad', data); },
  async update(id, data) { return CRUD.update('morbilidad', id, data); },
  async delete(id) { return CRUD.delete('morbilidad', id); }
};

const SettingsDB = {
  async get(key) {
    const s = await db.settings.get(key);
    return s ? s.value : null;
  },
  async set(key, value) {
    await db.settings.put({ key, value });
  }
};

const UserDB = {
  async getAll() { return await db.users.toArray(); },
  async getByUsername(username) {
    return await db.users.where('username').equals(username).first();
  },
  async add(data) { return CRUD.add('users', data); },
  async update(id, data) { return CRUD.update('users', id, data); },
  async delete(id) { return CRUD.delete('users', id); },
  async count() { return CRUD.count('users'); }
};

// =============================================================================
// Stats for dashboard
// =============================================================================
const StatsDB = {
  async getDashboardStats() {
    const [workers, evaluaciones, repososVig, consultas] = await Promise.all([
      WorkerDB.count(),
      db.evaluaciones.count(),
      ReposooDB.getVigentes(),
      db.consultas.count()
    ]);
    return {
      totalWorkers: workers,
      totalEvaluaciones: evaluaciones,
      repososVigentes: repososVig.length,
      totalConsultas: consultas
    };
  },

  async getMorbilityByMonth(anio) {
    const all = await db.consultas.filter(c => c.fecha && c.fecha.startsWith(String(anio))).toArray();
    const byMonth = Array(12).fill(0);
    all.forEach(c => {
      const m = parseInt(c.fecha.slice(5,7)) - 1;
      if (m >= 0 && m < 12) byMonth[m]++;
    });
    return byMonth;
  }
};

export { db, CRUD, WorkerDB, EvaluacionDB, AptitudDB, PresionDB, ReposooDB,
         ReferenciaDB, GoniometriaDB, InpsaselDB, ConsultaDB,
         MorbilidadDB, SettingsDB, UserDB, StatsDB };
