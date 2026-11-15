// ─── TOGTMOL v9 · 13-Channel Procedural Web Audio Sound Engine ───────
// 100% Web Audio API — no external audio files.
// Strictly lazy: AudioContext is NEVER instantiated until an explicit user action.

export type ChannelId =
  | "rain"
  | "ocean"
  | "forest"
  | "cafe"
  | "fire"
  | "wind"
  | "white"
  | "pink"
  | "brown"
  | "drone"
  | "binaural"
  | "lofi"
  | "purr";

export interface ChannelDef {
  id: ChannelId;
  name: string;
  nameMn: string;
  icon: string;
  desc: string;
  color: string;
}

export const CHANNELS: ChannelDef[] = [
  {
    id: "rain",
    name: "Rain",
    nameMn: "Бороо",
    icon: "cloud-rain",
    desc: "Шилэн дээрх бороо",
    color: "#38bdf8",
  },
  {
    id: "ocean",
    name: "Ocean",
    nameMn: "Далай",
    icon: "waves",
    desc: "Зөөлөн долгион",
    color: "#2dd4bf",
  },
  {
    id: "forest",
    name: "Forest",
    nameMn: "Ой",
    icon: "trees",
    desc: "Салхи + шувууд",
    color: "#4ade80",
  },
  {
    id: "cafe",
    name: "Café",
    nameMn: "Кафе",
    icon: "coffee",
    desc: "Хүмүүсийн яриа",
    color: "#f59e0b",
  },
  {
    id: "fire",
    name: "Fireplace",
    nameMn: "Зуух",
    icon: "flame",
    desc: "Галын тачигнаа",
    color: "#fb923c",
  },
  {
    id: "wind",
    name: "Wind",
    nameMn: "Салхи",
    icon: "wind",
    desc: "Уулын салхи",
    color: "#94a3b8",
  },
  {
    id: "white",
    name: "White",
    nameMn: "Цагаан",
    icon: "audio-lines",
    desc: "White noise",
    color: "#e2e8f0",
  },
  {
    id: "pink",
    name: "Pink",
    nameMn: "Ягаан",
    icon: "audio-waveform",
    desc: "Pink noise",
    color: "#f472b6",
  },
  {
    id: "brown",
    name: "Brown",
    nameMn: "Бор",
    icon: "waves-ladder",
    desc: "Brown noise",
    color: "#a16207",
  },
  {
    id: "drone",
    name: "Drone",
    nameMn: "Дрон",
    icon: "orbit",
    desc: "Гүн фокус дрон",
    color: "#8b5cf6",
  },
  {
    id: "binaural",
    name: "Binaural α",
    nameMn: "Хоёр чих",
    icon: "brain",
    desc: "Альфа долгион 10Hz",
    color: "#c084fc",
  },
  {
    id: "lofi",
    name: "Lo-Fi",
    nameMn: "Лоуфай",
    icon: "disc",
    desc: "Зөөлөн аккорд",
    color: "#fb7185",
  },
  {
    id: "purr",
    name: "Cat Purr",
    nameMn: "Муур",
    icon: "cat",
    desc: "Муурны хурхираа",
    color: "#fbbf24",
  },
];

export interface Preset {
  id: string;
  name: string;
  nameMn: string;
  emoji: string;
  desc: string;
  mix: Partial<Record<ChannelId, number>>;
}

