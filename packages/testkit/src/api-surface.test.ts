import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import ts from "typescript";

describe("testkit public API surface", () => {
  it("matches the explicit snapshot", async () => {
    const source = ts.createSourceFile("index.ts", await readFile(new URL("../src/index.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const actual = { runtime: [] as string[], types: [] as string[] };
    for (const statement of source.statements) {
      if (!ts.isExportDeclaration(statement) || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue;
      const target = statement.isTypeOnly ? actual.types : actual.runtime;
      for (const element of statement.exportClause.elements) target.push(element.name.text);
    }
    actual.runtime.sort();
    actual.types.sort();
    const expected = JSON.parse(await readFile(new URL("../api-surface.json", import.meta.url), "utf8")) as typeof actual;
    assert.deepEqual(actual, { runtime: expected.runtime.sort(), types: expected.types.sort() });
    assert.ok(actual.runtime.includes("createFailureInjectionFixture"));
  });
});
