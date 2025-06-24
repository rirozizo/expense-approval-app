
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

    // Normalize input to avoid case or whitespace issues
    const normalizedUser = (usernameOrEmail || '').trim().toLowerCase();
    const normalizedPass = (password || '').trim();

    if (!normalizedUser || !normalizedPass) {
      return res.status(400).json({ message: 'Username/Email and password are required.' });
    }

    if (normalizedUser === 'admin' && normalizedPass === 'admin') {
      return res.json({ user: { id: 'admin-user', username: 'admin', role: 'ADMIN' } });
    }

    // Check new users table first
    const user = await database.getUserByEmail(normalizedUser);
    if (user && normalizedPass === normalizedUser) {
      return res.json({ user: { id: user.id, username: normalizedUser, email: normalizedUser, role: user.role } });
    }

    // Fallback to legacy settings for backward compatibility
    const settings = await database.getSettings();

    if (settings.submitterEmail && normalizedUser === settings.submitterEmail.toLowerCase() && normalizedPass === settings.submitterEmail.toLowerCase()) {
      return res.json({ user: { id: `submitter-${normalizedUser}`, username: normalizedUser, email: normalizedUser, role: 'SUBMITTER' } });
    }

    if (settings.approverEmail && normalizedUser === settings.approverEmail.toLowerCase() && normalizedPass === settings.approverEmail.toLowerCase()) {
      return res.json({ user: { id: `approver-${normalizedUser}`, username: normalizedUser, email: normalizedUser, role: 'APPROVER' } });
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
    const { name, amount, currency, department, submitterEmail } = req.body;

    if (!name || !amount || !currency || !department || !submitterEmail) {
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
      department,
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

    const savedExpense = await database.addExpense(newExpense);

    // Email notification to first level approvers
    const firstLevelApprovals = savedExpense.approvals.filter(approval => approval.level === 1);
    for (const approval of firstLevelApprovals) {
      sendEmailMock(
        approval.approverEmail,
        "New Expense Submitted for Your Approval",
        `A new expense has been submitted by ${savedExpense.submitterEmail}:
        Name: ${savedExpense.name}
        Amount: ${savedExpense.currency} ${savedExpense.amount.toFixed(2)}
        Department: ${savedExpense.department}
        Approval Level: ${approval.level}
        Please log in to review.`
      );
    }
    
    res.status(201).json({ expense: savedExpense });
  } catch (error) {
    console.error("Error adding expense:", error);
    res.status(500).json({ message: "Failed to add expense." });
  }
});