export const PRESETS: Preset[] = [
  {
    id: "deep-night",
    name: "Deep Night",
    nameMn: "Гүн шөнө",
    emoji: "🌙",
    desc: "Бороо + дрон + бинаурал — шалгалтын өмнөх шөнө",
    mix: { rain: 0.35, drone: 0.5, binaural: 0.55, brown: 0.25 },
  },
  {
    id: "rainy-cafe",
    name: "Rainy Café",
    nameMn: "Бороотой кафе",
    emoji: "🌧️",
    desc: "Бороо + кафе + жааз маягийн лоуфай",
    mix: { rain: 0.6, cafe: 0.45, lofi: 0.35, fire: 0.1 },
  },
  {
    id: "forest-dawn",
    name: "Forest Dawn",
    nameMn: "Ойн үүр",
    emoji: "🌲",
    desc: "Шувууд + салхи — өглөөний уншлага",
    mix: { forest: 0.7, wind: 0.25, pink: 0.15 },
  },
  {
    id: "deep-space",
    name: "Deep Space",
    nameMn: "Гүн сансар",
    emoji: "🚀",
    desc: "Дрон + цагаан чимээ — код/математик",
    mix: { drone: 0.65, white: 0.18, binaural: 0.4 },
  },
  {
    id: "cabin-fire",
    name: "Cabin Fire",
    nameMn: "Байшингийн гал",
    emoji: "🔥",
    desc: "Гал + салхи + бороо — өвлийн орой",
    mix: { fire: 0.65, wind: 0.3, rain: 0.2 },
  },
  {
    id: "library-hush",
    name: "Library Hush",
    nameMn: "Номын сан",
    emoji: "📚",
    desc: "Кафе (бага) + бор чимээ — номын сан",
    mix: { cafe: 0.3, brown: 0.4, pink: 0.2 },
  },
  {
    id: "ocean-breath",
    name: "Ocean Breath",
    nameMn: "Далайн амьсгал",
    emoji: "🌊",
    desc: "Долгион + салхи — амьсгалын дасгал",
    mix: { ocean: 0.7, wind: 0.3, drone: 0.2 },
  },
  {
    id: "sakura-lofi",
    name: "Sakura Lo-Fi",
    nameMn: "Сакура лоуфай",
    emoji: "🌸",
    desc: "Лоуфай + ой — хөгжилтэй давтлага",
    mix: { lofi: 0.6, forest: 0.3, rain: 0.15 },
  },
  {
    id: "cozy-purr",
    name: "Cozy Purr",
    nameMn: "Муужгай",
    emoji: "🐱",
    desc: "Муур + гал — хамгийн тайван",
    mix: { purr: 0.6, fire: 0.3, pink: 0.2 },
  },
  {
    id: "pure-focus",
    name: "Pure Focus",
    nameMn: "Цэвэр фокус",
    emoji: "💎",
    desc: "Бор + бинаурал — гүн ажил",
    mix: { brown: 0.5, binaural: 0.5, drone: 0.25 },
  },
  {
    id: "exam-mode",
    name: "Exam Mode",
    nameMn: "Шалгалтын горим",
    emoji: "⚡",
    desc: "Ягаан + дрон — сатаарал тэг",
    mix: { pink: 0.45, drone: 0.4, binaural: 0.45 },
  },
];

export const DEFAULT_MIX: Record<ChannelId, number> = {
  rain: 0,
  ocean: 0,
  forest: 0,
  cafe: 0,
  fire: 0,
  wind: 0,
  white: 0,
  pink: 0,
  brown: 0,
  drone: 0,
  binaural: 0,
  lofi: 0,
  purr: 0,
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function makeNoiseBuffer(
  ctx: BaseAudioContext,
  kind: "white" | "pink" | "brown",
): AudioBuffer {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  if (kind === "white") {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } else if (kind === "pink") {
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  return buf;
}

interface LiveChannel {
  gain: GainNode;
  pan: StereoPannerNode | null;
  stop: () => void;
}

type Generator = (ctx: AudioContext, out: GainNode) => () => void;

const genNoise =
  (
    kind: "white" | "pink" | "brown",
    filterFreq?: number,
    filterType: BiquadFilterType = "lowpass",
    filterQ = 0.7,
  ): Generator =>
  (ctx, out) => {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, kind);
    src.loop = true;
    let head: AudioNode = src;
    if (filterFreq) {
      const f = ctx.createBiquadFilter();
      f.type = filterType;
      f.frequency.value = filterFreq;
      f.Q.value = filterQ;
      src.connect(f);
      head = f;
    }
    head.connect(out);
    src.start();
    return () => {
      try {
        src.stop();
      } catch {
        /* noop */
      }
      src.disconnect();
    };
  };

const genRain: Generator = (ctx, out) => {
  const cleanups: (() => void)[] = [];
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, "white");
  src.loop = true;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1400;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 4500;
  bp.Q.value = 0.4;
  const g = ctx.createGain();
  g.gain.value = 0.5;
  src.connect(hp);
  hp.connect(bp);
  bp.connect(g);
  g.connect(out);
  src.start();
  cleanups.push(() => {
    try {
      src.stop();
    } catch {
      /* noop */
    }
  });
  const src2 = ctx.createBufferSource();
  src2.buffer = makeNoiseBuffer(ctx, "pink");
  src2.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  const g2 = ctx.createGain();
  g2.gain.value = 0.4;
  src2.connect(lp);
  lp.connect(g2);
  g2.connect(out);
  src2.start();
  cleanups.push(() => {
    try {
      src2.stop();
    } catch {
      /* noop */
    }
  });
  let alive = true;
  const drop = () => {
    if (!alive) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    const f = rand(1800, 5200);
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * rand(0.5, 0.7), t + 0.06);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(rand(0.02, 0.07), t + 0.008);
    e.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.05, 0.12));
    o.connect(e);
    e.connect(out);
    o.start(t);
    o.stop(t + 0.15);
    setTimeout(drop, rand(60, 420));
  };
  drop();
  return () => {
    alive = false;
    cleanups.forEach((c) => c());
  };
};

