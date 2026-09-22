import { useId } from "react";
import type { WorldSettings } from "@/types/study";
import type { CompanionState } from "@/lib/world/progress";
import { CompanionArt } from "./companion";
import { roomFurniture } from "@/lib/world/furniture";
import { ROOM_THEMES } from "@/lib/world/room-themes";
export function RoomScene({
  world,
  state = "idle",
  mini = false,
}: {
  world: WorldSettings;
  state?: CompanionState;
  mini?: boolean;
}) {
  const id = useId().replaceAll(":", ""),
    theme = ROOM_THEMES[world.design],
    p = theme.palette,
    bg = world.background,
    dark =
      world.atmosphere === "night" || bg === "night" || theme.decorations.space,
    rain =
      theme.decorations.rain || world.atmosphere === "rain" || bg === "rain",
    snow =
      theme.decorations.snow ||
      world.atmosphere === "snow" ||
      bg === "hokkaido",
    japan = bg === "japanese" || bg === "hokkaido" || theme.decorations.sakura,
    trees = theme.decorations.windowTrees,
    sky = dark
      ? "#25344e"
      : world.atmosphere === "evening"
        ? "#e2b49e"
        : rain
          ? "#b3c7c8"
          : p.sky;
  const has = (i: WorldSettings["desk"][number]) => world.desk.includes(i);
  const furniture = roomFurniture(world),
    deskColor =
      furniture.desk === "white"
        ? "#d6d7d0"
        : furniture.desk === "walnut"
          ? "#80634f"
          : p.wood;
  const chairColor =
    furniture.chair === "sage"
      ? "#8ea68d"
      : furniture.chair === "rose"
        ? "#c59b9e"
        : p.floor;
  return (
    <svg
      viewBox="0 0 760 430"
      className={`room-scene ${mini ? "room-mini" : ""}`}
      role="img"
      aria-label={`${mini ? "" : "Бондоок суралцаж буй "}өрөө`}
      style={{ "--companion-accent": p.accent } as React.CSSProperties}
    >
      <defs>
        <clipPath id={`${id}-window`}>
          <path
            d={
              japan || bg === "minimal"
                ? "M228 57H554V275H228Z"
                : "M228 275V146A163 104 0 0 1 554 146V275Z"
            }
          />
        </clipPath>
      </defs>
      <rect width="760" height="430" rx="30" fill={p.wall} />
      {theme.decorations.wallPlanks && (
        <g stroke={p.wood} opacity=".2">
          {[38, 82, 126, 170, 214, 258, 302].map((y) => (
            <path key={y} d={`M0 ${y}H760`} />
          ))}
        </g>
      )}
      {bg !== "minimal" && (
        <g stroke={p.wood} strokeWidth="1" opacity=".16">
          {[30, 90, 150, 610, 670, 730].map((x) => (
            <path key={x} d={`M${x} 0V302`} />
          ))}
        </g>
      )}
      <path d="M0 309H760V400Q760 430 730 430H30Q0 430 0 400Z" fill={p.floor} />
      <path d="M0 309H760" stroke={p.wood} strokeWidth="3" opacity=".5" />
      <g clipPath={`url(#${id}-window)`}>
        <rect x="218" y="30" width="348" height="252" fill={sky} />
        {dark ? (
          <g fill="#f0dba2">
            <circle cx="476" cy="105" r="24" />
            <circle cx="487" cy="96" r="24" fill={sky} />
            {[
              [271, 93],
              [324, 61],
              [405, 94],
              [519, 171],
              [301, 173],
              [445, 55],
              [366, 141],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={i % 2 ? 1.4 : 2.1} />
            ))}
          </g>
        ) : (
          <g fill="#fdf5df">
            <circle cx="479" cy="110" r="28" />
            <path
              d="M246 147Q267 126 291 140Q301 111 334 135Q347 118 369 142Z"
              opacity=".75"
            />
          </g>
        )}
        <path
          d="M204 239Q268 160 338 220Q433 163 575 233V288H204Z"
          fill={dark ? "#425169" : "#a4bba3"}
        />
        <path
          d="M193 272Q281 198 379 251Q492 205 586 260V290H193Z"
          fill={dark ? "#364b55" : "#92aa93"}
        />
        {theme.decorations.ocean && (
          <g>
            <path d="M215 186H567V289H215Z" fill="#85bac4" />
            <path
              d="M215 213Q258 197 299 215T384 215T470 215T567 213M216 240Q260 224 305 240T391 240T480 240T567 240"
              stroke="#d5eeeb"
              strokeWidth="4"
              fill="none"
            />
            <path
              d="M219 274Q319 249 405 271T565 270V291H215Z"
              fill="#ebddbf"
            />
          </g>
        )}
        {world.design === "cabin" && (
          <g>
            <path
              d="M211 245L298 111 364 197 424 93 578 257V289H211Z"
              fill="#91a7a0"
            />
            <path
              d="M298 111L272 151 298 145 318 158ZM424 93L392 142 421 132 450 146Z"
              fill="#f7f5ea"
            />
          </g>
        )}
        {trees && (
          <g fill={dark ? "#344c4d" : "#7e987d"}>
            {[239, 279, 509, 548].map((x, i) => (
              <g key={x} transform={`translate(${x} ${105 + (i % 2) * 36})`}>
                <path d="M0 0L-25 57H-17L-34 87H34L17 57H25Z" />
                <path d="M0 85V155" stroke="#7e7965" strokeWidth="5" />
                {snow && <path d="M0 0L-12 28 0 23 13 30Z" fill="#f3efe8" />}
              </g>
            ))}
          </g>
        )}
        {japan && world.design !== "cabin" && (
          <g stroke="#8f7a70" fill="#edb9bf">
            <path
              d="M228 201Q272 143 304 117Q299 79 339 56M286 137L259 111M304 117L353 110"
              fill="none"
              strokeWidth="5"
            />
            {[
              [300, 99],
              [335, 65],
              [324, 83],
              [264, 113],
              [354, 111],
              [281, 144],
              [305, 126],
            ].map(([x, y], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r="10" stroke="none" />
                <circle cx={x + 8} cy={y - 7} r="8" stroke="none" />
                <circle cx={x - 8} cy={y - 6} r="8" stroke="none" />
                <circle cx={x} cy={y - 3} r="3" fill="#f8e4d4" stroke="none" />
              </g>
            ))}
          </g>
        )}
        {bg === "space" && (
          <g fill="none" stroke="#cab3c7" opacity=".85">
            <ellipse
              cx="323"
              cy="156"
              rx="33"
              ry="9"
              transform="rotate(-24 323 156)"
            />
            <circle cx="323" cy="156" r="20" fill="#8b83aa" stroke="none" />
            <path d="M288 164Q319 166 351 141" />
          </g>
        )}
        {rain && (
          <g
            className="room-rain"
            stroke="#edf2ec"
            strokeWidth="2"
            opacity=".6"
          >
            {Array.from({ length: 20 }, (_, i) => (
              <path
                key={i}
                d={`M${234 + i * 17} ${70 + (i % 4) * 37}l-7 22m-2 21-7 22`}
              />
            ))}
          </g>
        )}
        {snow && (
          <g className="room-snow" fill="#faf8ee">
            {Array.from({ length: 18 }, (_, i) => (
              <circle
                key={i}
                cx={239 + i * 18}
                cy={80 + (i % 5) * 33}
                r={(i % 3) + 1.5}
              />
            ))}
          </g>
        )}
      </g>
      <path
        d={
          japan || bg === "minimal"
            ? "M228 57H554V275H228Z"
            : "M228 275V146A163 104 0 0 1 554 146V275Z"
        }
        fill="none"
        stroke={p.wood}
        strokeWidth="10"
      />
      <path
        d="M391 50V274M230 184H552"
        stroke={p.wood}
        strokeWidth={japan ? "6" : "8"}
      />
      {japan && (
        <path
          d="M282 59V274M336 52V274M447 54V274M500 72V274M231 128H550M231 230H550"
          stroke={p.wood}
          strokeWidth="4"
        />
      )}
      <rect x="216" y="275" width="349" height="12" rx="4" fill={p.wood} />
      {bg === "library" || furniture.bookshelf ? (
        <g>
          <path
            d="M55 54H188V274H55Z"
            fill={p.floor}
            stroke={p.wood}
            strokeWidth="6"
          />
          {[70, 133, 196].map((y, j) => (
            <g key={y}>
              {[67, 93, 117, 147].map((x, i) => (
                <rect
                  key={x}
                  x={x}
                  y={y + (i % 2) * 8}
                  width="20"
                  height={48 - (i % 2) * 8}
                  rx="2"
                  fill={
                    ["#9baf97", "#b5a1aa", "#d6b47d", "#b79582"][(i + j) % 4]
                  }
                />
              ))}
              <path d={`M55 ${y + 54}H187`} stroke={p.wood} strokeWidth="5" />
            </g>
          ))}
        </g>
      ) : furniture.poster !== "none" ? (
        <g>
          <path
            d="M65 121H171V211H65Z"
            fill={p.floor}
            stroke={p.wood}
            strokeWidth="5"
          />
          {furniture.poster === "botanical" ? (
            <g fill="none" stroke={p.accent} strokeWidth="3">
              <path d="M118 196V145M118 178Q81 174 98 152Q120 156 118 178ZM118 168Q146 168 145 145Q117 147 118 168Z" />
              <circle cx="118" cy="138" r="7" fill={p.accent} />
            </g>
          ) : (
            <>
              <path
                d="M79 194L109 151 128 177 146 159 161 194Z"
                fill={p.accent}
                opacity=".7"
              />
              <circle cx="143" cy="144" r="9" fill="#f4daaa" />
            </>
          )}
          {bg === "cafe" && (
            <text
              x="118"
              y="240"
              textAnchor="middle"
              fill={p.accent}
              fontSize="13"
              letterSpacing="3"
            >
              SLOW DAYS
            </text>
          )}
        </g>
      ) : null}
      <ellipse cx="390" cy="397" rx="220" ry="20" fill={p.wood} opacity=".19" />
      <path
        d="M222 345L214 409M571 345L579 409"
        fill="none"
        stroke={deskColor}
        strokeWidth="14"
      />
      <path
        d="M239 310Q228 237 257 222H479Q508 237 495 310"
        fill={chairColor}
        stroke={p.wood}
        strokeWidth="5"
      />
      <g transform="translate(287 112) scale(1.28)">
        <CompanionArt world={world} state={state} />
      </g>
      <rect x="175" y="337" width="450" height="20" rx="7" fill={deskColor} />
      <rect
        x="175"
        y="337"
        width="450"
        height="5"
        rx="3"
        fill="#f8e6c7"
        opacity=".4"
      />
      {has("lamp") && (
        <g stroke="#777566" strokeWidth="5" fill="none" strokeLinecap="round">
          <path d="M217 333H247M232 331V279L203 237 220 220" />
          <path d="M196 241L230 214 239 240 216 256Z" fill="#b1b68d" />
          <path
            d="M220 254L281 332H195Z"
            fill="#ffe7a0"
            opacity=".13"
            stroke="none"
          />
        </g>
      )}
      {has("books") && (
        <g stroke="#7d7666" strokeWidth="2">
          <rect x="506" y="314" width="70" height="17" rx="3" fill="#d5b48c" />
          <rect x="518" y="298" width="57" height="15" rx="2" fill="#93a994" />
          <path d="M514 324H570M527 306H570" stroke="#efdfc6" strokeWidth="4" />
        </g>
      )}
      {has("notebook") && (
        <g>
          <path
            d="M438 326L458 318 493 325 475 335Z"
            fill="#eadbbf"
            stroke="#9c897a"
            strokeWidth="2"
          />
          <path d="M453 328L469 323M460 331L476 326" stroke="#b6a58e" />
        </g>
      )}
      {has("laptop") && (
        <g stroke="#787e79" strokeWidth="2">
          <path d="M287 282L292 330H386L392 282Z" fill="#a9b5ae" />
          <circle cx="339" cy="304" r="5" fill="#e5e9dd" stroke="none" />
          <path d="M282 331H398L403 336H275Z" fill="#c5cec2" />
        </g>
      )}
      {(has("tea") || has("coffee")) && (
        <g stroke="#948573" strokeWidth="2">
          <path
            d="M464 301H489V325Q480 335 466 325Z"
            fill={has("tea") ? "#d7dfc3" : "#e6c6af"}
          />
          <path d="M490 305Q506 306 490 318" fill="none" />
          <ellipse cx="477" cy="301" rx="12" ry="3" fill="#a68a68" />
          <path
            className="tea-steam"
            d="M471 289Q467 284 471 278M482 289Q478 282 484 276"
            fill="none"
            opacity=".6"
          />
        </g>
      )}
      {has("plant") && (
        <g>
          <path
            d="M617 329H661L654 386H625Z"
            fill="#c09174"
            stroke="#a8866d"
            strokeWidth="2"
          />
          <path d="M640 330V261" stroke="#84927a" strokeWidth="4" />
          <g fill={p.accent}>
            <path d="M640 304Q596 307 601 279Q633 273 640 304Z" />
            <path d="M640 283Q646 245 674 257Q671 285 640 283Z" />
            <path d="M639 273Q612 257 626 237Q651 240 639 273Z" />
            <path d="M640 319Q654 289 679 303Q673 328 640 319Z" />
          </g>
        </g>
      )}
      {dark && (
        <rect width="760" height="430" rx="30" fill="#233447" opacity=".12" />
      )}
    </svg>
  );
}
