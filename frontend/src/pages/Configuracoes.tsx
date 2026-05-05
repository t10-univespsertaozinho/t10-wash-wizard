import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { exportBackup, importBackup, resetDatabase } from '@/services/database';
import { Shield, Database, AlertTriangle, Save, RefreshCw, UploadCloud, DownloadCloud, Trash2 } from 'lucide-react';

export default function Configuracoes() {
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Você não tem acesso a esta página.</p>
      </div>
    );
  }

  const handleExportBackup = async () => {
    setLoading(true);
    setMessage(null);
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
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Erro ao exportar backup.' });
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
      setMessage({ type: 'success', text: `Backup importado! ${res.records} registros restaurados.` });
      // Recarregar a página após alguns segundos para refletir os novos dados
      setTimeout(() => window.location.reload(), 2000);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Erro ao importar backup.' });
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
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Erro ao resetar banco de dados.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-barlow-condensed font-bold text-2xl text-foreground">Configurações do Sistema</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie o banco de dados local SQLite e realize backups via arquivos CSV.
        </p>
      </div>

      {/* Status Atual */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-barlow-condensed font-bold text-lg text-foreground mb-4 flex items-center gap-2">
          <Database size={18} /> Conexão com o Banco de Dados
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-success font-semibold flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse"></div>
            SQLite Local (Conectado via API)
          </span>
          <span className="text-xs text-muted-foreground">
            {import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}
          </span>
        </div>
      </div>

      {/* Ferramentas de Backup */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-barlow-condensed font-bold text-lg text-foreground mb-4 flex items-center gap-2">
          <Shield size={18} /> Backup CSV (Importação / Exportação)
        </h2>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O CSV é usado apenas para backup. Não modifique a estrutura dos arquivos exportados para garantir a consistência no momento da importação.
          </p>
          
          <div className="flex flex-col md:flex-row gap-3">
            <button
              onClick={handleExportBackup}
              disabled={loading}
              className="flex-1 bg-primary text-primary-foreground font-bold py-2.5 rounded-lg hover:brightness-110 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="animate-spin" size={16} /> : <DownloadCloud size={16} />}
              Exportar Backup (CSV)
            </button>

            <label className="flex-1 bg-secondary text-secondary-foreground font-bold py-2.5 rounded-lg hover:brightness-110 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
              {loading ? <RefreshCw className="animate-spin" size={16} /> : <UploadCloud size={16} />}
              Importar Backup (CSV)
              <input 
                type="file" 
                multiple 
                accept=".csv" 
                className="hidden" 
                onChange={handleImportBackup}
                disabled={loading}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Reset DB */}
      <div className="bg-destructive/10 border-2 border-destructive/30 rounded-xl p-5">
        <h2 className="font-barlow-condensed font-bold text-lg text-destructive mb-3 flex items-center gap-2">
          <AlertTriangle size={18} /> Zona de Perigo
        </h2>
        <p className="text-sm text-destructive/80 mb-4 font-medium">
          A exclusão do banco de dados removerá todos os clientes, veículos, lavagens e configurações. Faça um backup antes!
        </p>
        <button
          onClick={handleResetDatabase}
          disabled={loading}
          className="bg-destructive text-destructive-foreground font-bold py-2 px-4 rounded-lg hover:brightness-110 transition-all text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <Trash2 size={16} />
          Resetar Banco de Dados
        </button>
      </div>

      {/* Mensagem de Feedback */}
      {message && (
        <div className={`rounded-lg px-4 py-3 ${
          message.type === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
        }`}>
          {message.text}
        </div>
      )}
    </div>
  );
}