const genOcean: Generator = (ctx, out) => {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, "brown");
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 700;
  lp.Q.value = 0.6;
  const swell = ctx.createGain();
  swell.gain.value = 0.6;
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.09;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 0.35;
  lfo.connect(lfoG);
  lfoG.connect(swell.gain);
  const lfo2 = ctx.createOscillator();
  lfo2.type = "sine";
  lfo2.frequency.value = 0.055;
  const lfo2G = ctx.createGain();
  lfo2G.gain.value = 320;
  lfo2.connect(lfo2G);
  lfo2G.connect(lp.frequency);
  const src2 = ctx.createBufferSource();
  src2.buffer = makeNoiseBuffer(ctx, "white");
  src2.loop = true;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 5000;
  const g2 = ctx.createGain();
  g2.gain.value = 0.05;
  lfoG.connect(g2.gain);
  src.connect(lp);
  lp.connect(swell);
  swell.connect(out);
  src2.connect(hp);
  hp.connect(g2);
  g2.connect(out);
  src.start();
  src2.start();
  lfo.start();
  lfo2.start();
  return () => {
    try {
      src.stop();
      src2.stop();
      lfo.stop();
      lfo2.stop();
    } catch {
      /* noop */
    }
  };
};

const genForest: Generator = (ctx, out) => {
  const cleanups: (() => void)[] = [];
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, "pink");
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1200;
  bp.Q.value = 0.5;
  const g = ctx.createGain();
  g.gain.value = 0.28;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.13;
  const lg = ctx.createGain();
  lg.gain.value = 0.12;
  lfo.connect(lg);
  lg.connect(g.gain);
  src.connect(bp);
  bp.connect(g);
  g.connect(out);
  src.start();
  lfo.start();
  cleanups.push(() => {
    try {
      src.stop();
      lfo.stop();
    } catch {
      /* noop */
    }
  });
  let alive = true;
  const bird = () => {
    if (!alive) return;
    const t0 = ctx.currentTime + 0.02;
    const chirps = 2 + Math.floor(Math.random() * 4);
    const base = rand(2200, 4200);
    for (let i = 0; i < chirps; i++) {
      const t = t0 + i * rand(0.09, 0.16);
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(base * rand(0.9, 1.1), t);
      o.frequency.exponentialRampToValueAtTime(base * rand(1.2, 1.6), t + 0.05);
      o.frequency.exponentialRampToValueAtTime(base * rand(0.8, 1), t + 0.1);
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(rand(0.03, 0.08), t + 0.02);
      e.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(e);
      e.connect(out);
      o.start(t);
      o.stop(t + 0.15);
    }
    setTimeout(bird, rand(1500, 7000));
  };
  setTimeout(bird, 600);
  return () => {
    alive = false;
    cleanups.forEach((c) => c());
  };
};

const genCafe: Generator = (ctx, out) => {
  const cleanups: (() => void)[] = [];
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, "pink");
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 500;
  bp.Q.value = 0.4;
  const g = ctx.createGain();
  g.gain.value = 0.35;
  src.connect(bp);
  bp.connect(g);
  g.connect(out);
  src.start();
  cleanups.push(() => {
    try {
      src.stop();
    } catch {
      /* noop */
    }
  });
  let alive = true;
  const murmur = () => {
    if (!alive) return;
    const t = ctx.currentTime + 0.02;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    const base = rand(90, 220);
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(
      base * rand(0.9, 1.3),
      t + rand(0.15, 0.4),
    );
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = rand(400, 1400);
    f.Q.value = 2.5;
    const e = ctx.createGain();
    const dur = rand(0.15, 0.45);
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(rand(0.015, 0.05), t + dur * 0.3);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f);
    f.connect(e);
    e.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
    setTimeout(murmur, rand(120, 500));
  };
  const clink = () => {
    if (!alive) return;
    const t = ctx.currentTime + 0.02;
    [rand(2800, 3600), rand(4200, 5600)].forEach((fr) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = fr;
      const e = ctx.createGain();
      e.gain.setValueAtTime(rand(0.015, 0.045), t);
      e.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.2, 0.5));
      o.connect(e);
      e.connect(out);
      o.start(t);
      o.stop(t + 0.6);
    });
    setTimeout(clink, rand(4000, 12000));
  };
  murmur();
  setTimeout(clink, 2500);
  return () => {
    alive = false;
    cleanups.forEach((c) => c());
  };
};

