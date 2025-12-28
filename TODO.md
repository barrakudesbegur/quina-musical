# To Do list

- [ ] Al pausar, media session es treu.
- [x] Canvi de volum no es suau
- [ ] Millorar UI usuaris:
  - [ ] Treure QR i link (ja esta a la taula)
  - [ ] Posar imatges album a versio mobil
  - [ ] Animacio next/prev canco al historial no va be al mobil
- [ ] Asegurarse de que el playback va be amb l'internet lent!!!
- [x] Ajustar volum individual dels fx. Crec que algunes cancons sonen molt mes fluix i estaria be pujarla
- [ ] Fer FX sirena
- [x] Mando Wii - HOME no funciona
- [x] Crossfade entre cancons
- [ ] Animacio quina guanyada (confeti)
- [x] Bug: quan esta pausat, i intenres canviar el current time amb la barra de temps, no va be

## Idees post quina 2025

- Tablet al terra pels presentadors: n cancons, hora fi, nom canco. quan guanya, cartro guanyador
- un termometre al projector, en funcio de les cancons que queden i/o n cancons amb casitotes
- Que els presentadors puguin canviar de quina facilment
- els cartrons no fer-los de cartolina, no cal
- fer els cartons per davant i per darrere. Així tenim més cançons
- al cartró posar especial o normal
- la gent no sabia que es podien posar múltiples cartrons en 1 mòbil. Potser posar un popup diguent que introdueixis els números de cartrons al obrir
- poder posar quin cartró té línea.
- al passar de ronda, emplenat el camp de guanyador amb el número guanyador si només hi ha 1.
- Hi havia un bug que no es posava bé el número de la següent ronda. Fer que a la pantalla de configuració puguis dir quines rondes hi haurà, així només han de fer next. Donar la opció de fer una custom.
- fer una pantalla específica de quan no ha començat la roda. Amb el mando de la Wii era rato fer sonar la primera cançó, pk no hi havia play posat
- fer que no puguis passar de canço si no ha sonat 3s minim
- pensar alguna forma de que quedi demostrat que no hi ha tongo
- Tenir preparada la musica de ascensor entre quines. per exemple:  <https://www.youtube.com/watch?v=lx0aJYhMdc4>
- Trackejar els cartrons en us en funcio de la gent conectada i el seu Watching card.
- Normalitzar millor els volums, podria ser automatic. i tb els dels FX.
- No cal fer el paripe de llegir els noms de les cançons
- Com que fer una imatge amb els premis es dificil, fer-ho amb text. Utilitzar un csv i fer un excel al drive, aixi ells ho poden emplenar i imprimir, i jo utilitzar.

## Note on my phone (TODO: clean this up)

Idees app:

- ✅App té els mp3 i reprodueix un timestamp aleatori (dels definits anteriorment) de la següent canço.
- ✅intentar generar trancisions.
- ✅ gràfic de barres en directe X: cançons marcades, Y: Nº cartrons
- ✅Mostrar imatge premis entre quines. i al mobil, poder veure totes les imatges si la persona vol
- ✅Posar un comprovador de cartro. ❌idealment fer una animacio.
- ✅Posar una pantalla de pad amb efectes de so. portar un ipad i reproduirlos. ❌O fer servir la app de voicemod en remot
- ✅Poder conectar un mando de la wii per canviar de cançó i fer sons/pausa/volum <https://github.com/natel97/wiimote-chrome> o sino joycon switch
- ✅posar cronometro desde que inicia la ronda. mostrar quants segons hem deixat cada canço. a la caqnco actual mostrar quant porta sonant. ❌posar una estimacio de a quina hora acavarem la quina segons les ultimes 5 cançons
- ✅show prev song also
- ✅mostrar quantes cançons queden perquè 1 cartró tingui quina, ❌i 2 i 3. Tb fer-ho amb els cartrons no en joc
- ✅posar el QR a cada cartró. (Personalitzat amb el cardId.) Guardarlo a playing cards.
- ✅a la UI de user, posar el card id. I marcar les cançons que té. Si te més de un card id, casa un es un icono de color diferent o emoji
- ✅ordenar ids de les cançons alfabèticament
- ✅posar estimació de a quina h acaba la ronda en funció de les últims 5 cançons.
- ✅fer que els ids siguin en ordre alfabètic i treure el order by Id (Bueno, realment es fa order by Id pero El label es "Alfabèticament"
- ✅als grafics, posar un selector de linea
- ✅pujar volum fx individuals
- TIMESTAMPS!
- ✅Service worker per fer una cache de audios I que carregui instantáneament

Preparar:

- Cable USB-C a Jack, per posar la música desde el Mac.
- tenir un plan B, per si falla. (Generar una playlist per quina. Així sabem l'ordre)
- definir timestamps
- imatges premis
- imprimir cartrons i envolicarlos de 50 en 50
- retallar cancons
- comprar blat de moro

Idees generals:

- els cartrons són fàcils de solapar

To Do app:

- estabilitat dels sse
- ✅deployment ben fet
- definir timestamp cancons
- efectes so pro (hold drumb + indefinite horn)
- ✅mando wii
- imatge premis entre quina i quina.
- imatges: portada, preus cartrons, preus barra
- treure QR i URL de la homescreen (ja están a la taula imprimits)
- preparar full amb molts QRs
- refactor del Hook de Reproduir musica

Sons:

- drumb roll + heartbeat (loop)
- TaDaa + Wow (cute)
- Wrong (buzzer) + fail (sad trumpet)
- air horn (loop)

Altres sons

- Ostia
- angels singing
- crickets
- sad violin
- wah wah wah
- rising
- cash register

Trnansitions:

- crossfade
- echo out

## From 2024

Improvement for the next version

### Live

- Create a "Clear database" button that saves de json in a folder and clears the one used as db.
- Make a nice-looking screen for when a round doesn't have any sing yet.
- Update in real time the Admin too.
- Make the the app reproduce the songs, so there's no delay/mistakes.
- Song shuffling: Pseudo-random. This ensures that the shuffling is actually random while making people happy. Modify the algorithm so it counts how many times a song has been played, and the max played song vs the min played song difference is always 1 or 2. Consider that songs that come after the round has finished shouldn't count. So the shuffling can't be known in advance. Well, think this more and ensure that it is fair and everyone has the same chances of winning.
- Playing next queue. In admin, show the next playing songs, and enable moving or "re-shufling".
- Maybe improve the animation of the song. The full list can be just in the phone, and the big screen just show the last 3 or 5.
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
- Prevent screen locking.

### Card generator

- Print the cards so when they are cut, they end up in order. Consider the different colors, create multiple files, one per color. And the eaxh color defines the thousands digit (red is 1000-1999, blue 2000-2999, etc)
- Add the QR to the card.
- The cards could be smaller if we want. (4 for page)
- There was 1 round what 2 people had bingo at the same time! it should not be possible.
- Make a test suit for the generation to ensure no mistakes, as this is very important.
