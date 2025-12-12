import {
  Button,
  Card,
  CardBody,
  CircularProgress,
  Image,
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
  IconSquareRotated,
  IconTriangleSquareCircle,
  IconVolume,
  IconVolume3,
  TablerIcon,
} from '@tabler/icons-react';
import { clamp } from 'lodash-es';
import { CSSProperties, FC, PropsWithChildren, useMemo } from 'react';
import { SongTimestampCategory } from '../hooks/useSongPlayer';
import { formatCompactDuration } from '../utils/time';
import { differenceInMilliseconds, parseISO } from 'date-fns';

const songTimestampOptions = [
  { value: 'constant', label: 'Millor', icon: IconCarambolaFilled },
  { value: 'main', label: 'Principals', icon: IconFlameFilled },
  { value: 'secondary', label: 'Secundaris', icon: IconSquareRotated },
  { value: 'any', label: 'Tots', icon: IconTriangleSquareCircle },
] as const satisfies readonly {
  value: SongTimestampCategory;
  label: string;
  icon: TablerIcon;
}[];

export const MiniPlayer: FC<
  PropsWithChildren<{
    song: {
      id: number;
      title: string;
      artist: string;
      cover?: string;
      playedAt: string | null;
      timestamps?: {
        main?: number[];
        secondary?: number[];
      };
    } | null;
    now: number;
    isPlaying: boolean;
    isLoading?: boolean;
    currentTime: number;
    duration: number | null;
    onTogglePlay: () => void;
    onToggleLowVolume: () => void;
    isLowVolumeMode: boolean;
    onNext?: () => void;
    onPrevious?: () => void;
    canPlayPrevious?: boolean;
    onSeek?: (nextTime: number) => void;
    playerPreloadProgress: number;
    selectedTimestampType: string;
    onTimestampTypeChange: (value: string) => void;
  }>
> = ({
  song,
  now,
  isPlaying,
  isLoading = false,
  currentTime,
  duration,
  onTogglePlay,
  onToggleLowVolume,
  isLowVolumeMode,
  onNext,
  onPrevious,
  canPlayPrevious,
  onSeek,
  playerPreloadProgress,
  selectedTimestampType,
  onTimestampTypeChange,
}) => {
  const formattedTimes = useMemo(() => {
    const formatTime = (value: number | null) => {
      if (value === null || !Number.isFinite(value)) return '0:00';
      const totalSeconds = Math.max(0, Math.floor(value));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return {
      current: formatTime(song ? currentTime : 0),
      duration: formatTime(duration),
    };
  }, [currentTime, duration, song]);

  const sliderMax = useMemo(() => {
    if (duration && duration > 0) return duration;
    if (song && currentTime > 0) return Math.max(currentTime, 1);
    return 1;
  }, [currentTime, duration, song]);

  const markers = useMemo(() => {
    if (!song?.timestamps) return [];
    return Object.entries(song.timestamps).flatMap(([type, values]) =>
      values.map((value) => ({
        value,
        type,
        isBest: type === 'main' ? values.indexOf(value) === 0 : false,
      }))
    );
  }, [song]);

  const currentTimestampOption = useMemo(
    () =>
      songTimestampOptions.find((opt) => opt.value === selectedTimestampType) ??
      songTimestampOptions[0],
    [selectedTimestampType]
  );

  const elapsedLabel = useMemo(
    () =>
      song?.playedAt
        ? formatCompactDuration(
            differenceInMilliseconds(now, parseISO(song.playedAt))
          )
        : null,
    [now, song]
  );

  const handleCycleTimestamp = () => {
    const currentIndex = songTimestampOptions.findIndex(
      (opt) => opt.value === selectedTimestampType
    );
    const next =
      songTimestampOptions[(currentIndex + 1) % songTimestampOptions.length];
    onTimestampTypeChange(next.value);
  };

  return (
    <Card
      isBlurred
      shadow="sm"
      className="border-none bg-background/60 dark:bg-default-100/50 max-w-[610px]"
    >
      <CardBody className="overflow-hidden">
        <div className="flex flex-row gap-4 items-center justify-center">
          {song ? (
            <Image
              alt={song?.title ?? 'Sense cançó'}
              className="object-cover max-w-none shrink-0 max-2xs:hidden w-35 rounded-sm aspect-square"
              shadow="md"
              src={song?.cover}
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
                  {(playerPreloadProgress < 1 || isLoading) && (
                    <CircularProgress
                      aria-label="Carregant cançons"
                      size="lg"
                      value={
                        isLoading ? undefined : playerPreloadProgress * 100
                      }
                      disableAnimation
                      className="absolute inset-0 pointer-events-none"
                      isIndeterminate={isLoading}
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
                  markers.map(({ value, type, isBest }) => {
                    const Icon = isBest
                      ? IconCarambolaFilled
                      : type === 'main'
                        ? IconFlameFilled
                        : IconSquareRotated;
                    return (
                      <div
                        key={`${type}-${value}`}
                        className={cn(
                          'absolute -translate-x-1/2 flex flex-col items-center gap-0.5 left-(--progress)',
                          {
                            'text-red-500': type === 'main',
                            'text-blue-500': type === 'secondary',
                          }
                        )}
                        style={
                          {
                            '--progress': `${clamp((value / sliderMax) * 100, 0, 100)}%`,
                          } as CSSProperties
                        }
                      >
                        <Button
                          isIconOnly
                          variant="light"
                          className={cn(
                            'size-6 p-1 -m-1 min-w-auto text-current',
                            {
                              'p-0.5': type === 'secondary',
                            }
                          )}
                          isDisabled={!onSeek || !song}
                          onPress={() => {
                            onSeek?.(value);
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
                maxValue={sliderMax}
                step={0.05}
                value={song ? currentTime : 0}
                onChange={(value) => {
                  if (!onSeek || !song) return;
                  if (typeof value === 'number') {
                    onSeek(value);
                  }
                }}
                isDisabled={!song}
                size="sm"
              />
              <div className="flex justify-between text-small text-foreground/60">
                <span>{formattedTimes.current}</span>
                <span className="text-foreground/50">
                  {formattedTimes.duration}
                </span>
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
              <Button
                isIconOnly
                radius="full"
                variant="light"
                aria-label={
                  currentTimestampOption
                    ? `Canviar punt d'inici (${currentTimestampOption.label})`
                    : "Canviar punt d'inici"
                }
                onPress={handleCycleTimestamp}
              >
                <currentTimestampOption.icon className="size-6" />
              </Button>
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
