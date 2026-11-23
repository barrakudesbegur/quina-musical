# Audio files

The repo is public, so copyrighted audio stays out of git. Only `fx/` is tracked. Every other folder is gitignored (see `client/.gitignore`) and has to be downloaded again on a new machine from the sources below.

| Folder | Purpose (see `GLOSSARY.md`) | Source |
|---|---|---|
| `song/<id>.mp3` | The bingo songs of the pool. `<id>` is the `id` in `server/db/default/songs.json` | Spotify playlist via spotDL (`playlist-fetcher/`) |
| `fx/` | Sound effects the presenters trigger (tracked in git) | Various |
| `hold/` | Hold music: loops played while waiting, for example after a failed check | `windows-error-remix.mp3`: <https://www.youtube.com/watch?v=dj9KbKKJVVo> · `directed-by-robert-b-weide.mp3`: <https://www.youtube.com/watch?v=X-KwYX2u8e4> · `mkwii-grand-prix-low-place.mp3`: Mario Kart Wii OST, "Grand Prix - Low Place" |
| `celebration/` | Victory music for the celebration after a successful check | `mkwii-grand-prix-1st-place.mp3`: Mario Kart Wii OST, "Grand Prix - 1st Place" |
| `stingers/` | Short one-shot fanfares for game moments (final lap, check passed or failed) | Mario Kart Wii OST: "Final Lap!", "Mission Clear! (Fanfare Only)", "Mission Failure... (Fanfare Only)", "Grand Prix - Low Place (Fanfare Only)" |
| `interval/` | Music for the interval between rounds. Track metadata is in `interval/playlist.spotdl` | Spotify playlist `0SsuXelEzN8gsS7WufySOg` via spotDL |

The Mario Kart Wii files come from <https://downloads.khinsider.com/game-soundtracks/album/mario-kart-wii>. khinsider has many video-game songs and effects in their original quality.

Hold and celebration tracks must loop from a point inside the track, not from its very start or end. Loop points are worked out by the analysis pipeline in `experiments/mixer-poc`.
