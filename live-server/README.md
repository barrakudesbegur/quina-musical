# Live app for musical bingo

Backend for an app to use during the musical bingo.

Use it here: <https://quina.barrakudesbegur.org>

## Deployment

This api is meant to be ran on your laptop during the event and point the evironment variable `VITE_API_URL` of the client to your local instance. \
I configured a subdomain <https://quina-api.barrakudesbegur.org>, but using the ip is fine too.

Or, you can also host this api anywhere you want.

## Develop

The frontend is in the folder [`/live-server`](/live-server).

### Database

The database are simple `json` files in the folder [`/db/local`](db/local).

### Commands

```zsh
# To develop
npm i
npm run dev

# To build
npm run build
```
