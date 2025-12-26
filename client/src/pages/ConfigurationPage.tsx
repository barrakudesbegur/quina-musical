import {
  Button,
  Card,
  CardBody,
  Chip,
  cn,
  Divider,
  Image,
  Input,
  Listbox,
  ListboxItem,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectItem,
  Slider,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import {
  IconCarambolaFilled,
  IconCheck,
  IconFlameFilled,
  IconLoader2,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerSkipForward,
  IconPlus,
  IconSquareRotated,
  IconTrash,
  IconVolume,
  TablerIcon,
} from '@tabler/icons-react';
import { clamp } from 'lodash-es';
import {
  CSSProperties,
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDebounceCallback, useInterval } from 'usehooks-ts';
import { fxList } from '../config/fx';
import type { PlayEffect, SongTimestamp } from '../hooks/useSongPlayer';
import { trpc } from '../utils/trpc';

type Song = {
  id: number;
  title: string;
  artist: string;
  cover: string;
  spotifyId: string;
  timestamps: SongTimestamp[];
  volume?: number;
};

const TIMESTAMP_OPTIONS = [
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
  className: string;
}[];

const PLAY_EFFECT_OPTIONS = [
  { value: 'none', label: 'Cap' },
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'fade-out-in', label: 'Fade out/in' },
] as const;

const formatTime = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '0:00';
  const totalSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

type SaveStatus = 'saved' | 'saving' | 'unsaved';

type FxOptions = { volume?: number; startTime?: number };

