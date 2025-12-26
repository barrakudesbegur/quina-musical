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
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectItem,
  Slider,
  Tab,
  Tabs,
  useDisclosure,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import {
  IconCarambolaFilled,
  IconCheck,
  IconDatabase,
  IconDownload,
  IconFlaskFilled,
  IconFlameFilled,
  IconLoader2,
  IconMusic,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerSkipForward,
  IconPlus,
  IconQuestionMark,
  IconSparkles,
  IconSquareRotated,
  IconTrash,
  IconTriangleFilled,
  IconUpload,
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
  const importDbMutation = trpc.game.importDb.useMutation();
  const clearDbMutation = trpc.game.clearDb.useMutation();
  const trpcUtils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clearDbModal = useDisclosure();

  // Use the shared player hook - same as PresenterPage
  const { setSong, togglePlay, isPlaying, seek, getCurrentTime } =
    useSongPlayer();

  // Keep a ref to the latest setSong to avoid stale closures in async functions
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
  const [fxOptionsDrafts, setFxOptionsDrafts] = useState<
    Record<string, FxOptions>
  >({});
  const [saveStatuses, setSaveStatuses] = useState<Record<number, SaveStatus>>(
    {}
  );
  const [fxSaveStatus, setFxSaveStatus] = useState<SaveStatus>('saved');

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('adminAuth');
    navigate('/login');
  }, [navigate]);

  const handleExport = useCallback(async () => {
    const data = await trpcUtils.game.exportDb.fetch();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quina-db-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [trpcUtils.game.exportDb]);

  const handleImport = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (
          !window.confirm(
            'Això sobreescriurà TOTES les dades. Estàs segur que vols continuar?'
          )
        ) {
          return;
        }

        await importDbMutation.mutateAsync({ data });
        await trpcUtils.invalidate();
        window.alert('Importació completada!');
      } catch (err) {
        console.error('Import failed:', err);
        window.alert(
          `Error d'importació: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }
    },
    [importDbMutation, trpcUtils]
  );

  const handleClearDb = useCallback(async () => {
    try {
      await clearDbMutation.mutateAsync();
      await trpcUtils.invalidate();
      clearDbModal.onClose();
      window.alert('Base de dades esborrada!');
    } catch (err) {
      console.error('Clear failed:', err);
      window.alert(
        `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }, [clearDbMutation, clearDbModal, trpcUtils]);

  const sortedSongs = useMemo(() => {
    return (songsQuery.data ?? []).slice().sort((a, b) => a.id - b.id);
  }, [songsQuery.data]);

  // Track current time from the player
  useInterval(() => {
    if (isPlaying) {
      setCurrentTime(getCurrentTime());
    }
  }, 100);

  // Get duration for a song - prefer cached from DB, then local state
  const getDuration = useCallback(
    (songId: number): number | null => {
      // First check local state (might have just been loaded)
      if (durations[songId]) return durations[songId];
      // Then check API data (cached in DB)
      const song = songsQuery.data?.find((s) => s.id === songId);
      return song?.duration ?? null;
    },
    [durations, songsQuery.data]
  );

  // Load durations for songs that don't have them cached - ONE AT A TIME to avoid freezing
  useEffect(() => {
    if (!songsQuery.data) return;

    // Find songs without cached duration
    const songsNeedingDuration = songsQuery.data.filter(
      (song) => !song.duration && !durations[song.id]
    );

    if (songsNeedingDuration.length === 0) return;

    // Load ONE song at a time to avoid freezing
    const song = songsNeedingDuration[0];
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = `/audios/song/${song.id}.mp3`;

    audio.addEventListener('loadedmetadata', () => {
      const dur = audio.duration;
      if (dur && Number.isFinite(dur)) {
        setDurations((prev) => ({ ...prev, [song.id]: dur }));
        // Save to server so it's cached for next time
        updateSongMutation.mutate({ songId: song.id, duration: dur });
      }
    });

    audio.addEventListener('error', () => {
      console.warn(`Failed to load duration for song ${song.id}`);
      // Mark as loaded with 0 to avoid retrying
      setDurations((prev) => ({ ...prev, [song.id]: 0 }));
    });
  }, [songsQuery.data, durations, updateSongMutation]);

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

  // Playback using useSongPlayer
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

  // Preview transition using the player's built-in transition effects
  const previewTransition = useCallback(
    async (targetSongId: number, timestamp: SongTimestamp) => {
      const otherSongs = sortedSongs.filter((s) => s.id !== targetSongId);
      if (otherSongs.length === 0) return;

      // Pick a random other song
      const randomSong =
        otherSongs[Math.floor(Math.random() * otherSongs.length)];

      // Random start position (before last 20 seconds)
      const randomDuration = getDuration(randomSong.id) ?? 180;
      const maxStart = Math.max(0, randomDuration - 20);
      const randomStartTime = Math.random() * maxStart;

      // Play the random song first
      setActiveSongId(randomSong.id);
      await setSong(randomSong.id, randomStartTime, true);

      // Wait 2-4 seconds
      const waitTime = 2000 + Math.random() * 2000;
      await new Promise((r) => setTimeout(r, waitTime));

      // Now transition to the target song using the timestamp's playEffect
      // Use setSongRef.current to get the LATEST setSong with updated songId closure
      // This is required because setSong's closure captures songId state
      setActiveSongId(targetSongId);
      await setSongRef.current(targetSongId, timestamp, true);
    },
    [getDuration, setSong, sortedSongs]
  );

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
    <main className="h-dvh flex flex-col bg-background">
      <header className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-divider">
        <h1 className="text-2xl font-brand uppercase tracking-widest">
          Configuració
        </h1>
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

      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs
          aria-label="Configuration sections"
          classNames={{
            base: 'px-6 pt-4',
            tabList: 'gap-4',
            panel: 'flex-1 overflow-y-auto p-0',
          }}
        >
          <Tab
            key="songs"
            title={
              <div className="flex items-center gap-2">
                <IconMusic className="size-4" />
                <span>Cançons</span>
                <Chip size="sm" variant="flat">
                  {sortedSongs.length}
                </Chip>
              </div>
            }
          >
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
                    selectedTimestampIndex={
                      isActive ? selectedTimestampIndex : null
                    }
                    saveStatus={saveStatus}
                    onTogglePlay={() => togglePlaySong(song.id)}
                    onSeek={(time, keepSelection = false) => {
                      if (!isActive) {
                        playSong(song.id, time, !keepSelection);
                      } else {
                        seekTo(time);
                      }
                    }}
                    onSelectTimestamp={(index) => {
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
                    onDeleteTimestamp={(index) =>
                      deleteTimestamp(song.id, index)
                    }
                    onVolumeChange={(vol) => updateVolume(song.id, vol)}
                    onPreviewTransition={(ts) => previewTransition(song.id, ts)}
                  />
                );
              })}
            </div>
          </Tab>

          <Tab
            key="fx"
            title={
              <div className="flex items-center gap-2">
                <IconSparkles className="size-4" />
                <span>Efectes</span>
                <Chip size="sm" variant="flat">
                  {fxList.length}
                </Chip>
              </div>
            }
          >
            <div className="p-6">
              <FxSettingsSection
                fxOptions={fxList.reduce(
                  (acc, fx) => ({ ...acc, [fx.id]: getFxOptions(fx.id) }),
                  {} as Record<string, FxOptions>
                )}
                saveStatus={fxSaveStatus}
                onOptionChange={updateFxOption}
              />
            </div>
          </Tab>

          <Tab
            key="database"
            title={
              <div className="flex items-center gap-2">
                <IconDatabase className="size-4" />
                <span>Base de dades</span>
              </div>
            }
          >
            <div className="p-6">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImport(file);
                    e.target.value = '';
                  }
                }}
              />

              <Card className="max-w-xl">
                <CardBody className="gap-4">
                  <h2 className="text-lg font-semibold">
                    Gestió de la base de dades
                  </h2>
                  <p className="text-default-500 text-sm">
                    Exporta, importa o esborra totes les dades del joc.
                  </p>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      onPress={handleExport}
                      variant="flat"
                      color="primary"
                      startContent={<IconDownload className="size-4" />}
                    >
                      Exportar DB
                    </Button>
                    <Button
                      onPress={() => fileInputRef.current?.click()}
                      variant="flat"
                      color="secondary"
                      isLoading={importDbMutation.isPending}
                      startContent={
                        !importDbMutation.isPending && (
                          <IconUpload className="size-4" />
                        )
                      }
                    >
                      Importar DB
                    </Button>
                    <Button
                      onPress={clearDbModal.onOpen}
                      variant="flat"
                      color="danger"
                      startContent={<IconTrash className="size-4" />}
                    >
                      Esborrar DB
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </div>
          </Tab>
        </Tabs>
      </div>

      <Modal
        isOpen={clearDbModal.isOpen}
        onOpenChange={clearDbModal.onOpenChange}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Confirmar esborrament</ModalHeader>
              <ModalBody>
                <p>
                  Estàs segur que vols esborrar <strong>TOTES</strong> les
                  dades? Això inclou:
                </p>
                <ul className="list-disc list-inside text-default-500 mt-2">
                  <li>Timestamps de cançons</li>
                  <li>Volums personalitzats</li>
                  <li>Configuració d&apos;efectes</li>
                  <li>Rondes i estat del joc</li>
                </ul>
                <p className="text-danger mt-2 font-medium">
                  Aquesta acció no es pot desfer!
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel·lar
                </Button>
                <Button
                  color="danger"
                  onPress={handleClearDb}
                  isLoading={clearDbMutation.isPending}
                >
                  Esborrar tot
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
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

      <div className="flex flex-col  min-w-0">
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
                        onSeek(time, true); // keepSelection = true
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
            min={0}
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

const FxSettingsSection: FC<{
  fxOptions: Record<string, FxOptions>;
  saveStatus: SaveStatus;
  onOptionChange: (fxId: string, key: keyof FxOptions, value: number) => void;
}> = ({ fxOptions, saveStatus, onOptionChange }) => {
  return (
    <section>
      <div className="flex items-center gap-4 mb-4">
        <SaveStatusIndicator status={saveStatus} />
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
