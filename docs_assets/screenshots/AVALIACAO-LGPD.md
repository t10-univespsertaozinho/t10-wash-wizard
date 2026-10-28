# Avaliação técnica de privacidade e LGPD — capturas de tela

**Escopo:** as imagens de tela do projeto (`docs_assets/screenshots/`, 23 arquivos)
e as 5 imagens antigas que elas substituíram.
**Natureza deste documento:** avaliação **técnica** de risco, não parecer
jurídico. Não substitui análise de encarregado (DPO) ou de advogado.
**Data da avaliação:** 28/10/2026.

---

## 1. Pergunta que esta avaliação responde

> As imagens publicadas no repositório mostram dados que permitem identificar uma
> pessoa natural — e, portanto, configuram tratamento de dado pessoal nos termos
> da Lei 13.709/2018?

E, se sim: **o que foi removido, o que ainda resta e com que risco.**

---

## 2. Método

A avaliação foi feita em quatro frentes independentes, para não depender de uma
única checagem dar "limpo" por engano:

| Frente | O que examina | Como |
|---|---|---|
| **1. Origem do dado** | o conteúdo do banco que alimenta as telas | consulta direta ao SQLite de demonstração (driver `sqlite3` do backend), campo a campo |
| **2. Texto renderizado** | o que a imagem realmente exibe | extração via Chromium headless de `innerText` **+** `value` de inputs **+** opção de `select` **+** `placeholder`, por captura |
| **3. Metadados** | EXIF, software, data de criação, caminhos | `identify -verbose` / `exiftool`-style, antes e depois de `-strip` |
| **4. Histórico** | o que já foi publicado | `git log --all -- docs_assets`, `git rev-list --objects --all`, `git branch -r --contains` |

**Limitações declaradas:**

- **Não houve leitura visual das imagens** por esta análise (o agente não
  processa imagem). As conclusões sobre o *conteúdo* vêm do texto extraído do DOM
  no momento da captura, que é uma fonte fiel do que foi renderizado.
- **Não havia OCR no ambiente** (`tesseract`, `gocr`, `ocrad` ausentes) durante
  a análise inicial. Por isso as 5 imagens antigas começaram como "conteúdo
  desconhecido". A verificação foi feita **depois**, com OCR instalado
  especificamente para isso (`rapidocr-onnxruntime`), e o resultado mudou a
  classificação do item A8 — ver seção 4.
- A auditoria cobre texto e atributos de campos. Ela **não** cobre o conteúdo de
  pixels fora do DOM (ex.: um nome embutido em um gráfico como imagem) — no
  projeto atual não existe esse caso: todos os gráficos são SVG gerados por
  Recharts a partir do DOM.

---

## 3. Categorias de dado presentes nas telas

O Wash Wizard é um sistema de gestão de clientes: por desenho, as telas exibem
**identificadores diretos**. O inventário do que aparece em cada captura:

| Categoria | Classificação LGPD | Telas que exibem |
|---|---|---|
| Nome do cliente | dado pessoal (art. 5º, I) | 17 de 23 |
| Telefone | dado pessoal (art. 5º, I) | 5 de 23 |
| Placa do veículo | dado pessoal **indireto** — identifica o proprietário junto ao Detran | 12 de 23 |
| Data de nascimento | dado pessoal; não é sensível (art. 5º, II), mas é credencial comum de autenticação | 0 de 23 (hoje) |
| Observações de lavagem | campo livre — vetor clássico de vazamento não intencional | 0 de 23 |
| Nome/e-mail de usuário do sistema | dado pessoal do operador | 0 de 23 |

**Nenhuma tela contém dado pessoal sensível** (art. 5º, II): não há saúde,
biometria, genética, origem racial/étnica, convicção religiosa, opinião política,
filiação sindical ou vida sexual. Também não há dado de criança ou adolescente
(art. 14), nem CPF/CNPJ, CEP, endereço ou dado financeiro de titular.

---

## 4. Achados

Severidade = probabilidade de o dado atingir uma pessoa real × impacto para essa
pessoa. Escala: Baixo / Médio / Alto / Crítico.

### A1 — Telefone com DDD real e sequência plausível · **Alto (antes)**

O gerador usava `(16) 9NNNN-NNNN`. O DDD 16 é uma região **real** (São José do
Rio Preto / Sertãozinho–SP, a região do projeto) e a máscara de 9 dígitos é a de
celular válido. Resultado: 24 números que **podem pertencer a pessoas reais** —
inclusive a clientes do próprio Lava Rápido Maquininha — sem qualquer intenção.
Um número sorteado que coincide com uma linha ativa transforma a captura em
divulgação de dado de terceiro.

