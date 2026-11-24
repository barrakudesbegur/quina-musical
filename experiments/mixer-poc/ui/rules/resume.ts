// Plan B, resuming a round by hand (ADR 0003, `resumeAt`), shared by the console and Admin. The engine sends a resume code on every snapshot
// (`state.resume`, PRIVATE to tablets), for example "Q3N-4K7XM2P-17-S41-L12". The console keeps the latest
// one on this device, so a replacement laptop can be resumed from the tablet even with the old laptop and
// the cloud gone. Presenters can also type a code noted on paper. Pure: storage and sending live in the model.
import { formatResumeToken, parseResumeToken, type CommandFields, type ResumePoint, type ResumeToken } from '@quina/protocol';

export interface ResumeDraft {
  point: ResumePoint | null;
  /** The code in its canonical spelling (upper case, no spaces), when it parses. */
  text: string | null;
  error: 'empty' | 'invalid' | null;
}

/** Read a typed or stored code. */
export function readResume(raw: string): ResumeDraft {
  const trimmed = raw.trim();
  if (!trimmed) return { point: null, text: null, error: 'empty' };
  const point = parseResumeToken(trimmed);
  if (!point) return { point: null, text: null, error: 'invalid' };
  return { point, text: formatResumeToken(point), error: null };
}

/** The `resumeAt` command for a code: every field, so the engine checks both the song and the draw number. */
export function resumeCommand(point: ResumePoint): CommandFields['resumeAt'] {
  return {
    round: point.round,
    kind: point.kind,
    shuffleSeed: point.shuffleSeed,
    position: point.position,
    lineConfirmedFrom: point.lineConfirmedFrom,
    lastSongId: point.lastSongId,
    shuffleAttempts: point.shuffleAttempts,
  };
}

/** The code to keep on this device: the engine's latest, else what was kept before (a snapshot without one changes nothing). */
export function nextSavedCode(saved: string | null, live: ResumeToken | null | undefined): string | null {
  return live?.text ?? saved;
}

/** What the preview shows, in counting terms (songs are numbered from 1 on screen). */
export interface ResumeSummary {
  round: number;
  special: boolean;
  /** How many songs had counted (0 before the first). */
  counted: number;
  lastSongId: number | null;
  /** The song number from which the Bingo climb started, or null when no Line was confirmed. */
  lineFromSong: number | null;
}

export function resumeSummary(point: ResumePoint): ResumeSummary {
  return {
    round: point.round,
    special: point.kind === 'special',
    counted: point.position + 1,
    lastSongId: point.lastSongId,
    lineFromSong: point.lineConfirmedFrom === null ? null : point.lineConfirmedFrom + 1,
  };
}
