import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCssTokens, toHsl } from '@/hooks/useThemeTokens';
import { useChartPalette } from '@/components/charts/useChartPalette';
import { getDashboardStats } from '@/services/database';
import { DashboardStats } from '@/types';
import { montarLinkWhatsapp } from '@/utils/format';
import type { SeriesDescriptor } from '@/components/charts/chartSeries';

const TOKENS = ['--card', '--foreground', '--chart-tick', '--chart-grid', '--border'] as const;

/**
 * Estado analitico compartilhado entre o Dashboard (resumo operacional) e a
 * pagina "Análise & Relatórios" (/analise). Centraliza a carga de
 * `GET /api/dashboard/stats`, o refresh com feedback, os estilos dos graficos
 * Recharts derivados dos tokens do tema e as derivacoes de negocio (mix em
 * destaque, agrupamento de pagamentos, tempo medio e link de WhatsApp), para
 * que as duas telas nao dupliquem logica e nao divirjam.
 */
export function useDashboardStats() {
  const tokens = useCssTokens(TOKENS);
  const chartColors = useChartPalette();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
      fill: toHsl(tokens['--chart-tick']),
      fontSize: 13,
      fontFamily: 'inherit',
    }),
    [tokens]
  );

  // WCAG 1.4.11 - grade do grafico: contraste sutil (nao compete com os dados),
  // mas distinta em cada tema (Slate-200 no claro, Slate-700 no escuro).
  const gridColor = useMemo(() => toHsl(tokens['--chart-grid']), [tokens]);

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
  const gerarLinkWhatsapp = useCallback(
    (telefone: string | null | undefined, nomeCliente: string) =>
      montarLinkWhatsapp(
        telefone,
        `Olá, ${nomeCliente}! Aqui é do Lava Rápido Maquininha. Notamos que faz um tempo desde a sua última visita e preparamos um atendimento especial para deixar seu carro novinho de novo. Quando gostaria de passar aqui?`
      ),
    []
  );

  return {
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
    destaqueMix,
    pagamentosAgrupados,
    tempoMedioTexto,
    gerarLinkWhatsapp,
  };
}