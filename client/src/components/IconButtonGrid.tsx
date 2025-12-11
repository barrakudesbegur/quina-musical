import { Button, ButtonProps, cn } from '@heroui/react';
import { Icon as IconifyIcon } from '@iconify/react';
import { TablerIcon } from '@tabler/icons-react';
import { FC, PropsWithChildren } from 'react';
import { useSoundEffects } from '../hooks/useSoundEffects';

type IconSource = TablerIcon | string;

type IconGridAction = {
  id: string;
  label: string;
  icon: IconSource;
  iconClassName?: string;
  src: string;
} & Omit<ButtonProps, 'isIconOnly' | 'children'>;

const actions: IconGridAction[] = [
  {
    id: 'anime-wow',
    label: 'Anime wow',
    icon: 'noto:smiling-cat-with-heart-eyes',
    src: '/fx/anime-wow.mp3',
  },
  {
    id: 'correct',
    label: 'Correct',
    icon: 'noto:check-mark-button',
    src: '/fx/correct.mp3',
  },
  {
    id: 'tada',
    label: 'Tada',
    icon: 'noto:party-popper',
    src: '/fx/tada.mp3',
  },
  {
    id: 'heaven',
    label: 'Heaven',
    icon: 'noto:wing',
    src: '/fx/heaven.mp3',
  },
  {
    id: 'among-us',
    label: 'Among Us',
    icon: 'noto:alien-monster',
    src: '/fx/among-us.mp3',
  },
  {
    id: 'spongebob-boowomp',
    label: 'Spongebob Boowomp',
    icon: 'noto:balloon',
    src: '/fx/spongebob-boowomp.mp3',
  },
  {
    id: 'boom',
    label: 'Boom',
    icon: 'twemoji:collision',
    src: '/fx/boom.mp3',
  },
  {
    id: 'horn',
    label: 'Horn',
    icon: 'noto:police-car-light',
    src: '/fx/horn.mp3',
  },
  {
    id: 'buzzer',
    label: 'Buzzer',
    icon: 'noto:cross-mark',
    src: '/fx/buzzer.mp3',
  },
  {
    id: 'sad-trombone',
    label: 'Sad Trombone',
    icon: 'noto:trumpet',
    src: '/fx/sad-trombone.mp3',
  },
  {
    id: 'spongebob-fail',
    label: 'Spongebob Fail',
    icon: 'noto:crying-face',
    src: '/fx/spongebob-fail.mp3',
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
  }>
> = ({ className }) => {
  const { playFx } = useSoundEffects(actions);

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
