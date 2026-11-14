export function ripple(event: MouseEvent) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>(".menu-tile") : null;
  if (!target || target.matches(":disabled")) return;

  const bounds = target.getBoundingClientRect();
  const size = Math.hypot(bounds.width, bounds.height) * 2;
  const x = event.detail ? event.clientX - bounds.left : bounds.width / 2;
  const y = event.detail ? event.clientY - bounds.top : bounds.height / 2;
  const circle = document.createElement("span");
  circle.className = "menu-ripple";
  circle.setAttribute("aria-hidden", "true");
  Object.assign(circle.style, {
    width: `${size}px`, height: `${size}px`,
    left: `${x - size / 2}px`, top: `${y - size / 2}px`,
  });
  target.append(circle);
  const animation = circle.animate(
    [{ transform: "scale(0)", opacity: 0.2 }, { transform: "scale(1)", opacity: 0 }],
    { duration: 500, easing: "ease-out" },
  );
  void animation.finished.then(() => circle.remove(), () => circle.remove());
}
