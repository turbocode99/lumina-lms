/**
 * Renders the walkthrough to a real MP4.
 *
 *   node render.mjs            → video + music, no narration
 *   node render.mjs --vo       → also mixes vo/scene-NN.mp3 if present
 *   node render.mjs --limit 4  → quick smoke of the first four scenes
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import ffmpegPath from "ffmpeg-static";
import { SCENES, ACTS } from "./scenes.mjs";
import { renderMusic } from "./music.mjs";

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

// Paths resolve from this file, so the pipeline runs from any clone.
const HERE = dirname(fileURLToPath(import.meta.url));
const MARKETING = join(HERE, "..");
const WORK = join(tmpdir(), "lumina-film");


const SHOTS = join(MARKETING, "shots");
const OUT_DIR = MARKETING;
const TMP = WORK;
const VO_DIR = TMP + "/vo";

const W = 1920, H = 1080, FPS = 30, XF = 0.7;
const SERIF = "C\\:/Windows/Fonts/georgia.ttf";
const SERIF_B = "C\\:/Windows/Fonts/georgiab.ttf";
const SANS_B = "C\\:/Windows/Fonts/arialbd.ttf";
const SANS = "C\\:/Windows/Fonts/arial.ttf";

const args = process.argv.slice(2);
const withVO = args.includes("--vo");
const li = args.indexOf("--limit");
const LIMIT = li >= 0 ? Number(args[li + 1]) : SCENES.length;
const scenes = SCENES.slice(0, LIMIT);

mkdirSync(TMP, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

function ff(cmdArgs, label) {
  try {
    execFileSync(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...cmdArgs],
      { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 });
  } catch (e) {
    console.error("\nffmpeg failed:", label);
    console.error(String(e.stderr || e.message).slice(0, 1400));
    process.exit(1);
  }
}

// Text goes through files so apostrophes and colons need no escaping.
function textFile(name, value) {
  const p = `${TMP}/${name}.txt`;
  writeFileSync(p, value, "utf8");
  return p.replace(/:/g, "\\:");
}

// One reusable scrim so captions stay legible over bright light-mode screens.
const SCRIM = `${TMP}/scrim.png`;
if (!existsSync(SCRIM)) {
  ff(["-f", "lavfi", "-i",
      `gradients=s=${W}x560:c0=0x080B14@0.95:c1=0x080B14@0.0:x0=0:y0=560:x1=0:y1=0:nb_colors=2`,
      "-frames:v", "1", SCRIM], "scrim");
}

console.log(`Rendering ${scenes.length} scenes at ${W}x${H}…`);
const clips = [];

scenes.forEach((s, i) => {
  const out = `${TMP}/clip-${String(i).padStart(2, "0")}.mp4`;
  clips.push(out);
  const frames = Math.round(s.d * FPS);

  if (s.img) {
    const src = `${SHOTS}/${s.img}.png`;
    if (!existsSync(src)) { console.error("missing shot:", src); process.exit(1); }

    const tf = textFile(`osd-${i}`, s.osd || "");
    const af = textFile(`act-${i}`, `ACT ${ACTS[s.act]}  ·  ${s.act.toUpperCase()}`);
    const bf = textFile(`sub-${i}`, s.sub || "");

    // Eyebrow, headline, supporting line — staggered so the frame reads in
    // order rather than arriving all at once. With no narration these three
    // carry the whole scene, so the supporting line gets real size.
    const pre = Math.round(W * 1.35);
    const vf =
      `[0:v]scale=${pre}:-1:flags=bilinear,` +
      // Zoom rate scales with the scene, so a seven-second shot and an
      // eleven-second one finish at the same magnification instead of the
      // short ones looking static next to the long ones.
      `zoompan=z='min(zoom+${(0.075 / frames).toFixed(7)},1.075)':d=${frames}` +
        `:x='iw/2-(iw/zoom/2)':y='ih/8-(ih/zoom/8)':s=${W}x${H}:fps=${FPS},` +
      `setsar=1[base];` +
      `[1:v]scale=${W}:560[sc];` +
      `[base][sc]overlay=0:${H - 560},` +
      `drawtext=fontfile='${SANS_B}':textfile='${af}':fontcolor=0x8FE6F7:fontsize=24` +
        `:x=92:y=${H - 306}:alpha='min(0.95,max(0,(t-0.1)/0.4))',` +
      `drawtext=fontfile='${SERIF}':textfile='${tf}':fontcolor=white:fontsize=68` +
        `:x=88:y=${H - 252}:shadowcolor=0x080B14@0.6:shadowx=0:shadowy=3` +
        `:alpha='min(1,max(0,(t-0.22)/0.5))',` +
      `drawtext=fontfile='${SANS}':textfile='${bf}':fontcolor=0xE4E9F2:fontsize=33` +
        `:x=91:y=${H - 142}:shadowcolor=0x080B14@0.55:shadowx=0:shadowy=2` +
        `:alpha='min(0.95,max(0,(t-0.6)/0.6))',` +
      `format=yuv420p[out]`;

    ff(["-loop", "1", "-t", String(s.d), "-i", src, "-i", SCRIM,
        "-filter_complex", vf, "-map", "[out]", "-t", String(s.d), "-r", String(FPS),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", out], `clip ${i}`);
  } else {
    // Brand card: the product gradient, set in the film's own serif.
    const cf = textFile(`card-${i}`, s.card);
    const sf = textFile(`cardsub-${i}`, s.sub || "");
    const vf = [
      `drawtext=fontfile='${SERIF_B}':textfile='${cf}':fontcolor=white:fontsize=132` +
        `:x=(w-text_w)/2:y=(h-text_h)/2-46:alpha='min(1,max(0,(t-0.3)/0.8))'`,
      `drawtext=fontfile='${SANS_B}':textfile='${sf}':fontcolor=white@0.88:fontsize=32` +
        `:x=(w-text_w)/2:y=(h/2)+86:alpha='min(1,max(0,(t-0.9)/0.8))'`,
      `format=yuv420p`
    ].join(",");
    ff(["-f", "lavfi", "-t", String(s.d), "-r", String(FPS), "-i",
        `gradients=s=${W}x${H}:c0=0x5B5EF0:c1=0x06B6D4:x0=0:y0=0:x1=${W}:y1=${H}:nb_colors=2`,
        "-vf", vf, "-t", String(s.d), "-r", String(FPS),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", out], `card ${i}`);
  }
  process.stdout.write(`  ✓ ${String(i + 1).padStart(2)}/${scenes.length}  ${s.osd || s.card}\n`);
});

// Clip lengths can drift a frame or two from the intended duration, and an
// xfade offset past the end of its input silently collapses the whole chain —
// so the cut is built from what actually rendered.
function probe(file) {
  try {
    execFileSync(ffmpegPath, ["-hide_banner", "-i", file], { stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    const m = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/);
    if (m) return (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
  }
  return null;
}

const real = clips.map((c, i) => {
  const d = probe(c);
  if (!d) { console.error("could not read duration:", c); process.exit(1); }
  return d;
});

// ---- Crossfade the clips into one picture ----
console.log("Crossfading…");
const inputs = clips.flatMap((c) => ["-i", c]);
let chain = "", last = "0:v", acc = real[0];
for (let k = 1; k < clips.length; k += 1) {
  const off = (acc - XF).toFixed(3);
  const lbl = k === clips.length - 1 ? "vout" : `x${k}`;
  chain += `[${last}][${k}:v]xfade=transition=fade:duration=${XF}:offset=${off}[${lbl}];`;
  last = lbl;
  acc = acc - XF + real[k];
}
if (clips.length === 1) chain = "[0:v]null[vout];";
const VIDEO = `${TMP}/video.mp4`;
ff([...inputs, "-filter_complex", chain.replace(/;$/, ""), "-map", "[vout]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
    "-r", String(FPS), VIDEO], "xfade");

const runtime = acc;
console.log(`  picture locked — ${Math.floor(runtime / 60)}:${String(Math.round(runtime % 60)).padStart(2, "0")}`);

// ---- Audio ----
console.log("Scoring…");
const MUSIC = `${TMP}/music.wav`;
renderMusic(runtime + 2, MUSIC, withVO ? 0.17 : 0.3);

let audioInputs = ["-i", MUSIC];
let audioFilter = "[1:a]volume=1.0[aout]";

if (withVO) {
  // Each line starts where its scene starts, allowing for the crossfades.
  const starts = [];
  let t = 0;
  scenes.forEach((s, i) => { starts.push(t); t += real[i] - (i < scenes.length - 1 ? XF : 0); });

  const present = scenes.map((_, i) => `${VO_DIR}/scene-${String(i).padStart(2, "0")}.mp3`)
                        .map((p) => (existsSync(p) ? p : null));
  const have = present.filter(Boolean).length;
  console.log(`  narration tracks found: ${have}/${scenes.length}`);

  if (have) {
    const parts = [];
    present.forEach((p, i) => { if (p) { audioInputs.push("-i", p); parts.push(i); } });
    let f = "";
    parts.forEach((sceneIdx, n) => {
      const delay = Math.max(0, Math.round((starts[sceneIdx] + 0.45) * 1000));
      f += `[${n + 2}:a]adelay=${delay}|${delay},volume=1.9[v${n}];`;
    });
    const voMix = parts.map((_, n) => `[v${n}]`).join("");
    f += `${voMix}amix=inputs=${parts.length}:dropout_transition=0:normalize=0[vo];`;
    // Duck the bed under the voice so the words stay on top.
    f += `[1:a][vo]sidechaincompress=threshold=0.06:ratio=7:attack=25:release=520[bed];`;
    f += `[bed][vo]amix=inputs=2:dropout_transition=0:normalize=0,alimiter=limit=0.95[aout]`;
    audioFilter = f;
  }
}

const FINAL = `${OUT_DIR}/lumina-walkthrough.mp4`;
ff(["-i", VIDEO, ...audioInputs, "-filter_complex", audioFilter,
    "-map", "0:v", "-map", "[aout]", "-shortest",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", FINAL], "mux");

rmSync(SCRIM, { force: true });
console.log("\n→", FINAL);
