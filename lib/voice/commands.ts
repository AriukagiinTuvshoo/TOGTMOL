import type { View } from "@/types/study";

export type VoiceCommandIntent =
  | { kind: "timer_start"; mode?: "focus" | "shortBreak" | "longBreak" }
  | { kind: "timer_pause" }
  | { kind: "timer_resume" }
  | { kind: "timer_finish" }
  | { kind: "sound_preset"; presetId: string; label: string }
  | { kind: "sound_stop" }
  | {
      kind: "room_change";
      roomId: "night" | "rainy" | "cozy" | "library" | "sakura" | "minimal";
      label: string;
    }
  | { kind: "navigate"; view: View | "sound"; label: string }
  | { kind: "add_task"; title: string }
  | { kind: "add_note"; body: string }
  | { kind: "ask_bondook"; prompt: string };

export function matchVoiceCommand(rawText: string): VoiceCommandIntent | null {
  const clean = rawText.trim();
  const q = clean
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .trim();
  if (!q) return null;

  // 1. Quick task creation: "даалгавар нэм: ...", "add task ..."
  const taskMatch = clean.match(
    /^(?:даалгавар\s+нэм(?:эх)?|ажил\s+нэм(?:эх)?|add\s+task)[:\s]+(.+)$/iu,
  );
  if (taskMatch?.[1]?.trim()) {
    return {
      kind: "add_task",
      title: taskMatch[1].trim().replace(/[.]+$/, ""),
    };
  }

  // 2. Quick note creation: "тэмдэглэл хадгал: ...", "save note ..."
  const noteMatch = clean.match(
    /^(?:тэмдэглэл\s+(?:хадгал|нэм)|note\s+save|save\s+note)[:\s]+(.+)$/iu,
  );
  if (noteMatch?.[1]?.trim()) {
    return {
      kind: "add_note",
      body: noteMatch[1].trim(),
    };
  }

  // 3. Direct Bondook invocation: "бондоок оо ...", "hey bondook ..."
  const bondookMatch = clean.match(
    /^(?:бондоок(?:\s+оо)?|bondook|hey\s+bondook)[,:\s]+(.+)$/iu,
  );
  if (bondookMatch?.[1]?.trim()) {
    return {
      kind: "ask_bondook",
      prompt: bondookMatch[1].trim(),
    };
  }

  // 4. Timer commands
  if (
    /^(?:фокус\s+эхэл|фокус\s+эхлүүл|цаг\s+эхэл|цаг\s+эхлүүл|помодоро\s+эхэл|start\s+focus|start\s+timer|集中開始)$/iu.test(
      q,
    )
  ) {
    return { kind: "timer_start", mode: "focus" };
  }
  if (/^(?:завсарлага\s+эхэл|амралт\s+эхэл|start\s+break)$/iu.test(q)) {
    return { kind: "timer_start", mode: "shortBreak" };
  }
  if (
    /^(?:түр\s+зогс|цаг\s+зогсоо|түр\s+зогсоо|pause|pause\s+timer|一時停止)$/iu.test(
      q,
    )
  ) {
    return { kind: "timer_pause" };
  }
  if (
    /^(?:үргэлжлүүл|цаг\s+үргэлжлүүл|resume|resume\s+timer|再開)$/iu.test(q)
  ) {
    return { kind: "timer_resume" };
  }
  if (/^(?:фокус\s+дуусга|цаг\s+дуусга|finish\s+timer)$/iu.test(q)) {
    return { kind: "timer_finish" };
  }

  // 5. Sound & Ambient Presets
  if (/^(?:бороо\s+асаа|бороотой\s+кафе|rainy\s+cafe|play\s+rain)$/iu.test(q)) {
    return {
      kind: "sound_preset",
      presetId: "rainy_cafe",
      label: "Бороотой Кафе",
    };
  }
  if (/^(?:гүн\s+шөнө|шөнийн\s+фокус|deep\s+night)$/iu.test(q)) {
    return { kind: "sound_preset", presetId: "deep_night", label: "Гүн Шөнө" };
  }
  if (/^(?:ойн\s+үүр|байгалийн\s+дуу|forest\s+dawn)$/iu.test(q)) {
    return { kind: "sound_preset", presetId: "forest_dawn", label: "Ойн Үүр" };
  }
  if (/^(?:номын\s+сангийн\s+дуу|library\s+sound)$/iu.test(q)) {
    return { kind: "sound_preset", presetId: "library", label: "Номын Сан" };
  }
  if (/^(?:сансар\s+асаа|space\s+drift)$/iu.test(q)) {
    return { kind: "sound_preset", presetId: "space_drift", label: "Сансар" };
  }
  if (/^(?:галын\s+илч|ил\s+зуух|fireplace)$/iu.test(q)) {
    return {
      kind: "sound_preset",
      presetId: "fireplace_study",
      label: "Галын Илч",
    };
  }
  if (
    /^(?:дуу\s+зогсоо|дуу\s+унтраа|хөгжим\s+зогсоо|stop\s+sound|stop\s+music|mute\s+all)$/iu.test(
      q,
    )
  ) {
    return { kind: "sound_stop" };
  }

  // 6. Room switching
  if (/^(?:шөнийн\s+өрөө|night\s+room)$/iu.test(q)) {
    return { kind: "room_change", roomId: "night", label: "Шөнийн хот" };
  }
  if (/^(?:бороотой\s+өрөө|rain\s+room)$/iu.test(q)) {
    return { kind: "room_change", roomId: "rainy", label: "Бороотой цонх" };
  }
  if (/^(?:сакура\s+өрөө|sakura\s+room)$/iu.test(q)) {
    return { kind: "room_change", roomId: "sakura", label: "Сакура" };
  }
  if (/^(?:минимал\s+өрөө|minimal\s+room)$/iu.test(q)) {
    return { kind: "room_change", roomId: "minimal", label: "Минимал" };
  }

  // 7. Navigation
  const navMap: Array<[RegExp, View | "sound", string]> = [
    [
      /^(?:миний\s+өрөө|фокус\s+өрөө|go\s+home|study\s+room)$/iu,
      "overview",
      "Миний өрөө",
    ],
    [
      /^(?:өрөө\s+засах|миний\s+ертөнц|customize\s+room)$/iu,
      "room",
      "Өрөө засах",
    ],
    [/^(?:дууны\s+студи|дуу\s+нээ|sound\s+studio)$/iu, "sound", "Дууны студи"],
    [
      /^(?:зорилго(?:\s+нээ)?|төлөвлөгөө(?:\s+нээ)?|open\s+goals)$/iu,
      "goals",
      "Зорилго",
    ],
    [
      /^(?:мэдлэг(?:\s+нээ)?|тэмдэглэл(?:\s+нээ)?|open\s+notes)$/iu,
      "knowledge",
      "Мэдлэг",
    ],
    [
      /^(?:статистик(?:\s+нээ)?|тайлан(?:\s+нээ)?|open\s+stats)$/iu,
      "statistics",
      "Статистик",
    ],
    [
      /^(?:календарь(?:\s+нээ)?|түүх(?:\s+нээ)?|open\s+calendar)$/iu,
      "calendar",
      "Календарь",
    ],
    [/^(?:хичээлүүд(?:\s+нээ)?|open\s+subjects)$/iu, "subjects", "Хичээлүүд"],
    [
      /^(?:бондоок(?:\s+нээ)?|туслах(?:\s+нээ)?|open\s+assistant)$/iu,
      "assistant",
      "Бондоок",
    ],
    [/^(?:тохиргоо(?:\s+нээ)?|open\s+settings)$/iu, "settings", "Тохиргоо"],
  ];

  for (const [pattern, view, label] of navMap) {
    if (pattern.test(q)) {
      return { kind: "navigate", view, label };
    }
  }

  return null;
}
