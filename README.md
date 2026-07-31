# Sword Runner

An endless runner with a sword. Jump the armoured obstacles, cut the soft ones,
build a multiplier, and slash gold lanterns mid-air to upgrade your blade.

One HTML file, HTML5 canvas, no build step and no dependencies.

## Run it locally

Audio will not play from `file://`, so serve it:

```bash
npm run dev          # http://localhost:8000
```

or without npm:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Deploy to Vercel

The repo is a static site with `index.html` at the root, so there is nothing to
build.

```bash
git init
git add .
git commit -m "Sword Runner"
git branch -M main
git remote add origin git@github.com:YOUR_USER/sword-runner.git
git push -u origin main
```

Then on Vercel: **Add New Project**, import the repo, and when it asks for a
framework choose **Other**. Leave the build command empty and set the output
directory to the repo root (or just leave the defaults; Vercel detects a static
site). Deploy.

`vercel.json` only sets cache headers: long-lived for `/music`, no-cache for the
HTML so your changes appear immediately.

### Why audio should work there and not locally

Browsers block audio on `file://` and require a user gesture before playback.
Vercel serves over HTTPS with proper MIME types and byte-range support, which is
what the `<audio>` element wants. The game arms playback on your first tap, so
the tap that starts a run is also what starts the music.

If it is still silent, look at the speaker icon in the top right. If it reads
**"no music file"** next to it, the mp3s did not deploy — check that `music/`
was committed. If there is no such message, the file loaded and the issue is
volume, mute state, or the device silent switch.

## Controls

| | Keyboard | Touch |
| --- | --- | --- |
| Jump | Space / Up / W | left half of the screen |
| Slash | X / Right / J | right half of the screen |
| Pause | Esc / P | button, top right |
| Restart | R | button in the pause menu |

## Characters

Three skins, chosen on the title screen or from the pause menu, saved to
localStorage. **They are cosmetic only** and play identically.

| Skin | Sword line | Music |
| --- | --- | --- |
| The Runner | Worn Tachi, Moonlit Katana, True Moonlit Katana | none |
| 2B | Virtuous Contract line, plus machine-lifeform enemies | `music/2b.mp3` |
| Link | Traveler's Sword, Master Sword, True Master Sword | `music/link.mp3` |

## How it works

- **Fixed timestep** at 120Hz inside `requestAnimationFrame`, so 60Hz and 120Hz
  devices play identically.
- **The character is a rig, not a sprite.** Poses are keyframes that interpolate;
  hair is simulated verlet strands; the death collapse is a small rigid-body sim
  that inherits momentum from whatever killed you.
- **Everything renders to an offscreen buffer** which is blitted letterboxed, so
  one virtual 800x360 canvas fits any screen.
- All tunables live in `CONFIG` at the top of the script.

Sprite dimensions and skin authoring notes: [`docs/sprite-spec.md`](docs/sprite-spec.md).
Conventions and invariants for editing: [`CLAUDE.md`](CLAUDE.md).

## Verify

```bash
npm run verify
```

Runs the game headlessly and asserts around 30 invariants — hitbox parity across
skins, the air-only lantern rule, spawn fairness over 40 simulated runs, hair
stability, the death collapse, music config. Run it after any change.

## A note on the audio

The two mp3s are 8-bit style covers of music from NieR:Automata and The Legend of
Zelda. They are fine for a personal project you keep to yourself, but do not
publish or distribute this with them. Swapping in your own tracks is a one-line
change per skin.
