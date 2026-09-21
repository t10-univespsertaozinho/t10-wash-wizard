import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';

export default function NovaLavagem() {
  const { clientes, getVeiculosCliente, tiposLavagem, addLavagem } = useApp();
  const navigate = useNavigate();

  const [clienteId, setClienteId] = useState('');
  const [veiculoId, setVeiculoId] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [valor, setValor] = useState('');
  const [pagamento, setPagamento] = useState('Dinheiro');
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');

  const veiculosCliente = clienteId ? getVeiculosCliente(clienteId) : [];

  const handleTipoChange = (id: string) => {
    setTipoId(id);
    const t = tiposLavagem.find(x => x.id === id);
    if (t) setValor(t.preco.toFixed(2));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!clienteId || !veiculoId || !tipoId) return;

    const valorNum = parseFloat(valor);
    if (!Number.isFinite(valorNum) || valorNum < 0) {
      setErro('O valor deve ser um número maior ou igual a zero.');
      return;
    }

    addLavagem({
      cliente_id: clienteId,
      veiculo_id: veiculoId,
      tipo_lavagem_id: tipoId,
      status: 'pendente',
      pagamento,
      valor: valorNum,
      observacao: obs,
    });
    navigate('/lavagens');
  };

  return (
    <div className="max-w-lg mx-auto">
      <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-6 space-y-5 animate-fade-up">
        <h2 className="font-barlow-condensed font-bold text-lg text-foreground">Registrar Lavagem</h2>
        {erro && (
          <div className="badge-cancelada text-sm rounded-lg px-4 py-2 text-center">{erro}</div>
        )}
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Cliente</label>
          <select className="input-t10" value={clienteId} onChange={e => { setClienteId(e.target.value); setVeiculoId(''); }} required>
            <option value="">Selecione...</option>
            {[...clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Veículo</label>
          <select className="input-t10" value={veiculoId} onChange={e => setVeiculoId(e.target.value)} required disabled={!clienteId}>
            <option value="">{clienteId ? 'Selecione o veículo...' : 'Selecione um cliente primeiro'}</option>
            {veiculosCliente.map(v => <option key={v.id} value={v.id}>{v.modelo} — {v.placa}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Tipo de Lavagem</label>
          <select className="input-t10" value={tipoId} onChange={e => handleTipoChange(e.target.value)} required>
            <option value="">Selecione...</option>
            {tiposLavagem.map(t => <option key={t.id} value={t.id}>{t.nome} — R$ {t.preco.toFixed(2)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Valor (R$)</label>
          <input className="input-t10" type="number" step="0.01" min="0" value={valor} onChange={e => setValor(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Forma de Pagamento</label>
          <select className="input-t10" value={pagamento} onChange={e => setPagamento(e.target.value)}>
            <option>Dinheiro</option>
            <option>PIX</option>
            <option>Cartão Débito</option>
            <option>Cartão Crédito</option>
            <option>Pendente</option>
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Observações</label>
          <textarea className="input-t10 min-h-[80px] resize-y" value={obs} onChange={e => setObs(e.target.value)} placeholder="Opcional..." />
        </div>
        <button type="submit" className="w-full bg-primary text-primary-foreground font-bold py-2.5 rounded-lg hover:brightness-110 transition-all text-sm">
          Registrar Lavagem
        </button>
      </form>
    </div>
  );
}
