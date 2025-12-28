# Live app for musical bingo

[![Netlify Status](https://api.netlify.com/api/v1/badges/f82f2426-9320-448b-81cb-fbae7bbc44e1/deploy-status)](https://app.netlify.com/sites/quina-musical-barrakudes/deploys)

App to use during the musical bingo.

Use it here: <https://quina.barrakudesbegur.org>

Features:

- 🎶 Displays the curently playing song, history, and round info.
- 📱 Big screen view and mobile view.
- 🌠 Animations.
- ⚡️ Real-time updates.
- 💰 Free deployment.
- 🎯 Admin to pick the next song, undo, manage rounds, etc.
- ⌨️ Media Session API and keyboard shortcuts (Media keys, Arrow keys, Space).
- ⏱️ Admin stopwatch and per-song playback durations derived from play times.
- 🔍 Admin card checker with played/missing songs and winner indicator.
- 📊 Admin insights with a cards-per-song progress chart.
- 🔀 Optional manual song picking.
- 📄 Saves history in a `json` file.
- 🦖 System down screen.
- 🎮 WiiMote support.
- 🎛️ Timestamp editor for configuring song start points.

<https://github.com/user-attachments/assets/eacd44d1-6aec-4d63-bb7c-5e443f72a0bb>

## Deployment

### Frontend

Deployed on **GitHub Pages**.

Build the client and deploy the generated static files:

```zsh
npm run build:client
# Deploy the client/dist folder to GitHub Pages
```

### Backend

Hosted on a **VPS** (own server).

```zsh
cd server
npm run build
npm run start
```

Point the `VITE_API_URL` environment variable in the client to your VPS URL.

### Songs

Audio files are stored in an **S3 bucket**.

## Develop

### Database

The database are simple `json` files in the folder [`/server/db/local`](/server/db/local).

### Commands

You can use `dev`, `build`, and `start`. Used as-is, they run both client and server, but you can also specify with one to run by adding `:client` or `:server`, for example: `npm run build:server`

```zsh
# Always install first
npm i

npm run dev        # Client + Server
npm run dev:client # Client
npm run dev:server # Server

npm run build        # Client + Server
npm run build:client # Client
npm run build:server # Server

npm run start        # Client + Server
npm run start:client # Client
npm run start:server # Server

```

You can rename all songs name to just numbers with:

```sh
for f in *.mp3; do n=$(echo "$f" | grep -o '^[0-9]\+'); mv -- "$f" "$((10#$n)).mp3"; done
```
