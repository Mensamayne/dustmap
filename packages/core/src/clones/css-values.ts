/**
 * CSS value equivalence for duplicate detection (DUP-01), after Mazinanian, Tsantalis and Mesbah,
 * "Discovering Refactoring Opportunities in Cascading Style Sheets" (FSE 2014): type II duplication
 * is the same value written another way. Colours in any notation become one canonical `rgba()`,
 * zero lengths lose their unit, numbers lose redundant zeros, keywords are lower-cased; strings and
 * `url()` keep their case. Values this module cannot read stay as written (lexical comparison).
 */

/** CSS named colours (CSS Color Module Level 4) as hex. */
const NAMED: Record<string, string> = {
  aliceblue: "f0f8ff", antiquewhite: "faebd7", aqua: "00ffff", aquamarine: "7fffd4", azure: "f0ffff", beige: "f5f5dc",
  bisque: "ffe4c4", black: "000000", blanchedalmond: "ffebcd", blue: "0000ff", blueviolet: "8a2be2", brown: "a52a2a",
  burlywood: "deb887", cadetblue: "5f9ea0", chartreuse: "7fff00", chocolate: "d2691e", coral: "ff7f50",
  cornflowerblue: "6495ed", cornsilk: "fff8dc", crimson: "dc143c", cyan: "00ffff", darkblue: "00008b", darkcyan: "008b8b",
  darkgoldenrod: "b8860b", darkgray: "a9a9a9", darkgreen: "006400", darkgrey: "a9a9a9", darkkhaki: "bdb76b",
  darkmagenta: "8b008b", darkolivegreen: "556b2f", darkorange: "ff8c00", darkorchid: "9932cc", darkred: "8b0000",
  darksalmon: "e9967a", darkseagreen: "8fbc8f", darkslateblue: "483d8b", darkslategray: "2f4f4f", darkslategrey: "2f4f4f",
  darkturquoise: "00ced1", darkviolet: "9400d3", deeppink: "ff1493", deepskyblue: "00bfff", dimgray: "696969",
  dimgrey: "696969", dodgerblue: "1e90ff", firebrick: "b22222", floralwhite: "fffaf0", forestgreen: "228b22",
  fuchsia: "ff00ff", gainsboro: "dcdcdc", ghostwhite: "f8f8ff", gold: "ffd700", goldenrod: "daa520", gray: "808080",
  green: "008000", greenyellow: "adff2f", grey: "808080", honeydew: "f0fff0", hotpink: "ff69b4", indianred: "cd5c5c",
  indigo: "4b0082", ivory: "fffff0", khaki: "f0e68c", lavender: "e6e6fa", lavenderblush: "fff0f5", lawngreen: "7cfc00",
  lemonchiffon: "fffacd", lightblue: "add8e6", lightcoral: "f08080", lightcyan: "e0ffff", lightgoldenrodyellow: "fafad2",
  lightgray: "d3d3d3", lightgreen: "90ee90", lightgrey: "d3d3d3", lightpink: "ffb6c1", lightsalmon: "ffa07a",
  lightseagreen: "20b2aa", lightskyblue: "87cefa", lightslategray: "778899", lightslategrey: "778899",
  lightsteelblue: "b0c4de", lightyellow: "ffffe0", lime: "00ff00", limegreen: "32cd32", linen: "faf0e6", magenta: "ff00ff",
  maroon: "800000", mediumaquamarine: "66cdaa", mediumblue: "0000cd", mediumorchid: "ba55d3", mediumpurple: "9370db",
  mediumseagreen: "3cb371", mediumslateblue: "7b68ee", mediumspringgreen: "00fa9a", mediumturquoise: "48d1cc",
  mediumvioletred: "c71585", midnightblue: "191970", mintcream: "f5fffa", mistyrose: "ffe4e1", moccasin: "ffe4b5",
  navajowhite: "ffdead", navy: "000080", oldlace: "fdf5e6", olive: "808000", olivedrab: "6b8e23", orange: "ffa500",
  orangered: "ff4500", orchid: "da70d6", palegoldenrod: "eee8aa", palegreen: "98fb98", paleturquoise: "afeeee",
  palevioletred: "db7093", papayawhip: "ffefd5", peachpuff: "ffdab9", peru: "cd853f", pink: "ffc0cb", plum: "dda0dd",
  powderblue: "b0e0e6", purple: "800080", rebeccapurple: "663399", red: "ff0000", rosybrown: "bc8f8f",
  royalblue: "4169e1", saddlebrown: "8b4513", salmon: "fa8072", sandybrown: "f4a460", seagreen: "2e8b57",
  seashell: "fff5ee", sienna: "a0522d", silver: "c0c0c0", skyblue: "87ceeb", slateblue: "6a5acd", slategray: "708090",
  slategrey: "708090", snow: "fffafa", springgreen: "00ff7f", steelblue: "4682b4", tan: "d2b48c", teal: "008080",
  thistle: "d8bfd8", tomato: "ff6347", turquoise: "40e0d0", violet: "ee82ee", wheat: "f5deb3", white: "ffffff",
  whitesmoke: "f5f5f5", yellow: "ffff00", yellowgreen: "9acd32",
};

