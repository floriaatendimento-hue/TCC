'use strict';

require('dotenv').config();
const fs    = require('fs');
const path  = require('path');
const mysql = require('mysql2/promise');

const { montarConfigBanco: montarConfig } = require('./dbConfig');

// Helpers de introspecção

async function existeTabela(conn, schema, tabela) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS total FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [schema, tabela]
  );
  return rows[0].total > 0;
}

async function existeColuna(conn, schema, tabela, coluna) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [schema, tabela, coluna]
  );
  return rows[0].total > 0;
}

async function tipoDaColuna(conn, schema, tabela, coluna) {
  const [rows] = await conn.query(
    `SELECT COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [schema, tabela, coluna]
  );
  return rows[0] || null;
}

async function existeIndice(conn, schema, tabela, nomeIndice) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS total FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [schema, tabela, nomeIndice]
  );
  return rows[0].total > 0;
}

async function existeForeignKeyNaColuna(conn, schema, tabela, coluna) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS total FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [schema, tabela, coluna]
  );
  return rows[0].total > 0;
}

async function executarArquivo(conn, nomeArquivo) {
  const caminho = path.join(__dirname, nomeArquivo);
  const banco = montarConfig().database.replace(/`/g, '');
  const sql = fs.readFileSync(caminho, 'utf8')
    .replace(/CREATE DATABASE IF NOT EXISTS floria\b/g, `CREATE DATABASE IF NOT EXISTS \`${banco}\``)
    .replace(/^USE floria;/gm, `USE \`${banco}\`;`);
  await conn.query(sql);
}

const COLUNAS_PEDIDOS = [
  ['subtotal',            "DECIMAL(10,2) NOT NULL DEFAULT 0"],
  ['frete',               "DECIMAL(10,2) NOT NULL DEFAULT 0"],
  ['desconto',            "DECIMAL(10,2) NOT NULL DEFAULT 0"],
  ['cupom',               "VARCHAR(40) DEFAULT NULL"],
  ['parcelas',            "TINYINT UNSIGNED NOT NULL DEFAULT 1"],
  ['transportadora',      "VARCHAR(80) DEFAULT NULL"],
  ['codigo_rastreio',     "VARCHAR(60) DEFAULT NULL"],
  ['previsao_entrega',    "DATE DEFAULT NULL"],
  ['motivo_cancelamento', "VARCHAR(255) DEFAULT NULL"],
  ['end_rotulo',          "VARCHAR(60) DEFAULT NULL"],
  ['end_destinatario',    "VARCHAR(120) DEFAULT NULL"],
  ['end_telefone',        "VARCHAR(20) DEFAULT NULL"],
  ['end_cep',             "VARCHAR(9) DEFAULT NULL"],
  ['end_logradouro',      "VARCHAR(180) DEFAULT NULL"],
  ['end_numero',          "VARCHAR(20) DEFAULT NULL"],
  ['end_complemento',     "VARCHAR(80) DEFAULT NULL"],
  ['end_bairro',          "VARCHAR(100) DEFAULT NULL"],
  ['end_cidade',          "VARCHAR(100) DEFAULT NULL"],
  ['end_uf',              "CHAR(2) DEFAULT NULL"],
];

const COLUNAS_PEDIDOS_COMPROVANTE = [
  ['status_pagamento', "ENUM('pendente','aprovado','recusado','estornado') NOT NULL DEFAULT 'pendente'"],
  ['observacoes',      "VARCHAR(500) DEFAULT NULL"],
];

const COLUNAS_ITENS = [
  ['produto_nome',   "VARCHAR(150) DEFAULT NULL"],
  ['produto_imagem', "VARCHAR(255) DEFAULT NULL"],
  ['categoria_nome', "VARCHAR(80) DEFAULT NULL"],
];

async function adicionarColunasFaltantes(conn, schema, tabela, colunas) {
  for (const [nome, definicao] of colunas) {
    const jaExiste = await existeColuna(conn, schema, tabela, nome);
    if (!jaExiste) {
      await conn.query(`ALTER TABLE \`${tabela}\` ADD COLUMN \`${nome}\` ${definicao}`);
      console.log(`   + coluna ${tabela}.${nome} criada`);
    }
  }
}

async function migrarStatusEnum(conn, schema) {
  const info = await tipoDaColuna(conn, schema, 'pedidos', 'status');
  const tipoAtual = info?.COLUMN_TYPE || '';
  if (tipoAtual.includes('em_transporte')) return; // já está na versão nova

  await conn.query(
    `ALTER TABLE pedidos MODIFY COLUMN status
       ENUM('pendente','pago','preparando','enviado','em_transporte','saiu_entrega','entregue','cancelado')
       NOT NULL DEFAULT 'preparando'`
  );
  await conn.query(`UPDATE pedidos SET status = 'preparando' WHERE status IN ('pendente','pago')`);
  await conn.query(
    `ALTER TABLE pedidos MODIFY COLUMN status
       ENUM('preparando','enviado','em_transporte','saiu_entrega','entregue','cancelado')
       NOT NULL DEFAULT 'preparando'`
  );
  console.log('   + status migrado para as 6 etapas novas');
}

async function preencherSnapshotEndereco(conn) {
  await conn.query(`
    UPDATE pedidos p
      JOIN enderecos e ON e.id = p.endereco_id
       SET p.end_rotulo       = e.rotulo,
           p.end_destinatario = e.destinatario,
           p.end_telefone     = e.telefone,
           p.end_cep          = e.cep,
           p.end_logradouro   = e.logradouro,
           p.end_numero       = e.numero,
           p.end_complemento  = e.complemento,
           p.end_bairro       = e.bairro,
           p.end_cidade       = e.cidade,
           p.end_uf           = e.uf
     WHERE p.end_logradouro IS NULL
  `);
  await conn.query(`UPDATE pedidos SET subtotal = total WHERE subtotal = 0`);
}

async function preencherSnapshotItens(conn) {
  await conn.query(`
    UPDATE itens_pedido i
      JOIN produtos pr  ON pr.id = i.produto_id
      JOIN categorias c ON c.id = pr.categoria_id
       SET i.produto_nome   = pr.nome,
           i.produto_imagem = pr.imagem,
           i.categoria_nome = c.nome
     WHERE i.produto_nome IS NULL
  `);
}

async function ajustarFkProdutoId(conn, schema) {
  const info = await tipoDaColuna(conn, schema, 'itens_pedido', 'produto_id');
  if (!info || info.IS_NULLABLE === 'YES') return; // já ajustado

  const [fkRows] = await conn.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'itens_pedido'
        AND COLUMN_NAME = 'produto_id' AND REFERENCED_TABLE_NAME = 'produtos'`,
    [schema]
  );
  if (fkRows[0]) {
    await conn.query(`ALTER TABLE itens_pedido DROP FOREIGN KEY \`${fkRows[0].CONSTRAINT_NAME}\``);
  }
  await conn.query(`ALTER TABLE itens_pedido MODIFY COLUMN produto_id INT UNSIGNED DEFAULT NULL`);
  await conn.query(
    `ALTER TABLE itens_pedido ADD CONSTRAINT itens_pedido_produto_fk
       FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL`
  );
  console.log('   + FK de itens_pedido.produto_id ajustada (aceita produto excluído)');
}

