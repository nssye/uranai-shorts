// style-analyzer: 任意の動画から「雰囲気」を数値解析して styles/<id>.json を出力する(API不使用)
// 使い方: npm run analyze -- <動画ファイル> [--id s01] [--name "見本1"] [--max-sec 60] [--force]
//
// 画像・文字・音声は一切コピーしない。抽出するのは色・配置・尺・動きの種類などの数値だけ。
// 推定はヒューリスティックなので、出力後に styles/<id>.json を手で微調整してよい。
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { FONT_CANDIDATES } from "../remotion/src/fonts";
import { Style, styleSchema } from "../remotion/src/schema";
import { fail, P, parseArgs, rng, writeJson } from "./lib/common";

// 解析用の縮小解像度(1px = 1080x1920換算で10px)とサンプリングfps
const W = 108;
const H = 192;
const AFPS = 10;
const SCALE = 1080 / W;

// ---------- 汎用 ----------
type RGB = [number, number, number];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const pct = (a: number[], p: number) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))];
};
const median = (a: number[]) => pct(a, 0.5);
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const dist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const lumOf = (c: RGB) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const hex = (c: RGB) => "#" + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("");
const hsv = ([r, g, b]: RGB) => {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx / 255 };
};
const fromHsv = (h: number, s: number, v: number): RGB => {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return 255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  return [f(5), f(3), f(1)];
};
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => a[i] * (1 - t) + b[i] * t) as RGB;
const vote = <T extends string>(votes: T[], fallback: T, weights?: number[]): T => {
  const m = new Map<T, number>();
  votes.forEach((v, i) => m.set(v, (m.get(v) ?? 0) + (weights?.[i] ?? 1)));
  let best = fallback;
  let bestN = 0;
  for (const [k, n] of m) if (n > bestN) [best, bestN] = [k, n];
  return best;
};

const run = (cmd: string, args: string[]) => {
  const r = spawnSync(cmd, args, { maxBuffer: 1 << 30 });
  if (r.error) throw r.error;
  return r;
};

// ---------- 入力 ----------
type Frame = { t: number; px: Uint8Array; lum: Float32Array; gx: Uint8Array };

const probe = (file: string) => {
  const r = run("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file]);
  if (r.status !== 0) fail(`ffprobeで読めません: ${r.stderr.toString()}`);
  const info = JSON.parse(r.stdout.toString());
  const vs = info.streams.find((s: { codec_type: string }) => s.codec_type === "video");
  if (!vs) fail("映像ストリームがありません");
  const [n, d] = String(vs.avg_frame_rate || vs.r_frame_rate).split("/").map(Number);
  return { width: vs.width as number, height: vs.height as number, fps: round(n / (d || 1)), durationSec: Number(info.format.duration) };
};

const sceneCuts = (file: string, maxSec: number) => {
  const r = run("ffmpeg", ["-hide_banner", "-i", file, "-t", String(maxSec), "-an", "-vf", "select='gt(scene,0.3)',showinfo", "-f", "null", "-"]);
  return [...r.stderr.toString().matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
};

const readFrames = (file: string, maxSec: number): Frame[] => {
  const r = run("ffmpeg", ["-v", "error", "-i", file, "-t", String(maxSec), "-vf", `fps=${AFPS},scale=${W}:${H}:flags=area`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  if (r.status !== 0) fail(`フレーム抽出に失敗: ${r.stderr.toString().slice(-500)}`);
  const size = W * H * 3;
  const frames: Frame[] = [];
  for (let i = 0; (i + 1) * size <= r.stdout.length; i++) {
    const px = new Uint8Array(r.stdout.subarray(i * size, (i + 1) * size));
    const lum = new Float32Array(W * H);
    for (let p = 0; p < W * H; p++) lum[p] = 0.299 * px[p * 3] + 0.587 * px[p * 3 + 1] + 0.114 * px[p * 3 + 2];
    const gx = new Uint8Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 1; x < W - 1; x++) gx[y * W + x] = Math.min(255, Math.abs(lum[y * W + x + 1] - lum[y * W + x - 1]));
    frames.push({ t: i / AFPS, px, lum, gx });
  }
  return frames;
};

const pixel = (f: Frame, p: number): RGB => [f.px[p * 3], f.px[p * 3 + 1], f.px[p * 3 + 2]];

// ---------- 文字行の検出 ----------
// 文字は縦画が多く、行方向に強い横勾配が密集する。行ごとの密度から文字行を拾う
type Line = { y0: number; y1: number; left: number; right: number };
const EDGE = 48;

const rowRatios = (f: Frame) => {
  const rr = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    let c = 0;
    for (let x = 1; x < W - 1; x++) if (f.gx[y * W + x] > EDGE) c++;
    rr[y] = c / W;
  }
  return rr;
};

const detectLines = (f: Frame): Line[] => {
  const rr = rowRatios(f);
  const lines: Line[] = [];
  let y = 0;
  while (y < H) {
    if (rr[y] < 0.07) { y++; continue; }
    let y1 = y;
    while (y1 + 1 < H && (rr[y1 + 1] >= 0.07 || (y1 + 2 < H && rr[y1 + 2] >= 0.07 && rr[y1 + 1] >= 0.03))) y1++;
    const h = y1 - y + 1;
    if (h >= 2 && h <= 40) {
      const hits = new Array(W).fill(0);
      for (let yy = y; yy <= y1; yy++) for (let x = 1; x < W - 1; x++) if (f.gx[yy * W + x] > EDGE) hits[x]++;
      // 横方向の最大スパン(6px以内の隙間は連結)
      let best = { l: 0, r: -1, n: 0 };
      let cur = { l: -1, r: -1, n: 0, gap: 0 };
      for (let x = 0; x < W; x++) {
        if (hits[x] > 0) {
          if (cur.l < 0) cur = { l: x, r: x, n: 0, gap: 0 };
          cur.r = x;
          cur.n++;
          cur.gap = 0;
        } else if (cur.l >= 0 && ++cur.gap > 6) {
          if (cur.n > best.n) best = { l: cur.l, r: cur.r, n: cur.n };
          cur = { l: -1, r: -1, n: 0, gap: 0 };
        }
      }
      if (cur.l >= 0 && cur.n > best.n) best = { l: cur.l, r: cur.r, n: cur.n };
      const width = best.r - best.l + 1;
      if (width / W >= 0.12 && best.n / width >= 0.3) lines.push({ y0: y, y1, left: best.l, right: best.r });
    }
    y = y1 + 1;
  }
  return lines;
};

// ---------- k-means パレット ----------
const kmeans = (samples: Float32Array, k: number) => {
  const n = samples.length / 3;
  const r = rng("kmeans");
  const cent: RGB[] = [];
  const first = Math.floor(r.next() * n);
  cent.push([samples[first * 3], samples[first * 3 + 1], samples[first * 3 + 2]]);
  const d2 = new Float32Array(n);
  while (cent.length < k) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      const c: RGB = [samples[i * 3], samples[i * 3 + 1], samples[i * 3 + 2]];
      d2[i] = Math.min(...cent.map((m) => dist(c, m) ** 2));
      total += d2[i];
    }
    let pick = r.next() * total;
    let idx = 0;
    while (idx < n - 1 && (pick -= d2[idx]) > 0) idx++;
    cent.push([samples[idx * 3], samples[idx * 3 + 1], samples[idx * 3 + 2]]);
  }
  const assign = new Uint8Array(n);
  for (let it = 0; it < 12; it++) {
    const sum = cent.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      const c: RGB = [samples[i * 3], samples[i * 3 + 1], samples[i * 3 + 2]];
      let bi = 0;
      let bd = Infinity;
      cent.forEach((m, j) => {
        const d = dist(c, m);
        if (d < bd) [bd, bi] = [d, j];
      });
      assign[i] = bi;
      sum[bi][0] += c[0];
      sum[bi][1] += c[1];
      sum[bi][2] += c[2];
      sum[bi][3]++;
    }
    sum.forEach((s, j) => s[3] && (cent[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]));
  }
  return cent;
};
const nearest = (c: RGB, cent: RGB[]) => {
  let bi = 0;
  let bd = Infinity;
  cent.forEach((m, j) => {
    const d = dist(c, m);
    if (d < bd) [bd, bi] = [d, j];
  });
  return bi;
};

