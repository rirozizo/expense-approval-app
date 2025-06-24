
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'expense_app.db');

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      const createSettingsTable = `
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          submitter_email TEXT NOT NULL,
          approver_email TEXT NOT NULL
        )
      `;

      const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('SUBMITTER', 'APPROVER')),
          created_at TEXT NOT NULL
        )
      `;

      const createExpensesTable = `
        CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          amount REAL NOT NULL,
          currency TEXT NOT NULL,
          department TEXT NOT NULL,
          submitter_email TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          submitted_at TEXT NOT NULL,
          approved_or_declined_at TEXT,
          current_approval_level INTEGER DEFAULT 1,
          max_approval_level INTEGER DEFAULT 1,
          attachment_filename TEXT,
          attachment_mimetype TEXT,
          attachment_path TEXT,
          attachment_original_filename TEXT
        )
      `;

      const createApprovalRulesTable = `
        CREATE TABLE IF NOT EXISTS approval_rules (
          id TEXT PRIMARY KEY,
          department TEXT NOT NULL,
          amount_min REAL NOT NULL,
          amount_max REAL NOT NULL,
          currency TEXT NOT NULL,
          level INTEGER NOT NULL,
          recipient TEXT NOT NULL
        )
      `;

      const createApprovalsTable = `
        CREATE TABLE IF NOT EXISTS approvals (
          id TEXT PRIMARY KEY,
          expense_id TEXT NOT NULL,
          level INTEGER NOT NULL,
          approver_email TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          approved_at TEXT,
          FOREIGN KEY (expense_id) REFERENCES expenses (id)
        )
      `;

      this.db.serialize(() => {
        this.db.run(createSettingsTable, (err) => {
          if (err) {
            console.error('Error creating settings table:', err);
            reject(err);
            return;
          }
        });

        this.db.run(createUsersTable, (err) => {
          if (err) {
            console.error('Error creating users table:', err);
            reject(err);
            return;
          }
        });

        this.db.run(createExpensesTable, (err) => {
          if (err) {
            console.error('Error creating expenses table:', err);
            reject(err);
            return;
          }
        });

        this.db.run(createApprovalRulesTable, (err) => {
          if (err) {
            console.error('Error creating approval rules table:', err);
            reject(err);
            return;
          }
        });

        this.db.run(createApprovalsTable, (err) => {
          if (err) {
            console.error('Error creating approvals table:', err);
            reject(err);
            return;
          }
          
          // Insert default settings if none exist
          this.db.get('SELECT COUNT(*) as count FROM settings', (err, row) => {
            if (err) {
              console.error('Error checking settings:', err);
              reject(err);
              return;
            }
            
            if (row.count === 0) {
              this.db.run(
                'INSERT INTO settings (submitter_email, approver_email) VALUES (?, ?)',
                ['', ''],
                (err) => {
                  if (err) {
                    console.error('Error inserting default settings:', err);
                    reject(err);
                  } else {
                    this.initializeApprovalRulesAndUsers().then(() => {
                      console.log('Database tables created successfully');
                      resolve();
                    }).catch(reject);
                  }
                }
              );
            } else {
              this.initializeApprovalRulesAndUsers().then(() => {
                console.log('Database tables created successfully');
                resolve();
              }).catch(reject);
            }
          });
        });
      });
    });
  }

  // Settings methods
  async getSettings() {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM settings ORDER BY id DESC LIMIT 1', (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? {
            submitterEmail: row.submitter_email,
            approverEmail: row.approver_email
          } : { submitterEmail: '', approverEmail: '' });
        }
      });
    });
  }

  async saveSettings(submitterEmail, approverEmail) {
    return new Promise((resolve, reject) => {
      // Delete existing settings and insert new ones
      this.db.serialize(() => {
        this.db.run('DELETE FROM settings', (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          this.db.run(
            'INSERT INTO settings (submitter_email, approver_email) VALUES (?, ?)',
            [submitterEmail, approverEmail],
            function(err) {
              if (err) {
                reject(err);
              } else {
                resolve({ submitterEmail, approverEmail });
              }
            }
          );
        });
      });
    });
  }

  // Expense methods
  async getExpenses() {
    return new Promise(async (resolve, reject) => {
      this.db.all('SELECT * FROM expenses ORDER BY submitted_at DESC', async (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const expenses = [];
          for (const row of rows) {
            const approvals = await this.getApprovalRecords(row.id);
            expenses.push({
              id: row.id,
              name: row.name,
              amount: row.amount,
              currency: row.currency,
              department: row.department,
              submitterEmail: row.submitter_email,
              status: row.status,
              submittedAt: row.submitted_at,
              approvedOrDeclinedAt: row.approved_or_declined_at,
              currentApprovalLevel: row.current_approval_level,
              maxApprovalLevel: row.max_approval_level,
              approvals: approvals,
              attachment: row.attachment_filename ? {
                filename: row.attachment_filename,
                mimetype: row.attachment_mimetype,
                path: row.attachment_path,
                originalFilename: row.attachment_original_filename
              } : undefined
            });
          }
          resolve(expenses);
        }
      });
    });
  }

  async getExpensesForSubmitter(email) {
    return new Promise(async (resolve, reject) => {
      this.db.all(
        'SELECT * FROM expenses WHERE submitter_email = ? ORDER BY submitted_at DESC',
        [email],
        async (err, rows) => {
          if (err) {
            reject(err);
          } else {
            const expenses = [];
            for (const row of rows) {
              const approvals = await this.getApprovalRecords(row.id);
              expenses.push({
                id: row.id,
                name: row.name,
                amount: row.amount,
                currency: row.currency,
                department: row.department,
                submitterEmail: row.submitter_email,
                status: row.status,
                submittedAt: row.submitted_at,
                approvedOrDeclinedAt: row.approved_or_declined_at,
                currentApprovalLevel: row.current_approval_level,
                maxApprovalLevel: row.max_approval_level,
                approvals: approvals,
                attachment: row.attachment_filename ? {
                  filename: row.attachment_filename,
                  mimetype: row.attachment_mimetype,
                  path: row.attachment_path,
                  originalFilename: row.attachment_original_filename
                } : undefined
              });
            }
            resolve(expenses);
          }
        }
      );
    });
  }

  async getExpensesForApprover(email) {
    return new Promise(async (resolve, reject) => {
      const query = `
        SELECT DISTINCT e.*
        FROM expenses e
        JOIN approvals a ON e.id = a.expense_id
        WHERE a.approver_email = ?
          AND a.status = 'PENDING'
          AND a.level = e.current_approval_level
          AND e.status = 'PENDING'
        ORDER BY e.submitted_at DESC
      `;

      this.db.all(query, [email], async (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const expenses = [];
          for (const row of rows) {
            const approvals = await this.getApprovalRecords(row.id);
            expenses.push({
              id: row.id,
              name: row.name,
              amount: row.amount,
              currency: row.currency,
              department: row.department,
              submitterEmail: row.submitter_email,
              status: row.status,
              submittedAt: row.submitted_at,
              approvedOrDeclinedAt: row.approved_or_declined_at,
              currentApprovalLevel: row.current_approval_level,
              maxApprovalLevel: row.max_approval_level,
              approvals: approvals,
              attachment: row.attachment_filename ? {
                filename: row.attachment_filename,
                mimetype: row.attachment_mimetype,
                path: row.attachment_path,
                originalFilename: row.attachment_original_filename
              } : undefined
            });
          }
          resolve(expenses);
        }
      });
    });
  }

  async addExpense(expense) {
    return new Promise(async (resolve, reject) => {
      try {
        const {
          id, name, amount, currency, department, submitterEmail,
          status, submittedAt, attachment
        } = expense;

        // Get approval workflow for this expense
        const workflow = await this.getApprovalWorkflow(department, amount, currency);
        const maxLevel = Math.max(...workflow.map(w => w.level));

        const query = `
          INSERT INTO expenses (
            id, name, amount, currency, department, submitter_email,
            status, submitted_at, current_approval_level, max_approval_level,
            attachment_filename, attachment_mimetype, attachment_path, attachment_original_filename
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
          id, name, amount, currency, department, submitterEmail,
          status, submittedAt, 1, maxLevel,
          attachment?.filename || null,
          attachment?.mimetype || null,
          attachment?.path || null,
          attachment?.originalFilename || null
        ];

        this.db.run(query, values, async (err) => {
          if (err) {
            reject(err);
          } else {
            // Create approval records
            await this.createApprovalRecords(id, workflow);
            expense.currentApprovalLevel = 1;
            expense.maxApprovalLevel = maxLevel;
            expense.approvals = await this.getApprovalRecords(id);
            resolve(expense);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async updateExpenseStatus(expenseId, status, approvedOrDeclinedAt, currentLevel = null) {
    return new Promise((resolve, reject) => {
      let query, params;
      
      if (currentLevel !== null) {
        query = 'UPDATE expenses SET status = ?, approved_or_declined_at = ?, current_approval_level = ? WHERE id = ?';
        params = [status, approvedOrDeclinedAt, currentLevel, expenseId];
      } else {
        query = 'UPDATE expenses SET status = ?, approved_or_declined_at = ? WHERE id = ?';
        params = [status, approvedOrDeclinedAt, expenseId];
      }
      
      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else if (this.changes === 0) {
          reject(new Error('Expense not found'));
        } else {
          resolve();
        }
      });
    });
  }

  async getExpenseById(expenseId) {
    return new Promise(async (resolve, reject) => {
      this.db.get('SELECT * FROM expenses WHERE id = ?', [expenseId], async (err, row) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          const approvals = await this.getApprovalRecords(row.id);
          const expense = {
            id: row.id,
            name: row.name,
            amount: row.amount,
            currency: row.currency,
            department: row.department,
            submitterEmail: row.submitter_email,
            status: row.status,
            submittedAt: row.submitted_at,
            approvedOrDeclinedAt: row.approved_or_declined_at,
            currentApprovalLevel: row.current_approval_level,
            maxApprovalLevel: row.max_approval_level,
            approvals: approvals,
            attachment: row.attachment_filename ? {
              filename: row.attachment_filename,
              mimetype: row.attachment_mimetype,
              path: row.attachment_path,
              originalFilename: row.attachment_original_filename
            } : undefined
          };
          resolve(expense);
        }
      });
    });
  }

  // User methods
  async getUsers() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM users ORDER BY created_at DESC', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const users = rows.map(row => ({
            id: row.id,
            email: row.email,
            role: row.role,
            createdAt: row.created_at
          }));
          resolve(users);
        }
      });
    });
  }

  async addUser(user) {
    return new Promise((resolve, reject) => {
      const { id, email, role, createdAt } = user;
      this.db.run(
        'INSERT INTO users (id, email, role, created_at) VALUES (?, ?, ?, ?)',
        [id, email, role, createdAt],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(user);
          }
        }
      );
    });
  }

  async updateUser(userId, role) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE users SET role = ? WHERE id = ?',
        [role, userId],
        function(err) {
          if (err) {
            reject(err);
          } else if (this.changes === 0) {
            reject(new Error('User not found'));
          } else {
            resolve();
          }
        }
      );
    });
  }

  async deleteUser(userId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM users WHERE id = ?',
        [userId],
        function(err) {
          if (err) {
            reject(err);
          } else if (this.changes === 0) {
            reject(new Error('User not found'));
          } else {
            resolve();
          }
        }
      );
    });
  }

  async getUserByEmail(email) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          resolve({
            id: row.id,
            email: row.email,
            role: row.role,
            createdAt: row.created_at
          });
        }
      });
    });
  }

  async initializeApprovalRulesAndUsers() {
    // Initialize approval rules based on the Google Sheet data
    const approvalRules = [
      // Logistics
      { department: 'Logistics', amountMin: 0, amountMax: 999.99, currency: 'ALL', level: 1, recipient: 'rawad.zahreddine@holdalgroup.com' },
      { department: 'Logistics', amountMin: 1000, amountMax: 4999.99, currency: 'ALL', level: 1, recipient: 'rawad.zahreddine@holdalgroup.com' },
      { department: 'Logistics', amountMin: 1000, amountMax: 4999.99, currency: 'ALL', level: 2, recipient: 'digitalage@holdalgroup.com' },
      { department: 'Logistics', amountMin: 5000, amountMax: 999999999, currency: 'ALL', level: 1, recipient: 'rawad.zahreddine@holdalgroup.com' },
      { department: 'Logistics', amountMin: 5000, amountMax: 999999999, currency: 'ALL', level: 2, recipient: 'digitalage@holdalgroup.com' },
      { department: 'Logistics', amountMin: 5000, amountMax: 999999999, currency: 'ALL', level: 3, recipient: 'ceo@holdalgroup.com' },
      
      // HR
      { department: 'HR', amountMin: 0, amountMax: 999.99, currency: 'ALL', level: 1, recipient: 'hr@holdalgroup.com' },
      { department: 'HR', amountMin: 1000, amountMax: 4999.99, currency: 'ALL', level: 1, recipient: 'hr@holdalgroup.com' },
      { department: 'HR', amountMin: 1000, amountMax: 4999.99, currency: 'ALL', level: 2, recipient: 'ceo@holdalgroup.com' },
      { department: 'HR', amountMin: 5000, amountMax: 999999999, currency: 'ALL', level: 1, recipient: 'hr@holdalgroup.com' },
      { department: 'HR', amountMin: 5000, amountMax: 999999999, currency: 'ALL', level: 2, recipient: 'ceo@holdalgroup.com' },
      
      // Retail
      { department: 'Retail', amountMin: 0, amountMax: 999.99, currency: 'ALL', level: 1, recipient: 'retail@holdalgroup.com' },
      { department: 'Retail', amountMin: 1000, amountMax: 4999.99, currency: 'ALL', level: 1, recipient: 'retail@holdalgroup.com' },
      { department: 'Retail', amountMin: 1000, amountMax: 4999.99, currency: 'ALL', level: 2, recipient: 'digitalage@holdalgroup.com' },
      { department: 'Retail', amountMin: 5000, amountMax: 999999999, currency: 'ALL', level: 1, recipient: 'retail@holdalgroup.com' },
      { department: 'Retail', amountMin: 5000, amountMax: 999999999, currency: 'ALL', level: 2, recipient: 'digitalage@holdalgroup.com' },
      { department: 'Retail', amountMin: 5000, amountMax: 999999999, currency: 'ALL', level: 3, recipient: 'ceo@holdalgroup.com' },
      
      // Incoma
      { department: 'Incoma', amountMin: 0, amountMax: 999.99, currency: 'ALL', level: 1, recipient: 'incoma@holdalgroup.com' },
      { department: 'Incoma', amountMin: 1000, amountMax: 4999.99, currency: 'ALL', level: 1, recipient: 'incoma@holdalgroup.com' },
      { department: 'Incoma', amountMin: 1000, amountMax: 4999.99, currency: 'ALL', level: 2, recipient: 'digitalage@holdalgroup.com' },
      { department: 'Incoma', amountMin: 5000, amountMax: 999999999, currency: 'ALL', level: 1, recipient: 'incoma@holdalgroup.com' },
      { department: 'Incoma', amountMin: 5000, amountMax: 999999999, currency: 'ALL', level: 2, recipient: 'digitalage@holdalgroup.com' },
      { department: 'Incoma', amountMin: 5000, amountMax: 999999999, currency: 'ALL', level: 3, recipient: 'ceo@holdalgroup.com' },
      
      // Para-Pharma
      { department: 'Para-Pharma', amountMin: 0, amountMax: 999.99, currency: 'ALL', level: 1, recipient: 'parapharma@holdalgroup.com' },
      { department: 'Para-Pharma', amountMin: 1000, amountMax: 4999.99, currency: 'ALL', level: 1, recipient: 'parapharma@holdalgroup.com' },
      { department: 'Para-Pharma', amountMin: 1000, amountMax: 4999.99, currency: 'ALL', level: 2, recipient: 'digitalage@holdalgroup.com' },
      { department: 'Para-Pharma', amountMin: 5000, amountMax: 999999999, currency: 'ALL', level: 1, recipient: 'parapharma@holdalgroup.com' },
      { department: 'Para-Pharma', amountMin: 5000, amountMax: 999999999, currency: 'ALL', level: 2, recipient: 'digitalage@holdalgroup.com' },
      { department: 'Para-Pharma', amountMin: 5000, amountMax: 999999999, currency: 'ALL', level: 3, recipient: 'ceo@holdalgroup.com' },
    ];

    // Clear existing approval rules
    await new Promise((resolve, reject) => {
      this.db.run('DELETE FROM approval_rules', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Insert approval rules
    for (const rule of approvalRules) {
      await new Promise((resolve, reject) => {
        const ruleId = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.db.run(
          'INSERT INTO approval_rules (id, department, amount_min, amount_max, currency, level, recipient) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [ruleId, rule.department, rule.amountMin, rule.amountMax, rule.currency, rule.level, rule.recipient],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    // Create users from recipients
    const uniqueRecipients = [...new Set(approvalRules.map(rule => rule.recipient))];
    
    for (const email of uniqueRecipients) {
      const existingUser = await this.getUserByEmail(email);
      if (!existingUser) {
        const newUser = {
          id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          email,
          role: 'APPROVER',
          createdAt: new Date().toISOString()
        };
        await this.addUser(newUser);
      }
    }
  }

  async getApprovalWorkflow(department, amount, currency) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT DISTINCT level, recipient 
        FROM approval_rules 
        WHERE department = ? 
        AND amount_min <= ? 
        AND amount_max >= ? 
        AND (currency = ? OR currency = 'ALL')
        ORDER BY level
      `;
      
      this.db.all(query, [department, amount, amount, currency], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async createApprovalRecords(expenseId, workflow) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        const stmt = this.db.prepare('INSERT INTO approvals (id, expense_id, level, approver_email, status) VALUES (?, ?, ?, ?, ?)');
        
        for (const step of workflow) {
          const approvalId = `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          stmt.run(approvalId, expenseId, step.level, step.recipient, 'PENDING');
        }
        
        stmt.finalize((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async getApprovalRecords(expenseId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM approvals WHERE expense_id = ? ORDER BY level',
        [expenseId],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            const approvals = rows.map(row => ({
              id: row.id,
              expenseId: row.expense_id,
              level: row.level,
              approverEmail: row.approver_email,
              status: row.status,
              approvedAt: row.approved_at
            }));
            resolve(approvals);
          }
        }
      );
    });
  }

  async updateApprovalRecord(expenseId, level, approverEmail, status) {
    return new Promise((resolve, reject) => {
      const approvedAt = status === 'APPROVED' ? new Date().toISOString() : null;
      this.db.run(
        'UPDATE approvals SET status = ?, approved_at = ? WHERE expense_id = ? AND level = ? AND approver_email = ?',
        [status, approvedAt, expenseId, level, approverEmail],
        function(err) {
          if (err) {
            reject(err);
          } else if (this.changes === 0) {
            reject(new Error('Approval record not found'));
          } else {
            resolve();
          }
        }
      );
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

module.exports = Database;
