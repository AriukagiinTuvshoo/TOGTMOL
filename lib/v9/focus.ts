export interface SessionScoreInput {
  plannedSeconds: number;
  actualSeconds: number;
  completed: boolean;
  interruptions: number;
  mode: string;
  hourOfDay: number;
}

/** Focus Score 0..100 — completion, endurance, calm, rhythm */
export function focusScore(s: SessionScoreInput): number {
  const completion =
    s.plannedSeconds > 0
      ? Math.min(1, s.actualSeconds / s.plannedSeconds)
      : Math.min(1, s.actualSeconds / 1500);
  const completionPts = completion * 45;
  const endurance = Math.min(1, s.actualSeconds / 5400);
  const endurancePts = endurance * 20;
  const calm = Math.max(0, 1 - s.interruptions * 0.12);
  const calmPts = calm * 20;
  const h = s.hourOfDay;
  const prime = (h >= 6 && h <= 11) || (h >= 19 && h <= 23);
  const rhythmPts = prime ? 10 : 5;
  const modeBonus = s.mode === "pomodoro" ? 5 : s.mode === "flowtime" ? 4 : 3;
  const total = completionPts + endurancePts + calmPts + rhythmPts + modeBonus;
  return Math.max(1, Math.min(100, Math.round(total)));
}

export function xpForSession(
  actualSeconds: number,
  score: number,
  completed: boolean,
): number {
  const base = Math.floor(actualSeconds / 60) * 2;
  const bonus = completed ? 15 : 0;
  const scoreBonus = Math.floor(score / 10);
  return base + bonus + scoreBonus;
}

export function levelForXp(xp: number): {
  level: number;
  into: number;
  needed: number;
  title: string;
} {
  let level = 1;
  let acc = 0;
  while (acc + level * 100 <= xp) {
    acc += level * 100;
    level++;
  }
  const needed = level * 100;
  const into = xp - acc;
  const titles = [
    "Эхлэгч",
    "Суралцагч",
    "Тогтмол",
    "Тууштай",
    "Мастер",
    "Далай",
    "Од",
    "Домог",
  ];
  const title =
    titles[Math.min(titles.length - 1, Math.floor((level - 1) / 2))];
  return { level, into, needed, title };
}

export const fmtClock = (sec: number): string => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${p(h)}:${p(m)}:${p(r)}` : `${p(m)}:${p(r)}`;
};

export const fmtMnDuration = (sec: number): string => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}ц ${m}мин`;
  if (m > 0) return `${m} мин`;
  return `${s} сек`;
};

export const BONDOOK_QUOTES = [
  "25 минут — зүгээр л эхэл. Би хамт байна! 🐾",
  "Өөрийн хэмнэлээр, нэг жижиг алхам. 🌱",
  "Сатаарал ирэхэд: амьсгал ав, бич, буц. Чи чадна!",
  "Өнөөдрийн чи өчигдрийнхөөсөө 1% дээр. 📈",
  "Тархи чинь булчин — давтлага бол дасгал. 🧠",
  "Амралт бол залхуурал биш, ой тогтоолтын нэг хэсэг. ☕",
  "Бороо сонсож, ном унш — энэ бол жаргал. 🌧️",
  "Төгс байх албагүй. Тогтмол байх чухал. ✨",
  "Чиний ирээдүйн би одоогийн чамд талархаж байна. 💜",
  "Гүнзгий амьсгал… гар… одоо фокус. 🎯",
];

export const BONDOOK_TIPS = [
  {
    title: "Идэвхтэй давтлага",
    body: "Зүгээр унших биш — номоо хааж, өөрийгөө асуу. Карт ашигла!",
  },
  {
    title: "Помодоро 50/10",
    body: "Гүн хичээлд 50 мин ажил + 10 мин амралт хамгийн үр дүнтэй нь батлагдсан.",
  },
  {
    title: "Утас хол",
    body: "Утсаа өөр өрөөнд тавь. Зүгээр харагдах нь анхаарлыг 20% бууруулдаг.",
  },
  {
    title: "Ус + гэрэл",
    body: "Ус уу, гэрлээ асаа. Тархины хүчилтөрөгч = төвлөрөл.",
  },
  {
    title: "2-минутын дүрэм",
    body: "Эхлэхэд хэцүү бол: 'зөвхөн 2 минут' гэж хэл. Ихэнхдээ үргэлжилнэ.",
  },
  {
    title: "Нойр = санах ой",
    body: "Шөнө 7-8 цаг унт. Нойр давтлагаас илүү 'хадгалдаг'.",
  },
];
