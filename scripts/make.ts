// 1コマンドで 台本生成 → QA → VOICEVOX → レンダリング → キャプション → 運用記録 まで行う
// 例: npm run make -- --type tarot --style mystic
//     npm run make -- --type zodiac --sign leo --style pastel --date 2026-10-05
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { FORTUNE_TYPES, FortuneType } from "../remotion/src/schema";
import { stretchToMin } from "../remotion/src/timeline";
import { generate } from "./content/generate";
import { fail, loadStyle, P, parseArgs, todayJst, writeJson } from "./lib/common";
import { upsertRecord } from "./lib/records";
import { printQa, qaScript } from "./qa";
import { narrate } from "./tts";

const ALIASES: Record<string, FortuneType> = { 星座: "zodiac", タロット: "tarot", 数秘: "numerology" };

const HELP = `使い方: npm run make -- --type <zodiac|tarot|numerology> [オプション]
  --style <id|path>   スタイル(styles/<id>.json)。既定: mystic
  --date YYYY-MM-DD   既定: 今日(JST)
  --sign <id>         星座(aries, taurus, ... pisces)。省略時は日替わり
  --card <0-21>       タロットのカード番号。省略時は日付から決定
  --hook <id>         daily | question | message。省略時は日付から決定
  --speaker <id>      VOICEVOX話者ID(スタイルの指定を上書き)
  --no-tts            音声なし(推定尺で作成)
  --no-render         台本・音声・キャプションだけ作る
  --force             QAエラーがあっても続行
  --min / --max       許容尺(秒)。既定 15 / 30`;

const args = parseArgs();
if (args.bool("help") || !args.str("type")) {
  console.log(HELP);
  process.exit(args.bool("help") ? 0 : 1);
}
const typeArg = args.str("type")!;
const type = (ALIASES[typeArg] ?? typeArg) as FortuneType;
if (!FORTUNE_TYPES.includes(type)) fail(`--type は ${FORTUNE_TYPES.join(" | ")} のいずれか`);

const style = loadStyle(args.str("style") ?? "mystic");
if (args.str("speaker")) style.voice.speaker = Number(args.str("speaker"));
const date = args.str("date") ?? todayJst();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("--date は YYYY-MM-DD 形式");
const qaOpts = { minSec: Number(args.str("min") ?? 15), maxSec: Number(args.str("max") ?? 30) };
const force = args.bool("force");

const gen = (() => {
  try {
    return generate({ type, date, styleId: style.id, sign: args.str("sign"), card: args.str("card") ? Number(args.str("card")) : undefined, hook: args.str("hook") });
  } catch (e) {
    return fail((e as Error).message);
  }
})();
let script = gen.script;
console.log(`\n▶ ${script.jobId}  「${script.title}」 style=${style.id} hook=${gen.meta.hookType}`);

const pre = qaScript(stretchToMin(script, style, qaOpts.minSec), style, qaOpts);
printQa(pre, `台本(推定 ${pre.totalSec.toFixed(1)}秒)`);
if (pre.errors.length && !force) fail("QAエラーのため中止しました(--force で続行)");

let speakerLabel = "";
if (!args.bool("no-tts")) {
  console.log("\n■ VOICEVOX");
  try {
    ({ script, speakerLabel } = await narrate(script, style));
  } catch (e) {
    fail((e as Error).message);
  }
  script = stretchToMin(script, style, qaOpts.minSec);
  const post = qaScript(script, style, qaOpts);
  printQa(post, `音声付き(実尺 ${post.totalSec.toFixed(1)}秒)`);
  if (post.errors.length && !force) fail("QAエラーのため中止しました(--force で続行)");
}

script = stretchToMin(script, style, qaOpts.minSec);
const dir = path.join(P.content, script.jobId);
const propsFile = path.join(dir, "props.json");
writeJson(path.join(dir, "script.json"), script);
writeJson(propsFile, { style, script });
const captionText = [script.caption, "", script.hashtags.join(" "), script.credit ? `\n${script.credit}` : ""].join("\n").trim() + "\n";
fs.writeFileSync(path.join(dir, "caption.txt"), captionText);

const totalSec = qaScript(script, style, qaOpts).totalSec;
const video = path.join(P.out, `${script.jobId}.mp4`);
if (!args.bool("no-render")) {
  console.log("\n■ レンダリング");
  const r = spawnSync(`npx remotion render src/index.ts Uranai "${video}" "--props=${propsFile}" --log=warn`, {
    cwd: P.remotion,
    stdio: "inherit",
    shell: true,
  });
  if (r.status !== 0) fail("レンダリングに失敗しました");
}

upsertRecord({
  job_id: script.jobId,
  created_at: new Date().toISOString(),
  date,
  style_id: style.id,
  style_name: style.name,
  fortune_type: type,
  target: script.target,
  hook_type: gen.meta.hookType,
  font: style.typography.fontFamily,
  text_in: style.animation.textIn,
  transition: style.animation.transition,
  camera: style.animation.cameraMotion,
  pace: style.tempo.pace,
  particles: style.background.particles,
  bg_color: style.palette.background[0],
  speaker: speakerLabel,
  duration_sec: totalSec.toFixed(1),
  scene_count: String(script.scenes.length),
  video_file: args.bool("no-render") ? "" : path.relative(P.out, video),
});

console.log(`\n✅ 完了 (${totalSec.toFixed(1)}秒)`);
if (!args.bool("no-render")) console.log(`  動画:       ${path.relative(process.cwd(), video)}`);
console.log(`  キャプション: ${path.relative(process.cwd(), path.join(dir, "caption.txt"))}`);
console.log(`  プレビュー:   npm run studio -- ${script.jobId}`);
console.log(`  投稿後:       npm run record -- ${script.jobId} --posted_at ${date} --views 0 --saves 0 ...`);
