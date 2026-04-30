import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { isFirebaseConfigured, getFirebaseConfig } from '@/lib/firebase';
import { isFirebaseActive } from '@/services/database';
import { Shield, Database, Key, CheckCircle, AlertTriangle, Save, Eye, EyeOff, RefreshCw, Cloud, CloudOff, ArrowLeftRight } from 'lucide-react';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export default function Configuracoes() {
  const { user } = useAuth();
  const { syncStatus, lastSync, conflicts, hasPendingChanges, syncToFirebase, resolveConflict } = useApp();
  const navigate = useNavigate();
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dbType, setDbType] = useState<'localstorage' | 'firebase'>(() => {
    const envType = import.meta.env.VITE_DB_TYPE as 'localstorage' | 'firebase';
    const storageType = localStorage.getItem('t10_db_type') as 'localstorage' | 'firebase';
    return envType || storageType || 'localstorage';
  });
  
  const [config, setConfig] = useState<FirebaseConfig>(() => {
    const currentConfig = getFirebaseConfig();
    return {
      apiKey: currentConfig.apiKey || '',
      authDomain: currentConfig.authDomain || '',
      projectId: currentConfig.projectId || '',
      storageBucket: currentConfig.storageBucket || '',
      messagingSenderId: currentConfig.messagingSenderId || '',
      appId: currentConfig.appId || '',
    };
  });


  const firebaseReady = isFirebaseConfigured();

  const isValidUrl = (value: string) => {
    if (!value) return true;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };

  const isValidProjectId = (value: string) => {
    if (!value) return true;
    return /^[a-z0-9-]+$/.test(value);
  };

  const isValidSenderId = (value: string) => {
    if (!value) return true;
    return /^\d+$/.test(value);
  };

  const validateConfig = (): string | null => {
    if (dbType === 'firebase') {
      if (!config.apiKey || config.apiKey.length < 10) {
        return 'A API Key é obrigatória e deve ter pelo menos 10 caracteres';
      }
      if (!config.authDomain || !isValidUrl(config.authDomain)) {
        return 'O Auth Domain deve ser uma URL válida';
      }
      if (!config.projectId || !isValidProjectId(config.projectId)) {
        return 'O Project ID deve conter apenas letras minúsculas, números e hífens';
      }
      if (!config.appId || config.appId.length < 10) {
        return 'O App ID é obrigatório';
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
      
      if (dbType === 'firebase') {
        localStorage.setItem('t10_firebase_apiKey', config.apiKey);
        localStorage.setItem('t10_firebase_authDomain', config.authDomain);
        localStorage.setItem('t10_firebase_projectId', config.projectId);
        localStorage.setItem('t10_firebase_storageBucket', config.storageBucket);
        localStorage.setItem('t10_firebase_messagingSenderId', config.messagingSenderId);
        localStorage.setItem('t10_firebase_appId', config.appId);
      } else {
        localStorage.removeItem('t10_firebase_apiKey');
        localStorage.removeItem('t10_firebase_authDomain');
        localStorage.removeItem('t10_firebase_projectId');
        localStorage.removeItem('t10_firebase_storageBucket');
        localStorage.removeItem('t10_firebase_messagingSenderId');
        localStorage.removeItem('t10_firebase_appId');
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
    if (dbType !== 'firebase') {
      setMessage({ type: 'error', text: 'Configure o Firebase primeiro.' });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`https://${config.projectId}.firebaseio.com/.json`, {
        method: 'GET',
      });
      
      if (response.ok || response.status === 401) {
        setMessage({ type: 'success', text: 'Conexão com Firebase verificada!' });
      } else {
        setMessage({ type: 'error', text: 'Não foi possível conectar ao Firebase. Verifique as credenciais.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro de conexão. Verifique a internet e as credenciais.' });
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
          Escolha onde os dados serão salvos: no navegador (local) ou na nuvem (Firebase). 
          Recomendamos começar pelo modo local para testar.
        </p>
      </div>

      {/* Status Atual */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-barlow-condensed font-bold text-lg text-foreground mb-4 flex items-center gap-2">
          <Database size={18} /> Status do Banco de Dados
        </h2>
        <div className="flex items-center gap-3">
          {dbType === 'firebase' && firebaseReady ? (
            <>
              <CheckCircle className="text-success" size={20} />
              <span className="text-foreground font-semibold">Firebase (Ativo)</span>
              <span className="text-xs text-muted-foreground">
                Projeto: {config.projectId || 'não configurado'}
              </span>
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
              <span className="text-foreground font-semibold">Firebase (Parcial)</span>
            </>
          )}
        </div>
      </div>

      {/* Status de Sincronização - apenas se Firebase ativo */}
      {isFirebaseActive() && (
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
                  const result = await syncToFirebase();
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
              <strong>Recomendado para testes.</strong> Os dados ficam salvos no seu navegador (localStorage). 
              Fácil de usar, mas os dados não sincronizam entre dispositivos.
            </div>
          </button>
          
          <button
            onClick={() => {
              setDbType('firebase');
              setMessage(null);
            }}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              dbType === 'firebase'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="font-semibold text-foreground">☁️ Firebase (Nuvem)</div>
            <div className="text-xs text-muted-foreground mt-1">
              <strong>Recomendado para uso real.</strong> Os dados ficam salvos na nuvem do Google (Firebase). 
              Permite múltiplos usuários e acesso de qualquer dispositivo.
            </div>
          </button>
        </div>
      </div>

      {/* Tutorial - mostra quando Firebase está selecionado */}
      {dbType === 'firebase' && (
        <div className="bg-primary/10 border-2 border-primary/30 rounded-xl p-5">
          <h2 className="font-barlow-condensed font-bold text-lg text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-primary" /> Como obter as credenciais
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Siga estes passos para configurar o Firebase:
          </p>
          <div className="text-sm text-foreground space-y-2 ml-1">
            <ol className="list-decimal list-inside space-y-2">
              <li className="bg-card p-2 rounded border border-border">
                Acesse o <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">Firebase Console</a> e faça login
              </li>
              <li className="bg-card p-2 rounded border border-border">
                Clique em <strong>"Criar projeto"</strong> ou selecione um projeto existente
              </li>
              <li className="bg-card p-2 rounded border border-border">
                No menu (≡), clique em <strong>"Configurações do projeto"</strong>
              </li>
              <li className="bg-card p-2 rounded border border-border">
                Role até <strong>"Seus apps"</strong> e clique em <strong>"&lt;/&gt;"</strong> (Web)
              </li>
              <li className="bg-card p-2 rounded border border-border">
                Dê um nome ao app e clique em <strong>"Registrar app"</strong>
              </li>
              <li className="bg-card p-2 rounded border border-border">
                Copie os valores do SDK e cole nos campos abaixo
              </li>
            </ol>
          </div>
        </div>
      )}

      {dbType === 'firebase' && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-barlow-condensed font-bold text-lg text-foreground mb-4 flex items-center gap-2">
            <Key size={18} /> Credenciais do Firebase
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">
                API Key *
              </label>
              <input
                className="input-t10"
                type="text"
                value={config.apiKey}
                onChange={e => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="AIzaSy..."
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">
                Auth Domain *
              </label>
              <input
                className="input-t10"
                type="text"
                value={config.authDomain}
                onChange={e => setConfig({ ...config, authDomain: e.target.value })}
                placeholder="meu-projeto.firebaseapp.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                O domínio configurado no Firebase Authentication
              </p>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">
                Project ID *
              </label>
              <input
                className="input-t10"
                type="text"
                value={config.projectId}
                onChange={e => setConfig({ ...config, projectId: e.target.value.toLowerCase() })}
                placeholder="meu-projeto"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">
                App ID
              </label>
              <input
                className="input-t10"
                type="text"
                value={config.appId}
                onChange={e => setConfig({ ...config, appId: e.target.value })}
                placeholder="1:123456789:web:abc123..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">
                  Storage Bucket
                </label>
                <input
                  className="input-t10"
                  type="text"
                  value={config.storageBucket}
                  onChange={e => setConfig({ ...config, storageBucket: e.target.value })}
                  placeholder="meu-projeto.appspot.com"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">
                  Messaging Sender ID
                </label>
                <input
                  className="input-t10"
                  type="text"
                  value={config.messagingSenderId}
                  onChange={e => setConfig({ ...config, messagingSenderId: e.target.value })}
                  placeholder="123456789"
                />
              </div>
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
          <li>• Os dados são criptografados antes de serem enviados ao Firebase</li>
          <li>• Para apps em produção, recomenda-se usar variáveis de ambiente (.env)</li>
          <li>• O Project ID deve ser único globalmente (não é possível alterá-lo depois)</li>
          <li>• Após configurar, atualize as regras de segurança no Firebase Console</li>
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

        {dbType === 'firebase' && (
          <button
            onClick={testConnection}
            disabled={saving || !config.projectId}
            className="flex-1 bg-secondary text-secondary-foreground font-bold py-2.5 rounded-lg hover:brightness-110 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            Testar Conexão
          </button>
        )}
      </div>
    </div>
  );
}

      