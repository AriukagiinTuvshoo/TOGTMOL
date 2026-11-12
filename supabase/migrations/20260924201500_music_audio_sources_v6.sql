-- Native audio sources for the music queue. StudyData schema stays 5: this
-- migration only widens the relational validation of public.music_sources.
-- Policy: an audio source is either a portable URL (audioUrl) that syncs to
-- every device, or a device-only file (audioStorageKey) whose bytes never leave
-- the device that added it. The payload is still validated here so a synced
-- record can never be unplayable on every device.
alter table public.music_sources
  alter column youtube_id drop not null;

alter table public.music_sources
  drop constraint if exists music_sources_kind_check;
alter table public.music_sources
  drop constraint if exists music_sources_check;
alter table public.music_sources
  drop constraint if exists music_sources_check1;

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
        coalesce((payload->>'audioUrl') ~* '^https?://', false)
        or coalesce((payload->>'audioStorageKey') ~ '^musicblob_[A-Za-z0-9_-]{8,160}$', false)
      )
    )
  );
