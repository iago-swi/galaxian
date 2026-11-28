# Suncrest — Gemini version

A browser shooter built with Gemini (Google), inspired by the 1980 arcade game *Phoenix* and drawn in the style of a sunlit Edo woodblock and gold-leaf scroll. Flocks of painted birds dive across washi paper, porcelain kintsugi eggs hatch into Great Solar Phoenixes whose sheared wings grow back, and every fifth stage brings the Sun-Ark: a screen-wide imperial pagoda fortress with destructible lacquer armour and a revolving bronze shield belt.

Graphics and sound are generated directly in the browser (HTML5 Canvas 2D and Web Audio API). There are no image or audio files, no frameworks, and no build step.

**[Play it in your browser](https://iago-swi.github.io/phoenix/Gemini/)**

The version number is shown on the title screen. The [changelog](CHANGELOG.md) lists what changed in each version.

![Suncrest on Cycle 1, Stage 5 against The Sun-Ark. Over a sunlit gold-leaf woodblock sky with radiating sunbeams, a vermilion sun disc, drifting Rinpa clouds, a distant red torii gate and Prussian-blue waves, the screen-wide imperial pagoda fortress descends with a breach shot through its three rows of coloured lacquer armour tiles and revolving bronze shield belt. Rising diamond sun-lances strike its glowing solar core as Azure Swift escorts swoop past the player's origami crane skiff.](screenshot.png)

## Run it

Play online with the link above. To play offline, download [Suncrest.html](https://raw.githubusercontent.com/iago-swi/phoenix/main/Gemini/Suncrest.html), save it as an `.html` file, and open it in a current version of Chrome, Edge, Firefox or Safari. That single file contains the entire game. To inspect or edit the source, clone the repository and open `Gemini/index.html` directly from disk — no installation, web server or build step is needed. Display and monospace typefaces load from Google Fonts (`Cinzel`, `Cormorant Garamond`, `IBM Plex Mono`) with automatic system font fallbacks offline.

## How to play

| Key / Input | Action |
| --- | --- |
| `←` `→` or `A` `D` | Move left and right |
| `Space` (or `↑`, `W`, `Z`) | Fire sun-lances (hold for continuous fire) |
| `↓` (or `S`, `Shift`, `X`) | Raise the Solar Ward (force shield) |
| `Enter` or `Space` | Start from title screen, or fly again after game over |
| `P` or `Esc` | Pause / resume |
| `M` | Toggle sound on/off |

On a touch screen (phone or tablet), dedicated on-screen **◀**, **▶**, **WARD** and **FIRE** buttons appear along the bottom edge, and you can also drag directly on the playfield to steer and fire. With a mouse, hold the left button to steer and fire, and click the right button to raise the Solar Ward.

**The Solar Ward** (force shield) surrounds your crane skiff with a rotating golden mandala barrier for **2.0 seconds**, then recharges for **5.0 seconds**. The bottom-right HUD gauge displays `READY`, `ACTIVE`, or the remaining cooldown seconds, and a subtle dashed gold ring glows behind your ship whenever the ward is ready. While raised, the Solar Ward vaporizes incoming enemy shots and destroys diving small birds on contact, but slows your ship to 55% speed and suspends your cannons.

The game follows the classic **five-stage Phoenix cycle**. After the fifth stage falls, a new cycle begins with faster enemies, denser broods, quicker dives and a tougher Sun-Ark.

| Stage | Name | What comes |
| --- | --- | --- |
| 1 | Dawn Flock | Swifts, kingfishers and kites enter along curved paths, hold formation and break off to dive and fire. |
| 2 | Gale Flock | A wider twin-chevron flock that dives more frequently across a gold-ochre noon sky. |
| 3 | Porcelain Brood | Kintsugi porcelain eggs weave side to side and hatch into Great Solar Phoenixes. |
| 4 | Crimson Brood | A larger, faster brood of eggs and Great Solar Phoenixes across a persimmon scroll. |
| 5 | The Sun-Ark | A screen-wide imperial sky-citadel descending slowly with three armour rows, a revolving bronze shield belt, wing turrets and escort birds. |

### Scoring

| Target | Points | Notes |
| --- | --- | --- |
| Azure Swift (Prussian blue) | 40 | Weaves widely while diving. Double points (80) if shot mid-dive. |
| Jade Kingfisher (malachite green) | 60 | Banks sharply toward your skiff. Double points (120) mid-dive. |
| Vermilion Kite (cinnabar red) | 90 | Fastest diver; fires twin shots. Double points (180) mid-dive. |
| Kintsugi Porcelain Egg | 50 | Destroyed in one shot before it cracks and hatches. |
| Great Solar Phoenix (body) | 250 | Only a body hit destroys it (400 if destroyed during a swoop). |
| Great Solar Phoenix (wing) | 30 | Shears the wing off; it regrows in 3.6 seconds. |
| Sun-Ark lacquer armour tile | 15 | Layer 1 outer bulwark (38 tiles across 3 rows). |
| Sun-Ark revolving bronze shield | 30 | Layer 2 conveyor belt behind the armour tiles. |
| Sun-Ark Solar Core hit | 150 | Requires threading shots through both breached outer layers. |
| The Sun-Ark destroyed | 3,000 × cycle | Clears all escorts and launches the next cycle. |
| Twin Lance lantern pickup | 100 | Doubles your cannons for 11 seconds. |
| Stage clear bonus | 500 × stage | Awarded at the end of every stage. |

Kills in quick succession (within 2.6 seconds) build a **Flow Multiplier** stamped next to your score (`×2` at 3 kills, `×3` at 6 kills, `×4` at 9+ kills).

**Great Solar Phoenixes.** Shooting either wing shears it off in a shower of painted feathers and starts a 3.6-second regrowth cycle visible as budding gold filaments. A phoenix missing one wing slows down and lists in circles toward its missing side; a phoenix missing both wings loses lift and tumbles downward until a wing grows back. Aim straight for the gilded diamond on its chest to finish it.

**The Sun-Ark.** Carve a tunnel through the three rows of coloured lacquer armour tiles (Layer 1), then blast openings in the horizontally revolving bronze shield belt (Layer 2) directly behind them so your shots reach the glowing Solar Core inside the central sanctum. Destroyed belt segments slowly reforge after 18 seconds while intact shields continue scrolling across the breach. Meanwhile, two Dragon Lantern turrets fire aimed ember shots, side alcoves release escort birds, and the entire fortress descends steadily toward your ship.

**Lives and extra ships.** You start with three crane skiffs. An extra ship is awarded at **10,000 points** and every **20,000 points** thereafter (30,000, 50,000, …), up to five lives. After losing a ship, your replacement spawns with 2.4 seconds of invulnerability. Your best score is stored locally in the browser (`localStorage`).

## Technical notes

### Stack

| | |
| --- | --- |
| Delivery | `index.html` plus four classic scripts in `js/` (~1,850 lines total). `Suncrest.html` is the same game with all scripts inlined into one file. Zero dependencies, zero build step. |
| Language | Plain JavaScript (ES2020) loaded via classic `<script>` tags so the game runs identically from GitHub Pages and directly from disk (`file://`). |
| Rendering | High-DPI HTML5 Canvas 2D with procedural washi-paper grain caching, full-bleed woodblock landscapes, ink-outlined sprites and particle physics. HTML/CSS handles the HUD, scroll overlays and mobile touch pads. |
| Sound | Web Audio API procedural synthesizer: pentatonic koto plucks, low shamisen bass, taiko drums, hyōshigi woodblocks, breathy flute swells and bespoke SFX. |
| Storage | `localStorage` key `suncrest.best` for the player's highest score (wrapped in `try/catch` for restricted contexts). |
| Version | Shown on the title screen badge (`Version 1.0.0`). Numbered and released per [VERSIONING.md](../VERSIONING.md). |

### Files

| File | Responsibility |
| --- | --- |
| [index.html](index.html) | Page markup, typography, woodblock scroll HUD/overlays, responsive mobile touch controls. |
| [js/art.js](js/art.js) | Five stage sky palettes, procedural washi paper texture, Rinpa clouds, Hokusai waves, all woodblock bird/egg/phoenix/Sun-Ark/ship drawings and particles. |
| [js/audio.js](js/audio.js) | Pentatonic step sequencer (idle, flock, brood and boss arrangements) and synthesized sound effects. |
| [js/entities.js](js/entities.js) | Flock formations, escort birds, egg paths, Great Phoenix factories, Sun-Ark construction and swept multi-layer boss shot collision. |
| [js/game.js](js/game.js) | Fixed-timestep-clamped frame loop, player movement and Solar Ward state machine, combat, scoring, extra lives, input handling and inspection hook. |
| [Suncrest.html](Suncrest.html) | Portable single-file offline edition. |
| [CHANGELOG.md](CHANGELOG.md) | Player-facing release notes per version. |

### Behavior

- **Delta-time movement:** Frame delta is clamped to 50 ms so the game runs at consistent speed across 60 Hz, 120 Hz and higher refresh monitors.
- **Swept boss collisions:** Player shots travel fast (`840 units/s`), so boss collisions sample substeps along each shot's vertical segment from bottom to top (Layer 1 tiles → Layer 2 revolving belt → Solar Core → hull) to prevent tunneling through thin armour rows.
- **Auto-pause:** Switching tabs or blurring the browser window automatically pauses an active game and releases held keys.
- **Reduced motion:** Respects `prefers-reduced-motion` on UI overlay transitions.

## Testing

Adding `?stage=1` through `?stage=6` to the URL starts directly at that stage without modifying the saved best score, and `window.__suncrest` exposes read-only state and test helpers.

Checked in headless Chrome at 1280 × 800 with automated end-to-end scripts (zero console errors):

- Opening both `Gemini/index.html` and the standalone `Gemini/Suncrest.html` directly from disk (`file://`) and over HTTP.
- Title screen rendering (`Version 1.0.0` badge and live animated flock).
- **Stage 1 (Dawn Flock)** and **Stage 2 (Gale Flock):** bird entry, formation sway, diving attacks, shooting and scoring.
- **Solar Ward force shield:** activation (`ACTIVE`), duration expiry into cooldown timer, and HUD indicator updates.
- **Pause and Mute:** `P` pause/resume and `M` mute toggle.
- **Stage 3 (Porcelain Brood)** and **Stage 4 (Crimson Brood):** destroying an egg before hatching, hatching into Great Solar Phoenixes, shearing off a wing without killing the bird, verifying the wing regrows after 3.6 seconds, and verifying a body hit destroys the phoenix.
- **Stage 5 (The Sun-Ark) and Cycle 2:** boss entry and slow descent, shooting sequentially through Layer 1 lacquer armour tiles → Layer 2 revolving bronze shield belt → Solar Sovereign Core, escort birds spawning, destroying the core, and advancing cleanly to **Cycle 2 · Stage 1 (Stage 6)**.
- **Progression:** extra life awarded at 10,000 points, `localStorage` best-score persistence, game over screen, and restarting a new flight.
- **Live deployment:** verified `https://iago-swi.github.io/phoenix/Gemini/` loads and plays after merge.

Not checked:

- Listening to the Web Audio music and sound effects by ear.
- Playing on a physical smartphone or tablet touch screen.
- Frame rate on older or low-power mobile hardware.
- Human difficulty feel across a full hand-played multi-cycle run.

[Game history and the other versions](../README.md)
