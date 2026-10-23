// Punto de entrada: navegación entre pantallas, dibujo de cada pantalla y formulario.

import * as store from './store.js';
import * as sync from './sync.js';
import {
  dinero, dineroCorto, mesDe, nombreMes, sumarMeses, hoyISO, fechaLarga, escapar, agrupar, descargarArchivo,
} from './utils.js';

const $ = (selector) => document.querySelector(selector);
const vista = $('#vista');
const dialogo = $('#dialogo');
const formulario = $('#formulario');

// Estado de la interfaz (no son datos, solo lo que el usuario está viendo)
let mesActual = mesInicial();
let filtroTipo = 'Todos';
let busqueda = '';
let graficas = [];
let editando = null;
let eventoInstalar = null;

const PANTALLAS = {
  resumen: { titulo: 'Resumen', dibujar: pantallaResumen },
  movimientos: { titulo: 'Movimientos', dibujar: pantallaMovimientos },
  ajustes: { titulo: 'Ajustes', dibujar: pantallaAjustes },
};

function mesInicial() {
  const actual = mesDe(hoyISO());
  const meses = store.mesesConDatos();
  return meses.includes(actual) || !meses.length ? actual : meses.at(-1);
}

function rutaActual() {
  const ruta = location.hash.replace('#/', '');
  return PANTALLAS[ruta] ? ruta : 'resumen';
}

// Vuelve a dibujar la pantalla actual completa.
function dibujar() {
  const ruta = rutaActual();
  const enfocado = document.activeElement?.id;
  graficas.forEach((g) => g.destroy());
  graficas = [];
  $('#titulo').textContent = PANTALLAS[ruta].titulo;
  document.querySelectorAll('.pestanas a').forEach((a) => a.classList.toggle('activa', a.hash === '#/' + ruta));
  $('#boton-agregar').hidden = ruta === 'ajustes';
  vista.innerHTML = '';
  PANTALLAS[ruta].dibujar();
  if (enfocado) document.getElementById(enfocado)?.focus();
}

function avisar(texto) {
  const aviso = $('#aviso');
  aviso.textContent = texto;
  aviso.classList.add('visible');
  clearTimeout(avisar.espera);
  avisar.espera = setTimeout(() => aviso.classList.remove('visible'), 2600);
}

function selectorMes() {
  return `
    <div class="selector-mes">
      <button class="boton-icono" data-accion="mes" data-cambio="-1" aria-label="Mes anterior">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <strong>${nombreMes(mesActual)}</strong>
      <button class="boton-icono" data-accion="mes" data-cambio="1" aria-label="Mes siguiente">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>`;
}

// =====================================================================
// Pantalla: Resumen (equivale a la hoja "Dashboard" del Excel)
// =====================================================================

function totales(movimientos, tipo) {
  const lista = movimientos.filter((m) => m.tipo === tipo);
  return {
    monto: lista.reduce((s, m) => s + m.monto, 0),
    presupuesto: lista.reduce((s, m) => s + m.presupuesto, 0),
  };
}

// Texto de diferencia contra presupuesto. En egresos gastar de más es malo;
// en ingresos, recibir de menos es lo malo.
function diferencia(monto, presupuesto, tipo) {
  const dif = monto - presupuesto;
  if (!presupuesto || Math.abs(dif) < 0.005) return '';
  const esBueno = tipo === 'Ingreso' ? dif > 0 : dif < 0;
  const texto = tipo === 'Ingreso'
    ? (dif > 0 ? `▲ ${dinero(dif)} más` : `▼ ${dinero(-dif)} menos`)
    : (dif > 0 ? `▲ ${dinero(dif)} de más` : `▼ ${dinero(-dif)} de ahorro`);
  return `<span class="${esBueno ? 'positivo' : 'negativo'}">${texto}</span>`;
}

