import { useState } from 'react'
import reactLogo from '../assets/react.svg'
import viteLogo from '/vite.svg'
import { trpc } from '../utils/trpc'
import { Providers } from './Providers'

function ExampleComponent() {
  const [count, setCount] = useState(0)

  const songs = trpc.song.getAll.useQuery()

  return (
    <Providers>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/ExampleComponent.tsx</code> and save to test HMR
        </p>
        <pre className="bg-stone-100 rounded-lg p-4">
          <code>{JSON.stringify(songs.data, null, 2)}</code>
        </pre>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </Providers>
  )
}

export default ExampleComponent
