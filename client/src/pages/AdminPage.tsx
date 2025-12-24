import { Button, ButtonProps } from '@heroui/react';
import {
  IconLogout,
  IconMicrophone2,
  IconSettings,
  TablerIcon,
} from '@tabler/icons-react';
import { FC, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const links = [
  {
    key: 'presenter',
    label: 'Presenter',
    url: '/admin/presenter',
    icon: IconMicrophone2,
    color: 'primary',
    variant: 'shadow',
  },
  {
    key: 'config',
    label: 'Configuració',
    url: '/admin/config',
    icon: IconSettings,
    color: 'secondary',
    variant: 'flat',
  },
] as const satisfies {
  key: string;
  label: string;
  url: string;
  icon: TablerIcon;
  color: ButtonProps['color'];
  variant: ButtonProps['variant'];
}[];

export const AdminPage: FC = () => {
  const navigate = useNavigate();

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('adminAuth');
    navigate('/login');
  }, [navigate]);

  return (
    <main className="container mx-auto min-h-dvh p-4 flex flex-col items-center justify-center gap-6">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-4xl font-brand uppercase text-center tracking-widest">
          Admin
        </h1>

        <div className="flex flex-col gap-3">
          {links.map(({ key, label, url, icon: Icon, ...buttonProps }) => (
            <Button
              key={key}
              as={Link}
              to={url}
              size="lg"
              startContent={<Icon size={22} />}
              {...buttonProps}
            >
              {label}
            </Button>
          ))}
          <Button
            onPress={handleLogout}
            variant="faded"
            color="primary"
            size="lg"
            startContent={<IconLogout size={22} />}
          >
            Logout
          </Button>
        </div>
      </div>
    </main>
  );
};
