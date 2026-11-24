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
  IconFlaskFilled,
  IconLoader2,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlus,
  IconQuestionMark,
  IconSquareRotated,
  IconTrash,
  IconTriangleFilled,
  IconVolume,
  TablerIcon,
} from '@tabler/icons-react';
import { clamp } from 'lodash-es';
import {
  CSSProperties,
  FC,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useDebounceCallback, useInterval } from 'usehooks-ts';
import type { PlayEffect, SongTimestamp } from '../hooks/useSongPlayer';
import { useSongPlayer } from '../hooks/useSongPlayer';
import { trpc } from '../utils/trpc';

type Song = {
  id: number;
  title: string;
  artist: string;
  cover: string;
  spotifyId: string;
  timestamps: SongTimestamp[];
  volume?: number;
  duration?: number;
};

type SaveStatus = 'saved' | 'saving' | 'unsaved';

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

export const SongsTab: FC = () => {
  const songsQuery = trpc.song.getAll.useQuery();
  const updateSongMutation = trpc.game.updateSong.useMutation();

  const { setSong, togglePlay, isPlaying, seek, getCurrentTime, getSongUrl } =
    useSongPlayer();

  const setSongRef = useRef(setSong);
  useEffect(() => {
    setSongRef.current = setSong;
  }, [setSong]);

  const [activeSongId, setActiveSongId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [durations, setDurations] = useState<Record<number, number>>({});
  const [selectedTimestampIndex, setSelectedTimestampIndex] = useState<
    number | null
  >(null);
  const [timestampDrafts, setTimestampDrafts] = useState<
    Record<number, SongTimestamp[]>
  >({});
  const [volumeDrafts, setVolumeDrafts] = useState<Record<number, number>>({});
  const [saveStatuses, setSaveStatuses] = useState<Record<number, SaveStatus>>(
    {}
  );

  const sortedSongs = (songsQuery.data ?? [])
    .slice()
    .sort((a, b) => a.id - b.id);

  // Track current time from the player
  useInterval(() => {
    if (isPlaying) {
      setCurrentTime(getCurrentTime());
    }
  }, 100);

  // Get duration for a song - prefer cached from DB, then local state
  const getDuration = useCallback(
    (songId: number): number | null => {
      if (durations[songId]) return durations[songId];
      const song = songsQuery.data?.find((s) => s.id === songId);
      return song?.duration ?? null;
    },
    [durations, songsQuery.data]
  );

  // Load durations for songs that don't have them cached - ONE AT A TIME
  useEffect(() => {
    if (!songsQuery.data) return;

    const songsNeedingDuration = songsQuery.data.filter(
      (song) => !song.duration && !durations[song.id]
    );

    if (songsNeedingDuration.length === 0) return;

    const song = songsNeedingDuration[0];
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = getSongUrl(song.id);

    audio.addEventListener('loadedmetadata', () => {
      const dur = audio.duration;
      if (dur && Number.isFinite(dur)) {
        setDurations((prev) => ({ ...prev, [song.id]: dur }));
        updateSongMutation.mutate({ songId: song.id, duration: dur });
      }
    });

    audio.addEventListener('error', () => {
      console.warn(`Failed to load duration for song ${song.id}`);
      setDurations((prev) => ({ ...prev, [song.id]: 0 }));
    });
  }, [songsQuery.data, durations, updateSongMutation, getSongUrl]);

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

  const playSong = useCallback(
    async (songId: number, seekTo?: number, resetSelection = true) => {
      if (activeSongId !== songId && resetSelection) {
        setSelectedTimestampIndex(null);
      }
      setActiveSongId(songId);
      await setSong(songId, seekTo ?? 0, true);
      if (seekTo !== undefined) {
        setCurrentTime(seekTo);
      }
    },
    [activeSongId, setSong]
  );

  const togglePlaySong = useCallback(
    (songId: number) => {
      if (activeSongId === songId) {
        togglePlay();
      } else {
        playSong(songId);
      }
    },
    [activeSongId, playSong, togglePlay]
  );

  const seekTo = useCallback(
    (time: number) => {
      seek(time);
      setCurrentTime(time);
    },
    [seek]
  );

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

  const previewTransition = useCallback(
    async (targetSongId: number, timestamp: SongTimestamp) => {
      const otherSongs = sortedSongs.filter((s) => s.id !== targetSongId);
      if (otherSongs.length === 0) return;

      const randomSong =
        otherSongs[Math.floor(Math.random() * otherSongs.length)];

      const randomDuration = getDuration(randomSong.id) ?? 180;
      const maxStart = Math.max(0, randomDuration - 20);
      const randomStartTime = Math.random() * maxStart;

      setActiveSongId(randomSong.id);
      await setSong(randomSong.id, randomStartTime, true);

      const waitTime = 2000 + Math.random() * 2000;
      await new Promise((r) => setTimeout(r, waitTime));

      setActiveSongId(targetSongId);
      await setSongRef.current(targetSongId, timestamp, true);
    },
    [getDuration, setSong, sortedSongs]
  );

  const handleSeek = useCallback(
    (songId: number, time: number, keepSelection?: boolean) => {
      if (activeSongId !== songId) {
        playSong(songId, time, !keepSelection);
      } else {
        seekTo(time);
      }
    },
    [activeSongId, playSong, seekTo]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === ' ') {
        e.preventDefault();
        if (activeSongId) {
          if (selectedTimestampIndex !== null && !isPlaying) {
            const ts = getTimestamps(activeSongId)[selectedTimestampIndex];
            if (ts) seekTo(ts.time);
          }
          togglePlay();
        }
        return;
      }

      if (!activeSongId || selectedTimestampIndex === null) return;

      const step = e.shiftKey ? 0.5 : 0.05;
      const ts = getTimestamps(activeSongId)[selectedTimestampIndex];
      if (!ts) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const newTime = Math.max(0, ts.time - step);
        updateTimestamp(activeSongId, selectedTimestampIndex, {
          time: newTime,
        });
        seekTo(newTime);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const newTime = ts.time + step;
        updateTimestamp(activeSongId, selectedTimestampIndex, {
          time: newTime,
        });
        seekTo(newTime);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeSongId,
    selectedTimestampIndex,
    getTimestamps,
    updateTimestamp,
    isPlaying,
    togglePlay,
    seekTo,
  ]);

  return (
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
            duration={getDuration(song.id)}
            selectedTimestampIndex={isActive ? selectedTimestampIndex : null}
            saveStatus={saveStatus}
            onTogglePlay={() => togglePlaySong(song.id)}
            onSeek={(time, keepSelection) =>
              handleSeek(song.id, time, keepSelection)
            }
            onSelectTimestamp={setSelectedTimestampIndex}
            onAddTimestamp={(tag) => addTimestamp(song.id, tag)}
            onUpdateTimestamp={(index, updates) =>
              updateTimestamp(song.id, index, updates)
            }
            onDeleteTimestamp={(index) => deleteTimestamp(song.id, index)}
            onVolumeChange={(vol) => updateVolume(song.id, vol)}
            onPreviewTransition={(ts) => previewTransition(song.id, ts)}
          />
        );
      })}
    </div>
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
  onSeek: (time: number, keepSelection?: boolean) => void;
  onSelectTimestamp: (index: number) => void;
  onAddTimestamp: (tag: SongTimestamp['tag']) => void;
  onUpdateTimestamp: (index: number, updates: Partial<SongTimestamp>) => void;
  onDeleteTimestamp: (index: number) => void;
  onVolumeChange: (volume: number) => void;
  onPreviewTransition: (timestamp: SongTimestamp) => void;
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
  onPreviewTransition,
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

      <div className="flex flex-col min-w-0">
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

            <Button
              isIconOnly
              size="sm"
              variant="flat"
              isDisabled={!selectedTimestamp}
              onPress={() =>
                selectedTimestamp && onPreviewTransition(selectedTimestamp)
              }
              aria-label="Previsualitzar transició"
            >
              <IconFlaskFilled className="size-4" />
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

        <div className="-mb-3">
          <div className="relative mx-2.5 h-4 overflow-visible">
            {!!duration &&
              timestamps.map(({ time, tag }, index) => {
                const option = TIMESTAMP_OPTIONS.find(
                  (opt) => opt.value === tag
                );
                const Icon = option?.icon ?? IconQuestionMark;
                const isSelected = selectedTimestampIndex === index;

                return (
                  <div
                    key={`${tag}-${time}-${index}`}
                    className={cn(
                      'absolute -translate-x-1/2 flex flex-col items-center gap-0.5 left-(--progress) z-10',
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
                      tabIndex={-1}
                      className={cn(
                        'size-6 p-1 -m-1 min-w-auto text-current transition-transform',
                        isSelected && 'scale-125',
                        tag === 'secondary' && 'p-0.5'
                      )}
                      onPress={() => {
                        onSelectTimestamp(index);
                        onSeek(time, true);
                        (document.activeElement as HTMLElement)?.blur();
                      }}
                    >
                      <Icon className="size-4" stroke={3} />
                    </Button>
                    <div className="flex flex-col items-center pointer-events-none">
                      <div
                        className={cn(
                          'w-[2px] rounded-full h-4 bg-current',
                          isSelected && 'h-5'
                        )}
                      />
                      {isSelected && (
                        <IconTriangleFilled className="size-3 text-current -mt-px" />
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
          <Slider
            aria-label="Progress de reproducció"
            color="foreground"
            minValue={0}
            maxValue={duration ?? 100}
            step={0.05}
            value={currentTime}
            onChange={(value) => {
              if (typeof value === 'number') onSeek(value);
            }}
            isDisabled={!duration}
          />
          <div className="flex justify-between text-small text-foreground/60">
            <span>{formatTime(currentTime)}</span>
            <span className="text-foreground/50">{formatTime(duration)}</span>
          </div>
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
              fadeInOffset: 0.8,
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
            label="Fade in offset (s)"
            size="sm"
            step={0.1}
            value={timestamp.playEffect.fadeInOffset.toFixed(1)}
            onValueChange={(val) => {
              const num = parseFloat(val);
              if (
                !Number.isNaN(num) &&
                timestamp.playEffect.type === 'fade-out-in'
              ) {
                onUpdate({
                  playEffect: { ...timestamp.playEffect, fadeInOffset: num },
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
