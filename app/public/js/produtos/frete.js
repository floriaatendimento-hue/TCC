(function () {
  'use strict';

  function formatarCep(valor) {
    return valor.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9);
  }

  function formatarBRL(valor) {
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatarPrazo(dias) {
    return dias === 1 ? '1 dia útil' : dias + ' dias úteis';
  }

  function limparResultado(ul) {
    ul.innerHTML = '';
    ul.hidden = true;
  }

  function mostrarStatus(p, mensagem, tipo) {
    p.textContent = mensagem;
    p.hidden = !mensagem;
    p.className = 'frete-status' + (tipo ? ' frete-status--' + tipo : '');
    p.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  }

  function renderizarOpcoes(ul, resultado) {
    ul.innerHTML = '';
    resultado.opcoes.forEach(function (opcao) {
      var li = document.createElement('li');
      li.className = 'frete-opcao';

      var nome = document.createElement('p');
      nome.className = 'frete-opcao-nome';
      var strong = document.createElement('strong');
      strong.textContent = opcao.transportadora;
      nome.appendChild(strong);
      nome.appendChild(document.createTextNode(' - ' + opcao.tipo));

      var prazo = document.createElement('p');
      prazo.className = 'frete-opcao-prazo';
      prazo.appendChild(document.createTextNode('Chega em até '));
      var dataEl = document.createElement('data');
      dataEl.value = opcao.prazoDias;
      dataEl.textContent = formatarPrazo(opcao.prazoDias);
      prazo.appendChild(dataEl);

      var valor = document.createElement('output');
      valor.className = 'frete-opcao-valor';
      valor.setAttribute('for', 'cep');
      valor.textContent = opcao.valor === 0 ? 'Grátis' : formatarBRL(opcao.valor);

      li.appendChild(nome);
      li.appendChild(prazo);
      li.appendChild(valor);
      ul.appendChild(li);
    });
    ul.hidden = false;
  }

  function obterQuantidade(form) {
    var secao = form.closest('.info') || document;
    var campo = secao.querySelector('#qtd');
    var valor = campo ? parseInt(campo.value, 10) : 1;
    return isFinite(valor) && valor > 0 ? valor : 1;
  }

  function iniciarFormulario(form) {
    var input = form.querySelector('input[type="text"]');
    var botao = form.querySelector('.btn-calcular');
    var secaoFrete = form.closest('.frete');
    if (!input || !botao || !secaoFrete) return;

    var status = secaoFrete.querySelector('.frete-status');
    var resultado = secaoFrete.querySelector('.frete-resultado');
    if (!status || !resultado) return;

    var textoOriginalBotao = botao.textContent;
    var requisicaoEmAndamento = false;

    input.addEventListener('input', function () {
      input.value = formatarCep(input.value);
    });

    form.addEventListener('submit', function (evento) {
      evento.preventDefault();
      if (requisicaoEmAndamento) return;

      var cepDigitado = input.value.replace(/\D/g, '');
      if (cepDigitado.length !== 8) {
        mostrarStatus(status, 'Digite um CEP válido com 8 dígitos.', 'erro');
        limparResultado(resultado);
        input.focus();
        return;
      }

      var slug = form.dataset.slug;
      if (!slug) {
        mostrarStatus(status, 'Não foi possível identificar o produto para calcular o frete.', 'erro');
        return;
      }

      requisicaoEmAndamento = true;
      botao.disabled = true;
      botao.textContent = 'Calculando…';
      secaoFrete.classList.add('frete--carregando');
      mostrarStatus(status, 'Calculando o frete…', 'carregando');
      limparResultado(resultado);

      var csrf = (document.getElementById('csrf-token') || {}).value || '';

      fetch('/api/frete/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({
          cep: cepDigitado,
          slug: slug,
          quantidade: obterQuantidade(form),
        }),
      })
        .then(function (resp) {
          return resp.json()
            .catch(function () { return null; })
            .then(function (json) { return { status: resp.status, json: json }; });
        })
        .then(function (res) {
          if (!res.json || res.json.ok !== true) {
            var msg = (res.json && res.json.message) || 'Não foi possível calcular o frete agora. Tente novamente.';
            mostrarStatus(status, msg, 'erro');
            return;
          }
          var dados = res.json.data;
          var localTexto = dados.cidade && dados.uf ? ' para ' + dados.cidade + '/' + dados.uf : '';
          mostrarStatus(status, (dados.freteGratis ? 'Frete grátis' : 'Frete calculado') + localTexto + '.', 'sucesso');
          renderizarOpcoes(resultado, dados);
        })
        .catch(function () {
          mostrarStatus(status, 'Falha de conexão. Verifique sua internet e tente novamente.', 'erro');
        })
        .finally(function () {
          requisicaoEmAndamento = false;
          botao.disabled = false;
          botao.textContent = textoOriginalBotao;
          secaoFrete.classList.remove('frete--carregando');
        });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var forms = document.querySelectorAll('section.frete form.frete-row');
    forms.forEach(iniciarFormulario);
  });
})();
