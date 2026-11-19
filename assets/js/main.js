/* ==========================================================================
   Momentum — motion & interaction
   Requires: gsap, ScrollTrigger, SplitText, CustomEase, Flip, Lenis
   ========================================================================== */
(() => {
  "use strict";

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduced = root.classList.contains("no-motion");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasGsap = typeof window.gsap !== "undefined";

  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  if (!hasGsap) {
    root.classList.add("no-motion");
    root.classList.remove("is-first-visit", "is-transitioning-in");
    initBasics();
    return;
  }

  const { gsap } = window;
  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase, Flip);
  CustomEase.create("momentum", "0.65, 0.05, 0, 1");
  CustomEase.create("silk", "0.76, 0, 0.24, 1");
  window.__momentumReady = true;

  /* ------------------------------------------------------------------ */
  /* Smooth scroll                                                       */
  /* ------------------------------------------------------------------ */
  let lenis = null;
  if (!reduced && typeof window.Lenis !== "undefined") {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
  }
  const scrollTo = (target, opts = {}) => {
    if (lenis) lenis.scrollTo(target, { duration: 1.6, ...opts });
    else {
      const el = typeof target === "string" ? $(target) : target;
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
      else if (typeof target === "number") window.scrollTo({ top: target, behavior: "smooth" });
    }
  };

  /* ------------------------------------------------------------------ */
  /* Intro: preloader or page-transition reveal                          */
  /* ------------------------------------------------------------------ */
  const introQueue = [];
  const onIntro = (fn) => introQueue.push(fn);
  let introDone = false;
  const runIntro = () => {
    if (introDone) return;
    introDone = true;
    root.classList.remove("is-first-visit", "is-transitioning-in");
    introQueue.forEach((fn) => fn());
    ScrollTrigger.refresh();
  };

  function playPreloader() {
    const pre = $(".preloader");
    if (!pre) return Promise.resolve();
    lenis && lenis.stop();
    const imgs = $$(".preloader-frame img", pre);
    const count = $(".preloader-count", pre);
    const frame = $(".preloader-frame", pre);
    const counter = { v: 0 };
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: () => { pre.remove(); lenis && lenis.start(); resolve(); } });
      tl.from([".preloader-brand", ".preloader-meta"], { yPercent: 100, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.1 }, 0)
        .from(frame, { clipPath: "inset(100% 0 0 0)", duration: 1.1, ease: "momentum" }, 0.1)
        .to(counter, {
          v: 100, duration: 2.4, ease: "power2.inOut",
          onUpdate: () => { count.textContent = String(Math.round(counter.v)).padStart(2, "0"); },
        }, 0.2)
        .to(".preloader-bar", { scaleX: 1, duration: 2.4, ease: "power2.inOut" }, 0.2);
      const step = 2.4 / imgs.length;
      imgs.forEach((img, i) => tl.set(img, { opacity: 1, zIndex: i + 1 }, 0.25 + i * step));
      imgs.forEach((img, i) => tl.fromTo(img, { scale: 1.25 }, { scale: 1, duration: step + 0.4, ease: "power2.out" }, 0.25 + i * step));
      tl.to([count, ".preloader-brand", ".preloader-meta"], { yPercent: -60, opacity: 0, duration: 0.8, ease: "expo.in", stagger: 0.04 }, "+=0.15")
        .to(frame, { width: "100vw", height: "100vh", duration: 1.3, ease: "silk" }, "-=0.35")
        .add(runIntro, "-=0.55")
        .to(pre, { opacity: 0, duration: 0.6, ease: "power2.out" }, "-=0.25");
    });
  }

  function playTransitionIn() {
    const panel = $(".transition-panel--1");
    const label = $(".transition-label span");
    if (!panel) return runIntro();
    const tl = gsap.timeline();
    if (label) {
      label.textContent = store.get("hs-label") || "";
      tl.set(label, { yPercent: 0 });
      tl.to(label, { yPercent: -110, duration: 0.6, ease: "expo.in" }, 0.05);
    }
    tl.set(".transition", { visibility: "visible" }, 0)
      .to(panel, { yPercent: -100, duration: 1.05, ease: "silk" }, 0.35)
      .add(runIntro, 0.75)
      .set(".transition", { visibility: "hidden" })
      .set(panel, { yPercent: 100 });
    store.del("hs-label");
  }

  function startIntro() {
    if (reduced) { store.set("hs-visited", "1"); return runIntro(); }
    if (root.classList.contains("is-first-visit")) {
      store.set("hs-visited", "1");
      const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
      fonts.then(playPreloader);
    } else if (root.classList.contains("is-transitioning-in")) {
      playTransitionIn();
    } else {
      runIntro();
    }
  }

  // Outbound page transitions
  function initTransitions() {
    if (reduced) return;
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!a || e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (!/\.html$|\/$/.test(url.pathname)) return;
      if (url.pathname === location.pathname && url.hash) return;
      if (url.pathname === location.pathname && url.search === location.search) { e.preventDefault(); scrollTo(0); return; }
      e.preventDefault();
      const label = a.dataset.label || (a.textContent || "").trim().split("\n")[0].trim() || "Momentum";
      store.set("hs-label", label.length > 28 ? "Momentum" : label);
      const panel = $(".transition-panel--1");
      const accent = $(".transition-panel--2");
      const span = $(".transition-label span");
      if (span) span.textContent = store.get("hs-label");
      closeMenu();
      gsap.timeline({ onComplete: () => { location.href = url.href; } })
        .set(".transition", { visibility: "visible" })
        .fromTo(accent, { yPercent: 100 }, { yPercent: 0, duration: 0.7, ease: "silk" })
        .fromTo(panel, { yPercent: 100 }, { yPercent: 0, duration: 0.75, ease: "silk" }, 0.12)
        .fromTo(span, { yPercent: 110 }, { yPercent: 0, duration: 0.6, ease: "expo.out" }, 0.55)
        .set(accent, { yPercent: 100 })
        .to({}, { duration: 0.1 });
      store.set("hs-transition", "1");
    });

    window.addEventListener("pageshow", (e) => {
      if (e.persisted) {
        gsap.set(".transition", { visibility: "hidden" });
        gsap.set(".transition-panel", { yPercent: 100 });
        store.del("hs-transition");
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Header, menu, mobile CTA                                            */
  /* ------------------------------------------------------------------ */
  const header = $(".site-header");
  let menuOpen = false;
  let menuTl = null;

  function initHeader() {
    if (!header) return;
    let last = 0;
    const mobileCta = $(".mobile-cta");
    const ctaBlock = $(".cta, .site-footer");
    const onScroll = () => {
      const y = window.scrollY;
      header.classList.toggle("is-scrolled", y > 40);
      if (!menuOpen) header.classList.toggle("is-hidden", y > 240 && y > last + 2);
      if (y < last - 2) header.classList.remove("is-hidden");
      last = y;
      if (mobileCta) {
        const pastHero = y > window.innerHeight * 0.7;
        const nearEnd = ctaBlock ? ctaBlock.getBoundingClientRect().top < window.innerHeight * 0.85 : false;
        mobileCta.classList.toggle("is-visible", pastHero && !nearEnd);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function initMenu() {
    const toggle = $(".menu-toggle");
    const menu = $(".menu");
    if (!toggle || !menu) return;
    const links = $$(".menu-links a span", menu);
    menuTl = gsap.timeline({ paused: true })
      .set(menu, { visibility: "visible" })
      .fromTo(menu, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.9, ease: "silk" })
      .from(links, { yPercent: 110, duration: 0.9, ease: "expo.out", stagger: 0.06 }, 0.35)
      .from(".menu-foot > *", { opacity: 0, y: 16, duration: 0.6, stagger: 0.06 }, 0.5);
    if (reduced) menuTl.duration(0.01);
    toggle.addEventListener("click", () => (menuOpen ? closeMenu() : openMenu()));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && menuOpen) closeMenu(); });
  }
  function openMenu() {
    if (!menuTl) return;
    menuOpen = true;
    root.classList.add("menu-open");
    $(".menu-toggle").setAttribute("aria-expanded", "true");
    $(".menu").removeAttribute("inert");
    header.classList.remove("is-hidden");
    lenis && lenis.stop();
    menuTl.timeScale(1).play();
  }
  function closeMenu() {
    if (!menuTl || !menuOpen) return;
    menuOpen = false;
    root.classList.remove("menu-open");
    $(".menu-toggle").setAttribute("aria-expanded", "false");
    $(".menu").setAttribute("inert", "");
    lenis && lenis.start();
    menuTl.timeScale(1.6).reverse();
  }

  /* ------------------------------------------------------------------ */
  /* Cursor & magnetic                                                   */
  /* ------------------------------------------------------------------ */
  function initCursor() {
    if (!finePointer || reduced) return;
    const cursor = $(".cursor");
    if (!cursor) return;
    root.classList.add("has-cursor");
    const dot = $(".cursor-dot", cursor);
    const ring = $(".cursor-ring", cursor);
    const xDot = gsap.quickTo(dot, "x", { duration: 0.12, ease: "power3" });
    const yDot = gsap.quickTo(dot, "y", { duration: 0.12, ease: "power3" });
    const xRing = gsap.quickTo(ring, "x", { duration: 0.55, ease: "power3" });
    const yRing = gsap.quickTo(ring, "y", { duration: 0.55, ease: "power3" });
    window.addEventListener("pointermove", (e) => { cursor.classList.add("is-active"); xDot(e.clientX); yDot(e.clientY); xRing(e.clientX); yRing(e.clientY); }, { passive: true });
    let current = null;
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest("[data-cursor]");
      if (t === current) return;
      current = t;
      if (t) {
        ring.textContent = t.dataset.cursor;
        gsap.to(ring, { scale: 1, opacity: 1, duration: 0.5, ease: "expo.out" });
        gsap.to(dot, { scale: 0, duration: 0.3 });
      } else {
        gsap.to(ring, { scale: 0, opacity: 0, duration: 0.4, ease: "expo.out" });
        gsap.to(dot, { scale: 1, duration: 0.3 });
      }
    });
    document.addEventListener("pointerover", (e) => {
      const hov = e.target.closest("a, button, input, select, textarea, label");
      if (!current) gsap.to(dot, { scale: hov ? 3 : 1, duration: 0.35, ease: "power3" });
    });
    document.addEventListener("pointerleave", () => gsap.to([dot, ring], { opacity: 0, duration: 0.3 }));
    document.addEventListener("pointerenter", () => gsap.to(dot, { opacity: 1, duration: 0.3 }));
  }

  function initMagnetic() {
    if (!finePointer || reduced) return;
    $$("[data-magnetic]").forEach((el) => {
      const strength = parseFloat(el.dataset.magnetic) || 0.35;
      const xTo = gsap.quickTo(el, "x", { duration: 0.8, ease: "elastic.out(1, 0.4)" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.8, ease: "elastic.out(1, 0.4)" });
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      });
      el.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Text & media reveals                                                */
  /* ------------------------------------------------------------------ */
  function initSplits() {
    $$("[data-split]").forEach((el) => {
      if (reduced) { el.style.visibility = "visible"; return; }
      const isIntro = el.dataset.split === "intro";
      const delay = parseFloat(el.dataset.delay || 0);
      let played = false;
      SplitText.create(el, {
        type: "lines",
        mask: "lines",
        linesClass: "line",
        autoSplit: true,
        onSplit(self) {
          gsap.set(el, { visibility: "visible" });
          if (played) return;
          const tw = gsap.from(self.lines, {
            yPercent: 115, rotate: 2.5, transformOrigin: "0% 0%",
            duration: isIntro ? 1.6 : 1.3, ease: "expo.out", stagger: 0.09,
            delay: isIntro ? 0 : delay,
            paused: true,
            onComplete: () => { played = true; },
          });
          if (isIntro) {
            if (introDone) tw.play(); else onIntro(() => gsap.delayedCall(0.15 + delay, () => tw.play()));
          } else {
            ScrollTrigger.create({ trigger: el, start: "top 88%", once: true, onEnter: () => tw.play() });
          }
          return tw;
        },
      });
    });
  }

  function initReveals() {
    $$("[data-reveal]").forEach((el) => {
      if (reduced) return;
      const img = $("img", el);
      const isIntro = el.dataset.reveal === "intro";
      const dir = el.dataset.dir || "up";
      const from = { up: "inset(100% 0% 0% 0%)", down: "inset(0% 0% 100% 0%)", left: "inset(0% 100% 0% 0%)", right: "inset(0% 0% 0% 100%)" }[dir];
      const tl = gsap.timeline({ paused: true, delay: parseFloat(el.dataset.delay || 0) });
      tl.fromTo(el, { clipPath: from }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.5, ease: "momentum" });
      if (img && !el.hasAttribute("data-parallax")) tl.fromTo(img, { scale: 1.35 }, { scale: 1, duration: 1.9, ease: "expo.out" }, 0);
      if (isIntro) onIntro(() => tl.play());
      else ScrollTrigger.create({ trigger: el, start: "top 90%", once: true, onEnter: () => tl.play() });
    });
  }

  function initFades() {
    if (reduced) return;
    ScrollTrigger.batch("[data-fade]", {
      start: "top 92%",
      once: true,
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.2, ease: "expo.out", stagger: 0.08, overwrite: true }),
    });
    $$("[data-fade='intro']").forEach((el) => {
      onIntro(() => gsap.to(el, { opacity: 1, y: 0, duration: 1.2, ease: "expo.out", delay: 0.5 + parseFloat(el.dataset.delay || 0) }));
    });
  }

  function initParallax() {
    if (reduced) return;
    $$("[data-parallax]").forEach((el) => {
      const img = $("img", el);
      if (!img) return;
      const amt = parseFloat(el.dataset.parallax) || 9;
      gsap.fromTo(img, { yPercent: -amt }, {
        yPercent: amt, ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
      });
    });
    $$("[data-speed]").forEach((el) => {
      const s = parseFloat(el.dataset.speed);
      gsap.to(el, {
        y: () => -s * window.innerHeight * 0.25, ease: "none",
        scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true },
      });
    });
  }

  function initStatement() {
    $$(".statement-text").forEach((el) => {
      if (reduced) return;
      const split = SplitText.create(el, { type: "words", wordsClass: "word" });
      gsap.to(split.words, {
        opacity: 1, ease: "none", stagger: 0.12,
        scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 45%", scrub: 0.6 },
      });
    });
  }

  function initCounters() {
    $$("[data-count]").forEach((el) => {
      const end = parseFloat(el.dataset.count);
      const dec = (el.dataset.count.split(".")[1] || "").length;
      if (reduced) return;
      const obj = { v: 0 };
      el.textContent = (0).toFixed(dec);
      ScrollTrigger.create({
        trigger: el, start: "top 90%", once: true,
        onEnter: () => gsap.to(obj, {
          v: end, duration: 2.2, ease: "expo.out",
          onUpdate: () => { el.textContent = dec ? obj.v.toFixed(dec) : Math.round(obj.v).toLocaleString("en-IE"); },
        }),
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Home: hero slider, zoom, horizontal stories, services preview       */
  /* ------------------------------------------------------------------ */
  function initHero() {
    const hero = $(".hero");
    if (!hero) return;
    const slides = $$(".hero-slide", hero);
    const caption = $(".hero-caption", hero);
    const idx = $(".hero-index-num", hero);
    const bar = $(".hero-index-bar i", hero);
    let i = 0;
    const DURATION = 5.5;

    const setCaption = (s) => {
      if (!caption) return;
      $("b", caption).textContent = s.dataset.title || "";
      $("span", caption).textContent = s.dataset.place || "";
    };

    if (!reduced) {
      gsap.to($$("img", slides[0]), { scale: 1, duration: 2.6, ease: "expo.out", paused: true });
      onIntro(() => gsap.fromTo($("img", slides[0]), { scale: 1.35 }, { scale: 1.05, duration: 3, ease: "expo.out" }));
      gsap.to(".hero-media", { yPercent: 18, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
      gsap.to(".hero-content", { yPercent: -12, opacity: 0.2, ease: "none", scrollTrigger: { trigger: hero, start: "40% top", end: "bottom top", scrub: true } });
      onIntro(() => gsap.from([".hero-caption", ".hero-bottom > *"], { opacity: 0, y: 24, duration: 1.2, ease: "expo.out", stagger: 0.08, delay: 0.7 }));
    }
    if (slides.length < 2) return;

    const go = (n) => {
      const prev = slides[i];
      i = (n + slides.length) % slides.length;
      const next = slides[i];
      if (idx) idx.textContent = String(i + 1).padStart(2, "0");
      setCaption(next);
      if (reduced) {
        prev.classList.remove("is-active"); next.classList.add("is-active");
        return;
      }
      gsap.set(slides, { zIndex: 0 });
      gsap.set(prev, { zIndex: 1 });
      gsap.set(next, { zIndex: 2 });
      gsap.timeline({ onComplete: () => { prev.classList.remove("is-active"); gsap.set(prev, { clipPath: "inset(0 0 0 100%)" }); } })
        .fromTo(next, { clipPath: "inset(0% 0% 0% 100%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.6, ease: "silk" })
        .fromTo($("img", next), { scale: 1.3, xPercent: 8 }, { scale: 1.05, xPercent: 0, duration: 2.6, ease: "expo.out" }, 0)
        .to($("img", prev), { xPercent: -12, duration: 1.6, ease: "silk" }, 0)
        .add(() => { next.classList.add("is-active"); gsap.set($("img", prev), { xPercent: 0 }); });
    };

    let timer = null;
    const cycle = () => {
      if (bar && !reduced) {
        timer = gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: DURATION, ease: "none", onComplete: () => { go(i + 1); cycle(); } });
      } else {
        timer = gsap.delayedCall(DURATION, () => { go(i + 1); cycle(); });
      }
    };
    onIntro(cycle);
    // Pause when the hero is off-screen
    ScrollTrigger.create({
      trigger: hero, start: "top top", end: "bottom top",
      onLeave: () => timer && timer.pause(),
      onEnterBack: () => timer && timer.resume(),
    });
    document.addEventListener("visibilitychange", () => { if (!timer) return; document.hidden ? timer.pause() : timer.resume(); });
  }

  function initZoom() {
    const zoom = $(".zoom");
    if (!zoom || reduced) {
      if (zoom) { gsap.set(".zoom-media", { width: "100%", height: "100%", borderRadius: 0 }); gsap.set(".zoom-overlay", { opacity: 1 }); gsap.set(".zoom-words", { opacity: 0 }); gsap.set(".zoom-media img", { scale: 1 }); }
      return;
    }
    const words = $$(".zoom-words span", zoom);
    const stacked = () => window.innerWidth <= 600;
    gsap.timeline({
      scrollTrigger: { trigger: zoom, start: "top top", end: "+=180%", scrub: 1, pin: true, anticipatePin: 1 },
    })
      .to(".zoom-media", { width: "100vw", height: "100vh", borderRadius: 0, ease: "power2.inOut", duration: 1 }, 0)
      .fromTo(".zoom-media img", { filter: "grayscale(1) brightness(.85)" }, { scale: 1, filter: "grayscale(0) brightness(1)", ease: "power2.inOut", duration: 1 }, 0)
      .to(words[0], { xPercent: () => (stacked() ? 0 : -140), yPercent: () => (stacked() ? -160 : 0), opacity: 0, ease: "power2.in", duration: 0.8 }, 0)
      .to(words[1], { xPercent: () => (stacked() ? 0 : 140), yPercent: () => (stacked() ? 160 : 0), opacity: 0, ease: "power2.in", duration: 0.8 }, 0)
      .to(".zoom-overlay", { opacity: 1, duration: 0.3 }, 0.85)
      .from(".zoom-overlay > *", { y: 40, duration: 0.3, stagger: 0.05 }, 0.85)
      .to({}, { duration: 0.25 });
  }

  function initStories() {
    const sec = $(".stories");
    if (!sec) return;
    const track = $(".stories-track", sec);
    const progress = $(".stories-progress i", sec);
    if (reduced) { track.style.overflowX = "auto"; track.style.width = "auto"; return; }
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const tween = gsap.to(track, {
      x: () => -dist(), ease: "none",
      scrollTrigger: {
        trigger: ".stories-pin", start: "top top", end: () => "+=" + dist(),
        scrub: 1, pin: true, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: (self) => progress && gsap.set(progress, { scaleX: self.progress }),
      },
    });
    $$(".story-media img", track).forEach((img) => {
      gsap.fromTo(img, { xPercent: -6 }, {
        xPercent: 6, ease: "none",
        scrollTrigger: { trigger: img.closest(".story-card"), containerAnimation: tween, start: "left right", end: "right left", scrub: true },
      });
    });
    $$(".story-card, .story-end", track).forEach((card) => {
      gsap.from(card, {
        y: 80, rotate: 2, opacity: 0.2, ease: "power2.out",
        scrollTrigger: { trigger: card, containerAnimation: tween, start: "left 100%", end: "left 60%", scrub: true },
      });
    });
  }

  function initServicePreview() {
    const list = $(".service-list");
    const preview = $(".hover-preview");
    if (!list || !preview || !finePointer || reduced) return;
    const imgs = $$("img", preview);
    const xTo = gsap.quickTo(preview, "x", { duration: 0.7, ease: "power3" });
    const yTo = gsap.quickTo(preview, "y", { duration: 0.7, ease: "power3" });
    const rTo = gsap.quickTo(preview, "rotate", { duration: 0.9, ease: "power3" });
    let lastX = 0;
    list.addEventListener("pointermove", (e) => {
      xTo(e.clientX - 150); yTo(e.clientY - 190);
      rTo(gsap.utils.clamp(-12, 12, (e.clientX - lastX) * 0.6));
      lastX = e.clientX;
    });
    list.addEventListener("pointerenter", () => gsap.to(preview, { opacity: 1, scale: 1, duration: 0.6, ease: "expo.out" }));
    list.addEventListener("pointerleave", () => gsap.to(preview, { opacity: 0, scale: 0.6, duration: 0.5, ease: "expo.out" }));
    $$(".service-row", list).forEach((row, n) => {
      row.addEventListener("pointerenter", () => {
        imgs.forEach((img, k) => {
          if (k === n) gsap.fromTo(img, { opacity: 1, clipPath: "inset(100% 0 0 0)", scale: 1.3, zIndex: 2 }, { clipPath: "inset(0% 0 0 0)", scale: 1, duration: 0.8, ease: "expo.out" });
          else gsap.set(img, { zIndex: 1 });
        });
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Marquee (scroll-velocity aware)                                     */
  /* ------------------------------------------------------------------ */
  function initMarquees() {
    $$(".marquee").forEach((m) => {
      const track = $(".marquee-track", m);
      if (!track) return;
      const original = track.innerHTML;
      track.innerHTML = original + original;
      $$(".marquee-item", track).slice(track.children.length / 2).forEach((n) => n.setAttribute("aria-hidden", "true"));
      if (reduced) return;
      const baseSpeed = parseFloat(m.dataset.marqueeSpeed || 0.6);
      let dir = m.dataset.reverse ? 1 : -1;
      let x = 0;
      let half = track.scrollWidth / 2;
      const setX = gsap.quickSetter(track, "x", "px");
      new ResizeObserver(() => { half = track.scrollWidth / 2; }).observe(track);
      let visible = false;
      ScrollTrigger.create({ trigger: m, start: "top bottom", end: "bottom top", onToggle: (s) => { visible = s.isActive; } });
      let last = window.scrollY;
      gsap.ticker.add(() => {
        if (!visible) return;
        const y = window.scrollY;
        const v = y - last;
        last = y;
        if (Math.abs(v) > 0.5) dir = (v > 0 ? -1 : 1) * (m.dataset.reverse ? -1 : 1);
        x += (baseSpeed + Math.min(Math.abs(v) * 0.35, 18)) * dir;
        if (x <= -half) x += half;
        if (x > 0) x -= half;
        setX(x);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Testimonials                                                        */
  /* ------------------------------------------------------------------ */
  function initTestimonials() {
    const wrap = $(".testimonials");
    if (!wrap) return;
    const quotes = $$(".t-quote", wrap);
    const imgs = $$(".t-media img", wrap);
    const count = $(".t-count", wrap);
    const bar = $(".t-progress i", wrap);
    let i = 0;
    let busy = false;
    const total = quotes.length;
    const show = (n, dirSign = 1) => {
      if (busy || n === i) return;
      busy = true;
      const prevQ = quotes[i], prevI = imgs[i];
      i = (n + total) % total;
      const nextQ = quotes[i], nextI = imgs[i];
      if (count) count.textContent = `${String(i + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
      if (reduced) {
        prevQ.classList.remove("is-active"); nextQ.classList.add("is-active");
        prevI.classList.remove("is-active"); nextI.classList.add("is-active");
        busy = false; return;
      }
      gsap.set(imgs, { zIndex: 0 }); gsap.set(prevI, { zIndex: 1 }); gsap.set(nextI, { zIndex: 2 });
      nextQ.classList.add("is-active");
      const tl = gsap.timeline({ onComplete: () => { prevQ.classList.remove("is-active"); prevI.classList.remove("is-active"); busy = false; } });
      tl.to(prevQ.children, { y: -30 * dirSign, opacity: 0, duration: 0.5, ease: "power3.in", stagger: 0.04 })
        .fromTo(nextI, { clipPath: dirSign > 0 ? "inset(100% 0 0 0)" : "inset(0 0 100% 0)" }, { clipPath: "inset(0% 0 0 0)", duration: 1.2, ease: "silk", onStart: () => nextI.classList.add("is-active") }, 0)
        .fromTo(nextI, { scale: 1.25 }, { scale: 1, duration: 1.6, ease: "expo.out" }, 0)
        .fromTo(nextQ.children, { y: 40 * dirSign, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "expo.out", stagger: 0.06 }, 0.45);
    };
    let auto = null;
    const loop = () => {
      if (auto) auto.kill();
      if (reduced) return;
      auto = gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 7, ease: "none", onComplete: () => { show(i + 1); loop(); } });
    };
    $(".t-next", wrap)?.addEventListener("click", () => { show(i + 1, 1); loop(); });
    $(".t-prev", wrap)?.addEventListener("click", () => { show(i - 1, -1); loop(); });
    ScrollTrigger.create({ trigger: wrap, start: "top 75%", once: true, onEnter: loop });
    ScrollTrigger.create({ trigger: wrap, start: "top bottom", end: "bottom top", onToggle: (s) => auto && (s.isActive ? auto.resume() : auto.pause()) });
  }

  /* ------------------------------------------------------------------ */
  /* FAQ, tabs, process cards                                            */
  /* ------------------------------------------------------------------ */
  function initFaq() {
    $$(".faq-item").forEach((item) => {
      const q = $(".faq-q", item);
      const a = $(".faq-a", item);
      q.addEventListener("click", () => {
        const open = !item.classList.contains("is-open");
        $$(".faq-item.is-open", item.parentElement).forEach((o) => {
          if (o === item) return;
          o.classList.remove("is-open");
          $(".faq-q", o).setAttribute("aria-expanded", "false");
          gsap.to($(".faq-a", o), { height: 0, duration: reduced ? 0 : 0.7, ease: "momentum" });
        });
        item.classList.toggle("is-open", open);
        q.setAttribute("aria-expanded", String(open));
        gsap.to(a, { height: open ? "auto" : 0, duration: reduced ? 0 : 0.8, ease: "momentum", onComplete: () => ScrollTrigger.refresh() });
      });
    });
  }

  function initTabs() {
    $$("[data-tabs]").forEach((tabs) => {
      const btns = $$("button[role='tab']", tabs);
      const ind = $(".tabs-ind", tabs);
      const moveInd = (b) => { if (!ind) return; ind.style.width = b.offsetWidth + "px"; ind.style.transform = `translateX(${b.offsetLeft - 5}px)`; };
      const activate = (btn, animate = true) => {
        btns.forEach((b) => {
          const sel = b === btn;
          b.setAttribute("aria-selected", String(sel));
          b.tabIndex = sel ? 0 : -1;
          const panel = document.getElementById(b.getAttribute("aria-controls"));
          if (!panel) return;
          if (sel) {
            panel.hidden = false;
            if (animate && !reduced) gsap.fromTo(panel.children, { y: 50, opacity: 0, rotateX: -8 }, { y: 0, opacity: 1, rotateX: 0, duration: 1, ease: "expo.out", stagger: 0.08 });
          } else panel.hidden = true;
        });
        moveInd(btn);
        ScrollTrigger.refresh();
      };
      btns.forEach((b, n) => {
        b.addEventListener("click", () => activate(b));
        b.addEventListener("keydown", (e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          const next = btns[(n + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length];
          next.focus(); activate(next);
        });
      });
      const initial = btns.find((b) => b.getAttribute("aria-selected") === "true") || btns[0];
      requestAnimationFrame(() => activate(initial, false));
      window.addEventListener("resize", () => moveInd(btns.find((b) => b.getAttribute("aria-selected") === "true")));
      document.fonts && document.fonts.ready.then(() => moveInd(btns.find((b) => b.getAttribute("aria-selected") === "true")));
    });
  }

  function initProcess() {
    const cards = $$(".process-card");
    cards.forEach((c, n) => c.style.setProperty("--i", n));
    if (reduced) return;
    cards.forEach((card, n) => {
      const next = cards[n + 1];
      if (!next) return;
      gsap.to(card, {
        scale: 0.9, filter: "brightness(0.55)", ease: "none",
        scrollTrigger: { trigger: next, start: "top 95%", end: "top 20%", scrub: true },
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Work: filters (Flip) + lightbox                                     */
  /* ------------------------------------------------------------------ */
  function initWork() {
    const grid = $(".work-grid");
    if (!grid) return;
    const items = $$(".work-item", grid);
    const btns = $$(".filter-btn");
    const countEl = $(".work-count b");
    btns.forEach((b) => {
      const f = b.dataset.filter;
      const n = f === "all" ? items.length : items.filter((it) => it.dataset.cat === f).length;
      const sup = $("sup", b);
      if (sup) sup.textContent = n;
    });
    const apply = (f) => {
      const state = Flip.getState(items);
      items.forEach((it) => it.classList.toggle("is-hidden", f !== "all" && it.dataset.cat !== f));
      if (countEl) countEl.textContent = items.filter((it) => !it.classList.contains("is-hidden")).length;
      if (reduced) { ScrollTrigger.refresh(); return; }
      items.forEach((it) => { const m = $(".media", it); if (m) m.style.clipPath = "none"; const im = $("img", it); if (im) gsap.set(im, { scale: 1 }); });
      Flip.from(state, {
        duration: 0.9, ease: "momentum", scale: true, absolute: true, nested: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.8, ease: "expo.out" }),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.85, duration: 0.5, ease: "power2.in" }),
        onComplete: () => ScrollTrigger.refresh(),
      });
    };
    btns.forEach((b) => b.addEventListener("click", () => {
      btns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      apply(b.dataset.filter);
      const top = $(".work-toolbar");
      if (top && top.getBoundingClientRect().top < 0) scrollTo(top, { offset: -10 });
    }));
    const hashFilter = new URLSearchParams(location.search).get("filter");
    if (hashFilter) { const b = btns.find((x) => x.dataset.filter === hashFilter); if (b) b.click(); }

    // Lightbox
    const lb = $(".lightbox");
    if (!lb) return;
    const lbImg = $(".lightbox-stage img", lb);
    const lbTitle = $(".lightbox-caption h3", lb);
    const lbMeta = $(".lightbox-caption p", lb);
    const lbCount = $(".lightbox-count", lb);
    let current = 0;
    let lastFocus = null;
    const visible = () => items.filter((it) => !it.classList.contains("is-hidden"));
    const render = (dir = 0) => {
      const list = visible();
      const it = list[current];
      if (!it) return;
      const img = $("img", it);
      lbTitle.textContent = it.dataset.title || "";
      lbMeta.textContent = it.dataset.meta || "";
      lbCount.textContent = `${String(current + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}`;
      const src = img.currentSrc || img.src;
      const full = it.dataset.full || src;
      if (reduced || dir === 0) { lbImg.src = full; lbImg.alt = img.alt; return; }
      gsap.timeline()
        .to(lbImg, { xPercent: -8 * dir, opacity: 0, duration: 0.35, ease: "power2.in" })
        .add(() => { lbImg.src = full; lbImg.alt = img.alt; })
        .fromTo(lbImg, { xPercent: 8 * dir, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.7, ease: "expo.out" });
    };
    const open = (it) => {
      lastFocus = document.activeElement;
      current = visible().indexOf(it);
      render(0);
      lb.classList.add("is-open");
      lb.removeAttribute("aria-hidden");
      lenis && lenis.stop();
      document.body.style.overflow = "hidden";
      if (!reduced) {
        gsap.fromTo(lb, { clipPath: "inset(50% 50% 50% 50%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.9, ease: "silk" });
        gsap.fromTo(lbImg, { scale: 1.15, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.2, ease: "expo.out", delay: 0.25 });
      }
      $(".lb-close", lb).focus();
    };
    const close = () => {
      const done = () => {
        lb.classList.remove("is-open"); lb.setAttribute("aria-hidden", "true");
        lenis && lenis.start(); document.body.style.overflow = "";
        lastFocus && lastFocus.focus();
      };
      if (reduced) return done();
      gsap.to(lb, { clipPath: "inset(50% 50% 50% 50%)", duration: 0.7, ease: "silk", onComplete: done });
    };
    const step = (d) => { const n = visible().length; current = (current + d + n) % n; render(d); };
    items.forEach((it) => {
      it.addEventListener("click", () => open(it));
      it.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(it); } });
    });
    $(".lb-close", lb).addEventListener("click", close);
    $(".lb-next", lb).addEventListener("click", () => step(1));
    $(".lb-prev", lb).addEventListener("click", () => step(-1));
    $(".lightbox-stage", lb).addEventListener("click", (e) => { if (e.target === e.currentTarget) close(); });
    document.addEventListener("keydown", (e) => {
      if (!lb.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "Tab") {
        const f = $$("button", lb);
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    let sx = null;
    lb.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", (e) => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
      sx = null;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Booking form                                                        */
  /* ------------------------------------------------------------------ */
  function initBooking() {
    const shell = $(".form");
    const form = shell && $("form", shell);
    if (!form) return;
    const steps = $$(".form-step", form);
    const bar = $(".form-progress-bar i", shell);
    const label = $(".form-step-label", shell);
    const back = $(".form-nav .back", form);
    const next = $(".form-nav .next", form);
    const nextText = $(".btn-text span", next);
    const errBox = $(".form-error-msg", form);
    let s = 0;

    // Prefill from query string (e.g. ?type=wedding&package=Signature)
    const params = new URLSearchParams(location.search);
    const type = params.get("type");
    if (type) { const r = form.querySelector(`input[name="type"][value="${CSS.escape(type)}"]`); if (r) r.checked = true; }
    const pkg = params.get("package");
    if (pkg && form.elements.package) form.elements.package.value = pkg;

    const date = form.elements.date;
    if (date) date.min = new Date().toISOString().split("T")[0];
    const flex = form.elements.flexible;
    if (flex && date) flex.addEventListener("change", () => { date.required = !flex.checked; date.disabled = flex.checked; if (flex.checked) clearErr(date); });

    const budget = form.elements.budget;
    const out = $(".budget-out", form);
    const fmt = (v) => (Number(v) >= 10000 ? "€10,000+" : "€" + Number(v).toLocaleString("en-IE"));
    if (budget && out) { const u = () => { out.textContent = fmt(budget.value); }; budget.addEventListener("input", u); u(); }

    const clearErr = (el) => { const f = el.closest(".field"); if (f) { f.classList.remove("has-error"); const m = $(".field-error", f); if (m) m.textContent = ""; } el.removeAttribute("aria-invalid"); };
    const setErr = (el, msg) => { const f = el.closest(".field"); if (f) { f.classList.add("has-error"); const m = $(".field-error", f); if (m) m.textContent = msg; } el.setAttribute("aria-invalid", "true"); };
    $$("input, select, textarea", form).forEach((el) => el.addEventListener("input", () => clearErr(el)));

    const validate = (idx) => {
      const step = steps[idx];
      let ok = true;
      let firstBad = null;
      errBox.textContent = "";
      const radios = new Set($$("input[type=radio][required]", step).map((r) => r.name));
      radios.forEach((name) => {
        if (!form.querySelector(`input[name="${name}"]:checked`)) {
          ok = false; errBox.textContent = "Please choose an option to continue.";
          firstBad = firstBad || step.querySelector(`input[name="${name}"]`);
        }
      });
      $$("input:not([type=radio]):not([type=checkbox]), select, textarea", step).forEach((el) => {
        if (el.disabled) return;
        if (!el.checkValidity()) {
          ok = false;
          let msg = "This field is required.";
          if (el.validity.typeMismatch && el.type === "email") msg = "Please enter a valid email address.";
          else if (el.validity.rangeUnderflow) msg = "Please choose a future date.";
          else if (el.validity.patternMismatch) msg = el.title || "Please check this field.";
          setErr(el, msg);
          firstBad = firstBad || el;
        }
      });
      if (!ok && firstBad) {
        firstBad.focus({ preventScroll: true });
        if (!reduced) gsap.fromTo(step, { x: -10 }, { x: 0, duration: 0.6, ease: "elastic.out(1, 0.3)" });
      }
      return ok;
    };

    const goTo = (n) => {
      const from = steps[s];
      const to = steps[n];
      const dir = n > s ? 1 : -1;
      s = n;
      bar.style.transform = `scaleX(${(s + 1) / steps.length})`;
      label.textContent = `Step ${s + 1} of ${steps.length}`;
      back.hidden = s === 0;
      const last = s === steps.length - 1;
      nextText.textContent = last ? "Send enquiry" : "Continue";
      nextText.dataset.text = nextText.textContent;
      next.type = last ? "submit" : "button";
      const swap = () => {
        from.classList.remove("is-active"); to.classList.add("is-active");
        const heading = $("h2", to); if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true }); }
      };
      if (reduced) return swap();
      gsap.timeline()
        .to(from, { x: -40 * dir, opacity: 0, duration: 0.35, ease: "power2.in" })
        .add(swap)
        .fromTo(to, { x: 40 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "expo.out" })
        .from($$(".choice, .field, h2, .form-step > p", to), { y: 20, opacity: 0, duration: 0.7, ease: "expo.out", stagger: 0.035 }, "<");
      const top = shell.getBoundingClientRect().top;
      if (top < 0) scrollTo(shell, { offset: -100 });
    };

    next.addEventListener("click", (e) => {
      if (next.type === "submit") return;
      e.preventDefault();
      if (validate(s)) goTo(s + 1);
    });
    back.addEventListener("click", () => { if (s > 0) goTo(s - 1); });
    form.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.tagName === "INPUT" && next.type !== "submit") { e.preventDefault(); next.click(); }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!validate(s)) return;
      if (form.elements.company && form.elements.company.value) return; // honeypot
      const endpoint = form.dataset.endpoint;
      nextText.textContent = "Sending…";
      next.disabled = true;
      try {
        if (endpoint) {
          const res = await fetch(endpoint, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
          if (!res.ok) throw new Error("Request failed");
        } else {
          await new Promise((r) => setTimeout(r, 900));
        }
        const name = (form.elements.name && form.elements.name.value.split(" ")[0]) || "";
        const nameSlot = $(".success-name", shell);
        if (nameSlot) nameSlot.textContent = name ? `, ${name}` : "";
        shell.classList.add("is-sent");
        $(".form-progress", shell).style.display = "none";
        if (!reduced) {
          gsap.timeline()
            .from(".form-success .check", { scale: 0, rotate: -90, duration: 1, ease: "elastic.out(1, 0.5)" })
            .from(".form-success > *:not(.check)", { y: 30, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.08 }, 0.2);
        }
        scrollTo(shell, { offset: -120 });
      } catch (err) {
        errBox.textContent = "Sorry — something went wrong. Please email us directly at hello@momentum.studio.";
        nextText.textContent = "Send enquiry";
        next.disabled = false;
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Footer                                                              */
  /* ------------------------------------------------------------------ */
  function initFooter() {
    const word = $(".footer-word");
    if (word && !reduced) {
      const split = SplitText.create(word, { type: "chars", charsClass: "char" });
      gsap.from(split.chars, {
        yPercent: 100, ease: "expo.out", duration: 1.4, stagger: 0.05,
        scrollTrigger: { trigger: word, start: "top 98%", once: true },
      });
    }
    const nl = $(".newsletter");
    if (nl) nl.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("input", nl);
      const msg = nl.parentElement.querySelector(".newsletter-msg");
      if (!input.checkValidity()) { msg.textContent = "Please enter a valid email."; input.focus(); return; }
      msg.textContent = "Thank you — you're on the list.";
      input.value = "";
    });
    const yr = $("[data-year]");
    if (yr) yr.textContent = new Date().getFullYear();
  }

  function initAnchors() {
    $$("a[href^='#']").forEach((a) => a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const t = $(id);
      if (!t) return;
      e.preventDefault();
      scrollTo(t, { offset: -80 });
    }));
  }

  function initBasics() {
    // Minimal behaviour when GSAP is unavailable
    const toggle = document.querySelector(".menu-toggle");
    const menu = document.querySelector(".menu");
    if (toggle && menu) toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      menu.style.visibility = open ? "visible" : "hidden";
      menu.style.clipPath = open ? "none" : "";
      if (open) menu.removeAttribute("inert"); else menu.setAttribute("inert", "");
    });
    document.querySelectorAll(".faq-item").forEach((it) => it.querySelector(".faq-q").addEventListener("click", () => {
      const open = it.classList.toggle("is-open");
      it.querySelector(".faq-a").style.height = open ? "auto" : "0";
    }));
  }

  /* ------------------------------------------------------------------ */
  /* Glow spotlight cards                                                */
  /* ------------------------------------------------------------------ */
  function initGlow() {
    if (!finePointer) return;
    $$("[data-glow]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  initTransitions();
  initHeader();
  initMenu();
  initCursor();
  initMagnetic();
  initAnchors();
  initSplits();
  initReveals();
  initFades();
  initParallax();
  initStatement();
  initCounters();
  initHero();
  initZoom();
  initStories();
  initServicePreview();
  initMarquees();
  initTestimonials();
  initFaq();
  initTabs();
  initProcess();
  initWork();
  initBooking();
  initFooter();
  initGlow();

  window.addEventListener("load", () => ScrollTrigger.refresh());
  startIntro();
})();
