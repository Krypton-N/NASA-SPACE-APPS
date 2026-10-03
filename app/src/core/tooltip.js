let tip;

function ensure() {
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "tip";
    tip.hidden = true;
    tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);
  }
  return tip;
}

function place(e) {
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  let x = e.clientX + 16;
  let y = e.clientY + 16;
  if (x + w > innerWidth - 8) x = e.clientX - w - 16;
  if (y + h > innerHeight - 8) y = e.clientY - h - 16;
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
}

/** Asocia un tooltip a un elemento: content() devuelve HTML; on/off permiten resaltar la marca. */
export function bindTip(target, content, { on, off } = {}) {
  ensure();
  target.addEventListener("mouseenter", (e) => {
    tip.innerHTML = content();
    tip.hidden = false;
    place(e);
    on?.();
  });
  target.addEventListener("mousemove", place);
  target.addEventListener("mouseleave", () => {
    tip.hidden = true;
    off?.();
  });
}

export function hideTip() {
  if (tip) tip.hidden = true;
}
