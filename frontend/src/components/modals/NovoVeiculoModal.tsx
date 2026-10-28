import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { usePlacaMask } from "@/hooks/usePlacaMask";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface NovoVeiculoModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId?: string | null;
  veiculoId?: string | null;
}

export function NovoVeiculoModal({
  isOpen,
  onClose,
  clienteId,
  veiculoId,
}: NovoVeiculoModalProps) {
  const { clientes, veiculos, addVeiculo, updateVeiculo } = useApp();

  const [selectedClienteId, setSelectedClienteId] = useState("");
  const [modelo, setModelo] = useState("");
  const {
    value: placa,
    setValue: setPlaca,
    handleChange: handlePlacaChange,
  } = usePlacaMask();
  const [marca, setMarca] = useState("");
  const [cor, setCor] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    if (veiculoId) {
      const v = veiculos.find((item) => item.id === veiculoId);
      if (v) {
        setSelectedClienteId(v.cliente_id || "");
        setModelo(v.modelo || "");
        setPlaca(v.placa || "");
        setMarca(v.marca || "");
        setCor(v.cor || "");
      }
    } else {
      setSelectedClienteId(clienteId || "");
      setModelo("");
      setPlaca("");
      setMarca("");
      setCor("");
    }
    setErro("");
  }, [isOpen, veiculoId, clienteId, veiculos, setPlaca]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClienteId || !modelo.trim() || !placa.trim()) {
      setErro("Cliente, modelo e placa são obrigatórios.");
      return;
    }

    setLoading(true);
    setErro("");

    try {
      const payload = {
        cliente_id: selectedClienteId,
        modelo: modelo.trim(),
        placa: placa.trim().toUpperCase().replace("-", ""),
        marca: marca.trim(),
        cor: cor.trim(),
      };

      if (veiculoId) {
        await updateVeiculo(veiculoId, payload);
        toast.success("Veículo atualizado com sucesso.");
      } else {
        await addVeiculo(payload);
        toast.success("Veículo cadastrado com sucesso.");
      }

      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar veículo";
      setErro(msg);
      toast.error(msg);
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            {veiculoId ? "Editar Veículo" : "Cadastrar Veículo"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Preencha os dados do veículo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && <p className="text-destructive text-sm">{erro}</p>}

          <div>
            <label
              htmlFor="veiculo-cliente"
              className="block text-base font-semibold mb-1.5 text-foreground"
            >
              Cliente *
            </label>
            <select
              id="veiculo-cliente"
              className="input-t10"
              value={selectedClienteId}
              onChange={(e) => setSelectedClienteId(e.target.value)}
              required
              disabled={!!clienteId && !veiculoId}
            >
              <option value="">Selecione um cliente...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="veiculo-modelo"
                className="block text-base font-semibold mb-1.5 text-foreground"
              >
                Modelo *
              </label>
              <input
                id="veiculo-modelo"
                className="input-t10"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                placeholder="Ex: Corolla"
                required
              />
            </div>
            <div>
              <label
                htmlFor="veiculo-placa"
                className="block text-base font-semibold mb-1.5 text-foreground"
              >
                Placa *
              </label>
              <input
                id="veiculo-placa"
                className="input-t10 uppercase font-mono"
                value={placa}
                onChange={handlePlacaChange}
                placeholder="Placa do veículo"
                maxLength={8}
                aria-describedby="veiculo-placa-formato"
                required
              />
              <p id="veiculo-placa-formato" className="text-xs text-muted-foreground mt-1">
                Formato antigo ou Mercosul, sem hífen.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="veiculo-marca"
                className="block text-base font-semibold mb-1.5 text-foreground"
              >
                Marca
              </label>
              <input
                id="veiculo-marca"
                className="input-t10"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                placeholder="Ex: Toyota"
              />
            </div>
            <div>
              <label
                htmlFor="veiculo-cor"
                className="block text-base font-semibold mb-1.5 text-foreground"
              >
                Cor
              </label>
              <input
                id="veiculo-cor"
                className="input-t10"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                placeholder="Ex: Prata"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
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
              {loading ? "Salvando..." : "Salvar Veículo"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
