// PLANTAS
'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { montarProdutoView } = require('../../helpers/produtoView');

const IMAGENS_DIR = path.join(__dirname, '..', 'public', 'imagens');
const LOGO_PATH = path.join(IMAGENS_DIR, 'logoflor.png');

// Paleta
const VERDE = '#0E3124';
const VERDE_MEDIO = '#154030';
const VERDE_CLARO_BG = '#e8f5ee';
const DOURADO = '#b8945f';
const DOURADO_ESCURO = '#8a6a2f';
const CREME = '#FFFFFF';
const CINZA = '#5a5a4a';
const CINZA_CLARO = '#9a9a8a';
const LINHA = '#F2F2F0';
const BRANCO = '#ffffff';
const AZUL = '#1565c0';
const AZUL_BG = '#e9f0fb';
const AVISO_BG = '#fdf3e3';

const NOME_LOJA = 'Floria';

const CATEGORIAS_PERMITIDAS = ['plantas', 'adubos', 'controle-pragas'];
const RES_CATEGORIA = {
  plantas: 'Plantas',
  adubos: 'Adubos e Fertilizantes',
  'controle-pragas': 'Controle de Pragas',
};
const KICKER_CATEGORIA = {
  plantas: 'JARDINAGEM & CUIDADOS',
  adubos: 'NUTRIÇÃO & JARDINAGEM',
  'controle-pragas': 'PROTEÇÃO & JARDINAGEM',
};

const AVISO_FINAL =
  'Siga sempre as instruções da embalagem e do fabricante. Este guia é um material complementar da ' +
  NOME_LOJA + ' e não substitui as informações oficiais impressas no produto.';

function acharFicha(ficha, chaves) {
  const alvo = chaves.map((c) => c.toLowerCase());
  const achado = (ficha || []).find((f) => alvo.includes(String(f.rotulo).toLowerCase()));
  return achado ? String(achado.valor) : null;
}
function acharCuidado(cuidados, titulos) {
  const alvo = titulos.map((t) => t.toLowerCase());
  const achado = (cuidados || []).find((c) => alvo.includes(String(c.titulo).toLowerCase()));
  return achado ? achado.texto : null;
}

const FALLBACK = {
  descricao: 'Descrição detalhada não cadastrada para este produto. Consulte a embalagem ou fale com nosso suporte para mais informações.',
  comoUtilizar: 'O modo de uso específico deste produto não está detalhado em nosso sistema. Siga sempre as instruções impressas na embalagem ou no rótulo do fabricante.',
  cuidadosUso: 'Utilize o produto com atenção, seguindo as instruções da embalagem, e interrompa o uso em caso de reação adversa.',
  armazenamento: 'Armazene em local fresco, seco e ao abrigo da luz solar direta, seguindo as recomendações da embalagem. Mantenha fora do alcance de crianças e animais domésticos.',
  epi: 'Ao manusear, utilize luvas e, quando indicado na embalagem, óculos de proteção e máscara. Lave bem as mãos após o manuseio.',
  ambiental: 'Descarte embalagens vazias de forma consciente, conforme a legislação local, nunca em rios, lagos ou na rede de esgoto. Prefira pontos de coleta seletiva ou logística reversa quando disponíveis.',
};

const FAQ_POR_CATEGORIA = {
  plantas: [
    { p: 'Posso adubar minha planta com qualquer adubo?', r: 'Consulte as recomendações do fabricante do adubo escolhido e as necessidades desta espécie antes de aplicar.' },
    { p: 'Minha planta está com folhas amareladas, o que fazer?', r: 'Pode indicar excesso ou falta de água, ou necessidade de mais luz. Avalie o solo e a luminosidade do ambiente antes de agir.' },
    { p: 'Posso deixar minha planta ao sol direto o dia todo?', r: 'Depende da espécie: consulte a seção "Condições ideais" deste guia antes de mudar o local da planta.' },
  ],
  adubos: [
    { p: 'Posso misturar este produto com outros adubos?', r: 'Só se o fabricante indicar compatibilidade na embalagem. Na dúvida, aplique produtos separadamente.' },
    { p: 'O que fazer se eu aplicar mais do que o recomendado?', r: 'Regue abundantemente para ajudar a diluir o produto no solo e evite novas aplicações até o próximo ciclo indicado na embalagem.' },
    { p: 'Adubo em excesso pode prejudicar a planta?', r: 'Sim, o excesso pode queimar raízes e folhas. Siga sempre a dose indicada pelo fabricante.' },
  ],
  'controle-pragas': [
    { p: 'Este produto é seguro para plantas comestíveis (hortas e temperos)?', r: 'Verifique sempre a indicação de uso na embalagem antes de aplicar em hortas, temperos ou plantas comestíveis.' },
    { p: 'Posso aplicar perto de crianças e animais?', r: 'Afaste crianças e animais durante e após a aplicação, respeitando o tempo de reentrada indicado no rótulo do fabricante.' },
    { p: 'Preciso repetir a aplicação?', r: 'Siga o intervalo de reaplicação indicado na embalagem: reaplicar antes do tempo pode ser prejudicial.' },
  ],
};

