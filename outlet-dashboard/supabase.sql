-- Outlet performance: one row per outlet per week.
create table if not exists public.outlet_weekly (
  outlet  text    not null,
  week    date    not null,
  sales   numeric not null check (sales >= 0),
  target  numeric not null check (target > 0),
  orders  integer not null check (orders >= 0),
  returns integer not null check (returns >= 0),
  primary key (outlet, week)
);

-- The dashboard reads with the public publishable key, so allow read-only access.
alter table public.outlet_weekly enable row level security;
drop policy if exists "Public read outlet_weekly" on public.outlet_weekly;
create policy "Public read outlet_weekly" on public.outlet_weekly
  for select to anon, authenticated using (true);

-- Seed from the original CSV. Re-running updates the same outlet-weeks.
insert into public.outlet_weekly (outlet, week, sales, target, orders, returns) values
  ('Tampines','2026-09-07',18400,18000,612,9),
  ('Tampines','2026-09-14',16100,18000,540,14),
  ('Tampines','2026-09-21',19200,18000,640,8),
  ('Jurong','2026-09-07',14200,15000,488,11),
  ('Jurong','2026-09-14',12600,15000,430,19),
  ('Jurong','2026-09-21',15300,15000,512,10),
  ('Orchard','2026-09-07',22500,24000,690,12),
  ('Orchard','2026-09-14',20100,24000,612,21),
  ('Orchard','2026-09-21',24800,24000,742,9)
on conflict (outlet, week) do update set
  sales = excluded.sales, target = excluded.target,
  orders = excluded.orders, returns = excluded.returns;