// ---------- 動き ----------
const half = (f: Frame) => {
  const w = W / 2;
  const h = H / 2;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      out[y * w + x] = (f.lum[2 * y * W + 2 * x] + f.lum[2 * y * W + 2 * x + 1] + f.lum[(2 * y + 1) * W + 2 * x] + f.lum[(2 * y + 1) * W + 2 * x + 1]) / 4;
  return out;
};

// a→b がズーム/パンで説明できるか(テキスト領域の行は除外)
const cameraBetween = (a: Frame, b: Frame, skipRows: [number, number]) => {
  const w = W / 2;
  const h = H / 2;
  const A = half(a);
  const B = half(b);
  const cx = w / 2;
  const cy = h / 2;
  const diff = (s: number, dx: number, dy: number) => {
    let sum = 0;
    let n = 0;
    for (let y = 6; y < h - 6; y++) {
      if (y * 2 >= skipRows[0] && y * 2 <= skipRows[1]) continue;
      for (let x = 6; x < w - 6; x++) {
        const sx = Math.round(cx + (x - cx) / s - dx);
        const sy = Math.round(cy + (y - cy) / s - dy);
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
        sum += Math.abs(B[y * w + x] - A[sy * w + sx]);
        n++;
      }
    }
    return n ? sum / n : Infinity;
  };
  const base = diff(1, 0, 0);
  let best = { kind: "none" as "none" | "zoom" | "pan", d: base };
  for (const s of [0.94, 0.96, 0.98, 1.02, 1.04, 1.06, 1.08]) {
    const d = diff(s, 0, 0);
    if (d < best.d) best = { kind: "zoom", d };
  }
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) {
      if (!dx && !dy) continue;
      const d = diff(1, dx, dy);
      if (d < best.d) best = { kind: "pan", d };
    }
  if (base < 1.5 || best.d > base * 0.85) return "none";
  return best.kind;
};

const frameDiff = (a: Frame, b: Frame, rows?: [number, number]) => {
  const [y0, y1] = rows ?? [0, H - 1];
  let s = 0;
  for (let y = y0; y <= y1; y++) for (let x = 0; x < W; x++) s += Math.abs(a.lum[y * W + x] - b.lum[y * W + x]);
  return s / ((y1 - y0 + 1) * W);
};
const meanLum = (f: Frame) => f.lum.reduce((s, v) => s + v, 0) / f.lum.length;

// ---------- メイン ----------
const args = parseArgs();
const file = args.positional[0];
if (!file || !fs.existsSync(file)) {
  console.log("使い方: npm run analyze -- <動画ファイル> [--id s01] [--name 名前] [--max-sec 60] [--force]");
  process.exit(1);
}
const id = (args.str("id") ?? path.basename(file, path.extname(file))).replace(/[^\w-]/g, "_");
const outFile = path.join(P.styles, `${id}.json`);
if (fs.existsSync(outFile) && !args.bool("force")) fail(`${outFile} は既にあります(上書きは --force)`);
const maxSec = Number(args.str("max-sec") ?? 60);

