# Audio files

Moved here from last year's `client/public/audios/` (still in `legacy/2025/`, without the untracked files).

The repo is public, so copyrighted audio stays out of git. Only `fx/` is tracked. Every other folder is gitignored (see `data/.gitignore`) and has to be downloaded again on a new machine from the sources below.

| Folder | Purpose (see `GLOSSARY.md`) | Source |
|---|---|---|
| `song/<id>.mp3` | The bingo songs of the default repertoire. `<id>` is the `id` in `data/repertoires/default/songs.json` | Spotify playlist via spotDL (`tools/prep/playlist-fetcher/`) |
| `fx/` | Sound effects the presenters trigger (tracked in git) | Various |
| `hold/` | Hold music: loops played while waiting, for example after a failed check | `windows-error-remix.mp3`: <https://www.youtube.com/watch?v=dj9KbKKJVVo> · `directed-by-robert-b-weide.mp3`: <https://www.youtube.com/watch?v=X-KwYX2u8e4> · `mkwii-grand-prix-low-place.mp3`: Mario Kart Wii OST, "Grand Prix - Low Place" |
| `celebration/` | Victory music for the celebration after a successful check | `mkwii-grand-prix-1st-place.mp3`: Mario Kart Wii OST, "Grand Prix - 1st Place" |
| `stingers/` | Short one-shot fanfares for game moments (final lap, check passed or failed, shuffle) | Mario Kart Wii OST: "Final Lap!", "Mission Clear! (Fanfare Only)", "Mission Failure... (Fanfare Only)", "Grand Prix - Low Place (Fanfare Only)" · `mkwii-item-box.mp3`: <https://www.youtube.com/watch?v=a4eJjmAxUGA> |
| `interval/<set>/` | The music sets (D129), one folder each, prepared by `tools/prep/interval.py`. Each folder's track metadata is in its `playlist.spotdl` | `breaks/`: the breaks between rounds, and after the Game for now (U97), Spotify `0fvoRGCC8zXqDyj5uLhJVg` via spotDL. `pausa/`: Pausa's lofi and silly-core, Spotify `0XTlZPUpt7xPoPxk4AUU3O` (D104, D129). The earlier Interval set `0SsuXelEzN8gsS7WufySOg` is kept in `interval-old-0SsuXelEzN8gsS7WufySOg/` |
| `intro/` | A round's intro track (D129), looped by `tools/prep/hold.py` | `parasail-minigame.mp3`: "5-12. Parasail Minigame" (The Legend of Zelda: Breath of the Wild), from the user (it was in `temp/`) |
| `throw/` | The throw song (D138), decoded by `tools/prep/hold.py` | `flying-free.mp3`: "Flying Free" (Pont Aeri, Marian Dacal), a copy of last year's `song/24.mp3` (Spotify `1cpIInDCM09St4ajfPvPPZ`). Its throw hook is `THROW.hookSec` in `apps/show/engine/src/config.ts` |

The Mario Kart Wii files come from <https://downloads.khinsider.com/game-soundtracks/album/mario-kart-wii>. khinsider has many video-game songs and effects in their original quality.

Hold, celebration and intro tracks must loop from a point inside the track, not from its very start or end. Loop points are worked out by the analysis pipeline in `tools/prep/` (`hold.py`).
