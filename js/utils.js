// Funciones pequeñas que se usan en varias partes de la app.

const formatoDinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const formatoCorto = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 });

export const dinero = (n) => formatoDinero.format(n || 0);
export const dineroCorto = (n) => '$' + formatoCorto.format(n || 0);

// Los meses se manejan como texto "AAAA-MM" (ej. "2026-08"), fácil de comparar y ordenar.
export const mesDe = (fechaISO) => fechaISO.slice(0, 7);

export function nombreMes(mes, opciones = { month: 'long', year: 'numeric' }) {
  const [anio, m] = mes.split('-').map(Number);
  const texto = new Date(anio, m - 1, 1).toLocaleDateString('es-MX', opciones);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function sumarMeses(mes, cantidad) {
  const [anio, m] = mes.split('-').map(Number);
  const fecha = new Date(anio, m - 1 + cantidad, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

export function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fechaLarga(fechaISO) {
  const [a, m, d] = fechaISO.split('-').map(Number);
  const texto = new Date(a, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Evita que un texto escrito por el usuario se interprete como HTML.
export function escapar(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Agrupa una lista de movimientos por un campo y suma presupuesto y monto.
export function agrupar(movimientos, campo) {
  const grupos = new Map();
  for (const m of movimientos) {
    const g = grupos.get(m[campo]) ?? { monto: 0, presupuesto: 0, items: [] };
    g.monto += m.monto;
    g.presupuesto += m.presupuesto;
    g.items.push(m);
    grupos.set(m[campo], g);
  }
  return grupos;
}

export function descargarArchivo(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
