// Installing the player as an app (D221; docs/research/reports/ios-install-and-app-clip.md and
// android-twa-and-install.md). Pure: what to offer, from what the browser says.
// - Android and desktop Chrome: Chrome hands the page an install prompt (`beforeinstallprompt`) once the app can be
//   installed and the person has used the page a little; «Instal·la l'app» shows only while one is held, and opens
//   Chrome's own dialog. `navigator.install()` is desktop-only (Chrome 158): not for phones.
// - iPhones: no browser can install from the page, so only Ajustos offers it, as a drawer with the steps.
// - Installed: running as the app (`display-mode: standalone`, or iOS's `navigator.standalone`), or a tab of a phone
//   that has the app (`getInstalledRelatedApps()` finds the manifest's own `webapp` entry): «Ja tens l'app».
import type { LineIconName } from '../../../packages/ui/icons/line.ts';

export type InstallPlatform = 'ios' | 'other';
/** On an iPhone, Safari or another browser (Chrome, Firefox, the Google app…), whose share button sits elsewhere. */
export type IosBrowser = 'safari' | 'other';

/** What Ajustos offers: «Ja tens l'app», Chrome's dialog, the iPhone's steps, or nothing (no way to install here). */
export type InstallOffer = 'installed' | 'prompt' | 'steps' | 'none';

export interface InstallFacts {
  platform: InstallPlatform;
  /** Running as the installed app. */
  standalone: boolean;
  /** This browser has the app installed (getInstalledRelatedApps), or just installed it (appinstalled). */
  installed: boolean;
  /** An install prompt is held (beforeinstallprompt). */
  promptHeld: boolean;
}

export function installOffer({ platform, standalone, installed, promptHeld }: InstallFacts): InstallOffer {
  if (standalone || installed) return 'installed';
  if (promptHeld) return 'prompt';
  return platform === 'ios' ? 'steps' : 'none';
}

/** The home's «Instal·la l'app» (InstallPrompt): only while Chrome's prompt is held; never on an iPhone (U193). */
export const homeOffersInstall = (offer: InstallOffer): boolean => offer === 'prompt';

/** An iPhone or an iPad (iPadOS says it's a Mac, but a Mac has no touch screen). */
export function installPlatform(userAgent: string, maxTouchPoints: number): InstallPlatform {
  if (/\b(iPhone|iPad|iPod)\b/.test(userAgent)) return 'ios';
  return /\bMacintosh\b/.test(userAgent) && maxTouchPoints > 1 ? 'ios' : 'other';
}

/** Safari, or another iOS browser (each names itself: CriOS, FxiOS, EdgiOS, OPiOS, GSA for the Google app…). */
export const iosBrowser = (userAgent: string): IosBrowser => (/\b(CriOS|FxiOS|EdgiOS|OPiOS|OPT|GSA|DuckDuckGo|YaBrowser)\//.test(userAgent) ? 'other' : 'safari');

/** One step of the iPhone's drawer: the button's drawing, then the words, the button's own name in bold. */
export interface InstallStep {
  readonly icon: LineIconName;
  /** The words, with `{}` where the button's name goes. */
  readonly text: string;
  readonly button: string;
}

export interface StepWords {
  more: InstallStepWords;
  shareSafari: InstallStepWords;
  shareOther: InstallStepWords;
  addHome: InstallStepWords;
  add: InstallStepWords;
}
export interface InstallStepWords {
  readonly text: string;
  readonly button: string;
}

/**
 * The shortest steps (iOS 26 Safari's default layout): ⋯ next to the address bar → Compartir → Afegir a la pantalla
 * d'inici → Afegir, leaving «Obrir com a app web» on. Other iPhone browsers show Compartir in their address bar.
 */
export function installSteps(browser: IosBrowser, words: StepWords): InstallStep[] {
  const steps: InstallStep[] = [];
  if (browser === 'safari') steps.push({ icon: 'dots', ...words.more }, { icon: 'share', ...words.shareSafari });
  else steps.push({ icon: 'share', ...words.shareOther });
  steps.push({ icon: 'plus-square', ...words.addHome }, { icon: 'check', ...words.add });
  return steps;
}

/** A review link's `?install=` (development and demos): the offer to show whatever the browser says. */
export const isInstallOffer = (v: unknown): v is InstallOffer => v === 'installed' || v === 'prompt' || v === 'steps' || v === 'none';
