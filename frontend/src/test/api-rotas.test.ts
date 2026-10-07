/**
 * Mapa de rotas do cliente HTTP (src/services/database.ts).
 *
 * Cada método vira um verbo + caminho que precisa casar com o que o Express
 * expõe. Trocar um `PUT` por `POST` ou errar o caminho é um bug silencioso: o
 * backend responde 404/405 e a UI, agora com try/catch, mostra "não foi possível
 * salvar" sem dizer por quê. Este teste trava o contrato dos dois lados.
 *
 * As rotas administrativas aparecem aqui de propósito: elas são as que o
 * backend protegeu com `requireAdmin` (FA-03), e é por este caminho que o 403
 * chega à tela.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  apiDB,
  exportBackup,
  getDashboardStats,
  getDatabase,
  importBackup,
  resetDatabase,
} from '@/services/database';
import { TOKEN_STORAGE_KEY } from '@/utils/security';

let fetchDublado: ReturnType<typeof vi.fn>;

const ok = (body: unknown = {}) =>
  ({ ok: true, status: 200, json: async () => body, headers: new Headers() }) as Response;

beforeEach(() => {
  localStorage.setItem(TOKEN_STORAGE_KEY, 'token-de-teste');
  fetchDublado = vi.fn().mockResolvedValue(ok());
  vi.stubGlobal('fetch', fetchDublado);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

/** Devolve [caminho, método, corpo] da última chamada ao fetch. */
function ultimaChamada() {
  const [url, init] = fetchDublado.mock.calls.at(-1)!;
  return {
    url: String(url),
    metodo: init?.method ?? 'GET',
    corpo: init?.body ? JSON.parse(String(init.body)) : undefined,
  };
}

describe('getDatabase', () => {
  it('devolve a implementação HTTP', () => {
    expect(getDatabase()).toBe(apiDB);
  });

  it('initialize não faz chamada de rede', async () => {
    await apiDB.initialize();
    expect(fetchDublado).not.toHaveBeenCalled();
  });
});

describe('clientes', () => {
  it('GET da lista filtra por usuário', async () => {
    await apiDB.getClientes('u1');
    expect(ultimaChamada()).toMatchObject({ url: '/api/clientes?user_id=u1', metodo: 'GET' });
  });

  it('GET individual', async () => {
    await apiDB.getCliente('cli-1');
    expect(ultimaChamada().url).toBe('/api/clientes/cli-1');
  });

  it('POST envia o user_id junto do corpo', async () => {
    await apiDB.createCliente('u1', { nome: 'Alice', telefone: '(16) 99999-0000' } as never);
    const { url, metodo, corpo } = ultimaChamada();
    expect({ url, metodo }).toEqual({ url: '/api/clientes', metodo: 'POST' });
    expect(corpo).toMatchObject({ nome: 'Alice', user_id: 'u1' });
  });

  it('PUT envia só os campos alterados', async () => {
    await apiDB.updateCliente('cli-1', { nome: 'Alice Souza' });
    expect(ultimaChamada()).toMatchObject({
      url: '/api/clientes/cli-1',
      metodo: 'PUT',
      corpo: { nome: 'Alice Souza' },
    });
  });

  it('DELETE usa o verbo DELETE (rota restrita a admin)', async () => {
    await apiDB.deleteCliente('cli-1');
    expect(ultimaChamada()).toMatchObject({ url: '/api/clientes/cli-1', metodo: 'DELETE' });
  });
});

describe('veiculos', () => {
  it('GET por usuário e por cliente usam filtros distintos', async () => {
    await apiDB.getVeiculos('u1');
    expect(ultimaChamada().url).toBe('/api/veiculos?user_id=u1');

    await apiDB.getVeiculosByCliente('cli-1');
    expect(ultimaChamada().url).toBe('/api/veiculos?cliente_id=cli-1');
  });

  it('POST, PUT e DELETE', async () => {
    await apiDB.createVeiculo('u1', { cliente_id: 'cli-1', modelo: 'Gol', placa: 'ABC1D23' } as never);
    expect(ultimaChamada()).toMatchObject({ url: '/api/veiculos', metodo: 'POST' });

    await apiDB.updateVeiculo('vei-1', { placa: 'XYZ9876' });
    expect(ultimaChamada()).toMatchObject({ url: '/api/veiculos/vei-1', metodo: 'PUT' });

    await apiDB.deleteVeiculo('vei-1');
    expect(ultimaChamada()).toMatchObject({ url: '/api/veiculos/vei-1', metodo: 'DELETE' });
  });
});

describe('lavagens', () => {
  it('GET por usuário e por cliente', async () => {
    await apiDB.getLavagens('u1');
    expect(ultimaChamada().url).toBe('/api/lavagens?user_id=u1');

    await apiDB.getLavagensByCliente('cli-1');
    expect(ultimaChamada().url).toBe('/api/lavagens?cliente_id=cli-1');
  });

  it('POST não envia data_conclusao: ela é do servidor (FA-01)', async () => {
    await apiDB.createLavagem('u1', {
      cliente_id: 'cli-1',
      veiculo_id: 'vei-1',
      tipo_lavagem_id: 'tl-1',
      status: 'pendente',
      valor: 25,
      pagamento: 'PIX',
      observacao: '',
    } as never);

    const { corpo } = ultimaChamada();
    expect(corpo).not.toHaveProperty('data_conclusao');
    expect(corpo).toMatchObject({ status: 'pendente', user_id: 'u1' });
  });

  it('PUT de status envia apenas o status', async () => {
    await apiDB.updateLavagem('lav-1', { status: 'concluida' });
    expect(ultimaChamada()).toMatchObject({
      url: '/api/lavagens/lav-1',
      metodo: 'PUT',
      corpo: { status: 'concluida' },
    });
  });

  it('DELETE usa o verbo DELETE (rota restrita a admin)', async () => {
    await apiDB.deleteLavagem('lav-1');
    expect(ultimaChamada()).toMatchObject({ url: '/api/lavagens/lav-1', metodo: 'DELETE' });
  });
});

