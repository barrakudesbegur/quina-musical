// The projector's garland for the gallery (E2): its rules and the stage's tokens are lifted at runtime from the text of
// apps/stage/stage.css (Vite's ?inline, which injects nothing), so the gallery draws the stage's own CSS without
// loading the scenes' layout (stage.css's .stage-root is a fixed, full-screen box that would cover the page). Kept, each
// in its own @layer and @media: every rule whose selector names .garland, the @property registrations and @keyframes
// those rules use, and .stage-root's custom properties, set on `.ds-stage` instead (the gallery's stand-in for the
// stage's root). Injected once as a <style data-ds-source="apps/stage/stage.css">, so the Tokens section lists the
// stage's tokens with the other apps'. Development only, like the rest of apps/ds.
import stageCss from '../stage/stage.css?inline';

export const STAGE_SOURCE = 'apps/stage/stage.css';
/** The class that stands for the stage's root: its tokens are set on it. */
export const STAGE_ROOT_CLASS = 'ds-stage';

/** The garland block and its elements (.garland, .garland__lamp…). */
const GARLAND = /\.garland(?:__[\w-]+)?(?![\w-])/;

/** The garland's part of stage.css's text, as CSS: its rules, their at-rules, and the stage's tokens on `.ds-stage`. */
export function stageGarlandCss(source: string = stageCss): string {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(source);
  /** @property and @keyframes, by the layer they sit in: kept only when the garland's rules name them. */
  const named: { layer: string; name: string; text: string }[] = [];
  const garlandRules: string[] = [];

  const lift = (rules: CSSRuleList, layer: string): string => {
    let out = '';
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSLayerBlockRule) {
        const inner = lift(rule.cssRules, rule.name);
        if (inner) out += `@layer ${rule.name} {\n${inner}}\n`;
      } else if (rule instanceof CSSMediaRule) {
        const inner = lift(rule.cssRules, layer);
        if (inner) out += `@media ${rule.conditionText} {\n${inner}}\n`;
      } else if (rule instanceof CSSStyleRule) {
        if (rule.selectorText === '.stage-root') {
          const tokens = Array.from(rule.style).filter((p) => p.startsWith('--'));
          if (tokens.length) out += `.${STAGE_ROOT_CLASS} {\n${tokens.map((p) => `  ${p}: ${rule.style.getPropertyValue(p).trim()};`).join('\n')}\n}\n`;
        } else if (GARLAND.test(rule.selectorText)) {
          garlandRules.push(rule.cssText);
          out += `${rule.cssText}\n`;
        }
      } else if (rule instanceof CSSPropertyRule || rule instanceof CSSKeyframesRule) {
        named.push({ layer, name: rule.name, text: rule.cssText });
      }
    }
    return out;
  };

  const body = lift(sheet.cssRules, '');
  const names = (text: string) => new Set(text.match(/-{0,2}[a-z][\w-]*/gi) ?? []);
  const usedNames = new Set(garlandRules.flatMap((text) => [...names(text)]));
  const used = named.filter((n) => usedNames.has(n.name));
  const byLayer = new Map<string, string[]>();
  for (const n of used) byLayer.set(n.layer, [...(byLayer.get(n.layer) ?? []), n.text]);
  const atRules = [...byLayer].map(([layer, texts]) => (layer ? `@layer ${layer} {\n${texts.join('\n')}\n}\n` : `${texts.join('\n')}\n`)).join('');
  return atRules + body;
}

/** Adds the garland's CSS to the page once (the projector's gallery page, before it mounts). */
export function liftStageGarland(): void {
  if (document.querySelector(`style[data-ds-source="${STAGE_SOURCE}"]`)) return;
  const style = document.createElement('style');
  style.dataset.dsSource = STAGE_SOURCE;
  style.textContent = stageGarlandCss();
  document.head.append(style);
}
