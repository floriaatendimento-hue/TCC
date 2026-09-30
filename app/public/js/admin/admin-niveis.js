(function () {
  'use strict';

  var main = document.querySelector('.admin-main');
  if (!main || !document.getElementById('dialog-excluir-nivel')) return;

  function csrfToken() {
    var el = document.getElementById('csrf-token');
    return el ? el.value : '';
  }

  function mostrarMsg(el, texto, tipo) {
    el.textContent = texto;
    el.className = 'form-admin__mensagem ' + (tipo === 'erro' ? 'is-erro' : 'is-sucesso');
  }
  function limparMsg(el) { el.textContent = ''; el.className = 'form-admin__mensagem'; }

  function brl(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function ligarFechamento(dialog, btnFechar, btnCancelar) {
    if (btnFechar)   btnFechar.addEventListener('click', function () { dialog.close(); });
    if (btnCancelar) btnCancelar.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('cancel', function (e) { e.preventDefault(); dialog.close(); });
    dialog.addEventListener('click', function (e) {
      var r = dialog.getBoundingClientRect();
      var dentro = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!dentro) dialog.close();
    });
  }

  /* EXCLUSÃO */

  var dialogExcluir  = document.getElementById('dialog-excluir-nivel');
  var excluirResumo  = document.getElementById('excluir-resumo');
  var excluirMsg     = document.getElementById('form-excluir-msg');
  var btnConfirmar   = document.getElementById('btn-confirmar-excluir');
  var idParaExcluir  = null;

  ligarFechamento(
    dialogExcluir,
    document.getElementById('dialog-excluir-fechar'),
    document.getElementById('btn-cancelar-excluir')
  );

  function abrirExclusao(botao) {
    idParaExcluir = botao.dataset.id;
    limparMsg(excluirMsg);
    excluirResumo.textContent = 'Carregando impacto…';
    btnConfirmar.disabled = false;
    dialogExcluir.showModal();

    fetch('/api/admin/niveis/' + idParaExcluir + '/impacto')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) { excluirResumo.textContent = 'Não foi possível carregar o impacto.'; return; }
        var d = data.data;
        var partes = ['Excluir o nível “' + d.nivel.nome + '” (a partir de ' + brl(d.nivel.valor_minimo) + ').'];

        if (d.clientes_no_nivel === 0) {
          partes.push('Nenhum cliente está neste nível no momento.');
        } else {
          var plural = d.clientes_no_nivel === 1 ? 'cliente está' : 'clientes estão';
          partes.push(d.clientes_no_nivel + ' ' + plural + ' neste nível e ' +
            (d.destino
              ? 'passará' + (d.clientes_no_nivel === 1 ? '' : 'ão') + ' para “' + d.destino.nome + '”.'
              : 'ficará' + (d.clientes_no_nivel === 1 ? '' : 'ão') + ' sem nível até que exista uma faixa abaixo desta.'));
        }
        excluirResumo.textContent = partes.join(' ');
      })
      .catch(function () { excluirResumo.textContent = 'Não foi possível carregar o impacto.'; });
  }

  btnConfirmar.addEventListener('click', function () {
    if (!idParaExcluir) return;
    limparMsg(excluirMsg);
    btnConfirmar.disabled = true;
    btnConfirmar.classList.add('is-carregando');

    fetch('/api/admin/niveis/' + idParaExcluir, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': csrfToken() },
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) {
          mostrarMsg(excluirMsg, data.message || 'Não foi possível excluir.', 'erro');
          btnConfirmar.disabled = false;
          btnConfirmar.classList.remove('is-carregando');
          return;
        }
        window.location.reload();
      })
      .catch(function () {
        mostrarMsg(excluirMsg, 'Erro de conexão. Tente novamente.', 'erro');
        btnConfirmar.disabled = false;
        btnConfirmar.classList.remove('is-carregando');
      });
  });

  /* AÇÕES NA LISTA */

  main.addEventListener('click', function (e) {
    var btnExcluir = e.target.closest('.js-excluir');
    if (btnExcluir) return abrirExclusao(btnExcluir);

    var btnMover = e.target.closest('.js-mover');
    if (btnMover) {
      var card = btnMover.closest('.nivel-card');
      btnMover.disabled = true;
      fetch('/api/admin/niveis/' + card.dataset.id + '/mover', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({ direcao: btnMover.dataset.direcao }),
      })
        .then(function () { window.location.reload(); })
        .catch(function () {
          btnMover.disabled = false;
          window.alert('Não foi possível reordenar agora.');
        });
    }
  });

  main.addEventListener('change', function (e) {
    var toggle = e.target.closest('.js-toggle-ativo');
    if (!toggle) return;
    var card = toggle.closest('.nivel-card');

    fetch('/api/admin/niveis/' + card.dataset.id + '/ativo', {
      method: 'PATCH',
      headers: { 'X-CSRF-Token': csrfToken() },
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) {
          toggle.checked = !toggle.checked;
          window.alert(data.message || 'Não foi possível alterar o status.');
          return;
        }
        window.location.reload();
      })
      .catch(function () {
        toggle.checked = !toggle.checked;
        window.alert('Não foi possível alterar o status agora.');
      });
  });

  var btnReordenar = document.getElementById('btn-reordenar-valor');
  if (btnReordenar) {
    btnReordenar.addEventListener('click', function () {
      btnReordenar.disabled = true;
      btnReordenar.classList.add('is-carregando');
      fetch('/api/admin/niveis/reordenar-por-valor', {
        method: 'PATCH',
        headers: { 'X-CSRF-Token': csrfToken() },
      })
        .then(function () { window.location.reload(); })
        .catch(function () {
          btnReordenar.disabled = false;
          btnReordenar.classList.remove('is-carregando');
          window.alert('Não foi possível reordenar agora.');
        });
    });
  }
})();
