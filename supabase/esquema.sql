-- Esquema de la base de datos de la app Finanzas.
-- Cópialo completo en Supabase -> SQL Editor -> New query y presiona "Run".
-- Se puede correr más de una vez sin problema.

create table if not exists public.movimientos (
  id           uuid primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha        date not null,
  tipo         text not null check (tipo in ('Ingreso', 'Egreso')),
  categoria    text not null,
  concepto     text not null default '',
  presupuesto  numeric(12, 2) not null default 0,
  monto        numeric(12, 2) not null default 0,
  actualizado  timestamptz not null default now(),
  borrado      boolean not null default false
);

create table if not exists public.categorias (
  id           uuid primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo         text not null check (tipo in ('Ingreso', 'Egreso')),
  nombre       text not null,
  actualizado  timestamptz not null default now(),
  borrado      boolean not null default false
);

create index if not exists movimientos_usuario_fecha on public.movimientos (user_id, fecha);

-- Seguridad: cada usuario solo puede ver y modificar sus propias filas (Row Level Security)
alter table public.movimientos enable row level security;
alter table public.categorias enable row level security;

drop policy if exists "Solo mis movimientos" on public.movimientos;
create policy "Solo mis movimientos" on public.movimientos
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Solo mis categorias" on public.categorias;
create policy "Solo mis categorias" on public.categorias
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.movimientos, public.categorias to authenticated;