function pantallaResumen() {
  const movimientos = store.movimientosDelMes(mesActual);
  const ingresos = totales(movimientos, 'Ingreso');
  const egresos = totales(movimientos, 'Egreso');
  const saldo = ingresos.monto - egresos.monto;
  let html = selectorMes();

  if (!store.movimientos().length && sync.configurado() && !sync.usuarioActual()) {
    html += `
      <div class="banner">
        <p><strong>¿Ya tienes cuenta?</strong> Inicia sesión para traer tus movimientos guardados en la nube.</p>
        <div class="botones"><a class="boton primario" href="#/ajustes">Iniciar sesión</a></div>
      </div>`;
  } else if (!store.movimientos().length && !localStorage.getItem('finanzas.importacionOmitida')) {
    html += `
      <div class="banner">
        <p><strong>¿Vienes del Excel?</strong> Puedes importar todos tus movimientos anteriores para no empezar de cero.</p>
        <div class="botones">
          <button class="boton primario" data-accion="importar-excel">Importar movimientos</button>
          <button class="boton" data-accion="omitir-importacion">Empezar de cero</button>
        </div>
      </div>`;
  }

  html += `
    <section class="tarjetas">
      <article class="tarjeta saldo">
        <span>Saldo del mes</span>
        <strong class="cifra">${dinero(saldo)}</strong>
        <small>Presupuestado: ${dinero(ingresos.presupuesto - egresos.presupuesto)}</small>
      </article>
      <article class="tarjeta">
        <span>Ingresos</span>
        <strong class="cifra">${dinero(ingresos.monto)}</strong>
        <small>Ppto. ${dinero(ingresos.presupuesto)}</small>
        <small>${diferencia(ingresos.monto, ingresos.presupuesto, 'Ingreso')}</small>
      </article>
      <article class="tarjeta">
        <span>Egresos</span>
        <strong class="cifra">${dinero(egresos.monto)}</strong>
        <small>Ppto. ${dinero(egresos.presupuesto)}</small>
        <small>${diferencia(egresos.monto, egresos.presupuesto, 'Egreso')}</small>
      </article>
    </section>`;

  if (!movimientos.length) {
    vista.innerHTML = html + '<p class="vacio">No hay movimientos en este mes.<br>Toca <b>+</b> para agregar el primero.</p>';
    return;
  }

  html += `
    <section class="panel">
      <h2>¿En qué se fue el dinero?</h2>
      <div class="grafica"><canvas id="grafica-dona" role="img" aria-label="Egresos por categoría"></canvas></div>
      <div class="leyenda" id="leyenda-dona"></div>
    </section>
    <section class="panel">
      <h2>Presupuesto vs real (egresos)</h2>
      <div class="grafica"><canvas id="grafica-presupuesto" role="img" aria-label="Presupuesto contra gasto real por categoría"></canvas></div>
      <div class="leyenda">${muestra('--referencia', 'Presupuesto')}${muestra('--serie-1', 'Real')}</div>
    </section>
    ${desglose(movimientos, 'Egreso')}
    ${desglose(movimientos, 'Ingreso')}
    <section class="panel">
      <h2>Últimos 6 meses</h2>
      <div class="grafica"><canvas id="grafica-meses" role="img" aria-label="Ingresos y egresos de los últimos seis meses"></canvas></div>
      <div class="leyenda">${muestra('--serie-1', 'Ingresos')}${muestra('--serie-2', 'Egresos')}</div>
    </section>`;

  vista.innerHTML = html;
  crearGraficas(movimientos);
}

