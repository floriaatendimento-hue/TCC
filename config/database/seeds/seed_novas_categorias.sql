-- Ferramentas de Jardinagem
INSERT IGNORE INTO produtos
  (categoria_id, nome, slug, descricao, preco, estoque, imagem, imagem_2, imagem_3, tags, destaque, especificacoes, criado_em)
VALUES
  ((SELECT id FROM categorias WHERE slug = 'ferramentas'),
    'Pá de Jardinagem Manual', 'pa-jardinagem-manual',
    'Pá de mão em aço carbono com cabo ergonômico emborrachado, ideal para transplantar mudas e cultivar vasos.',
    39.90, 60, 'produtos-fotos/pa-jardinagem-manual-1.webp', 'produtos-fotos/pa-jardinagem-manual-2.webp', 'produtos-fotos/pa-jardinagem-manual-3.webp', 'pa,jardinagem,plantio,transplante',
    1, JSON_OBJECT('Material', 'Aço carbono', 'Cabo', 'Emborrachado antiderrapante', 'Comprimento', '28 cm', 'Peso', '210 g', 'Garantia', '12 meses'),
    '2025-04-01 09:00:00'),

  ((SELECT id FROM categorias WHERE slug = 'ferramentas'),
    'Regador de Metal 5L', 'regador-metal-5l',
    'Regador galvanizado de 5 litros com crivo removível, para uma rega uniforme em vasos e canteiros.',
    89.90, 40, 'produtos-fotos/regador-metal-5l-1.webp', 'produtos-fotos/regador-metal-5l-2.webp', 'produtos-fotos/regador-metal-5l-3.webp', 'regador,rega,irrigacao',
    0, JSON_OBJECT('Material', 'Aço galvanizado', 'Capacidade', '5 litros', 'Crivo', 'Removível', 'Peso', '620 g'),
    '2025-04-02 09:00:00'),

  ((SELECT id FROM categorias WHERE slug = 'ferramentas'),
    'Tesoura de Poda Profissional', 'tesoura-poda-profissional',
    'Tesoura de poda com lâmina em aço inox afiada, corte limpo para galhos de até 2 cm de diâmetro.',
    64.90, 55, 'produtos-fotos/tesoura-poda-profissional-1.webp', 'produtos-fotos/tesoura-poda-profissional-2.webp', 'produtos-fotos/tesoura-poda-profissional-3.webp', 'tesoura,poda,corte',
    1, JSON_OBJECT('Material da lâmina', 'Aço inox', 'Capacidade de corte', 'Até 2 cm', 'Cabo', 'Antiderrapante', 'Garantia', '12 meses'),
    '2025-04-03 09:00:00'),

  ((SELECT id FROM categorias WHERE slug = 'ferramentas'),
    'Kit de Ferramentas de Jardim (5 peças)', 'kit-ferramentas-jardim',
    'Kit completo com pá, garfo, cultivador, transplantador e tesoura — tudo que você precisa para começar a jardinagem.',
    129.90, 30, 'produtos-fotos/kit-ferramentas-jardim-1.png', 'produtos-fotos/kit-ferramentas-jardim-2.webp', 'produtos-fotos/kit-ferramentas-jardim-3.webp', 'kit,ferramentas,conjunto',
    1, JSON_OBJECT('Peças', '5', 'Material', 'Aço carbono + cabo de madeira', 'Estojo', 'Bolsa de transporte inclusa', 'Garantia', '12 meses'),
    '2025-04-04 09:00:00'),

  ((SELECT id FROM categorias WHERE slug = 'ferramentas'),
    'Luvas de Jardinagem Reforçadas', 'luvas-jardinagem-reforcadas',
    'Luvas com palma reforçada em látex, proteção contra espinhos e conforto para longas sessões de trabalho.',
    29.90, 80, 'produtos-fotos/luvas-jardinagem-reforcadas-1.webp', 'produtos-fotos/luvas-jardinagem-reforcadas-2.webp', 'produtos-fotos/luvas-jardinagem-reforcadas-3.webp', 'luvas,protecao,seguranca',
    0, JSON_OBJECT('Material', 'Algodão + látex', 'Tamanho', 'Único (M/G)', 'Proteção', 'Reforço contra espinhos'),
    '2025-04-05 09:00:00'),

  ((SELECT id FROM categorias WHERE slug = 'ferramentas'),
    'Carrinho de Mão para Jardim', 'carrinho-mao-jardim',
    'Carrinho de mão robusto com caçamba de 60L, ideal para transportar terra, adubo e mudas pelo jardim.',
    349.90, 15, 'produtos-fotos/carrinho-mao-jardim-1.webp', 'produtos-fotos/carrinho-mao-jardim-2.webp', 'produtos-fotos/carrinho-mao-jardim-3.webp', 'carrinho,transporte,caçamba',
    0, JSON_OBJECT('Capacidade', '60 litros', 'Estrutura', 'Aço reforçado', 'Roda', 'Pneumática', 'Carga máxima', '80 kg'),
    '2025-04-06 09:00:00');

