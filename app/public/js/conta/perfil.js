function mostrarToast(msg) {
  const el = document.getElementById('perfil-toast');
  if (!el) return;
  el.innerHTML = '<i class="fas fa-check-circle" aria-hidden="true"></i><b>' + msg + '</b>';
  el.classList.add('visivel');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('visivel'), 2800);
}
