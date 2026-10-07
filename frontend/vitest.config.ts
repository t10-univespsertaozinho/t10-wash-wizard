import { defineConfig } from "vitest/config";
// Usa o mesmo plugin do vite.config.ts. Antes apontava para
// @vitejs/plugin-react-swc, que nunca esteve nas dependências — o que fazia
// `npm test` falhar na carga da config com ERR_MODULE_NOT_FOUND.
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      // Fora da conta: os componentes de biblioteca (shadcn/ui, código de
      // terceiros copiado para dentro do projeto), declarações de tipo, a
      // própria suíte e o ponto de entrada, que só monta a árvore.
      exclude: [
        "src/components/ui/**",
        "src/test/**",
        "src/**/*.d.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
      // Dois níveis de limiar, por honestidade de medição (FA-19):
      //
      // 1) Global: o número real do frontend inteiro, com as páginas incluídas.
      //    Hoje elas não têm teste de componente, então a média é baixa — e fica
      //    à vista no log do CI, em vez de escondida por um `exclude`. O valor é
      //    uma catraca: trava regressão e deve subir a cada página coberta. Meta
      //    do plano de remediação: 60–70%.
      //
      // 2) Por diretório: as camadas que a suíte realmente cobre (formatação,
      //    validação, cliente HTTP, sessão) ficam presas em patamar alto, para
      //    que a folga do limiar global não permita descobrir o que já está
      //    testado.
      thresholds: {
        lines: 13,
        statements: 12,
        functions: 15,
        branches: 12,

        'src/utils/**': { lines: 95, statements: 95, functions: 100, branches: 95 },
        'src/services/**': { lines: 95, statements: 95, functions: 100, branches: 90 },
        'src/contexts/AuthContext.tsx': { lines: 90, statements: 90, functions: 85, branches: 85 },
        'src/components/ErrorBoundary.tsx': { lines: 90, statements: 90, functions: 85, branches: 75 },
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
});
