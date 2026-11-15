import { describe, expect, it } from "vitest";
import {
  EXPECTED_SCHEMA_VERSION,
  snapshotProblem,
} from "../scripts/snapshot-check.mjs";

const snapshot = (schemaVersion: unknown) => ({
  revision: 2,
  data: { schemaVersion },
});

describe("production smoke test snapshot check", () => {
  it("expects schema 6", () => {
    expect(EXPECTED_SCHEMA_VERSION).toBe(6);
    expect(snapshotProblem(snapshot(6))).toBeNull();
  });

  it("rejects the old schema 5 snapshot with an actionable message", () => {
    const problem = snapshotProblem(snapshot(5));
    expect(problem).toMatch(/v5/);
    expect(problem).toMatch(/migration/);
  });

  it("rejects missing data and invalid revisions", () => {
    expect(snapshotProblem(null)).toMatch(/no study snapshot/);
    expect(snapshotProblem({ revision: -1, data: {} })).toMatch(/revision/);
    expect(snapshotProblem({ revision: 1 })).toMatch(/without data/);
    expect(snapshotProblem(snapshot(undefined))).toMatch(/vundefined/);
  });
});
