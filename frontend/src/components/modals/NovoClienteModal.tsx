import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useApp } from '@/contexts/AppContext';
import { useTelefoneMask } from '@/hooks/useTelefoneMask';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface NovoClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NovoClienteModal({ isOpen, onClose }: NovoClienteModalProps) {
  const { addCliente } = useApp();
  const nomeRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState('');
  const { value: telefone, handleChange: handleTelefoneChange, setValue: setTelefone } = useTelefoneMask();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setNome('');
    setTelefone('');
    setError('');
  }, [isOpen, setTelefone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    try {
      setError('');
      await addCliente({ nome: nome.trim(), telefone: telefone.trim() });
      toast.success('Cliente cadastrado com sucesso.');
      onClose();
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro ao cadastrar cliente';
      setError(mensagem);
      toast.error(mensagem);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          nomeRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">Cadastrar Cliente</DialogTitle>
          <DialogDescription className="sr-only">
            Preencha os dados do novo cliente para cadastrá-lo no sistema.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p role="alert" aria-live="assertive" className="text-destructive text-sm">{error}</p>
          )}
          <div>
            <label htmlFor="cliente-nome" className="block text-base font-semibold text-foreground mb-1.5">Nome Completo</label>
            <input id="cliente-nome" ref={nomeRef} className="input-t10" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do cliente" required />
          </div>
          <div>
            <label htmlFor="cliente-telefone" className="block text-base font-semibold text-foreground mb-1.5">Telefone / WhatsApp</label>
            <input id="cliente-telefone" className="input-t10" value={telefone} onChange={handleTelefoneChange} placeholder="16 99999-9999" maxLength={15} />
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-secondary text-secondary-foreground font-bold h-12 rounded-lg hover:bg-secondary/80 transition-all text-base"
            >
              Cancelar
            </button>
            <button type="submit" className="flex-1 bg-primary text-primary-foreground font-bold h-12 rounded-lg hover:brightness-110 transition-all text-base">
              Salvar Cliente
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}