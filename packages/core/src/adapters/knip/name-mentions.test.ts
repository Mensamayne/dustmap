import { describe, expect, it } from "vitest";
import { countNameMentions, fileStem } from "./name-mentions.js";

describe("countNameMentions", () => {
  it("counts the needle inside string literals only", () => {
    const texts = [
      `const plugin = "loaded-by-name";`,
      `import { loadedByName } from "./loaded-by-name";`,
      "no match here",
    ];
    expect(countNameMentions("loaded-by-name", texts)).toBe(2);
  });

  it("returns 0 for an empty needle", () => {
    expect(countNameMentions("  ", ["'x'"])).toBe(0);
  });
});

describe("fileStem", () => {
  it("strips the last extension from a POSIX path", () => {
    expect(fileStem("src/loaded-by-name.ts")).toBe("loaded-by-name");
    expect(fileStem("app/page.tsx")).toBe("page");
  });
});
