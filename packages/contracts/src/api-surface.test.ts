import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import ts from "typescript";

interface ApiSurfaceSnapshot {
  runtime: string[];
  types: string[];
}

async function readSurface(): Promise<ApiSurfaceSnapshot> {
  const snapshotUrl = new URL("../api-surface.json", import.meta.url);
  return JSON.parse(await readFile(snapshotUrl, "utf8")) as ApiSurfaceSnapshot;
}

function exportedNames(sourceText: string): ApiSurfaceSnapshot {
  const source = ts.createSourceFile(
    "index.ts",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const runtime: string[] = [];
  const types: string[] = [];
  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement) || statement.exportClause === undefined) continue;
    if (!ts.isNamedExports(statement.exportClause)) continue;
    const target = statement.isTypeOnly ? types : runtime;
    for (const element of statement.exportClause.elements) {
      target.push(element.name.text);
    }
  }
  return { runtime: runtime.sort(), types: types.sort() };
}

describe("contracts public API surface", () => {
  it("matches the reviewed explicit export snapshot", async () => {
    const indexUrl = new URL("../src/index.ts", import.meta.url);
    const actual = exportedNames(await readFile(indexUrl, "utf8"));
    const expected = await readSurface();
    assert.deepEqual(actual, {
      runtime: [...expected.runtime].sort(),
      types: [...expected.types].sort(),
    });
  });

  it("contains the required v4 contract families", async () => {
    const snapshot = await readSurface();
    assert.ok(snapshot.runtime.includes("executionContextSchema"));
    assert.ok(snapshot.runtime.includes("IDEMPOTENCY_RECORD_SCHEMA_VERSION"));
    assert.ok(snapshot.runtime.includes("runtimeEventEnvelopeSchema"));
    assert.ok(snapshot.types.includes("ExecutionContext"));
    assert.ok(snapshot.types.includes("AgentTask"));
    assert.ok(snapshot.types.includes("RuntimeEventEnvelope"));
  });
});
