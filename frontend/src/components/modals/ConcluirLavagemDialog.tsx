import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ConcluirLavagemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (pagamento: string) => Promise<boolean>;
}

export function ConcluirLavagemDialog({ open, onOpenChange, onConfirm }: ConcluirLavagemDialogProps) {
  const [pagamento, setPagamento] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) setPagamento('');
  }, [open]);

  const confirmar = async () => {
    if (!pagamento || salvando) return;
    setSalvando(true);
    try {
      if (await onConfirm(pagamento)) onOpenChange(false);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Informar pagamento</DialogTitle>
          <DialogDescription>
            Selecione a forma de pagamento para concluir esta lavagem.
          </DialogDescription>
        </DialogHeader>
        <div>
          <label htmlFor="concluir-lavagem-pagamento" className="mb-1.5 block text-sm font-semibold">
            Forma de pagamento
          </label>
          <select
            id="concluir-lavagem-pagamento"
            className="input-t10 w-full"
            value={pagamento}
            onChange={(event) => setPagamento(event.target.value)}
            required
          >
            <option value="">Selecione...</option>
            <option value="PIX">PIX</option>
            <option value="Débito">Cartão de débito</option>
            <option value="Crédito">Cartão de crédito</option>
            <option value="Dinheiro">Dinheiro</option>
          </select>
        </div>
        <DialogFooter>
          <button type="button" className="input-t10" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-lg bg-success px-4 py-2 font-semibold text-white disabled:opacity-50"
            onClick={confirmar}
            disabled={!pagamento || salvando}
          >
            {salvando ? 'Concluindo...' : 'Confirmar conclusão'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