// Lista de categorías con barra de avance; al tocarla muestra sus conceptos.
function desglose(movimientos, tipo) {
  const grupos = agrupar(movimientos.filter((m) => m.tipo === tipo), 'categoria');
  if (!grupos.size) return '';
  const filas = [...grupos].sort((a, b) => b[1].monto - a[1].monto).map(([categoria, g]) => {
    const porcentaje = g.presupuesto ? Math.min(100, (g.monto / g.presupuesto) * 100) : 100;
    const excedido = tipo === 'Egreso' && g.presupuesto > 0 && g.monto > g.presupuesto;
    const conceptos = [...agrupar(g.items, 'concepto')].sort((a, b) => b[1].monto - a[1].monto);
    return `
      <details class="categoria">
        <summary>
          <div class="fila"><span class="nombre">${escapar(categoria)}</span><span class="cifra">${dinero(g.monto)}</span></div>
          <div class="progreso"><i class="${excedido ? 'excedido' : ''}" style="width:${porcentaje}%"></i></div>
          <small>Presupuesto ${dinero(g.presupuesto)} ${diferencia(g.monto, g.presupuesto, tipo) ? '· ' + diferencia(g.monto, g.presupuesto, tipo) : ''}</small>
        </summary>
        <table class="conceptos">
          <thead><tr><th>Concepto</th><th>Ppto.</th><th>Real</th></tr></thead>
          <tbody>
            ${conceptos.map(([nombre, c]) => `
              <tr><td>${escapar(nombre)}</td><td class="cifra">${dinero(c.presupuesto)}</td><td class="cifra">${dinero(c.monto)}</td></tr>`).join('')}
          </tbody>
        </table>
      </details>`;
  }).join('');
  return `<section class="panel"><h2>${tipo === 'Ingreso' ? 'Ingresos' : 'Egresos'} por categoría</h2>${filas}</section>`;
}

const color = (variable) => getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
const muestra = (variable, texto) => `<span><i style="background:var(${variable})"></i>${escapar(texto)}</span>`;

// El color de cada categoría depende de su lugar en la lista de categorías,
// así "Servicios" siempre tiene el mismo color sin importar el mes.
function colorCategoria(categoria) {
  const posicion = store.categorias('Egreso').indexOf(categoria);
  return posicion >= 0 && posicion < 8 ? `--serie-${posicion + 1}` : '--referencia';
}

function crearGraficas(movimientos) {
  Object.assign(Chart.defaults, { color: color('--texto-2'), borderColor: color('--rejilla'), maintainAspectRatio: false });
  Chart.defaults.font.family = color('--fuente');
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.callbacks.label = (c) => ` ${c.dataset.label ?? c.label}: ${dinero(c.parsed.y ?? c.parsed)}`;

  const ejeDinero = { beginAtZero: true, border: { display: false }, ticks: { callback: (v) => dineroCorto(v) } };
  const ejeX = { grid: { display: false } };
  const barra = { borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22, categoryPercentage: 0.7, barPercentage: 0.9 };

  // 1. Dona: egresos por categoría
  const egresos = [...agrupar(movimientos.filter((m) => m.tipo === 'Egreso'), 'categoria')]
    .filter(([, g]) => g.monto > 0)
    .sort((a, b) => b[1].monto - a[1].monto);
  const totalEgresos = egresos.reduce((s, [, g]) => s + g.monto, 0);
  graficas.push(new Chart($('#grafica-dona'), {
    type: 'doughnut',
    data: {
      labels: egresos.map(([c]) => c),
      datasets: [{
        data: egresos.map(([, g]) => g.monto),
        backgroundColor: egresos.map(([c]) => color(colorCategoria(c))),
        borderColor: color('--superficie'),
        borderWidth: 2,
      }],
    },
    options: { cutout: '64%' },
  }));
  $('#leyenda-dona').innerHTML = egresos
    .map(([c, g]) => muestra(colorCategoria(c), `${c} ${Math.round((g.monto / totalEgresos) * 100)}%`))
    .join('');

  // 2. Barras: presupuesto vs real por categoría de egreso
  const porCategoria = [...agrupar(movimientos.filter((m) => m.tipo === 'Egreso'), 'categoria')];
  graficas.push(new Chart($('#grafica-presupuesto'), {
    type: 'bar',
    data: {
      labels: porCategoria.map(([c]) => c),
      datasets: [
        { label: 'Presupuesto', data: porCategoria.map(([, g]) => g.presupuesto), backgroundColor: color('--referencia'), ...barra },
        { label: 'Real', data: porCategoria.map(([, g]) => g.monto), backgroundColor: color('--serie-1'), ...barra },
      ],
    },
    options: { scales: { y: ejeDinero, x: ejeX }, interaction: { mode: 'index', intersect: false } },
  }));

  // 3. Barras: ingresos y egresos de los últimos 6 meses
  const meses = Array.from({ length: 6 }, (_, i) => sumarMeses(mesActual, i - 5));
  const porMes = meses.map((mes) => store.movimientosDelMes(mes));
  graficas.push(new Chart($('#grafica-meses'), {
    type: 'bar',
    data: {
      labels: meses.map((m) => nombreMes(m, { month: 'short' }).replace('.', '')),
      datasets: [
        { label: 'Ingresos', data: porMes.map((l) => totales(l, 'Ingreso').monto), backgroundColor: color('--serie-1'), ...barra },
        { label: 'Egresos', data: porMes.map((l) => totales(l, 'Egreso').monto), backgroundColor: color('--serie-2'), ...barra },
      ],
    },
    options: { scales: { y: ejeDinero, x: ejeX }, interaction: { mode: 'index', intersect: false } },
  }));
}

