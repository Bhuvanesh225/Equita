const header = document.querySelector(".site-header");
const toggle = header.querySelector(".nav-toggle");
const panelLinks = header.querySelectorAll(".site-header__panel a");
let navOpen = false;

const setNav = (open) => {
  navOpen = open;
  header.toggleAttribute("data-nav-open", open);
  toggle.setAttribute("aria-expanded", String(open));
};
toggle.addEventListener("click", () => setNav(!navOpen));
panelLinks.forEach((a) => a.addEventListener("click", () => setNav(false)));
addEventListener("keydown", (e) => { if (e.key === "Escape" && navOpen) setNav(false); });

const elevate = () => {
  header.dataset.elevate = scrollY > 8 ? "raised" : "";
};
elevate();
addEventListener("scroll", elevate, { passive: true });

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const revealAll = () => {
  document.querySelectorAll("[data-reveal]").forEach((el) => {
    el.classList.add("is-in");
    el.style.transitionDelay = "";
    el.removeAttribute("data-reveal");
  });
};

if (!reduced && "IntersectionObserver" in window) {
  const groups = new Map();
  document.querySelectorAll("[data-reveal]").forEach((el) => {
    const parent = el.parentElement;
    const idx = groups.has(parent) ? groups.get(parent) : (groups.set(parent, 0), 0);
    groups.set(parent, idx + 1);
    el.style.transitionDelay = `${Math.min(idx, 7) * 60}ms`;
  });

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const el = entry.target;
          el.classList.add("is-in");
          io.unobserve(el);
          // Drop the reveal transition once done so hover transitions
          // (card lift, border) run at their own speed again.
          setTimeout(() => {
            el.style.transitionDelay = "";
            el.removeAttribute("data-reveal");
          }, 900);
        }
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );
  document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
} else {
  revealAll();
}

// Scroll-spy — deterministic and monotonic. The active link is the last
// section whose top has passed the reading line, so the highlight only ever
// advances forward as you scroll: never back to the top at page start, never
// out of order when a section sits earlier in the DOM than in the nav.
const navPairs = [...document.querySelectorAll('.site-header__nav a[href^="#"]')]
  .map((a) => {
    const el = document.getElementById(a.hash.slice(1));
    return el ? { a, el } : null;
  })
  .filter(Boolean);

let navThrottle = 0;
let navTrail = 0;
const syncNav = () => {
  const readingLine = header.offsetHeight + Math.min(innerHeight * 0.22, 220);
  let active = null;
  for (const pair of navPairs) {
    if (pair.el.getBoundingClientRect().top <= readingLine) active = pair.a;
  }
  // At the very bottom, the shortest last section still deserves the highlight
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) {
    active = navPairs.at(-1)?.a ?? active;
  }
  for (const { a } of navPairs) {
    if (a === active) a.setAttribute("aria-current", "true");
    else a.removeAttribute("aria-current");
  }
};
const requestNavSync = () => {
  clearTimeout(navTrail);
  const now = performance.now();
  if (now - navThrottle > 90) {
    navThrottle = now;
    syncNav();
  } else {
    // Trailing run so the last scroll event of a gesture is never dropped
    navTrail = setTimeout(syncNav, 90);
  }
};
addEventListener("scroll", requestNavSync, { passive: true });
addEventListener("resize", requestNavSync);
syncNav();

document.getElementById("year").textContent = new Date().getFullYear();

// Coming-soon links — honest inline feedback instead of dead ends
const toast = document.getElementById("toast");
let toastTimer;
document.querySelectorAll("[data-soon]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    toast.textContent = link.dataset.soon;
    toast.setAttribute("data-show", "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.removeAttribute("data-show"), 3200);
  });
});
