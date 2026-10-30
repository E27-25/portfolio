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

  /* ---- paper reader overlay */
  const reader = $('.reader');
  if (reader && reader.showModal) {
    const pagesEl = $('[data-r-pages]', reader), countEl = $('[data-r-count]', reader);
    let pageIO;
    const open = (d) => {
      $('[data-r-title]', reader).textContent = d.title;
      $('[data-r-venue]', reader).textContent = d.venue;
      const dir = d.dir || `papers/${d.reader}`;
      $('[data-r-pdf]', reader).href = d.pdf || `papers/${d.reader}.pdf`;
      const n = +d.pages;
      countEl.textContent = `1 / ${n}`;
      pagesEl.replaceChildren(...Array.from({ length: n }, (_, k) => {
        const img = new Image();
        img.src = `${dir}/p${k + 1}.webp`;
        img.loading = k < 2 ? 'eager' : 'lazy';
        img.decoding = 'async';
        img.style.aspectRatio = d.ratio;
        img.alt = `Page ${k + 1} of ${n}`;
        img.dataset.page = k + 1;
        return img;
      }));
      pageIO?.disconnect();
      pageIO = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) countEl.textContent = `${e.target.dataset.page} / ${n}`;
      }, { root: pagesEl, rootMargin: '-45% 0px -50% 0px' });
      $$('img', pagesEl).forEach((img) => pageIO.observe(img));
      document.documentElement.classList.add('reader-open');
      reader.showModal();
      pagesEl.scrollTop = 0;
      pagesEl.focus({ preventScroll: true });
    };
    $$('[data-reader]').forEach((a) => a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      open(a.dataset);
    }));
    $('[data-r-close]', reader).addEventListener('click', () => reader.close());
    reader.addEventListener('click', (e) => { if (e.target === reader) reader.close(); });
    reader.addEventListener('close', () => {
      if (reader.open) return; // reopened before this event fired
      document.documentElement.classList.remove('reader-open');
      pageIO?.disconnect();
      pagesEl.replaceChildren();
    });
  }
})();
