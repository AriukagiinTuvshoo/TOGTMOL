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
export function CustomizeRoom() {
  const { data, store, run, navigate, today } = useStudy(),
    world = data.settings.world;
  const progress = useMemo(() => companionProgress(data, today), [data, today]);
  const [showAllRooms, setShowAllRooms] = useState(false);
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
        title="Таны жижиг ертөнц"
        subtitle="Өрөө, Бондоок, гэрэл — өөртөө тухтайг сонгоорой."
        action={
          <button
            className="button primary"
            onClick={() => navigate("overview")}
          >
            Өрөөндөө очих
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
            <h2>Өрөөний орчин</h2>
            <div className="form-grid">
              <label>
                Арын орчин
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
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Гэрэл, цаг агаар
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
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className="desk-options">
              <legend>Ширээн дээр</legend>
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
                  {i.name}
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
                  <option value="botanical" disabled={progress.level < 2}>
                    Ургамлын зураг · 2-р түвшин
                  </option>
                </select>
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={furniture.bookshelf}
                  disabled={progress.level < 3 && !furniture.bookshelf}
                  onChange={(e) => furnish({ bookshelf: e.target.checked })}
                />
                Номын тавиур · 3-р түвшин
              </label>
            </div>
          </section>
          <section className="card">
            <h2>Бондоокийн төрх</h2>
            <div className="companion-options">
              {COMPANIONS.map((c) => (
                <button
                  key={c.id}
                  className="companion-option"
                  aria-pressed={world.companion === c.id}
                  onClick={() => update({ companion: c.id })}
                >
                  <CompanionAvatar world={{ ...world, companion: c.id }} />
                  <span>{c.name}</span>
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
              <legend>Жижиг чимэглэл</legend>
              {ACCESSORIES.map((a) => (
                <button
                  key={a.id}
                  className="button small"
                  disabled={progress.level < a.level}
                  aria-pressed={world.accessory === a.id}
                  onClick={() => update({ accessory: a.id })}
                >
                  {a.name}
                  {progress.level < a.level ? ` · Lv. ${a.level}` : ""}
                </button>
              ))}
            </fieldset>
            <p className="tiny muted">
              Бүх хамтрагч, өрөө анхнаасаа нээлттэй. Од, цэцэг нь суралцах явцад
              нэмэгдэнэ.
            </p>
          </section>
        </div>
      </div>
      <section className="card">
        <SectionTitle
          title="Таван өөр уур амьсгал"
          subtitle="Theme солиход өрөө, Бондоок, гэрэл болон хуудасны загвар хамт өөрчлөгдөнө."
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
              <span>{d.description}</span>
              {world.design === d.id && (
                <span className="theme-selected">Сонгосон</span>
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
          {showAllRooms ? "Үндсэн 4 өрөөг харуулах" : "Бусад өрөө (6)"}
          <Icon name={showAllRooms ? "chevron-up" : "chevron-down"} size={16} />
        </button>
      </section>
    </div>
  );
}
