import {
  Button,
  Card,
  CardBody,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from '@heroui/react';
import { IconDownload, IconTrash, IconUpload } from '@tabler/icons-react';
import { FC, useCallback, useRef } from 'react';
import { trpc } from '../utils/trpc';

export const DatabaseTab: FC = () => {
  const trpcUtils = trpc.useUtils();
  const importDbMutation = trpc.game.importDb.useMutation();
  const clearDbMutation = trpc.game.clearDb.useMutation();
  const clearDbModal = useDisclosure();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(async () => {
    const data = await trpcUtils.game.exportDb.fetch();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quina-db-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [trpcUtils.game.exportDb]);

  const handleImport = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (
          !window.confirm(
            'Això sobreescriurà TOTES les dades. Estàs segur que vols continuar?'
          )
        ) {
          return;
        }

        await importDbMutation.mutateAsync({ data });
        await trpcUtils.invalidate();
        window.alert('Importació completada!');
      } catch (err) {
        console.error('Import failed:', err);
        window.alert(
          `Error d'importació: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }
    },
    [importDbMutation, trpcUtils]
  );

  const handleClearDb = useCallback(async () => {
    try {
      await clearDbMutation.mutateAsync();
      await trpcUtils.invalidate();
      clearDbModal.onClose();
      window.alert('Base de dades esborrada!');
    } catch (err) {
      console.error('Clear failed:', err);
      window.alert(
        `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }, [clearDbMutation, clearDbModal, trpcUtils]);

  return (
    <div className="p-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImport(file);
            e.target.value = '';
          }
        }}
      />

      <Card className="max-w-xl">
        <CardBody className="gap-4">
          <h2 className="text-lg font-semibold">Gestió de la base de dades</h2>
          <p className="text-default-500 text-sm">
            Exporta, importa o esborra totes les dades del joc.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              onPress={handleExport}
              variant="flat"
              color="primary"
              startContent={<IconDownload className="size-4" />}
            >
              Exportar DB
            </Button>
            <Button
              onPress={() => fileInputRef.current?.click()}
              variant="flat"
              color="secondary"
              isLoading={importDbMutation.isPending}
              startContent={
                !importDbMutation.isPending && <IconUpload className="size-4" />
              }
            >
              Importar DB
            </Button>
            <Button
              onPress={clearDbModal.onOpen}
              variant="flat"
              color="danger"
              startContent={<IconTrash className="size-4" />}
            >
              Esborrar DB
            </Button>
          </div>
        </CardBody>
      </Card>

      <Modal
        isOpen={clearDbModal.isOpen}
        onOpenChange={clearDbModal.onOpenChange}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Confirmar esborrament</ModalHeader>
              <ModalBody>
                <p>
                  Estàs segur que vols esborrar <strong>TOTES</strong> les
                  dades? Això inclou:
                </p>
                <ul className="list-disc list-inside text-default-500 mt-2">
                  <li>Timestamps de cançons</li>
                  <li>Volums personalitzats</li>
                  <li>Configuració d&apos;efectes</li>
                  <li>Rondes i estat del joc</li>
                </ul>
                <p className="text-danger mt-2 font-medium">
                  Aquesta acció no es pot desfer!
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel·lar
                </Button>
                <Button
                  color="danger"
                  onPress={handleClearDb}
                  isLoading={clearDbMutation.isPending}
                >
                  Esborrar tot
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};
