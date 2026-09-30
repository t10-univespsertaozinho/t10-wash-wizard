import { useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCssTokens, toHsl } from '@/hooks/useThemeTokens';
import { Droplets, Calendar, DollarSign, Users, ChevronRight, Check, AlertTriangle, Shield, User, TrendingUp, Package, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, ComposedChart, Legend } from 'recharts';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const TOKENS = [
  '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6',
  '--card', '--foreground', '--muted-foreground', '--border',
] as const;

export default function Dashboard() {
  const { user } = useAuth();
  const { lavagens, clientes, produtosBaixoEstoque, getCliente, getTipoLavagem, updateLavagemStatus, veiculos, seedTestData, tiposLavagem } = useApp();
  const tokens = useCssTokens(TOKENS);

  const chartColors = useMemo(() => TOKENS.slice(0, 6).map(name => toHsl(tokens[name])), [tokens]);

  const tooltipStyle = useMemo(() => ({
    background: toHsl(tokens['--card']),
    border: `1px solid hsl(${tokens['--border']})`,
    borderRadius: 8,
    color: toHsl(tokens['--foreground']),
    fontSize: 12,
  }), [tokens]);

  const tickStyle = useMemo(() => ({
    fill: toHsl(tokens['--muted-foreground']),
    fontSize: 11,
  }), [tokens]);

  const stats = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const mesAtual = new Date().toISOString().slice(0, 7);

    const lavagensHoje = lavagens.filter(l => l.data.slice(0, 10) === hoje);
    const lavagensMes = lavagens.filter(l => l.data.slice(0, 7) === mesAtual);
    const clientesHoje = [...new Set(lavagensHoje.map(l => l.cliente_id))].length;
    const receitaHoje = lavagensHoje.filter(l => l.status === 'concluida').reduce((s, l) => s + l.valor, 0);
    const receitaMes = lavagensMes.filter(l => l.status === 'concluida').reduce((s, l) => s + l.valor, 0);
    const pendentes = lavagens.filter(l => l.status === 'pendente');
    const concluidasMes = lavagensMes.filter(l => l.status === 'concluida');
    
    const lavagensPorTipoMes = tiposLavagem.map(t => ({
      nome: t.nome,
      quantidade: lavagensMes.filter(l => l.tipo_lavagem_id === t.id).length,
    }));

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

    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const key = d.toISOString().slice(0, 7);
      const monthLavagens = lavagens.filter(l => l.data.slice(0, 7) === key);
      return {
        mes: MONTHS[d.getMonth()],
        lavagens: monthLavagens.length,
        receita: monthLavagens.filter(l => l.status === 'concluida').reduce((s, l) => s + l.valor, 0),
      };
    });

    const lavagensPorTipo = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const key = d.toISOString().slice(0, 7);
      const monthLavagens = lavagens.filter(l => l.data.slice(0, 7) === key);
      
      const data: Record<string, number | string> = { mes: MONTHS[d.getMonth()] };
      tiposLavagem.forEach(t => {
        data[t.nome] = monthLavagens.filter(l => l.tipo_lavagem_id === t.id).length;
      });
      return data;
    });

    return {
      lavagensHoje,
      lavagensMes,
      clientesHoje,
      receitaHoje,
      receitaMes,
      pendentes,
      concluidasMes,
      lavagensPorTipoMes,
      last7,
      last6Months,
      lavagensPorTipo
    };
  }, [lavagens, tiposLavagem]);

  const recentClientes = useMemo(() => 
    [...clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, 5),
  [clientes]);

  const statsCardsHoje = useMemo(() => [
    { label: 'Lavagens Hoje', value: stats.lavagensHoje.length, icon: Droplets, border: 'border-primary' },
    { label: 'Receita Hoje', value: `R$ ${stats.receitaHoje.toFixed(2)}`, icon: DollarSign, border: 'border-success' },
    { label: 'Clientes Hoje', value: stats.clientesHoje, icon: Users, border: 'border-chart-4' },
    { label: 'Lavagens no Mês', value: stats.lavagensMes.length, icon: Calendar, border: 'border-accent' },
  ], [stats]);

  const statsCardsMes = useMemo(() => [
    { label: 'Receita do Mês', value: `R$ ${stats.receitaMes.toFixed(2)}`, icon: TrendingUp, border: 'border-success' },
    { label: 'Concluídas no Mês', value: stats.concluidasMes.length, icon: Check, border: 'border-accent' },
  ], [stats]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-barlow-condensed font-bold text-2xl text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {user?.role === 'admin' ? <Shield size={14} className="text-accent-text" /> : <User size={14} />}
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
              className="bg-accent/10 text-accent-text hover:bg-accent/20 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 border border-accent/20"
            >
              <Droplets size={16} /> Carregar Dados
            </button>
          )}
        </div>
      </div>

      {/* 1. Stats Rápidas - Hoje */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCardsHoje.map((s, i) => (
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

      {/* Pendentes + Clientes */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-5 animate-fade-up" style={{ animationDelay: '240ms' }}>
          <h2 className="font-barlow-condensed font-bold text-foreground mb-4">Lavagens Pendentes</h2>
          {stats.pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma lavagem pendente.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Últimas lavagens registradas, com cliente, veículo, tipo, valor e ações</caption>
                <thead><tr className="table-header"><th scope="col" className="text-left py-2 px-3">Cliente</th><th scope="col" className="text-left py-2 px-3">Veículo</th><th scope="col" className="text-left py-2 px-3">Tipo</th><th scope="col" className="text-right py-2 px-3">Valor</th><th scope="col" className="py-2 px-3"><span className="sr-only">Ações</span></th></tr></thead>
                <tbody>
                  {stats.pendentes.slice(0, 5).map(l => {
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
                          <div className="inline-flex items-center gap-1.5">
                            <button onClick={() => updateLavagemStatus(l.id, 'em_progresso')} className="bg-accent/10 text-accent-text text-xs px-3 py-1 rounded-full font-semibold hover:bg-accent/20 transition-colors inline-flex items-center gap-1">
                              <PlayCircle size={12} /> Em progresso
                            </button>
                            <button onClick={() => updateLavagemStatus(l.id, 'concluida')} className="bg-success/10 text-success text-xs px-3 py-1 rounded-full font-semibold hover:bg-success/20 transition-colors inline-flex items-center gap-1">
                              <Check size={12} /> Concluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-5 animate-fade-up" style={{ animationDelay: '320ms' }}>
          <h2 className="font-barlow-condensed font-bold text-foreground mb-4">Clientes Recentes</h2>
          {recentClientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {recentClientes.map(c => {
                const avatarColors = ['badge-andamento', 'badge-pendente', 'badge-concluida', 'badge-info', 'badge-cancelada'];
                const ci = c.nome.charCodeAt(0) % avatarColors.length;
                return (
                  <Link key={c.id} to={`/clientes/${c.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/40 transition-colors">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${avatarColors[ci]}`}>
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

      {/* 2. Gráficos Últimos 7 dias + Estoque Baixo */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5 animate-fade-up" style={{ animationDelay: '400ms' }}>
          <h2 className="font-barlow-condensed font-bold text-foreground mb-4">Últimos 7 dias</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats.last7}>
                <XAxis dataKey="dia" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={tickStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar yAxisId="left" dataKey="receita" fill={chartColors[0]} radius={[4, 4, 0, 0]} name="Receita (R$)" />
                <Line yAxisId="right" type="monotone" dataKey="lavagens" stroke={chartColors[1]} strokeWidth={2} dot={{ fill: chartColors[1] }} name="Lavagens" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 animate-fade-up" style={{ animationDelay: '480ms' }}>
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

      {/* 3. Stats do Mês + Lavagens por Tipo */}
      {user?.role === 'admin' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statsCardsMes.map((s, i) => (
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
            <div className="bg-card rounded-xl border-l-4 border-chart-4 p-4 animate-fade-up" style={{ animationDelay: '160ms' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total por Tipo (Mês)</p>
                  <div className="mt-1 space-y-1">
                    {stats.lavagensPorTipoMes.map((t) => (
                      <p key={t.nome} className="text-sm font-barlow-condensed font-bold text-foreground">
                        {t.nome}: <span className="text-chart-4">{t.quantidade}</span>
                      </p>
                    ))}
                  </div>
                </div>
                <Package className="text-muted-foreground" size={22} />
              </div>
            </div>
          </div>

          {/* 4. Gráficos 6 meses */}
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border border-border p-5 animate-fade-up" style={{ animationDelay: '320ms' }}>
              <h2 className="font-barlow-condensed font-bold text-foreground mb-4">Lavagens e Receita - Últimos 6 meses</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={stats.last6Months}>
                    <XAxis dataKey="mes" tick={tickStyle} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={tickStyle} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={tickStyle} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="lavagens" fill={chartColors[1]} radius={[4, 4, 0, 0]} name="Lavagens" />
                    <Line yAxisId="right" type="monotone" dataKey="receita" stroke={chartColors[0]} strokeWidth={2} dot={{ fill: chartColors[0] }} name="Receita (R$)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-5 animate-fade-up" style={{ animationDelay: '400ms' }}>
              <h2 className="font-barlow-condensed font-bold text-foreground mb-4">Lavagens por Tipo - Últimos 6 meses</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.lavagensPorTipo}>
                    <XAxis dataKey="mes" tick={tickStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={tickStyle} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    {tiposLavagem.map((t, i) => (
                      <Bar key={t.id} dataKey={t.nome} stackId="a" fill={chartColors[i % chartColors.length]} radius={[2, 2, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}