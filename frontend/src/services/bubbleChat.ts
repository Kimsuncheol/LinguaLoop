import type { ComponentOptions } from "vue";
import type { dialogueMessages } from "./lessonText";
type Messages = ReturnType<typeof dialogueMessages>["messages"];

/** Isolated Vue 3 compat island: the main app continues using standard Vue 3. */
export async function mountBubbleChat(
  host: HTMLElement,
  messages: Messages,
  language: string,
) {
  const [compat, { default: plugin }] = await Promise.all([
    import("@vue/compat/dist/vue.runtime.esm-bundler.js"),
    import("vue-bubble-chat"),
  ]);
  let original: ComponentOptions | undefined;
  plugin.install({
    component(_name, options) {
      original = options;
    },
  });
  if (!original) throw new Error("Chat component unavailable");
  compat.configureCompat({ MODE: 3 });
  const readonlyChat = {
    ...original,
    compatConfig: { MODE: 2 as const },
    // Vendor CSS injects global body rules and a fixed chat launcher. Use the
    // app's scoped semantic styling instead, with the vendor's actual renderer.
    beforeCreate() {},
    data: () => ({
      windowMode: true,
      messageUpdating: false,
      newMessageText: "",
      fullMesagesList: [],
      checkedMessages: 0,
    }),
    watch: {},
    methods: { openChat() {}, sendMessage() {}, scrollDownChat() {} },
  };
  const app = compat.createApp(readonlyChat, {
    messages,
    textField: "text",
    senderNameField: "speaker",
    position: "left",
  });
  app.mount(host);
  const list = host.querySelector<HTMLElement>(".scroll");
  if (!list || list.children.length !== messages.length) {
    app.unmount();
    throw new Error("Chat renderer unavailable");
  }
  list.setAttribute("role", "list");
  list?.setAttribute("aria-label", "Dialogue between characters A and B");
  for (const [i, row] of Array.from(list?.children || []).entries()) {
    const message = messages[i];
    if (!message) continue;
    row.setAttribute("role", "listitem");
    row.setAttribute("data-speaker", message.speaker);
    row.querySelector(".no_image")?.setAttribute("aria-hidden", "true");
    const badge = row.querySelector<HTMLElement>(".name");
    const bubble = row.firstElementChild;
    if (badge && bubble) {
      badge.classList.add("character-badge");
      row.insertBefore(badge, bubble);
    }
    const text = row.querySelector(".msg");
    text?.setAttribute("lang", language);
    if (message.translation && text) {
      const meaning = document.createElement("p");
      meaning.className = "bubble-translation";
      meaning.lang = "ko";
      meaning.textContent = message.translation;
      text.insertAdjacentElement("afterend", meaning);
    }
  }
  const input = host.querySelector("textarea");
  if (input) {
    input.disabled = true;
    input.tabIndex = -1;
  }
  return () => app.unmount();
}
