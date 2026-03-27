import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Clientes from "@/pages/Clientes";
import NovoCliente from "@/pages/NovoCliente";
import ClienteDetalhe from "@/pages/ClienteDetalhe";
import Lavagens from "@/pages/Lavagens";
import NovaLavagem from "@/pages/NovaLavagem";
import TiposLavagem from "@/pages/TiposLavagem";
import Estoque from "@/pages/Estoque";
import NovoProduto from "@/pages/NovoProduto";
import Movimentacao from "@/pages/Movimentacao";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
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
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/clientes" element={<Clientes />} />
                  <Route path="/novo-cliente" element={<NovoCliente />} />
                  <Route path="/clientes/:id" element={<ClienteDetalhe />} />
                  <Route path="/lavagens" element={<Lavagens />} />
                  <Route path="/nova-lavagem" element={<NovaLavagem />} />
                  <Route path="/tipos-lavagem" element={<AdminRoute><TiposLavagem /></AdminRoute>} />
                  <Route path="/estoque" element={<AdminRoute><Estoque /></AdminRoute>} />
                  <Route path="/novo-produto" element={<AdminRoute><NovoProduto /></AdminRoute>} />
                  <Route path="/movimentacao" element={<AdminRoute><Movimentacao /></AdminRoute>} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </AppProvider>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