async function criarTimelineSeNecessario(conn, schema) {
  const jaExiste = await existeTabela(conn, schema, 'pedido_timeline');
  if (!jaExiste) {
    await conn.query(`
      CREATE TABLE pedido_timeline (
        id                  INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
        pedido_id           INT UNSIGNED  NOT NULL,
        etapa               ENUM('confirmado','preparando','enviado','em_transporte','saiu_entrega','entregue','cancelado')
                                          NOT NULL,
        observacao          VARCHAR(255)  DEFAULT NULL,
        usuario_admin_nome  VARCHAR(120)  DEFAULT NULL,
        criado_em           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
        INDEX idx_timeline_pedido (pedido_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela pedido_timeline criada');
  }

  await adicionarColunasFaltantes(conn, schema, 'pedido_timeline', [
    ['usuario_admin_nome', 'VARCHAR(120) DEFAULT NULL'],
  ]);

  await conn.query(`
    INSERT INTO pedido_timeline (pedido_id, etapa, criado_em)
    SELECT p.id, 'confirmado', p.criado_em
      FROM pedidos p
     WHERE NOT EXISTS (SELECT 1 FROM pedido_timeline t WHERE t.pedido_id = p.id)
  `);
  await conn.query(`
    INSERT INTO pedido_timeline (pedido_id, etapa, criado_em)
    SELECT p.id, p.status, p.atualizado_em
      FROM pedidos p
     WHERE p.status <> 'preparando'
       AND NOT EXISTS (SELECT 1 FROM pedido_timeline t WHERE t.pedido_id = p.id AND t.etapa = p.status)
  `);
}

async function aplicarMigracaoDetalhesPedido(conn, schema) {
  await adicionarColunasFaltantes(conn, schema, 'pedidos', COLUNAS_PEDIDOS);
  await migrarStatusEnum(conn, schema);
  await preencherSnapshotEndereco(conn);
  await adicionarColunasFaltantes(conn, schema, 'itens_pedido', COLUNAS_ITENS);
  await preencherSnapshotItens(conn);
  await ajustarFkProdutoId(conn, schema);
  await criarTimelineSeNecessario(conn, schema);
}

async function criarComprovantesSeNecessario(conn, schema) {
  await adicionarColunasFaltantes(conn, schema, 'pedidos', COLUNAS_PEDIDOS_COMPROVANTE);

  const jaExiste = await existeTabela(conn, schema, 'comprovantes');
  if (!jaExiste) {
    await conn.query(`
      CREATE TABLE comprovantes (
        id               INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
        pedido_id        INT UNSIGNED   NOT NULL UNIQUE,
        codigo           VARCHAR(20)    NOT NULL UNIQUE,
        emissoes         INT UNSIGNED   NOT NULL DEFAULT 1,
        enviado_email_em TIMESTAMP      NULL DEFAULT NULL,
        email_destino    VARCHAR(150)   DEFAULT NULL,
        envios_email     INT UNSIGNED   NOT NULL DEFAULT 0,
        criado_em        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela comprovantes criada');
  }

  await conn.query(`UPDATE pedidos SET status_pagamento = 'estornado' WHERE status = 'cancelado' AND status_pagamento <> 'estornado'`);
}

const COLUNAS_PRODUTOS = [
  ['slug_pagina', "VARCHAR(120) DEFAULT NULL"],
  ['tags',        "VARCHAR(255) DEFAULT NULL"],
];

async function preencherTagsConhecidas(conn) {
  await conn.query(
    `UPDATE produtos SET tags = 'monstera'
      WHERE slug = 'costela-de-adao' AND tags IS NULL`
  );
}

async function garantirProdutosRelacionados(conn, schema) {
  await adicionarColunasFaltantes(conn, schema, 'produtos', COLUNAS_PRODUTOS);
  await executarArquivo(conn, 'database/seeds/seed_produtos_relacionados.sql');
  await preencherTagsConhecidas(conn);
}

const COLUNAS_PRODUTOS_ESPECIFICACOES = [
  ['especificacoes', "JSON DEFAULT NULL"],
];

async function garantirNovasCategorias(conn, schema) {
  await adicionarColunasFaltantes(conn, schema, 'produtos', COLUNAS_PRODUTOS_ESPECIFICACOES);
  await adicionarColunasFaltantes(conn, schema, 'produtos', COLUNAS_PRODUTOS_PADRAO);

  await conn.query(
    `INSERT IGNORE INTO categorias (nome, slug, descricao) VALUES
       ('Ferramentas',        'ferramentas',      'Ferramentas de jardinagem para plantar, podar e cultivar'),
       ('Adubos',             'adubos',           'Adubos e fertilizantes para nutrir suas plantas'),
       ('Controle de Pragas', 'controle-pragas',  'Produtos para prevenir e controlar pragas e doenças no jardim')`
  );

  await executarArquivo(conn, 'database/seeds/seed_novas_categorias.sql');
}

async function garantirCategoriaVasos(conn, schema) {
  await adicionarColunasFaltantes(conn, schema, 'produtos', COLUNAS_PRODUTOS_PADRAO);
  await conn.query(
    `INSERT IGNORE INTO categorias (nome, slug, descricao) VALUES
       ('Vasos', 'vasos', 'Vasos, cachepôs e suportes')`
  );
  await executarArquivo(conn, 'database/seeds/seed_vasos.sql');
}

const COLUNAS_PRODUTOS_FILTROS = [
  ['pet_friendly', "TINYINT(1) NOT NULL DEFAULT 0"],
  ['pouca_luz',    "TINYINT(1) NOT NULL DEFAULT 0"],
];

const ATRIBUTOS_PLANTAS = [
  ['comigo-ninguem-pode',     1,         0], // Dieffenbachia — tóxica
  ['samambaia',               1,         1], // Nephrolepis exaltata — não tóxica
  ['alecrim',                 0,         1], // Rosmarinus officinalis — não tóxico
  ['babosa',                  0,         0], // Aloe vera — tóxica
  ['cacto',                   0,         1], // não tóxico
  ['costela-de-adao',         1,         0], // Monstera deliciosa — tóxica
  ['orquidea',                0,         1], // Phalaenopsis — não tóxica
  ['lavanda',                 0,         0],
  ['jasmim',                  0,         0],
  ['hortela',                 0,         1], // Mentha — não tóxica
  ['espadadesaojorge',        1,         0], // Sansevieria — tóxica
  ['manjericao',              0,         1], // Ocimum basilicum — não tóxico
  ['singonio',                1,         0], // Syngonium — tóxico
  ['zamioculca',              1,         0], // Zamioculcas zamiifolia — tóxica
  ['philodendron',            1,         0], // Philodendron — tóxico
];

async function preencherAtributosPlantas(conn) {
  for (const [slug, poucaLuz, petFriendly] of ATRIBUTOS_PLANTAS) {
    await conn.query(
      `UPDATE produtos SET pouca_luz = ?, pet_friendly = ?
        WHERE slug = ? OR slug_pagina = ?`,
      [poucaLuz, petFriendly, slug, slug]
    );
  }
}

async function garantirFiltrosAvancados(conn, schema) {
  await adicionarColunasFaltantes(conn, schema, 'produtos', COLUNAS_PRODUTOS_FILTROS);
  await preencherAtributosPlantas(conn);
}

async function removerCategoriaDecoracoes(conn) {
  await conn.query(
    `DELETE FROM categorias
      WHERE slug = 'decoracoes'
        AND id NOT IN (SELECT DISTINCT categoria_id FROM produtos)`
  );
}

const COLUNAS_CATEGORIAS_ADMIN = [
  ['ativa', 'TINYINT(1) NOT NULL DEFAULT 1'],
  ['ordem', 'INT UNSIGNED NOT NULL DEFAULT 0'],
];

const COLUNAS_PRODUTOS_SUBCATEGORIA = [
  ['subcategoria_id', 'INT UNSIGNED DEFAULT NULL'],
];

const SEED_SUBCATEGORIAS = {
  plantas: [
    ['Suculentas', 'suculentas'],
    ['Samambaias', 'samambaias'],
    ['Orquídeas', 'orquideas'],
    ['Árvores frutíferas', 'arvores-frutiferas'],
    ['Folhagens', 'folhagens'],
  ],
  vasos: [
    ['Cerâmica', 'ceramica'],
    ['Vidro', 'vidro'],
    ['Concreto e cimento', 'concreto-cimento'],
    ['Decorativos e funcionais', 'decorativos-funcionais'],
  ],
  ferramentas: [
    ['Poda', 'poda'],
    ['Irrigação', 'irrigacao'],
    ['Ferramentas manuais', 'ferramentas-manuais'],
    ['Acessórios', 'acessorios'],
  ],
  adubos: [
    ['Orgânicos', 'organicos'],
    ['Minerais (NPK)', 'minerais-npk'],
    ['Fertilizantes específicos', 'fertilizantes-especificos'],
    ['Corretivos e complementos', 'corretivos-complementos'],
  ],
  'controle-pragas': [
    ['Prevenção', 'prevencao'],
    ['Tratamento', 'tratamento'],
    ['Pragas específicas', 'pragas-especificas'],
    ['Proteção das plantas', 'protecao-plantas'],
  ],
};

async function semearOrdemCategorias(conn) {
  const [rows] = await conn.query('SELECT id FROM categorias ORDER BY nome');
  const [contagem] = await conn.query('SELECT COUNT(*) AS totalComOrdem FROM categorias WHERE ordem > 0');
  if (contagem[0].totalComOrdem > 0) return;
  for (let i = 0; i < rows.length; i++) {
    await conn.query('UPDATE categorias SET ordem = ? WHERE id = ?', [i, rows[i].id]);
  }
}

async function semearSubcategorias(conn) {
  for (const [slugCategoria, subs] of Object.entries(SEED_SUBCATEGORIAS)) {
    const [catRows] = await conn.query('SELECT id FROM categorias WHERE slug = ?', [slugCategoria]);
    const categoria = catRows[0];
    if (!categoria) continue;
    for (let i = 0; i < subs.length; i++) {
      const [nome, slug] = subs[i];
      await conn.query(
        `INSERT IGNORE INTO subcategorias (categoria_id, nome, slug, ordem) VALUES (?, ?, ?, ?)`,
        [categoria.id, nome, slug, i]
      );
    }
  }
}

const SEED_PRODUTOS_SUBCATEGORIA = [
  ['samambaia',                 'plantas',          'samambaias'],
  ['orquidea',                  'plantas',          'orquideas'],
  ['babosa',                    'plantas',          'suculentas'],       // Aloe vera é uma suculenta
  ['cacto',                     'plantas',          'suculentas'],       // agrupado comercialmente com suculentas
  ['espadadesaojorge',          'plantas',          'suculentas'],       // Sansevieria — folhas suculentas
  ['costela-de-adao',           'plantas',          'folhagens'],
  ['comigo-ninguem-pode',       'plantas',          'folhagens'],
  ['singonio',                  'plantas',          'folhagens'],
  ['zamioculca',                'plantas',          'folhagens'],
  ['philodendron',              'plantas',          'folhagens'],

  ['vaso-ceramica-rosa',        'vasos',            'ceramica'],
  ['vaso-ceramica-azul',        'vasos',            'ceramica'],
  ['vaso-barro-tradicional',    'vasos',            'ceramica'],
  ['vaso-barro-artesanal',      'vasos',            'ceramica'],
  ['vaso-esmaltado',            'vasos',            'ceramica'],         // esmalte é acabamento cerâmico
  ['vaso-ceramica-decorado',    'vasos',            'ceramica'],
  ['vaso-vidro-transparente',   'vasos',            'vidro'],
  ['vaso-cimento-rustico',      'vasos',            'concreto-cimento'],
  ['vaso-concreto-geometrico',  'vasos',            'concreto-cimento'],
  ['vaso-geometrico',           'vasos',            'concreto-cimento'],

  ['regador-metal-5l',          'ferramentas',      'irrigacao'],
  ['tesoura-poda-profissional', 'ferramentas',      'poda'],

  ['adubo-organico-composto-5kg', 'adubos',         'organicos'],
  ['humus-minhoca-2kg',           'adubos',         'organicos'],
  ['fertilizante-npk-10-10-10',   'adubos',         'minerais-npk'],
  ['adubo-suculentas-cactos',     'adubos',         'minerais-npk'],     // formulação NPK 2-7-7

  ['armadilha-adesiva-insetos',   'controle-pragas', 'prevencao'],       // captura/monitoramento
  ['repelente-natural-pulgoes',   'controle-pragas', 'prevencao'],
  ['sabao-inseticida-natural',    'controle-pragas', 'tratamento'],      // elimina praga já presente
];

async function preencherSubcategoriaProdutos(conn) {
  for (const [slugProduto, slugCategoria, slugSubcategoria] of SEED_PRODUTOS_SUBCATEGORIA) {
    await conn.query(
      `UPDATE produtos p
          JOIN categorias c ON c.slug = ?
          JOIN subcategorias s ON s.categoria_id = c.id AND s.slug = ?
         SET p.subcategoria_id = s.id
       WHERE (p.slug = ? OR p.slug_pagina = ?) AND p.subcategoria_id IS NULL`,
      [slugCategoria, slugSubcategoria, slugProduto, slugProduto]
    );
  }
}

async function garantirCategoriasSubcategorias(conn, schema) {
  await adicionarColunasFaltantes(conn, schema, 'categorias', COLUNAS_CATEGORIAS_ADMIN);
  await semearOrdemCategorias(conn);

  const jaExisteTabela = await existeTabela(conn, schema, 'subcategorias');
  if (!jaExisteTabela) {
    await conn.query(`
      CREATE TABLE subcategorias (
        id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
        categoria_id  INT UNSIGNED  NOT NULL,
        nome          VARCHAR(80)   NOT NULL,
        slug          VARCHAR(80)   NOT NULL,
        descricao     TEXT          DEFAULT NULL,
        ativa         TINYINT(1)    NOT NULL DEFAULT 1,
        ordem         INT UNSIGNED  NOT NULL DEFAULT 0,
        criado_em     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE,
        UNIQUE KEY uk_subcategoria_categoria_slug (categoria_id, slug),
        INDEX idx_subcategorias_categoria (categoria_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela subcategorias criada');
  }

  await adicionarColunasFaltantes(conn, schema, 'produtos', COLUNAS_PRODUTOS_SUBCATEGORIA);
  await semearSubcategorias(conn);
  await preencherSubcategoriaProdutos(conn);
}

async function garantirCatalogoCompleto(conn, schema) {
  await adicionarColunasFaltantes(conn, schema, 'produtos', COLUNAS_PRODUTOS_PADRAO);
  await executarArquivo(conn, 'database/seeds/seed_catalogo_completo.sql');
}

async function garantirCuponsBanners(conn, schema) {
  const jaExisteCupons = await existeTabela(conn, schema, 'cupons');
  if (!jaExisteCupons) {
    await conn.query(`
      CREATE TABLE cupons (
        id             INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
        codigo         VARCHAR(40)   DEFAULT NULL,
        tipo           ENUM('percentual','fixo','frete_gratis') NOT NULL DEFAULT 'percentual',
        valor          DECIMAL(10,2) DEFAULT NULL,
        valor_minimo   DECIMAL(10,2) DEFAULT NULL,
        data_inicio    DATE          DEFAULT NULL,
        data_fim       DATE          DEFAULT NULL,
        limite_usos    INT UNSIGNED  DEFAULT NULL,
        usos_atual     INT UNSIGNED  NOT NULL DEFAULT 0,
        ativo          TINYINT(1)    NOT NULL DEFAULT 1,
        criado_em      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_cupons_codigo (codigo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela cupons criada');
  }

  const jaExisteBanners = await existeTabela(conn, schema, 'banners');
  if (!jaExisteBanners) {
    await conn.query(`
      CREATE TABLE banners (
        id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
        titulo        VARCHAR(120)  NOT NULL,
        subtitulo     VARCHAR(200)  DEFAULT NULL,
        imagem        VARCHAR(255)  NOT NULL,
        texto_botao   VARCHAR(60)   DEFAULT NULL,
        link          VARCHAR(255)  DEFAULT NULL,
        ordem         INT UNSIGNED  NOT NULL DEFAULT 0,
        ativo         TINYINT(1)    NOT NULL DEFAULT 1,
        data_inicio   DATETIME      DEFAULT NULL,
        data_fim      DATETIME      DEFAULT NULL,
        criado_em     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela banners criada');
  }

  await adicionarColunasFaltantes(conn, schema, 'banners', [
    ['subtitulo',     'VARCHAR(200) DEFAULT NULL'],
    ['texto_botao',   'VARCHAR(60) DEFAULT NULL'],
    ['atualizado_em', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
  ]);

  const infoDataInicio = await tipoDaColuna(conn, schema, 'banners', 'data_inicio');
  if ((infoDataInicio?.COLUMN_TYPE || '').toLowerCase() === 'date') {
    await conn.query('ALTER TABLE banners MODIFY COLUMN data_inicio DATETIME DEFAULT NULL');
    await conn.query('ALTER TABLE banners MODIFY COLUMN data_fim DATETIME DEFAULT NULL');
    console.log('   + banners.data_inicio/data_fim migradas de DATE para DATETIME');
  }

  const [[{ totalBanners }]] = await conn.query('SELECT COUNT(*) AS totalBanners FROM banners');
  if (totalBanners === 0) {
    const SEED_BANNERS = [
      ['Confira os mais vendidos',          '1.png', '/maisvendidos'],
      ['Novidades para o seu jardim',       '2.png', '/maisvendidos'],
      ['Plantas para todos os ambientes',   '3.png', '/plantas'],
      ['Vasos para decorar sua casa',       '4.png', '/vasos'],
    ];
    for (let i = 0; i < SEED_BANNERS.length; i++) {
      const [titulo, imagem, link] = SEED_BANNERS[i];
      await conn.query(
        'INSERT INTO banners (titulo, imagem, link, ordem, ativo) VALUES (?, ?, ?, ?, 1)',
        [titulo, imagem, link, i]
      );
    }
    console.log('   + banners semeados a partir do carrossel estático anterior');
  }

  await adicionarColunasFaltantes(conn, schema, 'comentarios', [
    ['resposta',    'TEXT DEFAULT NULL'],
    ['resposta_em', 'TIMESTAMP NULL DEFAULT NULL'],
  ]);
}

async function garantirPromocoes(conn, schema) {
  const jaExistePromocoes = await existeTabela(conn, schema, 'promocoes');
  if (!jaExistePromocoes) {
    await conn.query(`
      CREATE TABLE promocoes (
        id                  INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
        nome                VARCHAR(120)  NOT NULL,
        tipo                ENUM('categoria','subcategoria','produto',
                                  'valor_minimo_produto','valor_minimo_carrinho','todos') NOT NULL,
        categoria_id        INT UNSIGNED  DEFAULT NULL,
        subcategoria_id     INT UNSIGNED  DEFAULT NULL,
        valor_minimo        DECIMAL(10,2) DEFAULT NULL,
        desconto_percentual DECIMAL(5,2)  NOT NULL,
        data_inicio         DATE          DEFAULT NULL,
        data_fim            DATE          DEFAULT NULL,
        ativo               TINYINT(1)    NOT NULL DEFAULT 1,
        criado_em           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE,
        INDEX idx_promocoes_tipo (tipo),
        INDEX idx_promocoes_categoria (categoria_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela promocoes criada');
  }

  const jaExistePromocaoProdutos = await existeTabela(conn, schema, 'promocao_produtos');
  if (!jaExistePromocaoProdutos) {
    await conn.query(`
      CREATE TABLE promocao_produtos (
        promocao_id INT UNSIGNED NOT NULL,
        produto_id  INT UNSIGNED NOT NULL,
        PRIMARY KEY (promocao_id, produto_id),
        FOREIGN KEY (promocao_id) REFERENCES promocoes(id) ON DELETE CASCADE,
        FOREIGN KEY (produto_id)  REFERENCES produtos(id)  ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela promocao_produtos criada');
  }

  await adicionarColunasFaltantes(conn, schema, 'itens_pedido', [
    ['promocao_id',     'INT UNSIGNED DEFAULT NULL'],
    ['promocao_nome',   'VARCHAR(120) DEFAULT NULL'],
    ['preco_original',  'DECIMAL(10,2) DEFAULT NULL'],
  ]);

  await adicionarColunasFaltantes(conn, schema, 'pedidos', [
    ['promocao_carrinho_id',        'INT UNSIGNED DEFAULT NULL'],
    ['promocao_carrinho_nome',      'VARCHAR(120) DEFAULT NULL'],
    ['desconto_promocao_carrinho',  'DECIMAL(10,2) NOT NULL DEFAULT 0'],
  ]);
}

const SEED_CONFIGURACOES = {
  loja_nome:          'Floria',
  loja_email:         'contato@floria.com.br',
  telefone_exibicao:  '+55 11 4002-8922',
  telefone_e164:      '+551140028922',
  whatsapp_numero:    '5511999999999',
  whatsapp_mensagem:  'Olá! Vim pelo site da Floria e gostaria de saber mais sobre os produtos.',
  facebook:           'https://www.facebook.com/floriaplantas',
  instagram:          'https://www.instagram.com/floriaplantas',
  frete_padrao:       '15.00',
  frete_gratis_acima: '150.00',
  cep_origem:         '01310930',
  uf_origem:          'SP',
  cidade_origem:      'São Paulo',
  bairro_origem:      'Bela Vista',
  logradouro_origem:  'Avenida Paulista',
  numero_origem:      '',
  ufs_entrega_permitidas: '',
};

async function garantirConfiguracoesLogs(conn, schema) {
  const jaExisteConfig = await existeTabela(conn, schema, 'configuracoes');
  if (!jaExisteConfig) {
    await conn.query(`
      CREATE TABLE configuracoes (
        chave       VARCHAR(60)  NOT NULL PRIMARY KEY,
        valor       TEXT         DEFAULT NULL,
        atualizado_em TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela configuracoes criada');
  }
  for (const [chave, valor] of Object.entries(SEED_CONFIGURACOES)) {
    await conn.query('INSERT IGNORE INTO configuracoes (chave, valor) VALUES (?, ?)', [chave, valor]);
  }

  const jaExisteLogs = await existeTabela(conn, schema, 'logs_admin');
  if (!jaExisteLogs) {
    await conn.query(`
      CREATE TABLE logs_admin (
        id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
        usuario_id    INT UNSIGNED  DEFAULT NULL,
        usuario_nome  VARCHAR(120)  DEFAULT NULL,
        acao          VARCHAR(60)   NOT NULL,
        detalhes      VARCHAR(255)  DEFAULT NULL,
        criado_em     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_logs_admin_criado (criado_em),
        INDEX idx_logs_admin_acao (acao)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela logs_admin criada');
  }

  await garantirAuditoriaLogs(conn, schema);
}

const COLUNAS_LOGS_AUDITORIA = [
  ['ip',                   'VARCHAR(45) DEFAULT NULL'],
  ['navegador',            'VARCHAR(40) DEFAULT NULL'],
  ['sistema_operacional',  'VARCHAR(40) DEFAULT NULL'],
  ['dispositivo',          'VARCHAR(20) DEFAULT NULL'],
  ['dados_antes',          'JSON DEFAULT NULL'],
  ['dados_depois',         'JSON DEFAULT NULL'],
];

async function garantirAuditoriaLogs(conn, schema) {
  await adicionarColunasFaltantes(conn, schema, 'logs_admin', COLUNAS_LOGS_AUDITORIA);

  const [rows] = await conn.query(
    `SELECT COUNT(*) AS total FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'logs_admin' AND INDEX_NAME = 'idx_logs_admin_usuario'`,
    [schema]
  );
  if (rows[0].total === 0) {
    await conn.query('ALTER TABLE logs_admin ADD INDEX idx_logs_admin_usuario (usuario_id)');
    console.log('   + índice logs_admin.usuario_id criado');
  }
}

async function garantirEstoqueDetalhado(conn, schema) {
  await adicionarColunasFaltantes(conn, schema, 'produtos', [
    ['estoque_minimo', 'INT UNSIGNED NOT NULL DEFAULT 5'],
  ]);

  const jaExiste = await existeTabela(conn, schema, 'movimentacoes_estoque');
  if (!jaExiste) {
    await conn.query(`
      CREATE TABLE movimentacoes_estoque (
        id                INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
        produto_id        INT UNSIGNED  NOT NULL,
        produto_nome      VARCHAR(150)  DEFAULT NULL,
        tipo              ENUM('entrada','saida','ajuste') NOT NULL,
        quantidade        INT           NOT NULL,
        estoque_anterior  INT           NOT NULL,
        estoque_novo      INT           NOT NULL,
        motivo            VARCHAR(255)  DEFAULT NULL,
        usuario_id        INT UNSIGNED  DEFAULT NULL,
        usuario_nome      VARCHAR(120)  DEFAULT NULL,
        criado_em         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
        INDEX idx_movimentacoes_produto (produto_id),
        INDEX idx_movimentacoes_criado (criado_em)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela movimentacoes_estoque criada');
  }
}

async function garantirNotasInternasClientes(conn, schema) {
  const jaExiste = await existeTabela(conn, schema, 'clientes_notas_internas');
  if (!jaExiste) {
    await conn.query(`
      CREATE TABLE clientes_notas_internas (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        usuario_id  INT UNSIGNED NOT NULL,
        admin_id    INT UNSIGNED DEFAULT NULL,
        admin_nome  VARCHAR(120) DEFAULT NULL,
        nota        TEXT NOT NULL,
        criado_em   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (admin_id)   REFERENCES usuarios(id) ON DELETE SET NULL,
        INDEX idx_notas_internas_usuario (usuario_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela clientes_notas_internas criada');
  }
}

const SEED_NIVEIS_CLIENTES = [
  ['Semente',     '🌱',    0, 'Todo jardim começa aqui — seu primeiro passo na Floria.',      'Acesso à loja completa\nAcompanhamento de pedidos'],
  ['Broto',       '🌿',  100, 'Suas primeiras plantas já criaram raiz.',                       'Tudo do nível anterior\nOfertas selecionadas por e-mail'],
  ['Jardineiro',  '🪴',  250, 'Você já cuida de um cantinho verde de verdade.',                'Tudo do nível anterior\nAcesso antecipado a novidades'],
  ['Cultivador',  '🌳',  500, 'Seu jardim virou rotina — e ficou lindo.',                      'Tudo do nível anterior\nFrete promocional em datas especiais'],
  ['Especialista','🌺', 1000, 'Referência em cuidado com plantas dentro da Floria.',           'Tudo do nível anterior\nAtendimento prioritário'],
];

async function garantirNiveisClientes(conn, schema) {
  const jaExiste = await existeTabela(conn, schema, 'niveis_clientes');
  if (!jaExiste) {
    await conn.query(`
      CREATE TABLE niveis_clientes (
        id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
        nome          VARCHAR(60)   NOT NULL,
        icone         VARCHAR(16)   DEFAULT NULL,
        valor_minimo  DECIMAL(10,2) NOT NULL DEFAULT 0,
        ordem         INT UNSIGNED  NOT NULL DEFAULT 0,
        descricao     VARCHAR(255)  DEFAULT NULL,
        beneficios    TEXT          DEFAULT NULL,
        ativo         TINYINT(1)    NOT NULL DEFAULT 1,
        criado_em     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_niveis_ordem (ordem),
        INDEX idx_niveis_valor (valor_minimo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela niveis_clientes criada');
  }

  const [[{ totalNiveis }]] = await conn.query('SELECT COUNT(*) AS totalNiveis FROM niveis_clientes');
  if (totalNiveis === 0) {
    for (let i = 0; i < SEED_NIVEIS_CLIENTES.length; i++) {
      const [nome, icone, valorMinimo, descricao, beneficios] = SEED_NIVEIS_CLIENTES[i];
      await conn.query(
        `INSERT INTO niveis_clientes (nome, icone, valor_minimo, ordem, descricao, beneficios, ativo)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [nome, icone, valorMinimo, i, descricao, beneficios]
      );
    }
    console.log('   + progressão inicial de níveis de clientes semeada');
  }
}

const COLUNAS_PRODUTOS_FRETE = [
  ['peso_g',         'INT UNSIGNED DEFAULT NULL'],
  ['altura_cm',       'DECIMAL(6,1) DEFAULT NULL'],
  ['largura_cm',      'DECIMAL(6,1) DEFAULT NULL'],
  ['comprimento_cm',  'DECIMAL(6,1) DEFAULT NULL'],
];

const DIMENSOES_PRODUTOS = [
  ['comigo-ninguem-pode',               900,    20,    18,    18],
  ['samambaia',                         700,    25,    20,    20],
  ['alecrim',                           500,    18,    14,    14],
  ['babosa',                            600,    16,    14,    14],
  ['cacto',                             500,    15,    12,    12],
  ['costela-de-adao',                  1000,    22,    20,    20],
  ['orquidea',                          450,    20,    14,    14],
  ['lavanda',                           500,    18,    14,    14],
  ['jasmim',                            600,    22,    14,    14],
  ['hortela',                           450,    16,    13,    13],
  ['espadadesaojorge',                  800,    25,    14,    14],
  ['manjericao',                        450,    16,    13,    13],
  ['singonio',                          550,    18,    14,    14],
  ['zamioculca',                        900,    20,    16,    16],
  ['philodendron',                      550,    18,    14,    14],

  ['vaso-autoirrigavel',                700,    22,    18,    18],
  ['vaso-barro-tradicional',           1400,    20,    18,    18],
  ['vaso-autoirrigavel-transparente',   750,    22,    18,    18],
  ['vaso-de-barro',                    1300,    18,    16,    16],
  ['vaso-ceramica-azul',               1600,    20,    18,    18],
  ['vaso-ceramica-rosa',               1600,    20,    18,    18],
  ['vaso-cimento-rustico',             2200,    20,    18,    18],
  ['vaso-suspenso-macrame',             400,    25,    15,    15],
  ['vaso-vidro-transparente',           900,    18,    16,    16],
  ['vaso-concreto-geometrico',         2400,    20,    18,    18],
  ['vaso-esmaltado',                   1500,    20,    18,    18],
  ['vaso-ceramica-decorado',           1700,    22,    20,    20],
  ['vaso-geometrico',                  2000,    20,    18,    18],
  ['vaso-minimalista',                 1400,    18,    16,    16],
  ['vaso-barro-artesanal',             1300,    18,    16,    16],
  ['vaso-decorativo-marrom',            600,    20,    18,    18],

  ['pa-jardinagem-manual',              210,    32,    10,     6],
  ['regador-metal-5l',                  620,    30,    20,    18],
  ['tesoura-poda-profissional',         250,    22,     9,     4],
  ['kit-ferramentas-jardim',           1500,    35,    20,    10],
  ['luvas-jardinagem-reforcadas',       150,    28,    15,     3],
  ['carrinho-mao-jardim',              8000,    90,    50,    40],

  ['adubo-organico-composto-5kg',      5000,    35,    22,    10],
  ['fertilizante-npk-10-10-10',        1000,    20,    14,     8],
  ['humus-minhoca-2kg',                2000,    25,    18,     8],
  ['farinha-de-osso-1kg',              1000,    18,    14,     6],
  ['fertilizante-liquido-multiuso',     550,    20,     8,     8],
  ['adubo-suculentas-cactos',           300,    14,    10,     6],

  ['oleo-de-neem-concentrado',          250,    16,     8,     8],
  ['armadilha-adesiva-insetos',         100,    25,    15,     2],
  ['sabao-inseticida-natural',          550,    20,     8,     8],
  ['repelente-natural-pulgoes',         450,    22,     8,     8],
  ['terra-de-diatomacea',               400,    18,    12,     6],
  ['spray-fungicida-organico',          550,    22,     8,     8],
];

async function preencherDimensoesProdutos(conn) {
  for (const [slug, peso, altura, largura, comprimento] of DIMENSOES_PRODUTOS) {
    await conn.query(
      `UPDATE produtos SET peso_g = ?, altura_cm = ?, largura_cm = ?, comprimento_cm = ?
        WHERE (slug = ? OR slug_pagina = ?) AND peso_g IS NULL`,
      [peso, altura, largura, comprimento, slug, slug]
    );
  }
  await conn.query(
    `UPDATE produtos SET peso_g = 500, altura_cm = 15, largura_cm = 15, comprimento_cm = 15
      WHERE peso_g IS NULL OR altura_cm IS NULL OR largura_cm IS NULL OR comprimento_cm IS NULL`
  );
}

async function garantirFreteProdutos(conn, schema) {
  await adicionarColunasFaltantes(conn, schema, 'produtos', COLUNAS_PRODUTOS_FRETE);
  await preencherDimensoesProdutos(conn);
}

const COLUNAS_PRODUTOS_PADRAO = [
  ['sku',           'VARCHAR(40) DEFAULT NULL'],
  ['marca',         'VARCHAR(80) DEFAULT NULL'],
  ['imagem_2',      'VARCHAR(255) DEFAULT NULL'],
  ['imagem_3',      'VARCHAR(255) DEFAULT NULL'],
  ['cuidados',      'JSON DEFAULT NULL'],
  ['variacoes',     'JSON DEFAULT NULL'],
  ['beneficios',    'TEXT DEFAULT NULL'],
  ['como_utilizar', 'TEXT DEFAULT NULL'],
  ['recomendacoes', 'TEXT DEFAULT NULL'],
];

async function preencherPadraoProduto(conn) {
  await conn.query(
    `UPDATE produtos SET imagem_2 = imagem WHERE imagem_2 IS NULL AND imagem IS NOT NULL`
  );
  await conn.query(
    `UPDATE produtos SET imagem_3 = imagem WHERE imagem_3 IS NULL AND imagem IS NOT NULL`
  );

  await conn.query(
    `UPDATE produtos SET sku = CONCAT('FLO-', LPAD(id, 5, '0')) WHERE sku IS NULL OR sku = ''`
  );

  const { CUIDADOS_PADRAO } = require('../app/helpers/cuidadosPadrao');
  for (const categoriaSlug of Object.keys(CUIDADOS_PADRAO)) {
    if (categoriaSlug === '_padrao') continue;
    await conn.query(
      `UPDATE produtos p JOIN categorias c ON c.id = p.categoria_id
         SET p.cuidados = ?
       WHERE p.cuidados IS NULL AND c.slug = ?`,
      [JSON.stringify(CUIDADOS_PADRAO[categoriaSlug]), categoriaSlug]
    );
  }
  await conn.query(
    `UPDATE produtos SET cuidados = ? WHERE cuidados IS NULL`,
    [JSON.stringify(CUIDADOS_PADRAO._padrao)]
  );
}

async function garantirPadraoProduto(conn, schema) {
  await adicionarColunasFaltantes(conn, schema, 'produtos', COLUNAS_PRODUTOS_PADRAO);
  await preencherPadraoProduto(conn);
}

const COLUNAS_COMENTARIOS_MIDIA = [
  ['status',     "ENUM('aprovado','reprovado') NOT NULL DEFAULT 'aprovado'"],
  ['editado_em', 'TIMESTAMP NULL DEFAULT NULL'],
];

async function garantirAvaliacoesMidias(conn, schema) {
  await adicionarColunasFaltantes(conn, schema, 'comentarios', COLUNAS_COMENTARIOS_MIDIA);

  const jaExiste = await existeTabela(conn, schema, 'comentario_midias');
  if (!jaExiste) {
    await conn.query(`
      CREATE TABLE comentario_midias (
        id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
        comentario_id INT UNSIGNED  NOT NULL,
        tipo          ENUM('imagem','video') NOT NULL,
        arquivo       VARCHAR(255)  NOT NULL,
        thumbnail     VARCHAR(255)  DEFAULT NULL,
        oculto        TINYINT(1)    NOT NULL DEFAULT 0,
        ordem         INT UNSIGNED  NOT NULL DEFAULT 0,
        criado_em     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (comentario_id) REFERENCES comentarios(id) ON DELETE CASCADE,
        INDEX idx_comentario_midias_comentario (comentario_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela comentario_midias criada');
  }
}

async function garantirCpfUsuarios(conn, schema) {
  await adicionarColunasFaltantes(conn, schema, 'usuarios', [
    ['cpf', 'VARCHAR(11) DEFAULT NULL'],
  ]);

  const [rows] = await conn.query(
    `SELECT COUNT(*) AS total FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usuarios' AND INDEX_NAME = 'uk_usuarios_cpf'`,
    [schema]
  );
  if (rows[0].total === 0) {
    await conn.query('ALTER TABLE usuarios ADD UNIQUE KEY uk_usuarios_cpf (cpf)');
    console.log('   + índice único usuarios.cpf criado');
  }
}

async function garantirRelatorioGeral(conn, schema) {
  const jaExisteBuscas = await existeTabela(conn, schema, 'buscas_log');
  if (!jaExisteBuscas) {
    await conn.query(`
      CREATE TABLE buscas_log (
        id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
        termo       VARCHAR(100)  NOT NULL,
        resultados  INT UNSIGNED  NOT NULL DEFAULT 0,
        usuario_id  INT UNSIGNED  DEFAULT NULL,
        criado_em   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_buscas_termo   (termo),
        INDEX idx_buscas_criado  (criado_em)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela buscas_log criada');
  }

  const jaExisteAcessos = await existeTabela(conn, schema, 'categoria_acessos');
  if (!jaExisteAcessos) {
    await conn.query(`
      CREATE TABLE categoria_acessos (
        id              INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
        categoria_slug  VARCHAR(80)   NOT NULL,
        criado_em       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_acessos_slug    (categoria_slug),
        INDEX idx_acessos_criado  (criado_em)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela categoria_acessos criada');
  }
}

async function garantirPagamentoPreparo(conn, schema) {
  const info = await tipoDaColuna(conn, schema, 'pedidos', 'status_pagamento');
  const tipoAtual = info?.COLUMN_TYPE || '';
  if (!tipoAtual.includes('processando')) {
    await conn.query(
      `ALTER TABLE pedidos MODIFY COLUMN status_pagamento
         ENUM('pendente','processando','aprovado','recusado','expirado','estornado')
         NOT NULL DEFAULT 'pendente'`
    );
    console.log('   + status_pagamento ganhou "processando" e "expirado"');
  }

  await adicionarColunasFaltantes(conn, schema, 'pedidos', [
    ['pagamento_processa_em',   'DATETIME DEFAULT NULL'],
    ['pagamento_confirma_em',   'DATETIME DEFAULT NULL'],
    ['pagamento_expira_em',     'DATETIME DEFAULT NULL'],
    ['pagamento_confirmado_em', 'DATETIME DEFAULT NULL'],
    ['cartao_final',            'VARCHAR(4) DEFAULT NULL'],
    ['cartao_bandeira',         'VARCHAR(20) DEFAULT NULL'],
  ]);

  const jaExisteEventos = await existeTabela(conn, schema, 'pedido_pagamento_eventos');
  if (!jaExisteEventos) {
    await conn.query(`
      CREATE TABLE pedido_pagamento_eventos (
        id                INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
        pedido_id         INT UNSIGNED  NOT NULL,
        status_pagamento  ENUM('pendente','processando','aprovado','recusado','expirado','estornado')
                                        NOT NULL,
        origem            VARCHAR(40)   DEFAULT NULL,
        observacao        VARCHAR(255)  DEFAULT NULL,
        criado_em         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
        INDEX idx_pgto_eventos_pedido (pedido_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela pedido_pagamento_eventos criada');
  }
}

async function garantirIdempotenciaPedidos(conn, schema) {
  const jaExiste = await existeTabela(conn, schema, 'idempotencia_pedidos');
  if (!jaExiste) {
    await conn.query(`
      CREATE TABLE idempotencia_pedidos (
        chave         VARCHAR(100) NOT NULL,
        usuario_id    INT UNSIGNED NOT NULL,
        status        ENUM('processando','concluido') NOT NULL DEFAULT 'processando',
        pedido_id     INT UNSIGNED DEFAULT NULL,
        resposta_json TEXT DEFAULT NULL,
        criado_em     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (chave, usuario_id),
        INDEX idx_idempotencia_criado (criado_em),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (pedido_id)  REFERENCES pedidos(id)  ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela idempotencia_pedidos criada');
  }
}

async function garantirIndicesIntegridade(conn, schema) {
  if (!(await existeIndice(conn, schema, 'pedidos', 'idx_pedidos_criado_em'))) {
    await conn.query(`ALTER TABLE pedidos ADD INDEX idx_pedidos_criado_em (criado_em)`);
    console.log('   + índice pedidos.criado_em criado');
  }

  if (!(await existeIndice(conn, schema, 'pedidos', 'idx_pedidos_status_pagamento'))) {
    await conn.query(`ALTER TABLE pedidos ADD INDEX idx_pedidos_status_pagamento (status_pagamento)`);
    console.log('   + índice pedidos.status_pagamento criado');
  }

  if (!(await existeForeignKeyNaColuna(conn, schema, 'buscas_log', 'usuario_id'))) {
    await conn.query(`
      UPDATE buscas_log bl
        LEFT JOIN usuarios u ON u.id = bl.usuario_id
         SET bl.usuario_id = NULL
       WHERE bl.usuario_id IS NOT NULL AND u.id IS NULL
    `);
    await conn.query(`
      ALTER TABLE buscas_log
        ADD CONSTRAINT fk_buscas_log_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    `);
    console.log('   + FOREIGN KEY buscas_log.usuario_id criada');
  }

  if (!(await existeIndice(conn, schema, 'comentarios', 'uk_comentarios_usuario_produto'))) {
    const [dups] = await conn.query(`
      SELECT usuario_id, produto_slug, COUNT(*) AS total
        FROM comentarios
       GROUP BY usuario_id, produto_slug
      HAVING total > 1
    `);
    if (dups.length) {
      console.warn(`   ⚠️  comentarios: ${dups.length} par(es) usuario_id/produto_slug duplicado(s) — UNIQUE não aplicada; resolva manualmente antes de reexecutar.`);
    } else {
      await conn.query(`
        ALTER TABLE comentarios
          ADD CONSTRAINT uk_comentarios_usuario_produto UNIQUE KEY (usuario_id, produto_slug)
      `);
      console.log('   + UNIQUE comentarios (usuario_id, produto_slug) criada');
    }
  }

  const indicesExtras = [
    ['produtos', 'idx_produtos_subcategoria', 'subcategoria_id'],
    ['promocoes', 'idx_promocoes_subcategoria', 'subcategoria_id'],
    ['itens_pedido', 'idx_itens_pedido_promocao', 'promocao_id'],
    ['pedidos', 'idx_pedidos_promocao_carrinho', 'promocao_carrinho_id'],
  ];
  for (const [tabela, nomeIndice, coluna] of indicesExtras) {
    if (!(await existeIndice(conn, schema, tabela, nomeIndice))) {
      await conn.query(`ALTER TABLE \`${tabela}\` ADD INDEX \`${nomeIndice}\` (\`${coluna}\`)`);
      console.log(`   + índice ${tabela}.${coluna} criado`);
    }
  }
}

async function garantirSessoesSeguranca(conn, schema) {
  const jaExiste = await existeTabela(conn, schema, 'sessoes_seguranca');
  if (!jaExiste) {
    await conn.query(`
      CREATE TABLE sessoes_seguranca (
        id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        usuario_id          INT UNSIGNED NOT NULL,
        session_id_hash     CHAR(64)     NOT NULL,
        papel_no_momento    VARCHAR(20)  NOT NULL,
        criado_em           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ultima_atividade_em TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expira_em           TIMESTAMP    NOT NULL,
        ip                  VARCHAR(45)  DEFAULT NULL,
        user_agent          VARCHAR(255) DEFAULT NULL,
        revogado_em         TIMESTAMP    NULL DEFAULT NULL,
        UNIQUE KEY uk_sessoes_seguranca_hash (session_id_hash),
        INDEX idx_sessoes_seguranca_usuario (usuario_id),
        INDEX idx_sessoes_seguranca_expira (expira_em),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela sessoes_seguranca criada');
  }
}

async function garantirPreferenciasAcessibilidade(conn, schema) {
  const jaExiste = await existeTabela(conn, schema, 'preferencias_acessibilidade');
  if (!jaExiste) {
    await conn.query(`
      CREATE TABLE preferencias_acessibilidade (
        usuario_id              INT UNSIGNED NOT NULL PRIMARY KEY,
        tamanho_fonte           ENUM('normal','grande','muito_grande') NOT NULL DEFAULT 'normal',
        espacamento_texto       ENUM('normal','aumentado','muito_aumentado') NOT NULL DEFAULT 'normal',
        alto_contraste          TINYINT(1) NOT NULL DEFAULT 0,
        reduzir_movimento       TINYINT(1) NOT NULL DEFAULT 0,
        destacar_links          TINYINT(1) NOT NULL DEFAULT 0,
        destacar_foco           TINYINT(1) NOT NULL DEFAULT 0,
        interface_simplificada  TINYINT(1) NOT NULL DEFAULT 0,
        otimizar_leitor_tela    TINYINT(1) NOT NULL DEFAULT 0,
        libras_ativo            TINYINT(1) NOT NULL DEFAULT 0,
        pausar_midia_automatica TINYINT(1) NOT NULL DEFAULT 0,
        atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela preferencias_acessibilidade criada');
  }
}

async function garantirTokensRecuperacaoSenha(conn, schema) {
  const jaExiste = await existeTabela(conn, schema, 'tokens_recuperacao_senha');
  if (!jaExiste) {
    await conn.query(`
      CREATE TABLE tokens_recuperacao_senha (
        id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT UNSIGNED NOT NULL,
        token_hash CHAR(64)     NOT NULL,
        criado_em  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expira_em  TIMESTAMP    NOT NULL,
        usado_em   TIMESTAMP    NULL DEFAULT NULL,
        ip         VARCHAR(45)  DEFAULT NULL,
        user_agent VARCHAR(255) DEFAULT NULL,
        UNIQUE KEY uk_tokens_recuperacao_hash (token_hash),
        INDEX idx_tokens_recuperacao_usuario (usuario_id),
        INDEX idx_tokens_recuperacao_expira (expira_em),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela tokens_recuperacao_senha criada');
  }
}

async function garantirOtpsRecuperacaoSenha(conn, schema) {
  const jaExiste = await existeTabela(conn, schema, 'otps_recuperacao_senha');
  if (!jaExiste) {
    await conn.query(`
      CREATE TABLE otps_recuperacao_senha (
        id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        usuario_id        INT UNSIGNED NOT NULL,
        otp_hash          CHAR(64)     NOT NULL,
        tentativas        TINYINT UNSIGNED NOT NULL DEFAULT 0,
        criado_em         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expira_em         TIMESTAMP    NOT NULL,
        verificado_em     TIMESTAMP    NULL DEFAULT NULL,
        reset_token_hash  CHAR(64)     NULL DEFAULT NULL,
        reset_expira_em   TIMESTAMP    NULL DEFAULT NULL,
        usado_em          TIMESTAMP    NULL DEFAULT NULL,
        ip                VARCHAR(45)  DEFAULT NULL,
        user_agent        VARCHAR(255) DEFAULT NULL,
        UNIQUE KEY uk_otps_reset_token (reset_token_hash),
        INDEX idx_otps_usuario_criado (usuario_id, criado_em),
        INDEX idx_otps_expira (expira_em),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela otps_recuperacao_senha criada');
  }
}

async function garantirSolicitacoesSuporte(conn, schema) {
  const jaExiste = await existeTabela(conn, schema, 'solicitacoes_suporte');
  if (!jaExiste) {
    await conn.query(`
      CREATE TABLE solicitacoes_suporte (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        usuario_id    INT UNSIGNED NULL,
        nome          VARCHAR(120) NOT NULL,
        email         VARCHAR(190) NOT NULL,
        assunto       VARCHAR(150) NOT NULL,
        categoria     ENUM('pedido','entrega','produto','pagamento','conta','outras') NULL,
        mensagem      TEXT         NOT NULL,
        status        ENUM('aberto','em_andamento','respondido','fechado') NOT NULL DEFAULT 'aberto',
        ip            VARCHAR(45)  DEFAULT NULL,
        user_agent    VARCHAR(255) DEFAULT NULL,
        criado_em     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        respondido_em TIMESTAMP    NULL DEFAULT NULL,
        INDEX idx_suporte_email (email),
        INDEX idx_suporte_criado (criado_em),
        INDEX idx_suporte_status (status),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela solicitacoes_suporte criada');
  }
}

async function garantirFornecedoresCompras(conn, schema) {
  if (!(await existeTabela(conn, schema, 'fornecedores'))) {
    await conn.query(`
      CREATE TABLE fornecedores (
        id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        razao_social   VARCHAR(150)  NOT NULL,
        nome_fantasia  VARCHAR(150)  DEFAULT NULL,
        documento      VARCHAR(20)   DEFAULT NULL,
        telefone       VARCHAR(20)   DEFAULT NULL,
        email          VARCHAR(190)  DEFAULT NULL,
        endereco       VARCHAR(255)  DEFAULT NULL,
        status         ENUM('ativo','inativo','bloqueado') NOT NULL DEFAULT 'ativo',
        observacoes    VARCHAR(500)  DEFAULT NULL,
        criado_em      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_fornecedores_documento (documento),
        INDEX idx_fornecedores_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela fornecedores criada');
  }

  if (!(await existeTabela(conn, schema, 'compras'))) {
    await conn.query(`
      CREATE TABLE compras (
        id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        fornecedor_id       INT UNSIGNED NOT NULL,
        status              ENUM('registrada','cancelada') NOT NULL DEFAULT 'registrada',
        data_compra         DATE          NOT NULL,
        subtotal            DECIMAL(12,2) NOT NULL DEFAULT 0,
        desconto            DECIMAL(12,2) NOT NULL DEFAULT 0,
        frete               DECIMAL(12,2) NOT NULL DEFAULT 0,
        impostos            DECIMAL(12,2) NOT NULL DEFAULT 0,
        taxas               DECIMAL(12,2) NOT NULL DEFAULT 0,
        total               DECIMAL(12,2) NOT NULL DEFAULT 0,
        observacoes         VARCHAR(500)  DEFAULT NULL,
        motivo_cancelamento VARCHAR(255)  DEFAULT NULL,
        usuario_admin_nome  VARCHAR(120)  DEFAULT NULL,
        criado_em           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_compras_fornecedor (fornecedor_id),
        INDEX idx_compras_data (data_compra),
        INDEX idx_compras_status (status),
        FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela compras criada');
  }

  if (!(await existeTabela(conn, schema, 'itens_compra'))) {
    await conn.query(`
      CREATE TABLE itens_compra (
        id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        compra_id    INT UNSIGNED NOT NULL,
        descricao    VARCHAR(200)  NOT NULL,
        quantidade   DECIMAL(12,3) NOT NULL DEFAULT 1,
        preco_unit   DECIMAL(12,2) NOT NULL DEFAULT 0,
        subtotal     DECIMAL(12,2) NOT NULL DEFAULT 0,
        criado_em    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_itens_compra_compra (compra_id),
        FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela itens_compra criada');
  }

  if (!(await existeTabela(conn, schema, 'contas_pagar'))) {
    await conn.query(`
      CREATE TABLE contas_pagar (
        id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        compra_id      INT UNSIGNED NOT NULL,
        fornecedor_id  INT UNSIGNED NOT NULL,
        valor_original DECIMAL(12,2) NOT NULL,
        vencimento     DATE          NOT NULL,
        status         ENUM('pendente','parcialmente_paga','paga','cancelada') NOT NULL DEFAULT 'pendente',
        observacoes    VARCHAR(500)  DEFAULT NULL,
        criado_em      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_contas_pagar_compra (compra_id),
        INDEX idx_contas_pagar_fornecedor (fornecedor_id),
        INDEX idx_contas_pagar_vencimento (vencimento),
        INDEX idx_contas_pagar_status (status),
        FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE CASCADE,
        FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela contas_pagar criada');
  }

  if (!(await existeTabela(conn, schema, 'pagamentos_fornecedor'))) {
    await conn.query(`
      CREATE TABLE pagamentos_fornecedor (
        id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        conta_pagar_id     INT UNSIGNED NOT NULL,
        valor              DECIMAL(12,2) NOT NULL,
        data_pagamento     DATE          NOT NULL,
        metodo             ENUM('transferencia','pix','boleto','cartao','dinheiro','outro') NOT NULL,
        referencia         VARCHAR(120)  DEFAULT NULL,
        observacoes        VARCHAR(500)  DEFAULT NULL,
        status             ENUM('confirmado','estornado') NOT NULL DEFAULT 'confirmado',
        usuario_admin_nome VARCHAR(120)  DEFAULT NULL,
        criado_em          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pagamentos_fornecedor_conta (conta_pagar_id),
        INDEX idx_pagamentos_fornecedor_data (data_pagamento),
        FOREIGN KEY (conta_pagar_id) REFERENCES contas_pagar(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela pagamentos_fornecedor criada');
  }

  await adicionarColunasFaltantes(conn, schema, 'pagamentos_fornecedor', [
    ['estornado_por', 'VARCHAR(120) DEFAULT NULL'],
    ['estornado_em', 'TIMESTAMP NULL DEFAULT NULL'],
  ]);

  if (!(await existeIndice(conn, schema, 'contas_pagar', 'idx_contas_pagar_status_vencimento'))) {
    await conn.query('ALTER TABLE contas_pagar ADD INDEX idx_contas_pagar_status_vencimento (status, vencimento)');
  }

  const infoCompraId = await tipoDaColuna(conn, schema, 'contas_pagar', 'compra_id');
  if (infoCompraId && infoCompraId.IS_NULLABLE === 'NO') {
    const [fkRows] = await conn.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'contas_pagar' AND COLUMN_NAME = 'compra_id'
          AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [schema]
    );
    if (fkRows[0]) {
      await conn.query(`ALTER TABLE contas_pagar DROP FOREIGN KEY \`${fkRows[0].CONSTRAINT_NAME}\``);
    }
    if (await existeIndice(conn, schema, 'contas_pagar', 'uk_contas_pagar_compra')) {
      await conn.query('ALTER TABLE contas_pagar DROP INDEX uk_contas_pagar_compra');
    }
    if (!(await existeIndice(conn, schema, 'contas_pagar', 'idx_contas_pagar_compra'))) {
      await conn.query('ALTER TABLE contas_pagar ADD INDEX idx_contas_pagar_compra (compra_id)');
    }
    await conn.query('ALTER TABLE contas_pagar MODIFY COLUMN compra_id INT UNSIGNED DEFAULT NULL');
    await conn.query(
      `ALTER TABLE contas_pagar ADD CONSTRAINT contas_pagar_compra_fk
         FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE CASCADE`
    );
    console.log('   + contas_pagar.compra_id agora aceita NULL e permite várias linhas por compra (parcelamento + conta avulsa)');
  }

  await adicionarColunasFaltantes(conn, schema, 'contas_pagar', [
    ['parcela_numero', 'TINYINT UNSIGNED NOT NULL DEFAULT 1'],
    ['parcela_total', 'TINYINT UNSIGNED NOT NULL DEFAULT 1'],
    ['descricao', 'VARCHAR(200) DEFAULT NULL'],
    ['categoria', "VARCHAR(40) NOT NULL DEFAULT 'compra_fornecedor'"],
  ]);

  await adicionarColunasFaltantes(conn, schema, 'compras', [
    ["forma_pagamento", "ENUM('a_vista','parcelado') DEFAULT NULL"],
  ]);

  if (!(await existeColuna(conn, schema, 'itens_compra', 'produto_id'))) {
    await conn.query('ALTER TABLE itens_compra ADD COLUMN produto_id INT UNSIGNED DEFAULT NULL AFTER compra_id');
    await conn.query(
      `ALTER TABLE itens_compra ADD CONSTRAINT itens_compra_produto_fk
         FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL`
    );
    console.log('   + itens_compra.produto_id adicionado (link opcional com o catálogo)');
  }
  await adicionarColunasFaltantes(conn, schema, 'itens_compra', [
    ['unidade', 'VARCHAR(10) DEFAULT NULL'],
    ['desconto', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
  ]);

  await adicionarColunasFaltantes(conn, schema, 'fornecedores', [
    ['cep', 'VARCHAR(9) DEFAULT NULL'],
    ['logradouro', 'VARCHAR(180) DEFAULT NULL'],
    ['numero', 'VARCHAR(20) DEFAULT NULL'],
    ['complemento', 'VARCHAR(80) DEFAULT NULL'],
    ['bairro', 'VARCHAR(100) DEFAULT NULL'],
    ['cidade', 'VARCHAR(100) DEFAULT NULL'],
    ['uf', 'CHAR(2) DEFAULT NULL'],
    ['validacao_status', "ENUM('nao_validado','valid','partially_validated','not_found','invalid','service_unavailable') NOT NULL DEFAULT 'nao_validado'"],
    ['validacao_em', 'TIMESTAMP NULL DEFAULT NULL'],
    ['validacao_fonte', 'VARCHAR(40) DEFAULT NULL'],
    ['validacao_detalhes', 'JSON DEFAULT NULL'],
  ]);
  if (!(await existeIndice(conn, schema, 'fornecedores', 'idx_fornecedores_cidade_uf'))) {
    await conn.query('ALTER TABLE fornecedores ADD INDEX idx_fornecedores_cidade_uf (cidade, uf)');
  }

  if (!(await existeTabela(conn, schema, 'idempotencia_admin'))) {
    await conn.query(`
      CREATE TABLE idempotencia_admin (
        chave          VARCHAR(100)  NOT NULL,
        usuario_id     INT UNSIGNED  NOT NULL,
        tipo           VARCHAR(30)   NOT NULL,
        status         ENUM('processando','concluido') NOT NULL DEFAULT 'processando',
        referencia_id  INT UNSIGNED  DEFAULT NULL,
        resposta_json  JSON          DEFAULT NULL,
        criado_em      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (chave, usuario_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela idempotencia_admin criada');
  }
}

const COLUNAS_ENDERECOS_VALIDACAO = [
  ['validacao_status', "ENUM('nao_validado','valid','partially_validated','not_found','invalid','service_unavailable') NOT NULL DEFAULT 'nao_validado'"],
  ['validacao_em', 'TIMESTAMP NULL DEFAULT NULL'],
  ['validacao_fonte', 'VARCHAR(40) DEFAULT NULL'],
  ['validacao_detalhes', 'JSON DEFAULT NULL'],
];

async function garantirValidacaoEnderecos(conn, schema) {
  await adicionarColunasFaltantes(conn, schema, 'enderecos', COLUNAS_ENDERECOS_VALIDACAO);
}

async function garantirMercadoPago(conn, schema) {
  await adicionarColunasFaltantes(conn, schema, 'pedidos', [
    ['mercadopago_payment_id',         'VARCHAR(32) DEFAULT NULL'],
    ['mercadopago_external_reference', 'VARCHAR(80) DEFAULT NULL'],
  ]);
  const jaTemIndice = await existeIndice(conn, schema, 'pedidos', 'idx_pedidos_mp_payment_id');
  if (!jaTemIndice) {
    await conn.query('ALTER TABLE pedidos ADD INDEX idx_pedidos_mp_payment_id (mercadopago_payment_id)');
    console.log('   + índice idx_pedidos_mp_payment_id criado');
  }

  await adicionarColunasFaltantes(conn, schema, 'pedido_pagamento_eventos', [
    ['mercadopago_notification_id', 'VARCHAR(64) DEFAULT NULL'],
  ]);

  const jaExisteLog = await existeTabela(conn, schema, 'mercadopago_webhook_log');
  if (!jaExisteLog) {
    await conn.query(`
      CREATE TABLE mercadopago_webhook_log (
        id                 INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
        notification_id    VARCHAR(64)   DEFAULT NULL,
        tipo_evento        VARCHAR(40)   DEFAULT NULL,
        payload_json        JSON          DEFAULT NULL,
        assinatura_valida  TINYINT(1)    NOT NULL DEFAULT 0,
        ip                 VARCHAR(45)   DEFAULT NULL,
        processado         TINYINT(1)    NOT NULL DEFAULT 0,
        erro               VARCHAR(255)  DEFAULT NULL,
        criado_em          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_mp_webhook_log_notification (notification_id),
        INDEX idx_mp_webhook_log_criado (criado_em)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   + tabela mercadopago_webhook_log criada');
  }
}

async function verificarEAplicarMigracoes() {
  const config = montarConfig();
  const schema = config.database;

  let conn;
  try {
    conn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      multipleStatements: true,
      connectTimeout: 10000,
    });
  } catch (err) {
    console.warn('⚠️   [migração] Não foi possível conectar ao MySQL para checar o schema:', err.message);
    return;
  }

  try {
    const pedidosExiste = await existeTabela(conn, schema, 'pedidos');

    if (!pedidosExiste) {
      console.log('🌱  [migração] Banco novo detectado — criando schema completo (database.sql)…');
      await executarArquivo(conn, 'database/schema.sql');
      console.log('✅  [migração] Schema criado com sucesso.');
      await garantirProdutosRelacionados(conn, schema);
      await garantirNovasCategorias(conn, schema);
      await garantirCategoriaVasos(conn, schema);
      await garantirFiltrosAvancados(conn, schema);
      await garantirCategoriasSubcategorias(conn, schema);
      await garantirCatalogoCompleto(conn, schema);
      await garantirCuponsBanners(conn, schema);
      await garantirPromocoes(conn, schema);
      await garantirConfiguracoesLogs(conn, schema);
      await garantirEstoqueDetalhado(conn, schema);
      await removerCategoriaDecoracoes(conn);
      await criarComprovantesSeNecessario(conn, schema);
      await garantirAvaliacoesMidias(conn, schema);
      await garantirFreteProdutos(conn, schema);
      await garantirPadraoProduto(conn, schema);
      await criarTimelineSeNecessario(conn, schema);
      await garantirCpfUsuarios(conn, schema);
      await garantirRelatorioGeral(conn, schema);
      await garantirPagamentoPreparo(conn, schema);
      await garantirNotasInternasClientes(conn, schema);
      await garantirNiveisClientes(conn, schema);
      await garantirSessoesSeguranca(conn, schema);
      await garantirPreferenciasAcessibilidade(conn, schema);
      await garantirTokensRecuperacaoSenha(conn, schema);
      await garantirOtpsRecuperacaoSenha(conn, schema);
      await garantirSolicitacoesSuporte(conn, schema);
      await garantirIdempotenciaPedidos(conn, schema);
      await garantirIndicesIntegridade(conn, schema);
      await garantirFornecedoresCompras(conn, schema);
      await garantirValidacaoEnderecos(conn, schema);
      await garantirMercadoPago(conn, schema);
      return;
    }

    const emDia = await existeColuna(conn, schema, 'pedidos', 'subtotal');
    if (emDia) {
      console.log('✅  [migração] Schema já está atualizado.');
      await conn.query(`USE \`${schema}\`;`);
      await garantirProdutosRelacionados(conn, schema);
      await garantirNovasCategorias(conn, schema);
      await garantirCategoriaVasos(conn, schema);
      await garantirFiltrosAvancados(conn, schema);
      await garantirCategoriasSubcategorias(conn, schema);
      await garantirCatalogoCompleto(conn, schema);
      await garantirCuponsBanners(conn, schema);
      await garantirPromocoes(conn, schema);
      await garantirConfiguracoesLogs(conn, schema);
      await garantirEstoqueDetalhado(conn, schema);
      await removerCategoriaDecoracoes(conn);
      await criarComprovantesSeNecessario(conn, schema);
      await garantirAvaliacoesMidias(conn, schema);
      await garantirFreteProdutos(conn, schema);
      await garantirPadraoProduto(conn, schema);
      await criarTimelineSeNecessario(conn, schema);
      await garantirCpfUsuarios(conn, schema);
      await garantirRelatorioGeral(conn, schema);
      await garantirPagamentoPreparo(conn, schema);
      await garantirNotasInternasClientes(conn, schema);
      await garantirNiveisClientes(conn, schema);
      await garantirSessoesSeguranca(conn, schema);
      await garantirPreferenciasAcessibilidade(conn, schema);
      await garantirTokensRecuperacaoSenha(conn, schema);
      await garantirOtpsRecuperacaoSenha(conn, schema);
      await garantirSolicitacoesSuporte(conn, schema);
      await garantirIdempotenciaPedidos(conn, schema);
      await garantirIndicesIntegridade(conn, schema);
      await garantirFornecedoresCompras(conn, schema);
      await garantirValidacaoEnderecos(conn, schema);
      await garantirMercadoPago(conn, schema);
      return;
    }

    console.log('🔧  [migração] Detectada versão antiga do banco — atualizando schema…');
    await conn.query(`USE \`${schema}\`;`);
    await aplicarMigracaoDetalhesPedido(conn, schema);
    await garantirProdutosRelacionados(conn, schema);
    await garantirNovasCategorias(conn, schema);
    await garantirCategoriaVasos(conn, schema);
    await garantirFiltrosAvancados(conn, schema);
    await garantirCategoriasSubcategorias(conn, schema);
    await garantirCatalogoCompleto(conn, schema);
    await garantirCuponsBanners(conn, schema);
    await garantirPromocoes(conn, schema);
    await garantirConfiguracoesLogs(conn, schema);
    await garantirEstoqueDetalhado(conn, schema);
    await removerCategoriaDecoracoes(conn);
    await criarComprovantesSeNecessario(conn, schema);
    await garantirAvaliacoesMidias(conn, schema);
    await garantirFreteProdutos(conn, schema);
    await garantirPadraoProduto(conn, schema);
    await garantirCpfUsuarios(conn, schema);
    await garantirRelatorioGeral(conn, schema);
    await garantirPagamentoPreparo(conn, schema);
    await garantirNotasInternasClientes(conn, schema);
    await garantirNiveisClientes(conn, schema);
    await garantirSessoesSeguranca(conn, schema);
    await garantirPreferenciasAcessibilidade(conn, schema);
    await garantirTokensRecuperacaoSenha(conn, schema);
    await garantirOtpsRecuperacaoSenha(conn, schema);
    await garantirSolicitacoesSuporte(conn, schema);
    await garantirIdempotenciaPedidos(conn, schema);
    await garantirIndicesIntegridade(conn, schema);
    await garantirFornecedoresCompras(conn, schema);
    await garantirValidacaoEnderecos(conn, schema);
    await garantirMercadoPago(conn, schema);
    console.log('✅  [migração] Migração aplicada com sucesso — Detalhes do Pedido pronto para uso.');
  } catch (err) {
    console.error('❌  [migração] Erro ao aplicar migração automática:', err.code || '', err.message);
    console.error('     Se o erro persistir, me mande esta mensagem completa.');
    process.exit(1);
  } finally {
    await conn.end();
  }
}

module.exports = { verificarEAplicarMigracoes };