describe('tipos de lavagem', () => {
  it('usa o caminho com hífen esperado pelo backend', async () => {
    await apiDB.getTiposLavagem();
    expect(ultimaChamada().url).toBe('/api/tipos-lavagem');

    await apiDB.createTipoLavagem({ nome: 'Simples', preco: 25 } as never);
    expect(ultimaChamada()).toMatchObject({ url: '/api/tipos-lavagem', metodo: 'POST' });

    await apiDB.updateTipoLavagem('tl-1', { preco: 30 });
    expect(ultimaChamada()).toMatchObject({ url: '/api/tipos-lavagem/tl-1', metodo: 'PUT' });

    await apiDB.deleteTipoLavagem('tl-1');
    expect(ultimaChamada()).toMatchObject({ url: '/api/tipos-lavagem/tl-1', metodo: 'DELETE' });
  });
});

describe('produtos e movimentações', () => {
  it('produtos: lista, criação, edição e exclusão', async () => {
    await apiDB.getProdutos('u1');
    expect(ultimaChamada().url).toBe('/api/produtos?user_id=u1');

    await apiDB.createProduto('u1', { nome: 'Shampoo', quantidade: 10 } as never);
    expect(ultimaChamada()).toMatchObject({ url: '/api/produtos', metodo: 'POST' });

    await apiDB.updateProduto('prod-1', { quantidade: 5 });
    expect(ultimaChamada()).toMatchObject({ url: '/api/produtos/prod-1', metodo: 'PUT' });

    await apiDB.deleteProduto('prod-1');
    expect(ultimaChamada()).toMatchObject({ url: '/api/produtos/prod-1', metodo: 'DELETE' });
  });

  it('movimentações aceitam quantidade decimal (FA-13)', async () => {
    await apiDB.getMovimentacoes('u1');
    expect(ultimaChamada().url).toBe('/api/movimentacoes?user_id=u1');

    await apiDB.createMovimentacao('u1', { produto_id: 'prod-1', tipo: 'saida', quantidade: 0.4 } as never);
    const { url, metodo, corpo } = ultimaChamada();
    expect({ url, metodo }).toEqual({ url: '/api/movimentacoes', metodo: 'POST' });
    // O valor precisa chegar inteiro ao backend: o truncamento era o bug.
    expect(corpo.quantidade).toBe(0.4);
  });

  it('createMovimentacaoWithUpdate usa a mesma rota', async () => {
    await apiDB.createMovimentacaoWithUpdate('u1', { produto_id: 'prod-1', tipo: 'entrada', quantidade: 2 } as never);
    expect(ultimaChamada()).toMatchObject({ url: '/api/movimentacoes', metodo: 'POST' });
  });
});

describe('backup e analytics (rotas de admin)', () => {
  it('export é GET', async () => {
    await exportBackup();
    expect(ultimaChamada()).toMatchObject({ url: '/api/backup/export', metodo: 'GET' });
  });

  it('reset é POST', async () => {
    await resetDatabase();
    expect(ultimaChamada()).toMatchObject({ url: '/api/backup/reset', metodo: 'POST' });
  });

  it('import envia FormData sem forçar Content-Type', async () => {
    const formData = new FormData();
    formData.append('clientes.csv', new Blob(['id,nome\n']), 'clientes.csv');

    await importBackup(formData);

    const [url, init] = fetchDublado.mock.calls.at(-1)!;
    expect(String(url)).toBe('/api/backup/import');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    // Definir Content-Type à mão quebraria o boundary do multipart.
    expect(init.headers).not.toHaveProperty('Content-Type');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token-de-teste' });
  });

  it('import sem token não manda header de autorização', async () => {
    localStorage.clear();
    await importBackup(new FormData());

    const [, init] = fetchDublado.mock.calls.at(-1)!;
    expect(init.headers).toBeUndefined();
  });

  it('import propaga o erro do servidor', async () => {
    fetchDublado.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'clientes.csv, linha 3, coluna "id": valor obrigatório está vazio.' }),
      headers: new Headers(),
    } as unknown as Response);

    await expect(importBackup(new FormData())).rejects.toThrow('linha 3');
  });

  it('import sem corpo JSON cai no status', async () => {
    fetchDublado.mockResolvedValue({
      ok: false,
      status: 413,
      json: async () => {
        throw new Error('sem corpo');
      },
      headers: new Headers(),
    } as unknown as Response);

    await expect(importBackup(new FormData())).rejects.toThrow(/413|desconhecido/);
  });

  it('dashboard é GET em /dashboard/stats', async () => {
    await getDashboardStats();
    expect(ultimaChamada()).toMatchObject({ url: '/api/dashboard/stats', metodo: 'GET' });
  });
});
