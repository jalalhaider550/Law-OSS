create table if not exists public.user_data (
  user_id text primary key,
  matters jsonb not null default '[]'::jsonb,
  projects jsonb not null default '[]'::jsonb,
  contracts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;
create policy "Users own data select" on public.user_data for select using (auth.uid()::text = user_id);
create policy "Users own data all" on public.user_data for all using (auth.uid()::text = user_id);
