# DON'T MELT!

DON'T MELT! is a browser survival RPG set in Unmelted County. Choose one of 12 wanderers, explore 15 regions, build a camp, and restore enough of the county to host the All-Night Broadcast.

## Run locally

Use Node.js 22.18 or newer and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. The default is [localhost:3000](http://localhost:3000/). The game runs in the browser and saves progress in browser storage for that URL. Save manually from the HUD or pause menu. The game also saves at dawn and at certain story milestones.

## Controls

| Action | Keyboard |
| --- | --- |
| Move | WASD or arrow keys |
| Boop, interact, hook, or reel | Space |
| Roll / character ability | Shift / E |
| Move the lamp at Delta Public Bank | L |
| Use a quick item | 1–5 |
| Atlas / Bag / Craft | G / B / C |
| Styles / Skills / Quests | V / K / Q |
| Camp Ledger | H |
| Pause or close a menu | Esc |

On touchscreens, drag on the left side of the world to move and use the HUD buttons for actions and menus. Open Settings from the title screen, pause menu, or HUD. Reduced Motion can follow your system setting. Perception Intensity can be set to 0%, and visual sound cues appear automatically for muted channels. Master, music, ambience, and effects have separate volume controls. The in-game settings also include a fishing reel toggle.

## Camp Ledger

- Check today’s and tomorrow’s weather before a long trip. A Paper Squall makes exposed evenings colder, while Emberfall uses up Munch faster in daylight.
- Pin Delta Public Bank under First Fishing Trip. Borrow the reed rod, wait for **Hook Now**, and reel when the fish is calm. Bring your catch to a Camp Table for the ferry supper.
- Under **Restoration field notes**, start the Singing Millpond outing. Tie the two marked ribbons, choose a fishing bank, and collect Cool-Mint before turning in at Mailbox Square. Restoring the pond opens Red-Chalk Hollow, where you can bank quartz and lead a stalled lantern moth back to shelter.
- Use the community bench in Giggle-Grove or build your own camp site. Mark it from the ledger, stock Fizz Berries as rations, and give tamed companions dusk jobs. They can gather supplies, tend nearby Mood Soil, or watch a camp lamp. Build a Camp Relay at a workbench to improve gathering and tending.
- Pin Lantern Loop or Marmalade Run from the ledger. The clock starts at the first gate. Roll through gold arches to clear them, then race the rest of the route. Each first finish awards a supply cache, and later attempts can improve your saved best time.

## Check and build

```sh
npm run lint
npm test
npm run build
npm run preview
```

Serve the generated `dist/` directory from a static web host.

Open [the browser QA fixture](http://127.0.0.1:4317/tests/production-qa.html) while running the dev server on port 4317. It exercises both expeditions at 0% and 100% perception, Delta fishing, legacy saves, storm overlap, and mixer headroom in an isolated tab session.

## Cover illustration

The title backdrop was generated for this game with the built-in image generation tool.

> Stylized-concept title background for the original browser game DON'T MELT!, landscape 16:9. Hand-inked psychedelic storybook screen print, heavy plum outlines and warm parchment halftone, teal foliage and coral cloud accents. At twilight a crooked lantern-lit post office with blank sign, oversized frilled mushrooms, folded-paper trees and a sinuous ribbon trail curl up from lower right toward a distant radio tower on the ridge. Lamplight and glowing fireflies, indigo and mauve sky. Composition weighted toward right half with quiet dark purple negative space on the left for a game menu, artwork still reads in a center crop. Clear illustrated silhouettes, tactile papercut shapes, intentionally limited color palette. No text, letters, logos, weapons, or watermarks.
