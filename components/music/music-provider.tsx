"use client";

import React, { createContext, useContext, useState } from "react";

export type MusicSource =
  | { kind: "video"; id: string; title?: string }
  | { kind: "playlist"; id: string; title?: string }
  | { kind: "audio"; id: string; url: string; title?: string };

export type YouTubeSource = Extract<MusicSource, { kind: "video" | "playlist" }>;

interface MusicContextType {
  sources: MusicSource[];
  selected: number;
  source: MusicSource | null;
  busy: boolean;
  error: string | null;
  volume: number;
  muted: boolean;
  isPlaying: boolean;
  title: string;
  setTitle: (title: string) => void;
  select: (index: number) => void;
  next: () => void;
  previous: () => void;
  togglePlay: () => void;
  remove: (index: number) => void;
  addSource: (src: MusicSource) => void;
  addURL: (url: string) => void;
  addFile: (file: File) => void;
  onState: (state: number) => void;
}

const MusicContext = createContext<MusicContextType | null>(null);

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const [sources, setSources] = useState<MusicSource[]>([
    { kind: "video", id: "jfKfPfyJRdk", title: "Lofi Hip Hop Radio" },
  ]);
  const [selected, setSelected] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [title, setTitle] = useState("Lofi Radio");
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);

  const currentSource = sources[selected] || null;

  const next = () => {
    if (sources.length > 0) {
      setSelected((prev) => (prev + 1) % sources.length);
    }
  };

  const previous = () => {
    if (sources.length > 0) {
      setSelected((prev) => (prev - 1 + sources.length) % sources.length);
    }
  };

  const select = (index: number) => {
    if (index >= 0 && index < sources.length) {
      setSelected(index);
    }
  };

  const togglePlay = () => setIsPlaying((prev) => !prev);

  const addSource = (newSource: MusicSource) => {
    setSources((prev) => [...prev, newSource]);
  };

  const addURL = (url: string) => {
    addSource({ kind: "audio", id: Date.now().toString(), url, title: "Custom URL Track" });
  };

  const addFile = (file: File) => {
    const url = URL.createObjectURL(file);
    addSource({ kind: "audio", id: Date.now().toString(), url, title: file.name });
  };

  const remove = (index: number) => {
    setSources((prev) => prev.filter((_, i) => i !== index));
    if (selected >= index && selected > 0) {
      setSelected((prev) => prev - 1);
    }
  };

  const onState = (state: number) => {
    if (state === 0) {
      next();
    }
  };

  return (
    <MusicContext.Provider
      value={{
        sources,
        selected,
        source: currentSource,
        busy,
        error,
        volume,
        muted,
        isPlaying,
        title,
        setTitle,
        select,
        next,
        previous,
        togglePlay,
        remove,
        addSource,
        addURL,
        addFile,
        onState,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error("useMusic must be used within a MusicProvider");
  }
  return context;
}