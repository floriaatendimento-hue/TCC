USE floria;

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS status_pagamento ENUM('pendente','aprovado','recusado','estornado')
                                             NOT NULL DEFAULT 'aprovado' AFTER parcelas,
  ADD COLUMN IF NOT EXISTS observacoes      VARCHAR(500) DEFAULT NULL;

UPDATE pedidos SET status_pagamento = 'estornado' WHERE status = 'cancelado' AND status_pagamento <> 'estornado';

CREATE TABLE IF NOT EXISTS comprovantes (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Migração de Comprovante de Compra concluída com sucesso.' AS resultado;
