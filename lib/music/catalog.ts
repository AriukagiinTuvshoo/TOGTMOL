export const AMBIENTS = [
  { id: "lofi", name: "Lo-fi", detail: "Зөөлөн төвлөрөх хэмнэл" },
  { id: "rain", name: "Rainy window", detail: "Борооны тайван чимээ" },
  { id: "piano", name: "Piano", detail: "Зөөлөн төгөлдөр хуур" },
  { id: "nature", name: "Nature", detail: "Салхи, шувуудын зөөлөн чимээ" },
  { id: "night", name: "Night study", detail: "Шөнийн намуухан төвлөрөл" },
] as const;
export type AmbientId = (typeof AMBIENTS)[number]["id"];
