# iPhones: one-tap install, an App Clip, and the QR path

Research for the player app, 27 Nov 2026. Sources are listed with their dates. Apple's App Clip pages carry no date. They were read today and still describe iOS 17 as the newest change.

## Verdicts

**1. One-tap install of the web app: not possible on iPhone.** No iOS browser lets a page start the install. Safari has no `beforeinstallprompt`, no `appinstalled`, and no `navigator.install()`. WebKit formally opposes the Web Install API because it sees installing as the user's own act. Chrome, Edge and Firefox on iPhone all run on WebKit, so they can't do it either. The only path is the share sheet. iOS 26 made two things easier: every site added to the Home Screen now opens as a web app by default, and Safari has "zero requirements for installability". Safari 27 (Sept 2026) changed nothing here. **Recommendation:** keep the current plan in screens.md. On iPhone, show no install button on the home screen. Ajustos gets a short drawer with three or four pictured steps, written for the iOS 26/27 compact Safari layout. Go to "Shortest steps" below for them.

**2. An App Clip: pass.** It is technically small (a WKWebView inside a 15 MB clip), but it doesn't fit this event:
- It needs a full parent app on the App Store with the same functionality. A parent that is only our website in a web view is exactly what guideline 4.2 rejects.
- A brand-new account's first app usually takes 2–7 days to approve, often after at least one rejection.
- Apple warns that reviews slow down around 19–26 December.
- An advanced experience can take about 2 days to start working after approval.
- The App Clip adds a step for players (an App Clip card with an "Open" button, then a download) rather than removing one.
- Its one real gain is notifications for 8 hours, and that would need APNs sending from our Worker as well.
- After the night it stays on the App Store under the account holder's name and needs a yearly membership.

Fixing a bug on the night would need another review, or the experience would have to be switched off, and forum reports say a switched-off experience can keep loading for 48 hours or more. With four weeks left, the risk and the work outweigh the gain.

**3. The QR on iPhone: the plain web link is already the simplest path.** Without an App Clip, the player points the Camera at the QR, a yellow link chip appears, they tap it, and Safari opens the card at `/26/<number>`: one tap. With an App Clip, the same chip opens an App Clip card, they tap "Open", and the clip downloads and launches: two taps plus a wait. Phones where App Clips are off or fail fall back to Safari anyway. **Recommendation:**
- Keep the printed URL as it is.
- Make the Safari page work instantly from a cold open.
- Put no App Clip or Smart App Banner meta tag on the page.
- Ask for nothing at entry.
- Teach "camera, point, tap the yellow button" on the screen and through the presenters.
- If anyone does add the app to the Home Screen, make sure it reopens on their own card. Go to "Risks" below for why.

## Key facts and sources

