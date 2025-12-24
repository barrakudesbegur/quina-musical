import {
  Button,
  Card,
  CardBody,
  CircularProgress,
  Image,
  Listbox,
  ListboxItem,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Slider,
  cn,
} from '@heroui/react';
import {
  IconCarambolaFilled,
  IconFlameFilled,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconQuestionMark,
  IconSquareRotated,
  IconVolume,
  IconVolume3,
  TablerIcon,
} from '@tabler/icons-react';
import { differenceInMilliseconds, parseISO } from 'date-fns';
import { clamp } from 'lodash-es';
import {
  CSSProperties,
  FC,
  PropsWithChildren,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useInterval } from 'usehooks-ts';
import type { SongTimestamp } from '../hooks/useSongPlayer';
import { formatCompactDuration } from '../utils/time';

const songTimestampOptions = [
  {
    value: 'best',
    label: 'Millor',
    icon: IconCarambolaFilled,
    className: 'text-yellow-500',
  },
  {
    value: 'main',
    label: 'Principals',
    icon: IconFlameFilled,
    className: 'text-red-500',
  },
  {
    value: 'secondary',
    label: 'Secundaris',
    icon: IconSquareRotated,
    className: 'text-blue-500',
  },
] as const satisfies readonly {
  value: SongTimestamp['tag'];
  label: string;
  icon: TablerIcon;
  className: string | null;
}[];

const formatTime = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '0:00';
  const totalSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const MiniPlayer: FC<
  PropsWithChildren<{
    song: {
      id: number;
      title: string;
      artist: string;
      cover?: string;
      playedAt: string | null;
      timestamps?: SongTimestamp[];
    } | null;
    now: number;
    isPlaying: boolean;
    isLoading?: boolean;
    getCurrentTime: () => number;
    duration: number | null;
    onTogglePlay: () => void;
    onToggleLowVolume: () => void;
    isLowVolumeMode: boolean;
    onNext?: () => void;
    onPrevious?: () => void;
    canPlayPrevious?: boolean;
    onSeek?: (nextTime: number) => void;
    isSongReady: boolean;
    selectedTimestampTypes: SongTimestamp['tag'][];
    onTimestampTypesChange: (values: SongTimestamp['tag'][]) => void;
  }>
