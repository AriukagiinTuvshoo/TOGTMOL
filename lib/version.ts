/**
 * Аппын хувилбарын нэг эх сурвалж (single source of truth).
 *
 * `package.json`-ы `version` талбартай заавал ижил байна; `tests/version-consistency.test.ts`
 * зөрүү гарвал тестийг унагана. Хадгалалтын схем (`data.schemaVersion`) болон
 * Supabase migration-уудын дугаар нь энэ дугаараас хөндий хөгждөг — дэлгэрэнгүйг
 * `docs/VERSIONING.md`-ээс харна.
 */
export const APP_VERSION = "12.0.0";

/** UI дээр харуулах богино шошго, жишээ нь `v12`. */
export const APP_VERSION_LABEL = `v${APP_VERSION.split(".")[0]}`;
