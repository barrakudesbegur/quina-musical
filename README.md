# Live app for musical bingo

[![Netlify Status](https://api.netlify.com/api/v1/badges/f82f2426-9320-448b-81cb-fbae7bbc44e1/deploy-status)](https://app.netlify.com/sites/quina-musical-barrakudes/deploys)

App to use during the musical bingo.

Use it here: <https://quina.barrakudesbegur.org>

Features:

- 🎶 Displays the curently playing song.
- ⏳ Displays the played songs history.
- 📱 Big screen view and mobile view.
- ⚡️ Real-time updates.

## Deployment

### Frontend

Automatically in [Netlify](https://app.netlify.com/sites/quina-musical-barrakudes/deploys), for free.

### Backend

This api is meant to be ran (for free) on your laptop during the event and point the evironment variable `VITE_API_URL` of the client to your local instance. \
I configured a subdomain <https://quina-api.barrakudesbegur.org>, but using the ip is fine too.

Or, you can also host this api anywhere you want.

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
