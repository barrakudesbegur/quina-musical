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
- 📄 Saves history in a `json` file.
- 🦖 System down screen.

<https://github.com/user-attachments/assets/eacd44d1-6aec-4d63-bb7c-5e443f72a0bb>

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

## Roadmap

Improvement for the next version

### Live

- Don't create a new file for every server restart, because when it fails, we loose the progress. Instead create a "Clear database" button that saves de json in a folder and clears the one used as db.
- Make a nice-looking screen for when a round doesn't have any sing yet.
- Update in real time the Admin too.
- Make the the app reproduce the songs, so there's no delay/mistakes. 
- Song shuffling: Pseudo-random. This ensures that the shuffling is actually random while making people happy. Modify the algorithm so it counts how many times a song has been played, and the max played song vs the min played song difference is always 1 or 2. Consider that songs that come after the round has finished shouldn't count. So the shuffling can't be known in advance. Well, think this more and ensure that it is fair and everyone has the same chances of winning.
- Playing next queue. In admin, show the next playing songs, and enable moving or "re-shufling".
- Maybe improve the animation of the song. The full list can be just in the phone, and the big screen just show the last 3 or 5.
- Ensure that 300 people can be connected at the same time. There was a limit of 10 people for SSE...
- Ensure it works on mobile hotspot or find another way of hosting it. Using a server should be better I think.
- Enable Card checking for Line and Quina by providing the card number. This is for admin, and it tells the songs the card has, with a check or cross to the played ones.
- Save time to organizers by automatically downloading the songs from YT or by playing them in Spotify. on the actual timestamp.
- [idea] a round where we play remixes of the song instead of the actual one. or maybe do it in more rounds so there's variety.
- it takes 60-63 songs to get a quina. Play the first ones normal, then move to fast, and getting closer to the end slower.
- Add a pause button, that keeps playing the song in loop at lower volume. this is for when someone has Quina to not stop playing music. Or maybe play a special "pause" song, like the ones in elevators.
- Enable the app to be controlled with a remote by the showman.
- The laptop presenting has 2 screens, the big one, and a showman one. in the showman one we show the current/next/prev song, the count, the auto-play switch, the card-cheking feature (by card numer, and show all songs), etc.
- Auto-play has a toggle, so we can do it manually too.
- when te music is paused, it brings automatically the card checking ui.
- imprive admin password security? haha
- Provide a 100% manual alternative in case there is a problem.
- Find a way that the system outputs the songs, as they are played somewhere. In case of a problem, to be able to resume the game manually.

### Card generator
- Print the cards so when they are cut, they end up in order. Consider the different colors, create multiple files, one per color. And the eaxh color defines the thousands digit (red is 1000-1999, blue 2000-2999, etc)
- Add the QR to the card.
- The cards could be smaller if we want. (4 for page)
- There was 1 round what 2 people had bingo at the same time! it should not be possible.
- Make a test suit for the generation to ensure no mistakes, as this is very important.
