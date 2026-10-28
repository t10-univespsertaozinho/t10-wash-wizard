import crypto from "crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { dbReady, withTransaction, pool } from "./db.js";
import { resolverSenhaSeed } from "./seed-credentials.js";

dotenv.config();

/**
 * Popula o PostgreSQL (Supabase) com dados de demonstração.
 *
 * Destrutivo por definição: apaga os dados existentes e recria o cenário. Roda
 * inteiro em uma transação — se qualquer INSERT falhar, a base fica como estava
 * em vez de sobrar pela metade.
 *
 * Uso: `npm run seed` (no diretório backend).
 */
async function seed() {
  await dbReady;

  // A validação das senhas roda apenas aqui: o boot da API não depende delas.
  // Em produção, senha ausente ou igual ao padrão publicado aborta o seed
  // antes de qualquer DELETE (o banco fica intacto).
  const senhaAdmin = resolverSenhaSeed("SEED_ADMIN_PASSWORD");
  const senhaOperador = resolverSenhaSeed("SEED_OPERADOR_PASSWORD");

  console.log("Iniciando seed de dados...\n");

  const getNow = () => new Date().toISOString();
  const now = getNow();
  const adminId = "admin-local";

  await withTransaction(async (tx) => {
    // Limpar dados existentes (filhos antes dos pais: as FKs são validadas
    // linha a linha pelo PostgreSQL).
    console.log("Limpando dados existentes...");
    for (const table of [
      "movimentacoes",
      "auditoria_lavagens",
      "lavagens",
      "veiculos",
      "clientes",
      "produtos",
      "tipos_lavagem",
    ]) {
      await tx.exec(`DELETE FROM ${table};`);
    }

    console.log("Criando usuários iniciais (se não existirem)...");
    const adminPasswordHash = await bcrypt.hash(senhaAdmin, 10);
    const operadorPasswordHash = await bcrypt.hash(senhaOperador, 10);

    // ON CONFLICT preserva usuários já existentes (o id antigo continua
    // valendo) e evita duplicar o e-mail único.
    const insertUser = `INSERT INTO users (id, email, nome, role, password_hash, created_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT (email) DO NOTHING`;

    // Os ids fixos acima só valem se o usuário ainda não existia. Quando o
    // e-mail já está cadastrado com outro id, reutilizamos o id real para não
    // violar as FKs de clientes/veiculos/produtos/lavagens.
    await tx.run(insertUser, [adminId, "admin@washwizard.com", "Administrador", "admin", adminPasswordHash, now]);
    await tx.run(insertUser, ["operador-local", "operador@washwizard.com", "Operador", "operador", operadorPasswordHash, now]);

    const adminRow = await tx.get("SELECT id FROM users WHERE email = ?", ["admin@washwizard.com"]);
    const adminUserId = adminRow ? adminRow.id : adminId;

  // Inserir tipos de lavagem
  console.log("Inserindo tipos de lavagens...");
  const tiposLavagem = [
    {
      id: "tl-001",
      nome: "Lavagem Simples",
      descricao: "Lavagem externa básica com água e sabão",
      preco: 25.0,
    },
    {
      id: "tl-002",
      nome: "Lavagem Completa",
      descricao: "Lavagem interna e externa completa",
      preco: 45.0,
    },
    {
      id: "tl-003",
      nome: "Polimento",
      descricao: "Polimento completo da pintura",
      preco: 80.0,
    },
    {
      id: "tl-004",
      nome: "Lavagem a Seco",
      descricao: "Lavagem ecológica sem uso de água",
      preco: 35.0,
    },
    {
      id: "tl-005",
      nome: "Cera de Proteção",
      descricao: "Aplicação de cera de proteção",
      preco: 50.0,
    },
    {
      id: "tl-006",
      nome: "Higienização Interna",
      descricao: "Limpeza profunda de estofados e carpetes",
      preco: 60.0,
    },
  ];

  const insertTipo =
    "INSERT INTO tipos_lavagem (id, nome, descricao, preco, created_at) VALUES (?, ?, ?, ?, ?)";
  for (const t of tiposLavagem) {
    await tx.run(insertTipo, [t.id, t.nome, t.descricao, t.preco, now]);
  }

  // Inserir clientes (25 clientes com data_nascimento)
  console.log("Inserindo clientes...");
  const clientes = [
    {
      id: "cli-001",
      nome: "João Silva",
      telefone: "(11) 98888-7777",
      data_nascimento: "1988-03-15",
    },
    {
      id: "cli-002",
      nome: "Maria Oliveira",
      telefone: "(11) 97777-6666",
      data_nascimento: "1992-07-22",
    },
    {
      id: "cli-003",
      nome: "Carlos Santos",
      telefone: "(11) 96666-5555",
      data_nascimento: "1985-11-05",
    },
    {
      id: "cli-004",
      nome: "Ana Paula",
      telefone: "(11) 95555-4444",
      data_nascimento: "1995-01-30",
    },
    {
      id: "cli-005",
      nome: "Pedro Costa",
      telefone: "(11) 94444-3333",
      data_nascimento: "1990-09-12",
    },
    {
      id: "cli-006",
      nome: "Juliana Ferreira",
      telefone: "(11) 93333-2222",
      data_nascimento: "1987-04-18",
    },
    {
      id: "cli-007",
      nome: "Roberto Alves",
      telefone: "(11) 92222-1111",
      data_nascimento: "1982-08-03",
    },
    {
      id: "cli-008",
      nome: "Fernanda Lima",
      telefone: "(11) 91111-0000",
      data_nascimento: "1998-12-25",
    },
    {
      id: "cli-009",
      nome: "Lucas Martins",
      telefone: "(11) 99999-8888",
      data_nascimento: "1993-05-09",
    },
    {
      id: "cli-010",
      nome: "Camila Rodrigues",
      telefone: "(11) 98887-7777",
      data_nascimento: "1991-10-14",
    },
    {
      id: "cli-011",
      nome: "Ricardo Souza",
      telefone: "(11) 97776-6666",
      data_nascimento: "1984-02-28",
    },
    {
      id: "cli-012",
      nome: "Patrícia Almeida",
      telefone: "(11) 96665-5555",
      data_nascimento: "1996-06-17",
    },
    {
      id: "cli-013",
      nome: "Marcos Pereira",
      telefone: "(11) 95554-4444",
      data_nascimento: "1989-01-08",
    },
    {
      id: "cli-014",
      nome: "Renata Castro",
      telefone: "(11) 94443-3333",
      data_nascimento: "1994-09-29",
    },
    {
      id: "cli-015",
      nome: "Gustavo Lima",
      telefone: "(11) 93332-2222",
      data_nascimento: "1986-11-20",
    },
    {
      id: "cli-016",
      nome: "Aline Barros",
      telefone: "(11) 92221-1111",
      data_nascimento: "1997-03-04",
    },
    {
      id: "cli-017",
      nome: "Bruno Gomes",
      telefone: "(11) 91110-0000",
      data_nascimento: "1990-08-19",
    },
    {
      id: "cli-018",
      nome: "Daniela Martins",
      telefone: "(11) 99998-8888",
      data_nascimento: "1983-12-11",
    },
    {
      id: "cli-019",
      nome: "Thiago Costa",
      telefone: "(11) 98886-7777",
      data_nascimento: "1992-04-26",
    },
    {
      id: "cli-020",
      nome: "Vanessa Santos",
      telefone: "(11) 97775-6666",
      data_nascimento: "1988-10-02",
    },
    {
      id: "cli-021",
      nome: "Felipe Oliveira",
      telefone: "(11) 96664-5555",
      data_nascimento: "1995-07-15",
    },
    {
      id: "cli-022",
      nome: "Gabriela Dias",
      telefone: "(11) 95553-4444",
      data_nascimento: "1999-05-23",
    },
    {
      id: "cli-023",
      nome: "Leonardo Rodrigues",
      telefone: "(11) 94442-3333",
      data_nascimento: "1981-06-30",
    },
    {
      id: "cli-024",
      nome: "Isabella Ferreira",
      telefone: "(11) 93331-2222",
      data_nascimento: "1996-02-14",
    },
    {
      id: "cli-025",
      nome: "Mateus Almeida",
      telefone: "(11) 92220-1111",
      data_nascimento: "1993-09-07",
    },
  ];

  const insertCliente =
    "INSERT INTO clientes (id, user_id, nome, telefone, data_nascimento, created_at) VALUES (?, ?, ?, ?, ?, ?)";
  for (const c of clientes) {
    await tx.run(insertCliente, [c.id, adminUserId, c.nome, c.telefone, c.data_nascimento, now]);
  }

  // Inserir veículos (um para cada cliente + alguns com múltiplos)
  console.log("Inserindo veículos...");
  const veiculos = [
    {
      id: "vei-001",
      cliente_id: "cli-001",
      modelo: "Toyota Corolla",
      placa: "ABC1234",
      cor: "Prata",
      marca: "Toyota",
    },
    {
      id: "vei-002",
      cliente_id: "cli-002",
      modelo: "Honda Civic",
      placa: "XYZ9876",
      cor: "Preto",
      marca: "Honda",
    },
    {
      id: "vei-003",
      cliente_id: "cli-003",
      modelo: "Volkswagen Gol",
      placa: "DEF5678",
      cor: "Branco",
      marca: "Volkswagen",
    },
    {
      id: "vei-004",
      cliente_id: "cli-004",
      modelo: "Ford Ka",
      placa: "GHI9012",
      cor: "Vermelho",
      marca: "Ford",
    },
    {
      id: "vei-005",
      cliente_id: "cli-005",
      modelo: "Chevrolet Onix",
      placa: "JKL3456",
      cor: "Cinza",
      marca: "Chevrolet",
    },
    {
      id: "vei-006",
      cliente_id: "cli-006",
      modelo: "Hyundai HB20",
      placa: "MNO7890",
      cor: "Azul",
      marca: "Hyundai",
    },
    {
      id: "vei-007",
      cliente_id: "cli-007",
      modelo: "Fiat Uno",
      placa: "PQR1234",
      cor: "Verde",
      marca: "Fiat",
    },
    {
      id: "vei-008",
      cliente_id: "cli-008",
      modelo: "Jeep Renegade",
      placa: "STU5678",
      cor: "Laranja",
      marca: "Jeep",
    },
    {
      id: "vei-009",
      cliente_id: "cli-009",
      modelo: "Nissan Versa",
      placa: "VWX9012",
      cor: "Preto",
      marca: "Nissan",
    },
    {
      id: "vei-010",
      cliente_id: "cli-010",
      modelo: "Toyota Etios",
      placa: "YZA3456",
      cor: "Branco",
      marca: "Toyota",
    },
    {
      id: "vei-011",
      cliente_id: "cli-011",
      modelo: "Honda Fit",
      placa: "BCD7890",
      cor: "Cinza",
      marca: "Honda",
    },
    {
      id: "vei-012",
      cliente_id: "cli-012",
      modelo: "Volkswagen Passat",
      placa: "EFG1234",
      cor: "Prata",
      marca: "Volkswagen",
    },
    {
      id: "vei-013",
      cliente_id: "cli-013",
      modelo: "Ford EcoSport",
      placa: "HIJ5678",
      cor: "Vermelho",
      marca: "Ford",
    },
    {
      id: "vei-014",
      cliente_id: "cli-014",
      modelo: "Chevrolet Spin",
      placa: "KLM9012",
      cor: "Azul",
      marca: "Chevrolet",
    },
    {
      id: "vei-015",
      cliente_id: "cli-015",
      modelo: "Hyundai Creta",
      placa: "NOP3456",
      cor: "Branco",
      marca: "Hyundai",
    },
    {
      id: "vei-016",
      cliente_id: "cli-016",
      modelo: "Fiat Pulse",
      placa: "QRS7890",
      cor: "Preto",
      marca: "Fiat",
    },
    {
      id: "vei-017",
      cliente_id: "cli-017",
      modelo: "Jeep Compass",
      placa: "TUV1234",
      cor: "Cinza",
      marca: "Jeep",
    },
    {
      id: "vei-018",
      cliente_id: "cli-018",
      modelo: "Nissan Kicks",
      placa: "WXY5678",
      cor: "Vermelho",
      marca: "Nissan",
    },
    {
      id: "vei-019",
      cliente_id: "cli-019",
      modelo: "Toyota Yaris",
      placa: "ZAB9012",
      cor: "Prata",
      marca: "Toyota",
    },
    {
      id: "vei-020",
      cliente_id: "cli-020",
      modelo: "Honda City",
      placa: "CDE3456",
      cor: "Branco",
      marca: "Honda",
    },
    {
      id: "vei-021",
      cliente_id: "cli-021",
      modelo: "Volkswagen Virtus",
      placa: "FGH7890",
      cor: "Azul",
      marca: "Volkswagen",
    },
    {
      id: "vei-022",
      cliente_id: "cli-022",
      modelo: "Ford Territory",
      placa: "IJK1234",
      cor: "Preto",
      marca: "Ford",
    },
    {
      id: "vei-023",
      cliente_id: "cli-023",
      modelo: "Chevrolet Trailblazer",
      placa: "LMN5678",
      cor: "Cinza",
      marca: "Chevrolet",
    },
    {
      id: "vei-024",
      cliente_id: "cli-024",
      modelo: "Hyundai Tucson",
      placa: "OPQ9012",
      cor: "Verde",
      marca: "Hyundai",
    },
    {
      id: "vei-025",
      cliente_id: "cli-025",
      modelo: "Fiat Strada",
      placa: "RST3456",
      cor: "Branco",
      marca: "Fiat",
    },
    {
      id: "vei-026",
      cliente_id: "cli-001",
      modelo: "Toyota Camry",
      placa: "UVW7890",
      cor: "Preto",
      marca: "Toyota",
    },
    {
      id: "vei-027",
      cliente_id: "cli-003",
      modelo: "Honda CR-V",
      placa: "XYZ1234",
      cor: "Cinza",
      marca: "Honda",
    },
  ];

  const insertVeiculo =
    "INSERT INTO veiculos (id, cliente_id, user_id, modelo, placa, cor, marca, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
  for (const v of veiculos) {
    await tx.run(insertVeiculo, [v.id, v.cliente_id, adminUserId, v.modelo, v.placa, v.cor, v.marca, now]);
  }

  // Inserir produtos
  console.log("Inserindo produtos...");
  const produtos = [
    {
      id: "prod-001",
      nome: "Shampoo Automotivo",
      quantidade: 25,
      estoque_minimo: 10,
      categoria: "Limpeza",
      unidade: "L",
      preco_unitario: 12.0,
    },
    {
      id: "prod-002",
      nome: "Cera de Polimento",
      quantidade: 8,
      estoque_minimo: 5,
      categoria: "Polimento",
      unidade: "un",
      preco_unitario: 25.0,
    },
    {
      id: "prod-003",
      nome: "Limpa Vidros",
      quantidade: 15,
      estoque_minimo: 8,
      categoria: "Limpeza",
      unidade: "L",
      preco_unitario: 8.0,
    },
    {
      id: "prod-004",
      nome: "Desengraxante",
      quantidade: 12,
      estoque_minimo: 5,
      categoria: "Limpeza",
      unidade: "L",
      preco_unitario: 15.0,
    },
    {
      id: "prod-005",
      nome: "Silicone Repelente",
      quantidade: 20,
      estoque_minimo: 10,
      categoria: "Proteção",
      unidade: "un",
      preco_unitario: 18.0,
    },
    {
      id: "prod-006",
      nome: "Escova de Limpeza",
      quantidade: 30,
      estoque_minimo: 15,
      categoria: "Outros",
      unidade: "un",
      preco_unitario: 5.0,
    },
    {
      id: "prod-007",
      nome: "Pano de Microfibra",
      quantidade: 50,
      estoque_minimo: 20,
      categoria: "Outros",
      unidade: "un",
      preco_unitario: 3.0,
    },
    {
      id: "prod-008",
      nome: "Cera Líquida",
      quantidade: 5,
      estoque_minimo: 8,
      categoria: "Polimento",
      unidade: "L",
      preco_unitario: 22.0,
    },
    {
      id: "prod-009",
      nome: "Shampoo Seco",
      quantidade: 10,
      estoque_minimo: 5,
      categoria: "Limpeza",
      unidade: "L",
      preco_unitario: 20.0,
    },
    {
      id: "prod-010",
      nome: "Borrifador",
      quantidade: 3,
      estoque_minimo: 10,
      categoria: "Outros",
      unidade: "un",
      preco_unitario: 4.0,
    },
  ];

  const insertProduto =
    "INSERT INTO produtos (id, nome, quantidade, estoque_minimo, categoria, unidade, preco_unitario, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
  for (const p of produtos) {
    await tx.run(insertProduto, [
      p.id, p.nome, p.quantidade, p.estoque_minimo, p.categoria,
      p.unidade, p.preco_unitario, adminUserId, now,
    ]);
  }

  // Inserir lavagens (dados dos últimos 6 meses)
  console.log("Inserindo lavagens (dados históricos)...");

  const generateRandomDate = (monthsAgo) => {
    const date = new Date();
    date.setMonth(date.getMonth() - monthsAgo);
    date.setDate(Math.floor(Math.random() * 28) + 1);
    date.setHours(Math.floor(Math.random() * 10) + 8);
    date.setMinutes(Math.floor(Math.random() * 60));

    const agora = new Date();
    return (date > agora ? agora : date).toISOString();
  };

  const statuses = ["concluida", "pendente", "em_progresso", "cancelada"];
  const pagamentos = ["Dinheiro", "PIX", "Débito", "Crédito", "Pendente"];

  const lavagens = [];
  let lavId = 1;

  // Gerar lavagens para os últimos 6 meses
  for (let m = 0; m < 6; m++) {
    const lavagensNoMes = Math.floor(Math.random() * 15) + 10;

    for (let i = 0; i < lavagensNoMes; i++) {
      const veiculo = veiculos[Math.floor(Math.random() * veiculos.length)];
      const tipo =
        tiposLavagem[Math.floor(Math.random() * tiposLavagem.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const pagamento =
        status === "concluida"
          ? pagamentos[Math.floor(Math.random() * 4)]
          : "Pendente";
      const data = generateRandomDate(m);

      lavagens.push({
        id: `lav-${String(lavId++).padStart(3, "0")}`,
        cliente_id: veiculo.cliente_id,
        veiculo_id: veiculo.id,
        tipo_lavagem_id: tipo.id,
        status,
        valor: tipo.preco,
        data,
        user_id: adminUserId,
        pagamento,
        observacao: "",
        data_conclusao: status === "concluida" ? data : null,
      });
    }
  }

  // Adicionar algumas lavagens pendentes e em andamento recentes
  lavagens.push(
    {
      id: "lav-900",
      cliente_id: "cli-001",
      veiculo_id: "vei-001",
      tipo_lavagem_id: "tl-001",
      status: "pendente",
      valor: 25.0,
      data: getNow(),
      user_id: adminUserId,
      pagamento: "Pendente",
      observacao: "",
      data_conclusao: null,
    },
    {
      id: "lav-901",
      cliente_id: "cli-002",
      veiculo_id: "vei-002",
      tipo_lavagem_id: "tl-002",
      status: "pendente",
      valor: 45.0,
      data: getNow(),
      user_id: adminUserId,
      pagamento: "Pendente",
      observacao: "",
      data_conclusao: null,
    },
    {
      id: "lav-902",
      cliente_id: "cli-005",
      veiculo_id: "vei-005",
      tipo_lavagem_id: "tl-003",
      status: "em_progresso",
      valor: 80.0,
      data: getNow(),
      user_id: adminUserId,
      pagamento: "PIX",
      observacao: "Cliente aguardando",
      data_conclusao: null,
    },
  );

  const insertLavagem =
    "INSERT INTO lavagens (id, cliente_id, veiculo_id, tipo_lavagem_id, status, valor, data, user_id, pagamento, observacao, data_conclusao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  for (const l of lavagens) {
    await tx.run(insertLavagem, [
      l.id, l.cliente_id, l.veiculo_id, l.tipo_lavagem_id, l.status, l.valor,
      l.data, l.user_id, l.pagamento, l.observacao, l.data_conclusao,
    ]);
  }

  // Inserir movimentações
  console.log("Inserindo movimentações...");
  const movimentacoes = [];

  for (let m = 0; m < 6; m++) {
    const data = generateRandomDate(m);

    // Entrada de produtos
    produtos.forEach((p) => {
      if (Math.random() > 0.3) {
        movimentacoes.push({
          id: `mov-${crypto.randomUUID().slice(0, 8)}`,
          produto_id: p.id,
          tipo: "entrada",
          quantidade: Math.floor(Math.random() * 20) + 5,
          observacao: "Reposição mensal",
          user_id: adminUserId,
          data,
        });
      }
    });

    // Saída de produtos
    produtos.forEach((p) => {
      if (Math.random() > 0.5) {
        movimentacoes.push({
          id: `mov-${crypto.randomUUID().slice(0, 8)}`,
          produto_id: p.id,
          tipo: "saida",
          quantidade: Math.floor(Math.random() * 10) + 1,
          observacao: "Consumo lavagens",
          user_id: adminUserId,
          data,
        });
      }
    });
  }

  const insertMovimentacao =
    "INSERT INTO movimentacoes (id, produto_id, tipo, quantidade, observacao, user_id, data) VALUES (?, ?, ?, ?, ?, ?, ?)";
  for (const m of movimentacoes) {
    await tx.run(insertMovimentacao, [
      m.id, m.produto_id, m.tipo, m.quantidade, m.observacao, m.user_id, m.data,
    ]);
  }

  console.log("\n=== Seed concluído com sucesso! ===\n");
  console.log("Resumo dos dados inseridos:");
  console.log(`- Usuários: 2 (admin e operador)`);
  console.log(`- Tipos de Lavagem: ${tiposLavagem.length}`);
  console.log(`- Clientes: ${clientes.length}`);
  console.log(`- Veículos: ${veiculos.length}`);
  console.log(`- Produtos: ${produtos.length}`);
  console.log(
    `- Lavagens: ${lavagens.length} (inclui ${lavagens.filter((l) => l.status === "concluida").length} concluídas)`,
  );
  console.log(`- Movimentações: ${movimentacoes.length}`);
  }); // end withTransaction
}

seed()
  .catch((err) => {
    console.error("\nFalha no seed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
