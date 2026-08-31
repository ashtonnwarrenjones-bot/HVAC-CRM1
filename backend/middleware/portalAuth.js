const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'hvac-crm-secret-2024';

module.exports = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Portal authentication required' });
  }
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'portal') {
      return res.status(403).json({ error: 'Not a portal token' });
    }
    req.portal = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired portal session. Please request a new link.' });
  }
};
