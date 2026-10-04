// Remotion Studioでプレビュー。jobIdを渡すとその台本・スタイル・音声で開く
// 例: npm run studio                 (デモ)
//     npm run studio -- <jobId>
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fail, P, parseArgs } from "./lib/common";

const job = parseArgs().positional[0];
const extra: string[] = [];
if (job) {
  const props = fs.existsSync(job) ? path.resolve(job) : path.join(P.content, job, "props.json");
  if (!fs.existsSync(props)) fail(`${props} がありません。先に npm run make を実行してください`);
  extra.push(`--props=${props}`);
}
spawnSync(["npx remotion studio src/index.ts", ...extra.map((e) => `"${e}"`)].join(" "), { cwd: P.remotion, stdio: "inherit", shell: true });
