// どの見本スタイル(と要素)の反応が良いかを比較するレポート
// 出力: コンソール表 + reports/report.html
// 主指標は保存率(saves/reach)。占い動画は「あとで見返す」保存が伸びの鍵になりやすいため
import fs from "node:fs";
import path from "node:path";
import { parseArgs, ROOT } from "./lib/common";
import { readRecords, Row } from "./lib/records";

const args = parseArgs();
const MIN_N = Number(args.str("min") ?? 3);

const num = (v: string | undefined) => (v === undefined || v === "" ? NaN : Number(v));
const posted = readRecords().filter((r) => num(r.views) > 0);

type Agg = {
  key: string;
  n: number;
  views: number;
  reach: number;
  saveRate: number;
  shareRate: number;
  likeRate: number;
  followPer1k: number;
  completion: number;
};

const rate = (rows: Row[], metric: string) => {
  // 率は合計同士の比(投稿ごとの率の平均だと少数リーチの投稿に引っぱられる)
  const denom = rows.reduce((s, r) => s + (num(r.reach) > 0 ? num(r.reach) : num(r.views)), 0);
  const top = rows.reduce((s, r) => s + (num(r[metric]) || 0), 0);
  return denom ? top / denom : NaN;
};
const avg = (xs: number[]) => {
  const v = xs.filter((x) => !Number.isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
};

const aggregate = (dim: string): Agg[] => {
  const groups = new Map<string, Row[]>();
  posted.forEach((r) => {
    const k = r[dim] || "(なし)";
    groups.set(k, [...(groups.get(k) ?? []), r]);
  });
  return [...groups.entries()]
    .map(([key, rows]) => ({
      key,
      n: rows.length,
      views: avg(rows.map((r) => num(r.views))),
      reach: avg(rows.map((r) => num(r.reach))),
      saveRate: rate(rows, "saves"),
      shareRate: rate(rows, "shares"),
      likeRate: rate(rows, "likes"),
      followPer1k: rate(rows, "follows") * 1000,
      completion: avg(rows.map((r) => num(r.avg_watch_sec) / num(r.duration_sec))),
    }))
    .sort((a, b) => (b.saveRate || 0) - (a.saveRate || 0));
};

const DIMS: { key: string; label: string }[] = [
  { key: "style_id", label: "見本スタイル" },
  { key: "fortune_type", label: "占いの種類" },
  { key: "hook_type", label: "フックの型" },
  { key: "font", label: "フォント" },
  { key: "text_in", label: "文字の登場アニメ" },
  { key: "transition", label: "シーン切替" },
  { key: "pace", label: "テンポ" },
  { key: "speaker", label: "ボイス" },
];

const pctS = (v: number, d = 1) => (Number.isNaN(v) ? "-" : `${(v * 100).toFixed(d)}%`);
const intS = (v: number) => (Number.isNaN(v) ? "-" : Math.round(v).toLocaleString("ja-JP"));
const fx = (v: number, d = 1) => (Number.isNaN(v) ? "-" : v.toFixed(d));

if (!posted.length) {
  console.log("反応データ(views)が記録された投稿がまだありません。npm run record で記録してください");
  process.exit(0);
}

console.log(`\n■ 見本スタイル別(投稿${posted.length}件 / 保存率順。n<${MIN_N} は参考値)`);
console.table(
  Object.fromEntries(
    aggregate("style_id").map((a) => [
      a.key + (a.n < MIN_N ? " *" : ""),
      { 投稿: a.n, 平均再生: intS(a.views), 保存率: pctS(a.saveRate), シェア率: pctS(a.shareRate), いいね率: pctS(a.likeRate), フォロー千人あたり: fx(a.followPer1k), 視聴完了率: pctS(a.completion, 0) },
    ]),
  ),
);

// ---------- HTML ----------
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const section = (dim: { key: string; label: string }) => {
  const rows = aggregate(dim.key);
  const max = Math.max(...rows.map((r) => r.saveRate || 0), 1e-9);
  const body = rows
    .map(
      (r) => `<tr class="${r.n < MIN_N ? "few" : ""}">
  <th scope="row">${esc(r.key)}${r.n < MIN_N ? ' <span class="tag">参考</span>' : ""}</th>
  <td class="num">${r.n}</td>
  <td><div class="bar"><div class="track" title="${esc(r.key)}: 保存率 ${pctS(r.saveRate, 2)}(${r.n}件)"><div class="fill" style="width:${((r.saveRate || 0) / max) * 100}%"></div></div><span class="num">${pctS(r.saveRate, 2)}</span></div></td>
  <td class="num">${intS(r.views)}</td>
  <td class="num">${pctS(r.shareRate, 2)}</td>
  <td class="num">${pctS(r.likeRate)}</td>
  <td class="num">${fx(r.followPer1k)}</td>
  <td class="num">${pctS(r.completion, 0)}</td>
</tr>`,
    )
    .join("\n");
  return `<section><h2>${dim.label}別</h2>
<div class="scroll"><table>
<thead><tr><th scope="col">${dim.label}</th><th scope="col" class="num">投稿</th><th scope="col">保存率</th><th scope="col" class="num">平均再生</th><th scope="col" class="num">シェア率</th><th scope="col" class="num">いいね率</th><th scope="col" class="num">フォロー/千リーチ</th><th scope="col" class="num">視聴完了率</th></tr></thead>
<tbody>${body}</tbody></table></div></section>`;
};

const best = aggregate("style_id").filter((a) => a.n >= MIN_N)[0];
const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>占いショート反応レポート</title>
<style>
:root { --surface:#fcfcfb; --card:#ffffff; --text:#0b0b0b; --text2:#52514e; --line:#e4e3df; --series:#2a78d6; --track:#eeedea; }
@media (prefers-color-scheme: dark) { :root { --surface:#1a1a19; --card:#232322; --text:#ffffff; --text2:#c3c2b7; --line:#383835; --series:#3987e5; --track:#2e2e2c; } }
* { box-sizing:border-box; }
body { margin:0; padding:24px 16px 48px; background:var(--surface); color:var(--text); font:15px/1.6 system-ui, "Hiragino Sans", "Yu Gothic UI", sans-serif; }
main { max-width:1040px; margin:0 auto; }
h1 { font-size:22px; margin:0 0 4px; } h2 { font-size:16px; margin:0 0 10px; }
.meta { color:var(--text2); margin:0 0 20px; }
.hero { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px; }
.tile { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px 16px; min-width:160px; }
.tile b { display:block; font-size:22px; font-variant-numeric:tabular-nums; } .tile span { color:var(--text2); font-size:13px; }
section { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px; margin-bottom:16px; }
.scroll { overflow-x:auto; }
table { border-collapse:collapse; width:100%; min-width:720px; }
th, td { padding:6px 8px; border-bottom:1px solid var(--line); text-align:left; white-space:nowrap; }
thead th { color:var(--text2); font-weight:600; font-size:13px; }
.num { text-align:right; font-variant-numeric:tabular-nums; }
.bar { display:flex; align-items:center; gap:8px; min-width:220px; }
.track { flex:1; height:12px; background:var(--track); border-radius:0 4px 4px 0; }
.fill { height:100%; background:var(--series); border-radius:0 4px 4px 0; }
tr.few th, tr.few td { color:var(--text2); } tr.few .fill { opacity:.45; }
.tag { font-size:11px; border:1px solid var(--line); border-radius:4px; padding:0 4px; color:var(--text2); }
.note { color:var(--text2); font-size:13px; }
</style></head><body><main>
<h1>占いショート 反応レポート</h1>
<p class="meta">投稿 ${posted.length}件 ・ 作成 ${new Date().toLocaleString("ja-JP")} ・ 並び順は保存率(saves ÷ reach)</p>
<div class="hero">
  <div class="tile"><span>記録済み投稿</span><b>${posted.length}</b></div>
  <div class="tile"><span>全体の保存率</span><b>${pctS(rate(posted, "saves"), 2)}</b></div>
  <div class="tile"><span>全体のシェア率</span><b>${pctS(rate(posted, "shares"), 2)}</b></div>
  <div class="tile"><span>保存率トップのスタイル(${MIN_N}件以上)</span><b>${best ? esc(best.key) : "-"}</b></div>
</div>
${DIMS.map(section).join("\n")}
<p class="note">率はすべて合計同士の比(例: 保存率 = Σsaves ÷ Σreach。reach未入力の投稿はviewsで代用)。視聴完了率 = 平均視聴秒数 ÷ 動画の尺。投稿が${MIN_N}件未満の行は「参考」表示で、偶然の差が大きい点に注意。</p>
</main></body></html>`;

const out = path.join(ROOT, "reports", "report.html");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`HTMLレポート: ${path.relative(process.cwd(), out)}`);
