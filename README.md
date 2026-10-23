# Finanzas

App para llevar ingresos, egresos y presupuesto mensual. Reemplaza el Excel `Finanzas.xlsx`.
Es una **PWA** (Progressive Web App): está hecha con HTML, CSS y JavaScript como un sitio web,
pero se instala en el celular o la PC con su propio ícono, abre en pantalla completa y funciona sin internet.

## Cómo abrirla en tu PC

Desde esta carpeta:

```bash
python -m http.server 5173
```

Luego abre <http://localhost:5173>. (Abrir `index.html` con doble clic **no** funciona:
los módulos de JavaScript y el modo sin internet necesitan un servidor.)

## Qué hace cada archivo

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La estructura: encabezado, barra de pestañas y el formulario de movimiento |
| `css/styles.css` | Todo el diseño, con modo claro y oscuro automático |
| `js/app.js` | Las pantallas (Resumen, Movimientos, Ajustes), el formulario y los botones |
| `js/store.js` | Guarda y lee los datos en el dispositivo (`localStorage`) |
| `js/sync.js` | Sube y baja los datos de Supabase cuando hay sesión e internet |
| `js/config.js` | La dirección y la clave pública de tu proyecto de Supabase |
| `js/utils.js` | Funciones pequeñas: formato de pesos, nombres de meses, etc. |
| `sw.js` | *Service worker*: guarda una copia de la app para abrirla sin internet |
| `manifest.webmanifest` | Nombre, ícono y colores con los que se instala la app |
| `vendor/` | Librerías externas: Chart.js (gráficas) y supabase-js |
| `supabase/esquema.sql` | Las tablas y reglas de seguridad de la base de datos |
| `herramientas/importar_excel.py` | Convierte tu Excel en `data/importado.json` |
| `data/importado.json` | Tus movimientos del Excel (**privado**, no lo publiques) |

## Cómo fluyen los datos

```
Formulario ──► store.js (se guarda en el dispositivo, marcado "pendiente")
                  │
                  ├──► la pantalla se vuelve a dibujar
                  │
                  └──► sync.js (si hay sesión e internet)
                          1. sube lo pendiente a Supabase
                          2. baja todo y lo mezcla: gana el cambio más reciente
```

## Equivalencias con el Excel

| Excel | App |
|---|---|
| Tabla *Registro* | Pestaña **Movimientos** |
| Hoja *Dashboard* con selector de mes | Pestaña **Resumen** con flechas ‹ › para cambiar de mes |
| Ingresos / Egresos / Saldo con Ppto y Dif | Tarjetas de arriba del Resumen |
| Resumen por categoría y tablas de conceptos | Listas por categoría (tócalas para ver los conceptos) |
| Hoja *Lista Validadas* | **Ajustes → Categorías** |

## Actualizar la app después de cambiar código

El service worker guarda una copia de los archivos. Si cambias algo y no lo ves, recarga la página
una vez más. Si agregas un archivo nuevo, súmalo a la lista `ARCHIVOS` de `sw.js` y cambia
`CACHE = 'finanzas-v1'` a `'finanzas-v2'`.
