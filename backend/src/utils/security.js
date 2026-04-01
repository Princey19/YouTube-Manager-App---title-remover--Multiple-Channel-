export function applySecurityMiddleware(app) {
  // Basic IP restriction (optional). If ALLOWED_IPS is not set, allow all.
  const allowedIpsEnv = process.env.ALLOWED_IPS;
  const allowedIps = allowedIpsEnv
    ? allowedIpsEnv.split(',').map((ip) => ip.trim()).filter(Boolean)
    : null;

  if (allowedIps && allowedIps.length > 0) {
    app.use((req, res, next) => {
      const ip =
        req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
        req.socket.remoteAddress ||
        '';

      if (!allowedIps.some((allowed) => ip.includes(allowed))) {
        return res.status(403).json({ error: 'Access denied from this IP' });
      }
      next();
    });
  }

  // Additional security headers can be added here if needed.
}

