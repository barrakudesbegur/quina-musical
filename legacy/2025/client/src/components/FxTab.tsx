import { Card, CardBody, Chip, Slider } from '@heroui/react';
import { Icon } from '@iconify/react';
import {
  IconCheck,
  IconLoader2,
  IconVolume,
} from '@tabler/icons-react';
import { FC, useCallback, useState } from 'react';
import { useDebounceCallback } from 'usehooks-ts';
import { fxList } from '../config/fx';
import { trpc } from '../utils/trpc';

type SaveStatus = 'saved' | 'saving' | 'unsaved';
type FxOptions = { volume?: number };

export const FxTab: FC = () => {
  const fxOptionsQuery = trpc.game.getFxOptions.useQuery();
  const updateFxOptionsMutation = trpc.game.updateFxOptions.useMutation();

  const [fxOptionsDrafts, setFxOptionsDrafts] = useState<
    Record<string, FxOptions>
  >({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  const getFxOptions = useCallback(
    (fxId: string): FxOptions => {
      const draft = fxOptionsDrafts[fxId];
      const saved = fxOptionsQuery.data?.[fxId];
      return {
        volume: draft?.volume ?? saved?.volume ?? 1,
      };
    },
    [fxOptionsDrafts, fxOptionsQuery.data]
  );

  const debouncedSaveFxOptions = useDebounceCallback(
    async (fxId: string, options: FxOptions) => {
      setSaveStatus('saving');
      try {
        await updateFxOptionsMutation.mutateAsync({ fxId, options });
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to save FX options:', err);
        setSaveStatus('unsaved');
      }
    },
    600
  );

  const updateFxOption = useCallback(
    (fxId: string, key: keyof FxOptions, value: number) => {
      setFxOptionsDrafts((prev) => {
        const current = prev[fxId] ?? {};
        const next = { ...current, [key]: value };
        setSaveStatus('unsaved');
        debouncedSaveFxOptions(fxId, next);
        return { ...prev, [fxId]: next };
      });
    },
    [debouncedSaveFxOptions]
  );

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-4">
        <SaveStatusIndicator status={saveStatus} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {fxList.map((fx) => {
          const opts = getFxOptions(fx.id);
          const volume = opts.volume ?? 1;
          return (
            <Card key={fx.id}>
              <CardBody className="p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Icon icon={fx.icon} className="size-5" />
                  <span className="text-sm font-medium truncate">
                    {fx.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <IconVolume className="size-4 text-default-400 shrink-0" />
                  <Slider
                    aria-label={`Volum ${fx.label}`}
                    size="sm"
                    minValue={0}
                    maxValue={2}
                    step={0.01}
                    value={volume}
                    onChange={(val) => {
                      if (typeof val === 'number')
                        updateFxOption(fx.id, 'volume', val);
                    }}
                    classNames={{
                      filler: volume > 1 ? 'bg-warning' : undefined,
                    }}
                  />
                  <span className="text-xs text-default-400 w-10 text-right">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

const SaveStatusIndicator: FC<{ status: SaveStatus }> = ({ status }) => {
  if (status === 'saved') {
    return (
      <Chip
        size="sm"
        variant="flat"
        color="success"
        startContent={<IconCheck className="size-3" />}
      >
        Guardat
      </Chip>
    );
  }
  if (status === 'saving') {
    return (
      <Chip
        size="sm"
        variant="flat"
        color="warning"
        startContent={<IconLoader2 className="size-3 animate-spin" />}
      >
        Guardant...
      </Chip>
    );
  }
  return (
    <Chip size="sm" variant="flat" color="default">
      Sense guardar
    </Chip>
  );
};
