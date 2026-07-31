# Sword Runner: art spec and next steps

The game runs at a virtual resolution of **800 x 360** with the ground line at
**y = 300**. These are 16-bit-era sprite dimensions, so draw **at 1x, at the
exact pixel sizes below**, and let the game upscale with nearest-neighbor.
Drawing at 3x and downscaling destroys pixel art. `imageSmoothingEnabled` is
already set to `false` in `resize()`, so a 26 x 42 PNG will stay crisp on a
retina phone.

## The character frame

Every frame of every character animation uses **one canvas: 84 x 106**, with the
26 x 42 collision body anchored at **(10, 34)** inside it. The frame is sized to
contain the *longest* sword, so one grid covers every upgrade level. Draw the grid once
and reuse it for run, jump, slash and death. Verified free space around the
body:

- **10 px left** for the ponytail trailing behind her
- **48 px right** for the sword arc, which reaches up to 50 px forward at Lvl 3
- **34 px above** the head, enough for the longest blade held fully overhead
- **30 px below** the feet for landing squash and the follow-through

Art may overhang anywhere in that frame without affecting collision. The
hitboxes never change, so you cannot break the game with a drawing.

## Other sprite sizes

| Slot | Canvas size (w x h) | Notes |
| --- | --- | --- |
| `barrier` | 22 x 46 | Armored, unslashable. Should read as "do not touch, jump it." |
| `brute` | 28 x 28 | Ground enemy, slashable. Should read as soft or cuttable. |
| `flyer` | 30 x 26 | Hovers 36 units above the ground, at chest height. |
| `lantern` | 22 x 22 | Hangs 96 units up, only reachable at your jump apex. Harmless. Cutting two awakens the katana. |

## Sword levels

| Lvl | Name | Reach | Blade | Hilt |
| --- | --- | --- | --- | --- |
| 1 | Worn Tachi | 34 | steel `#dfe7f2` | brass `#8a6a3a`, indigo wrap |
| 2 | Moonlit Katana | 45 | cyan `#7fe9ff`, glowing | gold `#ffd166`, deep blue wrap |
| 3 | True Moonlit Katana | 50 | violet `#c9b6ff`, pulsing halo | gold `#ffd166`, violet wrap |

Lvl 3 also fires a ranged crescent on each charged swing, on a 2.6s cooldown.
The beam inherits the slash's vertical band, which is what keeps lanterns
air-only for free: fired from the ground the band sits below them, and only a
swing at the jump apex reaches one. Armoured barriers absorb the beam, so
jumping is never optional. The beam pierces slashable enemies, so three in a
row die to one shot.

Costs are per level (`toNext`): 2 lanterns for Lvl 2, then 3 more for Lvl 3.

`reach` drives the hitbox and the drawn blade length from the same number, so
the art can never promise reach the collision does not have. Vertical span
(`hitTop`, `hitH`) is deliberately NOT part of the upgrade, which is what keeps
lanterns air-only at every level. Verified at both levels: 20 px of overlap on
the flyer standing, lantern out of reach from the ground, lantern reachable at
the apex. Adding a Lvl 3 means appending to `CONFIG.swords` and nothing else,
though anything past reach 50 needs a taller frame again.


## Skins

Three characters, chosen on the title screen or from the pause menu, saved to
localStorage. **A skin is purely cosmetic.** It supplies colours, a body
profile, hair strands and a sword shape; reach, hitboxes, timings and spawn
rules always come from `CONFIG`, so all three play identically. Verified: the
attack box is byte-identical across skins at every sword level.

| Skin | Body | Hair (all simulated) | Sword |
| --- | --- | --- | --- |
| The Runner | feminine, short tunic | 1 strand: black ponytail | katana |
| 2B | feminine, dress to the knee, tall black boots, blindfold | none: the bob is a static shape | katana |
| Link | masculine, pointed ear, heavier limbs | 1 strand: green cap tail | straight blade |

**Hair is either a shape or a rope, never both.** Things that genuinely swing
(a ponytail, a cap tail) are simulated strands. Things that hold their form
(a bob, a fringe, sideburns) are static polygons in `headArt`, given in
head-local `[forward, up]` coordinates so they rotate with the head. Simulating
a bob only ever produced a stubby tail, no matter how the wind and gravity were
balanced, because a rope cannot hold a silhouette.

`headArt.back` draws behind the skull, `headArt.front` after the face, so a lock
can fall across a blindfold or a fringe can sit over a brow. Anything in `front`
must not cover the eye at head-local `(3.9, 0.1)`.

