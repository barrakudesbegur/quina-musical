import autoAnimate from '@formkit/auto-animate';
import { Alert, Chip, cn, Input } from '@heroui/react';
import {
  IconCircleFilled,
  IconClubsFilled,
  IconGiftFilled,
  IconLaurelWreathFilled,
  IconMoonFilled,
  IconSquareFilled,
  IconStarFilled,
  IconTriangleFilled,
} from '@tabler/icons-react';
import { maxBy, uniq } from 'lodash-es';
import { FC, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { useSearchParams } from 'react-router-dom';
import decorationLeft from '../assets/decoration-left.svg';
import decorationRight from '../assets/decoration-right.svg';
import { MorphingText } from '../components/MorphingText';
import { GALLERY_IMAGES } from '../config/images';
import { trpc } from '../utils/trpc';

const CARD_ID_QUERY_PARAM = 'c';

const CARD_ICON_CONFIGS = [
  { icon: IconStarFilled, color: '#FFD93D' },
  { icon: IconLaurelWreathFilled, color: '#6BCB77' },
  { icon: IconMoonFilled, color: '#00d3f2' },
  { icon: IconTriangleFilled, color: '#C77DFF' },
  { icon: IconGiftFilled, color: '#FF922B' },
  { icon: IconClubsFilled, color: '#2a2524' },
  { icon: IconCircleFilled, color: '#ffffff' },
  { icon: IconSquareFilled, color: '#4D96FF' },
];

function cardHasSongExcludingLast(
  card: { lines: number[][] },
  song: { id: number } | undefined | null,
  playedSongs: { id: number; position: number }[] | undefined | null
) {
  if (!song) return false;
  const songIds = card.lines.flat();

  if (playedSongs?.length) {
    const songsInCard = songIds.filter((songId) =>
      playedSongs.some((s) => s.id === songId)
    );
    const isWinner = songsInCard.length >= songIds.length;

    if (isWinner) {
      const playedSongOfCard = songIds
        .map((songId) => playedSongs.find((s) => s.id === songId))
        .filter((s) => s !== undefined);
      const lastPlayedSongOfCard = maxBy(playedSongOfCard, 'position');
      if (lastPlayedSongOfCard?.id === song.id) {
        return false;
      }
    }
  }

  return songIds.some((songId) => songId === song.id);
}

export const HomePage: FC = () => {
  const parent = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (parent.current) autoAnimate(parent.current);
  }, [parent]);

  const allCardsQuery = trpc.card.getAll.useQuery(undefined, { enabled: true });
  const [searchParams, setSearchParams] = useSearchParams();
  const [cardInputValue, setCardInputValue] = useState(() => {
    return searchParams.getAll(CARD_ID_QUERY_PARAM).join(',');
  });

  const watchingCardIds = useMemo(() => {
    return uniq(
      cardInputValue
        .split(/\D+/)
        .filter(Boolean)
        .map((v) => Number.parseInt(v, 10))
        .filter((n) => Number.isFinite(n) && n >= 0)
    );
  }, [cardInputValue]);

  const watchingCards = useMemo(() => {
    return watchingCardIds
      .map((id, index) => {
        const card = allCardsQuery.data?.find((c) => c.id === id);
        if (!card) return undefined;

        return {
          ...card,
          ...CARD_ICON_CONFIGS[index % CARD_ICON_CONFIGS.length],
          watchPosition: index,
        };
      })
      .filter((c) => c !== undefined);
  }, [watchingCardIds, allCardsQuery.data]);

  useEffect(() => {
    setSearchParams({
      [CARD_ID_QUERY_PARAM]: watchingCardIds.map((c) => c.toString()),
    });
  }, [watchingCardIds, setSearchParams]);

  type Song = NonNullable<(typeof gameState)['data']>['playedSongs'][number];

  const [lastSongs, setLastSongs] = useState<{
    current: Song | null;
    prev: Song | null;
  }>({
    current: null,
    prev: null,
  });
  const prevSong = lastSongs.prev;

  const gameState = trpc.game.onStateChange.useSubscription(undefined, {
    onData(data) {
      setLastSongs((prevValues) => ({
        current: data.playedSongs[0] ?? null,
        prev: prevValues.current,
      }));

      if (
        watchingCards.some((card) =>
          cardHasSongExcludingLast(card, data.playedSongs[0], data.playedSongs)
        )
      ) {
        navigator.vibrate?.(500);
      }
    },
    onError(err) {
      console.error('Subscription error:', err);
    },
  });
  const currentSong = gameState.data?.playedSongs[0] ?? null;

  const displayedImage = useMemo(() => {
    return (
      GALLERY_IMAGES.find(
        (img) => img.id === gameState.data?.displayedImageId
      ) ?? null
    );
  }, [gameState.data?.displayedImageId]);

  const cardsWithCurrentSong = useMemo(() => {
    return watchingCards.filter((card) =>
      cardHasSongExcludingLast(card, currentSong, gameState.data?.playedSongs)
    );
  }, [watchingCards, currentSong, gameState.data?.playedSongs]);

  return (
    <main className="bg-[#8B1538] max-md:pb-[calc(100dvh/3)] font-brand font-light tracking-wider text-white md:overflow-hidden min-h-dvh md:h-dvh w-full grid grid-rows-[auto_1fr_auto]">
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

        <div
          className={cn(
            'bg-white py-4 text-stone-900 flex flex-col items-center justify-center text-center overflow-hidden',
            cardsWithCurrentSong.length > 0 && 'bg-[#fef200]'
          )}
        >
          <MorphingText
            texts={[prevSong?.title ?? '', currentSong?.title ?? '']}
            classNames={{
              container: 'leading-none',
              text: cn(
                'md:text-ellipsis md:overflow-hidden md:whitespace-nowrap text-balance uppercase font-normal',
                !currentSong || currentSong.title.length < 20
                  ? 'text-[clamp(3rem,9dvw,15dvh)] tracking-wider'
                  : 'text-[clamp(3rem,7.2dvw,calc(15dvh*7.2/9))] tracking-wide'
              ),
            }}
          />
          <MorphingText
            texts={[prevSong?.artist ?? '', currentSong?.artist ?? '']}
            classNames={{
              container: 'leading-tight',
              text: cn(
                'md:text-ellipsis md:overflow-hidden md:whitespace-nowrap text-balance text-stone-700',
                !currentSong || currentSong.title.length < 20
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
              cardsWithCurrentSong.length > 0
                ? "url(\"data:image/svg+xml,%3Csvg width='64' height='12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M64 0c-8.806 7.967-20.196 12-32 12C20.196 12 8.806 7.967 0 0h64Z' fill='%23fef200'/%3E%3C/svg%3E\")"
                : "url(\"data:image/svg+xml,%3Csvg width='64' height='12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M64 0c-8.806 7.967-20.196 12-32 12C20.196 12 8.806 7.967 0 0h64Z' fill='%23fff'/%3E%3C/svg%3E\")",
            backgroundSize: '64px 12px',
            backgroundPosition: 'center top',
            backgroundRepeat: 'repeat-x',
          }}
        />
        <div
          style={{
            height: '12px',
            width: '100%',
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='64' height='12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M64 0c-8.806 7.967-20.196 12-32 12C20.196 12 8.806 7.967 0 0h64Z' fill='%23000'/%3E%3C/svg%3E\")",
            backgroundSize: '64px 12px',
            backgroundPosition: 'center top',
            backgroundRepeat: 'repeat-x',

            marginTop: '-10px',
            zIndex: -1,
            position: 'relative',
            boxShadow: '0px -12px 0 black',
            opacity: 0.3,
          }}
        />
      </div>

      <div className="md:h-full box-border w-full md:min-h-0 py-12 md:py-0 text-center">
        <h2 className="text-4xl block md:hidden uppercase font-normal underline underline-offset-4 decoration-white/30 tracking-wider leading-none mb-4">
          Historial
        </h2>
        {gameState.data?.playedSongs.length ? (
          <ol
            ref={parent}
            className="flex min-h-48 flex-col items-center content-start justify-items-start justify-start md:flex-wrap md:h-full w-full overflow-auto md:overflow-hidden p-2"
          >
            {gameState.data.playedSongs.map((song) => {
              const cardsWithSong = watchingCards.filter((card) =>
                cardHasSongExcludingLast(
                  card,
                  song,
                  gameState.data?.playedSongs
                )
              );

              return (
                <li
                  className="text-2xl md:text-3xl uppercase space-x-1 tracking-wide leading-none md:w-1/3 p-2 text-balance "
                  key={`${song.id}-${song.position}`}
                >
                  {cardsWithSong
                    .filter((card) => card.watchPosition % 2 === 1)
                    .map((card) => (
                      <card.icon
                        key={card.id}
                        size={20}
                        style={{ color: card.color }}
                        className="shrink-0 inline-block align-[-0.05em]"
                      />
                    ))}
                  <span
                    className={cn(
                      cardsWithSong.length > 0 && 'text-yellow-200'
                    )}
                  >
                    {song.title}
                  </span>
                  {cardsWithSong
                    .filter((card) => card.watchPosition % 2 === 0)
                    .map((card) => (
                      <card.icon
                        key={card.id}
                        size={20}
                        style={{ color: card.color }}
                        className="shrink-0 inline-block align-[-0.05em]"
                      />
                    ))}
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="min-h-48"></div>
        )}

        <div className="md:hidden px-4 mt-6">
          <Input
            label="Nº de cartrons (separats per comes)"
            placeholder="Ex: 101, 205, 300"
            value={cardInputValue}
            onValueChange={setCardInputValue}
            size="sm"
          />
          {watchingCardIds.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {watchingCards.map((card) => {
                  return (
                    <Chip
                      key={card.id}
                      variant="bordered"
                      startContent={
                        <card.icon size={14} style={{ color: card.color }} />
                      }
                      className="text-white"
                    >
                      Cartró {card.id}
                    </Chip>
                  );
                })}
              </div>
              <Alert
                color="warning"
                variant="flat"
                title="L'última cançó no es marcarà"
                description="Si vols guanyar la quina, has de estar atent/a."
                className="mt-2"
              />
            </>
          )}
        </div>
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

      <ul className="md:hidden *:border-b-2 *:border-b-gray-200 *:last:border-b-0">
        {GALLERY_IMAGES.filter((image) => image.discoverable).map((image) => (
          <li key={image.id}>
            <img
              src={image.filename}
              alt={image.label}
              className={cn({
                'border-8 border-blue-500': displayedImage?.id === image.id,
              })}
            />
          </li>
        ))}
      </ul>

      {displayedImage && (
        <img
          src={displayedImage.filename}
          alt={displayedImage.label}
          className="max-md:hidden fixed inset-0 z-50 size-full object-contain bg-black transition-opacity duration-300"
        />
      )}
    </main>
  );
};
