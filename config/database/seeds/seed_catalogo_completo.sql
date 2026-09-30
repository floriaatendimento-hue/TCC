INSERT IGNORE INTO subcategorias (categoria_id, nome, slug, ordem)
SELECT c.id, x.nome, x.slug, x.ordem
  FROM (
    SELECT 'vasos' AS categoria_slug, 'Decorativos e funcionais' AS nome, 'decorativos-funcionais' AS slug, 3 AS ordem
    UNION ALL SELECT 'ferramentas', 'Ferramentas manuais', 'ferramentas-manuais', 2
    UNION ALL SELECT 'ferramentas', 'Acessórios',          'acessorios',          3
    UNION ALL SELECT 'adubos',      'Fertilizantes específicos', 'fertilizantes-especificos', 2
    UNION ALL SELECT 'adubos',      'Corretivos e complementos', 'corretivos-complementos',   3
    UNION ALL SELECT 'controle-pragas', 'Pragas específicas',    'pragas-especificas',  2
    UNION ALL SELECT 'controle-pragas', 'Proteção das plantas',  'protecao-plantas',    3
  ) x
  JOIN categorias c ON c.slug = x.categoria_slug;

UPDATE produtos p
   JOIN categorias c ON c.id = p.categoria_id AND c.slug = 'ferramentas'
   JOIN subcategorias s ON s.categoria_id = c.id AND s.slug = 'ferramentas-manuais'
   SET p.subcategoria_id = s.id
 WHERE p.slug = 'pa-jardinagem-manual' AND p.subcategoria_id IS NULL;

UPDATE produtos p
   JOIN categorias c ON c.id = p.categoria_id AND c.slug = 'ferramentas'
   JOIN subcategorias s ON s.categoria_id = c.id AND s.slug = 'acessorios'
   SET p.subcategoria_id = s.id
 WHERE p.slug IN ('kit-ferramentas-jardim', 'luvas-jardinagem-reforcadas', 'carrinho-mao-jardim')
   AND p.subcategoria_id IS NULL;

UPDATE produtos p
   JOIN categorias c ON c.id = p.categoria_id AND c.slug = 'vasos'
   JOIN subcategorias s ON s.categoria_id = c.id AND s.slug = 'decorativos-funcionais'
   SET p.subcategoria_id = s.id
 WHERE p.slug IN ('vaso-suspenso-macrame', 'vaso-minimalista', 'vaso-decorativo-marrom', 'vaso-autoirrigavel-transparente')
   AND p.subcategoria_id IS NULL;

UPDATE produtos p
   JOIN categorias c ON c.id = p.categoria_id AND c.slug = 'controle-pragas'
   JOIN subcategorias s ON s.categoria_id = c.id AND s.slug = 'tratamento'
   SET p.subcategoria_id = s.id
 WHERE p.slug IN ('oleo-de-neem-concentrado', 'terra-de-diatomacea', 'spray-fungicida-organico')
   AND p.subcategoria_id IS NULL;

UPDATE produtos p
   JOIN categorias c ON c.id = p.categoria_id AND c.slug = 'adubos'
   JOIN subcategorias s ON s.categoria_id = c.id AND s.slug = 'fertilizantes-especificos'
   SET p.subcategoria_id = s.id
 WHERE p.slug IN ('farinha-de-osso-1kg', 'fertilizante-liquido-multiuso')
   AND p.subcategoria_id IS NULL;
-- Produtos novos

-- PLANTAS
INSERT IGNORE INTO produtos (categoria_id, subcategoria_id, nome, slug, preco, descricao, beneficios, como_utilizar, recomendacoes, imagem)
SELECT (SELECT id FROM categorias WHERE slug = 'plantas'),
       (SELECT s.id FROM subcategorias s
          JOIN categorias c ON c.id = s.categoria_id
         WHERE c.slug = 'plantas' AND s.slug = x.sub),
       x.nome, x.slug, x.preco, x.descricao, x.beneficios, x.como_utilizar, x.recomendacoes, x.imagem
  FROM (
    SELECT 'folhagens' AS sub, 'Filodendro' AS nome, 'filodendro' AS slug, 65.00 AS preco,
           'Filodendro de folhas verdes brilhantes e formato arredondado, uma trepadeira versátil que se adapta bem a vasos suspensos ou com suporte para subir.' AS descricao,
           'Purifica o ar do ambiente e cresce rápido mesmo em espaços com pouca luz direta.' AS beneficios,
           'Mantenha o substrato levemente úmido e posicione em local com luz indireta. Pode ser conduzido em tutor para crescer na vertical.' AS como_utilizar,
           'Ideal para quem está começando com plantas de interior, pela baixa manutenção.' AS recomendacoes,
           'catalogo/filodendro.svg' AS imagem
    UNION ALL
    SELECT 'folhagens' AS sub, 'Maranta' AS nome, 'maranta' AS slug, 89.90 AS preco,
           'Maranta leuconeura, conhecida como "planta-oração" pelo movimento das folhas ao entardecer, com padrões marcantes em tons de verde.' AS descricao,
           'Folhagem decorativa com padrões únicos que trazem textura visual para qualquer ambiente interno.' AS beneficios,
           'Cultive em meia-sombra, com regas frequentes e substrato sempre úmido, sem encharcar. Aprecia ambientes úmidos.' AS como_utilizar,
           'Recomendada para banheiros ou cozinhas com boa luminosidade indireta, onde a umidade natural ajuda a planta.' AS recomendacoes,
           'catalogo/maranta.svg' AS imagem
    UNION ALL
    SELECT 'folhagens' AS sub, 'Calathea' AS nome, 'calathea' AS slug, 99.90 AS preco,
           'Calathea de folhagem exuberante, com desenhos contrastantes entre a face superior e inferior das folhas, muito usada na decoração de interiores.' AS descricao,
           'Uma das folhagens mais decorativas do mercado, valorizada pelo desenho e textura únicos de cada folha.' AS beneficios,
           'Regue com água filtrada ou de chuva, mantendo o substrato úmido sem encharcar, em ambiente com luz indireta e alta umidade.' AS como_utilizar,
           'Evite correntes de ar frio e proximidade com aparelhos de ar-condicionado, que ressecam as folhas.' AS recomendacoes,
           'catalogo/calathea.svg' AS imagem
    UNION ALL
    SELECT 'samambaias' AS sub, 'Samambaia Americana' AS nome, 'samambaia-americana' AS slug, 95.00 AS preco,
           'Samambaia de folhagem densa e arqueada, formato exuberante que se destaca em vasos suspensos ou floreiras.' AS descricao,
           'Cresce rápido e enche o ambiente com uma folhagem cheia, ideal para varandas sombreadas.' AS beneficios,
           'Mantenha o substrato sempre úmido e borrife água nas folhas em dias secos. Evite sol direto.' AS como_utilizar,
           'Combina bem com vasos suspensos de macramê, aproveitando o formato caído das folhas.' AS recomendacoes,
           'catalogo/samambaia-americana.svg' AS imagem
    UNION ALL
    SELECT 'samambaias' AS sub, 'Samambaia Havaiana' AS nome, 'samambaia-havaiana' AS slug, 85.00 AS preco,
           'Samambaia de folhas finas e delicadas, com aspecto rendado que confere leveza à decoração.' AS descricao,
           'Folhagem fina e leve, ótima para compor arranjos e cantos de sombra no jardim.' AS beneficios,
           'Prefira meia-sombra e regas regulares, mantendo o substrato úmido, sem encharcamento.' AS como_utilizar,
           'Boa opção para quem busca uma samambaia de porte um pouco menor que a tradicional.' AS recomendacoes,
           'catalogo/samambaia-havaiana.svg' AS imagem
    UNION ALL
    SELECT 'samambaias' AS sub, 'Samambaia Renda-Portuguesa' AS nome, 'samambaia-renda-portuguesa' AS slug, 105.00 AS preco,
           'Samambaia de folhas onduladas e recortadas, lembrando uma renda, com visual sofisticado para ambientes internos e sombreados.' AS descricao,
           'Textura ornamental diferenciada, destaque em composições com outras folhagens.' AS beneficios,
           'Cultive em sombra ou meia-sombra, com regas frequentes e ambiente úmido, evitando sol direto.' AS como_utilizar,
           'Aprecia pulverizações regulares nas folhas, especialmente em regiões de clima seco.' AS recomendacoes,
           'catalogo/samambaia-renda-portuguesa.svg' AS imagem
    UNION ALL
    SELECT 'samambaias' AS sub, 'Samambaia de Boston' AS nome, 'samambaia-boston' AS slug, 115.00 AS preco,
           'Uma das samambaias mais populares, com folhas longas e arqueadas de verde intenso, tradicional em varandas e jardins de inverno.' AS descricao,
           'Ajuda a umidificar o ar do ambiente e tem crescimento vigoroso quando bem cuidada.' AS beneficios,
           'Regue com frequência, mantendo o substrato sempre levemente úmido, em local de meia-sombra.' AS como_utilizar,
           'Perfeita para pendurar em suportes altos, deixando as folhas caírem livremente.' AS recomendacoes,
           'catalogo/samambaia-boston.svg' AS imagem
    UNION ALL
    SELECT 'suculentas' AS sub, 'Echeveria' AS nome, 'echeveria' AS slug, 39.90 AS preco,
           'Suculenta em formato de roseta, com folhas carnudas e coloração que varia entre o verde-azulado e tons rosados conforme a luminosidade.' AS descricao,
           'Baixíssima manutenção e resistente a longos períodos sem rega, ideal para o dia a dia corrido.' AS beneficios,
           'Regue apenas quando o substrato estiver completamente seco e mantenha em local com boa luz, de preferência sol da manhã.' AS como_utilizar,
           'Use substrato específico para suculentas e cactos, com boa drenagem, para evitar apodrecimento das raízes.' AS recomendacoes,
           'catalogo/echeveria.svg' AS imagem
    UNION ALL
    SELECT 'suculentas' AS sub, 'Sedum' AS nome, 'sedum' AS slug, 34.90 AS preco,
           'Suculenta rasteira de folhas pequenas e carnudas, cresce formando tapetes densos, muito usada em jardins de pedra e vasos baixos.' AS descricao,
           'Cresce rápido, se multiplica com facilidade e tolera bem períodos de seca.' AS beneficios,
           'Regue moderadamente, deixando o substrato secar entre uma rega e outra, em local ensolarado.' AS como_utilizar,
           'Ótima para composições com outras suculentas em um mesmo vaso ou jardim vertical.' AS recomendacoes,
           'catalogo/sedum.svg' AS imagem
    UNION ALL
    SELECT 'orquideas' AS sub, 'Orquídea Phalaenopsis' AS nome, 'orquidea-phalaenopsis' AS slug, 109.90 AS preco,
           'A orquídea mais popular do mercado, com flores duradouras em hastes elegantes, disponível em diversas cores.' AS descricao,
           'Floração longa, podendo durar meses, e fácil adaptação a ambientes internos.' AS beneficios,
           'Regue por imersão uma vez por semana e mantenha em local com luz indireta e boa circulação de ar.' AS como_utilizar,
           'Após o fim da floração, corte a haste acima de um nó saudável para estimular um novo florescimento.' AS recomendacoes,
           'catalogo/orquidea-phalaenopsis.svg' AS imagem
    UNION ALL
    SELECT 'orquideas' AS sub, 'Orquídea Dendrobium' AS nome, 'orquidea-dendrobium' AS slug, 119.90 AS preco,
           'Orquídea de hastes eretas com diversas flores por ramo, florescendo em ciclos ao longo do ano.' AS descricao,
           'Produz várias flores por haste, criando um efeito visual mais denso que outras orquídeas.' AS beneficios,
           'Regue regularmente na época de crescimento e reduza na fase de repouso, sempre com boa luminosidade.' AS como_utilizar,
           'Prefere leve diferença de temperatura entre dia e noite para estimular a floração.' AS recomendacoes,
           'catalogo/orquidea-dendrobium.svg' AS imagem
    UNION ALL
    SELECT 'orquideas' AS sub, 'Orquídea Cattleya' AS nome, 'orquidea-cattleya' AS slug, 149.90 AS preco,
           'Conhecida como a "rainha das orquídeas", com flores grandes e perfumadas, muito valorizada em arranjos e presentes.' AS descricao,
           'Flores exuberantes e perfumadas, com grande apelo decorativo.' AS beneficios,
           'Cultive com boa luminosidade, regas espaçadas e substrato bem drenado, deixando secar entre as regas.' AS como_utilizar,
           'Fertilize durante a fase de crescimento ativo para estimular floradas mais generosas.' AS recomendacoes,
           'catalogo/orquidea-cattleya.svg' AS imagem
    UNION ALL
    SELECT 'orquideas' AS sub, 'Orquídea Oncidium' AS nome, 'orquidea-oncidium' AS slug, 99.90 AS preco,
           'Orquídea conhecida como "chuva-de-ouro" pelas hastes repletas de pequenas flores amarelas, com floração abundante.' AS descricao,
           'Produz muitas flores por haste, criando um efeito de cascata bastante decorativo.' AS beneficios,
           'Mantenha em local iluminado, com regas regulares e boa ventilação entre as raízes.' AS como_utilizar,
           'Fixe em placas ou vasos com substrato bem arejado, imitando seu habitat natural em árvores.' AS recomendacoes,
           'catalogo/orquidea-oncidium.svg' AS imagem
  ) x;

