(function () {
  'use strict';

  var input    = document.getElementById('busca-input');
  var dropdown = document.getElementById('busca-dropdown');
  var form     = document.getElementById('busca-form');

  if (!input || !dropdown) return;

  var timer       = null;
  var ultimaBusca = '';

  /* Helpers */
  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function destacar(texto, q) {
    if (!q) return esc(texto);
    var regex = new RegExp(
      '(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')',
      'gi'
    );
    return esc(texto).replace(regex, '<mark class="busca-mark">$1</mark>');
  }

  function formatPreco(valor) {
    return 'R$ ' + Number(valor).toFixed(2).replace('.', ',');
  }

  /* Abrir / fechar */
  function abrir() { dropdown.classList.add('visivel'); }
  function fechar() {
    dropdown.classList.remove('visivel');
    dropdown.innerHTML = '';
    ultimaBusca = '';
  }

  /* Renderizar resultados */
  function renderResultados(produtos, q) {
    dropdown.innerHTML = '';

    var lista = document.createElement('ul');
    lista.className = 'bdd-lista';
    lista.setAttribute('role', 'listbox');

    produtos.forEach(function (p) {
      var preco    = p.preco_exibido;
      var imgSrc   = p.imagem ? '/imagens/' + p.imagem : '/imagens/image.png';
      var href     = '/' + encodeURIComponent(p.slug);

      var li = document.createElement('li');
      li.className = 'bdd-item';
      li.setAttribute('role', 'option');

      var a = document.createElement('a');
      a.href = href;
      a.className = 'bdd-link';

      /* Imagem */
      var imgWrap = document.createElement('figure');
      imgWrap.className = 'bdd-img';
      var img = document.createElement('img');
      img.src = imgSrc;
      img.alt = p.nome;
      img.loading = 'lazy';
      imgWrap.appendChild(img);

      /* Texto */
      var info = document.createElement('section');
      info.className = 'bdd-info';

      var nome = document.createElement('b');
      nome.className = 'bdd-nome';
      nome.innerHTML = destacar(p.nome, q);

      var cat = document.createElement('small');
      cat.className = 'bdd-cat';
      cat.textContent = p.categoria_nome || '';

      var precoEl = document.createElement('b');
      precoEl.className = 'bdd-preco';
      if (p.preco_riscado) {
        var antigo = document.createElement('s');
        antigo.className = 'bdd-preco-antigo';
        antigo.textContent = formatPreco(p.preco_riscado);
        precoEl.appendChild(antigo);
        precoEl.appendChild(document.createTextNode(' '));
      }
      precoEl.appendChild(document.createTextNode(formatPreco(preco)));

      info.appendChild(nome);
      info.appendChild(cat);
      info.appendChild(precoEl);

      a.appendChild(imgWrap);
      a.appendChild(info);
      li.appendChild(a);
      lista.appendChild(li);
    });

    dropdown.appendChild(lista);

    var rodape = document.createElement('footer');
    rodape.className = 'bdd-rodape';
    var linkTodos = document.createElement('a');
    linkTodos.href = '/busca?q=' + encodeURIComponent(q);
    linkTodos.className = 'bdd-ver-todos';
    linkTodos.textContent = 'Ver todos os resultados para "' + q + '" →';
    rodape.appendChild(linkTodos);
    dropdown.appendChild(rodape);

    abrir();
  }

  function renderVazio(q) {
    dropdown.innerHTML =
      '<section class="bdd-vazio">' +
        '<b>Nenhum produto encontrado para <strong>"' + esc(q) + '"</strong></b>' +
        '<a href="/busca?q=' + encodeURIComponent(q) + '" class="bdd-ver-todos">Busca completa →</a>' +
      '</section>';
    abrir();
  }

  function renderCarregando() {
    dropdown.innerHTML = '<section class="bdd-loading"><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i></section>';
    abrir();
  }

  /* Busca via fetch */
  function buscar(q) {
    if (q === ultimaBusca) return;
    ultimaBusca = q;

    if (!q || q.length < 2) { fechar(); return; }

    renderCarregando();

    fetch('/api/busca?q=' + encodeURIComponent(q) + '&limite=6')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok && data.data && data.data.length > 0) {
          renderResultados(data.data, q);
        } else {
          renderVazio(q);
        }
      })
      .catch(function () { fechar(); });
  }

  /* Eventos */
  input.addEventListener('input', function () {
    var q = this.value.trim();
    clearTimeout(timer);
    if (!q) { fechar(); return; }
    timer = setTimeout(function () { buscar(q); }, 280);
  });

  /* Fecha ao clicar fora */
  document.addEventListener('click', function (e) {
    var wrapper = document.getElementById('busca-wrapper');
    if (wrapper && !wrapper.contains(e.target)) fechar();
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') fechar();
  });

  input.addEventListener('search', function () {
    if (!this.value) fechar();
  });
})();
