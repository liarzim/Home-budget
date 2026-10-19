const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const crypto = require('crypto');

function signAdminJwt() {
  const secret = 'HomeBudgetSuperSecretJWTKey2026AtLeast32Chars!';
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { role: 'postgres', iss: 'supabase', iat: Math.floor(Date.now() / 1000), exp: 2100000000 };
  const b64H = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64P = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(b64H + '.' + b64P).digest('base64url');
  return b64H + '.' + b64P + '.' + sig;
}

const url = 'https://budget-db.liarzi.com';
const key = signAdminJwt();
const supabase = createClient(url, key);

async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFile = path.join(backupDir, `system_backup_${timestamp}.json`);
  console.log(`Starting system backup to: ${backupFile}`);

  const tables = [
    'households',
    'household_members',
    'profiles',
    'macro_categories',
    'categories',
    'business_mapping',
    'payment_method_mappings',
    'transactions',
    'budgets',
    'savings',
    'investments'
  ];

  const backupData = {
    backup_timestamp: new Date().toISOString(),
    tables: {}
  };

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        console.warn(`Table ${table} error:`, error.message);
        backupData.tables[table] = { error: error.message, rows: [] };
      } else {
        backupData.tables[table] = { count: data.length, rows: data };
        console.log(`✓ ${table}: backed up ${data.length} rows`);
      }
    } catch (e) {
      console.error(`Exception backing up ${table}:`, e.message);
      backupData.tables[table] = { error: e.message, rows: [] };
    }
  }

  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log(`\nSystem backup completed successfully!\nFile: ${backupFile}\nSize: ${(fs.statSync(backupFile).size / 1024).toFixed(2)} KB`);
  return backupFile;
}

runBackup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