-- VASOS
INSERT IGNORE INTO produtos (categoria_id, subcategoria_id, nome, slug, preco, descricao, beneficios, como_utilizar, recomendacoes, imagem, imagem_2, imagem_3)
SELECT (SELECT id FROM categorias WHERE slug = 'vasos'),
       (SELECT s.id FROM subcategorias s
          JOIN categorias c ON c.id = s.categoria_id
         WHERE c.slug = 'vasos' AND s.slug = x.sub),
       x.nome, x.slug, x.preco, x.descricao, x.beneficios, x.como_utilizar, x.recomendacoes, x.imagem, x.imagem_2, x.imagem_3
  FROM (
    SELECT 'ceramica' AS sub, 'Vaso de Cerâmica Branco' AS nome, 'vaso-ceramica-branco' AS slug, 89.90 AS preco,
           'Vaso de cerâmica esmaltada na cor branca, acabamento liso que combina com qualquer estilo de decoração, do clássico ao minimalista.' AS descricao,
           'Visual neutro que se adapta a qualquer ambiente e realça o verde das plantas.' AS beneficios,
           'Utilize um prato coletor caso não haja furo de drenagem no fundo do vaso.' AS como_utilizar,
           'Combina bem com plantas de folhagem verde intensa, que ganham destaque contra o fundo branco.' AS recomendacoes,
           'produtos-fotos/vaso-ceramica-branco-1.webp' AS imagem, 'produtos-fotos/vaso-ceramica-branco-2.webp' AS imagem_2, 'produtos-fotos/vaso-ceramica-branco-3.webp' AS imagem_3
    UNION ALL
    SELECT 'ceramica' AS sub, 'Vaso de Cerâmica Terracota' AS nome, 'vaso-ceramica-terracota' AS slug, 75.00 AS preco,
           'Vaso de cerâmica em terracota natural, material poroso tradicional na jardinagem, com visual rústico e aconchegante.' AS descricao,
           'A porosidade natural da terracota favorece a aeração das raízes e ajuda a regular a umidade do substrato.' AS beneficios,
           'Antes do primeiro uso, deixe o vaso de molho em água por algumas horas para reduzir a absorção excessiva de umidade do substrato.' AS como_utilizar,
           'Boa opção para suculentas e cactos, que preferem substrato com secagem mais rápida.' AS recomendacoes,
           'produtos-fotos/vaso-ceramica-terracota-1.webp' AS imagem, 'produtos-fotos/vaso-ceramica-terracota-2.webp' AS imagem_2, 'produtos-fotos/vaso-ceramica-terracota-3.webp' AS imagem_3
    UNION ALL
    SELECT 'concreto-cimento' AS sub, 'Vaso de Cimento Redondo' AS nome, 'vaso-cimento-redondo' AS slug, 65.00 AS preco,
           'Vaso de cimento em formato redondo, com acabamento fosco e visual industrial contemporâneo.' AS descricao,
           'Peso e estabilidade que evitam tombamentos, ideal para plantas de porte médio em áreas externas.' AS beneficios,
           'Utilize prato ou base impermeável ao usar sobre móveis de madeira, evitando manchas de umidade.' AS como_utilizar,
           'Combina bem com plantas de folhagem estruturada, como zamioculcas e espadas-de-são-jorge.' AS recomendacoes,
           'produtos-fotos/vaso-cimento-redondo-1.webp' AS imagem, 'produtos-fotos/vaso-cimento-redondo-2.webp' AS imagem_2, 'produtos-fotos/vaso-cimento-redondo-3.webp' AS imagem_3
    UNION ALL
    SELECT 'concreto-cimento' AS sub, 'Vaso de Cimento Alto' AS nome, 'vaso-cimento-alto' AS slug, 95.00 AS preco,
           'Vaso de cimento em formato alto e cilíndrico, ideal para dar destaque a plantas de porte maior em ambientes internos e externos.' AS descricao,
           'O formato alto valoriza plantas de folhagem ereta e ajuda a criar pontos focais na decoração.' AS beneficios,
           'Posicione em local firme e nivelado devido ao peso e à altura da peça.' AS como_utilizar,
           'Ideal para compor entradas e corredores, onde o volume da peça ganha destaque.' AS recomendacoes,
           'produtos-fotos/vaso-cimento-alto-1.webp' AS imagem, 'produtos-fotos/vaso-cimento-alto-2.webp' AS imagem_2, 'produtos-fotos/vaso-cimento-alto-3.webp' AS imagem_3
    UNION ALL
    SELECT 'vidro' AS sub, 'Vaso de Vidro Âmbar' AS nome, 'vaso-vidro-ambar' AS slug, 68.00 AS preco,
           'Vaso de vidro na tonalidade âmbar, com transparência que permite acompanhar o desenvolvimento das raízes.' AS descricao,
           'A cor âmbar filtra parte da luz, ajudando a controlar o crescimento de algas em cultivos com água.' AS beneficios,
           'Ideal para cultivo hidropônico simples: mantenha o nível de água cobrindo apenas a base das raízes.' AS como_utilizar,
           'Combina bem com plantas como potos e comigo-ninguém-pode cultivadas em água.' AS recomendacoes,
           'produtos-fotos/vaso-vidro-ambar-1.webp' AS imagem, 'produtos-fotos/vaso-vidro-ambar-2.webp' AS imagem_2, 'produtos-fotos/vaso-vidro-ambar-3.webp' AS imagem_3
    UNION ALL
    SELECT 'vidro' AS sub, 'Vaso de Vidro Canelado' AS nome, 'vaso-vidro-canelado' AS slug, 72.00 AS preco,
           'Vaso de vidro com acabamento canelado, textura que brinca com a luz e adiciona um toque decorativo mesmo sem planta.' AS descricao,
           'O relevo canelado cria reflexos de luz que valorizam tanto a peça quanto a planta.' AS beneficios,
           'Limpe com pano macio e água morna, evitando esponjas abrasivas que podem riscar o vidro.' AS como_utilizar,
           'Ótimo para suculentas pequenas ou arranjos florais de vida curta.' AS recomendacoes,
           'produtos-fotos/vaso-vidro-canelado-1.webp' AS imagem, 'produtos-fotos/vaso-vidro-canelado-2.webp' AS imagem_2, 'produtos-fotos/vaso-vidro-canelado-3.webp' AS imagem_3
    UNION ALL
    SELECT 'vidro' AS sub, 'Vaso de Vidro Redondo' AS nome, 'vaso-vidro-redondo' AS slug, 55.00 AS preco,
           'Vaso de vidro em formato esférico, design minimalista que funciona tanto sozinho quanto em composições com outras peças.' AS descricao,
           'Formato compacto que se adapta bem a mesas, estantes e prateleiras estreitas.' AS beneficios,
           'Evite exposição direta ao sol por longos períodos quando usado com água, para não favorecer o surgimento de algas.' AS como_utilizar,
           'Boa opção para pequenos arranjos de suculentas ou plantas aquáticas de baixa manutenção.' AS recomendacoes,
           'produtos-fotos/vaso-vidro-redondo-1.webp' AS imagem, 'produtos-fotos/vaso-vidro-redondo-2.webp' AS imagem_2, 'produtos-fotos/vaso-vidro-redondo-3.webp' AS imagem_3
    UNION ALL
    SELECT 'vidro' AS sub, 'Vaso de Vidro Decorativo' AS nome, 'vaso-vidro-decorativo' AS slug, 79.90 AS preco,
           'Vaso de vidro com design diferenciado, pensado tanto para plantas quanto para composições decorativas com elementos naturais.' AS descricao,
           'Versatilidade para uso com terra, água ou apenas como peça decorativa isolada.' AS beneficios,
           'Ao usar com substrato, adicione uma camada de argila expandida no fundo para auxiliar a drenagem.' AS como_utilizar,
           'Combina com arranjos de flores secas ou plantas de pequeno porte em ambientes internos.' AS recomendacoes,
           'produtos-fotos/vaso-vidro-decorativo-1.webp' AS imagem, 'produtos-fotos/vaso-vidro-decorativo-2.webp' AS imagem_2, 'produtos-fotos/vaso-vidro-decorativo-3.webp' AS imagem_3
    UNION ALL
    SELECT 'decorativos-funcionais' AS sub, 'Vaso Autoirrigável de Cerâmica' AS nome, 'vaso-autoirrigavel-ceramica' AS slug, 129.90 AS preco,
           'Vaso autoirrigável com reservatório de água embutido na base de cerâmica, unindo praticidade e acabamento sofisticado.' AS descricao,
           'Reduz a frequência de regas e evita tanto o encharcamento quanto o ressecamento do substrato.' AS beneficios,
           'Preencha o reservatório inferior conforme o indicador de nível e deixe a planta absorver a água por capilaridade.' AS como_utilizar,
           'Ideal para quem viaja com frequência ou tem dificuldade em manter uma rotina fixa de regas.' AS recomendacoes,
           'produtos-fotos/vaso-autoirrigavel-ceramica-1.webp' AS imagem, 'produtos-fotos/vaso-autoirrigavel-ceramica-2.webp' AS imagem_2, 'produtos-fotos/vaso-autoirrigavel-ceramica-3.webp' AS imagem_3
  ) x;