const genFire: Generator = (ctx, out) => {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, "brown");
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 500;
  const g = ctx.createGain();
  g.gain.value = 0.5;
  src.connect(lp);
  lp.connect(g);
  g.connect(out);
  src.start();
  let alive = true;
  const crackle = () => {
    if (!alive) return;
    const t = ctx.currentTime + 0.01;
    const bursts = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < bursts; i++) {
      const tt = t + i * rand(0.015, 0.05);
      const nb = ctx.createBufferSource();
      nb.buffer = makeNoiseBuffer(ctx, "white");
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = rand(1500, 4000);
      const e = ctx.createGain();
      e.gain.setValueAtTime(rand(0.05, 0.22), tt);
      e.gain.exponentialRampToValueAtTime(0.0001, tt + rand(0.02, 0.09));
      nb.connect(hp);
      hp.connect(e);
      e.connect(out);
      nb.start(tt);
      nb.stop(tt + 0.12);
    }
    setTimeout(crackle, rand(80, 700));
  };
  crackle();
  return () => {
    alive = false;
    try {
      src.stop();
    } catch {
      /* noop */
    }
  };
};

const genWind: Generator = (ctx, out) => {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, "white");
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 480;
  bp.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.value = 0.4;
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.07;
  const lg = ctx.createGain();
  lg.gain.value = 0.25;
  lfo.connect(lg);
  lg.connect(g.gain);
  const lfo2 = ctx.createOscillator();
  lfo2.frequency.value = 0.045;
  const lg2 = ctx.createGain();
  lg2.gain.value = 260;
  lfo2.connect(lg2);
  lg2.connect(bp.frequency);
  src.connect(bp);
  bp.connect(g);
  g.connect(out);
  src.start();
  lfo.start();
  lfo2.start();
  return () => {
    try {
      src.stop();
      lfo.stop();
      lfo2.stop();
    } catch {
      /* noop */
    }
  };
};

const genDrone: Generator = (ctx, out) => {
  const freqs = [55, 82.5, 110, 164.8];
  const oscs: OscillatorNode[] = [];
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 320;
  lp.Q.value = 0.5;
  const g = ctx.createGain();
  g.gain.value = 0.5;
  lp.connect(g);
  g.connect(out);
  freqs.forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = i % 2 ? "sine" : "triangle";
    o.frequency.value = f;
    o.detune.value = rand(-8, 8);
    const og = ctx.createGain();
    og.gain.value = i === 0 ? 0.32 : 0.14;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rand(0.04, 0.1);
    const lg = ctx.createGain();
    lg.gain.value = 0.05;
    lfo.connect(lg);
    lg.connect(og.gain);
    o.connect(og);
    og.connect(lp);
    o.start();
    lfo.start();
    oscs.push(o, lfo);
  });
  const sh = ctx.createOscillator();
  sh.type = "sine";
  sh.frequency.value = 440;
  const shG = ctx.createGain();
  shG.gain.value = 0.012;
  sh.connect(shG);
  shG.connect(out);
  sh.start();
  oscs.push(sh);
  return () => {
    oscs.forEach((o) => {
      try {
        o.stop();
      } catch {
        /* noop */
      }
    });
  };
};