const PLANTAS_CONTEUDO = {
  'comigo-ninguem-pode': {
    origem: 'nativa das regiões tropicais da América Central e do Sul.',
    caracteristicas: 'Folhagem grande, verde e variegada de branco/creme, uma das plantas de interior mais populares do Brasil.',
    luz: 'luz indireta, meia-sombra. Evite sol direto forte, que queima as folhas.',
    rega: 'moderada: deixe secar a camada superior do solo entre uma rega e outra.',
    solo: 'bem drenado, rico em matéria orgânica.',
    temperatura: 'ambientes quentes; é sensível a frio intenso e correntes de ar.',
    umidade: 'aprecia ambientes úmidos; borrifar as folhas ajuda.',
    comoPlantar: 'use vaso com furos de drenagem e substrato leve e fértil.',
    comoReplantar: 'a cada 1 a 2 anos, preferencialmente na primavera/verão, quando as raízes ocuparem o vaso.',
    poda: 'remova folhas amareladas ou danificadas na base, com ferramenta limpa.',
    doencas: 'manchas escuras nas folhas costumam indicar fungos por excesso de umidade.',
    excessoAgua: 'folhas amareladas, moles, e solo sempre encharcado.',
    faltaAgua: 'folhas murchas, com bordas secas e quebradiças.',
    crescimento: 'boa luz indireta combinada com adubação equilibrada estimula um crescimento mais vigoroso.',
    curiosidade: 'o nome popular vem da seiva tóxica da planta, que pode causar inchaço na boca e na garganta se mastigada, daí o "alerta" no próprio nome.',
  },
  samambaia: {
    origem: 'regiões tropicais e subtropicais de diversas partes do mundo.',
    caracteristicas: 'Folhas plumosas em tons de verde vibrante, crescendo em touceira, clássica em varandas e ambientes internos.',
    luz: 'sombra ou meia-sombra, sempre com luz indireta.',
    rega: 'regular, mantendo o solo sempre levemente úmido, sem encharcar.',
    solo: 'rico em matéria orgânica e bem drenado.',
    temperatura: 'ambientes amenos, longe de correntes de ar quente ou seco.',
    umidade: 'essencial que seja alta: borrife as folhas com frequência.',
    comoPlantar: 'em vasos suspensos ou de chão, com substrato leve e fértil.',
    comoReplantar: 'geralmente uma vez por ano, quando as raízes começarem a sair pelo fundo do vaso.',
    poda: 'remova folhas secas ou amareladas na base.',
    doencas: 'pontas das folhas marrons costumam indicar ar muito seco.',
    excessoAgua: 'folhas amolecidas e apodrecimento na base da planta.',
    faltaAgua: 'folhas e folíolos ressecados, quebradiços, com pontas marrons.',
    crescimento: 'ambiente sombreado e úmido é o principal fator para um crescimento vigoroso.',
    curiosidade: 'samambaias fazem parte de um dos grupos de plantas mais antigos do planeta, existindo muito antes das plantas com flores.',
  },
  alecrim: {
    origem: 'região do Mediterrâneo.',
    caracteristicas: 'Erva aromática arbustiva, de folhas finas em formato de agulha, muito usada na culinária.',
    luz: 'sol pleno: pelo menos 4 a 6 horas de luz direta por dia.',
    rega: 'espaçada; deixe o solo secar bem entre as regas (planta resistente à seca).',
    solo: 'bem drenado, arenoso e pouco fértil.',
    temperatura: 'adapta-se bem a climas quentes e secos.',
    umidade: 'baixa: evite ambientes abafados ou muito úmidos.',
    comoPlantar: 'em vaso com boa drenagem ou direto no solo, em local ensolarado.',
    comoReplantar: 'quando as raízes ocuparem todo o vaso atual.',
    poda: 'apare após a floração para estimular ramificação, e colha os ramos regularmente para uso culinário.',
    doencas: 'excesso de umidade favorece fungos e podridão das raízes.',
    excessoAgua: 'folhas amareladas e apodrecimento das raízes.',
    faltaAgua: 'planta resistente, mas seca prolongada murcha os ramos.',
    crescimento: 'sol pleno e solo bem drenado são os fatores-chave para uma planta vigorosa.',
    curiosidade: 'o alecrim é associado à memória desde a Antiguidade e é usado tanto na culinária quanto em rituais e perfumaria.',
  },
  babosa: {
    origem: 'Península Arábica, hoje naturalizada em regiões tropicais e áridas do mundo todo.',
    caracteristicas: 'Suculenta de folhas carnudas com gel no interior, uma das plantas mais populares para cultivo doméstico.',
    luz: 'sol pleno ou luz indireta forte.',
    rega: 'espaçada: deixe o solo secar completamente entre as regas.',
    solo: 'arenoso e bem drenado (substrato próprio para suculentas/cactos).',
    temperatura: 'clima ameno a quente; sensível a geadas.',
    umidade: 'baixa.',
    comoPlantar: 'em vaso com furos de drenagem e substrato para suculentas.',
    comoReplantar: 'a cada 2 anos aproximadamente, ou quando surgirem muitas mudas ("filhotes") ao redor da planta-mãe.',
    poda: 'remova apenas folhas externas secas ou danificadas.',
    doencas: 'excesso de água costuma causar apodrecimento das raízes e da base.',
    excessoAgua: 'folhas moles, translúcidas, com sinais de apodrecimento.',
    faltaAgua: 'folhas enrugadas e mais finas (a planta é bem tolerante à seca).',
    crescimento: 'sol direto e regas espaçadas estimulam um crescimento saudável.',
    curiosidade: 'o gel da babosa é usado há séculos em cuidados com a pele, mas qualquer uso medicinal deve ser sempre orientado por um profissional de saúde.',
  },
  cacto: {
    origem: 'principalmente do continente americano, em regiões áridas e semiáridas.',
    caracteristicas: 'Suculenta que armazena água no caule, com poucos ou nenhum espinho de folha: os espinhos substituem as folhas.',
    luz: 'sol pleno.',
    rega: 'bem espaçada: deixe secar completamente entre regas, ainda mais no inverno.',
    solo: 'arenoso e extremamente bem drenado.',
    temperatura: 'tolera calor; proteja de frio intenso e geadas.',
    umidade: 'baixa.',
    comoPlantar: 'em vaso com boa drenagem e substrato específico para cactos.',
    comoReplantar: 'pouco frequente (a cada 2 a 3 anos), usando luvas ou pano para manuseio por causa dos espinhos.',
    poda: 'geralmente não é necessária.',
    doencas: 'o excesso de água é a principal causa de problemas, levando ao apodrecimento.',
    excessoAgua: 'manchas moles e escurecidas, com apodrecimento da base.',
    faltaAgua: 'enrugamento do caule, mas o cacto tolera bem períodos de seca.',
    crescimento: 'luz abundante e regas espaçadas favorecem um crescimento saudável.',
    curiosidade: 'os espinhos são, na verdade, folhas modificadas que ajudam a planta a reduzir a perda de água.',
  },
  'costela-de-adao': {
    origem: 'florestas tropicais da América Central.',
    caracteristicas: 'Folhas grandes e recortadas (fenestradas), com hábito trepador, uma presença marcante em qualquer ambiente.',
    luz: 'luz indireta, meia-sombra.',
    rega: 'moderada: deixe a superfície do solo secar levemente entre as regas.',
    solo: 'rico em matéria orgânica e bem drenado.',
    temperatura: 'ambientes quentes; sensível a frio.',
    umidade: 'aprecia umidade alta.',
    comoPlantar: 'em vaso amplo, considerando um tutor para guiar o crescimento da trepadeira.',
    comoReplantar: 'a cada 1 a 2 anos, ou quando o vaso e as raízes aéreas ficarem apertados.',
    poda: 'remova folhas velhas ou danificadas; guie o crescimento com o tutor.',
    doencas: 'manchas escuras nas folhas podem indicar fungos por excesso de água.',
    excessoAgua: 'folhas amareladas e moles.',
    faltaAgua: 'folhas murchas, com bordas secas.',
    crescimento: 'um tutor de fibra ou madeira estimula folhas maiores e com mais fenestrações.',
    curiosidade: 'as folhas desenvolvem os característicos "furos" (fenestrações) à medida que a planta amadurece.',
  },
  orquidea: {
    origem: 'regiões tropicais do Sudeste Asiático.',
    caracteristicas: 'Flores elegantes e duradouras, com raízes aéreas esverdeadas, símbolo de sofisticação na decoração.',
    luz: 'luz indireta forte; nunca sol direto.',
    rega: 'regue quando as raízes ficarem prateadas/secas, evitando encharcar o substrato.',
    solo: 'substrato específico para orquídeas (casca de pinus), nunca terra comum.',
    temperatura: 'ambientes amenos, sem variações bruscas.',
    umidade: 'alta umidade é benéfica.',
    comoPlantar: 'em vaso transparente ou telado, com substrato próprio de casca.',
    comoReplantar: 'a cada 1 a 2 anos, ou quando o substrato se decompuser.',
    poda: 'corte a haste floral após murcharem todas as flores, acima de um nó, se quiser estimular nova floração.',
    doencas: 'manchas moles e escuras nas raízes indicam apodrecimento por excesso de água.',
    excessoAgua: 'raízes escuras, moles, com sinais de apodrecimento.',
    faltaAgua: 'raízes enrugadas e esbranquiçadas.',
    crescimento: 'luz adequada e rega correta são essenciais para uma nova floração.',
    curiosidade: 'as orquídeas formam uma das maiores famílias de plantas com flores do mundo, com milhares de espécies catalogadas.',
  },
  lavanda: {
    origem: 'região do Mediterrâneo.',
    caracteristicas: 'Arbusto aromático de flores roxas e folhas acinzentadas, muito usado em jardins e na aromaterapia.',
    luz: 'sol pleno.',
    rega: 'espaçada: o solo deve secar bem entre as regas (planta resistente à seca).',
    solo: 'bem drenado, neutro a alcalino, pouco fértil.',
    temperatura: 'clima ameno; tolera calor, mas é sensível a excesso de umidade.',
    umidade: 'baixa.',
    comoPlantar: 'em local ensolarado, vaso ou solo com boa drenagem.',
    comoReplantar: 'quando o vaso atual ficar pequeno para a planta.',
    poda: 'pode após a floração para manter o formato compacto e estimular novas flores.',
    doencas: 'excesso de umidade favorece fungos e apodrecimento de raízes.',
    excessoAgua: 'folhas amareladas e apodrecimento da base.',
    faltaAgua: 'a planta murcha, mas é bastante tolerante à seca.',
    crescimento: 'sol pleno e poda regular estimulam mais floração.',
    curiosidade: 'o nome "lavanda" vem do latim "lavare" (lavar); os romanos usavam a planta para perfumar a água do banho.',
  },
  jasmim: {
    origem: 'regiões tropicais e subtropicais da Ásia, África e Oceania, variando conforme a espécie.',
    caracteristicas: 'Trepadeira ou arbusto de flores brancas ou amareladas, com perfume marcante.',
    luz: 'sol pleno a meia-sombra.',
    rega: 'regular, mantendo o solo levemente úmido, sem encharcar.',
    solo: 'fértil e bem drenado.',
    temperatura: 'clima ameno a quente.',
    umidade: 'moderada.',
    comoPlantar: 'junto a um tutor ou treliça, se for uma variedade trepadeira.',
    comoReplantar: 'quando as raízes ocuparem todo o vaso.',
    poda: 'apare após a floração para controlar o crescimento e estimular novas flores.',
    doencas: 'excesso de água pode causar fungos nas raízes.',
    excessoAgua: 'folhas amareladas e queda prematura de folhas.',
    faltaAgua: 'folhas murchas e ressecadas.',
    crescimento: 'boa luminosidade e adubação na primavera estimulam a floração.',
    curiosidade: 'o perfume do jasmim é usado há séculos na perfumaria e em chás aromáticos ao redor do mundo.',
  },
  hortela: {
    origem: 'Europa e Ásia, hoje naturalizada em quase todo o mundo.',
    caracteristicas: 'Erva aromática de crescimento rápido e folhas serrilhadas, conhecida por se espalhar com facilidade.',
    luz: 'sol pleno a meia-sombra.',
    rega: 'regular, mantendo o solo sempre levemente úmido (não tolera seca prolongada).',
    solo: 'fértil, com boa retenção de umidade e drenagem.',
    temperatura: 'clima ameno.',
    umidade: 'moderada a alta.',
    comoPlantar: 'em vaso próprio: a hortelã se espalha rápido e pode invadir outros vasos ou canteiros.',
    comoReplantar: 'divida as touceiras a cada ano para renovar o vigor da planta.',
    poda: 'colher os ramos regularmente estimula um crescimento mais denso.',
    doencas: 'manchas ou ferrugem nas folhas podem surgir em ambientes muito úmidos e abafados.',
    excessoAgua: 'apodrecimento da base e das raízes.',
    faltaAgua: 'folhas murcham rapidamente: planta sensível à seca.',
    crescimento: 'colheita frequente e boa luminosidade estimulam um crescimento vigoroso.',
    curiosidade: 'a hortelã se propaga tão facilmente que muitos jardineiros recomendam sempre plantá-la em vaso separado.',
  },
  espadadesaojorge: {
    origem: 'África tropical (da Nigéria ao Congo).',
    caracteristicas: 'Folhas rígidas, eretas, em forma de espada, verdes com faixas, uma das plantas de interior mais resistentes.',
    luz: 'muito adaptável, de sol pleno a ambientes com pouca luz.',
    rega: 'bem espaçada; deixe o solo secar completamente entre regas (muito tolerante à seca).',
    solo: 'bem drenado, tipo substrato para suculentas.',
    temperatura: 'ampla tolerância; sensível apenas a frio intenso.',
    umidade: 'baixa.',
    comoPlantar: 'em vaso com boa drenagem.',
    comoReplantar: 'pouco frequente, a cada 2 a 3 anos.',
    poda: 'remova folhas danificadas na base.',
    doencas: 'o excesso de água é a principal causa de apodrecimento.',
    excessoAgua: 'folhas moles, amareladas, com apodrecimento da base.',
    faltaAgua: 'planta muito resistente; as folhas só enrugam em seca extrema.',
    crescimento: 'cresce mesmo em pouca luz, mas se desenvolve mais rápido com boa luminosidade.',
    curiosidade: 'é uma das plantas mais indicadas para iniciantes, por sua resistência e baixa necessidade de manutenção.',
  },
  manjericao: {
    origem: 'regiões tropicais da Ásia e África.',
    caracteristicas: 'Erva aromática de folhas verdes macias, um dos temperos mais usados na culinária.',
    luz: 'sol pleno a meia-sombra: pelo menos algumas horas de luz direta.',
    rega: 'regular, mantendo o solo levemente úmido.',
    solo: 'fértil e bem drenado.',
    temperatura: 'clima quente; sensível a frio.',
    umidade: 'moderada.',
    comoPlantar: 'em vaso com boa drenagem, em local ensolarado.',
    comoReplantar: 'quando as raízes ocuparem todo o vaso.',
    poda: 'colher e podar as pontas regularmente estimula um crescimento mais denso e atrasa o florescimento.',
    doencas: 'excesso de umidade favorece o aparecimento de fungos.',
    excessoAgua: 'folhas amareladas e murchas, com apodrecimento.',
    faltaAgua: 'folhas murcham rapidamente.',
    crescimento: 'a colheita frequente das folhas estimula uma planta mais robusta e cheia.',
    curiosidade: 'existem diversas variedades de manjericão, com aromas que vão do clássico ao adocicado e picante.',
  },
  singonio: {
    origem: 'florestas tropicais da América Central e do Sul.',
    caracteristicas: 'Folhas em formato de seta que mudam de aparência com a idade da planta; pode ser trepadeira ou rasteira.',
    luz: 'luz indireta, meia-sombra.',
    rega: 'moderada: deixe a superfície do solo secar entre as regas.',
    solo: 'rico em matéria orgânica e bem drenado.',
    temperatura: 'ambientes quentes; sensível a frio.',
    umidade: 'aprecia ambientes úmidos.',
    comoPlantar: 'em vaso com tutor, se quiser estimular o crescimento trepador.',
    comoReplantar: 'a cada 1 a 2 anos.',
    poda: 'apare as pontas para estimular ramificação e um formato mais cheio.',
    doencas: 'manchas escuras podem indicar excesso de umidade.',
    excessoAgua: 'folhas amareladas e moles.',
    faltaAgua: 'folhas murchas, com bordas secas.',
    crescimento: 'luz indireta adequada e boa umidade estimulam folhas maiores.',
    curiosidade: 'as folhas mudam de formato conforme a planta amadurece, começando em seta e podendo se tornar mais lobuladas.',
  },
  zamioculca: {
    origem: 'África Oriental (Quênia e Tanzânia).',
    caracteristicas: 'Folhas brilhantes e grossas, com hastes suculentas que armazenam água, extremamente resistente.',
    luz: 'muito adaptável, de luz indireta forte a ambientes com pouca luz.',
    rega: 'bem espaçada; deixe o solo secar completamente entre regas (a planta armazena água nos rizomas).',
    solo: 'bem drenado.',
    temperatura: 'ampla tolerância; sensível a frio intenso.',
    umidade: 'baixa.',
    comoPlantar: 'em vaso com boa drenagem.',
    comoReplantar: 'pouco frequente, a cada 2 a 3 anos.',
    poda: 'remova folhas ou hastes danificadas na base.',
    doencas: 'o excesso de água é a principal causa de apodrecimento dos rizomas.',
    excessoAgua: 'hastes moles e amareladas, com apodrecimento.',
    faltaAgua: 'planta muito resistente; tolera longos períodos sem água.',
    crescimento: 'cresce bem mesmo com pouca manutenção; regas espaçadas favorecem a saúde da planta.',
    curiosidade: 'é uma das plantas de interior mais resistentes, sobrevivendo bem em escritórios com pouca luz natural.',
  },
  philodendron: {
    origem: 'florestas tropicais das Américas.',
    caracteristicas: 'Folhagem exuberante, podendo ser trepadeira ou de porte ereto, dependendo da espécie.',
    luz: 'luz indireta, meia-sombra.',
    rega: 'moderada: deixe a superfície do solo secar entre as regas.',
    solo: 'rico em matéria orgânica e bem drenado.',
    temperatura: 'ambientes quentes; sensível a frio.',
    umidade: 'aprecia ambientes úmidos.',
    comoPlantar: 'em vaso com tutor, se for uma espécie trepadeira.',
    comoReplantar: 'a cada 1 a 2 anos.',
    poda: 'remova folhas velhas e apare as pontas para estimular ramificação.',
    doencas: 'manchas escuras podem indicar excesso de umidade.',
    excessoAgua: 'folhas amareladas e moles.',
    faltaAgua: 'folhas murchas, com bordas secas.',
    crescimento: 'luz indireta adequada e um tutor (se trepadeira) estimulam um crescimento vigoroso.',
    curiosidade: 'o nome "Philodendron" vem do grego e significa "amigo das árvores", referência ao hábito trepador de muitas espécies.',
  },
};

