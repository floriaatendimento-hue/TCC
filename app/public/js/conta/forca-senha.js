(function () {
  const NIVEIS = ['Vazia', 'Muito fraca', 'Fraca', 'Boa', 'Forte'];

  function avaliarSenha(senha) {
    const requisitos = {
      tamanho: senha.length >= 12,
      caixa:   /[a-z]/.test(senha) && /[A-Z]/.test(senha),
      numero:  /[0-9]/.test(senha),
      simbolo: /[^a-zA-Z0-9]/.test(senha),
    };
    const atendidos = Object.values(requisitos).filter(Boolean).length;
    const nivel = senha.length === 0 ? 0 : Math.max(1, atendidos);
    return { requisitos, nivel };
  }

  function iniciar(secao) {
    const input = document.getElementById(secao.dataset.senhaForca);
    if (!input) return;

    const rotulo = secao.querySelector('.forca-rotulo-texto');
    const itens  = secao.querySelectorAll('.requisito');

    function atualizar() {
      const { requisitos, nivel } = avaliarSenha(input.value);

      secao.className = 'forca-senha forca-nivel-' + nivel;
      if (rotulo) rotulo.textContent = NIVEIS[nivel];

      itens.forEach((item) => {
        const cumprido = !!requisitos[item.dataset.requisito];
        item.classList.toggle('requisito-cumprido', cumprido);

        const icone = item.querySelector('.requisito-icone');
        if (icone) {
          icone.classList.toggle('far', !cumprido);
          icone.classList.toggle('fa-circle', !cumprido);
          icone.classList.toggle('fas', cumprido);
          icone.classList.toggle('fa-check-circle', cumprido);
        }

        const estado = item.querySelector('.requisito-estado');
        if (estado) estado.textContent = cumprido ? ' (requisito cumprido)' : '';
      });
    }

    input.addEventListener('input', atualizar);
    atualizar();
  }

  document.querySelectorAll('[data-senha-forca]').forEach(iniciar);
})();
