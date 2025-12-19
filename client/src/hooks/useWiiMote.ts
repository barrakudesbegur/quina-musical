import { createContext, useContext } from 'react';
import WiiMote from '../utils/WiimoteLib/WiiMote';
import { WiiMoteConnectionHelper } from '../utils/WiimoteLib/WiiMote/WiiMoteConnectionHelper';

export type DPadDirection = 'up' | 'down' | 'left' | 'right';

export type DPadFxMapping = Record<DPadDirection, string | null>;

type WiiMoteContextType = {
  helper: WiiMoteConnectionHelper;
  wiiMote: WiiMote | null;
  error: string;
  dpadFxMapping: DPadFxMapping;
  setDPadFx: (direction: DPadDirection, fxId: string | null) => void;
  connectViaBluetooth: () => Promise<void>;
  connectViaHID: () => Promise<void>;
  disconnect: () => void;
};

export const WiiMoteContext = createContext<WiiMoteContextType | null>(null);

export const useWiiMote = () => {
  const context = useContext(WiiMoteContext);
  if (!context) {
    throw new Error('useWiiMote must be used within a WiiMoteProvider');
  }
  return context;
};
