# Push notifications for the player app?

A study commissioned by the orchestrator on 2026-11-27, at the user's question: "how could we use push notifications, and would it be worth it?". It's a dated record: any decision goes in [decision-log.md](../../decision-log.md). Sources were read on 2026-11-27; platform facts can change.

## Verdict: pass for 2026

Push adds little on this night and costs a lot for who it reaches.

- **Everyone it could reach is already in the tent,** with the app open and its screen kept awake, the projector, the presenters and the automatic voices (D198, D202). The QR is on the card, and cards are sold at the door, so nobody has the app before they arrive.
- **About a quarter of the phones can't get it easily.** In Spain about 27% of mobile traffic is iOS (StatCounter, October 2026). On an iPhone, push works only after the player adds the page to the Home Screen, and that Home Screen app starts with empty storage, so their cards would have to be added again.
- **Few would say yes.** Realistically 20–40% of Android players who are asked, and almost no iPhone users. Many players are older and distrust computers; a browser asking to "send notifications" is exactly what notification-spam scams look like.
- **Effort:** about 3–5 days across Backend and Frontend, plus testing on real phones, for a feature that mostly repeats what the voice cues already say.

What we already have does the job better: the Admin banner to every phone, the voice lines in the Descans ("Tornem en dos minuts", turn the card over), the projector, and the app's own end screen.

If the user wants it anyway, the smallest useful version is Android-first, opt-in from a switch the player taps, with at most two messages a night (see "A minimal version").

## Use cases, ranked

Ranked by value on this night. "Better with" names what we already have.

| # | Use case | Value | Better with |
|---|---|---|---|
| 1 | **"El Descans s'acaba en 2 minuts"**, for players outside the tent (smoking, toilets, car) | Low–medium | The voice line at 2 minutes (D202) reaches everyone inside, the bar included. Push only adds the few outside, and only if they opted in. |
| 2 | **A prize reminder** to a confirmed winner who hasn't collected yet | Unknown: only if prizes go uncollected | The presenters' closing words and the paper process. Needs a "collected" mark in Admin's winners list. Ask the user whether this ever happens. |
| 3 | **A thank-you the next morning,** maybe with a feedback link, then all subscriptions deleted | Low | The app's end screen, shown to anyone who opens it. |
| 4 | **"Comença la Quina 6: gireu el cartró"** | Low | The Descans voice line, the projector, and the phone showing the right side by itself (D102, U50). |
| 5 | **The doors countdown** | Very low | The doors voice-overs (D202). Players only get the app after buying a card, inside. |
| 6 | **A relative's card won** (the phone holds Àvia's card, but you're not looking) | Very low | The in-app Celebration. People who follow a relative's card are sitting with them. |

**Never pushed,** because of the game's rules or because it would annoy:
- each landing or "Ara sona" (about 500 a night);
- "one song away" or anything about how close a card or a round is to its end;
- a win before the presenters confirm it, or any win on a phone that doesn't hold that card (D32);
- a prize before its round's intro;
- anything about next year: it means keeping subscriptions for a year, against "each edition starts clean", and both Chrome and Safari drop stale ones anyway.

