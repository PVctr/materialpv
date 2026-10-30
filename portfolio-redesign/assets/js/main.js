/* Paulo Victor — portfólio. Sem dependências. */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const PHONE = '5521990777088';
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasIO = 'IntersectionObserver' in window;

  /* ---------------------------------------------------------------
     Abertura em vídeo
     - termina sozinha, ou com "Pular abertura" / Esc
     - se o vídeo não tocar (autoplay bloqueado, rede lenta, erro), segue sem ela
  ---------------------------------------------------------------- */
  const intro = $('#intro');
  const app = $('#app');

  const ready = (delay = 0) => setTimeout(() => root.classList.add('is-ready'), delay);

  function runIntro() {
    const video = $('#introVideo');
    const skip = $('#introSkip');
    const sources = $$('source', video);
    let done = false;
    let startTimer;
    let hardTimer;

    app.setAttribute('inert', '');
    document.body.classList.add('is-locked');

    const release = () => {
      if (!intro.isConnected) return;
      try { video.pause(); video.removeAttribute('src'); sources.forEach((s) => s.remove()); video.load(); } catch (e) {}
      intro.remove();
    };

    function finish(instant) {
      if (done) return;
      done = true;
      clearTimeout(startTimer);
      clearTimeout(hardTimer);
      try { sessionStorage.setItem('pv-intro', '1'); } catch (e) {}

      app.removeAttribute('inert');
      document.body.classList.remove('is-locked');

      if (instant) {
        intro.classList.add('is-instant');
        release();
        ready();
        return;
      }

      intro.classList.add('is-leaving');
      ready(380);
      intro.addEventListener('transitionend', (e) => { if (e.propertyName === 'clip-path') release(); });
      setTimeout(release, 1800);
    }

    video.addEventListener('playing', () => {
      clearTimeout(startTimer);
      intro.classList.add('is-playing');
    }, { once: true });
    video.addEventListener('ended', () => finish(false));
    video.addEventListener('error', () => finish(true));
    if (sources.length) sources[sources.length - 1].addEventListener('error', () => finish(true));

    skip.addEventListener('click', () => finish(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') finish(false); });

    startTimer = setTimeout(() => { if (!intro.classList.contains('is-playing')) finish(true); }, 4000);
    hardTimer = setTimeout(() => finish(false), 9000);

    const p = video.play();
    if (p && typeof p.catch === 'function') p.catch(() => finish(true));
  }

  if (intro && root.classList.contains('has-intro')) {
    runIntro();
  } else {
    if (intro) intro.remove();
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-ready')));
  }

  /* ---------------------------------------------------------------
     Cabeçalho: fundo mais firme depois de rolar
  ---------------------------------------------------------------- */
  const header = $('.header');
  const sentinel = $('#sentinel');
  if (header && sentinel && hasIO) {
    new IntersectionObserver(([entry]) => {
      header.classList.toggle('is-stuck', !entry.isIntersecting);
    }, { rootMargin: '-24px 0px 0px 0px' }).observe(sentinel);
  }

  /* ---------------------------------------------------------------
     Navegação: seção atual
  ---------------------------------------------------------------- */
  const navLinks = $$('.nav__link');
  const sections = ['projetos', 'servicos', 'processo', 'sobre', 'contato']
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (sections.length && hasIO) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        navLinks.forEach((a) => {
          if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => io.observe(s));
  }

  /* ---------------------------------------------------------------
     Menu mobile (tela cheia)
  ---------------------------------------------------------------- */
  const menuBtn = $('#menuBtn');
  const menuLabel = $('#menuLabel');
  const mobileNav = $('#mobileNav');
  let menuTimer;

  function setMenu(open) {
    if (!menuBtn || !mobileNav) return;
    clearTimeout(menuTimer);
    menuBtn.setAttribute('aria-expanded', String(open));
    if (menuLabel) menuLabel.textContent = open ? 'Fechar' : 'Menu';
    document.body.classList.toggle('menu-open', open);
    if (open) {
      mobileNav.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => mobileNav.classList.add('is-open')));
    } else {
      mobileNav.classList.remove('is-open');
      menuTimer = setTimeout(() => { mobileNav.hidden = true; }, calm ? 0 : 380);
    }
  }
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
    mobileNav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); }
    });
    matchMedia('(min-width: 861px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
  }

  /* ---------------------------------------------------------------
     Entradas ao rolar (sutis; sem IntersectionObserver, tudo aparece)
  ---------------------------------------------------------------- */
  const reveals = $$('[data-reveal]');
  if (reveals.length) {
    if (hasIO && !calm) {
      const ro = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          ro.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      reveals.forEach((el) => ro.observe(el));
    } else {
      reveals.forEach((el) => el.classList.add('is-in'));
    }
  }

  /* ---------------------------------------------------------------
     Brilho que acompanha o cursor nos cards de projeto
  ---------------------------------------------------------------- */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !calm) {
    $$('.project').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ---------------------------------------------------------------
     Hero: campo de barras em 3D
     Canvas 2D com projeção em perspectiva própria, sem bibliotecas.
     - uma onda atravessa o campo; o ponteiro levanta as barras próximas
     - pausa fora da tela e com a aba oculta; com "reduzir movimento", um quadro parado
  ---------------------------------------------------------------- */
  const canvas = $('#field');
  const heroEl = $('#inicio');

  if (canvas && heroEl && canvas.getContext) {
    const ctx = canvas.getContext('2d');
    const STEPS = 40;
    const lerp = (a, b, t) => a + (b - a) * t;
    const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

    // Paleta: grafite -> laranja do portfólio -> brasa clara
    const LOW = [30, 35, 43], MID = [255, 90, 31], HIGH = [255, 156, 108];
    const topC = [], frontC = [], sideC = [];
    for (let i = 0; i < STEPS; i++) {
      const k = i / (STEPS - 1);
      const c = k < 0.72 ? mix(LOW, MID, Math.pow(k / 0.72, 1.35)) : mix(MID, HIGH, (k - 0.72) / 0.28);
      const rgb = (m) => 'rgb(' + Math.round(c[0] * m) + ',' + Math.round(c[1] * m) + ',' + Math.round(c[2] * m) + ')';
      topC.push(rgb(1)); frontC.push(rgb(0.66)); sideC.push(rgb(0.42));
    }

    let W = 0, H = 0, dpr = 1, small = false;
    let cols = 0, rows = 0, order = [];
    let cx = 0, cy = 0, f = 0;
    let base = null; // projeção fixa da base de cada barra
    let top = null;  // projeção da face superior, a cada quadro
    let raf = 0, visible = true, last = 0;
    const ptr = { x: 0, y: 0, tx: 0, ty: 0, on: false };

    const CELL = 1, HALF = 0.41;
    const CAM_Y = 9, CAM_Z = 7, PITCH = 0.5;
    const cp = Math.cos(PITCH), sp = Math.sin(PITCH);

    function setup() {
      const r = heroEl.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      small = W < 760;
      dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = small ? 26 : 44; rows = small ? 20 : 26;
      f = W * (small ? 1.45 : 0.72);
      cx = W * (small ? 0.56 : 0.64); cy = H * (small ? 0.36 : 0.36);

      // ordem de desenho em cada fileira: das bordas para o centro
      order = [];
      const mid = Math.floor(cols / 2);
      for (let i = 0; i < mid; i++) order.push(i);
      for (let i = cols - 1; i >= mid; i--) order.push(i);

      base = new Float32Array(cols * rows * 10);
      top = new Float32Array(cols * rows * 8);
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const n = (j * cols + i) * 10;
          const x0 = (i - cols / 2 + 0.5) * CELL, z0 = j * CELL;
          project(x0 - HALF, 0, z0 - HALF, base, n);      // perto, esquerda
          project(x0 + HALF, 0, z0 - HALF, base, n + 2);  // perto, direita
          project(x0 - HALF, 0, z0 + HALF, base, n + 4);  // longe, esquerda
          project(x0 + HALF, 0, z0 + HALF, base, n + 6);  // longe, direita
          project(x0, 0, z0, base, n + 8);                // centro
        }
      }
    }

    function project(x, y, z, out, n) {
      const py = y - CAM_Y, pz = z + CAM_Z;
      const depth = -py * sp + pz * cp;
      const up = py * cp + pz * sp;
      const s = f / depth;
      out[n] = cx + x * s;
      out[n + 1] = cy - up * s;
    }

    function height(x, z, t) {
      const u = x * 0.46 + z * 0.34 - t * 0.9;
      const ridge = Math.pow(0.5 + 0.5 * Math.sin(u), 2.4) * 2.7;
      const ripple = (0.5 + 0.5 * Math.sin(x * 0.85 - z * 0.55 + t * 1.6)) * 0.42;
      const swell = (0.5 + 0.5 * Math.sin(z * 0.27 + t * 0.45)) * 0.5;
      return 0.14 + ridge + ripple + swell;
    }

    function quad(c, x1, y1, x2, y2, x3, y3, x4, y4) {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill();
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      ptr.x += (ptr.tx - ptr.x) * 0.12; ptr.y += (ptr.ty - ptr.y) * 0.12;
      const sigma2 = 2 * Math.pow(W * 0.085, 2);

      for (let j = rows - 1; j >= 0; j--) {
        ctx.globalAlpha = 0.2 + 0.8 * Math.pow(1 - j / rows, 0.8);
        for (let q = 0; q < cols; q++) {
          const i = order[q];
          const n = (j * cols + i) * 10, m = (j * cols + i) * 8;
          const x0 = (i - cols / 2 + 0.5) * CELL, z0 = j * CELL;

          let h = height(x0, z0, t);
          if (ptr.on) {
            const dx = base[n + 8] - ptr.x, dy = base[n + 9] - ptr.y;
            h += 1.9 * Math.exp(-(dx * dx + dy * dy) / sigma2);
          }
          const k = Math.min(1, Math.max(0, (h - 0.14) / 3.4));
          const ci = (k * (STEPS - 1)) | 0;

          project(x0 - HALF, h, z0 - HALF, top, m);      // perto, esquerda
          project(x0 + HALF, h, z0 - HALF, top, m + 2);  // perto, direita
          project(x0 + HALF, h, z0 + HALF, top, m + 4);  // longe, direita
          project(x0 - HALF, h, z0 + HALF, top, m + 6);  // longe, esquerda

          // lateral voltada para o centro da imagem
          if (x0 > 0) {
            quad(sideC[ci], top[m], top[m + 1], top[m + 6], top[m + 7], base[n + 4], base[n + 5], base[n], base[n + 1]);
          } else if (x0 < 0) {
            quad(sideC[ci], top[m + 2], top[m + 3], top[m + 4], top[m + 5], base[n + 6], base[n + 7], base[n + 2], base[n + 3]);
          }
          // frente
          quad(frontC[ci], top[m], top[m + 1], top[m + 2], top[m + 3], base[n + 2], base[n + 3], base[n], base[n + 1]);
          // topo
          quad(topC[ci], top[m], top[m + 1], top[m + 2], top[m + 3], top[m + 4], top[m + 5], top[m + 6], top[m + 7]);
        }
      }
      ctx.globalAlpha = 1;
    }

    const t0 = performance.now();
    function frame(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      raf = requestAnimationFrame(frame);
      if (small && now - last < 32) return; // ~30 quadros por segundo no celular
      last = now;
      draw((now - t0) / 1000);
    }
    const start = () => { if (!raf && visible && !document.hidden && !calm) raf = requestAnimationFrame(frame); };

    setup();
    draw(2.6);
    requestAnimationFrame(() => canvas.classList.add('is-live'));

    if (!calm) {
      start();
      if (hasIO) new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(heroEl);
      document.addEventListener('visibilitychange', start);
      if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
        heroEl.addEventListener('pointermove', (e) => {
          const r = heroEl.getBoundingClientRect();
          ptr.tx = e.clientX - r.left; ptr.ty = e.clientY - r.top;
          if (!ptr.on) { ptr.x = ptr.tx; ptr.y = ptr.ty; ptr.on = true; }
        });
        heroEl.addEventListener('pointerleave', () => { ptr.on = false; });
      }
    }

    let rz;
    const onResize = () => { clearTimeout(rz); rz = setTimeout(() => { setup(); if (calm) draw(2.6); }, 120); };
    if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(heroEl);
    else window.addEventListener('resize', onResize);
  }

  /* ---------------------------------------------------------------
     Hero: linha "eu crio ..." que troca de palavra
  ---------------------------------------------------------------- */
  const typed = $('#typed');
  if (typed && !calm) {
    const words = ['landing pages', 'sites institucionais', 'páginas responsivas', 'sites rápidos'];
    let w = 0, n = words[0].length, erasing = false;
    const tick = () => {
      const word = words[w];
      typed.textContent = word.slice(0, n);
      let wait = erasing ? 38 : 82;
      if (!erasing && n === word.length) { erasing = true; wait = 1800; }
      else if (erasing && n === 0) { erasing = false; w = (w + 1) % words.length; wait = 380; }
      else n += erasing ? -1 : 1;
      setTimeout(tick, wait);
    };
    setTimeout(tick, 2200);
  }

  /* ---------------------------------------------------------------
     Barra fixa de WhatsApp (celular): aparece depois do hero
     e some quando o contato já está na tela
  ---------------------------------------------------------------- */
  const dock = $('#dock');
  const contactEl = $('#contato');
  if (dock && heroEl && contactEl && hasIO) {
    let heroIn = true;
    let contactIn = false;
    const update = () => {
      const on = !heroIn && !contactIn;
      dock.classList.toggle('is-on', on);
      if (on) dock.removeAttribute('inert'); else dock.setAttribute('inert', '');
    };
    new IntersectionObserver(([e]) => { heroIn = e.isIntersecting; update(); }, { threshold: 0.2 }).observe(heroEl);
    new IntersectionObserver(([e]) => { contactIn = e.isIntersecting; update(); }, { threshold: 0.1 }).observe(contactEl);
  }

  /* ---------------------------------------------------------------
     Formulário → mensagem de WhatsApp
  ---------------------------------------------------------------- */
  const form = $('#briefing');
  if (form) {
    const tipo = $('#tipo');
    const objetivo = $('#objetivo');
    const nome = $('#nome');
    const contador = $('#contador');
    const erro = $('#tipo-erro');
    const status = $('#status');
    const copiar = $('#copiar');

    const message = () => {
      const lines = ['Olá, Paulo! Vim pelo seu portfólio e quero falar sobre um projeto.', '', 'Tipo de site: ' + tipo.value];
      if (objetivo.value.trim()) lines.push('Objetivo: ' + objetivo.value.trim());
      if (nome.value.trim()) lines.push('Nome: ' + nome.value.trim());
      return lines.join('\n');
    };

    const valid = () => {
      const ok = Boolean(tipo.value);
      erro.hidden = ok;
      if (ok) tipo.removeAttribute('aria-invalid');
      else { tipo.setAttribute('aria-invalid', 'true'); tipo.focus(); }
      return ok;
    };

    const say = (text) => {
      status.textContent = '';
      requestAnimationFrame(() => { status.textContent = text; });
    };

    objetivo.addEventListener('input', () => { contador.textContent = String(objetivo.value.length); });
    tipo.addEventListener('change', () => { if (tipo.value) valid(); });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!valid()) return;
      const url = 'https://wa.me/' + PHONE + '?text=' + encodeURIComponent(message());
      // Link real em nova aba: funciona em qualquer navegador e não é barrado como pop-up.
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      document.body.appendChild(a); a.click(); a.remove();
      say('Conversa aberta no WhatsApp.');
    });

    copiar.addEventListener('click', async () => {
      if (!valid()) return;
      const text = message();
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch (err) {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
        document.body.appendChild(ta); ta.select();
        try { ok = document.execCommand('copy'); } catch (e2) {}
        ta.remove();
      }
      const label = copiar.textContent;
      copiar.textContent = ok ? 'Mensagem copiada' : 'Não foi possível copiar';
      say(copiar.textContent);
      setTimeout(() => { copiar.textContent = label; }, 2200);
    });
  }
})();
