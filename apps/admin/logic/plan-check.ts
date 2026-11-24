// Admin's view of plan validation. It is ui/plan.ts's checkGamePlan plus one thing the shared validator
// doesn't accept yet: a sponsor logo kept inline as a data URL (the cleaned WebP or PNG), until the Platform
// session stores logos in R2. checkGamePlan limits `logo` to a 500-character path, so the data URLs are
// checked here (format and size) and set aside while the rest goes through checkGamePlan unchanged.
// Every function returns every problem with its JSON path and never throws.
import { checkGamePlan, type GamePlan, type PlanCheck } from '../../../packages/ui/plan.ts';
import { LOGO_CONFIG } from '../config.ts';

const DATA_URL_RE = /^data:image\/(webp|png);base64,([A-Za-z0-9+/]+={0,2})$/;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A logo kept inline (any `data:` URL; checkPlanDraft says whether it is an acceptable one). */
export const isInlineLogo = (logo: unknown): logo is string => typeof logo === 'string' && logo.startsWith('data:');

/** Decoded size in bytes of a base64 payload. */
export function base64Bytes(b64: string): number {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

/** Problems with an inline logo, or null when it is a base64 WebP or PNG within the size limit. */
export function inlineLogoError(url: string, maxBytes: number = LOGO_CONFIG.maxBytes): string | null {
  const match = DATA_URL_RE.exec(url);
  if (!match) return 'an inline logo must be a base64 data URL of a WebP or PNG image';
  const bytes = base64Bytes(match[2]);
  if (bytes > maxBytes) return `inline logo is ${Math.round(bytes / 1024)} KB, more than ${Math.round(maxBytes / 1024)} KB`;
  return null;
}

/**
 * Check a plan that may carry inline logos. Same contract as checkGamePlan: `{ ok: true, plan }` with the
 * inline logos back in place, or every error with its path.
 */
export function checkPlanDraft(json: unknown): PlanCheck {
  if (!isRec(json) || !Array.isArray(json.sponsors)) return checkGamePlan(json);
  const inline = new Map<number, string>();
  const errors: string[] = [];
  const sponsors = json.sponsors.map((s: unknown, i: number) => {
    if (!isRec(s) || !isInlineLogo(s.logo)) return s;
    const error = inlineLogoError(s.logo);
    if (error) errors.push(`plan.sponsors[${i}].logo: ${error}`);
    inline.set(i, s.logo);
    return { ...s, logo: null };
  });
  const check = checkGamePlan({ ...json, sponsors });
  if (!check.ok) return { ok: false, errors: [...check.errors, ...errors] };
  if (errors.length) return { ok: false, errors };
  const plan: GamePlan = {
    ...check.plan,
    sponsors: check.plan.sponsors.map((s, i) => (inline.has(i) ? { ...s, logo: inline.get(i) ?? null } : s)),
  };
  return { ok: true, plan };
}

export type PlanTextCheck =
  | { ok: true; plan: GamePlan }
  /** Not JSON at all: `message` is the parser's. */
  | { ok: false; kind: 'syntax'; message: string }
  | { ok: false; kind: 'empty' }
  /** JSON, but not a valid plan: every problem with its path. */
  | { ok: false; kind: 'invalid'; errors: string[] };

/** Check pasted or uploaded text as a plan. Never throws. */
export function checkPlanText(text: string): PlanTextCheck {
  if (!text.trim()) return { ok: false, kind: 'empty' };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { ok: false, kind: 'syntax', message: e instanceof Error ? e.message : String(e) };
  }
  const check = checkPlanDraft(json);
  return check.ok ? check : { ok: false, kind: 'invalid', errors: check.errors };
}

/** The errors under a JSON path prefix ("plan.rounds[2]" also matches "plan.rounds[2].line.title"). */
export function errorsAt(errors: readonly string[], prefix: string): string[] {
  return errors.filter((e) => e.startsWith(`${prefix}:`) || e.startsWith(`${prefix}.`) || e.startsWith(`${prefix}[`));
}

/**
 * The plan as the shared store can keep it. When the shared validator accepts the plan as it is (no inline
 * logos, or once it accepts them), it is stored whole. Otherwise the inline logos go to a side store, keyed by
 * sponsor id, and the plan is stored with `logo: null` for them, so every other screen can still load it.
 */
export function planForStorage(plan: GamePlan): { plan: GamePlan; logos: Record<string, string> } {
  if (checkGamePlan(plan).ok) return { plan, logos: {} };
  const logos: Record<string, string> = {};
  const sponsors = plan.sponsors.map((s) => {
    if (!isInlineLogo(s.logo)) return s;
    logos[s.id] = s.logo;
    return { ...s, logo: null };
  });
  return { plan: { ...plan, sponsors }, logos };
}

/** The stored plan with its side-stored logos back in place (only where the plan has none). */
export function planFromStorage(plan: GamePlan, logos: Readonly<Record<string, string>>): GamePlan {
  if (!Object.keys(logos).length) return plan;
  return { ...plan, sponsors: plan.sponsors.map((s) => (s.logo === null && Object.hasOwn(logos, s.id) ? { ...s, logo: logos[s.id] } : s)) };
}