-- Adubos e Fertilizantes
INSERT IGNORE INTO produtos
  (categoria_id, nome, slug, descricao, preco, estoque, imagem, tags, destaque, especificacoes, criado_em)
VALUES
  ((SELECT id FROM categorias WHERE slug = 'adubos'),
    'Adubo Orgânico Composto 5kg', 'adubo-organico-composto-5kg',
    'Composto orgânico rico em matéria orgânica, melhora a estrutura do solo e a retenção de água.',
    34.90, 70, 'adubo-organico-composto.png', 'adubo,organico,composto,solo',
    1, JSON_OBJECT('Tipo', 'Orgânico', 'Peso', '5 kg', 'Aplicação', 'A cada 30 dias', 'Uso', 'Solo e vasos'),
    '2025-04-07 09:00:00'),

  ((SELECT id FROM categorias WHERE slug = 'adubos'),
    'Fertilizante NPK 10-10-10', 'fertilizante-npk-10-10-10',
    'Fertilizante mineral balanceado NPK 10-10-10, ideal para manutenção geral de plantas de jardim e vasos.',
    27.90, 90, 'adubo-fertilizante-npk.png', 'npk,fertilizante,mineral',
    1, JSON_OBJECT('Formulação', 'NPK 10-10-10', 'Peso', '1 kg', 'Aplicação', 'Mensal', 'Uso', 'Plantas em geral'),
    '2025-04-08 09:00:00'),

  ((SELECT id FROM categorias WHERE slug = 'adubos'),
    'Húmus de Minhoca 2kg', 'humus-minhoca-2kg',
    'Húmus de minhoca 100% natural, rico em nutrientes prontamente disponíveis para as raízes.',
    22.90, 65, 'adubo-humus-minhoca.png', 'humus,minhoca,organico',
    0, JSON_OBJECT('Tipo', 'Orgânico', 'Peso', '2 kg', 'Origem', 'Minhocultura', 'Uso', 'Solo, vasos e mudas'),
    '2025-04-09 09:00:00'),

  ((SELECT id FROM categorias WHERE slug = 'adubos'),
    'Farinha de Osso 1kg', 'farinha-de-osso-1kg',
    'Fonte natural de fósforo e cálcio, estimula o enraizamento e a floração.',
    19.90, 50, 'adubo-farinha-osso.png', 'farinha,osso,fosforo',
    0, JSON_OBJECT('Tipo', 'Orgânico mineral', 'Peso', '1 kg', 'Rico em', 'Fósforo e cálcio', 'Aplicação', 'A cada 60 dias'),
    '2025-04-10 09:00:00'),

  ((SELECT id FROM categorias WHERE slug = 'adubos'),
    'Fertilizante Líquido Multiuso', 'fertilizante-liquido-multiuso',
    'Fertilizante líquido concentrado de rápida absorção, para todos os tipos de plantas ornamentais.',
    32.90, 55, 'adubo-fertilizante-liquido.png', 'fertilizante,liquido,concentrado',
    1, JSON_OBJECT('Formato', 'Líquido concentrado', 'Volume', '500 ml', 'Diluição', '5 ml por litro de água', 'Aplicação', 'Quinzenal'),
    '2025-04-11 09:00:00'),

  ((SELECT id FROM categorias WHERE slug = 'adubos'),
    'Adubo para Suculentas e Cactos', 'adubo-suculentas-cactos',
    'Fórmula especial de baixa concentração de nitrogênio, desenvolvida para suculentas e cactos.',
    24.90, 60, 'adubo-suculentas-cactos.png', 'suculentas,cactos,adubo',
    0, JSON_OBJECT('Formulação', 'NPK 2-7-7', 'Peso', '300 g', 'Uso', 'Suculentas e cactos', 'Aplicação', 'A cada 45 dias'),
    '2025-04-12 09:00:00');

