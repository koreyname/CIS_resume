const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function clampIndex(i, len) {
  if (len <= 0) return 0;
  return (i % len + len) % len;
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function initScrollRestoration() {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  if (!window.location.hash) {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }
}

function initScrollProgress() {
  const update = () => {
    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - doc.clientHeight);
    const p = Math.min(1, Math.max(0, window.scrollY / max));
    doc.style.setProperty("--scroll", `${(p * 100).toFixed(2)}%`);
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
}

function initSpotlight() {
  if (prefersReducedMotion()) return;

  const doc = document.documentElement;
  let raf = 0;

  const set = (x, y, o) => {
    doc.style.setProperty("--spot-x", `${x}px`);
    doc.style.setProperty("--spot-y", `${y}px`);
    doc.style.setProperty("--spot-o", String(o));
  };

  const move = (e) => {
    if (!(e instanceof PointerEvent)) return;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => set(e.clientX, e.clientY, 0.95));
  };

  const leave = () => {
    doc.style.setProperty("--spot-o", "0");
  };

  set(window.innerWidth * 0.55, window.innerHeight * 0.2, 0.75);
  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("pointerdown", move, { passive: true });
  window.addEventListener("blur", leave);
  window.addEventListener("pointerleave", leave);
}

function initCountUp() {
  const els = $$(".count");
  if (els.length === 0) return;

  const seen = new WeakSet();

  const animate = (el) => {
    const to = Number(el.getAttribute("data-count-to") || "0");
    const suffix = el.getAttribute("data-suffix") || "";
    const dur = prefersReducedMotion() ? 0 : 900;
    const start = performance.now();

    const tick = (now) => {
      const t = dur === 0 ? 1 : Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = `${Math.round(to * eased)}${suffix}`;
      if (t < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  };

  const obs = new IntersectionObserver(
    (entries) => {
      for (const ent of entries) {
        if (!ent.isIntersecting) continue;
        const el = ent.target;
        if (!(el instanceof HTMLElement)) continue;
        if (seen.has(el)) continue;
        seen.add(el);
        animate(el);
      }
    },
    { threshold: 0.35 }
  );

  for (const el of els) obs.observe(el);
}

function initYear() {
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
}

function initHeaderElevate() {
  const header = $(".site-header");
  if (!header) return;

  const update = () => {
    header.dataset.elevate = String(window.scrollY > 10);
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
}

function initHeaderOffset() {
  const header = $(".site-header");
  if (!header) return;

  const doc = document.documentElement;
  let raf = 0;

  const set = () => {
    raf = 0;
    const h = Math.ceil(header.getBoundingClientRect().height);
    doc.style.setProperty("--header-h", `${h}px`);
  };

  const schedule = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(set);
  };

  set();

  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(schedule);
    ro.observe(header);
    return;
  }

  window.addEventListener("resize", schedule);
}

function initNav() {
  const toggle = $(".nav-toggle");
  const panel = $("#nav-panel");
  if (!toggle || !panel) return;

  const setOpen = (open) => {
    panel.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };

  toggle.addEventListener("click", () => setOpen(!panel.classList.contains("is-open")));

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!panel.classList.contains("is-open")) return;
    setOpen(false);
    toggle.focus();
  });

  document.addEventListener("click", (e) => {
    if (!panel.classList.contains("is-open")) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (panel.contains(target) || toggle.contains(target)) return;
    setOpen(false);
  });

  panel.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.matches("a.nav-link")) setOpen(false);
  });
}

function initActiveNavLinks() {
  const links = $$(".nav-link").filter((a) => a.getAttribute("href")?.startsWith("#"));
  if (links.length === 0) return;

  const sections = links
    .map((a) => a.getAttribute("href"))
    .map((hash) => (hash ? $(hash) : null))
    .filter(Boolean);

  if (sections.length === 0) return;

  const mapLinkById = new Map();
  for (const a of links) {
    const hash = a.getAttribute("href") || "";
    const id = hash.replace("#", "");
    if (id) mapLinkById.set(id, a);
  }

  const obs = new IntersectionObserver(
    (entries) => {
      for (const ent of entries) {
        const id = ent.target.id;
        const a = mapLinkById.get(id);
        if (!a) continue;
        if (ent.isIntersecting) {
          for (const l of links) l.classList.remove("is-active");
          a.classList.add("is-active");
        }
      }
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0.01 }
  );

  for (const sec of sections) obs.observe(sec);
}

function initTheme() {
  const html = document.documentElement;
  const btn = $(".theme-toggle");
  if (!btn) return;

  const storageKey = "lab_theme";

  const apply = (theme) => {
    html.setAttribute("data-theme", theme);
  };

  const detectDefault = () => {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
    return "dark";
  };

  const saved = localStorage.getItem(storageKey);
  const initial = saved === "dark" || saved === "light" ? saved : detectDefault();
  apply(initial);

  btn.addEventListener("click", () => {
    const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
    apply(next);
    localStorage.setItem(storageKey, next);
  });
}

function initReveal() {
  if (prefersReducedMotion()) {
    for (const el of $$(".reveal")) el.classList.add("is-in");
    return;
  }

  const els = $$(".reveal");
  if (els.length === 0) return;

  const obs = new IntersectionObserver(
    (entries) => {
      for (const ent of entries) {
        if (!ent.isIntersecting) continue;
        ent.target.classList.add("is-in");
        obs.unobserve(ent.target);
      }
    },
    { threshold: 0.12 }
  );

  for (const el of els) obs.observe(el);
}

