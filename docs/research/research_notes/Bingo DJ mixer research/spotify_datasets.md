# Spotify-derived datasets (Anna's Archive and others) as a source of per-track musical metadata

Research date: 2026-11-23. All dates below are as reported by the cited source. Every claim has an inline source. "My check" means something I observed directly on 2026-11-23 by querying the named endpoint (HTTP requests contained only Spotify track IDs or dataset names).

## 1. What did Anna's Archive release? (dates, scope, fields, audio features vs. audio analysis, formats, sizes, distribution)

### Takeaway
On 2025-12-20 Anna's Archive announced a scrape of Spotify (snapshot about July 2025): metadata for about 256M tracks, plus 86M audio files (~300 TB). Only the metadata torrents (<200 GB compressed, SQLite) were formally released, in Dec 2025. That metadata **includes Spotify "audio features"** (tempo, key, mode, time_signature, energy, danceability, valence, loudness, etc.) in a separate SQLite DB. The **"audio analysis" (bars/beats/tatums/sections/segments)** was scraped for only about 40M tracks (4 TB compressed, `##.json.zst`). It was not on the release checklist, and I found no evidence it was ever publicly released or mirrored. The Spotify torrents were later pulled after a US court injunction.

### Cited Findings
**Dates and scope**
- The blog post "Backing up Spotify" is dated 2025-12-20. It says "We backed up Spotify (metadata and music files)", distributed in bulk torrents (~300 TB) grouped by popularity. — [Anna's Blog](https://annas-archive.gl/blog/backing-up-spotify.html)
- Scope: metadata for about 99.9% of tracks (256 million tracks, 186 million unique ISRCs). There are 86 million music files representing about 99.6% of listens, "a little under 300TB". — [Anna's Blog](https://annas-archive.gl/blog/backing-up-spotify.html)
- The 86M files are about 37% of Spotify's catalog. The archive goes up to July 2025, based on the torrent file names. — [Android Authority](https://www.androidauthority.com/spotify-annas-archive-3627023/), [Neowin](https://www.neowin.net/news/annas-archive-claims-to-have-backed-up-spotify-in-a-300tb-preservation-archive/) (as summarised in search results)
- Audio format: OGG Vorbis 160 kbit/s for popularity > 0, and OGG Opus 75 kbit/s for popularity = 0. — [Anna's Blog](https://annas-archive.gl/blog/backing-up-spotify.html)

**Metadata files and fields (from the blog's file list)**
- `spotify_clean.sqlite3` holds the tables `artists`, `albums`, `tracks`, `artist_genres`, `artist_images`, `artist_albums`, `available_markets`, `album_images` and `track_artists`. "The metadata for artists, albums, tracks is less than 200 GB compressed." — [Anna's Blog](https://annas-archive.gl/blog/backing-up-spotify.html). HN commenters quoted the checklist as "199GB, only metadata released for now". — [Hacker News](https://news.ycombinator.com/item?id=46338339) (as summarised in search results)
- `spotify_clean_audio_features.sqlite3` holds the table `track_audio_features`, one row per track. Columns: `track_id, fetched_at, null_response, duration_ms, time_signature, tempo, key, mode, danceability, energy, loudness, speechiness, acousticness, instrumentalness, liveness, valence`. This is "a scrape of AudioFeatures objects from the Spotify API". — [Anna's Blog](https://annas-archive.gl/blog/backing-up-spotify.html)
- `spotify_clean_playlists.sqlite3` covers 6.6M playlists and 1.7B playlist tracks. `spotify_clean_track_files.sqlite3` maps tracks to archived files, with `status` values such as `success`, `error_not_available`, `skipped_isrc_has_download` and `skipped_low_priority`. There are also raw JSONL.zst files for audiobooks, podcasts and episodes. — [Anna's Blog](https://annas-archive.gl/blog/backing-up-spotify.html)
- Other fields: ISRCs, popularity, artist genres, available markets and album art. Coverage describes these as "compact, queryable SQLite databases, including artist genres, album art, track popularity, licensing info, and even audio analysis features like tempo, valence, and danceability". — [CyberInsider](https://cyberinsider.com/annas-archive-releases-massive-300tb-spotify-music-scrape/) (as summarised in search results). Album release dates are present in a derivative dataset built from this scrape (`album_release_date` column), which implies the albums table has release dates. — [HF: GildasLeDrogoff/spotify-huge-track-analysis-dataset](https://huggingface.co/datasets/GildasLeDrogoff/spotify-huge-track-analysis-dataset) (my check of its columns)
- The blog gives descriptive statistics: BPM is "normally distributed with a mean around 120", and loudness correlates with energy. — [Anna's Blog](https://annas-archive.gl/blog/backing-up-spotify.html)

**Audio analysis (the beat/bar/section data)**
- The blog lists `annas_archive_spotify_2025_07_audio_analysis.torrent/##.json.zst` as "Raw JSON API responses for audio analysis". It "Contains around 40 million rows, fetched in descending priority order", and many songs return 404 (no analysis). "The secondary metadata of audio analysis is 4TB compressed." — [Anna's Blog](https://annas-archive.gl/blog/backing-up-spotify.html)
- The release checklist has only "[X] Metadata (Dec 2025)" ticked. Unticked items: music files, additional file metadata, album art, .zstdpatch files. Audio analysis is not on the checklist. — [Anna's Blog](https://annas-archive.gl/blog/backing-up-spotify.html)
- Press coverage in Dec 2025 said "Audio analysis JSONs, album art files, and diff patches ... are expected in later release stages." — [CyberInsider](https://cyberinsider.com/annas-archive-releases-massive-300tb-spotify-music-scrape/), [Hacker News](https://news.ycombinator.com/item?id=46338339) (as summarised in search results)
- The Spotify audio-analysis JSON format contains `track` (tempo, tempo_confidence, key, key_confidence, mode, mode_confidence, time_signature, time_signature_confidence, loudness, end_of_fade_in, start_of_fade_out). It also contains `bars`, `beats` and `tatums` (start, duration, confidence each); `sections` (start, duration, confidence, loudness, tempo, key, mode, time_signature, each with confidences); and `segments` (start, duration, confidence, loudness_start/max/max_time/end, 12 pitches, 12 timbre). — [Spotify Web API reference](https://developer.spotify.com/documentation/web-api/reference/get-audio-analysis)

**Distribution and later events**
- The release was torrents only. Individual-file downloads were offered only as a possibility "if there is enough interest". — [Anna's Blog](https://annas-archive.gl/blog/backing-up-spotify.html)
- After the injunction, the Spotify download section was removed and marked "unavailable until further notice". The Spotify torrents were removed from torrents.json and the torrents page. — [TorrentFreak, 2026-02-11](https://torrentfreak.com/annas-archive-quietly-releases-millions-of-spotify-tracks-despite-legal-pushback/)
- On 2026-02-08, 47 music torrents labelled "pop_0" appeared without announcement: about 2.8M files, ~6 TB, file names are Spotify track IDs. A new metadata torrent with a 29 GB "seekable" file came with them. They were later removed. In March, Anna's Archivist said the music torrents were "released accidentally". — [TorrentFreak](https://torrentfreak.com/annas-archive-quietly-releases-millions-of-spotify-tracks-despite-legal-pushback/)
- My check on 2026-11-23: `https://annas-archive.gl/torrents/spotify` returns HTTP 404. — [annas-archive.gl/torrents/spotify](https://annas-archive.gl/torrents/spotify)
- Naming conflict: a Hugging Face derivative says it was built from a "spotify_2024" torrent with files `track_metadata.sqlite3` / `audio_features.sqlite3`. These names differ from the blog's `spotify_clean*.sqlite3` / `2025_07` naming. — [HF: ozefe/spotify_audio_features README](https://huggingface.co/datasets/ozefe/spotify_audio_features)

### Inferences
- For our purpose, the useful part of the Anna's release is the audio-features table: one tempo, key, mode, time_signature and loudness value per track, plus energy, danceability and valence. That table is already mirrored in queryable form (see Q2). The data that would really help a phrase-aligned mixer (beats, bars, sections with confidences) is in the audio-analysis set. It covers only ~40M tracks, is 4 TB, apparently was never released, and in any case came from a source that is now under a court order. In practice we cannot get Spotify's beat grids or sections.
- The `fetched_at` values I saw in the mirrors (e.g. 1755734400000 = 2025-08-21, 1746057600000 = 2025-05-01) suggest the audio-features scrape ran over spring and summer 2025, after Spotify closed the endpoint to new apps.

### Gaps
- I found no reliable confirmation that the audio-analysis torrent was ever seeded publicly, and no mirror of it.
- No lyrics or preview-URL fields are documented in the blog. I could not confirm either way whether `tracks` contains `preview_url`.
- The exact column lists of `tracks` and `albums` in `spotify_clean.sqlite3` were not visible in the sources I could read.
- Coverage of `track_audio_features` is not stated in the blog. The mirrors (Q2) have ~255.6M rows, about equal to the track count, including `null_response` rows.

## 2. Is there a small, queryable, metadata-only copy (HF datasets-server, SQLite, lookup service) usable for 77 IDs?

### Takeaway
Yes, for **audio features only**. Two routes work with plain HTTP requests keyed by Spotify ID and no bulk download:
1. The free **ReccoBeats API** (`/v1/audio-features?ids=`). It returns values **identical to Spotify's original audio features**.
2. The **Hugging Face datasets-server `/filter` API** on derivatives of the Anna's Archive audio-features table and on older Kaggle pulls.

Coverage for our 77 `spotifyId`s (2026-11-23):

| Source | Tracks found (of 77) |
|---|---|
| Any source combined | **68** |
| GildasLeDrogoff (fully indexed) | 66 |
| ReccoBeats | 53 |
| P-Arpan (Kaggle merge) | 28 |
| maharshipandya | 19 |
| ozefe (partially indexed) | 17 |
| monology | query failed |

The results are saved in `experiments/mixer-poc/data/spotify_features.json`, keyed by song id, with source and license for each value. None of these sources has a queryable copy of the audio analysis (beats, bars, sections), and I found none anywhere else.

### Cited Findings
**Hugging Face mirrors of the Anna's Archive audio-features table**
- `monology/spotify-track-features` was created 2026-01-12. It has the same columns as `track_audio_features` plus `rowid`; 255,594,909 rows; 80 parquet shards, 12.6 GB; no license stated in the card. Its commit history shows "Delete spotify_clean_audio_features.sqlite3.zst". — [HF API: monology/spotify-track-features](https://huggingface.co/api/datasets/monology/spotify-track-features), [commits](https://huggingface.co/datasets/monology/spotify-track-features/commits/722592497eddd5bfa78e311a48019a360c183fc2) (my check)
- `ozefe/spotify_audio_features` joins the tracks table (id, name, popularity) with audio features: 255,593,643 rows, 12.05 GB parquet (ZSTD). License tag "other", `license_name: spotify-developer-terms`. The README credits Anna's Archive as the source. — [HF: ozefe/spotify_audio_features](https://huggingface.co/datasets/ozefe/spotify_audio_features) (my check)
- `GildasLeDrogoff/spotify-huge-track-analysis-dataset` has one 4.1 GB parquet with 56,277,664 rows. It has one row per (track_id, artist), popularity > 0 only, and columns for album release date, popularity, tempo/key/mode and the other features. License CC-BY-NC-4.0. Despite the name, it has no beat or section data. — [HF: GildasLeDrogoff](https://huggingface.co/datasets/GildasLeDrogoff/spotify-huge-track-analysis-dataset) (my check)
- `GD-Studio/embeat_45m_spotify_tracks` has 45M tracks combined with Anna's Archive metadata and Every Noise genres. It is CC-BY-NC-4.0 and gated (requires login). — [HF: GD-Studio/embeat_45m_spotify_tracks](https://huggingface.co/datasets/GD-Studio/embeat_45m_spotify_tracks)
- The datasets-server reports `filter: true` for these mirrors (`/is-valid`). In practice, the first `/filter` calls return "the dataset index is loading" for minutes. For `ozefe` the index came back with `"partial": true`, meaning only part of the 12 GB is indexed. For `monology` it returned "Unexpected error" or "loading" for more than 30 minutes. — [datasets-server is-valid](https://datasets-server.huggingface.co/is-valid?dataset=monology/spotify-track-features) (my check)
- The mirrors' rows are in SQLite rowid order, not sorted by track_id (e.g. rowid 1 = `2Pe9cbhOTvOUTDE4bl7zzl`). So parquet row-group statistics cannot prune a lookup, and reading remote parquet with HTTP range requests would still mean scanning the whole multi-GB track_id column. — [datasets-server /rows](https://datasets-server.huggingface.co/rows?dataset=monology/spotify-track-features&config=default&split=train&offset=0&length=5) (my check)

**ReccoBeats**
- ReccoBeats is free and needs no API key. It accepts Spotify IDs (and, since Dec 2025, ISRCs) on `/v1/track` and `/v1/audio-features?ids=`. It returns 404 for unknown tracks and offers upload-based extraction (`POST /v1/analysis/audio-features`). — [ReccoBeats docs](https://reccobeats.com/docs/apis/get-audio-features), [Lewis Does Data](https://www.lewisdoesdata.com/2025/11/05/rescuing-a-reproducibility-fail.html), [taylor R package](https://rdrr.io/cran/taylor/man/get_reccobeats_audio_features.html) (as summarised in search results)
- Rate limits are "configured internally" and not published. Honour `Retry-After` on 429 and avoid bursts. — [ReccoBeats rate limiting](https://reccobeats.com/docs/documentation/rate-limiting)
- The ToS were updated 2026-05-25. The service is "entirely free to use for both personal and commercial projects", provided "as is", and no attribution is required. Core track metadata is aggregated from Spotify and governed by third-party terms. The ToS say nothing on caching. — [ReccoBeats ToS](https://reccobeats.com/docs/documentation/terms-of-service)
- My check: the audio-features response has `id, href (open.spotify.com/track/<id>), isrc, acousticness, danceability, energy, instrumentalness, key, liveness, loudness, mode, speechiness, tempo, valence`. It has **no `time_signature` and no `duration_ms`**; duration and popularity come from `/v1/track`. For all 10 of our tracks present in both ReccoBeats and the Anna-derived `ozefe` mirror, tempo, key, mode and energy matched to every decimal (e.g. Viva La Vida: 138.015 BPM, key 5, minor). ReccoBeats therefore serves Spotify's original audio-feature values, not its own estimates. — [ReccoBeats API](https://api.reccobeats.com/v1/audio-features?ids=0bYg9bo50gSsH3LtXe2SQn) (my check)

**Smaller Kaggle-derived HF sets (pre-2024 Spotify API pulls)**
- `P-Arpan/Mood_Based_Music_Search` merges five Kaggle Spotify datasets into 2,577,667 unique tracks (176 MB parquet). Sources: rodolfofigueroa "Spotify 1.2M+ songs", amitanshjoshi "spotify-1million-tracks", maharshipandya "spotify-tracks-dataset", joebeachcapital "30000 spotify songs" and thedevastator "spotify-tracks-genre". Licensed ODbL / Spotify Developer ToS. — [HF: P-Arpan/Mood_Based_Music_Search](https://huggingface.co/datasets/P-Arpan/Mood_Based_Music_Search)
- `maharshipandya/spotify-tracks-dataset` has 114,000 tracks across 125 genres (13.6 MB), BSD license. — [HF: maharshipandya/spotify-tracks-dataset](https://huggingface.co/datasets/maharshipandya/spotify-tracks-dataset)

**My fetch results (2026-11-23)**
- `GildasLeDrogoff/spotify-huge-track-analysis-dataset` is fully indexed (`"partial": false`). `/filter` with an OR-chain of 20 IDs per call found **66/77**. — [HF: GildasLeDrogoff](https://huggingface.co/datasets/GildasLeDrogoff/spotify-huge-track-analysis-dataset) (my check)
- `P-Arpan/Mood_Based_Music_Search` found 28/77, and `maharshipandya/spotify-tracks-dataset` found 19/77, both fully indexed. `ozefe` found 17/77 (partial index). `monology` returned HTTP 500 "Unexpected error" or "index loading". `IN (...)` is rejected by `/filter` (HTTP 422); `"col"='a' OR "col"='b'` works. — (my check)
- Combined coverage is **68/77**. Not found anywhere: ids 12 (capaz – Alleh/Yorghaki), 18 (Danza Kuduro), 21 (El Tiburón), 22 (Everytime We Touch), 24 (Flying Free), 32 (La Bomba), 51 (No Puedo Vivir Sin Ti), 55 (Purpurina) and 70 (Una Vaina Loca). — (my check; data in `experiments/mixer-poc/data/spotify_features.json`)
- Across 808 pairwise field comparisons between sources, values were identical except in 4 tracks, all between the 2025 snapshot and the older Kaggle (pre-2024) pulls. Example: Devuélveme a mi chica has tempo 172.547 vs 172.676 and energy 0.936 vs 0.843; On The Floor has 130.003 vs 130.0. So Spotify re-analysed some tracks over time. — (my check)

### Inferences
- The shortest practical path is ReccoBeats first (batched `ids=`, about 20 per call, with a pause between calls), then the HF `/filter` on GildasLeDrogoff for gaps. Every value from either route is the same Spotify audio-features number, so there is no real "second opinion" between them.
- The 9 misses are mostly Spanish dance or latin catalog tracks. Their IDs may be compilation versions that were never analysed (`null_response`), or they sit in the unindexed part of the 255M-row mirrors. Trying the canonical Spotify ID or ISRC (ReccoBeats accepts ISRC) is the cheap next step.
- Several of our tracks that ReccoBeats lacks have very low Spotify popularity in the mirror (e.g. Dancing Queen pop=3, Boom Boom Boom Boom pop=3, Elefants pop=0). This suggests some `spotifyId`s in songs.json point to compilation or alternate releases rather than the canonical recording. Switching to canonical IDs (or looking up by ISRC) would likely raise coverage.

### Gaps
- I could not get a complete (non-partial) HF index for the 255M-row mirrors in the time available. Tracks reported "not found" there may simply sit in the unindexed part.
- ReccoBeats' catalog size and update policy are not documented.

## 3. Responses (Spotify, labels), and legal/practical considerations of using factual metadata for 77 tracks

### Takeaway
Spotify and the three majors sued in SDNY. They obtained a preliminary injunction (January 2026) and a default judgment of **$322.2M** (April 2026) with a worldwide domain injunction. The damages rest on **sound-recording copyright and DMCA §1201/1203 circumvention** of the audio, not on metadata. Using a handful of factual values (tempo, key) for 77 tracks as a cross-check is low-risk in substance. The EU sui generis database right only bites on substantial or systematic extraction. The cleanest sources are still ReccoBeats (its own ToS) or our own analysis, and we should not redistribute any Spotify-derived table.

### Cited Findings
- Spotify's statement: "An investigation into unauthorized access identified that a third party scraped public metadata and used illicit tactics to circumvent DRM to access some of the platform's audio files." — [Android Authority](https://www.androidauthority.com/spotify-annas-archive-3627023/)
- Plaintiffs were Spotify, UMG, Sony Music and Warner, against the unknown operators, in SDNY before Judge Jed Rakoff. — [TorrentFreak](https://torrentfreak.com/annas-archive-loses-322-million-spotify-piracy-case-without-a-fight/), [Music Ally, 2026-01-21](https://musically.com/2026/01/21/the-major-labels-are-suing-spotify-scraper-annas-archive/)
- The complaint reportedly alleges copying of "metadata for about 256 million audio tracks (e.g., artist, album, and track name) and 86 million music files". — [Music Business Worldwide](https://www.musicbusinessworldwide.com/record-labels-spotify-sue-pirate-group-annas-archive-over-scraping-and-brazen-theft-of-86m-tracks/) (quoted via search summary; direct fetch returned 403)
- Preliminary injunction date conflicts. TorrentFreak says Rakoff signed it on January 16. Other reports say it was issued January 20. It targeted registries, hosts and Cloudflare, and several domains were lost; the .gl domain persisted. — [TorrentFreak](https://torrentfreak.com/annas-archive-quietly-releases-millions-of-spotify-tracks-despite-legal-pushback/); contradicted by [Wikipedia: Anna's Archive](https://en.wikipedia.org/wiki/Anna's_Archive) (as summarised in search results)
- The default judgment was entered about 2026-04-14 (Wikipedia: 04-15). It awards $322.2M: Spotify $300M = $2,500 × 120,000 files under 17 U.S.C. §1203(c)(3)(A); Warner $7.2M; Sony $7.5M; UMG $7.5M (statutory $150k per work). It adds a permanent worldwide injunction against 10 domains and an order to destroy all copies of "works scraped from Spotify". The article does not say the judgment separately covers metadata. — [TorrentFreak, 2026-04-15](https://torrentfreak.com/annas-archive-loses-322-million-spotify-piracy-case-without-a-fight/), [Billboard](https://www.billboard.com/pro/spotify-major-labels-win-music-piracy-lawsuit/)
- The original complaint reportedly claimed $13 trillion. — [Exclaim!](https://exclaim.ca/music/article/record-labels-spotify-sue-anna-s-archive-for-13-trillion-alleging-theft)
- Spotify cut off Audio Features and Audio Analysis (plus Recommendations and others) for new Web API use cases on 2024-11-27. New apps get 403. — [Spotify for Developers blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api), [Spotify Community](https://community.spotify.com/t5/Spotify-for-Developers/Web-API-Get-Track-s-Audio-Features-403-error/td-p/6654507)
- **EU database right.** Directive 96/9/EC protects databases built with "substantial investment" in obtaining, verifying or presenting contents. The right is against extraction or re-utilisation of the whole or a **substantial part**. Recital 45: it is not "an extension of copyright protection to mere facts or data". Art. 8(1): lawful users may extract insubstantial parts. Art. 7(5): repeated and systematic extraction of insubstantial parts is still prohibited. — [Directive 96/9/EC (WIPO Lex)](https://www.wipo.int/wipolex/en/text/126788), [EUR-Lex summary](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=LEGISSUM%3Al26028)
- In CJEU *Directmedia* (C-304/07, 2008), copying with adaptation counts as extraction. In *Ryanair* (C-30/14), where no database right applies, the owner can restrict use by contract (ToS). — [ipcuria C-304/07](https://ipcuria.eu/case?reference=C-304%2F07), [Commission evaluation SWD(2018) 146](https://openfuture.eu/wp-content/uploads/2021/12/2018swd-Evaluation-of-Directive-969ECpdf.pdf)
- The HF mirrors label their data "Spotify Developer Terms" (ozefe, P-Arpan) or CC-BY-NC-4.0 (GildasLeDrogoff, GD-Studio). monology states no license. — [ozefe](https://huggingface.co/datasets/ozefe/spotify_audio_features), [P-Arpan](https://huggingface.co/datasets/P-Arpan/Mood_Based_Music_Search), [GildasLeDrogoff](https://huggingface.co/datasets/GildasLeDrogoff/spotify-huge-track-analysis-dataset)

### Inferences
- 77 rows × ~6 numeric fields is plainly an insubstantial part of a 256M-track database. They are facts (BPM, key) that our own analysis independently re-derives. The realistic exposure is contractual or ToS-based (Spotify Developer Terms bind API users, not us) and reputational (relying on a piracy-sourced dataset). Copyright and database-right exposure is minimal. This is not legal advice.
- Practical recommendation:
  - Prefer ReccoBeats as the documented source: free commercial use per its ToS, and the values are identical anyway.
  - Treat the HF-mirror rows as a private, internal cross-check only. Do not ship them in the product, do not republish the JSON, and do not bulk-download the mirrors.
  - Our own analysis (beat_this, all-in-one, essentia) is the authoritative source and has no third-party dependency.
- The audio from the Anna's torrents is the clearly infringing part, and it is what the injunction and damages target. We are not using it.

### Gaps
- I did not read the complaint or judgment PDFs themselves. Whether the permanent injunction's "destroy copies" wording extends to metadata derivatives is unclear from the press coverage.
- I found no reports of takedowns against the Hugging Face mirrors as of 2026-11-23. All four were still accessible in my check, but absence of evidence is not proof.
- I found no reports of Spotify user account bans tied to this scrape.

## 4. Alternatives that may cover our songs; which can be looked up by Spotify ID or ISRC

### Takeaway
By Spotify ID with no bulk download:
- **ReccoBeats**: free; also looks up by ISRC.
- **Soundcharts**: paid; by Spotify ID or ISRC.
- **Musicae**: RapidAPI, 10 requests/day free.
- **Sonovault**: tempo and key only, independently measured; by Spotify ID or ISRC.

GetSongBPM is name-search only. **AcousticBrainz** (CC0, frozen 2022, MBID-keyed) and the **Million Song Dataset** (Echo Nest analysis *with* beats, bars and sections, but songs up to ~2010 and no Spotify IDs) are the only open sources with richer data. Neither is practical for 77 mostly recent Spanish and Catalan tracks.

### Cited Findings
- **Soundcharts API**: `GET /api/v2.25/song/by-platform/{platform}/{identifier}` and `/song/by-isrc/{isrc}` return song metadata including audio data (tempo, key, mode, time signature, loudness, energy, valence, danceability, etc.). Commercial, paid. — [Soundcharts API docs](https://developers.soundcharts.com/documentation/reference/song/get-song-metadata), [Soundcharts audio-features API](https://soundcharts.com/en/audio-features-api), [changelog](https://developers.soundcharts.com/changelog)
- **Musicae**: "Spotify-compatible" `GET /v1/audio-features/{id}` via RapidAPI. Free tier is 10 requests/day; paid from $9.99/mo. No audio analysis. The data source is not stated. — [Musicae](https://api.musicae.io/spotify-audio-features/)
- **Sonovault**: `POST /v1/tracks/resolve` (up to 100 Spotify IDs) and `GET /v1/tracks/isrc/:isrc`. Returns tempo (Lexicon DJ beat detector) and key (OpenKeyScan) only, with no time signature or energy. Free key with 1,000 credits/month. Page dated Oct 2026. — [Sonovault](https://sonovault.now/resources/spotify-audio-features-api)
- **GetSongBPM**: `/search/` by title or artist and `/song/?id=<GetSong id>`. Returns tempo, time_sig, key_of, open_key, danceability, acousticness. Requires an API key and a mandatory backlink. No Spotify-ID or ISRC lookup. — [GetSongBPM API](https://getsongbpm.com/api), [FreqBlog comparison](https://freqblog.com/compare.html) (as summarised in search results)
- **AcousticBrainz**: MetaBrainz announced the end of the project on 2022-02-16; submissions stopped June 2022. The final dumps (2022-07-06) hold 29,460,584 submissions; the low-level features dump of 2022-06-23 covers 7,564,449 recordings. Data is keyed by MusicBrainz recording MBID, license CC0. Full JSON dumps are about 900–1000 GB; a smaller key/BPM features dump was also planned. — [MetaBrainz blog](https://blog.metabrainz.org/2022/02/16/acousticbrainz-making-a-hard-decision-to-end-the-project/), [MetaBrainz community](https://community.metabrainz.org/t/acousticbrainz-submissions-data-dumps-and-next-steps/589843), [TempoPeek about](https://tempopeek.com/about) (as summarised in search results)
- **Million Song Dataset**: 1M "contemporary popular music tracks"; the full set is 280 GB, with a 10,000-song subset of 1.8 GB. "There is no audio included". Released Feb 2011, built from Echo Nest analysis. It also comes as an AWS EBS snapshot. Lookup is by Echo Nest track ID (unique_tracks list: track id, song id, artist, title). — [MSD home](http://millionsongdataset.com/), [MSD getting the dataset](http://millionsongdataset.com/pages/getting-dataset/)
- MSD per-track fields include `bars_start`, `beats_start`, `sections_start` and `tatums_start`, each with confidence arrays, plus segments with pitches, timbre and loudness. — [MSD FAQ](http://millionsongdataset.com/faq/), [ISMIR 2011 MSD paper](https://ismir2011.ismir.net/papers/OS6-1.pdf) (as summarised in search results)
- There is no official MSD↔Spotify mapping. A community Kaggle set maps 50,683 MSD songs to Spotify IDs. — [Kaggle: MSD + Spotify + Last.fm](https://www.kaggle.com/datasets/undefinenull/million-song-dataset-spotify-lastfm)
- Kaggle/HF datasets of Spotify audio features ("Spotify 1.2M+ songs", "1 million tracks", "114k tracks dataset") are merged and queryable in `P-Arpan/Mood_Based_Music_Search` (2.58M tracks). — [HF: P-Arpan](https://huggingface.co/datasets/P-Arpan/Mood_Based_Music_Search)
- A Kaggle "Anna's Archive Top 10K Spotify Songs Expanded 2025" dataset exists. — [Kaggle](https://www.kaggle.com/datasets/serkantysz/annas-archive-top-10k-spotify-songs-metadata-2025)
- Tunebat (web only, no public API) shows Spotify-ID-keyed pages. A DJ blog claims its numbers come from Spotify's audio features. — [AlternativeTo: Tunebat](https://alternativeto.net/software/song-key-bpm) (weak source; see Gaps)

### Inferences
- For section boundaries specifically, no live API keyed by Spotify ID still serves Echo-Nest-style sections. MSD has them only for pre-2011 songs, needs title matching, and the full set is 280 GB. Section boundaries must come from our own all-in-one or MSAF-style analysis.
- Several "Spotify-compatible" APIs (ReccoBeats, Musicae, Soundcharts) probably serve cached Spotify values for older catalog. Treat them as one source, not independent votes. I verified this for ReccoBeats only.

### Gaps
- I did not test Soundcharts, Musicae or Sonovault (they need keys or accounts). Their coverage of our 77 tracks is unknown.
- I found no primary source confirming where Tunebat's values come from.
- The MSD year range comes from the release date (Feb 2011), not a stated cutoff. The ISMIR PDF could not be text-extracted here.

## 5. How accurate are Spotify/Echo Nest tempo, key and section values, and how to use them as a cross-check

### Takeaway
I found **no published systematic evaluation** of Spotify's audio-features tempo or key against ground truth. The evidence is anecdotal plus general MIR results: tempo estimators commonly make octave (×2, ×½) errors, and key detectors confuse relative major and minor and fifths. Echo Nest attaches confidence values but warns that low confidence does not mean wrong. Our own data shows at least one obvious error: YMCA with `time_signature=3`. Use the Spotify values only as a sanity flag, folding octave relations before comparing.

### Cited Findings
- Echo Nest Analyzer documentation (Tristan Jehan):
  - Tatums are the "lowest regular pulse train", beats are multiples of tatums, bars align with beats, and sections are "defined by large variations in rhythm or timbre".
  - Each marker has a confidence. "Confidence indicates the reliability of its corresponding attribute", but a low confidence "does not necessarily mean the value is inaccurate".
  - — [Echo Nest Analyzer Documentation (PDF)](http://modelai.gettysburg.edu/2012/music/docs/EchoNestAnalyzeDocumentation.pdf)
- The Echo Nest analyzer changed over time. v3.08b (Aug 2011) improved tatum and beat precision, "removing certain errors like out-of-phase beats". — [Echo Nest blog](https://blog.echonest.com/post/9299205486/new-version-of-the-echo-nest-track-analyzer?route=/post/:id/:summary), [MSD FAQ](http://millionsongdataset.com/faq/)
- The tempo-evaluation literature defines ACC1 (strict) and ACC2 (allows factors 2, 3, ½, ⅓, the "octave errors"). It cites a DJ-software view that octave errors are "unacceptable". — [Schreiber et al., TISMIR "Music Tempo Estimation: Are We Done Yet?"](https://transactions.ismir.net/articles/10.5334/tismir.43)
- Recent work scores tempo with a tolerance plus octave-equivalent accuracy, and key with "loose" accuracy that also accepts relative and parallel keys. — [VIBE, arXiv 2608.30125](https://arxiv.org/pdf/2608.30125) (as summarised in search results)
- AcousticBrainz (Essentia) was shut down partly because "there are many recordings for which the predicted value is incorrect" (BPM). Key "was accurate on some styles of music" only, and the algorithms are "unable to indicate a confidence level". This matters because essentia is also on our toolchain. — [MetaBrainz blog](https://blog.metabrainz.org/2022/02/16/acousticbrainz-making-a-hard-decision-to-end-the-project/)
- Community view: Spotify's valence, energy and danceability are named PCA-like axes that "correspond pretty poorly to musical concepts"; "Spotify's own metadata is not particularly sophisticated". — [Hacker News, vintermann](https://news.ycombinator.com/item?id=46338339)
- Anecdote: one analysis found Spotify's tempo close but its key wrong for a track, concluding that the Echo Nest analysis "inaccurately casts an interpretation of Key". — [Medium, FinchMF](https://medium.com/@FinchMF/praise-questions-and-critique-spotify-api-38e984a4174b)
- Half-time and double-time readings and relative-key confusion are known failure modes even in DJ tools such as Mixed In Key. — [Pluginerds review](https://pluginerds.com/mixed-in-key-live-review/)
- My data check: in the Anna-derived mirror, YMCA (Village People) has `tempo=126.432`, `time_signature=3`. The song is in 4/4, so the time_signature is wrong while the tempo is plausible. — [HF: ozefe/spotify_audio_features](https://huggingface.co/datasets/ozefe/spotify_audio_features) (my check)
- My data check on our 68 fetched tracks shows several suspicious tempos. These are suspicions, not yet verified against our audio:
  - Baby (Justin Bieber): 65.043 BPM, likely half of ~130.
  - Waka Waka: 190.732 BPM with `time_signature=3`, consistent with a 3/2 error on ~127 BPM.
  - Aserejé: 184.976 BPM; Llença't: 200.547 BPM. Possibly double-time.
  - The Best of Both Worlds: `time_signature=3`.
  — [ReccoBeats API](https://reccobeats.com/docs/apis/get-audio-features), [HF: GildasLeDrogoff](https://huggingface.co/datasets/GildasLeDrogoff/spotify-huge-track-analysis-dataset) (my check)

### Inferences
Proposed cross-check rules (my design, not from a source):
- **Tempo.** Let r = local_bpm / spotify_bpm. Fold r into [0.5, 2) by repeated ×2 or ÷2 and record the fold factor. Then:
  - If |r_folded − 1| ≤ 0.02, mark "agree". If the fold factor ≠ 1, also mark "octave relation (half/double)". Don't flag it as an error, but surface it so a human picks the musically right one (beat_this generally tracks the felt beat).
  - Also test 3/2 and 2/3 (dotted or triplet feel, 6/8 vs 3/4). If within 2% of either, mark "metrical ambiguity".
  - Otherwise, flag as a "disagreement > 2%" and inspect the beat grid manually.
  - Spotify's tempo is a single global average, so for tracks with tempo drift (live drummers, e.g. Nino Bravo, ABBA) expect 1–3% scatter versus our median inter-beat interval.
- **Key.** Map both to pitch class plus mode. Mark "agree" if equal. Mark "soft" if they are relative major/minor (same Camelot number), a fifth apart (adjacent Camelot), or parallel major/minor. Flag anything else. Do not trust `mode` alone: low `mode` confidence is common in the analysis JSON.
- **Time signature.** Ignore Spotify's value unless both it and our downbeat tracker say non-4.
- **Loudness.** Spotify loudness is a whole-track dB figure, not LUFS. Use only the relative ordering for gain staging; compute LUFS ourselves (essentia or pyloudnorm).
- **Energy and danceability.** Use only as coarse tie-breakers for set ordering, not for transition decisions.

### Gaps
- I found no peer-reviewed or community benchmark quantifying Spotify audio-features tempo or key accuracy (e.g. on GiantSteps or GTZAN).
- I found no evaluation of Echo Nest section-boundary accuracy against annotated structure datasets (e.g. SALAMI).
- I did not compare the fetched Spotify values against our own local analysis. That is the obvious next step once our pipeline has outputs.
