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
import { IconChevronsRight, IconDeviceFloppy } from '@tabler/icons-react'
import { FC, useState } from 'react'

export const FinishRoundDialog: FC<{
  isOpen: boolean
  defaultValue: string
  onClose: () => void
  onConfirm: (name: string, isLastRound: boolean) => void
}> = ({ isOpen, defaultValue, onClose, onConfirm }) => {
  const [isLastRound, setIsLastRound] = useState(false)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string
    onConfirm(name, isLastRound)
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
                name="name"
                label="Nom de la següent quina"
                defaultValue={defaultValue}
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
              <Button
                color="primary"
                type="submit"
                startContent={<IconChevronsRight size={20} />}
              >
                Següent quina
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  )
}
