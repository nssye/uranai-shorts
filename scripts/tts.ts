// VOICEVOX(ローカルエンジン)でシーンごとのナレーションwavを生成する
// エンジン未起動なら同梱の run.exe をバックグラウンド起動する
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Script, Style } from "../remotion/src/schema";
import { P, parseArgs } from "./lib/common";

const BASE = process.env.VOICEVOX_URL ?? "http://127.0.0.1:50021";
const ENGINE =
  process.env.VOICEVOX_ENGINE_PATH ??
  path.join(process.env.LOCALAPPDATA ?? "", "Programs", "VOICEVOX", "vv-engine", "run.exe");

const ping = async () => {
  try {
    const res = await fetch(`${BASE}/version`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
};

export const ensureEngine = async () => {
  if (await ping()) return;
  if (!fs.existsSync(ENGINE)) {
    throw new Error(`VOICEVOXエンジンに接続できません(${BASE})。VOICEVOXアプリを起動するか、VOICEVOX_ENGINE_PATH を設定してください`);
  }
  console.log("VOICEVOXエンジンを起動しています…");
  spawn(ENGINE, [], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await ping()) return;
  }
  throw new Error("VOICEVOXエンジンの起動待ちがタイムアウトしました");
};

type Speaker = { name: string; styles: { name: string; id: number }[] };

export const listSpeakers = async (): Promise<Speaker[]> => (await fetch(`${BASE}/speakers`)).json() as Promise<Speaker[]>;

export const creditFor = async (styleId: number) => {
  const sp = (await listSpeakers()).find((s) => s.styles.some((st) => st.id === styleId));
  if (!sp) throw new Error(`VOICEVOXに話者ID ${styleId} がありません(npm run tts -- --list で確認)`);
  return { credit: `VOICEVOX:${sp.name}`, label: `${sp.name}(${sp.styles.find((s) => s.id === styleId)!.name})` };
};

const wavDuration = (buf: Buffer) => {
  let byteRate = 0;
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") byteRate = buf.readUInt32LE(off + 16);
    if (id === "data") return size / byteRate;
    off += 8 + size + (size % 2);
  }
  throw new Error("wavの解析に失敗しました");
};

export const synthesize = async (text: string, voice: Style["voice"]) => {
  const q = new URLSearchParams({ text, speaker: String(voice.speaker) });
  const queryRes = await fetch(`${BASE}/audio_query?${q}`, { method: "POST" });
  if (!queryRes.ok) throw new Error(`audio_query失敗: ${queryRes.status} ${await queryRes.text()}`);
  const query = (await queryRes.json()) as Record<string, unknown>;
  Object.assign(query, {
    speedScale: voice.speedScale,
    pitchScale: voice.pitchScale,
    intonationScale: voice.intonationScale,
    volumeScale: voice.volumeScale,
    prePhonemeLength: 0.1,
    postPhonemeLength: 0.15,
  });
  const synth = await fetch(`${BASE}/synthesis?speaker=${voice.speaker}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  });
  if (!synth.ok) throw new Error(`synthesis失敗: ${synth.status} ${await synth.text()}`);
  const wav = Buffer.from(await synth.arrayBuffer());
  return { wav, durationSec: wavDuration(wav) };
};

// 台本の各シーンに音声を付ける。wavは remotion/public/jobs/<jobId>/ に置く
export const narrate = async (script: Script, style: Style): Promise<{ script: Script; speakerLabel: string }> => {
  await ensureEngine();
  const { credit, label } = await creditFor(style.voice.speaker);
  const rel = `jobs/${script.jobId}`;
  fs.mkdirSync(path.join(P.public, rel), { recursive: true });
  const scenes = [];
  for (const [i, scene] of script.scenes.entries()) {
    const { wav, durationSec } = await synthesize(scene.narration, style.voice);
    const src = `${rel}/scene${i + 1}.wav`;
    fs.writeFileSync(path.join(P.public, src), wav);
    scenes.push({ ...scene, audio: { src, durationSec } });
    console.log(`  🔊 scene${i + 1} ${durationSec.toFixed(2)}秒 「${scene.narration}」`);
  }
  return { script: { ...script, scenes, credit }, speakerLabel: label };
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs();
  await ensureEngine();
  if (args.bool("list")) {
    for (const sp of await listSpeakers()) console.log(`${sp.name}: ${sp.styles.map((s) => `${s.name}=${s.id}`).join(", ")}`);
  } else {
    const text = args.positional[0] ?? "テストです。今日もいい一日になりそうです。";
    const speaker = Number(args.str("speaker") ?? 3);
    const { wav, durationSec } = await synthesize(text, { speaker, speedScale: 1, pitchScale: 0, intonationScale: 1, volumeScale: 1 });
    const out = path.join(P.out, "tts-test.wav");
    fs.mkdirSync(P.out, { recursive: true });
    fs.writeFileSync(out, wav);
    console.log(`${out} (${durationSec.toFixed(2)}秒) ${(await creditFor(speaker)).credit}`);
  }
}