-- FERRAMENTAS
INSERT IGNORE INTO produtos (categoria_id, subcategoria_id, nome, slug, preco, descricao, beneficios, como_utilizar, recomendacoes, imagem, imagem_2, imagem_3)
SELECT (SELECT id FROM categorias WHERE slug = 'ferramentas'),
       (SELECT s.id FROM subcategorias s
          JOIN categorias c ON c.id = s.categoria_id
         WHERE c.slug = 'ferramentas' AND s.slug = x.sub),
       x.nome, x.slug, x.preco, x.descricao, x.beneficios, x.como_utilizar, x.recomendacoes, x.imagem, x.imagem_2, x.imagem_3
  FROM (
    SELECT 'irrigacao' AS sub, 'Mangueira para Jardim 15m' AS nome, 'mangueira-jardim-15m' AS slug, 119.90 AS preco,
           'Mangueira flexível de 15 metros, resistente a dobras e ideal para regar jardins e hortas de médio a grande porte.' AS descricao,
           'Alcança áreas mais distantes da torneira sem a necessidade de trocar de posição o tempo todo.' AS beneficios,
           'Conecte à torneira usando os engates inclusos e desenrole totalmente antes de abrir o registro para evitar dobras.' AS como_utilizar,
           'Guarde enrolada e à sombra após o uso para aumentar a vida útil do material.' AS recomendacoes,
           'produtos-fotos/mangueira-jardim-15m-1.webp' AS imagem, 'produtos-fotos/mangueira-jardim-15m-2.webp' AS imagem_2, 'produtos-fotos/mangueira-jardim-15m-3.webp' AS imagem_3
    UNION ALL
    SELECT 'irrigacao' AS sub, 'Esguicho Regulável para Mangueira' AS nome, 'esguicho-regulavel-mangueira' AS slug, 24.90 AS preco,
           'Esguicho com bico regulável, permite alternar entre jato forte e neblina fina conforme a necessidade da rega.' AS descricao,
           'Um único acessório cobre desde a lavagem de calçadas até a rega delicada de mudas.' AS beneficios,
           'Encaixe na ponta da mangueira e gire o bico para ajustar a intensidade do jato desejado.' AS como_utilizar,
           'Use o modo neblina para mudas recém-plantadas e o jato forte para limpeza de áreas externas.' AS recomendacoes,
           'produtos-fotos/esguicho-regulavel-mangueira-1.webp' AS imagem, 'produtos-fotos/esguicho-regulavel-mangueira-2.webp' AS imagem_2, 'produtos-fotos/esguicho-regulavel-mangueira-3.webp' AS imagem_3
    UNION ALL
    SELECT 'irrigacao' AS sub, 'Aspersor para Jardim' AS nome, 'aspersor-jardim' AS slug, 44.90 AS preco,
           'Aspersor giratório que distribui água de forma uniforme sobre gramados e canteiros, ideal para áreas maiores.' AS descricao,
           'Economiza tempo ao regar áreas extensas automaticamente, com alcance ajustável.' AS beneficios,
           'Posicione no centro da área a ser regada e conecte à mangueira; ajuste o alcance conforme o tamanho do gramado.' AS como_utilizar,
           'Programe a rega para o início da manhã ou fim da tarde, reduzindo a perda de água por evaporação.' AS recomendacoes,
           'produtos-fotos/aspersor-jardim-1.webp' AS imagem, 'produtos-fotos/aspersor-jardim-2.webp' AS imagem_2, 'produtos-fotos/aspersor-jardim-3.webp' AS imagem_3
    UNION ALL
    SELECT 'irrigacao' AS sub, 'Regador Plástico 10L' AS nome, 'regador-plastico-10l' AS slug, 34.90 AS preco,
           'Regador de plástico resistente com capacidade de 10 litros, alça ergonômica e crivo removível para rega uniforme.' AS descricao,
           'Maior capacidade que os regadores tradicionais, reduzindo o número de idas até a torneira.' AS beneficios,
           'Encha até a capacidade máxima e incline gradualmente para controlar o fluxo de água sobre as plantas.' AS como_utilizar,
           'Use o crivo para plantas delicadas e retire-o quando precisar de um jato mais direcionado.' AS recomendacoes,
           'produtos-fotos/regador-plastico-10l-1.webp' AS imagem, 'produtos-fotos/regador-plastico-10l-2.webp' AS imagem_2, 'produtos-fotos/regador-plastico-10l-3.webp' AS imagem_3
    UNION ALL
    SELECT 'poda' AS sub, 'Serrote de Poda' AS nome, 'serrote-de-poda' AS slug, 79.90 AS preco,
           'Serrote com lâmina curva serrilhada, indicado para cortar galhos mais grossos que a tesoura de poda não alcança.' AS descricao,
           'Corte eficiente em galhos espessos, com menor esforço graças ao formato curvo da lâmina.' AS beneficios,
           'Posicione a lâmina na base do galho e faça movimentos de vai-e-vem, deixando o próprio peso da ferramenta auxiliar o corte.' AS como_utilizar,
           'Higienize a lâmina entre podas de plantas diferentes para evitar a transmissão de doenças.' AS recomendacoes,
           'produtos-fotos/serrote-de-poda-1.webp' AS imagem, 'produtos-fotos/serrote-de-poda-2.webp' AS imagem_2, 'produtos-fotos/serrote-de-poda-3.webp' AS imagem_3
    UNION ALL
    SELECT 'poda' AS sub, 'Podão de Jardim' AS nome, 'podao-de-jardim' AS slug, 69.90 AS preco,
           'Podão com cabo longo, permite alcançar galhos altos sem a necessidade de escada.' AS descricao,
           'Aumenta o alcance da poda com segurança, evitando subir em bancos ou escadas instáveis.' AS beneficios,
           'Posicione a lâmina ao redor do galho e acione o mecanismo de corte pelo cabo, mantendo os pés firmes no solo.' AS como_utilizar,
           'Ideal para poda de manutenção em árvores de médio porte e cercas vivas mais altas.' AS recomendacoes,
           'produtos-fotos/podao-de-jardim-1.webp' AS imagem, 'produtos-fotos/podao-de-jardim-2.webp' AS imagem_2, 'produtos-fotos/podao-de-jardim-3.webp' AS imagem_3
    UNION ALL
    SELECT 'poda' AS sub, 'Tesoura para Cerca Viva' AS nome, 'tesoura-cerca-viva' AS slug, 89.90 AS preco,
           'Tesoura de lâminas longas, própria para aparar cercas vivas e arbustos, garantindo um corte reto e uniforme.' AS descricao,
           'Corte mais rápido e uniforme em grandes extensões de cerca viva, comparado à tesoura de poda comum.' AS beneficios,
           'Segure com as duas mãos e faça movimentos amplos e contínuos, acompanhando a linha desejada do arbusto.' AS como_utilizar,
           'Apare a cerca viva regularmente para manter a densidade da folhagem e o formato definido.' AS recomendacoes,
           'produtos-fotos/tesoura-cerca-viva-1.webp' AS imagem, 'produtos-fotos/tesoura-cerca-viva-2.webp' AS imagem_2, 'produtos-fotos/tesoura-cerca-viva-3.webp' AS imagem_3
    UNION ALL
    SELECT 'poda' AS sub, 'Tesoura de Poda Manual' AS nome, 'tesoura-poda-manual' AS slug, 39.90 AS preco,
           'Tesoura de poda compacta, ideal para cortes finos em galhos pequenos, flores e hastes.' AS descricao,
           'Leve e de fácil manuseio, ótima para podas frequentes e de precisão.' AS beneficios,
           'Posicione a lâmina próxima à base do corte desejado e pressione o cabo com firmeza em um único movimento.' AS como_utilizar,
           'Mantenha as lâminas afiadas para evitar esmagar os galhos ao invés de cortá-los.' AS recomendacoes,
           'produtos-fotos/tesoura-poda-manual-1.webp' AS imagem, 'produtos-fotos/tesoura-poda-manual-2.webp' AS imagem_2, 'produtos-fotos/tesoura-poda-manual-3.webp' AS imagem_3
    UNION ALL
    SELECT 'ferramentas-manuais' AS sub, 'Enxada de Jardinagem' AS nome, 'enxada-jardinagem' AS slug, 49.90 AS preco,
           'Enxada de tamanho reduzido, própria para revolver a terra e abrir covas em vasos e canteiros.' AS descricao,
           'Facilita o preparo do solo antes do plantio, soltando a terra compactada.' AS beneficios,
           'Segure firme pelo cabo e faça movimentos curtos, cavando a profundidade necessária para o plantio.' AS como_utilizar,
           'Use antes de adubar o solo, para que o adubo se distribua melhor entre as camadas de terra.' AS recomendacoes,
           'produtos-fotos/enxada-jardinagem-1.webp' AS imagem, 'produtos-fotos/enxada-jardinagem-2.webp' AS imagem_2, 'produtos-fotos/enxada-jardinagem-3.webp' AS imagem_3
    UNION ALL
    SELECT 'ferramentas-manuais' AS sub, 'Rastelo de Jardim' AS nome, 'rastelo-jardim' AS slug, 44.90 AS preco,
           'Rastelo com dentes espaçados, usado para nivelar terra, remover folhas secas e detritos do jardim.' AS descricao,
           'Agiliza a limpeza de canteiros e gramados, juntando folhas e resíduos com poucos movimentos.' AS beneficios,
           'Passe o rastelo sobre a superfície com movimentos firmes, juntando os detritos em um único ponto.' AS como_utilizar,
           'Use também para nivelar a terra antes de semear grama ou plantar mudas.' AS recomendacoes,
           'produtos-fotos/rastelo-jardim-1.webp' AS imagem, 'produtos-fotos/rastelo-jardim-2.webp' AS imagem_2, 'produtos-fotos/rastelo-jardim-3.webp' AS imagem_3
    UNION ALL
    SELECT 'ferramentas-manuais' AS sub, 'Garfo de Jardinagem' AS nome, 'garfo-jardinagem' AS slug, 42.90 AS preco,
           'Garfo de mão com dentes resistentes, ideal para soltar e arejar a terra em vasos e canteiros pequenos.' AS descricao,
           'Areja o solo sem revirar completamente a terra, preservando as raízes das plantas ao redor.' AS beneficios,
           'Insira os dentes na terra e faça um movimento leve de vai-e-vem para soltar o substrato compactado.' AS como_utilizar,
           'Use antes da adubação para que os nutrientes penetrem mais facilmente no solo.' AS recomendacoes,
           'produtos-fotos/garfo-jardinagem-1.webp' AS imagem, 'produtos-fotos/garfo-jardinagem-2.webp' AS imagem_2, 'produtos-fotos/garfo-jardinagem-3.webp' AS imagem_3
    UNION ALL
    SELECT 'ferramentas-manuais' AS sub, 'Ancinho de Mão' AS nome, 'ancinho-de-mao' AS slug, 24.90 AS preco,
           'Ancinho de mão compacto, próprio para pequenas áreas e vasos, útil para remover ervas daninhas superficiais.' AS descricao,
           'Tamanho reduzido que facilita o trabalho em espaços apertados, como jardineiras e vasos grandes.' AS beneficios,
           'Passe levemente sobre a superfície do substrato para remover folhas secas e pequenas ervas daninhas.' AS como_utilizar,
           'Ideal para manutenção semanal de jardineiras e vasos decorativos.' AS recomendacoes,
           'produtos-fotos/ancinho-de-mao-1.webp' AS imagem, 'produtos-fotos/ancinho-de-mao-2.webp' AS imagem_2, 'produtos-fotos/ancinho-de-mao-3.webp' AS imagem_3
    UNION ALL
    SELECT 'ferramentas-manuais' AS sub, 'Cultivador Manual' AS nome, 'cultivador-manual' AS slug, 22.90 AS preco,
           'Cultivador com três dentes curvos, usado para arejar e misturar adubo à terra em pequenas áreas.' AS descricao,
           'Facilita a incorporação de adubo e compostos ao solo sem esforço excessivo.' AS beneficios,
           'Insira os dentes no substrato e gire levemente o cabo para misturar a terra com o adubo aplicado.' AS como_utilizar,
           'Use com cuidado próximo às raízes para não danificar plantas já estabelecidas.' AS recomendacoes,
           'produtos-fotos/cultivador-manual-1.webp' AS imagem, 'produtos-fotos/cultivador-manual-2.webp' AS imagem_2, 'produtos-fotos/cultivador-manual-3.webp' AS imagem_3
    UNION ALL
    SELECT 'ferramentas-manuais' AS sub, 'Plantador Manual' AS nome, 'plantador-manual' AS slug, 19.90 AS preco,
           'Plantador de bico cônico, feito para abrir pequenas covas destinadas a mudas, bulbos e sementes.' AS descricao,
           'Torna o plantio de mudas e bulbos mais rápido e organizado, com covas de tamanho uniforme.' AS beneficios,
           'Pressione o plantador na terra em movimento giratório até atingir a profundidade desejada para a muda ou bulbo.' AS como_utilizar,
           'Ideal para o plantio de bulbos de flores, que exigem profundidade regular.' AS recomendacoes,
           'produtos-fotos/plantador-manual-1.webp' AS imagem, 'produtos-fotos/plantador-manual-2.webp' AS imagem_2, 'produtos-fotos/plantador-manual-3.webp' AS imagem_3
    UNION ALL
    SELECT 'ferramentas-manuais' AS sub, 'Sacho de Jardinagem' AS nome, 'sacho-jardinagem' AS slug, 21.90 AS preco,
           'Sacho de mão com lâmina curva, usado para capinar e remover ervas daninhas próximas às plantas.' AS descricao,
           'Remove ervas daninhas pela raiz sem precisar se ajoelhar para arrancá-las à mão.' AS beneficios,
           'Deslize a lâmina rente ao solo, na base da erva daninha, e puxe para desenraizá-la.' AS como_utilizar,
           'Use com cuidado próximo a mudas jovens, mantendo distância segura das raízes principais.' AS recomendacoes,
           'produtos-fotos/sacho-jardinagem-1.webp' AS imagem, 'produtos-fotos/sacho-jardinagem-2.webp' AS imagem_2, 'produtos-fotos/sacho-jardinagem-3.webp' AS imagem_3
    UNION ALL
    SELECT 'acessorios' AS sub, 'Faca de Jardinagem' AS nome, 'faca-jardinagem' AS slug, 34.90 AS preco,
           'Faca multiuso para jardinagem, útil para dividir mudas, cortar barbantes e abrir sacos de substrato.' AS descricao,
           'Ferramenta versátil que substitui vários utensílios avulsos no dia a dia do jardim.' AS beneficios,
           'Utilize com cuidado para dividir touceiras de plantas ou cortar amarrações de tutores.' AS como_utilizar,
           'Guarde em local seco e mantenha a lâmina limpa após o contato com terra ou adubo.' AS recomendacoes,
           'produtos-fotos/faca-jardinagem-1.webp' AS imagem, 'produtos-fotos/faca-jardinagem-2.webp' AS imagem_2, 'produtos-fotos/faca-jardinagem-3.webp' AS imagem_3
    UNION ALL
    SELECT 'acessorios' AS sub, 'Joelheira para Jardinagem' AS nome, 'joelheira-jardinagem' AS slug, 29.90 AS preco,
           'Joelheira acolchoada, protege os joelhos durante atividades de jardinagem realizadas próximas ao solo.' AS descricao,
           'Reduz o desconforto e o impacto sobre os joelhos durante o plantio e a capina.' AS beneficios,
           'Ajuste as tiras de velcro ao redor do joelho antes de se ajoelhar para iniciar o trabalho no jardim.' AS como_utilizar,
           'Recomendada para sessões longas de jardinagem, especialmente em canteiros baixos.' AS recomendacoes,
           'produtos-fotos/joelheira-jardinagem-1.webp' AS imagem, 'produtos-fotos/joelheira-jardinagem-2.webp' AS imagem_2, 'produtos-fotos/joelheira-jardinagem-3.webp' AS imagem_3
  ) x;

