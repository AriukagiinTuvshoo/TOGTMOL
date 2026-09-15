import { useStudy } from "@/hooks/use-study";
import { ACHIEVEMENTS } from "@/lib/calculations/achievements";
import { Icon } from "@/components/ui/icon";
export function Achievements() {
  const { data } = useStudy();
  return (
    <>
      <p className="page-description">
        Жижиг алхмууд тань нийлж байна.{" "}
        {ACHIEVEMENTS.filter((a) => data.achievementsUnlocked[a.id]).length} /{" "}
        {ACHIEVEMENTS.length} амжилт
      </p>
      <div className="achievements-grid">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = data.achievementsUnlocked[a.id];
          return (
            <article
              className={`card achievement ${unlocked ? "unlocked" : ""}`}
              key={a.id}
            >
              <span className="achievement-icon">
                <Icon name={a.icon} size={30} />
              </span>
              <span className="badge">
                {unlocked ? "БИЕЛСЭН" : "ТАНЫ ӨМНӨ БАЙНА"}
              </span>
              <h2>{a.name}</h2>
              <p>{a.description}</p>
              <small>
                {unlocked?.replaceAll("-", ".") ?? "Өөрийн хэмнэлээр"}
              </small>
            </article>
          );
        })}
      </div>
    </>
  );
}
