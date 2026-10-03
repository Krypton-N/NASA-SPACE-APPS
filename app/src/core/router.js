import { $, $$ } from "./dom.js";
import { hideTip } from "./tooltip.js";

/**
 * Pestañas con ciclo de vida: cada vista puede declarar enter() y leave()
 * para arrancar o liberar recursos (animaciones, WebGL) solo mientras está visible.
 */
export function createRouter({ tabs, views, initial }) {
  const nav = $("#tabs");
  const pill = $(".tab-pill", nav);
  let current = null;

  tabs.forEach(({ id, label }) => {
    const b = document.createElement("button");
    b.className = "tab";
    b.id = `tab-${id}`;
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-controls", `view-${id}`);
    b.dataset.tab = id;
    b.textContent = label;
    b.addEventListener("click", () => go(id));
    nav.appendChild(b);
  });

  function movePill() {
    const b = $(`#tab-${current}`);
    if (!b) return;
    pill.style.width = `${b.offsetWidth}px`;
    pill.style.transform = `translateX(${b.offsetLeft}px)`;
  }
  addEventListener("resize", movePill);
  document.fonts?.ready.then(movePill);

  function go(id, { scroll = true } = {}) {
    if (!views[id] || id === current) return;
    hideTip();
    if (current) views[current].leave?.();
    const prev = current;
    current = id;
    $$(".tab", nav).forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === id));
    $$(".view").forEach((v) => {
      const on = v.id === `view-${id}`;
      v.hidden = !on;
      v.classList.toggle("enter", on);
    });
    movePill();
    history.replaceState(null, "", `#${id}`);
    try { localStorage.setItem("fif-tab", id); } catch { /* sin almacenamiento */ }
    if (scroll && prev) scrollTo({ top: 0, behavior: "smooth" });
    views[id].enter?.();
  }

  addEventListener("hashchange", () => {
    const id = location.hash.slice(1);
    if (views[id]) go(id);
  });

  let start = initial;
  try { start = localStorage.getItem("fif-tab") || start; } catch { /* sin almacenamiento */ }
  const hash = location.hash.slice(1);
  if (views[hash]) start = hash;
  if (!views[start]) start = initial;
  go(start, { scroll: false });

  return { go };
}
