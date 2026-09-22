// Regenerate the original SVG room illustrations used in the README.
import fs from "node:fs";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const load = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
for (const extension of [".tsx", ".ts"]) {
  load.extensions[extension] = (mod, filename) =>
    mod._compile(
      ts.transpileModule(
        fs
          .readFileSync(filename, "utf8")
          .replace(/(["'])@\/([^"']+)\1/g, (_match, _quote, name) =>
            JSON.stringify(path.join(root, name)),
          ),
        {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            jsx: ts.JsxEmit.ReactJSX,
            target: ts.ScriptTarget.ES2022,
          },
        },
      ).outputText,
      filename,
    );
}
const { RoomScene } = load("../components/world/room-scene.tsx"),
  { defaultWorld, DESIGNS } = load("../lib/world/config.ts");
fs.mkdirSync("docs/previews", { recursive: true });
for (const theme of DESIGNS) {
  const world = {
    ...defaultWorld(),
    design: theme.id,
    background: theme.background,
    atmosphere: theme.atmosphere,
    companion: theme.companion,
  };
  let svg = renderToStaticMarkup(
    React.createElement(RoomScene, { world, mini: true }),
  ).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
  const accent = svg.match(/--companion-accent:([^";]+)/)?.[1] ?? "#819b7c";
  svg = svg.replaceAll("var(--companion-accent, #728d7a)", accent);
  fs.writeFileSync(`docs/previews/${theme.id}.svg`, svg);
}
const { CompanionAvatar } = load("../components/world/companion.tsx");
const { COMPANIONS } = load("../lib/world/config.ts");
const characters = COMPANIONS.map((companion, index) => {
  const svg = renderToStaticMarkup(
    React.createElement(CompanionAvatar, {
      world: {
        ...defaultWorld(),
        companion: companion.id,
        expression: "smile",
      },
      state: "happy",
    }),
  );
  return `<g transform="translate(${30 + index * 190},75)"><rect width="175" height="225" rx="24" fill="#fffcf6" stroke="#e4dacb"/><g transform="translate(8,8)">${svg.replace("<svg ", '<svg width="160" height="175" ')}</g><text x="87.5" y="205" text-anchor="middle" font-size="14" fill="#443e36">${companion.name}</text></g>`;
}).join("");
fs.writeFileSync(
  "docs/previews/bondook.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" width="1190" height="330" viewBox="0 0 1190 330"><rect width="1190" height="330" fill="#f7f2e9"/><g font-family="Arial,sans-serif"><text x="35" y="43" font-size="25" fill="#443e36">Бондоок · Суралцах зургаан төрх</text>${characters}</g></svg>`,
);
