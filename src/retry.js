/**
 * Retry an async function with exponential backoff.
 * @param {() => Promise<T>} fn
 * @param {object} opts
 * @param {number} opts.retries - max retry attempts (default 3)
 * @param {number} opts.baseDelay - base delay in ms (default 1000)
 * @param {string} opts.label - label for logging
 * @returns {Promise<T>}
 * @template T
 */
export async function retry(fn, { retries = 3, baseDelay = 1000, label = '' } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[retry] ${label || 'op'} failed (attempt ${attempt + 1}/${retries + 1}): ${err.message}. Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
