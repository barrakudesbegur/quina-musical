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
