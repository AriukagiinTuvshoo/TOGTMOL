import type { Companion, WorldSettings } from "@/types/study";
import type { CompanionState } from "@/lib/world/progress";
const colors: Record<Companion, [string, string]> = {
  fox: ["#d78d60", "#fff0d7"],
  cat: ["#e8b77e", "#fff0d7"],
  bear: ["#a48166", "#eac9a2"],
  rabbit: ["#ede3de", "#fffaf2"],
  penguin: ["#576572", "#f6efe0"],
  dog: ["#c79873", "#fff0d7"],
};
export function CompanionArt({
  world,
  state = "idle",
}: {
  world: WorldSettings;
  state?: CompanionState;
}) {
  const animal = world.companion,
    [fur, cream] = colors[animal],
    happy =
      ["happy", "celebrating", "welcome"].includes(state) ||
      world.expression === "smile",
    calm = world.expression === "calm" || state === "break";
  return (
    <g
      className={`companion companion-${state}`}
      fill={fur}
      stroke="#584d46"
      strokeWidth="2.7"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {animal === "fox" && (
        <g className="companion-tail">
          <path d="M71 142Q133 102 115 69Q144 81 146 115Q157 154 108 163Z" />
          <path
            d="M116 70Q145 84 146 115L128 110 119 99 121 88Z"
            fill={cream}
          />
        </g>
      )}
      {(animal === "cat" || animal === "dog") && (
        <path
          className="companion-tail"
          d="M96 151Q152 140 131 106"
          fill="none"
          stroke={fur}
          strokeWidth="16"
        />
      )}
      <ellipse
        cx="68"
        cy="165"
        rx="61"
        ry="8"
        fill="#584d46"
        opacity=".1"
        stroke="none"
      />
      <path d="M26 117Q20 158 38 163L104 163Q120 152 106 117Z" />
      <ellipse cx="68" cy="143" rx="28" ry="24" fill={cream} stroke="none" />
      {world.outfit === "vest" && (
        <path
          d="M27 120L47 113 60 147 75 113 105 120 111 154 77 158 69 149 59 159 24 154Z"
          fill="#819787"
        />
      )}
      {animal === "rabbit" ? (
        <g>
          <path d="M37 47Q9-24 32-18Q53-8 55 43Z" />
          <path d="M77 42Q85-24 105-19Q124-6 95 49Z" />
          <path
            d="M33 0L44 33M102-1L90 33"
            fill="none"
            stroke="#dca8a4"
            strokeWidth="8"
          />
        </g>
      ) : animal === "bear" ? (
        <g>
          <circle cx="29" cy="43" r="23" />
          <circle cx="108" cy="43" r="23" />
          <circle cx="29" cy="43" r="12" fill={cream} stroke="none" />
          <circle cx="108" cy="43" r="12" fill={cream} stroke="none" />
        </g>
      ) : animal === "dog" ? (
        <g fill="#8d684f">
          <path d="M28 47Q-9 39-2 91Q1 111 25 84Z" />
          <path d="M104 47Q140 39 139 89Q135 114 111 90Z" />
        </g>
      ) : (
        animal !== "penguin" && (
          <g>
            <path d="M19 70L12 13Q31 17 51 43Z" />
            <path d="M84 43Q105 17 124 13L117 72Z" />
            <path d="M23 28L29 56 42 45Z" fill="#edb9a4" stroke="none" />
            <path d="M112 28L98 45 109 55Z" fill="#edb9a4" stroke="none" />
          </g>
        )
      )}
      <path d="M69 34C109 34 124 51 126 85Q127 121 68 127Q8 122 10 84C11 52 28 34 69 34Z" />
      {animal === "fox" ? (
        <path
          d="M12 80Q39 72 67 94Q90 71 124 80Q130 118 68 127Q7 122 12 80Z"
          fill={cream}
          stroke="none"
        />
      ) : animal === "penguin" ? (
        <path
          d="M21 80Q22 50 47 55Q64 55 68 77Q78 48 101 58Q118 64 116 91Q120 123 68 124Q15 121 21 80Z"
          fill={cream}
          stroke="none"
        />
      ) : (
        <ellipse cx="69" cy="102" rx="34" ry="21" fill={cream} stroke="none" />
      )}
      {animal === "cat" && (
        <g fill="#c89363" stroke="none">
          <path d="M48 37L51 58 58 35Z" />
          <path d="M68 34L72 60 79 35Z" />
          <path d="M11 84L26 90 11 95Z" />
          <path d="M125 84L110 90 125 95Z" />
        </g>
      )}
      <g className="companion-eyes" fill="#453e39" stroke="#453e39">
        {happy || calm ? (
          <g fill="none">
            <path
              d={
                happy
                  ? "M39 84Q45 77 51 84M87 84Q93 77 99 84"
                  : "M39 82Q45 88 51 82M87 82Q93 88 99 82"
              }
            />
          </g>
        ) : (
          <g>
            <ellipse cx="45" cy="83" rx="3.2" ry="4.7" />
            <ellipse cx="93" cy="83" rx="3.2" ry="4.7" />
          </g>
        )}
        {animal === "penguin" ? (
          <path d="M62 96L76 96 69 104Z" fill="#e8b471" />
        ) : (
          <path d="M65 98Q69 95 73 98L69 102Z" />
        )}
        <path
          d={happy ? "M61 108Q69 116 77 108" : "M63 108Q69 112 75 108"}
          fill="none"
          strokeWidth="2"
        />
      </g>
      <g fill="#da9a90" opacity=".5" stroke="none">
        <ellipse cx="31" cy="99" rx="9" ry="5" />
        <ellipse cx="105" cy="99" rx="9" ry="5" />
      </g>
      {world.outfit === "scarf" && (
        <g fill="var(--companion-accent, #728d7a)">
          <path d="M24 117Q71 132 112 117L111 129Q65 140 27 129Z" />
          <path d="M90 130L106 130 102 157 87 153Z" />
        </g>
      )}
      {world.accessory === "leaf" && (
        <g fill="#819b72">
          <path d="M91 34Q82 7 109 17Q108 34 91 34Z" />
          <path d="M91 34L103 20" fill="none" strokeWidth="1.4" />
        </g>
      )}
      {world.accessory === "glasses" && (
        <g fill="none">
          <circle cx="44" cy="84" r="15" />
          <circle cx="93" cy="84" r="15" />
          <path d="M59 82Q68 76 78 82M11 79L29 80M109 80L125 77" />
        </g>
      )}
      {world.accessory === "star" && (
        <path
          d="M100 18L104 27 114 28 106 35 108 44 100 39 91 44 93 34 86 28 96 27Z"
          fill="#eaca79"
        />
      )}
      {world.accessory === "flower" && (
        <g fill="#e7afa9">
          <circle cx="100" cy="23" r="7" />
          <circle cx="92" cy="31" r="7" />
          <circle cx="108" cy="31" r="7" />
          <circle cx="100" cy="39" r="7" />
          <circle cx="100" cy="31" r="5" fill="#edd290" />
        </g>
      )}
      {state === "break" ? (
        <g>
          <path d="M53 145H81V160Q66 171 53 160Z" fill="#dae4cf" />
          <path d="M81 147Q99 148 83 157" fill="none" />
          <path
            className="tea-steam"
            d="M60 137Q55 130 61 126M73 137Q69 130 74 126"
            fill="none"
            strokeWidth="1.5"
          />
        </g>
      ) : (
        <g>
          <path
            d="M26 142Q51 137 68 150Q90 137 111 142L105 170Q85 165 68 175Q49 164 31 169Z"
            fill="#f8efdb"
          />
          <path
            d="M68 150V175M37 149L55 152M37 157L55 160M81 152L99 149M81 160L98 157"
            fill="none"
            stroke="#b9ae97"
            strokeWidth="1.6"
          />
        </g>
      )}
      <ellipse className="companion-hand" cx="29" cy="145" rx="10" ry="7" />
      <ellipse cx="108" cy="145" rx="10" ry="7" />
      {state === "celebrating" && (
        <g fill="#e8cb7d" stroke="none">
          <path d="M-10 45L-6 55 5 58-6 62-10 74-13 62-24 58-13 55Z" />
          <path d="M145 20L148 28 156 31 148 34 145 42 142 34 134 31 142 28Z" />
        </g>
      )}
    </g>
  );
}
export function CompanionAvatar({
  world,
  state = "idle",
}: {
  world: WorldSettings;
  state?: CompanionState;
}) {
  return (
    <svg
      viewBox="-25 -25 190 210"
      className="companion-avatar"
      role="img"
      aria-label="Тоги хамтрагч"
    >
      <CompanionArt world={world} state={state} />
    </svg>
  );
}
