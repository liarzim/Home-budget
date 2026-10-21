const XLSX = require('xlsx');
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
const HOUSEHOLD_ID = 'a65b65b2-1fd7-4711-b531-9ea20137c09e';

async function auditYear2024() {
  console.log('=== בדיקה מקיפה של שנת 2024 ומיפוי פערים ===');
  
  // 1. Fetch categories and mappings from DB
  const { data: dbCategories } = await supabase.from('categories').select('id, name, macro_category_id');
  const { data: dbMappings } = await supabase.from('business_mapping').select('id, raw_business_name, category_id');
  const { data: dbCards } = await supabase.from('payment_method_mappings').select('id, card_name, card_last_digits');

  const catMap = new Map();
  (dbCategories || []).forEach(c => catMap.set(c.name.trim(), c.id));

  const busMap = new Map();
  (dbMappings || []).forEach(m => busMap.set(m.raw_business_name.trim().toLowerCase(), m.category_id));

  console.log(`נטענו מה-DB: ${catMap.size} קטגוריות, ${busMap.size} מיפויי עסקים, ${dbCards?.length || 0} כרטיסים.`);

  // 2. Read 2024 Excel
  const wb = XLSX.readFile('C:/Users/micha/Downloads/תקציב שנתי/סיכום הכנסות הוצאת - 2024.xlsx');

  // Also read Excel's own 'טבלאות' sheet mappings
  const tabSheet = wb.Sheets['טבלאות'];
  const excelBusMap = new Map();
  if (tabSheet) {
    const range = XLSX.utils.decode_range(tabSheet['!ref'] || 'A1:K1000');
    for (let r = 2; r <= range.e.r; r++) {
      const bCell = tabSheet[XLSX.utils.encode_cell({ r, c: 6 })];
      const cCell = tabSheet[XLSX.utils.encode_cell({ r, c: 7 })];
      if (bCell && cCell && bCell.v && cCell.v) {
        excelBusMap.set(String(bCell.v).trim().toLowerCase(), String(cCell.v).trim());
      }
    }
  }
  console.log(`נטענו מגיליון טבלאות באקסל: ${excelBusMap.size} חוקי מיפוי.`);

  // 3. Scan Credit transactions
  let totalTxs = 0;
  let totalAmount = 0;
  const unmappedPayees = new Map(); // payee -> { count, totalAmount, sampleMonth, card }
  const unmappedCards = new Set();

  for (let m = 1; m <= 12; m++) {
    const s = wb.Sheets[String(m)];
    if (!s) continue;
    const range = XLSX.utils.decode_range(s['!ref'] || 'A1:H100');

    for (let r = 1; r <= range.e.r; r++) {
      const cardCell = s[XLSX.utils.encode_cell({ r, c: 0 })];
      const payeeCell = s[XLSX.utils.encode_cell({ r, c: 1 })];
      const dateCell = s[XLSX.utils.encode_cell({ r, c: 2 })];
      const amountCell = s[XLSX.utils.encode_cell({ r, c: 3 })];

      if (!payeeCell || !amountCell || amountCell.v === undefined) continue;

      const payeeRaw = String(payeeCell.v).trim();
      const payeeNorm = payeeRaw.toLowerCase();
      const amount = Number(amountCell.v) || 0;
      totalTxs++;
      totalAmount += amount;

      // Check card
      const cardStr = cardCell ? String(cardCell.v).trim() : '';
      const cardDigits = cardStr.match(/\b\d{4}\b/)?.[0] || null;
      if (cardStr && !cardDigits) {
        unmappedCards.add(cardStr);
      }

      // Check category resolution
      let matchedCatId = busMap.get(payeeNorm);
      if (!matchedCatId && excelBusMap.has(payeeNorm)) {
        const catName = excelBusMap.get(payeeNorm);
        matchedCatId = catMap.get(catName);
      }

      if (!matchedCatId) {
        if (!unmappedPayees.has(payeeNorm)) {
          unmappedPayees.set(payeeNorm, {
            payee: payeeRaw,
            count: 0,
            amount: 0,
            sampleMonth: m,
            card: cardStr,
            excelSuggestedCat: excelBusMap.get(payeeNorm) || null
          });
        }
        const item = unmappedPayees.get(payeeNorm);
        item.count++;
        item.amount += amount;
      }
    }
  }

  console.log('\n--- תוצאות ניתוח כרטיסי אשראי 2024 ---');
  console.log(`סך עסקאות אשראי: ${totalTxs}`);
  console.log(`סך סכום עסקאות אשראי: ₪${totalAmount.toLocaleString('he-IL', { minimumFractionDigits: 2 })}`);
  console.log(`בתי עסק ללא שיוך קטגוריה ב-DB: ${unmappedPayees.size}`);
  
  const unmappedList = Array.from(unmappedPayees.values()).sort((a, b) => b.amount - a.amount);
  console.log('\n10 בתי עסק מובילים ללא שיוך:');
  unmappedList.slice(0, 10).forEach(u => {
    console.log(`- ${u.payee}: ${u.count} עסקאות, סה"כ ₪${u.amount.toFixed(2)} (הצעה באקסל: ${u.excelSuggestedCat || 'אין'})`);
  });

  if (unmappedCards.size > 0) {
    console.log('\nכרטיסים ללא 4 ספרות מזוהות:', Array.from(unmappedCards));
  }
}

auditYear2024().catch(console.error);
