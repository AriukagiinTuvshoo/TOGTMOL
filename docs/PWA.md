# PWA, гар утасны навигаци ба хүртээмж (Phase 2)

Огноо: 2026-11-12. Хэмжилт: `main` дээрх код, локал `npm run check`, jsdom тестүүд. Бодит iPhone/Android/Windows төхөөрөмж болон browser дээр хараахан туршаагүй — §5-д юу үлдсэнийг бичсэн.

## 1. Offline ажиллагаа

`scripts/service-worker.template.js` → `public/sw.js` (build бүрд `scripts/create-precache.mjs` үүсгэнэ; `__BUILD_ID__` нь static asset-уудын sha256).

Кэшлэдэг:

- аппын бүрхүүл `/`, `/manifest.webmanifest`, `/icons/*`, **`/privacy`, `/terms`** (Phase 2-т нэмсэн — өмнө нь offline үед эдгээр хуудас аппын нүүр рүү шилждэг байсан);
- `precache-manifest.json`-д орсон бүх `/_next/static/**` JS/CSS/woff.

Кэшлэдэггүй (зориуд): `/api/**`, `/auth/**`, `authorization` толгойтой, `code` / `access_token` / `error` query-тай, өөр origin-оос ирсэн бүх хүсэлт. Navigation хүсэлт сүлжээнд унасан үед кэшлэсэн `/`-г буцаана.

Шинэ worker нь `install` → `waiting` төлөвт хүлээж, хэрэглэгч «Одоо шинэчлэх» дарахад л `SKIP_WAITING` авч идэвхждэг. `controllerchange` дээр хуудас дахин ачаалагдана; 5 секундэд болохгүй бол тодорхой мессеж гарч, нээлттэй цонхыг хаахыг зөвлөнө. Хуучин `togtmol-shell-*` кэшүүд л устдаг, бусад аппын кэш хөндөгдөхгүй.

**Phase 2-т нэмсэн:** worker-ийг зөвхөн нээх үед шалгадаг байсныг өргөтгөж, таб дахин харагдах бүрд (хамгийн ихдээ минутад нэг удаа) `registration.update()` дуудна. Олон хоног нээлттэй үлдсэн таб ч шинэ хувилбарыг мэднэ.

## 2. Гар утасны навигаци

Доод тав: Нүүр, Мэдлэг, Төвлөрөх, Бондоок, Бусад. «Бусад» нь бүх дэлгэцийг агуулсан хуудасны доорх хуудас (sheet).

**Phase 2-т зассан:**

- Хуудас нь одоо `role="dialog"`, `aria-modal="true"`, `aria-label`-тай; нээгдэхэд эхний цэсэн дэх товч руу фокус шилжинэ, `Tab`/`Shift+Tab` хуудас дотор үлдэнэ, `Escape` болон backdrop дарахад хаагдаж, фокус «Бусад» товч руу буцна.
- «Бусад» товч `aria-expanded`, `aria-haspopup="dialog"`, `aria-controls="mobile-more-panel"`-той.
- `<nav>`-ийн `aria-label` нь хатуу бичсэн «Гар утасны цэс» байсныг орчуулга болгосон (`nav.mobileMenu`: «Гар утасны цэс» / «Mobile menu»). Хэл солиход landmark ч хамт солигдоно.
- Доод навигацийн товчнууд 52px өндөр (WCAG 2.5.8-ийн 44px-ээс дээш), `env(safe-area-inset-bottom)`-той тул iPhone-ийн доод зураастай давхцахгүй.

Тест: `tests/mobile-shell.test.tsx` (2 тест) — sheet-ийн dialog шинж, фокус шилжилт, `Escape`, фокус буцах, `aria-controls`, англи хэл дээрх landmark.

## 3. Хүртээмж

- **Контраст.** Дизайны токенуудыг WCAG-ийн харьцаагаар шалгав; бүх үндсэн хос 4.5:1-ээс дээш байна (доор). Токен өөрчлөх шаардлага гараагүй.

