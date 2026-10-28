#!/usr/bin/env node
/**
 * Captura as telas do Wash Wizard para o README, usando um Chromium headless.
 *
 * Princípios (privacidade e reprodutibilidade):
 *  1. A imagem é da *viewport*, não da janela do navegador. Não existe barra de
 *     abas, favoritos, barra de endereço, barra de tarefas ou notificação do SO
 *     para "apagar depois": nada disso é renderizado.
 *  2. O login é feito por API e o JWT é injetado no localStorage antes do
 *     primeiro paint — nenhum campo de senha aparece, nenhum autofill do
 *     navegador sugere credencial salva.
 *  3. Os dados vêm de `scripts/demo-data.mjs` (pseudônimos "Cliente 001",
 *     telefone em DDD 00 e placa mascarada), num arquivo fora do repositório.
 *     O `wash_wizard.db` real nunca é aberto.
 *  4. Antes de abrir o navegador, um portão consulta o SQLite e aborta se
 *     qualquer cliente/veículo não estiver anonimizado. `--keep-db` reutiliza o
 *     arquivo, mas não escapa do portão.
 *  5. Roda contra o build de produção servido pelo `vite preview`, que não
 *     injeta o widget flutuante do lovable-tagger do modo dev.
 *  6. `-strip` do ImageMagick remove metadados (EXIF, caminhos locais, software).
 *  7. Ao final, audita o que a imagem realmente mostra — inclusive `value` de
 *     inputs e `placeholder`, que o `innerText` não enxerga — e falha em
 *     telefone, placa, CPF/CNPJ/CEP, e-mail ou caminho fora do padrão reservado.
 *
 * Uso:
 *   npm run screenshots              # gera banco demo, builda e captura tudo
 *   npm run screenshots -- --only 02 # refaz só as telas que começam com "02"
 *   npm run screenshots -- --no-build --keep-db
 *
 * Requisitos: Chromium/Chrome disponível (CHROME_PATH ou cache do Puppeteer) e
 * ImageMagick (`convert`) para otimizar. Sem ImageMagick as imagens saem em 2x.
 */
import puppeteer from 'puppeteer-core';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dirname, '..');
const FRONTEND = path.join(RAIZ, 'frontend');
const SAIDA = path.join(RAIZ, 'docs_assets', 'screenshots');
const DEMO_DB = path.join(os.homedir(), '.cache', 'wash-wizard-demo', 'wash_wizard.db');

const API_URL = 'http://localhost:3001';
const WEB_URL = 'http://localhost:8080';
const EMAIL_ADMIN = 'admin@washwizard.com';
const EMAIL_OPERADOR = 'operador@washwizard.com';
const SENHA_ADMIN = process.env.SEED_ADMIN_PASSWORD || 'admin123';
const SENHA_OPERADOR = process.env.SEED_OPERADOR_PASSWORD || 'operador123';

const args = process.argv.slice(2);
const opcoes = {
  only: args.includes('--only') ? args[args.indexOf('--only') + 1] : null,
  noBuild: args.includes('--no-build'),
  keepDb: args.includes('--keep-db'),
};

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(`› ${msg}`);

/* ------------------------------------------------------------------ */
/* Chromium                                                            */
/* ------------------------------------------------------------------ */
function acharChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;

  // Preferência: Chrome baixado pelo Puppeteer (não tem o confinamento do snap,
  // que bloqueia escrita em /tmp e em diretórios ocultos do home).
  const raizPuppeteer = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome');
  if (fs.existsSync(raizPuppeteer)) {
    for (const versao of fs.readdirSync(raizPuppeteer).sort().reverse()) {
      for (const relativo of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
        const candidato = path.join(raizPuppeteer, versao, relativo);
        if (fs.existsSync(candidato)) return candidato;
      }
    }
  }

  for (const binario of ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium']) {
    if (fs.existsSync(binario)) return binario;
  }

  throw new Error(
    'Chromium não encontrado. Defina CHROME_PATH ou rode:\n  npx puppeteer browsers install chrome',
  );
}

/* ------------------------------------------------------------------ */
/* Servidores                                                          */
/* ------------------------------------------------------------------ */
function portaOcupada(porta) {
  return new Promise((resolve) => {
    const socket = net.connect({ port: porta, host: '127.0.0.1' });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
    socket.setTimeout(1000, () => { socket.destroy(); resolve(false); });
  });
}

