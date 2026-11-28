// The browsers the night must work in, and the web features newer than them that the screens use or might
// (apps/show/tests/ui/ds/baseline-lint.test.ts reads this). Why: on 28 Nov the phone's Historial and cards went blank on
// an iPhone on iOS 18.6 (Safari 18), where a scroll-driven animation (`animation-timeline: scroll()`, no such property
// there) ran `animation: … both` with no time and held a mask at its end value. Playwright's WebKit is newer than
// Safari 18, so no browser test catches that: the lint does, from the source.
//
// Support facts are the modern-web-guidance Baseline data (web-features), as its guides gave them on 28 Nov 2026: the
// first Safari (iOS where it differs) and Chrome versions with the whole feature. `null`: none yet.
//
// Within the floor already, so not listed (same data): @starting-style (Safari 17.5), transition-behavior and
// discrete `display` transitions (17.4, 18), view transitions with a callback (18), relative colours (18), container
// style queries (18), unprefixed backdrop-filter (18), linear() (17.2), registered custom properties (16.4),
// text-wrap: balance (17.5), container size queries (16), popover (17; light dismiss on iOS from 18.3, see below).

/**
 * The floor: Safari 18.0, i.e. every iPhone and iPad on iOS / iPadOS 18 (many phones on the night; the console may run
 * on an iPad), and Chrome on Android from two years back (Chrome 131, Nov 2024). Raise it here; the lint then lists
 * the entries below that the new floor supports, to drop.
 */
export const FLOOR = { safari: 18.0, chrome: 131 } as const;

interface Support {
  /** The feature, by its web-features name. */
  name: string;
  safari: number | null;
  chrome: number | null;
}

/** A CSS feature newer than the floor. */
export interface CssFeature extends Support {
  /** Where it is written, matched on one declaration (`prop: value`), a selector, or an at-rule's prelude. */
  use: RegExp;
}

/** A feature that can hide content or break layout where it's missing: only inside an `@supports` that tests it. */
export interface GuardedCss extends CssFeature {
  /** What, in a positive `@supports` condition, counts as testing it (any member of the same web feature). */
  guard: RegExp;
  /** What goes wrong without it. */
  without: string;
}

/** A feature that degrades harmlessly where it's missing: allowed anywhere. */
export interface AllowedCss extends CssFeature {
  harmless: string;
}

/** A script feature newer than the floor: the file that uses it must also test for it (`guard`). */
export interface GuardedJs extends Support {
  use: RegExp;
  guard: RegExp;
  without: string;
}

