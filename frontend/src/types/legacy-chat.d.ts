declare module "vue-bubble-chat" {
  import type { ComponentOptions } from "vue";
  const plugin: {
    install(app: {
      component(name: string, options: ComponentOptions): void;
    }): void;
  };
  export default plugin;
}
declare module "@vue/compat/dist/vue.runtime.esm-bundler.js" {
  export { createApp } from "vue";
  export function configureCompat(
    config: Record<string, boolean | number>,
  ): void;
}
