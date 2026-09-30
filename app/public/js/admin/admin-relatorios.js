(function () {
  'use strict';

  var tabela = document.querySelector('[data-relatorio-tabela]');
  if (!tabela) return;

  var tbody = tabela.querySelector('tbody');
  var linhas = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
  if (!linhas.length) return;

  var buscaInput = document.querySelector('[data-relatorio-busca]');
  var paginacaoEl = document.querySelector('[data-relatorio-paginacao]');
  var ths = Array.prototype.slice.call(tabela.querySelectorAll('thead th[data-ordenavel]'));

  var TAMANHO_PAGINA = 25;
  var estado = { termo: '', col: null, dir: 1, pagina: 1 };

  function normalizar(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }

  function linhasFiltradas() {
    if (!estado.termo) return linhas.slice();
    var termo = normalizar(estado.termo);
    return linhas.filter(function (tr) {
      return normalizar(tr.textContent).indexOf(termo) !== -1;
    });
  }

  function ordenar(lista) {
    if (estado.col == null) return lista;
    var col = estado.col;
    var tipo = ths[col].dataset.tipo;
    var copia = lista.slice();
    copia.sort(function (a, b) {
      var va = a.children[col] ? a.children[col].dataset.valor : '';
      var vb = b.children[col] ? b.children[col].dataset.valor : '';
      var cmp;
      if (tipo === 'numero' || tipo === 'moeda' || tipo === 'data') {
        cmp = (parseFloat(va) || 0) - (parseFloat(vb) || 0);
      } else {
        cmp = normalizar(va).localeCompare(normalizar(vb), 'pt-BR');
      }
      return cmp * estado.dir;
    });
    return copia;
  }

  function renderizar() {
    var resultado = ordenar(linhasFiltradas());
    var totalPaginas = Math.max(1, Math.ceil(resultado.length / TAMANHO_PAGINA));
    if (estado.pagina > totalPaginas) estado.pagina = totalPaginas;

    linhas.forEach(function (tr) { tr.hidden = true; });

    var inicio = (estado.pagina - 1) * TAMANHO_PAGINA;
    var visiveis = resultado.slice(inicio, inicio + TAMANHO_PAGINA);
    visiveis.forEach(function (tr) {
      tr.hidden = false;
      tbody.appendChild(tr);
    });

    renderizarPaginacao(resultado.length, totalPaginas);
  }

  function renderizarPaginacao(totalLinhas, totalPaginas) {
    if (!paginacaoEl) return;
    if (totalLinhas <= TAMANHO_PAGINA) {
      paginacaoEl.innerHTML = '';
      paginacaoEl.hidden = true;
      return;
    }
    paginacaoEl.hidden = false;

    var partes = [];
    partes.push(
      '<a href="#" data-pag="prev" class="' + (estado.pagina === 1 ? 'desabilitado' : '') + '">&laquo; Anterior</a>'
    );
    for (var i = 1; i <= totalPaginas; i++) {
      partes.push(
        '<a href="#" data-pag="' + i + '" class="' + (i === estado.pagina ? 'atual' : '') + '">' + i + '</a>'
      );
    }
    partes.push(
      '<a href="#" data-pag="next" class="' + (estado.pagina === totalPaginas ? 'desabilitado' : '') + '">Próxima &raquo;</a>'
    );
    paginacaoEl.innerHTML = partes.join('');
  }

  if (buscaInput) {
    buscaInput.addEventListener('input', function () {
      estado.termo = buscaInput.value;
      estado.pagina = 1;
      renderizar();
    });
  }

  ths.forEach(function (th, idx) {
    function ativar() {
      if (estado.col === idx) estado.dir *= -1;
      else { estado.col = idx; estado.dir = 1; }
      estado.pagina = 1;
      ths.forEach(function (t) { t.classList.remove('is-asc', 'is-desc'); });
      th.classList.add(estado.dir === 1 ? 'is-asc' : 'is-desc');
      renderizar();
    }
    th.addEventListener('click', ativar);
    th.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ativar(); }
    });
  });

  if (paginacaoEl) {
    paginacaoEl.addEventListener('click', function (e) {
      var alvo = e.target.closest('[data-pag]');
      if (!alvo || alvo.classList.contains('desabilitado')) return;
      e.preventDefault();
      var totalPaginas = Math.max(1, Math.ceil(linhasFiltradas().length / TAMANHO_PAGINA));
      var valor = alvo.dataset.pag;
      if (valor === 'prev') estado.pagina = Math.max(1, estado.pagina - 1);
      else if (valor === 'next') estado.pagina = Math.min(totalPaginas, estado.pagina + 1);
      else estado.pagina = parseInt(valor, 10) || 1;
      renderizar();
    });
  }

  renderizar();
})();
