import type {
  WorldSettings,
  DesignTheme,
  Companion,
  Background,
  Atmosphere,
  DeskItem,
  Accessory,
} from "@/types/study";
export const DESIGNS: {
  id: DesignTheme;
  name: string;
  description: string;
  background: Background;
  companion: Companion;
  atmosphere: Atmosphere;
}[] = [
  {
    id: "cozy",
    name: "Cozy Cat",
    description: "Дулаахан гэрэл · модон ширээ · зөөлөн хэлбэр",
    background: "cozy",
    companion: "cat",
    atmosphere: "day",
  },
  {
    id: "minimal",
    name: "Minimal Focus",
    description: "Цэвэрхэн шугам · цэлгэр зай · нам гүм",
    background: "minimal",
    companion: "penguin",
    atmosphere: "day",
  },
  {
    id: "night",
    name: "Night Study",
    description: "Одтой тэнгэр · гүн хөх · ширээний гэрэл",
    background: "night",
    companion: "fox",
    atmosphere: "night",
  },
  {
    id: "forest",
    name: "Forest Study",
    description: "Ногоон ой · ургамал · байгалийн хэмнэл",
    background: "forest",
    companion: "bear",
    atmosphere: "day",
  },
  {
    id: "sakura",
    name: "Sakura",
    description: "Сакура · цаасан хаалт · тайван ягаан",
    background: "japanese",
    companion: "rabbit",
    atmosphere: "day",
  },
  {
    id: "rainy",
    name: "Rainy Café",
    description: "Борооны хэмнэл · хотын цонх · цайны ширээ",
    background: "cafe",
    companion: "cat",
    atmosphere: "rain",
  },
  {
    id: "space",
    name: "Space Study",
    description: "Оддын орбит · гүн хөх · сансрын ажиглалт",
    background: "space",
    companion: "penguin",
    atmosphere: "night",
  },
  {
    id: "cabin",
    name: "Mountain Cabin",
    description: "Цаст уул · модон байшин · дулаахан гэрэл",
    background: "hokkaido",
    companion: "bear",
    atmosphere: "snow",
  },
  {
    id: "library",
    name: "Quiet Library",
    description: "Номын тавиур · хүрэн мод · унших булан",
    background: "library",
    companion: "fox",
    atmosphere: "evening",
  },
  {
    id: "ocean",
    name: "Ocean Calm",
    description: "Далайн давалгаа · цагаан ширээ · цэлгэр хөх",
    background: "ocean",
    companion: "dog",
    atmosphere: "day",
  },
];
export const COMPANIONS: { id: Companion; name: string }[] = [
  { id: "fox", name: "Үнэг" },
  { id: "cat", name: "Муур" },
  { id: "bear", name: "Баавгай" },
  { id: "rabbit", name: "Туулай" },
  { id: "penguin", name: "Оцон шувуу" },
  { id: "dog", name: "Нохой" },
];
export const BACKGROUNDS: { id: Background; name: string }[] = [
  { id: "cozy", name: "Дулаахан өрөө" },
  { id: "night", name: "Шөнийн өрөө" },
  { id: "rain", name: "Бороотой цонх" },
  { id: "library", name: "Номын сан" },
  { id: "forest", name: "Ой" },
  { id: "cafe", name: "Кафе" },
  { id: "minimal", name: "Цэвэрхэн өрөө" },
  { id: "space", name: "Сансар" },
  { id: "japanese", name: "Япон өрөө" },
  { id: "hokkaido", name: "Хоккайдо" },
  { id: "ocean", name: "Далайн эрэг" },
];
export const ATMOSPHERES: { id: Atmosphere; name: string }[] = [
  { id: "day", name: "Өдөр" },
  { id: "evening", name: "Орой" },
  { id: "night", name: "Шөнө" },
  { id: "rain", name: "Бороо" },
  { id: "snow", name: "Цас" },
];
export const DESK_ITEMS: { id: DeskItem; name: string }[] = [
  { id: "laptop", name: "Зөөврийн компьютер" },
  { id: "books", name: "Ном" },
  { id: "notebook", name: "Дэвтэр" },
  { id: "coffee", name: "Кофе" },
  { id: "tea", name: "Цай" },
  { id: "plant", name: "Ургамал" },
  { id: "lamp", name: "Гэрэл" },
];
export const ACCESSORIES: { id: Accessory; name: string; level: number }[] = [
  { id: "none", name: "Энгийн", level: 1 },
  { id: "leaf", name: "Навч", level: 1 },
  { id: "glasses", name: "Нүдний шил", level: 1 },
  { id: "star", name: "Од", level: 2 },
  { id: "flower", name: "Цэцэг", level: 3 },
];
export const ROOM_REWARDS = [
  {
    id: "botanical_poster",
    name: "Ургамлын ханын зураг",
    requiredHours: 5,
    achievementId: null,
  },
  {
    id: "bookshelf",
    name: "Номын тавиур",
    requiredHours: 10,
    achievementId: "hours_10",
  },
  {
    id: "star",
    name: "Од",
    requiredHours: 10,
    achievementId: "hours_10",
  },
  {
    id: "flower",
    name: "Цэцэг",
    requiredHours: 25,
    achievementId: null,
  },
] as const;
export function defaultWorld(): WorldSettings {
  return {
    design: "cozy",
    companion: "fox",
    background: "cozy",
    atmosphere: "day",
    desk: ["books", "tea", "plant", "lamp"],
    accessory: "leaf",
    outfit: "scarf",
    expression: "auto",
    extras: {},
  };
}
function choice<T extends string>(
  v: unknown,
  choices: readonly T[],
  fallback: T,
): T {
  return typeof v === "string" && choices.includes(v as T)
    ? (v as T)
    : fallback;
}
export function normalizeWorld(input: unknown): WorldSettings {
  const d = defaultWorld(),
    w =
      input && typeof input === "object" && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {};
  const known = [
    "design",
    "companion",
    "background",
    "atmosphere",
    "desk",
    "accessory",
    "outfit",
    "expression",
    "extras",
  ];
  return {
    design: choice(
      w.design,
      DESIGNS.map((x) => x.id),
      d.design,
    ),
    companion: choice(
      w.companion,
      COMPANIONS.map((x) => x.id),
      d.companion,
    ),
    background: choice(
      w.background,
      BACKGROUNDS.map((x) => x.id),
      d.background,
    ),
    atmosphere: choice(
      w.atmosphere,
      ATMOSPHERES.map((x) => x.id),
      d.atmosphere,
    ),
    desk: Array.isArray(w.desk)
      ? [
          ...new Set(
            w.desk.filter((i): i is DeskItem =>
              DESK_ITEMS.some((x) => x.id === i),
            ),
          ),
        ]
      : d.desk,
    accessory: choice(
      w.accessory,
      ACCESSORIES.map((x) => x.id),
      d.accessory,
    ),
    outfit: choice(w.outfit, ["scarf", "vest", "none"], d.outfit),
    expression: choice(w.expression, ["auto", "smile", "calm"], d.expression),
    extras: {
      ...(w.extras && typeof w.extras === "object" ? w.extras : {}),
      ...Object.fromEntries(
        Object.entries(w).filter(([k]) => !known.includes(k)),
      ),
    },
  };
}