### Installing a web app on iOS
- iOS/iPadOS 26: every site added to the Home Screen opens as a web app by default. The user can turn off "Open as Web App" in the add sheet. "There are now zero requirements for 'installability' in Safari." [WebKit, Features in Safari 26.0, 15 Sep 2025](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- Safari 27.0 (16 Sep 2026), 27.1 and 27.2: no change to install or Home Screen behaviour. Safari 27 added the service worker static routing API. [openpwa.net, iOS by version, updated 20 Oct 2026](https://openpwa.net/reference/platforms/ios-by-version/); [web-standards.dev, Safari 27, Sep 2026](https://web-standards.dev/news/2026/09/safari-27/)
- No `beforeinstallprompt`, no `navigator.install` and no `getInstalledRelatedApps` in Safari, confirmed by a device test on 20 Oct 2026. [openpwa.net, install prompt](https://openpwa.net/reference/installation/install-prompt/); [openpwa.net, navigator.install](https://openpwa.net/reference/installation/navigator-install/)
- WebKit: "Oppose" on the Web Install API, quoted in the Blink Intent to Ship of 21 Sep 2026. In Chromium it ships for desktop from Chrome 156 only. [blink-dev Intent to Ship](http://www.mail-archive.com/blink-dev@chromium.org/msg17503.html); [WebKit standards position #463](https://github.com/WebKit/standards-positions/issues/463)
- The only signal we get that a player has installed is `navigator.standalone === true`, or `display-mode: standalone`, once the app is launched from the Home Screen.
- Other iOS browsers have offered "Add to Home Screen" from their Share menus since iOS 16.4. Chrome's own steps: Share in the address bar, then Add to Home Screen, then Add. [Google Chrome Help, iOS](https://support.google.com/chrome/answer/9658361?hl=en&co=GENIE.Platform%3DiOS)
  - Microsoft publishes no Edge-specific documentation for this, and I found no confirmation that Edge shows the iOS 26 toggle. Test it on a device.
- iOS 26 Safari moved Share behind the "⋯" (page menu) button next to the address bar. This compact layout is the default. In the "Bottom" or "Top" tab layouts, the Share button is shown directly. [MacRumors, 20 Aug 2025](https://www.macrumors.com/how-to/save-safari-bookmark-web-app-iphone-home-screen/)
- A Home Screen web app keeps its own storage. Safari's cookies are copied in once, when the app is added (iOS 17.2+). localStorage and IndexedDB are not copied. [openpwa.net, storage isolation, updated 20 Oct 2026](https://openpwa.net/reference/storage/home-screen-storage-isolation/)
- iOS uses the manifest's `start_url` when one is set, and the current page when none is. These are recent developer reports, not Apple documentation. [GitHub PR example](https://github.com/An-Be/your-turn/pull/3)

### Shortest steps to show users (iOS 26/27, Safari, default layout)
1. Tap **⋯** next to the address bar.
2. Tap **Share**.
3. Scroll down (or tap "View More") and tap **Add to Home Screen**.
4. Leave "Open as Web App" on and tap **Add**.

On iOS 16.4–18, and in the Bottom/Top tab layouts, steps 1–2 are one tap on the Share icon. In Chrome on iPhone, use Share in the address bar, then Add to Home Screen. The Catalan labels on a Catalan iPhone must be checked on a real device before the drawer's text is fixed.

### App Clips (Apple documentation, undated pages, read 27 Nov 2026)
- **A full app is required:** "An App Clip always requires a corresponding full app." Also, "the full app must include the same functionality as the App Clip", and once the full app is installed, it handles every invocation. [Configuring App Clip experiences](https://developer.apple.com/documentation/appclip/configuring-the-launch-experience-of-your-app-clip); [Choosing the right functionality](https://developer.apple.com/documentation/appclip/choosing-the-right-functionality-for-your-app-clip)
- **Size:**
  - The limit is 15 MB for iOS 16+ (10 MB for iOS 15 and earlier).
  - It rises to 100 MB on iOS 17+, but only for clips with digital invocations only. QR codes are a physical invocation, so we are held to 15 MB.
  - The demo link allows 100 MB with QR codes, but it can't carry URL parameters, so it can't carry our card number.
  - A web-view clip is far under any of these limits.
  - Source: [Choosing the right functionality](https://developer.apple.com/documentation/appclip/choosing-the-right-functionality-for-your-app-clip)
- **Web view:** WKWebView is not on the list of frameworks that App Clips can't use, so a clip can host our existing web app. The limit is App Review, not the technology.
- **App Review:**
  - Guideline 4.2: an app must be "beyond a repackaged website". Guideline 4.2.2 rules out apps that are mainly "web clippings".
  - Guideline 2.5.16: "all App Clip features and functionality must be included in the main app binary"; App Clips can't contain ads.
  - The guidelines were last updated on 16 Oct 2026. [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
  - Developers widely report that adding one native feature to a web wrapper is not enough to pass. [MobiLoud, 2026](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper/)
- **Invocation from our printed URL:**
  - Our printed URL works as it is, because prefix matching covers it. We would register one advanced App Clip experience for `https://<domain>/26/`, and every `/26/<number>` would match. The clip reads the card number from the invocation URL.
  - This needs the `appclips:<domain>` associated-domains entitlement on both targets. It also needs an AASA file at `/.well-known/apple-app-site-association` with an `appclips.apps` entry, served by our Worker, with `AASA-Bot` and `CFNetwork` allowed through any bot protection.
  - Sources: [Configuring App Clip experiences](https://developer.apple.com/documentation/appclip/configuring-the-launch-experience-of-your-app-clip); [Associating your App Clip with your website](https://developer.apple.com/documentation/appclip/associating-your-app-clip-with-your-website)
  - A QR code with our own domain needs an advanced experience. Without one, "your web page will be offered in Safari instead of your customers seeing the App Clip card in Camera". [WWDC21, Build light and fast App Clips](https://developer.apple.com/videos/play/wwdc2021/10013/)
  - Developer forums report that the default experience doesn't show the card from a QR with our own domain. [Forum, May–Jun 2025](https://developer.apple.com/forums/thread/786265)
  - An advanced experience can take about 2 days to start working after approval.
  - The first scan after a phone reset sometimes opens Safari instead of the clip. [App Clips forum tag](https://developer.apple.com/forums/tags/app-clips/?page=8); [Forum: card sometimes fails](https://developer.apple.com/forums/thread/805725)
- **When the clip isn't available:**
  - The URL opens as a normal website in Safari.
  - This covers App Clips turned off in Screen Time (which also deletes any App Clips already on the phone), very old iOS, a configuration error, and an unreliable first scan.
  - Because the QR URL is our website, these players still land on the card.
  - Source: [Apple Support, App Clips, 22 Aug 2023](https://support.apple.com/en-us/102093)
- **The App Clip card:**
  - It has a header image, a title of up to 30 characters, a subtitle of up to 56, and a button such as "Open".
  - Its content can't be changed by code; only per-experience metadata in App Store Connect.
- **Notifications:**
  - With `NSAppClipRequestEphemeralUserNotification`, the clip may send notifications for up to 8 hours after each launch, with no permission prompt. The card shows a note, and the user can turn it off there.
  - Reopening the clip from a notification brings no invocation URL, so the clip must restore its own saved state.
  - Server pushes would mean APNs from our backend.
  - Sources: [Enabling notifications in App Clips](https://developer.apple.com/documentation/appclip/enabling-notifications-in-app-clips); [Responding to invocations](https://developer.apple.com/documentation/appclip/responding-to-invocations)
  - For comparison, Web Push on iPhone works only for Home Screen web apps (iOS 16.4+).
- **Retention:** iOS deletes an App Clip after 30 days of non-use, and its data after 10 days. [Apple Support](https://support.apple.com/en-us/102093)
- **Switching off:** one developer reported that a deactivated advanced experience still launched more than 48 hours later. [Forum, Nov 2025](https://developer.apple.com/forums/thread/807984)
- **Review time:**
  - Apple says 90% of submissions are reviewed in under 24 hours, and the tracker average was about 16 hours in late Oct 2026.
  - One developer's data for new apps (Sep–Oct 2026): a median of 4.4 days from first submission to approval, and none of 21 apps approved first time. [dev.to, 2026](https://dev.to/mattbusel/app-store-review-time-64-real-decisions-median-73-hours-4a52)
  - Holidays: Apple warned of slower reviews on 19–26 Dec 2025 and 20–26 Dec 2024. [Compuscoop, 22 Dec 2025](https://www.compuscoop.com/apple-announces-app-store-connect-holiday-hours-and-maintenance-date-downtime/)
- **EU listing:**
  - Every app needs a declared trader status (Digital Services Act, since 17 Feb 2025).
  - A trader's name, address, phone and email are shown on the EU store page.
  - Source: [Apple Developer News](https://developer.apple.com/news/?id=einwn76m)

## Effort and risks

**App Clip, if it were pursued anyway:**
- About 3–5 developer days for:
  - an Xcode project with a full app and an App Clip, both WKWebView;
  - the entitlements;
  - the AASA in the Worker;
  - App Store Connect metadata (screenshots, privacy policy, privacy labels, age rating, trader status, the 1800×1200 card image);
  - the advanced experience;
  - testing with a local experience and TestFlight.
- After that, another 1–2 weeks of native work to give the full app a credible chance under 4.2.
- Then 2–7+ days of review, likely with a rejection round. That runs into the slow 19–26 Dec window, with about 2 days for the experience to go live after approval.
- Realistically it is ready a few days before the 27th at best, with no margin to fix anything.

**Risks of an App Clip:**
- a 4.2 rejection;
- going live late;
- an extra step for players;
- a card that some phones fail to show;
- no hotfix outside the web content;
- hard to switch off;
- a public App Store listing that outlives the night, with the seller's name and, in the EU, trader contact details.

**Risks of the web path (the recommended one):**
- **Storage isolation:** a player who adds the app to the Home Screen starts it with empty localStorage. If the manifest's `start_url` is generic (`/` or `/26/`), the icon opens without their card.
  - Fix A: no `start_url`, so iOS keeps the page they were on.
  - Fix B: keep the player's card numbers in a cookie, since iOS copies cookies in once when the app is added.
  - Either fix must be checked on a real iPhone when the manifest (D221) is built.
- **Old versions:** a Home Screen app keeps its service worker. This is the trap that caught last year's app (`apps/player/logic/cleanup.ts`). The network-first service worker of D222 is the guard.
- **Wording:** Catalan share-sheet labels, and the differences between iOS 18 and 26, mean the drawer's text and pictures need a device check.

## Open points for the user

- **(a)** Pass on the App Clip for 2026 (recommended), or **(b)** try it anyway, knowing it may not be approved in time. It would have to be submitted within the next week or so.
- On iPhone, the install help appears only in Ajustos, as screens.md already plans; no button on the home screen. Does this research close the "unless iOS offers a one-tap install" condition? (Yes: there is none.)
- When the Home Screen icon opens: **(a)** on the card the player added it from (no `start_url`), or **(b)** on a general start page that restores their cards from a cookie.
- Is a physical iPhone with iOS 26 or 27, set to Catalan, available to test the steps and take the drawer's screenshots?
