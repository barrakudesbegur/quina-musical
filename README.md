# Live app for musical bingo

[![Netlify Status](https://api.netlify.com/api/v1/badges/f82f2426-9320-448b-81cb-fbae7bbc44e1/deploy-status)](https://app.netlify.com/sites/quina-musical-barrakudes/deploys)

App to use during the musical bingo.

Use it here: <https://quina.barrakudesbegur.org>

Features:

- 🎶 Displays the curently playing song.
- ⏳ Displays the played songs history.
- 📱 Big screen view and mobile view.
- ⚡️ Real-time updates.

https://github.com/user-attachments/assets/eacd44d1-6aec-4d63-bb7c-5e443f72a0bb

## Deployment

### Frontend

Use any service you want, it's a regular React client app, that generates static files.

I use [Netlify](https://app.netlify.com/sites/quina-musical-barrakudes/deploys), which is free and easy to setup.

### Backend

#### Cloudflare Tunnel (cloudflared)

This api is meant to be ran (for free) on your laptop during the event and point the evironment variable `VITE_API_URL` of the client to your local instance. \
I configured a subdomain <https://quina-api.barrakudesbegur.org>, but using the ip is fine too.

```zsh
cd server

# Install Cloudflare Tunnel Client (cloudflared)
# This is for macOS, it may be different for your OS
brew install cloudflared

# Follow the login steps
cloudflared tunnel login

# Create a Cloudflare Tunnel
cloudflared tunnel create --credentials-file ./cloudflared/credentials.json quina-api

# Add the DNS records to configure a subdomain
cloudflared tunnel route dns quina-api quina-api.barrakudesbegur.org
```

To run it, use this command:

```zsh
cd server
npm run build
npm run production
```

#### Self hosting

You can also host this api anywhere you want.

```zsh
cd server
npm run build
npm run start
```

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
