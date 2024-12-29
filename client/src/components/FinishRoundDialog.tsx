import {
  Alert,
  Button,
  Checkbox,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@nextui-org/react'
import { IconChevronsRight, IconDeviceFloppy, IconX } from '@tabler/icons-react'
import { FC, useState } from 'react'

export const FinishRoundDialog: FC<{
  isOpen: boolean
  defaultValue: string
  onClose: () => void
  onConfirm: (name: string, isLastRound: boolean) => void
  loading: boolean
}> = ({ isOpen, defaultValue, onClose, onConfirm, loading }) => {
  const [isLastRound, setIsLastRound] = useState(false)
  const [roundName, setRoundName] = useState(defaultValue)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onConfirm(roundName, isLastRound)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        {(onClose) => (
          <form onSubmit={handleSubmit}>
            <ModalHeader className="flex flex-col gap-1">
              Finalitzar quina
            </ModalHeader>
            <ModalBody className="gap-4">
              <Input
                autoFocus
                value={roundName}
                onValueChange={setRoundName}
                label="Nom de la següent quina"
                variant="bordered"
                disabled={isLastRound}
                minLength={1}
                maxLength={30}
              />

              <Checkbox isSelected={isLastRound} onValueChange={setIsLastRound}>
                No hi ha més quines
              </Checkbox>

              <Alert
                variant="flat"
                color="success"
                className="text-sm text-default-500"
                classNames={{
                  alertIcon: 'fill-none',
                }}
                title="La quina anterior es guardarà."
                description=""
                icon={<IconDeviceFloppy size={20} fill="none" />}
              />
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Cancel·lar
              </Button>
              {isLastRound ? (
                <Button
                  color="danger"
                  type="submit"
                  startContent={<IconX size={20} />}
                  isLoading={loading}
                >
                  Acabar totes les quines
                </Button>
              ) : (
                <Button
                  color="primary"
                  type="submit"
                  startContent={<IconChevronsRight size={20} />}
                  isLoading={loading}
                >
                  Següent quina
                </Button>
              )}
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  )
}
