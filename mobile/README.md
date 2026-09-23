# Тогтмол — Capacitor mobile wrapper

Энэ folder нь одоогийн Next.js/PWA web app-ийг native iOS болон Android shell-д багцлахад зориулагдсан.

## Яагаад web app-ийг энд дахин build хийхгүй вэ?

Тогтмол нь Next.js серверийн route болон Supabase auth/API ашигладаг. Тиймээс Capacitor-д статик Next export хийхийн оронд native shell-ийг production web origin-оор ажиллуулах тохиргоо ашиглаж байна.

Production:

```bash
cd mobile
npm install
CAPACITOR_SERVER_URL=https://YOUR-PRODUCTION-DOMAIN npm run sync
npm run open:ios
npm run open:android
```

Windows/PowerShell:

```powershell
cd mobile
npm install
$env:CAPACITOR_SERVER_URL="https://YOUR-PRODUCTION-DOMAIN"
npm run sync
npm run open:android
```

`CAPACITOR_SERVER_URL` нь тохируулагдаагүй үед Capacitor нь `www/index.html` fallback shell-ийг ашиглана.

## Native project үүсгэх

Анх удаа:

```bash
cd mobile
npm install
npm run add:ios
npm run add:android
```

Үүний дараа:

```bash
npm run sync
npm run open:ios
npm run open:android
```

iOS build/signing нь macOS + Xcode дээр, Android build/signing нь Android Studio/Android SDK дээр хийгдэнэ.

## App identity

- App name: Тогтмол
- iOS/Android application ID: `com.togtmol.study`
- Custom deep-link scheme: `togtmol` — authentication integration-ийн дараагийн шатанд ашиглана.

## Release-ийн өмнө заавал хийх зүйл

1. Production web domain-оо тогтоож `CAPACITOR_SERVER_URL`-д ашиглах.
2. Supabase Auth redirect configuration-д native callback URL нэмэх.
3. Google OAuth зэрэг external login-ийг system browser + native callback руу шилжүүлэх.
4. iOS bundle display name, signing team, deployment target, privacy manifests-ийг Xcode дээр шалгах.
5. Android application ID, signing key, target SDK болон Play App Signing-ийг Android Studio/Play Console дээр тохируулах.
6. Бодит iPhone болон Android төхөөрөмж дээр login, offline/PWA, sync, timer, YouTube, privacy delete урсгалуудыг шалгах.

Энэ wrapper нь одоогоор native project skeleton/configuration-ийн шатанд байна. Xcode эсвэл Android Studio байхгүй орчинд signing/build-ийг эндээс баталгаажуулсан гэж үзэхгүй.
