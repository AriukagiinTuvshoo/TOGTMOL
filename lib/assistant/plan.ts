import { isObject } from "@/lib/migration/values";
export interface PlanProposal {
  title: string;
  description: string;
  weeks: number;
  daysPerWeek: number;
  minutesPerDay: number;
  milestoneTitles: string[];
}
export const planSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    weeks: { type: "integer" },
    daysPerWeek: { type: "integer" },
    minutesPerDay: { type: "integer" },
    milestoneTitles: { type: "array", items: { type: "string" } },
  },
  required: [
    "title",
    "description",
    "weeks",
    "daysPerWeek",
    "minutesPerDay",
    "milestoneTitles",
  ],
};
export function parsePlanProposal(raw: unknown): PlanProposal {
  if (
    !isObject(raw) ||
    typeof raw.title !== "string" ||
    !raw.title.trim() ||
    raw.title.length > 200 ||
    typeof raw.description !== "string" ||
    raw.description.length > 2000 ||
    !Number.isInteger(raw.weeks) ||
    Number(raw.weeks) < 1 ||
    Number(raw.weeks) > 12 ||
    !Number.isInteger(raw.daysPerWeek) ||
    Number(raw.daysPerWeek) < 1 ||
    Number(raw.daysPerWeek) > 7 ||
    !Number.isInteger(raw.minutesPerDay) ||
    Number(raw.minutesPerDay) < 5 ||
    Number(raw.minutesPerDay) > 120 ||
    !Array.isArray(raw.milestoneTitles) ||
    !raw.milestoneTitles.length ||
    raw.milestoneTitles.length > 12 ||
    raw.milestoneTitles.some(
      (t) => typeof t !== "string" || !t.trim() || t.length > 120,
    )
  )
    throw Error(
      "AI төлөвлөгөөний бүтэц тохирохгүй байна. Засаж эсвэл дахин санал гаргуулна уу.",
    );
  return {
    title: raw.title.trim(),
    description: raw.description,
    weeks: Number(raw.weeks),
    daysPerWeek: Number(raw.daysPerWeek),
    minutesPerDay: Number(raw.minutesPerDay),
    milestoneTitles: raw.milestoneTitles as string[],
  };
}
