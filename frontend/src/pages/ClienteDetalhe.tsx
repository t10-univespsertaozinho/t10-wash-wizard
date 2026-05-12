import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { useState } from 'react';
import { Trash2, Plus, Car, Pencil, X, Check } from 'lucide-react';
import { usePlacaMask } from '@/hooks/usePlacaMask';
import { ConfirmDialogButton } from '@/components/ConfirmDialog';

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getCliente, getVeiculosCliente, getLavagensCliente, getTipoLavagem, addVeiculo, updateVeiculo, deleteVeiculo, veiculos } = useApp();

  const [showForm, setShowForm] = useState(false);
  const [modelo, setModelo] = useState('');
  const { value: placa, handleChange: handlePlacaChange, setValue: setPlaca } = usePlacaMask();
  const [cor, setCor] = useState('');
  
  const [editandoVeiculoId, setEditandoVeiculoId] = useState<string | null>(null);
  const [editandoModelo, setEditandoModelo] = useState('');
  const [editandoPlaca, setEditandoPlaca] = useState('');
  const [editandoCor, setEditandoCor] = useState('');
  const { value: editPlacaValue, handleChange: handleEditPlacaChange, setValue: setEditPlacaValue } = usePlacaMask();

  const cliente = getCliente(id!);
  if (!cliente) return <p className="text-muted-foreground">Cliente não encontrado.</p>;

  const veiculosCliente = getVeiculosCliente(id!);
  const lavagensCliente = getLavagensCliente(id!).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 10);

  const handleAddVeiculo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelo.trim() || !placa.trim()) return;
    addVeiculo({ cliente_id: id!, modelo: modelo.trim(), placa: placa.trim(), cor: cor.trim() });
    setModelo(''); setPlaca(''); setCor(''); setShowForm(false);
  };

  const iniciarEdicaoVeiculo = (v: { id: string; modelo: string; placa: string; cor: string }) => {
    setEditandoVeiculoId(v.id);
    setEditandoModelo(v.modelo);
    setEditandoPlaca(v.placa);
    setEditandoCor(v.cor);
    setEditPlacaValue(v.placa);
  };

  const cancelarEdicaoVeiculo = () => {
    setEditandoVeiculoId(null);
    setEditandoModelo('');
    setEditandoPlaca('');
    setEditandoCor('');
  };

  const salvarEdicaoVeiculo = async () => {
    if (!editandoVeiculoId || !editandoModelo.trim() || !editandoPlaca.trim()) return;
    await updateVeiculo(editandoVeiculoId, { 
      modelo: editandoModelo.trim(), 
      placa: editandoPlaca.trim(), 
      cor: editandoCor.trim() 
    });
    cancelarEdicaoVeiculo();
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { pendente: 'badge-pendente', em_progresso: 'badge-andamento', concluida: 'badge-concluida', cancelada: 'badge-cancelada' };
    const labels: Record<string, string> = { pendente: 'Pendente', em_progresso: 'Em progresso', concluida: 'Concluída', cancelada: 'Cancelada' };
    return <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${map[s] || ''}`}>{labels[s] || s}</span>;
  };

  const colors = ['bg-primary/20 text-primary', 'bg-accent/20 text-accent', 'bg-success/20 text-success', 'bg-purple-500/20 text-purple-400'];
  const ci = cliente.nome.charCodeAt(0) % colors.length;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="bg-card rounded-xl border border-border p-6 flex items-center gap-5">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${colors[ci]}`}>
          {cliente.nome[0]?.toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-barlow-condensed font-bold text-foreground">{cliente.nome}</h2>
          <p className="text-sm text-muted-foreground">{cliente.telefone}</p>
          <p className="text-xs text-muted-foreground mt-1">Cadastro: {new Date(cliente.created_at).toLocaleDateString('pt-BR')}</p>
        </div>
        <div className="ml-auto flex gap-6 text-center">
          <div>
            <p className="text-2xl font-barlow-condensed font-bold text-primary">{lavagensCliente.length}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Lavagens</p>
          </div>
          <div>
            <p className="text-2xl font-barlow-condensed font-bold text-accent">{veiculosCliente.length}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Veículos</p>
          </div>
        </div>
      </div>

      {/* Veículos */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-barlow-condensed font-bold text-foreground flex items-center gap-2"><Car size={18} /> Veículos</h3>
          <button onClick={() => setShowForm(!showForm)} className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-semibold hover:bg-primary/20 transition-colors flex items-center gap-1">
            <Plus size={12} /> Adicionar
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAddVeiculo} className="grid grid-cols-3 gap-3 mb-4">
            <input className="input-t10" placeholder="Modelo" value={modelo} onChange={e => setModelo(e.target.value)} required />
            <input className="input-t10 uppercase font-mono" placeholder="ABC1D23 ou ABC1234" value={placa} onChange={handlePlacaChange} maxLength={8} required />
            <div className="flex gap-2">
              <input className="input-t10" placeholder="Cor" value={cor} onChange={e => setCor(e.target.value)} />
              <button type="submit" className="bg-primary text-primary-foreground px-4 rounded-lg font-bold text-sm hover:brightness-110 transition-all whitespace-nowrap">Salvar</button>
            </div>
          </form>
        )}

        <table className="w-full text-sm">
          <thead><tr className="table-header"><th className="text-left py-2 px-3">Modelo</th><th className="text-left py-2 px-3">Placa</th><th className="text-left py-2 px-3">Cor</th><th className="py-2 px-3"></th></tr></thead>
          <tbody>
            {veiculosCliente.map(v => (
              <tr key={v.id} className="table-row-hover border-t border-border">
                {editandoVeiculoId === v.id ? (
                  <>
                    <td className="py-2 px-3">
                      <input className="input-t10 text-sm py-1" value={editandoModelo} onChange={e => setEditandoModelo(e.target.value)} />
                    </td>
                    <td className="py-2 px-3">
                      <input className="input-t10 text-sm py-1 uppercase font-mono" value={editPlacaValue} onChange={handleEditPlacaChange} maxLength={8} />
                    </td>
                    <td className="py-2 px-3">
                      <input className="input-t10 text-sm py-1" value={editandoCor} onChange={e => setEditandoCor(e.target.value)} />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={salvarEdicaoVeiculo} className="text-success hover:bg-success/10 p-1 rounded"><Check size={14} /></button>
                        <button onClick={cancelarEdicaoVeiculo} className="text-muted-foreground hover:bg-secondary/60 p-1 rounded"><X size={14} /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 px-3 font-medium text-foreground">{v.modelo}</td>
                    <td className="py-2 px-3 font-mono text-primary text-xs">{v.placa}</td>
                    <td className="py-2 px-3 text-muted-foreground">{v.cor}</td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => iniciarEdicaoVeiculo(v)} className="text-muted-foreground hover:text-primary transition-colors p-1">
                          <Pencil size={14} />
                        </button>
                        <ConfirmDialogButton
                          title="Excluir Veículo"
                          description={`Tem certeza que deseja excluir o veículo "${v.modelo}"? Esta ação não pode ser desfeita.`}
                          onConfirm={() => deleteVeiculo(v.id)}
                          icon={<Trash2 size={14} />}
                          variant="ghost"
                        />
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {veiculosCliente.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground text-sm">Nenhum veículo cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Histórico */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-barlow-condensed font-bold text-foreground mb-4">Histórico de Lavagens</h3>
        <table className="w-full text-sm">
          <thead><tr className="table-header"><th className="text-left py-2 px-3">Data</th><th className="text-left py-2 px-3">Veículo</th><th className="text-left py-2 px-3">Tipo</th><th className="text-right py-2 px-3">Valor</th><th className="text-center py-2 px-3">Status</th></tr></thead>
          <tbody>
            {lavagensCliente.map(l => {
              const v = veiculos.find(x => x.id === l.veiculo_id);
              const t = getTipoLavagem(l.tipo_lavagem_id);
              return (
                <tr key={l.id} className="table-row-hover border-t border-border">
                  <td className="py-2 px-3 text-muted-foreground">{new Date(l.data).toLocaleDateString('pt-BR')}</td>
                  <td className="py-2 px-3">{v?.modelo || '—'}</td>
                  <td className="py-2 px-3">{t?.nome || '—'}</td>
                  <td className="py-2 px-3 text-right text-primary font-semibold">R$ {l.valor.toFixed(2)}</td>
                  <td className="py-2 px-3 text-center">{statusBadge(l.status)}</td>
                </tr>
              );
            })}
            {lavagensCliente.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground text-sm">Nenhuma lavagem registrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}