import {
  Button,
  Card,
  CardBody,
  Chip,
  cn,
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
import {
  IconCarambolaFilled,
  IconCheck,
  IconFlameFilled,
  IconLoader2,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
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

export const ConfigurationPage: FC = () => {
  const navigate = useNavigate();
  const songsQuery = trpc.song.getAll.useQuery();
  const updateTimestampsMutation = trpc.game.updateSongTimestamps.useMutation();

  const [activeSongId, setActiveSongId] = useState<number | null>(null);
  const [selectedTimestampIndex, setSelectedTimestampIndex] = useState<
    number | null
  >(null);
  const [timestampDrafts, setTimestampDrafts] = useState<
    Record<number, SongTimestamp[]>
  >({});
  const [saveStatuses, setSaveStatuses] = useState<Record<number, SaveStatus>>(
    {}
  );

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

  const debouncedSave = useDebounceCallback(
    async (songId: number, timestamps: SongTimestamp[]) => {
      setSaveStatuses((prev) => ({ ...prev, [songId]: 'saving' }));
      try {
        await updateTimestampsMutation.mutateAsync({ songId, timestamps });
        setSaveStatuses((prev) => ({ ...prev, [songId]: 'saved' }));
      } catch (err) {
        console.error('Failed to save timestamps:', err);
        setSaveStatuses((prev) => ({ ...prev, [songId]: 'unsaved' }));
      }
    },
    600
  );

  const updateTimestamps = useCallback(
    (songId: number, newTimestamps: SongTimestamp[]) => {
      setTimestampDrafts((prev) => ({ ...prev, [songId]: newTimestamps }));
      setSaveStatuses((prev) => ({ ...prev, [songId]: 'unsaved' }));
      debouncedSave(songId, newTimestamps);
    },
    [debouncedSave]
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
              />
            );
          })}
        </div>
      </div>
    </main>
  );
};

const SongRow: FC<{
  song: Song;
  timestamps: SongTimestamp[];
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
}> = ({
  song,
  timestamps,
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

        <VolumeControlPlaceholder songVolume={song.volume} />
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

const VolumeControlPlaceholder: FC<{ songVolume?: number }> = ({
  songVolume,
}) => {
  return (
    <Card className="opacity-50">
      <CardBody className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <IconVolume className="size-4 text-default-400" />
          <span className="text-sm text-default-400">Volum (pròximament)</span>
        </div>
        <Slider
          aria-label="Volum de la cançó"
          size="sm"
          minValue={0}
          maxValue={1}
          step={0.01}
          value={songVolume ?? 1}
          isDisabled
          classNames={{
            base: 'opacity-50',
          }}
        />
      </CardBody>
    </Card>
  );
};
