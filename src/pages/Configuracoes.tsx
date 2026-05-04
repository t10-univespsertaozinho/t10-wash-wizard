import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { isSupabaseConfigured, getSupabaseConfig, getSupabaseClient } from '@/lib/supabase';
import { isSupabaseActive } from '@/services/database';
import { Shield, Database, Key, CheckCircle, AlertTriangle, Save, RefreshCw, Cloud, ArrowLeftRight } from 'lucide-react';

interface SupabaseConfigForm {
  url: string;
  anonKey: string;
}

export default function Configuracoes() {
  const { user } = useAuth();
  const { syncStatus, lastSync, conflicts, hasPendingChanges, syncToSupabase, resolveConflict } = useApp();
  
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [dbType, setDbType] = useState<'localstorage' | 'supabase'>(() => {
    const envType = import.meta.env.VITE_DB_TYPE as string;
    const storageType = localStorage.getItem('t10_db_type') as string;
    const resolvedType = envType || storageType || 'localstorage';
    return (resolvedType === 'supabase' || resolvedType === 'firebase') ? 'supabase' : 'localstorage';
  });
  
  const [config, setConfig] = useState<SupabaseConfigForm>(() => {
    const currentConfig = getSupabaseConfig();
    return {
      url: currentConfig.url || '',
      anonKey: currentConfig.anonKey || '',
    };
  });

  const supabaseReady = isSupabaseConfigured();

  const validateConfig = (): string | null => {
    if (dbType === 'supabase') {
      if (!config.url || !config.url.startsWith('https://')) {
        return 'A URL do Supabase é obrigatória e deve ser válida (começar com https://)';
      }
      if (!config.anonKey || config.anonKey.length < 20) {
        return 'A Anon Key é obrigatória e deve ser válida';
      }
    }
    return null;
  };

  const handleSave = async () => {
    const error = validateConfig();
    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      localStorage.setItem('t10_db_type', dbType);
      
      if (dbType === 'supabase') {
        localStorage.setItem('t10_supabase_url', config.url);
        localStorage.setItem('t10_supabase_anonKey', config.anonKey);
      } else {
        localStorage.removeItem('t10_supabase_url');
        localStorage.removeItem('t10_supabase_anonKey');
      }

      setMessage({ type: 'success', text: 'Configurações salvas! Recarregue a página para aplicar as mudanças.' });
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch {
      setMessage({ type: 'error', text: 'Erro ao salvar configurações.' });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (dbType !== 'supabase') {
      setMessage({ type: 'error', text: 'Configure o Supabase primeiro.' });
      return;
    }

    setSaving(true);
    try {
      // Usa as configurações temporárias do formulário
      localStorage.setItem('t10_supabase_url', config.url);
      localStorage.setItem('t10_supabase_anonKey', config.anonKey);
      
      const tempDb = getSupabaseClient();
      const { error } = await tempDb.from('clientes').select('id').limit(1);
      
      if (error && error.code !== 'PGRST116') { // PGRST116 é no results, o que não é um erro de conexão
        throw error;
      }
      
      setMessage({ type: 'success', text: 'Conexão com Supabase verificada!' });
    } catch (e: unknown) {
      setMessage({ type: 'error', text: 'Não foi possível conectar ao Supabase. Verifique as credenciais.' });
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Você não tem acesso a esta página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-barlow-condensed font-bold text-2xl text-foreground">Configurações do Banco de Dados</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Escolha onde os dados serão salvos: no navegador (local) ou na nuvem (Supabase). 
          Recomendamos começar pelo modo local para testar.
        </p>
      </div>

      {/* Status Atual */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-barlow-condensed font-bold text-lg text-foreground mb-4 flex items-center gap-2">
          <Database size={18} /> Status do Banco de Dados
        </h2>
        <div className="flex items-center gap-3">
          {dbType === 'supabase' && supabaseReady ? (
            <>
              <CheckCircle className="text-success" size={20} />
              <span className="text-foreground font-semibold">Supabase (Ativo)</span>
            </>
          ) : dbType === 'localstorage' ? (
            <>
              <CheckCircle className="text-success" size={20} />
              <span className="text-foreground font-semibold">Modo Local (Ativo)</span>
              <span className="text-xs text-muted-foreground">
                Dados no navegador
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="text-primary" size={20} />
              <span className="text-foreground font-semibold">Supabase (Incompleto)</span>
            </>
          )}
        </div>
      </div>

      {/* Status de Sincronização - apenas se Supabase ativo */}
      {isSupabaseActive() && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-barlow-condensed font-bold text-lg text-foreground mb-4 flex items-center gap-2">
            <ArrowLeftRight size={18} /> Sincronização
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {syncStatus === 'synced' && (
                <span className="flex items-center gap-2 text-success">
                  <Cloud size={18} /> Sincronizado
                </span>
              )}
              {syncStatus === 'pending' && (
                <span className="flex items-center gap-2 text-yellow-500">
                  <RefreshCw size={18} className="animate-spin" /> Alterações pendentes
                </span>
              )}
              {syncStatus === 'conflict' && (
                <span className="flex items-center gap-2 text-destructive">
                  <AlertTriangle size={18} /> Conflitos detectados
                </span>
              )}
              
              {lastSync && (
                <span className="text-xs text-muted-foreground">
                  Última sync: {new Date(lastSync).toLocaleString('pt-BR')}
                </span>
              )}
            </div>

            {hasPendingChanges && (
              <p className="text-xs text-muted-foreground">
                Você tem alterações não sincronizadas. A sincronização ocorrerá automaticamente ao fechar a página.
              </p>
            )}

            <button
              onClick={async () => {
                setSyncing(true);
                setMessage(null);
                try {
                  const result = await syncToSupabase();
                  if (result.length > 0) {
                    setMessage({ type: 'error', text: `${result.length} conflito(s) detectado(s). Verifique abaixo.` });
                  } else {
                    setMessage({ type: 'success', text: 'Dados sincronizados com sucesso!' });
                  }
                } catch (e) {
                  setMessage({ type: 'error', text: 'Erro ao sincronizar. Tente novamente.' });
                } finally {
                  setSyncing(false);
                }
              }}
              disabled={syncing || !hasPendingChanges}
              className="bg-secondary text-secondary-foreground font-bold py-2 px-4 rounded-lg hover:brightness-110 transition-all text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {syncing ? <RefreshCw className="animate-spin" size={16} /> : <Cloud size={16} />}
              Sincronizar Agora
            </button>

            {/* Conflitos */}
            {conflicts.length > 0 && (
              <div className="mt-4 p-4 bg-destructive/10 rounded-lg border border-destructive/30">
                <h3 className="font-semibold text-destructive mb-2 flex items-center gap-2">
                  <AlertTriangle size={16} /> Conflitos Pendentes ({conflicts.length})
                </h3>
                <div className="space-y-2">
                  {conflicts.map((conflict, idx) => (
                    <div key={idx} className="text-sm bg-card p-3 rounded border border-border">
                      <div className="font-medium">
                        {conflict.entityType === 'cliente' && 'Cliente'}
                        {conflict.entityType === 'veiculo' && 'Veículo'}
                        {conflict.entityType === 'lavagem' && 'Lavagem'}
                        {conflict.entityType === 'produto' && 'Produto'}
                        {conflict.entityType === 'movimentacao' && 'Movimentação'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Local: {conflict.localUpdatedAt ? new Date(conflict.localUpdatedAt).toLocaleString('pt-BR') : 'N/A'} | 
                        Remoto: {conflict.remoteUpdatedAt ? new Date(conflict.remoteUpdatedAt).toLocaleString('pt-BR') : 'N/A'}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => resolveConflict(conflict.entityType, conflict.entityId, true)}
                          className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded"
                        >
                          Manter Local
                        </button>
                        <button
                          onClick={() => resolveConflict(conflict.entityType, conflict.entityId, false)}
                          className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded"
                        >
                          Manter Remoto
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tipo de Banco */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-barlow-condensed font-bold text-lg text-foreground mb-2 flex items-center gap-2">
          <Shield size={18} /> Escolha o Tipo de Armazenamento
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Isso define onde seus dados serão salvos. Você pode mudar a qualquer momento.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => {
              setDbType('localstorage');
              setMessage(null);
            }}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              dbType === 'localstorage'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="font-semibold text-foreground">💾 Modo Local</div>
            <div className="text-xs text-muted-foreground mt-1">
              <strong>Recomendado para uso offline.</strong> Os dados ficam salvos no seu navegador (localStorage). 
              Fácil de usar, mas os dados não sincronizam entre dispositivos.
            </div>
          </button>
          
          <button
            onClick={() => {
              setDbType('supabase');
              setMessage(null);
            }}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              dbType === 'supabase'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="font-semibold text-foreground">☁️ Supabase (Nuvem)</div>
            <div className="text-xs text-muted-foreground mt-1">
              <strong>Recomendado para produção.</strong> Os dados ficam salvos na nuvem (Supabase PostgreSQL). 
              Permite sincronização entre dispositivos.
            </div>
          </button>
        </div>
      </div>

      {/* Tutorial - mostra quando Supabase está selecionado */}
      {dbType === 'supabase' && (
        <div className="bg-primary/10 border-2 border-primary/30 rounded-xl p-5">
          <h2 className="font-barlow-condensed font-bold text-lg text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-primary" /> Como obter as credenciais
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Siga estes passos para configurar o Supabase:
          </p>
          <div className="text-sm text-foreground space-y-2 ml-1">
            <ol className="list-decimal list-inside space-y-2">
              <li className="bg-card p-2 rounded border border-border">
                Acesse o <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">Supabase Dashboard</a> e faça login
              </li>
              <li className="bg-card p-2 rounded border border-border">
                Crie um novo projeto ou selecione um existente
              </li>
              <li className="bg-card p-2 rounded border border-border">
                Vá em <strong>"Project Settings"</strong> (ícone de engrenagem)
              </li>
              <li className="bg-card p-2 rounded border border-border">
                Clique em <strong>"API"</strong>
              </li>
              <li className="bg-card p-2 rounded border border-border">
                Copie o <strong>Project URL</strong> e a <strong>anon public key</strong> e cole nos campos abaixo
              </li>
            </ol>
          </div>
        </div>
      )}

      {dbType === 'supabase' && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-barlow-condensed font-bold text-lg text-foreground mb-4 flex items-center gap-2">
            <Key size={18} /> Credenciais do Supabase
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">
                Project URL *
              </label>
              <input
                className="input-t10"
                type="text"
                value={config.url}
                onChange={e => setConfig({ ...config, url: e.target.value })}
                placeholder="https://xyz.supabase.co"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">
                Anon Public Key *
              </label>
              <input
                className="input-t10"
                type="text"
                value={config.anonKey}
                onChange={e => setConfig({ ...config, anonKey: e.target.value })}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              />
            </div>
          </div>
        </div>
      )}

      {/* Informações de Segurança */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-barlow-condensed font-bold text-lg text-foreground mb-4 flex items-center gap-2">
          <AlertTriangle size={18} className="text-primary" /> Informações de Segurança
        </h2>
        <ul className="text-sm text-muted-foreground space-y-2">
          <li>• As credenciais são armazenadas apenas no seu navegador local</li>
          <li>• Para apps em produção, recomenda-se usar variáveis de ambiente (.env)</li>
          <li>• Lembre-se de configurar as políticas de Row Level Security (RLS) no Supabase</li>
        </ul>
      </div>

      {/* Mensagem de Feedback */}
      {message && (
        <div className={`rounded-lg px-4 py-3 ${
          message.type === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
        }`}>
          {message.text}
        </div>
      )}

      {/* Botões de Ação */}
      <div className="flex flex-col md:flex-row gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-primary text-primary-foreground font-bold py-2.5 rounded-lg hover:brightness-110 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
          Salvar Configurações
        </button>

        {dbType === 'supabase' && (
          <button
            onClick={testConnection}
            disabled={saving || !config.url || !config.anonKey}
            className="flex-1 bg-secondary text-secondary-foreground font-bold py-2.5 rounded-lg hover:brightness-110 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            Testar Conexão
          </button>
        )}
      </div>
    </div>
  );
}