import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { Droplets, Calendar, DollarSign, Users, ChevronRight, Check, AlertTriangle, Shield, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();
  const { lavagens, clientes, produtos, produtosBaixoEstoque, getCliente, getTipoLavagem, updateLavagemStatus, veiculos, seedTestData } = useApp();

  const hoje = new Date().toISOString().slice(0, 10);
  const mesAtual = new Date().toISOString().slice(0, 7);

  const lavagensHoje = lavagens.filter(l => l.data.slice(0, 10) === hoje);
  const lavagensMes = lavagens.filter(l => l.data.slice(0, 7) === mesAtual);
  const receitaHoje = lavagensHoje.filter(l => l.status === 'concluida').reduce((s, l) => s + l.valor, 0);
  const pendentes = lavagens.filter(l => l.status === 'pendente');

  // Last 7 days chart data
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const dayLavagens = lavagens.filter(l => l.data.slice(0, 10) === key);
    return {
      dia: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
      receita: dayLavagens.filter(l => l.status === 'concluida').reduce((s, l) => s + l.valor, 0),
      lavagens: dayLavagens.length,
    };
  });

  const recentClientes = [...clientes].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  const stats = [
    { label: 'Lavagens Hoje', value: lavagensHoje.length, icon: Droplets, border: 'border-primary' },
    { label: 'Lavagens no Mês', value: lavagensMes.length, icon: Calendar, border: 'border-accent' },
    { label: 'Receita Hoje', value: `R$ ${receitaHoje.toFixed(2)}`, icon: DollarSign, border: 'border-success' },
    { label: 'Total Clientes', value: clientes.length, icon: Users, border: 'border-purple-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-barlow-condensed font-bold text-2xl text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {user?.role === 'admin' ? <Shield size={14} className="text-accent" /> : <User size={14} />}
            Perfil: <span className="font-semibold text-foreground capitalize">{user?.role}</span> ({user?.nome})
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {user?.role === 'admin' && (
            <button 
              onClick={() => {
                if (confirm('Deseja carregar dados de teste? Isso irá substituir os dados atuais.')) {
                  seedTestData();
                }
              }}
              className="bg-accent/10 text-accent hover:bg-accent/20 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 border border-accent/20"
            >
              <Droplets size={16} /> Carregar Dados
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={s.label} className={`bg-card rounded-xl border-l-4 ${s.border} p-4 animate-fade-up`} style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{s.label}</p>
                <p className="text-2xl font-barlow-condensed font-bold text-foreground mt-1">{s.value}</p>
              </div>
              <s.icon className="text-muted-foreground" size={22} />
            </div>
          </div>
        ))}
      </div>

      {/* Chart + Low Stock */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5 animate-fade-up" style={{ animationDelay: '320ms' }}>
          <h2 className="font-barlow-condensed font-bold text-foreground mb-4">Últimos 7 dias</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={last7}>
                <XAxis dataKey="dia" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#fff', fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="receita" fill="hsl(49,100%,50%)" radius={[4, 4, 0, 0]} name="Receita (R$)" />
                <Line yAxisId="right" type="monotone" dataKey="lavagens" stroke="hsl(212,80%,42%)" strokeWidth={2} dot={{ fill: 'hsl(212,80%,42%)' }} name="Lavagens" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 animate-fade-up" style={{ animationDelay: '400ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-primary" />
            <h2 className="font-barlow-condensed font-bold text-foreground">Estoque Baixo</h2>
          </div>
          {produtosBaixoEstoque.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todos os produtos estão OK.</p>
          ) : (
            <div className="space-y-2">
              {produtosBaixoEstoque.map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{p.nome}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.quantidade === 0 ? 'badge-zerado' : 'badge-baixo'}`}>
                    {p.quantidade} {p.unidade}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending + Recent Clients */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-5 animate-fade-up" style={{ animationDelay: '480ms' }}>
          <h2 className="font-barlow-condensed font-bold text-foreground mb-4">Lavagens Pendentes</h2>
          {pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma lavagem pendente.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="table-header"><th className="text-left py-2 px-3">Cliente</th><th className="text-left py-2 px-3">Veículo</th><th className="text-left py-2 px-3">Tipo</th><th className="text-right py-2 px-3">Valor</th><th className="py-2 px-3"></th></tr></thead>
                <tbody>
                  {pendentes.slice(0, 5).map(l => {
                    const c = getCliente(l.cliente_id);
                    const v = veiculos.find(x => x.id === l.veiculo_id);
                    const t = getTipoLavagem(l.tipo_lavagem_id);
                    return (
                      <tr key={l.id} className="table-row-hover border-t border-border">
                        <td className="py-2 px-3">{c?.nome || '—'}</td>
                        <td className="py-2 px-3">{v?.modelo || '—'}</td>
                        <td className="py-2 px-3">{t?.nome || '—'}</td>
                        <td className="py-2 px-3 text-right text-primary font-semibold">R$ {l.valor.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right">
                          <button onClick={() => updateLavagemStatus(l.id, 'concluida')} className="bg-success/10 text-success text-xs px-3 py-1 rounded-full font-semibold hover:bg-success/20 transition-colors inline-flex items-center gap-1">
                            <Check size={12} /> Concluir
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-5 animate-fade-up" style={{ animationDelay: '560ms' }}>
          <h2 className="font-barlow-condensed font-bold text-foreground mb-4">Clientes Recentes</h2>
          {recentClientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {recentClientes.map(c => {
                const colors = ['bg-primary/20 text-primary', 'bg-accent/20 text-accent', 'bg-success/20 text-success', 'bg-purple-500/20 text-purple-400', 'bg-destructive/20 text-destructive'];
                const ci = c.nome.charCodeAt(0) % colors.length;
                return (
                  <Link key={c.id} to={`/clientes/${c.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/40 transition-colors">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${colors[ci]}`}>
                      {c.nome[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.nome}</p>
                      <p className="text-xs text-muted-foreground">{c.telefone}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
