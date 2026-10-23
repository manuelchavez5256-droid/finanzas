// Sincronización con Supabase.
// Idea general ("offline first"):
//   1. Los cambios se guardan primero en el dispositivo (store.js) marcados como pendientes.
//   2. Cuando hay internet y sesión iniciada, se SUBEN los pendientes.
//   3. Luego se BAJA todo lo de la nube y se mezcla (gana el cambio más reciente).

import { CONFIG } from './config.js';
import * as store from './store.js';

const TABLAS = ['movimientos', 'categorias'];
let cliente = null;
let usuario = null;
let enCurso = null;
const oyentes = new Set();

export const estado = { fase: 'sin-config', mensaje: '', ultima: null };

function cambiarEstado(fase, mensaje = '') {
  Object.assign(estado, { fase, mensaje });
  if (fase === 'ok') estado.ultima = new Date();
  oyentes.forEach((fn) => fn(estado));
}

export const alCambiarEstado = (fn) => oyentes.add(fn);
export const configurado = () => Boolean(CONFIG.supabaseUrl && CONFIG.supabaseKey);
export const usuarioActual = () => usuario;

export async function iniciar() {
  if (!configurado()) return;
  cliente = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
  const { data } = await cliente.auth.getSession();
  usuario = data.session?.user ?? null;
  cliente.auth.onAuthStateChange((_evento, sesion) => {
    usuario = sesion?.user ?? null;
    if (!usuario) cambiarEstado('desconectado');
  });
  if (usuario) sincronizar();
  else cambiarEstado('desconectado');

  // Reintentar al recuperar internet o al volver a abrir la app
  window.addEventListener('online', () => sincronizar());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sincronizar();
  });
}

export async function entrar(email, password) {
  const { error } = await cliente.auth.signInWithPassword({ email, password });
  if (error) throw traducirError(error);
  usuario = (await cliente.auth.getUser()).data.user;
  store.marcarTodoPendiente(); // lo que ya había en este dispositivo se sube a la cuenta
  await sincronizar();
}

export async function registrarse(email, password) {
  const { data, error } = await cliente.auth.signUp({ email, password });
  if (error) throw traducirError(error);
  if (!data.session) return 'confirmar'; // Supabase pide confirmar el correo primero
  usuario = data.user;
  store.marcarTodoPendiente();
  await sincronizar();
  return 'ok';
}

export async function salir() {
  await cliente.auth.signOut();
  usuario = null;
  cambiarEstado('desconectado');
}

// Si ya hay una sincronización corriendo, se reutiliza en vez de empezar otra.
export function sincronizar() {
  if (!cliente || !usuario) return Promise.resolve();
  if (!navigator.onLine) {
    cambiarEstado('sin-internet');
    return Promise.resolve();
  }
  enCurso ??= ejecutarSincronizacion().finally(() => (enCurso = null));
  return enCurso;
}

async function ejecutarSincronizacion() {
  cambiarEstado('sincronizando');
  try {
    for (const tabla of TABLAS) {
      const pendientes = store.filasPendientes(tabla);
      if (pendientes.length) {
        const filas = pendientes.map(({ pendiente, ...resto }) => resto);
        const { error } = await cliente.from(tabla).upsert(filas);
        if (error) throw error;
        store.marcarSincronizadas(tabla, pendientes);
      }
      store.fusionarRemotas(tabla, await bajarTodo(tabla));
    }
    cambiarEstado('ok');
  } catch (error) {
    console.error('Error al sincronizar', error);
    cambiarEstado('error', error.message ?? String(error));
  }
}

// Supabase entrega máximo 1000 filas por consulta, así que se piden por páginas.
async function bajarTodo(tabla) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await cliente.from(tabla).select('*').order('id').range(desde, desde + 999);
    if (error) throw error;
    filas.push(...data);
    if (data.length < 1000) return filas;
  }
}

// Cambios pendientes: se sincronizan un momento después del último cambio.
let espera;
store.suscribir(() => {
  clearTimeout(espera);
  espera = setTimeout(() => store.hayPendientes() && sincronizar(), 1500);
});

function traducirError(error) {
  const textos = {
    'Invalid login credentials': 'Correo o contraseña incorrectos.',
    'Email not confirmed': 'Primero confirma tu correo (revisa tu bandeja de entrada).',
    'User already registered': 'Ese correo ya tiene cuenta. Usa "Entrar".',
  };
  return new Error(textos[error.message] ?? error.message);
}
