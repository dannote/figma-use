/**
 * Retry utility with configurable backoff
 */

export interface RetryOptions {
  maxAttempts?: number
  delayMs?: number
  backoff?: 'fixed' | 'linear' | 'exponential'
}

const defaults: Required<RetryOptions> = {
  maxAttempts: 10,
  delayMs: 50,
  backoff: 'fixed'
}

function getDelay(attempt: number, delayMs: number, backoff: RetryOptions['backoff']): number {
  switch (backoff) {
    case 'linear':
      return delayMs * (attempt + 1)
    case 'exponential':
      return delayMs * Math.pow(2, attempt)
    default:
      return delayMs
  }
}

/**
 * Retry an async function until it returns a truthy value or max attempts reached
 */
export async function retry<T>(
  fn: () => Promise<T | null | undefined>,
  options?: RetryOptions
): Promise<T | null> {
  const { maxAttempts, delayMs, backoff } = { ...defaults, ...options }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await fn()
    if (result) return result

    if (attempt < maxAttempts - 1) {
      await sleep(getDelay(attempt, delayMs, backoff))
    }
  }

  return null
}

/**
 * Retry an async function, throwing on final failure
 */
export async function retryOrThrow<T>(
  fn: () => Promise<T | null | undefined>,
  errorMessage: string,
  options?: RetryOptions
): Promise<T> {
  const result = await retry(fn, options)
  if (!result) throw new Error(errorMessage)
  return result
}

/**
 * Sleep for given milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
