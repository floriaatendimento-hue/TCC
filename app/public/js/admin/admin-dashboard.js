(function () {
  'use strict';

  /* TOOLTIP COMPARTILHADO */
  var tooltipEl        = document.getElementById('chart-tooltip');
  var tooltipTituloEl  = document.getElementById('chart-tooltip-titulo');
  var tooltipLinhasEl  = document.getElementById('chart-tooltip-linhas');

  function montarLinhaTooltip(cor, rotulo, valor) {
    var li = document.createElement('li');
    var chave = document.createElement('i');
    chave.className = 'chart-tooltip__chave';
    chave.style.background = cor;
    chave.setAttribute('aria-hidden', 'true');
    var valorEl = document.createElement('b');
    valorEl.className = 'chart-tooltip__valor';
    valorEl.textContent = valor;
    li.appendChild(chave);
    li.appendChild(document.createTextNode(rotulo));
    li.appendChild(valorEl);
    return li;
  }

  function mostrarTooltip(clientX, clientY, titulo, linhas) {
    if (!tooltipEl || !tooltipTituloEl || !tooltipLinhasEl) return;
    tooltipTituloEl.textContent = titulo;
    tooltipLinhasEl.textContent = '';
    linhas.forEach(function (l) {
      tooltipLinhasEl.appendChild(montarLinhaTooltip(l.cor, l.rotulo, l.valor));
    });

    tooltipEl.classList.add('is-visivel');

    var largura = tooltipEl.offsetWidth;
    var altura  = tooltipEl.offsetHeight;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var left = clientX + 14;
    var top  = clientY + 14;
    if (left + largura > vw - 8) left = clientX - largura - 14;
    if (top + altura > vh - 8) top = clientY - altura - 14;
    tooltipEl.style.left = Math.max(8, left) + 'px';
    tooltipEl.style.top  = Math.max(8, top) + 'px';
  }

  function esconderTooltip() {
    if (tooltipEl) tooltipEl.classList.remove('is-visivel');
  }

  function ativarTooltipGenerico(seletor) {
    var els = document.querySelectorAll(seletor);
    els.forEach(function (el) {
      function exibirNoPonteiro(evt) { exibir(evt.clientX, evt.clientY); }
      function exibirNoFoco() {
        var r = el.getBoundingClientRect();
        exibir(r.left + r.width / 2, r.top);
      }
      function exibir(clientX, clientY) {
        mostrarTooltip(clientX, clientY, el.dataset.tooltipTitulo, [{
          cor:    el.dataset.tooltipCor,
          rotulo: el.dataset.tooltipRotulo,
          valor:  el.dataset.tooltipValor,
        }]);
      }
      el.addEventListener('pointerenter', exibirNoPonteiro);
      el.addEventListener('pointermove', exibirNoPonteiro);
      el.addEventListener('pointerleave', esconderTooltip);
      el.addEventListener('focus', exibirNoFoco);
      el.addEventListener('blur', esconderTooltip);
    });
  }

  ativarTooltipGenerico('.grafico-faturamento .barra[data-tooltip-titulo]');
  ativarTooltipGenerico('.grafico-formas-pagamento .donut-fatia[data-tooltip-titulo]');

  var svg = document.getElementById('grafico-evolucao-svg');
  if (svg) {

  var INTERVALO_MS = 20000;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var margemEsq  = Number(svg.dataset.margemEsq);
  var margemDir  = Number(svg.dataset.margemDir);
  var margemTopo = Number(svg.dataset.margemTopo);
  var margemBase = Number(svg.dataset.margemBase);
  var altura     = Number(svg.dataset.altura);
  var largura    = Number(svg.dataset.largura);
  var alturaUtil  = altura  - margemTopo - margemBase;
  var larguraUtil = largura - margemEsq  - margemDir;
  var baseline    = altura - margemBase;

  var linhaFat    = document.getElementById('linha-fat');
  var linhaPed    = document.getElementById('linha-ped');
  var areaFat     = document.getElementById('area-fat');
  var pontosFat   = document.getElementById('pontos-fat');
  var pontosPed   = document.getElementById('pontos-ped');
  var legendaFat  = document.getElementById('legenda-valor-faturamento');
  var legendaPed  = document.getElementById('legenda-valor-pedidos');
  var tabelaCorpo = document.getElementById('tabela-evolucao-corpo');
  var crosshair   = document.getElementById('grafico-evolucao-crosshair');
  var hitArea     = document.getElementById('grafico-evolucao-hitarea');

  var statusEl      = document.getElementById('evolucao-status');
  var statusTextoEl = document.getElementById('evolucao-status-texto');

  var serieAtual    = [];
  var maiorFatAtual = 1;
  var maiorPedAtual = 1;
  (function carregarDadosIniciais() {
    var script = document.getElementById('grafico-evolucao-dados');
    if (!script) return;
    try { serieAtual = JSON.parse(script.textContent || '[]'); } catch (e) { serieAtual = []; }
    if (serieAtual.length) {
      maiorFatAtual = Math.max(1, Math.max.apply(null, serieAtual.map(function (d) { return d.faturamento; })));
      maiorPedAtual = Math.max(1, Math.max.apply(null, serieAtual.map(function (d) { return d.pedidos; })));
    }
  })();

  function marcarStatus(texto, atualizando) {
    if (statusTextoEl) statusTextoEl.textContent = texto;
    if (statusEl) statusEl.classList.toggle('is-atualizando', !!atualizando);
  }

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function coordX(i, n) {
    return margemEsq + (n > 1 ? (larguraUtil / (n - 1)) * i : 0);
  }

  function coordY(valor, maior) {
    var pct = maior > 0 ? valor / maior : 0;
    return margemTopo + (1 - pct) * alturaUtil;
  }

  function caminhoArea(pontos) {
    if (!pontos.length) return '';
    var d = 'M ' + pontos.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' L ');
    d += ' L ' + pontos[pontos.length - 1].x.toFixed(1) + ',' + baseline;
    d += ' L ' + pontos[0].x.toFixed(1) + ',' + baseline + ' Z';
    return d;
  }

  function marcarAtualizado(el) {
    if (!el) return;
    el.classList.remove('legenda-grafico__valor--atualizado');
    void el.offsetWidth;
    el.classList.add('legenda-grafico__valor--atualizado');
  }

  function redesenhar(evolucao) {
    var serie = (evolucao && evolucao.serie) || [];
    var n = serie.length;
    if (!n) return;

    var maiorFat = evolucao.maiorFaturamento || 1;
    var maiorPed = evolucao.maiorPedidos || 1;

    var pontosFatCoords = serie.map(function (d, i) {
      return { x: coordX(i, n), y: coordY(d.faturamento, maiorFat), d: d };
    });
    var pontosPedCoords = serie.map(function (d, i) {
      return { x: coordX(i, n), y: coordY(d.pedidos, maiorPed), d: d };
    });

    linhaFat.setAttribute('points', pontosFatCoords.map(function (p) {
      return p.x.toFixed(1) + ',' + p.y.toFixed(1);
    }).join(' '));
    linhaPed.setAttribute('points', pontosPedCoords.map(function (p) {
      return p.x.toFixed(1) + ',' + p.y.toFixed(1);
    }).join(' '));
    if (areaFat) areaFat.setAttribute('d', caminhoArea(pontosFatCoords));

    pontosFat.textContent = '';
    pontosFatCoords.forEach(function (p) {
      var rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('class', 'ponto-serie ponto-serie--faturamento');
      rect.setAttribute('x', (p.x - 4).toFixed(1));
      rect.setAttribute('y', (p.y - 4).toFixed(1));
      rect.setAttribute('width', 8);
      rect.setAttribute('height', 8);
      rect.setAttribute('transform', 'rotate(45 ' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')');
      pontosFat.appendChild(rect);
    });

    pontosPed.textContent = '';
    pontosPedCoords.forEach(function (p) {
      var circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('class', 'ponto-serie ponto-serie--pedidos');
      circle.setAttribute('cx', p.x.toFixed(1));
      circle.setAttribute('cy', p.y.toFixed(1));
      circle.setAttribute('r', 4.5);
      pontosPed.appendChild(circle);
    });

    var totalFat = serie.reduce(function (s, d) { return s + d.faturamento; }, 0);
    var totalPed = serie.reduce(function (s, d) { return s + d.pedidos; }, 0);
    if (legendaFat) { legendaFat.textContent = formatarMoeda(totalFat); marcarAtualizado(legendaFat); }
    if (legendaPed) { legendaPed.textContent = String(totalPed); marcarAtualizado(legendaPed); }

    if (tabelaCorpo) {
      tabelaCorpo.textContent = '';
      serie.forEach(function (d) {
        var tr = document.createElement('tr');
        var tdDia = document.createElement('td'); tdDia.textContent = d.label;
        var tdPed = document.createElement('td'); tdPed.textContent = d.pedidos;
        var tdFat = document.createElement('td'); tdFat.textContent = formatarMoeda(d.faturamento);
        tr.appendChild(tdDia);
        tr.appendChild(tdPed);
        tr.appendChild(tdFat);
        tabelaCorpo.appendChild(tr);
      });
    }

    serieAtual = serie;
    maiorFatAtual = maiorFat;
    maiorPedAtual = maiorPed;
  }

  function atualizar() {
    marcarStatus('Atualizando…', true);
    fetch('/api/admin/dashboard/evolucao', { headers: { 'X-Requested-With': 'fetch' } })
      .then(function (r) { return r.json(); })
      .then(function (resp) {
        if (resp && resp.ok) {
          redesenhar(resp.data);
          marcarStatus('Atualizado agora mesmo', false);
        } else {
          marcarStatus('Atualiza automaticamente', false);
        }
      })
      .catch(function () {
        marcarStatus('Atualiza automaticamente', false);
      });
  }

  setInterval(atualizar, INTERVALO_MS);

  if (hitArea && crosshair) {
    var indiceFoco = 0;

    function indiceMaisProximo(localX) {
      var n = serieAtual.length;
      if (n <= 1) return 0;
      var passoX = larguraUtil / (n - 1);
      var i = Math.round((localX - margemEsq) / passoX);
      return Math.min(n - 1, Math.max(0, i));
    }

    function linhasTooltip(d) {
      return [
        { cor: 'var(--dourado)',     rotulo: 'Faturamento', valor: formatarMoeda(d.faturamento) },
        { cor: 'var(--verde-medio)', rotulo: 'Pedidos',      valor: String(d.pedidos) },
      ];
    }

    function exibirIndice(i, clientX, clientY) {
      var d = serieAtual[i];
      if (!d) return;
      indiceFoco = i;
      var x = coordX(i, serieAtual.length);
      crosshair.setAttribute('x1', x.toFixed(1));
      crosshair.setAttribute('x2', x.toFixed(1));
      crosshair.classList.add('is-visivel');
      mostrarTooltip(clientX, clientY, d.label, linhasTooltip(d));
    }

    hitArea.addEventListener('pointermove', function (e) {
      var rect = svg.getBoundingClientRect();
      var localX = ((e.clientX - rect.left) / rect.width) * largura;
      exibirIndice(indiceMaisProximo(localX), e.clientX, e.clientY);
    });
    hitArea.addEventListener('pointerleave', function () {
      crosshair.classList.remove('is-visivel');
      esconderTooltip();
    });

    function exibirIndiceComFoco(i) {
      var d = serieAtual[i];
      if (!d) return;
      var rect = svg.getBoundingClientRect();
      var x = coordX(i, serieAtual.length);
      var clientX = rect.left + (x / largura) * rect.width;
      var clientY = rect.top + rect.height / 2;
      exibirIndice(i, clientX, clientY);
    }

    hitArea.addEventListener('focus', function () { exibirIndiceComFoco(indiceFoco); });
    hitArea.addEventListener('blur', function () {
      crosshair.classList.remove('is-visivel');
      esconderTooltip();
    });
    hitArea.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); exibirIndiceComFoco(Math.min(serieAtual.length - 1, indiceFoco + 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); exibirIndiceComFoco(Math.max(0, indiceFoco - 1)); }
    });
  }

  }

  var svgTr = document.getElementById('grafico-trafego-svg');
  if (svgTr) {
    var SVG_NS_TR = 'http://www.w3.org/2000/svg';

    var margemEsqTr  = Number(svgTr.dataset.margemEsq);
    var margemDirTr  = Number(svgTr.dataset.margemDir);
    var margemTopoTr = Number(svgTr.dataset.margemTopo);
    var margemBaseTr = Number(svgTr.dataset.margemBase);
    var alturaTr     = Number(svgTr.dataset.altura);
    var larguraTr    = Number(svgTr.dataset.largura);
    var alturaUtilTr  = alturaTr  - margemTopoTr - margemBaseTr;
    var larguraUtilTr = larguraTr - margemEsqTr  - margemDirTr;
    var baselineTr    = alturaTr - margemBaseTr;

    var cardTr      = document.getElementById('grafico-trafego-card');
    var figureTr    = cardTr ? cardTr.querySelector('figure') : null;
    var linhaTr     = document.getElementById('linha-trafego');
    var areaTr      = document.getElementById('area-trafego');
    var pontosTr    = document.getElementById('pontos-trafego');
    var gradeTr     = document.getElementById('grafico-trafego-grade');
    var eixoXTr     = document.getElementById('grafico-trafego-eixox');
    var crosshairTr = document.getElementById('grafico-trafego-crosshair');
    var hitAreaTr   = document.getElementById('grafico-trafego-hitarea');
    var navTr       = document.getElementById('trafego-periodo-nav');
    var totalElTr        = document.getElementById('trafego-total');
    var periodoTextoElTr = document.getElementById('trafego-periodo-texto');
    var variacaoElTr     = document.getElementById('trafego-variacao');

    var serieAtualTr = [];
    (function carregarDadosIniciaisTr() {
      var script = document.getElementById('grafico-trafego-dados');
      if (!script) return;
      try { serieAtualTr = JSON.parse(script.textContent || '[]'); } catch (e) { serieAtualTr = []; }
    })();

    function coordXTr(i, n) {
      return margemEsqTr + (n > 1 ? (larguraUtilTr / (n - 1)) * i : 0);
    }

    function tetoEixoYTr(valor) {
      if (valor <= 0) return 10;
      var exp = Math.pow(10, Math.floor(Math.log10(valor)));
      var passo = valor / exp;
      var base = passo <= 1 ? 1 : passo <= 2 ? 2 : passo <= 5 ? 5 : 10;
      return base * exp;
    }

    function coordYTr(valor, teto) {
      var pct = teto > 0 ? valor / teto : 0;
      return margemTopoTr + (1 - pct) * alturaUtilTr;
    }

    function caminhoAreaTr(pontos) {
      if (!pontos.length) return '';
      var d = 'M ' + pontos.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' L ');
      d += ' L ' + pontos[pontos.length - 1].x.toFixed(1) + ',' + baselineTr;
      d += ' L ' + pontos[0].x.toFixed(1) + ',' + baselineTr + ' Z';
      return d;
    }

    function redesenharTrafego(dados) {
      var serie = (dados && dados.serie) || [];
      var n = serie.length;
      if (!n) return;

      var teto = tetoEixoYTr(dados.maiorValor || 1);
      var pontos = serie.map(function (d, i) { return { x: coordXTr(i, n), y: coordYTr(d.total, teto), d: d }; });
      var poly = pontos.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');

      if (linhaTr) linhaTr.setAttribute('points', poly);
      if (areaTr) areaTr.setAttribute('d', caminhoAreaTr(pontos));

      if (pontosTr) {
        pontosTr.textContent = '';
        pontos.forEach(function (p) {
          var circle = document.createElementNS(SVG_NS_TR, 'circle');
          circle.setAttribute('class', 'ponto-serie ponto-serie--trafego');
          circle.setAttribute('cx', p.x.toFixed(1));
          circle.setAttribute('cy', p.y.toFixed(1));
          circle.setAttribute('r', 3.5);
          pontosTr.appendChild(circle);
        });
      }

      if (gradeTr) {
        gradeTr.textContent = '';
        [0, 0.25, 0.5, 0.75, 1].forEach(function (pct) {
          var y = margemTopoTr + (1 - pct) * alturaUtilTr;
          var linha = document.createElementNS(SVG_NS_TR, 'line');
          linha.setAttribute('class', 'linha-guia');
          linha.setAttribute('x1', margemEsqTr); linha.setAttribute('y1', y.toFixed(1));
          linha.setAttribute('x2', larguraTr - margemDirTr); linha.setAttribute('y2', y.toFixed(1));
          gradeTr.appendChild(linha);
          var texto = document.createElementNS(SVG_NS_TR, 'text');
          texto.setAttribute('class', 'eixo-label-y');
          texto.setAttribute('x', margemEsqTr - 8); texto.setAttribute('y', (y + 3).toFixed(1));
          texto.setAttribute('text-anchor', 'end');
          texto.textContent = String(Math.round(teto * pct));
          gradeTr.appendChild(texto);
        });
      }

      if (eixoXTr) {
        eixoXTr.textContent = '';
        var passoLabel = Math.max(1, Math.ceil(n / 8));
        var indicesRotulo = [];
        for (var iRot = 0; iRot < n; iRot += passoLabel) indicesRotulo.push(iRot);
        var ultimoRot = n - 1;
        if (indicesRotulo[indicesRotulo.length - 1] !== ultimoRot) {
          if (ultimoRot - indicesRotulo[indicesRotulo.length - 1] < passoLabel / 2) indicesRotulo[indicesRotulo.length - 1] = ultimoRot;
          else indicesRotulo.push(ultimoRot);
        }
        indicesRotulo.forEach(function (i) {
          var texto = document.createElementNS(SVG_NS_TR, 'text');
          texto.setAttribute('class', 'eixo-label');
          texto.setAttribute('x', coordXTr(i, n).toFixed(1));
          texto.setAttribute('y', alturaTr - 8);
          texto.setAttribute('text-anchor', 'middle');
          texto.textContent = serie[i].label;
          eixoXTr.appendChild(texto);
        });
      }

      if (totalElTr) totalElTr.textContent = String(dados.total);
      if (periodoTextoElTr) periodoTextoElTr.textContent = dados.periodoRotulo;
      if (variacaoElTr) {
        var subiu = dados.variacaoPercentual >= 0;
        variacaoElTr.className = 'stat-card__variacao ' + (subiu ? 'stat-card__variacao--alta' : 'stat-card__variacao--baixa');
        variacaoElTr.textContent = '';
        var icone = document.createElement('i');
        icone.className = 'fas fa-arrow-' + (subiu ? 'up' : 'down');
        icone.setAttribute('aria-hidden', 'true');
        variacaoElTr.appendChild(icone);
        variacaoElTr.appendChild(document.createTextNode(' ' + Math.abs(dados.variacaoPercentual) + '%'));
      }

      serieAtualTr = serie;
    }

    if (navTr) {
      navTr.addEventListener('click', function (e) {
        var btn = e.target.closest('.chip-periodo');
        if (!btn || btn.classList.contains('is-active')) return;

        Array.prototype.forEach.call(navTr.querySelectorAll('.chip-periodo'), function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        if (cardTr) cardTr.classList.add('is-carregando');

        fetch('/api/admin/dashboard/trafego?periodo=' + encodeURIComponent(btn.dataset.periodo), {
          headers: { 'X-Requested-With': 'fetch' },
        })
          .then(function (r) { return r.json(); })
          .then(function (resp) {
            if (resp && resp.ok) redesenharTrafego(resp.data);
          })
          .catch(function () {   })
          .finally(function () {
            if (cardTr) cardTr.classList.remove('is-carregando');
          });
      });
    }

    if (hitAreaTr && crosshairTr) {
      var indiceFocoTr = 0;

      function indiceMaisProximoTr(localX) {
        var n = serieAtualTr.length;
        if (n <= 1) return 0;
        var passoX = larguraUtilTr / (n - 1);
        var i = Math.round((localX - margemEsqTr) / passoX);
        return Math.min(n - 1, Math.max(0, i));
      }

      function exibirIndiceTr(i, clientX, clientY) {
        var d = serieAtualTr[i];
        if (!d) return;
        indiceFocoTr = i;
        var x = coordXTr(i, serieAtualTr.length);
        crosshairTr.setAttribute('x1', x.toFixed(1));
        crosshairTr.setAttribute('x2', x.toFixed(1));
        crosshairTr.classList.add('is-visivel');
        mostrarTooltip(clientX, clientY, d.label, [
          { cor: 'var(--dourado)', rotulo: 'Acessos', valor: String(d.total) },
        ]);
      }

      hitAreaTr.addEventListener('pointermove', function (e) {
        var rect = svgTr.getBoundingClientRect();
        var localX = ((e.clientX - rect.left) / rect.width) * larguraTr;
        exibirIndiceTr(indiceMaisProximoTr(localX), e.clientX, e.clientY);
      });
      hitAreaTr.addEventListener('pointerleave', function () {
        crosshairTr.classList.remove('is-visivel');
        esconderTooltip();
      });

      function exibirIndiceComFocoTr(i) {
        var d = serieAtualTr[i];
        if (!d) return;
        var rect = svgTr.getBoundingClientRect();
        var x = coordXTr(i, serieAtualTr.length);
        var clientX = rect.left + (x / larguraTr) * rect.width;
        var clientY = rect.top + rect.height / 2;
        exibirIndiceTr(i, clientX, clientY);
      }

      hitAreaTr.addEventListener('focus', function () { exibirIndiceComFocoTr(indiceFocoTr); });
      hitAreaTr.addEventListener('blur', function () {
        crosshairTr.classList.remove('is-visivel');
        esconderTooltip();
      });
      hitAreaTr.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); exibirIndiceComFocoTr(Math.min(serieAtualTr.length - 1, indiceFocoTr + 1)); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); exibirIndiceComFocoTr(Math.max(0, indiceFocoTr - 1)); }
      });
    }
  }

  var svgAc = document.getElementById('grafico-atividade-svg');
  if (svgAc) {
    var SVG_NS_AC = 'http://www.w3.org/2000/svg';

    var margemEsqAc  = Number(svgAc.dataset.margemEsq);
    var margemDirAc  = Number(svgAc.dataset.margemDir);
    var margemTopoAc = Number(svgAc.dataset.margemTopo);
    var margemBaseAc = Number(svgAc.dataset.margemBase);
    var alturaAc     = Number(svgAc.dataset.altura);
    var larguraAc    = Number(svgAc.dataset.largura);
    var alturaUtilAc  = alturaAc  - margemTopoAc - margemBaseAc;
    var larguraUtilAc = larguraAc - margemEsqAc  - margemDirAc;
    var baselineAc    = alturaAc - margemBaseAc;

    var cardAc         = document.getElementById('grafico-atividade-card');
    var linhaNovosAc      = document.getElementById('linha-atividade-novos');
    var linhaTotalAc      = document.getElementById('linha-atividade-total');
    var areaNovosAc       = document.getElementById('area-atividade-novos');
    var areaRecorrentesAc = document.getElementById('area-atividade-recorrentes');
    var gradeAc        = document.getElementById('grafico-atividade-grade');
    var eixoXAc        = document.getElementById('grafico-atividade-eixox');
    var crosshairAc    = document.getElementById('grafico-atividade-crosshair');
    var hitAreaAc      = document.getElementById('grafico-atividade-hitarea');
    var selectAc       = document.getElementById('atividade-periodo-select');
    var totalElAc         = document.getElementById('atividade-total');
    var periodoTextoElAc  = document.getElementById('atividade-periodo-texto');

    var serieAtualAc = [];
    (function carregarDadosIniciaisAc() {
      var script = document.getElementById('grafico-atividade-dados');
      if (!script) return;
      try { serieAtualAc = JSON.parse(script.textContent || '[]'); } catch (e) { serieAtualAc = []; }
    })();

    function coordXAc(i, n) {
      return margemEsqAc + (n > 1 ? (larguraUtilAc / (n - 1)) * i : 0);
    }
    function tetoEixoYAc(valor) {
      if (valor <= 0) return 10;
      var exp = Math.pow(10, Math.floor(Math.log10(valor)));
      var passo = valor / exp;
      var base = passo <= 1 ? 1 : passo <= 2 ? 2 : passo <= 5 ? 5 : 10;
      return base * exp;
    }
    function coordYAc(valor, teto) {
      var pct = teto > 0 ? valor / teto : 0;
      return margemTopoAc + (1 - pct) * alturaUtilAc;
    }

    function redesenharAtividade(dados) {
      var serie = (dados && dados.serie) || [];
      var n = serie.length;
      if (!n) return;

      var teto = tetoEixoYAc(dados.maiorValor || 1);
      var pontosNovos = serie.map(function (d, i) { return { x: coordXAc(i, n), y: coordYAc(d.novos, teto) }; });
      var pontosTotal = serie.map(function (d, i) { return { x: coordXAc(i, n), y: coordYAc(d.total, teto) }; });
      var polyNovos = pontosNovos.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
      var polyTotal = pontosTotal.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');

      if (linhaNovosAc) linhaNovosAc.setAttribute('points', polyNovos);
      if (linhaTotalAc) linhaTotalAc.setAttribute('points', polyTotal);

      if (areaNovosAc) {
        var dNovos = 'M ' + pontosNovos.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' L ');
        dNovos += ' L ' + pontosNovos[n - 1].x.toFixed(1) + ',' + baselineAc;
        dNovos += ' L ' + pontosNovos[0].x.toFixed(1) + ',' + baselineAc + ' Z';
        areaNovosAc.setAttribute('d', dNovos);
      }
      if (areaRecorrentesAc) {
        var dRec = 'M ' + pontosTotal.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' L ');
        dRec += ' L ' + pontosNovos.slice().reverse().map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' L ') + ' Z';
        areaRecorrentesAc.setAttribute('d', dRec);
      }

      if (gradeAc) {
        gradeAc.textContent = '';
        [0, 0.25, 0.5, 0.75, 1].forEach(function (pct) {
          var y = margemTopoAc + (1 - pct) * alturaUtilAc;
          var linha = document.createElementNS(SVG_NS_AC, 'line');
          linha.setAttribute('class', 'linha-guia');
          linha.setAttribute('x1', margemEsqAc); linha.setAttribute('y1', y.toFixed(1));
          linha.setAttribute('x2', larguraAc - margemDirAc); linha.setAttribute('y2', y.toFixed(1));
          gradeAc.appendChild(linha);
          var texto = document.createElementNS(SVG_NS_AC, 'text');
          texto.setAttribute('class', 'eixo-label-y');
          texto.setAttribute('x', margemEsqAc - 8); texto.setAttribute('y', (y + 3).toFixed(1));
          texto.setAttribute('text-anchor', 'end');
          texto.textContent = String(Math.round(teto * pct));
          gradeAc.appendChild(texto);
        });
      }

      if (eixoXAc) {
        eixoXAc.textContent = '';
        var passoLabel = Math.max(1, Math.ceil(n / 8));
        var indicesRotulo = [];
        for (var iRot = 0; iRot < n; iRot += passoLabel) indicesRotulo.push(iRot);
        var ultimoRot = n - 1;
        if (indicesRotulo[indicesRotulo.length - 1] !== ultimoRot) {
          if (ultimoRot - indicesRotulo[indicesRotulo.length - 1] < passoLabel / 2) indicesRotulo[indicesRotulo.length - 1] = ultimoRot;
          else indicesRotulo.push(ultimoRot);
        }
        indicesRotulo.forEach(function (i) {
          var texto = document.createElementNS(SVG_NS_AC, 'text');
          texto.setAttribute('class', 'eixo-label');
          texto.setAttribute('x', coordXAc(i, n).toFixed(1));
          texto.setAttribute('y', alturaAc - 8);
          texto.setAttribute('text-anchor', 'middle');
          texto.textContent = serie[i].label;
          eixoXAc.appendChild(texto);
        });
      }

      if (totalElAc) totalElAc.textContent = String(dados.totalGeral);
      if (periodoTextoElAc) periodoTextoElAc.textContent = dados.periodoRotulo;

      serieAtualAc = serie;
    }

    if (selectAc) {
      selectAc.addEventListener('change', function () {
        if (cardAc) cardAc.classList.add('is-carregando');
        fetch('/api/admin/dashboard/atividade-clientes?periodo=' + encodeURIComponent(selectAc.value), {
          headers: { 'X-Requested-With': 'fetch' },
        })
          .then(function (r) { return r.json(); })
          .then(function (resp) {
            if (resp && resp.ok) redesenharAtividade(resp.data);
          })
          .catch(function () {   })
          .finally(function () {
            if (cardAc) cardAc.classList.remove('is-carregando');
          });
      });
    }

    if (hitAreaAc && crosshairAc) {
      var indiceFocoAc = 0;

      function indiceMaisProximoAc(localX) {
        var n = serieAtualAc.length;
        if (n <= 1) return 0;
        var passoX = larguraUtilAc / (n - 1);
        var i = Math.round((localX - margemEsqAc) / passoX);
        return Math.min(n - 1, Math.max(0, i));
      }

      function exibirIndiceAc(i, clientX, clientY) {
        var d = serieAtualAc[i];
        if (!d) return;
        indiceFocoAc = i;
        var x = coordXAc(i, serieAtualAc.length);
        crosshairAc.setAttribute('x1', x.toFixed(1));
        crosshairAc.setAttribute('x2', x.toFixed(1));
        crosshairAc.classList.add('is-visivel');
        mostrarTooltip(clientX, clientY, d.label, [
          { cor: 'var(--dourado)',     rotulo: 'Clientes novos',       valor: String(d.novos) },
          { cor: 'var(--verde-medio)', rotulo: 'Clientes recorrentes', valor: String(d.recorrentes) },
        ]);
      }

      hitAreaAc.addEventListener('pointermove', function (e) {
        var rect = svgAc.getBoundingClientRect();
        var localX = ((e.clientX - rect.left) / rect.width) * larguraAc;
        exibirIndiceAc(indiceMaisProximoAc(localX), e.clientX, e.clientY);
      });
      hitAreaAc.addEventListener('pointerleave', function () {
        crosshairAc.classList.remove('is-visivel');
        esconderTooltip();
      });

      function exibirIndiceComFocoAc(i) {
        var d = serieAtualAc[i];
        if (!d) return;
        var rect = svgAc.getBoundingClientRect();
        var x = coordXAc(i, serieAtualAc.length);
        var clientX = rect.left + (x / larguraAc) * rect.width;
        var clientY = rect.top + rect.height / 2;
        exibirIndiceAc(i, clientX, clientY);
      }

      hitAreaAc.addEventListener('focus', function () { exibirIndiceComFocoAc(indiceFocoAc); });
      hitAreaAc.addEventListener('blur', function () {
        crosshairAc.classList.remove('is-visivel');
        esconderTooltip();
      });
      hitAreaAc.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); exibirIndiceComFocoAc(Math.min(serieAtualAc.length - 1, indiceFocoAc + 1)); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); exibirIndiceComFocoAc(Math.max(0, indiceFocoAc - 1)); }
      });
    }
  }
})();
