USE floria;

-- coluna de ficha técnica
SET @coluna_existe := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produtos' AND COLUMN_NAME = 'especificacoes'
);
SET @sql := IF(@coluna_existe = 0,
  'ALTER TABLE produtos ADD COLUMN especificacoes JSON DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- novas categorias
INSERT IGNORE INTO categorias (nome, slug, descricao) VALUES
  ('Ferramentas',        'ferramentas',      'Ferramentas de jardinagem para plantar, podar e cultivar'),
  ('Adubos',             'adubos',           'Adubos e fertilizantes para nutrir suas plantas'),
  ('Controle de Pragas', 'controle-pragas',  'Produtos para prevenir e controlar pragas e doenças no jardim');

-- produtos das novas categorias
SOURCE seed_novas_categorias.sql;
