// '#datos/ensayos/PSI-69:20CAL08' llega como sub = 'ensayos/PSI-69:20CAL08'
const split = (sub) => {
  if (!sub) return [null, null];
  const i = sub.indexOf("/");
  return i < 0 ? [sub, null] : [sub.slice(0, i), sub.slice(i + 1)];
};

/**
 * Pestaña con varias vistas y un selector arriba. Solo la vista elegida está activa:
 * recibe enter() al mostrarse y leave() al ocultarse, igual que una pestaña.
 */
export function mountParts(root, tab, parts, { label }) {
  root.innerHTML = `
    <div class="subnav"><div class="seg" role="group" aria-label="${label}">
      ${parts.map((p) => `<button type="button" data-v="${p.id}">${p.label}</button>`).join("")}
    </div></div>
    ${parts.map((p) => `<div class="subview" data-part="${p.id}" hidden></div>`).join("")}`;

  const box = (id) => root.querySelector(`.subview[data-part="${id}"]`);
  const views = Object.fromEntries(parts.map((p) => [p.id, p.mount(box(p.id))]));
  let current = parts[0].id;
  let on = false;

  function show(id, rest = null) {
    if (!views[id]) id = parts[0].id;
    if (on && id === current) return rest && views[id].route?.(rest);
    if (on) {
      views[current].leave?.();
      // al cambiar de vista desde abajo de la página (p. ej. clic en un punto), subir al selector
      if (root.getBoundingClientRect().top < 0) scrollTo({ top: 0, behavior: "smooth" });
    }
    current = id;
    on = true;
    parts.forEach((p) => { box(p.id).hidden = p.id !== id; });
    root.querySelectorAll(".subnav button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === id));
    history.replaceState(null, "", `#${tab}/${id}`);
    views[id].enter?.(rest);
  }

  root.querySelector(".subnav").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) show(b.dataset.v);
  });

  return {
    enter(sub) {
      const [id, rest] = split(sub);
      show(id || current, rest);
    },
    route(sub) {
      const [id, rest] = split(sub);
      if (id) show(id, rest);
    },
    leave() {
      if (on) views[current].leave?.();
      on = false;
    },
  };
}

/** Varias vistas una debajo de otra en la misma pestaña. */
export function mountStack(root, mounts) {
  root.innerHTML = mounts.map(() => `<div class="subview"></div>`).join("");
  const views = mounts.map((mount, i) => mount(root.children[i]));
  return {
    enter: (sub) => views.forEach((v) => v.enter?.(sub)),
    leave: () => views.forEach((v) => v.leave?.()),
  };
}
