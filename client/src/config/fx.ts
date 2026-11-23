import { ButtonProps } from '@heroui/react';

export type IconGridAction = {
  id: string;
  label: string;
  icon: string;
  iconClassName?: string;
  url: string;
} & Omit<ButtonProps, 'isIconOnly' | 'children'>;

export const fxList: IconGridAction[] = [
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
  {
    id: 'orchestra-hit',
    label: 'Orchestra Hit',
    icon: 'noto:violin',
    url: '/fx/orchestra-hit.mp3',
  },
  {
    id: 'metal-gear-alert',
    label: 'Metal Gear Alert',
    icon: 'noto:red-exclamation-mark',
    url: '/fx/metal-gear-alert.mp3',
  },
  {
    id: 'fear-melody',
    label: 'Fear Melody',
    icon: 'noto:ghost',
    url: '/fx/fear-melody.mp3',
  },
  {
    id: 'bum-bum-buaaa',
    label: 'Bum Bum Buaaa',
    icon: 'noto:face-screaming-in-fear',
    url: '/fx/bum-bum-buaaa.mp3',
  },
  {
    id: 'duck-quack',
    label: 'Duck Quack',
    icon: 'noto:duck',
    url: '/fx/duck-quack.mp3',
  },
];
