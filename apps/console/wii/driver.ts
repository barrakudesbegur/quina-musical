// The Wii Remote over WebHID (desktop Chrome): find or ask for the remote, open it, ask for buttons plus the
// accelerometer, and rumble. Browser-only glue; the parsing and the mapping are pure (report.ts, mapping.ts).
import { WII } from '../config.ts';
import { parseReport, parseStatus, REPORT, STATUS_REPORT, type WiiReport } from './report.ts';

/** The bits of WebHID this uses (TypeScript's DOM types don't include WebHID). */
interface HidDevice {
  opened: boolean;
  productName: string;
  open(): Promise<void>;
  close(): Promise<void>;
  sendReport(reportId: number, data: BufferSource): Promise<void>;
  addEventListener(type: 'inputreport', listener: (e: { reportId: number; data: DataView }) => void): void;
  removeEventListener(type: 'inputreport', listener: (e: { reportId: number; data: DataView }) => void): void;
}
interface Hid {
  requestDevice(options: { filters: { vendorId: number }[] }): Promise<HidDevice[]>;
  getDevices(): Promise<HidDevice[]>;
  addEventListener(type: 'connect' | 'disconnect', listener: (e: { device: HidDevice }) => void): void;
}
const hid = (): Hid | null => (typeof navigator !== 'undefined' && 'hid' in navigator ? ((navigator as unknown as { hid: Hid }).hid ?? null) : null);

/** Whether this browser can talk to a remote at all. */
export const wiiSupported = (): boolean => hid() !== null;

const OUT = { leds: 0x11, reportMode: 0x12, status: 0x15 } as const;
/** Report mode byte 0: 0x04 = send reports continuously (the accelerometer needs it). */
const CONTINUOUS = 0x04;

export class WiiRemote {
  readonly device: HidDevice;
  private rumbleTimer: ReturnType<typeof setTimeout> | null = null;
  private listener: ((e: { reportId: number; data: DataView }) => void) | null = null;

  constructor(device: HidDevice) {
    this.device = device;
  }

  /** Open it, light LED 1 and switch to buttons + accelerometer. */
  async start(onReport: (report: WiiReport) => void, onBattery: (level: number) => void = () => {}): Promise<void> {
    if (!this.device.opened) await this.device.open();
    this.listener = (e) => {
      const bytes = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength);
      if (e.reportId === STATUS_REPORT) {
        const status = parseStatus(bytes);
        if (status) onBattery(status.battery);
        // After a status report the remote stops its data reports until the mode is set again.
        void this.send(OUT.reportMode, [CONTINUOUS, REPORT.buttonsAccel]);
        return;
      }
      const report = parseReport(e.reportId, bytes, WII.accel);
      if (report) onReport(report);
    };
    this.device.addEventListener('inputreport', this.listener);
    await this.send(OUT.leds, [WII.leds]);
    await this.send(OUT.reportMode, [CONTINUOUS, REPORT.buttonsAccel]);
  }

  /** Ask for a status report (the battery comes back through `onBattery`). */
  requestStatus(): void {
    void this.send(OUT.status, [0x00]);
  }

  /** Play a pattern: on/off durations in ms, starting with on. A new pattern cuts the previous one. */
  rumble(pattern: readonly number[]): void {
    if (this.rumbleTimer) clearTimeout(this.rumbleTimer);
    const step = (i: number) => {
      if (i >= pattern.length) return void this.send(OUT.leds, [WII.leds]);
      void this.send(OUT.leds, [WII.leds | (i % 2 === 0 ? 0x01 : 0x00)]);
      this.rumbleTimer = setTimeout(() => step(i + 1), pattern[i]);
    };
    step(0);
  }

  async stop(): Promise<void> {
    if (this.rumbleTimer) clearTimeout(this.rumbleTimer);
    if (this.listener) this.device.removeEventListener('inputreport', this.listener);
    this.listener = null;
    try {
      await this.send(OUT.leds, [0]);
      await this.device.close();
    } catch {
      // Already gone.
    }
  }

  private send(reportId: number, bytes: number[]): Promise<void> {
    return this.device.sendReport(reportId, new Uint8Array(bytes)).catch(() => undefined);
  }
}

/** Ask the presenter to pick the remote (needs a click). Null when cancelled or unsupported. */
export async function requestWiiRemote(): Promise<WiiRemote | null> {
  const api = hid();
  if (!api) return null;
  try {
    const [device] = await api.requestDevice({ filters: [{ vendorId: WII.vendorId }] });
    return device ? new WiiRemote(device) : null;
  } catch {
    return null;
  }
}

/** A remote this browser was already allowed to use (reconnects without asking). */
export async function knownWiiRemote(): Promise<WiiRemote | null> {
  const api = hid();
  if (!api) return null;
  const [device] = await api.getDevices().catch(() => [] as HidDevice[]);
  return device ? new WiiRemote(device) : null;
}

/** Tell when a remote connects or goes away. */
export function onWiiConnection(listener: (connected: boolean) => void): void {
  const api = hid();
  api?.addEventListener('connect', () => listener(true));
  api?.addEventListener('disconnect', () => listener(false));
}