console.log(`▶ 解析: ${file}`);
const meta = probe(file);
if (meta.height < meta.width) console.warn("  ! 横長動画です。縦9:16に引き伸ばして解析します");
const frames = readFrames(file, maxSec);
if (frames.length < AFPS) fail("動画が短すぎます(1秒以上必要)");
const lengthSec = frames.length / AFPS;
const fi = (t: number) => clamp(Math.round(t * AFPS), 0, frames.length - 1);
const sd = (a: number[]) => Math.sqrt(mean(a.map((v) => (v - mean(a)) ** 2)));
console.log(`  ${meta.width}x${meta.height} ${meta.fps}fps ${round(meta.durationSec, 1)}秒 → ${frames.length}フレームを解析`);

// 行ごとの背景色(平坦な画素の中央値)。グラデーションや装飾に強い背景推定
const rowBg = frames.map((f) => {
  const out: RGB[] = [];
  for (let y = 0; y < H; y++) {
    const rs: number[] = [];
    const gs: number[] = [];
    const bs: number[] = [];
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      if (f.gx[p] > 20) continue;
      rs.push(f.px[p * 3]);
      gs.push(f.px[p * 3 + 1]);
      bs.push(f.px[p * 3 + 2]);
    }
    out.push(rs.length > 10 ? [median(rs), median(gs), median(bs)] : (out[y - 1] ?? [0, 0, 0]));
  }
  return out;
});

// ---------- 文字領域 ----------
// 行の出現頻度を帯にまとめ、最も文字量の多い帯(と同程度の帯)を本文領域とみなす。
// カードやメダルの中の小さな文字など、別の帯にある装飾は除外される
const linesRaw = frames.map(detectLines);
const freq = new Array(H).fill(0);
linesRaw.forEach((ls) => ls.forEach((l) => { for (let y = l.y0; y <= l.y1; y++) freq[y] += l.right - l.left + 1; }));
const maxFreq = Math.max(0, ...freq);
const bands: { y0: number; y1: number; mass: number }[] = [];
for (let y = 0; y < H; y++) {
  if (freq[y] <= maxFreq * 0.03 || freq[y] === 0) continue;
  const last = bands[bands.length - 1];
  if (last && y - last.y1 <= 8) { last.y1 = y; last.mass += freq[y]; }
  else bands.push({ y0: y, y1: y, mass: freq[y] });
}
const mainMass = Math.max(0, ...bands.map((b) => b.mass));
const kept = bands.filter((b) => b.mass >= mainMass * 0.6);
const inKept = (l: Line) => kept.some((b) => (l.y0 + l.y1) / 2 >= b.y0 && (l.y0 + l.y1) / 2 <= b.y1);
const linesPerFrame = linesRaw.map((ls) => ls.filter(inKept));
const textFrames = linesPerFrame.filter((l) => l.length > 0);
const allLines = linesPerFrame.flat();

let textAreaY: [number, number] = [0.5, 0.78];
if (allLines.length) {
  const ys: number[] = [];
  allLines.forEach((l) => { for (let y = l.y0; y <= l.y1; y++) ys.push(y); });
  textAreaY = [round(clamp(pct(ys, 0.03) / H - 0.03, 0.03, 0.9)), round(clamp((pct(ys, 0.97) + 1) / H + 0.03, 0.1, 0.97))];
  if (textAreaY[1] - textAreaY[0] < 0.15) {
    const c = (textAreaY[0] + textAreaY[1]) / 2;
    textAreaY = [round(clamp(c - 0.1, 0.03, 0.85)), round(clamp(c + 0.1, 0.15, 0.97))];
  }
}
const textRows: [number, number] = [Math.floor(textAreaY[0] * H), Math.min(H - 1, Math.ceil(textAreaY[1] * H))];

const heights = allLines.map((l) => l.y1 - l.y0 + 1);
const glyph = 0.85; // 文字の見かけ高さ / フォントサイズ
const bodySize = Math.round(clamp((median(heights) * SCALE) / glyph, 40, 140)) || 68;
const headingSize = Math.round(clamp((pct(heights, 0.8) * SCALE) / glyph, bodySize * 1.15, bodySize * 1.8));
const gaps: number[] = [];
linesPerFrame.forEach((ls) => ls.slice(1).forEach((l, i) => {
  const ha = ls[i].y1 - ls[i].y0 + 1;
  const hb = l.y1 - l.y0 + 1;
  if (hb / ha > 0.75 && hb / ha < 1.33) gaps.push((l.y0 - ls[i].y0) / ((ha + hb) / 2));
}));
const lineHeight = round(clamp(gaps.length ? median(gaps) : 1.5, 1.2, 2.0));
const lineCounts = textFrames.map((l) => l.length);
const maxLinesPerScene = Math.round(clamp(Math.ceil(pct(lineCounts, 0.9)), 2, 6));
const coverage = mean(textFrames.map((ls) => ls.reduce((s, l) => s + (l.y1 - l.y0 + 1) * (l.right - l.left + 1), 0) / (W * H)));
const density = coverage < 0.03 ? "low" : coverage < 0.07 ? "medium" : "high";
const centers = allLines.map((l) => (l.left + l.right + 1) / 2 / W);
const lefts = allLines.map((l) => l.left / W);
const rights = allLines.map((l) => (l.right + 1) / W);
const align: Style["layout"]["align"] = !allLines.length || Math.abs(mean(centers) - 0.5) < 0.06 ? "center" : sd(lefts) <= sd(rights) ? "left" : "right";
const marginX = round(clamp(pct(allLines.map((l) => Math.min(l.left / W, 1 - (l.right + 1) / W)), 0.1), 0.03, 0.2));
const charsPerLine = allLines.map((l) => ((l.right - l.left + 1) * SCALE) / (bodySize * 1.04));
const maxCharsPerLine = Math.round(clamp(pct(charsPerLine, 0.9) || 12, 6, 16));