export const ConfigurationPage: FC = () => {
  const navigate = useNavigate();
  const songsQuery = trpc.song.getAll.useQuery();
  const fxOptionsQuery = trpc.game.getFxOptions.useQuery();
  const updateSongMutation = trpc.game.updateSong.useMutation();
  const updateFxOptionsMutation = trpc.game.updateFxOptions.useMutation();

  const [activeSongId, setActiveSongId] = useState<number | null>(null);
  const [selectedTimestampIndex, setSelectedTimestampIndex] = useState<
    number | null
  >(null);
  const [timestampDrafts, setTimestampDrafts] = useState<
    Record<number, SongTimestamp[]>
  >({});
  const [volumeDrafts, setVolumeDrafts] = useState<Record<number, number>>({});
  const [fxOptionsDrafts, setFxOptionsDrafts] = useState<
    Record<string, FxOptions>
  >({});
  const [saveStatuses, setSaveStatuses] = useState<Record<number, SaveStatus>>(
    {}
  );
  const [fxSaveStatus, setFxSaveStatus] = useState<SaveStatus>('saved');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('adminAuth');
    navigate('/login');
  }, [navigate]);

  const sortedSongs = useMemo(() => {
    return (songsQuery.data ?? []).slice().sort((a, b) => a.id - b.id);
  }, [songsQuery.data]);

  const getTimestamps = useCallback(
    (songId: number): SongTimestamp[] => {
      if (songId in timestampDrafts) {
        return timestampDrafts[songId];
      }
      const song = songsQuery.data?.find((s) => s.id === songId);
      return song?.timestamps ?? [];
    },
    [timestampDrafts, songsQuery.data]
  );

  const getVolume = useCallback(
    (songId: number): number => {
      if (songId in volumeDrafts) {
        return volumeDrafts[songId];
      }
      const song = songsQuery.data?.find((s) => s.id === songId);
      return song?.volume ?? 1;
    },
    [volumeDrafts, songsQuery.data]
  );

  const getFxOptions = useCallback(
    (fxId: string): FxOptions => {
      const draft = fxOptionsDrafts[fxId];
      const saved = fxOptionsQuery.data?.[fxId];
      return {
        volume: draft?.volume ?? saved?.volume ?? 1,
        startTime: draft?.startTime ?? saved?.startTime ?? 0,
      };
    },
    [fxOptionsDrafts, fxOptionsQuery.data]
  );

  const debouncedSaveSong = useDebounceCallback(
    async (
      songId: number,
      updates: { timestamps?: SongTimestamp[]; volume?: number }
    ) => {
      setSaveStatuses((prev) => ({ ...prev, [songId]: 'saving' }));
      try {
        await updateSongMutation.mutateAsync({ songId, ...updates });
        setSaveStatuses((prev) => ({ ...prev, [songId]: 'saved' }));
      } catch (err) {
        console.error('Failed to save song:', err);
        setSaveStatuses((prev) => ({ ...prev, [songId]: 'unsaved' }));
      }
    },
    600
  );

  const debouncedSaveFxOptions = useDebounceCallback(
    async (fxId: string, options: FxOptions) => {
      setFxSaveStatus('saving');
      try {
        await updateFxOptionsMutation.mutateAsync({ fxId, options });
        setFxSaveStatus('saved');
      } catch (err) {
        console.error('Failed to save FX options:', err);
        setFxSaveStatus('unsaved');
      }
    },
    600
  );

  const updateTimestamps = useCallback(
    (songId: number, newTimestamps: SongTimestamp[]) => {
      setTimestampDrafts((prev) => ({ ...prev, [songId]: newTimestamps }));
      setSaveStatuses((prev) => ({ ...prev, [songId]: 'unsaved' }));
      debouncedSaveSong(songId, { timestamps: newTimestamps });
    },
    [debouncedSaveSong]
  );

  const updateVolume = useCallback(
    (songId: number, volume: number) => {
      setVolumeDrafts((prev) => ({ ...prev, [songId]: volume }));
      setSaveStatuses((prev) => ({ ...prev, [songId]: 'unsaved' }));
      debouncedSaveSong(songId, { volume });
    },
    [debouncedSaveSong]
  );

  const updateFxOption = useCallback(
    (fxId: string, key: keyof FxOptions, value: number) => {
      setFxOptionsDrafts((prev) => {
        const current = prev[fxId] ?? {};
        const next = { ...current, [key]: value };
        setFxSaveStatus('unsaved');
        debouncedSaveFxOptions(fxId, next);
        return { ...prev, [fxId]: next };
      });
    },
    [debouncedSaveFxOptions]
  );

  const playSong = useCallback(
    async (songId: number, seekTo?: number) => {
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.addEventListener('loadedmetadata', () => {
          setDuration(audioRef.current?.duration ?? null);
        });
        audioRef.current.addEventListener('ended', () => {
          setIsPlaying(false);
        });
      }

      if (activeSongId !== songId) {
        audioRef.current.src = `/audios/song/${songId}.mp3`;
        audioRef.current.load();
        setActiveSongId(songId);
        setSelectedTimestampIndex(null);
      }

      if (seekTo !== undefined) {
        audioRef.current.currentTime = seekTo;
      }

      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.error('Playback error:', err);
      }
    },
    [activeSongId]
  );

  const pauseSong = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlaySong = useCallback(
    (songId: number) => {
      if (activeSongId === songId && isPlaying) {
        pauseSong();
      } else {
        playSong(songId);
      }
    },
    [activeSongId, isPlaying, pauseSong, playSong]
  );

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = clamp(
        time,
        0,
        audioRef.current.duration || 0
      );
    }
  }, []);

  useInterval(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, 100);

  const addTimestamp = useCallback(
    (songId: number, tag: SongTimestamp['tag']) => {
      const current = getTimestamps(songId);
      const newTimestamp: SongTimestamp = {
        time: currentTime,
        tag,
        playEffect: { type: 'crossfade', durationSeconds: 1 },
      };
      updateTimestamps(songId, [...current, newTimestamp]);
      setSelectedTimestampIndex(current.length);
    },
    [currentTime, getTimestamps, updateTimestamps]
  );

  const updateTimestamp = useCallback(
    (songId: number, index: number, updates: Partial<SongTimestamp>) => {
      const current = getTimestamps(songId);
      const updated = current.map((ts, i) =>
        i === index ? { ...ts, ...updates } : ts
      );
      updateTimestamps(songId, updated);
    },
    [getTimestamps, updateTimestamps]
  );

  const deleteTimestamp = useCallback(
    (songId: number, index: number) => {
      const current = getTimestamps(songId);
      updateTimestamps(
        songId,
        current.filter((_, i) => i !== index)
      );
      setSelectedTimestampIndex(null);
    },
    [getTimestamps, updateTimestamps]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !activeSongId ||
        selectedTimestampIndex === null ||
        e.target instanceof HTMLInputElement
      ) {
        return;
      }

      const step = e.shiftKey ? 0.5 : 0.05;
      const current = getTimestamps(activeSongId);
      const ts = current[selectedTimestampIndex];
      if (!ts) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        updateTimestamp(activeSongId, selectedTimestampIndex, {
          time: Math.max(0, ts.time - step),
        });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        updateTimestamp(activeSongId, selectedTimestampIndex, {
          time: ts.time + step,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSongId, selectedTimestampIndex, getTimestamps, updateTimestamp]);

  return (
    <main className="h-dvh flex flex-col bg-background">
      <header className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-divider">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-brand uppercase tracking-widest">
            Song Timestamps
          </h1>
          <Chip variant="flat" size="sm">
            {sortedSongs.length} songs
          </Chip>
        </div>
        <div className="flex items-center gap-2">
          <Button
            as={Link}
            to="/admin"
            variant="flat"
            color="default"
            size="sm"
          >
            Admin home
          </Button>
          <Button
            onPress={handleLogout}
            variant="faded"
            color="primary"
            size="sm"
          >
            Logout
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col divide-y divide-divider">
          {sortedSongs.map((song) => {
            const isActive = activeSongId === song.id;
            const timestamps = getTimestamps(song.id);
            const saveStatus = saveStatuses[song.id] ?? 'saved';

            return (
              <SongRow
                key={song.id}
                song={song}
                timestamps={timestamps}
                volume={getVolume(song.id)}
                isActive={isActive}
                isPlaying={isActive && isPlaying}
                currentTime={isActive ? currentTime : 0}
                duration={isActive ? duration : null}
                selectedTimestampIndex={
                  isActive ? selectedTimestampIndex : null
                }
                saveStatus={saveStatus}
                onTogglePlay={() => togglePlaySong(song.id)}
                onSeek={(time) => {
                  if (!isActive) playSong(song.id, time);
                  else seekTo(time);
                }}
                onSelectTimestamp={(index) => {
                  if (!isActive) {
                    playSong(song.id);
                  }
                  setSelectedTimestampIndex(index);
                }}
                onAddTimestamp={(tag) => {
                  if (!isActive) {
                    playSong(song.id);
                  }
                  addTimestamp(song.id, tag);
                }}
                onUpdateTimestamp={(index, updates) =>
                  updateTimestamp(song.id, index, updates)
                }
                onDeleteTimestamp={(index) => deleteTimestamp(song.id, index)}
                onVolumeChange={(vol) => updateVolume(song.id, vol)}
              />
            );
          })}
        </div>

        <Divider className="my-6" />

        <FxSettingsSection
          fxOptions={fxList.reduce(
            (acc, fx) => ({ ...acc, [fx.id]: getFxOptions(fx.id) }),
            {} as Record<string, FxOptions>
          )}
          saveStatus={fxSaveStatus}
          onOptionChange={updateFxOption}
        />
      </div>
    </main>
  );
};

