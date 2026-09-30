(function () {
  'use strict';

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  var contador = 0;
  var instanciaAberta = null;

  function pad2(n) { return String(n).padStart(2, '0'); }

  function deISO(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    var partes = iso.split('-');
    return { ano: Number(partes[0]), mes: Number(partes[1]) - 1, dia: Number(partes[2]) };
  }

  function paraISO(ano, mes, dia) { return ano + '-' + pad2(mes + 1) + '-' + pad2(dia); }

  function paraBR(iso) {
    var p = deISO(iso);
    return p ? pad2(p.dia) + '/' + pad2(p.mes + 1) + '/' + p.ano : '';
  }

  function construirGrade(ano, mes) {
    var primeiroDiaSemana = (new Date(ano, mes, 1).getDay() + 6) % 7;
    var diasNoMes = new Date(ano, mes + 1, 0).getDate();
    var diasMesAnterior = new Date(ano, mes, 0).getDate();
    var celulas = [];
    for (var i = primeiroDiaSemana - 1; i >= 0; i--) {
      celulas.push({ dia: diasMesAnterior - i, atual: false });
    }
    for (var d = 1; d <= diasNoMes; d++) celulas.push({ dia: d, atual: true, ano: ano, mes: mes });
    var proximo = 1;
    while (celulas.length % 7 !== 0) celulas.push({ dia: proximo++, atual: false });
    return celulas;
  }

  function attach(nativo) {
    if (nativo.dataset.brAnexado) return;
    nativo.dataset.brAnexado = '1';
    contador += 1;
    var idPainel = 'data-br-painel-' + contador;

    var wrapper = document.createElement('b');
    wrapper.className = 'data-br';
    nativo.parentNode.insertBefore(wrapper, nativo);
    wrapper.appendChild(nativo);
    nativo.classList.add('data-br__nativo');
    nativo.tabIndex = -1;
    nativo.setAttribute('aria-hidden', 'true');

    var visual = document.createElement('input');
    visual.type = 'text';
    visual.id = 'data-br-visual-' + contador;
    visual.className = 'data-br__visual';
    visual.readOnly = true;
    visual.placeholder = 'DD/MM/AAAA';
    visual.autocomplete = 'off';
    visual.setAttribute('role', 'combobox');
    visual.setAttribute('aria-haspopup', 'dialog');
    visual.setAttribute('aria-expanded', 'false');
    visual.setAttribute('aria-controls', idPainel);
    wrapper.appendChild(visual);

    var rotulo = nativo.closest('label');
    if (rotulo && !rotulo.hasAttribute('for')) rotulo.setAttribute('for', visual.id);

    var botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'data-br__botao';
    botao.setAttribute('aria-label', 'Abrir calendário');
    botao.setAttribute('aria-haspopup', 'dialog');
    botao.setAttribute('aria-expanded', 'false');
    botao.setAttribute('aria-controls', idPainel);
    botao.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';
    wrapper.appendChild(botao);

    var painel = document.createElement('section');
    painel.className = 'data-br__painel';
    painel.id = idPainel;
    painel.setAttribute('role', 'dialog');
    painel.setAttribute('aria-label', 'Selecionar data');
    painel.hidden = true;

    var cabecalho = document.createElement('header');
    cabecalho.className = 'data-br__cabecalho';
    var navAnterior = document.createElement('button');
    navAnterior.type = 'button';
    navAnterior.className = 'data-br__nav';
    navAnterior.setAttribute('aria-label', 'Mês anterior');
    navAnterior.textContent = '‹';
    var titulo = document.createElement('strong');
    titulo.className = 'data-br__titulo';
    var navProximo = document.createElement('button');
    navProximo.type = 'button';
    navProximo.className = 'data-br__nav';
    navProximo.setAttribute('aria-label', 'Próximo mês');
    navProximo.textContent = '›';
    cabecalho.append(navAnterior, titulo, navProximo);

    var tabela = document.createElement('table');
    tabela.className = 'data-br__tabela';
    var legenda = document.createElement('caption');
    legenda.textContent = 'Selecione uma data';
    var thead = document.createElement('thead');
    var trCabecalho = document.createElement('tr');
    DIAS_SEMANA.forEach(function (nome) {
      var th = document.createElement('th');
      th.scope = 'col';
      th.textContent = nome;
      trCabecalho.appendChild(th);
    });
    thead.appendChild(trCabecalho);
    var tbody = document.createElement('tbody');
    tabela.append(legenda, thead, tbody);

    var rodape = document.createElement('footer');
    rodape.className = 'data-br__rodape';
    var btnHoje = document.createElement('button');
    btnHoje.type = 'button';
    btnHoje.className = 'data-br__acao';
    btnHoje.textContent = 'Hoje';
    var btnLimpar = document.createElement('button');
    btnLimpar.type = 'button';
    btnLimpar.className = 'data-br__acao';
    btnLimpar.textContent = 'Limpar';
    rodape.append(btnHoje, btnLimpar);

    painel.append(cabecalho, tabela, rodape);
    var dialogAncestral = nativo.closest('dialog');
    (dialogAncestral || document.body).appendChild(painel);

    var hoje = new Date();
    var mesExibido = { ano: hoje.getFullYear(), mes: hoje.getMonth() };

    function valorAtualISO() { return nativo.value || ''; }

    function renderizarGrade() {
      titulo.textContent = MESES[mesExibido.mes] + ' de ' + mesExibido.ano;
      tbody.innerHTML = '';
      var selecionado = deISO(valorAtualISO());
      var celulas = construirGrade(mesExibido.ano, mesExibido.mes);
      for (var semana = 0; semana < celulas.length / 7; semana++) {
        var tr = document.createElement('tr');
        for (var col = 0; col < 7; col++) {
          var celula = celulas[semana * 7 + col];
          var td = document.createElement('td');
          if (celula.atual) {
            var btnDia = document.createElement('button');
            btnDia.type = 'button';
            btnDia.className = 'data-br__dia';
            btnDia.textContent = celula.dia;
            var ehHoje = celula.ano === hoje.getFullYear() && celula.mes === hoje.getMonth() && celula.dia === hoje.getDate();
            if (ehHoje) btnDia.setAttribute('aria-current', 'date');
            var ehSelecionado = selecionado && selecionado.ano === celula.ano && selecionado.mes === celula.mes && selecionado.dia === celula.dia;
            btnDia.setAttribute('aria-selected', ehSelecionado ? 'true' : 'false');
            btnDia.addEventListener('click', function (ev) {
              var alvo = ev.currentTarget;
              selecionarData(Number(alvo.dataset.ano), Number(alvo.dataset.mes), Number(alvo.dataset.dia));
            });
            btnDia.dataset.ano = celula.ano;
            btnDia.dataset.mes = celula.mes;
            btnDia.dataset.dia = celula.dia;
            td.appendChild(btnDia);
          }
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
    }

    function sincronizarVisual() {
      visual.value = paraBR(valorAtualISO());
      var p = deISO(valorAtualISO());
      if (p) mesExibido = { ano: p.ano, mes: p.mes };
      if (!painel.hidden) renderizarGrade();
    }

    function definirValor(iso) {
      nativo.value = iso;
      nativo.dispatchEvent(new Event('input', { bubbles: true }));
      nativo.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function selecionarData(ano, mes, dia) {
      definirValor(paraISO(ano, mes, dia));
      fechar();
      visual.focus();
    }

    function posicionar() {
      var retangulo = wrapper.getBoundingClientRect();
      var alturaPainel = painel.offsetHeight || 300;
      var topo = retangulo.bottom + 6;
      if (topo + alturaPainel > window.innerHeight) topo = Math.max(6, retangulo.top - alturaPainel - 6);
      var esquerda = Math.min(retangulo.left, window.innerWidth - painel.offsetWidth - 8);
      painel.style.top = topo + 'px';
      painel.style.left = Math.max(8, esquerda) + 'px';
    }

    function abrir() {
      if (instanciaAberta && instanciaAberta !== fecharAtual) instanciaAberta();
      renderizarGrade();
      painel.hidden = false;
      visual.setAttribute('aria-expanded', 'true');
      botao.setAttribute('aria-expanded', 'true');
      posicionar();
      instanciaAberta = fecharAtual;
      document.addEventListener('mousedown', aoClicarFora, true);
      window.addEventListener('resize', posicionar);
      window.addEventListener('scroll', fechar, true);
      document.addEventListener('keydown', aoTeclar);
    }

    function fechar() {
      painel.hidden = true;
      visual.setAttribute('aria-expanded', 'false');
      botao.setAttribute('aria-expanded', 'false');
      if (instanciaAberta === fecharAtual) instanciaAberta = null;
      document.removeEventListener('mousedown', aoClicarFora, true);
      window.removeEventListener('resize', posicionar);
      window.removeEventListener('scroll', fechar, true);
      document.removeEventListener('keydown', aoTeclar);
    }
    function fecharAtual() { fechar(); }

    function alternar() { if (painel.hidden) abrir(); else fechar(); }

    function aoClicarFora(ev) {
      if (!painel.contains(ev.target) && !wrapper.contains(ev.target)) fechar();
    }
    function aoTeclar(ev) {
      if (ev.key === 'Escape') { fechar(); visual.focus(); }
    }

    visual.addEventListener('click', alternar);
    botao.addEventListener('click', alternar);
    navAnterior.addEventListener('click', function () {
      mesExibido.mes -= 1;
      if (mesExibido.mes < 0) { mesExibido.mes = 11; mesExibido.ano -= 1; }
      renderizarGrade();
    });
    navProximo.addEventListener('click', function () {
      mesExibido.mes += 1;
      if (mesExibido.mes > 11) { mesExibido.mes = 0; mesExibido.ano += 1; }
      renderizarGrade();
    });
    btnHoje.addEventListener('click', function () {
      selecionarData(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    });
    btnLimpar.addEventListener('click', function () {
      definirValor('');
      fechar();
      visual.focus();
    });

    var descritorOriginal = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(nativo, 'value', {
      configurable: true,
      get: function () { return descritorOriginal.get.call(nativo); },
      set: function (v) { descritorOriginal.set.call(nativo, v); sincronizarVisual(); },
    });

    var formulario = nativo.closest('form');
    if (formulario) {
      formulario.addEventListener('reset', function () { setTimeout(sincronizarVisual, 0); });
    }

    sincronizarVisual();
  }

  function iniciar() {
    document.querySelectorAll('input[type="date"][data-br-enhance]').forEach(attach);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
