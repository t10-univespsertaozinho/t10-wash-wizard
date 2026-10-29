import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface NovaLavagemModalProps {
  isOpen: boolean;
  onClose: () => void;
  lavagemId?: string | null;
}

export function NovaLavagemModal({
  isOpen,
  onClose,
  lavagemId,
}: NovaLavagemModalProps) {
  const {
    clientes,
    getVeiculosCliente,
    tiposLavagem,
    addLavagem,
    updateLavagem,
    lavagens,
  } = useApp();
  const primeiroCampoRef = useRef<HTMLSelectElement>(null);
  const [clienteId, setClienteId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState("pendente");
  const [pagamento, setPagamento] = useState("Dinheiro");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const veiculosCliente = clienteId ? getVeiculosCliente(clienteId) : [];

  useEffect(() => {
    if (!isOpen) return;

    if (lavagemId) {
      // Caso seja edição de lavagem existente
      const lavagemEdicao = lavagens?.find((l) => l.id === lavagemId);
      if (lavagemEdicao) {
        setClienteId(lavagemEdicao.cliente_id || "");
        setVeiculoId(lavagemEdicao.veiculo_id || "");
        setTipoId(lavagemEdicao.tipo_lavagem_id || "");
        setValor(String(lavagemEdicao.valor || ""));
        setStatus(lavagemEdicao.status || "pendente");
        setPagamento(lavagemEdicao.pagamento || "Dinheiro");
        setObs(lavagemEdicao.observacao || "");
      }
    } else {
      // Limpa os campos para novo atendimento
      setClienteId("");
      setVeiculoId("");
      setTipoId("");
      setValor("");
      setStatus("pendente");
      setPagamento("Dinheiro");
      setObs("");
    }
    setErro("");
  }, [isOpen, lavagemId, lavagens]);

  const handleTipoChange = (id: string) => {
    setTipoId(id);
    const t = tiposLavagem.find((x) => x.id === id);
    if (t) setValor(t.preco.toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    if (!clienteId || !veiculoId || !tipoId) return;

    const valorNum = parseFloat(valor);
    if (!Number.isFinite(valorNum) || valorNum < 0) {
      setErro("O valor deve ser um número maior ou igual a zero.");
      return;
    }
    if (status === "concluida" && (!pagamento.trim() || pagamento.trim().toLocaleLowerCase("pt-BR") === "pendente")) {
      setErro("Para concluir a lavagem, informe uma forma de pagamento diferente de Pendente.");
      return;
    }

    setSalvando(true);
    try {
      const payload = {
        cliente_id: clienteId,
        veiculo_id: veiculoId,
        tipo_lavagem_id: tipoId,
        status,
        pagamento,
        valor: valorNum,
        observacao: obs,
      };

      if (lavagemId && updateLavagem) {
        await updateLavagem(lavagemId, payload);
        toast.success("Lavagem atualizada com sucesso.");
      } else {
        await addLavagem(payload);
        toast.success("Lavagem registrada com sucesso.");
      }

      onClose();
    } catch (err) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Erro desconhecido ao salvar a lavagem.";
      setErro(`Não foi possível salvar a lavagem: ${mensagem}`);
      toast.error(`Não foi possível salvar a lavagem: ${mensagem}`);
    } finally {
      setSalvando(false);
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
          primeiroCampoRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            {lavagemId ? "Editar Lavagem" : "Registrar Lavagem"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Preencha os dados do atendimento para salvá-los no sistema.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {erro && (
            <div
              role="alert"
              aria-live="assertive"
              className="badge-cancelada text-sm rounded-lg px-4 py-2 text-center"
            >
              {erro}
            </div>
          )}

          <div>
            <label
              htmlFor="lavagem-cliente"
              className="block text-base font-semibold text-foreground mb-1.5"
            >
              Cliente
            </label>
            <select
              ref={primeiroCampoRef}
              id="lavagem-cliente"
              className="input-t10"
              value={clienteId}
              onChange={(e) => {
                setClienteId(e.target.value);
                setVeiculoId("");
              }}
              required
            >
              <option value="">Selecione...</option>
              {[...clientes]
                .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="lavagem-veiculo"
              className="block text-base font-semibold text-foreground mb-1.5"
            >
              Veículo
            </label>
            <select
              id="lavagem-veiculo"
              className="input-t10"
              value={veiculoId}
              onChange={(e) => setVeiculoId(e.target.value)}
              required
              disabled={!clienteId}
            >
              <option value="">
                {clienteId
                  ? "Selecione o veículo..."
                  : "Selecione um cliente primeiro"}
              </option>
              {veiculosCliente.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.modelo} — {v.placa}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="lavagem-tipo"
              className="block text-base font-semibold text-foreground mb-1.5"
            >
              Tipo de Lavagem
            </label>
            <select
              id="lavagem-tipo"
              className="input-t10"
              value={tipoId}
              onChange={(e) => handleTipoChange(e.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {tiposLavagem.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome} — R$ {t.preco.toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="lavagem-valor"
                className="block text-base font-semibold text-foreground mb-1.5"
              >
                Valor (R$)
              </label>
              <input
                id="lavagem-valor"
                className="input-t10"
                type="number"
                step="0.01"
                min="0"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                required
              />
            </div>

            <div>
              <label
                htmlFor="lavagem-status"
                className="block text-base font-semibold text-foreground mb-1.5"
              >
                Status
              </label>
              <select
                id="lavagem-status"
                className="input-t10"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="pendente">Pendente</option>
                <option value="em_progresso">Em Progresso</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="lavagem-pagamento"
              className="block text-base font-semibold text-foreground mb-1.5"
            >
              Forma de Pagamento
            </label>
            <select
              id="lavagem-pagamento"
              className="input-t10"
              value={pagamento}
              onChange={(e) => setPagamento(e.target.value)}
            >
              <option value="Dinheiro">Dinheiro</option>
              <option value="PIX">PIX</option>
              <option value="Débito">Cartão Débito</option>
              <option value="Crédito">Cartão Crédito</option>
              <option value="Pendente">Pendente</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="lavagem-obs"
              className="block text-base font-semibold text-foreground mb-1.5"
            >
              Observações
            </label>
            <textarea
              id="lavagem-obs"
              className="input-t10 min-h-[80px] resize-y"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Opcional..."
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-secondary text-secondary-foreground font-bold h-12 rounded-lg hover:bg-secondary/80 transition-all text-base"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="flex-1 bg-primary text-primary-foreground font-bold h-12 rounded-lg hover:brightness-110 transition-all text-base disabled:opacity-50"
            >
              {salvando
                ? "Salvando..."
                : lavagemId
                  ? "Atualizar Lavagem"
                  : "Registrar Lavagem"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
