import js from "@eslint/js";
import globals from "globals";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // coverage/ é relatório gerado pelo vitest: não é código do projeto e seus
  // arquivos vendorizados geram avisos falsos de lint.
  { ignores: ["dist", "coverage"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "jsx-a11y": jsxA11y,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // `flat/recommended` traz todas as regras como aviso. Mantenho o padrao
      // "erro" das duas regras estruturais que quebram a tela para quem usa
      // leitor de tela ou navegacao por teclado, e deixo as demais em aviso para
      // nao bloquear o build com nitidez de codigo.
      ...jsxA11y.flatConfigs.recommended.rules,
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/no-redundant-roles": "warn",
      "jsx-a11y/no-access-key": "warn",
      // A regra nao conhece a excecao de regiao rolavel: o padrao recomendado
      // pela WCAG (2.1.1 / 1.4.10) e exatamente `tabIndex={0}` num container
      // rolavel, para que o teclado consiga arrastar o conteudo que nao cabe.
      // `role="region"` + `aria-label` transforma o div num landmark rotulado,
      // que e o que autoriza o tabIndex neste caso.
      "jsx-a11y/no-noninteractive-tabindex": [
        "error",
        { roles: ["tabpanel", "region"], tags: [] },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Componentes vendorizados do shadcn/ui repassam os filhos via `{...props}`.
    // As analises estaticas veem um elemento vazio e acusam conteudo ausente,
    // mas quem chama o componente e quem supplying children em runtime.
    files: ["src/components/ui/**/*.tsx"],
    rules: {
      "jsx-a11y/heading-has-content": "off",
      "jsx-a11y/anchor-has-content": "off",
    },
  },
);
