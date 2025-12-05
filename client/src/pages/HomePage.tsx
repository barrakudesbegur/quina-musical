import autoAnimate from '@formkit/auto-animate';
import { cn } from '@heroui/react';
import { FC, useEffect, useMemo, useRef } from 'react';
import QRCode from 'react-qr-code';
import decorationLeft from '../assets/decoration-left.svg';
import decorationRight from '../assets/decoration-right.svg';
import { MorphingText } from '../components/MorphingText';
import { trpc } from '../utils/trpc';

export const HomePage: FC = () => {
  const parent = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (parent.current) autoAnimate(parent.current);
  }, [parent]);

  const gameState = trpc.game.onStateChange.useSubscription(undefined, {
    onError(err) {
      console.error('Subscription error:', err);
    },
  });

  const lastPlayedSong = useMemo(
    () => gameState.data?.playedSongs[0],
    [gameState.data]
  );

  const previousTitle = useRef(lastPlayedSong?.title ?? '');
  const previousArtist = useRef(lastPlayedSong?.artist ?? '');

  useEffect(() => {
    previousTitle.current = lastPlayedSong?.title ?? '';
    previousArtist.current = lastPlayedSong?.artist ?? '';
  }, [lastPlayedSong]);

  return (
    <main className="bg-[#8B1538] font-brand font-light tracking-wider text-white md:overflow-hidden min-h-dvh md:h-dvh w-full grid grid-rows-[auto_1fr_auto]">
      <div className="sticky top-0 inset-x-0 z-30 overflow-hidden">
        <img
          src={decorationLeft}
          alt="Decoration Left"
          className="absolute left-0 top-0 h-[calc(clamp(3rem,9dvw,15dvh)*1.7)] pointer-events-none hidden md:block"
        />
        <img
          src={decorationRight}
          alt="Decoration Right"
          className="absolute right-0 top-0 h-[calc(clamp(3rem,9dvw,15dvh)*1.7)] pointer-events-none hidden md:block"
        />

        <div className="bg-white py-4 text-stone-900 flex flex-col items-center justify-center text-center overflow-hidden">
          <MorphingText
            texts={[previousTitle.current, lastPlayedSong?.title ?? '']}
            classNames={{
              container: 'leading-none',
              text: cn(
                'md:text-ellipsis md:overflow-hidden md:whitespace-nowrap text-balance uppercase font-normal',
                !lastPlayedSong || lastPlayedSong.title.length < 20
                  ? 'text-[clamp(3rem,9dvw,15dvh)] tracking-wider'
                  : 'text-[clamp(3rem,7.2dvw,calc(15dvh*7.2/9))] tracking-wide'
              ),
            }}
          />
          <MorphingText
            texts={[previousArtist.current, lastPlayedSong?.artist ?? '']}
            classNames={{
              container: 'leading-tight',
              text: cn(
                'md:text-ellipsis md:overflow-hidden md:whitespace-nowrap text-balance text-stone-700',
                !lastPlayedSong || lastPlayedSong.title.length < 20
                  ? 'text-[clamp(2rem,5dvw,calc(15dvh*5/9))] tracking-wider'
                  : 'text-[clamp(2rem,4dvw,calc(15dvh*5/9*4/5))] tracking-wide'
              ),
            }}
          />
        </div>

        <div
          style={{
            height: '12px',
            width: '100%',
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='64' height='12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M64 0c-8.806 7.967-20.196 12-32 12C20.196 12 8.806 7.967 0 0h64Z' fill='%23fff'/%3E%3C/svg%3E\")",
            backgroundSize: '64px 12px',
            backgroundPosition: 'center top',
            backgroundRepeat: 'repeat-x',
          }}
        />
      </div>

      <div className="md:h-full box-border w-full md:min-h-0 pb-[calc(100dvh/3)] py-12 md:py-0 text-center">
        <h2 className="text-4xl block md:hidden uppercase font-normal underline underline-offset-4 decoration-white/30 tracking-wider leading-none mb-4">
          Historial
        </h2>
        <ol
          ref={parent}
          className="flex flex-col items-center content-start justify-items-start justify-start md:flex-wrap md:h-full w-full overflow-auto md:overflow-hidden p-2"
        >
          {gameState.data?.playedSongs.map((song) => (
            <li
              className="text-2xl md:text-3xl uppercase tracking-wide leading-none md:w-1/3 p-2 text-balance"
              key={`${song.id}-${song.position}`}
            >
              <span className="text-white/40 font-thin">{song.position}.</span>{' '}
              {song.title}
            </li>
          ))}
        </ol>
      </div>

      <div className="h-[calc(clamp(5rem,20dvw,30dvh)*0.2)] hidden md:grid grid-cols-[repeat(3,1fr)] items-center justify-center content-end overflow-visible">
        <div className="h-[calc(clamp(5rem,20dvw,30dvh)*0.2)] w-full flex items-center self-end justify-center col-span-2 z-10 min-w-0">
          <p className="text-[calc(clamp(10rem,20dvw,30dvh)*0.25)] -mt-4 uppercase tracking-widest text-[#FFD7A3] leading-none -mr-[calc(100dvw/3/6)]">
            quina.barrakudesbegur.org
          </p>
        </div>

        <div className="h-full w-full relative col-span-1 bg-[#8B1538] pt-2 flex justify-between">
          <div className="absolute bottom-[calc(100%-1px)] left-0 w-full h-[calc(clamp(5rem,20dvw,30dvh)*0.75)] bg-linear-to-b from-transparent to-[#8B1538]"></div>
          <div className="w-[clamp(5rem,20dvw,30dvh)] p-[calc(clamp(5rem,20dvw,30dvh)*0.06)] ml-[calc(100dvw/3/6)] bg-white rounded-t-[7%] aspect-square">
            <QRCode
              value="https://quina.barrakudesbegur.org"
              className="w-full h-full z-20"
            />
          </div>
          {gameState.data?.round?.name && (
            <p className="text-[calc(clamp(10rem,20dvw,30dvh)*0.125)] px-2 flex flex-1 flex-col items-center justify-center leading-none gap-[0.25em] uppercase tracking-widest">
              <span className="font-light">quina</span>
              <span
                className={cn(
                  gameState.data.round.name.length <= 1
                    ? 'text-[calc(clamp(10rem,20dvw,30dvh)*0.4)] font-thin'
                    : gameState.data.round.name.length <= 3
                      ? 'text-[calc(clamp(10rem,20dvw,30dvh)*0.35)] font-thin'
                      : 'tracking-normal',
                  gameState.data.round.name.length >= 6 &&
                    'text-[calc(clamp(10rem,20dvw,30dvh)*0.1)]'
                )}
              >
                {gameState.data.round.name}
              </span>
            </p>
          )}
        </div>
      </div>
    </main>
  );
};