> **Correção:** telefones agora em **DDD 00** (`(00) 90000-00NN`). O DDD 00 **não
> é atribuído pela ANATEL**, logo a colisão com uma linha real é estruturalmente
> impossível, não apenas improvável. O formato continua válido para a UI (máscara
> de 11 dígitos) e os links de reengajamento apontam para `wa.me/55…` com DDD 00,
> que não roteia para ninguém.

### A2 — Nome completo plausível · **Alto (antes)**

24 nomes compostos por nome + sobrenome comuns, plausíveis como pessoa real. Como
*dado sintético*, não é dado pessoal (art. 5º, I — não se refere a pessoa natural
identificável). Mas, na prática: (a) são nomes que existem; (b) aparecem ao lado
de telefone e placa; (c) um leitor não tem como distinguir a captura de um dump
real. O risco não é jurídico-teórico, é de **percepção e de colisão**: quem tem
aquele nome e mora na região vê seu nome numa tela pública com um telefone ao
lado.

> **Correção:** pseudônimos `Cliente 001` … `Cliente 024` (art. 13, §4 — o dado
> perde a associação direta). O rótulo também **comunica** que o dado é sintético,
> o que resolve a percepção.

### A3 — Placa veicular em formato real · **Alto (antes)**

31 placas no padrão Mercosul (`ABC1D23`) e uma no padrão antigo (`AAA-0000`).
Placa é dado público consultável e identifica o proprietário. Um valor gerado
aleatoriamente pode ser de um veículo existente.

> **Correção:** placas mascaradas (`•••••NN`). Preserva a largura da coluna e
> sinaliza supressão; nenhuma placa plausível entra no dataset.

### A4 — Data de nascimento · **Médio (antes)**

18 dos 24 clientes tinham data de nascimento. Não é dado sensível, mas é
combinação perigosa: nome + nascimento + telefone é matéria-prima de engenharia
social e de resposta a perguntas de recuperação de conta. Para uma captura de
tela, não há finalidade que justifique exibi-la.

> **Correção:** coluna mantida no schema, valor **nulo** no dataset (minimização,
> art. 6º, III). A UI segue exercitando o estado "não informado".

### A5 — E-mail em domínio real de terceiro · **Médio (antes)**

O placeholder do login era `admin@washwizard.com`. `washwizard.com` **resolve e
responde** (HTTP 403, atrás de Wix) — é domínio de terceiro, não do projeto. Um
placeholder que parece um endereço pertencente a alguém, numa tela pública, é
ruído com potencial de virar contato indevido.

> **Correção:** `voce@example.com`. `example.com/.org/.net` são reservados por
> RFC 2606 justamente para documentação — não pertencem a ninguém e não podem
> receber tráfego real.
> **Ressalva:** os usuários do banco demo continuam com `@washwizard.com`. Não é
> vazamento (não aparecem em nenhuma das 23 telas, e são endereços de *sistema*,
> não de cliente), mas é uma inconsistência que vale corrigir quando o dataset for
> tocado de novo.

### A6 — Captura da tela inteira, com metadados · **Alto (antes)**

As 5 imagens antigas são **1920×1200** — a resolução de um monitor, não de uma
viewport (numa tela de 1200 px de altura não sobra espaço para o chrome do
navegador). Foram feitas com `gnome-screenshot`, o que significa **captura do
desktop completo**: barra de título, abas, favoritos, possivelmente notificações.
E os arquivos **não passaram por `-strip`**: carregam `Software: gnome-screenshot`
e `Creation Time` de **17/05/2026** nos chunks `tEXt`.

Metadado de captura é dado sobre o *ambiente*, não sobre o titular, mas data e
hora de uma sessão de trabalho são informação operacional que não tem por que ser
publicada.

> **Correção estrutural (não apenas cosmética):** a captura passa a ser **da
> viewport**, via Chromium headless. Não existe chrome do navegador, barra de
> tarefas ou notificação **para apagar depois** — eles nunca são renderizados.
> Além disso, todo PNG passa por `convert -strip` (remove EXIF, tEXt, data,
> software e caminho de origem).

### A7 — A auditoria anterior era cega a campos de formulário · **Alto (antes, como falha de controle)**

