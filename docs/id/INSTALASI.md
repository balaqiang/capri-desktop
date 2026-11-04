[English](../INSTALL.md) · **Bahasa Indonesia** · [← README](../../README.id.md)

# Instalasi

## Windows, cara mudah

1. Download **`Capri-Setup-x.y.z.exe`** dari [Releases](https://github.com/balaqiang/capri-desktop/releases) lalu
   jalankan. Terpasang hanya untuk akunmu (tanpa hak admin), menambahkan shortcut di Start menu dan Desktop, jalan saat
   Windows menyala, dan langsung menjalankan Capri.
2. Installer-nya belum ditandatangani, jadi SmartScreen mungkin bilang "Windows protected your PC": **More info**, lalu
   **Run anyway**.
3. Capri memperkenalkan dirinya. Untuk ngobrol dengannya, atur otaknya di pengaturan: Ollama di PC-mu (dia bisa memasang
   Ollama dan modelnya untukmu), atau key-mu sendiri.

`Capri-Portable-x.y.z.exe` cukup satu file, tidak ada yang dipasang.

## Update

Versi yang di-install mencari rilis baru di GitHub satu setengah menit setelah dia menyala, lalu setiap enam jam.
**Tanya aku** (bawaan): dia bilang ada versi baru, dan men-download-nya kalau kamu setuju. **Otomatis**: di-download
sendiri, terpasang saat kamu menutupnya. **Mati**: tidak mengecek sama sekali. Pengaturan › Advanced › System › Updates
juga punya **Cek sekarang**. Yang di-download dicek dulu dengan rilisnya sebelum dipasang. Versi portable tidak update
sendiri: download yang baru.

## File .bat (dari source)

- `Capri.bat`: menjalankannya (pertama kali, memasang yang dia butuhkan). Tidak ada terminal yang tetap terbuka.
- `Build.bat`: membuat `dist\Capri-Setup-<versi>.exe` dan `dist\Capri-Portable-<versi>.exe`.
- `Capri-Dev.bat`: log-nya di sebuah jendela, untuk melacak bug.

## Dari source

Butuh [Node.js](https://nodejs.org) 20 atau lebih baru.

```bash
git clone https://github.com/balaqiang/capri-desktop.git
cd capri-desktop
npm install
node node_modules/electron/install.js   # npm 11 melewati install script: ini mengambil Electron-nya
npm start
```

`npm start` menjalankannya terpisah dari terminal (tutup terminalnya, dia tetap jalan); `npm run attached` menampilkan
log-nya di terminal; `npm run dist` membuat installer-nya. macOS dan Linux belum dites: dia mungkin bisa jalan, tapi trik
jendela, perintah, dan Look hanya untuk Windows.

## Sambungkan ke Claude Code, Codex, atau Antigravity

Klik kanan dia › **Install Claude Code hooks** (atau `npm run hooks:install`), lalu restart Claude Code. Hook-nya masuk ke
`~/.claude/settings.json` (backup ditulis dulu; `npm run hooks:uninstall` menghapusnya). Untuk Codex atau Antigravity:
menunya › **Watch**, atau `npm run hooks:codex:install` / `npm run hooks:agy:install`. `npm run demo` memutar sesi
tiruan kalau kamu cuma ingin melihatnya.

## Uninstall

Settings Windows › Apps › Capri › Uninstall. Datanya (pengaturan, riwayat, catatan) tetap ada di `%APPDATA%\capri-desktop`
sampai kamu menghapus folder itu; hook Claude Code-nya dihapus dengan `npm run hooks:uninstall` atau dari menunya.
