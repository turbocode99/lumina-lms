/**
 * Generates the narration with a frontier TTS model, one file per scene.
 *
 *   OPENAI_API_KEY=...  node voice.mjs                 → OpenAI, voice "nova"
 *   OPENAI_API_KEY=...  node voice.mjs --voice shimmer
 *   GEMINI_API_KEY=...  node voice.mjs --engine gemini
 *
 * Writes render/vo/scene-NN.mp3, which render.mjs --vo mixes under the picture.
 * Nothing is sent anywhere except the narration lines themselves.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { SCENES } from "./scenes.mjs";

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

// Paths resolve from this file, so the pipeline runs from any clone.
const HERE = dirname(fileURLToPath(import.meta.url));
const MARKETING = join(HERE, "..");
const WORK = join(tmpdir(), "lumina-film");


const OUT = join(WORK, "vo");
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf("--" + name);
  return i >= 0 ? args[i + 1] : fallback;
};

const engine = opt("engine", process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY ? "gemini" : "openai");
const force = args.includes("--force");

// Warm, measured, female. nova and shimmer read closest to the direction;
// sage and coral are worth an A/B if the client wants softer.
const OPENAI_VOICE = opt("voice", "nova");
const OPENAI_MODEL = opt("model", "gpt-4o-mini-tts");
const GEMINI_VOICE = opt("voice", "Aoede");
const GEMINI_MODEL = opt("model", "gemini-2.5-flash-preview-tts");

const DIRECTION =
  "Read as a warm, measured documentary narrator explaining a product she knows " +
  "well. Unhurried. Confident, never salesy. Let the sentences breathe.";

async function openai(text, path) {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      voice: OPENAI_VOICE,
      input: text,
      instructions: DIRECTION,
      response_format: "mp3",
      speed: 0.96,
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
}

/** Gemini returns raw PCM, so it gets a WAV header rather than an mp3 container. */
async function gemini(text, path) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${DIRECTION}\n\nSay this: ${text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_VOICE } } },
      },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const b64 = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
  if (!b64) throw new Error("no audio in response");
  const pcm = Buffer.from(b64, "base64");

  const rate = 24000, header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
  writeFileSync(path.replace(/\.mp3$/, ".wav"), Buffer.concat([header, pcm]));
}

const hasKey = engine === "openai" ? !!process.env.OPENAI_API_KEY
                                   : !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
if (!hasKey) {
  console.error(
    `No key for ${engine}. Set ${engine === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY"} and run again.`
  );
  process.exit(1);
}

console.log(`Narrating ${SCENES.length} scenes · ${engine} · ${engine === "openai" ? OPENAI_VOICE : GEMINI_VOICE}`);

for (let i = 0; i < SCENES.length; i += 1) {
  const name = `scene-${String(i).padStart(2, "0")}.mp3`;
  const path = `${OUT}/${name}`;
  if (!force && (existsSync(path) || existsSync(path.replace(/\.mp3$/, ".wav")))) {
    console.log(`  · ${name} already recorded`);
    continue;
  }
  try {
    if (engine === "openai") await openai(SCENES[i].vo, path);
    else await gemini(SCENES[i].vo, path);
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}: ${String(e.message).slice(0, 200)}`);
    process.exit(1);
  }
}

console.log("\nDone. Now run:  node render.mjs --vo");
