-- IDs remain TEXT to preserve every v2 identifier. Payload retains extension fields;
-- generated relational columns support joins, filters and indexes without drift.
create table public.subjects (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id),
  name text generated always as (payload->>'name') stored not null,
  color text generated always as (payload->>'color') stored,
  icon text generated always as (payload->>'icon') stored,
  archived boolean generated always as ((payload->>'archived')::boolean) stored,
  created_at bigint generated always as ((payload->>'createdAt')::bigint) stored,
  updated_at bigint generated always as ((payload->>'updatedAt')::bigint) stored,
  deleted_at bigint generated always as ((payload->>'deletedAt')::bigint) stored,
  primary key (user_id,id)
);
create table public.study_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id),
  subject_id text generated always as (payload->>'subjectId') stored not null,
  date text generated always as (payload->>'date') stored not null,
  start_time bigint generated always as ((payload->>'startEpoch')::bigint) stored,
  end_time bigint generated always as ((payload->>'endEpoch')::bigint) stored,
  duration_sec numeric generated always as ((payload->>'durationSec')::numeric) stored not null check (duration_sec >= 0),
  duration_minutes numeric generated always as ((payload->>'durationSec')::numeric / 60) stored,
  note text generated always as (payload->>'note') stored,
  created_at bigint generated always as ((payload->>'createdAt')::bigint) stored,
  updated_at bigint generated always as ((payload->>'updatedAt')::bigint) stored,
  deleted_at bigint generated always as ((payload->>'deletedAt')::bigint) stored,
  primary key (user_id,id),
  foreign key (user_id,subject_id) references public.subjects(user_id,id)
);
create table public.study_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id),
  subject_id text generated always as (payload->>'subjectId') stored not null,
  date text generated always as (payload->>'date') stored not null,
  created_at bigint generated always as ((payload->>'createdAt')::bigint) stored,
  updated_at bigint generated always as ((payload->>'updatedAt')::bigint) stored,
  deleted_at bigint generated always as ((payload->>'deletedAt')::bigint) stored,
  primary key (user_id,id),
  foreign key (user_id,subject_id) references public.subjects(user_id,id)
);
create table public.daily_tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id),
  subject_id text generated always as (payload->>'subjectId') stored not null,
  date text generated always as (payload->>'date') stored not null,
  title text generated always as (payload->>'title') stored,
  minutes numeric generated always as ((payload->>'minutes')::numeric) stored check (minutes > 0 and minutes <= 1440),
  completed boolean generated always as ((payload->>'completed')::boolean) stored,
  updated_at bigint generated always as ((payload->>'updatedAt')::bigint) stored,
  deleted_at bigint generated always as ((payload->>'deletedAt')::bigint) stored,
  primary key (user_id,id),
  foreign key (user_id,subject_id) references public.subjects(user_id,id)
);
create table public.goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  weekly_hours numeric generated always as ((payload->>'weeklyHours')::numeric) stored check (weekly_hours > 0),
  weekly_days numeric generated always as ((payload->>'weeklyDays')::numeric) stored check (weekly_days >= 1 and weekly_days <= 7),
  updated_at bigint generated always as ((payload->>'updatedAt')::bigint) stored
);
create table public.achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null,
  unlocked_at text not null,
  primary key (user_id,achievement_key)
);
create table public.study_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);
create index study_sessions_user_subject_date_idx on public.study_sessions(user_id,subject_id,date);
create index study_sessions_user_date_idx on public.study_sessions(user_id,date);
create index study_entries_user_subject_date_idx on public.study_entries(user_id,subject_id,date);
create index daily_tasks_user_subject_date_idx on public.daily_tasks(user_id,subject_id,date);

-- Every relation is private to its owner. Never authorize from editable user_metadata.
do $$
declare relation text;
begin
  foreach relation in array array['subjects','study_sessions','study_entries','daily_tasks','goals','achievements','study_profiles'] loop
    execute format('alter table public.%I enable row level security',relation);
    execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)',relation);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',relation);
    execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',relation);
    execute format('revoke all on public.%I from anon, authenticated',relation);
    execute format('grant select, insert, update on public.%I to authenticated',relation);
  end loop;
end $$;

create function public.pull_study_data(expected_user_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare owner uuid := auth.uid(); result jsonb; rev bigint;
begin
  if owner is null or owner <> expected_user_id then raise exception 'Account changed' using errcode = '42501'; end if;
  select p.revision, p.payload into rev,result from public.study_profiles p where p.user_id=owner;
  result := coalesce(result,'{}'::jsonb) || jsonb_build_object(
    'schemaVersion',3,
    'subjects',coalesce((select jsonb_agg(s.payload order by s.id) from public.subjects s where s.user_id=owner),'[]'::jsonb),
    'sessions',coalesce((select jsonb_agg(s.payload order by s.id) from public.study_sessions s where s.user_id=owner),'[]'::jsonb),
    'entries',coalesce((select jsonb_agg(s.payload order by s.id) from public.study_entries s where s.user_id=owner),'[]'::jsonb),
    'tasks',coalesce((select jsonb_agg(s.payload order by s.id) from public.daily_tasks s where s.user_id=owner),'[]'::jsonb),
    'goals',coalesce((select g.payload from public.goals g where g.user_id=owner),'{}'::jsonb),
    'achievementsUnlocked',coalesce((select jsonb_object_agg(a.achievement_key,a.unlocked_at) from public.achievements a where a.user_id=owner),'{}'::jsonb),
    'activeTimer',null);
  return jsonb_build_object('revision',coalesce(rev,0),'data',result);
end $$;

create function public.push_study_data(expected_user_id uuid, expected_revision bigint, document jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare owner uuid := auth.uid(); rev bigint; relation text; collection text;
begin
  if owner is null or owner <> expected_user_id then raise exception 'Account changed' using errcode = '42501'; end if;
  if document->>'schemaVersion' is distinct from '3' then raise exception 'Unsupported schema' using errcode='22023'; end if;
  insert into public.study_profiles(user_id) values(owner) on conflict(user_id) do nothing;
  select p.revision into rev from public.study_profiles p where p.user_id=owner for update;
  if rev <> expected_revision then raise exception 'Cloud revision changed' using errcode='40001'; end if;
  for relation,collection in select * from (values ('subjects','subjects'),('study_sessions','sessions'),('study_entries','entries'),('daily_tasks','tasks')) as mappings(table_name,property_name) loop
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
