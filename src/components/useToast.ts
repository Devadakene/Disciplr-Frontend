import { useToastStore } from "../Zustand/toastStore";

/**
 * Convenience hook for components that only need to push a toast.
 * Components that need to read the queue should subscribe to
 * `useToastStore` directly so they only re-render when the slice they
 * care about changes.
 */
export function useToast() {
  return {
    push: useToastStore((s) => s.push),
    dismiss: useToastStore((s) => s.dismiss),
    clear: useToastStore((s) => s.clear),
  };
}
