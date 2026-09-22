# Хөгжмийн системийн засвар

2026-09-22 · Анхны суурь: `771b41a1a53564bab2cd87bbcba39f9ccca387d4`. GitHub-д оруулахын өмнө таймерын тусдаа шинэчлэлтүүдтэй `59d89edd4bd073875e350bbc4271f360a1334800` суурь дээр нэгтгэсэн; тэдгээрийн кодыг өөрчлөөгүй.

## Яг ямар шалтгаан байсан бэ?

1. `MusicPlayer`-ийн `{open && ...}` дотор `YouTubeEmbed` байсан. Багасгахад iframe unmount болж, effect cleanup `player.destroy()` дууддаг байв. Дахин нээхэд шинэ iframe үүсдэг байсан.
2. `minimize()` нь `requiresVisiblePlayer`-ийг шалгаад pause хийдэг; `visibilitychange` болон `IntersectionObserver` мөн pause хийдэг байв.
3. Өмнөх YouTube API-ready callback алдаа шидэхэд барихгүй байсан. Async/iframe callback дахь алдааг React render boundary дангаараа барьдаггүй. Салсан player reference дээр удирдлага дуудах эрсдэл байсан.
4. Volume, last-played зэрэг хязгаарлагдмал тохиргоо хадгалагддаг байсан; нээсэн/багасгасан төлөв, playback intent, одоогийн playlist index/track metadata бүрэн хадгалагддаггүй байв.
5. Хөгжмийн тохиргооны бичилт нийт аппын `busy` төлөвийг асаадаг байсан. Хөгжим багасгасны дараах Start товч даралт ийм бичилттэй давхцахад түр хаагддагийг интеграцийн тестээр давтаж олсон. Music settings-ийн алдаа мөн ерөнхий алдааны сувгийг ашигладаг байв.

Байршуулсан хувилбарын runtime log өгөөгүй тул хэрэглэгчийн харсан бүх initialization error-ийн ганц шалтгааныг тогтоосон гэж үзэхгүй. Дээрх нь эх кодоос болон давтагдах тестээс баталсан замууд юм.

## Засвар

- Одоогийн `AppShell` дэх тогтвортой `MusicProvider` байрлалыг хадгалсан. AppShell, timer болон view navigation-ийн кодыг өөрчлөөгүй.
- `MusicProvider` удирдлага/төлөвийг эзэмшинэ. YouTube болон generated/local audio нь одоогийн adapter интерфейсээр Play, Pause, Stop, Volume үйлдлээ гүйцэтгэнэ.
- Нэг iframe нь том болон жижиг харагдацад ижил DOM байрлалтай үлдэнэ. Хуудас солих, minimize/expand, volume болон таймерын өөрчлөлтөөр дахин үүсэхгүй. Зөвхөн source солих, explicit Retry, бүртгэл/апп гарах үед iframe cleanup ажиллана.
- Play/Pause, Volume, Expand, Stop жижиг тоглуулагч дээр бий. Pause байрлалаа хадгална; Stop албан ёсны `stopVideo()` эсвэл local source stop-ийг дуудаж, дахин тоглоход эхнээс нь эхлүүлнэ.
- `visibilitychange`/intersection/minimize pause-ийг хассан. Native YouTube болон браузер өөрөө тоглолтыг зогсоовол бодит iframe state-ийг дагана.
- Render алдаанд жижиг хөгжмийн boundary, API/async/command/storage алдаанд локал мэдэгдэл ба Retry ашиглана. Failed API script-ийг дахин ачаалж болно; хуучин callback, салсан metadata getter, cleanup дахь алдаа апп руу тархахгүй.
- `lib/persistence/store.ts`-д зөвхөн хоёр optional flag нэмсэн. Хөгжмийн бичилт ерөнхий `busy` төлөвийг асаахгүй, ерөнхий алдааг үүсгэхгүй/арилгахгүй. Анхдагч үйлдэл бусад бүх caller-д хэвээр; сериалчлал, backup, revision/CAS, IndexedDB save хэвээр. Database schema, migration, Supabase өөрчлөгдөөгүй.
- Desktop-д доод булангийн dock; mobile-д navigation-ийн дээр байрлах dock. Дууны түвшин mobile дээр ч харагдана. Dock-ийн хэмжээгээр контентын доод зайг нэмж, timer controls руу гүйлгэж хүрэх боломжийг хадгална. Expanded panel жижиг дэлгэцэд гүйлгэгдэнэ.

## Хадгалдаг төлөв

Одоогийн `settings.extras.musicPreferences.session` дотор:

- `selection`: local sound эсвэл хадгалсан YouTube source-ийн ID;
- `open`: том/жижиг харагдац;
- `playback`: playing/paused/stopped гэсэн сүүлийн intent;
- `position`, `playlistIndex`;
- `track.title`, `track.artist`, `track.videoId`, `track.url`.

Volume/mute болон saved video/playlist нь одоогийн music preferences, `musicSources` дотроо үлдсэн. Шинэ database, storage key эсвэл хоёр дахь хадгалалтын систем нэмээгүй. Хуучин `togtmol:music:<namespace>` compatibility key болон одоогийн event холбоос хадгалагдсан; IndexedDB-ийн аппын документ үндсэн эх сурвалж хэвээр.

Команд, state event, minimize/expand дээр snapshot хадгална. YouTube тоглож байхад байрлалыг 15 секунд тутам шинэчилнэ; `pagehide` дээр best-effort checkpoint хийнэ. Браузер/OS процессыг гэнэт устгавал хамгийн сүүлийн агшны бичилтийг батлахгүй.

