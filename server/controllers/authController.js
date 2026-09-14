const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { processDueRecurring } = require('../utils/recurring');

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

module.exports = { registerUser, loginUser, getMe, updateMe };