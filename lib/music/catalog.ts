export const AMBIENTS = [
  { id: "lofi", name: "Lo-fi notebook", detail: "Зөөлөн хэмнэл" },
  { id: "rain", name: "Rainy window", detail: "Борооны чимээ" },
  { id: "cafe", name: "Quiet café", detail: "Нам гүм кафены өнгө" },
  { id: "piano", name: "Little piano", detail: "Тайван төгөлдөр хуур" },
  { id: "nature", name: "Forest morning", detail: "Салхи, шувууд" },
  { id: "ambient", name: "Evening air", detail: "Зөөлөн ambient" },
  { id: "night", name: "Night study", detail: "Үдшийн зөөлөн аялгуу" },
  { id: "white", name: "White noise", detail: "Жигд цагаан шуугиан" },
  { id: "deep", name: "Deep focus", detail: "Нам давтамжийн зөөлөн дэвсгэр" },
] as const;
export type AmbientId = (typeof AMBIENTS)[number]["id"];
export const THEME_MUSIC: Record<
  import("@/types/study").DesignTheme,
  AmbientId[]
> = {
  rainy: ["rain", "cafe", "piano"],
  space: ["deep", "ambient", "night"],
  cabin: ["piano", "nature", "lofi"],
  library: ["deep", "piano", "white"],
  ocean: ["ambient", "nature", "white"],
  cozy: ["lofi", "cafe", "piano"],
  forest: ["nature", "rain", "ambient"],
  night: ["night", "rain", "ambient"],
  sakura: ["piano", "nature", "rain"],
  minimal: ["ambient", "piano", "rain"],
};
