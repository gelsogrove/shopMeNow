import "@testing-library/jest-dom"

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!("ResizeObserver" in globalThis)) {
  ;(globalThis as any).ResizeObserver = ResizeObserverMock
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
