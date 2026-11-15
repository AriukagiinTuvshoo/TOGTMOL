import type { DesignTheme, WorldSettings } from "@/types/study";

export type RoomId = DesignTheme;

export interface Room {
  id: RoomId;
  name: string;
  nameMn: string;
  tagline: string;
  emoji: string;
  accent: string;
  accentSoft: string;
  bg: [string, string, string];
  orbs: {
    color: string;
    x: string;
    y: string;
    size: string;
    blur: string;
    anim: "drift1" | "drift2" | "drift3";
  }[];
  grain: number;
  preset: string;
  tip: string;
  greeting: string;
}

export const ROOMS: Room[] = [
  {
    id: "night",
    name: "Night Study",
    nameMn: "Шөнийн өрөө",
    tagline: "Гүн төвлөрлийн харанхуй",
    emoji: "🌙",
    accent: "#a78bfa",
    accentSoft: "rgba(167,139,250,.16)",
    bg: ["#070714", "#0d0d28", "#151338"],
    orbs: [
      {
        color: "#6d28d9",
        x: "12%",
        y: "18%",
        size: "420px",
        blur: "120px",
        anim: "drift1",
      },
      {
        color: "#312e81",
        x: "70%",
        y: "65%",
        size: "520px",
        blur: "140px",
        anim: "drift2",
      },
      {
        color: "#0ea5e9",
        x: "82%",
        y: "12%",
        size: "240px",
        blur: "100px",
        anim: "drift3",
      },
    ],
    grain: 0.5,
    preset: "deep-night",
    tip: "Шөнө тархи сатаарал багатай — 50/10 помодоро хамгийн үр дүнтэй.",
    greeting: "Шөнө бол гүнзгийрэх цаг. Нэг хичээл, нэг зорилго.",
  },
  {
    id: "rainy",
    name: "Rainy Cafe",
    nameMn: "Бороотой кафе",
    tagline: "Бороо + кофе + ном",
    emoji: "🌧️",
    accent: "#38bdf8",
    accentSoft: "rgba(56,189,248,.14)",
    bg: ["#060d16", "#0b1e30", "#12324a"],
    orbs: [
      {
        color: "#0369a1",
        x: "8%",
        y: "70%",
        size: "460px",
        blur: "130px",
        anim: "drift2",
      },
      {
        color: "#0ea5e9",
        x: "75%",
        y: "20%",
        size: "380px",
        blur: "120px",
        anim: "drift1",
      },
      {
        color: "#f59e0b",
        x: "55%",
        y: "55%",
        size: "180px",
        blur: "90px",
        anim: "drift3",
      },
    ],
    grain: 0.7,
    preset: "rainy-cafe",
    tip: "Борооны чимээ нь ярианы чимээг далдалж, унших хурдыг нэмэгдүүлдэг.",
    greeting: "Бороо шилэн дээр... аяга кофегоо бариад эхэлцгээе.",
  },
  {
    id: "forest",
    name: "Forest",
    nameMn: "Ойн үүр",
    tagline: "Ногоон чимээгүйдэл",
    emoji: "🌲",
    accent: "#4ade80",
    accentSoft: "rgba(74,222,128,.14)",
    bg: ["#04120b", "#07281a", "#0b3d27"],
    orbs: [
      {
        color: "#15803d",
        x: "15%",
        y: "25%",
        size: "440px",
        blur: "130px",
        anim: "drift1",
      },
      {
        color: "#65a30d",
        x: "70%",
        y: "70%",
        size: "420px",
        blur: "120px",
        anim: "drift3",
      },
      {
        color: "#14b8a6",
        x: "80%",
        y: "15%",
        size: "220px",
        blur: "90px",
        anim: "drift2",
      },
    ],
    grain: 0.55,
    preset: "forest-dawn",
    tip: "Байгалийн чимээ стрессийн гормоныг бууруулж, ой тогтоолтыг сайжруулна.",
    greeting: "Шувуудын жиргээ, навчны чимээ — тархиа амраая.",
  },
  {
    id: "space",
    name: "Space Study",
    nameMn: "Гүн сансар",
    tagline: "Оддын дундах ганцаардал",
    emoji: "🚀",
    accent: "#c084fc",
    accentSoft: "rgba(192,132,252,.15)",
    bg: ["#030014", "#0d0247", "#1c0a5e"],
    orbs: [
      {
        color: "#7c3aed",
        x: "60%",
        y: "15%",
        size: "480px",
        blur: "140px",
        anim: "drift2",
      },
      {
        color: "#db2777",
        x: "10%",
        y: "65%",
        size: "380px",
        blur: "130px",
        anim: "drift1",
      },
      {
        color: "#22d3ee",
        x: "45%",
        y: "80%",
        size: "260px",
        blur: "100px",
        anim: "drift3",
      },
    ],
    grain: 0.4,
    preset: "deep-space",
    tip: "Сансрын дрон дуу нь монотон сатаарлыг арилгаж, урсгал төлөвт оруулна.",
    greeting: "Хязгааргүй сансарт зөвхөн чи болон чиний зорилго.",
  },
  {
    id: "cabin",
    name: "Mountain Cabin",
    nameMn: "Уулын байшин",
    tagline: "Зуухны дэргэдэх дулаан",
    emoji: "🏔️",
    accent: "#fb923c",
    accentSoft: "rgba(251,146,60,.15)",
    bg: ["#120803", "#241208", "#3a1c0c"],
    orbs: [
      {
        color: "#c2410c",
        x: "20%",
        y: "60%",
        size: "460px",
        blur: "130px",
        anim: "drift1",
      },
      {
        color: "#f59e0b",
        x: "70%",
        y: "25%",
        size: "320px",
        blur: "110px",
        anim: "drift2",
      },
      {
        color: "#7c2d12",
        x: "50%",
        y: "85%",
        size: "300px",
        blur: "100px",
        anim: "drift3",
      },
    ],
    grain: 0.65,
    preset: "cabin-fire",
    tip: "Галын тачигнах чимээ нь аюулгүй мэдрэмж төрүүлж, анхаарлыг тогтворжуулна.",
    greeting: "Гадаа цас, дотор дулаан. Энд хэн ч чамайг сатааруулахгүй.",
  },
  {
    id: "library",
    name: "Library",
    nameMn: "Номын сан",
    tagline: "Эрдмийн сүм",
    emoji: "📚",
    accent: "#eab308",
    accentSoft: "rgba(234,179,8,.13)",
    bg: ["#100c04", "#221806", "#33250a"],
    orbs: [
      {
        color: "#a16207",
        x: "12%",
        y: "30%",
        size: "400px",
        blur: "120px",
        anim: "drift3",
      },
      {
        color: "#713f12",
        x: "75%",
        y: "60%",
        size: "440px",
        blur: "130px",
        anim: "drift1",
      },
      {
        color: "#fbbf24",
        x: "50%",
        y: "10%",
        size: "180px",
        blur: "80px",
        anim: "drift2",
      },
    ],
    grain: 0.6,
    preset: "library-hush",
    tip: 'Номын сангийн чимээгүй яриа нь "кохерент бус ярианы" нөлөөгөөр бүтээлчийг идэвхжүүлнэ.',
    greeting: "Мянган номын чимээгүй дунд чиний түүх бичигдэнэ.",
  },
  {
    id: "ocean",
    name: "Ocean Calm",
    nameMn: "Далайн эрэг",
    tagline: "Долгионы амьсгал",
    emoji: "🌊",
    accent: "#2dd4bf",
    accentSoft: "rgba(45,212,191,.14)",
    bg: ["#02141a", "#04303a", "#075263"],
    orbs: [
      {
        color: "#0e7490",
        x: "18%",
        y: "20%",
        size: "440px",
        blur: "130px",
        anim: "drift2",
      },
      {
        color: "#14b8a6",
        x: "72%",
        y: "65%",
        size: "420px",
        blur: "120px",
        anim: "drift1",
      },
      {
        color: "#67e8f9",
        x: "55%",
        y: "40%",
        size: "200px",
        blur: "90px",
        anim: "drift3",
      },
    ],
    grain: 0.5,
    preset: "ocean-breath",
    tip: "Далайн долгион амьсгалтай синхрончлогдож, зүрхний цохилтыг тайвшруулна.",
    greeting: "Долгион ирнэ, долгион явна. Бодол ч мөн адил — зүгээр л ажигла.",
  },
  {
    id: "sakura",
    name: "Sakura",
    nameMn: "Сакура",
    tagline: "Ягаан хаврын хөнгөн",
    emoji: "🌸",
    accent: "#f472b6",
    accentSoft: "rgba(244,114,182,.15)",
    bg: ["#16060f", "#2b0d20", "#431231"],
    orbs: [
      {
        color: "#db2777",
        x: "15%",
        y: "25%",
        size: "420px",
        blur: "130px",
        anim: "drift1",
      },
      {
        color: "#a855f7",
        x: "70%",
        y: "60%",
        size: "420px",
        blur: "120px",
        anim: "drift3",
      },
      {
        color: "#fda4af",
        x: "60%",
        y: "15%",
        size: "220px",
        blur: "90px",
        anim: "drift2",
      },
    ],
    grain: 0.45,
    preset: "sakura-lofi",
    tip: "Хөнгөн хөгжим + байгалийн чимээний хослол уйтгартай давтлагыг хөгжилтэй болгоно.",
    greeting: "Дэлбээ унах мэт хөнгөнөөр — өнөөдрийн жижиг алхмаа хийцгээе.",
  },
  {
    id: "cozy",
    name: "Cozy Cat",
    nameMn: "Муужгайтай өрөө",
    tagline: "Муурны хурхирах чимээ",
    emoji: "🐱",
    accent: "#fbbf24",
    accentSoft: "rgba(251,191,36,.15)",
    bg: ["#150f06", "#2a1d0c", "#402b12"],
    orbs: [
      {
        color: "#b45309",
        x: "20%",
        y: "30%",
        size: "420px",
        blur: "130px",
        anim: "drift1",
      },
      {
        color: "#f59e0b",
        x: "72%",
        y: "62%",
        size: "380px",
        blur: "120px",
        anim: "drift2",
      },
      {
        color: "#f472b6",
        x: "50%",
        y: "80%",
        size: "220px",
        blur: "90px",
        anim: "drift3",
      },
    ],
    grain: 0.6,
    preset: "cozy-purr",
    tip: "Муурны хурхирах (25Hz) чимээ нь тайвшруулж, стрессийг бууруулдаг нь батлагдсан.",
    greeting:
      "Бондоок өвөр дээр чинь хурхирч байна. Битгий зогсоо — үргэлжлүүл.",
  },
  {
    id: "minimal",
    name: "Minimal",
    nameMn: "Минимал",
    tagline: "Юу ч үгүй — зөвхөн чи",
    emoji: "◻️",
    accent: "#94a3b8",
    accentSoft: "rgba(148,163,184,.14)",
    bg: ["#08090c", "#101318", "#181d26"],
    orbs: [
      {
        color: "#334155",
        x: "25%",
        y: "30%",
        size: "400px",
        blur: "140px",
        anim: "drift2",
      },
      {
        color: "#475569",
        x: "70%",
        y: "60%",
        size: "380px",
        blur: "130px",
        anim: "drift1",
      },
      {
        color: "#64748b",
        x: "50%",
        y: "15%",
        size: "180px",
        blur: "90px",
        anim: "drift3",
      },
    ],
    grain: 0.3,
    preset: "pure-focus",
    tip: "Харааны сатаарал тэг — хамгийн гүн төвлөрөл хүсвэл энэ өрөөг сонго.",
    greeting: "Хоосон дэлгэц, цэвэр оюун. Эхэл.",
  },
];

export const roomById = (id: string): Room =>
  ROOMS.find((r) => r.id === id) ?? ROOMS[0];

/**
 * Resolves the active v9 immersive room while keeping core WorldSettings
 * default ("cozy") untouched in persistence/migration tests.
 * Defaults visually to "night" ("Шөнийн өрөө") unless the user picked a room.
 */
export function resolveV9RoomId(world: WorldSettings): RoomId {
  if (world.design !== "cozy") {
    return world.design;
  }
  const explicit = world.extras?.v9Room;
  if (typeof explicit === "string" && ROOMS.some((r) => r.id === explicit)) {
    return explicit as RoomId;
  }
  return "night";
}