async function esperarHttp(url, aceitos, tentativas = 60) {
  for (let i = 0; i < tentativas; i += 1) {
    try {
      const res = await fetch(url);
      if (aceitos.includes(res.status)) return true;
    } catch {
      /* servidor ainda subindo */
    }
    await dormir(500);
  }
  return false;
}

function iniciar(nome, comando, argumentos, cwd, env) {
  // detached: o `npm run preview` cria um neto (vite). Sem grupo de processos
  // próprio, matar o npm deixaria o vite segurando a porta 8080 no próximo run.
  const filho = spawn(comando, argumentos, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  const saida = [];
  filho.stdout.on('data', (d) => saida.push(d.toString()));
  filho.stderr.on('data', (d) => saida.push(d.toString()));
  filho.on('exit', (codigo) => {
    if (codigo !== 0 && codigo !== null) {
      console.error(`\n[${nome}] saiu com código ${codigo}:\n${saida.join('').slice(-1500)}`);
    }
  });
  return { nome, filho, saida };
}

/* ------------------------------------------------------------------ */
/* Helpers de interação                                                */
/* ------------------------------------------------------------------ */
async function clicarPorTexto(page, texto) {
  const handle = await page.evaluateHandle((t) => {
    const candidatos = [...document.querySelectorAll('button, a, label, [role="tab"]')];
    return candidatos.find((el) => el.textContent.replace(/\s+/g, ' ').trim().includes(t)) || null;
  }, texto);
  const elemento = handle.asElement();
  if (!elemento) throw new Error(`Botão/link com texto "${texto}" não encontrado`);
  await elemento.click();
  await dormir(400);
}

async function rolarAte(page, texto, deslocamento = 96) {
  const achou = await page.evaluate(({ t, deslocamento }) => {
    const folhas = [...document.querySelectorAll('h2, h3, p, span, div, strong')].filter(
      (el) => el.children.length === 0 && el.textContent.replace(/\s+/g, ' ').includes(t),
    );
    const alvo = folhas[0];
    if (!alvo) return false;
    const y = alvo.getBoundingClientRect().top + window.scrollY - deslocamento;
    window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
    return true;
  }, { t: texto, deslocamento });
  if (!achou) throw new Error(`Texto "${texto}" não encontrado para rolar até ele`);
  await dormir(500);
  return page.evaluate(() => window.scrollY);
}

async function aquietar(page) {
  await page
    .waitForFunction(
      () => {
        const t = document.body?.innerText || '';
        return !t.includes('Carregando conteúdo') && !t.includes('Carregando...');
      },
      { timeout: 20000 },
    )
    .catch(() => {});
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 20000 }).catch(() => {});
  // Recharts anima as séries por ~1,5 s; capturar antes disso pega barra pela metade.
  await dormir(1800);
}

/* ------------------------------------------------------------------ */
/* Sessões do navegador                                                */
/* ------------------------------------------------------------------ */
async function abrirSessao(browser, { token, theme = 'light', viewport }) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport(viewport);
  await page.evaluateOnNewDocument(
    (dados) => {
      try {
        localStorage.setItem('t10_token', dados.token);
        localStorage.setItem('theme', dados.theme);
        document.documentElement.classList.add(dados.theme);
      } catch {
        /* about:blank não tem origem acessível — só a navegação real importa */
      }
    },
    { token, theme },
  );
  page.setDefaultTimeout(30000);
  return { context, page };
}

async function irPara(page, rota) {
  await page.goto(`${WEB_URL}${rota}`, { waitUntil: 'domcontentloaded' });
  await aquietar(page);
}

/* ------------------------------------------------------------------ */
/* Pós-processamento e auditoria                                       */
/* ------------------------------------------------------------------ */
function temImageMagick() {
  return spawnSync('which', ['convert'], { encoding: 'utf8' }).status === 0;
}

