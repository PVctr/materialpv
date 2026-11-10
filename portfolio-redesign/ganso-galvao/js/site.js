/* Ganso Galvão — interações. Sem dependências.
   1) abertura (retrato → peça na mesma moldura)  2) menu  3) visor de peça  4) orçamento por WhatsApp */
(function () {
  'use strict';
  var WHATS = '5521993018288'; // número confirmado no site atual do artista
  var doc = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var mqSereno = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqCelular = window.matchMedia('(max-width: 820px)');
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var suave = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  function linkWhats(texto) { return 'https://wa.me/' + WHATS + '?text=' + encodeURIComponent(texto); }
  var MSG_GERAL = 'Olá, Ganso! Vim pelo site e quero solicitar um orçamento.\n\nMinha ideia: \nRegião do corpo: \nTamanho aproximado (cm): ';
  $$('[data-whats="geral"]').forEach(function (a) { a.href = linkWhats(MSG_GERAL); });

  /* ---------- 1. Abertura ---------- */
  var abertura = $('.abertura'), palco = $('.palco'), prancha = $('.prancha'),
      heroTexto = $('.hero-texto'), pecaTexto = $('.peca-texto'), veu = $('.veu'),
      retrato = $('.retrato-hero'), leao = $('.camada-leao'), quadroPeca = $('.quadro-peca'), pausa = $('.pausa'), nav = $('.nav');
  var modo = '';

  function definirModo() {
    var novo = mqSereno.matches ? 'sereno' : (mqCelular.matches ? 'corte' : 'zoom');
    if (novo === modo) return;
    modo = novo;
    doc.classList.toggle('sereno', modo === 'sereno');
    doc.classList.toggle('zoom', modo === 'zoom');
    prancha.style.cssText = ''; leao.style.transform = ''; retrato.style.cssText = ''; heroTexto.style.cssText = ''; pecaTexto.style.opacity = ''; veu.style.opacity = '';
    quadroPeca.classList.toggle('ativo', modo === 'sereno');
    quadro();
  }

  function quadro() {
    agendado = false;
    var y = window.scrollY;
    nav.classList.toggle('fundo', y > abertura.offsetHeight - window.innerHeight - 40 || (modo === 'sereno' && y > 40));
    marcarSecao(y);
    if (modo === 'sereno') return;
    var curso = abertura.offsetHeight - window.innerHeight;
    var p = clamp(y / curso, 0, 1);
    var e = suave(clamp((p - .04) / .82, 0, 1));
    doc.classList.toggle('rolando', p > .02);

    var saiHero = clamp(1 - p / .26, 0, 1);
    heroTexto.style.opacity = saiHero;
    heroTexto.style.transform = 'translateY(' + (-p * 90) + 'px)';
    heroTexto.style.visibility = saiHero === 0 ? 'hidden' : '';
    pausa.style.opacity = saiHero; pausa.style.visibility = saiHero === 0 ? 'hidden' : '';
    var entraPeca = clamp((p - .74) / .2, 0, 1);
    pecaTexto.style.opacity = entraPeca;
    quadroPeca.classList.toggle('ativo', entraPeca > .6);
    if (modo === 'corte') {              // celular: corte suave do retrato para a peça
      retrato.style.opacity = 1 - e;
      veu.style.opacity = 1 - e;
      prancha.style.opacity = e;
      prancha.style.transform = 'scale(' + (1.06 - .06 * e) + ')';
      return;
    }
    // desktop: a peça sobe dentro da mesma moldura do retrato e a câmera recua do olhar do leão até a peça inteira
    var w = suave(clamp((p - .06) / .5, 0, 1));
    prancha.style.clipPath = 'inset(' + ((1 - w) * 100).toFixed(2) + '% 0 0 0)';
    leao.style.transform = 'scale(' + (2.6 - 1.6 * e) + ')';
    retrato.style.transform = 'scale(' + (1 + .05 * w) + ')';
    retrato.style.filter = 'brightness(' + (1 - .55 * w) + ')';
  }
  var agendado = false;
  function pedirQuadro() { if (!agendado) { agendado = true; requestAnimationFrame(quadro); } }
  window.addEventListener('scroll', pedirQuadro, { passive: true });
  window.addEventListener('resize', function () { definirModo(); pedirQuadro(); });
  [mqSereno, mqCelular].forEach(function (m) { m.addEventListener ? m.addEventListener('change', definirModo) : m.addListener(definirModo); });

  pausa.addEventListener('click', function () {
    var parado = doc.classList.toggle('parado');
    pausa.setAttribute('aria-pressed', String(parado));
    pausa.textContent = parado ? 'Retomar movimento' : 'Pausar movimento';
  });

  /* ---------- 2. Menu com marcador deslizante ---------- */
  var links = $$('.nav-lista a'), marcador = $('.nav-marcador'), botaoMenu = $('.nav-menu');
  var alvos = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  var atual = -1;
  function marcarSecao(y) {
    var linha = y + window.innerHeight * .4, i, achou = -1;
    for (i = 0; i < alvos.length; i++) {
      if (alvos[i] && alvos[i].getBoundingClientRect().top + y <= linha) achou = i;
    }
    if (achou === atual) return;
    atual = achou;
    links.forEach(function (a, k) { k === achou ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'); });
    if (achou < 0) { marcador.style.width = '0'; return; }
    marcador.style.width = links[achou].offsetWidth + 'px';
    marcador.style.transform = 'translateX(' + links[achou].offsetLeft + 'px)';
  }
  function fecharMenu() { nav.classList.remove('aberta'); botaoMenu.setAttribute('aria-expanded', 'false'); botaoMenu.textContent = 'Menu'; }
  botaoMenu.addEventListener('click', function () {
    var aberta = nav.classList.toggle('aberta');
    botaoMenu.setAttribute('aria-expanded', String(aberta));
    botaoMenu.textContent = aberta ? 'Fechar' : 'Menu';
  });
  links.forEach(function (a) { a.addEventListener('click', fecharMenu); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && nav.classList.contains('aberta')) { fecharMenu(); botaoMenu.focus(); } });

  /* ---------- 3. Visor de peça ---------- */
  var visor = $('.visor'), vImg = $('.visor-palco img'), vPalco = $('.visor-palco'),
      vTitulo = $('.visor-lado h2'), vLegenda = $('.visor-lado .legenda'), vConta = $('.visor-conta'),
      vWhats = $('.visor-whats'), vDetalhe = $('.visor-detalhe');
  var gatilhos = $$('[data-peca]');
  var pecas = [], porIndice = {};
  gatilhos.forEach(function (b) {
    var i = +b.dataset.peca;
    if (porIndice[i] === undefined) {
      porIndice[i] = b;
      pecas[i] = { src: b.dataset.src, nome: b.dataset.nome, local: b.dataset.local, w: +b.dataset.w || 600, h: +b.dataset.h || 800 };
    }
    b.addEventListener('click', function () { abrir(i, b); });
  });
  var indice = 0, origem = null, fechando = false;

  function mostrar(i, troca) {
    indice = (i + pecas.length) % pecas.length;
    var p = pecas[indice];
    var aplicar = function () {
      vImg.src = p.src; vImg.alt = 'Tatuagem ' + p.nome + ', ' + p.local.toLowerCase();
      vImg.width = p.w; vImg.height = p.h;
      vTitulo.textContent = p.nome; vLegenda.textContent = p.local;
      vConta.textContent = 'Peça ' + (indice + 1) + ' de ' + pecas.length;
      vWhats.href = linkWhats('Olá, Ganso! Vi a peça “' + p.nome + '” no seu portfólio e quero um orçamento para uma ideia nesse estilo.\n\nMinha ideia: \nRegião do corpo: \nTamanho aproximado (cm): ');
      vImg.classList.remove('trocando');
    };
    detalhe(false);
    if (troca && !mqSereno.matches) { vImg.classList.add('trocando'); setTimeout(aplicar, 140); } else aplicar();
    // pré-carrega as vizinhas para a troca responder ao toque
    [indice + 1, indice - 1].forEach(function (k) { var n = pecas[(k + pecas.length) % pecas.length]; if (n) (new Image()).src = n.src; });
  }

  function voo(de, abrindo) {      // expande a partir da miniatura (e recolhe de volta)
    if (mqSereno.matches || !de || !vImg.animate) return null;
    var a = de.getBoundingClientRect(), b = vImg.getBoundingClientRect();
    if (!a.width || !b.width) return null;
    var s = a.width / b.width;
    var dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
    var longe = { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')', opacity: .6 }, perto = { transform: 'none', opacity: 1 };
    return vImg.animate(abrindo ? [longe, perto] : [perto, longe], { duration: abrindo ? 340 : 260, easing: 'cubic-bezier(.2,.7,.1,1)' });
  }

  function abrir(i, gatilho) {
    if (visor.open) return;
    origem = gatilho; fechando = false;
    mostrar(i, false);
    visor.showModal();
    var img = gatilho.closest('.peca-texto') ? prancha : (gatilho.querySelector('img') || gatilho);
    voo(img, true);
  }
  function fechar() {
    if (!visor.open || fechando) return;
    fechando = true; detalhe(false);
    var alvo = porIndice[indice] || origem;                 // devolve o foco à miniatura da peça em exibição
    if (indice === 0 && origem && !origem.closest('.grade')) alvo = origem;
    var img = alvo && (alvo.closest('.peca-texto') ? prancha : (alvo.querySelector('img') || alvo));
    var visivel = img && img.getBoundingClientRect().bottom > 0 && img.getBoundingClientRect().top < window.innerHeight;
    var anim = visivel ? voo(img, false) : null;
    var fim = function () { visor.close(); fechando = false; if (alvo) alvo.focus({ preventScroll: !!visivel }); };
    if (anim) anim.onfinish = fim; else fim();
  }
  function detalhe(liga) {
    visor.classList.toggle('detalhe', liga);
    vDetalhe.setAttribute('aria-pressed', String(liga));
    vDetalhe.textContent = liga ? 'Ver peça inteira' : 'Ver detalhe';
    if (!liga) vImg.style.transformOrigin = '';
  }
  function mirar(ev) {
    if (!visor.classList.contains('detalhe')) return;
    var r = vPalco.getBoundingClientRect();
    vImg.style.transformOrigin = clamp((ev.clientX - r.left) / r.width * 100, 0, 100) + '% ' + clamp((ev.clientY - r.top) / r.height * 100, 0, 100) + '%';
  }

  visor.addEventListener('cancel', function (ev) { ev.preventDefault(); fechar(); });   // Esc
  $('.fechar').addEventListener('click', fechar);
  $('.visor-ant').addEventListener('click', function () { mostrar(indice - 1, true); });
  $('.visor-prox').addEventListener('click', function () { mostrar(indice + 1, true); });
  vDetalhe.addEventListener('click', function () { detalhe(!visor.classList.contains('detalhe')); });
  visor.addEventListener('keydown', function (ev) {
    if (ev.target.matches('input,textarea')) return;
    if (ev.key === 'ArrowRight') { ev.preventDefault(); mostrar(indice + 1, true); }
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); mostrar(indice - 1, true); }
  });
  var toque = null;
  vPalco.addEventListener('pointerdown', function (ev) { toque = { x: ev.clientX, y: ev.clientY, t: Date.now() }; mirar(ev); });
  vPalco.addEventListener('pointermove', mirar);
  vPalco.addEventListener('pointerup', function (ev) {
    if (!toque) return;
    var dx = ev.clientX - toque.x, dy = ev.clientY - toque.y; toque = null;
    if (visor.classList.contains('detalhe')) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && ev.pointerType === 'mouse') detalhe(false); return; }
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) mostrar(indice + (dx < 0 ? 1 : -1), true);
    else if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && ev.target === vPalco) fechar();
  });
  vPalco.addEventListener('pointercancel', function () { toque = null; });

  /* ---------- 4. Orçamento: o formulário só monta a mensagem do WhatsApp ---------- */
  var form = $('#pedido');
  if (form) {
    var enviar = $('#pedido-enviar');
    var montar = function () {
      var v = function (n) { return (form.elements[n].value || '').trim(); };
      enviar.href = linkWhats('Olá, Ganso! Vim pelo site e quero solicitar um orçamento.\n\nMinha ideia: ' + v('ideia') + '\nRegião do corpo: ' + v('regiao') + '\nTamanho aproximado (cm): ' + v('tamanho'));
    };
    form.addEventListener('input', montar);
    form.addEventListener('submit', function (ev) { ev.preventDefault(); montar(); enviar.click(); });
    montar();
  }

  definirModo();
  quadro();
})();
