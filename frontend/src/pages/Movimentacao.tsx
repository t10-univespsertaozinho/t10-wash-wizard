import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

export default function Movimentacao() {
  const { produtos, movimentacoes, addMovimentacao, getProduto } = useApp();
  const [produtoId, setProdutoId] = useState('');
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada');
  const [quantidade, setQuantidade] = useState('');
  const [obs, setObs] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!produtoId || !quantidade) return;
    addMovimentacao({ produto_id: produtoId, tipo, quantidade: parseInt(quantidade) || 0, observacao: obs.trim() });
    setQuantidade(''); setObs('');
  };

  const sorted = [...movimentacoes].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 20);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-6 space-y-5 animate-fade-up h-fit">
        <h2 className="font-barlow-condensed font-bold text-lg text-foreground">Nova Movimentação</h2>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Produto</label>
          <select className="input-t10" value={produtoId} onChange={e => setProdutoId(e.target.value)} required>
            <option value="">Selecione...</option>
            {produtos.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.quantidade} {p.unidade})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Tipo</label>
          <div className="flex gap-3">
            <button type="button" onClick={() => setTipo('entrada')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${tipo === 'entrada' ? 'bg-success/15 text-success border border-success/30' : 'bg-secondary text-secondary-foreground'}`}>
              Entrada
            </button>
            <button type="button" onClick={() => setTipo('saida')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${tipo === 'saida' ? 'bg-destructive/15 text-destructive border border-destructive/30' : 'bg-secondary text-secondary-foreground'}`}>
              Saída
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Quantidade</label>
          <input className="input-t10" type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Observação</label>
          <textarea className="input-t10 min-h-[70px] resize-y" value={obs} onChange={e => setObs(e.target.value)} placeholder="Opcional..." />
        </div>
        <button type="submit" className="w-full bg-primary text-primary-foreground font-bold py-2.5 rounded-lg hover:brightness-110 transition-all text-sm">Registrar</button>
      </form>

      <div className="bg-card rounded-xl border border-border overflow-hidden animate-fade-up" style={{ animationDelay: '100ms' }}>
        <div className="p-4 border-b border-border">
          <h2 className="font-barlow-condensed font-bold text-foreground">Histórico</h2>
        </div>
        <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
          {sorted.map(m => {
            const p = getProduto(m.produto_id);
            return (
              <div key={m.id} className="flex items-center gap-3 p-3 table-row-hover">
                {m.tipo === 'entrada'
                  ? <ArrowDownCircle size={18} className="text-success flex-shrink-0" />
                  : <ArrowUpCircle size={18} className="text-destructive flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{p?.nome || '—'}</p>
                  <p className="text-xs text-muted-foreground">{m.observacao || 'Sem observação'}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${m.tipo === 'entrada' ? 'text-success' : 'text-destructive'}`}>
                    {m.tipo === 'entrada' ? '+' : '-'}{m.quantidade}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{new Date(m.data).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            );
          })}
          {sorted.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma movimentação.</p>}
        </div>
      </div>
    </div>
  );
}