// GET /api/users
app.get('/api/users', checkDbInitialized, async (req, res) => {
  try {
    const users = await database.getUsers();
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// POST /api/users
app.post('/api/users', checkDbInitialized, async (req, res) => {
  try {
    const { email, role } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();
    
    if (!email || !role) {
      return res.status(400).json({ message: 'Email and role are required.' });
    }
    
    if (!['SUBMITTER', 'APPROVER'].includes(role)) {
      return res.status(400).json({ message: 'Role must be SUBMITTER or APPROVER.' });
    }
    
    const existingUser = await database.getUserByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }
    
    const newUser = {
      id: `user-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      email: normalizedEmail,
      role,
      createdAt: new Date().toISOString()
    };
    
    await database.addUser(newUser);
    res.status(201).json({ user: newUser });
  } catch (error) {
    console.error('Add user error:', error);
    res.status(500).json({ message: 'Failed to add user' });
  }
});

// PUT /api/users/:id
app.put('/api/users/:id', checkDbInitialized, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!role) {
      return res.status(400).json({ message: 'Role is required.' });
    }
    
    if (!['SUBMITTER', 'APPROVER'].includes(role)) {
      return res.status(400).json({ message: 'Role must be SUBMITTER or APPROVER.' });
    }
    
    await database.updateUser(id, role);
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    if (error.message === 'User not found') {
      res.status(404).json({ message: 'User not found' });
    } else {
      res.status(500).json({ message: 'Failed to update user' });
    }
  }
});

// DELETE /api/users/:id
app.delete('/api/users/:id', checkDbInitialized, async (req, res) => {
  try {
    const { id } = req.params;
    await database.deleteUser(id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    if (error.message === 'User not found') {
      res.status(404).json({ message: 'User not found' });
    } else {
      res.status(500).json({ message: 'Failed to delete user' });
    }
  }
});

// PUT /api/expenses/:id/approve
app.put('/api/expenses/:id/approve', checkDbInitialized, async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail, userRole } = req.body;

    if (!userEmail || !userRole) {
      return res.status(400).json({ message: "User email and role are required." });
    }

    if (userRole !== 'APPROVER' && userRole !== 'ADMIN') {
      return res.status(403).json({ message: 'Unauthorized to approve expense.' });
    }

    const expense = await database.getExpenseById(id);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found.' });
    }

    if (expense.status !== 'PENDING') {
      return res.status(403).json({ message: 'Expense is not pending approval.' });
    }

    // Find the pending approval for this user at current level
    const currentLevelApproval = expense.approvals.find(
      approval => approval.level === expense.currentApprovalLevel && 
                  approval.approverEmail === userEmail && 
                  approval.status === 'PENDING'
    );

    if (!currentLevelApproval) {
      return res.status(403).json({ message: 'You are not authorized to approve this expense at this level.' });
    }

    // Update the approval record
    await database.updateApprovalRecord(id, expense.currentApprovalLevel, userEmail, 'APPROVED');

    // Check if all approvals at current level are complete
    const currentLevelApprovals = expense.approvals.filter(approval => approval.level === expense.currentApprovalLevel);
    const completedApprovals = currentLevelApprovals.filter(approval => 
      approval.approverEmail === userEmail || approval.status === 'APPROVED'
    );

    if (completedApprovals.length === currentLevelApprovals.length) {
      // Move to next level or mark as approved
      if (expense.currentApprovalLevel < expense.maxApprovalLevel) {
        // Move to next level
        const nextLevel = expense.currentApprovalLevel + 1;
        await database.updateExpenseStatus(id, 'PENDING', null, nextLevel);
        
        // Notify next level approvers
        const nextLevelApprovals = expense.approvals.filter(approval => approval.level === nextLevel);
        for (const approval of nextLevelApprovals) {
          sendEmailMock(
            approval.approverEmail,
            "Expense Approval Required",
            `An expense requires your approval (Level ${nextLevel}):
            Name: ${expense.name}
            Amount: ${expense.currency} ${expense.amount.toFixed(2)}
            Department: ${expense.department}
            Submitter: ${expense.submitterEmail}
            Please log in to review.`
          );
        }
      } else {
        // Final approval
        const approvedAt = new Date().toISOString();
        await database.updateExpenseStatus(id, 'APPROVED', approvedAt);
        
        // Notify submitter
        sendEmailMock(
          expense.submitterEmail,
          "Your Expense Has Been Approved",
          `Your expense submission has been fully approved:
          Name: ${expense.name}
          Amount: ${expense.currency} ${expense.amount.toFixed(2)}
          Department: ${expense.department}`
        );
      }
    }

    const updatedExpense = await database.getExpenseById(id);
    res.json({ expense: updatedExpense });
  } catch (error) {
    console.error("Error approving expense:", error);
    res.status(500).json({ message: "Failed to approve expense." });
  }
});

// PUT /api/expenses/:id/decline
app.put('/api/expenses/:id/decline', checkDbInitialized, async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail, userRole } = req.body;

    if (!userEmail || !userRole) {
      return res.status(400).json({ message: "User email and role are required." });
    }

    if (userRole !== 'APPROVER' && userRole !== 'ADMIN') {
      return res.status(403).json({ message: 'Unauthorized to decline expense.' });
    }

    const expense = await database.getExpenseById(id);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found.' });
    }

    if (expense.status !== 'PENDING') {
      return res.status(403).json({ message: 'Expense is not pending approval.' });
    }

    // Find the pending approval for this user at current level
    const currentLevelApproval = expense.approvals.find(
      approval => approval.level === expense.currentApprovalLevel && 
                  approval.approverEmail === userEmail && 
                  approval.status === 'PENDING'
    );

    if (!currentLevelApproval) {
      return res.status(403).json({ message: 'You are not authorized to decline this expense at this level.' });
    }

    // Update the approval record and expense status
    await database.updateApprovalRecord(id, expense.currentApprovalLevel, userEmail, 'DECLINED');
    const declinedAt = new Date().toISOString();
    await database.updateExpenseStatus(id, 'DECLINED', declinedAt);

    // Notify submitter
    sendEmailMock(
      expense.submitterEmail,
      "Your Expense Has Been Declined",
      `Your expense submission has been declined:
      Name: ${expense.name}
      Amount: ${expense.currency} ${expense.amount.toFixed(2)}
      Department: ${expense.department}
      Declined by: ${userEmail}`
    );

    const updatedExpense = await database.getExpenseById(id);
    res.json({ expense: updatedExpense });
  } catch (error) {
    console.error("Error declining expense:", error);
    res.status(500).json({ message: "Failed to decline expense." });
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
  
  // Run workflow migration
  try {
    const migrateWorkflow = require('./migrate-workflow.cjs');
    await migrateWorkflow();
  } catch (error) {
    console.log('Workflow migration skipped or completed previously');
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