-- ADUBOS
INSERT IGNORE INTO produtos (categoria_id, subcategoria_id, nome, slug, preco, descricao, beneficios, como_utilizar, recomendacoes, imagem)
SELECT (SELECT id FROM categorias WHERE slug = 'adubos'),
       (SELECT s.id FROM subcategorias s
          JOIN categorias c ON c.id = s.categoria_id
         WHERE c.slug = 'adubos' AND s.slug = x.sub),
       x.nome, x.slug, x.preco, x.descricao, x.beneficios, x.como_utilizar, x.recomendacoes, x.imagem
  FROM (
    SELECT 'organicos' AS sub, 'Torta de Mamona 1kg' AS nome, 'torta-mamona-1kg' AS slug, 24.90 AS preco,
           'Adubo orgânico derivado do resíduo da extração do óleo de mamona, rico em nitrogênio e nutrientes para o solo.' AS descricao,
           'Melhora a estrutura do solo e ainda ajuda a repelir alguns nematoides e insetos de solo.' AS beneficios,
           'Misture ao substrato na hora do plantio ou aplique em cobertura ao redor da planta, incorporando levemente à terra.' AS como_utilizar,
           'Evite o contato direto com raízes finas, pois a fermentação inicial pode gerar calor localizado.' AS recomendacoes,
           'catalogo/torta-mamona-1kg.svg' AS imagem
    UNION ALL
    SELECT 'organicos' AS sub, 'Composto Orgânico 10kg' AS nome, 'composto-organico-10kg' AS slug, 44.90 AS preco,
           'Composto orgânico curtido, resultado da decomposição de matéria vegetal, rico em nutrientes e microrganismos benéficos ao solo.' AS descricao,
           'Melhora a retenção de água e a estrutura do solo, favorecendo o desenvolvimento das raízes.' AS beneficios,
           'Incorpore ao solo antes do plantio ou use como cobertura, misturando levemente aos primeiros centímetros de terra.' AS como_utilizar,
           'Ideal para preparar canteiros e renovar o substrato de vasos maiores antes de uma nova estação de cultivo.' AS recomendacoes,
           'catalogo/composto-organico-10kg.svg' AS imagem
    UNION ALL
    SELECT 'organicos' AS sub, 'Bokashi 1kg' AS nome, 'bokashi-1kg' AS slug, 29.90 AS preco,
           'Adubo orgânico fermentado, produzido a partir de resíduos orgânicos por um processo de fermentação controlada, rico em microrganismos.' AS descricao,
           'Acelera a decomposição de matéria orgânica e enriquece o solo com microrganismos benéficos.' AS beneficios,
           'Aplique uma fina camada sobre o substrato e cubra levemente com terra, regando em seguida.' AS como_utilizar,
           'Pode ser usado em conjunto com composteiras domésticas para acelerar o processo de compostagem.' AS recomendacoes,
           'catalogo/bokashi-1kg.svg' AS imagem
    UNION ALL
    SELECT 'organicos' AS sub, 'Esterco Bovino Curtido 5kg' AS nome, 'esterco-bovino-curtido-5kg' AS slug, 26.90 AS preco,
           'Esterco bovino já curtido, livre do odor forte do esterco fresco, pronto para uso direto no solo.' AS descricao,
           'Fonte tradicional e econômica de matéria orgânica, melhorando a fertilidade do solo a longo prazo.' AS beneficios,
           'Misture ao substrato na proporção de uma parte de esterco para três partes de terra antes do plantio.' AS como_utilizar,
           'Por já estar curtido, pode ser aplicado diretamente, sem o período de espera exigido pelo esterco fresco.' AS recomendacoes,
           'catalogo/esterco-bovino-curtido-5kg.svg' AS imagem
    UNION ALL
    SELECT 'minerais-npk' AS sub, 'Fertilizante NPK 04-14-08' AS nome, 'fertilizante-npk-04-14-08' AS slug, 29.90 AS preco,
           'Fertilizante mineral com maior concentração de fósforo, formulado para estimular o enraizamento e a floração das plantas.' AS descricao,
           'Favorece o desenvolvimento de raízes fortes e estimula a formação de flores e frutos.' AS beneficios,
           'Aplique ao redor da planta, evitando contato direto com o caule, e regue bem em seguida para dissolver os grânulos.' AS como_utilizar,
           'Indicado no início do ciclo da planta ou antes da fase de floração.' AS recomendacoes,
           'catalogo/fertilizante-npk-04-14-08.svg' AS imagem
    UNION ALL
    SELECT 'minerais-npk' AS sub, 'Fertilizante NPK 20-05-20' AS nome, 'fertilizante-npk-20-05-20' AS slug, 29.90 AS preco,
           'Fertilizante mineral rico em nitrogênio e potássio, indicado para o crescimento vegetativo e fortalecimento geral da planta.' AS descricao,
           'Estimula o crescimento de folhas e caules, além de fortalecer a resistência da planta.' AS beneficios,
           'Dilua conforme a embalagem e aplique ao substrato durante a fase de crescimento ativo da planta.' AS como_utilizar,
           'Bom complemento para plantas de folhagem que exigem crescimento vigoroso.' AS recomendacoes,
           'catalogo/fertilizante-npk-20-05-20.svg' AS imagem
    UNION ALL
    SELECT 'minerais-npk' AS sub, 'Fertilizante NPK 15-15-15' AS nome, 'fertilizante-npk-15-15-15' AS slug, 27.90 AS preco,
           'Fertilizante mineral balanceado, com proporções iguais de nitrogênio, fósforo e potássio, indicado para manutenção geral.' AS descricao,
           'Fórmula equilibrada que atende às necessidades básicas da maioria das plantas de jardim.' AS beneficios,
           'Aplique a cada 30 dias ao redor da planta, incorporando levemente ao substrato e regando em seguida.' AS como_utilizar,
           'Boa opção para quem tem plantas variadas e prefere um único adubo de uso geral.' AS recomendacoes,
           'catalogo/fertilizante-npk-15-15-15.svg' AS imagem
    UNION ALL
    SELECT 'minerais-npk' AS sub, 'Fertilizante para Flores' AS nome, 'fertilizante-para-flores' AS slug, 32.90 AS preco,
           'Fertilizante formulado especialmente para plantas floríferas, com maior teor de fósforo e potássio para estimular a floração.' AS descricao,
           'Aumenta a quantidade e a durabilidade das flores, deixando as cores mais vivas.' AS beneficios,
           'Aplique durante o período de formação dos botões florais, seguindo a dosagem indicada na embalagem.' AS como_utilizar,
           'Combine com regas regulares para potencializar o efeito na floração.' AS recomendacoes,
           'catalogo/fertilizante-para-flores.svg' AS imagem
    UNION ALL
    SELECT 'minerais-npk' AS sub, 'Fertilizante para Folhagens' AS nome, 'fertilizante-para-folhagens' AS slug, 32.90 AS preco,
           'Fertilizante rico em nitrogênio, formulado para intensificar a cor e o vigor das folhas em plantas ornamentais de folhagem.' AS descricao,
           'Deixa as folhas mais verdes e viçosas, realçando o aspecto decorativo da planta.' AS beneficios,
           'Aplique a cada 20 a 30 dias na fase de crescimento ativo, seguindo a dosagem da embalagem.' AS como_utilizar,
           'Ideal para plantas cultivadas principalmente pela beleza da folhagem, como filodendros e calatheas.' AS recomendacoes,
           'catalogo/fertilizante-para-folhagens.svg' AS imagem
    UNION ALL
    SELECT 'fertilizantes-especificos' AS sub, 'Adubo para Orquídeas' AS nome, 'adubo-para-orquideas' AS slug, 27.90 AS preco,
           'Fertilizante formulado especialmente para orquídeas, com nutrientes balanceados para as necessidades específicas dessas plantas epífitas.' AS descricao,
           'Estimula floradas mais generosas e mantém as raízes aéreas saudáveis.' AS beneficios,
           'Dilua na água de rega uma vez por mês durante a fase de crescimento, evitando o excesso que pode queimar as raízes.' AS como_utilizar,
           'Reduza a aplicação durante o período de repouso da planta, após o fim da floração.' AS recomendacoes,
           'catalogo/adubo-para-orquideas.svg' AS imagem
    UNION ALL
    SELECT 'fertilizantes-especificos' AS sub, 'Fertilizante de Enraizamento' AS nome, 'fertilizante-enraizamento' AS slug, 34.90 AS preco,
           'Fertilizante rico em fósforo e enraizadores, indicado para estimular o desenvolvimento de raízes em mudas recém-plantadas ou transplantadas.' AS descricao,
           'Reduz o estresse do transplante e acelera a fixação das raízes no novo substrato.' AS beneficios,
           'Aplique diluído em água logo após o plantio ou transplante, regando na base da planta.' AS como_utilizar,
           'Use também ao propagar estacas e mudas, para estimular o enraizamento mais rápido.' AS recomendacoes,
           'catalogo/fertilizante-enraizamento.svg' AS imagem
    UNION ALL
    SELECT 'fertilizantes-especificos' AS sub, 'Adubo de Liberação Lenta' AS nome, 'adubo-liberacao-lenta' AS slug, 39.90 AS preco,
           'Fertilizante em grânulos de liberação lenta, que nutre a planta gradualmente ao longo de vários meses.' AS descricao,
           'Reduz a frequência de adubação, liberando nutrientes aos poucos conforme a necessidade da planta.' AS beneficios,
           'Aplique os grânulos na superfície do substrato uma única vez, conforme a periodicidade indicada na embalagem (geralmente de 3 a 6 meses).' AS como_utilizar,
           'Prática ideal para quem tem uma rotina corrida e não consegue adubar com frequência.' AS recomendacoes,
           'catalogo/adubo-liberacao-lenta.svg' AS imagem
    UNION ALL
    SELECT 'corretivos-complementos' AS sub, 'Calcário Dolomítico 2kg' AS nome, 'calcario-dolomitico-2kg' AS slug, 17.90 AS preco,
           'Corretivo de solo usado para elevar o pH de solos ácidos, fornecendo também cálcio e magnésio às plantas.' AS descricao,
           'Corrige a acidez do solo, melhorando a absorção de nutrientes pelas raízes.' AS beneficios,
           'Incorpore ao solo algumas semanas antes do plantio, misturando bem às camadas superficiais da terra.' AS como_utilizar,
           'Recomendado antes de iniciar um novo canteiro ou renovar o substrato de vasos grandes.' AS recomendacoes,
           'catalogo/calcario-dolomitico-2kg.svg' AS imagem
    UNION ALL
    SELECT 'corretivos-complementos' AS sub, 'Gesso Agrícola 2kg' AS nome, 'gesso-agricola-2kg' AS slug, 18.90 AS preco,
           'Corretivo de solo que fornece cálcio e enxofre, além de ajudar a neutralizar o alumínio tóxico em solos compactados.' AS descricao,
           'Melhora a estrutura de solos compactados, facilitando o aprofundamento das raízes.' AS beneficios,
           'Aplique em cobertura e incorpore levemente ao solo, regando bem em seguida.' AS como_utilizar,
           'Pode ser usado em conjunto com o calcário dolomítico no preparo do solo.' AS recomendacoes,
           'catalogo/gesso-agricola-2kg.svg' AS imagem
    UNION ALL
    SELECT 'corretivos-complementos' AS sub, 'Carvão Vegetal para Plantas' AS nome, 'carvao-vegetal-plantas' AS slug, 21.90 AS preco,
           'Carvão vegetal triturado, usado como componente de substrato para melhorar a drenagem e a aeração das raízes.' AS descricao,
           'Absorve o excesso de umidade e ajuda a prevenir o apodrecimento das raízes.' AS beneficios,
           'Misture ao substrato na proporção de uma parte de carvão para dez partes de terra, especialmente em vasos sem boa drenagem.' AS como_utilizar,
           'Muito usado no cultivo de orquídeas e suculentas, que exigem substrato leve e bem drenado.' AS recomendacoes,
           'catalogo/carvao-vegetal-plantas.svg' AS imagem
    UNION ALL
    SELECT 'corretivos-complementos' AS sub, 'Substrato para Plantas' AS nome, 'substrato-para-plantas' AS slug, 24.90 AS preco,
           'Substrato pronto para uso, formulado com uma mistura balanceada de terra, matéria orgânica e materiais de drenagem.' AS descricao,
           'Já vem pronto para o plantio, economizando o trabalho de preparar a mistura manualmente.' AS beneficios,
           'Preencha o vaso com o substrato, deixando um espaço de 2 a 3 cm da borda antes de posicionar a muda.' AS como_utilizar,
           'Complemente com adubo de liberação lenta no momento do plantio para nutrir a planta nos primeiros meses.' AS recomendacoes,
           'catalogo/substrato-para-plantas.svg' AS imagem
    UNION ALL
    SELECT 'corretivos-complementos' AS sub, 'Substrato para Orquídeas' AS nome, 'substrato-para-orquideas' AS slug, 27.90 AS preco,
           'Substrato específico para orquídeas, composto por casca de pinus e outros materiais que garantem boa aeração às raízes.' AS descricao,
           'Reproduz as condições naturais de aeração que as orquídeas encontram em seu habitat original.' AS beneficios,
           'Preencha o vaso vazando bem entre as raízes, sem compactar, e regue por imersão semanalmente.' AS como_utilizar,
           'Troque o substrato a cada 1 ou 2 anos, quando começar a se decompor e perder a capacidade de drenagem.' AS recomendacoes,
           'catalogo/substrato-para-orquideas.svg' AS imagem
  ) x;