// ---------- 背景 ----------
const avg = (cs: RGB[], fallback: RGB): RGB => (cs.length ? ([0, 1, 2].map((i) => mean(cs.map((c) => c[i]))) as RGB) : fallback);
const rowsAvg = (y0: number, y1: number) => avg(rowBg.flatMap((rows) => rows.slice(Math.floor(y0 * H), Math.ceil(y1 * H))), [0, 0, 0]);
const top = rowsAvg(0, 0.12);
const midC = rowsAvg(0.44, 0.56);
const bottom = rowsAvg(0.88, 1);
// 中央列と左右端の比較(縦グラデの影響を受けない) → 放射グラデ/ビネットの判定
const colSamples = { center: [] as RGB[], edge: [] as RGB[] };
frames.forEach((f, i) => {
  if (i % 2) return;
  for (let y = Math.floor(H * 0.3); y < H * 0.7; y += 2) {
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      if (f.gx[p] > 20) continue;
      if (x < W * 0.08 || x > W * 0.92) colSamples.edge.push(pixel(f, p));
      else if (x > W * 0.42 && x < W * 0.58) colSamples.center.push(pixel(f, p));
    }
  }
});
const centerC = avg(colSamples.center, midC);
const edgeC = avg(colSamples.edge, midC);
const vertDiff = dist(top, bottom);
const horizDiff = dist(centerC, edgeC);
let bgType: Style["background"]["type"] = "linear";
let bgStops: RGB[] = dist(midC, mix(top, bottom, 0.5)) < 12 ? [top, bottom] : [top, midC, bottom];
if (Math.max(vertDiff, horizDiff) < 18) [bgType, bgStops] = ["solid", [midC]];
else if (horizDiff > 20 && horizDiff > vertDiff * 0.8) [bgType, bgStops] = ["radial", [centerC, edgeC]];
const bgMean = avg(bgStops, midC);
const vignette = round(bgType === "radial" ? 0.2 : clamp((lumOf(centerC) - lumOf(edgeC) - 4) / 40, 0, 0.8));

// 粒子・質感(文字行の外側の画素だけを見る)
let starCount = 0;
let grainSum = 0;
let grainN = 0;
const resid: number[] = [];
frames.forEach((f, i) => {
  if (i % 2) return;
  const boxes = linesRaw[i];
  const inBox = (x: number, y: number) => boxes.some((l) => y >= l.y0 - 2 && y <= l.y1 + 2 && x >= l.left - 2 && x <= l.right + 2);
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      const L = f.lum[p];
      const nb = (f.lum[p - 1] + f.lum[p + 1] + f.lum[p - W] + f.lum[p + W]) / 4;
      if (L - nb > 35 && L > 120 && !inBox(x, y)) { starCount++; continue; }
      if (f.gx[p] > 20 || (x + y) % 3 || inBox(x, y)) continue;
      grainSum += Math.abs(L - nb);
      grainN++;
      resid.push(L - lumOf(rowBg[i][y]));
    }
});
const starsPerFrame = starCount / Math.ceil(frames.length / 2);
const bgStd = Math.sqrt(mean(resid.map((v) => v * v)));
const particles: Style["background"]["particles"] = starsPerFrame > 8 ? "stars" : bgStd > 7 ? "bokeh" : "none";
const particleDensity = round(particles === "stars" ? clamp(starsPerFrame / 60, 0.1, 1) : particles === "bokeh" ? clamp(bgStd / 25, 0.2, 0.8) : 0);
const grain = round(clamp((grainSum / Math.max(1, grainN) - 1.5) / 6, 0, 0.5));

// ---------- 文字色・縁取り・座布団 ----------
// 文字行の中で背景との輝度差が大きい側を文字色、反対側に大きな差があれば縁取りとみなす
const pos: { c: RGB; d: number }[] = [];
const neg: { c: RGB; d: number }[] = [];
frames.forEach((f, i) => {
  if (i % 2) return;
  linesPerFrame[i].forEach((l) => {
    for (let y = l.y0; y <= l.y1; y++)
      for (let x = l.left; x <= l.right; x++) {
        const c = pixel(f, y * W + x);
        const d = lumOf(c) - lumOf(rowBg[i][y]);
        if (d > 40) pos.push({ c, d });
        else if (d < -40) neg.push({ c, d: -d });
      }
  });
});
const medianC = (cs: RGB[]): RGB => [0, 1, 2].map((k) => median(cs.map((c) => c[k]))) as RGB;
// 背景との差が大きい上位10%の中央値(見出しのアクセント色など少数派に引っぱられない)
const extreme = (arr: { c: RGB; d: number }[]) =>
  arr.length ? medianC([...arr].sort((a, b) => b.d - a.d).slice(0, Math.max(1, Math.round(arr.length * 0.1))).map((v) => v.c)) : ([255, 255, 255] as RGB);
const textIsLight = pos.length >= neg.length;
const textSide = textIsLight ? pos : neg;
const otherSide = textIsLight ? neg : pos;
let textC: RGB = textSide.length ? extreme(textSide) : lumOf(bgMean) > 128 ? [40, 30, 50] : [250, 248, 240];
const strokeC: RGB | undefined = otherSide.length >= textSide.length * 0.25 && otherSide.length > 30 ? extreme(otherSide) : undefined;

let panelVotes = 0;
let panelEval = 0;
const panelNear: RGB[] = [];
frames.forEach((f, i) => {
  if (i % 3) return;
  linesPerFrame[i].forEach((l) => {
    const near: RGB[] = [];
    const far: RGB[] = [];
    for (let y = l.y0; y <= l.y1; y++) {
      for (const x of [l.left - 5, l.left - 4, l.left - 3, l.right + 3, l.right + 4, l.right + 5]) if (x >= 0 && x < W) near.push(pixel(f, y * W + x));
      for (const x of [l.left - 14, l.left - 12, l.left - 10, l.right + 10, l.right + 12, l.right + 14]) if (x >= 0 && x < W) far.push(pixel(f, y * W + x));
    }
    if (near.length < 6 || far.length < 6) return;
    panelEval++;
    if (dist(medianC(near), medianC(far)) > 15) { panelVotes++; panelNear.push(medianC(near)); }
  });
});
const panelEnabled = panelEval >= 5 && panelVotes / panelEval >= 0.5;
const panelC = panelNear.length ? medianC(panelNear) : bgMean;