const SongRow: FC<{
  song: Song;
  timestamps: SongTimestamp[];
  volume: number;
  isActive: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number | null;
  selectedTimestampIndex: number | null;
  saveStatus: SaveStatus;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onSelectTimestamp: (index: number) => void;
  onAddTimestamp: (tag: SongTimestamp['tag']) => void;
  onUpdateTimestamp: (index: number, updates: Partial<SongTimestamp>) => void;
  onDeleteTimestamp: (index: number) => void;
  onVolumeChange: (volume: number) => void;
}> = ({
  song,
  timestamps,
  volume,
  isActive,
  isPlaying,
  currentTime,
  duration,
  selectedTimestampIndex,
  saveStatus,
  onTogglePlay,
  onSeek,
  onSelectTimestamp,
  onAddTimestamp,
  onUpdateTimestamp,
  onDeleteTimestamp,
  onVolumeChange,
}) => {
  const selectedTimestamp =
    selectedTimestampIndex !== null ? timestamps[selectedTimestampIndex] : null;

  return (
    <div
      className={cn(
        'grid grid-cols-[80px_1fr_320px] gap-4 p-4 transition-colors',
        isActive && 'bg-default-50'
      )}
    >
      <Image
        src={song.cover}
        alt={song.title}
        className="w-20 h-20 object-cover rounded-lg shrink-0"
      />

      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-default-400 text-sm">{song.id}.</span>
              <h3 className="font-semibold truncate">{song.title}</h3>
            </div>
            <p className="text-default-500 text-sm truncate">{song.artist}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <SaveStatusIndicator status={saveStatus} />

            <Button
              isIconOnly
              size="sm"
              variant="flat"
              onPress={onTogglePlay}
              aria-label={isPlaying ? 'Pausa' : 'Reproduir'}
            >
              {isPlaying ? (
                <IconPlayerPauseFilled className="size-4" />
              ) : (
                <IconPlayerPlayFilled className="size-4" />
              )}
            </Button>

            <Popover placement="bottom">
              <PopoverTrigger>
                <Button
                  size="sm"
                  variant="flat"
                  startContent={<IconPlus className="size-4" />}
                >
                  Afegir
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-1">
                <Listbox
                  aria-label="Afegir timestamp"
                  onAction={(key) =>
                    onAddTimestamp(key as SongTimestamp['tag'])
                  }
                >
                  {TIMESTAMP_OPTIONS.map((opt) => (
                    <ListboxItem
                      key={opt.value}
                      startContent={
                        <opt.icon className={cn('size-4', opt.className)} />
                      }
                    >
                      {opt.label}
                    </ListboxItem>
                  ))}
                </Listbox>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-default-400 w-10 text-right">
            {formatTime(currentTime)}
          </span>

          <div className="flex-1 relative h-8">
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-default-200 rounded-full" />

            {duration && currentTime > 0 && (
              <div
                className="absolute top-1/2 h-1 -translate-y-1/2 bg-primary rounded-full"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            )}

            {duration &&
              timestamps.map((ts, index) => {
                const opt = TIMESTAMP_OPTIONS.find((o) => o.value === ts.tag);
                const Icon = opt?.icon ?? IconSquareRotated;
                const isSelected = selectedTimestampIndex === index;

                return (
                  <button
                    key={index}
                    type="button"
                    className={cn(
                      'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center z-10 transition-transform',
                      isSelected && 'scale-125',
                      opt?.className
                    )}
                    style={
                      {
                        left: `${clamp((ts.time / duration) * 100, 0, 100)}%`,
                      } as CSSProperties
                    }
                    onClick={() => onSelectTimestamp(index)}
                  >
                    <Icon className="size-4" stroke={2.5} />
                  </button>
                );
              })}

            <Slider
              aria-label="Seek"
              classNames={{
                base: 'absolute inset-0',
                track: 'bg-transparent',
                filler: 'bg-transparent',
                thumb: 'opacity-0 hover:opacity-100',
              }}
              minValue={0}
              maxValue={duration ?? 100}
              step={0.1}
              value={currentTime}
              onChange={(value) => {
                if (typeof value === 'number') onSeek(value);
              }}
            />
          </div>

          <span className="text-xs text-default-400 w-10">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 shrink-0">
        <Card>
          <CardBody className="p-3">
            {selectedTimestamp ? (
              <TimestampEditor
                timestamp={selectedTimestamp}
                duration={duration}
                onUpdate={(updates) =>
                  onUpdateTimestamp(selectedTimestampIndex!, updates)
                }
                onDelete={() => onDeleteTimestamp(selectedTimestampIndex!)}
                onSeekTo={(time) => onSeek(time)}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-default-400 text-sm">
                Selecciona un timestamp per editar
              </div>
            )}
          </CardBody>
        </Card>

        <SongVolumeControl volume={volume} onChange={onVolumeChange} />
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

const TimestampEditor: FC<{
  timestamp: SongTimestamp;
  duration: number | null;
  onUpdate: (updates: Partial<SongTimestamp>) => void;
  onDelete: () => void;
  onSeekTo: (time: number) => void;
}> = ({ timestamp, duration, onUpdate, onDelete, onSeekTo }) => {
  const opt = TIMESTAMP_OPTIONS.find((o) => o.value === timestamp.tag);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {opt && <opt.icon className={cn('size-5', opt.className)} />}
          <span className="font-medium text-sm">Editar timestamp</span>
        </div>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          color="danger"
          onPress={onDelete}
        >
          <IconTrash className="size-4" />
        </Button>
      </div>

      <Select
        label="Tipus"
        size="sm"
        selectedKeys={[timestamp.tag]}
        onSelectionChange={(keys) => {
          const value = Array.from(keys)[0] as SongTimestamp['tag'];
          if (value) onUpdate({ tag: value });
        }}
      >
        {TIMESTAMP_OPTIONS.map((opt) => (
          <SelectItem
            key={opt.value}
            startContent={<opt.icon className={cn('size-4', opt.className)} />}
          >
            {opt.label}
          </SelectItem>
        ))}
      </Select>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          label="Temps (s)"
          size="sm"
          step={0.1}
          min={0}
          max={duration ?? undefined}
          value={timestamp.time.toFixed(2)}
          onValueChange={(val) => {
            const num = parseFloat(val);
            if (!Number.isNaN(num)) onUpdate({ time: num });
          }}
          classNames={{ base: 'flex-1' }}
        />
        <Button
          size="sm"
          variant="flat"
          onPress={() => onSeekTo(timestamp.time)}
        >
          Anar
        </Button>
      </div>

      <Select
        label="Efecte"
        size="sm"
        selectedKeys={[timestamp.playEffect.type]}
        onSelectionChange={(keys) => {
          const value = Array.from(keys)[0] as PlayEffect['type'];
          if (!value) return;

          let newEffect: PlayEffect;
          if (value === 'none') {
            newEffect = { type: 'none' };
          } else if (value === 'crossfade') {
            newEffect = { type: 'crossfade', durationSeconds: 1 };
          } else {
            newEffect = {
              type: 'fade-out-in',
              fadeOutSeconds: 1,
              silenceSeconds: 0.2,
              fadeInSeconds: 0.5,
            };
          }
          onUpdate({ playEffect: newEffect });
        }}
      >
        {PLAY_EFFECT_OPTIONS.map((opt) => (
          <SelectItem key={opt.value}>{opt.label}</SelectItem>
        ))}
      </Select>

      {timestamp.playEffect.type === 'crossfade' && (
        <Input
          type="number"
          label="Durada crossfade (s)"
          size="sm"
          step={0.1}
          min={0}
          value={timestamp.playEffect.durationSeconds.toFixed(1)}
          onValueChange={(val) => {
            const num = parseFloat(val);
            if (!Number.isNaN(num)) {
              onUpdate({
                playEffect: { type: 'crossfade', durationSeconds: num },
              });
            }
          }}
        />
      )}

      {timestamp.playEffect.type === 'fade-out-in' && (
        <>
          <Input
            type="number"
            label="Fade out (s)"
            size="sm"
            step={0.1}
            min={0}
            value={timestamp.playEffect.fadeOutSeconds.toFixed(1)}
            onValueChange={(val) => {
              const num = parseFloat(val);
              if (
                !Number.isNaN(num) &&
                timestamp.playEffect.type === 'fade-out-in'
              ) {
                onUpdate({
                  playEffect: { ...timestamp.playEffect, fadeOutSeconds: num },
                });
              }
            }}
          />
          <Input
            type="number"
            label="Silenci (s)"
            size="sm"
            step={0.1}
            min={0}
            value={timestamp.playEffect.silenceSeconds.toFixed(1)}
            onValueChange={(val) => {
              const num = parseFloat(val);
              if (
                !Number.isNaN(num) &&
                timestamp.playEffect.type === 'fade-out-in'
              ) {
                onUpdate({
                  playEffect: { ...timestamp.playEffect, silenceSeconds: num },
                });
              }
            }}
          />
          <Input
            type="number"
            label="Fade in (s)"
            size="sm"
            step={0.1}
            min={0}
            value={timestamp.playEffect.fadeInSeconds.toFixed(1)}
            onValueChange={(val) => {
              const num = parseFloat(val);
              if (
                !Number.isNaN(num) &&
                timestamp.playEffect.type === 'fade-out-in'
              ) {
                onUpdate({
                  playEffect: { ...timestamp.playEffect, fadeInSeconds: num },
                });
              }
            }}
          />
        </>
      )}

      <p className="text-xs text-default-400">
        ← → per ajustar temps (Shift: ±0.5s)
      </p>
    </div>
  );
};

const SongVolumeControl: FC<{
  volume: number;
  onChange: (volume: number) => void;
}> = ({ volume, onChange }) => {
  return (
    <Card>
      <CardBody className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <IconVolume className="size-4 text-default-500" />
          <span className="text-sm font-medium">Volum</span>
          <span className="text-xs text-default-400 ml-auto">
            {Math.round(volume * 100)}%
          </span>
        </div>
        <Slider
          aria-label="Volum de la cançó"
          size="sm"
          minValue={0}
          maxValue={2}
          step={0.01}
          value={volume}
          onChange={(val) => {
            if (typeof val === 'number') onChange(val);
          }}
          classNames={{
            filler: volume > 1 ? 'bg-warning' : undefined,
          }}
        />
      </CardBody>
    </Card>
  );
};

const FxSettingsSection: FC<{
  fxOptions: Record<string, FxOptions>;
  saveStatus: SaveStatus;
  onOptionChange: (fxId: string, key: keyof FxOptions, value: number) => void;
}> = ({ fxOptions, saveStatus, onOptionChange }) => {
  return (
    <section className="px-6 pb-6">
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-xl font-brand uppercase tracking-widest">
          FX Settings
        </h2>
        <Chip variant="flat" size="sm">
          {fxList.length} FX
        </Chip>
        <div className="ml-auto">
          <SaveStatusIndicator status={saveStatus} />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {fxList.map((fx) => {
          const opts = fxOptions[fx.id] ?? {};
          const volume = opts.volume ?? 1;
          const startTime = opts.startTime ?? 0;
          return (
            <Card key={fx.id}>
              <CardBody className="p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Icon icon={fx.icon} className="size-5" />
                  <span className="text-sm font-medium truncate">
                    {fx.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
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
                        onOptionChange(fx.id, 'volume', val);
                    }}
                    classNames={{
                      filler: volume > 1 ? 'bg-warning' : undefined,
                    }}
                  />
                  <span className="text-xs text-default-400 w-10 text-right">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <IconPlayerSkipForward className="size-4 text-default-400 shrink-0" />
                  <Input
                    aria-label={`Inici ${fx.label}`}
                    type="number"
                    size="sm"
                    min={0}
                    step={0.1}
                    value={String(startTime)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= 0) {
                        onOptionChange(fx.id, 'startTime', val);
                      }
                    }}
                    endContent={
                      <span className="text-xs text-default-400">s</span>
                    }
                    classNames={{
                      input: 'text-center',
                      inputWrapper: 'h-8',
                    }}
                  />
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </section>
  );
};