-- CONTROLE DE PRAGAS
INSERT IGNORE INTO produtos (categoria_id, subcategoria_id, nome, slug, preco, descricao, beneficios, como_utilizar, recomendacoes, imagem)
SELECT (SELECT id FROM categorias WHERE slug = 'controle-pragas'),
       (SELECT s.id FROM subcategorias s
          JOIN categorias c ON c.id = s.categoria_id
         WHERE c.slug = 'controle-pragas' AND s.slug = x.sub),
       x.nome, x.slug, x.preco, x.descricao, x.beneficios, x.como_utilizar, x.recomendacoes, x.imagem
  FROM (
    SELECT 'prevencao' AS sub, 'Armadilha para Mosca-Branca' AS nome, 'armadilha-mosca-branca' AS slug, 19.90 AS preco,
           'Placa adesiva amarela específica para monitoramento e captura de moscas-brancas, praga comum em hortas e plantas ornamentais.' AS descricao,
           'Ajuda a identificar a presença da praga precocemente, antes que a infestação se espalhe.' AS beneficios,
           'Pendure a placa próxima às plantas afetadas, na altura das folhas, e substitua quando estiver coberta de insetos.' AS como_utilizar,
           'Use em conjunto com o monitoramento visual das folhas para um controle mais eficaz.' AS recomendacoes,
           'catalogo/armadilha-mosca-branca.svg' AS imagem
    UNION ALL
    SELECT 'prevencao' AS sub, 'Armadilha para Mosquitos' AS nome, 'armadilha-mosquitos' AS slug, 22.90 AS preco,
           'Armadilha adesiva voltada para captura de mosquitos e pequenos insetos voadores ao redor de plantas e jardins.' AS descricao,
           'Reduz a presença de insetos voadores incômodos sem o uso de produtos químicos.' AS beneficios,
           'Posicione a armadilha próxima a áreas de maior circulação de insetos, como perto de água parada ou vasos.' AS como_utilizar,
           'Combine com a eliminação de água parada nos pratos dos vasos para reduzir a proliferação.' AS recomendacoes,
           'catalogo/armadilha-mosquitos.svg' AS imagem
    UNION ALL
    SELECT 'prevencao' AS sub, 'Repelente Natural para Formigas' AS nome, 'repelente-natural-formigas' AS slug, 27.90 AS preco,
           'Repelente à base de extratos naturais, formulado para afastar formigas de vasos, canteiros e áreas próximas às plantas.' AS descricao,
           'Alternativa natural aos formicidas convencionais, mais segura para uso próximo a crianças e animais domésticos.' AS beneficios,
           'Aplique ao redor da base da planta e nas trilhas de formigas identificadas, reaplicando após chuva ou rega.' AS como_utilizar,
           'Reaplique semanalmente em locais com infestação recorrente, até o afastamento completo das formigas.' AS recomendacoes,
           'catalogo/repelente-natural-formigas.svg' AS imagem
    UNION ALL
    SELECT 'tratamento' AS sub, 'Inseticida Natural para Plantas' AS nome, 'inseticida-natural-plantas' AS slug, 33.90 AS preco,
           'Inseticida à base de ingredientes naturais, formulado para o controle de insetos comuns em plantas ornamentais e hortaliças.' AS descricao,
           'Controla a infestação sem deixar resíduos agressivos nas folhas ou frutos.' AS beneficios,
           'Pulverize sobre toda a planta, incluindo a face inferior das folhas, preferencialmente ao entardecer.' AS como_utilizar,
           'Repita a aplicação a cada 7 dias até a eliminação completa da infestação.' AS recomendacoes,
           'catalogo/inseticida-natural-plantas.svg' AS imagem
    UNION ALL
    SELECT 'tratamento' AS sub, 'Fungicida à Base de Cobre' AS nome, 'fungicida-base-cobre' AS slug, 31.90 AS preco,
           'Fungicida à base de cobre, tradicional no controle preventivo e curativo de diversas doenças fúngicas em plantas.' AS descricao,
           'Amplo espectro de ação contra fungos e bactérias que afetam folhas, caules e frutos.' AS beneficios,
           'Dilua conforme a embalagem e pulverize sobre a planta, cobrindo bem toda a folhagem afetada.' AS como_utilizar,
           'Evite aplicar em dias de sol forte ou chuva prevista, para não reduzir a eficácia do produto.' AS recomendacoes,
           'catalogo/fungicida-base-cobre.svg' AS imagem
    UNION ALL
    SELECT 'tratamento' AS sub, 'Controle Natural de Cochonilhas' AS nome, 'controle-natural-cochonilhas' AS slug, 29.90 AS preco,
           'Produto natural formulado especificamente para o controle de cochonilhas, praga comum em plantas de folhas grossas.' AS descricao,
           'Age diretamente sobre a carapaça protetora do inseto, facilitando sua eliminação.' AS beneficios,
           'Aplique diretamente sobre as cochonilhas visíveis, cobrindo bem as folhas e o caule da planta afetada.' AS como_utilizar,
           'Remova manualmente as cochonilhas mais visíveis antes da aplicação, para potencializar o efeito do produto.' AS recomendacoes,
           'catalogo/controle-natural-cochonilhas.svg' AS imagem
    UNION ALL
    SELECT 'tratamento' AS sub, 'Tratamento para Ácaros' AS nome, 'tratamento-para-acaros' AS slug, 32.90 AS preco,
           'Acaricida natural indicado para o controle de ácaros, praga microscópica que causa manchas e amarelamento nas folhas.' AS descricao,
           'Combate os ácaros nas diferentes fases do seu ciclo de vida, reduzindo reinfestações.' AS beneficios,
           'Pulverize sobre toda a planta, com atenção especial à face inferior das folhas, onde os ácaros costumam se concentrar.' AS como_utilizar,
           'Aumente a umidade do ambiente, já que os ácaros se proliferam mais em condições secas.' AS recomendacoes,
           'catalogo/tratamento-para-acaros.svg' AS imagem
    UNION ALL
    SELECT 'pragas-especificas' AS sub, 'Controle de Lesmas e Caracóis' AS nome, 'controle-lesmas-caracois' AS slug, 24.90 AS preco,
           'Produto granulado formulado para o controle de lesmas e caracóis, que danificam folhas e mudas jovens durante a noite.' AS descricao,
           'Protege mudas recém-plantadas, especialmente vulneráveis ao ataque desses moluscos.' AS beneficios,
           'Distribua os grânulos ao redor da base das plantas afetadas, especialmente em dias úmidos ou após a chuva.' AS como_utilizar,
           'Reaplique após regas fortes ou chuva, já que o produto pode perder eficácia com o excesso de água.' AS recomendacoes,
           'catalogo/controle-lesmas-caracois.svg' AS imagem
    UNION ALL
    SELECT 'pragas-especificas' AS sub, 'Armadilha para Cochonilhas' AS nome, 'armadilha-cochonilhas' AS slug, 21.90 AS preco,
           'Armadilha adesiva voltada para o monitoramento de cochonilhas e outros insetos de corpo mole próximos às plantas.' AS descricao,
           'Facilita a identificação precoce da praga antes que ela se espalhe para outras plantas.' AS beneficios,
           'Posicione próximo às plantas com histórico de cochonilhas e verifique semanalmente.' AS como_utilizar,
           'Use como complemento ao controle natural de cochonilhas, não como tratamento principal.' AS recomendacoes,
           'catalogo/armadilha-cochonilhas.svg' AS imagem
    UNION ALL
    SELECT 'pragas-especificas' AS sub, 'Solução Natural contra Lagartas' AS nome, 'solucao-natural-lagartas' AS slug, 28.90 AS preco,
           'Solução à base de ingredientes naturais, formulada para o controle de lagartas que atacam folhas de hortaliças e ornamentais.' AS descricao,
           'Interrompe a alimentação das lagartas sem afetar insetos benéficos como abelhas e joaninhas.' AS beneficios,
           'Pulverize diretamente sobre as folhas afetadas e ao redor da planta, preferencialmente no fim da tarde.' AS como_utilizar,
           'Inspecione regularmente a face inferior das folhas, onde as lagartas costumam se esconder durante o dia.' AS recomendacoes,
           'catalogo/solucao-natural-lagartas.svg' AS imagem
    UNION ALL
    SELECT 'pragas-especificas' AS sub, 'Controle de Trips' AS nome, 'controle-de-trips' AS slug, 30.90 AS preco,
           'Produto formulado para o controle de trips, pequenos insetos que causam manchas prateadas e deformações nas folhas e flores.' AS descricao,
           'Reduz a população de trips, prevenindo a transmissão de viroses associadas a essa praga.' AS beneficios,
           'Pulverize sobre toda a planta, com atenção especial aos brotos novos e botões florais, onde os trips se concentram.' AS como_utilizar,
           'Combine com armadilhas adesivas azuis para monitorar a reinfestação ao longo do tempo.' AS recomendacoes,
           'catalogo/controle-de-trips.svg' AS imagem
    UNION ALL
    SELECT 'pragas-especificas' AS sub, 'Controle de Mosca-Branca' AS nome, 'controle-mosca-branca' AS slug, 26.90 AS preco,
           'Produto de combate direto à mosca-branca já instalada na plantação, complementando o monitoramento feito por armadilhas.' AS descricao,
           'Atua diretamente sobre a praga já presente, reduzindo rapidamente a infestação ativa.' AS beneficios,
           'Pulverize sobre a face inferior das folhas, onde a mosca-branca costuma se concentrar e depositar ovos.' AS como_utilizar,
           'Combine com a armadilha adesiva de monitoramento para acompanhar a eficácia do tratamento.' AS recomendacoes,
           'catalogo/controle-mosca-branca.svg' AS imagem
    UNION ALL
    SELECT 'protecao-plantas' AS sub, 'Spray Antifúngico para Plantas' AS nome, 'spray-antifungico-plantas' AS slug, 29.90 AS preco,
           'Spray de ação preventiva, formulado para proteger as plantas contra o surgimento de doenças fúngicas antes que se instalem.' AS descricao,
           'Atua como barreira preventiva, reduzindo a chance de novas infecções fúngicas na folhagem.' AS beneficios,
           'Pulverize preventivamente sobre toda a planta a cada 15 dias, especialmente em períodos de maior umidade.' AS como_utilizar,
           'Use como prevenção em plantas historicamente sensíveis a fungos, mesmo sem sintomas visíveis.' AS recomendacoes,
           'catalogo/spray-antifungico-plantas.svg' AS imagem
    UNION ALL
    SELECT 'protecao-plantas' AS sub, 'Protetor Natural para Folhagens' AS nome, 'protetor-natural-folhagens' AS slug, 26.90 AS preco,
           'Produto formulado para fortalecer e proteger a folhagem contra estresse ambiental e pequenos ataques de pragas.' AS descricao,
           'Fortalece a resistência natural da planta contra variações de temperatura e pragas leves.' AS beneficios,
           'Pulverize sobre as folhas a cada 20 dias, formando uma camada protetora natural sobre a superfície foliar.' AS como_utilizar,
           'Indicado principalmente para plantas recém-adquiridas, ainda em processo de adaptação ao novo ambiente.' AS recomendacoes,
           'catalogo/protetor-natural-folhagens.svg' AS imagem
    UNION ALL
    SELECT 'protecao-plantas' AS sub, 'Barreira Natural contra Insetos' AS nome, 'barreira-natural-insetos' AS slug, 23.90 AS preco,
           'Produto de barreira física e química, formulado para dificultar a aproximação de insetos às plantas protegidas.' AS descricao,
           'Cria uma camada de proteção duradoura, reduzindo a necessidade de aplicações frequentes de inseticida.' AS beneficios,
           'Aplique ao redor da base da planta e sobre o substrato, renovando a barreira a cada 30 dias.' AS como_utilizar,
           'Combine com boas práticas de higiene do jardim, como remoção de folhas secas, para potencializar o efeito.' AS recomendacoes,
           'catalogo/barreira-natural-insetos.svg' AS imagem
    UNION ALL
    SELECT 'protecao-plantas' AS sub, 'Protetor de Plantas contra Pragas' AS nome, 'protetor-plantas-contra-pragas' AS slug, 27.90 AS preco,
           'Produto de uso preventivo, formulado para reduzir a atratividade da planta a pragas comuns de jardim e horta.' AS descricao,
           'Reduz a incidência de novas infestações quando aplicado regularmente.' AS beneficios,
           'Pulverize sobre toda a planta a cada 15 a 20 dias, mesmo sem sinais visíveis de pragas.' AS como_utilizar,
           'Ideal para uso contínuo em hortas e jardins com histórico recorrente de pragas.' AS recomendacoes,
           'catalogo/protetor-plantas-contra-pragas.svg' AS imagem
    UNION ALL
    SELECT 'protecao-plantas' AS sub, 'Spray Protetor para Folhagens' AS nome, 'spray-protetor-folhagens' AS slug, 25.90 AS preco,
           'Spray de acabamento que forma uma fina camada protetora sobre as folhas, ajudando a repelir poeira e pequenos insetos.' AS descricao,
           'Deixa as folhas com brilho saudável e cria uma barreira leve contra poeira e pragas leves.' AS beneficios,
           'Aplique sobre as folhas limpas e secas, a uma distância de 20 cm, cobrindo toda a superfície foliar.' AS como_utilizar,
           'Evite aplicar sob sol forte direto, para não causar manchas na folhagem.' AS recomendacoes,
           'catalogo/spray-protetor-folhagens.svg' AS imagem
  ) x;

