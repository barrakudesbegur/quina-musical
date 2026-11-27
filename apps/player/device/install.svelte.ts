// What the browser says about installing the player (D221): holds Chrome's install prompt, and knows whether the app
// is installed. logic/install.ts turns these facts into what to offer; Ajustos and the home's InstallPrompt read
// `offer`. Created in main.ts before the app mounts, so a prompt Chrome hands over early is never missed.
import { installOffer, installPlatform, iosBrowser, type InstallOffer, type InstallPlatform, type IosBrowser } from '../logic/install.ts';

/** Chrome's install prompt (not in the DOM's types: Chrome only). */
interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Chrome's and Edge's view of the installed apps (not in the DOM's types). */
type RelatedAppsNavigator = Navigator & { getInstalledRelatedApps?: () => Promise<readonly { platform: string }[]> };

export class InstallState {
  readonly platform: InstallPlatform;
  readonly browser: IosBrowser;
  promptHeld = $state(false);
  standalone = $state(false);
  installed = $state(false);
  /** A review link's `?install=` (development and demos only): this offer, whatever the browser says. */
  private readonly forced: InstallOffer | null;
  private held: InstallPromptEvent | null = null;

  constructor({ userAgent = '', maxTouchPoints = 0, forced = null }: { userAgent?: string; maxTouchPoints?: number; forced?: InstallOffer | null } = {}) {
    this.platform = installPlatform(userAgent, maxTouchPoints);
    this.browser = iosBrowser(userAgent);
    this.forced = forced;
  }

  /** What to offer (logic/install.ts); reactive, as it reads the state above. */
  get offer(): InstallOffer {
    return this.forced ?? installOffer({ platform: this.platform, standalone: this.standalone, installed: this.installed, promptHeld: this.promptHeld });
  }

  /** Follow the browser: the prompt, the app being installed, the page running as the app. Never throws. */
  watch(win: Window): void {
    win.addEventListener('beforeinstallprompt', (event) => {
      // Our own button instead of Chrome's mini-infobar; the prompt is kept until it's used.
      event.preventDefault();
      this.held = event as InstallPromptEvent;
      this.promptHeld = true;
    });
    win.addEventListener('appinstalled', () => {
      this.held = null;
      this.promptHeld = false;
      this.installed = true;
    });
    const standalone = win.matchMedia('(display-mode: standalone)');
    const iosStandalone = (win.navigator as Navigator & { standalone?: boolean }).standalone === true;
    this.standalone = standalone.matches || iosStandalone;
    standalone.addEventListener('change', (e) => (this.standalone = e.matches || iosStandalone));
    void this.checkRelated(win.navigator);
    // The app may be installed (or removed) while the tab sits in the background.
    win.document.addEventListener('visibilitychange', () => {
      if (win.document.visibilityState === 'visible') void this.checkRelated(win.navigator);
    });
  }

  /** A tab of a phone that has the app installed (the manifest's own `webapp` entry). Android Chrome only. */
  private async checkRelated(nav: RelatedAppsNavigator): Promise<void> {
    if (typeof nav.getInstalledRelatedApps !== 'function') return;
    try {
      const apps = await nav.getInstalledRelatedApps();
      if (apps.some((a) => a.platform === 'webapp')) this.installed = true;
    } catch {
      // not allowed here: nothing to learn
    }
  }

  /** «Instal·la l'app» where Chrome holds a prompt: its own dialog. The prompt works once; a new one may come later. */
  async prompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const event = this.held;
    if (!event) return 'unavailable';
    this.held = null;
    this.promptHeld = false;
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      return outcome;
    } catch {
      return 'unavailable';
    }
  }
}
