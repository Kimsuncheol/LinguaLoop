import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
} from "vue";
import type { Language } from "./lessons";

export type LibraryView =
  | { kind: "dashboard"; language: Language }
  | { kind: "lesson" | "practice"; language: Language; ids: string[] };
interface ExitGuard {
  id: string;
  previous: boolean;
}
interface Entry {
  version: 1;
  key: string;
  depth: number;
  parent: LibraryView["kind"] | null;
  view: LibraryView;
  scroll: number;
  exitGuard?: ExitGuard;
  exitBoundary?: boolean;
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
  if (
    e.exitGuard &&
    (typeof e.exitGuard.id !== "string" ||
      typeof e.exitGuard.previous !== "boolean")
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
  let guard = savedEntry(window.history.state?.lingualoop)?.exitGuard;
  const exitRequested = ref(false),
    exitReady = ref(true),
    exitHint = ref(false);
  let leaving = false;
  let exitTimer: ReturnType<typeof setTimeout> | undefined;
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
    exitGuard: guard,
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
  function armExit(value: Entry) {
    guard ||= { id: crypto.randomUUID(), previous: window.history.length > 1 };
    // One boundary below the dashboard lets hardware Back ask before leaving.
    // Stay traverses Forward to the existing root instead of pushing duplicates.
    write({ ...value, exitGuard: guard, exitBoundary: true });
    const root = {
      ...value,
      key: crypto.randomUUID(),
      exitGuard: guard,
      exitBoundary: false,
    };
    write(root, true);
    leaving = false;
    exitHint.value = false;
    return root;
  }
  function stay() {
    exitRequested.value = false;
  }
  function leave() {
    if (!exitRequested.value || !exitReady.value) return;
    exitRequested.value = false;
    leaving = true;
    const key = entry.value.key;
    if (guard?.previous) {
      // Skip the dashboard's confirmation boundary and reach the previous page.
      window.history.go(-2);
      exitTimer = setTimeout(() => {
        if (
          active &&
          leaving &&
          window.history.state?.lingualoop?.key === key
        ) {
          exitHint.value = true;
          window.history.back();
        }
      }, 400);
    } else {
      if (
        window.matchMedia(
          "(display-mode: standalone), (display-mode: fullscreen)",
        ).matches
      )
        window.close();
      // Some hosts prohibit script-closing. Disarm the boundary so the next
      // hardware Back is native, and explain that fallback instead of trapping.
      exitHint.value = true;
      window.history.back();
    }
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
    if (entry.value.exitBoundary) entry.value = armExit(entry.value);
    exitHint.value = false;
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
    if (entry.value.exitBoundary) entry.value = armExit(entry.value);
    if (!entry.value.depth) return;
    saveScroll();
    window.history.go(-entry.value.depth);
  }
  function pop(event: PopStateEvent) {
    let next = savedEntry(event.state?.lingualoop);
    if (next?.exitBoundary && next.exitGuard?.id === guard?.id) {
      if (leaving) {
        entry.value = {
          ...next,
          view: entry.value.view,
          scroll: entry.value.scroll,
        };
        write(entry.value);
        return;
      }
      exitRequested.value = !exitRequested.value;
      exitReady.value = false;
      window.history.forward();
      return;
    }
    exitReady.value = true;
    leaving = false;
    exitHint.value = false;
    clearTimeout(exitTimer);
    next ||= create({ kind: "dashboard", language: entry.value.view.language });
    guard = next.exitGuard || guard;
    if (next.view.kind === "dashboard" && !next.exitGuard) next = armExit(next);
    void apply(next);
  }
  function scroll() {
    clearTimeout(timer);
    timer = setTimeout(saveScroll, 150);
  }
  onMounted(() => {
    active = true;
    previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    if (
      entry.value.view.kind === "dashboard" &&
      (!entry.value.exitGuard || entry.value.exitBoundary)
    ) {
      entry.value = armExit(entry.value);
    } else write(entry.value);
    window.addEventListener("popstate", pop);
    window.addEventListener("scroll", scroll, { passive: true });
    void apply(entry.value);
  });
  onUnmounted(() => {
    active = false;
    revision++;
    clearTimeout(timer);
    clearTimeout(exitTimer);
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
    exitRequested,
    exitReady,
    exitHint,
    stay,
    leave,
  };
}
