const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'hvac-crm-secret-2024';

module.exports = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No portal token provided' });
  }
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'portal') {
      return res.status(403).json({ error: 'Invalid portal token' });
    }
    req.portal = decoded; // { type:'portal', company_id, contact_id, contact_name }
    next();
  } catch {
    res.status(401).json({ error: 'Portal session expired. Please use your invitation link again.' });
  }
};
