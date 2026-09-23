"use client";
import { useMemo, useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { actions } from "@/lib/persistence/actions";
import {
  ACCESSORIES,
  ATMOSPHERES,
  BACKGROUNDS,
  COMPANIONS,
  DESIGNS,
  DESK_ITEMS,
  ROOM_REWARDS,
} from "@/lib/world/config";
import { companionProgress } from "@/lib/world/progress";
import {
  roomFurniture,
  updateFurniture,
  type Furniture,
} from "@/lib/world/furniture";
import type { WorldSettings } from "@/types/study";
import { RoomScene } from "./room-scene";
import { CompanionAvatar } from "./companion";
import { SectionTitle } from "@/components/ui/common";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/components/i18n/language-provider";
const ROOM_NAME_EN: Record<string, string> = {
  "Үнэг": "Fox",
  "Муур": "Cat",
  "Баавгай": "Bear",
  "Туулай": "Rabbit",
  "Оцон шувуу": "Penguin",
  "Нохой": "Dog",
  "Дулаахан өрөө": "Cozy room",
  "Шөнийн өрөө": "Night room",
  "Бороотой цонх": "Rainy window",
  "Номын сан": "Library",
  "Ой": "Forest",
  "Кафе": "Café",
  "Цэвэрхэн өрөө": "Minimal room",
  "Сансар": "Space",
  "Япон өрөө": "Japanese room",
  "Хоккайдо": "Hokkaido",
  "Далайн эрэг": "Ocean",
  "Өдөр": "Day",
  "Орой": "Evening",
  "Шөнө": "Night",
  "Бороо": "Rain",
  "Цас": "Snow",
  "Зөөврийн компьютер": "Laptop",
  "Ном": "Books",
  "Дэвтэр": "Notebook",
  "Кофе": "Coffee",
  "Цай": "Tea",
  "Ургамал": "Plant",
  "Гэрэл": "Lamp",
  "Энгийн": "Simple",
  "Навч": "Leaf",
  "Нүдний шил": "Glasses",
  "Од": "Star",
  "Цэцэг": "Flower",
  "{language === "en" ? "Light wood" : "Цайвар мод"}": "Light wood",
  "Цагаан": "White",
  "{language === "en" ? "Dark wood" : "Бараан мод"}": "Dark wood",
  "{language === "en" ? "Linen" : "Маалинган"}": "Linen",
  "{language === "en" ? "Green" : "Ногоон"}": "Green",
  "{language === "en" ? "Soft pink" : "Бүдэг ягаан"}": "Soft pink",
  "{language === "en" ? "Landscape" : "Байгаль"}": "Landscape",
  "{language === "en" ? "No poster" : "Зураггүй"}": "No poster",
  "{language === "en" ? "Scarf" : "Ороолт"}": "Scarf",
  "{language === "en" ? "Vest" : "Хантааз"}": "Vest",
  "{language === "en" ? "Match activity" : "Үйлдэлтэйгээ хамт"}": "Match activity",
  "{language === "en" ? "Smiling" : "Инээмсэглэсэн"}": "Smiling",
  "Тайван": "Calm",
};
const roomText = (value: string, language: "mn" | "en") =>
  language === "en" ? ROOM_NAME_EN[value] ?? value : value;
const ROOM_DESCRIPTION_EN: Record<string, string> = {
  "Дулаахан гэрэл · модон ширээ · зөөлөн хэлбэр": "Warm light · wooden desk · soft shapes",
  "Цэвэрхэн шугам · цэлгэр зай · нам гүм": "Clean lines · open space · quiet",
  "Одтой тэнгэр · гүн хөх · ширээний гэрэл": "Starry sky · deep blue · desk lamp",
  "Ногоон ой · ургамал · байгалийн хэмнэл": "Green forest · plants · natural rhythm",
  "Сакура · цаасан хаалт · тайван ягаан": "Sakura · paper screens · calm pink",
  "Борооны хэмнэл · хотын цонх · цайны ширээ": "Rain rhythm · city window · tea table",
  "Оддын орбит · гүн хөх · сансрын ажиглалт": "Star orbit · deep blue · space view",
  "Цаст уул · модон байшин · дулаахан гэрэл": "Snowy mountains · wooden cabin · warm light",
  "Номын тавиур · хүрэн мод · унших булан": "Bookshelves · brown wood · reading corner",
  "Далайн давалгаа · цагаан ширээ · цэлгэр хөх": "Ocean waves · white desk · open blue",
};
const roomDescription = (value: string, language: "mn" | "en") =>
  language === "en" ? ROOM_DESCRIPTION_EN[value] ?? value : value;
export function CustomizeRoom() {
  const { data, store, run, navigate, today } = useStudy(),
    { language } = useI18n(),
    world = data.settings.world;
  const progress = useMemo(() => companionProgress(data, today), [data, today]);
  const [showAllRooms, setShowAllRooms] = useState(false);
  const unlockedRewards = useMemo(
    () => new Set(progress.roomRewards.map((reward) => reward.id)),
    [progress.roomRewards],
  );
  const nextReward = ROOM_REWARDS.find(
    (reward) => progress.studyHours < reward.requiredHours,
  );
  const furniture = roomFurniture(world);
  const furnish = (patch: Partial<Furniture>) =>
    run(() =>
      store.mutate((d) =>
        actions.settings({ world: updateFurniture(d.settings.world, patch) })(
          d,
        ),
      ),
    );
  const update = (patch: Partial<WorldSettings>) =>
    run(() =>
      store.mutate((d) =>
        actions.settings({ world: { ...d.settings.world, ...patch } })(d),
      ),
    );
  return (
    <div className="stack room-customizer">
      <SectionTitle
        title={language === "en" ? "Your little world" : "Таны жижиг ертөнц"}
        subtitle={language === "en" ? "Choose a room, Bondook, and lighting that feel comfortable." : "Өрөө, Бондоок, гэрэл — өөртөө тухтайг сонгоорой."}
        action={
          <button
            className="button primary"
            onClick={() => navigate("overview")}
          >
            {language === "en" ? "Go to room" : "Өрөөндөө очих"}
          </button>
        }
      />
      <div className="customizer-layout">
        <div className="customizer-preview">
          <RoomScene world={world} />
          <p>
            Бондоок · Lv. {progress.level} · {progress.xp} XP
          </p>
        </div>
        <div className="stack">
          <section className="card">
            <h2>{language === "en" ? "Room environment" : "Өрөөний орчин"}</h2>
            <div className="form-grid">
              <label>
                {language === "en" ? "Background" : "Арын орчин"}
                <select
                  value={world.background}
                  onChange={(e) =>
                    update({
                      background: e.target.value as WorldSettings["background"],
                    })
                  }
                >
                  {BACKGROUNDS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {roomText(b.name, language)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {language === "en" ? "Lighting & weather" : "Гэрэл, цаг агаар"}
                <select
                  value={world.atmosphere}
                  onChange={(e) =>
                    update({
                      atmosphere: e.target.value as WorldSettings["atmosphere"],
                    })
                  }
                >
                  {ATMOSPHERES.map((b) => (
                    <option key={b.id} value={b.id}>
                      {roomText(b.name, language)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className="desk-options">
              <legend>{language === "en" ? "On the desk" : "Ширээн дээр"}</legend>
              {DESK_ITEMS.map((i) => (
                <label key={i.id}>
                  <input
                    type="checkbox"
                    checked={world.desk.includes(i.id)}
                    onChange={() =>
                      update({
                        desk: world.desk.includes(i.id)
                          ? world.desk.filter((x) => x !== i.id)
                          : [...world.desk, i.id],
                      })
                    }
                  />
                  {roomText(i.name, language)}
                </label>
              ))}
            </fieldset>
            <div className="form-grid furniture-options">
              <label>
                Ширээ
                <select
                  value={furniture.desk}
                  onChange={(e) =>
                    furnish({ desk: e.target.value as Furniture["desk"] })
                  }
                >
                  <option value="oak">Цайвар мод</option>
                  <option value="white">Цагаан</option>
                  <option value="walnut">Бараан мод</option>
                </select>
              </label>
              <label>
                Сандал
                <select
                  value={furniture.chair}
                  onChange={(e) =>
                    furnish({ chair: e.target.value as Furniture["chair"] })
                  }
                >
                  <option value="linen">Маалинган</option>
                  <option value="sage">Ногоон</option>
                  <option value="rose">Бүдэг ягаан</option>
                </select>
              </label>
              <label>
                Ханын зураг
                <select
                  value={furniture.poster}
                  onChange={(e) =>
                    furnish({ poster: e.target.value as Furniture["poster"] })
                  }
                >
                  <option value="landscape">Байгаль</option>
                  <option value="none">Зураггүй</option>
                  <option
                    value="botanical"
                    disabled={!unlockedRewards.has("botanical_poster")}
                  >
                    Ургамлын зураг · 5 цаг
                  </option>
                </select>
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={furniture.bookshelf}
                  disabled={
                    !unlockedRewards.has("bookshelf") && !furniture.bookshelf
                  }
                  onChange={(e) => furnish({ bookshelf: e.target.checked })}
                />
                Номын тавиур · 10 цаг
              </label>
            </div>
          </section>
          <section className="card">
            <h2>{language === "en" ? "Bondook's look" : "Бондоокийн төрх"}</h2>
            <div className="companion-options">
              {COMPANIONS.map((c) => (
                <button
                  key={c.id}
                  className="companion-option"
                  aria-pressed={world.companion === c.id}
                  onClick={() => update({ companion: c.id })}
                >
                  <CompanionAvatar world={{ ...world, companion: c.id }} />
                  <span>{roomText(c.name, language)}</span>
                </button>
              ))}
            </div>
            <div className="form-grid">
              <label>
                Хувцас
                <select
                  value={world.outfit}
                  onChange={(e) =>
                    update({
                      outfit: e.target.value as WorldSettings["outfit"],
                    })
                  }
                >
                  <option value="scarf">Ороолт</option>
                  <option value="vest">Хантааз</option>
                  <option value="none">Энгийн</option>
                </select>
              </label>
              <label>
                Илэрхийлэл
                <select
                  value={world.expression}
                  onChange={(e) =>
                    update({
                      expression: e.target.value as WorldSettings["expression"],
                    })
                  }
                >
                  <option value="auto">Үйлдэлтэйгээ хамт</option>
                  <option value="smile">Инээмсэглэсэн</option>
                  <option value="calm">Тайван</option>
                </select>
              </label>
            </div>
            <fieldset className="accessory-options">
              <legend>{language === "en" ? "Small decorations" : "Жижиг чимэглэл"}</legend>
              {ACCESSORIES.map((a) => {
                const reward = ROOM_REWARDS.find((item) => item.id === a.id);
                return (
                  <button
                    key={a.id}
                    className="button small"
                    disabled={Boolean(
                      reward && !unlockedRewards.has(reward.id),
                    )}
                    aria-pressed={world.accessory === a.id}
                    onClick={() => update({ accessory: a.id })}
                  >
                    {roomText(a.name, language)}
                    {reward && !unlockedRewards.has(reward.id)
                      ? ` · ${reward.requiredHours}ц`
                      : ""}
                  </button>
                );
              })}
            </fieldset>
            <div className="room-reward-progress">
              <strong>{language === "en" ? "Room rewards" : "Өрөөний шагнал"}</strong>
              <span>
                {language === "en" ? `Total study time: ${progress.studyHours.toFixed(1)} hours.` : `Нийт ${progress.studyHours.toFixed(1)} цаг суралцжээ.`}
                {nextReward
                  ? ` Дараагийнх: ${nextReward.name} · ${nextReward.requiredHours} цаг.`
                  : " {language === "en" ? "All rewards unlocked." : "Бүх шагналаа нээлээ."}"}
              </span>
              <div
                className="progress"
                role="progressbar"
                aria-label={language === "en" ? "Progress to next room reward" : "Дараагийн өрөөний шагналын ахиц"}
                aria-valuemin={0}
                aria-valuemax={nextReward?.requiredHours ?? 100}
                aria-valuenow={Math.min(
                  progress.studyHours,
                  nextReward?.requiredHours ?? 100,
                )}
              >
                <span
                  style={{
                    width: `${nextReward ? Math.min(100, (progress.studyHours / nextReward.requiredHours) * 100) : 100}%`,
                  }}
                />
              </div>
            </div>
            <p className="tiny muted">
              Өмнөх өрөөний тохиргоо хэвээр хадгалагдана. Шинэ зүйлсийг
              суралцсан цагаар нээнэ.
            </p>
          </section>
        </div>
      </div>
      <section className="card">
        <SectionTitle
          title={language === "en" ? "Ten room themes" : "Арван өөр уур амьсгал"}
          subtitle={language === "en" ? "Changing a theme updates the room, Bondook, lighting, and page style together." : "Theme солиход өрөө, Бондоок, гэрэл болон хуудасны загвар хамт өөрчлөгдөнө."}
        />
        <div className="theme-gallery">
          {(showAllRooms ? DESIGNS : DESIGNS.slice(0, 4)).map((d) => (
            <button
              className={`theme-preview theme-${d.id}`}
              key={d.id}
              aria-pressed={world.design === d.id}
              onClick={() =>
                update({
                  design: d.id,
                  background: d.background,
                  companion: d.companion,
                  atmosphere: d.atmosphere,
                })
              }
            >
              <RoomScene
                mini
                world={{
                  ...world,
                  design: d.id,
                  background: d.background,
                  companion: d.companion,
                  atmosphere: d.atmosphere,
                }}
              />
              <strong>{d.name}</strong>
              <span>{roomDescription(d.description, language)}</span>
              {world.design === d.id && (
                <span className="theme-selected">{language === "en" ? "Selected" : "Сонгосон"}</span>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="text-button settings-link"
          aria-expanded={showAllRooms}
          onClick={() => setShowAllRooms((current) => !current)}
        >
          {showAllRooms
            ? language === "en"
              ? "Show main 4 rooms"
              : "Үндсэн 4 өрөөг харуулах"
            : language === "en"
              ? "Other rooms (6)"
              : "Бусад өрөө (6)"}
          <Icon name={showAllRooms ? "chevron-up" : "chevron-down"} size={16} />
        </button>
      </section>
    </div>
  );
}