const genBinaural: Generator = (ctx, out) => {
  const merger = ctx.createChannelMerger(2);
  const oL = ctx.createOscillator();
  oL.type = "sine";
  oL.frequency.value = 200;
  const oR = ctx.createOscillator();
  oR.type = "sine";
  oR.frequency.value = 210;
  const gL = ctx.createGain();
  gL.gain.value = 0.24;
  const gR = ctx.createGain();
  gR.gain.value = 0.24;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.1;
  const lg = ctx.createGain();
  lg.gain.value = 0.04;
  lfo.connect(lg);
  lg.connect(gL.gain);
  lg.connect(gR.gain);
  oL.connect(gL);
  gL.connect(merger, 0, 0);
  oR.connect(gR);
  gR.connect(merger, 0, 1);
  merger.connect(out);
  oL.start();
  oR.start();
  lfo.start();
  return () => {
    try {
      oL.stop();
      oR.stop();
      lfo.stop();
    } catch {
      /* noop */
    }
  };
};

const LOFI_CHORDS = [
  [220.0, 261.63, 329.63, 392.0],
  [174.61, 220.0, 261.63, 349.23],
  [130.81, 164.81, 196.0, 246.94],
  [196.0, 246.94, 293.66, 329.63],
];

const genLofi: Generator = (ctx, out) => {
  let alive = true;
  let step = 0;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1400;
  lp.connect(out);
  const playChord = () => {
    if (!alive) return;
    const chord = LOFI_CHORDS[step % LOFI_CHORDS.length];
    step++;
    const t = ctx.currentTime + 0.05;
    chord.forEach((f) => {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = f * rand(0.998, 1.002);
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(0.055, t + 1.2);
      e.gain.setValueAtTime(0.055, t + 2.4);
      e.gain.linearRampToValueAtTime(0, t + 4.4);
      o.connect(e);
      e.connect(lp);
      o.start(t);
      o.stop(t + 4.6);
    });
    for (let i = 0; i < 6; i++) {
      const tt = t + Math.random() * 4;
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = rand(2000, 6000);
      const e = ctx.createGain();
      e.gain.setValueAtTime(rand(0.002, 0.006), tt);
      e.gain.exponentialRampToValueAtTime(0.0001, tt + 0.015);
      o.connect(e);
      e.connect(out);
      o.start(tt);
      o.stop(tt + 0.03);
    }
    setTimeout(playChord, 4200);
  };
  playChord();
  return () => {
    alive = false;
  };
};

const genPurr: Generator = (ctx, out) => {
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.value = 48;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 240;
  const trem = ctx.createGain();
  trem.gain.value = 0.5;
  const lfo = ctx.createOscillator();
  lfo.type = "square";
  lfo.frequency.value = 23;
  const lg = ctx.createGain();
  lg.gain.value = 0.32;
  lfo.connect(lg);
  lg.connect(trem.gain);
  const g = ctx.createGain();
  g.gain.value = 0.5;
  const br = ctx.createOscillator();
  br.frequency.value = 0.18;
  const brg = ctx.createGain();
  brg.gain.value = 0.12;
  br.connect(brg);
  brg.connect(g.gain);
  o.connect(lp);
  lp.connect(trem);
  trem.connect(g);
  g.connect(out);
  o.start();
  lfo.start();
  br.start();
  return () => {
    try {
      o.stop();
      lfo.stop();
      br.stop();
    } catch {
      /* noop */
    }
  };
};

const GENERATORS: Record<ChannelId, Generator> = {
  rain: genRain,
  ocean: genOcean,
  forest: genForest,
  cafe: genCafe,
  fire: genFire,
  wind: genWind,
  white: genNoise("white"),
  pink: genNoise("pink"),
  brown: genNoise("brown"),
  drone: genDrone,
  binaural: genBinaural,
  lofi: genLofi,
  purr: genPurr,
};

export interface SoundStateSnapshot {
  mix: Record<ChannelId, number>;
  master: number;
  muted: boolean;
  activePreset: string | null;
  activeCount: number;
}

