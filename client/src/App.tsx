import { FC } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminAuthGuard } from './components/AdminAuthGuard'
import { GameStateGuard } from './components/GameStateGuard'
import { AdminPage } from './pages/AdminPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'

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
                <AdminPage />
              </AdminAuthGuard>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
