import { Card, CardBody, CardHeader, Divider } from '@nextui-org/react'
import { FC } from 'react'
import { trpc } from '../utils/trpc'

export const Main: FC = () => {
  const songs = trpc.song.getAll.useQuery()

  return (
    <main className="container mx-auto px-4 py-16">
      <h1 className="text-3xl mb-2">Quina musical</h1>
      <Card>
        <CardHeader>
          <h1 className="text-lg font-bold">Totes les cançons</h1>
        </CardHeader>
        <Divider />
        <CardBody>
          <pre>
            <code>{JSON.stringify(songs.data, null, 2)}</code>
          </pre>
        </CardBody>
      </Card>
    </main>
  )
}
