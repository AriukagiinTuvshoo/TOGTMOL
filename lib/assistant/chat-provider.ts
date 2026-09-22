import { knowledgeStatistics } from "@/lib/knowledge/statistics";
import { knowledgeIndex } from "@/lib/knowledge/index";
import type { StudyData, StudyIndex } from "@/types/study";
import { insights, suggestPlan } from "./provider";
import { periodStats, weeklyReport } from "@/lib/calculations/analytics";
import {
  formatTime,
  shiftDate,
  weekStart,
  datesBetween,
} from "@/lib/calculations/dates";
import { coachInsights } from "./coach";
import { goalDetails, milestoneProgress } from "@/lib/world/milestones";
import { goalProgress } from "@/lib/world/progress";
export interface ChatReply {
  text: string;
  action?: "plan" | "goals" | "timer" | "knowledge";
  planPrompt?: string;
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
  if (/карт|flashcard|сорил|quiz/.test(q)) {
    const practice = knowledgeIndex(data.knowledge, today),
      cards = practice.cards,
      due = practice.reviewQueue;
    return {
      text: `Мэдлэгийн санд ${cards.length} карт байна. Өнөөдөр ${due.length} картын давтлага бэлэн. Тэмдэглэлээс карт бэлдэхдээ эхлээд асуулт, хариултаа хянаж хадгална.`,
      action: "knowledge",
    };
  }
  if (/бодитой|хуваарь|амжих|realistic|pace/.test(q)) {
    const review = coachInsights(data, index, today);
    return {
      text: review.length
        ? review.map((i) => `${i.title}\n${i.body}`).join("\n\n")
        : "Одоогоор хуваарьтай харьцуулах идэвхтэй зорилго, хэмжилт хангалтгүй байна. Өөртөө боломжтой өдрүүд, минутаа сонгоод эхэлье.",
      action: "goals",
    };
  }
  if (
    /зорилго|goal|план|төлөв|plan|сурмаар|болмоор|want.*learn|want.*intermediate/.test(
      q,
    )
  )
    return {
      text: "Зорилгоо хичээлтэй холбоод, өдөрт зарцуулах боломжтой минутаа сонгоё. Би жижиг алхмуудтай хуваарь санал болгоно. Та урьдчилж хараад засаж, хадгална.",
      action: "plan",
      planPrompt: message.slice(0, 200),
    };
  if (/тэмдэглэл|reflection|юу сур|дүгнэ/.test(q)) {
    const notes = recentNotes(data, today);
    return {
      text: notes.length
        ? `Сүүлийн 7 өдрийн ${notes.length} тэмдэглэл:\n\n${notes.map((n) => `${n.date} · ${n.note.slice(0, 600)}`).join("\n\n")}\n\nДараагийн удаа юуг үргэлжлүүлэх вэ? Эдгээр нь таны тэмдэглэл; ойлголтын түвшинг би хэмжээгүй.`
        : "Тэмдэглэл хараахан алга. Өнөөдөр ойлгосон нэг зүйлээ тэмдэглээд үлдээх үү?",
      action: "knowledge",
    };
  }
  if (/долоо|week|review|ахиц|стат/.test(q)) {
    const currentWeek = periodStats(
      index,
      datesBetween(weekStart(today), today).length,
      today,
    );
    const distribution = [...currentWeek.bySubject]
      .filter(([, seconds]) => seconds > 0)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([id, seconds]) =>
          `${index.subjects.get(id)?.name ?? "Хичээл"}: ${formatTime(seconds)}`,
      )
      .join("\n");
    const completed = data.tasks.filter(
      (t) =>
        !t.deletedAt &&
        t.completed &&
        String(t.extras.completedOn ?? t.date) >= weekStart(today) &&
        String(t.extras.completedOn ?? t.date) <= today,
    ).length;
    return {
      text: `Энэ долоо хоногт ${formatTime(w.seconds)}, ${w.studyDays} өдөр суралцжээ.\n${data.goals.weeklyHours} цагийн зорилгын ${Math.min(100, Math.round((w.seconds / (data.goals.weeklyHours * 3600)) * 100))}% байна.\n\n${distribution}\n${completed} алхам биелсэн · Нэг хичээл дунджаар ${formatTime(currentWeek.averageSession)}.\n\n${w.change === null ? "Өмнөх долоо хоногийн харьцуулах хугацаанд хэмжилт алга." : `Өмнөх долоо хоногийн ижил өдрүүдээс ${Math.abs(w.change).toFixed(0)}% ${w.change >= 0 ? "их" : "бага"}.`}\nӨдөр бүр ижил байх албагүй. Дараагийн жижиг алхмаа өөрийн боломжид тааруулаарай.`,
    };
  }
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
      text: "Жаахан завсарлахад болно. Ус ууж, нүдээ амраагаад, буцаж ирэхдээ хүсвэл жижиг алхмаар үргэлжлүүлээрэй. Бондоок энд байна.",
    };
  if (/сайн|hello|hi|мэнд/.test(q))
    return {
      text: `Сайн уу, би Бондоок. ${stats.sessionCount ? `Сүүлийн 7 өдөр ${stats.sessionCount} хичээл хадгалжээ.` : "Өнөөдрийн жижиг алхмаа хамт сонгоё."}\n\nОдоогоор local горимоор таны цаг, төлөвлөгөө, тэмдэглэлд тулгуурлан тусална. “Долоо хоногоо харъя”, “Юу хийх вэ?”, “Зорилго төлөвлөе” гэж бичээрэй.`,
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
function recentNotes(data: StudyData, today: string) {
  return [
    ...data.sessions
      .filter((s) => !s.deletedAt && s.note.trim())
      .map((s) => ({ date: s.date, note: s.note, stamp: s.endEpoch })),
    ...data.knowledge
      .filter(
        (r): r is import("@/types/knowledge").StudyNote =>
          r.kind === "note" && !r.deletedAt,
      )
      .map((r) => ({
        date: r.date,
        note: `${r.title}: ${r.body}`,
        stamp: r.updatedAt,
      })),
  ]
    .filter((n) => n.date >= shiftDate(today, -6) && n.date <= today)
    .sort((a, b) => b.stamp - a.stamp)
    .slice(0, 5);
}
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
        weeklyDays: goalDetails(g).weeklyDays,
        measuredMinutes: Math.round(goalProgress(data, g, today).seconds / 60),
        milestones: milestoneProgress(data, g, today)
          .slice(0, 6)
          .map((m) => ({
            title: m.title.slice(0, 80),
            completed: m.completed,
            tasks: m.tasks.length,
          })),
      })),
    completedTasks: data.tasks
      .filter(
        (t) =>
          !t.deletedAt &&
          t.completed &&
          String(t.extras.completedOn ?? t.date) >= shiftDate(today, -6) &&
          String(t.extras.completedOn ?? t.date) <= today,
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 10)
      .map((t) => ({
        title: t.title.slice(0, 100),
        date: t.extras.completedOn ?? t.date,
      })),
    practice: knowledgeStatistics(data, shiftDate(today, -6), today),
    notes: includeNotes
      ? recentNotes(data, today).map((n) => ({
          date: n.date,
          note: n.note.slice(0, 500),
        }))
      : [],
  };
}
export function createAIChatProvider(
  token: () => Promise<string | null>,
  includeNotes = false,
): ChatProvider {
  return {
    kind: "ai",
    reply: async (message, context) => {
      const accessToken = await token();
      if (!accessToken)
        throw Error(
          "Онлайн AI ашиглахын тулд эхлээд бүртгэлээрээ нэвтэрнэ үү.",
        );
      const contextData = aiContext(context, includeNotes);
      // Keep UTF-8 bytes below the server limit even with long multilingual names.
      const wantsPersonal =
        /миний|надад|долоо|өнөөдөр|тэмдэглэл|ахиц|хуваарь|review|my |this week|today|pace/i.test(
          message,
        );
      const payload = () =>
        JSON.stringify({
          message,
          context: wantsPersonal ? contextData : { today: context.today },
        });
      for (const list of [
        contextData.subjects,
        contextData.goals,
        contextData.completedTasks,
        contextData.notes,
      ])
        while (
          new TextEncoder().encode(payload()).length > 23500 &&
          list.length
        )
          list.pop();
      const response = await fetch("/api/bondook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: payload(),
        signal: AbortSignal.timeout(35000),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error ?? "AI түр холбогдсонгүй.");
      return {
        text: result.text,
        ...(/зорилго|goal|төлөв|plan|want.*learn|want.*intermediate/i.test(
          message,
        )
          ? { action: "plan" as const, planPrompt: message.slice(0, 200) }
          : {}),
      };
    },
  };
}
