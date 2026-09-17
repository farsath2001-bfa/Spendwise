require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const authRoutes = require('./routes/authRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const savingsGoalRoutes = require('./routes/savingsGoalRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const aiRoutes = require('./routes/aiRoutes');

connectDB();

const app = express();

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5174')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, '')) // tolerate a trailing slash in the env var
  .filter(Boolean);

// Logged once at boot so a CORS rejection is easy to diagnose from the
// Render logs - "is CLIENT_URL even set to what I think it is?" is the
// first thing to check when the browser reports a blocked preflight.
console.log('CORS allowed origins:', allowedOrigins);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // No Origin header - same-origin requests, curl, Render's own health
      // checks, server-to-server calls - always allowed through.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin.replace(/\/$/, ''))) {
        return callback(null, true);
      }
      console.warn(`CORS: rejected origin "${origin}" - not in CLIENT_URL (${allowedOrigins.join(', ')})`);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/goals', savingsGoalRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`SpendWise AI API running on port ${PORT}`);
});