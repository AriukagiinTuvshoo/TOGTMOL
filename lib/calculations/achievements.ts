import type { StudyData, StudyIndex } from "@/types/study";
import { dateKey, longestStreak } from "./dates";
import { weeklyReport } from "./analytics";
export const ACHIEVEMENTS = [
  {
    id: "sessions_10",
    name: "Арван жижиг алхам",
    description: "10 хичээлээ дуусгасан",
    icon: "book",
  },
  {
    id: "early_bird",
    name: "Өглөөний гэрэл",
    description: "Өглөө 5–9 цагт хэмжсэн хичээл",
    icon: "sun",
  },
  {
    id: "night_study",
    name: "Үдшийн нам гүм",
    description: "Орой 19–22 цагт хэмжсэн хичээл",
    icon: "moon",
  },
  {
    id: "first_study",
    name: "Эхний алхам",
    description: "Анхны суралцсан өдөр",
    icon: "leaf",
  },
  {
    id: "first_session",
    name: "Төвлөрсөн эхлэл",
    description: "Эхний хэмжсэн хичээл",
    icon: "play",
  },
  {
    id: "days_7",
    name: "7 өдрийн ахиц",
    description: "Нийт 7 өдөр суралцсан",
    icon: "calendar",
  },
  {
    id: "days_10",
    name: "10 суралцсан өдөр",
    description: "Жижиг алхмууд нийлнэ",
    icon: "calendar",
  },
  {
    id: "days_30",
    name: "Гучин өдрийн ахиц",
    description: "Нийт 30 өдөр суралцсан",
    icon: "leaf",
  },
  {
    id: "early_rhythm",
    name: "Өглөөний хэмнэл",
    description: "Өглөөний 3 хэмжсэн хичээл",
    icon: "sun",
  },
  {
    id: "evening_rhythm",
    name: "Үдшийн хэмнэл",
    description: "19–22 цагт 3 хэмжсэн хичээл",
    icon: "moon",
  },
  {
    id: "streak_7",
    name: "Нэг долоо хоног",
    description: "7 өдөр дараалан суралцсан",
    icon: "leaf",
  },
  {
    id: "streak_30",
    name: "30 өдрийн дараалал",
    description: "Өөрийн хэмнэлээ олсон",
    icon: "leaf",
  },
  {
    id: "hours_10",
    name: "10 цаг",
    description: "Өөртөө зориулсан 10 цаг",
    icon: "clock",
  },
  {
    id: "hours_50",
    name: "50 цаг",
    description: "Өөртөө зориулсан 50 цаг",
    icon: "clock",
  },
  {
    id: "hours_100",
    name: "100 цаг",
    description: "Өөртөө зориулсан 100 цаг",
    icon: "award",
  },
  {
    id: "sessions_100",
    name: "100 удаагийн эхлэл",
    description: "100 хичээлээ дуусгасан",
    icon: "book",
  },
  {
    id: "week_7",
    name: "Долоон жижиг алхам",
    description: "Нэг долоо хоногийн 7 өдөр",
    icon: "calendar",
  },
  {
    id: "weekly_goal",
    name: "Зорилгодоо хүрлээ",
    description: "Долоо хоногийн цагийн зорилго",
    icon: "target",
  },
] as const;
export function unlock(
  data: StudyData,
  index: StudyIndex,
  today = dateKey(),
): StudyData {
  const days = index.days.size,
    best = longestStreak(index.sortedDates),
    w = weeklyReport(index, today);
  const tests: Record<string, boolean> = {
    sessions_10: index.sessions.length >= 10,
    early_bird: index.sessions.some(
      (s) =>
        !s.startTimeEstimated &&
        !s.manuallyEdited &&
        new Date(s.startEpoch).getHours() >= 5 &&
        new Date(s.startEpoch).getHours() < 9,
    ),
    night_study: index.sessions.some(
      (s) =>
        !s.startTimeEstimated &&
        !s.manuallyEdited &&
        new Date(s.startEpoch).getHours() >= 19 &&
        new Date(s.startEpoch).getHours() < 22,
    ),
    first_study: days > 0,
    first_session: index.sessions.length > 0,
    days_7: days >= 7,
    days_10: days >= 10,
    days_30: days >= 30,
    early_rhythm:
      index.sessions.filter(
        (s) =>
          !s.startTimeEstimated &&
          !s.manuallyEdited &&
          new Date(s.startEpoch).getHours() >= 5 &&
          new Date(s.startEpoch).getHours() < 9,
      ).length >= 3,
    evening_rhythm:
      index.sessions.filter(
        (s) =>
          !s.startTimeEstimated &&
          !s.manuallyEdited &&
          new Date(s.startEpoch).getHours() >= 19 &&
          new Date(s.startEpoch).getHours() < 22,
      ).length >= 3,
    streak_7: best >= 7,
    streak_30: best >= 30,
    hours_10: index.totalSeconds >= 36000,
    hours_50: index.totalSeconds >= 180000,
    hours_100: index.totalSeconds >= 360000,
    sessions_100: index.sessions.length >= 100,
    week_7: w.studyDays === 7,
    weekly_goal: w.seconds >= data.goals.weeklyHours * 3600,
  };
  const added = Object.keys(tests).filter(
    (id) => tests[id] && !data.achievementsUnlocked[id],
  );
  return added.length
    ? {
        ...data,
        achievementsUnlocked: {
          ...data.achievementsUnlocked,
          ...Object.fromEntries(added.map((id) => [id, today])),
        },
      }
    : data;
}