| Хос                     | Харьцаа | Хос                     | Харьцаа |
| ----------------------- | ------- | ----------------------- | ------- |
| Гэрэл: muted / surface  | 5.53    | Харанхуй: muted/surface | 6.52    |
| Гэрэл: muted / bg       | 5.06    | Харанхуй: muted / bg    | 7.36    |
| Гэрэл: muted / muted-bg | 4.87    | Харанхуй: text / bg     | 14.51   |
| Гэрэл: text / bg        | 12.75   | Харанхуй: moss/soft     | 5.60    |
| Гэрэл: moss / surface   | 6.85    | Харанхуй: danger/surf   | 7.82    |
| Гэрэл: moss / moss-soft | 5.80    |                         |         |
| Гэрэл: danger / surface | 5.82    |                         |         |
| Гэрэл: hero text        | 8.42    |                         |         |
| Гэрэл: hero eyebrow     | 6.28    |                         |         |

- `prefers-reduced-motion: reduce` 10 газарт (globals, knowledge) хүдэлгөөнийг хасдаг.
- `viewport`-д `maximum-scale`/`user-scalable=no` байхгүй — томруулах боломж нээлттэй.
- `<html lang="mn">`, хэл солиход `document.documentElement.lang` шинэчлэгдэнэ.
- `:focus-visible` бүх button/a/input/select/textarea-д тодорхойлогдсон; skip link `#main-content` руу шилжүүлнэ; toast ба timer `aria-live="polite"`, алдаа `role="alert"`.

## 4. Capacitor-ийн шийдвэр

`setup/capacitor-mobile-wrapper` салбар (PR #21) нь 112 файл, `main`-тай зөрчилтэй, CI улаан. Шинээр эхлэхгүй, **нийлүүлэхгүй**.

Шалтгаан нь зөвхөн код хуучирсан биш: апп нь сервер талын route-той (`/api/bondook`, `/api/bondook/cards`, `/api/bondook/plan`, `/api/bondook/quiz`, `/api/chimege/transcribe`). Capacitor-ийн энгийн `output: "export"` хувилбар эдгээр API-г бүрэн алдана; AI түлхүүрийг клиент рүү зөөх нь хүлээн авахгүй. Тиймээс store-д гарах шаардлага үнэхээр гарвал Capacitor-ийг **`server.url`-тай** (байршуулсан Worker руу заасан) ашиглана, статик хуулбар биш.

Одоогийн шийдвэр: **PWA-г үндсэн платформ хэвээр үлдээнэ.** Суулгах боломж, offline, update flow нь бүрэн ажиллаж байна.

## 5. Бодит төхөөрөмж дээр үлдсэн шалгалт

Энэ орчинд Chrome/Chromium байхгүй тул Lighthouse болон жинхэнэ browserын шалгалт хийгдээгүй. Дараахыг төхөөрөмж бүр дээр гараар хийнэ:

1. iOS Safari (нэмэх → Home Screen) ба Android Chrome (Install app): standalone горим, доод навигаци safe-area-тай давхцахгүй байх.
2. Онгоцны горимд нээх: үндсэн дэлгэцүүд, `/privacy`, `/terms` ажиллах; AI/YouTube/синк тодорхой мессеж өгөх.
3. Шинэ build байршуулж, нээлттэй табыг буцааж идэвхжүүлэх: «Шинэ хувилбар бэлэн» гарч, «Одоо шинэчлэх» дарахад дахин ачаалагдах.
4. Гар утсан дээр «Бусад» нээж, `Tab` (гарын товчлуур/Bluetooth), `Escape` ба фокус буцахыг шалгах.
5. iOS/Android дээр түгжээтэй дэлгэц, background дуу — энэ нь PWA-гийн баталгаа биш (`docs/MUSIC.md`).
6. `lighthouserc.cjs`-ийн gate-ууд (performance 0.8, accessibility 0.9, best-practices 0.9, SEO 0.9, PWA 0.8) CI-ийн `.github/workflows/lighthouse.yml`-ээр ажиллана; локал Chrome байхгүй тул энд ажиллуулаагүй.

## 6. Файлууд

```text
components/app-shell.tsx            # mobile sheet dialog, фокус, орчуулга
components/settings/pwa.tsx         # харагдах үеийн update шалгалт
lib/i18n/dictionary.ts              # nav.mobileMenu (mn/en)
scripts/service-worker.template.js  # /privacy, /terms кэш
tests/mobile-shell.test.tsx         # шинэ: 2 тест
tests/offline.test.ts               # кэшийн нэмэлт шалгалт
docs/PWA.md                         # энэ баримт
```
