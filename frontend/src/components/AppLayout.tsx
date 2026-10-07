import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { NavLink } from '@/components/NavLink';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useModal } from '@/contexts/ModalContext';
import { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard, Droplets, Tags, Users,
  Package, ArrowLeftRight, LogOut, Menu, X, Plus, Settings, Car,
  AlertTriangle, RefreshCw, BarChart3
} from 'lucide-react';

const navItemsAdmin = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/lavagens', label: 'Lavagens', icon: Droplets },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/veiculos', label: 'Veículos', icon: Car },
  { to: '/tipos-lavagem', label: 'Tipos de Lavagem', icon: Tags },
  { to: '/estoque', label: 'Estoque', icon: Package },
  { to: '/movimentacao', label: 'Movimentação', icon: ArrowLeftRight },
  { to: '/analise', label: 'Análise & Relatórios', icon: BarChart3 },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

const navItemsUser = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/lavagens', label: 'Lavagens', icon: Droplets },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/veiculos', label: 'Veículos', icon: Car },
];

const pageTitle: Record<string, string> = {
  '/': 'Dashboard',
  '/analise': 'Análise & Relatórios',
  '/lavagens': 'Lavagens',
  '/tipos-lavagem': 'Tipos de Lavagem',
  '/clientes': 'Clientes',
  '/veiculos': 'Veículos',
  '/estoque': 'Estoque',
  '/movimentacao': 'Movimentação',
  '/novo-produto': 'Novo Produto',
  '/configuracoes': 'Configurações',
};

export default function AppLayout() {
  const { isAuthenticated, user, logout } = useAuth();
  const { erroCarregamento, refreshData } = useApp();
  const { openNovaLavagem } = useModal();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarWasOpen = useRef(false);

  /**
   * WCAG 2.1.1 - o menu lateral abre com um botao real, mas antes so dispensava
   * pelo clique no overlay, que e exclusivo do ponteiro: quem navega por teclado
   * abria o menu e ficava preso, sem Escape, sem botao de fechar e sem o foco
   * migrado para dentro da gaveta.
   */
  useEffect(() => {
    if (!sidebarOpen) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setSidebarOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen]);

  // Devolve o foco ao gatilho quando a gaveta fecha. O `sidebarWasOpen` evita
  // roubar o foco no primeiro render, quando `sidebarOpen` ja vale false.
  useEffect(() => {
    if (sidebarOpen) {
      sidebarWasOpen.current = true;
      return;
    }
    if (!sidebarWasOpen.current) return;
    sidebarWasOpen.current = false;
    menuButtonRef.current?.focus();
  }, [sidebarOpen]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const navItems = user?.role === 'admin' ? navItemsAdmin : navItemsUser;
  const title = pageTitle[location.pathname] || 'T10 Gestão';
  const esconderNovaLavagem =
    location.pathname === '/analise' || location.pathname === '/configuracoes';

  return (
    <div className="min-h-screen flex bg-background">
      {/* WCAG 2.4.1 - Skip Link: visível apenas ao receber foco via Tab */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:px-4 focus:py-2.5 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:text-sm focus:font-bold focus:shadow-lg"
      >
        Ir para o conteúdo principal
      </a>

      {/* Sidebar */}
      <aside
        id="app-sidebar"
        aria-label="Menu principal"
        className={`fixed inset-y-0 left-0 z-40 w-60 bg-card border-r border-border flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:static lg:w-60`}
      >
        <div className="p-5 border-b border-border">
          <NavLink
            to="/"
            end
            className="text-2xl font-barlow-condensed font-extrabold text-primary tracking-tight"
          >
            T10 🚗
          </NavLink>
          <p className="text-sm text-muted-foreground uppercase tracking-widest mt-0.5">Gestão</p>
          {/* Fecha a gaveta sem depender do overlay (que so o mouse alcança). */}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
            className="lg:hidden absolute right-3 top-4 text-muted-foreground hover:text-foreground rounded-lg p-1"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Navegação principal" className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              onClick={() => setSidebarOpen(false)}
              activeClassName="bg-primary/10 text-primary"
              className="flex items-center gap-3 px-3 py-2.5 min-h-11 rounded-lg text-sm font-medium transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <item.icon size={18} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold"
            >
              {user?.nome?.[0] || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.nome}</p>
            </div>
            <button
              type="button"
              onClick={() => { logout(); navigate('/login'); }}
              aria-label="Sair da conta"
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay: botão nativo em vez de div com onClick. Fica fora da ordem de
          tabulação (tabIndex={-1}) porque o teclado já tem Escape e o botão
          "Fechar menu"; continua alcançável por controle de voz, daí o rótulo. */}
      {sidebarOpen && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Fechar menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-background/60 lg:hidden"
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border flex items-center justify-between px-4 lg:px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              ref={menuButtonRef}
              type="button"
              className="lg:hidden text-muted-foreground shrink-0"
              onClick={() => setSidebarOpen(true)}
              aria-expanded={sidebarOpen}
              aria-controls="app-sidebar"
              aria-label={sidebarOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
            >
              {sidebarOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
            <h1 className="text-lg font-barlow-condensed font-bold text-foreground truncate">{title}</h1>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <ThemeToggle />
            {!esconderNovaLavagem && (
              <button
                type="button"
                onClick={openNovaLavagem}
                aria-label="Nova Lavagem"
                className="bg-primary text-primary-foreground text-base font-semibold h-11 px-4 sm:px-5 rounded-lg hover:brightness-110 transition-all flex items-center gap-1.5"
              >
                <Plus size={18} aria-hidden="true" />
                <span className="hidden sm:inline">Nova Lavagem</span>
              </button>
            )}
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 p-6 lg:p-8 overflow-y-auto focus:outline-none">
          <div className="mx-auto w-full max-w-[1600px]">
          {/* Carga parcial nunca é apresentada como sucesso: se o Promise.all do
              AppContext falhar, as listas estão desatualizadas e o usuário
              precisa saber disso antes de tomar decisões (FA-12). */}
          {erroCarregamento && (
            <div
              role="alert"
              aria-live="polite"
              className="badge-cancelada text-sm rounded-lg px-4 py-3 mb-4 flex items-center gap-3 flex-wrap"
            >
              <AlertTriangle size={16} aria-hidden="true" className="shrink-0" />
              <span className="flex-1 min-w-0">
                {erroCarregamento} Os dados exibidos podem estar desatualizados.
              </span>
              <button
                type="button"
                onClick={() => { void refreshData(); }}
                className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-2 shrink-0"
              >
                <RefreshCw size={13} aria-hidden="true" /> Tentar novamente
              </button>
            </div>
          )}
          <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