function initLightbox() {
  const lightbox = $(".lightbox");
  const dialog = $(".lightbox-dialog");
  const imgEl = $(".lightbox-img");
  const videoEl = $(".lightbox-video");
  const capEl = $(".lightbox-cap");
  if (!lightbox || !dialog || !imgEl || !videoEl || !capEl) return;

  const shots = $$(".shot");
  if (shots.length === 0) return;

  let index = 0;
  let lastFocus = null;

  const isVideoSrc = (src) => /\.(mp4|webm|ogg)(\?|#|$)/i.test(src);

  const getShotData = (i) => {
    const btn = shots[i];
    const img = $("img", btn);
    const video = $("video", btn);
    const src = btn.getAttribute("data-full") || img?.getAttribute("src") || "";
    const cap = $(".shot-cap", btn)?.textContent?.trim() || "";
    const alt = img?.getAttribute("alt") || cap || "照片预览";
    const kind = isVideoSrc(src) ? "video" : "image";
    const poster = kind === "video" ? btn.getAttribute("data-poster") || video?.getAttribute("poster") || "" : "";
    return { src, cap, alt, kind, poster };
  };

  const render = () => {
    const i = clampIndex(index, shots.length);
    index = i;
    const { src, cap, alt, kind, poster } = getShotData(i);

    if (kind === "video") {
      imgEl.hidden = true;
      imgEl.removeAttribute("src");
      imgEl.setAttribute("alt", "");

      videoEl.hidden = false;
      if (poster) videoEl.setAttribute("poster", poster);
      else videoEl.removeAttribute("poster");
      if (videoEl.getAttribute("src") !== src) {
        videoEl.pause();
        videoEl.setAttribute("src", src);
        videoEl.load();
      }
    } else {
      videoEl.pause();
      videoEl.hidden = true;
      videoEl.removeAttribute("src");
      videoEl.removeAttribute("poster");

      imgEl.hidden = false;
      imgEl.setAttribute("src", src);
      imgEl.setAttribute("alt", alt);
    }

    capEl.textContent = cap;
  };

  const setOpen = (open) => {
    lightbox.hidden = !open;
    lightbox.setAttribute("aria-hidden", String(!open));
    document.body.style.overflow = open ? "hidden" : "";
    if (open) {
      lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      render();
      $(".lightbox-close")?.focus();
    } else {
      videoEl.pause();
      videoEl.removeAttribute("src");
      if (lastFocus) lastFocus.focus();
    }
  };

  const move = (delta) => {
    index = clampIndex(index + delta, shots.length);
    render();
  };

  for (const [i, btn] of shots.entries()) {
    btn.addEventListener("click", () => {
      index = i;
      setOpen(true);
    });
  }

  lightbox.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    if (target.matches("[data-close]")) setOpen(false);
    if (target.matches("[data-prev]")) move(-1);
    if (target.matches("[data-next]")) move(1);
  });

  document.addEventListener("keydown", (e) => {
    if (lightbox.hidden) return;
    if (e.key === "Escape") setOpen(false);
    if (e.key === "ArrowLeft") move(-1);
    if (e.key === "ArrowRight") move(1);
    if (e.key === "Tab") {
      const focusables = $$(
        'button:not([disabled]), a[href]:not([aria-disabled="true"]), input:not([disabled]), textarea:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])',
        dialog
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}

function initGalleryStaticLayout() {
  const gallery = $(".gallery");
  if (!gallery) return;

  const shots = $$(".shot", gallery);
  if (shots.length === 0) return;

  const group3 = document.createElement("div");
  group3.className = "gallery-group gallery-group-3";

  const group2 = document.createElement("div");
  group2.className = "gallery-group gallery-group-2";

  const group1 = document.createElement("div");
  group1.className = "gallery-group gallery-group-1";

  const others = document.createElement("div");
  others.className = "gallery-group gallery-group-2";

  const match = (shot, re) => {
    const full = shot.getAttribute("data-full") || "";
    return re.test(full);
  };

  const isVideo = (shot) => match(shot, /\.(mp4|webm|ogg)(\?|#|$)/i);
  const is01to03 = (shot) => match(shot, /\/0[1-3]\.jpg(\?|#|$)/i);
  const is04to07 = (shot) => match(shot, /\/0[4-7]\.jpg(\?|#|$)/i);

  for (const shot of shots) {
    if (isVideo(shot)) group1.appendChild(shot);
    else if (is01to03(shot)) group3.appendChild(shot);
    else if (is04to07(shot)) group2.appendChild(shot);
    else others.appendChild(shot);
  }

  gallery.textContent = "";
  if (group3.childElementCount) gallery.appendChild(group3);
  if (group2.childElementCount) gallery.appendChild(group2);
  if (group1.childElementCount) gallery.appendChild(group1);
  if (others.childElementCount) gallery.appendChild(others);
}

function initDisabledLinks() {
  for (const a of $$('a[aria-disabled="true"]')) {
    a.addEventListener("click", (e) => e.preventDefault());
    a.setAttribute("tabindex", "-1");
  }
}

function initCopyrightBadge() {
  const text = "© korey 2026-1-29";
  if ($(".copyright-badge")) return;

  const el = document.createElement("div");
  el.className = "copyright-badge";
  el.setAttribute("role", "contentinfo");
  el.setAttribute("aria-label", "版权信息");
  el.textContent = text;
  document.body.appendChild(el);
}

initYear();
initHeaderElevate();
initHeaderOffset();
initNav();
initActiveNavLinks();
initTheme();
initReveal();
initGalleryStaticLayout();
initLightbox();
initDisabledLinks();
initCopyrightBadge();
initScrollRestoration();
initScrollProgress();
initSpotlight();
initCountUp();