function otimizar(arquivo, larguraAlvo) {
  const temp = `${arquivo}.tmp.png`;
  const res = spawnSync(
    'convert',
    [arquivo, '-strip', '-resize', `${larguraAlvo}x`, '-define', 'png:compression-level=9', temp],
    { encoding: 'utf8' },
  );
  if (res.status === 0 && fs.existsSync(temp)) {
    fs.renameSync(temp, arquivo);
  } else {
    if (res.stderr) console.warn(`  ⚠ ImageMagick falhou em ${path.basename(arquivo)}: ${res.stderr.trim()}`);
    if (fs.existsSync(temp)) fs.rmSync(temp);
  }
}

function medir(arquivo) {
  const res = spawnSync(
    'identify',
    ['-format', '%w %h %[fx:standard_deviation]', arquivo],
    { encoding: 'utf8' },
  );
  if (res.status !== 0) return null;
  const [w, h, desvio] = res.stdout.trim().split(/\s+/);
  return { largura: Number(w), altura: Number(h), desvio: Number(desvio) };
}

const PADROES = {
  telefone: /\(\d{2}\)\s?\d{4,5}[-\s]?\d{4}/g,
  email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,
  placaMercosul: /\b[A-Z]{3}\d[A-Z]\d{2}\b/g,
  placaAntiga: /\b[A-Z]{3}-?\d{4}\b/g,
  cpf: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
  cnpj: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g,
  cep: /\b\d{5}-\d{3}\b/g,
};
// Só o telefone do dataset demo passa: DDD 00 não é atribuído pela ANATEL.
const TELEFONE_DEMO = /^\(00\) 9\d{4}-\d{4}$/;
// RFC 2606: example.com/.org/.net são reservados para documentação e não
// pertencem a ninguém — o único domínio aceitável numa captura.
const EMAIL_RESERVADO = /@example\.(com|org|net)$/i;
const PROIBIDOS = ['localhost', '/home/', 'file://', 'C:\\', '192.168.', '127.0.0.1', 'undefined', 'NaN', 'Invalid Date'];

/**
 * Texto que a imagem realmente mostra.
 *
 * `document.body.innerText` ignora o conteúdo de `<input value>` e o
 * `placeholder`. A primeira versão desta auditoria usava só o innerText e por
 * isso dava "limpo" na tela de edição do cliente enquanto a imagem exibia
 * telefone e data de nascimento dentro dos campos. Aqui o extrator soma tudo o
 * que é renderizado: texto, valores de campo, opções selecionadas e placeholders.
 */
function textoDaTela(page) {
  return page.evaluate(() => {
    const partes = [document.body.innerText];
    for (const el of document.querySelectorAll('input, textarea, select')) {
      if (el.type === 'password') continue; // nunca é preenchido; nem deve ser lido
      if (!el.getClientRects().length) continue; // modal fechado / campo oculto
      if (el.tagName === 'SELECT') {
        const opcao = el.options[el.selectedIndex];
        if (opcao) partes.push(opcao.textContent);
      } else {
        partes.push(el.value);
      }
      const placeholder = el.getAttribute('placeholder');
      if (placeholder) partes.push(placeholder);
    }
    return partes.filter(Boolean).join('\n');
  });
}

function auditar(texto, id) {
  const problemas = [];

  for (const achado of texto.match(PADROES.telefone) || []) {
    if (!TELEFONE_DEMO.test(achado.trim())) {
      problemas.push(`telefone potencialmente real: ${achado}`);
    }
  }
  for (const achado of texto.match(PADROES.email) || []) {
    if (!EMAIL_RESERVADO.test(achado)) {
      problemas.push(`e-mail fora do domínio reservado: ${achado}`);
    }
  }
  for (const chave of ['placaMercosul', 'placaAntiga', 'cpf', 'cnpj', 'cep']) {
    for (const achado of texto.match(PADROES[chave]) || []) {
      problemas.push(`${chave} detectado: ${achado}`);
    }
  }
  for (const termo of PROIBIDOS) {
    if (texto.includes(termo)) problemas.push(`termo proibido na tela: "${termo}"`);
  }

  return problemas.map((p) => `${id}: ${p}`);
}

/**
 * Portão de privacidade do banco.
 *
 * Roda antes do navegador: se o SQLite não for o de demonstração (alguém trocou
 * o arquivo, ou rodou `--keep-db` apontando para o banco de campo), a captura
 * para aqui em vez de publicar nome, telefone ou placa de cliente real.
 */
