import { RadioGroup, Radio, cn } from '@heroui/react';
import { FC, useCallback } from 'react';
import { GALLERY_IMAGES } from '../config/images';
import { trpc } from '../utils/trpc';

export const ImagePicker: FC<{ className?: string }> = ({ className }) => {
  const gameState = trpc.game.onStateChange.useSubscription();
  const showImageMutation = trpc.game.showImage.useMutation();

  const currentImageId = gameState.data?.displayedImageId ?? null;

  const handleValueChange = useCallback(
    (value: string) => {
      const imageId = value === 'none' ? null : value;
      showImageMutation.mutate({ imageId });
    },
    [showImageMutation]
  );

  return (
    <div className={cn('mt-8 @container', className)}>
      <h2 className="text-3xl mb-4 font-brand uppercase text-center  tracking-wider">
        Imatges
      </h2>
      <RadioGroup
        value={currentImageId ?? 'none'}
        onValueChange={handleValueChange}
        isDisabled={showImageMutation.isPending}
        classNames={{ wrapper: 'grid grid-cols-2 @sm:grid-cols-3 gap-2' }}
      >
        <Radio
          value="none"
          color="default"
          classNames={{ label: 'font-bold leading-none' }}
        >
          Cap imatge
        </Radio>
        {GALLERY_IMAGES.map((image) => (
          <Radio
            key={image.id}
            value={image.id}
            color="danger"
            classNames={{
              label: 'leading-none group-data-[selected=true]:text-danger-500',
            }}
          >
            {image.label}
          </Radio>
        ))}
      </RadioGroup>
    </div>
  );
};
