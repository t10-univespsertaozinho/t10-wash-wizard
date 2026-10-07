import { useApp } from '@/contexts/AppContext';
import { Link } from 'react-router-dom';
import { AlertTriangle, Trash2, Plus, ArrowLeftRight } from 'lucide-react';
import { ConfirmDialogButton } from '@/components/ConfirmDialog';

export default function Estoque() {
  const { produtos, produtosBaixoEstoque, deleteProduto } = useApp();

  const statusBadge = (p: typeof produtos[0]) => {
    if (p.quantidade === 0) return <span className="badge-zerado text-sm px-3 py-1 rounded-md font-semibold">Zerado</span>;
    if (p.quantidade <= p.estoque_minimo) return <span className="badge-baixo text-sm px-3 py-1 rounded-md font-semibold">Baixo</span>;
    return <span className="badge-ok text-sm px-3 py-1 rounded-md font-semibold">OK</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Link to="/movimentacao" className="flex items-center gap-1.5 text-base font-bold h-12 px-6 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
          <ArrowLeftRight size={18} /> Movimentação
        </Link>
        <Link to="/novo-produto" className="flex items-center gap-1.5 text-base font-bold h-12 px-6 rounded-lg bg-primary text-primary-foreground hover:brightness-110 transition-all">
          <Plus size={18} /> Novo Produto
        </Link>
      </div>

      {produtosBaixoEstoque.length > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3 animate-fade-up">
          <AlertTriangle size={20} aria-hidden="true" className="text-primary flex-shrink-0" />
          <p className="text-sm text-primary font-medium">
            {produtosBaixoEstoque.length} produto(s) com estoque baixo ou zerado
          </p>
        </div>
      )}
      <div
        className="bg-card rounded-xl border border-border overflow-x-auto animate-fade-up"
        style={{ animationDelay: '100ms' }}
        tabIndex={0}
        role="region"
        aria-label="Tabela de produtos em estoque"
      >
        <table className="w-full text-sm">
                <caption className="sr-only">Produtos em estoque, com produto, categoria, quantidade, mínimo, preço unitário, status e ações</caption>
          <thead>
            <tr className="table-header">
              <th scope="col" className="text-left py-4 px-4">Produto</th>
              <th scope="col" className="text-left py-4 px-4">Categoria</th>
              <th scope="col" className="text-center py-4 px-4">Quantidade</th>
              <th scope="col" className="text-center py-4 px-4">Mínimo</th>
              <th scope="col" className="text-right py-4 px-4">Preço Un.</th>
              <th scope="col" className="text-center py-4 px-4">Status</th>
              <th scope="col" className="text-right py-4 px-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {produtos.map(p => (
              <tr key={p.id} className="table-row-hover border-t border-border">
                <td className="py-4 px-4 text-base font-medium text-foreground">{p.nome}</td>
                <td className="py-4 px-4 text-sm font-medium text-secondary-foreground">{p.categoria}</td>
                <td className="py-4 px-4 text-center text-base">{p.quantidade} {p.unidade}</td>
                <td className="py-4 px-4 text-center text-sm font-medium text-secondary-foreground">{p.estoque_minimo}</td>
                <td className="py-4 px-4 text-right text-base text-primary font-semibold">R$ {p.preco_unitario.toFixed(2)}</td>
                <td className="py-4 px-4 text-center">{statusBadge(p)}</td>
                <td className="py-4 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <ConfirmDialogButton
                      title="Excluir Produto"
                      ariaLabel={`Excluir produto ${p.nome}`}
                      description={`Tem certeza que deseja excluir o produto "${p.nome}"?`}
                      onConfirm={() => deleteProduto(p.id)}
                      icon={<Trash2 size={15} />}
                      variant="ghost"
                    />
                  </div>
                </td>
              </tr>
            ))}
            {produtos.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-secondary-foreground">Nenhum produto cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
