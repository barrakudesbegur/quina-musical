import { Button, ButtonProps, cn } from '@heroui/react';
import { Icon as IconifyIcon } from '@iconify/react';
import { TablerIcon } from '@tabler/icons-react';
import { FC, PropsWithChildren, useEffect } from 'react';
import { useAudioContext, useSoundEffects } from '../audio';

type IconSource = TablerIcon | string;

type IconGridAction = {
  id: string;
  label: string;
  icon: IconSource;
  iconClassName?: string;
  url: string;
} & Omit<ButtonProps, 'isIconOnly' | 'children'>;

const actions: IconGridAction[] = [
  {
    id: 'anime-wow',
    label: 'Anime wow',
    icon: 'noto:smiling-cat-with-heart-eyes',
    url: '/fx/anime-wow.mp3',
  },
  {
    id: 'correct',
    label: 'Correct',
    icon: 'noto:check-mark-button',
    url: '/fx/correct.mp3',
  },
  {
    id: 'tada',
    label: 'Tada',
    icon: 'noto:party-popper',
    url: '/fx/tada.mp3',
  },
  {
    id: 'heaven',
    label: 'Heaven',
    icon: 'noto:wing',
    url: '/fx/heaven.mp3',
  },
  {
    id: 'among-us',
    label: 'Among Us',
    icon: 'noto:alien-monster',
    url: '/fx/among-us.mp3',
  },
  {
    id: 'spongebob-boowomp',
    label: 'Spongebob Boowomp',
    icon: 'noto:balloon',
    url: '/fx/spongebob-boowomp.mp3',
  },
  {
    id: 'boom',
    label: 'Boom',
    icon: 'twemoji:collision',
    url: '/fx/boom.mp3',
  },
  {
    id: 'horn',
    label: 'Horn',
    icon: 'noto:police-car-light',
    url: '/fx/horn.mp3',
  },
  {
    id: 'buzzer',
    label: 'Buzzer',
    icon: 'noto:cross-mark',
    url: '/fx/buzzer.mp3',
  },
  {
    id: 'sad-trombone',
    label: 'Sad Trombone',
    icon: 'noto:trumpet',
    url: '/fx/sad-trombone.mp3',
  },
  {
    id: 'spongebob-fail',
    label: 'Spongebob Fail',
    icon: 'noto:crying-face',
    url: '/fx/spongebob-fail.mp3',
  },
];

const renderIcon = (icon: IconSource, iconClassName?: string) => {
  if (typeof icon === 'string') {
    return <IconifyIcon icon={icon} className={cn('size-6', iconClassName)} />;
  }

  const IconComponent = icon;
  return <IconComponent className={cn('size-6', iconClassName)} />;
};

export const IconButtonGrid: FC<
  PropsWithChildren<{
    className?: string;
    fxVolume?: number;
  }>
> = ({ className, fxVolume = 1 }) => {
  const { setVolume } = useAudioContext();
  const { playFx } = useSoundEffects(actions);

  useEffect(() => {
    setVolume('effects', fxVolume);
  }, [fxVolume, setVolume]);

  return (
    <div
      className={cn(
        'grid  grid-cols-[repeat(auto-fill,minmax(--spacing(16),1fr))] gap-3',
        className
      )}
    >
      {actions.map(
        ({
          id,
          icon: Icon,
          label,
          color = 'default',
          variant = 'flat',
          radius = 'md',
          className: actionClassName,
          iconClassName,
          ...buttonProps
        }) => (
          <Button
            key={id}
            isIconOnly
            aria-label={label}
            title={label}
            color={color}
            variant={variant}
            radius={radius}
            className={cn('w-full h-auto aspect-square', actionClassName)}
            onPress={() => {
              playFx(id);
            }}
            {...buttonProps}
          >
            {renderIcon(Icon, iconClassName)}
          </Button>
        )
      )}
    </div>
  );
};

export type { IconGridAction };
