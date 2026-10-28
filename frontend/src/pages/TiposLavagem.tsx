import { useApp } from '@/contexts/AppContext';
import { useModal } from '@/contexts/ModalContext';
import { Pencil, Plus, Trash2 } from 'lucide-react';

export default function TiposLavagem() {
  const { tiposLavagem, deleteTipoLavagem } = useApp();
  const { openNovoServico } = useModal();

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h3 className="font-barlow-condensed font-bold text-foreground">Catálogo de Serviços</h3>
          <button
            type="button"
            onClick={() => openNovoServico()}
            className="text-base bg-primary text-primary-foreground h-12 px-6 rounded-lg font-bold hover:brightness-110 transition-all flex items-center gap-1"
          >
            <Plus size={18} /> Novo Serviço
          </button>
        </div>

        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Tabela de tipos de lavagem"
        >
          <table className="w-full text-sm">
            <caption className="sr-only">Tipos de lavagem cadastrados, com nome, descrição, preço e ações</caption>
            <thead><tr className="table-header"><th scope="col" className="text-left py-4 px-4">Nome</th><th scope="col" className="text-left py-4 px-4">Descrição</th><th scope="col" className="text-right py-4 px-4">Preço</th><th scope="col" className="py-4 px-4"><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {tiposLavagem.map(t => (
                <tr key={t.id} className="table-row-hover border-t border-border">
                  <td className="py-4 px-4 text-base font-medium text-foreground">{t.nome}</td>
                  <td className="py-4 px-4 text-sm font-medium text-muted-foreground">{t.descricao}</td>
                  <td className="py-4 px-4 text-right text-base text-primary font-bold">R$ {t.preco.toFixed(2)}</td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openNovoServico(t.id)}
                        aria-label={`Editar tipo de lavagem ${t.nome}`}
                        title="Editar"
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-secondary-foreground hover:text-primary transition-colors"
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTipoLavagem(t.id)}
                        aria-label={`Excluir tipo de lavagem ${t.nome}`}
                        title="Excluir"
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-secondary-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {tiposLavagem.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground text-sm">Nenhum serviço cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
