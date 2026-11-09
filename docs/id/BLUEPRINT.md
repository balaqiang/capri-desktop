[English](../BLUEPRINT.md) · **Bahasa Indonesia** · [← README](../../README.id.md)

# Tubuhnya sebagai gambar

Gambar dia di Illustrator, beri nama layernya, ekspor satu SVG, dan dia menggerakkannya sendiri: tiap bagian berputar pada porosnya, dan
tiap wujud (tubuh utuh, topeng, spark…) adalah grup yang dia tampilkan atau sembunyikan.

## Nama layer

Tiap wujud adalah layer teratas bernama `form-<nama>`:

| Layer | Wajib | Isinya |
| --- | --- | --- |
| `form-full` | ya | seluruh tubuhnya |
| `form-mask` | ya | topengnya saja |
| `form-face`, `form-shards`, `form-spark`, `form-glitch`, `form-possess`, `form-silhouette` | tidak | wujud lainnya, gambarmu sendiri; kalau tidak ada, dia memakai efeknya |

Di dalam `form-full`, satu grup per bagian, namanya harus persis:

`head` (wajib), `jaw`, `hair_1` … `hair_5` (pangkal ke ujung), `torso` (wajib), `arm_L`, `forearm_L`, `hand_L`, `arm_R` (wajib), `forearm_R`,
`hand_R`, `leg_L`, `leg_R` (wajib). Taruh `forearm_L` di dalam `arm_L` dan `hand_L` di dalam `forearm_L`, supaya bergerak bersama.

## Poros

Untuk tiap bagian, tambahkan lingkaran kecil bernama `pivot-<bagian>` di titik sendinya (`pivot-head` di leher, `pivot-arm_L` di bahu). Dia
mencari sendinya di situ dan menyembunyikan lingkarannya. Tanpa itu, bagian tersebut berputar di sudut gambar.

## Ekspor

File › Export › Export As… › SVG, lalu di opsinya: Styling ***Presentation Attributes*** (CSS di dalam gambar tidak bisa dimuat), Object IDs ***Layer Names***, Decimal 2, Minify mati. Artboard sekitar
240 × 420, kakinya di tepi bawah.

## Cek

```bash
npm run check:blueprint -- lokasi/capri.svg
```

Perintah ini menyebut yang kurang dan nama yang kelihatan salah ketik. Kalau sudah **Ready**, taruh filenya di `assets/capri/blueprint.svg`.

Script dan atribut event dibuang saat dimuat: gambar tidak bisa menjalankan apa pun.