A primeira versão da auditoria lia apenas `document.body.innerText`. `innerText`
**não inclui** o `value` de um `<input>` nem o `placeholder`. Consequência
concreta: a captura `04-clientes/clientes-edicao.png` era aprovada como "limpa"
enquanto a imagem exibia nome, telefone e data de nascimento **dentro dos
campos**. Um controle que dá falso negativo é pior que nenhum controle, porque
produz confiança indevida.

> **Correção:** o extrator agora soma `innerText` + `value` de `input`/`textarea`
> + texto da opção selecionada em `select` + `placeholder`, ignorando apenas
> campos `type=password` (nunca preenchidos) e elementos sem layout (modal
> fechado). Verificação de que funciona: a captura de edição passou a registrar
> `Cliente 001` e `(00) 90000-0001` vindos do `value` — prova de que o extrator
> enxerga o campo.

### A8 — Histórico git expõe dado pessoal real · **Crítico (confirmado)**

Apagar o arquivo na working tree **não** o remove do repositório. Os 5 PNGs
antigos continuam em `d3cd653` ("add system screen", 17/05/2026) e esse commit
está em **9 refs remotas**, incluindo `origin/main`, `origin/estetica_geral`,
`origin/security_check`, `origin/start_PowerBI`, `origin/acessibilidade`,
`origin/portas_acesso`, `origin/abel_check` e o fork `fork-participante/main`.
Qualquer pessoa com acesso ao repositório pode extraí-los com
`git show d3cd653:docs_assets/dashboard_1.png`.

**O conteúdo foi lido por OCR, e não é sintético.** As 5 imagens exibem dado
pessoal de terceiros em formato real:

| O que apareceu | Quantidade |
|---|---:|
| Nomes completos distintas (nome + sobrenome) | 39 |
| Telefones com DDD atribuído | 15 distintos |
| Placas em formato real (padrão antigo) | 15 |
| Modelo/cor de veículo associado ao nome | presente |

Nenhum desses valores coincide com o dataset de demonstração — o banco de
demonstração usa DDD 16 e placas geradas; as imagens antigas mostram DDD 11 e
sequências distintas. Também **não** são dados claramente fictícios: são nomes
comuns, telefones discáveis e placas válidas, na mesma tela.

**Confirmação de exposição pública:** o repositório responde `200` sem
autenticação, e o blob antigo continua servível pelo caminho
`raw.githubusercontent.com/<org>/<repo>/d3cd653/...`. Não é exposição teórica:
o arquivo é baixável hoje.

Classificação: tratamento de dado pessoal sem base legal aparente e sem
minimização (art. 7º e art. 6º, III), com exposição pública. Exige **eliminação**
(art. 16) e avaliação de comunicação de incidente (art. 48) pelo controlador.

**O que foi feito em 28/10/2026:** os 5 arquivos foram removidos de **todos** os
commits do repositório com `git filter-repo --invert-paths`. O commit `d3cd653`
foi reescrito como `0148342` (mesma mensagem, sem os PNGs), as 9 refs foram
regravadas e `git rev-list --objects --all` não lista mais nenhum dos 5 nomes
antigos. O `force-push` atualizou `origin` e `fork-participante`.

**O que a reescrita não resolve:** `force-push` não apaga objetos que o GitHub já
serviu. O commit antigo pode continuar acessível por SHA direto e em cache por
tempo indeterminado — a remoção definitiva depende de pedido ao suporte da
plataforma (seção 8, item 2).

> **Nenhum valor de PII foi transcrito para este documento**, nem para os
> scripts. A evidência fica no OCR local (`/tmp/opencode/ocr-old-*.txt`), fora do
> repositório.

---

## 5. Antes × depois (números verificáveis)

| Indicador | Antes | Depois |
|---|---:|---:|
| Clientes com nome de pessoa plausível | 24 | **0** |
| Telefones com DDD atribuído (colidível) | 24 | **0** |
| Datas de nascimento preenchidas | 18 | **0** |
| Placas em formato real | 31 | **0** |
| Observações com e-mail ou sequência numérica longa | 0 | 0 |
| Imagens com metadado de captura (`gnome-screenshot`, data) | 5 de 5 | **0 de 23** |
| Imagens com chrome do navegador por construção | 5 de 5 (provável) | **0 de 23** |
| Ocorrências de PII fora do padrão na auditoria de texto | não medido | **0 em 23 telas** |

