'use strict';

const CUIDADOS_PADRAO = {
  plantas: [
    { icone: 'fas fa-sun', titulo: 'Luz', texto: 'Posicione em local com boa luminosidade, de preferência luz indireta.' },
    { icone: 'fas fa-tint', titulo: 'Rega', texto: 'Regue quando os primeiros centímetros do substrato estiverem secos.' },
    { icone: 'fas fa-thermometer-half', titulo: 'Temperatura', texto: 'Mantenha entre 18°C e 28°C, protegida de frio intenso e correntes de ar.' },
    { icone: 'fas fa-exclamation-triangle', titulo: 'Atenção', texto: 'Verifique periodicamente pragas e folhas amareladas.' },
  ],
  vasos: [
    { icone: 'fas fa-cube', titulo: 'Material', texto: 'Verifique a resistência do material a sol, chuva e variações de temperatura.' },
    { icone: 'fas fa-ruler-combined', titulo: 'Capacidade', texto: 'Escolha o porte adequado ao tamanho da planta e de suas raízes.' },
    { icone: 'fas fa-tint', titulo: 'Drenagem', texto: 'Utilize um prato coletor quando não houver escoamento direto para o solo.' },
    { icone: 'fas fa-broom', titulo: 'Limpeza', texto: 'Limpe com pano úmido e sabão neutro, evitando produtos abrasivos.' },
  ],
  ferramentas: [
    { icone: 'fas fa-hand-paper', titulo: 'Uso', texto: 'Utilize sempre com a proteção adequada e sobre superfície firme.' },
    { icone: 'fas fa-tools', titulo: 'Manutenção', texto: 'Limpe após o uso e lubrifique partes metálicas periodicamente.' },
    { icone: 'fas fa-warehouse', titulo: 'Armazenamento', texto: 'Guarde em local seco, longe da umidade, para evitar ferrugem.' },
    { icone: 'fas fa-exclamation-triangle', titulo: 'Atenção', texto: 'Mantenha fora do alcance de crianças.' },
  ],
  adubos: [
    { icone: 'fas fa-seedling', titulo: 'Modo de Uso', texto: 'Aplique diretamente no substrato, evitando contato direto com o caule.' },
    { icone: 'fas fa-weight-hanging', titulo: 'Dosagem', texto: 'Respeite a quantidade indicada na embalagem para o porte da planta.' },
    { icone: 'fas fa-calendar-alt', titulo: 'Frequência', texto: 'Reaplique conforme a periodicidade recomendada para cada espécie.' },
    { icone: 'fas fa-exclamation-triangle', titulo: 'Atenção', texto: 'Armazene em local seco e fora do alcance de crianças e animais.' },
  ],
  'controle-pragas': [
    { icone: 'fas fa-spray-can', titulo: 'Modo de Uso', texto: 'Aplique diretamente sobre a área afetada, preferencialmente ao entardecer.' },
    { icone: 'fas fa-weight-hanging', titulo: 'Dosagem', texto: 'Siga rigorosamente a diluição e a quantidade indicadas na embalagem.' },
    { icone: 'fas fa-calendar-alt', titulo: 'Frequência', texto: 'Repita a aplicação conforme a recorrência da praga, respeitando o intervalo indicado.' },
    { icone: 'fas fa-exclamation-triangle', titulo: 'Atenção', texto: 'Use proteção adequada durante a aplicação e mantenha longe de crianças e pets.' },
  ],
  _padrao: [
    { icone: 'fas fa-info-circle', titulo: 'Como Usar', texto: 'Siga as instruções da embalagem para o melhor resultado.' },
    { icone: 'fas fa-box', titulo: 'Conservação', texto: 'Mantenha em local apropriado, protegido de sol e umidade excessiva.' },
    { icone: 'fas fa-warehouse', titulo: 'Armazenamento', texto: 'Guarde em local seco e arejado quando não estiver em uso.' },
    { icone: 'fas fa-exclamation-triangle', titulo: 'Atenção', texto: 'Mantenha fora do alcance de crianças e animais de estimação.' },
  ],
};

function cuidadosPara(categoriaSlug) {
  return CUIDADOS_PADRAO[categoriaSlug] || CUIDADOS_PADRAO._padrao;
}

module.exports = { CUIDADOS_PADRAO, cuidadosPara };
