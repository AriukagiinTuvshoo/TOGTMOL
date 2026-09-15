const paths: Record<string, string> = {
  music:
    "M9 17V5l11-2v12M9 5v4l11-2M9 17a3 2 0 1 1-3-2c2 0 3 1 3 2Zm11-2a3 2 0 1 1-3-2c2 0 3 1 3 2Z",
  volume: "M3 9h4l5-5v16l-5-5H3ZM16 8q5 4 0 8m3-11q8 7 0 14",
  muted: "M3 9h4l5-5v16l-5-5H3ZM17 9l5 6m-5 0 5-6",
  rain: "M5 14a4 4 0 0 1 0-8 6 6 0 0 1 12 1 3 3 0 0 1 1 7ZM7 17l-1 3m6-3-1 3m6-3-1 3",
  previous: "M5 5v14M19 5 8 12l11 7Z",
  next: "M19 5v14M5 5l11 7-11 7Z",
  expand: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5",
  "chevron-up": "m5 15 7-7 7 7",
  "chevron-down": "m5 9 7 7 7-7",
  leaf: "M20 4C10 3 3 7 5 15c2 7 14 5 15-11ZM5 20 15 10",
  home: "m3 10 9-7 9 7v10H3ZM9 20v-7h6v7",
  calendar: "M4 5h16v16H4ZM8 3v4m8-4v4M4 10h16m-11 4h1m4 0h1m-6 3h1m4 0h1",
  book: "M12 6c-3-3-7-3-9-2v15c3-1 6 0 9 2m0-15c3-3 7-3 9-2v15c-3-1-6 0-9 2Zm0 0v15",
  chart: "M4 3v18h17M8 17v-5m5 5V8m5 9V4",
  target: "M21 12a9 9 0 1 1-9-9m5 0v4h4m-9 5 5-5m0 5a5 5 0 1 1-5-5",
  award:
    "M7 3h10v5a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 1v6m-5 2h10",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2-5h4l1 3 3 1 3 3v4l-3 1-1 3-3 3h-4l-1-3-3-1-3-3v-4l3-1 1-3Z",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2",
  play: "m8 4 12 8-12 8Z",
  pause: "M8 5v14M16 5v14",
  stop: "M6 6h12v12H6Z",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  chevron: "m9 5 7 7-7 7",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  upload: "M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5",
  more: "M5 12h.1M12 12h.1M19 12h.1",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1",
  moon: "M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z",
  cloud: "M7 18a5 5 0 0 1-1-10 7 7 0 0 1 13 2 4 4 0 0 1 0 8Z",
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z",
  trash: "M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  edit: "m4 16 12-12 4 4L8 20H4Zm10-10 4 4",
  user: "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21v-2a8 8 0 0 1 16 0v2",
  refresh: "M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5m-4 8a8 8 0 0 0 14 3l3-3m0 5v-5h-5",
  bell: "M5 16v-5a7 7 0 0 1 14 0v5l2 2H3Zm4 5h6",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 7v7m0-10v.1",
};
export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.book} />
    </svg>
  );
}
