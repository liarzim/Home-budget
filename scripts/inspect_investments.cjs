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

async function run() {
  const { data, error } = await supabase.from('investments').select('*');
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log(`Found ${data.length} assets:`);
  for (const a of data) {
    console.log(`Asset: ${a.name} (${a.ticker || a.symbol}) | Currency: ${a.currency} | Current Price: ${a.current_price}`);
    if (a.tranches) {
      for (const t of a.tranches) {
        console.log(`  Tranche: shares=${t.shares}, price=${t.price_per_share}, cost=${t.total_cost}, date=${t.purchase_date}, notes=${t.notes}`);
      }
    }
  }
}

run();