**Rule safety:** a push must only carry what the public feed already carries (operations.md › The public feed's privacy). Every message is a fixed, reviewed template, sent from a schedule event or a confirmed win, never from the Queue or the standing cards.

## The platforms in late 2026

| Platform | Push without installing? | Notes |
|---|---|---|
| **Android, Chrome** | **Yes,** from a normal tab | Needs a service worker and the user's Allow. Chrome 155 (beta in September 2026, so stable by about October) shows a lighter, non-blocking prompt that times out; a timed-out request returns `'default'`, and the user can subscribe later from Site Controls ([Chrome, 22 Jul 2026](https://developer.chrome.com/blog/notification-prompts-android)). Chrome revokes the permission of rarely-visited sites that send many notifications, except installed apps ([Chromium blog, Oct 2025](https://blog.chromium.org/2025/10/automatic-notification-permission.html)). Rate limits hit only disruptive sites ([Chrome, 6 Jan 2026](https://developer.chrome.com/blog/web-push-rate-limits)). |
| **iPhone, Safari** | **No,** only for a Home Screen web app (since iOS 16.4) | Since iOS 26, any page added to the Home Screen opens as a web app, manifest or not ([WebKit, Safari 26.0, 15 Sep 2025](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)). Declarative Web Push since iOS 18.4: the push carries the notification itself, no service worker needed ([WebKit, 27 Mar 2025](https://webkit.org/blog/16535/meet-declarative-web-push/)). Permission must follow a tap inside the Home Screen app. A push that shows nothing loses the permission. Safari 27 (Sep 2026) added nothing for push or Home Screen apps, as far as the secondary sources say ([WebKit, WWDC26](https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/)). |
| **iPhone storage** | | A Home Screen web app doesn't share localStorage or IndexedDB with Safari; only cookies are copied once, at install ([OpenPWA, Oct 2026](https://openpwa.net/reference/storage/home-screen-storage-isolation/), citing WebKit). So our saved cards would be missing there. To test: whether the added icon opens the card's own URL (then the card comes along) or the manifest's start URL. |
| **Desktop** (Chrome, Edge, Firefox, Safari on macOS) | Yes, from a tab | Not relevant on this night. |
| **Android TWA** (a Play Store app wrapping the site) | Needs an install from the Play Store | Notifications come from the app, not Chrome ("notification delegation"), and Android 13+ asks its own permission. It breaks "nothing to install", needs a Play developer account and review. Pass. |
| **iOS App Clip** | Opens from the QR without installing | The only way to reach an iPhone without the Home Screen: "ephemeral" notifications for 8 hours after launch, with no prompt, just a switch on the App Clip card ([Apple docs](https://developer.apple.com/documentation/appclip/enabling-notifications-in-app-clips); details confirmed by secondary sources such as [OneSignal, Jan 2026](https://documentation.onesignal.com/docs/en/app-clip-support)). But it's a native Swift app with a parent app in the App Store, the paid Apple Developer Program, App Review and associated domains on the QR's domain, and scanning the QR would open the App Clip card instead of Safari. Far too much for one night. Pass. |

Sources on opt-in rates: Chrome telemetry, notifications granted on about 23% of Android prompts and 12% on desktop ([Bilogrevic et al., USENIX Security 2021](https://www.usenix.org/conference/usenixsecurity21/presentation/bilogrevic)); about 30% after a user interaction instead of on page load ([web.dev, permissions best practices](https://web.dev/articles/permissions-best-practices)). Vendors claim 8–18% averages and 35%+ right after a meaningful action; unverified. Market share: [StatCounter, Spain mobile](https://gs.statcounter.com/os-market-share/mobile/spain).

## The permission prompt

- **Never on load,** and never stacked with D200's "add another?" banner. The browser's prompt only after the player taps something that asks for it ([web.dev](https://web.dev/articles/permissions-best-practices)). Firefox and Safari refuse a request without a tap; Chrome is moving that way.
- **The best moment is a switch the player chooses,** in context: a row in the Horari drawer, "Avisa'm quan s'acabi el Descans", with one plain line on what we'll send (at most two messages) and that nothing is kept after the night. The switch is the explanation, so no surprise prompt appears.
- **On an iPhone in Safari,** the switch can't work: it would have to explain "add to Home Screen, then add your cards again". For older players that's too much, so the switch would simply not show there.
- **Realistic numbers:** we have no count of 2025's phones (night-2025-data.md). If about 100–150 phones open the app, about 70% are Android, and 20–40% of those say yes, that's about **15–40 subscribed phones** out of ~300 people. This is an estimate, not data.
- **If most say no,** nothing breaks: the voices, the projector and the open app carry every message. A "Block" on Chrome is permanent for that site on that phone, which is harmless here. Code must treat `'default'` (Chrome 155's timed-out prompt) as "not now", not as an error.

## A minimal version (if the user wants it)

1. **Keys:** a VAPID key pair (P-256), the private key as a Worker secret (`wrangler secret put`), the public key in the player's config. VAPID's `sub` must be a contact: use a generic address, never a person's.
2. **Client:** the player app needs a service worker (it's becoming a PWA anyway) with `push` and `notificationclick` handlers. It subscribes with `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` and posts the subscription and its card numbers to the cloud. It listens to `navigator.permissions.query({ name: 'notifications' })` changes for Chrome 155's later subscribe. When the app is visible, the service worker skips the notification, since the app already shows it.
3. **Storage:** a `push_subscriptions` table in the Game's Durable Object (SQLite), keyed by endpoint, with the edition and card numbers. It's excluded from the JSON export and from Admin, and never in git. The endpoint is an opaque URL, but it ties a phone to its cards, so it's treated as personal data.
4. **Sending:** the Worker sends Web Push itself with Web Crypto; no push vendor. The usual `web-push` npm package needs Node's crypto and doesn't run on Workers. Candidates that do: [`@pushforge/builder`](https://socket.dev/npm/package/@pushforge/builder), [`@mmmike/web-push`](https://github.com/MMMikeM/web-push), [`web-push-neo`](https://github.com/ryoppippi/web-push-neo). Avoid `@block65/webcrypto-web-push` unless patched: its old VAPID header form is rejected by Chrome's push service ([report](https://atyantik.com/blog/web-push-vapid-guide/)). One payload for all: a Declarative Web Push JSON (`"web_push": 8030`, `notification.title`, `navigate`), which Safari shows by itself and our service worker parses on Chrome.
5. **Limits:** the free plan allows only **50 subrequests per invocation** ([Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/)), so a send goes out in batches of about 40, one Durable Object alarm after another. The Game's object already uses its one alarm for the show-silence check (`game-room.ts`), so the alarm handler has to serve both. Durable Objects get 30 s of CPU per invocation, plenty for the encryption ([DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/)). Headers: `Urgency: high` and a short `TTL` (for example 120 s for the Descans message, so it never arrives after the round started). A `404` or `410` deletes that subscription.
6. **Triggers:** the Descans message from the same journaled moment as the voice line (D202), so it follows the real night, not the planned clock; a winner's message only from a confirmed win, only to subscriptions holding that card. When the laptop is offline, the message simply doesn't go out.
7. **Deleting:** an alarm deletes every subscription the morning after the night (after the thank-you, if any). The app's "Esborrar dades" also unsubscribes.
8. **Icons:** Android's status bar draws the notification `badge` from its alpha channel only: a white silhouette on transparent, about 96×96 PNG ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notification/badge)); a full-colour icon becomes a white square. The `icon` is a colour PNG (about 192×192). A maskable icon (`"purpose": "maskable"`, the logo inside the central 80% safe zone) is for the installed app's launcher, not for push itself. These must be PNG: Chrome doesn't decode JPEG XL, so the JXL rule's PNG fallback is what's used.

**Effort:** Backend 2–3 days (keys, subscribe route, DO table, batched sender, deletion, tests), Frontend 1–2 days (service worker, Horari switch, Catalan copy, icons), plus a test on a real Android and a real iPhone Home Screen app and a rehearsal send. The notification's look and wording are a UI feature, specified and agreed like the rest.

**Risks:**
- **Trust:** a prompt that looks like spam to the many who distrust computers.
- **Leaks:** a second channel out of the cloud, one more place where a rule can break. Fixed templates make this small.
- **Late or lost delivery:** battery savers on some Android brands, iOS Focus modes, the 5G in the tent. Push gives no delivery guarantee.
- **Quota:** small. About 40 sends twice is a few hundred subrequests, well inside the free tier.
- **iPhone gap:** the feature would quietly favour Android players.

## Open points for the user

1. **Push for 2026:**
  - (a) pass, and use the Admin banner, the voices and the app's end screen (recommended);
  - (b) build the minimal Android-first version: an opt-in switch in Horari, the Descans message and, if wanted, a thank-you the next morning.
2. **Prizes:** do winners ever leave without collecting their prize? If yes, a reminder is the one case where push (or a line in the app) has real value, and Admin's winners list needs a "collected" mark.
3. **Only with (b):** whether to send a thank-you the next morning, and what it says (a feedback link?).
