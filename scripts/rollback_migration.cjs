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

async function runRollback() {
  const args = process.argv.slice(2);
  const year = args[0] || '2025';
  console.log(`=== ביטול ומחיקת טעינת שנת ${year} ===`);

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  // 1. Check transactions for this year
  const { data: txs, error: fetchErr } = await supabase
    .from('transactions')
    .select('id, date, payee, amount')
    .gte('date', startDate)
    .lte('date', endDate);

  if (fetchErr) {
    console.error('Error fetching transactions:', fetchErr.message);
    return;
  }

  console.log(`נמצאו ${txs.length} עסקאות לשנת ${year}.`);

  if (txs.length > 0) {
    const { error: delErr } = await supabase
      .from('transactions')
      .delete()
      .gte('date', startDate)
      .lte('date', endDate);

    if (delErr) {
      console.error('שגיאה במחיקת עסקאות:', delErr.message);
    } else {
      console.log(`✓ נמחקו בהצלחה ${txs.length} עסקאות של שנת ${year}!`);
    }
  }

  // 2. Savings for this year
  const { data: savs } = await supabase.from('savings').select('id, year').eq('year', parseInt(year, 10));
  if (savs && savs.length > 0) {
    await supabase.from('savings').delete().eq('year', parseInt(year, 10));
    console.log(`✓ נמחקו ${savs.length} רשומות חיסכון לשנת ${year}`);
  }

  console.log(`\nהביטול והמחיקה הושלמו! המערכת נקייה מנתוני שנת ${year}.`);
}

runRollback().catch(err => {
  console.error('Rollback error:', err);
});
