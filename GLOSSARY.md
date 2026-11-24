# Quina musical

A live music bingo show. Players mark songs on printed cards as they recognize them, while presenters on stage run the game and a projector shows a drum of album covers that reveals each song.

## Language

### The game

**Game**:
The whole set of rounds played on the night of the event. On screen it carries the edition's name, which is set in Admin (this year "Quina Quina 3").
_Avoid_: Night, session, event, partida

**Edition**:
One year's Quina Musical, named by its year (for example "26"). Cards, their QR links and the data on players' phones belong to an edition. A rehearsal is a separate Game in the same edition.
_Avoid_: Year, season

**Round**:
One game of bingo, from its first song until a Bingo is confirmed. Labelled "Quina 1", "Quina 2"… on screen, as people in town call it.
_Avoid_: Game, match, ronda

**Special round**:
A round played with special cards instead of the normal ones. Shown as "Quina Especial", never with a number.
_Avoid_: Quina especial (outside the UI)

**Desgraciat round**:
A round played in reverse: everyone stands, a card is out as soon as any of its songs lands, and the last card standing wins. One per game.
_Avoid_: Reverse round, elimination round

**Card**:
A printed sheet of 12 songs in 3 lines of 4, identified by its number (shown as "#123"). A normal card is kept for every regular round of the game; players mark its songs with corn seeds.
_Avoid_: Cartró (outside the UI), ticket

**Special card**:
A card that is only valid in the special round.

**Cards in play**:
The cards sold for the game, entered once. Each round only counts the ones valid for it: normal cards in regular rounds, special cards in the special round.
_Avoid_: Sold cards, active cards

**Line**:
A completed row of 4 songs on a card.
_Avoid_: Línia (outside the UI)

**Bingo**:
A completed card: all 12 of its songs have landed. It ends the round. Players shout "Quina!", and that is its label on screen ("premi de quina").
_Avoid_: Full house, full card, quina (outside the UI)

**Tie**:
Two or more cards completing the same Line or Bingo on the same landing. The shuffle avoids ties among the cards in play.

**Interval**:
The time between two rounds, with music playing. The next round's prizes stay hidden until its intro.
_Avoid_: Break, descans, pause

**Claim**:
A player shouting Line or Bingo for a card, which then has to be checked.
_Avoid_: Call, cant

**Check**:
The public verification of a claimed card: its songs are shown and replayed one by one, each marked as landed or not.
_Avoid_: Validation, verification

**Winner**:
A player whose claimed card passed the check. Their name is noted, and they collect the prize later by showing the card to the organizers.

**Celebration**:
The moment after a successful check, with a big impact, a victory lap of the drum and celebratory music.
_Avoid_: Ceremony, prize giving

**Prize**:
One item in the bundle given for a round's Line or Bingo, provided by a sponsor. A bundle usually holds one or two headline prizes and several smaller ones.
_Avoid_: Premi (outside the UI), reward

**Sponsor**:
Whoever provides a prize: Barrakudes itself or an outside business.

### The music

**Pool**:
The full set of songs the cards are printed from. Every round's queue is a shuffle of the whole pool.
_Avoid_: Song list, catalogue

**Queue**:
The order in which a round's songs will play. Decided once at the shuffle and never changed afterwards.
_Avoid_: Playlist

**Winning song**:
The song whose landing completed the card that won a Line or a Bingo.

**Shuffle**:
The public moment at the start of a round where the queue is decided, shown on the projector as the songs moving from a grid into the drum. It reshuffles, deterministically, until neither the first Line nor the first Bingo would be a tie.

**Hook**:
A moment in a song where its most recognizable part starts on a downbeat, such as a chorus. Songs only ever land on a hook.
_Avoid_: Timestamp, start point, punt d'inici, cue

**Transition**:
Everything that happens from the moment the next song is requested until it lands: overlapping layers of the outgoing and incoming songs, extra sounds and effects.
_Avoid_: Crossfade, mix

**Tease**:
Any part of the incoming song heard before its landing. A tease never counts for the cards.
_Avoid_: Preview, hint, pre-roll

**Decoy**:
A tease of a pending song that is not the next one, used during suspense to bluff. It never counts and always resolves clearly into the song that actually lands.
_Avoid_: Bluff, fake song

**Signature**:
A short, recognizable instrumental piece of a song, such as its intro riff or the build into its chorus, teased just before that song lands. Never a vocal line repeated after the landing.
_Avoid_: Sample, riff

**Suspense**:
A transition the presenters hold open on purpose. The current song keeps playing while the build grows and the drum hovers over a few pending songs with decoy teases, until they release it and the real next song lands.
_Avoid_: Stall, freeze

### The drum

**Drum**:
The reel of covers on the projector. It holds only the round's songs that haven't landed yet.

**Spin**:
The movement of the drum during a transition.
_Avoid_: Draw, roll

**Landing**:
The instant the drum stops on a song and that song's hook hits, at the same moment. A song counts for the cards from its landing.
_Avoid_: Drop, reveal

**Heat**:
How "hot" the round looks on screen. It follows the phase with some randomness, so it never reveals how many songs are left.
_Avoid_: Temperature, progress

### Running the show

**Projector**:
The audience screen: the drum, the current song and the big moments of the show.

**Console**:
The presenters' control page. It runs on the shared tablet, opens unchanged on an admin's phone, and every open console stays in sync.
_Avoid_: Remote, presenter page, tablet page

**Admin**:
The setup and fixes page for organizers: cards in play, rounds, prizes, sponsors, schedule.

**Player app**:
The app players open on their phones from the QR code on their card, following their own cards.
_Avoid_: Mobile view, PWA (in conversation)

**Pace**:
The target average time from one landing to the next, set by the presenters and gently adjusted by the system to keep to the schedule. Each gap snaps to the playing song's phrases, so the pace holds on average, not for every song.
_Avoid_: Speed, tempo, song duration

**Schedule**:
The planned timetable of the game: when it starts, how long each round and interval should last.
_Avoid_: Timetable, plan

**Drift**:
How far ahead of or behind the schedule the game is running.
_Avoid_: Delay, lag

**Resume code**:
A short private code for a round's shuffle, noted by the organizers at each Shuffle, that lets a restarted laptop rebuild that round's queue exactly. Labelled "codi de recuperació" on screen.
_Avoid_: Seed, recovery key

**Back**:
Undoing the last landing: that song stops counting and becomes the next song again, as if it had never played. The queue's order is untouched.
_Avoid_: Previous, undo, replay, anterior (outside the UI)

**Hold**:
A state in which no new song can land and the music ducks under the presenters' voices, used for claims and whenever the presenters want to talk (labelled "Parlem" on the console). The music never stops unless silence is intended.
_Avoid_: Pause, low volume

**Stay**:
A state in which no new song can land and the current song keeps playing at full volume, looping a phrase if needed, for dancing or crowd moments (labelled "Aguanta" on the console).
_Avoid_: Freeze, loop mode

**Hold music**:
Looping background tracks, such as a video-game waiting tune, that take over during a long hold.
_Avoid_: Background music, bed

**Phase**:
How likely a win is within the next few songs (early, mid, late, final), which decides how big the transitions are. It climbs towards a Line, resets once a Line is confirmed, and climbs again towards the Bingo. Late can start early or end without a win, so it never gives the ending away.
_Avoid_: Stage, level
