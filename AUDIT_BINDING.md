# DON'T MELT! production guide binding

Local baseline `5e15f8c9f0d64a5c11e7048b72d0cf7b4c553b07` on `main`. Type checking, all 20 baseline tests, and the production build passed.

| Guide area | Local implementation |
| --- | --- |
| Canvas and perception | `src/game/engine.ts` owns the frame loop and camera. Scene drawing lives in `sprites.ts` and `fieldworkArt.ts`. `tripFx.ts` supplied the legacy world and viewport effects. Simulation profiles live in `rules.ts`. |
| Audio | `src/game/audio.ts` synthesizes regional music, ambience, and effects using Web Audio. Each note previously went directly to the output. |
| Saves and settings | `src/game/save.ts` validates and migrates saves. The v6 schema uses the existing v5 storage key. `types.ts` defines save and HUD data. `App.tsx` and `components/Modals.tsx` connect settings to the engine. |
| Art | Procedural Canvas drawing plus the cover illustration in `src/assets`. Local screenshots under `.aistudio` are reference material. |
| County systems | `fieldwork.ts`, `fishing.ts`, `world.ts`, and `engine.ts` own camp work, ribbon trials, fishing, regional conditions, and melt recovery. `components/FieldworkPanel.tsx` renders the Camp Ledger. |
| Progression | `data.ts` declares leads. `disciplines.ts` declares tiers, perks, and diminishing practice returns. `engine.ts`, `rules.ts`, and `fishing.ts` apply their gameplay effects. |

The initial pass used Delta Public Bank’s loaner reed rod and Spool Perch. The expanded implementation adds the guide’s named Millpond and Hollow encounters, hand-placed ribbon stakes, Cool-Mint, Chalk-Quartz, companion escort, and their recovery paths. Delta fishing, the ferry supper, the timed ribbon trials, and the county broadcast remain in the game. The live survival meter is Vibe, so the melt warning uses missing Vibe and the strain effects also follow Wobble.

## Playable leads

The title and character card teach each ability. E activates it without a separate per-cast currency cost. Practice contexts below use live systems. Risk flags identify candidates for the progression pass.

| Lead | Active and cooldown | Passive or lead-specific advantage | Practice and decisive use | Audit |
| --- | --- | --- | --- | --- |
| Pip | Express Delivery, 5.5 s. Piercing stun parcel. | +15% XP, Junk Mail decoys, tube radio fix | Hit targets from range, ring bells, restore the radio | Broad XP bonus deserves route comparisons. |
| Barnaby | Spill the Tea, 7.5 s. Heals and forces a dance. | Brew anywhere, lamp recovery, steam radio tuning | Recover near camp, create an opening in a crowd | Distinguish warmth from Gus’s burst recovery. |
| DJ Moss | Drop the Bass, 8.5 s. Surges crops and stuns nearby creatures. | Double nearby crop growth, Dance-Off head start, relay jam | Time a crop surge or stop a group of foes | Test crop stacking with music buildings. |
| Gerald | Surprise Audit, 9.5 s. Freezes foes and damages bosses. | Peaceful inspectors, 25% barter discount, tax-form radio fix | Practice crowd control and defuse inspector routes | Compare barter stacking with Warm Welcome. |
| Tilda | Fold Span, 6.5 s. Speed and wet-terrain crossing for 6 s. | Rooftop bracing dialogue | Cross jam or shallow ink, reach rooftop paths | Compare uptime with Mossie. |
| Brin | Guide Line, 6 s. Reveals shoals and slows enemies. | Wider bite window, Reed Spools, Auntie Bias’s favor | Test a cast at the bank and follow reflected fish | Compare window stacking with Current Reader. |
| Solfa | Lend Glow, 7 s. Places warming light and restores Vibe. | Shortwick recognition and warm trail support | Place light on a dark road or near seedlings | Spell out where the warmth applies. |
| Marlo | High-Water Mark, 6.5 s. Reveals crystals and stalls nearby foes. | Oona’s weatherproof binder trade | Scout tide routes, caves, and crystal nodes | Clarify reveals and durable unlocks in the tooltip. |
| Bea | Wall Tap, 6 s. Rings props, pacifies creatures, and boosts crops. | Cavern cues and double Acoustics practice | Learn tuning fork cycles, then run cave routes | Check same-action XP floor for repeated taps. |
| Gus | Steam Vent, 7.5 s. Restores Vibe and knocks foes back. | Stove support and chowder supplies | Clear a path back to camp or prepare a meal | Verify the cooking benefit described in the card. |
| Nori | Split Sunbeam, 6.5 s. Surges crops and charms creatures. | Graft and reflected-lure theme | Use at Mood Soil or the reflected bank | Compare graft and lure claims with live triggers. |
| Mossie | Reed Float, 6.5 s. Glides over mud and water for 7 s. | Capt. Nix recognition | Cross jam, silt, and wet expedition routes | Test sustained wet-route speed alongside Tilda. |

