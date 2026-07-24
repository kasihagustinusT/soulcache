/**
 * Noop Function
 *
 * A function that does nothing. Used as a default callback.
 */
export function noop(): void {
  // Intentionally empty
}

/**
 * Noop Async
 *
 * An async function that does nothing.
 */
export async function noopAsync(): Promise<void> {
  // Intentionally empty
}

/**
 * Identity
 *
 * Returns the input value unchanged.
 *
 * @param value - The value to return
 * @returns The same value
 */
export function identity<T>(value: T): T {
  return value;
}

/**
 * Debounce
 *
 * Creates a debounced version of a function.
 *
 * @param fn - Function to debounce
 * @param ms - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: readonly unknown[]) => unknown>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return (...args: Parameters<T>): void => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
    }, ms);
  };
}

/**
 * Throttle
 *
 * Creates a throttled version of a function.
 *
 * @param fn - Function to throttle
 * @param ms - Minimum interval in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: readonly unknown[]) => unknown>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>): void => {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    }
  };
}
