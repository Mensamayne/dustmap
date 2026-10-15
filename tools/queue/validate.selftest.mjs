#!/usr/bin/env node
/**
 * Negative self-test for queue validation: planted defects must produce errors;
 * a minimal valid queue must produce none. Fails the process if the gate is blind.
 */
import { validateQueue } from "./validate-core.mjs";

const briefOk = () => true;
const briefMissing = () => false;

/** @type {{ name: string, queue: object, briefExists: () => boolean, expectErrorSubstr: string | null }[]} */
const cases = [
  {
    name: "valid minimal",
    queue: {
      version: 1,
      tasks: [
        {
          id: "T-1",
          title: "ok",
          layer: 0,
          segment: "core",
          brief: "docs/briefs/x.md",
          gates: [],
          status: "todo",
          kind: "feature",
        },
      ],
    },
    briefExists: briefOk,
    expectErrorSubstr: null,
  },
  {
    name: "bad version",
    queue: { version: "1", tasks: [] },
    briefExists: briefOk,
    expectErrorSubstr: "version musi być liczbą całkowitą",
  },
  {
    name: "duplicate id",
    queue: {
      version: 1,
      tasks: [
        {
          id: "DUP",
          title: "a",
          layer: 0,
          segment: "core",
          brief: "a.md",
          gates: [],
          status: "todo",
          kind: "feature",
        },
        {
          id: "DUP",
          title: "b",
          layer: 1,
          segment: "core",
          brief: "b.md",
          gates: [],
          status: "todo",
          kind: "feature",
        },
      ],
    },
    briefExists: briefOk,
    expectErrorSubstr: "zduplikowane id",
  },
  {
    name: "missing brief file",
    queue: {
      version: 1,
      tasks: [
        {
          id: "T-2",
          title: "ok",
          layer: 0,
          segment: "core",
          brief: "missing.md",
          gates: [],
          status: "todo",
          kind: "feature",
        },
      ],
    },
    briefExists: briefMissing,
    expectErrorSubstr: "brak pliku briefu",
  },
  {
    name: "unknown gate",
    queue: {
      version: 1,
      tasks: [
        {
          id: "T-3",
          title: "ok",
          layer: 0,
          segment: "core",
          brief: "a.md",
          gates: ["NOPE"],
          status: "todo",
          kind: "feature",
        },
      ],
    },
    briefExists: briefOk,
    expectErrorSubstr: "gate NOPE nie istnieje",
  },
  {
    name: "gate cycle",
    queue: {
      version: 1,
      tasks: [
        {
          id: "A",
          title: "a",
          layer: 0,
          segment: "core",
          brief: "a.md",
          gates: ["B"],
          status: "todo",
          kind: "feature",
        },
        {
          id: "B",
          title: "b",
          layer: 1,
          segment: "core",
          brief: "b.md",
          gates: ["A"],
          status: "todo",
          kind: "feature",
        },
      ],
    },
    briefExists: briefOk,
    expectErrorSubstr: "cykl w gates",
  },
  {
    name: "bug without severity",
    queue: {
      version: 1,
      tasks: [
        {
          id: "BUG-1",
          title: "bug",
          layer: 0,
          segment: "core",
          brief: "b.md",
          gates: [],
          status: "todo",
          kind: "bug",
        },
      ],
    },
    briefExists: briefOk,
    expectErrorSubstr: "bug bez poprawnego severity",
  },
  {
    name: "bad status",
    queue: {
      version: 1,
      tasks: [
        {
          id: "T-4",
          title: "ok",
          layer: 0,
          segment: "core",
          brief: "a.md",
          gates: [],
          status: "wip",
          kind: "feature",
        },
      ],
    },
    briefExists: briefOk,
    expectErrorSubstr: "zły status",
  },
];

let failed = 0;
for (const c of cases) {
  const errors = validateQueue(c.queue, { briefExists: c.briefExists });
  const joined = errors.join("\n");
  if (c.expectErrorSubstr === null) {
    if (errors.length === 0) {
      console.log(`PASS: ${c.name}`);
    } else {
      console.error(`FAIL: ${c.name} — oczekiwano 0 błędów, jest:\n${joined}`);
      failed++;
    }
    continue;
  }
  if (joined.includes(c.expectErrorSubstr)) {
    console.log(`PASS: ${c.name}`);
  } else {
    console.error(
      `FAIL: ${c.name} — brak „${c.expectErrorSubstr}” w błędach:\n${joined || "(brak)"}`,
    );
    failed++;
  }
}

if (failed) {
  console.error(`validate.selftest: ${failed} case(s) failed`);
  process.exit(1);
}
console.log(`validate.selftest: OK (${cases.length} cases)`);
