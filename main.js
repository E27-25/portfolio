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

    const open = (d) => {
      const n = +d.pages, dir = d.dir || `papers/${d.reader}`;
      const [w, h] = (d.ratio || '1100/1424').split('/').map(Number);
      $('[data-r-title]', reader).textContent = d.title;
      $('[data-r-venue]', reader).textContent = d.venue;
      $('[data-r-pdf]', reader).href = d.pdf || `papers/${d.reader}.pdf`;
      totalEl.textContent = pad(n);
      pages = Array.from({ length: n }, (_, k) => {
        const fig = document.createElement('figure');
        fig.className = 'reader__page';
        const img = new Image(w, h);
        img.dataset.src = `${dir}/p${k + 1}.webp`;
        img.decoding = 'async';
        img.alt = `Page ${k + 1} of ${n}`;
        img.draggable = false;
        const cap = document.createElement('figcaption');
        cap.innerHTML = `PAGE <b>${pad(k + 1)}</b> / ${pad(n)}`;
        fig.append(img, cap);
        return fig;
      });
      stage.replaceChildren(...pages);
      cur = 0;
      [0, 1].forEach(load);
      pages[0].classList.add('is-cur', 'is-enter');
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
})();