// ---------- アクセント色(色相ヒストグラム) ----------
// 背景(行ごとの背景色)・文字色・縁取りに近い画素を除いた鮮やかな画素の色相ピーク
const BINS = 24;
const hueW = new Array(BINS).fill(0);
const hueC: RGB[][] = Array.from({ length: BINS }, () => []);
frames.forEach((f, i) => {
  if (i % 2) return;
  for (let p = i % 5; p < W * H; p += 5) {
    const c = pixel(f, p);
    const { h, s, v } = hsv(c);
    if (s < 0.3 || v < 0.35) continue;
    const y = Math.floor(p / W);
    if (dist(c, rowBg[i][y]) < 45 || dist(c, textC) < 40 || (strokeC && dist(c, strokeC) < 40)) continue;
    const b = Math.floor(h / (360 / BINS)) % BINS;
    hueW[b] += s * v;
    if (hueC[b].length < 4000) hueC[b].push(c);
  }
});
const binOrder = hueW.map((_, i) => i).sort((a, b) => hueW[b] - hueW[a]);
const hueDist = (a: number, b: number) => Math.min(Math.abs(a - b), BINS - Math.abs(a - b));
const bgH = hsv(bgMean);
const totalHue = hueW.reduce((s, v) => s + v, 0);
let accent: RGB = fromHsv((bgH.h + 180) % 360, 0.5, 0.95);
let accent2: RGB = bgH.v < 0.5 ? fromHsv(bgH.h, 0.4, 0.9) : fromHsv(bgH.h, 0.5, 0.7);
const b1 = binOrder[0];
if (hueW[b1] > 0 && hueW[b1] / Math.max(1, totalHue) > 0.05) {
  accent = avg(hueC[b1], accent);
  const b2 = binOrder.find((b) => hueDist(b, b1) >= 3 && hueW[b] >= hueW[b1] * 0.08);
  if (b2 !== undefined) accent2 = avg(hueC[b2], accent2);
}
const shadowC: RGB = lumOf(bgMean) > 140 ? mix(bgMean, [255, 255, 255], 0.6) : mix(bgStops.reduce((a, b) => (lumOf(a) < lumOf(b) ? a : b)), [0, 0, 0], 0.5);

// ---------- カット(シーン切替 + テキスト切替) ----------
const cuts = sceneCuts(file, maxSec);
const tdiff = frames.map((f, i) => (i ? frameDiff(frames[i - 1], f, textRows) : 0));
const sm = tdiff.map((_, i) => (tdiff[i - 1] ?? 0) + tdiff[i] + (tdiff[i + 1] ?? 0));
const thr = Math.max(6, mean(sm) + 1.2 * sd(sm));
const textChanges: number[] = [];
sm.forEach((d, i) => {
  if (d > thr && d >= (sm[i - 1] ?? 0) && d >= (sm[i + 1] ?? 0)) {
    const t = frames[i].t;
    if (!textChanges.length || t - textChanges[textChanges.length - 1] > 1.0) textChanges.push(t);
  }
});
const events = [...cuts, ...textChanges].sort((a, b) => a - b).filter((t, i, a) => t > 0.8 && t < lengthSec - 0.3 && (i === 0 || t - a[i - 1] > 0.6));
const bounds = [0, ...events, lengthSec];
const shots = bounds.slice(1).map((end, i) => ({ start: bounds[i], end, dur: end - bounds[i] }));
const durs = shots.map((s) => s.dur);
const avgCutSec = round(mean(durs), 2);
const pace: Style["tempo"]["pace"] = avgCutSec < 2.2 ? "fast" : avgCutSec < 4 ? "medium" : "slow";

// ---------- カメラの動き ----------
const camVotes: ("none" | "zoom" | "pan")[] = [];
const camW: number[] = [];
shots.forEach((s) => {
  if (s.dur < 1) return;
  camVotes.push(cameraBetween(frames[fi(s.start + 0.3)], frames[fi(Math.min(s.end - 0.3, s.start + 2.5))], textRows));
  camW.push(s.dur);
});
const cam = vote(camVotes, "none", camW);
const cameraMotion: Style["animation"]["cameraMotion"] = cam === "zoom" ? "kenBurns" : cam === "pan" ? "pan" : "none";

