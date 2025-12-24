import { FC } from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom';
import { AdminAuthGuard } from './components/AdminAuthGuard';
import { GameStateGuard } from './components/GameStateGuard';
import { ConfigurationPage } from './pages/ConfigurationPage';
import { AdminPage } from './pages/AdminPage';
import { PresenterPage } from './pages/PresenterPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';

export const App: FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<GameStateGuard />}>
          <Route path="/" element={<HomePage />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <GameStateGuard
              allowedStatuses={['finished', 'not-started', 'ongoing']}
            />
          }
        >
          <Route
            path="/admin"
            element={
              <AdminAuthGuard>
                <Outlet />
              </AdminAuthGuard>
            }
          >
            <Route index element={<AdminPage />} />
            <Route path="presenter" element={<PresenterPage />} />
            <Route path="config" element={<ConfigurationPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
