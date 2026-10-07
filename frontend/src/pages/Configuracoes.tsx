import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { exportBackup, importBackup, resetDatabase } from '@/services/database';
import { Shield, Database, AlertTriangle, Save, RefreshCw, UploadCloud, DownloadCloud, Trash2 } from 'lucide-react';

/**
 * Extrai uma mensagem exibível de um `catch`.
 *
 * `unknown` em vez de `any`: `any` desligaria a checagem de tipo justamente no
 * ponto onde o valor é menos previsível — o `throw` pode ser qualquer coisa.
 * `e.message` num `any` passava sem reclamar, mas um `throw 'texto solto'` ou um
 * `throw { codigo: 500 }` quebrariam a tela em branco num `catch` que devia
 * justamente ser o caminho seguro.
 */
function mensagemDeErro(e: unknown, padrao: string): string {
  if (e instanceof Error && e.message) return e.message;
  // Erros de outra realm (iframe, worker) falham no `instanceof`; tenta ler o campo.
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const { message } = e as { message?: unknown };
    if (typeof message === 'string' && message) return message;
  }
  return padrao;
}

/**
 * Credenciais provisórias devolvidas pelo import de backup.
 *
 * O backup nunca carrega hashes de senha (ver SECURITY.md), então cada usuário
 * restaurado recebe uma senha aleatória. Elas aparecem UMA única vez, aqui:
 * sem exibi-las, o próprio admin ficaria trancado fora após restaurar
 * `users.csv`.
 */
interface SenhaTemporaria {
  email: string;
  senha_temporaria: string;
}

