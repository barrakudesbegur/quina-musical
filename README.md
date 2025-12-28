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

## Roadmap

### To do for next version

- [Tablet] Tablet al terra/ma/tripodeLlibres pels presentadors: n cancons, hora fi, nom canco. quan guanya, cartro guanyador
- [Tablet] Que els presentadors puguin canviar de quina facilment. i posar guanyadors linea/quina.
- [Admin] Afegir un botó per netejar la caché de cançons (service worker); no fer-ho automàticament amb startedAt.
- [Admin] Fer que puguis dir quines rondes hi haurà, així només han de fer next. Donar la opció de fer una custom.
- [Presentador] Cooldown al clicar next amb el mando de la Wii de 3s.
- [Presentador] Posar quin cartró guanya línea.
- [Presentador] Canviar automaticament a quina el grafic quan es fa la linea.
- [Presentador] al passar de ronda, emplenat el camp de guanyador amb el número guanyador si només hi ha 1.
- [Presentador] Al canviar de ronda fer servir la info de rondes del admin.
- [Presentador] Fer una pantalla específica de quan no ha començat la roda. Amb el mando de la Wii era raro fer sonar la primera cançó, pk no hi havia play posat. Fer que amb el boto A tb faci play si es la primera canco
- [Projector] Treure el QR i la URL.
- [Projector] UI per quan s'esta entre rondes.
- [Mobile] (BUG) L'animació de moure noms de cançons a l'historial no funciona.
- [Mobile] Millorar la discoverabilitat per posar diversos identificadors de cartró al mateix mòbil. Potser posar un popup diguent que introdueixis els números de cartrons al obrir
- [Mobil] Com que fer una imatge amb els premis es dificil, fer-ho amb text. Utilitzar un csv i fer un excel al drive, aixi ells ho poden emplenar i imprimir, i jo utilitzar. Aixo esta relacionat amb les rondes preconfigurades.
- [Descarregador] Posar les IDs en ordre alfabètic, o avisar si la playlist no està ordenada alfabèticament.
- [Cartrons] No cal que siguin de cartolina.
- [Cartrons] Indicar quins son especials i normals, no nomes amb el color.

### Ideas

- [Mobil] Posar imatges album
- [Projector] Quan un cartró guanya, fer una animacio on apareix el cartro i es van marcant (i sonant?) les cancons que han sonat. Tb posar confeti? Evolucionar el popup de comprovar cartro a aixo.
- [Projector] Potser no cal mostrar tantes cancons, nomes amb les 3 ultimes ja esta be
- [Presentador] Poder posar filtres amb IA a les veus del microfon (voicemod).
- [Presentador] Tenir preparada la musica de ascensor entre quines. per exemple:  <https://www.youtube.com/watch?v=lx0aJYhMdc4>
- [Presentador] Song shuffling: Pseudo-random. This ensures that the shuffling is actually random while making people happy. Modify the algorithm so it counts how many times a song has been played, and the max played song vs the min played song difference is always 1 or 2. Consider that songs that come after the round has finished shouldn't count. So the shuffling can't be known in advance. Well, think this more and ensure that it is fair and everyone has the same chances of winning. Inclus podem escollir el cartro guanyador i decidir les cancons que sonaran artificialment, per fer la quina mes llarga o mes lenta.
- [Cartrons] Ferlos a doble cara i tenir multiples playlists?
- [Projector] un termometre que mostri el nº de cancons que queden i/o nº de cartrons amb casitotes
- [General] pensar alguna forma de que quedi demostrat que no hi ha tongo
- [General] No cal fer el paripe de llegir els noms de les cançons. podria projectar el cartro guanyador al projector.
- [Admin] Trackejar els cartrons en us en funcio de la gent conectada i el seu Watching card.
- [Admin] Normalitzar millor els volums, podria ser automatic. i tb els dels FX.
- [Admin] imprive admin password security? and endpoints
- [Cartrons] Make a test suit for the generation to ensure no mistakes, as this is very important.
- [Cartrons] Fer que les ids tinguin una llatra devant si son especials aixi no son a partir del 400 i pico
- [General] Fer rondes especials, per exemple una de remixes.
