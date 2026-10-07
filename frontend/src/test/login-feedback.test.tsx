/**
 * Classificação das falhas de login (FA-11).
 *
 * Antes, 401, 429, 500 e queda de rede davam na mesma mensagem — "Email ou senha
 * inválidos" — mandando o usuário conferir uma senha que podia estar certa.
 * Estes testes fixam a tradução de cada status na mensagem correspondente.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { TOKEN_STORAGE_KEY } from '@/utils/security';

const resposta = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: new Headers(headers),
  }) as Response;

let fetchDublado: ReturnType<typeof vi.fn>;

async function montarAuth() {
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  // O provider verifica o token guardado no primeiro render; espera o fim disso
  // para não misturar esse fetch com o do login.
  await act(async () => {});
  return result;
}

beforeEach(() => {
  localStorage.clear();
  fetchDublado = vi.fn();
  vi.stubGlobal('fetch', fetchDublado);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('AuthContext.login', () => {
  it('classifica 401 como credenciais', async () => {
    fetchDublado.mockResolvedValue(resposta(401, { error: 'Email ou senha inválidos' }));
    const auth = await montarAuth();

    let retorno;
    await act(async () => {
      retorno = await auth.current.login('admin@teste.com', 'errada');
    });

    expect(retorno).toMatchObject({ sucesso: false, erro: 'credenciais' });
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('classifica 429 e devolve o Retry-After', async () => {
    fetchDublado.mockResolvedValue(
      resposta(429, { error: 'Muitas tentativas de login.' }, { 'Retry-After': '42' })
    );
    const auth = await montarAuth();

    let retorno;
    await act(async () => {
      retorno = await auth.current.login('admin@teste.com', 'x');
    });

    expect(retorno).toMatchObject({ sucesso: false, erro: 'rate_limit', retryAfter: 42 });
  });

  it('classifica 429 sem Retry-After, mantendo a mensagem do servidor', async () => {
    fetchDublado.mockResolvedValue(resposta(429, { error: 'Muitas tentativas de login.' }));
    const auth = await montarAuth();

    let retorno;
    await act(async () => {
      retorno = await auth.current.login('admin@teste.com', 'x');
    });

    expect(retorno).toMatchObject({ sucesso: false, erro: 'rate_limit' });
    expect(retorno.retryAfter).toBeUndefined();
    expect(retorno.detalhe).toBe('Muitas tentativas de login.');
  });

  it('classifica 500 como falha de servidor', async () => {
    fetchDublado.mockResolvedValue(resposta(500, { error: 'Erro interno do servidor' }));
    const auth = await montarAuth();

    let retorno;
    await act(async () => {
      retorno = await auth.current.login('admin@teste.com', 'x');
    });

    expect(retorno).toMatchObject({ sucesso: false, erro: 'servidor' });
  });

  it('classifica queda de rede, o caso do backend desligado', async () => {
    fetchDublado.mockRejectedValue(new TypeError('Failed to fetch'));
    const auth = await montarAuth();

    let retorno;
    await act(async () => {
      retorno = await auth.current.login('admin@teste.com', 'x');
    });

    expect(retorno).toMatchObject({ sucesso: false, erro: 'rede' });
  });

  it('guarda o token e o usuário no sucesso', async () => {
    fetchDublado.mockResolvedValue(
      resposta(200, {
        token: 'jwt-de-teste',
        user: { id: 'u1', nome: 'Admin', email: 'admin@teste.com', role: 'admin' },
      })
    );
    const auth = await montarAuth();

    let retorno;
    await act(async () => {
      retorno = await auth.current.login('admin@teste.com', 'certa');
    });

    expect(retorno).toEqual({ sucesso: true });
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('jwt-de-teste');
    expect(auth.current.isAuthenticated).toBe(true);
    expect(auth.current.user).toMatchObject({ role: 'admin' });
  });

  it('descarta o token guardado quando /auth/me o recusa', async () => {
    // Token revogado pelo backend (FA-06): a sessão não pode sobreviver no
    // localStorage, senão a UI mostra o usuário como logado.
    localStorage.setItem(TOKEN_STORAGE_KEY, 'token-revogado');
    fetchDublado.mockResolvedValue(resposta(401, { error: 'Perfil alterado. Faça login novamente.' }));

    const auth = await montarAuth();

    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(auth.current.isAuthenticated).toBe(false);
  });

  it('logout limpa a sessão', async () => {
    fetchDublado.mockResolvedValue(
      resposta(200, { token: 'jwt', user: { id: 'u1', nome: 'A', email: 'a@b.com', role: 'operador' } })
    );
    const auth = await montarAuth();
    await act(async () => {
      await auth.current.login('a@b.com', 'x');
    });

    await act(async () => {
      await auth.current.logout();
    });

    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(auth.current.isAuthenticated).toBe(false);
  });
});
