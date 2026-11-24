# Open questions for the user

Sessions add questions here instead of blocking. Use one entry per question, newest at the bottom. Say which default you went with, so the user only has to answer when they disagree. The orchestrator gathers these for the user, and moves answered questions into the decision docs.

Format:

```md
## <short title> (<session>, <date>)
<question, with the options>
**Default taken:** <what you did meanwhile, and how to reverse it>
```

---

## The Wii remote mapping (orchestrator, 2026-11-24)
Proposed (Q34): A Següent · B (hold) Suspens · 1 Parlem · 2 Aguanta · − (hold 1.5 s) Enrere · + Claim · D-pad 4 effects · HOME unused · a rumble on every action.

## Any laptop, nothing installed? (orchestrator, 2026-11-24)
Q26, under discussion. Options: A, installed (today); B, nothing installed (the show page from the cloud, the pool cached in the browser, a browser time-stretcher); C, both (B by default, A's local programs for an offline hotspot console). The orchestrator leans towards C.

## Card text size on phones (quina-musical-1e, 2026-11-24)
The player app draws each card as the 3×4 grid of the printed card, with a cover and 2 lines of title per song. On a phone that makes titles about 12–13 px, which is small for the grandmother test.
**Default taken:** the grid stays (cover first, title under it, the 1-song-away banner names the song in large type). Possible change: a "Lletra gran" switch that shows each card as a list.

## This year's printed card (quina-musical-1e, 2026-11-24)
The QR now points to `quina.barrakudesbegur.org/26/<card>`. The card's title and paper colour are configurable in `apps/cards/src/config.ts`.
**Default taken:** last year's title ("QUINA QUINA!") and colour until you choose. No cards are generated until the playlist is final.

## A new subdomain for the cloud, and Access (quina-musical-b2, 2026-11-24)
Access needs path-scoped protection (`/api` for admins, `/ws/show` for the laptop) while the phones' `/feed` stays public. Cloudflare documents Access on workers.dev only for the whole URL. So the cloud needs a hostname in the barrakudesbegur.org zone. Proposed: a NEW `quina-dev.barrakudesbegur.org`, added as a Worker Custom Domain; `quina` and `fitxes` are untouched. The deploy plan lists the Access steps: two self-hosted apps, a service token for the laptop, Google login (probably already set up for coin-reader), and 4 Worker secrets. It also needs the **list of organizer emails** allowed into Admin.
**Default taken:** nothing created. Until the secrets exist, every admin route and the laptop route answer 403 (fail-closed).

## The printed cards are public (quina-musical-b2, 2026-11-24)
The player app needs each card's songs, so `cards.json` (every card's songs) is public: the cloud serves it as a static file, and the laptop's relay serves it on the hotspot. With every card and the public landings, someone determined could work out live which card numbers are close to a Line or a Bingo, the information the console keeps private as "possible winners". Card numbers are anonymous and the next song stays secret, so the impact is low. The alternative is a per-card secret in the QR (for example `/26/123-k7f2`), with the cloud serving only that card. It would make "Afegir cartró" by number much harder, and that fails the grandmother test.
**Default taken:** keep `cards.json` public (the orchestrator agrees). To change: generate the cards with a secret per card before printing, and serve cards one by one.

## Checks only you can do on real devices (quina-musical-1e, 2026-11-24)
The player app is live for testing at https://quina-cloud.barrakudes.workers.dev/26/123. I checked it in desktop Chrome:
- the card link adds card 123;
- the "before the Game" welcome, help and "Esborrar dades" screens show;
- last year's `?c=57` link shows "Aquest cartró és de l'any passat";
- every asset loads.
I can't use real phones or the venue's projector, so these are yours:
1. **An iPhone with Safari, and an Android phone with Chrome.**
   - Scan a test QR for `/26/123` and add a second card with the number pad.
   - Lock and unlock the phone: it should reconnect, and while the screen is on it shouldn't lock by itself (Wake Lock).
   - Sounds should play after the first tap.
2. **An older phone:** is scrolling smooth with 3–4 cards, and does it stay usable at the end of a round?
3. **Last year's offline cache:** this can only be checked once quina.barrakudesbegur.org points to the new cloud. Open the old site on a phone that used it last year, then the new one, and check it shows the new app straight away.
4. **The projector:** open `/show/` on the laptop with the real projector at 4:3, then at 16:9. Check the drum band, the last-3 row and the Check card are readable from the back of the tent.
5. **The console on the actual tablet**, over the phone hotspot: open the relay's printed link (it carries `?t=`), then scan the console's own QR with a phone to pair it as "Mòbil admin".
**Default taken:** none of these block the build. Results go into the rehearsal checklist.

## How fast should a Suspense resolve? (quina-musical-ed, 2026-11-24)
In the new Suspense the playing song loops its 4-bar phrase, and the release lands the next song at the end of a pass (on the outgoing song's phrase boundary), after its exit move. So Next can take up to about 9 s to land. Options: (a) keep it, since a phrase-aligned resolution is part of the drama; (b) land on the next 2-bar boundary, about twice as fast but half a phrase.
**Default taken:** (a). To change it, set SUSPENSE.loopBars to 2, or let the release take a 2-bar boundary in plan/suspense.ts releaseOverLoop.

## Signatures are rarer now (quina-musical-ed, 2026-11-24)
Signatures are now instrumental only (riff, build into the chorus, chorus motif), and only the next song's plays, before the landing. On last year's songs 38 of 77 get an automatic pick, and they play in about 5% of transitions (it was 37% with the vocal calls and shouts). Over the outgoing song a Signature needs agreeing keys and tempos within 4%. Options: (a) keep it; (b) lower the automatic pick's score (0.6) to pick more; (c) pick more by hand on the audition page.
**Default taken:** (a), plus (c) when you review this year's playlist.
