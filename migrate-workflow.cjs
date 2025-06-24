
const Database = require('./database.cjs');
const fs = require('fs');
const path = require('path');

async function migrateToWorkflow() {
  console.log('Starting migration to approval workflow...');
  
  const database = new Database();
  await database.init();
  
  try {
    // Check if migration is needed
    const expenses = await database.getExpenses();
    
    if (expenses.length > 0 && !expenses[0].hasOwnProperty('department')) {
      console.log('Migrating existing expenses...');
      
      // Add columns to expenses table
      await new Promise((resolve, reject) => {
        database.db.run('ALTER TABLE expenses ADD COLUMN department TEXT DEFAULT "Logistics"', (err) => {
          if (err && !err.message.includes('duplicate column')) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      await new Promise((resolve, reject) => {
        database.db.run('ALTER TABLE expenses ADD COLUMN current_approval_level INTEGER DEFAULT 1', (err) => {
          if (err && !err.message.includes('duplicate column')) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      await new Promise((resolve, reject) => {
        database.db.run('ALTER TABLE expenses ADD COLUMN max_approval_level INTEGER DEFAULT 1', (err) => {
          if (err && !err.message.includes('duplicate column')) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      // Update existing expenses to use department instead of category
      await new Promise((resolve, reject) => {
        database.db.run('UPDATE expenses SET department = CASE WHEN category = "Travel" THEN "Logistics" WHEN category = "Meals" THEN "HR" WHEN category = "Software" THEN "Retail" WHEN category = "Hardware" THEN "Incoma" ELSE "Para-Pharma" END WHERE department IS NULL OR department = ""', (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      console.log('Migration completed successfully!');
    } else {
      console.log('No migration needed.');
    }
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    database.close();
  }
}

if (require.main === module) {
  migrateToWorkflow().catch(console.error);
}

module.exports = migrateToWorkflow;
