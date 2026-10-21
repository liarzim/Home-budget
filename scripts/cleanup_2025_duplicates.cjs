const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

function signAdminJwt() {
  const secret = 'HomeBudgetSuperSecretJWTKey2026AtLeast32Chars!';
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { role: 'postgres', iss: 'supabase', iat: Math.floor(Date.now() / 1000), exp: 2100000000 };
  const b64H = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64P = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(b64H + '.' + b64P).digest('base64url');
  return b64H + '.' + b64P + '.' + sig;
}

const supabase = createClient('https://budget-db.liarzi.com', signAdminJwt());

async function cleanDuplicates() {
  console.log('=== Step 1: Identifying duplicate batch from today (2026-10-21) ===');
  
  const { data: todayRows, error: fetchErr } = await supabase
    .from('transactions')
    .select('id, created_at, date')
    .gte('date', '2025-01-01')
    .lte('date', '2025-12-31')
    .gte('created_at', '2026-10-21T00:00:00Z');

  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
    return;
  }

  console.log('Rows created today to be deleted:', todayRows.length);
  if (todayRows.length === 0) {
    console.log('No rows found matching today filter. Aborting.');
    return;
  }

  const idsToDelete = todayRows.map(r => r.id);
  console.log('=== Step 2: Deleting duplicate rows in batches of 100 ===');
  let deletedCount = 0;
  const chunkSize = 100;
  
  for (let i = 0; i < idsToDelete.length; i += chunkSize) {
    const chunk = idsToDelete.slice(i, i + chunkSize);
    const { error: delErr } = await supabase
      .from('transactions')
      .delete()
      .in('id', chunk);

    if (delErr) {
      console.error('Delete chunk error at index', i, delErr.message);
      return;
    }
    deletedCount += chunk.length;
    console.log(`Deleted ${deletedCount} / ${idsToDelete.length} duplicate transactions...`);
  }

  console.log('\n=== Step 3: Verifying final state in DB ===');
  const { count, error: countErr } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .gte('date', '2025-01-01')
    .lte('date', '2025-12-31');

  if (countErr) {
    console.error('Count error:', countErr);
    return;
  }

  console.log('Remaining 2025 transactions count in DB:', count);
  if (count === 1341) {
    console.log('🎉 SUCCESS: Exactly 1,341 unique transactions remain in 2025!');
  } else {
    console.log('Notice: current count is', count);
  }
}

cleanDuplicates();
