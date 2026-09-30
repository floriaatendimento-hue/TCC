(function () {
  'use strict';

  const csrf = document.getElementById('csrf-token')?.value || '';
  const { mostrarErroCampo, limparErroCampo, limparErrosDoEscopo } = window.PagamentoValidacao;
  const PagamentoCartao = window.PagamentoCartao;

  const chaveIdempotencia = (window.crypto && typeof window.crypto.randomUUID === 'function')
    ? window.crypto.randomUUID()
    : 'checkout-' + Date.now() + '-' + Math.random().toString(36).slice(2);

  let enderecosCheckout = [];
  let enderecoSelecionadoId = null;

  const ufsEntregaPermitidas = Array.isArray(window.__ufsEntregaPermitidas) ? window.__ufsEntregaPermitidas : [];
  function enderecoAtendido(endereco) {
    if (!endereco || !ufsEntregaPermitidas.length) return true;
    return ufsEntregaPermitidas.includes(String(endereco.uf || '').toUpperCase());
  }
  function enderecoSelecionadoAtual() {
    return enderecosCheckout.find((e) => e.id === enderecoSelecionadoId) || null;
  }

  function selecionarEndereco(id) {
    enderecoSelecionadoId = Number(id);
    document.querySelectorAll('#endereco-checkout-lista .endereco-opcao').forEach((el) => {
      const selecionado = Number(el.dataset.id) === enderecoSelecionadoId;
      el.classList.toggle('selecionado', selecionado);
      el.setAttribute('aria-checked', String(selecionado));
    });
    atualizarBotaoConfirmar();
    atualizarGatePagamento();
  }

  function renderizarEnderecosCheckout(preferId) {
    const carregando = document.getElementById('endereco-checkout-carregando');
    if (carregando) carregando.hidden = true;

    const vazio = document.getElementById('endereco-checkout-vazio');
    const lista = document.getElementById('endereco-checkout-lista');
    const btnOutro = document.getElementById('btn-endereco-checkout-outro');
    const { escHtml, formatarTelefone, iconeEndereco } = window.EnderecoUI;

    if (enderecosCheckout.length === 0) {
      vazio.hidden = false;
      lista.hidden = true;
      btnOutro.hidden = true;
      lista.innerHTML = '';
      enderecoSelecionadoId = null;
      atualizarBotaoConfirmar();
      atualizarGatePagamento();
      return;
    }

    vazio.hidden = true;
    lista.hidden = false;
    btnOutro.hidden = false;

    if (preferId && enderecosCheckout.some((e) => e.id === Number(preferId))) {
      enderecoSelecionadoId = Number(preferId);
    } else if (!enderecosCheckout.some((e) => e.id === enderecoSelecionadoId)) {
      const principal = enderecosCheckout.find((e) => e.padrao) || enderecosCheckout[0];
      enderecoSelecionadoId = principal.id;
    }

    lista.innerHTML = enderecosCheckout.map((e) => {
      const selecionado = e.id === enderecoSelecionadoId;
      const atendido = enderecoAtendido(e);
      return `
        <li class="endereco-opcao ${selecionado ? 'selecionado' : ''}${atendido ? '' : ' endereco-opcao--indisponivel'}" data-id="${e.id}"
            role="radio" aria-checked="${selecionado}" tabindex="0">
          <i class="endereco-opcao-radio" aria-hidden="true"></i>
          <i class="endereco-opcao-icone" aria-hidden="true">${iconeEndereco(e.rotulo)}</i>
          <section class="endereco-opcao-info">
            <strong>${escHtml(e.rotulo)}${e.padrao ? ' <mark class="badge-endereco-padrao">Principal</mark>' : ''}${atendido ? '' : ' <mark class="badge-endereco-indisponivel">Fora da área de entrega</mark>'}</strong>
            <p>${escHtml(e.logradouro)}, ${escHtml(e.numero)}${e.complemento ? ', ' + escHtml(e.complemento) : ''}</p>
            <p>${escHtml(e.bairro)}, ${escHtml(e.cidade)} - ${escHtml(e.uf)} · ${escHtml(e.cep)}</p>
            <p>${escHtml(e.destinatario)} · ${escHtml(formatarTelefone(e.telefone))}</p>
          </section>
        </li>`;
    }).join('');

    lista.querySelectorAll('.endereco-opcao').forEach((el) => {
      el.addEventListener('click', () => selecionarEndereco(el.dataset.id));
      el.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selecionarEndereco(el.dataset.id); }
      });
    });

    atualizarBotaoConfirmar();
    atualizarGatePagamento();
  }

  async function carregarEnderecosCheckout(preferId) {
    try {
      const resp = await fetch('/api/enderecos');
      const data = await resp.json();
      enderecosCheckout = data.ok ? data.enderecos : [];
    } catch {
      enderecosCheckout = [];
    }
    renderizarEnderecosCheckout(preferId);
  }

  function atualizarBotaoConfirmar() {
    const btn = document.getElementById('btn-confirmar');
    if (btn) btn.disabled = !enderecoSelecionadoId || !enderecoAtendido(enderecoSelecionadoAtual());
  }

  document.addEventListener('endereco:salvo', (ev) => carregarEnderecosCheckout(ev.detail?.id));
  carregarEnderecosCheckout();

  document.getElementById('btn-endereco-checkout-vazio-add')?.addEventListener('click', () => {
    window.location.href = '/enderecos/novo?next=%2Fpagamento';
  });

  function precoNum(v) { return Number(v) || 0; }
  function fmt(v) { return 'R$ ' + Number(v).toFixed(2).replace('.', ','); }

  let carrinho = [];
  try {
    carrinho = JSON.parse(sessionStorage.getItem('carrinho_checkout'))
            || JSON.parse(localStorage.getItem('carrinho'))
            || [];
  } catch { /* carrinho fica vazio */ }

  const resumoItens = document.getElementById('resumo-itens');
  const resumoSubtotal = document.getElementById('resumo-subtotal');
  const resumoTotal = document.getElementById('resumo-total');
  const resumoLinhaDesconto = document.getElementById('resumo-linha-desconto');
  const resumoDesconto = document.getElementById('resumo-desconto');
  const resumoCupomTag = document.getElementById('resumo-cupom-tag');

  let subtotal = 0;

  if (carrinho.length === 0) {
    resumoItens.innerHTML = '<p class="resumo-vazio">Nenhum item no carrinho.</p>';
  } else {
    carrinho.forEach((item) => {
      const preco = precoNum(item.preco);
      subtotal += preco * item.quantidade;
      const linha = document.createElement('p');
      linha.className = 'resumo-item-linha';
      const descricao = document.createElement('b');
      descricao.textContent = item.nome + (item.cor ? ' (' + item.cor + ')' : '') + ' × ' + item.quantidade;
      const valor = document.createElement('b');
      valor.textContent = fmt(preco * item.quantidade);
      linha.append(descricao, valor);
      resumoItens.appendChild(linha);
    });
  }

  const cupomFormEl = document.getElementById('cupom-checkout-form');
  const inputCupomEl = document.getElementById('input-cupom-checkout');
  const btnCupomEl = document.getElementById('btn-cupom-checkout');
  const cupomAplicadoEl = document.getElementById('cupom-checkout-aplicado');
  const cupomCodigoEl = document.getElementById('cupom-checkout-codigo');
  const cupomValorEl = document.getElementById('cupom-checkout-valor');
  const btnRemoverCupom = document.getElementById('btn-remover-cupom-checkout');
  const cupomMsgEl = document.getElementById('cupom-checkout-msg');

  let cupomAplicado = null;
  try {
    cupomAplicado = JSON.parse(sessionStorage.getItem('cupom_checkout'))
                 || JSON.parse(localStorage.getItem('floria_cupom_aplicado'))
                 || null;
  } catch { cupomAplicado = null; }

  let total = 0;

  function calcularDescontoLocal(sub) {
    if (!cupomAplicado) return 0;
    if (cupomAplicado.tipo === 'percentual') return Math.round(sub * (cupomAplicado.valor / 100) * 100) / 100;
    if (cupomAplicado.tipo === 'fixo') return Math.min(cupomAplicado.valor, sub);
    return cupomAplicado.desconto || 0;
  }

  function mostrarCupomMsg(txt, tipo) {
    if (!cupomMsgEl) return;
    cupomMsgEl.textContent = txt || '';
    cupomMsgEl.className = 'cupom-checkout-msg' + (tipo ? ' is-' + tipo : '');
  }

  function alternarComAnimacao(el, mostrar) {
    if (!el) return;
    if (mostrar) {
      el.hidden = false;
      el.classList.add('cupom-anim-oculto');
      void el.offsetWidth;
      el.classList.remove('cupom-anim-oculto');
    } else {
      el.classList.add('cupom-anim-oculto');
      const finalizar = () => { el.hidden = true; };
      el.addEventListener('transitionend', finalizar, { once: true });
      setTimeout(finalizar, 350);
    }
  }

  function renderCupomUi() {
    if (cupomAplicado) {
      alternarComAnimacao(cupomFormEl, false);
      alternarComAnimacao(cupomAplicadoEl, true);
      if (cupomCodigoEl) cupomCodigoEl.textContent = cupomAplicado.codigo;
    } else {
      alternarComAnimacao(cupomFormEl, true);
      alternarComAnimacao(cupomAplicadoEl, false);
    }
  }

  function recalcularTotais() {
    if (cupomAplicado && cupomAplicado.valor_minimo && subtotal < cupomAplicado.valor_minimo) {
      cupomAplicado = null;
      sessionStorage.removeItem('cupom_checkout');
      localStorage.removeItem('floria_cupom_aplicado');
      renderCupomUi();
      mostrarCupomMsg('O cupom foi removido: o subtotal não atinge mais o valor mínimo exigido.', 'erro');
    }

    const desconto = calcularDescontoLocal(subtotal);
    total = Math.max(0, subtotal - desconto);

    if (resumoSubtotal) resumoSubtotal.textContent = fmt(subtotal);
    if (resumoTotal) resumoTotal.textContent = fmt(total);
    if (resumoLinhaDesconto) {
      resumoLinhaDesconto.hidden = !cupomAplicado;
      if (cupomAplicado) {
        if (resumoDesconto) resumoDesconto.textContent = '− ' + fmt(desconto);
        if (resumoCupomTag) resumoCupomTag.textContent = '(' + cupomAplicado.codigo + ')';
        if (cupomValorEl) cupomValorEl.textContent = fmt(desconto);
      }
    }
  }

  function salvarCupomAplicado(c) {
    cupomAplicado = c;
    try {
      if (c) {
        sessionStorage.setItem('cupom_checkout', JSON.stringify(c));
        localStorage.setItem('floria_cupom_aplicado', JSON.stringify(c));
      } else {
        sessionStorage.removeItem('cupom_checkout');
        localStorage.removeItem('floria_cupom_aplicado');
      }
    } catch {   }
  }

  function aplicarCupomCheckout(codigo) {
    if (!codigo) return;
    if (btnCupomEl) { btnCupomEl.disabled = true; btnCupomEl.textContent = 'Aplicando…'; }
    mostrarCupomMsg('', '');

    fetch('/api/cupons/validar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ codigo, subtotal }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) { mostrarCupomMsg(data.message || 'Não foi possível aplicar o cupom.', 'erro'); return; }
        salvarCupomAplicado({ codigo: data.codigo, tipo: data.tipo, valor: data.valor, valor_minimo: data.valor_minimo || 0, desconto: data.desconto });
        renderCupomUi();
        recalcularTotais();
        mostrarCupomMsg('Cupom aplicado com sucesso!', 'sucesso');
      })
      .catch(() => mostrarCupomMsg('Erro de conexão. Tente novamente.', 'erro'))
      .finally(() => { if (btnCupomEl) { btnCupomEl.disabled = false; btnCupomEl.textContent = 'Aplicar'; } });
  }

  if (btnCupomEl && inputCupomEl) {
    btnCupomEl.addEventListener('click', () => aplicarCupomCheckout(inputCupomEl.value.trim().toUpperCase()));
    inputCupomEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); btnCupomEl.click(); } });
  }
  if (btnRemoverCupom) {
    btnRemoverCupom.addEventListener('click', () => {
      salvarCupomAplicado(null);
      renderCupomUi();
      recalcularTotais();
      mostrarCupomMsg('Cupom removido.', '');
      if (inputCupomEl) inputCupomEl.value = '';
    });
  }

  renderCupomUi();
  recalcularTotais();

  if (cupomAplicado) {
    const codigoSalvo = cupomAplicado.codigo;
    fetch('/api/cupons/validar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ codigo: codigoSalvo, subtotal }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          salvarCupomAplicado(null);
          renderCupomUi();
          recalcularTotais();
          mostrarCupomMsg('O cupom "' + codigoSalvo + '" não é mais válido e foi removido.', 'erro');
          return;
        }
        salvarCupomAplicado({ codigo: data.codigo, tipo: data.tipo, valor: data.valor, valor_minimo: data.valor_minimo || 0, desconto: data.desconto });
        recalcularTotais();
      })
      .catch(() => {});
  }

  const metodosFieldset = document.getElementById('metodos-fieldset');
  const pagamentoBloqueado = document.getElementById('pagamento-bloqueado');
  const pagamentoBloqueadoTexto = document.getElementById('pagamento-bloqueado-texto');

  let mercadoPagoAtivo = false;

  function atualizarGatePagamento() {
    const enderecoAtual = enderecoSelecionadoAtual();
    const foraDaRegiao = !!enderecoAtual && !enderecoAtendido(enderecoAtual);
    const podeSeguir = !!enderecoSelecionadoId && !foraDaRegiao;

    if (metodosFieldset) metodosFieldset.hidden = !podeSeguir;
    if (pagamentoBloqueado) pagamentoBloqueado.hidden = podeSeguir;
    if (pagamentoBloqueadoTexto) {
      pagamentoBloqueadoTexto.textContent = foraDaRegiao
        ? 'No momento, não realizamos entregas para este endereço.'
        : 'Cadastre um endereço de entrega para escolher a forma de pagamento.';
    }
    if (mercadoPagoAtivo) {
      const brickContainer = document.getElementById('mp-brick-container');
      if (brickContainer) brickContainer.hidden = !podeSeguir;
    }
    atualizarCamposMetodo();
  }

  const radiosMetodo = document.querySelectorAll('input[name="forma_pagto"]');
  const camposCartao = document.getElementById('campos-cartao');
  const camposPix = document.getElementById('campos-pix');
  const camposBoleto = document.getElementById('campos-boleto');
  const linhaParcelas = document.getElementById('linha-parcelas');
  const notaCartaoTeste = document.getElementById('nota-cartao-teste');

  function rotuloBotaoPara(forma) {
    if (forma === 'pix') return 'Gerar Pix';
    if (forma === 'boleto') return 'Gerar boleto';
    if (forma === 'credito' || forma === 'debito') return 'Finalizar compra';
    return 'Confirmar pagamento';
  }
  function atualizarTextoBotao(forma) {
    const b = document.getElementById('btn-confirmar');
    const span = b && b.querySelector('.botao__texto');
    if (span && !b.classList.contains('is-carregando')) span.textContent = rotuloBotaoPara(forma);
  }

  function atualizarCamposMetodo() {
    const selecionado = document.querySelector('input[name="forma_pagto"]:checked');
    const forma = enderecoSelecionadoId && selecionado ? selecionado.value : null;

    if (camposCartao) camposCartao.hidden = !(forma === 'credito' || forma === 'debito');
    if (camposPix) camposPix.hidden = forma !== 'pix';
    if (camposBoleto) camposBoleto.hidden = forma !== 'boleto';
    if (linhaParcelas) linhaParcelas.hidden = forma !== 'credito';
    if (notaCartaoTeste) notaCartaoTeste.hidden = !(forma === 'credito' || forma === 'debito');
    atualizarTextoBotao(forma);
  }

  radiosMetodo.forEach((r) => r.addEventListener('change', atualizarCamposMetodo));
  atualizarGatePagamento();

  /* MÁSCARAS DO CARTÃO */
  const inputNumero = document.getElementById('cartao-numero');
  const inputValidade = document.getElementById('cartao-validade');
  const inputCvv = document.getElementById('cartao-cvv');
  const inputNomeCartao = document.getElementById('cartao-nome');
  const bandeiraEl = document.getElementById('cartao-bandeira');

  if (inputNumero) {
    inputNumero.addEventListener('input', () => {
      inputNumero.value = PagamentoCartao.formatarNumero(inputNumero.value);
      const bandeira = PagamentoCartao.detectarBandeira(inputNumero.value);
      if (bandeiraEl) bandeiraEl.textContent = bandeira || '';
      limparErroCampo(inputNumero);
    });
  }
  if (inputValidade) {
    inputValidade.addEventListener('input', () => {
      inputValidade.value = PagamentoCartao.formatarValidade(inputValidade.value);
      limparErroCampo(inputValidade);
    });
  }
  if (inputCvv) {
    inputCvv.addEventListener('input', () => {
      inputCvv.value = PagamentoCartao.apenasDigitos(inputCvv.value).slice(0, 4);
      limparErroCampo(inputCvv);
    });
  }

  const inputCpfBoleto = document.getElementById('boleto-cpf');
  if (inputCpfBoleto) {
    inputCpfBoleto.addEventListener('input', () => {
      const digitos = PagamentoCartao.apenasDigitos(inputCpfBoleto.value).slice(0, 11);
      inputCpfBoleto.value = digitos
        .replace(/^(\d{3})(\d)/, '$1.$2')
        .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)$/, '.$1-$2');
      limparErroCampo(inputCpfBoleto);
    });
  }

  function validarCampos(forma) {
    limparErrosDoEscopo(document.getElementById('form-pagamento'));
    let valido = true;
    let primeiroInvalido = null;

    function invalidar(input, msg) {
      mostrarErroCampo(input, msg);
      valido = false;
      if (!primeiroInvalido) primeiroInvalido = input;
    }

    if (forma === 'credito' || forma === 'debito') {
      if (!PagamentoCartao.numeroSimuladoValido(inputNumero.value)) invalidar(inputNumero, 'Número de cartão inválido.');
      if (!inputNomeCartao.value.trim()) invalidar(inputNomeCartao, 'Informe o nome impresso no cartão.');
      if (!inputValidade.value.trim()) invalidar(inputValidade, 'Informe a validade.');
      else if (!PagamentoCartao.validadeValida(inputValidade.value)) invalidar(inputValidade, 'Cartão vencido.');
      const bandeira = PagamentoCartao.detectarBandeira(inputNumero.value);
      if (!PagamentoCartao.cvvValido(inputCvv.value, bandeira)) invalidar(inputCvv, 'CVV inválido.');
    } else if (forma === 'boleto') {
      const digitosCpf = PagamentoCartao.apenasDigitos(inputCpfBoleto.value);
      if (digitosCpf.length !== 11) invalidar(inputCpfBoleto, 'Informe um CPF válido.');
    }

    if (!valido && primeiroInvalido) primeiroInvalido.focus();
    return valido;
  }

  let enviando = false;
  const form = document.getElementById('form-pagamento');
  const btn = document.getElementById('btn-confirmar');
  const msg = document.getElementById('msg-pedido');

  function montarPayloadBase(forma) {
    return {
      itens: carrinho.map((item) => ({
        nome: item.nome,
        preco: precoNum(item.preco),
        quantidade: item.quantidade,
        imagem: item.imagem || '',
        cor: item.cor || null,
        link: item.link || null,
      })),
      total,
      frete: 0,
      desconto: cupomAplicado ? calcularDescontoLocal(subtotal) : undefined,
      cupom: cupomAplicado ? cupomAplicado.codigo : undefined,
      forma_pagto: forma,
      endereco_id: enderecoSelecionadoId,
      observacoes: document.getElementById('observacoes-pedido').value.trim() || undefined,
    };
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (enviando) return;

    msg.classList.remove('is-sucesso');
    msg.textContent = '';

    if (carrinho.length === 0) {
      msg.textContent = 'Seu carrinho está vazio.';
      return;
    }
    if (!enderecoSelecionadoId) {
      msg.textContent = 'Para finalizar sua compra, é necessário cadastrar pelo menos um endereço de entrega.';
      return;
    }
    if (!form.reportValidity()) return;

    const selecionado = document.querySelector('input[name="forma_pagto"]:checked');
    const forma = selecionado ? selecionado.value : null;
    if (!forma) { msg.textContent = 'Selecione uma forma de pagamento.'; return; }
    if (!validarCampos(forma)) return;

    enviando = true;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.classList.add('is-carregando');
    btn.querySelector('.botao__texto').textContent = 'Processando…';

    const payload = montarPayloadBase(forma);
    if (forma === 'credito' || forma === 'debito') {
      payload.numero_cartao = PagamentoCartao.apenasDigitos(inputNumero.value);
      payload.nome_cartao = document.getElementById('cartao-nome').value.trim();
      payload.validade_cartao = inputValidade.value.trim();
      payload.cvv_cartao = inputCvv.value.trim();
      if (forma === 'credito') payload.parcelas = Number(document.getElementById('cartao-parcelas').value) || 1;
    } else if (forma === 'boleto') {
      payload.cpf_boleto = PagamentoCartao.apenasDigitos(inputCpfBoleto.value);
    }

    function reabilitarBotao() {
      enviando = false;
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.classList.remove('is-carregando');
      atualizarTextoBotao(forma);
    }

    try {
      const resp = await fetch('/api/pedidos/finalizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'Idempotency-Key': chaveIdempotencia },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();

      if (data.ok) {
        localStorage.removeItem('carrinho');
        sessionStorage.removeItem('carrinho_checkout');
        localStorage.removeItem('floria_cupom_aplicado');
        sessionStorage.removeItem('cupom_checkout');
        msg.classList.add('is-sucesso');
        msg.textContent = 'Pedido criado! Redirecionando para o pagamento…';
        setTimeout(() => { window.location.href = '/pedido/' + data.pedido_id + '/pagamento'; }, 900);
        return;
      }

      if (resp.status === 401) {
        msg.textContent = 'Sua sessão expirou. Faça login novamente para finalizar a compra.';
        setTimeout(() => { window.location.href = '/login?next=%2Fpagamento&motivo=checkout'; }, 1800);
        reabilitarBotao();
      } else if (data.code === 'CUPOM_INVALIDO' || data.code === 'CUPOM_VALOR_MINIMO') {
        salvarCupomAplicado(null);
        renderCupomUi();
        recalcularTotais();
        msg.textContent = data.message || 'O cupom aplicado não é mais válido.';
        reabilitarBotao();
      } else if (data.code === 'PAGAMENTO_RECUSADO') {
        msg.textContent = data.message || 'Pagamento recusado. Verifique os dados e tente novamente.';
        reabilitarBotao();
      } else if (data.code === 'REGIAO_NAO_ATENDIDA') {
        ufsEntregaPermitidas.length = 0;
        ufsEntregaPermitidas.push(...(Array.isArray(data.ufsEntregaPermitidas) ? data.ufsEntregaPermitidas : []));
        renderizarEnderecosCheckout();
        atualizarGatePagamento();
        msg.textContent = data.message || 'No momento, não realizamos entregas para este endereço.';
        reabilitarBotao();
      } else {
        msg.textContent = data.message || 'Erro ao finalizar pedido.';
        reabilitarBotao();
      }
    } catch {
      msg.textContent = 'Erro de conexão. Tente novamente.';
      reabilitarBotao();
    }
  });

  function carregarSdkMercadoPago() {
    return new Promise((resolve, reject) => {
      if (window.MercadoPago) return resolve();
      const script = document.createElement('script');
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Não foi possível carregar o Mercado Pago.'));
      document.head.appendChild(script);
    });
  }

  function formaPagtoDoBrick(selectedPaymentMethod, formData) {
    if (selectedPaymentMethod === 'bank_transfer') return 'pix';
    if (selectedPaymentMethod === 'ticket') return 'boleto';
    return formData?.payment_type_id === 'debit_card' ? 'debito' : 'credito';
  }

  async function enviarPedidoMercadoPago(selectedPaymentMethod, formData) {
    msg.classList.remove('is-sucesso');
    msg.textContent = '';

    if (carrinho.length === 0) { msg.textContent = 'Seu carrinho está vazio.'; return; }
    if (!enderecoSelecionadoId) { msg.textContent = 'Para finalizar sua compra, é necessário cadastrar pelo menos um endereço de entrega.'; return; }

    const forma = formaPagtoDoBrick(selectedPaymentMethod, formData);
    const payload = montarPayloadBase(forma);
    payload.mp_token = formData.token || undefined;
    payload.mp_payment_method_id = formData.payment_method_id;
    payload.mp_installments = formData.installments || undefined;
    payload.mp_issuer_id = formData.issuer_id || undefined;
    payload.mp_payer = formData.payer || undefined;

    try {
      const resp = await fetch('/api/pedidos/finalizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'Idempotency-Key': chaveIdempotencia },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();

      if (data.ok) {
        localStorage.removeItem('carrinho');
        sessionStorage.removeItem('carrinho_checkout');
        localStorage.removeItem('floria_cupom_aplicado');
        sessionStorage.removeItem('cupom_checkout');
        msg.classList.add('is-sucesso');
        msg.textContent = 'Pedido criado! Redirecionando para o pagamento…';
        setTimeout(() => { window.location.href = '/pedido/' + data.pedido_id + '/pagamento'; }, 900);
        return;
      }

      if (resp.status === 401) {
        msg.textContent = 'Sua sessão expirou. Faça login novamente para finalizar a compra.';
        setTimeout(() => { window.location.href = '/login?next=%2Fpagamento&motivo=checkout'; }, 1800);
      } else {
        msg.textContent = data.message || 'Erro ao finalizar pedido.';
      }
    } catch {
      msg.textContent = 'Erro de conexão. Tente novamente.';
    }
  }

  async function montarCheckoutBricks(publicKey) {
    const brickContainer = document.getElementById('mp-brick-container');
    if (!brickContainer) return;

    try {
      await carregarSdkMercadoPago();
    } catch {
      msg.textContent = 'Não foi possível carregar o pagamento. Recarregue a página.';
      return;
    }

    ['campos-cartao', 'campos-pix', 'campos-boleto', 'linha-parcelas', 'nota-cartao-teste'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
    document.querySelectorAll('input[name="forma_pagto"]').forEach((r) => {
      const rotulo = r.closest('label');
      if (rotulo) rotulo.hidden = true;
    });
    if (btn) btn.hidden = true;
    mercadoPagoAtivo = true;
    atualizarGatePagamento();

    const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
    await mp.bricks().create('payment', 'mp-brick-container', {
      initialization: {
        amount: total,
      },
      customization: {
        paymentMethods: { creditCard: 'all', debitCard: 'all', bankTransfer: 'pix', ticket: 'all' },
      },
      callbacks: {
        onSubmit: ({ selectedPaymentMethod, formData }) => enviarPedidoMercadoPago(selectedPaymentMethod, formData),
        onError: (error) => {
          console.error('[mercadopago brick]', error);
          msg.textContent = 'Não foi possível processar o pagamento. Tente novamente.';
        },
      },
    });
  }

  fetch('/api/pagamento/config')
    .then((r) => r.json())
    .then((data) => {
      if (data.modo === 'mercadopago' && data.publicKey) montarCheckoutBricks(data.publicKey);
    })
    .catch(() => {   });
})();