> = ({
  song,
  now,
  isPlaying,
  isLoading = false,
  getCurrentTime,
  duration,
  onTogglePlay,
  onToggleLowVolume,
  isLowVolumeMode,
  onNext,
  onPrevious,
  canPlayPrevious,
  onSeek,
  isSongReady,
  selectedTimestampTypes,
  onTimestampTypesChange,
}) => {
  const [currentTime, setCurrentTime] = useState<number>(0);
  const updateCurrentTime = useCallback(() => {
    setCurrentTime(getCurrentTime());
  }, [getCurrentTime]);
  useInterval(updateCurrentTime, 300);

  const formattedCurrent = useMemo(() => {
    return formatTime(currentTime);
  }, [currentTime]);

  const formattedDuration = useMemo(() => {
    return formatTime(duration);
  }, [duration]);

  const elapsedLabel = useMemo(
    () =>
      song?.playedAt
        ? formatCompactDuration(
            differenceInMilliseconds(now, parseISO(song.playedAt))
          )
        : null,
    [now, song]
  );

  return (
    <Card
      isBlurred
      shadow="sm"
      className="border-none shrink-0 bg-background/60 dark:bg-default-100/50 max-w-[610px]"
    >
      <CardBody className="overflow-hidden">
        <div className="flex flex-row gap-4 items-center justify-center">
          {song ? (
            <Image
              alt={song?.title ?? 'Sense cançó'}
              className="object-cover max-w-none shrink-0 max-2xs:hidden w-35 rounded-sm aspect-square"
              shadow="md"
              src={song?.cover}
              classNames={{
                wrapper: 'shrink-0',
              }}
            />
          ) : (
            <Card
              className="max-2xs:hidden w-full max-w-32 xs:max-w-40 min-w-16 rounded-xl aspect-square"
              shadow="md"
            >
              <CardBody className="flex items-center justify-center ">
                <IconVolume3 className="size-10 text-foreground/10" />
              </CardBody>
            </Card>
          )}
          <div className="flex flex-col grow min-w-32">
            <div className="flex justify-between items-start gap-2">
              <div className="flex flex-col gap-0   mr-auto min-w-16">
                <h1 className="text-xl font-bold tracking-wide truncate">
                  {song ? song.title : 'Silenci'}
                </h1>
                <h3 className=" text-foreground/90 truncate">
                  {song?.artist ?? '-'}
                </h3>
              </div>

              <div className="flex flex-col items-center justify-start gap-0.5">
                <div className="relative flex items-center justify-center">
                  <Button
                    isIconOnly
                    radius="full"
                    variant="light"
                    aria-label={isPlaying ? 'Pausa' : 'Reproduir'}
                    onPress={onTogglePlay}
                  >
                    <div className="flex items-center justify-center text-background bg-foreground rounded-full p-2">
                      {isPlaying ? (
                        <IconPlayerPauseFilled className="size-6" />
                      ) : (
                        <IconPlayerPlayFilled className="size-6" />
                      )}
                    </div>
                  </Button>
                  {(!isSongReady || isLoading) && (
                    <CircularProgress
                      aria-label="Carregant cançons"
                      size="lg"
                      disableAnimation
                      className="absolute inset-0 pointer-events-none"
                      isIndeterminate
                    />
                  )}
                </div>
                {elapsedLabel && (
                  <div className="overflow-visible relative">
                    <p className="text-xs absolute top-0 whitespace-nowrap left-1/2 -translate-x-1/2 text-default-400 font-bold">
                      {elapsedLabel}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-1 -mb-3">
              <div className="relative mx-2.5 h-4 overflow-visible ">
                {!!duration &&
                  song?.timestamps?.map(({ time, tag }) => {
                    const option = songTimestampOptions.find(
                      (opt) => opt.value === tag
                    );

                    const Icon = option?.icon ?? IconQuestionMark;
                    return (
                      <div
                        key={`${tag}-${time}`}
                        className={cn(
                          'absolute -translate-x-1/2 flex flex-col items-center gap-0.5 left-(--progress)',
                          option?.className
                        )}
                        style={
                          {
                            '--progress': duration
                              ? `${clamp((time / duration) * 100, 0, 100)}%`
                              : undefined,
                          } as CSSProperties
                        }
                      >
                        <Button
                          isIconOnly
                          variant="light"
                          className={cn(
                            'size-6 p-1 -m-1 min-w-auto text-current',
                            {
                              'p-0.5': tag === 'secondary',
                            }
                          )}
                          isDisabled={!onSeek || !song}
                          onPress={() => {
                            onSeek?.(time);
                          }}
                        >
                          <Icon className="size-4" stroke={3} />
                        </Button>
                        <div className="w-[2px] pointer-events-none rounded-full h-4 bg-current" />
                      </div>
                    );
                  })}
              </div>
              <Slider
                aria-label="Progress de reproducció"
                classNames={{
                  track: 'bg-default-500/30',
                  thumb: cn(
                    'w-2 h-2 after:w-2 after:h-2 after:bg-foreground',
                    !song && 'opacity-40 cursor-not-allowed'
                  ),
                }}
                color="foreground"
                minValue={0}
                maxValue={duration ?? undefined}
                step={0.05}
                value={song ? currentTime : 0}
                onChange={(value) => {
                  if (!onSeek || !song) return;
                  if (typeof value === 'number') {
                    onSeek(value satisfies number);
                  }
                }}
                isDisabled={!song}
                size="sm"
              />
              <div className="flex justify-between text-small text-foreground/60">
                <span>{formattedCurrent}</span>
                <span className="text-foreground/50">{formattedDuration}</span>
              </div>
            </div>

            <div className="flex w-full items-center justify-center">
              <Button
                isIconOnly
                className="data-hover:bg-foreground/10!"
                radius="full"
                variant="light"
                aria-label="Anterior"
                isDisabled={!onPrevious || !canPlayPrevious}
                onPress={onPrevious}
              >
                <IconPlayerSkipBack className="size-6" />
              </Button>
              <Popover placement="top">
                <PopoverTrigger>
                  <Button
                    isIconOnly
                    radius="full"
                    variant="light"
                    aria-label="Punts d'inici"
                  >
                    <div className="grid grid-cols-2 grid-rows-2 gap-0.5 size-6 place-items-center">
                      {songTimestampOptions.map((opt) => {
                        const isSelected = selectedTimestampTypes.includes(
                          opt.value
                        );
                        return (
                          <opt.icon
                            key={opt.value}
                            stroke={3}
                            className={cn(
                              'size-3',
                              opt.className,
                              !isSelected && 'opacity-25'
                            )}
                          />
                        );
                      })}
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-1">
                  <Listbox
                    aria-label="Punts d'inici"
                    variant="flat"
                    selectionMode="multiple"
                    selectedKeys={new Set(selectedTimestampTypes)}
                    onSelectionChange={(keys) => {
                      onTimestampTypesChange(
                        keys === 'all' || keys.size === 0
                          ? songTimestampOptions.map((o) => o.value)
                          : Array.from(keys).map(
                              (k) => String(k) as SongTimestamp['tag']
                            )
                      );
                    }}
                  >
                    {songTimestampOptions.map((opt) => (
                      <ListboxItem
                        key={opt.value}
                        startContent={
                          <opt.icon
                            className={cn('size-4', opt.className)}
                            stroke={3}
                          />
                        }
                      >
                        {opt.label}
                      </ListboxItem>
                    ))}
                  </Listbox>
                </PopoverContent>
              </Popover>
              <Button
                isIconOnly
                radius="full"
                variant="light"
                aria-label={isLowVolumeMode ? 'Pujar volum' : 'Baixar volum'}
                onPress={onToggleLowVolume}
              >
                {isLowVolumeMode ? (
                  <IconVolume3 className="size-6" />
                ) : (
                  <IconVolume className="size-6" />
                )}
              </Button>

              <Button
                isIconOnly
                className="data-hover:bg-foreground/10!"
                radius="full"
                variant="light"
                aria-label="Següent"
                isDisabled={!onNext}
                onPress={onNext}
              >
                <IconPlayerSkipForward className="size-6" />
              </Button>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
