import {
  IconGift,
  IconPlayerPause,
  IconPlayerPlay,
  IconPower,
  TablerIcon,
} from '@tabler/icons-react';
import { inferProcedureOutput } from '@trpc/server';
import { FC } from 'react';
import { AppRouter } from '../../../server/src/api';
import { makeHelpersForOptions } from '../utils/makeHelpersForOptions';
import { transformCase } from '../utils/strings';

type GameStatusInfo<T extends string | null | undefined = string> = {
  id: T;
  label: string;
  description: string | null;
  icon: TablerIcon;
};

const {
  // dataArray: gameStatusInfo,
  // dataObject: gameStatusInfoById,
  // getFn: getGameStatusInfo,
  useGetHook: useGameStatusInfo,
} = makeHelpersForOptions(
  'id',
  (id): GameStatusInfo<typeof id> => ({
    id,
    label: id ? transformCase(id, 'title') : String(id),
    description: null,
    icon: IconPlayerPause,
  }),
  [
    {
      id: 'not-avilable',
      label: 'Sistema apagat',
      description: "Espera't a que iniciem la app",
      icon: IconPower,
    },
    {
      id: 'not-started',
      label: 'Encara no hem començat',
      description:
        "Espera't una estona. Aprofita per comprar el cartró i prepara't.",
      icon: IconPlayerPause,
    },
    {
      id: 'ongoing',
      label: 'Ja estem jugant!',
      description: 'Recarrega la pàgina',
      icon: IconPlayerPlay,
    },
    {
      id: 'finished',
      label: 'Ja hem acavat',
      description: 'Gràcies per participar',
      icon: IconGift,
    },
  ] as const
);

type ExtractedStatus<G extends AsyncIterable<unknown>> =
  G extends AsyncIterable<infer T extends { status: unknown }>
    ? T['status']
    : never;

export type GameStatus =
  | ExtractedStatus<inferProcedureOutput<AppRouter['game']['getStatus']>>
  | 'not-avilable';

export const GameStatusScreen: FC<{
  status: GameStatus;
}> = ({ status }) => {
  const { label, description, icon: Icon } = useGameStatusInfo(status);
  return (
    <main className="bg-slate-900 font-brand font-light tracking-wider pb-16 pt-4 text-white min-h-dvh w-dvw flex items-center justify-center flex-col text-center text-balance gap-4 px-4">
      <Icon size={48} stroke={1.5} />
      <h1 className="text-4xl font-normal uppercase tracking-widest-2">
        {label}
      </h1>
      {description && <p className="text-lg tracking-widest">{description}</p>}
    </main>
  );
};
