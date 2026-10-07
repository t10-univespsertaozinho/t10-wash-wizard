import React, { useState } from 'react';
import { useAuth, type LoginResult } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Cada causa de falha pede uma ação diferente do usuário: corrigir a senha,
// esperar o bloqueio passar ou avisar quem cuida do servidor (FA-11).
function mensagemDeFalha({ erro, detalhe, retryAfter }: LoginResult): string {
  switch (erro) {
    case 'rate_limit':
      return retryAfter
        ? `Muitas tentativas de login. Aguarde ${retryAfter}s e tente novamente.`
        : detalhe || 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.';
    case 'servidor':
      return 'O servidor respondeu com erro. Tente novamente em instantes ou avise o responsável pelo sistema.';
    case 'rede':
      return 'Não foi possível falar com o servidor. Verifique sua conexão — se o problema persistir, o backend pode estar fora do ar.';
    default:
      return 'Email ou senha inválidos';
  }
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');

    try {
      const resultado = await login(email, senha);

      if (resultado.sucesso) {
        navigate('/');
      } else {
        setErro(mensagemDeFalha(resultado));
      }
    } catch (err) {
      console.error('Falha inesperada no login:', err);
      setErro('Ocorreu uma falha inesperada ao entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * WCAG 2.2.1: a mensagem de erro nao pode ter prazo. Antes ela sumia sozinha
   * em 4s, e quem usa leitor de tela, lupa ou teclado demorava mais que isso
   * para achar o campo e corrigir — o alerta era anunciado e ja havia sumido
   * quando o usuario chegava nele.
   *
   * O erro so sai da tela quando ele deixa de valer: uma nova submissao limpa o
   * estado (`setErro('')` em `handleSubmit`) e mexer em e-mail ou senha tambem,
   * sinalizando que o valor digitado mudou e o erro anterior nao se aplica.
   */
  const limparErro = () => {
    if (erro) setErro('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-barlow-condensed font-extrabold text-primary tracking-tight">
            T10 🚗
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">Lava Rápido — Serrana/SP</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-card rounded-xl p-8 border border-border space-y-5">
          {erro && (
            <div
              id="login-erro"
              role="alert"
              aria-live="assertive"
              className="badge-cancelada text-sm rounded-lg px-4 py-2 text-center"
            >
              {erro}
            </div>
          )}
          <div>
            <label htmlFor="login-email" className="block text-sm uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Email</label>
            <input 
              id="login-email"
              name="email"
              autoComplete="email"
              className="input-t10" 
              value={email} 
              onChange={e => { setEmail(e.target.value); limparErro(); }} 
              placeholder="admin@washwizard.com" 
              type="email"
              aria-invalid={erro ? true : undefined}
              aria-describedby={erro ? 'login-erro' : undefined}
              required
            />
          </div>
          <div>
            <label htmlFor="login-senha" className="block text-sm uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Senha</label>
            <input 
              id="login-senha"
              name="senha"
              autoComplete="current-password"
              className="input-t10" 
              type="password" 
              value={senha} 
              onChange={e => { setSenha(e.target.value); limparErro(); }} 
              placeholder="••••••••" 
              aria-invalid={erro ? true : undefined}
              aria-describedby={erro ? 'login-erro' : undefined}
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-primary text-primary-foreground font-semibold h-12 rounded-lg hover:brightness-110 transition-all text-base disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
