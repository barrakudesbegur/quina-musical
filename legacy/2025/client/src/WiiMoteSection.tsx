import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Select,
  SelectItem,
} from '@heroui/react';
import { IconBluetooth, IconUsb, IconX } from '@tabler/icons-react';
import { FC, useEffect, useState } from 'react';
import { fxList } from './config/fx';
import { DPadDirection, useWiiMote } from './hooks/useWiiMote';
import { WMButtons } from './utils/WiimoteLib/WiiMote/Types';
import {
  WiiMoteLedStatus,
  WMButtonEvent,
} from './utils/WiimoteLib/WiiMote/ObjectStates';
import { Icon as IconifyIcon } from '@iconify/react';

export const WiiMoteSection: FC = () => {
  const {
    helper,
    wiiMote,
    error,
    connectViaBluetooth,
    connectViaHID,
    disconnect,
  } = useWiiMote();

  return (
    <div className="space-y-6 pb-4">
      <Card>
        <CardHeader className="flex flex-col items-start gap-2">
          <h3 className="text-lg font-semibold">Pas 1: Bluetooth</h3>
          <p className="text-sm text-foreground-500">
            Connecta el Wii Remote via Bluetooth des de la configuració del
            sistema o amb el botó. A MacOS, cal instal·lar{' '}
            <a
              href="https://github.com/dolphin-emu/WiimotePair"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-500 underline"
            >
              WiimotePair
            </a>
            .
          </p>
        </CardHeader>
        <CardBody className="gap-3">
          {helper.bluetoothDevice && (
            <Chip color="success" variant="flat">
              Dispositiu Bluetooth detectat
            </Chip>
          )}
          {helper.bluetoothServer && (
            <Chip color="success" variant="flat">
              Servidor Bluetooth connectat
            </Chip>
          )}
          <Button
            color="primary"
            variant="shadow"
            startContent={<IconBluetooth size={20} />}
            onPress={connectViaBluetooth}
          >
            Connectar via Bluetooth
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex flex-col items-start gap-2">
          <h3 className="text-lg font-semibold">Pas 2: HID</h3>
          <p className="text-sm text-foreground-500">
            Estableix una connexió HID per accedir a les APIs del navegador
          </p>
        </CardHeader>
        <CardBody className="gap-3">
          {helper.hidDevice && (
            <Chip color="success" variant="flat">
              Connexió HID establerta
            </Chip>
          )}
          {wiiMote && (
            <Chip color="success" variant="solid">
              Wii Remote connectat
            </Chip>
          )}
          <div className="flex gap-2">
            <Button
              color="secondary"
              variant="shadow"
              startContent={<IconUsb size={20} />}
              onPress={connectViaHID}
              isDisabled={!!wiiMote}
              className="flex-1"
            >
              Connectar via HID
            </Button>
            {wiiMote && (
              <Button
                color="danger"
                variant="bordered"
                startContent={<IconX size={20} />}
                onPress={disconnect}
              >
                Desconnectar
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {!!error && error !== '{}' && (
        <Card className="bg-danger-50 border-danger">
          <CardBody>
            <p className="text-danger text-sm">{error}</p>
          </CardBody>
        </Card>
      )}

      {wiiMote && (
        <>
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Control</h3>
            </CardHeader>
            <CardBody className="gap-4">
              <div className="flex gap-4">
                <div>
                  <div className="text-sm font-medium mb-2">Vibració</div>
                  <RumbleToggle />
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">LEDs</div>
                  <div className="flex flex-wrap gap-2">
                    <LedToggle index="one" label="1" />
                    <LedToggle index="two" label="2" />
                    <LedToggle index="three" label="3" />
                    <LedToggle index="four" label="4" />
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Efectes de so per D-Pad</h3>
            </CardHeader>
            <CardBody className="gap-3">
              <DPadFxSelect direction="up" label="D-Pad Amunt" />
              <DPadFxSelect direction="down" label="D-Pad Avall" />
              <DPadFxSelect direction="left" label="D-Pad Esquerra" />
              <DPadFxSelect direction="right" label="D-Pad Dreta" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Estat dels Botons</h3>
            </CardHeader>
            <CardBody>
              <div className="flex flex-wrap gap-2">
                {Object.keys(WMButtons).map((b) => (
                  <SingleButton key={b} button={b as WMButtons} />
                ))}
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
};

const SingleButton: FC<{ button: WMButtons }> = ({ button }) => {
  const { wiiMote } = useWiiMote();
  const [pressed, setPressed] = useState(false);
  useEffect(() => {
    const callback = (e: WMButtonEvent) => {
      setPressed(e.isPressed);
    };

    wiiMote?.addButtonListener(button, callback);
    return () => {
      wiiMote?.removeButtonListener(callback);
    };
  }, [button, wiiMote]);

  return (
    <Chip
      color={pressed ? 'success' : 'default'}
      variant={pressed ? 'solid' : 'bordered'}
      className="w-full justify-center"
    >
      {button}
    </Chip>
  );
};

const RumbleToggle: FC = () => {
  const { wiiMote } = useWiiMote();
  const [isRumbling, setRumbling] = useState(false);

  return (
    <Button
      color={isRumbling ? 'warning' : 'default'}
      variant={isRumbling ? 'solid' : 'flat'}
      size="sm"
      onPress={() => {
        setRumbling(!isRumbling);
        wiiMote?.setRumble(!isRumbling);
      }}
      disabled={!wiiMote}
    >
      {isRumbling ? 'Apagar' : 'Encendre'}
    </Button>
  );
};

const LedToggle: FC<{
  index: keyof WiiMoteLedStatus;
  label: string;
}> = ({ index, label }) => {
  const { wiiMote } = useWiiMote();
  const [led, setLed] = useState(false);

  return (
    <Button
      color={led ? 'primary' : 'default'}
      variant={led ? 'solid' : 'flat'}
      size="sm"
      onPress={() => {
        wiiMote?.updateLed({ [index]: !led }, true);
        setLed(!led);
      }}
      className="min-w-auto"
      disabled={!wiiMote}
    >
      {label}
    </Button>
  );
};
const DPadFxSelect: FC<{ direction: DPadDirection; label: string }> = ({
  direction,
  label,
}) => {
  const { dpadFxMapping, setDPadFx } = useWiiMote();
  const selectedFx = dpadFxMapping[direction];
  const selectedFxData = fxList.find((fx) => fx.id === selectedFx);

  return (
    <Select
      label={label}
      selectedKeys={selectedFx ? [selectedFx] : []}
      onSelectionChange={(keys) => {
        const selected = Array.from(keys)[0];
        setDPadFx(direction, selected ? String(selected) : null);
      }}
      size="sm"
      startContent={
        selectedFxData && (
          <IconifyIcon icon={selectedFxData.icon} className="size-4" />
        )
      }
    >
      {fxList.map((fx) => (
        <SelectItem
          key={fx.id}
          startContent={<IconifyIcon icon={fx.icon} className="size-4" />}
        >
          {fx.label}
        </SelectItem>
      ))}
    </Select>
  );
};
