import { cn } from '@nextui-org/react'
import { FC, useMemo } from 'react'
import QRCode from 'react-qr-code'
import { trpc } from '../utils/trpc'

export const Main: FC = () => {
  const playedSongs = trpc.game.playedSongs.useQuery(undefined, {
    refetchInterval: 1_000,
  })

  const lastPlayedSong = useMemo(
    () => playedSongs.data?.[0],
    [playedSongs.data]
  )

  return (
    <main className="bg-[#8B1538] text-white min-h-dvh md:h-dvh w-full grid grid-rows-[auto_1fr_auto]">
      <div className="bg-white sticky top-0 inset-x-0 p-4 text-stone-900 flex flex-col items-center justify-center text-center overflow-hidden z-30">
        <h1
          className={cn(
            'md:text-ellipsis md:overflow-hidden md:whitespace-nowrap max-w-full leading-tight text-balance -my-[0.125em] uppercase font-normal',
            !lastPlayedSong || lastPlayedSong.title.length < 20
              ? 'text-[clamp(3rem,9dvw,15dvh)] tracking-wider'
              : 'text-[clamp(3rem,7.2dvw,calc(15dvh*7.2/9))] tracking-wide'
          )}
        >
          {lastPlayedSong?.title ?? <span className="text-transparent">-</span>}
        </h1>
        <h2
          className={cn(
            'md:text-ellipsis md:overflow-hidden md:whitespace-nowrap max-w-full leading-tight text-balance -my-[0.125em] text-stone-700',
            !lastPlayedSong || lastPlayedSong.title.length < 20
              ? 'text-[clamp(2rem,5dvw,calc(15dvh*5/9))] tracking-wider'
              : 'text-[clamp(2rem,4dvw,calc(15dvh*5/9*4/5))] tracking-wide'
          )}
        >
          {lastPlayedSong?.artist ?? (
            <span className="text-transparent">-</span>
          )}
        </h2>
      </div>

      <div className="md:h-full w-full md:min-h-0 pb-[calc(100dvh/3)] py-12 md:py-0 text-center">
        <h2 className="text-4xl block md:hidden uppercase font-normal underline underline-offset-4 decoration-white/30 tracking-wider leading-none mb-4">
          Historial
        </h2>
        <ol className="flex flex-col items-center content-start justify-items-start justify-start md:flex-wrap md:h-full w-full overflow-auto md:overflow-hidden p-2">
          {playedSongs.data?.map((song) => (
            <li
              className="text-2xl md:text-3xl uppercase tracking-wide leading-none md:w-1/3 p-2 text-balance"
              key={song.id}
            >
              <span className="text-white/40 font-thin">{song.position}.</span>{' '}
              {song.title}
            </li>
          ))}
        </ol>
      </div>

      <div className="h-[calc(clamp(5rem,20dvw,30dvh)*0.2)] hidden md:grid grid-cols-[repeat(3,1fr)] items-center justify-center content-end overflow-visible">
        <div className="h-[calc(clamp(5rem,20dvw,30dvh)*0.2)] w-full flex items-center self-end justify-center col-span-2 z-10">
          <p className="text-[calc(clamp(10rem,20dvw,30dvh)*0.25)] -mt-4 uppercase tracking-widest text-[#FFD7A3] leading-none -mr-[calc(100dvw/3/6)]">
            quina.barrakudesbegur.org
          </p>
        </div>

        <div className="h-full w-full relative col-span-1 bg-[#8B1538] pt-2">
          <div className="absolute bottom-[calc(100%-1px)] left-0 w-full h-[calc(clamp(5rem,20dvw,30dvh)*0.75)] bg-gradient-to-b from-transparent to-[#8B1538]"></div>
          <div className="w-[clamp(5rem,20dvw,30dvh)] p-[calc(clamp(5rem,20dvw,30dvh)*0.06)] ml-[calc(100dvw/3/6)] bg-white rounded-t-[7%] aspect-square">
            <QRCode
              value="https://quina.barrakudesbegur.org"
              className="w-full h-full z-20"
            />
          </div>
        </div>
      </div>
    </main>
  )
}
