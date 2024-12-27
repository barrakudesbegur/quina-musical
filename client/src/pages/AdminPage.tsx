import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@nextui-org/react'
import { FC } from 'react'
import { trpc } from '../utils/trpc'

export const AdminPage: FC = () => {
  const songsQuery = trpc.game.getAllSongs.useQuery()

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-4xl font-brand uppercase mb-6">Admin Dashboard</h1>

      <div className="card">
        <h2 className="text-2xl mb-4 font-brand uppercase">All Songs</h2>
        <Table aria-label="Songs table">
          <TableHeader>
            <TableColumn className="font-brand uppercase font-light tracking-wider">
              Title
            </TableColumn>
            <TableColumn className="font-brand uppercase font-light tracking-wider">
              Artist
            </TableColumn>
            <TableColumn className="font-brand uppercase font-light tracking-wider">
              ID
            </TableColumn>
          </TableHeader>
          <TableBody
            items={songsQuery.data ?? []}
            emptyContent={
              songsQuery.isLoading ? 'Loading...' : 'No songs found'
            }
          >
            {(song) => (
              <TableRow key={song.id}>
                <TableCell>{song.title}</TableCell>
                <TableCell>{song.artist}</TableCell>
                <TableCell>{song.id}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
