import express from 'express';
import calendarHandler from './api/calendar.js';
import typesHandler from './api/types.js';

// Ensure global fetch is available (for Node versions without fetch)
if (typeof globalThis.fetch !== 'function') {
  const { fetch: undiciFetch } = await import('undici');
  globalThis.fetch = undiciFetch;
}

const app = express();

// API routes
app.get(['/api/calendar', '/calendar'], async (req, res) => {
  try {
    await calendarHandler(req, res);
  } catch (error) {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/types', async (req, res) => {
  try {
    await typesHandler(req, res);
  } catch (error) {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Static frontend
app.use(express.static('public'));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Local server listening at http://localhost:${port}`);
  console.log(`- Calendar: http://localhost:${port}/api/calendar`);
  console.log(`- Types:    http://localhost:${port}/api/types`);
});
