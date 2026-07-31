# Working on Sword Runner

Read this before changing anything. Most of it is scar tissue from bugs that
actually happened.

## What this is

A side-scrolling endless runner. One HTML file, no build step, no dependencies.
`index.html` contains everything: config, simulation, rendering, UI. It is about
2000 lines and deliberately monolithic — do not split it into modules unless
asked.

Open `index.html` through a local web server, not `file://`, or audio will not
play. `npm run dev` serves it at http://localhost:8000.

## Run this after every change

```bash
npm run verify
```

`tools/verify.mjs` evaluates the game's script headlessly and asserts about 30
invariants: hitbox parity across skins, the lantern rule, spawn fairness, hair
stability, the death collapse, music config, enemy painters. It has caught real
regressions. A green run does not prove the game looks right, but a red run
means something is broken.

## The rules that must not break

**1. Skins are cosmetic. Full stop.**
A skin supplies colours, a body profile, hair, a sword *look*, enemy art, and a
music track. Gameplay values — `reach`, `toNext`, `beam`, hitboxes, spawn rules,
speeds — live in `CONFIG` and `OB` and are shared by every skin. `sword()` merges
skin colours over `CONFIG.swords` and must never let a skin override a gameplay
field. Verified by the first check in verify.mjs.

**2. Lanterns are reachable only from a jump.**
The slash hitbox has a fixed vertical span (`attack.hitTop`, `attack.hitH`).
Sword upgrades extend `reach`, which is horizontal only. If you ever make an
upgrade grow the arc vertically, a grounded player can hit lanterns and the
mechanic dies. The beam inherits the slash's vertical band for the same reason.

**3. Obstacle gaps scale with speed.**
Spawn gaps derive from `jumpArc()` = airtime x current speed. Never hardcode a
gap in pixels or the game becomes unclearable at high speed.

**4. The drawing is the hitbox.**
Blade length equals `sword().reach`. If you change one, change the other. Art
that promises reach the collision does not have is worse than ugly art.

## Draw order matters more than the shapes

Most of the character art bugs were layering, not geometry. The head paints in
this order and the comments in `drawCharacter()` say so:

```
headArt.back  ->  head/face  ->  headArt.mid  ->  visor or eye  ->  headArt.front  ->  ear
```

`mid` exists because hair that falls over the face must go *under* the visor.
Without it the locks painted over 75% of the visor and the character was
unreadable. Before adjusting any polygon coordinate, check whether the thing
you are fixing is actually being painted over by a later layer.

Related: `oneHead: true` draws a single face circle and skips the ink disc used
by the two-circle head. The face is outlined on its **lower arc only** — ringing
the whole circle drew a dark band across the top of the head that looked exactly
like a hairband, and cost several rounds of confusion.

## Hair: shape or rope, never both

Things that genuinely swing (a ponytail, a cap tail) are simulated verlet strands
in `SKINS[i].strands`. Things that hold their form (a bob, a fringe, sideburns)
are static polygons in `headArt`, given in head-local `[forward, up]` coordinates.
A rope cannot hold a silhouette; simulating a bob only ever produced a stubby
tail no matter how wind and gravity were balanced.

## Colour and legibility

The palette is daytime. A mid-tone sky cannot separate both light elements
(cream sleeves, steel blade) and mid-tone ones (armour, red enemies) by value —
no sky colour exists that does. That is why **everything readable carries a dark
`INK` outline**. When adding art, give it an outline rather than hunting for a
fill colour that contrasts.

Two signals the player relies on:
- **grey / dark and angular** = armoured, must jump
- **red accent** = slashable

2B's machine enemies are grey, which fights this. They stay legible because they
are much lighter than the barrier and keep red eyes. Do not darken them.

## Scale reality

The character is 26x42 units in an 800x360 viewport, so on a phone the head is
about 6 pixels across. Fine detail does not survive. If a feature cannot be seen,
the answer is usually camera zoom, not more shapes. A verified zoom exists in the
git history: shrink `width`/`height`/`groundY` and scale speeds by the same
factor the visible track shrank, which leaves reaction time unchanged.

## Music

Each skin lists **several candidate paths**; they are tried in order and a load
failure falls through to the next. If all fail the HUD shows "no music file"
next to the speaker. Playback is armed on the first user gesture because
browsers block autoplay. Pausing ducks to 35% rather than stopping, because
stopping and restarting pops.

## House style

- Comments explain *why*, especially where a value was chosen to fix something.
- Tunable numbers go in `CONFIG` at the top, not inline.
- Prefer deleting a shape over adding one on top of it. Several bugs were patches
  layered over earlier patches: a stray ink disc, a hairband, a duplicate hair
  lock. Removing things has fixed more here than adding things.
- No em dashes in prose or comments.
