import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useTelefoneMask } from "@/hooks/useTelefoneMask";

export default function EditarCliente() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getCliente, updateCliente } = useApp();
  const [nome, setNome] = useState("");
  const [data_nascimento, setData] = useState("");
  const {
    value: telefone,
    setValue: setTelefone,
    handleChange: handleTelefoneChange,
  } = useTelefoneMask();
  const [loading, setLoading] = useState(true);

  const cliente = getCliente(id!);

  useEffect(() => {
    if (cliente) {
      setNome(cliente.nome);
      const numeros = cliente.telefone.replace(/\D/g, "");
      const formatted =
        numeros.length > 0
          ? numeros.length <= 2
            ? `(${numeros}`
            : numeros.length <= 7
              ? `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`
              : numeros.length <= 11
                ? `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`
                : `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7, 11)}`
          : "";
      setTelefone(formatted);
      setData(cliente.data_nascimento ?? "");
    }
    setLoading(false);
  }, [cliente, setTelefone]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !id) return;
    updateCliente(id, {
      nome: nome.trim(),
      telefone: telefone.trim(),
      data_nascimento: data_nascimento.trim() || null,
    });
    navigate(`/clientes/${id}`);
  };

  if (!loading && !cliente) {
    return <p className="text-secondary-foreground">Cliente não encontrado.</p>;
  }

  return (
    <div className="max-w-lg mx-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-card rounded-xl border border-border p-6 space-y-5 animate-fade-up"
      >
        <h2 className="font-barlow-condensed font-bold text-lg text-foreground">
          Editar Cliente
        </h2>
        <div>
          <label
            htmlFor="editar-cliente-nome"
            className="block text-base font-semibold text-foreground mb-1.5"
          >
            Nome Completo
          </label>
          <input
            id="editar-cliente-nome"
            className="input-t10"
            maxLength={60}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do cliente"
            required
          />
        </div>
        <div>
          <label
            htmlFor="editar-cliente-telefone"
            className="block text-base font-semibold text-foreground mb-1.5"
          >
            Telefone / WhatsApp
          </label>
          <input
            id="editar-cliente-telefone"
            className="input-t10"
            value={telefone}
            onChange={handleTelefoneChange}
            placeholder="(00) 90000-0000"
            maxLength={15}
          />
        </div>
        <div>
          <label
            htmlFor="editar-cliente-nascimento"
            className="block text-base font-semibold text-foreground mb-1.5"
          >
            Data de Nascimento
          </label>
          <input
            id="editar-cliente-nascimento"
            className="input-t10"
            value={data_nascimento}
            onChange={(e) => setData(e.target.value)}
            maxLength={10}
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(`/clientes/${id}`)}
            className="flex-1 bg-secondary text-secondary-foreground font-semibold h-12 rounded-lg hover:brightness-110 transition-all text-base"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 bg-primary text-primary-foreground font-bold h-12 rounded-lg hover:brightness-110 transition-all text-base"
          >
            Salvar Alterações
          </button>
        </div>
      </form>
    </div>
  );
}