function badgeIcone(doc, cx, cy, raio, cor, desenharGlifo) {
  doc.save();
  doc.circle(cx, cy, raio).fill(cor);
  doc.fillColor(BRANCO).strokeColor(BRANCO);
  desenharGlifo(doc, cx, cy, raio);
  doc.restore();
}
const ICONES = {
  sol: (doc, cx, cy, r) => {
    doc.circle(cx, cy, r * 0.38).fill(BRANCO);
    for (let i = 0; i < 8; i++) {
      const ang = (Math.PI / 4) * i;
      doc.moveTo(cx + Math.cos(ang) * r * 0.55, cy + Math.sin(ang) * r * 0.55)
        .lineTo(cx + Math.cos(ang) * r * 0.82, cy + Math.sin(ang) * r * 0.82)
        .lineWidth(1.6).stroke(BRANCO);
    }
  },
  gota: (doc, cx, cy, r) => {
    doc.moveTo(cx, cy - r * 0.62)
      .quadraticCurveTo(cx + r * 0.62, cy + r * 0.1, cx, cy + r * 0.62)
      .quadraticCurveTo(cx - r * 0.62, cy + r * 0.1, cx, cy - r * 0.62)
      .fill(BRANCO);
  },
  nuvem: (doc, cx, cy, r) => {
    doc.circle(cx - r * 0.28, cy + r * 0.05, r * 0.3).fill(BRANCO);
    doc.circle(cx + r * 0.05, cy - r * 0.12, r * 0.36).fill(BRANCO);
    doc.circle(cx + r * 0.38, cy + r * 0.08, r * 0.26).fill(BRANCO);
    doc.rect(cx - r * 0.35, cy + r * 0.05, r * 0.9, r * 0.32).fill(BRANCO);
  },
  termometro: (doc, cx, cy, r) => {
    doc.roundedRect(cx - r * 0.16, cy - r * 0.55, r * 0.32, r * 0.85, r * 0.16).fill(BRANCO);
    doc.circle(cx, cy + r * 0.42, r * 0.26).fill(BRANCO);
  },
  alerta: (doc, cx, cy, r) => {
    doc.moveTo(cx, cy - r * 0.6).lineTo(cx + r * 0.62, cy + r * 0.5).lineTo(cx - r * 0.62, cy + r * 0.5).closePath().fill(BRANCO);
    doc.rect(cx - r * 0.07, cy - r * 0.28, r * 0.14, r * 0.5).fill(DOURADO);
    doc.circle(cx, cy + r * 0.38, r * 0.08).fill(DOURADO);
  },
  escudo: (doc, cx, cy, r) => {
    doc.moveTo(cx, cy - r * 0.6)
      .lineTo(cx + r * 0.5, cy - r * 0.35).lineTo(cx + r * 0.5, cy + r * 0.15)
      .quadraticCurveTo(cx + r * 0.5, cy + r * 0.55, cx, cy + r * 0.68)
      .quadraticCurveTo(cx - r * 0.5, cy + r * 0.55, cx - r * 0.5, cy + r * 0.15)
      .lineTo(cx - r * 0.5, cy - r * 0.35).closePath().fill(BRANCO);
  },
  folha: (doc, cx, cy, r) => {
    doc.moveTo(cx, cy - r * 0.6)
      .bezierCurveTo(cx + r * 0.72, cy - r * 0.5, cx + r * 0.72, cy + r * 0.4, cx, cy + r * 0.65)
      .bezierCurveTo(cx - r * 0.72, cy + r * 0.4, cx - r * 0.72, cy - r * 0.5, cx, cy - r * 0.6)
      .fill(BRANCO);
    doc.moveTo(cx, cy - r * 0.5).lineTo(cx, cy + r * 0.55).lineWidth(1).stroke(VERDE_MEDIO);
  },
  caixa: (doc, cx, cy, r) => {
    doc.rect(cx - r * 0.5, cy - r * 0.35, r * 1, r * 0.75).fill(BRANCO);
    doc.moveTo(cx - r * 0.5, cy - r * 0.35).lineTo(cx, cy - r * 0.62).lineTo(cx + r * 0.5, cy - r * 0.35).closePath().fill(DOURADO);
  },
  globo: (doc, cx, cy, r) => {
    doc.circle(cx, cy, r * 0.55).lineWidth(1.6).stroke(BRANCO);
    doc.ellipse(cx, cy, r * 0.24, r * 0.55).lineWidth(1.2).stroke(BRANCO);
    doc.moveTo(cx - r * 0.55, cy).lineTo(cx + r * 0.55, cy).lineWidth(1.2).stroke(BRANCO);
  },
  duvida: (doc, cx, cy, r) => {
    doc.fillColor(BRANCO).font('Helvetica-Bold').fontSize(r * 1.1).text('?', cx - r * 0.3, cy - r * 0.55, { width: r * 0.6, align: 'center' });
  },
  spray: (doc, cx, cy, r) => {
    doc.rect(cx - r * 0.3, cy - r * 0.1, r * 0.6, r * 0.62).fill(BRANCO);
    doc.rect(cx - r * 0.14, cy - r * 0.42, r * 0.28, r * 0.32).fill(BRANCO);
    for (let i = 0; i < 3; i++) {
      doc.moveTo(cx + r * 0.2, cy - r * 0.5 + i * r * 0.16).lineTo(cx + r * 0.5, cy - r * 0.62 + i * r * 0.16).lineWidth(1.2).stroke(BRANCO);
    }
  },
  broto: (doc, cx, cy, r) => {
    doc.moveTo(cx, cy + r * 0.6).lineTo(cx, cy - r * 0.1).lineWidth(2).stroke(BRANCO);
    doc.moveTo(cx, cy - r * 0.05)
      .bezierCurveTo(cx + r * 0.1, cy - r * 0.5, cx + r * 0.55, cy - r * 0.5, cx + r * 0.6, cy - r * 0.15)
      .bezierCurveTo(cx + r * 0.2, cy - r * 0.1, cx + r * 0.05, cy - r * 0.05, cx, cy - r * 0.05).fill(BRANCO);
    doc.moveTo(cx, cy - r * 0.05)
      .bezierCurveTo(cx - r * 0.1, cy - r * 0.5, cx - r * 0.55, cy - r * 0.5, cx - r * 0.6, cy - r * 0.15)
      .bezierCurveTo(cx - r * 0.2, cy - r * 0.1, cx - r * 0.05, cy - r * 0.05, cx, cy - r * 0.05).fill(BRANCO);
  },
  vaso: (doc, cx, cy, r) => {
    doc.moveTo(cx - r * 0.4, cy - r * 0.1).lineTo(cx + r * 0.4, cy - r * 0.1)
      .lineTo(cx + r * 0.28, cy + r * 0.55).lineTo(cx - r * 0.28, cy + r * 0.55).closePath().fill(BRANCO);
    doc.rect(cx - r * 0.48, cy - r * 0.22, r * 0.96, r * 0.14).fill(BRANCO);
  },
  tesoura: (doc, cx, cy, r) => {
    doc.moveTo(cx - r * 0.42, cy - r * 0.42).lineTo(cx + r * 0.42, cy + r * 0.42).lineWidth(2.2).stroke(BRANCO);
    doc.moveTo(cx + r * 0.42, cy - r * 0.42).lineTo(cx - r * 0.42, cy + r * 0.42).lineWidth(2.2).stroke(BRANCO);
    doc.circle(cx - r * 0.42, cy - r * 0.42, r * 0.12).fill(BRANCO);
    doc.circle(cx + r * 0.42, cy - r * 0.42, r * 0.12).fill(BRANCO);
  },
  mancha: (doc, cx, cy, r) => {
    ICONES.folha(doc, cx, cy, r);
    doc.circle(cx + r * 0.1, cy + r * 0.1, r * 0.16).fill(DOURADO_ESCURO);
  },
  lupa: (doc, cx, cy, r) => {
    doc.circle(cx - r * 0.08, cy - r * 0.08, r * 0.4).lineWidth(2).stroke(BRANCO);
    doc.moveTo(cx + r * 0.22, cy + r * 0.22).lineTo(cx + r * 0.55, cy + r * 0.55).lineWidth(2.4).stroke(BRANCO);
  },
  relogio: (doc, cx, cy, r) => {
    doc.circle(cx, cy, r * 0.55).lineWidth(1.6).stroke(BRANCO);
    doc.moveTo(cx, cy).lineTo(cx, cy - r * 0.35).lineWidth(1.6).stroke(BRANCO);
    doc.moveTo(cx, cy).lineTo(cx + r * 0.28, cy + r * 0.05).lineWidth(1.6).stroke(BRANCO);
  },
  calendario: (doc, cx, cy, r) => {
    doc.roundedRect(cx - r * 0.5, cy - r * 0.42, r, r * 0.9, r * 0.1).fill(BRANCO);
    doc.rect(cx - r * 0.5, cy - r * 0.42, r, r * 0.24).fill(VERDE_MEDIO);
    doc.circle(cx - r * 0.22, cy + r * 0.1, r * 0.07).fill(VERDE_MEDIO);
    doc.circle(cx + r * 0.05, cy + r * 0.1, r * 0.07).fill(VERDE_MEDIO);
    doc.circle(cx + r * 0.22, cy - r * 0.15, r * 0.07).fill(VERDE_MEDIO);
  },
  lampada: (doc, cx, cy, r) => {
    doc.circle(cx, cy - r * 0.1, r * 0.42).fill(BRANCO);
    doc.rect(cx - r * 0.16, cy + r * 0.28, r * 0.32, r * 0.16).fill(BRANCO);
    for (let i = 0; i < 2; i++) doc.moveTo(cx - r * 0.12, cy + r * 0.48 + i * r * 0.08).lineTo(cx + r * 0.12, cy + r * 0.48 + i * r * 0.08).lineWidth(1).stroke(DOURADO_ESCURO);
  },
};
const ICONE_ESTILO = { dica: 'lampada', atencao: 'alerta', curiosidade: 'lampada' };
const COR_ESTILO = {
  dica: { bg: VERDE_CLARO_BG, faixa: VERDE_MEDIO, titulo: VERDE },
  atencao: { bg: AVISO_BG, faixa: DOURADO, titulo: DOURADO_ESCURO },
  curiosidade: { bg: AZUL_BG, faixa: AZUL, titulo: AZUL },
};