async function auditarBancoDemo(arquivo) {
  if (!fs.existsSync(arquivo)) throw new Error(`Banco de demonstração não encontrado: ${arquivo}`);

  const requireDoBackend = createRequire(path.join(RAIZ, 'backend', 'package.json'));
  const sqlite3 = requireDoBackend('sqlite3');
  const db = new sqlite3.Database(arquivo, sqlite3.OPEN_READONLY);
  const all = (sql, params = []) =>
    new Promise((ok, erro) => db.all(sql, params, (e, r) => (e ? erro(e) : ok(r))));

  const problemas = [];
  try {
    const clientes = await all('SELECT id, nome, telefone, data_nascimento FROM clientes');
    for (const c of clientes) {
      if (!/^Cliente \d{3}$/.test(c.nome || '')) problemas.push(`cliente ${c.id}: nome não pseudonimizado ("${c.nome}")`);
      if (!TELEFONE_DEMO.test((c.telefone || '').trim())) problemas.push(`cliente ${c.id}: telefone fora do DDD 00 ("${c.telefone}")`);
      if (c.data_nascimento !== null) problemas.push(`cliente ${c.id}: data de nascimento preenchida (${c.data_nascimento})`);
    }

    const veiculos = await all('SELECT id, placa FROM veiculos');
    for (const v of veiculos) {
      if (!/^•{5}\d{2}$/.test(v.placa || '')) problemas.push(`veículo ${v.id}: placa não mascarada ("${v.placa}")`);
    }

    // Campo livre é o vetor mais fácil de vazar PII sem querer (alguém digita
    // "ligar para 16 99999-9999" na observação e ninguém percebe).
    const observacoes = await all(`
      SELECT 'lavagens' AS origem, id, observacao AS texto FROM lavagens WHERE observacao IS NOT NULL AND observacao <> ''
      UNION ALL
      SELECT 'movimentacoes', id, observacao FROM movimentacoes WHERE observacao IS NOT NULL AND observacao <> ''
    `);
    for (const o of observacoes) {
      const texto = o.texto || '';
      if (/@/.test(texto)) problemas.push(`${o.origem} ${o.id}: observação contém e-mail ("${texto}")`);
      if (/\d{7,}/.test(texto.replace(/\D/g, ''))) problemas.push(`${o.origem} ${o.id}: observação contém sequência numérica longa ("${texto}")`);
    }

    const usuarios = await all('SELECT nome FROM users');
    const nomesPermitidos = ['Administrador', 'Operador Demo'];
    for (const u of usuarios) {
      if (!nomesPermitidos.includes(u.nome)) problemas.push(`usuário: nome não genérico ("${u.nome}")`);
    }
  } finally {
    db.close();
  }

  return problemas;
}

/* ------------------------------------------------------------------ */
/* Roteiro de capturas                                                 */
/* ------------------------------------------------------------------ */
const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 2 };
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

