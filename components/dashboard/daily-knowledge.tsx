"use client";
import { StoredImage } from "@/components/ui/stored-image";
import { useMemo, useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { knowledgeIndex } from "@/lib/knowledge/index";
import { KnowledgeEditor } from "@/components/knowledge/editor";
import { CardReview } from "@/components/knowledge/review";
import { CompanionAvatar } from "@/components/world/companion";
import { Icon } from "@/components/ui/icon";
export function DailyKnowledge() {
  const { data, today, navigate } = useStudy(),
    [editing, setEditing] = useState(false),
    [reviewing, setReviewing] = useState(false);
  const index = useMemo(
    () => knowledgeIndex(data.knowledge, today),
    [data.knowledge, today],
  );
  const inspiration = index.notes
    .filter((n) => n.kind === "note" && n.date === today)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  return (
    <>
      <div className="daily-knowledge-grid">
        <section className="card inspiration-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ӨНӨӨДРИЙН САНАА</span>
              <h2>Юуг ойлгож авах вэ?</h2>
            </div>
            <button
              className="icon-button bordered"
              aria-label="Өнөөдрийн зураг, тэмдэглэл нэмэх"
              onClick={() => setEditing(true)}
            >
              <Icon name="plus" />
            </button>
          </div>
          {inspiration?.kind === "note" ? (
            <>
              <button
                className="inspiration-content"
                onClick={() => navigate("knowledge", inspiration.id)}
              >
                {inspiration.image ? (
                  <StoredImage
                    src={inspiration.image}
                    alt={inspiration.title}
                  />
                ) : (
                  <span className="inspiration-paper">
                    <Icon name="book" size={45} />
                  </span>
                )}
                <div>
                  <h3>{inspiration.title}</h3>
                  <p>{inspiration.body.slice(0, 220)}</p>
                </div>
              </button>
              <button
                className="text-button"
                onClick={() => navigate("knowledge", inspiration.id)}
              >
                Тэмдэглэлээ нээх →
              </button>
            </>
          ) : (
            <button
              className="inspiration-empty"
              onClick={() => setEditing(true)}
            >
              <span>＋</span>
              <strong>Нэг зураг. Нэг шинэ ойлголт.</strong>
              <p>Сурах хуудас, зураг эсвэл тэмдэглэлээ энд үлдээгээрэй.</p>
            </button>
          )}
        </section>
        <section className="card bondook-review-card">
          <CompanionAvatar world={data.settings.world} />
          <span className="eyebrow">БОНДООКИЙН БУЛАН</span>
          <h2>
            {index.reviewQueue.length
              ? "Мэдлэгээ жаахан сэргээх үү?"
              : "Жижиг ойлголтоос эхэлье."}
          </h2>
          <p>
            {index.reviewQueue.length
              ? `${index.due.length} хугацаа болсон, ${index.fresh.length} шинэ карт таныг хүлээж байна.`
              : "Сурсан зүйлээ нэг картаар үлдээвэл дараагийн удаа эргэн санахад амар болно."}
          </p>
          <button
            className="button primary"
            onClick={() =>
              index.reviewQueue.length
                ? setReviewing(true)
                : navigate("knowledge")
            }
          >
            {index.reviewQueue.length
              ? "Давтлага эхлүүлэх"
              : "Мэдлэгийн сангаа нээх"}
          </button>
          <button className="text-button" onClick={() => navigate("assistant")}>
            Бондооктой ярилцах →
          </button>
        </section>
      </div>
      {editing && (
        <KnowledgeEditor kind="note" onClose={() => setEditing(false)} />
      )}{" "}
      {reviewing && <CardReview onClose={() => setReviewing(false)} />}
    </>
  );
}