-- Controle de Pragas
INSERT IGNORE INTO produtos
  (categoria_id, nome, slug, descricao, preco, estoque, imagem, tags, destaque, especificacoes, criado_em)
VALUES
  ((SELECT id FROM categorias WHERE slug = 'controle-pragas'),
    'Óleo de Neem Concentrado', 'oleo-de-neem-concentrado',
    'Óleo de neem 100% natural, ação inseticida e fungicida, seguro para uso doméstico.',
    38.90, 45, 'praga-oleo-neem.png', 'neem,oleo,organico,inseticida',
    1, JSON_OBJECT('Princípio ativo', 'Azadiractina', 'Volume', '200 ml', 'Diluição', '5 ml por litro de água', 'Uso', 'Preventivo e curativo'),
    '2025-04-13 09:00:00'),

  ((SELECT id FROM categorias WHERE slug = 'controle-pragas'),
    'Armadilha Adesiva para Insetos', 'armadilha-adesiva-insetos',
    'Placas adesivas amarelas que atraem e capturam pulgões, moscas-brancas e outros insetos voadores.',
    18.90, 100, 'praga-armadilha-adesiva.png', 'armadilha,adesiva,insetos',
    0, JSON_OBJECT('Formato', 'Placas adesivas', 'Quantidade', '10 unidades', 'Cor', 'Amarelo atrativo', 'Uso', 'Interno e externo'),
    '2025-04-14 09:00:00'),

  ((SELECT id FROM categorias WHERE slug = 'controle-pragas'),
    'Sabão Inseticida Natural', 'sabao-inseticida-natural',
    'Sabão potássico biodegradável, elimina pulgões e cochonilhas sem agredir plantas benéficas.',
    26.90, 50, 'praga-sabao-inseticida.png', 'sabao,inseticida,organico',
    1, JSON_OBJECT('Base', 'Sabão potássico', 'Volume', '500 ml', 'Diluição', '20 ml por litro de água', 'Biodegradável', 'Sim'),
    '2025-04-15 09:00:00'),

  ((SELECT id FROM categorias WHERE slug = 'controle-pragas'),
    'Repelente Natural para Pulgões', 'repelente-natural-pulgoes',
    'Spray pronto para uso à base de extratos vegetais, repele pulgões e ácaros das folhas.',
    31.90, 40, 'praga-repelente-pulgoes.png', 'repelente,pulgoes,spray',
    0, JSON_OBJECT('Formato', 'Spray pronto para uso', 'Volume', '400 ml', 'Base', 'Extratos vegetais', 'Reaplicação', 'Semanal'),
    '2025-04-16 09:00:00'),

  ((SELECT id FROM categorias WHERE slug = 'controle-pragas'),
    'Terra de Diatomácea', 'terra-de-diatomacea',
    'Pó natural que controla lesmas, caracóis e insetos rastejantes por ação física, sem venenos.',
    23.90, 60, 'praga-terra-diatomacea.png', 'diatomacea,po,natural',
    0, JSON_OBJECT('Tipo', 'Mineral natural', 'Peso', '400 g', 'Ação', 'Física (não tóxica)', 'Uso', 'Solo e base das plantas'),
    '2025-04-17 09:00:00'),

  ((SELECT id FROM categorias WHERE slug = 'controle-pragas'),
    'Spray Fungicida Orgânico', 'spray-fungicida-organico',
    'Fungicida à base de calda bordalesa natural, previne e trata doenças fúngicas nas folhas.',
    29.90, 45, 'praga-spray-fungicida.png', 'fungicida,spray,organico',
    1, JSON_OBJECT('Base', 'Calda bordalesa natural', 'Volume', '500 ml', 'Uso', 'Preventivo e curativo', 'Aplicação', 'A cada 15 dias'),
    '2025-04-18 09:00:00');
