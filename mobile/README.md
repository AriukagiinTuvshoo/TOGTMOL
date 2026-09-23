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

## Native project ажиллуулах

`ios/` болон `android/` skeleton-ууд repo-д аль хэдийн орсон. Орон нутагт dependency суулгаад sync хий:

```bash
cd mobile
npm install
npm run sync
npm run open:ios
npm run open:android
```

Native project-ийг шинээр үүсгэх шаардлагатай бол эхлээд тухайн platform folder-ийг устгаад дараа нь `npm run add:ios` эсвэл `npm run add:android` ажиллуулна.

iOS build/signing нь macOS + Xcode дээр, Android build/signing нь Android Studio/Android SDK дээр хийгдэнэ.
Android Gradle project нь Java 21 ашигладаг тул Android build орчинд JDK 21 тохируулсан байх ёстой.

## App identity

- App name: Тогтмол
- iOS/Android application ID: `com.togtmol.study`
- Custom deep-link scheme: `togtmol` — Supabase PKCE callback-д ашиглана.
- Native plugins: `@capacitor/app` болон `@capacitor/browser`.

## Authentication deep link

Web app нь native орчинд `togtmol://auth/callback` callback ашиглаж, Supabase PKCE authorization code-ыг app дотор `exchangeCodeForSession()`-оор солино. Google login нь Capacitor Browser-оор browser руу нээгдэж, email confirmation болон password recovery мөн ижил callback руу буцна.

Native project-д deep-link registration аль хэдийн checked in. Xcode/Android Studio дээр доорх тохиргоо байгааг зөвхөн баталгаажуул:

iOS — Target → Info → URL Types дахь `togtmol` scheme.

Android — `mobile/android/app/src/main/AndroidManifest.xml` дахь main activity-ийн `togtmol://auth/callback` VIEW/BROWSABLE intent filter.

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
3. iOS bundle display name, signing team, deployment target, app privacy settings болон signing-ийг Xcode дээр шалгах.
4. Android application ID, signing key, target SDK болон Play App Signing-ийг Android Studio/Play Console дээр тохируулах.
5. Release version: iOS `1.0.0`, Android `1.0.0`.
6. Бодит iPhone болон Android төхөөрөмж дээр login, offline/PWA, sync, timer, YouTube, privacy delete урсгалуудыг шалгах.

Native project skeleton болон deep-link registration бэлэн. Xcode/Android Studio дээр signing, simulator/emulator болон бодит төхөөрөмжийн build одоогоор эндээс бүрэн баталгаажаагүй.
