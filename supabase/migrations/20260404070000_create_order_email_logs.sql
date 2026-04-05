create table if not exists public.order_email_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  email_to text,
  template_key text not null,
  status text not null,
  provider_message_id text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_email_logs_order_id_idx on public.order_email_logs(order_id);
create index if not exists order_email_logs_created_at_idx on public.order_email_logs(created_at desc);