// ---------- 文字の登場アニメ ----------
type TextIn = Style["animation"]["textIn"];
const energy = (i: number) => {
  const rr = rowRatios(frames[i]);
  let s = 0;
  let cy = 0;
  for (let y = textRows[0]; y <= textRows[1]; y++) { s += rr[y]; cy += rr[y] * y; }
  return { e: s, cy: s ? cy / s : 0 };
};
const extent = (i: number) => {
  const ls = linesPerFrame[i];
  return ls.length ? { l: Math.min(...ls.map((l) => l.left)), r: Math.max(...ls.map((l) => l.right)) } : null;
};
const textInVotes: TextIn[] = [];
shots.forEach((s, n) => {
  // 文字が一番少ない瞬間(切替の谷)から、文字が出そろうまでを観察する
  let i0 = n === 0 ? 0 : fi(s.start - 0.5);
  const iFinal = fi(Math.min(s.start + 1.6, s.end - 0.2));
  for (let i = i0; i <= fi(s.start + 0.3); i++) if (energy(i).e < energy(i0).e) i0 = i;
  if (iFinal - i0 < 4) return;
  const fin = energy(iFinal);
  if (fin.e < 0.3 || energy(i0).e > 0.6 * fin.e) return;
  let kEarly = -1;
  let k80 = -1;
  for (let i = i0 + 1; i <= iFinal; i++) {
    const e = energy(i).e;
    if (kEarly < 0 && e >= 0.35 * fin.e) kEarly = i;
    if (e >= 0.8 * fin.e) { k80 = i; break; }
  }
  if (k80 < 0 || kEarly < 0) return;
  if (k80 - i0 <= 1) { textInVotes.push("none"); return; }
  const topY = (i: number) => Math.min(...linesPerFrame[i].map((l) => l.y0));
  if (linesPerFrame[kEarly].length && linesPerFrame[iFinal].length && topY(kEarly) - topY(iFinal) >= 2) { textInVotes.push("slideUp"); return; }
  const eE = extent(kEarly);
  const eF = extent(iFinal);
  if (eE && eF) {
    const wE = eE.r - eE.l;
    const wF = eF.r - eF.l;
    let widest = 0;
    for (let i = kEarly; i <= iFinal; i++) { const e = extent(i); if (e) widest = Math.max(widest, e.r - e.l); }
    if (wF > 0 && widest > wF * 1.04 && wE < wF) { textInVotes.push("pop"); return; }
    if (Math.abs(eE.l - eF.l) <= 2 && wE < wF * 0.8) { textInVotes.push("typewriter"); return; }
    if (wE > wF * 1.1) { textInVotes.push("zoom"); return; }
    if (wE < wF * 0.85) { textInVotes.push("pop"); return; }
  }
  // 位置も大きさも変わらない: 輝度差は出ているのに輪郭が立っていない時間があればblur
  const ref = frames[i0];
  const cFin = frameDiff(frames[iFinal], ref, textRows) || 1;
  let blurish = false;
  for (let i = i0 + 1; i <= k80; i++) {
    const c = frameDiff(frames[i], ref, textRows) / cFin;
    if (c >= 0.3) { blurish = energy(i).e / fin.e < c * 0.5; break; }
  }
  textInVotes.push(blurish ? "blur" : "fade");
});
const textIn = vote(textInVotes, "fade", textInVotes.map((v) => (v === "fade" || v === "none" ? 0.9 : 1)));

// ---------- トランジション ----------
type Tr = Style["animation"]["transition"];
const trVotes: Tr[] = [];
const trDur: number[] = [];
// 途中フレームfの各画素が A/B どちらに近いかを軸方向の位置ごとに集計し、
// B側が片側から連続していれば(境界が1本)ワイプ/スライドとみなす。AとBで同じ画素(共通の背景)は無視
const splitSide = (f: Frame, a: Frame, b: Frame, axis: "x" | "y" | "d") => {
  const n = axis === "x" ? W : axis === "y" ? H : W + H;
  const nb = new Array(n).fill(0);
  const tot = new Array(n).fill(0);
  for (let y = 0; y < H; y += 2)
    for (let x = 0; x < W; x += 2) {
      const p = y * W + x;
      if (Math.abs(a.lum[p] - b.lum[p]) < 25) continue;
      const kk = axis === "x" ? x : axis === "y" ? y : x + y;
      tot[kk]++;
      if (Math.abs(f.lum[p] - b.lum[p]) < Math.abs(f.lum[p] - a.lum[p])) nb[kk]++;
    }
  const side: number[] = [];
  for (let kk = 0; kk < n; kk++) if (tot[kk] >= 2) side.push(nb[kk] / tot[kk] > 0.5 ? 1 : 0);
  if (side.length < 10) return false;
  const nB = side.reduce((s, v) => s + v, 0);
  if (nB < side.length * 0.15 || nB > side.length * 0.85) return false;
  let flips = 0;
  for (let kk = 1; kk < side.length; kk++) if (side[kk] !== side[kk - 1]) flips++;
  return flips <= 2;
};
events.forEach((t) => {
  const a = frames[fi(t - 0.7)];
  const b = frames[fi(t + 0.7)];
  const win = frames.slice(fi(t - 0.6), fi(t + 0.6) + 1);
  const base = (meanLum(a) + meanLum(b)) / 2;
  const dipped = win.filter((f) => meanLum(f) < base - 30 || meanLum(f) > base + 40).length;
  if (dipped >= 1) { trVotes.push("fade"); trDur.push(dipped / AFPS + 0.1); return; }
  const dAB = frameDiff(a, b);
  if (dAB < 3) { trVotes.push("cut"); return; }
  let blended = 0;
  let wipedX = 0;
  let wipedY = 0;
  for (const f of win) {
    const dA = frameDiff(f, a);
    const dB = frameDiff(f, b);
    if (dA > 0.15 * dAB && dB > 0.15 * dAB && dA < 0.9 * dAB && dB < 0.9 * dAB) {
      if (splitSide(f, a, b, "y")) wipedY++;
      else if (splitSide(f, a, b, "x") || splitSide(f, a, b, "d")) wipedX++;
      else blended++;
    }
  }
  if (wipedY >= 1 && wipedY >= wipedX) { trVotes.push("slide"); trDur.push((wipedY + 1) / AFPS); }
  else if (wipedX >= 1) { trVotes.push("wipe"); trDur.push((wipedX + 1) / AFPS); }
  else if (blended >= 2) { trVotes.push("fade"); trDur.push((blended + 1) / AFPS); }
  else trVotes.push("cut");
});
const transition = vote(trVotes, "cut");
const transitionSec = round(transition === "cut" ? 0 : clamp(median(trDur) || 0.4, 0.15, 1.2));

