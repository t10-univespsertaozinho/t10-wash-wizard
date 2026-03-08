import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(usuario, senha)) {
      navigate('/');
    } else {
      setErro('Usuário ou senha inválidos');
      setTimeout(() => setErro(''), 4000);
    }
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
            <div className="badge-cancelada text-sm rounded-lg px-4 py-2 text-center">{erro}</div>
          )}
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Usuário</label>
            <input className="input-t10" value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="admin" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Senha</label>
            <input className="input-t10" type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••" />
          </div>
          <button type="submit" className="w-full bg-primary text-primary-foreground font-bold py-2.5 rounded-lg hover:brightness-110 transition-all text-sm">
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