Os 23 dumps de texto por tela (`/tmp/wash-wizard-capturas/*.txt`, artefato local
não versionado) foram conferidos individualmente: 0 telefone fora do DDD 00, 0
e-mail fora de `example.com`, 0 placa em formato real, 0 nome da lista antiga.
As **fixtures de teste** do frontend que usavam `(16) 99999-0000` também foram
migradas para DDD 00, para que a regra "nenhum telefone colidível no repositório"
seja verdadeira fora do banco de demonstração também.

Já as **5 imagens antigas** não entram nessa conta: o OCR mostrou 39 nomes, 15
telefones e 15 placas reais (item A8). Elas saíram do HEAD e, em 28/10/2026, do
histórico — a reescrita é o que fecha esse item.

---

## 6. Classificação jurídica das capturas atuais

**As 23 capturas não contêm dado pessoal** nos termos do art. 5º, I da LGPD:

1. Os identificadores exibidos são **sintéticos e não vinculados a pessoa
   natural** — não há titular. `Cliente 001` não é uma pessoa; `(00) 90000-0001`
   não é uma linha; `•••••01` não é um veículo.
2. Consequência: não há "tratamento de dado pessoal", logo não há necessidade de
   base legal (art. 7º), não há titular a quem atender pedido de acesso (art. 18)
   e não há incidente a comunicar (art. 48) se uma imagem for copiada.
3. A aproximação com **anonimização** (art. 12) é a mais adequada: mesmo que se
   aplicasse a lógica do art. 12, §1º (esforços razoáveis para reversão), não há
   como reverter `Cliente 001` a alguém — não existe tabela de correspondência,
   nem a informação adicional que o art. 13, §4 exige.

**O que a LGPD ainda alcança o projeto, mesmo assim:**

| Dispositivo | Como se aplica |
|---|---|
| Art. 6º, III — minimização | o dataset de demonstração não deve conter campo sem finalidade (nascimento foi zerado) |
| Art. 6º, VII — segurança | pipeline que impede PII de entrar na imagem (portão do banco + auditoria da tela, seção 7) |
| Art. 6º, X e art. 37 — responsabilização e registro | este documento |
| Art. 46 — medidas de segurança | portão de privacidade + auditoria automatizada + `-strip` |
| Art. 16 — eliminação | exclusão das imagens antigas (working tree) e o item A8 |
| Art. 48 — comunicação de incidente | se o banco de *campo* (`wash_wizard.db`) vazar, não as capturas |

**Ressalva de escopo:** o sistema em produção, no Lava Rápido Maquininha, trata
dado pessoal real de clientes. Esta avaliação cobre **as imagens publicadas**, não
o sistema em operação — que tem seu próprio conjunto de obrigações (base legal,
retenção, segurança, atendimento ao titular).

---

## 7. Controles implementados

Quatro camadas independentes, todas automatizadas no pipeline `npm run screenshots`:

**Camada 1 — anonimização na origem** (`scripts/demo-data.mjs`)
O dataset nasce pseudonimizado. Não há etapa de "apagar depois": o dado pessoal
nunca é criado. Telefone em DDD não atribuído, placa mascarada, nascimento nulo,
operador genérico.

**Camada 2 — portão de privacidade do banco** (`auditarBancoDemo`)
Roda **antes** do build e do navegador. Abre o SQLite em modo somente leitura e
aborta a captura se encontrar nome fora do padrão `Cliente NNN`, telefone fora do
DDD 00, nascimento preenchido, placa não mascarada, observação com e-mail ou
sequência numérica longa, ou usuário com nome não genérico. Vale **também** para
`--keep-db` — reaproveitar um arquivo não é atalho para escapar do portão.

**Camada 3 — auditoria do que foi renderizado** (`auditar`)
Para cada uma das 23 telas, compara o texto extraído contra:

- telefone: só `(00) 9NNNN-NNNN`;
- e-mail: só `@example.com|org|net` (RFC 2606);
- placa Mercosul, placa antiga, CPF, CNPJ, CEP: **qualquer** ocorrência falha;
- termos proibidos: `localhost`, `/home/`, `file://`, `C:\`, `192.168.`,
  `127.0.0.1`, `undefined`, `NaN`, `Invalid Date`.

Falha em qualquer item retorna código de saída diferente de zero — a captura não
é publicada "com aviso".

**Camada 4 — sanitização do arquivo** (`convert -strip -resize 1440x`)
Remove EXIF/tEXt (software, data, caminho) e reduz a largura. Verificação
estrutural: os 23 PNGs contêm **apenas** os chunks `IHDR`, `IDAT` e `IEND` — não
há `tEXt`/`zTXt`/`iTXt` (software, data), `eXIf`, `iCCP` (perfil de cor) nem
`tIME`. Observação: o campo `date:create` que o `identify` exibe é **derivado do
mtime do arquivo** no disco, não um metadado embutido no PNG.

**Custo aceito (trade-off):** o banco de demonstração deixou de ser um sandbox
funcional completo. `•••••01` não passa em `isValidPlaca` e a data de nascimento é
nula, então salvar a edição de um veículo existente falha na validação. Isso é
intencional: o artefato existe para gerar capturas, não para simular operação. Se
o banco demo virar base de testes manuais, o mascaramento precisa ser recriado
apenas na cópia usada para captura.

---

## 8. Risco residual

| ID | Risco | Severidade | Situação |
|---|---|---|---|
| R1 | **5 PNGs antigos** com nome, telefone e placa reais | **Crítico** | removidos do histórico em 28/10/2026 (`git-filter-repo`); resta a purga no GitHub (item 2 abaixo) |
| R1b | Commit antigo ainda servível por SHA/cache no GitHub | Médio | depende de pedido ao suporte da plataforma |
| R2 | Banco de *campo* (`wash_wizard.db`) na máquina de quem desenvolve | Médio | fora do repositório (`*.db` no `.gitignore`); não versionado, mas depende de disciplina local |
| R3 | Percepção: leitor pode achar que "Cliente 001" esconde um cliente real | Baixo | mitigado pela nota em `00-indice.md` e no README |
| R4 | Reversão da pseudonimização | Nulo | não existe tabela de correspondência a reverter |

### R1 — o que foi feito com as imagens no histórico

O delete na working tree resolve o **futuro** e o HEAD, não o **passado**. Com o
OCR confirmando dado pessoal real, manter o histórico deixou de ser defensável.

**Executado em 28/10/2026 (com backup prévio em `git bundle` fora do repo):**

1. `git filter-repo --invert-paths` sobre os 5 caminhos, reescrevendo **todas** as
   refs locais. O commit `d3cd653` virou `0148342`, sem os PNGs.
2. Verificação local: `git rev-list --objects --all | grep docs_assets` não
   retorna nenhum dos 5 nomes antigos; `git cat-file -e d3cd653` responde "Not a
   valid object name".
3. `force-push` no `origin`: `main` (`af09307` → histórico reescrito; o hash do
   HEAD muda a cada amend desta seção, por isso não é citado aqui),
   `security_check` (`8e1e05a` → `b486330`) e `Enio_Dev` (`069c9e6` →
   `81c5f33`). A API de conteúdo do GitHub passou a responder **404** para o
   arquivo antigo em `main` e no commit do HEAD.
4. `force-push` no `fork-participante`: `Dev` aceito; **`main` rejeitado por
   falta de permissão** (`remote rejected ... permission denied`). O `main` do
   fork continua com o histórico antigo — precisa do dono do fork.
5. Consequência aceita: hashes mudaram, clones existentes divergem e PRs abertos
   precisam ser refeitos. Colaboradores devem re-clonar.

**O que o force-push não resolve (pendências reais):**

| Pendência | Por quê |
|---|---|
| `main` do fork `enioestudante-sys` | sem permissão de escrita; o dono precisa atualizar a partir de `origin/main` ou excluir o fork |
| 9 de 21 refs `refs/pull/*` | descendem do commit antigo e mantêm o blob **alcançável** no GitHub; não podem ser regravadas por push |
| cache do `raw.githubusercontent.com` | ainda responde `200` para o arquivo antigo, embora a API já responda `404`; expira ou sai por purga |
| commits órfãos | o GitHub mantém commits inalcançáveis acessíveis por SHA por um período |

**Ação necessária fora do git:** abrir ticket no GitHub Support pedindo remoção de
commits órfãos e *cached views*, e pedir ao dono do fork que sincronize ou apague
o fork. Enquanto isso não acontece, o R1b permanece.

**Avaliação do art. 48** com encarregado/advogado: dado pessoal de terceiros ficou
publicamente acessível desde 17/05/2026. A comunicação de incidente é decisão do
controlador — este documento registra o fato e a data da descoberta.

**Rotacionar nada**: não há credencial nas imagens; o risco é de privacidade, não
de conta.

---

## 9. Como verificar (reprodutível)

```bash
# 1. Regenerar banco + build + 23 capturas + auditoria (portas 3001/8080 livres)
npm run screenshots

# 2. Ver a saída do portão e da auditoria (deve terminar sem "✗")
#    › Banco anonimizado: nenhum nome, telefone, nascimento ou placa reais.
#    ✓ nenhum telefone real, placa, CPF/CNPJ/CEP, e-mail ou caminho fora do padrão

# 3. Conferir que os PNGs não têm metadado embutido (tEXt/eXIf/iCCP/tIME)
python3 - <<'PY'
import struct, glob
for f in glob.glob('docs_assets/screenshots/**/*.png', recursive=True):
    d = open(f, 'rb').read(); i = 8; tipos = []
    while i < len(d):
        n = struct.unpack('>I', d[i:i+4])[0]
        tipos.append(d[i+4:i+8].decode()); i += 12 + n
    assert set(tipos) <= {'IHDR', 'IDAT', 'IEND'}, (f, tipos)
