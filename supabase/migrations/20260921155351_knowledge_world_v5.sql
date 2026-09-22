-- V5 is additive. Apply after v3/v4. Old clients cannot overwrite v5 knowledge.
create table public.knowledge_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'id'=id),
  kind text generated always as (payload->>'kind') stored not null check(kind in ('note','deck','card','review','quiz','attempt','link')),
  subject_id text generated always as (payload->>'subjectId') stored,
  updated_at bigint generated always as ((payload->>'updatedAt')::bigint) stored not null,
  primary key(user_id,id),
  foreign key(user_id,subject_id) references public.subjects(user_id,id)
);
create index knowledge_records_user_kind_idx on public.knowledge_records(user_id,kind);
alter table public.knowledge_records enable row level security;
create policy owner_select on public.knowledge_records for select to authenticated using((select auth.uid())=user_id);
create policy owner_insert on public.knowledge_records for insert to authenticated with check((select auth.uid())=user_id);
create policy owner_update on public.knowledge_records for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
revoke all on public.knowledge_records from anon,authenticated;
grant select,insert,update on public.knowledge_records to authenticated;
create or replace function public.pull_study_data(expected_user_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare owner uuid := auth.uid(); result jsonb; rev bigint;
begin
  if owner is null or owner is distinct from expected_user_id then raise exception 'Account changed' using errcode = '42501'; end if;
  select p.revision, p.payload into rev,result from public.study_profiles p where p.user_id=owner;
  result := coalesce(result,'{}'::jsonb) || jsonb_build_object(
    'schemaVersion',5,
    'subjects',coalesce((select jsonb_agg(s.payload order by s.id) from public.subjects s where s.user_id=owner),'[]'::jsonb),
    'sessions',coalesce((select jsonb_agg(s.payload order by s.id) from public.study_sessions s where s.user_id=owner),'[]'::jsonb),
    'entries',coalesce((select jsonb_agg(s.payload order by s.id) from public.study_entries s where s.user_id=owner),'[]'::jsonb),
    'tasks',coalesce((select jsonb_agg(s.payload order by s.id) from public.daily_tasks s where s.user_id=owner),'[]'::jsonb),
    'studyGoals',coalesce((select jsonb_agg(s.payload order by s.id) from public.study_goals s where s.user_id=owner),'[]'::jsonb),
    'knowledge',coalesce((select jsonb_agg(s.payload order by s.id) from public.knowledge_records s where s.user_id=owner),'[]'::jsonb),
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
  if document->>'schemaVersion' is distinct from '5' then raise exception 'Unsupported schema' using errcode='22023'; end if;
  insert into public.study_profiles(user_id) values(owner) on conflict(user_id) do nothing;
  select p.revision into rev from public.study_profiles p where p.user_id=owner for update;
  if coalesce((select (p.payload->'extras'->>'cloudResetAt')::bigint from public.study_profiles p where p.user_id=owner),0) > coalesce((document->'extras'->>'cloudResetAt')::bigint,0) then raise exception 'Cloud reset requires explicit consent' using errcode='22023'; end if;
  if rev <> expected_revision then raise exception 'Cloud revision changed' using errcode='40001'; end if;
  for relation,collection in select * from (values ('subjects','subjects'),('study_goals','studyGoals'),('music_sources','musicSources'),('knowledge_records','knowledge'),('study_sessions','sessions'),('study_entries','entries'),('daily_tasks','tasks')) as mappings(table_name,property_name) loop
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


-- A reset retains a monotonically increasing revision and a deletion epoch.
-- Another device must explicitly acknowledge that epoch before re-uploading local history.
do $$ declare relation text; begin
  foreach relation in array array['subjects','study_sessions','study_entries','daily_tasks','study_goals','music_sources','knowledge_records','goals','achievements'] loop
    execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid())=user_id)',relation);
    execute format('grant delete on public.%I to authenticated',relation);
  end loop;
end $$;
create function public.delete_cloud_study_data(expected_user_id uuid, expected_revision bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare owner uuid:=auth.uid(); rev bigint; stamp bigint;
begin
  if owner is null or owner is distinct from expected_user_id then raise exception 'Account changed' using errcode='42501'; end if;
  insert into public.study_profiles(user_id) values(owner) on conflict(user_id) do nothing;
  select p.revision into rev from public.study_profiles p where p.user_id=owner for update;
  if rev <> expected_revision then raise exception 'Cloud revision changed' using errcode='40001'; end if;
  stamp:=greatest(floor(extract(epoch from clock_timestamp())*1000)::bigint,coalesce((select (p.payload->'extras'->>'cloudResetAt')::bigint from public.study_profiles p where p.user_id=owner),0)+1);
  delete from public.knowledge_records where user_id=owner;
  delete from public.study_sessions where user_id=owner;
  delete from public.study_entries where user_id=owner;
  delete from public.daily_tasks where user_id=owner;
  delete from public.study_goals where user_id=owner;
  delete from public.music_sources where user_id=owner;
  delete from public.goals where user_id=owner;
  delete from public.achievements where user_id=owner;
  delete from public.subjects where user_id=owner;
  rev:=rev+1;
  update public.study_profiles set revision=rev,updated_at=now(),payload=jsonb_build_object('extras',jsonb_build_object('cloudResetAt',stamp)) where user_id=owner;
  return jsonb_build_object('revision',rev,'resetAt',stamp);
end $$;
revoke all on function public.delete_cloud_study_data(uuid,bigint) from public,anon;
grant execute on function public.delete_cloud_study_data(uuid,bigint) to authenticated;
