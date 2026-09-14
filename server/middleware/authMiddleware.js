const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

/** Verifies the "Bearer <token>" header and attaches the matching user to req.user. */
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401);
    throw new Error('Not authorized - no token provided.');
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      res.status(401);
      throw new Error('Not authorized - user no longer exists.');
    }
    next();
  } catch (err) {
    res.status(401);
    throw new Error('Not authorized - invalid or expired token.');
  }
});

module.exports = { protect };