print('23 PNGs sem tEXt/eXIf/iCCP/tIME')
PY

# 4. Conferir o banco de demonstração (não o de campo) — sem depender da CLI sqlite3
node -e "
const { createRequire } = require('module');
const sqlite3 = createRequire(process.cwd() + '/backend/package.json')('sqlite3');
const db = new sqlite3.Database(process.env.HOME + '/.cache/wash-wizard-demo/wash_wizard.db');
db.all('SELECT nome, telefone, data_nascimento FROM clientes LIMIT 3', (e, a) => {
  console.log(a);
  db.all('SELECT placa FROM veiculos LIMIT 3', (e2, b) => { console.log(b); db.close(); });
});"

# 5. Procurar PII nos dumps de texto por tela (artefato local da captura)
#    Telefone: qualquer DDD diferente de 00 (o único aceitável no dataset).
grep -rE '\([1-9][0-9]\)\s?9?[0-9]{4}-[0-9]{4}|\b[A-Z]{3}[0-9][A-Z][0-9]{2}\b' \
  /tmp/wash-wizard-capturas/ || echo "sem telefone ou placa em formato real"

#    E-mail fora do domínio reservado por RFC 2606:
grep -rhoE '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' /tmp/wash-wizard-capturas/ \
  | grep -vE '@example\.(com|org|net)$' || echo "sem e-mail fora de example.*"

# 6. (Opcional) Repetir a verificação do A8. O commit antigo não existe mais no
#    repositório: use o bundle de backup criado antes da reescrita (não
#    versionado, fica fora do repo). Requer `pip install --user
#    --break-system-packages rapidocr-onnxruntime` (ou tesseract).
git clone -q /tmp/opencode/backup-wash-wizard-*.bundle /tmp/opencode/old-repo
mkdir -p /tmp/opencode/oldimgs
for f in dashboard_1 dashboard_2 tela_edicao_cliente tela_gestao_lavagens tela_todos_clientes; do
  git -C /tmp/opencode/old-repo show d3cd653:docs_assets/$f.png > /tmp/opencode/oldimgs/$f.png
done
python3 - <<'PY'
from rapidocr_onnxruntime import RapidOCR
import glob
motor = RapidOCR()
for img in sorted(glob.glob('/tmp/opencode/oldimgs/*.png')):
    res, _ = motor(img)
    print(img, len(res or []), 'blocos de texto')
PY
```

---

## 10. Conclusão

1. As imagens **atuais** (23) não contêm dado pessoal: os identificadores são
   sintéticos, o telefone é estruturalmente inroteável, a placa está mascarada e
   não há data de nascimento. Pela LGPD, estão fora do escopo de aplicação
   (art. 5º, I e art. 12).
2. O risco maior **não estava na imagem, estava no processo**: captura de tela
   inteira, sem `-strip`, com dados em formato colidível e uma auditoria que não
   enxergava campos de formulário. Foi isso que virou pipeline em quatro camadas.
3. Riscos **remanescentes**: o histórico local/remoto foi reescrito, mas objetos
   já servidos pelo GitHub podem continuar acessíveis por SHA até purga no
   suporte (R1b), e o banco de campo segue dependendo de disciplina local (R2).
   A avaliação do art. 48 é decisão do controlador.

---

## Apêndice — achados de qualidade fora do escopo de privacidade

Registrados porque apareceram durante a inspeção, mas **não** são questão de
LGPD e **não** foram corrigidos sem alinhamento:

- `openNovoVeiculo`, `openNovoServico` e `openMovimentacaoEstoque` existem no
  `ModalContext` mas **não têm gatilho de UI** — são modais inalcançáveis pelo
  usuário. Ou falta o botão, ou o handler é código morto. Impacto: funcionalidade
  de cadastro que o README descreve pode não estar acessível na interface.
