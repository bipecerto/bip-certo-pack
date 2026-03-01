import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  code: string;
  onOpenChange: (v: boolean) => void;
  onOk: () => void;
  onRescan: () => void;
  onGoImports: () => void;
}

export function NotFoundDialog({ open, code, onOpenChange, onOk, onRescan, onGoImports }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Código não encontrado</DialogTitle>
          <DialogDescription>
            Não encontramos <span className="font-mono font-semibold">{code}</span> no sistema.
            Verifique se os pedidos já foram importados.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onOk}>OK</Button>
          <Button variant="secondary" onClick={onRescan}>Escanear novamente</Button>
          <Button onClick={onGoImports}>Ir para Imports</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
