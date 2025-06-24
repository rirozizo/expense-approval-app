
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

      const createExpensesTable = `
        CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          amount REAL NOT NULL,
          currency TEXT NOT NULL,
          category TEXT NOT NULL,
          submitter_email TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          submitted_at TEXT NOT NULL,
          approved_or_declined_at TEXT,
          attachment_filename TEXT,
          attachment_mimetype TEXT,
          attachment_path TEXT,
          attachment_original_filename TEXT
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

        this.db.run(createExpensesTable, (err) => {
          if (err) {
            console.error('Error creating expenses table:', err);
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
                    console.log('Database tables created successfully');
                    resolve();
                  }
                }
              );
            } else {
              console.log('Database tables created successfully');
              resolve();
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
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM expenses ORDER BY submitted_at DESC', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const expenses = rows.map(row => ({
            id: row.id,
            name: row.name,
            amount: row.amount,
            currency: row.currency,
            category: row.category,
            submitterEmail: row.submitter_email,
            status: row.status,
            submittedAt: row.submitted_at,
            approvedOrDeclinedAt: row.approved_or_declined_at,
            attachment: row.attachment_filename ? {
              filename: row.attachment_filename,
              mimetype: row.attachment_mimetype,
              path: row.attachment_path,
              originalFilename: row.attachment_original_filename
            } : undefined
          }));
          resolve(expenses);
        }
      });
    });
  }

  async addExpense(expense) {
    return new Promise((resolve, reject) => {
      const {
        id, name, amount, currency, category, submitterEmail,
        status, submittedAt, attachment
      } = expense;

      const query = `
        INSERT INTO expenses (
          id, name, amount, currency, category, submitter_email,
          status, submitted_at, attachment_filename, attachment_mimetype,
          attachment_path, attachment_original_filename
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        id, name, amount, currency, category, submitterEmail,
        status, submittedAt,
        attachment?.filename || null,
        attachment?.mimetype || null,
        attachment?.path || null,
        attachment?.originalFilename || null
      ];

      this.db.run(query, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(expense);
        }
      });
    });
  }

  async updateExpenseStatus(expenseId, status, approvedOrDeclinedAt) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE expenses SET status = ?, approved_or_declined_at = ? WHERE id = ?',
        [status, approvedOrDeclinedAt, expenseId],
        function(err) {
          if (err) {
            reject(err);
          } else if (this.changes === 0) {
            reject(new Error('Expense not found'));
          } else {
            resolve();
          }
        }
      );
    });
  }

  async getExpenseById(expenseId) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM expenses WHERE id = ?', [expenseId], (err, row) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          const expense = {
            id: row.id,
            name: row.name,
            amount: row.amount,
            currency: row.currency,
            category: row.category,
            submitterEmail: row.submitter_email,
            status: row.status,
            submittedAt: row.submitted_at,
            approvedOrDeclinedAt: row.approved_or_declined_at,
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