## Livelihood disciplines

Skills shows all five tiers, at 0, 40, 100, 190, and 310 practice XP. Each discipline offers one of two sidegrades at Tier 3, with no material payment for perk selection. Recipe and gear material costs remain in Craft. Some tier descriptions describe player goals and should be checked against actual unlock gates before rebalancing.

| Discipline | Tier 1 → 2 → 3 → 4 → 5 | Tier 3 sidegrades | Learn, practice, and apply | Audit |
| --- | --- | --- | --- | --- |
| Farming | Sow → stress and mulch → graft → Choir Irrigator → stable hybrids | Graft Sage boosts hybrid odds and Bell Reeds per tooltip. Hydro Tender advertises automated irrigated growth. | Mood Soil, nearby camp irrigation, rare hybrids | Current engine hooks also give harvest yield and manual tending bonuses. Verify advertised rates. |
| Angling | Reed rod → nibble and lure → Prism Reel → rare shoals → nursery | Current Reader widens bite and helps reel. Stillwater Keeper aids reflected catches. | Delta Public Bank, dock lamp, rare fish, supper | Verify agreement between tooltip and FSM and test Brin stacking. XP starts at catch completion. |
| Cookery | Chowders → preservation → timed courses → substitutes → broadcast supper | Provisioner grants additional meal benefits. Tablekeeper improves shared meals. | Camp Table, chowder supplies, broadcast | Reconcile advertised duration and Vibe numbers with live extra-serving and multiplier hooks. |
| Fabrication | Basic gear → modular parts → Prism Reel → field tools → masterworks | Lens-Smith saves one crystal above the cost floor. Field Tinker removes station gates. | Craft, Workbench, Funk-Blender, expedition equipment | Surface cases where a one-crystal recipe receives zero discount. |
| Building | Place → furnish → Frost Pantry → route utilities → waystations | Host rewards hospitality. Rigger improves salvage. | Camp placement and dusk supper | Verify claimed radius and aura effects. Check XP from repeated place/salvage. |
| Field Botany | Sketch → compare → verify → cultivate → publish | Field Naturalist boosts release or observation practice. Nocturnal Spotter improves rare flora yield. | Reflections, fish release, nocturnal harvesting | Check exact observation bonus and release XP rate. |
| Acoustics | Calls → motifs → Choir Irrigator → relays → broadcast | Echo Listener extends acoustic windows. Motif Weaver grants restoration and charm effects. | Forks, radio, station motifs, cave passages | Verify wall-tap distance and repeated motif XP. |
| Wayfinding | Landmarks → timing → shortcuts → rigging → refuges | Shortcut Surveyor improves travel speed. Lantern Strider helps night drain and adds 6 s of Ghost Mode. | County roads and discoveries, night travel | Verify road restriction and compass claims. Discovery XP is one-time per location. |
| Creature Care | Observe → feed → train → restore habitat → migration | Gentle Hand lowers tame cost and rewards peaceful encounters. Field Scout shortens buddy gift interval. | Favored foods, dance, released fish, companions | Compare advertised gift frequency with the 16.25 s versus 25 s interval. |
| Hospitality | Supper → schedules and trades → welcoming stop → disputes → festival | Warm Welcome improves barter and gifts. County Connector gives +25 XP on resolutions. | Capt. Nix, camp meals, regional requests | Compare Warm Welcome with Gerald and check completion guards on repeated trades. |