UPDATE produtos SET imagem = 'produtos-fotos/vaso-ceramica-rosa-1.webp', imagem_2 = 'produtos-fotos/vaso-ceramica-rosa-2.webp', imagem_3 = 'produtos-fotos/vaso-ceramica-rosa-3.webp' WHERE slug = 'vaso-ceramica-rosa';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-cimento-rustico-1.webp', imagem_2 = 'produtos-fotos/vaso-cimento-rustico-2.webp', imagem_3 = 'produtos-fotos/vaso-cimento-rustico-3.webp' WHERE slug = 'vaso-cimento-rustico';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-suspenso-macrame-1.webp', imagem_2 = 'produtos-fotos/vaso-suspenso-macrame-2.webp', imagem_3 = 'produtos-fotos/vaso-suspenso-macrame-3.webp' WHERE slug = 'vaso-suspenso-macrame';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-vidro-transparente-1.webp', imagem_2 = 'produtos-fotos/vaso-vidro-transparente-2.webp', imagem_3 = 'produtos-fotos/vaso-vidro-transparente-3.webp' WHERE slug = 'vaso-vidro-transparente';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-concreto-geometrico-1.webp', imagem_2 = 'produtos-fotos/vaso-concreto-geometrico-2.webp', imagem_3 = 'produtos-fotos/vaso-concreto-geometrico-3.webp' WHERE slug = 'vaso-concreto-geometrico';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-ceramica-azul-1.webp', imagem_2 = 'produtos-fotos/vaso-ceramica-azul-2.webp', imagem_3 = 'produtos-fotos/vaso-ceramica-azul-3.webp' WHERE slug = 'vaso-ceramica-azul';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-barro-tradicional-1.webp', imagem_2 = 'produtos-fotos/vaso-barro-tradicional-2.webp', imagem_3 = 'produtos-fotos/vaso-barro-tradicional-3.webp' WHERE slug = 'vaso-barro-tradicional';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-barro-artesanal-1.webp', imagem_2 = 'produtos-fotos/vaso-barro-artesanal-2.webp', imagem_3 = 'produtos-fotos/vaso-barro-artesanal-3.webp' WHERE slug = 'vaso-barro-artesanal';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-esmaltado-1.webp', imagem_2 = 'produtos-fotos/vaso-esmaltado-2.webp', imagem_3 = 'produtos-fotos/vaso-esmaltado-3.webp' WHERE slug = 'vaso-esmaltado';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-ceramica-decorado-1.webp', imagem_2 = 'produtos-fotos/vaso-ceramica-decorado-2.webp', imagem_3 = 'produtos-fotos/vaso-ceramica-decorado-3.webp' WHERE slug = 'vaso-ceramica-decorado';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-geometrico-1.webp', imagem_2 = 'produtos-fotos/vaso-geometrico-2.webp', imagem_3 = 'produtos-fotos/vaso-geometrico-3.webp' WHERE slug = 'vaso-geometrico';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-minimalista-1.webp', imagem_2 = 'produtos-fotos/vaso-minimalista-2.webp', imagem_3 = 'produtos-fotos/vaso-minimalista-3.webp' WHERE slug = 'vaso-minimalista';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-autoirrigavel-transparente-1.webp', imagem_2 = 'produtos-fotos/vaso-autoirrigavel-transparente-2.webp', imagem_3 = 'produtos-fotos/vaso-autoirrigavel-transparente-3.webp' WHERE slug = 'vaso-autoirrigavel-transparente';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-ceramica-branco-1.webp', imagem_2 = 'produtos-fotos/vaso-ceramica-branco-2.webp', imagem_3 = 'produtos-fotos/vaso-ceramica-branco-3.webp' WHERE slug = 'vaso-ceramica-branco';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-ceramica-terracota-1.webp', imagem_2 = 'produtos-fotos/vaso-ceramica-terracota-2.webp', imagem_3 = 'produtos-fotos/vaso-ceramica-terracota-3.webp' WHERE slug = 'vaso-ceramica-terracota';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-cimento-redondo-1.webp', imagem_2 = 'produtos-fotos/vaso-cimento-redondo-2.webp', imagem_3 = 'produtos-fotos/vaso-cimento-redondo-3.webp' WHERE slug = 'vaso-cimento-redondo';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-cimento-alto-1.webp', imagem_2 = 'produtos-fotos/vaso-cimento-alto-2.webp', imagem_3 = 'produtos-fotos/vaso-cimento-alto-3.webp' WHERE slug = 'vaso-cimento-alto';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-vidro-ambar-1.webp', imagem_2 = 'produtos-fotos/vaso-vidro-ambar-2.webp', imagem_3 = 'produtos-fotos/vaso-vidro-ambar-3.webp' WHERE slug = 'vaso-vidro-ambar';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-vidro-canelado-1.webp', imagem_2 = 'produtos-fotos/vaso-vidro-canelado-2.webp', imagem_3 = 'produtos-fotos/vaso-vidro-canelado-3.webp' WHERE slug = 'vaso-vidro-canelado';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-vidro-redondo-1.webp', imagem_2 = 'produtos-fotos/vaso-vidro-redondo-2.webp', imagem_3 = 'produtos-fotos/vaso-vidro-redondo-3.webp' WHERE slug = 'vaso-vidro-redondo';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-vidro-decorativo-1.webp', imagem_2 = 'produtos-fotos/vaso-vidro-decorativo-2.webp', imagem_3 = 'produtos-fotos/vaso-vidro-decorativo-3.webp' WHERE slug = 'vaso-vidro-decorativo';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-autoirrigavel-ceramica-1.webp', imagem_2 = 'produtos-fotos/vaso-autoirrigavel-ceramica-2.webp', imagem_3 = 'produtos-fotos/vaso-autoirrigavel-ceramica-3.webp' WHERE slug = 'vaso-autoirrigavel-ceramica';
UPDATE produtos SET imagem = 'produtos-fotos/vaso-decorativo-marrom-1.webp', imagem_2 = 'produtos-fotos/vaso-decorativo-marrom-2.webp', imagem_3 = 'produtos-fotos/vaso-decorativo-marrom-3.webp' WHERE slug = 'vaso-decorativo-marrom';
UPDATE produtos SET imagem = 'produtos-fotos/pa-jardinagem-manual-1.webp', imagem_2 = 'produtos-fotos/pa-jardinagem-manual-2.webp', imagem_3 = 'produtos-fotos/pa-jardinagem-manual-3.webp' WHERE slug = 'pa-jardinagem-manual';
UPDATE produtos SET imagem = 'produtos-fotos/regador-metal-5l-1.webp', imagem_2 = 'produtos-fotos/regador-metal-5l-2.webp', imagem_3 = 'produtos-fotos/regador-metal-5l-3.webp' WHERE slug = 'regador-metal-5l';
UPDATE produtos SET imagem = 'produtos-fotos/tesoura-poda-profissional-1.webp', imagem_2 = 'produtos-fotos/tesoura-poda-profissional-2.webp', imagem_3 = 'produtos-fotos/tesoura-poda-profissional-3.webp' WHERE slug = 'tesoura-poda-profissional';
UPDATE produtos SET imagem = 'produtos-fotos/kit-ferramentas-jardim-1.png', imagem_2 = 'produtos-fotos/kit-ferramentas-jardim-2.webp', imagem_3 = 'produtos-fotos/kit-ferramentas-jardim-3.webp' WHERE slug = 'kit-ferramentas-jardim';
UPDATE produtos SET imagem = 'produtos-fotos/luvas-jardinagem-reforcadas-1.webp', imagem_2 = 'produtos-fotos/luvas-jardinagem-reforcadas-2.webp', imagem_3 = 'produtos-fotos/luvas-jardinagem-reforcadas-3.webp' WHERE slug = 'luvas-jardinagem-reforcadas';
UPDATE produtos SET imagem = 'produtos-fotos/carrinho-mao-jardim-1.webp', imagem_2 = 'produtos-fotos/carrinho-mao-jardim-2.webp', imagem_3 = 'produtos-fotos/carrinho-mao-jardim-3.webp' WHERE slug = 'carrinho-mao-jardim';
UPDATE produtos SET imagem = 'produtos-fotos/mangueira-jardim-15m-1.webp', imagem_2 = 'produtos-fotos/mangueira-jardim-15m-2.webp', imagem_3 = 'produtos-fotos/mangueira-jardim-15m-3.webp' WHERE slug = 'mangueira-jardim-15m';
UPDATE produtos SET imagem = 'produtos-fotos/esguicho-regulavel-mangueira-1.webp', imagem_2 = 'produtos-fotos/esguicho-regulavel-mangueira-2.webp', imagem_3 = 'produtos-fotos/esguicho-regulavel-mangueira-3.webp' WHERE slug = 'esguicho-regulavel-mangueira';
UPDATE produtos SET imagem = 'produtos-fotos/aspersor-jardim-1.webp', imagem_2 = 'produtos-fotos/aspersor-jardim-2.webp', imagem_3 = 'produtos-fotos/aspersor-jardim-3.webp' WHERE slug = 'aspersor-jardim';
UPDATE produtos SET imagem = 'produtos-fotos/regador-plastico-10l-1.webp', imagem_2 = 'produtos-fotos/regador-plastico-10l-2.webp', imagem_3 = 'produtos-fotos/regador-plastico-10l-3.webp' WHERE slug = 'regador-plastico-10l';
UPDATE produtos SET imagem = 'produtos-fotos/serrote-de-poda-1.webp', imagem_2 = 'produtos-fotos/serrote-de-poda-2.webp', imagem_3 = 'produtos-fotos/serrote-de-poda-3.webp' WHERE slug = 'serrote-de-poda';
UPDATE produtos SET imagem = 'produtos-fotos/podao-de-jardim-1.webp', imagem_2 = 'produtos-fotos/podao-de-jardim-2.webp', imagem_3 = 'produtos-fotos/podao-de-jardim-3.webp' WHERE slug = 'podao-de-jardim';
UPDATE produtos SET imagem = 'produtos-fotos/tesoura-cerca-viva-1.webp', imagem_2 = 'produtos-fotos/tesoura-cerca-viva-2.webp', imagem_3 = 'produtos-fotos/tesoura-cerca-viva-3.webp' WHERE slug = 'tesoura-cerca-viva';
UPDATE produtos SET imagem = 'produtos-fotos/tesoura-poda-manual-1.webp', imagem_2 = 'produtos-fotos/tesoura-poda-manual-2.webp', imagem_3 = 'produtos-fotos/tesoura-poda-manual-3.webp' WHERE slug = 'tesoura-poda-manual';
UPDATE produtos SET imagem = 'produtos-fotos/enxada-jardinagem-1.webp', imagem_2 = 'produtos-fotos/enxada-jardinagem-2.webp', imagem_3 = 'produtos-fotos/enxada-jardinagem-3.webp' WHERE slug = 'enxada-jardinagem';
UPDATE produtos SET imagem = 'produtos-fotos/rastelo-jardim-1.webp', imagem_2 = 'produtos-fotos/rastelo-jardim-2.webp', imagem_3 = 'produtos-fotos/rastelo-jardim-3.webp' WHERE slug = 'rastelo-jardim';
UPDATE produtos SET imagem = 'produtos-fotos/garfo-jardinagem-1.webp', imagem_2 = 'produtos-fotos/garfo-jardinagem-2.webp', imagem_3 = 'produtos-fotos/garfo-jardinagem-3.webp' WHERE slug = 'garfo-jardinagem';
UPDATE produtos SET imagem = 'produtos-fotos/ancinho-de-mao-1.webp', imagem_2 = 'produtos-fotos/ancinho-de-mao-2.webp', imagem_3 = 'produtos-fotos/ancinho-de-mao-3.webp' WHERE slug = 'ancinho-de-mao';
UPDATE produtos SET imagem = 'produtos-fotos/cultivador-manual-1.webp', imagem_2 = 'produtos-fotos/cultivador-manual-2.webp', imagem_3 = 'produtos-fotos/cultivador-manual-3.webp' WHERE slug = 'cultivador-manual';
UPDATE produtos SET imagem = 'produtos-fotos/plantador-manual-1.webp', imagem_2 = 'produtos-fotos/plantador-manual-2.webp', imagem_3 = 'produtos-fotos/plantador-manual-3.webp' WHERE slug = 'plantador-manual';
UPDATE produtos SET imagem = 'produtos-fotos/sacho-jardinagem-1.webp', imagem_2 = 'produtos-fotos/sacho-jardinagem-2.webp', imagem_3 = 'produtos-fotos/sacho-jardinagem-3.webp' WHERE slug = 'sacho-jardinagem';
UPDATE produtos SET imagem = 'produtos-fotos/faca-jardinagem-1.webp', imagem_2 = 'produtos-fotos/faca-jardinagem-2.webp', imagem_3 = 'produtos-fotos/faca-jardinagem-3.webp' WHERE slug = 'faca-jardinagem';
UPDATE produtos SET imagem = 'produtos-fotos/joelheira-jardinagem-1.webp', imagem_2 = 'produtos-fotos/joelheira-jardinagem-2.webp', imagem_3 = 'produtos-fotos/joelheira-jardinagem-3.webp' WHERE slug = 'joelheira-jardinagem';