// =====================================================================
// Pantalla: Movimientos (equivale a la tabla "Registro")
// =====================================================================

function pantallaMovimientos() {
  vista.innerHTML = `
    ${selectorMes()}
    <div class="filtros">
      <div class="chips">
        ${['Todos', 'Ingreso', 'Egreso'].map((t) => `
          <button class="chip ${filtroTipo === t ? 'activo' : ''}" data-accion="filtro" data-tipo="${t}">${t === 'Todos' ? 'Todos' : t + 's'}</button>`).join('')}
      </div>
      <input id="buscador" class="buscador" type="search" placeholder="Buscar concepto o categoría…" value="${escapar(busqueda)}">
    </div>
    <div id="lista-movimientos" class="filtros"></div>`;
  $('#buscador').addEventListener('input', (e) => {
    busqueda = e.target.value;
    dibujarLista();
  });
  dibujarLista();
}

function dibujarLista() {
  const texto = busqueda.trim().toLowerCase();
  const lista = store.movimientosDelMes(mesActual)
    .filter((m) => filtroTipo === 'Todos' || m.tipo === filtroTipo)
    .filter((m) => !texto || `${m.concepto} ${m.categoria}`.toLowerCase().includes(texto))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.actualizado.localeCompare(a.actualizado));
  const contenedor = $('#lista-movimientos');

  if (!lista.length) {
    contenedor.innerHTML = `<p class="vacio">${texto || filtroTipo !== 'Todos' ? 'Nada coincide con el filtro.' : 'No hay movimientos en este mes.'}</p>`;
    return;
  }

  const total = lista.reduce((s, m) => s + (m.tipo === 'Ingreso' ? m.monto : -m.monto), 0);
  const porDia = agrupar(lista, 'fecha');
  contenedor.innerHTML = `
    <div class="total-lista"><span>${lista.length} movimientos</span><span class="cifra">Neto ${dinero(total)}</span></div>
    ${[...porDia].map(([fecha, dia]) => `
      <section class="dia">
        <h3>${fechaLarga(fecha)}</h3>
        <ul class="lista">
          ${dia.items.map((m) => `
            <li>
              <button class="movimiento" data-accion="editar" data-id="${m.id}">
                <span class="punto" style="background:var(${m.tipo === 'Ingreso' ? '--bien' : colorCategoria(m.categoria)})"></span>
                <span class="info">
                  <strong>${escapar(m.concepto || '(sin concepto)')}</strong>
                  <small>${escapar(m.categoria)}</small>
                </span>
                <span class="montos">
                  ${!m.monto && m.presupuesto
                    ? `<strong class="pendiente">${m.tipo === 'Ingreso' ? 'Por recibir' : 'Por pagar'}</strong>`
                    : `<strong class="cifra ${m.tipo === 'Ingreso' ? 'positivo' : ''}">${m.tipo === 'Ingreso' ? '+' : '−'}${dinero(m.monto)}</strong>`}
                  ${m.presupuesto ? `<small class="cifra">Ppto. ${dinero(m.presupuesto)}</small>` : ''}
                </span>
              </button>
            </li>`).join('')}
        </ul>
      </section>`).join('')}`;
}

