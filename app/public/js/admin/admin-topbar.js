(function () {
  'use strict';

  var btn     = document.getElementById('admin-notif-btn');
  var painel  = document.getElementById('admin-notif-painel');
  var lista   = document.getElementById('admin-notif-lista');
  var ponto   = document.getElementById('admin-notif-ponto');
  if (!btn || !painel || !lista) return;

  var ICONE = {
    pendentes:  'fa-hourglass-half',
    estoque:    'fa-box-open',
    parados:    'fa-exclamation-triangle',
    avaliacoes: 'fa-star',
  };

  function item(icone, titulo, legenda, href) {
    var a = document.createElement('a');
    a.className = 'admin-notif-item';
    a.href = href;
    a.innerHTML =
      '<i class="admin-notif-item__icone" aria-hidden="true"><i class="fas ' + icone + '"></i></i>' +
      '<section class="admin-notif-item__texto">' +
        '<b class="admin-notif-item__titulo">' + titulo + '</b>' +
        '<small class="admin-notif-item__legenda">' + legenda + '</small>' +
      '</section>';
    return a;
  }

  function montarLista(dados) {
    lista.innerHTML = '';
    var linhas = [];

    if (dados.pedidosPendentes > 0) {
      linhas.push(item(ICONE.pendentes,
        dados.pedidosPendentes + (dados.pedidosPendentes === 1 ? ' pedido pendente' : ' pedidos pendentes'),
        'Aguardando processamento', '/pedidos'));
    }
    if (dados.estoqueBaixo && dados.estoqueBaixo.length) {
      linhas.push(item(ICONE.estoque,
        dados.estoqueBaixo.length + (dados.estoqueBaixo.length === 1 ? ' produto com estoque baixo' : ' produtos com estoque baixo'),
        'No limite mínimo ou abaixo', '/estoque'));
    }
    if (dados.pedidosParados && dados.pedidosParados.length) {
      linhas.push(item(ICONE.parados,
        dados.pedidosParados.length + (dados.pedidosParados.length === 1 ? ' pedido parado' : ' pedidos parados'),
        'Sem atualização de status há dias', '/pedidos'));
    }
    if (dados.avaliacoesRecentes && dados.avaliacoesRecentes.length) {
      linhas.push(item(ICONE.avaliacoes,
        dados.avaliacoesRecentes.length + (dados.avaliacoesRecentes.length === 1 ? ' avaliação sem resposta' : ' avaliações sem resposta'),
        'Aguardando retorno do lojista', '/admin/avaliacoes'));
    }

    if (!linhas.length) {
      var vazio = document.createElement('li');
      vazio.className = 'admin-notif-item admin-notif-item--vazio';
      vazio.textContent = 'Nenhuma notificação no momento.';
      lista.appendChild(vazio);
      if (ponto) ponto.hidden = true;
      return;
    }

    linhas.forEach(function (a) {
      var li = document.createElement('li');
      li.appendChild(a);
      lista.appendChild(li);
    });
    if (ponto) ponto.hidden = false;
  }

  function carregar() {
    fetch('/api/admin/dashboard/alertas', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (!json.ok) throw new Error('resposta sem ok');
        montarLista(json.data);
      })
      .catch(function () {
        lista.innerHTML = '';
        var erro = document.createElement('li');
        erro.className = 'admin-notif-item admin-notif-item--vazio';
        erro.textContent = 'Não foi possível carregar as notificações.';
        lista.appendChild(erro);
      });
  }

  function abrir() {
    painel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', aoClicarFora);
    document.addEventListener('keydown', aoTeclado);
  }
  function fechar() {
    painel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', aoClicarFora);
    document.removeEventListener('keydown', aoTeclado);
  }
  function aoClicarFora(e) {
    if (!painel.contains(e.target) && e.target !== btn) fechar();
  }
  function aoTeclado(e) {
    if (e.key === 'Escape') { fechar(); btn.focus(); }
  }

  btn.addEventListener('click', function () {
    if (painel.hidden) abrir(); else fechar();
  });

  carregar();
})();

(function () {
  'use strict';
  document.querySelectorAll('.tabela-scroll').forEach(function (el) {
    if (el.scrollWidth > el.clientWidth) {
      el.setAttribute('tabindex', '0');
      if (!el.hasAttribute('role')) el.setAttribute('role', 'region');
      if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) {
        el.setAttribute('aria-label', 'Tabela com rolagem horizontal');
      }
    }
  });
})();

(function () {
  'use strict';
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.classList && e.target.classList.contains('admin-toolbar')) {
      e.preventDefault();
    }
  });
})();
