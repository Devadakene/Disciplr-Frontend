export class ConnectTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Connect attempt timed out after ${timeoutMs}ms.`);
    this.name = 'ConnectTimeoutError';
  }
}

export type TimeoutWrappedPromise<T> = Promise<T> & {
  cancel: () => void;
};

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  onTimeout?: (timeoutMs: number) => void,
): TimeoutWrappedPromise<T> {
  let settled = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const clearTimer = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  const wrapped = new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      clearTimer();
      onTimeout?.(ms);
      reject(new ConnectTimeoutError(ms));
    }, ms);

    return Promise.resolve(promise).then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimer();
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimer();
        reject(error);
      },
    );
  }) as TimeoutWrappedPromise<T>;

  wrapped.cancel = () => {
    if (settled) return;
    settled = true;
    clearTimer();
  };

  return wrapped;
}
