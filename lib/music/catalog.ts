export const AMBIENTS = [
  { id: "lofi", name: "Lo-fi", detail: "Зөөлөн төвлөрөх хэмнэл" },
  { id: "rain", name: "Rain", detail: "Тайван борооны чимээ" },
  { id: "piano", name: "Piano", detail: "Зөөлөн төгөлдөр хуур" },
  { id: "nature", name: "Nature", detail: "Салхи, шувуудын зөөлөн чимээ" },
] as const;
export type AmbientId = (typeof AMBIENTS)[number]["id"];
