import { useEffect, useRef } from 'react';
import { trpc } from '../utils/trpc';

export const useAutoScroll = (enabled: boolean) => {
  const songsQuery = trpc.game.getAllSongs.useQuery();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousPlayedCountRef = useRef<number>(0);
  const hasScrolledToQueueRef = useRef<boolean>(false);

  useEffect(() => {
    if (!songsQuery.data || hasScrolledToQueueRef.current) return;

    const playedCount = songsQuery.data.filter((song) => song.isPlayed).length;

    if (enabled && playedCount > 0 && scrollContainerRef.current) {
      const firstCard = scrollContainerRef.current.querySelector(
        '[data-song-card]'
      ) as HTMLElement;
      if (firstCard) {
        const cardHeight = firstCard.offsetHeight;
        const gap = 8;
        scrollContainerRef.current.scrollTo({
          top: (playedCount - 2) * (cardHeight + gap),
          behavior: 'instant',
        });
        hasScrolledToQueueRef.current = true;
      }
    }
  }, [songsQuery.data, enabled]);

  useEffect(() => {
    if (!songsQuery.data) return;

    const playedCount = songsQuery.data.filter((song) => song.isPlayed).length;

    if (
      enabled &&
      playedCount !== previousPlayedCountRef.current &&
      scrollContainerRef.current
    ) {
      const firstCard = scrollContainerRef.current.querySelector(
        '[data-song-card]'
      ) as HTMLElement;
      if (firstCard) {
        const cardHeight = firstCard.offsetHeight;
        const gap = 8;
        const scrollAmount =
          (playedCount > previousPlayedCountRef.current ? 1 : -1) *
          (cardHeight + gap);

        scrollContainerRef.current.scrollBy({
          top: scrollAmount,
          behavior: 'smooth',
        });
      }
    }

    previousPlayedCountRef.current = playedCount;
  }, [songsQuery.data, enabled]);

  return scrollContainerRef;
};
