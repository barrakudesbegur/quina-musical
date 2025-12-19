import { FC, PropsWithChildren, useState } from 'react';
import { useLocalStorage } from 'usehooks-ts';
import WiiMote from '../utils/WiimoteLib/WiiMote';
import { WiiMoteConnectionHelper } from '../utils/WiimoteLib/WiiMote/WiiMoteConnectionHelper';
import {
  DPadDirection,
  DPadFxMapping,
  WiiMoteContext,
} from '../hooks/useWiiMote';

export const WiiMoteProvider: FC<PropsWithChildren> = ({ children }) => {
  const [helper] = useState(() => new WiiMoteConnectionHelper());
  const [wiiMote, setWiiMote] = useState<WiiMote | null>(null);
  const [error, setError] = useState('');
  const [dpadFxMapping, setDpadFxMapping] = useLocalStorage<DPadFxMapping>(
    'wiimote-dpad-fx-mapping',
    {
      up: 'anime-wow',
      down: 'tada',
      left: 'correct',
      right: 'buzzer',
    }
  );

  const connectViaBluetooth = async () => {
    try {
      setError('');
      await helper.connectViaBluetooth();
    } catch (err) {
      setError(JSON.stringify(err));
    }
  };

  const connectViaHID = async () => {
    try {
      setError('');
      const device = await helper.connectViaHID();
      setWiiMote(device);
    } catch (err) {
      setError(String(err));
    }
  };

  const disconnect = () => {
    setWiiMote(null);
    setError('');
  };

  const setDPadFx = (direction: DPadDirection, fxId: string | null) => {
    setDpadFxMapping((prev) => ({
      ...prev,
      [direction]: fxId,
    }));
  };

  return (
    <WiiMoteContext.Provider
      value={{
        helper,
        wiiMote,
        error,
        dpadFxMapping,
        setDPadFx,
        connectViaBluetooth,
        connectViaHID,
        disconnect,
      }}
    >
      {children}
    </WiiMoteContext.Provider>
  );
};
