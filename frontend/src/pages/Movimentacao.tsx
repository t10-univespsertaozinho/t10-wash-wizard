import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function Movimentacao() {
  const { produtos, movimentacoes, getProduto, addMovimentacao } = useApp();
  const [produtoId, setProdutoId] = useState('');
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada');
  const [quantidade, setQuantidade] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!produtoId || !quantidade) return;

    const produto = produtos.find(p => p.id === produtoId);
    const qtd = parseInt(quantidade);

    if (tipo === 'saida' && produto && qtd > produto.quantidade) {
      toast.error(`Estoque insuficiente. Disponível: ${produto.quantidade} ${produto.unidade}`);
      return;
    }

    const estoqueMinimo = produto?.estoque_minimo || 5;
    const novoEstoque = tipo === 'entrada' 
      ? (produto?.quantidade || 0) + qtd 
      : (produto?.quantidade || 0) - qtd;

    setLoading(true);
    try {
      await addMovimentacao({ produto_id: produtoId, tipo, quantidade: qtd, observacao: '' });
      
      if (novoEstoque <= estoqueMinimo && tipo === 'saida') {
        toast.warning(`⚠️ Estoque baixo: ${produto?.nome} agora tem ${novoEstoque} ${produto?.unidade}`);
      } else {
        toast.success(`${tipo === 'entrada' ? 'Entrada' : 'Saída'} registrada: ${qtd} ${produto?.unidade}. Novo estoque: ${novoEstoque}`);
      }
      
      setQuantidade('');
      setProdutoId('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar');
    } finally {
      setLoading(false);
    }
  };

  const produtosOrdenados = [...produtos].sort((a, b) => {
    const aBaixo = a.quantidade <= a.estoque_minimo;
    const bBaixo = b.quantidade <= b.estoque_minimo;
    if (aBaixo && !bBaixo) return -1;
    if (!aBaixo && bBaixo) return 1;
    return a.nome.localeCompare(b.nome);
  });

  const sorted = [...movimentacoes].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 15);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-6 space-y-4 animate-fade-up h-fit">
        <h2 className="font-barlow-condensed font-bold text-lg text-foreground">Nova Movimentação</h2>
        
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Produto</label>
          <select className="input-t10" value={produtoId} onChange={e => setProdutoId(e.target.value)} required>
            <option value="">Selecione...</option>
            {produtosOrdenados.map(p => {
              const baixo = p.quantidade <= p.estoque_minimo;
              return (
                <option key={p.id} value={p.id}>
                  {p.nome} - {p.quantidade} {p.unidade} {baixo ? '⚠️' : ''}
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Tipo</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setTipo('entrada')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${tipo === 'entrada' ? 'bg-success text-white' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
              <ArrowDownCircle size={18} /> Entrada
            </button>
            <button type="button" onClick={() => setTipo('saida')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${tipo === 'saida' ? 'bg-destructive text-white' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
              <ArrowUpCircle size={18} /> Saída
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Quantidade</label>
          <input className="input-t10" type="number" min="1" value={quantidade} onChange={e => setQuantidade(e.target.value)} required />
        </div>

        <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground font-bold py-2.5 rounded-lg hover:brightness-110 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'Registrando...' : 'Registrar'}
        </button>
      </form>

      <div className="bg-card rounded-xl border border-border overflow-hidden animate-fade-up" style={{ animationDelay: '100ms' }}>
        <div className="p-4 border-b border-border">
          <h2 className="font-barlow-condensed font-bold text-foreground">Histórico Recente</h2>
        </div>
        <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
          {sorted.map(m => {
            const p = getProduto(m.produto_id);
            return (
              <div key={m.id} className="flex items-center gap-3 p-3 hover:bg-secondary/30 transition-colors">
                {m.tipo === 'entrada'
                  ? <ArrowDownCircle size={18} className="text-success flex-shrink-0" />
                  : <ArrowUpCircle size={18} className="text-destructive flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{p?.nome || '—'}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(m.data).toLocaleDateString('pt-BR')} às {new Date(m.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${m.tipo === 'entrada' ? 'text-success' : 'text-destructive'}`}>
                    {m.tipo === 'entrada' ? '+' : '-'}{m.quantidade}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{p?.unidade}</p>
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