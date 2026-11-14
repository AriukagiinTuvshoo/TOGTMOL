# Өөрчлөлтийн түүх

Формат: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Хувилбарын дугаарын дүрэм, аль тоог хэзээ өсгөхийг [docs/VERSIONING.md](docs/VERSIONING.md)-ээс харна.

Энэ файл 2026-11-14-ний байдлаар эхэлсэн тул өмнөх том хувилбаруудын түүх доорх баримтуудад байна: [v4.1](docs/UPGRADE-4.1.md), [v5](docs/UPGRADE-5.md), [v7 суурь](docs/BASELINE-7.md), [шилжилт](docs/MIGRATION.md).

## [Unreleased]

### Нэмсэн

- `Content-Security-Policy-Report-Only` толгой ба `/api/csp-report` хүлээн авагч — зөрчил бүртгэгдэж, бодит хөдөлгөөнд тулгуурлан бодлогоо чангатгана. Одоо юу ч блоклогдохгүй.

- `docs/VERSIONING.md` — апп, хадгалалтын схем, Supabase migration, IndexedDB нэрийн дугааруудын ялгаа ба өсгөх дүрэм.
- `npm run check` одоо `format:check`-ыг ч ажиллуулна — CI-тэй ижил дараалал.
- «Миний өдөр»/дэлгэцийн гарчгийг шалгах регрессийн тест (`tests/ui.test.tsx`).

### Зассан

- `document.title` нь хэлний provider-ийн effect-ээр дарж бичигддэг байсныг зассан: гарчгийг одоо route metadata болон `AppShell` эзэмшинэ.
- Схемгүй холбоос бүртгэл «Миний мэдлэг» дэлгэцийг унагадаг байсныг зассан — `new URL()` унасан үед түүхий URL харагдана.
- Тохиргооны UI тестийн flaky шалгалт checkbox биш, хадгалагдсан `settings.extras.aiEnabled` утгыг хүлээдэг болсон.
- Баримт дахь migration тоо: `README.md`, `docs/ARCHITECTURE.md` одоо «дөрвөн файл» гэж зөв бичнэ.
- Offline үед `/privacy`, `/terms` нь кэшэд байсан ч үргэлж нүүр хуудас буцаадаг байсныг зассан — service worker одоо хүссэн замыг эхлээд кэшээс хайна, олдоогүй үед л нүүр хуудас руу шилжинэ.
- FSRS тохируулга нь давтлагын бичлэгт байгаа бодит `stability`-г интервалын оронд ашиглана; түүхгүй үед `NaN` биш `0` алдагдал буцаана.
- IndexedDB-ийн дотоод хувилбар: `README.md`, `docs/MIGRATION.md` дээр хуучин «2» биш, код дахь бодит `3` (`musicBlobs` store-той) гэж зассан.

### Өөрчлөгдсөн

- `eslint . --max-warnings 0` — анхааруулга ч CI-г унагана.
- `docs/VERIFICATION.md` нь хэмжсэн бодит үр дүнгээр (309 тест, 39 файл, 0 warning) шинэчлэгдсэн.

### Устгасан

- `components/statistics/decision-dashboard.tsx` — repo даяар импортгүй, 435 мөр. Статистик нь `current-decision-center`-ыг ашиглана.
