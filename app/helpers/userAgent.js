'use strict';

function detectarNavegador(ua) {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) return 'Chrome';
  if (/chromium/i.test(ua)) return 'Chromium';
  if (/firefox\//i.test(ua)) return 'Firefox';
  if (/version\/.*safari/i.test(ua) || (/safari\//i.test(ua) && !/chrome/i.test(ua))) return 'Safari';
  if (/msie |trident\//i.test(ua)) return 'Internet Explorer';
  return null;
}

function detectarSistemaOperacional(ua) {
  if (/windows nt 10/i.test(ua)) return 'Windows 10/11';
  if (/windows nt/i.test(ua)) return 'Windows';
  if (/mac os x/i.test(ua) && !/iphone|ipad/i.test(ua)) return 'macOS';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/linux/i.test(ua)) return 'Linux';
  return null;
}

function detectarDispositivo(ua) {
  if (/ipad|tablet(?!.*mobile)/i.test(ua)) return 'Tablet';
  if (/mobile|iphone|android/i.test(ua)) return 'Celular';
  return 'Desktop';
}

function parseUserAgent(uaBruto) {
  const ua = String(uaBruto || '');
  if (!ua.trim()) return { navegador: null, sistemaOperacional: null, dispositivo: null };
  return {
    navegador: detectarNavegador(ua),
    sistemaOperacional: detectarSistemaOperacional(ua),
    dispositivo: detectarDispositivo(ua),
  };
}

module.exports = { parseUserAgent };
