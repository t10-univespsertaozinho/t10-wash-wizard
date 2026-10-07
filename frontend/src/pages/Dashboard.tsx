import { useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  AlertTriangle,
  Clock,
  ExternalLink,
  Droplets,
  Check,
  PlayCircle,
  Shield,
  User,
  RefreshCw,
  Car,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useModal } from '@/contexts/ModalContext';
import { ResponsiveContainer, Bar, Line, ComposedChart, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import {
  ChartDataTable,
  ChartLegend,
  ChartTooltip,
} from '@/components/charts/chartA11y';
import { chartA11yProps } from '@/components/charts/chartSeries';
import {
  formatarMoeda,
  formatarMoedaExtenso,
  formatarPercentual,
} from '@/utils/format';

const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];

export default function Dashboard() {
  const { user } = useAuth();
  const { openNovaLavagem } = useModal();
  const {
    lavagens,
    getCliente,
    getTipoLavagem,
    updateLavagemStatus,
    veiculos,
    seedTestData,
  } = useApp();

  const {
    stats,
    loading,
    refreshing,
    error,
    carregarDadosAnaliticos,
    chartColors,
    tooltipStyle,
    tickStyle,
    gridColor,
    cursorStyle,
    series7dias,
  } = useDashboardStats();

  // Lavagens pendentes para ação operacional diária
  const pendentes = useMemo(
    () => lavagens.filter((l) => l.status === 'pendente' || l.status === 'em_progresso').slice(0, 5),
    [lavagens]
  );

  // Recarregar analíticos sempre que houver alteração nas lavagens locais.
  // Sem o try/catch, uma falha de rede ou um token expirado virava rejeição não
  // tratada: o card não mudava e o usuário não recebia nenhum aviso (FA-08).
  const handleUpdateStatus = async (id: string, novoStatus: 'em_progresso' | 'concluida') => {
    try {
      await updateLavagemStatus(id, novoStatus);
      await carregarDadosAnaliticos(true);
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('Erro ao atualizar o status da lavagem:', err);
      toast.error(`Não foi possível atualizar o status da lavagem: ${mensagem}`);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Cabeçalho do Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-barlow-condensed font-bold text-3xl text-foreground">
              Painel do Proprietário
            </h2>
            <span className="bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 font-semibold px-3 py-1 rounded-full text-sm">
              Lava Rápido Maquininha
            </span>
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2 mt-1">
            {user?.role === 'admin' ? (
              <Shield size={14} className="text-accent-text" />
            ) : (
              <User size={14} />
            )}
            Perfil:{' '}
            <span className={`text-sm px-3 py-1 rounded-md font-semibold border ${user?.role === 'admin' ? 'badge-role-admin' : 'badge-role-operador'}`}>
              {user?.role === 'admin' ? 'Admin' : 'Operador'}
            </span>{' '}
            ({user?.nome})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openNovaLavagem}
            className="bg-primary text-primary-foreground font-bold h-12 px-5 rounded-lg hover:brightness-110 transition-all flex items-center gap-2 text-base"
          >
            <Plus size={18} /> Nova Lavagem
          </button>
          <button
            onClick={() => carregarDadosAnaliticos(true)}
            disabled={refreshing}
            className="w-11 h-11 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 flex items-center justify-center"
            title="Atualizar dados analíticos"
            aria-label="Atualizar dados"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>

          {user?.role === 'admin' && (
            <button
              onClick={() => {
                if (confirm('Deseja recarregar a base com dados de demonstração?')) {
                  seedTestData().then(() => carregarDadosAnaliticos(true));
                }
              }}
              className="bg-accent/10 text-accent-text hover:bg-accent/20 px-6 rounded-lg text-base font-bold transition-colors flex items-center gap-2 border border-accent/20 h-12"
            >
              <Droplets size={18} /> Recarregar Demonstração
            </button>
          )}
        </div>
      </div>

      {/* Alerta de erro com retry se houver */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <button
            onClick={() => carregarDadosAnaliticos()}
            className="text-sm font-bold underline hover:opacity-80 ml-4"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* BLOCO 1: TOPO - 4 CARDS DE INDICADORES PRINCIPAIS DE NEGÓCIO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Faturamento da Semana */}
        <div className="bg-card rounded-xl border-l-4 border-success border border-border p-5 shadow-sm animate-fade-up">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Faturamento da Semana
            </span>
            <DollarSign className="text-success" size={24} />
          </div>
          <div className="mt-2">
            <p className="text-3xl xl:text-4xl font-barlow-condensed font-extrabold text-foreground leading-tight">
              {loading ? (
                <span className="animate-pulse">Carregando...</span>
              ) : (
                formatarMoedaExtenso(stats?.financeiro.receita_semana ?? 0)
              )}
            </p>
            <div className="flex items-center gap-1.5 mt-1 text-sm">
              {stats && stats.financeiro.variacao_receita_pct >= 0 ? (
                <span className="inline-flex items-center gap-0.5 font-bold text-emerald-700 dark:text-emerald-400">
                  <TrendingUp size={14} /> +{formatarPercentual(stats.financeiro.variacao_receita_pct)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 font-bold text-rose-700 dark:text-rose-400">
                  {/* Com stats nulo (erro de carga) isto renderizava "undefined%" (FA-14) */}
                  <TrendingDown size={14} /> {formatarPercentual(stats?.financeiro.variacao_receita_pct)}
                </span>
              )}
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">vs. semana anterior</span>
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">
              {stats?.financeiro.lavagens_semana ?? 0} lavagens concluídas nos últimos 7 dias
            </p>
          </div>
        </div>

        {/* Card 2: Ticket Médio por Carro */}
        <div className="bg-card rounded-xl border-l-4 border-primary border border-border p-5 shadow-sm animate-fade-up">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Ticket Médio
            </span>
            <Car className="text-primary" size={24} />
          </div>
          <div className="mt-2">
            <p className="text-3xl xl:text-4xl font-barlow-condensed font-extrabold text-foreground leading-tight">
              {loading ? (
                <span className="animate-pulse">Carregando...</span>
              ) : (
                formatarMoeda(stats?.financeiro.ticket_medio ?? 0)
              )}
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300 ml-1">/ carro</span>
            </p>
            <div className="flex items-center gap-1.5 mt-1 text-sm">
              {stats && stats.financeiro.variacao_ticket_pct >= 0 ? (
                <span className="inline-flex items-center gap-0.5 font-bold text-emerald-700 dark:text-emerald-400">
                  <TrendingUp size={14} /> +{formatarPercentual(stats.financeiro.variacao_ticket_pct)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 font-bold text-rose-700 dark:text-rose-400">
                  <TrendingDown size={14} /> {formatarPercentual(stats?.financeiro.variacao_ticket_pct)}
                </span>
              )}
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">vs. semana anterior</span>
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">
              Gasto médio por cliente atendido no caixa
            </p>
          </div>
        </div>

        {/* Card 3: Fidelização e Recorrência */}
        <div className="bg-card rounded-xl border-l-4 border-chart-4 border border-border p-5 shadow-sm animate-fade-up">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Clientes Fiéis
            </span>
            <Users className="text-chart-4" size={24} />
          </div>
          <div className="mt-2">
            <p className="text-3xl xl:text-4xl font-barlow-condensed font-extrabold text-foreground leading-tight">
              {loading ? (
                <span className="animate-pulse">Carregando...</span>
              ) : (
                `${stats?.fidelizacao.taxa_recorrencia_pct ?? 0}%`
              )}
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300 ml-1">recorrentes</span>
            </p>
            <p className="text-sm text-foreground/90 font-medium mt-1">
              {stats?.fidelizacao.clientes_recorrentes ?? 0} de{' '}
              {stats?.fidelizacao.total_clientes_com_lavagem ?? 0} clientes já retornaram
            </p>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">
              Lavaram mais de uma vez no lava-rápido
            </p>
          </div>
        </div>

        {/* Card 4: Alerta de Insumos Críticos */}
        <div className="bg-card rounded-xl border-l-4 border-amber-600 border border-border p-5 shadow-sm animate-fade-up">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Estoque de Atenção
            </span>
            <Package className="text-amber-600" size={24} />
          </div>
          <div className="mt-2">
            <p className="text-3xl xl:text-4xl font-barlow-condensed font-extrabold text-foreground leading-tight">
              {loading ? (
                <span className="animate-pulse">Carregando...</span>
              ) : (
                `${stats?.estoque_critico.length ?? 0} itens`
              )}
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300 ml-1">em baixa</span>
            </p>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mt-1 truncate">
              {stats && stats.estoque_critico.length > 0
                ? `${stats.estoque_critico[0].nome} (${stats.estoque_critico[0].quantidade} ${stats.estoque_critico[0].unidade})`
                : 'Todos os insumos operando bem'}
            </p>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">
              Abaixo da margem de segurança cadastrada
            </p>
          </div>
        </div>
      </div>

      {/* BLOCO 2: CENTRO - TENDÊNCIA (FLUXO DIÁRIO) */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm animate-fade-up">
        <div className="flex flex-col gap-3 mb-4">
          <div>
            <h3 className="font-barlow-condensed font-bold text-xl text-foreground">
              Fluxo Diário de Atendimentos & Receita
            </h3>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Movimentação dos últimos 7 dias (Barra = Faturamento R$, Linha = Volume de Lavagens)
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: chartColors[0] }} />
              Receita (R$)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5" style={{ backgroundColor: chartColors[1] }} />
              Carros Atendidos
            </span>
          </div>
        </div>

        <figure
          className="m-0"
          aria-label="Gráfico dos últimos 7 dias: receita em barras e quantidade de lavagens em linha tracejada."
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={stats?.financeiro.fluxo_diario_7d || []}
                {...chartA11yProps(
                  'Últimos 7 dias',
                  'Barras: receita em reais por dia. Linha tracejada: quantidade de lavagens por dia.'
                )}
              >
                <XAxis dataKey="dia" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={tickStyle}
                  axisLine={false}
                  tickLine={false}
                />
                <CartesianGrid stroke={gridColor} vertical={false} />
                <Tooltip
                  cursor={cursorStyle}
                  content={
                    <ChartTooltip
                      items={series7dias}
                      colors={chartColors}
                      contentStyle={tooltipStyle}
                    />
                  }
                />
                <Legend content={<ChartLegend items={series7dias} colors={chartColors} />} />
                <Bar
                  yAxisId="left"
                  dataKey="receita"
                  name={series7dias[0].name}
                  fill={chartColors[0]}
                  radius={BAR_RADIUS}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="lavagens"
                  name={series7dias[1].name}
                  stroke={chartColors[1]}
                  strokeWidth={2}
                  strokeDasharray={series7dias[1].dash}
                  dot={{ fill: chartColors[1] }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <ChartDataTable
            caption="Receita e quantidade de lavagens nos últimos 7 dias"
            rowLabel="Dia"
            columns={series7dias}
            rows={(stats?.financeiro.fluxo_diario_7d || []).map((d) => ({
              label: `${d.dia} (${d.data.slice(8, 10)}/${d.data.slice(5, 7)})`,
              values: [d.receita, d.lavagens],
            }))}
          />
        </figure>
      </div>

      {/* BLOCO 3: PLANO DE AÇÃO RÁPIDO - ALERTA DE COMPRAS (INSUMOS COM RUNWAY) */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-600" size={20} />
            <h3 className="font-barlow-condensed font-bold text-xl text-foreground">
              Alerta de Compras (Insumos em Baixa)
            </h3>
          </div>
          <Link
            to="/estoque"
            className="text-sm text-primary font-semibold hover:underline flex items-center gap-1"
          >
            <span>Ir para Estoque</span>
            <ExternalLink size={14} />
          </Link>
        </div>

        {stats?.estoque_critico && stats.estoque_critico.length > 0 ? (
          <div className="divide-y divide-border">
            {stats.estoque_critico.map((item) => (
              <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{item.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    Saldo: <span className="font-medium text-foreground">{item.quantidade} {item.unidade}</span>{' '}
                    (Mínimo: {item.estoque_minimo} {item.unidade})
                  </p>
                </div>

                <div className="text-right shrink-0">
                  {item.status_previsao === 'zerado' ? (
                    <span className="text-sm px-2.5 py-1 rounded-full font-bold bg-destructive/15 text-destructive border border-destructive/20 inline-flex items-center gap-1">
                      🔴 Zerado! Repor já
                    </span>
                  ) : item.status_previsao === 'urgente' ? (
                    <span className="text-sm px-2.5 py-1 rounded-full font-semibold bg-destructive/10 text-destructive border border-destructive/20 inline-flex items-center gap-1">
                      🔴 Acaba em ~{item.dias_restantes} dias
                    </span>
                  ) : item.status_previsao === 'atencao' ? (
                    <span className="text-sm px-3 py-1 rounded-md font-semibold border badge-baixo inline-flex items-center gap-1">
                      🟡 Acaba em ~{item.dias_restantes} dias
                    </span>
                  ) : (
                    <span className="text-sm px-2.5 py-1 rounded-full font-semibold bg-secondary text-muted-foreground border border-border inline-flex items-center gap-1">
                      ⚪ Abaixo do mínimo
                    </span>
                  )}
                  {item.consumo_diario > 0 && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Consumo: ~{item.consumo_diario} {item.unidade}/dia
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <Check size={28} className="mx-auto text-success mb-2" />
            <p className="text-sm font-medium text-foreground">Todos os insumos estão acima do mínimo!</p>
            <p className="text-sm mt-1">Nenhum risco de falta de produto no momento.</p>
          </div>
        )}
      </div>

      {/* BLOCO OPERACIONAL: FILA DE LAVAGENS PENDENTES */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="text-primary" size={20} />
            <h3 className="font-barlow-condensed font-bold text-xl text-foreground">
              Fila de Atendimento do Pátio
            </h3>
          </div>
          <Link
            to="/lavagens"
            className="text-sm text-primary font-semibold hover:underline flex items-center gap-1"
          >
            <span>Ver Todas as Lavagens</span>
            <ExternalLink size={14} />
          </Link>
        </div>

        {pendentes.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            <Check size={24} className="mx-auto text-success mb-2" />
            <p className="text-sm">Nenhuma lavagem pendente no pátio agora.</p>
          </div>
        ) : (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela de lavagens pendentes">
            <table className="w-full text-sm">
              <caption className="sr-only">Lavagens aguardando ou em atendimento</caption>
              <thead>
                <tr className="table-header">
                  <th scope="col" className="text-left py-4 px-4">Cliente</th>
                  <th scope="col" className="text-left py-4 px-4">Veículo</th>
                  <th scope="col" className="text-left py-4 px-4">Serviço</th>
                  <th scope="col" className="text-center py-4 px-4">Status</th>
                  <th scope="col" className="text-right py-4 px-4">Valor</th>
                  <th scope="col" className="py-4 px-4 text-right"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {pendentes.map((l) => {
                  const c = getCliente(l.cliente_id);
                  const v = veiculos.find((x) => x.id === l.veiculo_id);
                  const t = getTipoLavagem(l.tipo_lavagem_id);
                  return (
                    <tr key={l.id} className="table-row-hover border-t border-border">
                      <td className="py-4 px-4 text-base font-medium text-foreground">{c?.nome || '—'}</td>
                      <td className="py-4 px-4 text-sm font-medium text-muted-foreground">{v ? `${v.modelo} (${v.placa})` : '—'}</td>
                      <td className="py-4 px-4 text-base text-foreground">{t?.nome || '—'}</td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`text-sm px-3 py-1 rounded-md font-semibold border ${
                            l.status === 'em_progresso' ? 'badge-andamento' : 'badge-pendente'
                          }`}
                        >
                          {l.status === 'em_progresso' ? 'Em andamento' : 'Pendente'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right text-base text-primary font-bold">
                        {formatarMoeda(l.valor)}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {l.status === 'pendente' && (
                            <button
                              onClick={() => handleUpdateStatus(l.id, 'em_progresso')}
                              className="bg-accent/10 text-accent-text text-sm px-3 py-1 rounded-full font-semibold hover:bg-accent/20 transition-colors inline-flex items-center gap-1"
                              title="Iniciar lavagem"
                            >
                              <PlayCircle size={14} /> Iniciar
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateStatus(l.id, 'concluida')}
                            className="bg-success/10 text-success text-sm px-3 py-1 rounded-full font-semibold hover:bg-success/20 transition-colors inline-flex items-center gap-1"
                            title="Concluir lavagem"
                          >
                            <Check size={14} /> Concluir
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
    </div>
  );
}