# Audio and drum run together by default but may run on different devices

**Status:** amended by D274 (28 Nov): the audio on another device is only a nice-to-have, not a requirement; the mixer can be placed almost anywhere. The rule below that landings travel as shared timestamps still holds.

By default, the laptop that drives the projector also plays the audio, so the drum and the music share one clock and landings are exact. The venue, however, puts the speakers' mixer on stage and the projector far away, and the Wii remote's range ends before the stage. So the system must also support the audio playing on a different device from the drum's display, kept in sync by announcing every landing time in advance over the network.

Because of this, the drum never assumes it can read the audio clock directly. Landing times are always exchanged as shared timestamps, even when both run on the same laptop.