function montarBlocosPlanta(produto, pv) {
  const d = PLANTAS_CONTEUDO[pv.slug] || null;
  const cuidados = pv.cuidados || [];
  const b = [];

  b.push({ tipo: 'secao', titulo: 'Características e origem' });
  b.push({ tipo: 'item', icone: 'folha', texto: d ? d.caracteristicas : (pv.descricao || FALLBACK.descricao) });
  b.push({ tipo: 'item', icone: 'globo', texto: 'Origem: ' + (d ? d.origem : 'não cadastrada para esta planta. Consulte a etiqueta ou fale com nossa equipe.') });

  b.push({ tipo: 'secao', titulo: 'Condições ideais de cultivo' });
  b.push({ tipo: 'item', icone: 'sol', texto: 'Luminosidade: ' + (d ? d.luz : (acharCuidado(cuidados, ['luz']) || 'posicione em local com boa luminosidade indireta.')) });
  b.push({ tipo: 'item', icone: 'gota', texto: 'Rega: ' + (d ? d.rega : (acharCuidado(cuidados, ['rega']) || 'regue quando o substrato estiver seco ao toque.')) });
  b.push({ tipo: 'item', icone: 'vaso', texto: 'Solo ideal: ' + (d ? d.solo : 'utilize substrato com boa drenagem, apropriado para plantas de vaso.') });
  b.push({ tipo: 'item', icone: 'termometro', texto: 'Temperatura: ' + (d ? d.temperatura : (acharCuidado(cuidados, ['temperatura']) || 'mantenha em ambiente ameno, protegido de frio intenso.')) });
  b.push({ tipo: 'item', icone: 'nuvem', texto: 'Umidade: ' + (d ? d.umidade : 'a maioria das plantas de interior aprecia umidade moderada a alta.') });
  b.push({ tipo: 'item', icone: 'broto', texto: 'Adubação: siga sempre a recomendação do fabricante do adubo escolhido para esta espécie.' });

  b.push({ tipo: 'caixa', estilo: 'dica', titulo: 'Dica para estimular o crescimento', texto: d ? d.crescimento : 'Boa luminosidade indireta e regas equilibradas favorecem o crescimento saudável da maioria das plantas de interior.' });

  b.push({ tipo: 'secao', titulo: 'Como plantar, replantar e podar' });
  b.push({ tipo: 'item', icone: 'vaso', texto: 'Como plantar: ' + (d ? d.comoPlantar : 'utilize vaso com furos de drenagem e substrato adequado à espécie.') });
  b.push({ tipo: 'item', icone: 'broto', texto: 'Como replantar: ' + (d ? d.comoReplantar : 'transfira para um vaso maior quando as raízes ocuparem todo o espaço atual.') });
  b.push({ tipo: 'item', icone: 'tesoura', texto: 'Como podar: ' + (d ? d.poda : 'remova apenas folhas secas ou danificadas, com ferramenta limpa.') });

  b.push({ tipo: 'secao', titulo: 'Sinais de alerta' });
  b.push({ tipo: 'item', icone: 'mancha', texto: 'Como identificar doenças: ' + (d ? d.doencas : 'inspecione periodicamente folhas e caule em busca de manchas ou insetos.') });
  b.push({ tipo: 'item', icone: 'gota', texto: 'Sinais de excesso de água: ' + (d ? d.excessoAgua : 'folhas moles, amareladas ou solo sempre encharcado.') });
  b.push({ tipo: 'item', icone: 'sol', texto: 'Sinais de falta de água: ' + (d ? d.faltaAgua : 'folhas murchas, secas ou quebradiças.') });

  const seguraPet = produto.pet_friendly === 1;
  b.push({
    tipo: 'caixa', estilo: 'atencao', titulo: 'Cuidados com crianças e animais',
    texto: seguraPet
      ? 'Esta espécie é classificada como segura para conviver com pets. Ainda assim, evite que animais mastiguem folhas ou substrato.'
      : 'Esta espécie pode não ser segura para pets e crianças em caso de ingestão. Mantenha fora do alcance e busque orientação médica/veterinária em caso de contato acidental.',
  });

  b.push({ tipo: 'caixa', estilo: 'curiosidade', titulo: 'Você sabia?', texto: d ? d.curiosidade : 'Cada espécie de planta tem uma história única. Pesquise sobre a origem da sua para conhecê-la ainda melhor.' });

  b.push({
    tipo: 'calendario',
    itens: [
      { estacao: 'Primavera', tarefa: 'Fase de crescimento: bom momento para adubar e replantar.' },
      { estacao: 'Verão', tarefa: 'Atenção redobrada à rega em dias muito quentes.' },
      { estacao: 'Outono', tarefa: 'Reduza aos poucos a frequência de rega.' },
      { estacao: 'Inverno', tarefa: 'Regas mais espaçadas; evite adubar fora da fase de crescimento.' },
    ],
  });

  b.push({ tipo: 'faq', perguntas: FAQ_POR_CATEGORIA.plantas });
  b.push({ tipo: 'caixa', estilo: 'atencao', titulo: 'Recomendação importante', texto: AVISO_FINAL });
  return b;
}

