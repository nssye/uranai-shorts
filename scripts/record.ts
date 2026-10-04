// 投稿後の反応を records/posts.csv に記録する(ExcelでCSVを直接編集してもよい)
// 例: npm run record -- 2026-10-05_tarot_card5_mystic --posted_at "2026-10-05 21:00" --views 1520 --reach 1300 --likes 80 --saves 42 --shares 6 --follows 3 --avg_watch_sec 9.8
//     npm run record -- --list      未記録の動画を一覧
import { fail, parseArgs } from "./lib/common";
import { MANUAL_COLUMNS, METRICS, readRecords, RECORDS_FILE, writeRecords } from "./lib/records";

const args = parseArgs();
const rows = readRecords();

if (args.bool("list") || !args.positional[0]) {
  const pending = rows.filter((r) => !r.views);
  console.log(`反応が未記録: ${pending.length}件 / 全${rows.length}件  (${RECORDS_FILE})`);
  pending.forEach((r) => console.log(`  ${r.job_id}  ${r.posted_at ? `投稿 ${r.posted_at}` : "未投稿"}`));
  if (!args.positional[0]) console.log("\n記録: npm run record -- <job_id> --views 1000 --saves 20 ...");
  process.exit(0);
}

const row = rows.find((r) => r.job_id === args.positional[0]);
if (!row) fail(`job_id "${args.positional[0]}" が records/posts.csv にありません`);

const updates: Record<string, string> = {};
for (const col of MANUAL_COLUMNS) {
  const v = args.flags[col];
  if (v === undefined || v === true) continue;
  if ((METRICS as readonly string[]).includes(col) && Number.isNaN(Number(v))) fail(`--${col} は数値で指定してください`);
  updates[col] = String(v);
}
const unknown = Object.keys(args.flags).filter((k) => !(MANUAL_COLUMNS as readonly string[]).includes(k));
if (unknown.length) fail(`不明な項目: ${unknown.join(", ")}\n使える項目: ${MANUAL_COLUMNS.join(", ")}`);
if (!Object.keys(updates).length) fail(`更新する項目がありません。使える項目: ${MANUAL_COLUMNS.join(", ")}`);
if (!row!.platform && !updates.platform) updates.platform = "instagram";

Object.assign(row!, updates);
writeRecords(rows);
console.log(`✓ ${row!.job_id} を更新: ${Object.entries(updates).map(([k, v]) => `${k}=${v}`).join(" ")}`);
