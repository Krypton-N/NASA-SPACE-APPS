/**
 * Grupo de chips de filtro. options: [[valor, etiqueta], ...]
 * isOn(valor) decide el estado; onToggle(valor) cambia el filtro.
 */
export function chipGroup(box, label, options, isOn, onToggle) {
  box.innerHTML = `<span class="chip-label">${label}</span>`;
  const buttons = options.map(([value, text]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = text;
    b.dataset.v = value;
    b.addEventListener("click", () => {
      onToggle(value);
      buttons.forEach((x) => x.setAttribute("aria-pressed", isOn(x.dataset.v)));
    });
    b.setAttribute("aria-pressed", isOn(value));
    box.appendChild(b);
    return b;
  });
  return buttons;
}

/** Selector segmentado de gravedad; varios pueden reflejar el mismo estado. */
export function gravitySwitch(store) {
  const seg = document.createElement("div");
  seg.className = "seg";
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", "Gravedad");
  seg.innerHTML = `<button type="button" data-g="0">Microgravedad</button><button type="button" data-g="1">Gravedad terrestre</button>`;
  const sync = ({ g }) => seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.g === g));
  seg.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) store.set({ g: +b.dataset.g });
  });
  store.subscribe(sync);
  sync(store.get());
  return seg;
}
