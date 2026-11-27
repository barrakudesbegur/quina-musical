<!--
  B5 · WiiKey: which keys of the Wii remote trigger a control, drawn like the real keys (components-v2.md § 3 › B5;
  D36, D91–D94; comments-27nov.md #46).

  `spec` is the control's `wii` slot (types.ts › WiiKeySpec): `keys` side by side, never merged («− +» is two keys,
  D91); `hold` draws the three-quarter ring round a key that must be held; `withA` adds «+» and A (Suspens: B + A,
  D144); `size` `md` or `sm` (inside strips). The keys are white, as on the boards: colour belongs to the remote's
  drawing in the legend (C9), not to the badges. The D-pad arm is a cross as tall as a round key with soft corners,
  the pressed arm in ink (#46). `shake`: the remote shaken three times, «×3». Decorative (`aria-hidden`): the
  control's own name says what it does. Placement is the parent's (a Button's corner, a strip's end).
-->
<script lang="ts">
  import type { WiiKey, WiiKeySpec } from './types.ts';
  import './wii-key.css';

  let { spec, class: className = '' }: { spec: WiiKeySpec; class?: string } = $props();

  const GLYPH: Partial<Record<WiiKey, string>> = { a: 'A', b: 'B', minus: '−', plus: '+', one: '1', two: '2' };
  const ROTATION: Partial<Record<WiiKey, number>> = { up: 0, right: 90, down: 180, left: 270 };
  const REMOTES = [
    { opacity: 0.3, angle: -24 },
    { opacity: 0.55, angle: -12 },
    { opacity: 1, angle: 6 },
  ];
  const shape = (key: WiiKey) => (key === 'a' ? 'a' : key === 'b' ? 'b' : key in ROTATION ? 'dpad' : 'round');
</script>

<span class="wii-key {className}" data-size={spec.size ?? 'md'} data-hold={spec.hold || undefined} aria-hidden="true">
  {#if spec.keys.length === 1 && spec.keys[0] === 'shake'}
    <!-- The remote shaken three times: the upright remote as tall as a key (#13), its outline a key's line. -->
    <span class="wii-key__shake">
      <svg viewBox="-2.5 1.5 18 20.5" focusable="false">
        {#each REMOTES as r (r.angle)}
          <g opacity={r.opacity} transform="rotate({r.angle} 9 21)">
            <rect x="6" y="3" width="6" height="17" rx="1.6" class="wii-key__remote" />
            <circle cx="9" cy="7.6" r="1.3" class="wii-key__remote-a" />
          </g>
        {/each}
      </svg>
      <span class="wii-key__times">×3</span>
    </span>
  {:else}
    <span class="wii-key__keys">
      {#each spec.keys as key (key)}
        <span class="wii-key__key" data-shape={shape(key)} data-key={key}>
          {#if key === 'home'}
            <svg viewBox="0 0 24 24" focusable="false"><path class="wii-key__fill" d="M4 20v-8l8-7 8 7v8z" /></svg>
          {:else if key in ROTATION}
            <!-- A cross with rounded arms; the arm that's pressed is ink. -->
            <svg viewBox="0 0 24 24" focusable="false">
              <path class="wii-key__cross" d="M9 2.5h6a1.5 1.5 0 0 1 1.5 1.5v5h5A1.5 1.5 0 0 1 23 10.5v3a1.5 1.5 0 0 1-1.5 1.5h-5v5a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 20v-5h-5A1.5 1.5 0 0 1 1 13.5v-3A1.5 1.5 0 0 1 2.5 9h5V4A1.5 1.5 0 0 1 9 2.5z" />
              <path class="wii-key__fill" d="M9.6 4.4h4.8v5.2L12 12 9.6 9.6z" transform="rotate({ROTATION[key]} 12 12)" />
            </svg>
          {:else}
            {GLYPH[key]}
          {/if}
        </span>
      {/each}
    </span>
    {#if spec.withA}
      <svg class="wii-key__plus" viewBox="0 0 24 24" focusable="false"><path d="M12 4v16M4 12h16" /></svg>
      <span class="wii-key__key" data-shape="a" data-key="a">A</span>
    {/if}
  {/if}
</span>
