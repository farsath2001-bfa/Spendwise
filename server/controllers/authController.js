const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { sendPasswordResetEmail } = require('../utils/emailClient');
const { processDueRecurring } = require('../utils/recurring');

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** SHA-256 hash of a raw token - what we actually store/compare against, never the raw value. */
const hashToken = (rawToken) => crypto.createHash('sha256').update(rawToken).digest('hex');

const shapeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
});

/** POST /api/auth/register */
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Name, email, and password are all required.');
  }
  if (password.length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters.');
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    res.status(400);
    throw new Error('An account with that email already exists.');
  }

  const user = await User.create({ name: name.trim(), email, password });

  res.status(201).json({ ...shapeUser(user), token: generateToken(user._id) });
});

/** POST /api/auth/login */
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Email and password are required.');
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password.');
  }

  res.json({ ...shapeUser(user), token: generateToken(user._id) });
});

/**
 * GET /api/auth/me - requires the `protect` middleware to have run first.
 * The frontend calls this once on every app load (see AuthContext), before
 * any page renders - the perfect single choke point to materialize any
 * recurring transactions the user is now owed, so Dashboard/Budget/Analytics
 * all see fresh data even if the user never visits the Transactions page.
 */
const getMe = asyncHandler(async (req, res) => {
  await processDueRecurring(req.user._id);
  res.json(shapeUser(req.user));
});

/** PUT /api/auth/me */
const updateMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error('User not found.');
  }

  if (req.body.name !== undefined) user.name = req.body.name.trim();

  if (req.body.email !== undefined && req.body.email.toLowerCase().trim() !== user.email) {
    const emailTaken = await User.findOne({ email: req.body.email.toLowerCase().trim() });
    if (emailTaken) {
      res.status(400);
      throw new Error('That email is already in use.');
    }
    user.email = req.body.email.toLowerCase().trim();
  }

  if (req.body.password) {
    if (req.body.password.length < 6) {
      res.status(400);
      throw new Error('Password must be at least 6 characters.');
    }
    user.password = req.body.password; // pre-save hook re-hashes it
  }

  const updated = await user.save();
  res.json(shapeUser(updated));
});

/**
 * POST /api/auth/forgot-password
 * Always responds with the same generic message whether or not the email
 * belongs to an account - otherwise this endpoint could be used to check
 * which emails are registered. Only when an account actually matches do we
 * generate a token, save its hash, and try to send the email.
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400);
    throw new Error('Email is required.');
  }

  const genericMessage = "If an account exists for that email, we've sent a password reset link.";

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    res.json({ message: genericMessage });
    return;
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = hashToken(rawToken);
  user.resetPasswordExpire = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save();

  // CLIENT_URL may be a comma-separated list (see server.js's CORS setup) -
  // the first entry is always the app's own real frontend URL.
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5174').split(',')[0].trim();
  const resetUrl = `${clientUrl}/reset-password/${rawToken}`;

  try {
    await sendPasswordResetEmail(user.email, resetUrl);
  } catch (err) {
    // Don't leave a live, unusable token sitting on the account if the
    // email never actually went out.
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    console.error('Failed to send password reset email:', err.message);
    res.status(500);
    throw new Error('Could not send the reset email right now. Please try again shortly.');
  }

  res.json({ message: genericMessage });
});

/** POST /api/auth/reset-password/:token */
const resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters.');
  }

  const hashed = hashToken(req.params.token);
  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpire: { $gt: new Date() },
  }).select('+resetPasswordToken +resetPasswordExpire');

  if (!user) {
    res.status(400);
    throw new Error('This reset link is invalid or has expired. Please request a new one.');
  }

  user.password = password; // pre-save hook re-hashes it
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  // Log them straight in, same shape as register/login - one less step
  // after they've just proven ownership of the account via email.
  res.json({ ...shapeUser(user), token: generateToken(user._id) });
});

module.exports = { registerUser, loginUser, getMe, updateMe, forgotPassword, resetPassword };