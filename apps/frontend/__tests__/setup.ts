import "@testing-library/jest-dom"
import React from "react"
import { vi } from "vitest"

function createMockComponent(
  displayName: string,
  tag: keyof JSX.IntrinsicElements = "div"
) {
  const Component = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
    ({ children, ...props }, ref) =>
      React.createElement(tag, { ref, ...props }, children)
  )
  Component.displayName = displayName
  return Component
}

// Intentionally avoid mocking the full Radix UI components to prevent test breakage.

vi.mock("@radix-ui/react-presence", () => ({
  Presence: ({
    children,
    present,
    forceMount,
  }: {
    children: React.ReactNode | ((state: { present: boolean }) => React.ReactNode)
    present?: boolean
    forceMount?: boolean
  }) => {
    const resolvedPresent = forceMount ?? present ?? true
    if (typeof children === "function") {
      return children({ present: resolvedPresent })
    }
    return resolvedPresent
      ? React.createElement(React.Fragment, null, children)
      : null
  },
}))

vi.mock("@radix-ui/react-portal", () => ({
  Portal: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}))

vi.mock("@radix-ui/react-focus-scope", () => ({
  FocusScope: createMockComponent("FocusScope"),
}))

vi.mock("@radix-ui/react-dismissable-layer", () => ({
  DismissableLayer: createMockComponent("DismissableLayer"),
  DismissableLayerBranch: createMockComponent("DismissableLayerBranch"),
}))

vi.mock("@radix-ui/react-slot", () => ({
  Slot: React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
    ({ children, ...props }, ref) => {
      if (!React.isValidElement(children)) {
        return null
      }
      return React.cloneElement(children, { ...props, ref })
    }
  ),
  Slottable: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}))

vi.mock("@radix-ui/react-primitive", () => {
  const Primitive = new Proxy(
    {},
    {
      get: (_target, prop: string) =>
        createMockComponent(`Primitive.${String(prop)}`),
    }
  )
  return { Primitive }
})

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!("ResizeObserver" in globalThis)) {
  ;(globalThis as any).ResizeObserver = ResizeObserverMock
}

// Mock IntersectionObserver (required by framer-motion viewport features)
class IntersectionObserverMock implements IntersectionObserver {
  readonly root: Element | Document | null = null
  readonly rootMargin: string = ""
  readonly thresholds: ReadonlyArray<number> = []
  
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

if (!("IntersectionObserver" in globalThis)) {
  ;(globalThis as any).IntersectionObserver = IntersectionObserverMock
}

if ("HTMLDialogElement" in globalThis) {
  const proto = (globalThis as any).HTMLDialogElement.prototype
  if (!proto.showModal) {
    proto.showModal = function showModal() {
      this.open = true
    }
  }
  if (!proto.close) {
    proto.close = function close() {
      this.open = false
    }
  }
}

if (!("matchMedia" in globalThis)) {
  ;(globalThis as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

// Mock window.scrollTo (not implemented in jsdom)
if (typeof window !== "undefined" && !window.scrollTo) {
  window.scrollTo = () => {}
}

const originalConsoleError = console.error
console.error = (...args: unknown[]) => {
  const message = typeof args[0] === "string" ? args[0] : ""
  if (message.includes("was not wrapped in act")) {
    return
  }
  originalConsoleError(...args)
}