// =====================================================================
// Pantalla: Ajustes
// =====================================================================

function pantallaAjustes() {
  vista.innerHTML = `
    ${panelCuenta()}
    <section class="panel">
      <h2>Categorías</h2>
      ${['Egreso', 'Ingreso'].map((tipo) => `
        <p class="subtitulo">${tipo}s</p>
        <ul class="lista-categorias">
          ${store.categorias(tipo).map((c) => `
            <li>${escapar(c)}<button data-accion="borrar-categoria" data-tipo="${tipo}" data-nombre="${escapar(c)}" aria-label="Borrar ${escapar(c)}">×</button></li>`).join('')}
        </ul>
        <form class="agregar-categoria" data-formulario="categoria" data-tipo="${tipo}">
          <input name="nombre" required placeholder="Nueva categoría de ${tipo.toLowerCase()}" autocomplete="off">
          <button class="boton">Agregar</button>
        </form>`).join('')}
    </section>
    <section class="panel">
      <h2>Tus datos</h2>
      <p>Descarga una copia para abrirla en Excel o Google Sheets, o un respaldo completo para restaurar después.</p>
      <div class="botones">
        <button class="boton" data-accion="exportar-csv">Exportar a Excel (CSV)</button>
        <button class="boton" data-accion="respaldo">Descargar respaldo</button>
        <button class="boton" data-accion="restaurar">Importar archivo…</button>
      </div>
    </section>
    ${eventoInstalar ? `
      <section class="panel">
        <h2>Instalar la app</h2>
        <p>Agrégala a tu pantalla de inicio para abrirla como cualquier otra app, incluso sin internet.</p>
        <button class="boton primario" data-accion="instalar">Instalar</button>
      </section>` : ''}`;
}

