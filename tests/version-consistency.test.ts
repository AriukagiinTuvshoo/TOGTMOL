import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { APP_VERSION, APP_VERSION_LABEL } from "@/lib/version";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file: string) => readFileSync(`${root}${file}`, "utf8");

describe("хувилбарын нэг эх сурвалж", () => {
  it("lib/version.ts нь package.json-той ижил байна", () => {
    const pkg = JSON.parse(read("package.json")) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("шошго нь major дугаараас v12 гэж бүрдэнэ", () => {
    expect(APP_VERSION_LABEL).toBe(`v${APP_VERSION.split(".")[0]}`);
    expect(APP_VERSION_LABEL).toBe("v12");
  });

  it("package-lock.json-ы үндсэн version талбар таарна", () => {
    const lock = JSON.parse(read("package-lock.json")) as {
      version: string;
      packages: Record<string, { version?: string }>;
    };
    expect(lock.version).toBe(APP_VERSION);
    expect(lock.packages[""]?.version).toBe(APP_VERSION);
  });

  it("CHANGELOG-д энэ хувилбарын бичлэг байна", () => {
    const changelog = read("CHANGELOG.md");
    expect(changelog).toContain(`## [${APP_VERSION}]`);
  });

  it("README болон docs/VERSIONING.md хоцроогүй байна", () => {
    expect(read("README.md").split("\n")[0]).toContain(APP_VERSION_LABEL);
    expect(read("docs/VERSIONING.md")).toContain(APP_VERSION);
  });
});
