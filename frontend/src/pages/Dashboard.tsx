import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCssTokens, toHsl } from '@/hooks/useThemeTokens';
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
  MessageCircle,
  Car,
  ChevronRight,
  CreditCard,
  Timer,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ResponsiveContainer, Bar, Line, ComposedChart, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import {
  ChartDataTable,
  ChartLegend,
  ChartTooltip,
} from '@/components/charts/chartA11y';
import { chartA11yProps, type SeriesDescriptor } from '@/components/charts/chartSeries';
import { useChartPalette } from '@/components/charts/useChartPalette';
import { getDashboardStats } from '@/services/database';
import { DashboardStats } from '@/types';
import {
  formatarMoeda,
  formatarMoedaExtenso,
  formatarPercentual,
  montarLinkWhatsapp,
} from '@/utils/format';

const TOKENS = ['--card', '--foreground', '--muted-foreground', '--border'] as const;
const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];

export default function Dashboard() {
  const { user } = useAuth();
  const {
    lavagens,
    getCliente,
    getTipoLavagem,
    updateLavagemStatus,
    veiculos,
    seedTestData,
  } = useApp();

  const tokens = useCssTokens(TOKENS);
  const chartColors = useChartPalette();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar dados consolidados da API analítica
  const carregarDadosAnaliticos = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const dados = await getDashboardStats();
      setStats(dados);
    } catch (err: unknown) {
      console.error('Erro ao carregar estatísticas do dashboard:', err);
      setError('Não foi possível carregar as métricas do painel. Verifique sua conexão.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    carregarDadosAnaliticos();
  }, [carregarDadosAnaliticos]);

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

  // Cores do tooltip derivadas dos tokens do tema
  const tooltipStyle = useMemo(
    () => ({
      background: toHsl(tokens['--card']),
      border: `1px solid hsl(${tokens['--border']})`,
      borderRadius: 12,
      boxShadow: `0 10px 30px -8px hsl(${tokens['--foreground']} / 0.18)`,
      color: toHsl(tokens['--foreground']),
      fontFamily: 'inherit',
    }),
    [tokens]
  );

  const tickStyle = useMemo(
    () => ({
      fill: toHsl(tokens['--muted-foreground']),
      fontSize: 11,
      fontFamily: 'inherit',
    }),
    [tokens]
  );

  const cursorStyle = useMemo(
    () => ({ fill: `color-mix(in srgb, ${chartColors[0]} 12%, transparent)` }),
    [chartColors]
  );

  const series7dias = useMemo<SeriesDescriptor[]>(
    () => [
      { key: 'receita', name: 'Receita (R$)', unit: 'moeda', kind: 'bar' },
      { key: 'lavagens', name: 'Lavagens', unit: 'numero', kind: 'line', dash: '7 4' },
    ],
    []
  );

  // Lavagens pendentes para ação operacional diária
  const pendentes = useMemo(
    () => lavagens.filter((l) => l.status === 'pendente' || l.status === 'em_progresso').slice(0, 5),
    [lavagens]
  );

  // Identificar destaques do mix de serviços para o Sr. Reinaldo
  const destaqueMix = useMemo(() => {
    if (!stats || !stats.mix_servicos || stats.mix_servicos.length === 0) return null;
    const porReceita = [...stats.mix_servicos].sort((a, b) => b.faturamento_total - a.faturamento_total)[0];
    const porVolume = [...stats.mix_servicos].sort((a, b) => b.total_atendimentos - a.total_atendimentos)[0];
    return { porReceita, porVolume };
  }, [stats]);

  // [B1] Formas de pagamento agrupadas: "Cartão Débito"/"Cartão Crédito"
  // aparecem juntas como "Cartão", para o painel ser leitura de negócio
  // (PIX, Dinheiro, Cartão) em vez de espelhar o select do formulário.
  const pagamentosAgrupados = useMemo(() => {
    if (!stats?.pagamentos || stats.pagamentos.length === 0) return [];
    const grupos = new Map<string, { lavagens: number; receita: number }>();
    for (const p of stats.pagamentos) {
      const chave = p.forma_pagamento.startsWith('Cartão')
        ? 'Cartão'
        : p.forma_pagamento.trim() === ''
          ? 'Pendente'
          : p.forma_pagamento;
      const atual = grupos.get(chave) ?? { lavagens: 0, receita: 0 };
      grupos.set(chave, {
        lavagens: atual.lavagens + p.lavagens,
        receita: atual.receita + p.receita,
      });
    }
    const total = [...grupos.values()].reduce((s, p) => s + p.receita, 0);
    return [...grupos.entries()]
      .map(([nome, p]) => ({
        nome,
        lavagens: p.lavagens,
        receita: p.receita,
        pct: total > 0 ? Number(((p.receita / total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.receita - a.receita);
  }, [stats]);

  // [B3] Formatação do tempo médio: "42 min" ou "1 h 05 min"
  const tempoMedioTexto = useMemo(() => {
    const min = stats?.tempo_atendimento?.tempo_medio_min ?? 0;
    if (min === 0) return '—';
    if (min < 60) return `${Math.round(min)} min`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')} min`;
  }, [stats]);

  // Link de reengajamento. Devolve null quando o telefone não é discável — um
  // cliente sem número gerava `https://wa.me/55?text=...`, um botão que só abria
  // uma aba quebrada (FA-16).
  const gerarLinkWhatsapp = (telefone: string | null | undefined, nomeCliente: string) =>
    montarLinkWhatsapp(
      telefone,
      `Olá, ${nomeCliente}! Aqui é do Lava Rápido Maquininha. Notamos que faz um tempo desde a sua última visita e preparamos um atendimento especial para deixar seu carro novinho de novo. Quando gostaria de passar aqui?`
    );

  return (
    <div className="space-y-6 pb-8">
      {/* Cabeçalho do Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-barlow-condensed font-bold text-2xl text-foreground">
              Painel do Proprietário
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-primary/10 text-primary border border-primary/20">
              Lava Rápido Maquininha
            </span>
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
            {user?.role === 'admin' ? (
              <Shield size={14} className="text-accent-text" />
            ) : (
              <User size={14} />
            )}
            Perfil: <span className="font-semibold text-foreground capitalize">{user?.role}</span> ({user?.nome})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => carregarDadosAnaliticos(true)}
            disabled={refreshing}
            className="p-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Atualizar dados analíticos"
            aria-label="Atualizar dados"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>

          {user?.role === 'admin' && (
            <button
              onClick={() => {
                if (confirm('Deseja recarregar a base com dados de demonstração?')) {
                  seedTestData().then(() => carregarDadosAnaliticos(true));
                }
              }}
              className="bg-accent/10 text-accent-text hover:bg-accent/20 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 border border-accent/20"
            >
              <Droplets size={15} /> Recarregar Demonstração
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
            className="text-xs font-bold underline hover:opacity-80 ml-4"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* BLOCO 1: TOPO - 4 CARDS DE INDICADORES PRINCIPAIS DE NEGÓCIO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Faturamento da Semana */}
        <div className="bg-card rounded-xl border-l-4 border-success border border-border p-4 shadow-sm animate-fade-up">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Faturamento da Semana
            </span>
            <DollarSign className="text-success" size={20} />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-barlow-condensed font-bold text-foreground">
              {loading ? (
                <span className="animate-pulse">Carregando...</span>
              ) : (
                formatarMoedaExtenso(stats?.financeiro.receita_semana ?? 0)
              )}
            </p>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              {stats && stats.financeiro.variacao_receita_pct >= 0 ? (
                <span className="inline-flex items-center gap-0.5 font-semibold text-success">
                  <TrendingUp size={13} /> +{formatarPercentual(stats.financeiro.variacao_receita_pct)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 font-semibold text-destructive">
                  {/* Com stats nulo (erro de carga) isto renderizava "undefined%" (FA-14) */}
                  <TrendingDown size={13} /> {formatarPercentual(stats?.financeiro.variacao_receita_pct)}
                </span>
              )}
              <span className="text-muted-foreground">vs. semana anterior</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {stats?.financeiro.lavagens_semana ?? 0} lavagens concluídas nos últimos 7 dias
            </p>
          </div>
        </div>

        {/* Card 2: Ticket Médio por Carro */}
        <div className="bg-card rounded-xl border-l-4 border-primary border border-border p-4 shadow-sm animate-fade-up">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Ticket Médio
            </span>
            <Car className="text-primary" size={20} />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-barlow-condensed font-bold text-foreground">
              {loading ? (
                <span className="animate-pulse">Carregando...</span>
              ) : (
                formatarMoeda(stats?.financeiro.ticket_medio ?? 0)
              )}
              <span className="text-xs font-normal text-muted-foreground ml-1">/ carro</span>
            </p>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              {stats && stats.financeiro.variacao_ticket_pct >= 0 ? (
                <span className="inline-flex items-center gap-0.5 font-semibold text-success">
                  <TrendingUp size={13} /> +{formatarPercentual(stats.financeiro.variacao_ticket_pct)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 font-semibold text-destructive">
                  <TrendingDown size={13} /> {formatarPercentual(stats?.financeiro.variacao_ticket_pct)}
                </span>
              )}
              <span className="text-muted-foreground">vs. semana anterior</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Gasto médio por cliente atendido no caixa
            </p>
          </div>
        </div>

        {/* Card 3: Fidelização e Recorrência */}
        <div className="bg-card rounded-xl border-l-4 border-chart-4 border border-border p-4 shadow-sm animate-fade-up">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Clientes Fiéis
            </span>
            <Users className="text-chart-4" size={20} />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-barlow-condensed font-bold text-foreground">
              {loading ? (
                <span className="animate-pulse">Carregando...</span>
              ) : (
                `${stats?.fidelizacao.taxa_recorrencia_pct ?? 0}%`
              )}
              <span className="text-xs font-normal text-muted-foreground ml-1">recorrentes</span>
            </p>
            <p className="text-xs text-foreground/90 font-medium mt-1">
              {stats?.fidelizacao.clientes_recorrentes ?? 0} de{' '}
              {stats?.fidelizacao.total_clientes_com_lavagem ?? 0} clientes já retornaram
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Lavaram mais de uma vez no lava-rápido
            </p>
          </div>
        </div>

        {/* Card 4: Alerta de Insumos Críticos */}
        <div className="bg-card rounded-xl border-l-4 border-amber-500 border border-border p-4 shadow-sm animate-fade-up">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Estoque de Atenção
            </span>
            <Package className="text-amber-500" size={20} />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-barlow-condensed font-bold text-foreground">
              {loading ? (
                <span className="animate-pulse">Carregando...</span>
              ) : (
                `${stats?.estoque_critico.length ?? 0} itens`
              )}
              <span className="text-xs font-normal text-muted-foreground ml-1">em baixa</span>
            </p>
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1 truncate">
              {stats && stats.estoque_critico.length > 0
                ? `${stats.estoque_critico[0].nome} (${stats.estoque_critico[0].quantidade} ${stats.estoque_critico[0].unidade})`
                : 'Todos os insumos operando bem'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Abaixo da margem de segurança cadastrada
            </p>
          </div>
        </div>
      </div>

      {/* BLOCO 2: CENTRO - TENDÊNCIA E MIX DE SERVIÇOS */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Gráfico 1: Fluxo Diário nos Últimos 7 Dias (2 colunas) */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5 shadow-sm animate-fade-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-barlow-condensed font-bold text-lg text-foreground">
                Fluxo Diário de Atendimentos & Receita
              </h3>
              <p className="text-xs text-muted-foreground">
                Movimentação dos últimos 7 dias (Barra = Faturamento R$, Linha = Volume de Lavagens)
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
            <div className="h-64">
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

        {/* Gráfico 2: Mix de Serviços (Volume vs. Receita - 30 dias) */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm animate-fade-up flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-barlow-condensed font-bold text-lg text-foreground">
                  Mix de Serviços (Últimos 30 Dias)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Comparativo entre o mais vendido e o mais lucrativo
                </p>
              </div>
            </div>

            {/* Destaque Prático para o Sr. Reinaldo */}
            {destaqueMix && destaqueMix.porReceita && destaqueMix.porVolume && (
              <div className="bg-secondary/40 rounded-lg p-3 text-xs border border-border/80 mb-4 space-y-1.5">
                <p className="text-foreground">
                  <span className="font-semibold text-primary">💡 Visão do Negócio:</span>
                </p>
                <p className="text-muted-foreground">
                  • Mais rentável:{' '}
                  <strong className="text-foreground">{destaqueMix.porReceita.nome}</strong> traz{' '}
                  <strong className="text-foreground">{destaqueMix.porReceita.pct_receita}%</strong> do
                  dinheiro.
                </p>
                <p className="text-muted-foreground">
                  • Mais popular:{' '}
                  <strong className="text-foreground">{destaqueMix.porVolume.nome}</strong> lidera em{' '}
                  <strong className="text-foreground">{destaqueMix.porVolume.pct_volume}%</strong> da
                  fila.
                </p>
              </div>
            )}

            {/* Barras de Comparação dos Serviços */}
            <div className="space-y-3">
              {stats?.mix_servicos && stats.mix_servicos.length > 0 ? (
                stats.mix_servicos.slice(0, 4).map((servico) => (
                  <div key={servico.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground truncate">{servico.nome}</span>
                      <span className="text-muted-foreground">
                        {formatarMoeda(servico.faturamento_total)} ({servico.total_atendimentos} atend.)
                      </span>
                    </div>

                    {/* Barra de Receita */}
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden flex">
                      <div
                        className="bg-primary h-full rounded-full transition-all"
                        style={{ width: `${Math.min(servico.pct_receita, 100)}%` }}
                        title={`Receita: ${servico.pct_receita}%`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Receita: {servico.pct_receita}%</span>
                      <span>Volume: {servico.pct_volume}%</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum serviço registrado nos últimos 30 dias.</p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-border mt-4">
            <Link
              to="/tipos-lavagem"
              className="text-xs text-primary font-semibold hover:underline flex items-center justify-between"
            >
              <span>Gerenciar tabela de preços e serviços</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* BLOCO 2.5: GESTÃO OPERACIONAL E EQUIPE (B1, B2, B3) */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Card B3: Tempo Médio de Lavagem */}
        <div className="bg-card rounded-xl border-l-4 border-chart-3 border border-border p-5 shadow-sm animate-fade-up">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Tempo Médio de Lavagem
            </span>
            <Timer className="text-chart-3" size={18} />
          </div>
          <p className="mt-3 text-3xl font-barlow-condensed font-bold text-foreground">
            {loading ? (
              <span className="animate-pulse">Carregando...</span>
            ) : (
              <>
                {tempoMedioTexto}
                <span className="text-base font-normal text-muted-foreground ml-1">/ lavagem</span>
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats && stats.tempo_atendimento.total_finalizadas > 0
              ? `Base: ${stats.tempo_atendimento.total_finalizadas} lavagens concluídas`
              : 'Sem lavagens concluídas com hora final registrada'}
          </p>
        </div>

        {/* Card B1: Faturamento por Forma de Pagamento */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="text-chart-2" size={18} />
            <div>
              <h3 className="font-barlow-condensed font-bold text-lg text-foreground">
                Faturamento por Pagamento
              </h3>
              <p className="text-xs text-muted-foreground">
                Como o caixa recebeu (PIX, Dinheiro, Cartão) nos últimos 30 dias
              </p>
            </div>
          </div>

          {pagamentosAgrupados.length > 0 ? (
            <div className="space-y-3 mt-4">
              {pagamentosAgrupados.map((p, i) => {
                const cor = chartColors[i % Math.max(chartColors.length, 1)];
                return (
                  <div key={p.nome} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground truncate flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-sm shrink-0"
                          style={{ backgroundColor: cor }}
                          aria-hidden="true"
                        />
                        {p.nome}
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {formatarMoedaExtenso(p.receita)}
                        {' '}({p.lavagens} lav.)
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(p.pct, 100)}%`, backgroundColor: cor }}
                        title={`${p.pct}% da receita`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{p.pct}% da receita</span>
                      <span>Ticket: {formatarMoeda(p.receita / Math.max(p.lavagens, 1))}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-2">Nenhum pagamento registrado nos últimos 30 dias.</p>
          )}
        </div>

        {/* Card B2: Desempenho da Equipe */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <Users className="text-chart-4" size={18} />
            <div>
              <h3 className="font-barlow-condensed font-bold text-lg text-foreground">
                Desempenho da Equipe
              </h3>
              <p className="text-xs text-muted-foreground">
                Lavagens e receita por operador nos últimos 30 dias
              </p>
            </div>
          </div>

          {stats?.desempenho_operadores && stats.desempenho_operadores.length > 0 ? (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela de desempenho por operador">
              <table className="w-full text-sm">
                <caption className="sr-only">Lavagens concluídas, receita e ticket médio por operador nos últimos 30 dias</caption>
                <thead>
                  <tr className="table-header border-b border-border">
                    <th scope="col" className="text-left py-2 px-3 font-semibold text-muted-foreground">Operador</th>
                    <th scope="col" className="text-center py-2 px-3 font-semibold text-muted-foreground">Lavagens</th>
                    <th scope="col" className="text-right py-2 px-3 font-semibold text-muted-foreground">Receita</th>
                    <th scope="col" className="text-right py-2 px-3 font-semibold text-muted-foreground">Ticket</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.desempenho_operadores.map((op) => (
                    <tr key={op.id} className="table-row-hover border-t border-border">
                      <td className="py-2 px-3 font-medium text-foreground">{op.nome}</td>
                      <td className="py-2 px-3 text-center tabular-nums text-muted-foreground">{op.total_lavagens}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-primary font-bold">
                        {op.receita > 0 ? formatarMoeda(op.receita) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                        {op.ticket_medio > 0 ? formatarMoeda(op.ticket_medio) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum operador registrado.</p>
          )}
        </div>
      </div>

      {/* BLOCO 3: BASE - PLANO DE AÇÃO RÁPIDO DO SR. REINALDO */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Painel 1: Alerta de Compras (Insumos Críticos com Runway) */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm animate-fade-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={18} />
              <h3 className="font-barlow-condensed font-bold text-lg text-foreground">
                Alerta de Compras (Insumos em Baixa)
              </h3>
            </div>
            <Link
              to="/estoque"
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <span>Ir para Estoque</span>
              <ExternalLink size={12} />
            </Link>
          </div>

          {stats?.estoque_critico && stats.estoque_critico.length > 0 ? (
            <div className="divide-y divide-border">
              {stats.estoque_critico.map((item) => (
                <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      Saldo: <span className="font-medium text-foreground">{item.quantidade} {item.unidade}</span>{' '}
                      (Mínimo: {item.estoque_minimo} {item.unidade})
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    {item.status_previsao === 'zerado' ? (
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-destructive/15 text-destructive border border-destructive/20 inline-flex items-center gap-1">
                        🔴 Zerado! Repor já
                      </span>
                    ) : item.status_previsao === 'urgente' ? (
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-destructive/10 text-destructive border border-destructive/20 inline-flex items-center gap-1">
                        🔴 Acaba em ~{item.dias_restantes} dias
                      </span>
                    ) : item.status_previsao === 'atencao' ? (
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                        🟡 Acaba em ~{item.dias_restantes} dias
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-secondary text-muted-foreground border border-border inline-flex items-center gap-1">
                        ⚪ Abaixo do mínimo
                      </span>
                    )}
                    {item.consumo_diario > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
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
              <p className="text-xs mt-1">Nenhum risco de falta de produto no momento.</p>
            </div>
          )}
        </div>

        {/* Painel 2: Oportunidades de Retorno (Clientes Ausentes > 30 Dias) */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm animate-fade-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="text-chart-4" size={18} />
              <h3 className="font-barlow-condensed font-bold text-lg text-foreground">
                Clientes Ausentes (Resgate &gt; 30 dias)
              </h3>
            </div>
            <Link
              to="/clientes"
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <span>Ver Clientes</span>
              <ExternalLink size={12} />
            </Link>
          </div>

          {stats?.clientes_ausentes && stats.clientes_ausentes.length > 0 ? (
            <div className="divide-y divide-border">
              {stats.clientes_ausentes.map((cliente) => {
                const linkWhatsapp = gerarLinkWhatsapp(cliente.telefone, cliente.nome);

                return (
                  <div key={cliente.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{cliente.nome}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{cliente.telefone || 'Sem telefone'}</span>
                        <span>•</span>
                        <span>{cliente.historico_lavagens} lavagens já feitas</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded font-medium bg-secondary text-muted-foreground">
                        Há {cliente.dias_ausente} dias
                      </span>

                      {/* Telefone ausente ou incompleto: o botão fica desabilitado e
                          explica o motivo, em vez de abrir um wa.me sem número. */}
                      {linkWhatsapp ? (
                        <a
                          href={linkWhatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1 shadow-sm"
                          title="Enviar mensagem amigável no WhatsApp"
                        >
                          <MessageCircle size={13} />
                          <span className="hidden sm:inline">WhatsApp</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="bg-secondary text-muted-foreground text-xs font-semibold px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 cursor-not-allowed"
                          title={`Cadastre um telefone válido de ${cliente.nome} para enviar a mensagem pelo WhatsApp`}
                        >
                          <MessageCircle size={13} />
                          <span className="hidden sm:inline">Sem telefone</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Users size={28} className="mx-auto text-primary mb-2" />
              <p className="text-sm font-medium text-foreground">Nenhum cliente ausente há mais de 30 dias!</p>
              <p className="text-xs mt-1">A frequência de retorno da clientela está em dia.</p>
            </div>
          )}
        </div>
      </div>

      {/* BLOCO OPERACIONAL: FILA DE LAVAGENS PENDENTES */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="text-primary" size={18} />
            <h3 className="font-barlow-condensed font-bold text-lg text-foreground">
              Fila de Atendimento do Pátio
            </h3>
          </div>
          <Link
            to="/lavagens"
            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
          >
            <span>Ver Todas as Lavagens</span>
            <ExternalLink size={12} />
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
                <tr className="table-header border-b border-border">
                  <th scope="col" className="text-left py-2 px-3 font-semibold text-muted-foreground">Cliente</th>
                  <th scope="col" className="text-left py-2 px-3 font-semibold text-muted-foreground">Veículo</th>
                  <th scope="col" className="text-left py-2 px-3 font-semibold text-muted-foreground">Serviço</th>
                  <th scope="col" className="text-center py-2 px-3 font-semibold text-muted-foreground">Status</th>
                  <th scope="col" className="text-right py-2 px-3 font-semibold text-muted-foreground">Valor</th>
                  <th scope="col" className="py-2 px-3 text-right"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {pendentes.map((l) => {
                  const c = getCliente(l.cliente_id);
                  const v = veiculos.find((x) => x.id === l.veiculo_id);
                  const t = getTipoLavagem(l.tipo_lavagem_id);
                  return (
                    <tr key={l.id} className="table-row-hover border-t border-border">
                      <td className="py-2 px-3 font-medium text-foreground">{c?.nome || '—'}</td>
                      <td className="py-2 px-3 text-muted-foreground">{v ? `${v.modelo} (${v.placa})` : '—'}</td>
                      <td className="py-2 px-3 text-foreground">{t?.nome || '—'}</td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                            l.status === 'em_progresso' ? 'badge-andamento' : 'badge-pendente'
                          }`}
                        >
                          {l.status === 'em_progresso' ? 'Em andamento' : 'Pendente'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-primary font-bold">
                        {formatarMoeda(l.valor)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {l.status === 'pendente' && (
                            <button
                              onClick={() => handleUpdateStatus(l.id, 'em_progresso')}
                              className="bg-accent/10 text-accent-text text-xs px-2.5 py-1 rounded-full font-semibold hover:bg-accent/20 transition-colors inline-flex items-center gap-1"
                              title="Iniciar lavagem"
                            >
                              <PlayCircle size={12} /> Iniciar
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateStatus(l.id, 'concluida')}
                            className="bg-success/10 text-success text-xs px-2.5 py-1 rounded-full font-semibold hover:bg-success/20 transition-colors inline-flex items-center gap-1"
                            title="Concluir lavagem"
                          >
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
    </div>
  );
}