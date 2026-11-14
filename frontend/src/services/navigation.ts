import { computed, nextTick, onMounted, onUnmounted, shallowRef } from "vue";
import type { Language } from "./lessons";

export type LibraryView =
  | { kind: "dashboard"; language: Language }
  | { kind: "lesson" | "practice"; language: Language; ids: string[] };
interface Entry {
  version: 1;
  key: string;
  depth: number;
  parent: LibraryView["kind"] | null;
  view: LibraryView;
  scroll: number;
}
function savedEntry(value: unknown): Entry | null {
  if (!value || typeof value !== "object") return null;
  const e = value as Entry;
  if (
    e.version !== 1 ||
    typeof e.key !== "string" ||
    !Number.isInteger(e.depth) ||
    e.depth < 0 ||
    !Number.isFinite(e.scroll) ||
    e.scroll < 0
  )
    return null;
  const v = e.view;
  if (!v || !["en", "ja"].includes(v.language)) return null;
  if (v.kind === "dashboard") return e.depth === 0 ? e : null;
  if (
    !["lesson", "practice"].includes(v.kind) ||
    e.depth === 0 ||
    !Array.isArray(v.ids) ||
    !v.ids.length ||
    v.ids.length > 100000
  )
    return null;
  if (v.kind === "lesson" && v.ids.length !== 1) return null;
  return v.ids.every(
    (id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(id),
  )
    ? e
    : null;
}

/** History contains view identifiers only, never lesson content or credentials. */
export function useLibraryNavigation(
  render: (view: LibraryView) => Promise<void>,
) {
  const create = (
    view: LibraryView,
    depth = 0,
    parent: Entry["parent"] = null,
  ): Entry => ({
    version: 1,
    key: crypto.randomUUID(),
    depth,
    parent,
    view,
    scroll: 0,
  });
  const entry = shallowRef(
    savedEntry(window.history.state?.lingualoop) ||
      create({ kind: "dashboard", language: "en" }),
  );
  let active = false,
    restoring = false,
    revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let previousScrollRestoration: ScrollRestoration;
  function write(value: Entry, push = false) {
    window.history[push ? "pushState" : "replaceState"](
      { ...window.history.state, lingualoop: value },
      "",
    );
  }
  function saveScroll() {
    if (
      !active ||
      restoring ||
      window.history.state?.lingualoop?.key !== entry.value.key
    )
      return;
    entry.value = { ...entry.value, scroll: Math.max(0, window.scrollY) };
    write(entry.value);
  }
  async function apply(value: Entry) {
    const current = ++revision;
    clearTimeout(timer);
    restoring = true;
    entry.value = value;
    try {
      await render(value.view);
      await nextTick();
      if (!active || current !== revision) return;
      window.scrollTo({ top: value.scroll, behavior: "instant" });
      const heading = document.querySelector<HTMLElement>(
        ".reader-content h1, .practice h1, .view h1",
      );
      heading?.focus({ preventScroll: true });
    } finally {
      if (current === revision) restoring = false;
    }
  }
  function navigate(view: LibraryView, replace = false) {
    if (JSON.stringify(view) === JSON.stringify(entry.value.view)) return;
    saveScroll();
    const next = create(
      view,
      replace ? entry.value.depth : entry.value.depth + 1,
      replace ? entry.value.parent : entry.value.view.kind,
    );
    write(next, !replace);
    void apply(next);
  }
  function back() {
    if (!entry.value.depth) return;
    saveScroll();
    window.history.back();
  }
  function home() {
    if (!entry.value.depth) return;
    saveScroll();
    window.history.go(-entry.value.depth);
  }
  function pop(event: PopStateEvent) {
    // Never push a replacement entry on Back: at the dashboard the OS/browser
    // remains free to leave the app, instead of trapping the user in a loop.
    void apply(
      savedEntry(event.state?.lingualoop) ||
        create({ kind: "dashboard", language: entry.value.view.language }),
    );
  }
  function scroll() {
    clearTimeout(timer);
    timer = setTimeout(saveScroll, 150);
  }
  onMounted(() => {
    active = true;
    previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    write(entry.value);
    window.addEventListener("popstate", pop);
    window.addEventListener("scroll", scroll, { passive: true });
    void apply(entry.value);
  });
  onUnmounted(() => {
    active = false;
    revision++;
    clearTimeout(timer);
    window.removeEventListener("popstate", pop);
    window.removeEventListener("scroll", scroll);
    window.history.scrollRestoration = previousScrollRestoration;
  });
  return {
    entry,
    view: computed(() => entry.value.view),
    navigate,
    back,
    home,
  };
}