function montarBlocosAdubo(produto, pv) {
  const ficha = pv.ficha || [];
  const cuidados = pv.cuidados || [];
  const b = [];

  b.push({ tipo: 'secao', titulo: 'Para que serve' });
  b.push({ tipo: 'item', icone: 'broto', texto: acharFicha(ficha, ['uso', 'finalidade']) || (pv.descricao || FALLBACK.descricao) });
  b.push({ tipo: 'item', icone: 'globo', texto: 'Como funciona: fertilizantes fornecem nutrientes essenciais, como Nitrogênio (N), Fósforo (P) e Potássio (K), que as plantas absorvem principalmente pelas raízes, fortalecendo folhas, raízes e floração.' });

  b.push({ tipo: 'secao', titulo: 'Como e quando aplicar' });
  b.push({ tipo: 'item', icone: 'folha', texto: 'Tipos de planta indicados: ' + (acharFicha(ficha, ['uso', 'tipo']) || 'consulte a embalagem para a indicação exata do fabricante.') });
  b.push({ tipo: 'item', icone: 'vaso', texto: 'Como aplicar: ' + (pv.comoUtilizar || acharCuidado(cuidados, ['modo de uso']) || FALLBACK.comoUtilizar) });
  b.push({ tipo: 'item', icone: 'calendario', texto: 'Melhor época: ' + (acharFicha(ficha, ['aplicação', 'reaplicação', 'frequência']) || acharCuidado(cuidados, ['frequência']) || 'em geral, a fase de crescimento ativo (primavera e verão) é a mais indicada; confirme na embalagem.') });

  b.push({ tipo: 'caixa', estilo: 'atencao', titulo: 'Quantidade recomendada', texto: 'Sempre siga rigorosamente a quantidade e a diluição indicadas na embalagem do fabricante. A dose ideal varia conforme a formulação de cada produto.' });

  b.push({ tipo: 'secao', titulo: 'Cuidados e armazenamento' });
  b.push({ tipo: 'item', icone: 'escudo', texto: 'Cuidados: ' + (acharCuidado(cuidados, ['atenção']) || FALLBACK.cuidadosUso) });
  b.push({ tipo: 'item', icone: 'caixa', texto: 'Armazenamento: ' + FALLBACK.armazenamento });

  b.push({ tipo: 'caixa', estilo: 'dica', titulo: 'Erros comuns a evitar', texto: 'Aplicar mais do que o indicado, adubar solo seco, aplicar sob sol forte e misturar produtos sem indicação do fabricante são os erros mais frequentes, e podem prejudicar a planta em vez de ajudar.' });
  b.push({ tipo: 'caixa', estilo: 'curiosidade', titulo: 'Benefícios', texto: pv.beneficios || 'Um bom adubo fortalece raízes, estimula folhas mais viçosas e favorece a floração ao longo do tempo, quando usado corretamente e na medida certa.' });

  b.push({ tipo: 'faq', perguntas: FAQ_POR_CATEGORIA.adubos });
  b.push({ tipo: 'caixa', estilo: 'atencao', titulo: 'Recomendação importante', texto: AVISO_FINAL });
  return b;
}

