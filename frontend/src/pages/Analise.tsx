import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import {
  AlertTriangle,
  Users,
  CreditCard,
  Timer,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Shield,
  User,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatarMoeda, formatarMoedaExtenso } from '@/utils/format';

/**
 * Página "Análise & Relatórios" (/analise) — a camada BI densa do sistema.
 *
 * Concentra o Mix de Serviços detalhado, o Desempenho da Equipe (B2), a
 * distribuição por Forma de Pagamento (B1), o Tempo Médio de Lavagem (B3) e o
 * Reengajamento de Clientes Ausentes via WhatsApp (B4). O Dashboard (/) fica
 * com o resumo operacional do dia a dia.
 *
 * Rota restrita a admin (ver App.tsx); os dados vêm da mesma API analítica
 * consumida pelo Dashboard, via hook compartilhado `useDashboardStats`.
 */
export default function Analise() {
  const { user } = useAuth();
  const {
    stats,
    loading,
    refreshing,
    error,
    carregarDadosAnaliticos,
    chartColors,
    destaqueMix,
    pagamentosAgrupados,
    tempoMedioTexto,
    gerarLinkWhatsapp,
  } = useDashboardStats();

  return (
    <div className="space-y-6 pb-8">
      {/* Cabeçalho da página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-barlow-condensed font-bold text-3xl text-foreground">
              Análise & Relatórios
            </h2>
            <span className="text-sm px-3 py-1 rounded-full font-semibold bg-primary/10 text-primary border border-primary/20">
              Inteligência de Negócio
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

        <button
          onClick={() => carregarDadosAnaliticos(true)}
          disabled={refreshing}
          className="w-11 h-11 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 flex items-center justify-center"
          title="Atualizar dados analíticos"
          aria-label="Atualizar dados"
        >
          <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
        </button>
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

      {/* MIX DE SERVIÇOS - DETALHADO (30 dias) */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-barlow-condensed font-bold text-xl text-foreground">
              Mix de Serviços (Últimos 30 Dias)
            </h3>
            <p className="text-sm text-muted-foreground">
              Participação de cada serviço no faturamento e no volume de atendimentos
            </p>
          </div>
        </div>

        {/* Destaque Prático para o Sr. Reinaldo */}
        {destaqueMix && destaqueMix.porReceita && destaqueMix.porVolume && (
          <div className="bg-secondary/40 rounded-lg p-4 text-sm border border-border/80 mb-4 space-y-1.5">
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
        {stats?.mix_servicos && stats.mix_servicos.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
            {stats.mix_servicos.map((servico) => (
              <div key={servico.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground truncate">{servico.nome}</span>
                  <span className="text-muted-foreground">
                    {formatarMoeda(servico.faturamento_total)} ({servico.total_atendimentos} atend.)
                  </span>
                </div>

                {/* Barra de Receita */}
                <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden flex">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${Math.min(servico.pct_receita, 100)}%` }}
                    title={`Receita: ${servico.pct_receita}%`}
                  />
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Receita: {servico.pct_receita}%</span>
                  <span>Volume: {servico.pct_volume}%</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum serviço registrado nos últimos 30 dias.</p>
        )}

        <div className="pt-4 border-t border-border mt-4">
          <Link
            to="/tipos-lavagem"
            className="text-sm text-primary font-semibold hover:underline flex items-center justify-between"
          >
            <span>Gerenciar tabela de preços e serviços</span>
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      {/* GESTÃO OPERACIONAL E EQUIPE (B1, B2, B3) */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Card B3: Tempo Médio de Lavagem */}
        <div className="bg-card rounded-xl border-l-4 border-chart-3 border border-border p-5 shadow-sm animate-fade-up">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
              Tempo Médio de Lavagem
            </span>
            <Timer className="text-chart-3" size={20} />
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
          <p className="text-sm text-muted-foreground mt-1">
            {stats && stats.tempo_atendimento.total_finalizadas > 0
              ? `Base: ${stats.tempo_atendimento.total_finalizadas} lavagens concluídas`
              : 'Sem lavagens concluídas com hora final registrada'}
          </p>
        </div>

        {/* Card B1: Faturamento por Forma de Pagamento */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="text-chart-2" size={20} />
            <div>
              <h3 className="font-barlow-condensed font-bold text-xl text-foreground">
                Faturamento por Pagamento
              </h3>
              <p className="text-sm text-muted-foreground">
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
                    <div className="flex items-center justify-between text-sm">
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
                    <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(p.pct, 100)}%`, backgroundColor: cor }}
                        title={`${p.pct}% da receita`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{p.pct}% da receita</span>
                      <span>Ticket: {formatarMoeda(p.receita / Math.max(p.lavagens, 1))}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">Nenhum pagamento registrado nos últimos 30 dias.</p>
          )}
        </div>

        {/* Card B2: Desempenho da Equipe */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <Users className="text-chart-4" size={20} />
            <div>
              <h3 className="font-barlow-condensed font-bold text-xl text-foreground">
                Desempenho da Equipe
              </h3>
              <p className="text-sm text-muted-foreground">
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
            <p className="text-sm text-muted-foreground">Nenhum operador registrado.</p>
          )}
        </div>
      </div>

      {/* B4: OPORTUNIDADES DE RETORNO (CLIENTES AUSENTES > 30 DIAS) */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="text-chart-4" size={20} />
            <h3 className="font-barlow-condensed font-bold text-xl text-foreground">
              Clientes Ausentes (Resgate &gt; 30 dias)
            </h3>
          </div>
          <Link
            to="/clientes"
            className="text-sm text-primary font-semibold hover:underline flex items-center gap-1"
          >
            <span>Ver Clientes</span>
            <ExternalLink size={14} />
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
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <span>{cliente.telefone || 'Sem telefone'}</span>
                      <span>•</span>
                      <span>{cliente.historico_lavagens} lavagens já feitas</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm px-2 py-0.5 rounded font-medium bg-secondary text-muted-foreground">
                      Há {cliente.dias_ausente} dias
                    </span>

                    {/* Telefone ausente ou incompleto: o botão fica desabilitado e
                        explica o motivo, em vez de abrir um wa.me sem número. */}
                    {linkWhatsapp ? (
                      <a
                        href={linkWhatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1 shadow-sm"
                        title="Enviar mensagem amigável no WhatsApp"
                      >
                        <MessageCircle size={14} />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="bg-secondary text-muted-foreground text-sm font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-1 cursor-not-allowed"
                        title={`Cadastre um telefone válido de ${cliente.nome} para enviar a mensagem pelo WhatsApp`}
                      >
                        <MessageCircle size={14} />
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
            <p className="text-sm mt-1">A frequência de retorno da clientela está em dia.</p>
          </div>
        )}
      </div>
    </div>
  );
}