export const GUARDED_CSS: readonly GuardedCss[] = [
  {
    name: 'Scroll-driven animations',
    safari: 26,
    chrome: 115,
    use: /(?:^|[\s;{])(?:animation-timeline|animation-range(?:-start|-end)?|timeline-scope|(?:scroll|view)-timeline(?:-name|-axis|-inset)?)\s*:|(?<![\w-])(?:scroll|view)\(/,
    guard: /animation-timeline|animation-range|scroll-timeline|view-timeline|timeline-scope/,
    without: "the animation runs with no time: with `both` it holds its end value from the start (28 Nov's blank Historial)",
  },
  {
    name: 'Anchor positioning',
    safari: 27,
    chrome: 157,
    use: /(?:^|[\s;{])(?:anchor-name|anchor-scope|position-anchor|position-area|inset-area|position-try(?:-fallbacks|-order|-options)?|position-visibility)\s*:|(?<![\w-])anchor(?:-size)?\(|@position-try\b/,
    guard: /anchor-name|position-anchor|position-area|anchor\(|anchor-size\(|position-try/,
    without: 'the insets are dropped: the box sits at its static position (over other content) or shrinks to nothing',
  },
  {
    name: 'Container scroll-state queries',
    safari: null,
    chrome: 144,
    use: /(?<![\w-])scroll-state\b/,
    guard: /scroll-state/,
    without: 'the stuck / snapped / scrollable look never applies, and a `container-type` naming it is dropped whole',
  },
  {
    name: 'sibling-count() and sibling-index()',
    safari: 26.2,
    chrome: 138,
    use: /(?<![\w-])sibling-(?:index|count)\(/,
    guard: /sibling-(?:index|count)\(/,
    without: 'with a var() beside it the declaration is invalid at computed-value time: the property resets (delays to 0)',
  },
  {
    name: 'interpolate-size',
    safari: null,
    chrome: 129,
    use: /(?:^|[\s;{])interpolate-size\s*:/,
    guard: /interpolate-size/,
    without: 'a size meant to animate to or from `auto` jumps',
  },
  {
    name: 'calc-size()',
    safari: null,
    chrome: 129,
    use: /(?<![\w-])calc-size\(/,
    guard: /calc-size\(/,
    without: 'the size declaration is dropped: the box takes an earlier or default size',
  },
  {
    name: 'field-sizing',
    safari: 26.2,
    chrome: 123,
    use: /(?:^|[\s;{])field-sizing\s*:/,
    guard: /field-sizing/,
    without: 'the field keeps its fixed size: what is typed past it scrolls out of sight',
  },
  {
    name: 'text-box',
    safari: 18.2,
    chrome: 133,
    use: /(?:^|[\s;{])text-box(?:-trim|-edge)?\s*:/,
    guard: /text-box/,
    without: 'the text keeps its leading: a box sized to the trimmed text is too small for it',
  },
  {
    name: 'contrast-color()',
    safari: 26,
    chrome: 147,
    use: /(?<![\w-])contrast-color\(/,
    guard: /contrast-color\(/,
    without: 'the colour is dropped: the text takes the inherited colour, maybe the background\'s',
  },
];

export const ALLOWED_CSS: readonly AllowedCss[] = [
  {
    name: 'text-wrap: pretty',
    safari: 26,
    chrome: 117,
    use: /(?:^|[\s;{])text-wrap(?:-style)?\s*:\s*pretty/,
    harmless: 'lines break the plain way',
  },
  {
    name: 'overlay',
    safari: null,
    chrome: 117,
    use: /(?:^|[\s;{])transition(?:-property)?\s*:[^;]*(?<![\w-])overlay(?![\w-])/,
    harmless: 'a closing dialog leaves the top layer when it closes, its exit cut short; nothing stays hidden',
  },
  {
    name: 'scrollbar-width',
    safari: 18.2,
    chrome: 121,
    use: /(?:^|[\s;{])scrollbar-width\s*:/,
    harmless: 'the scrollbar shows (an overlay scrollbar on iOS)',
  },
  {
    name: ':active-view-transition-type()',
    safari: 18.2,
    chrome: 125,
    use: /:active-view-transition-type\(/,
    harmless: "the selector's rule is dropped: the transition runs at the browser's default length (the script's types are guarded below)",
  },
  {
    name: 'line-clamp (unprefixed)',
    safari: null,
    chrome: null,
    use: /(?:^|[\s;{])line-clamp\s*:/,
    harmless: '`-webkit-line-clamp` beside it does the clamping ("not natively supported by any major browser yet")',
  },
  {
    name: 'hyphenate-limit-chars',
    safari: null,
    chrome: null,
    use: /(?:^|[\s;{])hyphenate-limit-chars\s*:/,
    harmless: 'short words may hyphenate (not in the modern-web-guidance data: taken as unsupported)',
  },
];

export const GUARDED_JS: readonly GuardedJs[] = [
  {
    name: 'View transition types',
    safari: 18.2,
    chrome: 125,
    use: /startViewTransition\(\s*\{/,
    guard: /'types' in ViewTransition\.prototype/,
    without: 'Safari 18.0–18.1 take only a callback: the object form throws and the update never runs',
  },
  {
    name: 'Scroll-driven animations (script)',
    safari: 26,
    chrome: 115,
    use: /\bnew (?:Scroll|View)Timeline\b|\brange(?:Start|End)\s*:/,
    guard: /CSS\.supports\(\s*['"][^'"]*animation-timeline|['"](?:Scroll|View)Timeline['"] in |typeof (?:Scroll|View)Timeline/,
    without: 'ScrollTimeline is not defined: the script throws',
  },
  {
    name: 'Element-scoped view transitions',
    safari: null,
    chrome: 147,
    use: /(?<!document\??)\.startViewTransition\(/,
    guard: /'startViewTransition' in (?:HTML)?Element\.prototype/,
    without: 'element.startViewTransition is not a function: the update never runs',
  },
  {
    name: 'moveBefore()',
    safari: null,
    chrome: 133,
    use: /\.moveBefore\(/,
    guard: /'moveBefore' in/,
    without: 'moveBefore is not a function: the element is never moved',
  },
  {
    name: 'Scheduler API',
    safari: null,
    chrome: 129,
    use: /\bscheduler\.(?:yield|postTask)\(/,
    guard: /'scheduler' in|typeof scheduler\b/,
    without: 'scheduler is not defined: the script throws',
  },
  {
    name: 'Temporal',
    safari: null,
    chrome: 144,
    use: /\bTemporal\./,
    guard: /typeof Temporal\b|'Temporal' in/,
    without: 'Temporal is not defined: the script throws',
  },
  {
    name: '<dialog closedby>',
    safari: null,
    chrome: 134,
    use: /\bclosedby\b/,
    guard: /\blightDismiss\(/,
    without: "a tap outside doesn't close the dialog (top-layer.ts › lightDismiss does it where closedby is missing)",
  },
  {
    name: 'Invoker commands',
    safari: 26.2,
    chrome: 135,
    use: /\bcommandfor\b|\bcommandForElement\b/,
    guard: /'commandForElement' in/,
    without: 'the button does nothing',
  },
  {
    name: 'Popover (iOS)',
    safari: 18.3,
    chrome: 116,
    use: /\.(?:show|hide|toggle)Popover\(|matches\(\s*['"][^'"]*:popover-open/,
    guard: /'(?:show|toggle)Popover' in|'popover' in/,
    without: "iOS's popover support is dated 18.3 (Safari 17 on the Mac): where it's missing, showPopover() throws",
  },
];

/** Newer than the floor in either browser (unsupported counts as newer). */
export function newerThanFloor(f: Support, floor: { safari: number; chrome: number } = FLOOR): boolean {
  return f.safari === null || f.safari > floor.safari || f.chrome === null || f.chrome > floor.chrome;
}
