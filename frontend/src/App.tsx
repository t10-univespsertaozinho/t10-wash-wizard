import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import AppLayout from "@/components/AppLayout";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Clientes = lazy(() => import("@/pages/Clientes"));
const NovoCliente = lazy(() => import("@/pages/NovoCliente"));
const ClienteDetalhe = lazy(() => import("@/pages/ClienteDetalhe"));
const EditarCliente = lazy(() => import("@/pages/EditarCliente"));
const Veiculos = lazy(() => import("@/pages/Veiculos"));
const Lavagens = lazy(() => import("@/pages/Lavagens"));
const NovaLavagem = lazy(() => import("@/pages/NovaLavagem"));
const TiposLavagem = lazy(() => import("@/pages/TiposLavagem"));
const Estoque = lazy(() => import("@/pages/Estoque"));
const NovoProduto = lazy(() => import("@/pages/NovoProduto"));
const Movimentacao = lazy(() => import("@/pages/Movimentacao"));
const Configuracoes = lazy(() => import("@/pages/Configuracoes"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient();

// Loading Fallback
const PageLoading = () => (
  <div className="min-h-[400px] w-full flex flex-col items-center justify-center gap-3 animate-fade-in">
    <Loader2 className="w-10 h-10 text-primary animate-spin" />
    <p className="text-sm text-muted-foreground font-medium">Carregando conteúdo...</p>
  </div>
);

// Unified Protected Route
function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { user, isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  if (adminOnly && (!user || user.role !== 'admin')) {
    return <Navigate to="/" replace />;
  }
  
  return <Outlet />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <Toaster />
        <Sonner />
        <AuthProvider>
          <AppProvider>
            <BrowserRouter>
              <Suspense fallback={<PageLoading />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  
                  {/* Protected User Routes */}
                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppLayout />}>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/clientes" element={<Clientes />} />
                      <Route path="/novo-cliente" element={<NovoCliente />} />
                      <Route path="/clientes/:id" element={<ClienteDetalhe />} />
                      <Route path="/clientes/:id/editar" element={<EditarCliente />} />
                      <Route path="/veiculos" element={<Veiculos />} />
                      <Route path="/lavagens" element={<Lavagens />} />
                      <Route path="/nova-lavagem" element={<NovaLavagem />} />
                    </Route>
                  </Route>

                  {/* Protected Admin Routes */}
                  <Route element={<ProtectedRoute adminOnly />}>
                    <Route element={<AppLayout />}>
                      <Route path="/tipos-lavagem" element={<TiposLavagem />} />
                      <Route path="/estoque" element={<Estoque />} />
                      <Route path="/novo-produto" element={<NovoProduto />} />
                      <Route path="/movimentacao" element={<Movimentacao />} />
                      <Route path="/configuracoes" element={<Configuracoes />} />
                    </Route>
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </AppProvider>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
