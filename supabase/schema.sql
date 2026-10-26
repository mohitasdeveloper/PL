-- Run in Supabase SQL editor.
-- Already created the table? Just run: alter table plastic_logs alter column description drop not null;
-- Then: Auth > Providers > turn OFF "Allow new users to sign up", and add admins under Auth > Users.
create table plastic_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  student_id text not null,
  name text not null,
  course text not null,
  dp_url text,
  weight_kg numeric(8,2) not null check (weight_kg > 0),
  description text,
  program text not null,
  collection_point text not null,
  proof_url text not null,
  status text not null default 'pending' check (status in ('pending','accepted','rejected'))
);
alter table plastic_logs enable row level security;
create policy "students insert" on plastic_logs for insert to anon with check (status = 'pending');
create policy "admins read" on plastic_logs for select to authenticated using (true);
create policy "admins update" on plastic_logs for update to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values ('plastic-proofs', 'plastic-proofs', true)
  on conflict do nothing;
create policy "students upload proof" on storage.objects for insert to anon
  with check (bucket_id = 'plastic-proofs');

-- Leaderboard: students can only insert, so expose just the top-50 totals through this function.
create or replace function leaderboard()
returns table (student_id text, name text, course text, dp_url text, total_kg numeric, entries bigint)
language sql security definer set search_path = public as $$
  select l.student_id, max(l.name), max(l.course), max(l.dp_url), sum(l.weight_kg), count(*)
  from plastic_logs l
  where l.status = 'accepted'
  group by l.student_id
  order by sum(l.weight_kg) desc, count(*) desc
  limit 50;
$$;
grant execute on function leaderboard() to anon, authenticated;
