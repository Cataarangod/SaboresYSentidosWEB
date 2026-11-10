-- Pega esto en Supabase → SQL Editor → Run
create table pedidos (
  id bigint generated always as identity primary key,
  creado timestamptz default now(),
  estado text default 'pendiente',        -- pendiente | confirmado | entregado | cancelado
  nombre text, whatsapp text, email text, municipio text, direccion text, notas text, carta text,
  entrega_desde text, entrega_hasta text,
  items jsonb, total int, total_cliente int, preventa boolean,
  pago text, anticipo int, saldo int,
  saldo_cobrado boolean default false,
  comprobante_url text
);
alter table pedidos enable row level security;   -- sin políticas: solo el servidor (clave secreta) puede leer/escribir
insert into storage.buckets (id, name, public) values ('comprobantes', 'comprobantes', false);
