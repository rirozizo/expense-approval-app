
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Configuration ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(__dirname, 'db.json');

// --- Create uploads directory if it doesn't exist ---
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// --- Initialize DB file if it doesn't exist ---
const initialDbState = {
  settings: { submitterEmail: "", approverEmail: "" },
  expenses: []
};
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify(initialDbState, null, 2), 'utf8');
}

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR)); // Serve uploaded files

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

// --- Helper Functions for DB ---
const readDb = () => {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading DB:", error);
    return { ...initialDbState }; // Return default if error
  }
};

const writeDb = (data) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error("Error writing to DB:", error);
  }
};

// --- Mock Email Service ---
const sendEmailMock = (to, subject, body) => {
  console.log(`\nSERVER SENDING EMAIL (MOCK):`);
  console.log(`  To: ${to}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Body:\n    ${body.replace(/\n/g, '\n    ')}`);
  console.log(`  --------------------\n`);
};


// --- API Endpoints ---

// POST /api/login
app.post('/api/login', (req, res) => {
  const { usernameOrEmail, password } = req.body;
  const db = readDb();
  const { settings } = db;

  if (!usernameOrEmail || !password) {
    return res.status(400).json({ message: 'Username/Email and password are required.' });
  }

  if (usernameOrEmail.toLowerCase() === 'admin' && password === 'admin') {
    return res.json({ user: { id: 'admin-user', username: 'admin', role: 'ADMIN' } });
  }
  
  if (settings.submitterEmail && usernameOrEmail === settings.submitterEmail && password === settings.submitterEmail) {
    return res.json({ user: { id: `submitter-${usernameOrEmail}`, username: usernameOrEmail, email: usernameOrEmail, role: 'SUBMITTER' } });
  }

  if (settings.approverEmail && usernameOrEmail === settings.approverEmail && password === settings.approverEmail) {
    return res.json({ user: { id: `approver-${usernameOrEmail}`, username: usernameOrEmail, email: usernameOrEmail, role: 'APPROVER' } });
  }

  return res.status(401).json({ message: 'Invalid credentials or user not configured.' });
});

// GET /api/settings
app.get('/api/settings', (req, res) => {
  const db = readDb();
  res.json({ settings: db.settings });
});

// POST /api/settings
app.post('/api/settings', (req, res) => {
  const { submitterEmail, approverEmail } = req.body;
   if (typeof submitterEmail !== 'string' || typeof approverEmail !== 'string') {
    return res.status(400).json({ message: 'Invalid email format for settings.' });
  }
  if (submitterEmail === approverEmail && submitterEmail !== '') {
    return res.status(400).json({ message: 'Submitter and Approver emails cannot be the same.' });
  }
  const db = readDb();
  db.settings = { submitterEmail, approverEmail };
  writeDb(db);
  res.json({ settings: db.settings });
});

// GET /api/expenses
app.get('/api/expenses', (req, res) => {
  const db = readDb();
  res.json({ expenses: db.expenses || [] });
});

// POST /api/expenses
app.post('/api/expenses', upload.single('attachmentFile'), (req, res) => {
  try {
    const { name, amount, currency, category, submitterEmail } = req.body;
    
    if (!name || !amount || !currency || !category || !submitterEmail) {
        return res.status(400).json({ message: "Missing required expense fields." });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "Invalid amount." });
    }

    const db = readDb();
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
        filename: req.file.filename, // Name of the file on the server (e.g., attachmentFile-16298....png)
        mimetype: req.file.mimetype,
        path: `uploads/${req.file.filename}`, // URL-friendly path (e.g., uploads/attachmentFile-16298....png)
        originalFilename: req.file.originalname,
      };
    }

    db.expenses.push(newExpense);
    writeDb(db);

    // Email notification to Approver
    if (db.settings.approverEmail) {
      sendEmailMock(
        db.settings.approverEmail,
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
app.put('/api/expenses/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, userRole } = req.body; // userRole for authorization check

  if (!status || !userRole) {
    return res.status(400).json({ message: "Status and user role are required." });
  }

  // Allow ADMIN to bypass some role checks if needed, but for now, main role is Approver
  if (userRole !== 'APPROVER' && userRole !== 'ADMIN') {
    return res.status(403).json({ message: 'Unauthorized to update expense status.' });
  }

  const validStatuses = ['APPROVED', 'DECLINED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid expense status.' });
  }

  const db = readDb();
  const expenseIndex = db.expenses.findIndex(exp => exp.id === id);

  if (expenseIndex === -1) {
    return res.status(404).json({ message: 'Expense not found.' });
  }
  
  // Approvers can only act on PENDING expenses. Admins might have more leeway (not implemented here).
  if (db.expenses[expenseIndex].status !== 'PENDING' && userRole === 'APPROVER') {
    return res.status(403).json({ message: 'Expense is not pending approval.' });
  }


  db.expenses[expenseIndex].status = status;
  db.expenses[expenseIndex].approvedOrDeclinedAt = new Date().toISOString();
  writeDb(db);

  const updatedExpense = db.expenses[expenseIndex];

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
});


// --- Global Error Handler (optional basic) ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:\${PORT}`);
  console.log(`Uploads directory: \${UPLOADS_DIR}`);
  console.log(`Database file: \${DB_FILE}`);
});
