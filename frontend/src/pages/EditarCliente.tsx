import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';

export default function EditarCliente() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getCliente, updateCliente } = useApp();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [loading, setLoading] = useState(true);

  const cliente = getCliente(id!);

  useEffect(() => {
    if (cliente) {
      setNome(cliente.nome);
      setTelefone(cliente.telefone);
    }
    setLoading(false);
  }, [cliente]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !id) return;
    updateCliente(id, { nome: nome.trim(), telefone: telefone.trim() });
    navigate(`/clientes/${id}`);
  };

  if (!loading && !cliente) {
    return <p className="text-muted-foreground">Cliente não encontrado.</p>;
  }

  return (
    <div className="max-w-lg mx-auto">
      <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-6 space-y-5 animate-fade-up">
        <h2 className="font-barlow-condensed font-bold text-lg text-foreground">Editar Cliente</h2>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Nome Completo</label>
          <input className="input-t10" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do cliente" required />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Telefone / WhatsApp</label>
          <input className="input-t10" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(16) 99999-9999" />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(`/clientes/${id}`)} className="flex-1 bg-secondary text-secondary-foreground font-bold py-2.5 rounded-lg hover:brightness-110 transition-all text-sm">
            Cancelar
          </button>
          <button type="submit" className="flex-1 bg-primary text-primary-foreground font-bold py-2.5 rounded-lg hover:brightness-110 transition-all text-sm">
            Salvar Alterações
          </button>
        </div>
      </form>
    </div>
  );
}
