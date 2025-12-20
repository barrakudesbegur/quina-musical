import { FC, PropsWithChildren, useEffect, useState } from 'react';
import { useLocalStorage, useSessionStorage } from 'usehooks-ts';
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
  const [connectedDeviceId, setConnectedDeviceId] = useSessionStorage<
    number | null
  >('wiimote-device-id', null);
  const [dpadFxMapping, setDpadFxMapping] = useLocalStorage<DPadFxMapping>(
    'wiimote-dpad-fx-mapping',
    {
      up: 'anime-wow',
      down: 'tada',
      left: 'correct',
      right: 'buzzer',
    }
  );

  useEffect(() => {
    void (async () => {
      if (connectedDeviceId === null) return;

      try {
        setError('');
        const device = await helper.connectViaHID(connectedDeviceId);
        if (device) {
          setWiiMote(device);
          setConnectedDeviceId(device.device.productId);
        } else {
          setConnectedDeviceId(null);
        }
      } catch (err) {
        console.error('Failed to reconnect to Wii Remote:', err);
        setError(String(err));
        setConnectedDeviceId(null);
      }
    })();
  }, [connectedDeviceId, setConnectedDeviceId, helper]);

  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (wiiMote?.device.opened) {
        try {
          wiiMote.setRumble(false);
          await wiiMote.device.close();
        } catch (err) {
          console.error('Failed to close Wii Remote:', err);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [wiiMote]);

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
      if (device) {
        setWiiMote(device);
        setConnectedDeviceId(device.device.productId);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const disconnect = () => {
    if (wiiMote?.device.opened) {
      try {
        wiiMote.setRumble(false);
        void wiiMote.device.close();
      } catch (err) {
        console.error('Failed to close Wii Remote:', err);
      }
    }
    setWiiMote(null);
    setError('');
    setConnectedDeviceId(null);
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