const roteiro = [
  {
    id: '01-login/login',
    rota: '/login',
    legenda: 'Autenticação com JWT e retorno de perfil por papel (admin/operador).',
  },
  {
    id: '02-dashboard/dashboard-visao-geral',
    rota: '/',
    verificar: async (page) => {
      const graficos = await page.$$eval('.recharts-surface', (els) => els.length);
      return graficos > 0 ? null : 'nenhum gráfico Recharts renderizado';
    },
    legenda: 'KPIs financeiros da semana, comparativo com o período anterior e série diária de 7 dias.',
  },
  {
    id: '02-dashboard/dashboard-bi-pilares',
    rota: '/',
    rolarAte: 'Fluxo Diário de Atendimentos',
    legenda: 'Fluxo diário, alerta de compras com Runway de estoque e fila de atendimento do pátio.',
  },
  {
    id: '02-dashboard/dashboard-tema-escuro',
    rota: '/',
    tema: 'dark',
    verificar: async (page) =>
      (await page.evaluate(() => document.documentElement.classList.contains('dark')))
        ? null
        : 'classe de tema escuro não aplicada ao <html>',
    legenda: 'Mesmo painel no tema escuro (preferência persistida em localStorage).',
  },
  {
    id: '03-lavagens/lavagens-fila',
    rota: '/lavagens',
    legenda: 'Todas as lavagens com filtro por status e ações de iniciar/concluir/cancelar.',
  },
  {
    id: '03-lavagens/lavagens-concluidas',
    rota: '/lavagens',
    acao: (page) => clicarPorTexto(page, 'Concluída'),
    legenda: 'Filtro de lavagens concluídas, com forma de pagamento e valor por atendimento.',
    verificar: async (page) => {
      const status = await page.$$eval('tbody tr span', (els) => els.map((e) => e.textContent.trim()));
      const foraDoFiltro = status.filter((t) => ['Pendente', 'Em progresso', 'Cancelada'].includes(t));
      return foraDoFiltro.length ? `filtro não aplicado (${foraDoFiltro.length} linha(s) de outro status)` : null;
    },
  },
  {
    id: '04-clientes/clientes-listagem',
    rota: '/clientes',
    legenda: 'Listagem com busca por nome ou telefone, contagem de veículos e de lavagens.',
  },
  {
    id: '04-clientes/clientes-detalhe',
    rota: '/clientes/cli-001',
    legenda: 'Ficha do cliente: veículos vinculados e histórico completo de lavagens.',
  },
  {
    id: '04-clientes/clientes-edicao',
    rota: '/clientes/cli-001/editar',
    legenda: 'Edição cadastral com validação de telefone e data de nascimento.',
  },
  {
    id: '05-veiculos/veiculos-listagem',
    rota: '/veiculos',
    legenda: 'Frota cadastrada, com busca por modelo, placa ou cliente.',
  },
  {
    id: '05-veiculos/veiculos-formulario',
    rota: '/veiculos',
    acao: async (page) => {
      await clicarPorTexto(page, 'Novo Veículo');
      await page.waitForSelector('[role="dialog"]', { visible: true });
      await dormir(600);
    },
    verificar: async (page) => {
      const estado = await page.evaluate(() => {
        const dialogo = document.querySelector('[role="dialog"]');
        return {
          visivel: !!dialogo && dialogo.getBoundingClientRect().height > 200,
          titulo: dialogo ? dialogo.innerText.split('\n')[0] : '',
        };
      });
      if (!estado.visivel) return 'diálogo não está visível na captura';
      return estado.titulo.includes('Editar') ? `modal abriu em modo edição ("${estado.titulo}")` : null;
    },
    legenda: 'Modal de cadastro de veículo vinculado a um cliente, com placa validada.',
  },
  {
    id: '06-servicos/tipos-lavagem',
    rota: '/tipos-lavagem',
    legenda: 'Catálogo de serviços com criação e edição por linha, usados no faturamento.',
  },
  {
    id: '07-estoque/estoque-critico',
    rota: '/estoque',
    legenda: 'Estoque com alerta de itens zerados/baixos e status por produto.',
    verificar: async (page) => {
      const criticos = await page.$$eval('.badge-zerado, .badge-baixo', (els) => els.length);
      return criticos > 0 ? null : 'nenhum produto em estado crítico renderizado';
    },
  },
  {
    id: '07-estoque/novo-produto',
    rota: '/novo-produto',
    legenda: 'Cadastro de insumo com quantidade mínima, categoria e unidade.',
  },
  {
    id: '08-movimentacao/movimentacao-estoque',
    rota: '/movimentacao',
    legenda: 'Entradas e saídas de insumo: base do consumo diário usado no Runway.',
  },
  {
    id: '09-analise/analise-mix-servicos',
    rota: '/analise',
    legenda: 'Mix de serviços dos últimos 30 dias: volume x rentabilidade e leitura de negócio.',
    verificar: async (page) => {
      // Esta página monta as barras com CSS puro (sem Recharts): o sinal de que
      // renderizou é o bloco de leitura de negócio + os seis serviços do catálogo.
      const texto = await textoDaTela(page);
      const servicos = ['Lavagem Simples', 'Lavagem Completa', 'Lavagem a Seco', 'Cera de Proteção', 'Polimento', 'Higienização Interna']
        .filter((nome) => texto.includes(nome));
      if (!texto.includes('Visão do Negócio')) return 'bloco de leitura de negócio ausente';
      return servicos.length >= 5 ? null : `mix incompleto (${servicos.length}/6 serviços listados)`;
    },
  },
  {
    id: '09-analise/analise-retencao',
    rota: '/analise',
    rolarAte: 'Clientes Ausentes',
    verificar: async (page) => {
      const links = await page.$$eval('a[href^="https://wa.me"]', (els) => els.length);
      return links > 0 ? null : 'nenhum link de reengajamento do WhatsApp encontrado';
    },
    legenda: 'Radar de clientes ausentes há mais de 30 dias com reengajamento por WhatsApp.',
  },
  {
    id: '10-configuracoes/configuracoes-backup',
    rota: '/configuracoes',
    legenda: 'Administração do banco SQLite com exportação/importação de backup em CSV.',
  },
  {
    id: '11-modais/modal-nova-lavagem',
    rota: '/lavagens',
    acao: async (page) => {
      await clicarPorTexto(page, 'Nova Lavagem');
      await page.waitForSelector('[role="dialog"]', { visible: true });
      await dormir(600);
    },
    verificar: async (page) => {
      const estado = await page.evaluate(() => {
        const dialogo = document.querySelector('[role="dialog"]');
        return {
          visivel: !!dialogo && dialogo.getBoundingClientRect().height > 200,
          titulo: dialogo ? dialogo.innerText.split('\n')[0] : '',
        };
      });
      if (!estado.visivel) return 'diálogo não está visível na captura';
      return estado.titulo.includes('Registrar') ? null : `modal abriu em modo edição ("${estado.titulo}")`;
    },
    legenda: 'Modal acessível de registro de lavagem, reutilizado no dashboard e na listagem.',
  },
  {
    id: '11-modais/modal-novo-cliente',
    rota: '/clientes',
    acao: async (page) => {
      await clicarPorTexto(page, 'Novo Cliente');
      await page.waitForSelector('[role="dialog"]', { visible: true });
      await dormir(600);
    },
    verificar: async (page) => {
      const titulo = await page.evaluate(() => {
        const dialogo = document.querySelector('[role="dialog"]');
        return dialogo ? dialogo.innerText.split('\n')[0] : '';
      });
      return titulo.includes('Cadastrar') ? null : `modal abriu em modo edição ("${titulo}")`;
    },
    legenda: 'Modal de cadastro de cliente aberto por cima da listagem.',
  },
  {
    id: '12-operador/visao-operador-rbac',
    rota: '/',
    papel: 'operador',
    verificar: async (page) => {
      const rotas = await page.$$eval('#app-sidebar nav a', (as) => as.map((a) => a.getAttribute('href')));
      const admin = ['/estoque', '/analise', '/configuracoes', '/tipos-lavagem'];
      const expostas = rotas.filter((r) => admin.includes(r));
      return expostas.length ? `RBAC: menu do operador expõe ${expostas.join(', ')}` : null;
    },
    legenda: 'Visão do operador: menu sem as áreas administrativas (RBAC aplicado na rota e na API).',
  },
  {
    id: '13-mobile/mobile-dashboard',
    rota: '/',
    viewport: MOBILE,
    larguraFinal: 780,
    legenda: 'Dashboard em viewport de celular (390x844), com gráficos responsivos.',
  },
  {
    id: '13-mobile/mobile-menu-gaveta',
    rota: '/',
    viewport: MOBILE,
    larguraFinal: 780,
    acao: async (page) => {
      await page.click('button[aria-label="Abrir menu de navegação"]');
      await dormir(500);
    },
    verificar: async (page) => {
      const x = await page.evaluate(() => {
        const gaveta = document.querySelector('#app-sidebar');
        return gaveta ? gaveta.getBoundingClientRect().x : null;
      });
      if (x === null) return 'gaveta de navegação não encontrada';
      return x < 0 ? `gaveta continuou fechada (x=${Math.round(x)})` : null;
    },
    legenda: 'Gaveta de navegação aberta no mobile: fecha com Esc e devolve o foco ao botão.',
  },
];

