document.addEventListener('DOMContentLoaded', function () {
  var btn = document.querySelector('.pagina-erro-voltar');
  if (!btn) return;
  btn.addEventListener('click', function () {
    if (window.history.length > 1) window.history.back();
    else window.location.assign('/');
  });
});
