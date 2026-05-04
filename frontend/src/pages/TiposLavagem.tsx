import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Trash2 } from 'lucide-react';

export default function TiposLavagem() {
  const { tiposLavagem, addTipoLavagem, deleteTipoLavagem } = useApp();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [preco, setPreco] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    addTipoLavagem({ nome: nome.trim(), descricao: descricao.trim(), preco: parseFloat(preco) || 0 });
    setNome(''); setDescricao(''); setPreco('');
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-6 space-y-5 animate-fade-up h-fit">
        <h2 className="font-barlow-condensed font-bold text-lg text-foreground">Novo Tipo</h2>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Nome</label>
          <input className="input-t10" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Lavagem Premium" required />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Descrição</label>
          <input className="input-t10" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição do serviço" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Preço (R$)</label>
          <input className="input-t10" type="number" step="0.01" value={preco} onChange={e => setPreco(e.target.value)} placeholder="0.00" required />
        </div>
        <button type="submit" className="w-full bg-primary text-primary-foreground font-bold py-2.5 rounded-lg hover:brightness-110 transition-all text-sm">Cadastrar</button>
      </form>

      <div className="bg-card rounded-xl border border-border overflow-hidden animate-fade-up" style={{ animationDelay: '100ms' }}>
        <table className="w-full text-sm">
          <thead><tr className="table-header"><th className="text-left py-3 px-4">Nome</th><th className="text-left py-3 px-4">Descrição</th><th className="text-right py-3 px-4">Preço</th><th className="py-3 px-4"></th></tr></thead>
          <tbody>
            {tiposLavagem.map(t => (
              <tr key={t.id} className="table-row-hover border-t border-border">
                <td className="py-3 px-4 font-medium text-foreground">{t.nome}</td>
                <td className="py-3 px-4 text-muted-foreground">{t.descricao}</td>
                <td className="py-3 px-4 text-right text-primary font-bold">R$ {t.preco.toFixed(2)}</td>
                <td className="py-3 px-4 text-right">
                  <button onClick={() => deleteTipoLavagem(t.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