function panelCuenta() {
  if (!sync.configurado()) {
    return `
      <section class="panel">
        <h2>Sincronización</h2>
        <p>Todavía no está conectada a la nube. Sigue la guía <b>GUIA-SUPABASE.md</b> para activarla.
        Mientras tanto, todo se guarda en este dispositivo.</p>
      </section>`;
  }
  const usuario = sync.usuarioActual();
  if (!usuario) {
    return `
      <section class="panel">
        <h2>Cuenta</h2>
        <p>Inicia sesión para guardar tus datos en la nube y verlos en todos tus dispositivos.</p>
        <form class="formulario-cuenta" data-formulario="cuenta">
          <input name="email" type="email" required placeholder="Correo" autocomplete="email">
          <input name="password" type="password" required minlength="6" placeholder="Contraseña (mínimo 6)" autocomplete="current-password">
          <div class="botones">
            <button class="boton primario" value="entrar">Entrar</button>
            <button class="boton" value="registrar">Crear cuenta</button>
          </div>
        </form>
      </section>`;
  }
  const { fase, mensaje, ultima } = sync.estado;
  return `
    <section class="panel">
      <h2>Cuenta</h2>
      <p>Sesión iniciada como <b>${escapar(usuario.email)}</b>.<br>
      ${fase === 'error' ? `<span class="negativo">Error al sincronizar: ${escapar(mensaje)}</span>`
        : ultima ? `Última sincronización: ${ultima.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
      <div class="botones">
        <button class="boton primario" data-accion="sincronizar">Sincronizar ahora</button>
        <button class="boton" data-accion="salir">Cerrar sesión</button>
      </div>
    </section>`;
}

function pintarEstadoSync() {
  const boton = $('#estado-sync');
  const textos = {
    sincronizando: 'Sincronizando…',
    ok: '✓ Sincronizado',
    error: '⚠ Error al sincronizar',
    'sin-internet': 'Sin internet',
    desconectado: 'Sin sesión',
  };
  boton.hidden = !sync.configurado();
  boton.textContent = textos[sync.estado.fase] ?? '';
  boton.classList.toggle('error', sync.estado.fase === 'error');
}

// =====================================================================
// Importar / exportar
// =====================================================================

async function importarDelExcel() {
  try {
    const respuesta = await fetch('data/importado.json', { cache: 'no-store' });
    if (!respuesta.ok) throw new Error('no encontrado');
    terminarImportacion(store.importar(await respuesta.json()));
  } catch {
    elegirArchivo(); // si la app está publicada en internet, el archivo no viene incluido
  }
}

function elegirArchivo() {
  const entrada = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
  entrada.addEventListener('change', async () => {
    try {
      terminarImportacion(store.importar(JSON.parse(await entrada.files[0].text())));
    } catch {
      avisar('Ese archivo no es un respaldo válido');
    }
  });
  entrada.click();
}

function terminarImportacion(cantidad) {
  mesActual = mesInicial();
  avisar(cantidad ? `${cantidad} movimientos importados` : 'No había movimientos nuevos');
  dibujar();
}

function exportarCSV() {
  const celda = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const filas = store.movimientos()
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((m) => [m.fecha, nombreMes(mesDe(m.fecha)), m.tipo, m.categoria, m.concepto, m.presupuesto, m.monto].map(celda).join(','));
  const csv = '﻿' + ['Fecha,Mes,Tipo,Categoría,Concepto,Presupuesto,Monto', ...filas].join('\r\n');
  descargarArchivo(`finanzas-${hoyISO()}.csv`, csv, 'text/csv;charset=utf-8');
}

// =====================================================================
// Formulario de movimiento
// =====================================================================

function llenarCategorias(tipo, seleccionada) {
  const opciones = store.categorias(tipo);
  formulario.elements.categoria.innerHTML = opciones.map((c) => `<option ${c === seleccionada ? 'selected' : ''}>${escapar(c)}</option>`).join('');
  llenarConceptos();
}

function llenarConceptos() {
  const conceptos = store.conceptos(formulario.elements.categoria.value);
  $('#lista-conceptos').innerHTML = conceptos.map((c) => `<option value="${escapar(c)}">`).join('');
}

function abrirFormulario(movimiento = null) {
  editando = movimiento;
  formulario.reset();
  const campos = formulario.elements;
  $('#dialogo-titulo').textContent = movimiento ? 'Editar movimiento' : 'Nuevo movimiento';
  $('#boton-borrar').hidden = !movimiento;
  campos.tipo.value = movimiento?.tipo ?? (filtroTipo === 'Ingreso' ? 'Ingreso' : 'Egreso');
  llenarCategorias(campos.tipo.value, movimiento?.categoria);
  campos.concepto.value = movimiento?.concepto ?? '';
  campos.monto.value = movimiento ? movimiento.monto : '';
  campos.presupuesto.value = movimiento ? movimiento.presupuesto : '';
  campos.fecha.value = movimiento?.fecha ?? (mesActual === mesDe(hoyISO()) ? hoyISO() : `${mesActual}-01`);
  dialogo.showModal();
}

formulario.addEventListener('change', (e) => {
  const campos = formulario.elements;
  if (e.target.name === 'tipo') llenarCategorias(e.target.value);
  if (e.target.name === 'categoria') llenarConceptos();
  // Si el concepto ya se usó antes, sugiere el mismo presupuesto
  if (e.target.name === 'concepto' && !editando && !campos.presupuesto.value) {
    const anterior = store.ultimoConcepto(campos.categoria.value, campos.concepto.value.trim());
    if (anterior?.presupuesto) campos.presupuesto.value = anterior.presupuesto;
  }
});

formulario.addEventListener('submit', (e) => {
  e.preventDefault();
  const campos = formulario.elements;
  const datos = {
    tipo: campos.tipo.value,
    categoria: campos.categoria.value,
    concepto: campos.concepto.value.trim(),
    monto: Number(campos.monto.value) || 0,
    presupuesto: Number(campos.presupuesto.value) || 0,
    fecha: campos.fecha.value,
  };
  if (editando) datos.id = editando.id;
  mesActual = mesDe(datos.fecha);
  dialogo.close();
  store.guardarMovimiento(datos);
  avisar(editando ? 'Movimiento actualizado' : 'Movimiento agregado');
});

$('#boton-cancelar').addEventListener('click', () => dialogo.close());
$('#boton-borrar').addEventListener('click', () => {
  if (!confirm(`¿Borrar "${editando.concepto}"?`)) return;
  dialogo.close();
  store.borrarMovimiento(editando.id);
  avisar('Movimiento borrado');
});
$('#boton-agregar').addEventListener('click', () => abrirFormulario());
$('#estado-sync').addEventListener('click', () => (location.hash = '#/ajustes'));

// =====================================================================
// Botones y formularios dentro de las pantallas (un solo "escuchador")
// =====================================================================

const ACCIONES = {
  mes: (b) => { mesActual = sumarMeses(mesActual, Number(b.dataset.cambio)); dibujar(); },
  filtro: (b) => { filtroTipo = b.dataset.tipo; dibujar(); },
  editar: (b) => abrirFormulario(store.movimientos().find((m) => m.id === b.dataset.id)),
  'importar-excel': importarDelExcel,
  'omitir-importacion': () => { localStorage.setItem('finanzas.importacionOmitida', '1'); dibujar(); },
  'borrar-categoria': (b) => {
    if (confirm(`¿Borrar la categoría "${b.dataset.nombre}"? Los movimientos que ya la usan no se borran.`)) {
      store.borrarCategoria(b.dataset.tipo, b.dataset.nombre);
    }
  },
  'exportar-csv': exportarCSV,
  respaldo: () => descargarArchivo(`finanzas-respaldo-${hoyISO()}.json`, JSON.stringify(store.respaldo(), null, 1), 'application/json'),
  restaurar: elegirArchivo,
  sincronizar: () => sync.sincronizar(),
  salir: async () => { await sync.salir(); dibujar(); },
  instalar: async () => { eventoInstalar.prompt(); await eventoInstalar.userChoice; eventoInstalar = null; dibujar(); },
};

vista.addEventListener('click', (e) => {
  const boton = e.target.closest('[data-accion]');
  if (boton) ACCIONES[boton.dataset.accion]?.(boton);
});

vista.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  if (form.dataset.formulario === 'categoria') {
    const nombre = form.elements.nombre.value.trim();
    if (!store.agregarCategoria(form.dataset.tipo, nombre)) avisar('Esa categoría ya existe');
  }
  if (form.dataset.formulario === 'cuenta') {
    const { email, password } = form.elements;
    const botones = form.querySelectorAll('button');
    botones.forEach((b) => (b.disabled = true));
    try {
      if (e.submitter?.value === 'registrar') {
        const resultado = await sync.registrarse(email.value, password.value);
        avisar(resultado === 'confirmar' ? 'Te enviamos un correo para confirmar tu cuenta' : 'Cuenta creada');
      } else {
        await sync.entrar(email.value, password.value);
        avisar('Sesión iniciada');
      }
      dibujar();
    } catch (error) {
      avisar(error.message);
      botones.forEach((b) => (b.disabled = false));
    }
  }
});

// =====================================================================
// Arranque
// =====================================================================

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  eventoInstalar = e;
  if (rutaActual() === 'ajustes') dibujar();
});

store.suscribir(dibujar);
sync.alCambiarEstado(() => {
  pintarEstadoSync();
  if (rutaActual() === 'ajustes' || !store.movimientos().length) dibujar();
});
window.addEventListener('hashchange', () => {
  dibujar();
  window.scrollTo(0, 0);
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

pintarEstadoSync();
dibujar();
sync.iniciar();
