import { Card, CardBody, Chip, cn } from '@nextui-org/react'
import { IconArrowBackUp, IconCircleCheckFilled } from '@tabler/icons-react'
import { FC, useMemo } from 'react'
import { trpc } from '../utils/trpc'

export const AdminPage: FC = () => {
  const utils = trpc.useUtils()
  const songsQuery = trpc.game.getAllSongs.useQuery()

  const maxPosition = useMemo(() => {
    if (!songsQuery.data) return 0
    return Math.max(0, ...songsQuery.data.map((s) => s.playedPosition || 0))
  }, [songsQuery.data])

  const songsWithLastPlayed = useMemo(() => {
    return (
      songsQuery.data?.map((song) => ({
        ...song,
        isLastPlayed: song.playedPosition === maxPosition,
      })) ?? []
    )
  }, [songsQuery.data, maxPosition])

  const playSongMutation = trpc.game.playSong.useMutation({
    onMutate: async ({ songId }) => {
      await utils.game.getAllSongs.cancel()

      const previousSongs = utils.game.getAllSongs.getData()

      // Calculate next position
      const currentSongs = previousSongs || []
      const nextPosition =
        Math.max(0, ...currentSongs.map((s) => s.playedPosition || 0)) + 1

      utils.game.getAllSongs.setData(undefined, (old) => {
        if (!old) return previousSongs
        return old.map((song) => ({
          ...song,
          isPlayed: song.isPlayed || song.id === songId,
          playedPosition:
            song.id === songId ? nextPosition : song.playedPosition,
        }))
      })

      return { previousSongs }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousSongs) {
        utils.game.getAllSongs.setData(undefined, context.previousSongs)
      }
    },
    onSettled: () => {
      utils.game.getAllSongs.invalidate()
    },
  })

  const undoLastPlayedMutation = trpc.game.undoLastPlayed.useMutation({
    onMutate: async () => {
      await utils.game.getAllSongs.cancel()

      const previousSongs = utils.game.getAllSongs.getData()
      if (!previousSongs) return { previousSongs }

      const maxPos = Math.max(
        0,
        ...previousSongs.map((s) => s.playedPosition || 0)
      )
      const lastPlayedSong = previousSongs.find(
        (s) => s.playedPosition === maxPos
      )
      if (!lastPlayedSong) return { previousSongs }

      utils.game.getAllSongs.setData(undefined, (old) => {
        if (!old) return previousSongs
        return old.map((song) => ({
          ...song,
          isPlayed: song.isPlayed && song.playedPosition !== maxPos,
          playedPosition:
            song.playedPosition === maxPos ? undefined : song.playedPosition,
        }))
      })

      return { previousSongs }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousSongs) {
        utils.game.getAllSongs.setData(undefined, context.previousSongs)
      }
    },
    onSettled: () => {
      utils.game.getAllSongs.invalidate()
    },
  })

  const handlePlaySong = (songId: string) => {
    playSongMutation.mutate({ songId })
  }

  const handleCardPress = (song: (typeof songsWithLastPlayed)[number]) => {
    if (song.isLastPlayed) {
      undoLastPlayedMutation.mutate()
    } else if (!song.isPlayed) {
      handlePlaySong(song.id)
    }
  }

  return (
    <main className="container mx-auto p-4 pb-16">
      <h1 className="text-4xl font-brand uppercase mb-6">Admin Dashboard</h1>

      <div className="flex flex-col gap-2 -mx-2">
        {songsWithLastPlayed?.map((song) => (
          <Card
            key={song.id}
            isPressable
            isDisabled={song.isPlayed && !song.isLastPlayed}
            onPress={() => handleCardPress(song)}
            className={cn('flex items-center relative', {
              'opacity-50': song.isPlayed && !song.isLastPlayed,
              'border-success': song.isLastPlayed,
            })}
            radius="sm"
          >
            <CardBody className="gap-3 justify-between flex-row items-center">
              <div className="flex flex-col flex-grow">
                <p className="text-lg leading-tight">{song.title}</p>
                <p className="text-xs text-default-500 leading-tight">
                  {song.artist}
                </p>
              </div>
              <div className="flex gap-1">
                {song.isLastPlayed && (
                  <Chip
                    color="warning"
                    variant="flat"
                    className="font-brand tracking-widest text-lg uppercase"
                    classNames={{
                      base: 'p-0',
                    }}
                  >
                    <IconArrowBackUp size={20} />
                  </Chip>
                )}
                {song.isPlayed && (
                  <Chip
                    color="success"
                    variant="flat"
                    className="font-brand tracking-widest uppercase text-2xl font-light"
                    startContent={<IconCircleCheckFilled size={24} />}
                  >
                    {song.playedPosition}
                  </Chip>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </main>
  )
}
