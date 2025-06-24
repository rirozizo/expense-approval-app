
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('./database.cjs');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Configuration ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// --- Create uploads directory if it doesn't exist ---
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// --- Initialize Database ---
const database = new Database();
let dbInitialized = false;

async function initializeDatabase() {
  try {
    await database.init();
    dbInitialized = true;
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR)); // Serve uploaded files

// --- Serve static files from dist directory (for production) ---
app.use(express.static(path.join(__dirname, 'dist')));

// --- Serve index.html for all non-API routes (SPA support) ---
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }

  // For development, redirect to Vite dev server
  if (process.env.NODE_ENV !== 'production') {
    return res.redirect('http://localhost:5173');
  }

  // For production, serve index.html
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- Multer Setup (for file uploads) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Generate unique filename to prevent overwrites and keep original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// --- Mock Email Service ---
const sendEmailMock = (to, subject, body) => {
  console.log(`\nSERVER SENDING EMAIL (MOCK):`);
  console.log(`  To: ${to}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Body:\n    ${body.replace(/\n/g, '\n    ')}`);
  console.log(`  --------------------\n`);
};

// --- Middleware to check database initialization ---
const checkDbInitialized = (req, res, next) => {
  if (!dbInitialized) {
    return res.status(503).json({ message: 'Database not initialized' });
  }
  next();
};

// --- API Endpoints ---

// POST /api/login
app.post('/api/login', checkDbInitialized, async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({ message: 'Username/Email and password are required.' });
    }

    if (usernameOrEmail.toLowerCase() === 'admin' && password === 'admin') {
      return res.json({ user: { id: 'admin-user', username: 'admin', role: 'ADMIN' } });
    }

    const settings = await database.getSettings();

    if (settings.submitterEmail && usernameOrEmail === settings.submitterEmail && password === settings.submitterEmail) {
      return res.json({ user: { id: `submitter-${usernameOrEmail}`, username: usernameOrEmail, email: usernameOrEmail, role: 'SUBMITTER' } });
    }

    if (settings.approverEmail && usernameOrEmail === settings.approverEmail && password === settings.approverEmail) {
      return res.json({ user: { id: `approver-${usernameOrEmail}`, username: usernameOrEmail, email: usernameOrEmail, role: 'APPROVER' } });
    }

    return res.status(401).json({ message: 'Invalid credentials or user not configured.' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/settings
app.get('/api/settings', checkDbInitialized, async (req, res) => {
  try {
    const settings = await database.getSettings();
    res.json({ settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
});

// POST /api/settings
app.post('/api/settings', checkDbInitialized, async (req, res) => {
  try {
    const { submitterEmail, approverEmail } = req.body;
    
    if (typeof submitterEmail !== 'string' || typeof approverEmail !== 'string') {
      return res.status(400).json({ message: 'Invalid email format for settings.' });
    }
    
    if (submitterEmail === approverEmail && submitterEmail !== '') {
      return res.status(400).json({ message: 'Submitter and Approver emails cannot be the same.' });
    }
    
    const settings = await database.saveSettings(submitterEmail, approverEmail);
    res.json({ settings });
  } catch (error) {
    console.error('Save settings error:', error);
    res.status(500).json({ message: 'Failed to save settings' });
  }
});

// GET /api/expenses
app.get('/api/expenses', checkDbInitialized, async (req, res) => {
  try {
    const expenses = await database.getExpenses();
    res.json({ expenses });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ message: 'Failed to fetch expenses' });
  }
});

// POST /api/expenses
app.post('/api/expenses', checkDbInitialized, upload.single('attachmentFile'), async (req, res) => {
  try {
    const { name, amount, currency, category, submitterEmail } = req.body;

    if (!name || !amount || !currency || !category || !submitterEmail) {
      return res.status(400).json({ message: "Missing required expense fields." });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: "Invalid amount." });
    }

    const newExpense = {
      id: `exp-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      name,
      amount: parsedAmount,
      currency,
      category,
      submitterEmail,
      status: 'PENDING',
      submittedAt: new Date().toISOString(),
      attachment: undefined,
    };

    if (req.file) {
      newExpense.attachment = {
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        path: `uploads/${req.file.filename}`,
        originalFilename: req.file.originalname,
      };
    }

    await database.addExpense(newExpense);

    // Email notification to Approver
    const settings = await database.getSettings();
    if (settings.approverEmail) {
      sendEmailMock(
        settings.approverEmail,
        "New Expense Submitted for Your Approval",
        `A new expense has been submitted by ${newExpense.submitterEmail}:
        Name: ${newExpense.name}
        Amount: ${newExpense.currency} ${newExpense.amount.toFixed(2)}
        Category: ${newExpense.category}
        Please log in to review.`
      );
    }
    
    res.status(201).json({ expense: newExpense });
  } catch (error) {
    console.error("Error adding expense:", error);
    res.status(500).json({ message: "Failed to add expense." });
  }
});

// PUT /api/expenses/:id/status
app.put('/api/expenses/:id/status', checkDbInitialized, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, userRole } = req.body;

    if (!status || !userRole) {
      return res.status(400).json({ message: "Status and user role are required." });
    }

    if (userRole !== 'APPROVER' && userRole !== 'ADMIN') {
      return res.status(403).json({ message: 'Unauthorized to update expense status.' });
    }

    const validStatuses = ['APPROVED', 'DECLINED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid expense status.' });
    }

    const expense = await database.getExpenseById(id);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found.' });
    }

    if (expense.status !== 'PENDING' && userRole === 'APPROVER') {
      return res.status(403).json({ message: 'Expense is not pending approval.' });
    }

    const approvedOrDeclinedAt = new Date().toISOString();
    await database.updateExpenseStatus(id, status, approvedOrDeclinedAt);

    const updatedExpense = await database.getExpenseById(id);

    // Email notification to Submitter
    const emailSubject = status === 'APPROVED' 
      ? "Your Expense Has Been Approved" 
      : "Your Expense Has Been Declined";
    const emailBody = `Your expense submission has been ${status.toLowerCase()}:
      Name: ${updatedExpense.name}
      Amount: ${updatedExpense.currency} ${updatedExpense.amount.toFixed(2)}
      Status: ${status}`;

    sendEmailMock(updatedExpense.submitterEmail, emailSubject, emailBody);

    res.json({ expense: updatedExpense });
  } catch (error) {
    console.error("Error updating expense status:", error);
    res.status(500).json({ message: "Failed to update expense status." });
  }
});

// --- Global Error Handler (optional basic) ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// --- Start Server ---
async function startServer() {
  await initializeDatabase();
  
  // Run migration if db.json exists
  try {
    const migrate = require('./migrate.cjs');
    await migrate();
  } catch (error) {
    console.log('Migration skipped or completed previously');
  }
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
    console.log(`Uploads directory: ${UPLOADS_DIR}`);
    console.log(`Database: SQLite (expense_app.db)`);
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nGracefully shutting down...');
  database.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nGracefully shutting down...');
  database.close();
  process.exit(0);
});

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