// ---------- フォントの雰囲気(キーフレームの線幅) ----------
// 文字画素を横方向/縦方向に収縮させたときの残り方で、縦画と横画の太さの差(明朝らしさ)と太さを測る
const cacheDir = path.join(P.cache, "analyze", id);
fs.rmSync(cacheDir, { recursive: true, force: true });
fs.mkdirSync(cacheDir, { recursive: true });
const KW = 1080;
const KH = 1920;
const k = KW / W;
let nText = 0;
let survH = 0;
let survV = 0;
let survHeavy = 0;
const keyShots = shots.filter((s) => s.dur >= 0.8).slice(0, 12);
const runsH: number[] = [];
const runsV: number[] = [];
// 1) キーフレームの文字行をフル解像度で切り出す
type Crop = { px: Buffer; x0: number; y0: number; bw: number; bh: number; G: number; bg: RGB[] };
const crops: Crop[] = [];
keyShots.forEach((s, n) => {
  const t = Math.min(s.end - 0.2, s.start + Math.min(1.5, s.dur * 0.6));
  const i = fi(t);
  run("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", file, "-frames:v", "1", "-vf", "scale=540:960", path.join(cacheDir, `shot${String(n + 1).padStart(2, "0")}.jpg`)]);
  const lines = linesPerFrame[i];
  if (!lines.length) return;
  const px = run("ffmpeg", ["-v", "error", "-ss", String(t), "-i", file, "-frames:v", "1", "-vf", `scale=${KW}:${KH}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]).stdout;
  if (px.length < KW * KH * 3) return;
  lines.forEach((l) => {
    const y0 = Math.max(0, (l.y0 - 1) * k);
    const x0 = Math.max(0, (l.left - 1) * k);
    const bh = Math.min(KH, (l.y1 + 2) * k) - y0;
    const bw = Math.min(KW, (l.right + 2) * k) - x0;
    const bg = new Array(bh).fill(0).map((_, y) => rowBg[i][Math.min(H - 1, Math.floor((y0 + y) / k))]);
    crops.push({ px, x0, y0, bw, bh, G: (l.y1 - l.y0 + 1) * k, bg });
  });
});
const cropPixel = (c: Crop, x: number, y: number): RGB => {
  const p = ((c.y0 + y) * KW + c.x0 + x) * 3;
  return [c.px[p], c.px[p + 1], c.px[p + 2]];
};
// 2) 縮小で薄まらない本当の文字色を測り直す
{
  const side: { c: RGB; d: number }[] = [];
  crops.forEach((c) => {
    for (let y = 0; y < c.bh; y += 2)
      for (let x = 0; x < c.bw; x += 2) {
        const col = cropPixel(c, x, y);
        const d = (lumOf(col) - lumOf(c.bg[y])) * (textIsLight ? 1 : -1);
        if (d > 40) side.push({ c: col, d });
      }
  });
  if (side.length > 100) textC = extreme(side);
}
// 3) 文字画素を横/縦に収縮させて残り方を比べる
crops.forEach((c) => {
  const mask = new Uint8Array(c.bw * c.bh);
  for (let y = 0; y < c.bh; y++) {
    const tol = Math.max(30, 0.35 * dist(textC, c.bg[y]));
    for (let x = 0; x < c.bw; x++) mask[y * c.bw + x] = dist(cropPixel(c, x, y), textC) < tol ? 1 : 0;
  }
  const r1 = Math.max(1, Math.round(c.G * 0.03));
  const r2 = Math.max(2, Math.round(c.G * 0.08));
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < c.bw && y < c.bh ? mask[y * c.bw + x] : 0);
  // 画を横切る長さ(短いものだけ=画の太さ)。横に切ると縦画の太さ、縦に切ると横画の太さ
  const maxRun = c.G * 0.22;
  for (let y = 0; y < c.bh; y++) {
    let len = 0;
    for (let x = 0; x <= c.bw; x++) {
      if (x < c.bw && mask[y * c.bw + x]) len++;
      else { if (len && len < maxRun) runsH.push(len / c.G); len = 0; }
    }
  }
  for (let x = 0; x < c.bw; x++) {
    let len = 0;
    for (let y = 0; y <= c.bh; y++) {
      if (y < c.bh && mask[y * c.bw + x]) len++;
      else { if (len && len < maxRun) runsV.push(len / c.G); len = 0; }
    }
  }
  for (let y = 0; y < c.bh; y++)
    for (let x = 0; x < c.bw; x++) {
      if (!mask[y * c.bw + x]) continue;
      nText++;
      if (at(x - r1, y) && at(x + r1, y)) survH++;
      if (at(x, y - r1) && at(x, y + r1)) survV++;
      if (at(x - r2, y) && at(x + r2, y) && at(x, y - r2) && at(x, y + r2)) survHeavy++;
    }
});
if (keyShots.length) {
  run("ffmpeg", ["-v", "error", "-y", "-i", path.join(cacheDir, "shot%02d.jpg"), "-vf", "scale=180:-1,tile=6x2", "-frames:v", "1", path.join(cacheDir, "sheet.jpg")]);
}
const strokeContrast = survV ? survH / survV : 1;
const runRatio = runsV.length && runsH.length ? median(runsH) / median(runsV) : 1;
const heavyRatio = nText ? survHeavy / nText : 0;
const pastel = bgH.v > 0.75 && bgH.s > 0.08 && bgH.s < 0.5;
let textMood: Style["typography"]["textMood"] = "gothic";
if (runsH.length > 200 && runRatio >= 1.5) textMood = "mincho";
else if (heavyRatio >= 0.2) textMood = "pop";
else if (pastel) textMood = "maru";
const candidates = FONT_CANDIDATES[textMood];

// 参考: 全体の代表色(k-means)
const samples: number[] = [];
frames.forEach((f, i) => {
  if (i % 3) return;
  for (let p = 0; p < W * H; p += 11) samples.push(f.px[p * 3], f.px[p * 3 + 1], f.px[p * 3 + 2]);
});
const cent = kmeans(Float32Array.from(samples), 6);
const share = new Array(cent.length).fill(0);
for (let s = 0; s < samples.length; s += 3) share[nearest([samples[s], samples[s + 1], samples[s + 2]], cent)]++;

// ---------- 組み立て ----------
const textLum = lumOf(textC);
const style: Style = {
  schemaVersion: 1,
  id,
  name: args.str("name") ?? `${id}(解析)`,
  source: { file: path.basename(file), analyzedAt: new Date().toISOString(), durationSec: round(meta.durationSec, 2), width: meta.width, height: meta.height, fps: meta.fps },
  palette: {
    background: bgStops.map(hex),
    text: hex(textC),
    textSub: hex(mix(textC, bgMean, 0.25)),
    accent: hex(accent),
    accent2: hex(accent2),
    shadow: hex(shadowC),
  },
  background: { type: bgType, angle: 180, particles, particleDensity, grain, vignette },
  typography: {
    textMood,
    fontFamily: candidates[0].family,
    fontCandidates: candidates,
    headingWeight: textMood === "pop" ? 900 : 700,
    bodyWeight: textMood === "pop" ? 800 : heavyRatio > 0.1 ? 700 : 500,
    headingSize,
    bodySize,
    lineHeight,
    letterSpacing: textMood === "mincho" ? 0.06 : 0.03,
    stroke: { width: strokeC ? (bodySize < 70 ? 8 : 12) : 0, color: hex(strokeC ?? shadowC) },
    shadow: { blur: strokeC ? 0 : 18, color: hex(textLum > 128 ? [0, 0, 0] : [255, 255, 255]), opacity: strokeC ? 0 : round(Math.abs(textLum - lumOf(bgMean)) < 110 ? 0.7 : 0.4) },
  },
  layout: {
    textAnchor: (textAreaY[0] + textAreaY[1]) / 2 < 0.38 ? "top" : (textAreaY[0] + textAreaY[1]) / 2 > 0.62 ? "bottom" : "center",
    textAreaY,
    align,
    marginX,
    maxCharsPerLine,
    panel: { enabled: panelEnabled, color: hex(panelC), opacity: panelEnabled ? 0.85 : 0.4, radius: 32 },
    showCredit: true,
  },
  animation: {
    textIn,
    stagger: pace === "fast" ? 0.06 : pace === "medium" ? 0.12 : 0.18,
    emphasis: textMood === "mincho" ? "glow" : textMood === "gothic" ? "none" : "pulse",
    transition,
    transitionSec,
    cameraMotion,
  },
  tempo: {
    pace,
    avgCutSec,
    minSceneSec: round(clamp(avgCutSec * 0.6, 1.5, 4)),
    paddingSec: pace === "fast" ? 0.3 : pace === "medium" ? 0.5 : 0.7,
  },
  text: { density, maxLinesPerScene },
  voice: {
    speaker: { mincho: 14, gothic: 2, maru: 8, pop: 3 }[textMood],
    speedScale: pace === "fast" ? 1.15 : pace === "medium" ? 1.05 : 0.95,
    pitchScale: 0,
    intonationScale: pace === "fast" ? 1.2 : 1.0,
    volumeScale: 1,
  },
  analysis: {
    note: "ヒューリスティック推定。値は手で調整してよい。参照フレーム: " + path.relative(process.cwd(), cacheDir).replace(/\\/g, "/"),
    analyzedSec: round(lengthSec, 1),
    sceneCuts: cuts.map((v) => round(v)),
    textChanges: textChanges.map((v) => round(v)),
    shotSec: durs.map((v) => round(v)),
    textBands: bands.map((b) => ({ y: [round(b.y0 / H), round((b.y1 + 1) / H)], mass: round(b.mass / Math.max(1, mainMass)), used: kept.includes(b) })),
    textFrameRatio: round(textFrames.length / frames.length),
    textCoverage: round(coverage, 3),
    votes: { camera: camVotes, textIn: textInVotes, transition: trVotes },
    font: { strokeContrast: round(strokeContrast), runRatio: round(runRatio), vStroke: round(median(runsH), 3), hStroke: round(median(runsV), 3), heavyRatio: round(heavyRatio, 3), textPixels: nText },
    panel: { votes: panelVotes, evaluated: panelEval },
    dominantColors: cent.map((c, i) => ({ color: hex(c), share: round(share[i] / (samples.length / 3), 3) })).sort((a, b) => b.share - a.share),
    starsPerFrame: round(starsPerFrame, 1),
    bgResidualStd: round(bgStd, 1),
  },
};

const parsed = styleSchema.safeParse(style);
if (!parsed.success) fail(`出力がスキーマに合いません: ${JSON.stringify(parsed.error.issues, null, 2)}`);
writeJson(outFile, { $schema: "./schema.json", ...parsed.data });

const sp = style.palette;
console.log(`
■ 結果 → ${path.relative(process.cwd(), outFile)}
  配色     背景 ${sp.background.join(" → ")} (${bgType}) / 文字 ${sp.text} / アクセント ${sp.accent}, ${sp.accent2}${strokeC ? ` / 縁取り ${hex(strokeC)}` : ""}
  背景     粒子=${particles}(${particleDensity}) グレイン=${grain} ビネット=${vignette}${panelEnabled ? ` / 文字座布団 ${hex(panelC)}` : ""}
  文字配置 Y=${textAreaY.join("〜")} ${align}揃え 本文${bodySize}px 見出し${headingSize}px 行間${lineHeight} 最大${maxLinesPerScene}行 1行${maxCharsPerLine}字 量=${density}
  フォント ${textMood}系 → 候補: ${candidates.map((c) => c.family).join(" / ")}
  テンポ   平均${avgCutSec}秒/カット (${pace}) ${shots.length}カット
  動き     文字=${textIn} 切替=${transition}(${transitionSec}s) カメラ=${cameraMotion}
  参照     ${path.relative(process.cwd(), path.join(cacheDir, "sheet.jpg"))}
使ってみる: npm run make -- --type tarot --style ${id}`);
