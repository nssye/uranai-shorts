// QA: 禁止表現・文字数・尺・セーフゾーン・クレジットをルールで検査する(LLM不使用)
// 使い方:
//   npm run qa -- --dict                       辞書の全文例を検査
//   npm run qa -- content/<jobId>/script.json --style mystic
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { buildTimeline, FPS } from "../remotion/src/timeline";
import { Script, scriptSchema, Style } from "../remotion/src/schema";
import { CTAS, HOOKS, SIGNS, TAROT, NUMBERS, TIPS } from "./content/data";
import { loadStyle, parseArgs } from "./lib/common";

type Rule = { re: RegExp; reason: string };

// error: 公開不可 / warn: 確認推奨
const NG: Rule[] = [
  { re: /必ず|絶対|間違いなく|確実に|100\s?[%％]|運命が決ま/, reason: "断定表現" },
  { re: /不幸|災い|呪い|最悪|危険|破滅|手遅れ|後悔する|不吉|大凶|悪いことが起こ|気をつけないと|見ないと|怖い/, reason: "不安をあおる表現" },
  { re: /病気|治る|治療|薬|病院|症状|痩せ|ダイエット|妊娠|体調不良|うつ病|メンタル疾患|サプリ/, reason: "医療・健康の助言" },
  { re: /投資|株|仮想通貨|暗号資産|FX|宝くじ|ギャンブル|儲か|借金|稼げ|資産運用|金運爆上げ/, reason: "投資・金銭の助言" },
];
const CAUTION: Rule[] = [
  { re: /きっと|しなければ|してはいけない|ダメ|運命の人|今すぐ/, reason: "断定・強制に寄った表現" },
];

export type QaResult = { errors: string[]; warnings: string[] };

export const checkText = (text: string, where: string, r: QaResult) => {
  for (const rule of NG) {
    const m = text.match(rule.re);
    if (m) r.errors.push(`${where}: ${rule.reason}「${m[0]}」 → ${text.replace(/\n/g, "/")}`);
  }
  for (const rule of CAUTION) {
    const m = text.match(rule.re);
    if (m) r.warnings.push(`${where}: ${rule.reason}「${m[0]}」 → ${text.replace(/\n/g, "/")}`);
  }
};

export const qaScript = (
  script: Script,
  style: Style,
  opts: { minSec?: number; maxSec?: number } = {},
): QaResult & { totalSec: number } => {
  const r: QaResult = { errors: [], warnings: [] };
  const { minSec = 15, maxSec = 30 } = opts;
  const maxChars = style.layout.maxCharsPerLine;

  script.scenes.forEach((s, i) => {
    const where = `scene${i + 1}(${s.kind})`;
    [s.heading ?? "", ...s.lines, s.narration].forEach((t) => checkText(t, where, r));
    for (const line of [s.heading ?? "", ...s.lines]) {
      const len = [...line].length;
      if (len > maxChars + 4) r.errors.push(`${where}: 1行${len}字(上限${maxChars}字のスタイル)「${line}」`);
      else if (len > maxChars) r.warnings.push(`${where}: 1行${len}字で上限${maxChars}字を超過(自動縮小されます)「${line}」`);
    }
    const lineCount = s.lines.length + (s.heading ? 1 : 0);
    if (s.lines.length > style.text.maxLinesPerScene) {
      r.errors.push(`${where}: ${s.lines.length}行あり、スタイル上限${style.text.maxLinesPerScene}行を超えた分は表示されません`);
    } else if (lineCount > 5) r.warnings.push(`${where}: 見出し込み${lineCount}行。読み切れない可能性`);
    if (!s.narration.trim()) r.errors.push(`${where}: 読み上げテキストが空`);
  });

  const totalSec = buildTimeline(script, style, FPS).totalFrames / FPS;
  const basis = script.scenes.every((s) => s.audio) ? "実音声" : "推定";
  if (totalSec < minSec) r.errors.push(`尺 ${totalSec.toFixed(1)}秒(${basis}) が${minSec}秒未満`);
  if (totalSec > maxSec) r.errors.push(`尺 ${totalSec.toFixed(1)}秒(${basis}) が${maxSec}秒超`);

  const [top, bottom] = style.layout.textAreaY;
  if (top < 0.11) r.warnings.push(`テキスト上端 ${top} がReelsの上部UIにかかる可能性(0.11以上推奨)`);
  if (bottom > 0.83) r.warnings.push(`テキスト下端 ${bottom} がReelsのキャプション欄にかかる可能性(0.83以下推奨)`);

  checkText(script.caption, "caption", r);
  if ([...script.caption].length > 2200) r.errors.push("キャプションが2200字超(Instagram上限)");
  if (script.hashtags.length > 30) r.errors.push("ハッシュタグが30個超(Instagram上限)");
  else if (script.hashtags.length > 10) r.warnings.push(`ハッシュタグ${script.hashtags.length}個(多すぎるとスパム判定のおそれ)`);
  if (script.scenes.some((s) => s.audio) && !script.credit) r.errors.push("VOICEVOX音声を使っているのにクレジットがありません");

  return { ...r, totalSec };
};

export const qaDictionary = (): QaResult => {
  const r: QaResult = { errors: [], warnings: [] };
  SIGNS.forEach((s) => s.messages.forEach((m, i) => checkText(m, `星座:${s.ja}[${i}]`, r)));
  TAROT.forEach((c) => [c.keyword, c.message, c.tip].forEach((t) => checkText(t, `タロット:${c.ja}`, r)));
  Object.entries(NUMBERS).forEach(([n, e]) => [e.keyword, e.message, e.tip].forEach((t) => checkText(t, `数秘:${n}`, r)));
  TIPS.forEach((t, i) => checkText(t, `tips[${i}]`, r));
  CTAS.forEach((c, i) => checkText(c.text + c.narration, `cta[${i}]`, r));
  Object.entries(HOOKS).forEach(([k, hs]) => hs.forEach((h) => checkText(h.text + h.narration, `hook:${k}:${h.id}`, r)));
  const all = [...SIGNS.flatMap((s) => s.messages), ...TAROT.flatMap((c) => [c.message, c.tip]), ...TIPS];
  for (const t of all) {
    for (const line of t.split("\n")) {
      if ([...line].length > 13) r.warnings.push(`辞書の1行が${[...line].length}字: 「${line}」(11字上限のスタイルでは縮小表示)`);
    }
  }
  return r;
};

export const printQa = (r: QaResult, title: string) => {
  console.log(`\n■ QA: ${title}`);
  r.errors.forEach((e) => console.log(`  \x1b[31m✗ ${e}\x1b[0m`));
  r.warnings.forEach((w) => console.log(`  \x1b[33m! ${w}\x1b[0m`));
  if (!r.errors.length && !r.warnings.length) console.log("  \x1b[32m✓ 問題なし\x1b[0m");
  else console.log(`  エラー${r.errors.length}件 / 警告${r.warnings.length}件`);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs();
  if (args.bool("dict")) {
    const r = qaDictionary();
    printQa(r, "文例辞書");
    process.exit(r.errors.length ? 1 : 0);
  }
  const file = args.positional[0];
  if (!file) {
    console.log("使い方: npm run qa -- --dict | npm run qa -- <script.json> --style <id>");
    process.exit(1);
  }
  const script = scriptSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
  const style = loadStyle(args.str("style") ?? script.jobId.split("_").pop()!);
  const r = qaScript(script, style);
  printQa(r, `${script.jobId}(${r.totalSec.toFixed(1)}秒)`);
  process.exit(r.errors.length ? 1 : 0);
}
