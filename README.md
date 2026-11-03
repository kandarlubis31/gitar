# gitar

Dua alat bantu belajar gitar dalam satu halaman:

- **Tuner** — dengarkan senar lewat mikrofon, lihat nadanya.
- **Pustaka akor** — 12 nada dasar × 5 tipe (Major, Minor, 7, m7, maj7) beserta posisi jari.

## Menjalankan

```bash
pnpm install
pnpm dev      # http://localhost:4321
pnpm build
```

## Cara kerja

Tuner memakai Web Audio API: sinyal mikrofon dibaca `AnalyserNode`, nadanya diestimasi, lalu
pembacaan dihaluskan supaya jarum tidak melompat. Saat sinyal terlalu lemah, angka dikosongkan
daripada menampilkan nada palsu.

Pustaka akor adalah data statis — tiap akor menyimpan posisi enam senar (`-1` berarti tidak dipetik)
dan fret dasarnya. Tidak ada backend maupun basis data.

## Struktur

```
src/pages/index.astro            Halaman tunggal
src/components/GuitarTuner.tsx   Tuner mikrofon
src/components/ChordLibrary.tsx  Data + tampilan akor
```

## Catatan

- Mikrofon hanya aktif di `localhost` atau HTTPS; membuka lewat alamat IP jaringan akan ditolak browser.
- Petik satu senar setiap kali mengukur. Beberapa senar berbunyi bersamaan menghasilkan nada campuran, sehingga tuner bisa menunjuk senar yang salah.
- `tone` masih ada di dependensi tetapi belum dipakai; akor belum bisa dibunyikan.