function montarBlocosPraga(produto, pv) {
  const ficha = pv.ficha || [];
  const cuidados = pv.cuidados || [];
  const b = [];

  b.push({ tipo: 'secao', titulo: 'O que este produto combate' });
  b.push({ tipo: 'item', icone: 'lupa', texto: acharFicha(ficha, ['princípio ativo', 'uso']) ? ('Composição/uso: ' + acharFicha(ficha, ['princípio ativo', 'uso'])) : (pv.descricao || FALLBACK.descricao) });
  b.push({ tipo: 'item', icone: 'mancha', texto: 'Como identificar a infestação: observe folhas amareladas, manchas, teias finas, pontos escuros móveis ou insetos visíveis. Identificar a praga corretamente ajuda a escolher o tratamento adequado.' });

  b.push({ tipo: 'secao', titulo: 'Como preparar e aplicar' });
  b.push({ tipo: 'item', icone: 'gota', texto: 'Como preparar: ' + (acharFicha(ficha, ['diluição']) || 'siga rigorosamente a diluição indicada na embalagem do fabricante.') });
  b.push({ tipo: 'item', icone: 'spray', texto: 'Como aplicar: ' + (pv.comoUtilizar || acharCuidado(cuidados, ['modo de uso']) || FALLBACK.comoUtilizar) });

  b.push({ tipo: 'caixa', estilo: 'atencao', titulo: 'Equipamentos de proteção (EPI)', texto: FALLBACK.epi });

  b.push({ tipo: 'secao', titulo: 'Durante e depois da aplicação' });
  b.push({ tipo: 'item', icone: 'escudo', texto: 'Cuidados durante o uso: ' + (acharCuidado(cuidados, ['atenção']) || FALLBACK.cuidadosUso) });
  b.push({ tipo: 'item', icone: 'relogio', texto: 'Cuidados após a aplicação: mantenha crianças e animais afastados até a secagem completa, e ventile bem o ambiente se aplicado em local fechado.' });
  b.push({ tipo: 'item', icone: 'caixa', texto: 'Armazenamento: ' + FALLBACK.armazenamento });

  b.push({ tipo: 'caixa', estilo: 'dica', titulo: 'Descarte correto', texto: FALLBACK.ambiental });
  b.push({ tipo: 'caixa', estilo: 'atencao', titulo: 'Primeiros socorros', texto: 'Em caso de contato acidental, ingestão ou reação adversa, siga imediatamente as instruções de primeiros socorros impressas na embalagem e procure atendimento médico (emergência: 192), levando a embalagem do produto para identificação.' });

  b.push({ tipo: 'faq', perguntas: FAQ_POR_CATEGORIA['controle-pragas'] });
  b.push({ tipo: 'caixa', estilo: 'atencao', titulo: 'Advertências importantes', texto: AVISO_FINAL });
  return b;
}

