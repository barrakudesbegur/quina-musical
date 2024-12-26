import { FC, useMemo } from 'react'
import { trpc } from '../utils/trpc'
import { cn } from '@nextui-org/react'

export const Main: FC = () => {
  const playedSongs = trpc.game.playedSongs.useQuery(undefined, {
    refetchInterval: 1_000,
  })

  const lastPlayedSong = useMemo(
    () => playedSongs.data?.[0],
    [playedSongs.data]
  )

  return (
    <main className="bg-[#8B1538] text-white h-dvh w-full grid grid-rows-[auto_1fr]">
      <div className="bg-white p-4 text-stone-900 flex flex-col items-center justify-center text-center overflow-hidden">
        <h1
          className={cn(
            'md:text-ellipsis md:overflow-hidden md:whitespace-nowrap max-w-full leading-tight -my-[0.125em] uppercase font-normal',
            !lastPlayedSong || lastPlayedSong.title.length < 20
              ? 'text-[max(3rem,9dvw)] tracking-wider'
              : 'text-[max(3rem,7.2dvw)] tracking-wide'
          )}
        >
          {lastPlayedSong?.title ?? <span className="text-transparent">-</span>}
        </h1>
        <h2
          className={cn(
            'md:text-ellipsis md:overflow-hidden md:whitespace-nowrap max-w-full leading-tight -my-[0.125em] text-stone-700',
            !lastPlayedSong || lastPlayedSong.title.length < 20
              ? 'text-[max(2rem,5dvw)] tracking-wider'
              : 'text-[max(2rem,4dvw)] tracking-wide'
          )}
        >
          {lastPlayedSong?.artist ?? (
            <span className="text-transparent">-</span>
          )}
        </h2>
      </div>

      <ol className="flex flex-col items-center content-start justify-items-start justify-start md:flex-wrap h-full w-full overflow-auto md:overflow-hidden p-2 text-center">
        {playedSongs.data?.map((song) => (
          <li
            className="text-3xl uppercase tracking-wide leading-none md:w-1/3 p-2"
            key={song.id}
          >
            <span className="text-white/40 font-thin">{song.position}.</span>{' '}
            {song.title}
          </li>
        ))}
      </ol>
    </main>
  )
}
