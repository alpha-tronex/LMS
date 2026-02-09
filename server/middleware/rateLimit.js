const { sendError } = require('../utils/responses');

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function getClientIp(req) {
  return (
    (req.ip && String(req.ip)) ||
    (req.connection && req.connection.remoteAddress) ||
    'unknown'
  );
}

function createInMemoryRateLimiter(options) {
  const windowMs = parsePositiveInt(options && options.windowMs, 15 * 60 * 1000);
  const max = parsePositiveInt(options && options.max, 10);
  const keyFn = options && typeof options.keyFn === 'function' ? options.keyFn : null;
  const message = (options && options.message) || 'Too many requests';

  const buckets = new Map();

  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of buckets.entries()) {
      if (!entry || (now - entry.windowStart) > windowMs * 2) {
        buckets.delete(key);
      }
    }
  };

  const middleware = (req, res, next) => {
    cleanup();

    const ip = getClientIp(req);
    const key = keyFn ? String(keyFn(req, ip)) : String(ip);
    const now = Date.now();

    const existing = buckets.get(key);
    if (!existing || (now - existing.windowStart) >= windowMs) {
      buckets.set(key, { windowStart: now, count: 1 });
      req.rateLimitKey = key;
      req.rateLimitWindowMs = windowMs;
      req.rateLimitMax = max;
      return next();
    }

    existing.count += 1;
    if (existing.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - existing.windowStart)) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return sendError(res, 429, message, {
        retryAfterSeconds,
        limit: max,
        windowMs,
      });
    }

    req.rateLimitKey = key;
    req.rateLimitWindowMs = windowMs;
    req.rateLimitMax = max;
    return next();
  };

  middleware.resetKey = (key) => {
    if (!key) return;
    buckets.delete(String(key));
  };

  return middleware;
}

module.exports = {
  createInMemoryRateLimiter,
};
