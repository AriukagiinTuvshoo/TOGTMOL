// Unified 3-Deck Audio Bridge for TOGTMOL v10
// Synchronizes Deck 1 (MusicProvider: YouTube / 80MB Local Audio / Study Loops)
// with Deck 2 & 3 (SoundEngine: 13 Procedural Channels / Binaural / Chimes)
// while keeping <MusicPlayer /> fault-isolated inside its ModuleBoundary.

import type { MusicSource } from "@/types/study";
import type { ChannelId } from "./audio-engine";

export interface SavedAudioMix {
  id: string;
  name: string;
  createdAt: number;
  deck1Selected: string | null;
  deck1Name?: string;
  channels: Partial<Record<ChannelId, number>>;
}

export interface Deck1BridgeState {
  ready: boolean;
  name: string;
  selected: string;
  playing: boolean;
  playback: "playing" | "paused" | "stopped";
  volume: number;
  muted: boolean;
  open: boolean;
  busy: boolean;
  error: string;
  sources: MusicSource[];
}

export interface Deck1BridgeActions {
  toggle: () => void;
  stop: () => void;
  next: (delta?: number) => void;
  select: (id: string) => void;
  setOpen: (open: boolean) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  addUrl: (url: string, title?: string) => Promise<void>;
  addFile: (file: File | null) => Promise<void>;
  removeSource: (id: string) => Promise<void>;
}

const DEFAULT_DECK1: Deck1BridgeState = {
  ready: false,
  name: "Soft rain",
  selected: "ambient:rain",
  playing: false,
  playback: "stopped",
  volume: 0.35,
  muted: false,
  open: false,
  busy: false,
  error: "",
  sources: [],
};

let currentState: Deck1BridgeState = { ...DEFAULT_DECK1 };
let currentActions: Deck1BridgeActions | null = null;
const subscribers = new Set<(state: Deck1BridgeState) => void>();

export const deck1Bridge = {
  getState(): Deck1BridgeState {
    return currentState;
  },
  getActions(): Deck1BridgeActions | null {
    return currentActions;
  },
  publish(state: Deck1BridgeState, actions: Deck1BridgeActions) {
    currentState = state;
    currentActions = actions;
    subscribers.forEach((fn) => fn(currentState));
  },
  clear() {
    currentState = { ...DEFAULT_DECK1 };
    currentActions = null;
    subscribers.forEach((fn) => fn(currentState));
  },
  subscribe(fn: (state: Deck1BridgeState) => void) {
    subscribers.add(fn);
    fn(currentState);
    return () => {
      subscribers.delete(fn);
    };
  },
};

export function readSavedMixes(
  extras: Record<string, unknown> | undefined,
): SavedAudioMix[] {
  const raw = extras?.savedMixes;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> =>
      Boolean(x && typeof x === "object"),
    )
    .map((x) => ({
      id: typeof x.id === "string" ? x.id : `mix-${Date.now()}`,
      name: typeof x.name === "string" ? x.name.slice(0, 60) : "Миний микс",
      createdAt: typeof x.createdAt === "number" ? x.createdAt : 0,
      deck1Selected:
        typeof x.deck1Selected === "string" ? x.deck1Selected : null,
      deck1Name: typeof x.deck1Name === "string" ? x.deck1Name : undefined,
      channels:
        x.channels && typeof x.channels === "object"
          ? (x.channels as Partial<Record<ChannelId, number>>)
          : {},
    }))
    .slice(0, 24);
}
