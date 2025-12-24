import { Button, Card, CardBody, Chip, Divider } from '@heroui/react';
import { FC, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fxList } from '../config/fx';
import { trpc } from '../utils/trpc';

export const ConfigurationPage: FC = () => {
  const navigate = useNavigate();
  const songsQuery = trpc.game.getAllSongs.useQuery();

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('adminAuth');
    navigate('/login');
  }, [navigate]);

  const sortedSongs = useMemo(() => {
    return (songsQuery.data ?? []).slice().sort((a, b) => a.id - b.id);
  }, [songsQuery.data]);

  return (
    <main className="container mx-auto min-h-dvh p-4 flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-brand uppercase tracking-widest">
            Content management
          </h1>
          <div className="text-sm text-default-600">
            Read-only for now — later you’ll edit timestamps, custom volume,
            etc.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button as={Link} to="/admin" variant="flat" color="default">
            Admin home
          </Button>
          <Button onPress={handleLogout} variant="faded" color="primary">
            Logout
          </Button>
        </div>
      </header>

      <Divider />

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-brand uppercase tracking-widest">
                Songs
              </h2>
              <Chip variant="flat">{sortedSongs.length}</Chip>
            </div>
            {sortedSongs.length === 0 ? (
              <div className="text-sm text-default-600">
                No songs available (round not started yet?).
              </div>
            ) : (
              <ul className="space-y-2">
                {sortedSongs.map((song) => (
                  <li key={song.id} className="text-sm">
                    <span className="text-default-400">{song.id}.</span>{' '}
                    <span className="font-medium">{song.title}</span>{' '}
                    <span className="text-default-500">— {song.artist}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-brand uppercase tracking-widest">
                FX
              </h2>
              <Chip variant="flat">{fxList.length}</Chip>
            </div>
            <ul className="space-y-2">
              {fxList.map((fx) => (
                <li key={fx.id} className="text-sm">
                  <span className="font-medium">{fx.label}</span>{' '}
                  <span className="text-default-500">({fx.id})</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </section>
    </main>
  );
};
