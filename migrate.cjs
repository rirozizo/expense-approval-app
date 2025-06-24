
const fs = require('fs');
const path = require('path');
const Database = require('./database.cjs');

async function migrate() {
  const dbJsonPath = path.join(__dirname, 'db.json');
  
  if (!fs.existsSync(dbJsonPath)) {
    console.log('No db.json file found, skipping migration');
    return;
  }

  try {
    const jsonData = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
    const database = new Database();
    
    await database.init();
    
    // Migrate settings
    if (jsonData.settings) {
      await database.saveSettings(
        jsonData.settings.submitterEmail || '',
        jsonData.settings.approverEmail || ''
      );
      console.log('Settings migrated successfully');
    }
    
    // Migrate expenses
    if (jsonData.expenses && Array.isArray(jsonData.expenses)) {
      for (const expense of jsonData.expenses) {
        try {
          await database.addExpense(expense);
          console.log(`Migrated expense: ${expense.id}`);
        } catch (err) {
          console.error(`Error migrating expense ${expense.id}:`, err);
        }
      }
      console.log(`Migrated ${jsonData.expenses.length} expenses`);
    }
    
    database.close();
    
    // Rename the old db.json file as backup
    const backupPath = path.join(__dirname, 'db.json.backup');
    fs.renameSync(dbJsonPath, backupPath);
    console.log(`Migration completed! Original db.json backed up as ${backupPath}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrate();
}

module.exports = migrate;
