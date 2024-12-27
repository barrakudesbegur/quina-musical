import { FC } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { GameStatusWrapper } from './components/GameStatusWrapper'
import { AdminPage } from './pages/AdminPage'
import { HomePage } from './pages/HomePage'

export const App: FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <GameStatusWrapper>
              <HomePage />
            </GameStatusWrapper>
          }
        />
        <Route
          path="/admin"
          element={
            <GameStatusWrapper>
              <AdminPage />
            </GameStatusWrapper>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
