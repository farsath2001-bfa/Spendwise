const nodemailer = require('nodemailer');

// Gmail SMTP via an "App Password" (not your real Gmail password - see
// .env.example for how to generate one). Free, works for sending to any
// recipient, and needs no domain of your own - a good fit for a project
// that doesn't have a custom domain yet.
const getTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    throw new Error('EMAIL_USER / EMAIL_APP_PASSWORD is not set.');
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
};

/** Sends the "click here to reset your password" email. `resetUrl` already points at the frontend's reset page with the raw token in it. */
const sendPasswordResetEmail = async (to, resetUrl) => {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: `"SpendWise AI" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Reset your SpendWise AI password',
    text: `We received a request to reset your SpendWise AI password. Open this link to choose a new one (it expires in 30 minutes):\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
        <h2 style="color: #059669;">Reset your password</h2>
        <p>We received a request to reset your SpendWise AI password. This link expires in 30 minutes.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background: #059669; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Reset password
          </a>
        </p>
        <p style="color: #64748b; font-size: 13px;">
          If you didn't request this, you can safely ignore this email - your password won't change.
        </p>
      </div>
    `,
  });
};

module.exports = { sendPasswordResetEmail };