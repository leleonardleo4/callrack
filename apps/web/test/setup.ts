import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// jsdom has no WebGL/WebGL2 support, so ogl's Renderer throws when Aurora
// (the landing page's hero background) mounts in tests. Real rendering
// isn't the point of a component test here, so replace it with the
// smallest stub that satisfies what src/components/Aurora.tsx calls.
vi.mock('ogl', () => {
  class Renderer {
    readonly gl: Record<string, unknown>;
    constructor() {
      this.gl = {
        canvas: document.createElement('canvas'),
        clearColor: () => {},
        enable: () => {},
        blendFunc: () => {},
        getExtension: () => null,
        BLEND: 0,
        ONE: 1,
        ONE_MINUS_SRC_ALPHA: 2,
      };
    }
    setSize(): void {}
    render(): void {}
  }
  class Program {
    readonly uniforms: Record<string, { value: unknown }> = {
      uTime: { value: 0 },
      uAmplitude: { value: 0 },
      uColorStops: { value: [] },
      uResolution: { value: [0, 0] },
      uBlend: { value: 0 },
      uLightMode: { value: 0 },
    };
  }
  class Mesh {}
  class Triangle {
    readonly attributes: Record<string, unknown> = { uv: {} };
  }
  class Color {
    r = 0;
    g = 0;
    b = 0;
  }
  return { Renderer, Program, Mesh, Triangle, Color };
});

// jsdom doesn't implement these; Radix's Select (used by the capability
// picker) calls them internally, so without a no-op they throw in tests.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom has no ResizeObserver; Radix's Popper positioning (used by the
// wallet menu's DropdownMenu, which - unlike the capability Select - uses
// "popper" placement) depends on it, and hangs indefinitely without a stub.
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

// jsdom doesn't implement matchMedia; ThemeProvider reads it for the
// system-preference fallback. Reports "no preference" (matches: false) by
// default, same as most real headless/CI browser contexts.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
}
