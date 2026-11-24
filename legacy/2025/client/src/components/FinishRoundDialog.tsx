import {
  Button,
  Checkbox,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
} from '@heroui/react';
import { IconChevronsRight, IconX } from '@tabler/icons-react';
import { escapeRegExp } from 'lodash-es';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { GALLERY_IMAGES } from '../config/images';

function findImageMatch(name: string) {
  const hasNameStrictRegex = new RegExp(`\\b${escapeRegExp(name)}\\b`);
  const hasNameLooseRegex = new RegExp(`${escapeRegExp(name)}`);

  return (
    GALLERY_IMAGES.find((img) => hasNameStrictRegex.test(img.label)) ??
    GALLERY_IMAGES.find((img) => hasNameLooseRegex.test(img.label)) ??
    null
  );
}

export const FinishRoundDialog: FC<{
  isOpen: boolean;
  defaultValue: string;
  defaultWinnerCardIds?: string;
  onClose: () => void;
  onConfirm: (data: {
    name: string;
    isLastRound: boolean;
    imageId: string | null;
    winnerCardIds: number[];
  }) => void;
  loading: boolean;
}> = ({
  isOpen,
  defaultValue,
  defaultWinnerCardIds = '',
  onClose,
  onConfirm,
  loading,
}) => {
  const [name, setName] = useState(defaultValue);
  const [isLastRound, setIsLastRound] = useState(false);
  const [imageId, setImageId] = useState<string | null>(
    findImageMatch(defaultValue)?.id ?? null
  );
  const [winnerCardIdsText, setWinnerCardIdsText] =
    useState(defaultWinnerCardIds);

  useEffect(() => {
    setWinnerCardIdsText(defaultWinnerCardIds);
  }, [defaultWinnerCardIds]);

  const winnerCardIds = useMemo(() => {
    return winnerCardIdsText
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => Number.isFinite(id) && id > 0);
  }, [winnerCardIdsText]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    onConfirm({ name, isLastRound, imageId, winnerCardIds });
  };

  const handleNameChange = useCallback((newName: string) => {
    setName(newName);

    if (newName) {
      const match = findImageMatch(newName);
      setImageId(match?.id ?? null);
    }
  }, []);

  const isWinnerCardIdsValid = winnerCardIdsText.trim().length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        {(onClose) => (
          <form onSubmit={handleSubmit}>
            <ModalHeader className="flex flex-col gap-1">
              Finalitzar quina
            </ModalHeader>
            <ModalBody className="gap-4">
              <Input
                autoFocus
                value={winnerCardIdsText}
                onValueChange={setWinnerCardIdsText}
                label="Cartons guanyadors"
                variant="bordered"
                description="Separar amb comes. Ex: 1, 42, 103"
                isRequired
              />

              <Input
                value={name}
                onValueChange={handleNameChange}
                label="Nom de la següent quina"
                variant="bordered"
                disabled={isLastRound}
                minLength={1}
                maxLength={30}
              />

              <Select
                label="Imatge de la següent quina"
                variant="bordered"
                selectedKeys={imageId ? [imageId] : []}
                onSelectionChange={(keys) => {
                  const selectedKey = Array.from(keys)[0];
                  setImageId(selectedKey ? String(selectedKey) : null);
                }}
                isDisabled={isLastRound}
                placeholder="Cap imatge"
              >
                {GALLERY_IMAGES.map((image) => (
                  <SelectItem key={image.id}>{image.label}</SelectItem>
                ))}
              </Select>

              <Checkbox isSelected={isLastRound} onValueChange={setIsLastRound}>
                No hi ha més quines
              </Checkbox>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Cancel·lar
              </Button>
              {isLastRound ? (
                <Button
                  color="danger"
                  type="submit"
                  startContent={<IconX size={20} />}
                  isLoading={loading}
                  isDisabled={!isWinnerCardIdsValid}
                >
                  Acabar totes les quines
                </Button>
              ) : (
                <Button
                  color="primary"
                  type="submit"
                  startContent={<IconChevronsRight size={20} />}
                  isLoading={loading}
                  isDisabled={!winnerCardIds}
                >
                  Següent quina
                </Button>
              )}
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};
