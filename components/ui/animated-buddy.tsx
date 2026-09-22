"use client";

type BuddyMood = "idle" | "study" | "happy" | "idea";

const moods: Record<BuddyMood, { label: string; emoji: string }> = {
  idle: { label: "Хамтдаа суръя!", emoji: "👋" },
  study: { label: "Төвлөрч байна…", emoji: "📚" },
  happy: { label: "Мундаг! ✨", emoji: "🎉" },
  idea: { label: "Шинэ санаа!", emoji: "💡" },
};

export function AnimatedBuddy({
  mood = "idle",
  compact = false,
}: {
  mood?: BuddyMood;
  compact?: boolean;
}) {
  const current = moods[mood];

  return (
    <div
      className={`animated-buddy ${compact ? "animated-buddy-compact" : ""}`}
    >
      <div className="animated-buddy-glow" aria-hidden="true" />
      <div className="animated-buddy-avatar" aria-hidden="true">
        <span>🤖</span>
      </div>
      <span className="animated-buddy-bubble">
        <b>{current.emoji}</b> {current.label}
      </span>
    </div>
  );
}
