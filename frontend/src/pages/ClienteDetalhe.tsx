import { useParams } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import { Trash2, Plus, Car, Pencil } from 'lucide-react';
import { ConfirmDialogButton } from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { formatarData, formatarMoeda } from '@/utils/format';

const mensagemErro = (err: unknown) =>
  err instanceof Error ? err.message : 'Erro desconhecido';

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { getCliente, getVeiculosCliente, getLavagensCliente, getTipoLavagem, deleteVeiculo, veiculos } = useApp();
  const { openNovoVeiculo } = useModal();
  // Exclusão passou a exigir admin no backend (FA-03): mostrar o botão para
  // operador só renderia um 403 garantido.
  const { user } = useAuth();
  const podeExcluir = user?.role === 'admin';

  const cliente = getCliente(id!);
  if (!cliente) return <p className="text-secondary-foreground">Cliente não encontrado.</p>;

  const veiculosCliente = getVeiculosCliente(id!);
  const lavagensCliente = getLavagensCliente(id!).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 10);

  const handleDeleteVeiculo = async (veiculoId: string, descricao: string) => {
    try {
      await deleteVeiculo(veiculoId);
      toast.success(`Veículo ${descricao} excluído.`);
    } catch (err) {
      toast.error(`Não foi possível excluir o veículo: ${mensagemErro(err)}`);
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { pendente: 'badge-pendente', em_progresso: 'badge-andamento', concluida: 'badge-concluida', cancelada: 'badge-cancelada' };
    const labels: Record<string, string> = { pendente: 'Pendente', em_progresso: 'Em progresso', concluida: 'Concluída', cancelada: 'Cancelada' };
    return <span className={`text-sm px-3 py-1 rounded-md font-semibold border ${map[s] || ''}`}>{labels[s] || s}</span>;
  };

  const colors = ['badge-andamento', 'badge-pendente', 'badge-concluida', 'badge-info'];
  const ci = cliente.nome.charCodeAt(0) % colors.length;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="bg-card rounded-xl border border-border p-6 flex items-center gap-5">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${colors[ci]}`}>
          {cliente.nome[0]?.toUpperCase()}
        </div>
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">{cliente.nome}</h2>
          <p className="text-base font-medium text-muted-foreground">{cliente.telefone}</p>
          <p className="text-base font-medium text-muted-foreground mt-1">Cadastro: {formatarData(cliente.created_at)}</p>
        </div>
        <div className="ml-auto flex gap-6 text-center">
          <div>
            <p className="text-2xl font-barlow-condensed font-bold text-primary">{lavagensCliente.length}</p>
            <p className="text-sm font-semibold uppercase tracking-wider text-secondary-foreground">Lavagens</p>
          </div>
          <div>
            <p className="text-2xl font-barlow-condensed font-bold text-accent-text">{veiculosCliente.length}</p>
            <p className="text-sm font-semibold uppercase tracking-wider text-secondary-foreground">Veículos</p>
          </div>
        </div>
      </div>

      {/* Veículos */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-barlow-condensed font-bold text-foreground flex items-center gap-2"><Car size={18} /> Veículos</h3>
          <button
            type="button"
            onClick={() => openNovoVeiculo(cliente.id)}
            className="text-base font-bold bg-primary/10 text-primary h-12 px-6 rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-1"
          >
            <Plus size={18} /> Adicionar
          </button>
        </div>

        {/* WCAG 2.1.1 / 1.4.10 - regiao rolavel por teclado, com rotulo para leitores de tela */}
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela de veículos do cliente">
          <table className="w-full text-sm">
            <caption className="sr-only">Veículos do cliente, com modelo, placa, cor e ações</caption>
            <thead><tr className="table-header"><th scope="col" className="text-left py-4 px-4">Modelo</th><th scope="col" className="text-left py-4 px-4">Placa</th><th scope="col" className="text-left py-4 px-4">Cor</th><th scope="col" className="py-4 px-4"><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {veiculosCliente.map(v => (
                <tr key={v.id} className="table-row-hover border-t border-border">
                  <td className="py-4 px-4 text-base font-medium text-foreground">{v.modelo}</td>
                  <td className="py-4 px-4 font-mono text-sm font-medium text-muted-foreground">{v.placa}</td>
                  <td className="py-4 px-4 text-sm font-medium text-muted-foreground">{v.cor}</td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openNovoVeiculo(cliente.id, v.id)}
                        aria-label={`Editar veículo ${v.modelo}, placa ${v.placa}`}
                        title="Editar"
                        className="text-secondary-foreground hover:text-primary transition-colors p-1"
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      {podeExcluir && (
                        <ConfirmDialogButton
                          title="Excluir Veículo"
                          ariaLabel={`Excluir veículo ${v.modelo}, placa ${v.placa}`}
                          description={`Tem certeza que deseja excluir o veículo "${v.modelo}"? Esta ação não pode ser desfeita.`}
                          onConfirm={() => handleDeleteVeiculo(v.id, v.placa)}
                          icon={<Trash2 size={14} />}
                          variant="ghost"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {veiculosCliente.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground text-sm">Nenhum veículo cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Histórico */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-barlow-condensed font-bold text-foreground mb-4">Histórico de Lavagens</h3>
        {/* WCAG 2.1.1 / 1.4.10 - regiao rolavel por teclado, com rotulo para leitores de tela */}
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela de histórico de lavagens do cliente">
          <table className="w-full text-sm">
            <caption className="sr-only">Histórico de lavagens do cliente, com data, veículo, tipo, valor e status</caption>
            <thead><tr className="table-header"><th scope="col" className="text-left py-4 px-4">Data</th><th scope="col" className="text-left py-4 px-4">Veículo</th><th scope="col" className="text-left py-4 px-4">Tipo</th><th scope="col" className="text-right py-4 px-4">Valor</th><th scope="col" className="text-center py-4 px-4">Status</th></tr></thead>
            <tbody>
              {lavagensCliente.map(l => {
                const v = veiculos.find(x => x.id === l.veiculo_id);
                const t = getTipoLavagem(l.tipo_lavagem_id);
                return (
                  <tr key={l.id} className="table-row-hover border-t border-border">
                    <td className="py-4 px-4 text-sm font-medium text-muted-foreground">{formatarData(l.data)}</td>
                    <td className="py-4 px-4 text-base">{v?.modelo || '—'}</td>
                    <td className="py-4 px-4 text-base">{t?.nome || '—'}</td>
                    <td className="py-4 px-4 text-right text-base text-primary font-semibold">{formatarMoeda(l.valor)}</td>
                    <td className="py-4 px-4 text-center">{statusBadge(l.status)}</td>
                  </tr>
                );
              })}
              {lavagensCliente.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground text-sm">Nenhuma lavagem registrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}