UPDATE produtos SET imagem = 'produtos-fotos/torta-mamona-1kg-1.webp', imagem_2 = 'produtos-fotos/torta-mamona-1kg-2.webp', imagem_3 = 'produtos-fotos/torta-mamona-1kg-3.webp' WHERE slug = 'torta-mamona-1kg';
UPDATE produtos SET imagem = 'produtos-fotos/composto-organico-10kg-1.webp', imagem_2 = 'produtos-fotos/composto-organico-10kg-2.webp', imagem_3 = 'produtos-fotos/composto-organico-10kg-3.webp' WHERE slug = 'composto-organico-10kg';
UPDATE produtos SET imagem = 'produtos-fotos/bokashi-1kg-1.webp', imagem_2 = 'produtos-fotos/bokashi-1kg-2.webp', imagem_3 = 'produtos-fotos/bokashi-1kg-3.webp' WHERE slug = 'bokashi-1kg';
UPDATE produtos SET imagem = 'produtos-fotos/esterco-bovino-curtido-5kg-1.webp', imagem_2 = 'produtos-fotos/esterco-bovino-curtido-5kg-2.webp' WHERE slug = 'esterco-bovino-curtido-5kg';
UPDATE produtos SET imagem = 'produtos-fotos/fertilizante-npk-04-14-08-1.webp', imagem_2 = 'produtos-fotos/fertilizante-npk-04-14-08-2.webp' WHERE slug = 'fertilizante-npk-04-14-08';
UPDATE produtos SET imagem = 'produtos-fotos/fertilizante-npk-20-05-20-1.webp', imagem_2 = 'produtos-fotos/fertilizante-npk-20-05-20-2.webp' WHERE slug = 'fertilizante-npk-20-05-20';
UPDATE produtos SET imagem = 'produtos-fotos/fertilizante-npk-15-15-15-1.webp', imagem_2 = 'produtos-fotos/fertilizante-npk-15-15-15-2.webp' WHERE slug = 'fertilizante-npk-15-15-15';
UPDATE produtos SET imagem = 'produtos-fotos/adubo-para-orquideas-1.webp', imagem_2 = 'produtos-fotos/adubo-para-orquideas-2.webp', imagem_3 = 'produtos-fotos/adubo-para-orquideas-3.webp' WHERE slug = 'adubo-para-orquideas';
UPDATE produtos SET imagem = 'produtos-fotos/fertilizante-enraizamento-1.webp', imagem_2 = 'produtos-fotos/fertilizante-enraizamento-2.webp', imagem_3 = 'produtos-fotos/fertilizante-enraizamento-3.webp' WHERE slug = 'fertilizante-enraizamento';
UPDATE produtos SET imagem = 'produtos-fotos/adubo-liberacao-lenta-1.webp', imagem_2 = 'produtos-fotos/adubo-liberacao-lenta-2.webp' WHERE slug = 'adubo-liberacao-lenta';
UPDATE produtos SET imagem = 'produtos-fotos/calcario-dolomitico-2kg-1.webp', imagem_2 = 'produtos-fotos/calcario-dolomitico-2kg-2.webp', imagem_3 = 'produtos-fotos/calcario-dolomitico-2kg-3.webp' WHERE slug = 'calcario-dolomitico-2kg';
UPDATE produtos SET imagem = 'produtos-fotos/carvao-vegetal-plantas-1.webp', imagem_2 = 'produtos-fotos/carvao-vegetal-plantas-2.webp', imagem_3 = 'produtos-fotos/carvao-vegetal-plantas-3.webp' WHERE slug = 'carvao-vegetal-plantas';
UPDATE produtos SET imagem = 'produtos-fotos/substrato-para-orquideas-1.webp', imagem_2 = 'produtos-fotos/substrato-para-orquideas-2.webp', imagem_3 = 'produtos-fotos/substrato-para-orquideas-3.webp' WHERE slug = 'substrato-para-orquideas';
UPDATE produtos SET imagem = 'produtos-fotos/adubo-organico-composto-5kg-1.webp', imagem_2 = 'produtos-fotos/adubo-organico-composto-5kg-2.webp', imagem_3 = 'produtos-fotos/adubo-organico-composto-5kg-3.webp' WHERE slug = 'adubo-organico-composto-5kg';
UPDATE produtos SET imagem = 'produtos-fotos/fertilizante-npk-10-10-10-1.webp', imagem_2 = 'produtos-fotos/fertilizante-npk-10-10-10-2.webp', imagem_3 = 'produtos-fotos/fertilizante-npk-10-10-10-3.webp' WHERE slug = 'fertilizante-npk-10-10-10';
UPDATE produtos SET imagem = 'produtos-fotos/humus-minhoca-2kg-1.webp', imagem_2 = 'produtos-fotos/humus-minhoca-2kg-2.webp', imagem_3 = 'produtos-fotos/humus-minhoca-2kg-3.webp' WHERE slug = 'humus-minhoca-2kg';
UPDATE produtos SET imagem = 'produtos-fotos/farinha-de-osso-1kg-1.webp', imagem_2 = 'produtos-fotos/farinha-de-osso-1kg-2.webp', imagem_3 = 'produtos-fotos/farinha-de-osso-1kg-3.webp' WHERE slug = 'farinha-de-osso-1kg';
UPDATE produtos SET imagem = 'produtos-fotos/fertilizante-liquido-multiuso-1.webp', imagem_2 = 'produtos-fotos/fertilizante-liquido-multiuso-2.webp', imagem_3 = 'produtos-fotos/fertilizante-liquido-multiuso-3.webp' WHERE slug = 'fertilizante-liquido-multiuso';
UPDATE produtos SET imagem = 'produtos-fotos/adubo-suculentas-cactos-1.webp', imagem_2 = 'produtos-fotos/adubo-suculentas-cactos-2.webp', imagem_3 = 'produtos-fotos/adubo-suculentas-cactos-3.webp' WHERE slug = 'adubo-suculentas-cactos';
UPDATE produtos SET imagem = 'produtos-fotos/armadilha-mosquitos-1.webp', imagem_2 = 'produtos-fotos/armadilha-mosquitos-2.webp', imagem_3 = 'produtos-fotos/armadilha-mosquitos-3.webp' WHERE slug = 'armadilha-mosquitos';
UPDATE produtos SET imagem = 'produtos-fotos/repelente-natural-formigas-1.webp', imagem_2 = 'produtos-fotos/repelente-natural-formigas-2.webp', imagem_3 = 'produtos-fotos/repelente-natural-formigas-3.webp' WHERE slug = 'repelente-natural-formigas';
UPDATE produtos SET imagem = 'produtos-fotos/inseticida-natural-plantas-1.webp', imagem_2 = 'produtos-fotos/inseticida-natural-plantas-2.webp', imagem_3 = 'produtos-fotos/inseticida-natural-plantas-3.webp' WHERE slug = 'inseticida-natural-plantas';
UPDATE produtos SET imagem = 'produtos-fotos/fungicida-base-cobre-1.webp', imagem_2 = 'produtos-fotos/fungicida-base-cobre-2.webp', imagem_3 = 'produtos-fotos/fungicida-base-cobre-3.webp' WHERE slug = 'fungicida-base-cobre';
UPDATE produtos SET imagem = 'produtos-fotos/controle-natural-cochonilhas-1.webp', imagem_2 = 'produtos-fotos/controle-natural-cochonilhas-2.webp', imagem_3 = 'produtos-fotos/controle-natural-cochonilhas-3.webp' WHERE slug = 'controle-natural-cochonilhas';
UPDATE produtos SET imagem = 'produtos-fotos/tratamento-para-acaros-1.webp', imagem_2 = 'produtos-fotos/tratamento-para-acaros-2.webp', imagem_3 = 'produtos-fotos/tratamento-para-acaros-3.webp' WHERE slug = 'tratamento-para-acaros';
UPDATE produtos SET imagem = 'produtos-fotos/controle-lesmas-caracois-1.webp', imagem_2 = 'produtos-fotos/controle-lesmas-caracois-2.webp', imagem_3 = 'produtos-fotos/controle-lesmas-caracois-3.webp' WHERE slug = 'controle-lesmas-caracois';
UPDATE produtos SET imagem = 'produtos-fotos/armadilha-cochonilhas-1.webp', imagem_2 = 'produtos-fotos/armadilha-cochonilhas-2.webp', imagem_3 = 'produtos-fotos/armadilha-cochonilhas-3.webp' WHERE slug = 'armadilha-cochonilhas';
UPDATE produtos SET imagem = 'produtos-fotos/solucao-natural-lagartas-1.webp', imagem_2 = 'produtos-fotos/solucao-natural-lagartas-2.webp' WHERE slug = 'solucao-natural-lagartas';
UPDATE produtos SET imagem = 'produtos-fotos/controle-de-trips-1.webp', imagem_2 = 'produtos-fotos/controle-de-trips-2.webp', imagem_3 = 'produtos-fotos/controle-de-trips-3.webp' WHERE slug = 'controle-de-trips';
UPDATE produtos SET imagem = 'produtos-fotos/controle-mosca-branca-1.webp' WHERE slug = 'controle-mosca-branca';
UPDATE produtos SET imagem = 'produtos-fotos/spray-antifungico-plantas-1.webp', imagem_2 = 'produtos-fotos/spray-antifungico-plantas-2.webp' WHERE slug = 'spray-antifungico-plantas';
UPDATE produtos SET imagem = 'produtos-fotos/protetor-natural-folhagens-1.webp', imagem_2 = 'produtos-fotos/protetor-natural-folhagens-2.webp', imagem_3 = 'produtos-fotos/protetor-natural-folhagens-3.webp' WHERE slug = 'protetor-natural-folhagens';
UPDATE produtos SET imagem = 'produtos-fotos/barreira-natural-insetos-1.webp', imagem_2 = 'produtos-fotos/barreira-natural-insetos-2.webp', imagem_3 = 'produtos-fotos/barreira-natural-insetos-3.webp' WHERE slug = 'barreira-natural-insetos';
UPDATE produtos SET imagem = 'produtos-fotos/protetor-plantas-contra-pragas-1.webp', imagem_2 = 'produtos-fotos/protetor-plantas-contra-pragas-2.webp' WHERE slug = 'protetor-plantas-contra-pragas';
UPDATE produtos SET imagem = 'produtos-fotos/oleo-de-neem-concentrado-1.webp', imagem_2 = 'produtos-fotos/oleo-de-neem-concentrado-2.webp' WHERE slug = 'oleo-de-neem-concentrado';
UPDATE produtos SET imagem = 'produtos-fotos/terra-de-diatomacea-1.webp', imagem_2 = 'produtos-fotos/terra-de-diatomacea-2.webp', imagem_3 = 'produtos-fotos/terra-de-diatomacea-3.webp' WHERE slug = 'terra-de-diatomacea';
UPDATE produtos SET imagem = 'produtos-fotos/spray-fungicida-organico-1.webp', imagem_2 = 'produtos-fotos/spray-fungicida-organico-2.webp', imagem_3 = 'produtos-fotos/spray-fungicida-organico-3.webp' WHERE slug = 'spray-fungicida-organico';
UPDATE produtos SET imagem = 'produtos-fotos/repelente-natural-pulgoes-1.webp', imagem_2 = 'produtos-fotos/repelente-natural-pulgoes-2.webp', imagem_3 = 'produtos-fotos/repelente-natural-pulgoes-3.webp' WHERE slug = 'repelente-natural-pulgoes';