function montarBlocos(produto, pv) {
  if (pv.categoriaSlug === 'adubos') return montarBlocosAdubo(produto, pv);
  if (pv.categoriaSlug === 'controle-pragas') return montarBlocosPraga(produto, pv);
  return montarBlocosPlanta(produto, pv);
}

function montarChamada(pv) {
  if (pv.categoriaSlug === 'adubos') return 'Como usar o ' + pv.nome + ' corretamente';
  if (pv.categoriaSlug === 'controle-pragas') return 'Como usar o ' + pv.nome + ' com segurança';
  return 'Como cuidar da sua ' + pv.nome;
}

function gerarGuiaProdutoPdfBuffer(produto) {
  return new Promise((resolve, reject) => {
    try {
      const pv = montarProdutoView(produto);
      const categoriaLabel = RES_CATEGORIA[pv.categoriaSlug] || pv.categoriaNome || 'Produto';
      const kicker = KICKER_CATEGORIA[pv.categoriaSlug] || 'JARDINAGEM';
      const blocos = montarBlocos(produto, pv);

      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const larguraUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const xEsq = doc.page.margins.left;
      const yMax = () => doc.page.height - doc.page.margins.bottom;

      // PÁGINA 1 — abertura estilo revista
      doc.fillColor(CINZA_CLARO).font('Helvetica-Bold').fontSize(9)
        .text(kicker, xEsq, 50, { characterSpacing: 1.2 });
      doc.fillColor(DOURADO).font('Helvetica-Bold').fontSize(9)
        .text(categoriaLabel.toUpperCase(), xEsq, 50, { width: larguraUtil, align: 'right', characterSpacing: 1.2 });
      doc.strokeColor(LINHA).lineWidth(1).moveTo(xEsq, 66).lineTo(xEsq + larguraUtil, 66).stroke();

      let y = 84;
      const chamada = montarChamada(pv);
      doc.fillColor(VERDE).font('Times-BoldItalic').fontSize(27).text(chamada, xEsq, y, { width: larguraUtil });
      y += doc.heightOfString(chamada, { width: larguraUtil, font: 'Times-BoldItalic', fontSize: 27 }) + 18;

      const imagemPath = produto.imagem ? path.join(IMAGENS_DIR, produto.imagem) : null;
      const tamanhoFoto = 168;
      const xFoto = (doc.page.width - tamanhoFoto) / 2;
      doc.roundedRect(xFoto - 10, y - 10, tamanhoFoto + 20, tamanhoFoto + 20, 12).fill(CREME);
      if (imagemPath && fs.existsSync(imagemPath)) {
        try { doc.image(imagemPath, xFoto, y, { fit: [tamanhoFoto, tamanhoFoto], align: 'center', valign: 'center' }); }
        catch {   }
      }
      y += tamanhoFoto + 26;

      const intro = 'Neste guia ilustrado da ' + NOME_LOJA + ' você encontra tudo o que precisa saber sobre ' +
        (pv.categoriaSlug === 'plantas' ? 'a ' : 'o ') + pv.nome + (pv.descricao ? ': ' + pv.descricao : '.') +
        ' Preparamos um passo a passo completo, com dicas, avisos importantes e curiosidades, para você aproveitar o produto com segurança e confiança.';
      doc.font('Helvetica').fontSize(10.5).fillColor(CINZA).text(intro, xEsq, y, { width: larguraUtil, align: 'justify', lineGap: 2 });
      y += doc.heightOfString(intro, { width: larguraUtil, lineGap: 2 }) + 18;

      const resumoFinalidade = pv.categoriaSlug === 'plantas'
        ? 'Planta ornamental para cultivo residencial, com cuidados detalhados de rega, luz e solo neste guia.'
        : (acharFicha(pv.ficha, ['uso', 'finalidade']) || 'Consulte a embalagem para a finalidade exata indicada pelo fabricante.');
      const resumoBeneficio = pv.beneficios || (pv.categoriaSlug === 'plantas'
        ? 'Traz mais vida, cor e bem-estar para o seu ambiente.'
        : 'Veja a seção "Benefícios"/"Dicas" deste guia para saber mais.');
      const alturaCaixaResumo = desenharCaixaResumo(doc, xEsq, y, larguraUtil, resumoFinalidade, resumoBeneficio);
      y += alturaCaixaResumo + 20;

      // Índice
      const titulosSecao = blocos.filter((bl) => bl.tipo === 'secao').map((bl) => bl.titulo);
      if (titulosSecao.length && y < yMax() - 60) {
        doc.fillColor(VERDE).font('Helvetica-Bold').fontSize(11).text('Neste guia você vai encontrar', xEsq, y);
        y += 18;
        doc.font('Helvetica').fontSize(9.5);
        titulosSecao.forEach((t) => {
          if (y > yMax() - 14) return;
          doc.fillColor(DOURADO).text('•', xEsq, y);
          doc.fillColor(CINZA).text(t, xEsq + 12, y, { width: larguraUtil - 12 });
          y += 15;
        });
      }

      doc.addPage();
      y = doc.page.margins.top;
      const gapColunas = 22;
      const larguraColuna = (larguraUtil - gapColunas) / 2;
      const xColEsq = xEsq;
      const xColDir = xEsq + larguraColuna + gapColunas;
      let yEsq = y, yDir = y;

      function garantirEspaco(altura) {
        if (Math.min(yEsq, yDir) + altura > yMax()) {
          doc.addPage();
          yEsq = doc.page.margins.top;
          yDir = doc.page.margins.top;
        }
      }

      blocos.forEach((bloco) => {
        if (bloco.tipo === 'secao') {
          garantirEspaco(30);
          const yBase = Math.max(yEsq, yDir);
          doc.rect(xEsq, yBase, 4, 16).fill(DOURADO);
          doc.fillColor(VERDE).font('Helvetica-Bold').fontSize(13.5).text(bloco.titulo, xEsq + 12, yBase - 1, { width: larguraUtil - 12 });
          yEsq = yDir = yBase + 26;
          return;
        }

        if (bloco.tipo === 'item') {
          doc.font('Helvetica').fontSize(9.3);
          const alturaTexto = doc.heightOfString(bloco.texto, { width: larguraColuna, lineGap: 1.5 });
          const alturaBloco = 22 + 8 + alturaTexto + 16;
          garantirEspaco(alturaBloco);
          const usarEsq = yEsq <= yDir;
          const xCol = usarEsq ? xColEsq : xColDir;
          let yCol = usarEsq ? yEsq : yDir;

          badgeIcone(doc, xCol + 14, yCol + 14, 14, VERDE_MEDIO, ICONES[bloco.icone] || ICONES.folha);
          yCol += 34;
          doc.font('Helvetica').fontSize(9.3).fillColor(CINZA).text(bloco.texto, xCol, yCol, { width: larguraColuna, lineGap: 1.5 });
          yCol += alturaTexto + 16;

          if (usarEsq) yEsq = yCol; else yDir = yCol;
          return;
        }

        if (bloco.tipo === 'caixa') {
          const yBase = Math.max(yEsq, yDir);
          doc.font('Helvetica').fontSize(9.5);
          const alturaTexto = doc.heightOfString(bloco.texto, { width: larguraUtil - 70, lineGap: 1.5 });
          const alturaCaixa = Math.max(60, 30 + alturaTexto + 16);
          garantirEspaco(alturaCaixa + 16);
          const yReal = Math.max(yEsq, yDir);
          desenharCaixaDestaque(doc, xEsq, yReal, larguraUtil, bloco.estilo, bloco.titulo, bloco.texto, alturaCaixa);
          yEsq = yDir = yReal + alturaCaixa + 16;
          return;
        }

        if (bloco.tipo === 'faq') {
          const yBase = Math.max(yEsq, yDir);
          const alturaCaixa = alturaFaq(doc, larguraUtil, bloco.perguntas);
          garantirEspaco(alturaCaixa + 16);
          const yReal = Math.max(yEsq, yDir);
          desenharFaq(doc, xEsq, yReal, larguraUtil, bloco.perguntas, alturaCaixa);
          yEsq = yDir = yReal + alturaCaixa + 16;
          return;
        }

        if (bloco.tipo === 'calendario') {
          garantirEspaco(110);
          const yReal = Math.max(yEsq, yDir);
          desenharCalendario(doc, xEsq, yReal, larguraUtil, bloco.itens);
          yEsq = yDir = yReal + 110;
          return;
        }
      });

      adicionarRodapes(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function desenharCaixaResumo(doc, x, y, largura, finalidade, beneficio) {
  doc.font('Helvetica-Bold').fontSize(9.5);
  const alturaF = doc.heightOfString('Finalidade: ' + finalidade, { width: largura - 30, lineGap: 1.5 });
  const alturaB = doc.heightOfString('Benefícios: ' + beneficio, { width: largura - 30, lineGap: 1.5 });
  const altura = 20 + alturaF + alturaB + 24;

  doc.roundedRect(x, y, largura, altura, 10).fill(VERDE_CLARO_BG);
  doc.rect(x, y, 4, altura).fill(VERDE_MEDIO);
  doc.fillColor(VERDE).font('Helvetica-Bold').fontSize(10).text('RESUMO RÁPIDO', x + 16, y + 12, { characterSpacing: 0.6 });
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(VERDE_MEDIO).text('Finalidade: ', x + 16, y + 30, { continued: true, width: largura - 30 })
    .font('Helvetica').fillColor(CINZA).text(finalidade);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(VERDE_MEDIO).text('Benefícios: ', x + 16, y + 30 + alturaF + 6, { continued: true, width: largura - 30 })
    .font('Helvetica').fillColor(CINZA).text(beneficio);
  return altura;
}

function desenharCaixaDestaque(doc, x, y, largura, estilo, titulo, texto, altura) {
  const cor = COR_ESTILO[estilo] || COR_ESTILO.dica;
  doc.roundedRect(x, y, largura, altura, 10).fill(cor.bg);
  doc.rect(x, y, 4, altura).fill(cor.faixa);
  badgeIcone(doc, x + 30, y + 24, 14, cor.faixa, ICONES[ICONE_ESTILO[estilo]] || ICONES.lampada);
  doc.fillColor(cor.titulo).font('Helvetica-Bold').fontSize(10.5).text(titulo, x + 54, y + 16, { width: largura - 70 });
  doc.font('Helvetica').fontSize(9.5).fillColor(CINZA).text(texto, x + 54, y + 32, { width: largura - 70, lineGap: 1.5 });
}

function alturaFaq(doc, largura, perguntas) {
  let altura = 42;
  doc.font('Helvetica-Bold').fontSize(9.5);
  perguntas.forEach((f) => {
    altura += doc.heightOfString(f.p, { width: largura - 70 }) + 4;
    doc.font('Helvetica').fontSize(9.3);
    altura += doc.heightOfString(f.r, { width: largura - 70, lineGap: 1.5 }) + 12;
    doc.font('Helvetica-Bold').fontSize(9.5);
  });
  return altura;
}
function desenharFaq(doc, x, y, largura, perguntas, altura) {
  doc.roundedRect(x, y, largura, altura, 10).fill(BRANCO);
  doc.strokeColor(LINHA).lineWidth(1).roundedRect(x, y, largura, altura, 10).stroke();
  badgeIcone(doc, x + 30, y + 26, 14, VERDE_MEDIO, ICONES.duvida);
  doc.fillColor(VERDE).font('Helvetica-Bold').fontSize(11).text('Perguntas frequentes', x + 54, y + 18);
  let yy = y + 44;
  perguntas.forEach((f) => {
    doc.fillColor(VERDE_MEDIO).font('Helvetica-Bold').fontSize(9.5).text(f.p, x + 24, yy, { width: largura - 48 });
    yy += doc.heightOfString(f.p, { width: largura - 48 }) + 4;
    doc.fillColor(CINZA).font('Helvetica').fontSize(9.3).text(f.r, x + 24, yy, { width: largura - 48, lineGap: 1.5 });
    yy += doc.heightOfString(f.r, { width: largura - 48, lineGap: 1.5 }) + 12;
  });
}

function desenharCalendario(doc, x, y, largura, itens) {
  doc.fillColor(VERDE).font('Helvetica-Bold').fontSize(11).text('Calendário de manutenção', x, y);
  const yTopo = y + 20;
  const gap = 10;
  const larguraCard = (largura - gap * (itens.length - 1)) / itens.length;
  itens.forEach((it, i) => {
    const xCard = x + i * (larguraCard + gap);
    doc.roundedRect(xCard, yTopo, larguraCard, 78, 8).fill(CREME);
    doc.rect(xCard, yTopo, larguraCard, 20).fill(VERDE_MEDIO);
    doc.fillColor(BRANCO).font('Helvetica-Bold').fontSize(8.5).text(it.estacao.toUpperCase(), xCard, yTopo + 6, { width: larguraCard, align: 'center', characterSpacing: 0.4 });
    doc.fillColor(CINZA).font('Helvetica').fontSize(8).text(it.tarefa, xCard + 8, yTopo + 28, { width: larguraCard - 16, align: 'center', lineGap: 1 });
  });
}

function adicionarRodapes(doc) {
  const paginas = doc.bufferedPageRange();
  const larguraUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const xEsq = doc.page.margins.left;
  for (let i = 1; i < paginas.count; i++) {
    doc.switchToPage(i);
    const margemOriginal = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = doc.page.height - margemOriginal + 12;
    doc.fillColor(CINZA_CLARO).font('Helvetica').fontSize(8)
      .text(`${NOME_LOJA} · Página ${i} de ${paginas.count - 1}`, xEsq, y, { width: larguraUtil, align: 'center' });
    doc.page.margins.bottom = margemOriginal;
  }
}

module.exports = { gerarGuiaProdutoPdfBuffer, CATEGORIAS_PERMITIDAS };
