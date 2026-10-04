import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FONT_CANDIDATES } from "../../remotion/src/fonts";
import { Style, styleSchema } from "../../remotion/src/schema";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const P = {
  remotion: path.join(ROOT, "remotion"),
  public: path.join(ROOT, "remotion", "public"),
  styles: path.join(ROOT, "styles"),
  content: path.join(ROOT, "content"),
  out: path.join(ROOT, "out"),
  records: path.join(ROOT, "records"),
  cache: path.join(ROOT, ".cache"),
};

// --key value / --flag / 位置引数
export const parseArgs = (argv = process.argv.slice(2)) => {
  const flags: Record<string, string | true> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=", 2);
      if (v !== undefined) flags[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith("--")) flags[k] = argv[++i];
      else flags[k] = true;
    } else positional.push(a);
  }
  const str = (k: string) => (typeof flags[k] === "string" ? (flags[k] as string) : undefined);
  return { flags, positional, str, bool: (k: string) => flags[k] === true || flags[k] === "true" };
};

// 文字列シードの決定的乱数(同じ日付・条件なら同じ結果)
export const rng = (seed: string) => {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, pick: <T>(arr: T[]) => arr[Math.floor(next() * arr.length)] };
};

export const todayJst = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());

export const loadStyle = (idOrPath: string): Style => {
  const file = fs.existsSync(idOrPath) ? idOrPath : path.join(P.styles, `${idOrPath}.json`);
  if (!fs.existsSync(file)) {
    const ids = fs.readdirSync(P.styles).filter((f) => f.endsWith(".json") && f !== "schema.json");
    throw new Error(`スタイル "${idOrPath}" がありません。候補: ${ids.map((f) => f.replace(".json", "")).join(", ")}`);
  }
  const result = styleSchema.safeParse(JSON.parse(fs.readFileSync(file, "utf8")));
  if (!result.success) {
    throw new Error(`${file} がスキーマに合いません:\n${result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
  const style = result.data;
  if (style.typography.fontCandidates.length === 0) {
    style.typography.fontCandidates = FONT_CANDIDATES[style.typography.textMood];
  }
  return style;
};

export const writeJson = (file: string, data: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
};

export const fail = (msg: string): never => {
  console.error(`\x1b[31mエラー:\x1b[0m ${msg}`);
  process.exit(1);
};
