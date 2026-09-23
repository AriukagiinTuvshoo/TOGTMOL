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
- Custom deep-link scheme: `togtmol` — Supabase PKCE callback-д ашиглана.
- Native plugins: `@capacitor/app` болон `@capacitor/browser`.

## Authentication deep link

Web app нь native орчинд `togtmol://auth/callback` callback ашиглаж, Supabase PKCE authorization code-ыг app дотор `exchangeCodeForSession()`-оор солино. Google login нь Capacitor Browser-оор browser руу нээгдэж, email confirmation болон password recovery мөн ижил callback руу буцна.

Native project үүссэний дараа scheme-ийг platform бүрт бүртгэнэ:

iOS — Xcode → Target → Info → URL Types дээр URL scheme `togtmol` нэм.

Android — `mobile/android/app/src/main/AndroidManifest.xml` дахь main activity-д дараах intent filter-ийг нэм:

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="togtmol" android:host="auth" android:pathPrefix="/callback" />
</intent-filter>
```

Supabase Dashboard → Authentication → URL Configuration → Redirect URLs-д `togtmol://auth/callback`-ийг нэм. Google provider ашиглаж байгаа бол provider-ийн callback flow мөн энэ callback-ийг зөвшөөрөхөөр тохируулна.

## Release-ийн өмнө заавал хийх зүйл

1. Production web domain-оо тогтоож `CAPACITOR_SERVER_URL`-д ашиглах.
2. Supabase Auth redirect configuration-д `togtmol://auth/callback` болон production web callback-ийг зөвшөөрөх.
3. iOS bundle display name, signing team, deployment target, privacy manifests-ийг Xcode дээр шалгах.
4. Android application ID, signing key, target SDK болон Play App Signing-ийг Android Studio/Play Console дээр тохируулах.
5. Бодит iPhone болон Android төхөөрөмж дээр login, offline/PWA, sync, timer, YouTube, privacy delete урсгалуудыг шалгах.

Энэ wrapper нь одоогоор native project skeleton/configuration-ийн шатанд байна. Xcode эсвэл Android Studio байхгүй орчинд signing/build-ийг эндээс баталгаажуулсан гэж үзэхгүй.
