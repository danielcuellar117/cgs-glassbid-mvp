import "@testing-library/jest-dom/vitest";

// Mock IntersectionObserver for components like PageThumbnail
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  private callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(_target: Element): void {
    // Immediately trigger as intersecting for tests
    this.callback(
      [{ isIntersecting: true, target: _target } as IntersectionObserverEntry],
      this,
    );
  }

  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

globalThis.IntersectionObserver = MockIntersectionObserver as any;
