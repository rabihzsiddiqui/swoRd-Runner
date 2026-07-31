/**
 * verify.mjs — runs the game's logic headlessly and checks the invariants that
 * matter. No dependencies; no browser.
 *
 *   node tools/verify.mjs
 *
 * It pulls the <script> out of index.html, evaluates it against a stub DOM, and
 * asserts the things that have actually broken during development. If you change
 * the game, run this. A green run does not prove it looks right, but a red run
 * means something is definitely wrong.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('"use strict";', "");

/* ---------- stub browser ---------- */
const noop = () => {};
const store = {};
const ctx = new Proxy({}, {
  get: (_, k) => {
    if (k === "createLinearGradient" || k === "createRadialGradient")
      return () => ({ addColorStop: noop });
    if (k === "canvas") return { width: 0, height: 0 };
    if (k === "measureText") return () => ({ width: 0 });
    return typeof k === "string" ? noop : undefined;
  },
  set: () => true
});
const canvas = () => ({ width: 0, height: 0, getContext: () => ctx, addEventListener: noop });
globalThis.window = { innerWidth: 800, innerHeight: 360, devicePixelRatio: 1, addEventListener: noop };
globalThis.document = { createElement: canvas, getElementById: canvas };
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => (store[k] = v) };
globalThis.Image = class { set src(_) {} };
globalThis.Audio = class {
  constructor(src) { this.src = src; this.volume = 0; this.paused = true; }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  addEventListener() {}
};
globalThis.performance = { now: () => 0 };
globalThis.requestAnimationFrame = noop;

const G = eval(source + `
;({ get S(){return S}, reset, update, applySkin, SKINS, CONFIG, OB,
    attackBox, slashPivot, sword, painterFor, PAINTERS, spawn, skeleton })`);

