# The cloud owns the Game; the show laptop owns playback and can run alone

The venue is a pop-up tent with no Wi-Fi and no router, only 5G and phone hotspots. Organizers did not want everything to depend on one laptop. So the Game (rounds, queues, every landing, cards in play, claims, winners, prizes, sponsors, schedule) lives in the cloud: a single Cloudflare Durable Object with its own SQLite, exportable as JSON. Phones and remote consoles connect to it, and admins log in with Cloudflare Access.

The laptop that drives the projector and the PA still owns live playback. It reports every landing to the cloud and keeps its own journal, so:

- If the laptop fails, any prepared device resumes the Game from the cloud.
- If the internet or the cloud fails, the laptop carries on alone and uploads its journal when the connection returns. If it was restarted while offline, an admin resumes it by hand (round and song).

## Considered options

- **Laptop as the only server** (local relay, own router): rejected. There's no router at the venue, and it leaves a single point of failure.
- **Cloud as the hub for the live show:** rejected. A 5G drop would stop the music being controlled.

## Consequences

- While offline, presenters fall back to a simple plan B: the laptop's keyboard shortcuts and the Wii remote, plus the console when it's on the same hotspot as the laptop.
- The free Cloudflare plan is used first. It is upgraded on the spot if a limit is hit; that only pauses phones and consoles, never the show.