/* ------------------------------------------------------------------ */
/* Execução                                                            */
/* ------------------------------------------------------------------ */
const servidores = [];
let browser;
let falhas = 0;

async function principal() {
  if (await portaOcupada(3001)) throw new Error('Porta 3001 ocupada. Pare o backend atual antes de capturar.');
  if (await portaOcupada(8080)) throw new Error('Porta 8080 ocupada. Pare o frontend atual antes de capturar.');

  if (!opcoes.keepDb) {
    log('Gerando banco de demonstração (dados fictícios, fora do repositório)…');
    const r = spawnSync(process.execPath, [path.join(__dirname, 'demo-data.mjs'), '--out', DEMO_DB], {
      encoding: 'utf8',
    });
    if (r.status !== 0) throw new Error(`demo-data falhou:\n${r.stdout}\n${r.stderr}`);
  }

  // Portão de privacidade: vale também para --keep-db. Se o arquivo não for o
  // dataset anonimizado, a captura para antes de qualquer build.
  log('Conferindo o banco de demonstração (portão de privacidade)…');
  const violacoes = await auditarBancoDemo(DEMO_DB);
  if (violacoes.length) {
    throw new Error(
      `Banco de demonstração contém dado pessoal — captura abortada:\n - ${violacoes.join('\n - ')}`,
    );
  }
  log('Banco anonimizado: nenhum nome, telefone, nascimento ou placa reais.');

  if (!opcoes.noBuild) {
    log('Buildando o frontend (modo produção, sem o badge do lovable-tagger)…');
    const envBuild = { ...process.env };
    delete envBuild.VITE_API_URL; // força o caminho relativo /api (proxy do preview)
    const build = spawnSync('npm', ['run', 'build'], { cwd: FRONTEND, env: envBuild, encoding: 'utf8' });
    if (build.status !== 0) throw new Error(`build falhou:\n${build.stdout}\n${build.stderr}`);
  } else if (!fs.existsSync(path.join(FRONTEND, 'dist', 'index.html'))) {
    throw new Error('--no-build foi usado, mas frontend/dist não existe.');
  }

  log('Subindo backend (SQLite demo) e preview do frontend…');
  servidores.push(
    iniciar('backend', process.execPath, ['server.js'], path.join(RAIZ, 'backend'), {
      ...process.env,
      PORT: '3001',
      DB_PATH: DEMO_DB,
      JWT_SECRET: 'captura-readme',
      FRONTEND_URL: WEB_URL,
    }),
  );
  servidores.push(
    iniciar('preview', 'npm', ['run', 'preview', '--', '--port', '8080', '--strictPort'], FRONTEND, process.env),
  );

  const apiOk = await esperarHttp(`${API_URL}/api/auth/me`, [401]);
  const webOk = await esperarHttp(`${WEB_URL}/login`, [200]);
  if (!apiOk || !webOk) throw new Error(`Servidores não responderam (api=${apiOk}, web=${webOk}).`);
  log('Servidores prontos.');

  // Tokens via API: nenhum formulário de login é preenchido no navegador.
  const autenticar = async (email, senha) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    if (!res.ok) throw new Error(`login de ${email} falhou (HTTP ${res.status})`);
    const { token } = await res.json();
    return token;
  };
  const tokens = {
    admin: await autenticar(EMAIL_ADMIN, SENHA_ADMIN),
    operador: await autenticar(EMAIL_OPERADOR, SENHA_OPERADOR),
  };

  const chrome = acharChrome();
  log(`Chromium: ${chrome}`);
  browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb', '--lang=pt-BR'],
    defaultViewport: DESKTOP,
  });

  const selecionadas = roteiro.filter((c) => !opcoes.only || c.id.startsWith(opcoes.only));
  if (!opcoes.only) {
    // Sem --only a árvore é regenerada por inteiro, evitando PNG órfão — mas só
    // os PNGs: o 00-indice.md é escrito à mão e precisa sobreviver ao rebuild.
    const limparPngs = (dir) => {
      if (!fs.existsSync(dir)) return;
      for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        const alvo = path.join(dir, entrada.name);
        if (entrada.isDirectory()) limparPngs(alvo);
        else if (entrada.name.endsWith('.png')) fs.rmSync(alvo);
      }
    };
    limparPngs(SAIDA);
  }
  if (!selecionadas.length) throw new Error(`Nenhuma captura corresponde a --only ${opcoes.only}`);

  const sessoes = new Map();
  const relatorio = [];
  const problemas = [];

  for (const captura of selecionadas) {
    const papel = captura.papel || 'admin';
    const viewport = captura.viewport || DESKTOP;
    const tema = captura.tema || 'light';
    const chaveSessao = `${papel}|${tema}|${viewport.width}`;

    if (!sessoes.has(chaveSessao)) {
      sessoes.set(chaveSessao, await abrirSessao(browser, { token: tokens[papel], theme: tema, viewport }));
    }
    const { page } = sessoes.get(chaveSessao);

    await irPara(page, captura.rota);
    if (captura.acao) await captura.acao(page);
    if (captura.rolarAte) {
      const scrollY = await rolarAte(page, captura.rolarAte);
      if (scrollY <= 0) problemas.push(`${captura.id}: rolagem não aconteceu (scrollY=${scrollY})`);
    }
    await aquietar(page);

    // Verificações de estado: garantem que a imagem mostra o que a legenda promete
    // (filtro aplicado, tema escuro, gaveta aberta), sem depender de inspeção visual.
    if (captura.verificar) {
      const falha = await captura.verificar(page);
      if (falha) problemas.push(`${captura.id}: ${falha}`);
    }

    const arquivo = path.join(SAIDA, `${captura.id}.png`);
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    await page.screenshot({ path: arquivo, type: 'png' });

    const texto = await textoDaTela(page);
    problemas.push(...auditar(texto, captura.id));
    // Cópia do texto renderizado em /tmp: é o que permite conferir depois, sem
    // OCR, se a tela capturada era mesmo o estado desejado (filtro, modal, etc.).
    const pastaTexto = path.join(os.tmpdir(), 'wash-wizard-capturas');
    fs.mkdirSync(pastaTexto, { recursive: true });
    fs.writeFileSync(path.join(pastaTexto, `${captura.id.replace('/', '__')}.txt`), texto, 'utf8');

    if (temImageMagick()) otimizar(arquivo, captura.larguraFinal || 1440);

    const medida = medir(arquivo);
    const kb = Math.round(fs.statSync(arquivo).size / 1024);
    const emBranco = medida ? medida.desvio < 0.02 : kb < 20;
    if (emBranco) {
      problemas.push(`${captura.id}: imagem praticamente em branco`);
      falhas += 1;
    }
    if (kb > 400) console.warn(`  ⚠ ${captura.id}.png tem ${kb} KB (acima do alvo de 400 KB)`);

    relatorio.push({
      arquivo: path.relative(RAIZ, arquivo),
      ...(medida || {}),
      kb,
      legenda: captura.legenda,
    });
    log(`${captura.id}.png  ${medida ? `${medida.largura}x${medida.altura}` : '?'}  ${kb} KB`);
  }

  for (const { context } of sessoes.values()) await context.close();

  // Metadados ficam fora do repositório: serve para conferir medidas depois,
  // sem virar um artefato gerado versionado junto das imagens.
  fs.writeFileSync(
    path.join(os.tmpdir(), 'wash-wizard-capturas.json'),
    JSON.stringify(relatorio, null, 2),
    'utf8',
  );

  console.log('\nAuditoria de privacidade (texto + valores de campo + placeholders):');
  if (problemas.length) {
    falhas += problemas.length;
    problemas.forEach((p) => console.error(`  ✗ ${p}`));
  } else {
    console.log('  ✓ nenhum telefone real, placa, CPF/CNPJ/CEP, e-mail ou caminho fora do padrão');
  }

  const total = relatorio.length;
  const peso = relatorio.reduce((s, r) => s + r.kb, 0);
  console.log(`\n${total} capturas · ${peso} KB no total · ${path.relative(RAIZ, SAIDA)}/`);
}

principal()
  .catch((err) => {
    falhas += 1;
    console.error(`\n✗ ${err.message}`);
  })
  .finally(async () => {
    if (browser) await browser.close().catch(() => {});
    for (const { filho } of servidores.reverse()) {
      try {
        process.kill(-filho.pid, 'SIGTERM'); // encerra o grupo (npm + vite)
      } catch {
        filho.kill('SIGTERM');
      }
    }
    await dormir(500);
    process.exit(falhas ? 1 : 0);
  });
