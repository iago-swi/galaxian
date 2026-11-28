# Sunspindle — ChatGPT version

A fixed-screen bird shooter above a mountain lake. The swifts and kites look folded out of sheet metal. The Solar Press runs on a brass spindle that slides out of the firing line every time you hit it.

**[Play Sunspindle in your browser](https://iago-swi.github.io/phoenix/ChatGPT/)**

![Sunspindle during the Solar Press fight. Above a striped gold sun and blue mountains, a glowing spindle sits just right of a gap shot through three rows of brass plates. Swifts dive past the player's shots. The flight panel shows stage five, a score of 4,285 and three ships.](screenshot.png)

## Run it

Play online, or download and extract the repository and open `ChatGPT/index.html`. Keep the files in that folder together. All art, type and sound work offline. The title screen shows the version, and the [changelog](CHANGELOG.md) records each release.

## How to play

| Control | Action |
| --- | --- |
| Left / Right or A / D | Steer along the bottom. |
| Space, Up or W | Fire. Hold for continuous fire. |
| Shift, Down or S | Raise the shield. |
| Enter | Launch, resume a paused flight or fly again. |
| P or Escape | Pause or resume. Switching windows pauses the game. |
| M | Mute or restore music and effects. |
| Touch | Hold the arrow and Fire buttons with separate fingers. Tap Shield for cover. Pause and Sound are above the playfield. |

You have three ships. The shield absorbs hits for 1.45 seconds and needs five more seconds to recharge. The gauge reads **Ready** when it can be raised again. You can steer and shoot while protected. A replacement ship has 2.4 seconds of cover. Every 4,000 points earns another ship.

| Stage | What to aim for |
| --- | --- |
| First flight | Pick off the swifts in formation or catch them as they dive. |
| Crosswind | A wider flock sends its divers down in quicker succession. |
| Hatchery | Five eggs sweep across three lanes. Shoot before they hatch or wait for the more valuable kites. |
| Double brood | Seven eggs cross at a faster pace. Clip a kite's wing to open a gap, or aim between the wings to destroy it. A wing grows back after three seconds. |
| Solar press | Drill through three layers of brass, then hit the spindle when its centre glows gold. It slides along a rail after each hit. Track it and cut a fresh opening while the escorts dive. |

| Target | Points |
| --- | ---: |
| Swift in formation, including escorts | 50 |
| Diving swift | 100 |
| Egg | 70 |
| Kite's wing | 0 |
| Kite's body | 250 |
| Brass plate | 15 |
| Solar Press destroyed | 1,800 × cycle number |

The first spindle takes six hits. Each new cycle adds one hit and speeds up the swifts, the broods and enemy fire.

## Technical notes

The game uses classic JavaScript scripts, Canvas 2D, CSS and the Web Audio API. No installation or network requests are needed. The simulation runs at a fixed 120 steps per second. Keyboard and multi-pointer input feed the same flight controls.

| File | Responsibility |
| --- | --- |
| `flight.js` | Flight rules, movement, collisions, waves and scoring. |
| `print.js` | Five cached screen-print landscapes, folded birds, armour, ship and particles. |
| `sound.js` | An original sixteen-step bell phrase with triangle bass, percussion and synthesized effects. |
| `cabinet.js` | Screens, input, frame timing and the flight panel. |
| `index.html`, `style.css` | The playfield, responsive cabinet and touch controls. |

The browser keeps the record in `localStorage` under `sunspindle.best`. If storage is unavailable the current session still keeps its best score.

## Testing

A scripted pilot in desktop Edge launched from local files, flew all five stages by steering and shooting, destroyed the press and fought the first flock of cycle two. It also tested pause and resume, shield coverage and recharge, scoring, extra ships, game over and restart. Separate collision checks covered a wing being hit, shots passing through the gap and the wing growing back after three seconds. The 1280 × 800 screenshot is a frame from the boss fight.

The run also passed at a phone-sized viewport. Mute and unmute were exercised. Sound by ear, play on physical touch hardware, Firefox, Safari and difficulty for a human player remain untested.

[Game history and the other versions](../README.md)
