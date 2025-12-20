import {
  Alert,
  Button,
  Input,
  Listbox,
  ListboxItem,
  ListboxSection,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from '@heroui/react';
import { IconCheck, IconCircleXFilled } from '@tabler/icons-react';
import { FC, useMemo, useState } from 'react';
import { trpc } from '../utils/trpc';

export const CheckCardDialog: FC<{
  isOpen: boolean;
  onClose: () => void;
  onFinishRound: (cardId: string) => void;
}> = ({ isOpen, onClose, onFinishRound }) => {
  const [cardId, setCardId] = useState('');
  const cardsQuery = trpc.card.getAll.useQuery(undefined, { enabled: isOpen });
  const songsQuery = trpc.game.getAllSongs.useQuery(undefined, {
    enabled: isOpen,
  });

  const handleClose = () => {
    setCardId('');
    onClose();
  };

  const selectedCard = useMemo(() => {
    if (!cardsQuery.data) return undefined;
    const trimmed = cardId.trim();
    if (!trimmed) return undefined;
    return cardsQuery.data.find((card) => String(card.id) === trimmed);
  }, [cardId, cardsQuery.data]);

  const playedSongIds = useMemo(() => {
    if (!songsQuery.data) return null;
    return new Set(
      songsQuery.data.filter((song) => song.isPlayed).map((song) => song.id)
    );
  }, [songsQuery.data]);

  const missingSongs = useMemo(() => {
    if (!selectedCard || !playedSongIds) return null;
    return selectedCard.lines
      .flat()
      .filter((song) => !playedSongIds.has(song.id));
  }, [playedSongIds, selectedCard]);

  const isWinner = Boolean(selectedCard) && missingSongs?.length === 0;
  const isLoading = cardsQuery.isLoading || songsQuery.isLoading;
  const cardNotFound =
    cardId.trim().length > 0 && cardsQuery.isSuccess && !selectedCard;

  const handleFinishRound = () => {
    onFinishRound(cardId.trim());
    handleClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              Comprovar cartó
            </ModalHeader>
            <ModalBody className="gap-4">
              <Input
                autoFocus
                value={cardId}
                onValueChange={setCardId}
                label="Número del cartó"
                variant="bordered"
                labelPlacement="outside"
                placeholder="Ex: 123"
                inputMode="numeric"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                  }
                }}
              />

              {cardNotFound && (
                <Alert
                  color="danger"
                  variant="flat"
                  title="Cartó no trobat"
                  description="Revisa el número introduït."
                />
              )}

              {selectedCard && missingSongs && (
                <Alert
                  color={missingSongs.length === 0 ? 'success' : 'danger'}
                  variant="solid"
                  title={
                    missingSongs.length === 0
                      ? 'Cartó guanyador'
                      : missingSongs.length === 1
                        ? `Falta "${missingSongs[0].title}"`
                        : `Falten ${missingSongs.length} cançons`
                  }
                />
              )}

              {isLoading && (
                <div className="flex justify-center py-4">
                  <Spinner label="Carregant cartó..." color="primary" />
                </div>
              )}

              {selectedCard && playedSongIds && !isLoading && (
                <Listbox aria-label="Cartó complert per línies" variant="flat">
                  {selectedCard.lines.map((line, lineIndex) => (
                    <ListboxSection
                      key={lineIndex}
                      aria-label={`Línia ${lineIndex + 1}`}
                      showDivider={lineIndex !== selectedCard.lines.length - 1}
                    >
                      {line.map((song) => {
                        const playedSong = songsQuery.data?.find(
                          (s) => s.id === song.id
                        );
                        return (
                          <ListboxItem
                            key={song.id}
                            startContent={
                              playedSong?.isPlayed ? (
                                <IconCheck className="text-success" size={18} />
                              ) : (
                                <IconCircleXFilled
                                  className="text-current"
                                  size={18}
                                />
                              )
                            }
                            className={
                              playedSong?.isPlayed ? undefined : 'text-danger'
                            }
                            color={playedSong?.isPlayed ? undefined : 'danger'}
                            endContent={
                              <span className="text-sm text-default-400">
                                {playedSong?.position}
                              </span>
                            }
                          >
                            {song.title}
                          </ListboxItem>
                        );
                      })}
                    </ListboxSection>
                  ))}
                </Listbox>
              )}
            </ModalBody>
            <ModalFooter>
              <Button color="default" variant="light" onPress={handleClose}>
                Tancar
              </Button>
              {isWinner && (
                <Button color="success" onPress={handleFinishRound}>
                  Finalitzar quina
                </Button>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
