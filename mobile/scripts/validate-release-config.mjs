import { readFileSync, existsSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const checks = [];
const android = read("android/app/build.gradle");
const androidManifest = read("android/app/src/main/AndroidManifest.xml");
const strings = read("android/app/src/main/res/values/strings.xml");
const ios = read("ios/App/App/Info.plist");
const pbx = read("ios/App/App.xcodeproj/project.pbxproj");

checks.push(["Android applicationId", /applicationId\s+"com\.togtmol\.study"/.test(android)]);
checks.push(["Android target SDK 36", /targetSdkVersion\s+rootProject\.ext\.targetSdkVersion/.test(android) && /targetSdkVersion = 36/.test(read("android/variables.gradle"))]);
checks.push(["Android release version", /versionName\s+"1\.0\.0"/.test(android)]);
checks.push(["Android deep link", /android:scheme="togtmol"/.test(androidManifest) && /android:host="auth"/.test(androidManifest)]);
checks.push(["Android custom URL scheme", /<string name="custom_url_scheme">togtmol<\/string>/.test(strings)]);
checks.push(["iOS bundle identifier", /PRODUCT_BUNDLE_IDENTIFIER = com\.togtmol\.study;/.test(pbx)]);
checks.push(["iOS release version", /MARKETING_VERSION = 1\.0\.0;/.test(pbx)]);
checks.push(["iOS deep link", /<string>togtmol<\/string>/.test(ios)]);
checks.push(["iOS project", existsSync("ios/App/App.xcodeproj/project.pbxproj")]);
checks.push(["Android project", existsSync("android/settings.gradle")]);

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
if (failed.length) process.exit(1);
