import type { WorldSettings } from "@/types/study";
import { isObject } from "@/lib/migration/values";
export interface Furniture {
  desk: "oak" | "white" | "walnut";
  chair: "linen" | "sage" | "rose";
  poster: "landscape" | "botanical" | "none";
  bookshelf: boolean;
}
export function roomFurniture(world: WorldSettings): Furniture {
  const raw = isObject(world.extras.furniture) ? world.extras.furniture : {};
  return {
    desk: raw.desk === "white" || raw.desk === "walnut" ? raw.desk : "oak",
    chair: raw.chair === "sage" || raw.chair === "rose" ? raw.chair : "linen",
    poster:
      raw.poster === "botanical" || raw.poster === "none"
        ? raw.poster
        : "landscape",
    bookshelf: raw.bookshelf === true,
  };
}
export function updateFurniture(
  world: WorldSettings,
  patch: Partial<Furniture>,
): WorldSettings {
  return {
    ...world,
    extras: {
      ...world.extras,
      furniture: {
        ...(isObject(world.extras.furniture) ? world.extras.furniture : {}),
        ...roomFurniture(world),
        ...patch,
      },
    },
  };
}
