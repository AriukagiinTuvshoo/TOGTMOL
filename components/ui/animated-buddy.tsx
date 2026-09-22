"use client";

type BuddyMood = "idle" | "study" | "happy" | "idea";

const BUDDY_URL =
  "https://images.emojiterra.com/google/noto-emoji/animated-emoji/1f916.gif";

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
    <div className={`animated-buddy ${compact ? "animated-buddy-compact" : ""}`}>
      <div className="animated-buddy-glow" aria-hidden="true" />
      {/* The buddy asset is intentionally a plain image: the source is an animated GIF. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BUDDY_URL} alt="" aria-hidden="true" />
      <span className="animated-buddy-bubble">
        <b>{current.emoji}</b> {current.label}
      </span>
    </div>
  );
}
