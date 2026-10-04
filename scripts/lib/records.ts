// 運用記録 records/posts.csv の読み書き(Excelで開けるようBOM付きUTF-8)
import fs from "node:fs";
import path from "node:path";
import { P } from "./common";

// 生成時に自動で埋まる列
export const AUTO_COLUMNS = [
  "job_id", "created_at", "date", "style_id", "style_name", "fortune_type", "target", "hook_type",
  "font", "text_in", "transition", "camera", "pace", "particles", "bg_color", "speaker",
  "duration_sec", "scene_count", "video_file",
] as const;
// 投稿後に手入力(npm run record)する列
export const MANUAL_COLUMNS = [
  "posted_at", "platform", "post_url",
  "views", "reach", "likes", "comments", "saves", "shares", "follows", "avg_watch_sec", "notes",
] as const;
export const COLUMNS = [...AUTO_COLUMNS, ...MANUAL_COLUMNS];
export const METRICS = ["views", "reach", "likes", "comments", "saves", "shares", "follows", "avg_watch_sec"] as const;

export type Row = Record<string, string>;
export const RECORDS_FILE = path.join(P.records, "posts.csv");

const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
};

const esc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export const readRecords = (file = RECORDS_FILE): Row[] => {
  if (!fs.existsSync(file)) return [];
  const [header, ...rows] = parseCsv(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  if (!header) return [];
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
};

export const writeRecords = (rows: Row[], file = RECORDS_FILE) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const extra = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => !COLUMNS.includes(k as never));
  const header = [...COLUMNS, ...extra];
  const lines = [header.join(","), ...rows.map((r) => header.map((h) => esc(r[h] ?? "")).join(","))];
  fs.writeFileSync(file, "﻿" + lines.join("\r\n") + "\r\n");
};

// 同じjob_idは自動列だけ更新し、手入力の反応データは残す
export const upsertRecord = (auto: Row) => {
  const rows = readRecords();
  const existing = rows.find((r) => r.job_id === auto.job_id);
  if (existing) Object.assign(existing, auto);
  else rows.push(auto);
  writeRecords(rows);
};
