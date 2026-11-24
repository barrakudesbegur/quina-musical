# Generative AI audio tools and sound-design asset sources for the Quina musical DJ mixer

Research date: 2026-11-23. Prices, model versions and terms in this area change monthly, so every fact carries the date or version the source gave. Many "Suno API" and "AI music review" pages are written by competing API resellers or AI-music vendors; where a claim rests only on such a page it is flagged as third-party.

## 1. Suno: API status, models, features, commercial terms, lawsuits, and fitness for a "Quina Barrakudes" jingle, stingers and bridge loops

### Takeaway
As of Nov 2026, Suno has no public self-serve API. Its first-party API is invite-only for partners, and the popular unofficial wrappers run your own Suno account with a session cookie and a captcha solver, which Suno's terms do not allow. Suno is still good for making a branded jingle and key/BPM-locked loops by hand in the web app ("Sounds" mode, Jan 2026; Studio). Commercial use now needs a paid plan and counts against a monthly download cap (Pro: 20 a month). UMG and Sony are still suing Suno.

### Cited Findings
**API status**
- On July 1, 2026, Suno CPO Jack Brody posted an early-access intake form saying "We're beginning to explore a developer API, starting with a curated group of partners"; no launch timeline was given. — [Music Business Worldwide](https://www.musicbusinessworldwide.com/suno-explores-developer-api-seeking-apps-that-unlock-experiences-generative-music-makes-possible-for-the-first-time/) (page returned 403 to the fetcher; details are from the search snippet)
- In a check dated Oct 17, 2026, platform.suno.com showed "Make music with the Suno API" with only a sign-in for existing API accounts. Its /docs and /pricing paths showed the same sign-in box, with no public docs, prices or self-serve keys. — [OmniaKey](https://omniakey.com/blog/suno-api) (third-party API seller; see also [Tunova](https://tunova.ai/guides/is-there-an-official-suno-api), also a seller)
- Suno's official release notes contain no developer-API entry. The closest is "Suno MCP beta" (Oct 28, 2026): "Connect Suno to Claude, ChatGPT, Claude Code and other MCP clients." That is a client connector, not a documented REST API. — [Suno release notes](https://suno.com/release-notes)
- The best-known unofficial wrapper is [gcui-art/suno-api](https://github.com/gcui-art/suno-api). Third-party roundups say it needs your Suno cookie plus a captcha solver, runs through your own account (which Suno's terms disallow), and has had no new code since March 2026. — [OmniaKey](https://omniakey.com/blog/suno-api); [aimusicapi.ai](https://aimusicapi.ai/en/blog/does-suno-have-an-api) (both sell competing APIs)
- Resellers such as sunor.cc, apiframe.ai, kie.ai and OmniaKey are not run by Suno. A June 2026 comparison put prices between $0.014 per run and $0.111 per song. — [Sunor](https://sunor.cc/blog/suno-api-pricing-2026) (reseller)

**Models and features (versions with dates)**
- v4.5 (May 1, 2025); v5 (Sep 23, 2025); v5.5 (Mar 26, 2026, adds Custom Models trained on ≥6 of your tracks); v6 (Sep 9, 2026): "v6 and v6-wild are available only to paid users"; v6-mini is free for everyone. — [Suno release notes](https://suno.com/release-notes)
- v6 was built with Warner Music Group, BMG and Believe. All three variants generate up to 8 minutes, and older models are being retired. — [Dubspot](https://blog.dubspot.com/suno-v6-2026); [innFactory](https://innfactory.ai/en/ai-models/suno/)
- **"Sounds" mode (Jan 27, 2026):** "a new Create mode that lets you create individual one-shot samples and loops from scratch". For loops you "select your key and tempo (bpm)". "Sample" (Jan 20, 2026) lets you pick a section of audio as the starting point for new ideas. — [Suno release notes](https://suno.com/release-notes)
- Suno Studio, "the first-ever generative audio workstation", launched Sep 25, 2025. Studio 1.2 (Feb 16, 2026) added Warp Markers and time-signature support. Studio 2.0 (Aug 13, 2026) is Premier-only. The Studio chat bar became BPM-aware on Sep 2, 2026, and can generate audio stems from MIDI clips (Sep 17, 2026). Auto time-stretch arrived Oct 8 and Oct 29, 2026. — [Suno release notes](https://suno.com/release-notes)
- Stems: Auto Split gives up to 12 stem categories; Advanced Split offers "nearly 100 instruments" (Premier only, Jun 11, 2026). — [Suno release notes](https://suno.com/release-notes)
- Premier subscribers can reportedly export multitracks/stems from Studio at 32-bit/48 kHz without limits. — [Jack Righteous guide](https://jackrighteous.com/en-us/blogs/guides-using-suno-ai-music-creation/inside-suno-v6-studio-2-midi-recording-effects-automation-guide) (third-party)
- Remix (extend, cover, adjust speed) is included on every plan. — [Suno pricing](https://suno.com/pricing)

**Plans and commercial use (pricing page fetched 2026-11-23)**
- Free: $0, 50 credits a day, "No monthly song downloads", no commercial rights, v6-mini only. Pro: $10/mo ($8/mo billed annually), 2,500 credits, **20 downloads a month**, commercial rights, v6 and v6-wild, 2 stem types, no Studio. Premier: $30/mo ($24/mo annual), 10,000 credits, **60 downloads a month**, Studio, 3 stem types. Platinum: $120/mo, 15,000 credits, 120 downloads. — [Suno pricing](https://suno.com/pricing)
- New Terms of Service have been in force since Sep 3, 2026 (revised Aug 10). Commercial use is allowed only for songs obtained through an approved monthly "Download" within the plan's allowance. Unused downloads do not roll over. Downloads from Suno Studio are unlimited for Premier. — [Soundkey](https://soundkey.io/blog/suno-download-limits-commercial-rights); [Mubert blog](https://mubert.com/blog/suno-commercial-use-plans-downloads) (competitor); background in [Digital Music News, Dec 22, 2025](https://www.digitalmusicnews.com/2025/12/22/suno-warner-music-deal-changes/)
- Ownership wording conflicts. In Dec 2025 Suno's policy said that even with commercial rights "you generally are not considered the owner of the songs". A later help-centre edit (Jan 7, 2026) reportedly treats Pro/Premier subscribers as owners. — [Music in Africa](https://musicinafrica.net/magazine/suno-adjusts-ai-music-ownership-terms-after-warner-music-partnership/); [Undetectr](https://undetectr.com/blog/suno-commercial-use) (third-party; suno.com/terms not fetched)

**Lawsuits and settlements (as of Nov 2026)**
- Warner settled with Suno on Nov 25, 2025, as a licensing partnership. Suno bought Songkick from WMG and committed to launch licensed models in 2026 and retire the old ones. The dismissal order was entered Jan 28, 2026. — [CourtDocket](https://courtdocket.org/suno-lawsuit-explained-warner-settlement-umg-and-sony-next/); [Wikipedia](https://en.wikipedia.org/wiki/Suno_(platform)) (Wikipedia's "$500 million" figure is not corroborated elsewhere)
- UMG and Sony are still litigating in D. Mass. Talks were reported at a "hard impasse" in April 2026 over the "walled garden" question. In April a magistrate blocked UMG and Sony from obtaining the Warner settlement terms. — [Music Business Worldwide](https://www.musicbusinessworldwide.com/suno-fights-to-keep-warner-music-settlement-terms-away-from-umg-and-sony/); [AI Lawsuit Tracker](https://ailawsuittracker.com/cases/umg-v-suno/)
- Aug 2026: the court allowed a DMCA §1201(a) claim but refused to add 61,026 more recordings. Sep 18, 2026: UMG and Sony filed a second suit covering about 60,202 recordings. Suno filed its answer on Oct 20, 2026. In Nov 2026, the rights holders of the Eminem and Elvis Presley catalogs filed new suits. — [Shattered.io](https://shattered.io/suno-sued-again-eminem-elvis-umg-sony-60202-recordings-2026/); [AI Lawsuit Tracker](https://ailawsuittracker.com/cases/umg-v-suno/) (aggregators)

### Inferences
- Suno cannot be part of an automated pipeline for this app. Assets would be made by hand in the web app and downloaded, each download using one of the 20 (Pro) or 60 (Premier) monthly slots. That still covers a jingle plus a dozen stingers or loops.
- "Sounds" mode with key and BPM selection is the closest Suno feature to "bridge loops at a given BPM and key". A small set of loops (for example 4–8 bars at 100/110/120/128 BPM in a few keys) could serve as beds under the roulette spin.
- A sung "Quina Barrakudes" jingle in Catalan is feasible in principle (v6 sings with lyrics), but no source confirms the quality of Catalan vocals. Test it.
- Unofficial wrappers risk an account ban, and they gain nothing here because assets are pre-generated anyway.
- The open UMG/Sony litigation concerns Suno's training, not end users playing outputs. Still, Eleven Music and Stable Audio 3.0 are marketed as trained on licensed data, which is the lower-risk choice for a public event (see Q2 and Q3).

### Gaps
- Suno generation latency per song or loop: no authoritative figure found.
- The exact current suno.com/terms wording on public performance at live events was not fetched; the commercial-use reading above comes from third-party summaries.
- Suno v6 vocal quality in Catalan: no source found.
- Price of extra downloads beyond the plan cap: not announced as of Aug 11, 2026 per [Soundkey](https://soundkey.io/blog/suno-download-limits-commercial-rights); not rechecked.

## 2. ElevenLabs: Sound Effects API, Eleven Music API, and TTS / voice design for announcer drops

### Takeaway
ElevenLabs is the most practical single API for this show. Sound effects cost $0.12 per minute of audio, run 0.5–30 s with exact duration control, and offer seamless loops on the v2 model. Eleven Music costs $0.15 per minute, with section-by-section composition plans and per-section durations of 3–120 s. The v3 and v4 TTS models support Catalan and cost $0.08 per 1K characters. Music is marketed as trained on licensed data, and live and offline commercial use is allowed on paid self-serve plans; the exclusions are film, TV, radio and studio games.

### Cited Findings
**Sound Effects API (`POST /v1/sound-generation`)**
- Body: `text` (required), `loop` (bool, default false, "create a sound effect that loops smoothly"), `duration_seconds` ("at least 0.5 and at most 30"; if unset the model guesses), `prompt_influence` (0–1, default 0.3), `model_id` (`eleven_text_to_sound_v2` default, or `eleven_text_to_sound_v3`). — [ElevenLabs API reference](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert)
- Output formats include MP3 22.05–44.1 kHz (32–192 kbps), Opus 48 kHz, PCM 8–48 kHz and WAV 8–48 kHz. MP3 at 192 kbps requires Creator tier or above, and PCM/WAV at 44.1 kHz requires Pro or above. — [ElevenLabs API reference](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert)
- SFX v3 was released Nov 2, 2026. It follows multi-part prompts more closely: "the order of the prompts matter". "Looping currently only works with eleven_text_to_sound_v2." For exact timing, "set the duration_seconds to your desired time." — [ElevenLabs blog, SFX v3](https://elevenlabs.io/blog/sfx-v3-for-developers)
- A third-party guide says 48 kHz WAV is available only for non-looping effects and loops come out as MP3. — [Sandbase](https://www.sandbase.ai/models/elevenlabs/sound-effects-v2#api) (unverified against official docs)
- Price: Sound Effects "$0.12 per minute" on the API. The FAQ also says "Music and Sound Effects are billed per generation". Included generations by plan: 8 / 150 / 605 / 3,000 / 9,000 / 30,000. — [ElevenLabs API pricing](https://elevenlabs.io/pricing/api) (fetched 2026-11-23; the page shows no year)

**Eleven Music API (`POST /v1/music`, plus `POST /v1/music/plan`)**
- Models: `music_v1`, `music_v2`, `music_v2_5`. `prompt` and `composition_plan` are mutually exclusive. `music_length_ms` 3,000–600,000 (with prompt only). `force_instrumental` (prompt only). `seed` (composition plan only). `store_for_inpainting`. `sign_with_c2pa`. Default output is MP3 48 kHz/192 kbps for v2 models; PCM up to 48 kHz is also available. — [ElevenLabs Compose reference](https://elevenlabs.io/docs/api-reference/music/compose)
- A v2/v2.5 CompositionPlan is a list of `chunks`. Each GenerationChunk has `text` (optional bracketed section name plus lyric lines, ≤30 lines of ≤200 chars), `duration_ms` (3,000–120,000), `positive_styles` (early chunks should have "at least 6-7 styles"), optional `negative_styles`, `context_adherence` (low/medium/high), and optional `conditioning_ref` (AudioRefChunk with `song_id` + `start_ms`/`end_ms` range) with `condition_strength` up to `xhigh`. "For v2 models, durations are always enforced." — [ElevenLabs Compose reference](https://elevenlabs.io/docs/api-reference/music/compose)
- Creating a composition plan "does not cost any credits" but is rate-limited by tier. — [ElevenLabs create-composition-plan reference](https://elevenlabs.io/docs/api-reference/music/create-composition-plan)
- Price: Music "$0.15 per minute", finetune $1.50. Included minutes by plan: 3 / 40 / 147 / 660 / 1,993 / 6,600. — [ElevenLabs API pricing](https://elevenlabs.io/pricing/api). The Music API is unavailable on the Free plan. — [ElevenLabs Music 2026 (Stork)](https://www.stork.ai/blog/elevenlabs-music-2026) (third-party)
- Eleven Music launched Aug 5, 2025 with deals with Merlin and Kobalt. The launch model was trained on licensed production music, and outputs were said to be "cleared for broad commercial use". — [Business Wire press release](https://www.businesswire.com/news/home/20250805333301/en/ElevenLabs-Launches-Eleven-Music-in-Collaboration-with-Music-Industry-Partners); [Music Ally](https://musically.com/2025/08/06/elevenlabs-debuts-ai-music-service-with-kobalt-and-merlin-deals/)
- Music terms (last updated Oct 9, 2026): Free through Business plans: "All online and offline commercial use permitted, except film, TV, radio, and Studio Games". Enterprise Music has no exclusions. Free, Starter, Creator and Pro are "For Individual Use Only". Scale is for organizations with fewer than 10 employees, Business fewer than 50. Streaming distribution is prohibited on Free and Starter and permitted on Creator and up. Building a "Music Library" from output is prohibited. Free requires attribution ("denote Eleven Music"). Live events and public performance are not addressed explicitly. — [ElevenLabs Music Terms](https://elevenlabs.io/music-terms)
- Music model languages: `music_v2_5` lists "`en`, `es`, `de`, `ja`, and more"; Catalan is not named. — [ElevenLabs Models](https://elevenlabs.io/docs/overview/models)

**TTS and voice design for announcer drops**
- `eleven_v4` and `eleven_v4_turbo` (90+ languages) and `eleven_v3` (70+) include Catalan (ca). `eleven_multilingual_v2` (29 languages) and `eleven_flash_v2_5` (32) do not. The voice design model `eleven_ttv_v3` uses the 70+ language list, which includes Catalan; `eleven_multilingual_ttv_v2` does not. — [ElevenLabs Models](https://elevenlabs.io/docs/overview/models); [Eleven v3 blog](https://elevenlabs.io/blog/eleven-v3)
- Eleven v3 accepts up to 5,000 characters per request and supports audio tags. A third-party guide lists a `[strong catalan accent]` tag. — [ElevenLabs Catalan TTS page](https://elevenlabs.io/text-to-speech/catalan); [audio-generation-plugin guide](https://audio-generation-plugin.com/elevenlabs-v3/) (third-party)
- TTS API prices: v4 $0.08, v4 Turbo $0.04, v3 $0.08, v3 Conversational $0.04, Multilingual v2 $0.08, Flash/Turbo $0.04 per 1K characters. — [ElevenLabs API pricing](https://elevenlabs.io/pricing/api). Earlier Sep 2026 rates were $0.10 and $0.05; v4 launched with a 72% promo until Oct 12. — [Good Vibe Code](https://www.goodvibecode.com/text-to-speech/elevenlabs-api-pricing-explained) (third-party)
- Subscription tiers: Free $0 (10K credits), Starter $6, Creator $22, Pro $99, Scale $299, Business $990 per month. — [ElevenLabs API pricing](https://elevenlabs.io/pricing/api); [WebsiteVoice](https://websitevoice.com/blog/elevenlabs-pricing-plans/)

**Rate limits**
- Third-party summaries of ElevenLabs docs give TTS concurrency of 2 (Free), 3 (Starter), 5 (Creator), 10 (Pro), 15 (Scale/Business), doubled for Flash. — [Cartesia](https://www.cartesia.ai/learn/elevenlabs-pricing); [AssemblyAI](https://www.assemblyai.com/blog/tts-api-pricing) (competitors). The official pricing page instead lists 4 / 6 / 10 / 20 / 30 / 40 concurrent calls for the Realtime and Speech Engine APIs, and no TTS-specific limit. — [ElevenLabs API pricing](https://elevenlabs.io/pricing/api). These sources conflict.
- An HTTP 422 means invalid parameters (for example duration out of range); a 429 means the rate limit was hit. — [ElevenLabs skills registry (Tessl)](https://tessl.io/registry/skills/github/elevenlabs/skills/sound-effects)

### Inferences
- **Riser library:** request SFX v3 non-looping risers, sweeps and impacts with `duration_seconds` set to exact bar lengths (one bar at 120 BPM = 2.0 s; four bars = 8.0 s; eight bars at 100 BPM = 19.2 s; all within the 30 s cap). Then trim and time-stretch offline. A 40-asset library of about 10 s each is roughly 7 minutes of audio, about $0.80 at $0.12/min, or perhaps $4–8 with re-rolls. The "billed per generation" FAQ line may change the exact maths.
- **Loop beds for the spin:** SFX v2 with `loop: true` gives seamless tension loops (drum roll, ticking clock, crowd) that can play for any spin length from 5 to 11 s.
- **Jingle and stingers:** an Eleven Music composition plan with chunk durations set to exact bar lengths at a chosen BPM (BPM and key stated in `positive_styles`) gives timed stingers. A Catalan-lyric jingle may work, but Catalan isn't confirmed for music, so test it or use a Spanish/English hook plus a TTS "Quina Barrakudes!" tag.
- **Voice drops:** about 100 short Catalan/Spanish drops ("Següent cançó!", "Tres, dos, u…", "Quina!", "Últimes cançons!") at about 30 characters each is about 3K characters, roughly $0.25 on v4. Use a voice designed with `eleven_ttv_v3` for a consistent "Barrakudes announcer". Starter ($6/mo) is the minimum sensible plan because Free requires attribution and the Music API is paid-only.
- Rate limits don't matter here because everything is rendered offline ahead of the show.

### Gaps
- Whether ElevenLabs' general (non-music) terms allow commercial use of TTS and SFX on the Free plan was not checked; assume a paid plan.
- Exact SFX/Music generation latency is not published in the pages fetched.
- Whether Eleven Music actually holds BPM and key from text styles, rather than only approximating them, is undocumented; it needs a test.
- Live-event public performance of Eleven Music output isn't addressed explicitly in the terms. The reading that it is "offline commercial use" is an inference.

## 3. Other music/SFX generators: Stable Audio, AudioCraft/MusicGen/AudioGen, Google Lyria / Lyria RealTime / MusicFX DJ / Magenta RealTime, Udio, Mubert, Riffusion, Beatoven

### Takeaway
For local, licence-clean generation on a Mac, the best fits are **Stable Audio 3.0 Small SFX/Small** (open weights, Community License, free under $1M revenue, trained on licensed data) and **Magenta RealTime 2** (open weights, CC-BY 4.0, runs streaming on Apple Silicon at about 200 ms control latency). Google **Lyria RealTime** is the only hosted, steerable real-time music stream with BPM and scale control, but it is experimental, instrumental-only and has unpublished pricing. MusicGen/AudioGen run locally via MLX but their weights are non-commercial. Udio is a walled garden with no downloads, Riffusion is now Google Flow Music, MusicFX DJ was shut down, and Mubert and Beatoven are subscription background-music APIs of limited use here.

### Cited Findings
**Stability AI**
- Stable Audio 2.5 (launched Sep 10, 2025) generates up to 3 minutes with text-to-audio, audio-to-audio and **audio inpainting** ("input their own audio, select where they want it to start, and the model will use the context to generate the rest"). Inference is under 2 s on a GPU. — [Stability AI announcement](https://stability.ai/news-updates/stability-ai-introduces-stable-audio-25-the-first-audio-model-built-for-enterprise-sound-production-at-scale)
- Price conflict: Stability's pricing page (1 credit = $0.01) lists Stable Audio 2.5 at 8 credits ($0.08) per generation — [Stability pricing](https://docs.stability.ai/pricing). Newer reviews say a flat 20 credits ($0.20) for 2.5 and about 26 credits for 3.0 Large. — [The Rundown](https://www.therundown.ai/tools/stable-audio-2-5); [Kompozy](https://kompozy.io/reviews/stable-audio)
- Stable Audio 3.0 (May 20, 2026) is a family of Small SFX ("sound effects generation on-device, such as mobile phones and consumer-grade laptops"), Small (music up to 2 min, "the only model capable of full music composition on-device"), Medium (up to 6:20) and Large (API only). "3.0 Small SFX, 3.0 Small, and 3.0 Medium are all open-weights." "All Stable Audio 3.0 models are trained on fully licensed data." It supports "single-segment editing, multi-segment editing, and causal continuation" and per-second length granularity. "Under the Stability AI Community License, you own your outputs and can distribute and commercialize them freely"; an Enterprise License is needed above $1M annual revenue. — [Stability AI, Stable Audio 3.0](https://stability.ai/news-updates/meet-stable-audio-3-the-model-family-built-for-artistic-experimentation-with-open-weight-models)
- Small and Small-SFX run on a CPU with no GPU. LoRA fine-tuning needs about 20–50 described clips and a CUDA GPU or Apple Silicon Mac. — [Stability explainer](https://stability.ai/explainers/can-i-self-host-stable-audio-30-and-fine-tune-it-on-my-own-library)
- Stable Audio Open Small (May 14, 2025, with Arm) has 341M parameters and generates up to 11 s of 44.1 kHz stereo in under 8 s on a phone, under the Community License. — [Stability/Arm announcement](https://stability.ai/news-updates/stability-ai-and-arm-release-stable-audio-open-small-enabling-real-world-deployment-for-on-device-audio-control); [Hugging Face card](https://huggingface.co/stabilityai/stable-audio-open-small)

**Meta AudioCraft (MusicGen / AudioGen)**
- The code is MIT, but "model weights are released under CC-BY-NC 4.0" for both MusicGen and AudioGen, so non-commercial use only. — [AudioCraft README mirror](https://github.com/aime-labs/MusicGen); [HF Space README copy](https://huggingface.co/spaces/civichacker/MusicGen/blob/main/README.md)
- Apple Silicon via MLX: on M4 Max the author of musicgen-mlx reports musicgen-small at 1.3× realtime, medium about 0.6×, large about 0.3×; beyond 30 s with a sliding window is not implemented. — [andrade0/musicgen-mlx](https://github.com/andrade0/musicgen-mlx). An independent M4 Max test measured small at 0.68× (10 s audio in about 15 s). — [Medium, AudioGen port](https://theashishmaurya.medium.com/i-ported-audiogen-to-apple-silicon-heres-everything-i-learned-7a6b7d4a2c84). On M1 Max, MLX ran 10 s clips in 11–13 s, while transformers on MPS took 186–350 s with growing memory (issue dated Nov 2026). — [arioso issue #54](https://github.com/thorwhalen/arioso/issues/54). An MLX package covering MusicGen and Stable Audio Open also exists. — [mlx-audio-generate](https://huggingface.co/jasonvassallo/mlx-audio-generate)

**Google: Lyria RealTime, Lyria 3.5, MusicFX DJ, Magenta RealTime**
- Lyria RealTime (`models/lyria-realtime-exp`, "an experimental model") uses a persistent bidirectional WebSocket. Controls are weighted text prompts (blend smoothly mid-stream), BPM 60–200, scale enum, density 0–1, brightness 0–1, mute bass/drums, "only bass and drums", guidance, temperature, top_k, seed, and mode. Output is raw 16-bit PCM, 48 kHz stereo, always watermarked, instrumental only. Changing BPM or scale needs `reset_context()` or stop/play, which is "abrupt"; density and brightness change without a reset. — [Google AI Studio docs, Lyria RealTime](https://aistudio.google.com/docs/realtime-music-generation)
- Lyria RealTime does not appear on the Gemini API pricing page. Lyria 3.5 costs $0.08 per song, Lyria 3 Clip Preview (30 s) $0.04, and Lyria 3 Pro Preview $0.08, all with no free tier. — [Gemini API pricing](https://aistudio.google.com/docs/pricing)
- Lyria 3.5 (`lyria-3.5`, public preview, Gemini API from about Sep 3–4, 2026) produces 44.1 kHz stereo full songs with vocals, MP3 or WAV. Lyria 3 Clip always makes 30-second clips "for loops and previews". — [Gemini API music-generation docs](https://ai.google.dev/gemini-api/docs/music-generation); [Unite.AI](https://www.unite.ai/google-brings-lyria-3-5-music-generation-to-the-gemini-app-and-api/)
- MusicFX and MusicFX DJ shut down on Jul 31, 2026. — [AlphaSignal](https://alphasignal.ai/news/google-kills-musicfx-to-go-all-in-on-flow-music). Lyria RealTime came to Flow Music Spaces on Aug 28, 2026 ("Realtime Music Generation is live in Flow Music Spaces"). — [Google Flow Music on X](https://x.com/googleflowmusic/status/2093411388945281446). A third-party explainer cites about a 2-second response time to prompt changes. — [lyria3-pro.com](https://lyria3-pro.com/blog/what-is-lyria-realtime) (unofficial)
- Magenta RealTime 2 (MRT2, Jun 4, 2026): code Apache 2.0, weights CC-BY 4.0; "Google claims no rights in outputs you generate". Base model 2.4B parameters, small 230M. 48 kHz stereo, steered by text, audio examples and MIDI with "low latency control (~200ms)". Trained on primarily instrumental stock music. The model card does not mention BPM controls. — [Hugging Face, google/magenta-realtime-2](https://huggingface.co/google/magenta-realtime-2)
- MRT2 ships `magenta-rt` with JAX and MLX backends and a C++ engine for streaming on Apple Silicon MacBooks. The base model needs an M3 Pro or M2 Max or better; small runs on any Apple Silicon MacBook including the Air. — [magenta/magenta-realtime GitHub](https://github.com/magenta/magenta-realtime); [Magenta MRT2 page](https://magenta.withgoogle.com/mrt2); background paper [Live Music Models (arXiv 2508.04651)](https://arxiv.org/html/2508.04651)

**Udio**
- UMG and Udio settled on Oct 29/30, 2025. The new licensed platform would launch in 2026, trained on authorized music, as a subscription for "customizing, streaming and sharing music on the Udio platform". — [UMG/Udio press release](https://www.prnewswire.com/news-releases/universal-music-group-and-udio-announce-udios-first-strategic-agreements-for-new-licensed-ai-music-creation-platform-302599129.html). Further deals: Warner (Nov 2025) — [Music Week](https://www.musicweek.com/labels/read/warner-music-group-signs-ai-licensing-agreement-with-udio/093097); Merlin (Jan 20, 2026), with Udio described as a "walled garden" — [Billboard](https://www.billboard.com/pro/udio-merlin-ai-music-licensing-deal/)
- Downloads of audio, video and stems have been disabled since Oct 30, 2025 (a 48-hour re-enable window ran from Nov 3, 2025). They were still disabled in Sep–Oct 2026, and no public launch of the new platform had happened by late Sep 2026. — [Replayed Studio](https://replayedstudio.com/blog/udio-kills-downloads/); [Loop.fans](https://music.loop.fans/ai/what-happened-to-udio); [Undetectr](https://undetectr.com/blog/udio-review-2026) (third-party blogs)
- Sony filed a second suit against Udio on Jul 20, 2026. — [AI Lawsuit Tracker](https://ailawsuittracker.com/cases/umg-v-suno/)

**Riffusion / Producer.ai**
- Google acquired ProducerAI (formerly Riffusion) on Feb 24, 2026. — [Music Business Worldwide](https://www.musicbusinessworldwide.com/google-acquires-ai-music-platform-and-suno-challenger-producerai/). The product was renamed Google Flow Music (Apr 2026), and producer.ai and riffusion.com redirect to flowmusic.app. The open-source Riffusion model is unmaintained. — [Suno Watermark blog](https://sunowatermark.com/blog/producer-ai-review-2026/) (third-party)

**Mubert**
- API: tracks from 15 s to 25 min, MP3/WAV, from prompt/mood/genre/BPM/duration/image, about 10 s average generation for a 60 s track. Loop mode or track mode. Endpoint `POST https://music-api.mubert.com/api/v3/public/tracks`. — [Mubert blog](https://mubert.com/blog/why-every-ai-content-creator-needs-mubert-api-right-now); [Mubert API use case](https://mubert.com/api/use-cases/ai-video-music-generator)
- API pricing as reported from Mubert's pages (Apr 2026): Trial $49/mo for 100 tracks; Startup $199/mo for 5,000; Startup+ $499/mo for 30,000. Third-party figures conflict ($99/mo for 2,000 calls; or API only on a $199/mo Business plan). — [Mubert API use case](https://mubert.com/api/use-cases/ai-music-for-meditation-apps) via search summary (pricing widget not directly fetched); see also [AISongCreator review](https://aisongcreator.pro/blog/mubert-review)

**Beatoven.ai**
- The Maestro model API offers self-serve keys and is also on fal. It returns a mix plus four stems; max length and price are "Not published". — [SoundGen model table](https://soundgen.ai/ai-music-models) (third-party). Downloads come with a perpetual non-exclusive commercial licence; it is Fairly Trained certified. — [Scored.tools review](https://scored.tools/blog/beatoven-ai-review-2026/) (third-party; official pricing not fetched)

### Inferences
- **Local first:** on a Mac, Stable Audio 3.0 Small SFX is the natural engine for batch-rendering hundreds of riser, whoosh and impact variants for free, with licence-clean outputs ("you own your outputs"). A Barrakudes-sized organisation is far below the $1M revenue threshold.
- **Live bridging:** Lyria RealTime (hosted) and MRT2 (local) are the only two tools that generate continuously and can be steered live. Lyria RealTime's BPM and scale need an abrupt `reset_context()`, so in practice you set the target BPM and key of song B at spin start and leave them. MRT2 runs offline on the presenter's MacBook (no network risk at a venue) with ~200 ms steering, but it has no documented BPM parameter, so tempo locking would need MIDI or audio conditioning or post-stretching. Both are experimental. The safer show approach is to pre-render their output to files rather than depend on a live stream.
- MusicGen/AudioGen are technically viable on Apple Silicon (about realtime for small) but CC-BY-NC weights make them a poor fit if the Quina is a ticketed or commercial event.
- Udio is unusable for this project as long as downloads stay disabled.
- Mubert's $49/mo trial for 100 tracks is expensive relative to ElevenLabs or Stable Audio for a one-off show asset library.

### Gaps
- Lyria RealTime pricing and quotas: not on the official pricing page (experimental).
- No measured end-to-end latency for Lyria RealTime from an official source.
- Stable Audio 3.0 Small SFX generation speed on Apple Silicon: no benchmark found.
- Whether Udio's licensed platform launched in Oct–Nov 2026: no source found covering those months.
- Beatoven official API pricing: not verified on beatoven.ai.

## 4. AI-generated transitions or bridges between two songs: research and practicality for 77 songs offline

### Takeaway
The research exists but there is no off-the-shelf tool. DJtransGAN (ICASSP 2022) learns EQ and fader curves, not new music. Apple's diffusion-guidance paper (2023) and JenBridge (2026) generate a new musical bridge by inpainting or regenerating a crossfade region. The practical route in Nov 2026 is commercial inpainting and continuation features (Stable Audio 2.5/3.0, ElevenLabs Music `conditioning_ref`/inpainting, Suno Extend and v6 mashups), run offline on short excerpts of song A's outro and song B's intro. That is feasible for 76 sequential pairs if the draw order is fixed in advance, and infeasible for all 5,852 ordered pairs.

### Cited Findings
- DJtransGAN (Chen et al., Sony internship; arXiv 2110.06525, ICASSP 2022) is a GAN whose generator uses two differentiable DSP components, an EQ and a fader, to mix two tracks. It was trained on 284 DJ mixes from livetracklist. Listeners noted good use of high-pass filtering in vocal-to-non-vocal transitions but transitions that happen "too fast" in vocal-to-vocal. Code and demos are at paulyuchen.com. — [arXiv 2110.06525](https://arxiv.org/abs/2110.06525); [project page](https://paulyuchen.com/djtransgan-icassp2022/)
- "Controllable Music Production with Diffusion Models and Guidance Gradients" (Apple; NeurIPS 2023 Diffusion workshop) covers continuation, inpainting, regeneration and "the creation of smooth transitions between two different music tracks" by regenerating a crossfaded section with sampling-time guidance. — [arXiv 2311.00613](https://arxiv.org/abs/2311.00613); [Apple ML Research](https://machinelearning.apple.com/research/controllable-music)
- JenBridge (arXiv 2606.01703, 2026) offers a "generative transition" that "synthesizes a novel musical bridge to contextually and seamlessly link two distinct audio segments" via a ControlNet-based inpainting adaptation of a text-to-music MMDiT, guided by angle-based interpolation between the two segments' embeddings. The authors cite "scarcity of dedicated musical transition data". An LLM agent (Qwen3-8B) picks the transition technique. — [JenBridge, arXiv 2606.01703](https://arxiv.org/html/2606.01703)
- DJustify (arXiv 2610.33434) is newer DJ-planning work for pop transitions that cites DJtransGAN. — [DJustify](https://arxiv.org/html/2610.33434)
- A Transformer-based "melody infilling" between past and future context is also published, along with "Generating Music Transition by Using a Transformer-Based Model". Both are symbolic, not audio. — [ResearchGate](https://www.researchgate.net/publication/364222840_Melody_Infilling_with_User-Provided_Structural_Context)
- Commercial building blocks: Stable Audio 2.5 audio inpainting — [Stability](https://stability.ai/news-updates/stability-ai-introduces-stable-audio-25-the-first-audio-model-built-for-enterprise-sound-production-at-scale); Stable Audio 3.0 multi-segment editing and causal continuation — [Stability](https://stability.ai/news-updates/meet-stable-audio-3-the-model-family-built-for-artistic-experimentation-with-open-weight-models); ElevenLabs Music `store_for_inpainting`, `source_from` ranges, and `conditioning_ref` AudioRefChunks — [ElevenLabs Compose](https://elevenlabs.io/docs/api-reference/music/compose); Suno v6 mashups "from multiple sources" and section editing — [Dubspot](https://blog.dubspot.com/suno-v6-2026)

### Inferences
- Feeding copyrighted song excerpts into a cloud generator for inpainting has two problems. It may breach the provider's terms on uploading third-party content (not verified per provider). And the output is a transformation of protected works (see Q7). A local model (Stable Audio 3.0 Small/Medium inpainting, or MRT2 conditioned on audio) avoids the upload but not the transformation question.
- A cheaper, rights-cleaner alternative to a true A→B bridge is a key- and tempo-matched **generic** bridge. Pre-generate 6–12 neutral beds (e.g. 100/110/120/128 BPM × a few keys) from Stable Audio, Eleven Music or Suno Sounds. At runtime, pick the bed closest to song B's BPM and key, time-stretch it to the spin length, and layer procedural risers on top. This needs only BPM and key analysis of the 77 MP3s.
- If the show order is shuffled ahead of time, 76 A→B bridges at about $0.08–0.20 each (Stable Audio API) is under $20 per show order. Render time is minutes on a GPU, longer locally.

### Gaps
- No released, maintained open-source tool was found that takes two audio files and outputs a generated bridge. JenBridge code availability was not confirmed.
- Whether each provider's terms allow uploading copyrighted reference audio for inpainting or continuation was not checked.

## 5. Procedural (non-AI) synthesis of risers, sweeps, impacts, snare rolls and whooshes in code

### Takeaway
All the core build-up effects are easy to synthesise deterministically with Web Audio or Tone.js. Filtered white noise with an exponential cutoff and gain ramp makes a riser or sweep. Noise plus a triangle body, repeated at accelerating rates, makes a snare roll. A pitch-swept saw or sine plus noise burst through reverb makes an impact or downlifter. Rendering with `OfflineAudioContext` / `Tone.Offline` gives sample-accurate files of any bar length at any BPM, faster than realtime, so effects can be generated on the fly for each spin's exact 5–11 s window.

### Cited Findings
- Tone.js `Noise` supports "white", "pink" and "brown" and loops a noise buffer. The docs example chains `Tone.Noise("pink")` into `Tone.AutoFilter({frequency:"8n", baseFrequency:200, octaves:8})`. — [Tone.js Noise docs](https://tonejs.github.io/docs/14.9.17/classes/Noise.html)
- `Tone.Offline(callback, duration, channels?, sampleRate?)` returns a `Promise<ToneAudioBuffer>` and "is capable of rendering much faster than real time". Only nodes created in the callback are recorded, and you must call `transport.start()` yourself. — [Tone.js Offline docs (v15)](https://tonejs.github.io/docs/15.0.4/functions/Offline.html). Vanilla equivalent: [MDN OfflineAudioContext](https://developer.mozilla.org/docs/Web/API/OfflineAudioContext). An example PR adds offline rendering plus WAV export (RIFF header and DataView PCM). — [liminal-hq/undertone PR #29](https://github.com/liminal-hq/undertone/pull/29)
- MDN's advanced-techniques tutorial builds a noise source from a random buffer through a BiquadFilter and recommends Tone.js for complex work. — [MDN Web Audio advanced techniques](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques)
- Riser recipe: white noise → low-pass or band-pass, cutoff automated upward; reverb wet rising, then cut hard at the drop. — [How To Make Electronic Music](https://howtomakeelectronicmusic.com/how-to-create-an-effective-rising-build-up/). Band-pass center 200 Hz → 8 kHz with volume -∞ → 0 dB and a widening stereo image. — [Tunary Instruments](https://tunaryinstruments.com/guides/how-to-make-a-riser/). -24 dB rising to -3 dB, then 0 dB, with the filter 200 Hz → 12 kHz "steady, then accelerating". — [BeatmakingTools](https://beatmakingtools.com/how-to/how-to-create-buildups)
- Snare synthesis: a 200 Hz triangle body (50 ms decay) plus white noise → band-pass 1500 Hz Q 0.6 (180 ms decay). — [DEV Community, sample-free drum synthesis](https://dev.to/sendotltd/sample-free-drum-synthesis-in-web-audio-building-kick-snare-and-hi-hat-from-oscillators-in-60-2c0k). A scheduled `snare(context, time)` with noise high-passed at 1 kHz plus a triangle. — [Clockworkchilli drum machine](https://clockworkchilli.com/blog/3_html5_drum_machine_with_web_audio). See also [Sonoport, synthesising sounds](https://sonoport.github.io/synthesising-sounds-webaudio.html) and [cofx.nl snare and hi-hat](https://blog.cofx.nl/browser-beats-snare-and-hi-hat.html)
- Beat-accurate scheduling with `startTime + n*quarterNoteTime`. — [Middle Ear Media](https://middleearmedia.com/timed-rhythms-with-web-audio-api-and-javascript/)
- SuperCollider "riser" SynthDef: saw pitch envelope 55 → 1760 Hz over 3.1 s, plus a "squiggly" SinOsc-modulated saw, panned with `Line.kr`, through `FreeVerb`. — [truthindustri.es](https://truthindustri.es/supercollider/2019/01/05/supercollider-riser.html); [gilesbowkett/basic-beat synths.scd](https://github.com/gilesbowkett/basic-beat/blob/master/synths.scd.erb). Envelope-driven `MoogFF` cutoff on a mix including `WhiteNoise`. — [monome norns engine study](https://monome.org/docs/norns/engine-study-1/)

### Inferences
- Suggested parametric generator, all derived from `bpm`, `bars` and `spinSeconds`:
  - **Noise riser:** `Noise("white")` → `Filter(bandpass)` with frequency exponential-ramped 200 → 10,000 Hz and gain -30 → 0 dB, ending exactly on the landing beat.
  - **Snare roll:** schedule hits at intervals that halve every bar (8ths → 16ths → 32nds), with gain and noise filter rising.
  - **Pitch riser:** saw/supersaw with frequency ramped up two octaves, optionally quantised to song B's key.
  - **Impact:** sine 60 → 30 Hz sub drop plus a noise burst and a long reverb tail at landing.
  - **Whoosh:** short band-passed noise with a fast up-and-down cutoff sweep and a stereo pan.

  Render with `Tone.Offline` to a buffer just before the spin, or compute at spin start: renders are faster than realtime.
- Procedural effects scale directly with how close the round is to a winner. Early rounds get a 1–2 bar riser plus impact; late rounds get 4–8 bars with a snare roll, pitch riser and voice drop stacked.
- Mixing procedural layers with a few AI or sampled "sweeteners" (a real crash or orchestra hit at the landing) usually sounds more produced than pure synthesis. This is a judgement, not sourced.

### Gaps
- No complete, ready-made Tone.js "riser + snare roll at BPM" open-source module was found. The code has to be assembled from the recipes above.

## 6. Royalty-free sample sources for DJ FX and their licenses

### Takeaway
Freesound (filter to CC0), Pixabay sound effects (Pixabay Content License: free, commercial, no attribution) and the free Sonniss GDC bundles (royalty-free, commercial, no attribution) cover risers, whooshes and impacts at no cost. Splice is a paid subscription whose licence covers sounds "as embodied in" a new recording or creative work and forbids redistributing raw samples.

### Cited Findings
- Freesound lets uploaders pick CC0, CC BY or CC BY-NC (Sampling+ is being removed). CC0: "you can do pretty much what you want with the sound"; you "can't claim you are the author". BY: "always mention the original creators". BY-NC: "you can't earn any money with the piece of work you create". A licence filter in search covers Free Cultural Works (CC0 and BY). — [Freesound FAQ](https://freesound.org/help/faq/)
- Freesound licences are per sound, so similar sounds can carry different terms; check each sound's page. — [Selekt Audio](https://selektaudio.com/guides/is-freesound-safe-for-commercial-use) (third-party)
- The Pixabay Content License allows free use without attribution and modification "into new works". It prohibits selling or distributing content "where no creative effort has been applied" and using it as a trademark. Users must check third-party consents. — [Pixabay license summary](https://pixabay.com/service/license-summary/). Pixabay content is not CC0, except content published before Jan 9, 2019. — [Sonilo comparison](https://sonilo.com/blog/comparisons/pixabay-music-sound-effects-alternatives-2026) (third-party)
- Sonniss GDC 2026 Game Audio Bundle (mid-Mar 2026): 7.47 GB, 347 WAV files. "No attribution is required… Everything is royalty-free and commercially usable." The licence is v2.0, effective Aug 27, 2026. An archive of previous years (over 200 GB) is available. — [gdc.sonniss.com](https://gdc.sonniss.com/); [Bedroom Producers Blog](https://bedroomproducersblog.com/2026/03/16/sonniss-gdc-2026-bundle/)
- Splice Terms: you may "modify, reproduce, publicly perform, distribute… Sounds as embodied in a New Recording" or Creative Work. Sounds are licensed, not sold. — [Splice Terms](https://splice.com/terms); "Every sound you download is yours to keep" — [Splice Sounds](https://splice.com/sounds); broad royalty-free licence per AlphaTheta/Pioneer integration — [Pioneer DJ support](https://support.pioneerdj.com/hc/en-us/articles/4410472966937-What-rights-do-I-have-for-samples-I-download-from-this-service)

### Inferences
- For a live show, effects played as part of the produced transition count as a "creative work" with creative effort applied, which fits Pixabay's and Splice's conditions. Raw one-shot playback is the grey zone for Splice.
- Recommended zero-cost starter kit: Sonniss GDC archive (impacts, whooshes, risers) plus Freesound CC0, filtered for "riser", "uplifter", "snare roll", "airhorn" and "crowd cheer". Keep a CSV recording source, URL and licence per file in the repo.

### Gaps
- Specific free "DJ riser packs" (for example from 99Sounds, Cymatics, Splice free packs) and their licences were not researched individually.
- Splice's position on triggering raw samples live, outside a finished recording, is not stated explicitly.

## 7. Legal note: playing copyrighted songs at a public event in Spain/Catalonia, and whether remix or mashup use changes anything

### Takeaway
Publicly playing recorded songs in Spain generally needs two licences: SGAE for authors and publishers, and AGEDI/AIE ("Somos Música") for producers and performers of the recordings. Paying one does not exempt the other. Short beat-synced transitions over the original tracks are still public performance of those recordings. Creating and exploiting a remix, mashup or AI-generated bridge that transforms a song touches the separate **transformation right** (LPI art. 21), which an SGAE public-performance licence does not grant. Self-made jingles and procedural or AI effects owned by the organisers are not SGAE repertoire.

### Cited Findings
- SGAE's 2026 general tariff book offers events either the general tariff or a lump-sum ("tanto alzado") tariff based on capacity and average ticket price. Unlicensed use can be charged at the lump-sum rate plus 5% extra costs. — [SGAE Libro de Tarifas 2026](https://documentos-sgae.s3.eu-west-1.amazonaws.com/2026+SGAE+Libro+de+Tarifas+V1.pdf)
- Example municipal rates (2025) for "bailes esporádicos con música en vivo o grabada", per event: €6.57 (towns up to 500 inhabitants), €13.19 (1,001–3,000), €32.88 (provincial capitals). — [SGAE Tarifas 2025, entidades públicas](https://documentos-sgae.s3.eu-west-1.amazonaws.com/2025/WEB/Tarifas+clientes/Entidades+publicas/1+TARIFAS+SGAE+2025+EEPP.pdf)
- A legal blog cites the concert tariff as 8.5% of box office (excl. VAT) with a minimum based on 20% of capacity. If performers play only their own works not registered with SGAE, nothing is owed. — [Sympathy for the Lawyer](https://sympathyforthelawyer.com/blog/pagar-a-sgae-por-mis-propios-conciertos/) (about 3 years old; may be outdated)
- "Somos Música" is the joint AGEDI (producers) and AIE (performers) licensing brand for using recorded music in businesses and events open to the public. Collective management of these rights is mandatory by law. Owning a CD or a streaming subscription covers only private use. — [Somos Música](https://somos-musica.es/); [Somos Música FAQ](https://somos-musica.es/preguntas-frecuentes); [AGEDI-AIE FAQ](https://www.agedi-aie.es/41-faq/comunicacion-publica). Municipalities have a specific licence for fiestas and events. — [Somos Música, ayuntamientos](https://somos-musica.es/licencias/empresas/ayuntamientos)
- SGAE collects for the song (authors); AGEDI/AIE for the recording. At events with DJs or recorded music all three apply, and paying SGAE doesn't exempt AGEDI/AIE. — [FuturaTickets](https://futuratickets.com/en/blog/sgae-agedi-aie-eventos-musicales) (third-party ticketing blog)
- LPI art. 21: transformation includes "cualquier otra modificación en su forma de la que se derive una obra diferente". The original author keeps the right to authorise exploitation of the transformed work. Art. 17 lists transformation among the author's exclusive rights. — [Iberley, art. 21 LPI](https://www.iberley.es/legislacion/articulo-21-ley-propiedad-intelectual)
- A remix or mashup needs authorisation from the original rights holders for public exploitation, except under narrow limits such as quotation or parody. — [Confilegal (Aug 2025)](https://confilegal.com/20250811-opinion-remix-mashup-y-derecho-de-autor-el-uso-transformador-en-la-jurisprudencia/). Sampling or changing rhythm or tempo requires prior authorisation from the transformation-right holder. — [LegalToday](https://www.legaltoday.com/practica-juridica/derecho-civil/nuevas-tecnologias-civil/pueden-considerarse-los-arreglos-musicales-como-una-obra-derivada-2017-10-31/). In the Spanish Supreme Court's "Maite" case (STS 17-07-2008), an SGAE licence to record did not authorise an unauthorised arrangement. — [Iustel](https://www.iustel.com/diario_del_derecho/noticia.asp?ref_iustel=1032304)

### Inferences
- In practice, venues or municipalities often already hold SGAE and AGEDI/AIE licences, and the organiser should confirm who holds them for the Quina venue. DJ-style crossfades and effects layered over the original tracks during a live show are commonly treated as performance of the original recordings. The higher-risk acts are **recording or distributing** a mix, or generating new derivative audio (AI bridges, inpainting) from the copyrighted tracks.
- Branded jingles, voice drops and effects that Barrakudes generates with tools whose terms grant commercial rights are not SGAE repertoire unless the group registers them.
- This is not legal advice; the exact Quina tariff depends on capacity, ticket price and venue type.

### Gaps
- No SGAE tariff line specifically for "music bingo" was found. Whether it falls under "bailes esporádicos", background music or concerts is unclear.
- AGEDI/AIE event tariff amounts were not found in the results.
- No Spanish case law specific to live DJ transitions and effects (as opposed to recorded remixes) was found.

## 8. Concrete recommendations: what to pre-generate, with which tool, at what cost

### Takeaway
Use a hybrid. Procedural Web Audio/Tone.js synthesis supplies tempo-exact risers, snare rolls and sweeps generated per spin, at zero cost. A small pre-generated "sweetener" library comes from ElevenLabs SFX v3 and/or local Stable Audio 3.0 Small SFX, topped up with free CC0 and Sonniss impacts. An ElevenLabs v4 designed Catalan announcer voice handles drops. A branded jingle comes from Eleven Music (licensed-data, API) or Suno Pro (web app, best vocals, open litigation). Real-time AI bridging (Lyria RealTime / MRT2) is an optional experiment, pre-rendered to files.

### Cited Findings
(Cost inputs; see sections above for full citations.)
- ElevenLabs SFX $0.12/min; Music $0.15/min; TTS v4 $0.08/1K chars; Starter plan $6/mo. — [ElevenLabs API pricing](https://elevenlabs.io/pricing/api)
- SFX `duration_seconds` 0.5–30 s; loop only on v2. — [ElevenLabs API reference](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert); [SFX v3 blog](https://elevenlabs.io/blog/sfx-v3-for-developers)
- Eleven Music section `duration_ms` 3–120 s, enforced on v2 models. — [ElevenLabs Compose](https://elevenlabs.io/docs/api-reference/music/compose)
- Suno Pro $10/mo, 20 commercial downloads a month; "Sounds" loops with key/BPM. — [Suno pricing](https://suno.com/pricing); [Suno release notes](https://suno.com/release-notes)
- Stable Audio 3.0 Small SFX is open weights with "you own your outputs" under the Community License. — [Stability AI](https://stability.ai/news-updates/meet-stable-audio-3-the-model-family-built-for-artistic-experimentation-with-open-weight-models)
- Lyria 3 Clip Preview (30 s loops) $0.04; Lyria 3.5 $0.08 per song. — [Gemini API pricing](https://aistudio.google.com/docs/pricing)
- Lyria RealTime BPM 60–200 plus scale, with an abrupt change on reset. — [Lyria RealTime docs](https://aistudio.google.com/docs/realtime-music-generation)

### Inferences
Proposed asset plan (cost estimates are my arithmetic from the cited prices; they exclude re-roll overhead unless stated):

| Asset | Quantity / spec | Tool | Est. cost |
|---|---|---|---|
| Noise risers, snare rolls, pitch risers, down-sweeps | Generated per spin at exact BPM × bars (1, 2, 4, 8 bars) to fit 5–11 s | Procedural Tone.js / `Tone.Offline` (Q5) | $0 |
| "Sweetener" risers/uplifters with texture | ~24 files: 2/4/8 bars at 100, 110, 120, 128 BPM (2.0–19.2 s, all ≤30 s) | ElevenLabs SFX v3 (`duration_seconds` exact, `prompt_influence` ~0.6) or Stable Audio 3.0 Small SFX locally | ~$0.50 (24 × ~10 s ≈ 4 min × $0.12) ×5 re-rolls ≈ $2.50; or $0 locally |
| Impacts / booms / reverse cymbals / whooshes | ~30 one-shots | Sonniss GDC + Freesound CC0, plus ElevenLabs SFX for gaps | $0–1 |
| Tension loop beds for the spin | 6–8 seamless loops (drumroll, ticking, crowd murmur, pulsing synth) | ElevenLabs SFX v2 `loop:true`, or Suno "Sounds" loops at chosen key/BPM, or Lyria 3 Clip | ~$1 (ElevenLabs) / Suno Pro $10/mo / $0.04 each (Lyria Clip) |
| Branded "Quina Barrakudes" jingle + 3–5 stingers (2–8 s) | Composition plan with fixed-duration chunks at show BPM | Eleven Music v2.5 (API, licensed-data) and/or Suno v6 (web, best vocals) | Eleven: ~20 attempts × 15 s ≈ 5 min ≈ $0.75; Suno: $10 (1 month Pro, 20 downloads) |
| Announcer voice drops (Catalan + Spanish) | ~100 lines: "Següent cançó!", "Atenció…", countdown "3, 2, 1", "Últimes cançons!", "Quina!", hype lines for late rounds | ElevenLabs `eleven_ttv_v3` voice design + `eleven_v4` TTS | ~3K chars × $0.08/1K ≈ $0.25; Starter plan $6/mo |
| Late-game "hype" bridge beds (optional) | 6–12 key/BPM-bucketed beds of 8–16 bars | Stable Audio 3.0 Medium (local) / Eleven Music / Lyria RealTime captured to file | $0–5 |
| Experimental live AI bridge | Stream during spin, steered toward song B's genre/BPM | Lyria RealTime (hosted, experimental) or MRT2 (local Apple Silicon) | Lyria RT price unpublished; MRT2 $0 |

- **Total for a complete first library:** roughly **$10–25** (one month of ElevenLabs Starter or Creator, plus optionally one month of Suno Pro), with procedural effects free.
- **Runtime logic:** read song B's BPM and key (pre-analysed for all 77 MP3s), pick the sweetener and bed bucket nearest that BPM, time-stretch to the spin duration, render the procedural layers with `Tone.Offline` for the exact length, and place the impact plus a voice drop on the landing beat. Scale the layer count and length by "songs remaining" (short early, long and dense near the end).
- **Licensing hygiene:** prefer licensed-data generators (ElevenLabs, Stable Audio 3.0, Lyria) for anything played publicly. Keep a manifest of tool, plan, date and licence per asset. Don't feed the copyrighted 77 songs into cloud generators for "true" A→B bridges unless the rights question in Q7 is resolved.

### Gaps
- Actual listening quality of each tool for these specific FX was not tested; a short A/B listening session is recommended before committing.
- Whether a Catalan-language sung jingle works acceptably on Eleven Music or Suno is unverified.
