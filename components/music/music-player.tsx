"use client";

import React, { useRef } from "react";
import { useMusic } from "./music-provider";
import { Play, Pause, SkipBack, SkipForward, Trash2 } from "lucide-react";

export function MusicPlayer() {
  const {
    title,
    sources,
    selected,
    source,
    isPlaying,
    select,
    next,
    previous,
    togglePlay,
    remove,
  } = useMusic();

  const dock = useRef<HTMLDivElement>(null);

  return (
    <div ref={dock} className="music-player-container p-4 bg-slate-900 text-white rounded-xl shadow-lg w-full max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-lg">{title || "Music Player"}</h3>
        <span className="text-xs bg-slate-800 px-2 py-1 rounded">
          {sources.length > 0 ? `${selected + 1} / ${sources.length}` : "0"}
        </span>
      </div>

      {/* Currently Playing Track */}
      <div className="text-sm text-slate-300 mb-4 truncate">
        {source ? source.title || source.id : "Дуу сонгогдоогүй байна"}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={previous}
          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition"
          title="Өмнөх дуу"
        >
          <SkipBack size={20} />
        </button>

        <button
          onClick={togglePlay}
          className="p-3 bg-indigo-600 hover:bg-indigo-500 rounded-full transition"
          title={isPlaying ? "Түр зогсоох" : "Тоглуулах"}
        >
          {isPlaying ? <Pause size={22} /> : <Play size={22} />}
        </button>

        <button
          onClick={next}
          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition"
          title="Дараагийн дуу"
        >
          <SkipForward size={20} />
        </button>
      </div>

      {/* Playlist Section */}
      <section>
        <ul className="max-h-40 space-y-2 overflow-y-auto border-t border-slate-800 pt-3">
          {sources.map((item, index) => (
            <li
              key={item.id || index}
              className={`flex items-center justify-between rounded p-2 text-sm transition ${
                selected === index
                  ? "bg-indigo-600/30 font-medium text-indigo-300"
                  : "hover:bg-slate-800"
              }`}
            >
              <button
                type="button"
                onClick={() => select(index)}
                className="min-w-0 flex-1 truncate text-left"
                aria-current={selected === index ? "true" : undefined}
              >
                {item.title || `Дуу ${index + 1}`}
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                className="p-1 text-slate-500 hover:text-red-400"
                aria-label={`${item.title || `Дуу ${index + 1}`} устгах`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}