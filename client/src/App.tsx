import { FC } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GameStateGuard } from './components/GameStateGuard'
import { AdminPage } from './pages/AdminPage'
import { HomePage } from './pages/HomePage'

export const App: FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<GameStateGuard />}>
          <Route path="/" element={<HomePage />} />
        </Route>
        <Route
          element={
            <GameStateGuard
              allowedStatuses={['finished', 'not-started', 'ongoing']}
            />
          }
        >
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
