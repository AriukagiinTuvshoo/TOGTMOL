-- Native audio source support. StudyData schema remains v5; this migration
-- only widens the relational validation for music_sources.
alter table public.music_sources
  alter column youtube_id drop not null;

alter table public.music_sources
  drop constraint if exists music_sources_kind_check;

alter table public.music_sources
  drop constraint if exists music_sources_check;

alter table public.music_sources
  add constraint music_sources_kind_check
  check (kind in ('video', 'playlist', 'audio'));

alter table public.music_sources
  add constraint music_sources_payload_check
  check (
    (kind = 'video' and youtube_id ~ '^[a-zA-Z0-9_-]{11}$')
    or
    (kind = 'playlist' and youtube_id ~ '^[a-zA-Z0-9_-]{10,100}$')
    or
    (
      kind = 'audio'
      and (
        (payload->>'audioUrl') ~* '^https?://'
        or (payload->>'audioStorageKey') ~ '^musicblob_[A-Za-z0-9_-]{8,160}$'
      )
    )
  );
