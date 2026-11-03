# gitar — Project Context

## Ringkasan

Alat bantu belajar gitar di browser: tuner yang mendengarkan senar lewat mikrofon dan pustaka akor
yang menunjukkan posisi jari.

## Arsitektur

Astro sebagai kerangka halaman, dengan React hanya untuk bagian yang butuh state dan audio:

- **`GuitarTuner.tsx`** — `getUserMedia` → `AnalyserNode` (Web Audio API) → estimasi nada. Pembacaan
  dihaluskan dengan rata-rata bergerak agar jarum tidak melompat, dan nilai dikosongkan saat sinyal
  terlalu lemah supaya tidak menampilkan angka palsu.
- **`ChordLibrary.tsx`** — tabel akor statis: 12 nada dasar × 5 tipe (Major, Minor, 7, m7, maj7),
  masing-masing menyimpan `frets` enam senar (`-1` = tidak dipetik) dan `baseFret`.

Sisanya dirender Astro tanpa JavaScript, jadi halaman tetap ringan meski dua komponen di atas
interaktif.

Catatan: `tone` ada di dependensi tetapi belum dipakai di komponen mana pun — pustaka akor belum
memutar suara.

## Struktur

```
src/pages/index.astro           Halaman utama
src/components/GuitarTuner.tsx  Tuner mikrofon
src/components/ChordLibrary.tsx Data akor + tampilan
src/styles/global.css           Tailwind
astro.config.mjs                Integrasi React + Tailwind
```

## Menjalankan

```bash
pnpm install
pnpm dev      # http://localhost:4321
pnpm build
```

## Catatan

- Mikrofon hanya tersedia di `localhost` atau HTTPS; membuka lewat IP jaringan akan ditolak browser.
- Estimasi nada paling akurat saat satu senar dipetik. Beberapa senar berbunyi bersamaan menghasilkan
  satu nada campuran, sehingga tuner bisa menunjuk senar yang salah.