const { CONFIG, OB } = G;
const STEP = 1 / 120;
let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? "   " + detail : ""}`);
};
const head = t => console.log(`\n${t}`);

/* ---------- 1. skins are cosmetic ---------- */
head("Skins must not change gameplay");
const boxes = [];
for (let sk = 0; sk < G.SKINS.length; sk++) {
  G.applySkin(sk); G.reset();
  const row = [];
  for (let lv = 0; lv < CONFIG.swords.length; lv++) {
    G.S.swordLvl = lv;
    G.S.player.y = CONFIG.groundY - CONFIG.player.h;
    G.S.player.atkT = CONFIG.attack.windup + 0.01;
    const b = G.attackBox();
    row.push(`${b.x},${b.w},${b.y},${b.h}`);
  }
  boxes.push(row.join(" | "));
}
check("attack hitboxes identical across skins", new Set(boxes).size === 1, boxes[0]);
const enemyDims = G.SKINS.map(() => Object.entries(OB).map(([k, d]) => `${k}:${d.w}x${d.h}`).join(" "));
check("enemy boxes identical across skins", new Set(enemyDims).size === 1);

/* ---------- 2. lanterns stay air-only ---------- */
head("Lanterns must be reachable ONLY from a jump");
const floorY = CONFIG.groundY - CONFIG.player.h;
const apexY = floorY - CONFIG.jumpVelocity ** 2 / (2 * CONFIG.gravity);
const band = py => [py + CONFIG.attack.hitTop, py + CONFIG.attack.hitTop + CONFIG.attack.hitH];
const overlaps = (py, d) => {
  const [a, b] = band(py);
  const y0 = CONFIG.groundY - (d.hover || 0) - d.h;
  return a < y0 + d.h && b > y0;
};
for (let lv = 0; lv < CONFIG.swords.length; lv++) {
  G.S.swordLvl = lv;
  check(`Lvl ${lv + 1}: lantern out of reach standing`, !overlaps(floorY, OB.lantern));
  check(`Lvl ${lv + 1}: lantern reachable at apex`, overlaps(apexY, OB.lantern));
  check(`Lvl ${lv + 1}: brute reachable standing`, overlaps(floorY, OB.brute));
  check(`Lvl ${lv + 1}: flyer reachable standing`, overlaps(floorY, OB.flyer));
}

/* ---------- 3. no unclearable spawn patterns ---------- */
head("A competent player must not die to the spawner");
const airtime = Math.abs(CONFIG.jumpVelocity) * 2 / CONFIG.gravity;
function botRun(seconds = 60) {
  G.reset(); const S = G.S; S.phase = "play";
  let steps = 0;
  while (S.phase === "play" && steps < 120 * seconds) {
    const p = S.player;
    const next = S.obstacles
      .filter(o => !o.dead && o.x + o.w > CONFIG.player.x)
      .sort((a, b) => a.x - b.x)[0];
    if (next) {
      const lead = (next.x - (CONFIG.player.x + CONFIG.player.w)) / S.speed;
      if (next.harmless) {
        if (p.onGround && lead < airtime * 0.42) S.jumpBuf = CONFIG.inputBuffer;
        if (!p.onGround && lead < CONFIG.attack.windup + 0.02) S.atkBuf = CONFIG.inputBuffer;
      } else if (next.slashable) {
        if (lead < CONFIG.attack.windup + 0.02) S.atkBuf = CONFIG.inputBuffer;
      } else if (p.onGround && lead < airtime * 0.42) S.jumpBuf = CONFIG.inputBuffer;
    }
    G.update(STEP); steps++;
  }
  return steps / 120;
}
G.applySkin(0);
const runs = Array.from({ length: 40 }, () => botRun());
const early = runs.filter(t => t < 15).length;
const median = runs.slice().sort((a, b) => a - b)[20];
check("fewer than 4 of 40 bot runs die inside 15s", early < 4, `${early}/40 early, median ${median.toFixed(1)}s`);
check("gaps never shorter than a jump arc", CONFIG.spawnGapMin > 0 &&
  airtime * CONFIG.speedMax * 0.95 >= CONFIG.spawnGapMin * 0.5);

/* ---------- 4. hair and collapse stay numerically stable ---------- */
head("Simulation must not blow up on any skin");
for (let sk = 0; sk < G.SKINS.length; sk++) {
  G.applySkin(sk); G.reset(); G.S.phase = "play";
  let finite = true, deepest = -1e9;
  for (let i = 0; i < 120 * 25; i++) {
    if (i % 50 === 0) G.S.jumpBuf = CONFIG.inputBuffer;
    if (i % 31 === 0) G.S.atkBuf = CONFIG.inputBuffer;
    G.update(STEP);
    for (const strand of G.S.strands)
      for (const pt of strand) {
        if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) finite = false;
        deepest = Math.max(deepest, pt.y);
      }
  }
  const name = G.SKINS[sk].name;
  check(`${name}: hair stays finite`, finite);
  check(`${name}: hair stays on top of the grass`, deepest <= CONFIG.groundY);
}

/* ---------- 5. death collapse ---------- */
head("Death collapse inherits the killer's momentum");
function killedBy(type) {
  G.reset(); const S = G.S; S.phase = "play";
  S.t = (520 - CONFIG.speedStart) / CONFIG.speedGain;
  for (let i = 0; i < 60; i++) { S.obstacles.length = 0; G.update(STEP); }
  S.obstacles.length = 0;
  G.spawn(type, CONFIG.player.x + 40);
  for (let i = 0; i < 120 * 3; i++) G.update(STEP);
  return S.death;
}
G.applySkin(0);
const lowHit = killedBy("brute");
const highHit = killedBy("flyer");
check("struck low pitches her forward", lowHit && lowHit.rot > 0, `tilt ${(lowHit.rot * 57.3).toFixed(0)}deg`);
check("struck high knocks her backward", highHit && highHit.rot < 0, `tilt ${(highHit.rot * 57.3).toFixed(0)}deg`);
check("collapse settles", lowHit.settled && highHit.settled);

/* ---------- 6. music config ---------- */
head("Music config");
for (const sk of G.SKINS) {
  const m = sk.music;
  check(`${sk.name}: music is null or a list of candidate paths`,
    m === null || (Array.isArray(m) && m.length > 0 && m.every(p => typeof p === "string")));
}

/* ---------- 7. per-skin enemy art ---------- */
head("Per-skin enemy painters resolve");
for (let sk = 0; sk < G.SKINS.length; sk++) {
  G.applySkin(sk); G.reset();
  const ok = Object.keys(OB).every(t => typeof G.painterFor(t) === "function");
  check(`${G.SKINS[sk].name}: every enemy has a painter`, ok);
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
