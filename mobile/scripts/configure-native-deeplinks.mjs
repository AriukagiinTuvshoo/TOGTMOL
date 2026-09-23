import { existsSync, readFileSync, writeFileSync } from "node:fs";

const androidManifest = "android/app/src/main/AndroidManifest.xml";
const iosPlist = "ios/App/App/Info.plist";

function patchAndroid() {
  if (!existsSync(androidManifest)) {
    throw new Error(`Missing ${androidManifest}`);
  }
  let text = readFileSync(androidManifest, "utf8");
  if (text.includes('android:scheme="togtmol"')) return;

  const activityPattern = /(<activity\b[^>]*android:name="\.MainActivity"[^>]*>)/;
  if (!activityPattern.test(text)) {
    throw new Error("Could not find .MainActivity in AndroidManifest.xml");
  }

  const filter = [
    "      <intent-filter>",
    '        <action android:name="android.intent.action.VIEW" />',
    '        <category android:name="android.intent.category.DEFAULT" />',
    '        <category android:name="android.intent.category.BROWSABLE" />',
    '        <data android:scheme="togtmol" android:host="auth" android:pathPrefix="/callback" />',
    "      </intent-filter>",
  ].join("\n");

  text = text.replace(activityPattern, `$1\n${filter}`);
  writeFileSync(androidManifest, text);
}

function patchIos() {
  if (!existsSync(iosPlist)) {
    throw new Error(`Missing ${iosPlist}`);
  }
  let text = readFileSync(iosPlist, "utf8");
  if (text.includes("<string>togtmol</string>")) return;

  const block = [
    "    <key>CFBundleURLTypes</key>",
    "    <array>",
    "        <dict>",
    "            <key>CFBundleTypeRole</key>",
    "            <string>Editor</string>",
    "            <key>CFBundleURLSchemes</key>",
    "            <array>",
    "                <string>togtmol</string>",
    "            </array>",
    "        </dict>",
    "    </array>",
  ].join("\n");

  const marker = "</dict>\n</plist>";
  if (!text.includes(marker)) {
    throw new Error("Could not find iOS Info.plist root marker");
  }

  text = text.replace(marker, block + "\n" + marker);
  writeFileSync(iosPlist, text);
}

patchAndroid();
patchIos();
console.log("Configured togтмол auth deep link for iOS and Android.".replace("togтмол", "togtmol"));
