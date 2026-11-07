/*
 * Comportamentos da página: links de contato, menu mobile, botão flutuante
 * e carregamento sob demanda do dente 3D. O conteúdo funciona sem este arquivo.
 */
(function () {
  'use strict';

  var cfg = window.SITE_CONFIG || {};
  var doc = document;

  /* ---------- WhatsApp ---------- */
  var phone = String(cfg.whatsapp || '').replace(/\D/g, '');

  function waUrl() {
    var msg = cfg.whatsappMessage || '';
    return 'https://wa.me/' + phone + (msg ? '?text=' + encodeURIComponent(msg) : '');
  }

  function formatPhone(digits) {
    // 55 + DDD + número (8 ou 9 dígitos)
    var m = digits.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
    return m ? '(' + m[1] + ') ' + m[2] + '-' + m[3] : '+' + digits;
  }

  if (phone.length >= 12) {
    doc.querySelectorAll('[data-wa]').forEach(function (a) {
      a.href = waUrl();
      a.target = '_blank';
      a.rel = 'noopener';
      if (!a.hasAttribute('aria-label') && !a.hasAttribute('data-wa-display')) {
        a.setAttribute('aria-label', a.textContent.trim() + ' (abre o WhatsApp em nova aba)');
      }
    });
    doc.querySelectorAll('[data-wa-display]').forEach(function (el) {
      el.textContent = formatPhone(phone);
      el.setAttribute('aria-label', 'WhatsApp ' + formatPhone(phone) + ' (abre em nova aba)');
    });
  } else if (window.console) {
    console.warn('[site] Configure o número de WhatsApp em js/config.js. Enquanto isso, os botões levam à seção de contato.');
  }

  /* ---------- Instagram ---------- */
  if (/^https:\/\/(www\.)?instagram\.com\/.+/.test(cfg.instagram || '')) {
    doc.querySelectorAll('[data-instagram]').forEach(function (a) {
      a.href = cfg.instagram; a.target = '_blank'; a.rel = 'noopener';
    });
    doc.querySelectorAll('[data-instagram-item]').forEach(function (el) { el.hidden = false; });
  }

  /* ---------- Google Maps ---------- */
  if (cfg.address && cfg.address.trim()) {
    doc.querySelectorAll('[data-maps]').forEach(function (a) {
      a.href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(cfg.address.trim());
      a.target = '_blank'; a.rel = 'noopener';
      a.hidden = false;
    });
  }

  /* ---------- Ano no rodapé ---------- */
  doc.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Cabeçalho ---------- */
  var header = doc.querySelector('.site-header');
  var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Menu mobile ---------- */
  var toggle = doc.querySelector('.nav-toggle');
  var nav = doc.getElementById('menu-principal');
  var mq = window.matchMedia('(max-width: 960px)');

  function setMenu(open, returnFocus) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.nav-toggle-label').textContent = open ? 'Fechar' : 'Menu';
    nav.classList.toggle('is-open', open);
    if (open) {
      var first = nav.querySelector('a');
      if (first) first.focus();
    } else if (returnFocus) {
      toggle.focus();
    }
  }
  toggle.addEventListener('click', function () {
    setMenu(toggle.getAttribute('aria-expanded') !== 'true');
  });
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a') && mq.matches) setMenu(false);
  });
  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) setMenu(false, true);
  });
  doc.addEventListener('click', function (e) {
    if (nav.classList.contains('is-open') && !e.target.closest('.site-header')) setMenu(false);
  });
  var onMq = function () { if (!mq.matches) setMenu(false); };
  mq.addEventListener ? mq.addEventListener('change', onMq) : mq.addListener(onMq);

  /* ---------- Botão flutuante ---------- */
  var floatBtn = doc.querySelector('.wa-float');
  var heroActions = doc.querySelector('.hero-actions');
  var finalCta = doc.getElementById('localizacao');
  if (floatBtn && heroActions && finalCta && 'IntersectionObserver' in window) {
    floatBtn.hidden = false;
    var heroVisible = true, finalVisible = false;
    var update = function () { floatBtn.classList.toggle('is-visible', !heroVisible && !finalVisible); };
    new IntersectionObserver(function (en) { heroVisible = en[0].isIntersecting; update(); }).observe(heroActions);
    new IntersectionObserver(function (en) { finalVisible = en[0].isIntersecting; update(); }, { rootMargin: '0px 0px -25% 0px' }).observe(finalCta);
    // fora da tela, não recebe foco por teclado
    var syncFocus = function () { floatBtn.tabIndex = floatBtn.classList.contains('is-visible') ? 0 : -1; };
    new MutationObserver(syncFocus).observe(floatBtn, { attributes: true, attributeFilter: ['class'] });
    syncFocus();
  }

  /* ---------- Dente 3D (sob demanda) ---------- */
  var stage = doc.getElementById('tooth-stage');
  var model = cfg.model || {};

  function webglAvailable() {
    try {
      var c = doc.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = doc.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve; s.onerror = function () { reject(new Error('Falha ao carregar ' + src)); };
      doc.head.appendChild(s);
    });
  }

  function initTooth() {
    loadScript('js/tooth-renderer.js')
      .then(function () {
        return window.ToothRenderer.mount(stage, {
          src: model.src,
          // modelo embutido em JS (opcional, usado quando a hospedagem não serve arquivos .glb)
          buffer: window.TOOTH_MODEL_BASE64 ? Uint8Array.from(atob(window.TOOTH_MODEL_BASE64), function (c) { return c.charCodeAt(0); }).buffer : undefined,
          rotation: model.rotation,
          scale: model.scale,
          includeMeshes: model.includeMeshes,
          maxPixelRatio: model.maxPixelRatio,
          floatAmplitude: model.floatAmplitude,
          orbit: model.orbit,
          onError: function (err) { console.warn('[site] 3D:', err.message); }
        });
      })
      .catch(function (err) {
        // a imagem estática permanece visível
        stage.classList.remove('is-3d-ready');
        var c = stage.querySelector('canvas'); if (c) c.remove();
        if (window.console) console.warn('[site] Dente 3D indisponível, exibindo imagem estática:', err.message);
      });
  }

  if (stage && model.src && webglAvailable() && 'IntersectionObserver' in window && 'ResizeObserver' in window) {
    var started = false;
    var io = new IntersectionObserver(function (entries) {
      if (started || !entries[0].isIntersecting) return;
      started = true; io.disconnect();
      // espera o carregamento principal e um momento ocioso
      var go = function () { (window.requestIdleCallback || function (f) { setTimeout(f, 200); })(initTooth, { timeout: 1500 }); };
      doc.readyState === 'complete' ? go() : window.addEventListener('load', go, { once: true });
    }, { rootMargin: '200px' });
    io.observe(stage);
  }
})();
