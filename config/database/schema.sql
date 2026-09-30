-- FLORIA —

CREATE DATABASE IF NOT EXISTS floria
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE floria;

CREATE TABLE IF NOT EXISTS usuarios (
  id            INT UNSIGNED       AUTO_INCREMENT PRIMARY KEY,
  nome          VARCHAR(100)       NOT NULL,
  email         VARCHAR(150)       NOT NULL UNIQUE,
  senha_hash    VARCHAR(255)       NOT NULL,
  cpf           VARCHAR(11)        DEFAULT NULL UNIQUE,
  telefone      VARCHAR(20)        DEFAULT NULL,
  foto_perfil   VARCHAR(255)       DEFAULT NULL,
  papel         ENUM('cliente','admin') NOT NULL DEFAULT 'cliente',
  ativo         TINYINT(1)         NOT NULL DEFAULT 1,
  criado_em     TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,
  ultimo_acesso TIMESTAMP          NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  session_id  VARCHAR(128)  NOT NULL PRIMARY KEY,
  expires     INT(11)       UNSIGNED NOT NULL,
  data        MEDIUMTEXT,
  INDEX idx_expires (expires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_tentativas (
  id            INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  ip            VARCHAR(45)    NOT NULL,
  email         VARCHAR(150)   NOT NULL DEFAULT '',
  tentativas    INT            NOT NULL DEFAULT 1,
  bloqueado_ate TIMESTAMP      NULL DEFAULT NULL,
  atualizado_em TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ip    (ip),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categorias (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  nome        VARCHAR(80)   NOT NULL UNIQUE,
  slug        VARCHAR(80)   NOT NULL UNIQUE,
  descricao   TEXT          DEFAULT NULL,
  criado_em   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO categorias (nome, slug, descricao) VALUES
  ('Plantas',                 'plantas',          'Mudas, flores, árvores e sementes'),
  ('Vasos',                   'vasos',            'Vasos, cachepôs e suportes'),
  ('Ferramentas',             'ferramentas',      'Ferramentas de jardinagem para plantar, podar e cultivar'),
  ('Adubos',                  'adubos',           'Adubos e fertilizantes para nutrir suas plantas'),
  ('Controle de Pragas',      'controle-pragas',  'Produtos para prevenir e controlar pragas e doenças no jardim');

CREATE TABLE IF NOT EXISTS produtos (
  id            INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  categoria_id  INT UNSIGNED   NOT NULL,
  nome          VARCHAR(120)   NOT NULL,
  slug          VARCHAR(120)   NOT NULL UNIQUE,
  slug_pagina   VARCHAR(120)   DEFAULT NULL,
  descricao     TEXT           DEFAULT NULL,
  preco         DECIMAL(10,2)  NOT NULL,
  preco_promo   DECIMAL(10,2)  DEFAULT NULL,
  estoque       INT            NOT NULL DEFAULT 0,
  imagem        VARCHAR(255)   DEFAULT NULL,
  tags          VARCHAR(255)   DEFAULT NULL,
  especificacoes JSON          DEFAULT NULL,
  pouca_luz     TINYINT(1)     NOT NULL DEFAULT 0,
  pet_friendly  TINYINT(1)     NOT NULL DEFAULT 0,
  destaque      TINYINT(1)     NOT NULL DEFAULT 0,
  ativo         TINYINT(1)     NOT NULL DEFAULT 1,
  criado_em     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id)
    REFERENCES categorias(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO produtos
  (categoria_id, nome, slug, descricao, preco, estoque, imagem, destaque, tags, pouca_luz, pet_friendly)
VALUES
  (1, 'Muda de Comigo Ninguém Pode', 'comigo-ninguem-pode',
      'Dieffenbachia de folhagem verde e branca, ideal para interiores em meia-sombra.',
      211.25, 30, 'Muda.png', 1, NULL, 1, 0),
  (1, 'Samambaia', 'samambaia',
      'Planta de sombra, ótima para varandas.', 111.25, 45, 'samambaia.webp', 1, NULL, 1, 1),
  (1, 'Alecrim',   'alecrim',
      'Erva aromática, ideal para cozinha.',      70.25, 60, 'alecrim.jpg',   0, NULL, 0, 1),
  (1, 'Babosa',    'babosa',
      'Suculenta medicinal de fácil cultivo.',   116.25, 50, 'baboda.jpg',    1, NULL, 0, 0),
  (1, 'Cacto',     'cacto',
      'Resistente e decorativo, pouca rega.',     61.25, 80, 'cacto.webp',    0, NULL, 0, 1),
  (1, 'Costela de Adão', 'costela-de-adao',
      'Folhas marcantes, símbolo de ambientes modernos.',
      80.25, 25, 'costeladeadao.webp', 1, 'monstera', 1, 0),
  (1, 'Orquídea',  'orquidea',
      'Flor elegante em diversas cores.',         99.99, 35, 'orquidea.jpg',  1, NULL, 0, 1),
  (1, 'Lavanda',   'lavanda',
      'Aroma inconfundível, flor lilás.',         49.99, 70, 'lavanda.jpg',   0, NULL, 0, 0),
  (1, 'Jasmim',    'jasmim',
      'Trepadeira perfumada.',                    75.00, 40, 'jasmim.png',    0, NULL, 0, 0),
  (1, 'Hortelã',   'hortela',
      'Erva refrescante para drinks e cozinha.',  78.25, 55, 'hortela.png',   0, NULL, 0, 1);

CREATE TABLE IF NOT EXISTS enderecos (
  id            INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  usuario_id    INT UNSIGNED   NOT NULL,
  rotulo        VARCHAR(60)    NOT NULL,
  destinatario  VARCHAR(120)   NOT NULL,
  telefone      VARCHAR(20)    NOT NULL,
  cep           VARCHAR(9)     NOT NULL,
  logradouro    VARCHAR(180)   NOT NULL,
  numero        VARCHAR(20)    NOT NULL,
  complemento   VARCHAR(80)    DEFAULT NULL,
  bairro        VARCHAR(100)   NOT NULL,
  cidade        VARCHAR(100)   NOT NULL,
  uf            CHAR(2)        NOT NULL,
  referencia    VARCHAR(180)   DEFAULT NULL,    -- ponto de referência
  padrao        TINYINT(1)     NOT NULL DEFAULT 0,
  criado_em     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX idx_enderecos_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pedidos (
  id              INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  usuario_id      INT UNSIGNED  NOT NULL,
  endereco_id     INT UNSIGNED  DEFAULT NULL,

  status ENUM('preparando','enviado','em_transporte','saiu_entrega','entregue','cancelado')
                                NOT NULL DEFAULT 'preparando',

  -- Valores financeiros
  subtotal        DECIMAL(10,2) NOT NULL DEFAULT 0,
  frete           DECIMAL(10,2) NOT NULL DEFAULT 0,
  desconto        DECIMAL(10,2) NOT NULL DEFAULT 0,
  cupom           VARCHAR(40)   DEFAULT NULL,
  total           DECIMAL(10,2) NOT NULL,
  forma_pagto     VARCHAR(50)   DEFAULT NULL,
  parcelas        TINYINT UNSIGNED NOT NULL DEFAULT 1,
  status_pagamento ENUM('pendente','aprovado','recusado','estornado')
                                NOT NULL DEFAULT 'pendente',
  observacoes     VARCHAR(500)  DEFAULT NULL,

  -- Entrega / rastreio
  transportadora      VARCHAR(80)  DEFAULT NULL,
  codigo_rastreio     VARCHAR(60)  DEFAULT NULL,
  previsao_entrega    DATE         DEFAULT NULL,
  motivo_cancelamento VARCHAR(255) DEFAULT NULL,

  end_rotulo        VARCHAR(60)   DEFAULT NULL,
  end_destinatario  VARCHAR(120)  DEFAULT NULL,
  end_telefone      VARCHAR(20)   DEFAULT NULL,
  end_cep           VARCHAR(9)    DEFAULT NULL,
  end_logradouro    VARCHAR(180)  DEFAULT NULL,
  end_numero        VARCHAR(20)   DEFAULT NULL,
  end_complemento   VARCHAR(80)   DEFAULT NULL,
  end_bairro        VARCHAR(100)  DEFAULT NULL,
  end_cidade        VARCHAR(100)  DEFAULT NULL,
  end_uf            CHAR(2)       DEFAULT NULL,

  criado_em     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON DELETE RESTRICT,
  FOREIGN KEY (endereco_id)
    REFERENCES enderecos(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS itens_pedido (
  id              INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  pedido_id       INT UNSIGNED   NOT NULL,
  produto_id      INT UNSIGNED   DEFAULT NULL,
  produto_nome    VARCHAR(150)   DEFAULT NULL,
  produto_imagem  VARCHAR(255)   DEFAULT NULL,
  categoria_nome  VARCHAR(80)    DEFAULT NULL,
  quantidade      INT            NOT NULL DEFAULT 1,
  cor             VARCHAR(60)    DEFAULT NULL,   -- variação escolhida
  preco_unit      DECIMAL(10,2)  NOT NULL,
  FOREIGN KEY (pedido_id)
    REFERENCES pedidos(id)
    ON DELETE CASCADE,
  FOREIGN KEY (produto_id)
    REFERENCES produtos(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pedido_timeline (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  pedido_id   INT UNSIGNED  NOT NULL,
  etapa       ENUM('confirmado','preparando','enviado','em_transporte','saiu_entrega','entregue','cancelado')
                            NOT NULL,
  observacao  VARCHAR(255)  DEFAULT NULL,
  criado_em   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pedido_id)
    REFERENCES pedidos(id)
    ON DELETE CASCADE,
  INDEX idx_timeline_pedido (pedido_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comentarios (
  id            INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  produto_slug  VARCHAR(120)   NOT NULL,
  usuario_id    INT UNSIGNED   NOT NULL,
  usuario_nome  VARCHAR(100)   NOT NULL,
  avaliacao     TINYINT        NOT NULL CHECK (avaliacao BETWEEN 1 AND 5),
  comentario    TEXT           NOT NULL,
  criado_em     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX idx_comentarios_slug    (produto_slug),
  INDEX idx_comentarios_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS favoritos (
  id            INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  usuario_id    INT UNSIGNED   NOT NULL,
  produto_slug  VARCHAR(120)   NOT NULL,
  produto_nome  VARCHAR(150)   NOT NULL,
  produto_imagem VARCHAR(255) DEFAULT NULL,
  produto_preco DECIMAL(10,2) DEFAULT NULL,
  criado_em     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  UNIQUE KEY uk_favoritos_usuario_produto (usuario_id, produto_slug),
  INDEX idx_favoritos_usuario (usuario_id),
  INDEX idx_favoritos_slug    (produto_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comprovantes (
  id              INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  pedido_id       INT UNSIGNED   NOT NULL UNIQUE,
  codigo          VARCHAR(20)    NOT NULL UNIQUE,
  emissoes        INT UNSIGNED   NOT NULL DEFAULT 1,
  enviado_email_em TIMESTAMP     NULL DEFAULT NULL,
  email_destino   VARCHAR(150)   DEFAULT NULL,
  envios_email    INT UNSIGNED   NOT NULL DEFAULT 0,
  criado_em       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                 ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pedido_id)
    REFERENCES pedidos(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS buscas_log (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  termo       VARCHAR(100)  NOT NULL,
  resultados  INT UNSIGNED  NOT NULL DEFAULT 0,
  usuario_id  INT UNSIGNED  DEFAULT NULL,
  criado_em   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_buscas_termo   (termo),
  INDEX idx_buscas_criado  (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categoria_acessos (
  id              INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  categoria_slug  VARCHAR(80)   NOT NULL,
  criado_em       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_acessos_slug    (categoria_slug),
  INDEX idx_acessos_criado  (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ÍNDICES de desempenho
CREATE INDEX idx_usuarios_email      ON usuarios(email);
CREATE INDEX idx_produtos_categoria  ON produtos(categoria_id);
CREATE INDEX idx_produtos_destaque   ON produtos(destaque);
CREATE INDEX idx_produtos_ativo      ON produtos(ativo);
CREATE INDEX idx_pedidos_usuario     ON pedidos(usuario_id);
CREATE INDEX idx_pedidos_status      ON pedidos(status);
CREATE INDEX idx_itens_pedido        ON itens_pedido(pedido_id);
