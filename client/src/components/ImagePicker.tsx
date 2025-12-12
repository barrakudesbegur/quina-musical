import { RadioGroup, Radio, cn, Button, ButtonProps } from '@heroui/react';
import { IconStar, IconStarFilled } from '@tabler/icons-react';
import { FC, useCallback } from 'react';
import { GALLERY_IMAGES } from '../config/images';
import { trpc } from '../utils/trpc';

export const ImagePicker: FC<{ className?: string }> = ({ className }) => {
  const gameState = trpc.game.onStateChange.useSubscription();
  const showImageMutation = trpc.game.showImage.useMutation();
  const setRoundImageMutation = trpc.game.setRoundImage.useMutation();

  const currentImageId = gameState.data?.displayedImageId ?? null;
  const currentRoundImageId = gameState.data?.roundImageId ?? null;

  const handleValueChange = useCallback(
    (value: string) => {
      const imageId = value === 'none' ? null : value;
      showImageMutation.mutate({ imageId });
    },
    [showImageMutation]
  );

  const handleStarClick = useCallback(
    (imageId: string | null) => {
      if (currentRoundImageId === null && imageId === null) {
        return;
      }

      if (currentRoundImageId === imageId) {
        setRoundImageMutation.mutate({ imageId: null });
      } else {
        setRoundImageMutation.mutate({ imageId });
      }
    },
    [currentRoundImageId, setRoundImageMutation]
  );

  return (
    <div className={cn('@container', className)}>
      <RadioGroup
        value={currentImageId ?? 'none'}
        onValueChange={handleValueChange}
        isDisabled={showImageMutation.isPending}
        classNames={{ wrapper: 'grid grid-cols-2 @sm:grid-cols-3 gap-2' }}
      >
        <div className="flex items-center ">
          <StarButton
            isSelected={currentRoundImageId === null}
            disabled={
              setRoundImageMutation.isPending || currentRoundImageId === null
            }
            onPress={() => handleStarClick(null)}
          />
          <Radio
            value="none"
            color="default"
            classNames={{
              label: 'font-bold leading-none flex items-center gap-2',
              labelWrapper: 'flex-1',
            }}
          >
            Cap imatge
          </Radio>
        </div>
        {GALLERY_IMAGES.map((image) => (
          <div className="flex items-center" key={image.id}>
            <StarButton
              isSelected={currentRoundImageId === image.id}
              disabled={setRoundImageMutation.isPending}
              onPress={() => handleStarClick(image.id)}
            />
            <Radio
              value={image.id}
              color="danger"
              classNames={{
                label:
                  'leading-none group-data-[selected=true]:text-danger-500 flex items-center gap-2',
                labelWrapper: 'flex-1',
              }}
            >
              {image.label}
            </Radio>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};

const StarButton: FC<
  {
    isSelected: boolean;
  } & ButtonProps
> = ({ isSelected, disabled, onPress }) => {
  return (
    <Button
      onPress={onPress}
      disabled={disabled}
      isIconOnly
      size="sm"
      variant="light"
    >
      {isSelected ? (
        <IconStarFilled size={20} className="text-primary-500" />
      ) : (
        <IconStar size={20} className="text-default-400" />
      )}
    </Button>
  );
};
