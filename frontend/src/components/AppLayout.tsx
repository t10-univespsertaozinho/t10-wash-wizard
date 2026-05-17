import { Navigate, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import {
  LayoutDashboard, Droplets, List, Tags, Users, UserPlus,
  Package, ArrowLeftRight, LogOut, Menu, X, Plus, Settings, Car
} from 'lucide-react';

const navItemsAdmin = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/nova-lavagem', label: 'Nova Lavagem', icon: Plus },
  { to: '/lavagens', label: 'Lavagens', icon: Droplets },
  { to: '/tipos-lavagem', label: 'Tipos de Lavagem', icon: Tags },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/novo-cliente', label: 'Novo Cliente', icon: UserPlus },
  { to: '/veiculos', label: 'Veículos', icon: Car },
  { to: '/estoque', label: 'Estoque', icon: Package },
  { to: '/movimentacao', label: 'Movimentação', icon: ArrowLeftRight },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

const navItemsUser = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/nova-lavagem', label: 'Nova Lavagem', icon: Plus },
  { to: '/lavagens', label: 'Lavagens', icon: Droplets },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/novo-cliente', label: 'Novo Cliente', icon: UserPlus },
  { to: '/veiculos', label: 'Veículos', icon: Car },
];

const pageTitle: Record<string, string> = {
  '/': 'Dashboard',
  '/nova-lavagem': 'Nova Lavagem',
  '/lavagens': 'Lavagens',
  '/tipos-lavagem': 'Tipos de Lavagem',
  '/clientes': 'Clientes',
  '/novo-cliente': 'Novo Cliente',
  '/veiculos': 'Veículos',
  '/estoque': 'Estoque',
  '/movimentacao': 'Movimentação',
  '/novo-produto': 'Novo Produto',
  '/configuracoes': 'Configurações',
};

export default function AppLayout() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const navItems = user?.role === 'admin' ? navItemsAdmin : navItemsUser;
  const title = pageTitle[location.pathname] || 'T10 Gestão';

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 bg-card border-r border-border flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:static lg:w-60`}>
        <div className="p-5 border-b border-border">
          <Link to="/" className="text-2xl font-barlow-condensed font-extrabold text-primary tracking-tight">
            T10 🚗
          </Link>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Gestão</p>
        </div>
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
              {user?.nome?.[0] || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.nome}</p>
            </div>
            <button onClick={() => { logout(); navigate('/login'); }} className="text-muted-foreground hover:text-destructive transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-background/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border flex items-center justify-between px-4 lg:px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-muted-foreground" onClick={() => setSidebarOpen(true)}>
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1 className="text-lg font-barlow-condensed font-bold text-foreground">{title}</h1>
          </div>
          <Link to="/nova-lavagem" className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg hover:brightness-110 transition-all flex items-center gap-1.5">
            <Plus size={14} /> Nova Lavagem
          </Link>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
