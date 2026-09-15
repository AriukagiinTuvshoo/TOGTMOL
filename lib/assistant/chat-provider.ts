import type { StudyData, StudyIndex } from "@/types/study";
import { insights, suggestPlan } from "./provider";
import { periodStats, weeklyReport } from "@/lib/calculations/analytics";
import { formatTime, shiftDate, weekStart } from "@/lib/calculations/dates";
export interface ChatReply {
  text: string;
  action?: "plan" | "goals" | "timer";
}
export interface ChatContext {
  data: StudyData;
  index: StudyIndex;
  today: string;
}
export interface ChatProvider {
  kind: "local" | "ai";
  reply(message: string, context: ChatContext): Promise<ChatReply>;
}
export function localReply(
  message: string,
  { data, index, today }: ChatContext,
): ChatReply {
  const q = message.toLocaleLowerCase(),
    w = weeklyReport(index, today),
    stats = periodStats(index, 7, today);
  if (/зорилго|goal|план|төлөв|plan/.test(q))
    return {
      text: "Зорилгоо хичээлтэй холбоод, өдөрт зарцуулах боломжтой минутаа сонгоё. Би жижиг алхмуудтай хуваарь санал болгоно. Та урьдчилж хараад засаж, хадгална.",
      action: "plan",
    };
  if (/тэмдэглэл|reflection|юу сур|дүгнэ/.test(q)) {
    const start = weekStart(today),
      end = shiftDate(start, 6),
      notes = data.sessions
        .filter(
          (s) =>
            !s.deletedAt && s.date >= start && s.date <= end && s.note.trim(),
        )
        .sort((a, b) => b.endEpoch - a.endEpoch)
        .slice(0, 5);
    return {
      text: notes.length
        ? `Энэ долоо хоногийн таны ${notes.length} сүүлийн тэмдэглэл:\n\n${notes.map((s) => `${s.date} · ${index.subjects.get(s.subjectId)?.name ?? "Хичээл"}\n“${s.note.slice(0, 600)}${s.note.length > 600 ? "…" : ""}”`).join("\n\n")}\n\nДараагийн удаа юуг үргэлжлүүлэх вэ? Эдгээр нь таны өөрийн тэмдэглэл; ойлголтын түвшинг би хэмжээгүй.`
        : "Энэ долоо хоногт хадгалсан тэмдэглэл алга. Дараагийн хичээлийнхээ төгсгөлд «Юу ойлгов? Юу үлдэв?» гэсэн хоёр өгүүлбэр үлдээгээрэй.",
      action: notes.length ? undefined : "timer",
    };
  }
  if (/долоо|week|review|ахиц|стат/.test(q))
    return {
      text: `Энэ долоо хоногт ${formatTime(w.seconds)}, ${w.studyDays} өдөр суралцжээ.\n${data.goals.weeklyHours} цагийн зорилгын ${Math.min(100, Math.round((w.seconds / (data.goals.weeklyHours * 3600)) * 100))}% байна.\n\n${w.change === null ? "Өмнөх долоо хоногийн харьцуулах хугацаанд хэмжилт алга." : `Өмнөх долоо хоногийн ижил өдрүүдээс ${Math.abs(w.change).toFixed(0)}% ${w.change >= 0 ? "их" : "бага"}.`}\nӨдөр бүр ижил байх албагүй. Дараагийн жижиг алхмаа өөрийн боломжид тааруулаарай.`,
    };
  if (/юу хийх|recommend|санал|дараа|today/.test(q)) {
    const plans = suggestPlan(data, index, today, 25);
    return {
      text: plans.length
        ? `${plans.map((p) => `${p.title} · ${p.minutes} минут. ${p.reason}`).join("\n")}\n\nХугацаа бага зориулсан нь мэдлэг сул гэсэн үг биш. Өнөөдөр танд хэрэгтэй сэдвээ сонгоорой.`
        : "Суралцах хичээлээ нэмээд 5–25 минутын нэг жижиг алхмаар эхэлж болно.",
      action: plans.length ? "timer" : "goals",
    };
  }
  if (/ядар|амр|break|tired/.test(q))
    return {
      text: "Жаахан завсарлахад болно. Ус ууж, нүдээ амраагаад, буцаж ирэхдээ хүсвэл жижиг алхмаар үргэлжлүүлээрэй. Тоги энд байна.",
    };
  if (/сайн|hello|hi|мэнд/.test(q))
    return {
      text: `Сайн уу, би Тоги. ${stats.sessionCount ? `Сүүлийн 7 өдөр ${stats.sessionCount} хичээл хадгалжээ.` : "Өнөөдрийн жижиг алхмаа хамт сонгоё."}\n\nОдоогоор local горимоор таны цаг, төлөвлөгөө, тэмдэглэлд тулгуурлан тусална. “Долоо хоногоо харъя”, “Юу хийх вэ?”, “Зорилго төлөвлөе” гэж бичээрэй.`,
    };
  return {
    text: `Би local горимд чөлөөт асуултыг AI шиг тайлбарлахгүй. Харин таны бодит түүхийг харуулж чадна:\n\n${insights(
      index,
      today,
    )
      .slice(0, 2)
      .map((i) => `${i.title}. ${i.body}`)
      .join(
        "\n\n",
      )}\n\nЗорилго төлөвлөх, долоо хоногоо харах, тэмдэглэлээ дүгнэхээс сонгоорой.`,
  };
}
export const localChatProvider: ChatProvider = {
  kind: "local",
  reply: async (message, context) => localReply(message, context),
};
export function aiContext(
  { data, index, today }: ChatContext,
  includeNotes: boolean,
) {
  const w = weeklyReport(index, today),
    stats = periodStats(index, 30, today);
  return {
    today,
    weeklyMinutes: Math.round(w.seconds / 60),
    weeklyDays: w.studyDays,
    weeklyTargetHours: data.goals.weeklyHours,
    sessionCount30Days: stats.sessionCount,
    averageSessionMinutes: Math.round(stats.averageSession / 60),
    subjects: data.subjects
      .filter((s) => !s.deletedAt && !s.archived)
      .slice(0, 50)
      .map((s) => ({
        name: s.name,
        minutes30Days: Math.round((stats.bySubject.get(s.id) ?? 0) / 60),
      })),
    goals: data.studyGoals
      .filter((g) => !g.deletedAt)
      .slice(0, 20)
      .map((g) => ({
        title: g.title,
        weeklyMinutes: g.weeklyMinutes,
        endsOn: g.endsOn,
      })),
    notes: includeNotes
      ? data.sessions
          .filter(
            (s) =>
              !s.deletedAt &&
              s.note &&
              s.date >= shiftDate(today, -6) &&
              s.date <= today,
          )
          .slice(-10)
          .map((s) => ({ date: s.date, note: s.note.slice(0, 500) }))
      : [],
  };
}
export function createAIChatProvider(
  token: () => Promise<string | null>,
): ChatProvider {
  return {
    kind: "ai",
    reply: async (message, context) => {
      const accessToken = await token();
      if (!accessToken)
        throw Error(
          "Онлайн AI ашиглахын тулд эхлээд бүртгэлээрээ нэвтэрнэ үү.",
        );
      const response = await fetch("/api/togi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ message, context: aiContext(context, false) }),
        signal: AbortSignal.timeout(35000),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error ?? "AI түр холбогдсонгүй.");
      return { text: result.text };
    },
  };
}
