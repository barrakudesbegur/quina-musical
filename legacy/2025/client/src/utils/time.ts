import { intervalToDuration } from 'date-fns';

const normalizeMs = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.floor(value));
};

const toDurationParts = (value: number | null | undefined) => {
  const normalized = normalizeMs(value);
  if (normalized === null) return null;

  const duration = intervalToDuration({ start: 0, end: normalized });
  const hours = (duration.days ?? 0) * 24 + (duration.hours ?? 0);
  const minutes = duration.minutes ?? 0;
  const seconds = duration.seconds ?? 0;

  return { hours, minutes, seconds };
};

export const formatElapsedClock = (value: number | null | undefined) => {
  const parts = toDurationParts(value);
  if (!parts) return '-';

  const minutesText =
    parts.hours > 0
      ? parts.minutes.toString().padStart(2, '0')
      : parts.minutes.toString();

  return `${parts.hours > 0 ? `${parts.hours}h ` : ''}${minutesText}m ${parts.seconds.toString().padStart(2, '0')}s`;
};

export const formatCompactDuration = (value: number | null | undefined) => {
  const parts = toDurationParts(value);
  if (!parts) return null;

  const result: string[] = [];
  if (parts.hours > 0) result.push(`${parts.hours}h`);
  if (parts.minutes > 0 || parts.hours > 0) result.push(`${parts.minutes}m`);
  if (parts.seconds > 0 || !result.length) result.push(`${parts.seconds}s`);

  return result.join(' ');
};
