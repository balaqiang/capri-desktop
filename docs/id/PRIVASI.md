[English](../PRIVACY.md) · **Bahasa Indonesia** · [← README](../../README.id.md)

# Privasi: apa yang keluar dari PC-mu

## Secara bawaan, hampir tidak ada

Otaknya bisa Ollama di PC-mu, telinganya Whisper di PC-mu, suaranya suara Windows atau Piper. Yang dikirim dengan
sendirinya:

| Apa | Ke mana | Untuk apa | Saklar |
| --- | --- | --- | --- |
| Judul, artis, album, dan durasi lagu yang diputar | [LRCLIB](https://lrclib.net) | liriknya | Behavior › Song lyrics |
| Yang dicari oleh skill atau rencana | Bing, Wikipedia, atau halaman yang kamu minta buka | jawabannya, di profil browser miliknya | Access › Her own browser, Look things up online |
| Judul dan artis lagu yang belum pernah dia dengar | [Deezer](https://developers.deezer.com/api) | kekerasan dan tempo aslinya, untuk penilaiannya | Behavior › Check how a song really sounds |
| Pertanyaan tentang dunia ("siapa presiden indonesia") | Wikipedia, Bing | jawaban hari ini | Access › Look things up online |
| Nama kota | [Open-Meteo](https://open-meteo.com) | cuaca | Access › Look things up online |
| Cek versi baru | GitHub Releases | update | Advanced › Updates › Off |

## Hanya yang kamu nyalakan yang dikirim online

Ke layanan yang kamu pilih, dengan key-mu: pesan chat-mu ke otak cloud; kalimatnya (tidak pernah suaramu) ke suara cloud;
ucapanmu ke Groq atau OpenAI kalau kamu memilihnya untuk telinganya; screenshot jendela di depan hanya saat kamu
memintanya melihat dan mengizinkannya untuk model cloud; catatanmu dan pelajarannya hanya kalau kamu menyalakan "Also
with a cloud model".

## Disimpan di PC-mu

Riwayatmu, catatannya, pelajarannya, yang dia pelajari soal bergerak, penilaiannya tentang lagu, lirik yang diambil,
catatan apa yang sudah dia lakukan (yang dia ketik: berapa banyak dan di mana, bukan isinya), plugin-mu, key-mu
(dienkripsi dengan akun Windows-mu). Yang dia ingat dari obrolan lamamu dicari di PC ini. Screenshot yang dia lihat
tidak pernah disimpan.

## AI coding-mu

Hook Claude Code, Codex, dan Antigravity-nya hanya mengirim yang dibutuhkan tampilannya (nama tool, path file, perintah,
pesan terakhir asisten) ke `127.0.0.1`, tidak pernah isi file-mu.

## Yang dia ubah di sistemmu

Hook-nya (kalau kamu pasang), entri startup, shortcut. Dia di-uninstall seperti aplikasi biasa.
