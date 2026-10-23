// "Store": el único lugar donde se leen y modifican los datos.
// Todo se guarda en el navegador (localStorage), así la app funciona sin internet.
// Cada fila lleva:
//   actualizado -> fecha/hora del último cambio (para saber qué versión es más nueva)
//   borrado     -> en vez de eliminar, se marca; así el borrado también se sincroniza
//   pendiente   -> true si hay un cambio que todavía no se sube a la nube

import { mesDe } from './utils.js';

const CLAVE = 'finanzas.datos.v1';
const CATEGORIAS_INICIALES = {
  Ingreso: ['Sueldo', 'Negocio', 'Otros'],
  Egreso: ['Servicios', 'Gastos', 'Deudas', 'Ahorros', 'Emprendimiento'],
};

let datos = cargar();
const oyentes = new Set();

function cargar() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE));
    if (guardado) return guardado;
  } catch { /* datos dañados: se empieza de cero */ }
  const nuevo = { movimientos: [], categorias: [] };
  for (const [tipo, nombres] of Object.entries(CATEGORIAS_INICIALES)) {
    for (const nombre of nombres) nuevo.categorias.push(fila({ tipo, nombre }));
  }
  return nuevo;
}

function fila(campos) {
  return { id: crypto.randomUUID(), ...campos, actualizado: new Date().toISOString(), borrado: false, pendiente: true };
}

function guardar() {
  localStorage.setItem(CLAVE, JSON.stringify(datos));
  oyentes.forEach((fn) => fn());
}

// Para que las pantallas se vuelvan a dibujar cuando cambian los datos.
export function suscribir(fn) {
  oyentes.add(fn);
}

// ---------- Lectura ----------

export function movimientos() {
  return datos.movimientos.filter((m) => !m.borrado);
}

export function movimientosDelMes(mes) {
  return movimientos().filter((m) => mesDe(m.fecha) === mes);
}

export function mesesConDatos() {
  return [...new Set(movimientos().map((m) => mesDe(m.fecha)))].sort();
}

export function categorias(tipo) {
  const nombres = datos.categorias.filter((c) => !c.borrado && c.tipo === tipo).map((c) => c.nombre);
  // Si un movimiento usa una categoría que ya no existe, se sigue mostrando
  for (const m of movimientos()) if (m.tipo === tipo) nombres.push(m.categoria);
  return [...new Set(nombres)];
}

export function conceptos(categoria) {
  const usados = movimientos().filter((m) => m.categoria === categoria).map((m) => m.concepto);
  return [...new Set(usados)].sort((a, b) => a.localeCompare(b, 'es'));
}

// El último movimiento con ese concepto, para sugerir el presupuesto.
export function ultimoConcepto(categoria, concepto) {
  return movimientos()
    .filter((m) => m.categoria === categoria && m.concepto.toLowerCase() === concepto.toLowerCase())
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
}

// ---------- Escritura ----------

export function guardarMovimiento(campos) {
  const existente = datos.movimientos.find((m) => m.id === campos.id);
  if (existente) {
    Object.assign(existente, campos, { actualizado: new Date().toISOString(), pendiente: true });
  } else {
    datos.movimientos.push(fila(campos));
  }
  guardar();
}

export function borrarMovimiento(id) {
  const m = datos.movimientos.find((x) => x.id === id);
  if (m) Object.assign(m, { borrado: true, actualizado: new Date().toISOString(), pendiente: true });
  guardar();
}

export function agregarCategoria(tipo, nombre) {
  if (categorias(tipo).some((c) => c.toLowerCase() === nombre.toLowerCase())) return false;
  datos.categorias.push(fila({ tipo, nombre }));
  guardar();
  return true;
}

export function borrarCategoria(tipo, nombre) {
  for (const c of datos.categorias) {
    if (c.tipo === tipo && c.nombre === nombre && !c.borrado) {
      Object.assign(c, { borrado: true, actualizado: new Date().toISOString(), pendiente: true });
    }
  }
  guardar();
}

// Importa un respaldo de la app o el archivo generado desde el Excel.
// Las filas cuyo id ya existe se ignoran, así importar dos veces no duplica nada.
export function importar(contenido) {
  const ids = new Set(datos.movimientos.map((m) => m.id));
  let agregados = 0;
  for (const m of contenido.movimientos ?? []) {
    if (ids.has(m.id)) continue;
    datos.movimientos.push({ ...fila({}), ...m, presupuesto: Number(m.presupuesto) || 0, monto: Number(m.monto) || 0, pendiente: true });
    agregados++;
  }
  // El Excel trae { Ingreso: [...], Egreso: [...] }; un respaldo trae una lista de filas
  const cats = Array.isArray(contenido.categorias)
    ? contenido.categorias.filter((c) => !c.borrado)
    : Object.entries(contenido.categorias ?? {}).flatMap(([tipo, nombres]) => nombres.map((nombre) => ({ tipo, nombre })));
  for (const c of cats) {
    if (!categorias(c.tipo).includes(c.nombre)) datos.categorias.push(fila({ tipo: c.tipo, nombre: c.nombre }));
  }
  guardar();
  return agregados;
}

export function respaldo() {
  const limpiar = (f) => { const { pendiente, ...resto } = f; return resto; };
  return { app: 'Finanzas', version: 1, fecha: new Date().toISOString(), movimientos: datos.movimientos.map(limpiar), categorias: datos.categorias.map(limpiar) };
}

// ---------- Sincronización (lo usa sync.js) ----------

export function filasPendientes(tabla) {
  return datos[tabla].filter((f) => f.pendiente).map((f) => ({ ...f }));
}

// Quita la marca "pendiente" solo si la fila no cambió mientras se subía.
export function marcarSincronizadas(tabla, subidas) {
  const porId = new Map(datos[tabla].map((f) => [f.id, f]));
  for (const s of subidas) {
    const local = porId.get(s.id);
    if (local && local.actualizado === s.actualizado) local.pendiente = false;
  }
  localStorage.setItem(CLAVE, JSON.stringify(datos));
}

// Mezcla lo que viene de la nube: gana la versión con el cambio más reciente.
export function fusionarRemotas(tabla, remotas) {
  const porId = new Map(datos[tabla].map((f) => [f.id, f]));
  let cambios = 0;
  for (const r of remotas) {
    const { user_id, ...remota } = r;
    // Supabase devuelve las fechas como "...+00:00"; se pasan al mismo formato que usa la app
    remota.actualizado = new Date(remota.actualizado).toISOString();
    if (tabla === 'movimientos') Object.assign(remota, { presupuesto: Number(remota.presupuesto), monto: Number(remota.monto) });
    const local = porId.get(remota.id);
    if (!local) {
      datos[tabla].push({ ...remota, pendiente: false });
      cambios++;
    } else if (local.actualizado !== remota.actualizado && (!local.pendiente || remota.actualizado > local.actualizado)) {
      Object.assign(local, remota, { pendiente: false });
      cambios++;
    }
  }
  if (cambios) guardar();
  return cambios;
}

// Al iniciar sesión por primera vez, todo lo local se sube a la cuenta.
export function marcarTodoPendiente() {
  for (const tabla of ['movimientos', 'categorias']) datos[tabla].forEach((f) => (f.pendiente = true));
  localStorage.setItem(CLAVE, JSON.stringify(datos));
}

export function hayPendientes() {
  return datos.movimientos.some((f) => f.pendiente) || datos.categorias.some((f) => f.pendiente);
}
