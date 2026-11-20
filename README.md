# Northbound Afterglow

**Contest submission project for OpenGame Game Jam #1 (2026)** · `global-ai-game-jam-2026`

Start beside your station wagon at Kennedy Point Park in Titusville, Florida. Drive north on US 1 as a rocket climbs across the Indian River. Watch the light, then listen: the roar reaches you from where the rocket *was*, not where you see it now.

![In-game view approaching Cheney Highway on US 1 at dusk](docs/cheney-approach.jpg)

**Status:** Playable work in progress (Field Drive 04). This is the public source repository for the contest project; the official OpenGame entry has not yet been submitted.

## Play locally

No account, API keys, package install, or asset downloads are needed to play from a clone. From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory play
```

Open **http://127.0.0.1:8000/** and choose **Visit Kennedy Point**. Headphones make the delayed, directional launch sound easier to hear. If you already use the OpenGame CLI, `opengame dev . --port 8000` is an alternative local server.

| Control | Action |
| --- | --- |
| G | Enter at the driver's door, or exit once stopped |
| W / ↑, S / ↓ | Accelerate and brake; walk forward or back on foot |
| A / D or ← / → | Steer or walk sideways |
| X | Reverse the wagon |
| C / E | Switch chase/cockpit view or look toward the launch |
| F / R | Open the passenger window or toggle the radio |
| Space | Save a listening note in this browser |
| B / P | Show the route or pause the visit |

## What's mapped and what's imagined

The main 1.48 km alignment follows the northbound carriageway of South Washington Avenue. The modeled section has both carriageways, six named side-road approaches, and room to turn into either park. The wagon starts inside Kennedy Point Park. Follow the driveway and turn right onto US 1, then turn right into Rotary Riverfront Park when you reach its sign. You can park, get out, and walk south along the river to the fishing pier. The launch starts when you leave Kennedy Point or choose **Watch here**.

Census geometry anchors the named roads. The lane edges, park pavement, shoreline and pier approach are approximate traces and interpretations of the checked-in 2023 USDA aerial photograph. The pier dimensions come from [Brevard County](https://www.brevardfl.gov/ParksAndRecreation/ParkDirectory/RotaryRiverfront), and the horizon bearing and distance use NASA's [published 39A reference](https://netspublic.grc.nasa.gov/main/FINAL%20EA%20_LC-48_5_30_2019.pdf). Building facades, launch hardware and flight remain illustrated. The wagon, walker, sky paintings and synthesized audio were made for this game.

Map sources, reuse statements and the offline route builder are in [notes/maps](notes/maps/README.md). The [road-art reference](authoring/roadsurvey/README.md) documents the USDA imagery. `play/` contains the full browser game, including local art. It uses JavaScript modules, Canvas 2D and Web Audio.

## Check the build

With a recent Node.js and Python 3, run the route, interaction and sound tests from the repository root:

```sh
node --test tests/route.mjs && node tests/visit.mjs && node tests/sim.mjs
```

Optional Playwright keyboard and touch playthroughs are in `tests/mapped-journey.cjs` and `tests/mapped-touch.cjs`. With `playwright-core` and its Chromium browser installed, set `PREVIEW_URL=http://127.0.0.1:8000` to test a running local copy. Captures are written to `evidence/` (not tracked).
