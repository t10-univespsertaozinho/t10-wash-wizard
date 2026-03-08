import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';

export default function NovoCliente() {
  const { addCliente } = useApp();
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    const c = addCliente({ nome: nome.trim(), telefone: telefone.trim() });
    navigate(`/clientes/${c.id}`);
  };

  return (
    <div className="max-w-lg mx-auto">
      <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-6 space-y-5 animate-fade-up">
        <h2 className="font-barlow-condensed font-bold text-lg text-foreground">Cadastrar Cliente</h2>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Nome Completo</label>
          <input className="input-t10" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do cliente" required />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Telefone / WhatsApp</label>
          <input className="input-t10" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(16) 99999-9999" />
        </div>
        <button type="submit" className="w-full bg-primary text-primary-foreground font-bold py-2.5 rounded-lg hover:brightness-110 transition-all text-sm">
          Salvar Cliente
        </button>
      </form>
    </div>
  );
}