UPDATE produtos SET imagem = 'produtos-fotos/filodendro-1.webp', imagem_2 = 'produtos-fotos/filodendro-2.webp' WHERE slug = 'filodendro';
UPDATE produtos SET imagem = 'produtos-fotos/maranta-1.webp', imagem_2 = 'produtos-fotos/maranta-2.webp', imagem_3 = 'produtos-fotos/maranta-3.webp' WHERE slug = 'maranta';
UPDATE produtos SET imagem = 'produtos-fotos/calathea-1.webp', imagem_2 = 'produtos-fotos/calathea-2.webp', imagem_3 = 'produtos-fotos/calathea-3.webp' WHERE slug = 'calathea';
UPDATE produtos SET imagem = 'produtos-fotos/samambaia-americana-1.webp', imagem_2 = 'produtos-fotos/samambaia-americana-2.webp', imagem_3 = 'produtos-fotos/samambaia-americana-3.webp' WHERE slug = 'samambaia-americana';
UPDATE produtos SET imagem = 'produtos-fotos/samambaia-boston-1.webp', imagem_2 = 'produtos-fotos/samambaia-boston-2.webp', imagem_3 = 'produtos-fotos/samambaia-boston-3.webp' WHERE slug = 'samambaia-boston';
UPDATE produtos SET imagem = 'produtos-fotos/samambaia-havaiana-1.webp', imagem_2 = 'produtos-fotos/samambaia-havaiana-2.webp', imagem_3 = 'produtos-fotos/samambaia-havaiana-3.webp' WHERE slug = 'samambaia-havaiana';
UPDATE produtos SET imagem = 'produtos-fotos/samambaia-renda-portuguesa-1.webp', imagem_2 = 'produtos-fotos/samambaia-renda-portuguesa-2.webp' WHERE slug = 'samambaia-renda-portuguesa';
UPDATE produtos SET imagem = 'produtos-fotos/echeveria-1.webp', imagem_2 = 'produtos-fotos/echeveria-2.webp' WHERE slug = 'echeveria';
UPDATE produtos SET imagem = 'produtos-fotos/sedum-1.webp', imagem_2 = 'produtos-fotos/sedum-2.webp' WHERE slug = 'sedum';
UPDATE produtos SET imagem = 'produtos-fotos/orquidea-phalaenopsis-1.webp' WHERE slug = 'orquidea-phalaenopsis';
UPDATE produtos SET imagem = 'produtos-fotos/orquidea-dendrobium-1.webp', imagem_2 = 'produtos-fotos/orquidea-dendrobium-2.webp', imagem_3 = 'produtos-fotos/orquidea-dendrobium-3.webp' WHERE slug = 'orquidea-dendrobium';
UPDATE produtos SET imagem = 'produtos-fotos/orquidea-cattleya-1.webp', imagem_2 = 'produtos-fotos/orquidea-cattleya-2.webp' WHERE slug = 'orquidea-cattleya';
UPDATE produtos SET imagem = 'produtos-fotos/orquidea-oncidium-1.webp', imagem_2 = 'produtos-fotos/orquidea-oncidium-2.webp', imagem_3 = 'produtos-fotos/orquidea-oncidium-3.webp' WHERE slug = 'orquidea-oncidium';
UPDATE produtos SET imagem = 'produtos-fotos/espadadesaojorge-1.webp' WHERE slug = 'espadadesaojorge';
UPDATE produtos SET imagem = 'produtos-fotos/manjericao-1.webp', imagem_2 = 'produtos-fotos/manjericao-2.webp', imagem_3 = 'produtos-fotos/manjericao-3.webp' WHERE slug = 'manjericao';
UPDATE produtos SET imagem = 'produtos-fotos/singonio-1.webp', imagem_2 = 'produtos-fotos/singonio-2.webp', imagem_3 = 'produtos-fotos/singonio-3.webp' WHERE slug = 'singonio';
UPDATE produtos SET imagem = 'produtos-fotos/zamioculca-1.webp', imagem_2 = 'produtos-fotos/zamioculca-2.webp' WHERE slug = 'zamioculca';
UPDATE produtos SET imagem = 'produtos-fotos/philodendron-1.webp', imagem_2 = 'produtos-fotos/philodendron-2.webp', imagem_3 = 'produtos-fotos/philodendron-3.webp' WHERE slug = 'philodendron';

UPDATE produtos SET imagem = 'produtos-fotos/fertilizante-para-flores-1.webp', imagem_2 = 'produtos-fotos/fertilizante-para-flores-2.webp', imagem_3 = 'produtos-fotos/fertilizante-para-flores-3.webp' WHERE slug = 'fertilizante-para-flores';
UPDATE produtos SET imagem = 'produtos-fotos/fertilizante-para-folhagens-1.webp', imagem_2 = 'produtos-fotos/fertilizante-para-folhagens-2.webp', imagem_3 = 'produtos-fotos/fertilizante-para-folhagens-3.webp' WHERE slug = 'fertilizante-para-folhagens';
UPDATE produtos SET imagem = 'produtos-fotos/gesso-agricola-2kg-1.webp', imagem_2 = 'produtos-fotos/gesso-agricola-2kg-2.webp', imagem_3 = 'produtos-fotos/gesso-agricola-2kg-3.webp' WHERE slug = 'gesso-agricola-2kg';
UPDATE produtos SET imagem = 'produtos-fotos/substrato-para-plantas-1.webp', imagem_2 = 'produtos-fotos/substrato-para-plantas-2.webp', imagem_3 = 'produtos-fotos/substrato-para-plantas-3.webp' WHERE slug = 'substrato-para-plantas';
UPDATE produtos SET imagem = 'produtos-fotos/armadilha-mosca-branca-1.webp', imagem_2 = 'produtos-fotos/armadilha-mosca-branca-2.webp', imagem_3 = 'produtos-fotos/armadilha-mosca-branca-3.webp' WHERE slug = 'armadilha-mosca-branca';
UPDATE produtos SET imagem = 'produtos-fotos/spray-protetor-folhagens-1.webp', imagem_2 = 'produtos-fotos/spray-protetor-folhagens-2.webp', imagem_3 = 'produtos-fotos/spray-protetor-folhagens-3.webp' WHERE slug = 'spray-protetor-folhagens';
UPDATE produtos SET imagem = 'produtos-fotos/armadilha-adesiva-insetos-1.webp', imagem_2 = 'produtos-fotos/armadilha-adesiva-insetos-2.webp', imagem_3 = 'produtos-fotos/armadilha-adesiva-insetos-3.webp' WHERE slug = 'armadilha-adesiva-insetos';
UPDATE produtos SET imagem = 'produtos-fotos/sabao-inseticida-natural-1.webp', imagem_2 = 'produtos-fotos/sabao-inseticida-natural-2.webp', imagem_3 = 'produtos-fotos/sabao-inseticida-natural-3.webp' WHERE slug = 'sabao-inseticida-natural';
