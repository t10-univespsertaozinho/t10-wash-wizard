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
          <label htmlFor="tipo-nome" className="block text-base font-semibold text-foreground mb-1.5">Nome</label>
          <input id="tipo-nome" className="input-t10" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Lavagem Premium" required />
        </div>
        <div>
          <label htmlFor="tipo-descricao" className="block text-base font-semibold text-foreground mb-1.5">Descrição</label>
          <input id="tipo-descricao" className="input-t10" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição do serviço" />
        </div>
        <div>
          <label htmlFor="tipo-preco" className="block text-base font-semibold text-foreground mb-1.5">Preço (R$)</label>
          <input id="tipo-preco" className="input-t10" type="number" step="0.01" value={preco} onChange={e => setPreco(e.target.value)} placeholder="0.00" required />
        </div>
        <button type="submit" className="w-full bg-primary text-primary-foreground font-bold h-12 rounded-lg hover:brightness-110 transition-all text-base">Cadastrar</button>
      </form>

      <div
        className="bg-card rounded-xl border border-border overflow-x-auto animate-fade-up"
        style={{ animationDelay: '100ms' }}
        tabIndex={0}
        role="region"
        aria-label="Tabela de tipos de lavagem"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">Tipos de lavagem cadastrados, com nome, descrição e preço</caption>
          <thead><tr className="table-header"><th scope="col" className="text-left py-4 px-4">Nome</th><th scope="col" className="text-left py-4 px-4">Descrição</th><th scope="col" className="text-right py-4 px-4">Preço</th><th scope="col" className="py-4 px-4"><span className="sr-only">Ações</span></th></tr></thead>
          <tbody>
            {tiposLavagem.map(t => (
              <tr key={t.id} className="table-row-hover border-t border-border">
                <td className="py-4 px-4 text-base font-medium text-foreground">{t.nome}</td>
                <td className="py-4 px-4 text-sm font-medium text-muted-foreground">{t.descricao}</td>
                <td className="py-4 px-4 text-right text-base text-primary font-bold">R$ {t.preco.toFixed(2)}</td>
                <td className="py-4 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => deleteTipoLavagem(t.id)}
                    aria-label={`Excluir tipo de lavagem ${t.nome}`}
                    title="Excluir"
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-secondary-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
