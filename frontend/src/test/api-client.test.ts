/**
 * Contrato do cliente HTTP (src/services/database.ts).
 *
 * O backend passou a responder 403 para operador em rotas destrutivas e em
 * campos financeiros (FA-03, FA-05). Isso só chega ao usuário se o cliente
 * propagar a mensagem do servidor em vez de engolir o erro — era justamente o
 * que acontecia antes, com a rejeição morrendo no console (FA-07 a FA-09).
 *
 * Aqui o `fetch` é dublado: o objetivo é o comportamento do cliente diante de
 * cada resposta, não a regra do servidor (essa é testada de verdade, contra o
 * app Express, em backend/test/rbac.test.js).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiDB, getDashboardStats } from '@/services/database';
import { TOKEN_STORAGE_KEY } from '@/utils/security';

const resposta = (status: number, body: unknown, ok = status >= 200 && status < 300) =>
  ({
    ok,
    status,
    json: async () => body,
    headers: new Headers(),
  }) as Response;

let fetchDublado: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.setItem(TOKEN_STORAGE_KEY, 'token-de-teste');
  fetchDublado = vi.fn();
  vi.stubGlobal('fetch', fetchDublado);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('autorização: o 403 do backend chega ao chamador', () => {
  const mensagem403 = 'Acesso restrito a administradores';

  it('propaga a mensagem do servidor ao excluir lavagem como operador', async () => {
    fetchDublado.mockResolvedValue(resposta(403, { error: mensagem403 }));

    await expect(apiDB.deleteLavagem('lav-1')).rejects.toThrow(mensagem403);
  });

  it('propaga a mensagem do servidor ao excluir cliente como operador', async () => {
    fetchDublado.mockResolvedValue(resposta(403, { error: mensagem403 }));

    await expect(apiDB.deleteCliente('cli-1')).rejects.toThrow(mensagem403);
  });

  it('propaga a mensagem do servidor ao excluir veículo como operador', async () => {
    fetchDublado.mockResolvedValue(resposta(403, { error: mensagem403 }));

    await expect(apiDB.deleteVeiculo('vei-1')).rejects.toThrow(mensagem403);
  });

  it('propaga a recusa de alteração de valor da lavagem', async () => {
    const erro = 'Apenas administradores podem alterar valor ou forma de pagamento da lavagem.';
    fetchDublado.mockResolvedValue(resposta(403, { error: erro }));

    await expect(apiDB.updateLavagem('lav-1', { valor: 40 })).rejects.toThrow(erro);
  });

  it('propaga a recusa de criar lavagem já concluída', async () => {
    const erro = 'Apenas administradores podem registrar uma lavagem já concluída.';
    fetchDublado.mockResolvedValue(resposta(403, { error: erro }));

    await expect(
      apiDB.createLavagem('u1', {
        cliente_id: 'c1',
        veiculo_id: 'v1',
        tipo_lavagem_id: 't1',
        status: 'concluida',
        valor: 50,
        pagamento: 'PIX',
        observacao: '',
      } as never)
    ).rejects.toThrow(erro);
  });

  it('envia o token no header Authorization', async () => {
    fetchDublado.mockResolvedValue(resposta(200, []));

    await apiDB.getClientes('u1');

    const [, init] = fetchDublado.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer token-de-teste');
  });

  it('não inventa header quando não há token', async () => {
    localStorage.clear();
    fetchDublado.mockResolvedValue(resposta(200, []));

    await apiDB.getClientes('u1');

    const [, init] = fetchDublado.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });
});

describe('respostas de erro incompletas', () => {
  it('usa o status quando o corpo não é JSON', async () => {
    fetchDublado.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('corpo vazio');
      },
      headers: new Headers(),
    } as unknown as Response);

    await expect(apiDB.getClientes('u1')).rejects.toThrow(/500|desconhecido/);
  });

  it('usa o status quando o corpo vem sem a chave error', async () => {
    fetchDublado.mockResolvedValue(resposta(502, { mensagem: 'bad gateway' }));

    await expect(apiDB.getClientes('u1')).rejects.toThrow('Erro HTTP: 502');
  });

  it('propaga a falha de rede em vez de devolver dado vazio', async () => {
    fetchDublado.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(apiDB.getClientes('u1')).rejects.toThrow('Failed to fetch');
  });

  it('404 vira null apenas onde o chamador pediu isso', async () => {
    fetchDublado.mockResolvedValue(resposta(404, { error: 'Cliente não encontrado' }));

    await expect(apiDB.getCliente('inexistente')).resolves.toBeNull();
  });

  it('404 continua sendo erro nas rotas de lista', async () => {
    fetchDublado.mockResolvedValue(resposta(404, { error: 'não encontrado' }));

    await expect(apiDB.getClientes('u1')).rejects.toThrow('não encontrado');
  });
});

describe('contrato do dashboard no cliente', () => {
  it('devolve o payload do servidor sem transformar', async () => {
    const payload = {
      financeiro: { receita_semana: 0, ticket_medio: 0, variacao_receita_pct: 0 },
      fidelizacao: { total_clientes_com_lavagem: 0 },
      clientes_ausentes: [],
      mix_servicos: [],
      estoque_critico: [],
      pagamentos: [],
      desempenho_operadores: [],
      tempo_atendimento: { total_finalizadas: 0, tempo_medio_min: 0 },
    };
    fetchDublado.mockResolvedValue(resposta(200, payload));

    await expect(getDashboardStats()).resolves.toEqual(payload);
  });

  it('rejeita quando as estatísticas falham, para a UI poder mostrar o banner', async () => {
    fetchDublado.mockResolvedValue(resposta(500, { error: 'Erro interno do servidor' }));

    await expect(getDashboardStats()).rejects.toThrow('Erro interno do servidor');
  });
});
