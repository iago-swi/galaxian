# Nightflock changelog

What changed in each version of Nightflock, newest first. The version number is shown
on the game's title screen. Each version is also a
[release on GitHub](https://github.com/iago-swi/phoenix/releases?q=Nightflock), with the
standalone game of that version attached. The numbering rules are in
[VERSIONING.md](../VERSIONING.md).

## 2.1.0 (2026-11-28)

A new look. The neon and the glow are gone, and the game no longer takes place in
space. Nothing about how it plays has changed.

### Changed

- The backdrop is a sky at dusk, with drifting clouds, a pale moon and, along the
  bottom, hills, telephone poles and wires with birds perched on them. The light on
  the horizon changes from wave to wave.
- The birds are drawn like the plates of a field guide, in natural colors with an ink
  outline: slate-blue swallows, white gulls with black wing tips, brown falcons and
  blue-black ravens with red eyes.
- Eggs are pale green and speckled.
- Your ship is painted steel with red stripes. The Aerie is a steel bird with riveted
  armour and an amber eye behind a shutter.
- Your shots are pale bars, and the birds drop red pellets.
- A bird that is hit bursts into feathers. Only your ship and the Aerie burn.
- Scores and messages are set in serif type, in cream and amber. The game-over screen
  now reads "The sky is theirs".

## 2.0.0 (2026-11-27)

The game is reworked after the 1980 arcade game *Phoenix*. It now runs in cycles of
four waves: a flock, a brood of eggs, a second flock that attacks harder, and a giant
ship.

### Added

- A force shield on `↓`, `S` or `Shift` (right mouse button, or a second finger). It
  lasts 1.8 seconds and then recharges for 5. While it is up, shots are absorbed and a
  bird that rams it is destroyed, but the ship is slow and cannot fire. A meter at the
  bottom right shows it.
- Eggs that drift across the screen and hatch into great ravens. An egg breaks with
  one shot.
- Great ravens whose wings can be shot off and grow back after about three seconds.
  Only a hit on the body destroys one. A raven with one wing flies in slow circles; one
  with no wings tumbles down the screen.
- The Aerie, a ship as wide as the screen, on every fourth wave. Shoot through the
  armour under its eye and hit the eye while it is open. It fires back from the eye and
  from two turrets, and releases birds from its wing tips.
- A bar that shows how much the Aerie can still take.

### Changed

- Ravens no longer fly in the flocks; they hatch from eggs. The flocks are made of
  swallows, gulls and falcons.
- The game gets harder from cycle to cycle instead of from wave to wave.
- Eggs count toward the chain that multiplies the score.

### Removed

- The shield power-up. The ship now has a shield of its own.

Earlier best scores are kept.

## 1.0.0 (2026-11-27)

First version.

- A formation shooter drawn with WebGL 2: a flock of birds holds formation in the
  night sky, and one bird after another dives at your ship.
- Four kinds of bird: swallows, gulls, falcons and ravens. Each dives in its own way,
  and a raven takes two hits and brings an escort.
- Five formations, and waves that get faster and more aggressive.
- A bird shot while it dives scores double, and kills in quick succession build a
  chain that multiplies the score up to eight times.
- Three power-ups: twin shots, rapid fire and a shield.
- Three ships to start with, and extra ships as the score climbs.
- Music and sound effects synthesized in the browser.
- Keyboard, mouse and touch-screen controls, pause and mute.
- The best score is kept in the browser.
- `Nightflock.html`, the whole game in a single file for playing offline.
