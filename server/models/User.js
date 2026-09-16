const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Please add a name'], trim: true },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: [true, 'Please add a password'], minlength: 6, select: true },

    // --- Forgot password ---
    // We never store the raw reset token (it goes out in the email link
    // only) - only its SHA-256 hash, so a database leak alone can't be used
    // to reset anyone's password. resetPasswordExpire enforces a short
    // window (see authController.forgotPassword) after which the token is
    // simply ignored even if someone still has the link.
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },
  },
  { timestamps: true }
);

// Hash the password automatically whenever it's set/changed - controllers
// never have to remember to hash it themselves.
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);