Аппыг шинээр нээхэд сүүлийн сонголт, байрлал, харагдацыг сэргээнэ. Өмнө нь playing байсан ч шинэ iframe/AudioContext аль хэдийн тоглож байгаа мэт харуулахгүй, autoplay хийхгүй: хэрэглэгч Play дарж үргэлжлүүлнэ.

## Шалгалт

`npm run check` тэнцсэн: TypeScript, ESLint, **162 тест / 18 файл**, production build. `npm run build` мөн тусдаа тэнцсэн. Хөгжмийн өөрчилсөн файлуудын формат тэнцсэн. Хөгжимд зориулсан **16 шинэ тест** нэмсэн; өмнөх хөгжмийн тестүүдийн minimize хүлээлтийг шинэчилсэн.

Шалгасан зүйл:

- minimize/expand таван давталтад ижил iframe, ганц play, pause/destroy байхгүй;
- **Overview → Calendar → Subjects → Statistics → Room → AI → Overview** дараалалд тоглолт хэвээр;
- explicit Stop болон Pause ялгаатай, Stop iframe-ийг устгахгүй;
- playlist index, одоогийн video ID/URL/title/artist, volume, байрлал, minimized төлөв дахин нээхэд сэргээгдэх; autoplay байхгүй;
- visibility/intersection болон mobile хэмжээ рүү resize хийхэд тоглуулагч устахгүй, үндсэн товч/volume үлдэх;
- iframe constructor, API script, player callback/command, render болон storage алдаа хөгжмийн хэсэгт үлдэх;
- хаалттай localStorage + ажиллаж буй IndexedDB;
- таймер Start/Pause/Resume/Finish/Save үед хөгжим хэвээр;
- хөгжмийн хадгалалт ерөнхий busy/алдаанд нөлөөлөхгүй, study record-ууд өөрчлөгдөхгүй;
- Media Session play/pause/next/previous, metadata болон exit cleanup;
- есөн local sound-ийн бодит sample үүсгэлт; local pause/resume/stop; Stop-оос хожуу дууссан audio resume-г хүчингүй болгох.

Сүүлийн `59d89ed` суурийг нэгтгэсний дараах нийт төслийн `npm run format:check` нь өмнө нь өөрчлөгдсөн дараах дөрвөн файл дээр унасан: `app/globals.css`, `components/settings/settings.tsx`, `components/timer/study-timer.tsx`, `lib/notifications.ts`. Эдгээр файл хөгжмийн patch-д ороогүй, эх суурьтайгаа byte-for-byte ижил. Тиймээс GitHub-ийн үндсэн validation workflow-ийн формат шат мөн энэ зөрүүнд өртөнө; `npm run check` болон `npm run build`-ийн амжилтаас тусад нь авч үзнэ. Зөвхөн хөгжим засах хүрээнд эдгээр файлыг форматлаагүй.

React урсгалууд **jsdom**, YouTube API болон Media Session нь орлуулсан implementation ашигласан. Navigation тест нь бодит AppShell/дэлгэцүүдийг ажиллуулдаг боловч YouTube-ийн жинхэнэ сүлжээ, дуу болон mobile CSS дүрслэлийг баталдаггүй.

## Background / PWA / lock screen

Media Session API дэмжигдсэн үед play, pause, stop, nexttrack, previoustrack handler болон metadata/playback state бүртгэнэ. Дэмждэггүй action болон API алдааг барина. Энэ API нь background permission олгодоггүй, iframe-ийг native audio үйлчилгээ болгодоггүй.

Апп өөрөө minimized, hidden tab, off-screen гэсэн шалтгаанаар pause хийхгүй. Гэхдээ **browser background, PWA background, утас түгжсэн үеийн тоглолтыг баталгаажуулаагүй бөгөөд баталгаа өгөхгүй**. YouTube iframe, autoplay дүрэм, Web Audio lifecycle, browser/OS suspension үргэлж үйлчилнэ. PWA нь native background-audio service биш. Hidden audio, extraction, scraping, download эсвэл browser restriction тойрох арга нэмээгүй.

Энэ орчны браузер `http://localhost:3110` дээр `ERR_BLOCKED_BY_CLIENT` өгсөн. Өөр замаар тойроогүй. Бодит deployed URL дээр Chrome/Safari, iOS/Android, install хийсэн PWA, бодит YouTube video/playlist болон дэлгэц түгжих урсгалыг тусад нь шалгах шаардлагатай.

Албан ёсны лавлагаа:

- [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference): Play/Pause/Stop, cuePlaylist, getCurrentTime, getPlaylistIndex; iframe хамгийн багадаа 200 × 200 px.
- [MediaSession.setActionHandler](https://developer.mozilla.org/en-US/docs/Web/API/MediaSession/setActionHandler): action-ууд болон browser support-ийн хязгаар.

## Өөрчилсөн файлууд

```text
components/music/music-player.tsx
components/music/music-provider.tsx
components/music/music.css
components/music/youtube-embed.tsx
components/settings/music-settings.tsx
hooks/use-music-media-session.ts
hooks/use-music-preference.ts
lib/music/ambient.ts
lib/music/preferences.ts
lib/music/provider.ts
lib/music/youtube-player.ts
lib/persistence/store.ts
tests/media-v5.test.tsx
tests/music-player.test.tsx
tests/music.test.ts
tests/ui.test.tsx
README.md
docs/DEPLOYMENT.md
docs/MUSIC.md
```