Link's sword line is Traveler's Sword, Master Sword (blue hilt), True Master
Sword (gold hilt). The blade gets visibly longer per level because `reach` does,
which is shared with every skin.

### Adding a skin

Append to `SKINS`. The fields are `art` (the whole palette), `front`/`back`
(torso half-widths, the same seven-row table described above), `strands`
(each becomes its own verlet rope: `n` points, `seg` rest length, `sy`/`px`
anchor offsets from the head, `w0`/`w1` taper, `color`), `swordStyle`
(`katana` or `straight`), `limb` (thickness multiplier), plus optional `hat`,
`ear`, `shin: "boot"` and `face: "blindfold"`. `swords` supplies three
`{name, blade, edge, hilt, wrap, trail}` entries. Do not put `reach` or `beam`
in a skin: those are gameplay and belong in `CONFIG`.

## Frame counts, derived from the game's real timings

| Animation | Unique drawings | Timing |
| --- | --- | --- |
| Run | **4** key poses, mirrored to 8 frames | ~50 ms per frame at starting speed, ~30 ms at top speed |
| Jump | 5 | Not timed. Pick the frame from vertical velocity. |
| Slash | 7 (1 windup, 3 sweep, 3 recovery) | 60 ms / 40 ms each / 63 ms each |
| Jump slash | 7 | Same timing, legs tucked |

A run cycle is only **four** drawings. Frames 5 through 8 are those same four
poses with the arms and legs swapped. The four are: contact (front foot lands),
down (lowest point, knee absorbing), passing (rear leg swings under the body,
highest point of the head), and up (push off, fully extended). If you can draw
those four, you have a run cycle.

The jump should be driven by velocity, not a timer, or it desyncs from the
physics: rising, near-apex, falling, plus one takeoff and one landing squash.

The most important art job is not fidelity, it is **legibility at speed**.
A player has roughly a third of a second to decide. Armored things and
slashable things need to differ in silhouette and value, not only in hue,
so they stay readable to colorblind players and on a dim phone screen.

## Wiring your art in

Under `SPRITES` near the top of `sword-runner.html`:

```js
loadSprite('player', 'art/player.png');
loadSprite('playerAttack', 'art/player-attack.png');
loadSprite('barrier', 'art/barrier.png');
```

Any slot left as `null` keeps drawing a labelled placeholder box, so the game
stays playable while art is half finished. Sprites load asynchronously and pop
in when ready, so nothing breaks if a file is missing.

## Numbers worth knowing before you tune anything

- Jump peak: **101 px**, airtime **0.65 s**. The barrier is 46 px, so there is
  generous clearance.
- Attack: 0.06 s windup, 0.12 s active, 0.19 s recovery. Mashing is punished
  because the recovery blocks a re-swing.
- The slash is a **vertical arc**: 34 units of forward reach, sweeping from 14
  units above the head to 2 units below the feet. That single hitbox covers
  both ground enemies and chest-height flyers with about 20 px to spare, so you
  never have to judge height. Lanterns still sit above it, reachable only at
  the jump apex.
- If you animate the swing, the frame that matters is the **overhead hold**
  during windup. That is the tell that says the swing is already committed.
- Speed ramps from 320 to a cap of 720 px/s over about 36 seconds.
- Obstacle gaps are never shorter than one full jump arc at the current speed,
  so the game cannot generate an impossible pattern.

## Good next tasks for Claude Code

Roughly in order of how much they improve the game per unit of work:

1. Sound. Slash, jump, land, death, and a lantern chime. Use the Web Audio API
   and unlock the context on the first tap, or iOS will stay silent.
2. Sprite animation. Swap `player` for a frame array plus a frame timer, then
   add a run cycle and a distinct windup pose.
3. PWA. Add `manifest.json`, a service worker that pre-caches the HTML and every
   art file, and 192 px and 512 px icons. Test with the network disabled.
4. Juice pass. Landing dust, a blade trail during active frames, and a brief
   slow-motion effect on a high multiplier kill.
5. Difficulty curve tuning. Weight the obstacle table by elapsed time so
   lanterns and combos appear more often as the run goes on.

## A prompt that works well with Claude Code

> Read sword-runner.html. It is a single-file canvas endless runner with a
> fixed-timestep loop. Add sound effects using the Web Audio API, unlocked on
> first pointerdown so it works on iOS. Keep everything in this one file, keep
> the CONFIG block as the single place to tune values, and do not change the
> existing physics constants.

Being explicit about the constraints is what keeps an agent from quietly
rewriting your game loop while adding a feature.
