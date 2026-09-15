-- Additive v4 migration. Existing rows, IDs and v3 history remain intact.
create table public.study_goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id),
  subject_id text generated always as (payload->>'subjectId') stored not null,
  title text generated always as (payload->>'title') stored not null,
  weekly_minutes numeric generated always as ((payload->>'weeklyMinutes')::numeric) stored not null check (weekly_minutes > 0 and weekly_minutes <= 10080),
  target_minutes numeric generated always as ((payload->>'targetMinutes')::numeric) stored not null check (target_minutes > 0),
  updated_at bigint generated always as ((payload->>'updatedAt')::bigint) stored,
  deleted_at bigint generated always as ((payload->>'deletedAt')::bigint) stored,
  primary key (user_id,id),
  foreign key (user_id,subject_id) references public.subjects(user_id,id)
);
create index study_goals_user_subject_idx on public.study_goals(user_id,subject_id);
create table public.music_sources (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id),
  title text generated always as (payload->>'title') stored not null,
  kind text generated always as (payload->>'kind') stored not null check (kind in ('video','playlist')),
  youtube_id text generated always as (payload->>'youtubeId') stored not null,
  updated_at bigint generated always as ((payload->>'updatedAt')::bigint) stored,
  deleted_at bigint generated always as ((payload->>'deletedAt')::bigint) stored,
  check ((kind='video' and youtube_id ~ '^[a-zA-Z0-9_-]{11}$') or (kind='playlist' and youtube_id ~ '^[a-zA-Z0-9_-]{10,100}$')),
  primary key(user_id,id)
);
do $$
declare relation text;
begin
  foreach relation in array array['study_goals','music_sources'] loop
    execute format('alter table public.%I enable row level security',relation);
    execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)',relation);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',relation);
    execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',relation);
    execute format('revoke all on public.%I from anon, authenticated',relation);
    execute format('grant select, insert, update on public.%I to authenticated',relation);
  end loop;
end $$;
create or replace function public.pull_study_data(expected_user_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare owner uuid := auth.uid(); result jsonb; rev bigint;
begin
  if owner is null or owner is distinct from expected_user_id then raise exception 'Account changed' using errcode = '42501'; end if;
  select p.revision, p.payload into rev,result from public.study_profiles p where p.user_id=owner;
  result := coalesce(result,'{}'::jsonb) || jsonb_build_object(
    'schemaVersion',4,
    'subjects',coalesce((select jsonb_agg(s.payload order by s.id) from public.subjects s where s.user_id=owner),'[]'::jsonb),
    'sessions',coalesce((select jsonb_agg(s.payload order by s.id) from public.study_sessions s where s.user_id=owner),'[]'::jsonb),
    'entries',coalesce((select jsonb_agg(s.payload order by s.id) from public.study_entries s where s.user_id=owner),'[]'::jsonb),
    'tasks',coalesce((select jsonb_agg(s.payload order by s.id) from public.daily_tasks s where s.user_id=owner),'[]'::jsonb),
    'studyGoals',coalesce((select jsonb_agg(s.payload order by s.id) from public.study_goals s where s.user_id=owner),'[]'::jsonb),
    'musicSources',coalesce((select jsonb_agg(s.payload order by s.id) from public.music_sources s where s.user_id=owner),'[]'::jsonb),
    'goals',coalesce((select g.payload from public.goals g where g.user_id=owner),'{}'::jsonb),
    'achievementsUnlocked',coalesce((select jsonb_object_agg(a.achievement_key,a.unlocked_at) from public.achievements a where a.user_id=owner),'{}'::jsonb),
    'activeTimer',null);
  return jsonb_build_object('revision',coalesce(rev,0),'data',result);
end $$;

create or replace function public.push_study_data(expected_user_id uuid, expected_revision bigint, document jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare owner uuid := auth.uid(); rev bigint; relation text; collection text;
begin
  if owner is null or owner is distinct from expected_user_id then raise exception 'Account changed' using errcode = '42501'; end if;
  if document->>'schemaVersion' is distinct from '4' then raise exception 'Unsupported schema' using errcode='22023'; end if;
  insert into public.study_profiles(user_id) values(owner) on conflict(user_id) do nothing;
  select p.revision into rev from public.study_profiles p where p.user_id=owner for update;
  if rev <> expected_revision then raise exception 'Cloud revision changed' using errcode='40001'; end if;
  for relation,collection in select * from (values ('subjects','subjects'),('study_goals','studyGoals'),('music_sources','musicSources'),('study_sessions','sessions'),('study_entries','entries'),('daily_tasks','tasks')) as mappings(table_name,property_name) loop
    if jsonb_typeof(document->collection) is distinct from 'array' then raise exception 'Invalid collection' using errcode='22023'; end if;
    execute format('insert into public.%I(user_id,id,payload) select $1, value->>''id'', value from jsonb_array_elements($2) on conflict(user_id,id) do update set payload=excluded.payload',relation) using owner,document->collection;
  end loop;
  insert into public.goals(user_id,payload) values(owner,document->'goals') on conflict(user_id) do update set payload=excluded.payload;
  insert into public.achievements(user_id,achievement_key,unlocked_at) select owner,key,value from jsonb_each_text(document->'achievementsUnlocked') on conflict(user_id,achievement_key) do update set unlocked_at=excluded.unlocked_at;
  rev:=rev+1;
  update public.study_profiles set revision=rev,updated_at=now(),payload=jsonb_build_object('settings',document->'settings','extras',document->'extras','quarantine',document->'quarantine','conflicts',document->'conflicts') where user_id=owner;
  return jsonb_build_object('revision',rev);
end $$;
revoke all on function public.pull_study_data(uuid) from public,anon;
revoke all on function public.push_study_data(uuid,bigint,jsonb) from public,anon;
grant execute on function public.pull_study_data(uuid) to authenticated;
grant execute on function public.push_study_data(uuid,bigint,jsonb) to authenticated;

-- Only a bounded authenticated RPC may change AI quotas. No API table access.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.togi_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  used integer not null check (used between 1 and 20),
  primary key(user_id,day)
);
alter table private.togi_usage enable row level security;
revoke all on private.togi_usage from public,anon,authenticated;
create function public.consume_togi_request(expected_user_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); result integer; today_utc date := (now() at time zone 'UTC')::date;
begin
  if owner is null or owner is distinct from expected_user_id then raise exception 'Account changed' using errcode='42501'; end if;
  insert into private.togi_usage(user_id,day,used) values(owner,today_utc,1)
  on conflict(user_id,day) do update set used=private.togi_usage.used+1 where private.togi_usage.used<20
  returning used into result;
  return result is not null;
end $$;
revoke all on function public.consume_togi_request(uuid) from public,anon;
grant execute on function public.consume_togi_request(uuid) to authenticated;
