import {
  Button,
  Link as HeroLink,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
} from '@heroui/react';
import { IconDatabase, IconMusic, IconSparkles } from '@tabler/icons-react';
import { FC, useCallback } from 'react';
import {
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { DatabaseTab } from '../components/DatabaseTab';
import { FxTab } from '../components/FxTab';
import { SongsTab } from '../components/SongsTab';

const TABS = [
  {
    id: '/admin/config',
    href: '/admin/config',
    icon: IconMusic,
    label: 'Cançons',
  },
  {
    id: '/admin/config/fx',
    href: '/admin/config/fx',
    icon: IconSparkles,
    label: 'Efectes',
  },
  {
    id: '/admin/config/database',
    href: '/admin/config/database',
    icon: IconDatabase,
    label: 'Base de dades',
  },
];

export const ConfigurationPage: FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('adminAuth');
    navigate('/login');
  }, [navigate]);

  return (
    <main className="h-dvh flex flex-col bg-background">
      <Navbar isBordered maxWidth="full">
        <NavbarBrand>
          <h1 className="text-2xl font-brand uppercase tracking-widest">
            Configuració
          </h1>
        </NavbarBrand>

        <NavbarContent className="hidden sm:flex gap-4" justify="center">
          {TABS.map((tab) => (
            <NavbarItem key={tab.id} isActive={pathname === tab.href}>
              <HeroLink
                as={Link}
                to={tab.href}
                color={pathname === tab.href ? 'primary' : 'foreground'}
                className="flex items-center gap-2"
              >
                <tab.icon className="size-4" />
                <span>{tab.label}</span>
              </HeroLink>
            </NavbarItem>
          ))}
        </NavbarContent>

        <NavbarContent justify="end">
          <NavbarItem>
            <Button
              as={Link}
              to="/admin"
              variant="flat"
              color="default"
              size="sm"
            >
              Admin
            </Button>
          </NavbarItem>
          <NavbarItem>
            <Button
              onPress={handleLogout}
              variant="faded"
              color="primary"
              size="sm"
            >
              Logout
            </Button>
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route index element={<SongsTab />} />
            <Route path="fx" element={<FxTab />} />
            <Route path="database" element={<DatabaseTab />} />
          </Routes>
        </div>
      </div>
    </main>
  );
};
