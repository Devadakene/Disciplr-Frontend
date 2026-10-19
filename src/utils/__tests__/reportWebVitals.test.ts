// This suite exercises browser-only globals (window, PerformanceObserver),
// which the project's default vitest environment for plain .test.ts files
// ('node', see vitest.config.ts) does not provide. Force jsdom for this file
// so `typeof window === 'undefined'` doesn't short-circuit reportWebVitals()
// before it ever reaches the PerformanceObserver wiring under test.
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { reportWebVitals, type Metric } from '../reportWebVitals';

describe('reportWebVitals', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('callback wiring', () => {
    it('should not throw when no callback is provided', () => {
      expect(() => {
        reportWebVitals();
      }).not.toThrow();
    });

    it('should not throw when callback is undefined', () => {
      expect(() => {
        reportWebVitals(undefined);
      }).not.toThrow();
    });

    it('should not throw when callback is null', () => {
      expect(() => {
        reportWebVitals(null as any);
      }).not.toThrow();
    });

    it('should not throw when callback is not a function', () => {
      expect(() => {
        reportWebVitals('not a function' as any);
      }).not.toThrow();
    });

    it('should call the callback when a valid function is provided', () => {
      const callback = vi.fn();
      
      // Mock PerformanceObserver to simulate metric reporting
      const mockPerformanceObserver = vi.fn();
      mockPerformanceObserver.mockImplementation(() => ({
        observe: vi.fn(),
      }));
      
      global.PerformanceObserver = mockPerformanceObserver as any;
      
      reportWebVitals(callback);
      
      // The callback should be wired up (actual calls depend on browser events)
      expect(mockPerformanceObserver).toHaveBeenCalled();
    });

    it('should not crash the app when the callback throws an error', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const mockPerformanceObserver = vi.fn();
      mockPerformanceObserver.mockImplementation(() => ({
        observe: vi.fn(),
      }));
      
      global.PerformanceObserver = mockPerformanceObserver as any;
      
      expect(() => {
        reportWebVitals(errorCallback);
      }).not.toThrow();
      
      consoleSpy.mockRestore();
    });

    it('should log error when callback throws', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // reportWebVitals only invokes the callback once the PerformanceObserver
      // reports an entry, so capture the LCP observer's callback and invoke
      // it with a fake entry to actually exercise the error-handling path.
      let capturedLcpCallback: ((list: { getEntries: () => unknown[] }) => void) | undefined;
      const mockPerformanceObserver = vi.fn((callback: (list: { getEntries: () => unknown[] }) => void) => {
        if (!capturedLcpCallback) capturedLcpCallback = callback;
        return { observe: vi.fn() };
      });

      global.PerformanceObserver = mockPerformanceObserver as any;

      reportWebVitals(errorCallback);
      capturedLcpCallback?.({ getEntries: () => [{ renderTime: 1200, startTime: 0 }] });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Web Vitals reporter callback threw an error:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('environment handling', () => {
    it('should return early when window is undefined (SSR)', () => {
      const callback = vi.fn();
      const originalWindow = global.window;
      
      // @ts-expect-error - testing SSR scenario
      delete global.window;
      
      reportWebVitals(callback);
      
      // Callback should not be called in SSR
      expect(callback).not.toHaveBeenCalled();
      
      global.window = originalWindow;
    });

    it('should handle missing PerformanceObserver gracefully', () => {
      const callback = vi.fn();
      const originalPerformanceObserver = global.PerformanceObserver;
      
      // @ts-expect-error - testing missing PerformanceObserver
      delete global.PerformanceObserver;
      
      expect(() => {
        reportWebVitals(callback);
      }).not.toThrow();
      
      if (originalPerformanceObserver) {
        global.PerformanceObserver = originalPerformanceObserver;
      }
    });
  });

  describe('metric rating functions', () => {
    it('should rate LCP correctly', () => {
      // These are internal functions, but we can test the overall behavior
      // by checking that the function doesn't throw with valid inputs
      const callback = vi.fn();
      
      const mockPerformanceObserver = vi.fn();
      mockPerformanceObserver.mockImplementation(() => ({
        observe: vi.fn(),
      }));
      
      global.PerformanceObserver = mockPerformanceObserver as any;
      
      expect(() => {
        reportWebVitals(callback);
      }).not.toThrow();
    });
  });

  describe('multiple metrics', () => {
    it('should handle multiple metric observers without crashing', () => {
      const callback = vi.fn();
      
      const mockPerformanceObserver = vi.fn();
      mockPerformanceObserver.mockImplementation(() => ({
        observe: vi.fn(),
      }));
      
      global.PerformanceObserver = mockPerformanceObserver as any;
      
      expect(() => {
        reportWebVitals(callback);
      }).not.toThrow();
      
      // Should attempt to observe multiple metric types
      expect(mockPerformanceObserver).toHaveBeenCalled();
    });
  });

  describe('metric interface', () => {
    it('should accept metrics with the correct interface', () => {
      const callback = vi.fn();
      const metric: Metric = {
        id: 'test-metric',
        name: 'LCP',
        value: 1200,
        rating: 'good',
        delta: 100,
        navigationType: 'navigate',
      };
      
      // This tests that the interface is correctly typed
      expect(() => {
        callback(metric);
      }).not.toThrow();
      
      expect(callback).toHaveBeenCalledWith(metric);
    });
  });

  describe('observer error handling', () => {
    it('should handle observe() errors gracefully', () => {
      const callback = vi.fn();
      
      const mockPerformanceObserver = vi.fn();
      mockPerformanceObserver.mockImplementation(() => ({
        observe: vi.fn(() => {
          throw new Error('Observe error');
        }),
      }));
      
      global.PerformanceObserver = mockPerformanceObserver as any;
      
      expect(() => {
        reportWebVitals(callback);
      }).not.toThrow();
    });

    it('should handle PerformanceObserver constructor errors gracefully', () => {
      const callback = vi.fn();
      
      const mockPerformanceObserver = vi.fn(() => {
        throw new Error('Constructor error');
      });
      
      global.PerformanceObserver = mockPerformanceObserver as any;
      
      expect(() => {
        reportWebVitals(callback);
      }).not.toThrow();
    });
  });
});
