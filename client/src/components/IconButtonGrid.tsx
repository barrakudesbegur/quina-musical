import { Button, cn } from '@heroui/react';
import { Icon as IconifyIcon } from '@iconify/react';
import { TablerIcon } from '@tabler/icons-react';
import { FC, PropsWithChildren } from 'react';
import { fxList } from '../config/fx';

type IconSource = TablerIcon | string;

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
    playFx: (fxId: string) => Promise<void>;
  }>
> = ({ className, playFx }) => {
  return (
    <div
      className={cn(
        'grid  grid-cols-[repeat(auto-fill,minmax(--spacing(16),1fr))] gap-3',
        className
      )}
    >
      {fxList.map(
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