const round = (n: number, d = 3): string => String(Number(n.toFixed(d)));
const rgba = (r: number, g: number, b: number, a: number): string =>
  `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${round(Math.min(1, Math.max(0, a)))})`;

function fromHex(hex: string): string | null {
  const h = hex.length <= 4 ? [...hex].map((c) => c + c).join("") : hex;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(h)) return null;
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return rgba(n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1);
}

function channel(v: string, max: number): number | null {
  const m = /^([-+]?\d*\.?\d+)(%?)$/.exec(v);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] ? (n / 100) * max : n;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** Canonical `rgba(r,g,b,a)` for a colour token, or null when the token is not a colour. */
export function canonicalColor(token: string): string | null {
  const t = token.toLowerCase();
  if (t === "transparent") return rgba(0, 0, 0, 0);
  if (NAMED[t]) return fromHex(NAMED[t]!);
  if (t.startsWith("#")) return fromHex(t.slice(1));
  const fn = /^(rgba?|hsla?)\((.*)\)$/.exec(t);
  if (!fn) return null;
  const parts = fn[2]!.replace(/\s*\/\s*/, ",").split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const alpha = parts[3] !== undefined ? channel(parts[3], 1) : 1;
  if (alpha === null) return null;
  if (fn[1]!.startsWith("rgb")) {
    const [r, g, b] = parts.slice(0, 3).map((p) => channel(p, 255));
    return r === null || g === null || b === null || r === undefined || g === undefined || b === undefined ? null : rgba(r, g, b, alpha);
  }
  const h = Number(parts[0]!.replace(/deg$/, ""));
  const s = channel(parts[1]!, 1);
  const l = channel(parts[2]!, 1);
  if (!Number.isFinite(h) || s === null || l === null) return null;
  const [r, g, b] = hslToRgb(((h % 360) + 360) % 360, s, l);
  return rgba(r, g, b, alpha);
}

const LENGTH_UNITS = "px|em|rem|%|vh|vw|vmin|vmax|pt|pc|cm|mm|in|ch|ex|q|svh|lvh|dvh|svw|lvw|dvw|cqw|cqh";
const ZERO = new RegExp(`^[-+]?0*\\.?0+(?:${LENGTH_UNITS})?$`);
const NUMBER = /^([-+]?\d*\.?\d+)([a-z%]*)$/;

/** Split a value on top-level whitespace (parentheses keep `rgb(1 2 3)` and `calc(a + b)` whole). */
export function topLevelTokens(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of value.trim()) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/** One value token in canonical form. */
export function normalizeToken(token: string): string {
  if (/^['"]/.test(token) || /^url\(/i.test(token)) return token;
  const t = token.toLowerCase();
  const color = canonicalColor(t);
  if (color) return color;
  if (ZERO.test(t)) return "0";
  const n = NUMBER.exec(t);
  if (n) return `${String(Number(n[1]))}${n[2]}`;
  return t.replace(/\s*,\s*/g, ",").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
}

/** A whole value in canonical form: tokens normalized, single spaces, commas without spaces. */
export function normalizeValue(value: string): string {
  return topLevelTokens(value.replace(/\s*,\s*/g, ", "))
    .map((t) => (t.endsWith(",") ? `${normalizeToken(t.slice(0, -1))},` : normalizeToken(t)))
    .join(" ")
    .replace(/, /g, ",");
}

/** A value whose meaning depends on something we do not resolve (variables, SCSS, interpolation). */
export function isOpaqueValue(value: string): boolean {
  return /var\(|\$|#\{|@/.test(value);
}
