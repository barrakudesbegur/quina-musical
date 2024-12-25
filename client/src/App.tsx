import { FC } from 'react'
import { Main } from './components/Main'
import { Providers } from './components/Providers'

export const App: FC = () => {
  return (
    <Providers>
      <Main />
    </Providers>
  )
}
