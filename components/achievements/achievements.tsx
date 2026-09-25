import { useStudy } from "@/hooks/use-study";
import { ACHIEVEMENTS } from "@/lib/calculations/achievements";
import { ROOM_REWARDS } from "@/lib/world/config";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/components/i18n/language-provider";
const ACHIEVEMENT_EN: Record<string, { name: string; description: string }> = {
  cards_100: {
    name: "One hundred concepts",
    description: "Prepared 100 flashcards",
  },
  first_goal: {
    name: "First goal reached",
    description: "Reached your first measured goal target",
  },
  sessions_10: {
    name: "Ten small steps",
    description: "Completed 10 sessions",
  },
  early_bird: {
    name: "Morning light",
    description: "Measured a study session from 5–9 AM",
  },
  night_study: {
    name: "Evening calm",
    description: "Measured a study session from 7–10 PM",
  },
  first_study: { name: "First step", description: "First study day" },
  first_session: {
    name: "Focused start",
    description: "First measured session",
  },
  days_7: {
    name: "Seven-day progress",
    description: "Studied on 7 total days",
  },
  days_10: { name: "Ten study days", description: "Small steps add up" },
  days_30: {
    name: "Thirty-day progress",
    description: "Studied on 30 total days",
  },
  early_rhythm: {
    name: "Morning rhythm",
    description: "Three measured morning sessions",
  },
  evening_rhythm: {
    name: "Evening rhythm",
    description: "Three measured sessions from 7–10 PM",
  },
  streak_7: { name: "One week", description: "Studied 7 days in a row" },
  streak_30: {
    name: "Thirty-day streak",
    description: "Found your own rhythm",
  },
  hours_10: { name: "10 hours", description: "Ten hours invested in yourself" },
  hours_50: {
    name: "50 hours",
    description: "Fifty hours invested in yourself",
  },
  hours_100: {
    name: "100 hours",
    description: "One hundred hours invested in yourself",
  },
  sessions_100: {
    name: "One hundred starts",
    description: "Completed 100 sessions",
  },
  week_7: {
    name: "Seven small steps",
    description: "Studied on all 7 days of a week",
  },
  weekly_goal: {
    name: "Goal reached",
    description: "Reached your weekly time goal",
  },
};

export function Achievements() {
  const { data } = useStudy();
  const { language } = useI18n();
  return (
    <>
      <p className="page-description">
        {language === "en"
          ? "Your small steps are adding up."
          : "Жижиг алхмууд тань нийлж байна."}{" "}
        {ACHIEVEMENTS.filter((a) => data.achievementsUnlocked[a.id]).length} /{" "}
        {ACHIEVEMENTS.length} {language === "en" ? "achievements" : "амжилт"}
      </p>
      <div className="achievements-grid">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = data.achievementsUnlocked[a.id];
          const roomReward = ROOM_REWARDS.find(
            (reward) => reward.achievementId === a.id,
          );
          return (
            <article
              className={`card achievement ${unlocked ? "unlocked" : ""}`}
              key={a.id}
            >
              <span className="achievement-icon">
                <Icon name={a.icon} size={30} />
              </span>
              <span className="badge">
                {unlocked
                  ? language === "en"
                    ? "UNLOCKED"
                    : "БИЕЛСЭН"
                  : language === "en"
                    ? "UP NEXT"
                    : "ТАНЫ ӨМНӨ БАЙНА"}
              </span>
              <h2>
                {language === "en"
                  ? (ACHIEVEMENT_EN[a.id]?.name ?? a.name)
                  : a.name}
              </h2>
              <p>
                {language === "en"
                  ? (ACHIEVEMENT_EN[a.id]?.description ?? a.description)
                  : a.description}
              </p>
              {roomReward && (
                <p className="achievement-reward">
                  🏠 {language === "en" ? "Room reward:" : "Өрөөний шагнал:"}{" "}
                  <strong>{roomReward.name}</strong>
                </p>
              )}
              <small>
                {(unlocked?.replaceAll("-", ".") ?? language === "en")
                  ? "At your own pace"
                  : "Өөрийн хэмнэлээр"}
              </small>
            </article>
          );
        })}
      </div>
    </>
  );
}
