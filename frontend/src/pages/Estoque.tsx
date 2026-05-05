import { useApp } from '@/contexts/AppContext';
import { Link } from 'react-router-dom';
import { AlertTriangle, Trash2, Plus, ArrowLeftRight } from 'lucide-react';

export default function Estoque() {
  const { produtos, produtosBaixoEstoque, deleteProduto } = useApp();

  const statusBadge = (p: typeof produtos[0]) => {
    if (p.quantidade === 0) return <span className="badge-zerado text-xs px-2.5 py-0.5 rounded-full font-semibold">Zerado</span>;
    if (p.quantidade <= p.estoque_minimo) return <span className="badge-baixo text-xs px-2.5 py-0.5 rounded-full font-semibold">Baixo</span>;
    return <span className="badge-ok text-xs px-2.5 py-0.5 rounded-full font-semibold">OK</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Link to="/movimentacao" className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
          <ArrowLeftRight size={14} /> Movimentação
        </Link>
        <Link to="/novo-produto" className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:brightness-110 transition-all">
          <Plus size={14} /> Novo Produto
        </Link>
      </div>

      {produtosBaixoEstoque.length > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3 animate-fade-up">
          <AlertTriangle size={20} className="text-primary flex-shrink-0" />
          <p className="text-sm text-primary font-medium">
            {produtosBaixoEstoque.length} produto(s) com estoque baixo ou zerado
          </p>
        </div>
      )}
      <div className="bg-card rounded-xl border border-border overflow-x-auto animate-fade-up" style={{ animationDelay: '100ms' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="text-left py-3 px-4">Produto</th>
              <th className="text-left py-3 px-4">Categoria</th>
              <th className="text-center py-3 px-4">Quantidade</th>
              <th className="text-center py-3 px-4">Mínimo</th>
              <th className="text-right py-3 px-4">Preço Un.</th>
              <th className="text-center py-3 px-4">Status</th>
              <th className="text-right py-3 px-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {produtos.map(p => (
              <tr key={p.id} className="table-row-hover border-t border-border">
                <td className="py-3 px-4 font-medium text-foreground">{p.nome}</td>
                <td className="py-3 px-4 text-muted-foreground">{p.categoria}</td>
                <td className="py-3 px-4 text-center">{p.quantidade} {p.unidade}</td>
                <td className="py-3 px-4 text-center text-muted-foreground">{p.estoque_minimo}</td>
                <td className="py-3 px-4 text-right text-primary font-semibold">R$ {p.preco_unitario.toFixed(2)}</td>
                <td className="py-3 px-4 text-center">{statusBadge(p)}</td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => deleteProduto(p.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {produtos.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum produto cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