const STORAGE_KEY = "togtmol-mix-v9";

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private live = new Map<ChannelId, LiveChannel>();
  private listeners = new Set<() => void>();
  private hydrated = false;

  private state: SoundStateSnapshot = {
    mix: { ...DEFAULT_MIX },
    master: 0.65,
    muted: false,
    activePreset: null,
    activeCount: 0,
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): SoundStateSnapshot => this.state;

  private emit(patch: Partial<SoundStateSnapshot>) {
    const nextMix = patch.mix ?? this.state.mix;
    const activeCount = Object.values(nextMix).filter((v) => v > 0.01).length;
    this.state = {
      ...this.state,
      ...patch,
      mix: nextMix,
      activeCount,
    };
    this.persist();
    if (this.ctx) {
      this.syncMediaSession();
    }
    this.listeners.forEach((l) => l());
  }

  private syncMediaSession() {
    if (
      typeof navigator === "undefined" ||
      !("mediaSession" in navigator) ||
      !navigator.mediaSession
    ) {
      return;
    }
    try {
      if (this.state.activeCount > 0 && !this.state.muted) {
        const preset = PRESETS.find((p) => p.id === this.state.activePreset);
        if (typeof MediaMetadata !== "undefined") {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: preset ? `${preset.emoji} ${preset.nameMn}` : "Орчны микс",
            artist: `TOGTMOL · ${this.state.activeCount} суваг`,
            album: "Deep Focus Soundscape",
          });
        }
        navigator.mediaSession.playbackState = "playing";
      } else if (this.state.activeCount > 0 && this.state.muted) {
        navigator.mediaSession.playbackState = "paused";
      }
    } catch {
      /* ignore unsupported MediaSession environments */
    }
  }

  /** Restores saved slider values WITHOUT creating an AudioContext. */
  hydrateFromStorage() {
    if (this.hydrated || typeof window === "undefined") return;
    this.hydrated = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        mix?: Partial<Record<ChannelId, number>>;
        master?: number;
        preset?: string | null;
      };
      const mix = { ...DEFAULT_MIX, ...(parsed.mix ?? {}) };
      const master =
        typeof parsed.master === "number"
          ? Math.max(0, Math.min(1, parsed.master))
          : 0.65;
      const activeCount = Object.values(mix).filter((v) => v > 0.01).length;
      this.state = {
        mix,
        master,
        muted: false,
        activePreset: parsed.preset ?? null,
        activeCount,
      };
      this.listeners.forEach((l) => l());
    } catch {
      /* storage blocked or malformed */
    }
  }

  private persist() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          mix: this.state.mix,
          master: this.state.master,
          preset: this.state.activePreset,
        }),
      );
    } catch {
      /* storage blocked */
    }
  }

  ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ||
          (
            window as unknown as {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;
        if (!AC) return null;
        const created = new AC();
        if (!created || typeof created.createGain !== "function") return null;
        this.ctx = created;
        this.masterNode = created.createGain();
        this.masterNode.gain.value = this.state.muted ? 0 : this.state.master;
        if (typeof created.createAnalyser === "function") {
          this.analyser = created.createAnalyser();
          this.analyser.fftSize = 128;
          this.analyser.smoothingTimeConstant = 0.82;
          this.masterNode.connect(this.analyser);
          this.analyser.connect(created.destination);
        } else {
          this.masterNode.connect(created.destination);
        }
      }
      if (this.ctx.state === "suspended") {
        void this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private duckFactor = 1;

  setMaster(v: number) {
    const clamped = Math.max(0, Math.min(1, v));
    if (this.ctx && this.masterNode) {
      this.masterNode.gain.setTargetAtTime(
        clamped * this.duckFactor,
        this.ctx.currentTime,
        0.05,
      );
    }
    this.emit({ master: clamped, muted: false });
  }

  setMuted(muted: boolean) {
    if (this.ctx && this.masterNode) {
      this.masterNode.gain.setTargetAtTime(
        muted ? 0 : this.state.master * this.duckFactor,
        this.ctx.currentTime,
        0.05,
      );
    }
    this.emit({ muted });
  }

  setDuckFactor(factor: number) {
    const clamped = Math.max(0.15, Math.min(1, factor));
    this.duckFactor = clamped;
    if (this.ctx && this.masterNode && !this.state.muted) {
      this.masterNode.gain.setTargetAtTime(
        this.state.master * clamped,
        this.ctx.currentTime,
        0.25,
      );
    }
  }

  private syncLiveChannel(id: ChannelId, volume: number, pan = 0) {
    const ctx = this.ensure();
    if (!ctx || !this.masterNode) return;
    const existing = this.live.get(id);
    if (volume <= 0.005) {
      if (existing) {
        const t = ctx.currentTime;
        existing.gain.gain.setTargetAtTime(0, t, 0.25);
        const ch = existing;
        setTimeout(() => {
          try {
            ch.stop();
          } catch {
            /* noop */
          }
          ch.gain.disconnect();
        }, 900);
        this.live.delete(id);
      }
      return;
    }
    if (existing) {
      existing.gain.gain.setTargetAtTime(volume * 0.9, ctx.currentTime, 0.1);
      if (existing.pan) {
        existing.pan.pan.setTargetAtTime(pan, ctx.currentTime, 0.1);
      }
      return;
    }
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(volume * 0.9, ctx.currentTime, 0.4);
    let panner: StereoPannerNode | null = null;
    if (typeof ctx.createStereoPanner === "function") {
      panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      gain.connect(panner);
      panner.connect(this.masterNode);
    } else {
      gain.connect(this.masterNode);
    }
    const stop = GENERATORS[id](ctx, gain);
    this.live.set(id, { gain, pan: panner, stop });
  }

  setChannel(id: ChannelId, volume: number, pan = 0) {
    const clamped = Math.max(0, Math.min(1, volume));
    this.syncLiveChannel(id, clamped, pan);
    this.emit({
      mix: { ...this.state.mix, [id]: clamped },
      activePreset: null,
    });
  }

  applyPreset(presetId: string) {
    const p = PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    const nextMix = { ...DEFAULT_MIX, ...p.mix } as Record<ChannelId, number>;
    (Object.keys(GENERATORS) as ChannelId[]).forEach((id) => {
      this.syncLiveChannel(id, nextMix[id] ?? 0);
    });
    this.emit({
      mix: nextMix,
      activePreset: presetId,
    });
  }

  applyCustomMix(mix: Partial<Record<ChannelId, number>>) {
    const nextMix = { ...DEFAULT_MIX, ...mix } as Record<ChannelId, number>;
    (Object.keys(GENERATORS) as ChannelId[]).forEach((id) => {
      this.syncLiveChannel(
        id,
        Math.max(0, Math.min(1, Number(nextMix[id] ?? 0))),
      );
    });
    this.emit({
      mix: nextMix,
      activePreset: null,
    });
  }

  stopAll(fadeMs = 600) {
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.live.forEach((ch) => {
        ch.gain.gain.setTargetAtTime(0, t, fadeMs / 1000 / 3);
        setTimeout(() => {
          try {
            ch.stop();
          } catch {
            /* noop */
          }
        }, fadeMs + 150);
      });
      this.live.clear();
    }
    this.emit({
      mix: { ...DEFAULT_MIX },
      activePreset: null,
    });
  }

  spectrum(bins = 32): number[] {
    if (!this.analyser) return new Array(bins).fill(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    const out: number[] = [];
    const per = Math.max(1, Math.floor(data.length / bins));
    for (let i = 0; i < bins; i++) {
      let s = 0;
      for (let j = 0; j < per; j++) s += data[i * per + j] ?? 0;
      out.push(Math.min(1, s / per / 180));
    }
    return out;
  }

  chime(kind: "complete" | "break" | "tick" = "complete") {
    const ctx = this.ensure();
    if (!ctx || !this.masterNode) return;
    const t0 = ctx.currentTime + 0.02;
    const notes =
      kind === "complete"
        ? [523.25, 659.25, 783.99, 1046.5]
        : kind === "break"
          ? [392.0, 523.25]
          : [880];
    const dest = this.masterNode;
    notes.forEach((f, i) => {
      const t = t0 + i * (kind === "complete" ? 0.22 : 0.3);
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const o2 = ctx.createOscillator();
      o2.type = "sine";
      o2.frequency.value = f * 2.01;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(0.22, t + 0.02);
      e.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      const e2 = ctx.createGain();
      e2.gain.setValueAtTime(0, t);
      e2.gain.linearRampToValueAtTime(0.05, t + 0.02);
      e2.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      o.connect(e);
      o2.connect(e2);
      e.connect(dest);
      e2.connect(dest);
      o.start(t);
      o.stop(t + 1.7);
      o2.start(t);
      o2.stop(t + 1);
    });
  }

  breathTone(phase: "in" | "out") {
    const ctx = this.ensure();
    if (!ctx || !this.masterNode) return;
    const t = ctx.currentTime + 0.02;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(phase === "in" ? 330 : 440, t);
    o.frequency.exponentialRampToValueAtTime(
      phase === "in" ? 440 : 330,
      t + 3.5,
    );
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(0.06, t + 0.5);
    e.gain.linearRampToValueAtTime(0, t + 3.8);
    o.connect(e);
    e.connect(this.masterNode);
    o.start(t);
    o.stop(t + 4);
  }
}

export const engine = new SoundEngine();
