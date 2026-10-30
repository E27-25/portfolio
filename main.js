(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- reveal on scroll (with a small stagger between siblings) */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      const sibs = $$(':scope > .reveal', el.parentElement);
      el.style.transitionDelay = `${Math.min(sibs.indexOf(el), 6) * 70}ms`;
      el.classList.add('is-in');
      io.unobserve(el);
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach((el) => io.observe(el));

  /* ---- active section in the side rail */
  const links = new Map($$('[data-nav]').map((a) => [a.dataset.nav, a]));
  const secIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        links.forEach((a) => a.classList.remove('is-active'));
        links.get(e.target.dataset.sec)?.classList.add('is-active');
      }
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('[data-sec]').forEach((s) => secIO.observe(s));

  /* ---- count-up numbers */
  const countIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target, to = +el.dataset.count;
      countIO.unobserve(el);
      if (reduce) { el.textContent = to; continue; }
      const t0 = performance.now(), dur = 1100;
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }, { threshold: 0.6 });
  $$('[data-count]').forEach((el) => countIO.observe(el));

  /* ---- awards carousel */
  const rec = $('[data-carousel]');
  if (rec) {
    const slides = $$('.rec__slide', rec);
    const list = $$('[data-go]', rec);
    const cur = $('[data-cur]', rec), bar = $('[data-progress]', rec);
    $('[data-total]', rec).textContent = String(slides.length).padStart(2, '0');
    let i = 0;
    const show = (n, focus) => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => { s.classList.toggle('is-on', k === i); s.setAttribute('aria-hidden', k === i ? 'false' : 'true'); });
      list.forEach((b, k) => b.classList.toggle('is-on', k === i));
      cur.textContent = String(i + 1).padStart(2, '0');
      bar.style.width = `${((i + 1) / slides.length) * 100}%`;
      if (focus) slides[i].querySelector('h3')?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    };
    $('[data-prev]', rec).addEventListener('click', () => show(i - 1));
    $('[data-next]', rec).addEventListener('click', () => show(i + 1));
    list.forEach((b) => b.addEventListener('click', () => show(+b.dataset.go, true)));
    rec.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { show(i + 1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { show(i - 1); e.preventDefault(); }
    });
    let x0 = null;
    const stage = $('.rec__stage', rec);
    stage.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    stage.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
    });
    // ambient backdrop behind each award image; images that fail fall back to a designed cover
    $$('.rec__media > img:not(.rec__inset)', rec).forEach((img) => {
      img.closest('.rec__media').style.setProperty('--img', `url("${img.currentSrc || img.src}")`);
      const fail = () => {
        const fig = img.closest('.rec__media');
        const slide = img.closest('.rec__slide');
        const rank = slide.querySelector('.rec__rank span')?.textContent || '';
        const title = slide.querySelector('h3')?.textContent || '';
        fig.classList.add('rec__media--cover');
        fig.style.removeProperty('--img');
        fig.innerHTML = `<div class="cover"><span class="cover__big">${String(slides.indexOf(slide) + 1).padStart(2, '0')}</span>` +
          `<span class="cover__label">${rank.toUpperCase()}</span><span class="cover__sub">${title.toUpperCase()}</span></div>`;
      };
      if (img.complete && img.naturalWidth === 0) fail(); else img.addEventListener('error', fail, { once: true });
    });
    $$('.rec__inset', rec).forEach((img) => {
      const drop = () => img.remove();
      if (img.complete && img.naturalWidth === 0) drop(); else img.addEventListener('error', drop, { once: true });
    });
    show(0);
  }

  /* ---- mobile menu */
  const btn = $('.topbar__menu'), nav = $('#mnav');
  if (btn && nav) {
    const set = (open) => { nav.hidden = !open; btn.setAttribute('aria-expanded', String(open)); document.body.style.overflow = open ? 'hidden' : ''; };
    btn.addEventListener('click', () => set(nav.hidden));
    $$('a', nav).forEach((a) => a.addEventListener('click', () => set(false)));
  }

  /* ---- paper / CV reader overlay: one page at a time with a slide-turn */
  const reader = $('.reader');
  let openReader = null;
  if (reader && reader.showModal) {
    const stage = $('[data-r-stage]', reader), zoomBtn = $('[data-r-zoom]', reader);
    const curEl = $('[data-r-cur]', reader), totalEl = $('[data-r-total]', reader), bar = $('[data-r-progress]', reader);
    const prevBtns = $$('[data-r-prev]', reader), nextBtns = $$('[data-r-next]', reader);
    const pad = (n) => String(n).padStart(2, '0');
    let pages = [], cur = 0;

    const load = (k) => { const img = pages[k]?.querySelector('img'); if (img && !img.getAttribute('src')) img.src = img.dataset.src; };
    const setZoom = (on) => {
      reader.classList.toggle('is-zoom', on);
      zoomBtn.setAttribute('aria-pressed', String(on));
      if (pages[cur]) pages[cur].scrollTop = pages[cur].scrollLeft = 0;
    };
    const update = () => {
      curEl.textContent = pad(cur + 1);
      bar.style.width = `${((cur + 1) / pages.length) * 100}%`;
      prevBtns.forEach((b) => { b.disabled = cur === 0; });
      nextBtns.forEach((b) => { b.disabled = cur === pages.length - 1; });
    };
    const go = (n) => {
      if (n < 0 || n >= pages.length || n === cur) return;
      const fwd = n > cur, from = pages[cur], to = pages[n];
      setZoom(false);
      [n - 1, n, n + 1].forEach(load);
      // place the incoming page on the side it comes from, then let it slide in
      to.classList.add('snap'); to.classList.remove('is-enter', 'is-cur');
      to.classList.toggle('out-l', !fwd);
      void to.offsetWidth;
      to.classList.remove('snap', 'out-l');
      to.classList.add('is-cur');
      from.classList.remove('is-cur', 'is-enter');
      from.classList.toggle('out-l', fwd);
      cur = n;
      update();
    };

    const labelEl = $('[data-r-label]', reader), pdfBtn = $('[data-r-pdf]', reader);
    const open = (d) => {
      // d.images: [{src, w, h, cap}] for photo sets; otherwise a paged document
      const dir = d.dir || `papers/${d.reader}`;
      const [w, h] = (d.ratio || '1100/1424').split('/').map(Number);
      const list = d.images || Array.from({ length: +d.pages }, (_, k) => ({ src: `${dir}/p${k + 1}.webp`, w, h }));
      const n = list.length, label = d.label || 'PAGE';
      $('[data-r-title]', reader).textContent = d.title;
      $('[data-r-venue]', reader).textContent = d.venue;
      pdfBtn.hidden = d.pdf === null;
      if (d.pdf !== null) pdfBtn.href = d.pdf || `papers/${d.reader}.pdf`;
      labelEl.textContent = label;
      totalEl.textContent = pad(n);
      pages = Array.from({ length: n }, (_, k) => {
        const fig = document.createElement('figure');
        fig.className = 'reader__page';
        const it = list[k];
        const img = new Image(it.w, it.h);
        img.dataset.src = it.src;
        img.decoding = 'async';
        img.alt = it.cap || `Page ${k + 1} of ${n}`;
        img.draggable = false;
        const cap = document.createElement('figcaption');
        cap.innerHTML = `${label} <b>${pad(k + 1)}</b> / ${pad(n)}`;
        if (it.cap) cap.append(` · ${it.cap}`);
        fig.append(img, cap);
        return fig;
      });
      stage.replaceChildren(...pages);
      cur = Math.min(Math.max(+d.start || 0, 0), n - 1);
      [cur - 1, cur, cur + 1].forEach(load);
      pages[cur].classList.add('is-cur', 'is-enter');
      setZoom(false);
      update();
      document.documentElement.classList.add('reader-open');
      reader.showModal();
      stage.focus({ preventScroll: true });
    };

    $$('[data-reader]').forEach((a) => a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      open(a.dataset);
    }));
    openReader = open;
    prevBtns.forEach((b) => b.addEventListener('click', () => go(cur - 1)));
    nextBtns.forEach((b) => b.addEventListener('click', () => go(cur + 1)));
    zoomBtn.addEventListener('click', () => setZoom(!reader.classList.contains('is-zoom')));
    stage.addEventListener('click', (e) => { if (e.target.tagName === 'IMG') setZoom(!reader.classList.contains('is-zoom')); });
    reader.addEventListener('keydown', (e) => {
      if (e.target.closest('a, button') && (e.key === 'Enter' || e.key === ' ')) return;
      const k = e.key;
      if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !reader.classList.contains('is-zoom'))) { e.preventDefault(); go(cur + 1); }
      else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); go(cur - 1); }
      else if (k === 'Home') { e.preventDefault(); go(0); }
      else if (k === 'End') { e.preventDefault(); go(pages.length - 1); }
    });

    // swipe left / right (not while zoomed, where the page pans instead)
    let sx = 0, sy = 0, tracking = false;
    stage.addEventListener('pointerdown', (e) => { tracking = !reader.classList.contains('is-zoom'); sx = e.clientX; sy = e.clientY; });
    stage.addEventListener('pointerup', (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(cur + (dx < 0 ? 1 : -1));
    });
    stage.addEventListener('pointercancel', () => { tracking = false; });

    $('[data-r-close]', reader).addEventListener('click', () => reader.close());
    reader.addEventListener('click', (e) => { if (e.target === reader) reader.close(); });
    reader.addEventListener('close', () => {
      if (reader.open) return; // reopened before this event fired
      document.documentElement.classList.remove('reader-open');
      stage.replaceChildren();
      pages = [];
    });
  }
  /* ---- conference memories: draggable 3D photo ring */
  const memEl = $('[data-mem]'), memData = $('#mem-data');
  if (memEl && memData) {
    const confs = JSON.parse(memData.textContent);
    const stage = $('[data-mem-stage]', memEl), ring = $('[data-mem-ring]', memEl);
    const info = $('[data-mem-info]', memEl), capEl = $('[data-mem-cap]', memEl);
    const tabs = $$('[data-mem-tab]', memEl);
    const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    let conf, cards = [], step = 0, radius = 0, angle = 0, target = 0, vel = 0, tiltX = -6, tiltY = 0;
    let dragging = false, moved = 0, lastX = 0, idleAt = 0, visible = false, raf = 0, frontIdx = -1;

    const cardWidth = () => parseFloat(getComputedStyle(ring).width) || 230;
    const layout = () => {
      const n = cards.length, cw = cardWidth();
      step = 360 / n;
      radius = Math.max(cw * 0.95, (cw / 2) / Math.tan(Math.PI / n) + cw * 0.28);
      cards.forEach((c, i) => { c.style.transform = `rotateY(${i * step}deg) translateZ(${radius}px)`; });
    };
    const setFront = (i) => {
      if (i === frontIdx) return;
      frontIdx = i;
      cards.forEach((c, k) => c.classList.toggle('is-front', k === i));
      const p = conf.photos[i];
      capEl.innerHTML = `<b>${String(i + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}</b>${esc(p.cap)}`;
    };
    const render = () => {
      ring.style.transform = `translateZ(${-radius}px) rotateX(${tiltX}deg) rotateY(${angle}deg)`;
      const n = cards.length;
      cards.forEach((c, i) => {
        const a = ((i * step + angle) % 360 + 360) % 360;
        c.style.setProperty('--f', ((Math.cos(a * Math.PI / 180) + 1) / 2).toFixed(3));
      });
      setFront(((Math.round(-angle / step) % n) + n) % n);
    };
    const tick = (t) => {
      raf = 0;
      if (!dragging) {
        if (target !== null) {
          angle += (target - angle) * (reduce ? 1 : 0.12);
          if (Math.abs(target - angle) < 0.05) { angle = target; target = null; }
        } else if (Math.abs(vel) > 0.02) {
          angle += vel; vel *= 0.93;
          if (Math.abs(vel) <= 0.02) target = Math.round(angle / step) * step;
        } else if (!reduce && visible && t - idleAt > 2600) {
          angle -= 0.12; // slow drift while idle
        }
      }
      tiltX += ((-6 + tiltY) - tiltX) * 0.1;
      render();
      if (visible || target !== null || Math.abs(vel) > 0.02 || dragging) raf = requestAnimationFrame(tick);
    };
    const kick = () => { idleAt = performance.now(); if (!raf) raf = requestAnimationFrame(tick); };
    const goTo = (i) => {
      const base = -i * step;
      target = base + Math.round((angle - base) / 360) * 360; // shortest way round
      vel = 0; kick();
    };
    const openAt = (i) => openReader && openReader({
      title: `${conf.code} ${conf.year} · ${conf.city}`, venue: 'FIELD LOG', label: 'PHOTO',
      images: conf.photos.map((p) => ({ src: p.src, w: p.w, h: p.h, cap: p.cap })), start: i, pdf: null,
    });

    const show = (id) => {
      conf = confs.find((c) => c.id === id) || confs[0];
      tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.memTab === conf.id)));
      info.classList.remove('is-swap'); void info.offsetWidth; info.classList.add('is-swap');
      info.innerHTML = `<p class="mem__code">${esc(conf.code)}<b>${esc(conf.year)} · PRESENTED</b></p>
        <p class="mem__place">${esc(conf.place)}<span>${esc(conf.city)}</span></p>
        <dl class="mem__rows">${conf.rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        <div class="mem__paper"><p>${esc(conf.paper)}</p><button type="button" data-mem-read>READ PAPER →</button></div>`;
      $('[data-mem-read]', info).addEventListener('click', () => $(`.peek__thumb[data-reader="${conf.slug}"]`)?.click());
      cards = conf.photos.map((p, i) => {
        const f = document.createElement('figure');
        f.className = 'mem__card';
        f.style.setProperty('--i', i);
        f.innerHTML = `<img src="${p.thumb}" alt="${esc(p.cap)}" loading="lazy" decoding="async"><figcaption><span>${esc(conf.code)}</span><b>${String(i + 1).padStart(2, '0')}</b></figcaption>`;
        f.addEventListener('click', () => {
          if (moved > 6) return;
          if (i === frontIdx) openAt(i); else goTo(i);
        });
        return f;
      });
      ring.replaceChildren(...cards);
      ring.classList.remove('is-swap'); void ring.offsetWidth; ring.classList.add('is-swap');
      frontIdx = -1; angle = 24; target = 0; vel = 0;
      layout(); render(); kick();
    };

    tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.memTab)));
    $('[data-mem-prev]', memEl).addEventListener('click', () => goTo(frontIdx - 1));
    $('[data-mem-next]', memEl).addEventListener('click', () => goTo(frontIdx + 1));
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(frontIdx + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(frontIdx - 1); }
      else if (e.key === 'Enter' && e.target === stage) { e.preventDefault(); openAt(frontIdx); }
    });

    // drag / swipe to spin, with inertia; pointer position tilts the ring
    stage.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      dragging = true; moved = 0; lastX = e.clientX; vel = 0; target = null;
      stage.classList.add('is-drag');
      try { stage.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      kick();
    });
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      tiltY = ((e.clientY - r.top) / r.height - 0.5) * -10;
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX; moved += Math.abs(dx);
      const d = dx * (180 / Math.max(r.width, 320));
      angle += d; vel = d;
      kick();
    });
    const end = () => {
      if (!dragging) return;
      dragging = false; stage.classList.remove('is-drag');
      if (Math.abs(vel) < 0.3) target = Math.round(angle / step) * step;
      kick();
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    stage.addEventListener('pointerleave', () => { tiltY = 0; });

    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }, { threshold: 0.15 }).observe(stage);
    addEventListener('resize', () => { if (conf) { layout(); render(); } });
    show(confs[0].id);
  }
})();
