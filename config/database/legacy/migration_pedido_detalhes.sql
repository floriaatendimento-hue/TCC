USE floria;

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS subtotal            DECIMAL(10,2) NOT NULL DEFAULT 0    AFTER status,
  ADD COLUMN IF NOT EXISTS frete               DECIMAL(10,2) NOT NULL DEFAULT 0    AFTER subtotal,
  ADD COLUMN IF NOT EXISTS desconto            DECIMAL(10,2) NOT NULL DEFAULT 0    AFTER frete,
  ADD COLUMN IF NOT EXISTS cupom               VARCHAR(40)   DEFAULT NULL          AFTER desconto,
  ADD COLUMN IF NOT EXISTS parcelas            TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER forma_pagto,
  ADD COLUMN IF NOT EXISTS transportadora      VARCHAR(80)   DEFAULT NULL          AFTER parcelas,
  ADD COLUMN IF NOT EXISTS codigo_rastreio     VARCHAR(60)   DEFAULT NULL          AFTER transportadora,
  ADD COLUMN IF NOT EXISTS previsao_entrega    DATE          DEFAULT NULL          AFTER codigo_rastreio,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento VARCHAR(255)  DEFAULT NULL          AFTER previsao_entrega,
  ADD COLUMN IF NOT EXISTS end_rotulo          VARCHAR(60)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_destinatario    VARCHAR(120)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_telefone        VARCHAR(20)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_cep             VARCHAR(9)    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_logradouro      VARCHAR(180)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_numero          VARCHAR(20)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_complemento     VARCHAR(80)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_bairro          VARCHAR(100)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_cidade          VARCHAR(100)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_uf              CHAR(2)       DEFAULT NULL;

ALTER TABLE pedidos
  MODIFY COLUMN status ENUM(
    'pendente','pago',
    'preparando','enviado','em_transporte','saiu_entrega','entregue','cancelado'
  ) NOT NULL DEFAULT 'preparando';

UPDATE pedidos SET status = 'preparando' WHERE status IN ('pendente', 'pago');

ALTER TABLE pedidos
  MODIFY COLUMN status ENUM(
    'preparando','enviado','em_transporte','saiu_entrega','entregue','cancelado'
  ) NOT NULL DEFAULT 'preparando';

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
 WHERE p.end_logradouro IS NULL;

-- subtotal legado
UPDATE pedidos SET subtotal = total WHERE subtotal = 0;

-- itens_pedido
ALTER TABLE itens_pedido
  ADD COLUMN IF NOT EXISTS produto_nome    VARCHAR(150) DEFAULT NULL AFTER produto_id,
  ADD COLUMN IF NOT EXISTS produto_imagem  VARCHAR(255) DEFAULT NULL AFTER produto_nome,
  ADD COLUMN IF NOT EXISTS categoria_nome  VARCHAR(80)  DEFAULT NULL AFTER produto_imagem;

UPDATE itens_pedido i
  JOIN produtos pr  ON pr.id = i.produto_id
  JOIN categorias c ON c.id = pr.categoria_id
   SET i.produto_nome   = pr.nome,
       i.produto_imagem = pr.imagem,
       i.categoria_nome = c.nome
 WHERE i.produto_nome IS NULL;

SET @fk_name := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'itens_pedido'
     AND COLUMN_NAME = 'produto_id' AND REFERENCED_TABLE_NAME = 'produtos'
   LIMIT 1
);
SET @drop_fk := IF(@fk_name IS NOT NULL, CONCAT('ALTER TABLE itens_pedido DROP FOREIGN KEY ', @fk_name), 'SELECT 1');
PREPARE stmt FROM @drop_fk; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE itens_pedido MODIFY COLUMN produto_id INT UNSIGNED DEFAULT NULL;
ALTER TABLE itens_pedido
  ADD CONSTRAINT itens_pedido_produto_fk
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL;

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

INSERT INTO pedido_timeline (pedido_id, etapa, criado_em)
SELECT p.id, 'confirmado', p.criado_em
  FROM pedidos p
 WHERE NOT EXISTS (SELECT 1 FROM pedido_timeline t WHERE t.pedido_id = p.id);

INSERT INTO pedido_timeline (pedido_id, etapa, criado_em)
SELECT p.id, p.status, p.atualizado_em
  FROM pedidos p
 WHERE p.status <> 'preparando'
   AND NOT EXISTS (
     SELECT 1 FROM pedido_timeline t WHERE t.pedido_id = p.id AND t.etapa = p.status
   );

SELECT 'Migração de Detalhes do Pedido concluída com sucesso.' AS resultado;
