[English](README.md) · **Bahasa Indonesia**

# Capri

**Capri**, konstruk *Project Capricorn* dari Cyberpunk: Edgerunners 2, tinggal di desktop Windows-mu. Dia ngobrol
denganmu, diketik atau diucapkan, dan menjawab dengan suaranya sendiri. Dia menjalankan perintah di PC-mu, menulis dan
mengetik untukmu, membantu PR-mu, ikut mendengarkan musikmu, dan mengawasi AI coding-mu. Dan dia punya hidup sendiri:
berjalan, duduk di atas jendela, teleport, meng-glitch layar, bisa dielus dan dilempar.

![Capri memberi tahu Claude sudah selesai](docs/img/done.png)

> Recode oleh [balaqiang](https://github.com/balaqiang) dari [**capri-desktop** karya mochiiwuff](https://github.com/mochiiwuff/capri-desktop)
> (v0.4.4), digabung dengan **Capri Desktop 2.4** (C#), yang berawal dari
> [**capri-desktop** karya lachydotmcg](https://github.com/lachydotmcg/capri-desktop). Lihat [Kredit](#kredit).

**[Download untuk Windows](https://github.com/balaqiang/capri-desktop/releases/latest)** ·
[Fitur](docs/id/FITUR.md) · [Perintah](docs/id/PERINTAH.md) · [Pengaturan](docs/id/PENGATURAN.md) ·
[Plugin](docs/id/PLUGIN.md) · [Instalasi](docs/id/INSTALASI.md) · [Privasi](docs/id/PRIVASI.md) · [FAQ](docs/id/FAQ.md)

---

## Yang dia lakukan

| | |
| --- | --- |
| **Ngobrol denganmu** | Sesuai karakternya, campuran Indonesia-Inggris, diketik atau diucapkan. Otaknya di PC-mu (Ollama) atau online (Gemini, Groq, OpenAI, Anthropic, Claude Code…). Dia mencari pertanyaan di web dulu, mengingat yang kamu ceritakan, ingat obrolan berminggu-minggu lalu, dan memperbaiki dirinya dari reaksimu. [Selengkapnya](docs/id/FITUR.md#ngobrol-dengannya) |
| **Mendengar dan bicara** | Whisper di PC-mu, Groq, OpenAI, atau Windows untuk telinganya; ElevenLabs, OpenAI, server TTS-mu, Piper, atau Windows untuk suaranya, dengan efek dan gerak bibir. [Selengkapnya](docs/id/FITUR.md#suara-dan-telinganya) |
| **Menjalankan perintah di PC-mu** | Membuka aplikasi, folder, dan situs, mencari file, mengatur musikmu dan memutar lagu di Spotify, timer, alarm, timer belajar, cuaca, rangkuman harimu. [Selengkapnya](docs/id/FITUR.md#perintah-di-pc-mu) |
| **Mengetik dan menulis untukmu** | Mengetik di aplikasi apa pun, beberapa perintah sekaligus, membuat draft email dan pesan untuk kamu cek dulu, menulis kode langsung di editormu. Tidak pernah di kotak password; tombol yang kamu tekan menghentikannya. [Selengkapnya](docs/id/FITUR.md#mengetik-dan-menulis-untukmu) |
| **Membantu PR** | Membaca soal di layarmu dan menjawabnya beserta caranya, hitungannya dikerjakan kalkulatornya. [Selengkapnya](docs/id/FITUR.md#pr-dan-matematika) |
| **Plugin tanpa coding** | Saat sesuatu terjadi (sebuah frasa, jam, aplikasi, lagu…), dia menjalankan langkah-langkahmu. Ada yang siap pakai, dan bisa dibagikan sebagai file. [Selengkapnya](docs/id/PLUGIN.md) |
| **Ikut mendengarkan musikmu** | Lirik di atas kepalanya saat dinyanyikan, kepalanya ikut bergoyang, joget di lagu yang dia suka. [Selengkapnya](docs/id/FITUR.md#dia-ikut-mendengarkan-musikmu) |
| **Hidup di desktopmu** | Berjalan, duduk di jendela, teleport, merasuki jendela, meng-glitch layar, cemburu pada AI lain. Fisika rambut, meraih pointer-mu, dielus, dipegang, dilempar. [Selengkapnya](docs/id/FITUR.md#hidupnya-di-desktop) |
| **Mengawasi AI coding-mu** | Claude Code, Codex, atau Antigravity: apa yang dikerjakan, kapan butuh kamu, kapan selesai. [Selengkapnya](docs/id/FITUR.md#dia-mengawasi-ai-coding-mu) |

<table>
  <tr>
    <td width="50%"><img src="docs/img/homework.png" alt="PR di layar, dan jawabannya"></td>
    <td width="50%"><img src="docs/img/draft.png" alt="Draft-nya, dengan Ketik, Salin, dan Ulangi"></td>
  </tr>
  <tr>
    <td align="center"><b>PR</b>: dibaca dari layarmu, dijawab, hitungan oleh kalkulatornya</td>
    <td align="center"><b>Menulis untukmu</b>: draft dulu, diketik kalau kamu setuju</td>
  </tr>
  <tr>
    <td><img src="docs/img/hair.png" alt="Rambutnya diam, diseret, dilepas"></td>
    <td><img src="docs/img/settings-plugins.png" alt="Pengaturannya: Plugins"></td>
  </tr>
  <tr>
    <td align="center"><b>Fisika rambut</b>: rambutnya tertinggal lalu berayun kembali</td>
    <td align="center"><b>Plugin</b>: saat ini terjadi, dia melakukan itu</td>
  </tr>
</table>

![Teleport, frame demi frame](docs/img/teleport.png)

## Mulai cepat

1. Download **`Capri-Setup-x.y.z.exe`** dari [Releases](https://github.com/balaqiang/capri-desktop/releases/latest) lalu
   jalankan (belum ditandatangani: SmartScreen › **More info** › **Run anyway**). Versi portable tidak perlu install.
2. Dia memperkenalkan dirinya. Atur otaknya di pengaturan: **Ollama** di PC-mu (dia memasangnya untukmu), atau key-mu
   sendiri.
3. Ngobrol dengannya: **Ctrl+Alt+T** untuk chat, **Ctrl+Alt+V** untuk bicara. Coba:
   - "buka notepad lalu ketik halo" · "buka spotify terus putar musik"
   - "tuliskan surat izin di notepad" · "buatkan pesan ulang tahun untuk ibuku"
   - "buatkan kode html sederhana di sini" · "kerjakan soal di layar saya"
   - "cuaca hari ini" · "rangkuman hari ini" · "kalau aku bilang mode santai, putar musik lalu ke kiri"

Selengkapnya di [Instalasi](docs/id/INSTALASI.md) (dari source, menyambungkan ke Claude Code, update) dan
[Perintah](docs/id/PERINTAH.md).

## Dokumentasi

| | Bahasa Indonesia | English |
| --- | --- | --- |
| Semua yang dia lakukan | [Fitur](docs/id/FITUR.md) | [Features](docs/FEATURES.md) |
| Yang bisa kamu katakan | [Perintah](docs/id/PERINTAH.md) | [Commands](docs/COMMANDS.md) |
| Setiap pengaturan, dan hotkey | [Pengaturan](docs/id/PENGATURAN.md) | [Settings](docs/SETTINGS.md) |
| Membuat plugin | [Plugin](docs/id/PLUGIN.md) | [Plugins](docs/PLUGINS.md) |
| Instalasi, update, hook | [Instalasi](docs/id/INSTALASI.md) | [Install](docs/INSTALL.md) |
| Apa yang keluar dari PC-mu | [Privasi](docs/id/PRIVASI.md) | [Privacy](docs/PRIVACY.md) |
| Kalau ada yang aneh | [FAQ](docs/id/FAQ.md) | [FAQ](docs/FAQ.md) |
| Struktur kode, tes, rilis | | [Development](docs/DEVELOPMENT.md) |
| Rencana berikutnya | [Roadmap](ROADMAP.md) | |

## Privasi, singkatnya

Secara bawaan hampir tidak ada yang keluar dari PC-mu: otak, telinga, dan suaranya semua bisa jalan di PC-mu. Dengan
sendirinya dia hanya mengirim judul lagu ke LRCLIB (liriknya), pertanyaan tentang dunia ke Wikipedia dan Bing, nama kota
ke Open-Meteo (cuaca), dan mengecek update di GitHub, masing-masing dengan saklarnya. Semua yang dia simpan tetap di
PC-mu; screenshot yang dia lihat tidak pernah disimpan. [Selengkapnya](docs/id/PRIVASI.md).

## Kredit

Proyek ini berdiri di atas karya orang lain. Semua kredit untuk karya aslinya milik mereka.

| Siapa | Apa |
| --- | --- |
| [**balaqiang**](https://github.com/balaqiang) | Recode ini: penggabungan dengan Capri Desktop 2.4, dan semua yang ada di [Fitur](docs/id/FITUR.md) yang sebelumnya belum ada |
| [**mochiiwuff**](https://github.com/mochiiwuff) · [capri-desktop](https://github.com/mochiiwuff/capri-desktop) | Karya asli yang menjadi dasar proyek ini (v0.4.4, JavaScript/Electron): rig dan shader-nya, animasi dan aktingnya, teleport, satelit, narasi Claude Code / Codex / Antigravity, pemandu, chat, wajah, dan cut-in |
| Kontributor Capri Desktop | Kode capri-desktop sampai 0.4.3, di bawah lisensi MIT |
| Capri Desktop 2.4 (C#) | Fitur-fitur yang digabung di sini, art-nya (`assets/art`), terjemahannya (`assets/lang`), dan persona klasiknya; berawal dari versi 0.2.0 karya lachydotmcg |
| [**lachydotmcg**](https://github.com/lachydotmcg) · [capri-desktop](https://github.com/lachydotmcg/capri-desktop) | Capri pertama di desktop (C#), dengan kontribusi dari [tuno473](https://github.com/tuno473), [tob7as](https://github.com/tob7as), dan [super-cr4SH](https://github.com/super-cr4SH); terinspirasi video TikTok jpartnma_ |
| [LRCLIB](https://lrclib.net) · [Open-Meteo](https://open-meteo.com) | Perpustakaan lirik ber-timing yang gratis dan terbuka; API cuaca gratis |
| Font | Chakra Petch dan JetBrains Mono, SIL Open Font License, lewat Fontsource |

Capri / Project Capricorn, Cyberpunk, dan Cyberpunk: Edgerunners milik CD PROJEKT RED, Studio Trigger, dan Netflix.
Ini proyek fan tidak resmi dan non-komersial tanpa afiliasi. Gambar karakter (`assets/capri/`, `assets/art/`,
`docs/img/`) berasal dari frame anime, potongan gambar buatan fan, dan fan art; semuanya **tidak** termasuk lisensi kode.
Kalau pemegang hak ingin gambar-gambar itu dihapus, buka issue.

## Lisensi

**Gratis, tidak pernah dijual.** Lihat [LICENSE](LICENSE).

- Kode asli karya mochiiwuff berlisensi [PolyForm Noncommercial License 1.0.0](LICENSES/capri-desktop.md) (versi
  sampai 0.4.3 berlisensi MIT).
- Perubahan dan tambahan dari balaqiang berlisensi MIT.
- Karena proyek ini berisi kode aslinya, keseluruhannya hanya boleh dipakai, diubah, dan dibagikan secara gratis:
  menjual Capri, atau apa pun yang dibuat dari kodenya (key, langganan, akses berbayar, pesanan berbayar), tidak
  diperbolehkan.