## First slice verification

- The settings dialog opens from the title and pause menus. A Chromium reload preserved mute, Reduced Motion, and 0% perception intensity. At a 390 px layout width, the five sliders and comfort controls measured at least 44 px high with no page overflow.
- A browser fixture landed one Spool Perch at 0% perception intensity with Reduced Motion, Flash-Free Optics, and mute enabled. It also checked that the bite caption appeared, comfort changes cleared active motion on the next render, and melt recovery returned the player to Mailbox Square with the fishing line reset.
- A 600-frame storm, critical-melt, and fishing overlap fixture reported zero general flashes from the average luminance of five sampled 341 × 256 px blocks. The browser AudioContext suspended and resumed through the visibility lifecycle. A 60-second offline stress render at full gain measured −1.000 dBFS peak with zero clipped samples.
- TypeScript checking, 27 automated tests, and the Vite production build passed.

## Full guide integration

| Effect | Gameplay trigger and presentation |
| --- | --- |
| Contour Breath | Low-frequency reed and scenery motion near warm refuges, sheltered banks, and calm trips. |
| Watercolor Glaze | Warm pigment wash near a settled player and soft music warmth with camp recovery. |
| Form-Constant Hatch | Static or slow engraved honeycomb at fishing lanes, with a spiral variant for reflected fish. |
| Audio-Visual Ink Ripple | Pooled ink loops and stamped cues for casts, bites, crafting, weather, chimes, and camp tasks. |
| Meaning-Rich Motif | Landmark halo, two-note chime, alternate musical texture, and landmark name in the Camp Ledger. |
| Soft Ink Echo | Sepia trails using up to 32 preallocated stamps for the player and nearby moving wildlife. |
| Parallax Depth | Bounded decorative drift in a squall or high melt pressure. Landmarks, paths, and hitboxes stay fixed. |
| Cadence Drift | Six-second atmospheric modulation and small changes to sustained musical phrases. Fishing and combat clocks use the existing simulation step. |
| Bramble Frame | Composited hand-inked edge mask with a clear center and separate warning text. |
| Hollow Acoustic Filter | Band-limited ambience and a quiet 180 ms echo around severe exposure. |

The bespoke brew and synergy motifs again have a dedicated renderer. Kaleido rosettes, cloud bubbles, sound-spectrum ink, clockwork, cosmic lattice and star links, disco tiles, prism facets, and velvet filigree track the visible world. The former full-screen RGB separation, aggressive camera zoom/tilt, rapidly flashing overlays, and whisper text were replaced with these bounded cues. Named abilities also received clearer tooltips and matching gameplay hooks. Repeat-practice limits apply per completed action and game day. Items and skill unlocks persist in the v8 save format.

The asset register records the built-in image generation prompts, provenance, and procedural audio sources. Illustrations are packaged as WebP with a paper PNG fallback. Music uses three original synth parts on a continuous 96 BPM clock, with bar-aligned changes and separate 30-second calm and storm beds. The guide’s suggested recorded 64-second stems are represented by that live score.

The browser fixture at `tests/production-qa.html` completed both expeditions at 0% perception with audio muted and at 100% perception. Delta Spool Perch still advances the ferry supper. v7 inventory and v8 restoration progress reloaded, all eight art sources decoded, and the audio context suspended and resumed. The storm fixture reported one general flash per second at most and zero saturated-red transitions across nine sampled block averages. The 60-second offline mix peaked at −1.000 dBFS with zero clipped samples. Type checking, all 33 tests, and the production build passed.

The 43.2 fps browser capture result includes nine block samples and a pixel readback on every rendered frame. It measures the diagnostic loop. Release QA still requires independent gameplay frame-rate profiling, a pixel-level flash audit, a listening pass in Firefox and Safari, physical touch-device checks, and human comfort playtests.
