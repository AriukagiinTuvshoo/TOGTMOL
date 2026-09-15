import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) result.push(...(await files(path)));
    else if (/\.(js|css|woff2?)$/.test(entry.name))
      result.push(path.replace(/^\.next/, "/_next"));
  }
  return result;
}
const assets = (await files(".next/static")).sort();
const build = createHash("sha256")
  .update(assets.join("\n"))
  .digest("hex")
  .slice(0, 16);
await writeFile(
  "public/precache-manifest.json",
  JSON.stringify({ build, assets }, null, 2) + "\n",
);
const template = await readFile("scripts/service-worker.template.js", "utf8");
await writeFile("public/sw.js", template.replace("__BUILD_ID__", build));
console.info(
  `Offline cache: ${assets.length} immutable assets, build ${build}`,
);
