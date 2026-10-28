import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { useTelefoneMask } from "@/hooks/useTelefoneMask";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface NovoClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId?: string | null;
}

export function NovoClienteModal({
  isOpen,
  onClose,
  clienteId,
}: NovoClienteModalProps) {
  const { addCliente, updateCliente, clientes } = useApp();
  const nomeRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState("");
  const {
    value: telefone,
    handleChange: handleTelefoneChange,
    setValue: setTelefone,
  } = useTelefoneMask();
  const [dataNascimento, setDataNascimento] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (clienteId) {
      // Caso esteja editando um cliente existente
      const clienteEdicao = clientes?.find((c) => c.id === clienteId);
      if (clienteEdicao) {
        setNome(clienteEdicao.nome || "");
        setTelefone(clienteEdicao.telefone || "");
        setDataNascimento(clienteEdicao.data_nascimento || "");
      }
    } else {
      // Limpa os campos para novo cadastro
      setNome("");
      setTelefone("");
      setDataNascimento("");
    }
    setError("");
  }, [isOpen, clienteId, clientes, setTelefone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    try {
      setError("");
      setLoading(true);

      const payload = {
        nome: nome.trim(),
        telefone: telefone.trim(),
        data_nascimento: dataNascimento || null,
      };

      if (clienteId && updateCliente) {
        await updateCliente(clienteId, payload);
        toast.success("Cliente atualizado com sucesso.");
      } else {
        await addCliente(payload);
        toast.success("Cliente cadastrado com sucesso.");
      }

      onClose();
    } catch (err) {
      const mensagem =
        err instanceof Error ? err.message : "Erro ao salvar cliente";
      setError(mensagem);
      toast.error(mensagem);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          nomeRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            {clienteId ? "Editar Cliente" : "Cadastrar Cliente"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Preencha os dados do cliente para salvá-los no sistema.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p
              role="alert"
              aria-live="assertive"
              className="text-destructive text-sm"
            >
              {error}
            </p>
          )}

          <div>
            <label
              htmlFor="cliente-nome"
              className="block text-base font-semibold text-foreground mb-1.5"
            >
              Nome Completo *
            </label>
            <input
              id="cliente-nome"
              ref={nomeRef}
              className="input-t10"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do cliente"
              required
            />
          </div>

          <div>
            <label
              htmlFor="cliente-telefone"
              className="block text-base font-semibold text-foreground mb-1.5"
            >
              Telefone / WhatsApp
            </label>
            <input
              id="cliente-telefone"
              className="input-t10"
              value={telefone}
              onChange={handleTelefoneChange}
              placeholder="(00) 90000-0000"
              maxLength={15}
            />
          </div>

          <div>
            <label
              htmlFor="cliente-nascimento"
              className="block text-base font-semibold text-foreground mb-1.5"
            >
              Data de Nascimento (Aniversariante do Mês)
            </label>
            <input
              id="cliente-nascimento"
              type="date"
              className="input-t10"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-secondary text-secondary-foreground font-bold h-12 rounded-lg hover:bg-secondary/80 transition-all text-base"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary text-primary-foreground font-bold h-12 rounded-lg hover:brightness-110 transition-all text-base disabled:opacity-50"
            >
              {loading
                ? "Salving..."
                : clienteId
                  ? "Atualizar Cliente"
                  : "Salvar Cliente"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
