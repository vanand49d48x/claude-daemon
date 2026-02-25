export function authMiddleware(authToken) {
  return (req, res, next) => {
    // Skip auth for static CSS/JS assets
    if (req.path.match(/\.(css|js|ico|png|svg)$/)) return next();

    // 1. Check Authorization header (API clients)
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (token === authToken) return next();
      return res.status(401).json({ error: 'Invalid token' });
    }

    // 2. Check query parameter (browser first visit)
    if (req.query.token === authToken) {
      // Set cookie so token isn't needed in every URL
      res.cookie('daemon_token', authToken, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
      return next();
    }

    // 3. Check cookie (subsequent browser visits)
    if (req.cookies?.daemon_token === authToken) return next();

    // No valid auth found
    res.status(401).json({ error: 'Unauthorized. Provide Bearer token or ?token= parameter.' });
  };
}