export default function Configuracoes() {
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [senhasTemporarias, setSenhasTemporarias] = useState<SenhaTemporaria[]>([]);

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-secondary-foreground">Você não tem acesso a esta página.</p>
      </div>
    );
  }

  const handleExportBackup = async () => {
    setLoading(true);
    setMessage(null);
    setSenhasTemporarias([]);
    try {
      const data = await exportBackup();
      // Criar zip ou baixar multiplos arquivos.
      // Para simplificar, o servidor retorna um objeto com os CSVs: { users: "...", clientes: "..." }
      // Vamos baixar um a um, ou pedir para o usuário
      for (const [table, csv] of Object.entries(data)) {
        if (!csv) continue;
        const blob = new Blob([csv as string], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${table}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      setMessage({ type: 'success', text: 'Backup exportado com sucesso!' });
    } catch (e: unknown) {
      setMessage({ type: 'error', text: mensagemDeErro(e, 'Erro ao exportar backup.') });
    } finally {
      setLoading(false);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!window.confirm('Atenção: A importação de backup VAI APAGAR TODOS OS DADOS ATUAIS. Tem certeza?')) {
      e.target.value = '';
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const res = await importBackup(formData);
      const senhas: SenhaTemporaria[] = res.senhas_temporarias ?? [];
      setSenhasTemporarias(senhas);
      setMessage({ type: 'success', text: `Backup importado! ${res.records} registros restaurados.` });

      // Se usuários foram restaurados, as senhas provisórias precisam ser
      // anotadas antes de qualquer reload — então não recarregamos a página.
      if (senhas.length === 0) {
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (e: unknown) {
      setMessage({ type: 'error', text: mensagemDeErro(e, 'Erro ao importar backup.') });
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleResetDatabase = async () => {
    if (!window.confirm('CUIDADO: Você está prestes a DELETAR TODOS OS DADOS. Esta ação é irreversível. Deseja continuar?')) {
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      await resetDatabase();
      setMessage({ type: 'success', text: 'Banco de dados resetado com sucesso!' });
      setTimeout(() => window.location.reload(), 2000);
    } catch (e: unknown) {
      setMessage({ type: 'error', text: mensagemDeErro(e, 'Erro ao resetar banco de dados.') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Configurações do Sistema</h2>
        <p className="text-base font-medium text-secondary-foreground mt-1">
          Gerencie o banco de dados local SQLite e realize backups via arquivos CSV.
        </p>
      </div>

      {/* Status Atual */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="font-barlow-condensed font-bold text-lg text-foreground mb-4 flex items-center gap-2">
          <Database size={18} /> Conexão com o Banco de Dados
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-success font-semibold flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse"></div>
            SQLite Local (Conectado via API)
          </span>
          <span className="text-sm font-medium text-secondary-foreground">
            {import.meta.env.VITE_API_URL || '/api (Proxy Local)'}
          </span>
        </div>
      </div>

      {/* Ferramentas de Backup */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="font-barlow-condensed font-bold text-lg text-foreground mb-4 flex items-center gap-2">
          <Shield size={18} /> Backup CSV (Importação / Exportação)
        </h2>
        
        <div className="space-y-4">
          <p className="text-sm font-medium text-secondary-foreground">
            O CSV é usado apenas para backup. Não modifique a estrutura dos arquivos exportados para garantir a consistência no momento da importação.
          </p>
          
          <div className="flex flex-col md:flex-row gap-3">
            <button
              onClick={handleExportBackup}
              disabled={loading}
              className="flex-1 bg-primary text-primary-foreground font-semibold h-12 rounded-lg hover:brightness-110 transition-all text-base flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="animate-spin" size={18} /> : <DownloadCloud size={18} />}
              Exportar Backup (CSV)
            </button>

            <label
              htmlFor="import-backup-csv"
              className="flex-1 bg-secondary text-secondary-foreground font-semibold h-12 rounded-lg hover:brightness-110 transition-all text-base flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer focus-within:ring-2 focus-within:ring-[hsl(var(--focus-ring))] focus-within:ring-offset-2 focus-within:ring-offset-background"
            >
              <span aria-hidden="true" className="inline-flex">
                {loading ? <RefreshCw className="animate-spin" size={18} /> : <UploadCloud size={18} />}
              </span>
              Importar Backup (CSV)
              <input 
                id="import-backup-csv"
                type="file" 
                multiple 
                accept=".csv" 
                className="sr-only"
                onChange={handleImportBackup}
                disabled={loading}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Senhas provisórias do import — exibidas uma única vez */}
      {senhasTemporarias.length > 0 && (
        <div
          className="bg-amber-500/10 border-2 border-amber-500/40 rounded-xl p-5"
          role="alert"
          aria-live="assertive"
        >
          <h2 className="font-barlow-condensed font-bold text-lg mb-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle size={18} aria-hidden="true" /> Anote as senhas provisórias agora
          </h2>
          <p className="text-sm font-medium text-secondary-foreground mb-3">
            Por segurança, o arquivo de backup não contém senhas. Cada usuário restaurado
            recebeu uma senha provisória, exibida <strong>somente agora</strong>. Anote-as e
            troque-as no primeiro acesso — ao sair desta tela elas não poderão ser recuperadas.
          </p>
          <ul className="space-y-1.5">
            {senhasTemporarias.map((s) => (
              <li
                key={s.email}
                className="flex flex-wrap items-center justify-between gap-2 bg-background/60 rounded-lg px-3 py-2"
              >
                <span className="text-sm">{s.email}</span>
                <code className="font-mono text-sm font-bold select-all">{s.senha_temporaria}</code>
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              setSenhasTemporarias([]);
              window.location.reload();
            }}
            className="mt-4 bg-amber-600 text-white font-bold h-12 px-6 rounded-lg hover:brightness-110 transition-all text-base"
          >
            Já anotei, recarregar
          </button>
        </div>
      )}

      {/* Reset DB */}
      <div className="bg-destructive/10 border-2 border-destructive/30 rounded-xl p-6">
        <h2 className="font-barlow-condensed font-bold text-lg text-destructive mb-3 flex items-center gap-2">
          <AlertTriangle size={18} /> Zona de Perigo
        </h2>
        <p className="text-sm text-destructive/80 mb-4 font-medium">
          A exclusão do banco de dados removerá todos os clientes, veículos, lavagens e configurações. Faça um backup antes!
        </p>
        <button
          onClick={handleResetDatabase}
          disabled={loading}
          className="bg-destructive text-destructive-foreground font-bold h-12 px-6 rounded-lg hover:brightness-110 transition-all text-base flex items-center gap-2 disabled:opacity-50"
        >
          <Trash2 size={16} />
          Resetar Banco de Dados
        </button>
      </div>

      {/* Mensagem de Feedback */}
      {message && (
        <div
          role={message.type === 'error' ? 'alert' : 'status'}
          aria-live={message.type === 'error' ? 'assertive' : 'polite'}
          className={`rounded-lg px-4 py-3 ${
            message.type === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}