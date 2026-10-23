# Activar la sincronización en la nube (Supabase)

Supabase es una base de datos en la nube con plan gratuito. Con ella tus movimientos
se guardan en tu cuenta y los ves igual en el celular y en la PC. Toma unos 10 minutos.

## 1. Crear el proyecto

1. Entra a <https://supabase.com> y crea una cuenta (puedes usar tu cuenta de GitHub o Google).
2. Presiona **New project**.
   - **Name:** `finanzas`
   - **Database password:** inventa una y guárdala (casi no la vas a usar).
   - **Region:** la más cercana (por ejemplo *East US* o *West US*).
3. Espera a que termine de crearse (1–2 minutos).

## 2. Crear las tablas

1. En el menú izquierdo abre **SQL Editor** → **New query**.
2. Copia todo el contenido de [`supabase/esquema.sql`](supabase/esquema.sql), pégalo y presiona **Run**.
3. Debe decir *Success. No rows returned*. En **Table Editor** ya verás las tablas
   `movimientos` y `categorias`.

## 3. Conectar la app

1. Ve a **Project Settings** (engrane) → **API Keys** (o **Data API**).
2. Copia estos dos datos:
   - **Project URL**: algo como `https://abcdxyz.supabase.co`
   - **anon public key** (o **publishable key**): un texto largo.
   ⚠️ **No** uses la `service_role` / `secret key`: esa sí es privada.
3. Pégalos en [`js/config.js`](js/config.js) (o pásamelos y lo hago yo):

   ```js
   export const CONFIG = {
     supabaseUrl: 'https://abcdxyz.supabase.co',
     supabaseKey: 'eyJhbGciOi...',
   };
   ```

## 4. Configurar el inicio de sesión

En **Authentication** → **Sign In / Providers** → **Email**:

- Opción sencilla: desactiva **Confirm email**. Así puedes crear tu cuenta y entrar de inmediato.
- Si lo dejas activado, Supabase te manda un correo de confirmación. En
  **Authentication → URL Configuration** pon como **Site URL** la dirección donde abres la app
  (por ejemplo `http://localhost:5173` mientras pruebas, o tu dirección pública después).

## 5. Usarla

1. Abre la app → **Ajustes** → escribe tu correo y una contraseña → **Crear cuenta**.
2. Todo lo que ya tenías en ese dispositivo se sube a tu cuenta.
3. En el otro dispositivo, abre la app y presiona **Entrar** con el mismo correo: se descargan tus datos.

Arriba a la derecha verás el estado: *✓ Sincronizado*, *Sincronizando…* o *Sin internet*.
Si no hay internet, los cambios se guardan y se suben solos cuando vuelva la conexión.

## ¿Es seguro poner la clave en el código?

Sí. La *anon/publishable key* está hecha para ir dentro de apps. Lo que protege tus datos son las
reglas **RLS** del archivo `esquema.sql`: cada usuario solo puede leer y modificar sus propias filas,
y para eso necesita haber iniciado sesión con su contraseña.
