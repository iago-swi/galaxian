# Phoenix

A browser game inspired by the 1980 arcade game, built to compare what different AI assistants produce from the same brief. Birds dive at your ship, eggs hatch into larger birds whose wings grow back, and after a few waves a ship as wide as the screen comes down. The versions by Claude, Gemini and ChatGPT each have their own folder.

**Play it in your browser: <https://iago-swi.github.io/phoenix/>**

| Version | Play | Play offline | Source and technical notes |
| --- | --- | --- | --- |
| Claude · Nightflock | [Play](https://iago-swi.github.io/phoenix/Claude/) | [Download the standalone game](https://raw.githubusercontent.com/iago-swi/phoenix/main/Claude/Nightflock.html) | [Claude/](Claude/) |
| Gemini · Suncrest | [Play](https://iago-swi.github.io/phoenix/Gemini/) | [Download the standalone game](https://raw.githubusercontent.com/iago-swi/phoenix/main/Gemini/Suncrest.html) | [Gemini/](Gemini/) |
| ChatGPT · Sunspindle | [Play](https://iago-swi.github.io/phoenix/ChatGPT/) | Open `ChatGPT/index.html` in a downloaded copy | [ChatGPT/](ChatGPT/) |

To play offline, save the standalone file with the `.html` extension and open it in a browser, or download/clone this repository and open the root `index.html`, a landing page that links to every version. Each version is self-contained in its own folder, with its own README.

## Claude version

![Nightflock on wave 4, at dusk. The Aerie, a steel ship shaped like a great bird, fills the top of the screen beside a pale moon. Its amber eye is open, two gaps are shot into the armour below it, three shots rise from the player's ship and three escorts fly below.](Claude/screenshot.jpg)

Use the arrow keys or `A` and `D` to move the ship, hold **Space** to fire, and press `↓` to raise the force shield for a moment. With a mouse or on a touchscreen, press and hold: the ship follows the pointer and fires, and the right button or a second finger raises the shield. The game runs in cycles of four waves: a flock of swallows, gulls and falcons, a brood of eggs that hatch into great ravens, a second flock that attacks harder, and the Aerie, whose armour must be shot through to reach its eye. A bird shot in mid-dive scores double, and kills in quick succession build a chain that multiplies the score up to eight times. The best score is kept in the browser. Rules, scoring and technical notes are in [Claude/README.md](Claude/README.md).

## Gemini version

![Suncrest on Cycle 1, Stage 5 against The Sun-Ark. Over a sunlit gold-leaf woodblock sky with radiating sunbeams, a vermilion sun disc, drifting Rinpa clouds and Prussian-blue waves, the screen-wide imperial pagoda fortress descends with a breach shot through its three rows of coloured lacquer armour tiles and revolving bronze shield belt while diamond sun-lances strike its glowing solar core and Azure Swift escorts swoop below.](Gemini/screenshot.png)

Use the arrow keys or `A` and `D` to steer your origami crane skiff, hold **Space** (or `↑`, `W`, `Z`) to fire sun-lances, and press `↓` (or `S`, `Shift`, `X`) to raise the **Solar Ward** force shield when ready. On a touchscreen, dedicated on-screen **◀**, **▶**, **WARD** and **FIRE** buttons appear along the bottom, or you can drag on the playfield. Each cycle plays across five sunlit woodblock stages: two diving flocks of swifts, kingfishers and kites, two broods of kintsugi porcelain eggs that hatch into Great Solar Phoenixes whose sheared wings grow back, and **The Sun-Ark**, where you shoot through three rows of lacquer armour tiles and a revolving bronze shield belt to hit the Solar Core while escorts attack. Rules, scoring and technical notes are in [Gemini/README.md](Gemini/README.md).

## ChatGPT version

![Sunspindle during the Solar Press fight. Above a striped gold sun and blue mountains, a glowing spindle sits just right of a gap shot through three rows of brass plates. Swifts dive past the player's shots. The flight panel shows stage five, a score of 4,285 and three ships.](ChatGPT/screenshot.png)

In *Sunspindle*, steer with the arrows or A and D, hold Space to fire and press Shift for the shield. A phone has separate movement, fire and shield buttons. Shoot the metal swifts as they dive, break the eggs before they hatch or aim between a kite’s regenerating wings. Every fifth stage brings the Solar Press. Cut through the brass plates and follow its spindle along the rail after each hit. [Controls, scoring and technical notes](ChatGPT/README.md).

## Game history

*Phoenix* reached arcades at the end of 1980: Taito released it in Japan in December, and Centuri, under license from Amstar Electronics, in North America in January 1981. Who wrote it is not known for certain, because the credits were overwritten by the companies that held the rights. [Wikipedia](https://en.wikipedia.org/wiki/Phoenix_(1980_video_game))

The game is a fixed-screen shooter in five stages that repeat. In the first two, small birds hold a formation and some of them dive at the player. In the next two, eggs veer back and forth across the screen and hatch into large birds. These must be hit in the body: a wing that is shot off grows back after a few seconds. The fifth stage is a large fortress. The player has to shoot through its hull and a rotating band of shielding to reach the pilot, while small birds keep attacking. Then the cycle starts again, harder.

Two things set it apart. The ship has a force field on a second button, which protects it for a few seconds and then cannot be used again for about five. And the fortress makes *Phoenix* one of the first shooters with a boss battle, an idea that later came to define the genre. The game was Centuri's best seller by 1982, and its Atari 2600 version, released in 1983, sold more than 600,000 copies. It was reissued in the *Taito Legends* collection in 2005.

*Nightflock* takes that shape and gives it another cast and another look. The birds are seen from above and drawn like the plates of a field guide, in natural colors with an ink outline, against a sky at dusk: swallows, gulls and falcons in the flocks, and red-eyed ravens out of the eggs, a nod to Hitchcock’s *The Birds*. A cycle has four waves instead of five. A raven that loses a wing flies in slow circles, and one that loses both tumbles down the screen. The last wave is the Aerie, a ship shaped like a great bird: instead of a rotating band, its eye opens and closes, and it can only be hurt while open. The shield slows the ship and stops its fire, and a bird that rams it is destroyed.

Version 1.0.0 of Nightflock was built from a brief that named *Galaxian*, and had only the diving flocks. Version 2.0.0 reworked it after *Phoenix*, the game the brief was meant to describe.

*Suncrest* keeps the original five-stage cycle — two diving flocks, two egg-and-phoenix broods, and a screen-wide descending fortress with a horizontally revolving shield belt beneath its outer armour — and reimagines the whole game as a sunlit Edo woodblock and gold-leaf scroll with synthesized pentatonic koto and taiko music. Alongside the classic force shield (the Solar Ward), wing regrowth and descending citadel, it adds mid-dive score bonuses, a rapid-kill flow multiplier up to ×4, rare Twin Lance lantern drops and dedicated mobile touch controls.

*Sunspindle* keeps the original five-stage order and its choice between breaking an egg early and taking on a larger bird. Its blue mountains and folded-metal birds are drawn like a screen print. The fortress carries its vulnerable spindle on a rail. Each hit sends it behind a different stack of armour, so a single opening seldom lasts the fight.

## Releases

Each game is numbered separately and has its own release notes. The [Releases page](https://github.com/iago-swi/phoenix/releases) lists every numbered release, with the standalone game of that release attached where there is one. The numbering rules are in [VERSIONING.md](VERSIONING.md).

| Game | Release notes |
| --- | --- |
| Nightflock | [Claude/CHANGELOG.md](Claude/CHANGELOG.md) |
| Suncrest | [Gemini/CHANGELOG.md](Gemini/CHANGELOG.md) |
| Sunspindle | [ChatGPT/CHANGELOG.md](ChatGPT/CHANGELOG.md) |

## Repository structure

```text
phoenix/
├── Claude/        Nightflock: game, source, screenshots and technical notes
├── Gemini/        Suncrest: game, source, screenshot and technical notes
├── ChatGPT/       Sunspindle: game, source, screenshot and technical notes
├── index.html     Landing page that links to every version
├── VERSIONING.md  How the games are numbered and released
└── README.md
```

Personal fan project, not affiliated with the makers of the original game.
