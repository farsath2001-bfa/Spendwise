const jwt = require('jsonwebtoken');

/** Signs a JWT identifying this user, valid for 30 days. */
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

module.exports = generateToken;