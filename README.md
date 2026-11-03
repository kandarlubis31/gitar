# gitar

A guitar practice page in the browser: a chromatic tuner that actually measures pitch, and a
chord library that shows you where to put your fingers.

## Tuner

`GuitarTuner.tsx` does not guess from the loudest frequency bin. It runs the **YIN algorithm** on
the microphone input taken through the Web Audio API:

- FFT size 8192 samples for enough low-frequency resolution.
- Cumulative mean normalised difference, with a threshold of `0.10`.
- Search range limited to **70–380 Hz** — the guitar's practical range, low E up to the upper
  frets — which excludes most room noise and harmonics.
- Parabolic interpolation around the best period for sub-sample accuracy, so the needle does not
  jitter between adjacent cents.

That makes it usable in a noisy room, which a naive FFT peak picker is not.

## Chord library

`ChordLibrary.tsx` holds a hand-written chord database covering all 12 roots across five
qualities — Major, Minor, 7, m7 and maj7 — with fret positions and a `baseFret` offset for shapes
that live up the neck.

```
ROOTS = C  C#  D  Eb  E  F  F#  G  G#  A  Bb  B
TYPES = Major  Minor  7  m7  maj7
```

An open-string char is `0`, a muted string is `-1`, and `baseFret` shifts the diagram when the
shape starts above the first fret — so barre chords display correctly instead of looking like
open chords.

## Stack

Astro · React · Tone.js · Tailwind CSS

## Run

```bash
pnpm install
pnpm dev
```

```bash
pnpm build      # static output
pnpm start      # serve the build
```

Microphone access requires `https://` or `localhost`. Opening the built files over `file://` will
not work — serve them.

## Structure

```
src/
  pages/index.astro           page shell, mounts both islands
  components/GuitarTuner.tsx  YIN pitch detection + tuner UI
  components/ChordLibrary.tsx chord database + fretboard diagrams
  styles/global.css
```

## License

MIT
