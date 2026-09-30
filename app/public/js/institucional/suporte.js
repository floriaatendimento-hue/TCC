(function () {
  'use strict';

  const ctx = window.__suporteContexto || {};
  const FRETE = ctx.freteGratisAcima || 'o valor mínimo definido pela loja';

  const ICONES = {
    pedido: 'fas fa-box',
    entrega: 'fas fa-truck',
    produto: 'fas fa-seedling',
    pagamento: 'fas fa-credit-card',
    conta: 'far fa-user',
    outras: 'far fa-question-circle',
  };

  const CATEGORIAS = [
    {
      id: 'pedido',
      label: 'Pedido',
      problemas: [
        { id: 'acompanhar', titulo: 'Como acompanho meu pedido?',
          texto: 'Acesse Minha conta → Pedidos e abra o pedido desejado. A página mostra a linha do tempo completa (confirmado, em preparação, enviado, em transporte, saiu para entrega e entregue), além do código de rastreio, quando disponível.' },
        { id: 'comprovante', titulo: 'Onde encontro o comprovante da minha compra?',
          texto: 'Na página do pedido há as opções "Visualizar comprovante", "Baixar comprovante (PDF)" e "Enviar comprovante por e-mail", disponíveis a qualquer momento após a compra.' },
        { id: 'cancelado', titulo: 'Meu pedido foi cancelado',
          texto: 'Pedidos cancelados mostram o motivo na própria página do pedido, logo abaixo do título. Se você não reconhece esse cancelamento ou o motivo não ficou claro, verifique os detalhes com calma antes de prosseguir.' },
        { id: 'quero-cancelar', titulo: 'Quero cancelar meu pedido',
          texto: 'Você pode cancelar um pedido enquanto ele estiver em preparação ou já enviado, antes de sair para entrega. O botão "Cancelar pedido" fica na própria página do pedido. Depois que ele sai para entrega, o cancelamento não é mais automático pelo site.' },
        { id: 'quero-alterar', titulo: 'Quero alterar meu pedido (endereço, itens ou forma de pagamento)',
          texto: 'Não é possível editar um pedido já finalizado diretamente pelo site. Se ele ainda estiver em preparação, fale com a nossa equipe o quanto antes informando o número do pedido e o que precisa ser alterado. Quanto mais cedo, maior a chance de ajustarmos a tempo.',
          requerContato: true },
        { id: 'parcial', titulo: 'Recebi apenas parte do pedido',
          texto: 'Confira a lista de produtos e o status na página do pedido. Se algum item consta como enviado separadamente, isso aparece na linha do tempo; caso contrário, avalie com atenção o que foi recebido antes de prosseguir.' },
        { id: 'info-incorreta', titulo: 'Meu pedido está com informações incorretas',
          texto: 'Verifique o endereço, os itens e os valores na página do pedido: esses dados refletem exatamente o que foi confirmado na compra. Se algo estiver diferente do que você comprou, isso precisa ser conferido com mais detalhes.' },
      ],
    },
    {
      id: 'entrega',
      label: 'Entrega',
      problemas: [
        { id: 'frete', titulo: 'Como é calculado o frete?',
          texto: 'O frete é calculado no carrinho a partir do seu CEP. Compras acima de ' + FRETE + ' têm frete grátis.' },
        { id: 'rastreio', titulo: 'Como rastreio minha entrega?',
          texto: 'Assim que o pedido é enviado, um código de rastreio aparece na página do pedido, na seção "Entrega".' },
        { id: 'atrasado', titulo: 'Meu pedido está atrasado',
          texto: 'Confira a previsão de entrega e o código de rastreio na página do pedido. Se o prazo já passou, isso não é o esperado; vale a pena verificar com mais atenção.' },
        { id: 'passou-prazo', titulo: 'Já passou da data de entrega e meu pedido não chegou',
          texto: 'A previsão de entrega fica na página do pedido, na seção "Entrega". Se essa data já passou e o pedido não chegou, o ideal é confirmar a situação com a nossa equipe.' },
        { id: 'entregue-nao-recebi', titulo: 'Meu pedido aparece como entregue, mas não recebi',
          texto: 'Confira primeiro com outras pessoas do endereço, porteiro ou vizinhos, e o entorno do local de entrega. O status de entregue não pode ser revertido automaticamente pelo site. Se você realmente não localizar o pedido, esse caso precisa ser verificado diretamente com a nossa equipe.',
          requerContato: true },
        { id: 'parado-transporte', titulo: 'Meu pedido está parado no transporte',
          texto: 'Acompanhe a movimentação pelo código de rastreio na página do pedido. Pequenas pausas durante o transporte são normais; se o código não mostrar nenhuma movimentação por vários dias, vale a pena confirmar o que está havendo.' },
        { id: 'nao-consigo-acompanhar', titulo: 'Não consigo acompanhar meu pedido',
          texto: 'Acesse Minha conta → Pedidos com o mesmo login usado na compra. Se o pedido não aparecer, confira se está usando o e-mail correto da conta.' },
      ],
    },
    {
      id: 'produto',
      label: 'Produto',
      problemas: [
        { id: 'guia-cuidado', titulo: 'Onde encontro orientações de cuidado de uma planta?',
          texto: 'As páginas de plantas, adubos e produtos para controle de pragas trazem um guia de cuidados, com opção de baixar em PDF. O link também aparece nos itens do seu pedido depois da compra.' },
        { id: 'avaliar', titulo: 'Como avalio um produto que comprei?',
          texto: 'Depois que o pedido é entregue, use "Avaliar produtos" na página do pedido ou a seção de avaliações da própria página do produto, onde dá para enviar nota, comentário e fotos.' },
        { id: 'favoritos', titulo: 'Como salvo um produto nos favoritos?',
          texto: 'Clique no ícone de coração em qualquer produto. Seus favoritos ficam reunidos em Minha conta → Favoritos.' },
        { id: 'quebrado', titulo: 'Meu produto veio quebrado', requerContato: true,
          texto: 'Sentimos muito pelo ocorrido. Esse tipo de situação precisa ser resolvida diretamente com a nossa equipe. Separe o número do pedido e, se possível, fotos do produto e da embalagem: elas ajudam bastante a agilizar o atendimento pelo WhatsApp ou e-mail.' },
        { id: 'danificado', titulo: 'Meu produto veio danificado', requerContato: true,
          texto: 'Sentimos muito pelo ocorrido. Separe o número do pedido e, se possível, fotos do produto e da embalagem, e fale com a nossa equipe: vamos resolver diretamente com você.' },
        { id: 'estragado', titulo: 'Meu produto veio estragado', requerContato: true,
          texto: 'No caso de plantas, isso pode acontecer por conta do transporte. Separe o número do pedido e, se possível, fotos do produto recebido, e fale com a nossa equipe para resolvermos da melhor forma.' },
        { id: 'defeito', titulo: 'Meu produto veio com defeito', requerContato: true,
          texto: 'Descreva o que não está funcionando corretamente e, se possível, envie fotos ou um vídeo curto mostrando o problema. Tenha o número do pedido em mãos ao falar com a nossa equipe.' },
        { id: 'diferente', titulo: 'Recebi um produto diferente do que comprei', requerContato: true,
          texto: 'Confira os itens registrados na página do pedido para confirmar o que foi comprado. Se o que chegou realmente for diferente, fale com a nossa equipe informando o número do pedido e, se possível, uma foto do produto recebido.' },
        { id: 'faltando', titulo: 'Faltou algum produto no meu pedido', requerContato: true,
          texto: 'Confira a lista completa de itens na página do pedido. Se algum item comprado não veio na entrega, fale com a nossa equipe informando o número do pedido e o produto que faltou.' },
        { id: 'condicoes-inadequadas', titulo: 'Meu produto chegou em condições inadequadas', requerContato: true,
          texto: 'Isso pode acontecer por conta do transporte. Fale com a nossa equipe informando o número do pedido (se possível, com fotos do produto e da embalagem) para resolvermos da melhor forma.' },
        { id: 'troca-devolucao', titulo: 'Como solicito troca ou devolução depois de receber o produto?', requerContato: true,
          texto: 'Fale com a nossa equipe pelo WhatsApp ou e-mail informando o número do pedido e o motivo: vamos orientar os próximos passos.' },
      ],
    },
    {
      id: 'pagamento',
      label: 'Pagamento',
      problemas: [
        { id: 'verificar', titulo: 'Como verifico meu pagamento?',
          texto: 'Na página do pedido, o status de pagamento aparece como aguardando, em processamento, pago, recusado, expirado ou reembolsado. Pagamentos via Pix ou boleto são confirmados automaticamente assim que identificados, sem precisar reenviar nada.' },
        { id: 'formas', titulo: 'Quais formas de pagamento a Floria aceita?',
          texto: 'Pix, boleto e cartão (à vista ou parcelado, conforme exibido no checkout). A forma escolhida e as parcelas ficam registradas no resumo financeiro do pedido.' },
        { id: 'recusado', titulo: 'Meu pagamento foi recusado',
          texto: 'Revise os dados do cartão ou tente outra forma de pagamento na página do pedido. Se o problema continuar mesmo depois de revisar os dados, vale a pena verificar com mais atenção.' },
        { id: 'pagou-mas-pendente', titulo: 'Eu paguei pelo produto, mas o site informa que não foi pago',
          texto: 'Pagamentos por Pix ou boleto podem levar alguns instantes para serem confirmados. A página do pedido é atualizada automaticamente assim que identificamos o pagamento, sem precisar reenviar nada. Verifique o status atualizado na página do pedido antes de mais nada.' },
        { id: 'aprovado-nao-atualizado', titulo: 'Meu pagamento foi aprovado, mas o pedido não foi atualizado',
          texto: 'O status de pagamento e a etapa do pedido são informações independentes: o pagamento pode já constar como "Pago" enquanto o pedido ainda está "Em preparação"; isso é esperado até a loja processar o envio. Confira os dois status na página do pedido antes de mais nada.' },
        { id: 'cobrado-nao-aparece', titulo: 'Fui cobrado, mas meu pedido não aparece como pago',
          texto: 'Confira primeiro o status de pagamento na página do pedido: ele é atualizado automaticamente pelo nosso sistema assim que a cobrança é confirmada. Se a cobrança já apareceu na sua fatura ou extrato e o pedido continuar como pendente, tenha o comprovante em mãos para falar com a nossa equipe.' },
        { id: 'problema-durante', titulo: 'Tive um problema durante o pagamento',
          texto: 'Se a tela travou, apresentou erro ou você não recebeu confirmação, primeiro confira o status na página do pedido: ele pode ter sido concluído mesmo com uma falha visual. Se o pedido não aparecer na sua conta, isso precisa ser verificado com mais atenção.' },
      ],
    },
    {
      id: 'conta',
      label: 'Conta',
      problemas: [
        { id: 'alterar-dados', titulo: 'Como altero meus dados cadastrais ou endereço?',
          texto: 'Em Minha conta → Meus dados você atualiza nome, e-mail, telefone e foto. Endereços de entrega ficam em Minha conta → Endereços.' },
        { id: 'trocar-senha', titulo: 'Como troco minha senha?',
          texto: 'Em Minha conta → Meus dados há um campo para trocar a senha, informando a senha atual e a nova.' },
        { id: 'nao-consigo-entrar', titulo: 'Não consigo entrar na minha conta',
          texto: 'Confira se o e-mail e a senha digitados estão corretos, sem espaços extras ou tecla Caps Lock ativada. Se continuar sem conseguir acessar, vamos te ajudar a recuperar o acesso.',
          requerContato: true },
        { id: 'esqueci-senha', titulo: 'Esqueci minha senha',
          texto: 'Se você ainda está logado em algum dispositivo, é possível trocar a senha em Minha conta → Meus dados. Se não conseguir acessar a conta de forma alguma, fale com a nossa equipe informando o e-mail cadastrado.',
          requerContato: true },
        { id: 'nao-consigo-alterar', titulo: 'Não consigo alterar meus dados',
          texto: 'Confira se todos os campos obrigatórios do formulário foram preenchidos corretamente em Minha conta → Meus dados. Se a alteração continuar não sendo salva, descreva o que você tentou alterar para a nossa equipe.' },
        { id: 'email-incorreto', titulo: 'Meu e-mail está incorreto',
          texto: 'Você pode corrigir o e-mail cadastrado em Minha conta → Meus dados. Se o e-mail incorreto estiver impedindo o seu acesso à conta, fale com a nossa equipe para ajudarmos a corrigir.',
          requerContato: true },
        { id: 'outro-conta', titulo: 'Tenho outro problema com minha conta', requerContato: true,
          texto: 'Descreva a situação para a nossa equipe, informando seu nome e o e-mail cadastrado: vamos analisar o que houve.' },
      ],
    },
    {
      id: 'outras',
      label: 'Outras dúvidas',
      problemas: [
        { id: 'cupom', titulo: 'Como aplico um cupom de desconto?',
          texto: 'No carrinho, há um campo para inserir o código do cupom antes de finalizar a compra. O desconto aplicado fica registrado no resumo financeiro do pedido.' },
        { id: 'nivel', titulo: 'Como funciona o nível de cliente?',
          texto: 'Seu nível evolui de acordo com o total já comprado na Floria e aparece em Minha conta. Cada faixa pode trazer benefícios diferentes, definidos pela loja.' },
      ],
    },
  ];

  const filtro       = document.getElementById('suporte-filtro');
  const pedidoBloco  = document.getElementById('suporte-pedido-bloco');
  const pedidoSelect = document.getElementById('suporte-pedido-select');
  const lista        = document.getElementById('suporte-lista');

  if (!lista) return;

  let pedidosPromise = null;

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function fmtMoeda(v) {
    return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
  }

  function carregarPedidos() {
    if (pedidosPromise) return pedidosPromise;
    if (!ctx.logado) { pedidosPromise = Promise.resolve([]); return pedidosPromise; }
    pedidosPromise = fetch('/api/meus-pedidos')
      .then((r) => r.json())
      .then((data) => (data && data.ok && Array.isArray(data.data)) ? data.data : [])
      .catch(() => []);
    return pedidosPromise;
  }

  function pedidoSelecionadoId() {
    return pedidoSelect ? (pedidoSelect.value || '') : '';
  }

  function montarLinkWhatsapp(problema) {
    const pid = pedidoSelecionadoId();
    let msg = (ctx.whatsapp && ctx.whatsapp.mensagemBase) || '';
    msg += 'Problema: ' + problema.titulo + '. ';
    if (pid) msg += 'Pedido #' + pid + '. ';
    const numero = (ctx.whatsapp && ctx.whatsapp.numero) || '';
    return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(msg);
  }

  function montarLinkEmail(problema) {
    const pid = pedidoSelecionadoId();
    const assunto = 'Solicitação de suporte - ' + problema.titulo + (pid ? ' (Pedido #' + pid + ')' : '');
    let corpo = 'Olá, equipe Floria,\n\n';
    if (pid) corpo += 'Pedido: #' + pid + '\n';
    corpo += 'Assunto: ' + problema.titulo + '\n\nDescreva aqui mais detalhes do que aconteceu:\n\n';
    return 'mailto:' + ctx.email + '?subject=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(corpo);
  }

  function botoesContatoHtml() {
    return (
      '<section class="suporte-guia-contato-acoes">' +
        '<a class="suporte-contato-btn suporte-contato-btn--whatsapp suporte-contato-btn--sm" data-acao="whatsapp" target="_blank" rel="noopener noreferrer">' +
          '<i class="fab fa-whatsapp" aria-hidden="true"></i> Falar pelo WhatsApp' +
        '</a>' +
        '<a class="suporte-contato-btn suporte-contato-btn--email suporte-contato-btn--sm" data-acao="email">' +
          '<i class="fas fa-envelope" aria-hidden="true"></i> Enviar um e-mail' +
        '</a>' +
      '</section>'
    );
  }

  function ligarBotoesContato(escopo, problema) {
    const w = escopo.querySelector('[data-acao="whatsapp"]');
    const e = escopo.querySelector('[data-acao="email"]');
    if (w) w.href = montarLinkWhatsapp(problema);
    if (e) e.href = montarLinkEmail(problema);
  }

  function respostaHtml(problema) {
    if (problema.requerContato) {
      return (
        '<p>' + escHtml(problema.texto) + '</p>' +
        '<section class="suporte-guia-contato">' +
          '<p class="suporte-guia-aviso">Essa situação precisa ser resolvida diretamente com a nossa equipe.</p>' +
          botoesContatoHtml() +
        '</section>'
      );
    }
    return (
      '<p>' + escHtml(problema.texto) + '</p>' +
      '<section class="suporte-guia-gate">' +
        '<p class="suporte-guia-gate-pergunta">O problema continua?</p>' +
        '<section class="suporte-guia-gate-botoes">' +
          '<button type="button" class="suporte-gate-btn" data-resposta="nao">Não, foi resolvido</button>' +
          '<button type="button" class="suporte-gate-btn" data-resposta="sim">Sim, continua</button>' +
        '</section>' +
        '<section class="suporte-guia-resultado" hidden></section>' +
      '</section>'
    );
  }

  function encontrarProblema(catId, probId) {
    const cat = CATEGORIAS.find((c) => c.id === catId);
    return cat && cat.problemas.find((p) => p.id === probId);
  }

  function renderLista() {
    lista.innerHTML = CATEGORIAS.map((cat) => (
      '<section class="suporte-categoria-bloco" data-cat="' + cat.id + '">' +
        '<h3><i class="' + (ICONES[cat.id] || '') + '" aria-hidden="true"></i> ' + escHtml(cat.label) + '</h3>' +
        '<section class="suporte-problemas-lista">' +
          cat.problemas.map((p) => (
            '<details class="suporte-problema-item" data-cat="' + cat.id + '" data-prob="' + p.id + '">' +
              '<summary>' + escHtml(p.titulo) + '</summary>' +
              '<section class="suporte-problema-resposta">' + respostaHtml(p) + '</section>' +
            '</details>'
          )).join('') +
        '</section>' +
      '</section>'
    )).join('');

    lista.querySelectorAll('.suporte-problema-item').forEach((det) => {
      const problema = encontrarProblema(det.dataset.cat, det.dataset.prob);
      if (!problema) return;

      ligarBotoesContato(det, problema);

      const resultado = det.querySelector('.suporte-guia-resultado');
      det.querySelectorAll('.suporte-gate-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          det.querySelectorAll('.suporte-gate-btn').forEach((b) => b.classList.remove('ativo'));
          btn.classList.add('ativo');
          resultado.hidden = false;
          if (btn.dataset.resposta === 'nao') {
            resultado.innerHTML = '<p class="suporte-resolvido"><i class="fas fa-check-circle" aria-hidden="true"></i> Que bom! Ficamos felizes em ajudar.</p>';
          } else {
            resultado.innerHTML =
              '<p class="suporte-guia-aviso">Se você já tentou essas soluções e ainda precisa de ajuda, entre em contato com a nossa equipe:</p>' +
              botoesContatoHtml();
            ligarBotoesContato(resultado, problema);
          }
        });
      });
    });
  }

  function atualizarTodosOsLinksDeContato() {
    lista.querySelectorAll('.suporte-problema-item').forEach((det) => {
      const problema = encontrarProblema(det.dataset.cat, det.dataset.prob);
      if (problema) ligarBotoesContato(det, problema);
    });
  }

  function aplicarFiltro(catId) {
    lista.querySelectorAll('.suporte-categoria-bloco').forEach((bloco) => {
      bloco.hidden = catId !== 'todas' && bloco.dataset.cat !== catId;
    });
    if (filtro) {
      filtro.querySelectorAll('.suporte-filtro-chip').forEach((btn) => {
        const ativa = btn.dataset.cat === catId;
        btn.classList.toggle('ativa', ativa);
        btn.setAttribute('aria-pressed', String(ativa));
      });
    }
  }

  function carregarESelecionarPedidos() {
    if (!pedidoBloco || !pedidoSelect) return;
    if (!ctx.logado) { pedidoBloco.hidden = true; return; }
    pedidoBloco.hidden = false;
    pedidoSelect.innerHTML = '<option value="">Carregando seus pedidos…</option>';
    carregarPedidos().then((pedidos) => {
      if (!pedidos.length) { pedidoBloco.hidden = true; return; }
      pedidoSelect.innerHTML = '<option value="">Não é sobre um pedido específico</option>' +
        pedidos.map((p) => '<option value="' + p.id + '">Pedido #' + p.id + ' - ' + fmtMoeda(p.total) + '</option>').join('');
      if (ctx.pedidoInicial && pedidos.some((p) => String(p.id) === String(ctx.pedidoInicial.id))) {
        pedidoSelect.value = String(ctx.pedidoInicial.id);
      }
      atualizarTodosOsLinksDeContato();
    });
  }

  if (filtro) {
    filtro.querySelectorAll('.suporte-filtro-chip').forEach((btn) => {
      btn.addEventListener('click', () => aplicarFiltro(btn.dataset.cat));
    });
  }

  if (pedidoSelect) {
    pedidoSelect.addEventListener('change', atualizarTodosOsLinksDeContato);
  }

  renderLista();
  carregarESelecionarPedidos();

  if (ctx.pedidoInicial) {
    aplicarFiltro('pedido');
    const bloco = lista.querySelector('.suporte-categoria-bloco[data-cat="pedido"]');
    if (bloco) bloco.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
})();
