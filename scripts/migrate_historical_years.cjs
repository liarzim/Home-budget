const fs = require('fs');
const path = require('path');
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
const BASE_DIR = 'C:/Users/micha/Downloads/תקציב שנתי';

const MONTHS_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

function cleanComment(raw) {
  if (!raw) return '';
  return raw.replace(/Michael Liarzi:?/g, '').replace(/Orna Liarzi:?/g, '').trim();
}

function extractLastDigits(cardStr) {
  if (!cardStr) return null;
  const match = String(cardStr).match(/\b(\d{4})\b/);
  return match ? match[1] : null;
}

function parseManualCell(year, cat, m, cell) {
  const val = Number(cell.v);
  const formula = cell.f || '';
  const rawComment = cell.c ? cell.c[0].t : '';
  const comment = cleanComment(rawComment);
  const monthStr = String(m).padStart(2, '0');
  const date = `${year}-${monthStr}-01`;

  // 1. Check for multiple values summed in formula: "=120+450"
  if (formula && formula.includes('+')) {
    const parts = formula.replace('=', '').split('+').map(p => parseFloat(p)).filter(p => !isNaN(p));
    if (parts.length > 1) {
      const commentLines = comment.split('\n').map(l => l.trim()).filter(Boolean);
      return parts.map((amt, idx) => ({
        date,
        amount: amt,
        payee: commentLines[idx] || `${cat} (${idx + 1})`,
        category: cat,
        notes: `נוסחה: ${formula} | הערה: ${comment || 'אין'}`
      }));
    }
  }

  // 2. Single value
  return [{
    date,
    amount: val,
    payee: comment || cat,
    category: cat,
    notes: comment ? `הערה מאקסל: ${comment}` : undefined
  }];
}

async function migrateSingleYear(year) {
  console.log(`\n========================================`);
  console.log(`🚀 מתחיל הגירת שנת ${year}...`);
  console.log(`========================================`);

  // Find file
  const files = fs.readdirSync(BASE_DIR);
  const fileName = files.find(f => f.includes(year) && f.endsWith('.xlsx') && !f.startsWith('~$'));
  if (!fileName) {
    console.warn(`⚠️ לא נמצא קובץ עבור שנת ${year}`);
    return null;
  }

  const filePath = path.join(BASE_DIR, fileName);
  console.log(`קורא את הקובץ: ${fileName}`);
  const wb = XLSX.readFile(filePath);

  // 1. Fetch DB Categories
  const { data: dbCategories, error: catErr } = await supabase
    .from('categories')
    .select('id, name, macro_category_id');

  if (catErr || !dbCategories) {
    throw new Error('שגיאה בטעינת קטגוריות מה-DB: ' + (catErr ? catErr.message : 'ריק'));
  }

  const catMap = new Map();
  dbCategories.forEach(c => {
    if (c && c.name) {
      catMap.set(String(c.name).trim().toLowerCase(), c.id);
    }
  });

  // Ensure default/fallback category exists
  let fallbackCatId = catMap.get('שונות') || catMap.get('אחר');
  if (!fallbackCatId && dbCategories.length > 0) {
    fallbackCatId = dbCategories[0].id;
  }

  // Fetch Business Mappings
  const { data: dbMappings } = await supabase.from('business_mapping').select('*');
  const busMap = new Map();
  (dbMappings || []).forEach(m => {
    if (m && m.raw_business_name) {
      busMap.set(String(m.raw_business_name).trim().toLowerCase(), m.category_id);
    }
  });

  // Read Excel 'טבלאות'
  const tabSheet = wb.Sheets['טבלאות'];
  if (tabSheet) {
    const range = XLSX.utils.decode_range(tabSheet['!ref'] || 'A1:K1200');
    for (let r = 2; r <= range.e.r; r++) {
      const bCell = tabSheet[XLSX.utils.encode_cell({ r, c: 6 })];
      const cCell = tabSheet[XLSX.utils.encode_cell({ r, c: 7 })];
      if (bCell && cCell && bCell.v && cCell.v) {
        const busName = String(bCell.v).trim().toLowerCase();
        const catName = String(cCell.v).trim().toLowerCase();
        const catId = catMap.get(catName);
        if (catId && !busMap.has(busName)) {
          busMap.set(busName, catId);
        }
      }
    }
  }

  const transactionsToInsert = [];
  const uncategorizedItems = [];

  // 2. PARSE INCOME SHEET (Supports both 2016-2021 horizontal months and 2022-2026 vertical months)
  const incSheet = wb.Sheets['הכנסות'];
  if (incSheet) {
    console.log(`מנתח הכנסות ומשכורות לשנת ${year}...`);
    const r0c1 = incSheet['B1'] ? String(incSheet['B1'].v).trim() : '';
    const isHorizontalLayout = r0c1.includes('ינואר');

    if (isHorizontalLayout) {
      // 2016-2021 Horizontal format: Months are in columns B..M (c=1..12), rows are income types
      const incRange = XLSX.utils.decode_range(incSheet['!ref'] || 'A1:N20');
      for (let r = 1; r <= incRange.e.r; r++) {
        const titleCell = incSheet[XLSX.utils.encode_cell({ r, c: 0 })];
        if (!titleCell || !titleCell.v) continue;
        const incType = String(titleCell.v).trim();
        if (incType.includes('סה"כ') || incType.includes('סיכום') || incType.includes('סוג הכנסה')) continue;

        for (let m = 1; m <= 12; m++) {
          const valCell = incSheet[XLSX.utils.encode_cell({ r, c: m })];
          if (!valCell || valCell.v === undefined) continue;
          const val = Number(valCell.v);
          if (isNaN(val) || val <= 0) continue;
          const f = valCell.f || '';
          const date = `${year}-${String(m).padStart(2, '0')}-01`;

          if (incType.includes('משכורת')) {
            if (f.includes('+')) {
              const parts = f.replace('=', '').split('+').map(p => parseFloat(p)).filter(p => !isNaN(p));
              if (parts.length >= 2) {
                const michaelVal = Math.max(...parts);
                const ornaVal = Math.min(...parts);

                transactionsToInsert.push({
                  id: crypto.randomUUID(),
                  household_id: HOUSEHOLD_ID,
                  date,
                  amount: michaelVal,
                  category_id: catMap.get('משכורת') || fallbackCatId,
                  transaction_type: 'income',
                  payee_name: 'משכורת מיכאל',
                  original_description: `משכורת מיכאל ${MONTHS_NAMES[m - 1]} ${year}`,
                  payment_method: 'bank_transfer',
                  notes: `נוסחה מקורית: ${f}`,
                  is_hidden: false
                });

                transactionsToInsert.push({
                  id: crypto.randomUUID(),
                  household_id: HOUSEHOLD_ID,
                  date,
                  amount: ornaVal,
                  category_id: catMap.get('משכורת') || fallbackCatId,
                  transaction_type: 'income',
                  payee_name: 'משכורת אורנה',
                  original_description: `משכורת אורנה ${MONTHS_NAMES[m - 1]} ${year}`,
                  payment_method: 'bank_transfer',
                  notes: `נוסחה מקורית: ${f}`,
                  is_hidden: false
                });
                continue;
              }
            }

            transactionsToInsert.push({
              id: crypto.randomUUID(),
              household_id: HOUSEHOLD_ID,
              date,
              amount: val,
              category_id: catMap.get('משכורת') || fallbackCatId,
              transaction_type: 'income',
              payee_name: 'משכורת',
              original_description: `משכורת ${MONTHS_NAMES[m - 1]} ${year}`,
              payment_method: 'bank_transfer',
              is_hidden: false
            });
          } else {
            // Other income types
            let catName = 'הכנסות שונות';
            if (incType.includes('צבא')) catName = 'צבא';
            else if (incType.includes('ביטוח לאומי')) catName = 'קצבאות';

            transactionsToInsert.push({
              id: crypto.randomUUID(),
              household_id: HOUSEHOLD_ID,
              date,
              amount: val,
              category_id: catMap.get(catName.toLowerCase()) || fallbackCatId,
              transaction_type: 'income',
              payee_name: incType,
              original_description: `${incType} ${MONTHS_NAMES[m - 1]} ${year}`,
              payment_method: 'bank_transfer',
              is_hidden: false
            });
          }
        }
      }
    } else {
      // 2022-2026 Vertical format: Months are in rows 4..15 (rowIdx = m + 4), columns are income types
      for (let m = 0; m < 12; m++) {
        const monthNum = m + 1;
        const rowIdx = m + 4;
        const salaryCell = incSheet[XLSX.utils.encode_cell({ r: rowIdx, c: 1 })];

        if (salaryCell && salaryCell.v !== undefined) {
          const val = Number(salaryCell.v);
          const f = salaryCell.f || '';
          const date = `${year}-${String(monthNum).padStart(2, '0')}-01`;

          if (f.includes('+')) {
            const parts = f.split('+').map(p => parseFloat(p)).filter(p => !isNaN(p));
            if (parts.length >= 2) {
              const michaelVal = Math.max(...parts);
              const ornaVal = Math.min(...parts);

              transactionsToInsert.push({
                id: crypto.randomUUID(),
                household_id: HOUSEHOLD_ID,
                date,
                amount: michaelVal,
                category_id: catMap.get('משכורת') || fallbackCatId,
                transaction_type: 'income',
                payee_name: 'משכורת מיכאל',
                original_description: `משכורת מיכאל ${MONTHS_NAMES[m]} ${year}`,
                payment_method: 'bank_transfer',
                notes: `נוסחה מקורית: ${f}`,
                is_hidden: false
              });

              transactionsToInsert.push({
                id: crypto.randomUUID(),
                household_id: HOUSEHOLD_ID,
                date,
                amount: ornaVal,
                category_id: catMap.get('משכורת') || fallbackCatId,
                transaction_type: 'income',
                payee_name: 'משכורת אורנה',
                original_description: `משכורת אורנה ${MONTHS_NAMES[m]} ${year}`,
                payment_method: 'bank_transfer',
                notes: `נוסחה מקורית: ${f}`,
                is_hidden: false
              });
            } else {
              transactionsToInsert.push({
                id: crypto.randomUUID(),
                household_id: HOUSEHOLD_ID,
                date,
                amount: val,
                category_id: catMap.get('משכורת') || fallbackCatId,
                transaction_type: 'income',
                payee_name: 'משכורת משולבת',
                original_description: `משכורות ${MONTHS_NAMES[m]} ${year}`,
                payment_method: 'bank_transfer',
                is_hidden: false
              });
            }
          } else if (val > 0) {
            transactionsToInsert.push({
              id: crypto.randomUUID(),
              household_id: HOUSEHOLD_ID,
              date,
              amount: val,
              category_id: catMap.get('משכורת') || fallbackCatId,
              transaction_type: 'income',
              payee_name: 'משכורת',
              original_description: `משכורת ${MONTHS_NAMES[m]} ${year}`,
              payment_method: 'bank_transfer',
              is_hidden: false
            });
          }
        }

        // Other income columns (c=2: צבא, c=3: ביטוח לאומי, c=4: החזרים/שונות...)
        for (let c = 2; c <= 8; c++) {
          const headerCell = incSheet[XLSX.utils.encode_cell({ r: 3, c })];
          const valCell = incSheet[XLSX.utils.encode_cell({ r: rowIdx, c })];
          if (headerCell && valCell && valCell.v && Number(valCell.v) > 0) {
            const colName = String(headerCell.v).trim();
            const amount = Number(valCell.v);
            const date = `${year}-${String(monthNum).padStart(2, '0')}-01`;

            let catName = 'הכנסות שונות';
            if (colName.includes('צבא')) catName = 'צבא';
            else if (colName.includes('ביטוח לאומי')) catName = 'קצבאות';

            transactionsToInsert.push({
              id: crypto.randomUUID(),
              household_id: HOUSEHOLD_ID,
              date,
              amount,
              category_id: catMap.get(catName.toLowerCase()) || fallbackCatId,
              transaction_type: 'income',
              payee_name: colName,
              original_description: `${colName} ${MONTHS_NAMES[m]} ${year}`,
              payment_method: 'bank_transfer',
              is_hidden: false
            });
          }
        }
      }
    }
  }

  // 3. PARSE MANUAL EXPENSES (הוצאות ידני)
  const manSheet = wb.Sheets['הוצאות ידני'] || wb.Sheets['הוצאות'];
  if (manSheet) {
    console.log(`מנתח הוצאות ידניות / חשבונות שוטפים לשנת ${year}...`);
    const range = XLSX.utils.decode_range(manSheet['!ref'] || 'A1:M40');

    for (let r = 1; r <= range.e.r; r++) {
      const catCell = manSheet[XLSX.utils.encode_cell({ r, c: 0 })];
      if (!catCell || !catCell.v) continue;
      const catName = String(catCell.v).trim();
      if (catName.includes('סה"כ') || catName.includes('סיכום')) continue;

      for (let m = 1; m <= 12; m++) {
        const cell = manSheet[XLSX.utils.encode_cell({ r, c: m })];
        if (cell && cell.v !== undefined && Number(cell.v) > 0) {
          const parsed = parseManualCell(year, catName, m, cell);
          for (const item of parsed) {
            let catId = catMap.get(item.category.toLowerCase());
            if (!catId) {
              if (item.category.includes('חיסכון') || item.category.includes('השקעות')) {
                catId = catMap.get('חיסכון והשקעות') || fallbackCatId;
              } else {
                catId = fallbackCatId;
              }
            }

            transactionsToInsert.push({
              id: crypto.randomUUID(),
              household_id: HOUSEHOLD_ID,
              date: item.date,
              amount: item.amount,
              category_id: catId,
              transaction_type: 'expense',
              payee_name: item.payee,
              original_description: `${item.payee} (${item.category})`,
              payment_method: 'standing_order',
              notes: item.notes || `הוצאה חודשית ידנית (${item.category})`,
              is_hidden: false
            });
          }
        }
      }
    }
  }

  // 4. PARSE CREDIT CARDS TRANSACTIONS (Sheets 1 to 12) - WITH DYNAMIC HEADER RESOLUTION
  console.log(`מנתח עסקאות כרטיסי אשראי (חודשים 1 עד 12) לשנת ${year}...`);
  for (let m = 1; m <= 12; m++) {
    const s = wb.Sheets[String(m)];
    if (!s) continue;
    const range = XLSX.utils.decode_range(s['!ref'] || 'A1:H100');

    // Dynamically detect column indices from row 0
    const cols = {
      date: undefined,
      payee: undefined,
      card: undefined,
      amount: undefined,
      category: undefined,
      details: undefined
    };

    for (let c = 0; c <= range.e.c; c++) {
      const cell = s[XLSX.utils.encode_cell({ r: 0, c })];
      if (cell && cell.v) {
        const t = String(cell.v).trim();
        if (t === 'תאריך עסקה' || (t.includes('תאריך') && !t.includes('חיוב'))) cols.date = c;
        else if (t.includes('בית עסק')) cols.payee = c;
        else if (t.includes('כרטיס') && !t.includes('סוג כרטיס')) cols.card = c;
        else if (t === 'סכום העסקה' || (t.includes('סכום') && !t.includes('הוצאה') && cols.amount === undefined)) cols.amount = c;
        else if (t.includes('סוג הוצאה')) cols.category = c;
        else if (t.includes('פירוט') && !t.includes('נוסף')) cols.details = c;
      }
    }

    // Fallbacks if row 0 didn't have standard headers
    if (cols.payee === undefined) cols.payee = 1;
    if (cols.amount === undefined) cols.amount = 3;
    if (cols.card === undefined) cols.card = 0;
    if (cols.date === undefined) cols.date = 2;

    for (let r = 1; r <= range.e.r; r++) {
      const payeeCell = s[XLSX.utils.encode_cell({ r, c: cols.payee })];
      const amountCell = s[XLSX.utils.encode_cell({ r, c: cols.amount })];
      if (!payeeCell || !amountCell || amountCell.v === undefined) continue;

      const payeeRaw = String(payeeCell.v).trim();
      const payeeNorm = payeeRaw.toLowerCase();
      const amount = Number(amountCell.v);
      if (isNaN(amount) || amount === 0) continue;

      // Date
      const dateCell = cols.date !== undefined ? s[XLSX.utils.encode_cell({ r, c: cols.date })] : null;
      let txDate = `${year}-${String(m).padStart(2, '0')}-01`;
      if (dateCell && dateCell.v) {
        if (typeof dateCell.v === 'number') {
          const jsDate = new Date(Math.round((dateCell.v - 25569) * 86400 * 1000));
          if (!isNaN(jsDate.getTime())) {
            txDate = jsDate.toISOString().substring(0, 10);
          }
        } else if (typeof dateCell.v === 'string') {
          const parts = dateCell.v.split(/[\/\-\.]/);
          if (parts.length === 3) {
            const d = parts[0].padStart(2, '0');
            const mo = parts[1].padStart(2, '0');
            let y = parts[2];
            if (y.length === 2) y = '20' + y;
            txDate = `${y}-${mo}-${d}`;
          }
        }
      }

      // Card
      const cardCell = cols.card !== undefined ? s[XLSX.utils.encode_cell({ r, c: cols.card })] : null;
      const cardStr = cardCell && cardCell.v ? String(cardCell.v).trim() : '';
      const cardDigits = extractLastDigits(cardStr);

      // Category: first check direct category column (if exists in sheet, e.g. 2016-2019), then business mapping
      const catCell = cols.category !== undefined ? s[XLSX.utils.encode_cell({ r, c: cols.category })] : null;
      const directCatName = catCell && catCell.v ? String(catCell.v).trim().toLowerCase() : '';

      let catId = directCatName ? catMap.get(directCatName) : null;
      if (!catId) {
        catId = busMap.get(payeeNorm);
      }

      const isUncategorized = !catId;
      if (!catId) {
        catId = fallbackCatId;
        const detailsCell = cols.details !== undefined ? s[XLSX.utils.encode_cell({ r, c: cols.details })] : null;
        uncategorizedItems.push({
          year,
          month: m,
          date: txDate,
          payee: payeeRaw,
          amount,
          card: cardStr,
          details: detailsCell && detailsCell.v ? String(detailsCell.v).trim() : ''
        });
      }

      const detailsCell = cols.details !== undefined ? s[XLSX.utils.encode_cell({ r, c: cols.details })] : null;
      const details = detailsCell && detailsCell.v ? String(detailsCell.v).trim() : '';
      let notes = cardStr ? `כרטיס: ${cardStr}` : '';
      if (details) notes = notes ? `${notes} | ${details}` : details;
      if (isUncategorized) notes = notes ? `${notes} [דורש סיווג]` : '[דורש סיווג]';

      transactionsToInsert.push({
        id: crypto.randomUUID(),
        household_id: HOUSEHOLD_ID,
        date: txDate,
        amount: Math.abs(amount),
        category_id: catId,
        transaction_type: amount < 0 ? 'income' : 'expense',
        payee_name: payeeRaw,
        original_description: payeeRaw,
        payment_method: 'credit_card',
        card_last_digits: cardDigits,
        notes: notes || undefined,
        is_hidden: false
      });
    }
  }

  const validTransactions = transactionsToInsert.filter(
    t => t && typeof t.amount === 'number' && !isNaN(t.amount) && t.amount > 0
  );

  console.log(`\nסך הכל נאספו ${validTransactions.length} עסקאות תקינות לשנת ${year}.`);
  console.log(`מתוכן ${uncategorizedItems.length} עסקאות ללא סיווג קטגוריה ודאי.`);

  // 5. INJECT INTO SUPABASE WITH DEDUPLICATION PROTECTION
  console.log(`\nמנקה עסקאות קיימות של שנת ${year} ב-DB למניעת כפילויות...`);
  const { error: delErr } = await supabase
    .from('transactions')
    .delete()
    .eq('household_id', HOUSEHOLD_ID)
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`);

  if (delErr) {
    console.warn(`הערה בניקוי שנת ${year}:`, delErr.message);
  }

  console.log(`מזריק ${validTransactions.length} עסקאות ב-batches של 100...`);
  const CHUNK = 100;
  let inserted = 0;
  for (let i = 0; i < validTransactions.length; i += CHUNK) {
    const chunk = validTransactions.slice(i, i + CHUNK);
    const { error: insErr } = await supabase.from('transactions').insert(chunk);
    if (insErr) {
      console.error(`שגיאה בהזרקת מקטע ${i}:`, insErr.message);
      throw insErr;
    }
    inserted += chunk.length;
    process.stdout.write(`\rנשמרו: ${inserted} / ${validTransactions.length}...`);
  }
  console.log(`\n✓ שנת ${year} נשמרה בהצלחה מלאה בטבלת transactions!`);

  return {
    year,
    totalCount: transactionsToInsert.length,
    uncategorizedCount: uncategorizedItems.length,
    uncategorizedItems
  };
}

async function run() {
  const targetYear = process.argv[2] || '2019';
  if (targetYear === 'all') {
    const years = ['2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016'];
    const summary = [];
    for (const y of years) {
      const res = await migrateSingleYear(y);
      if (res) summary.push(res);
    }
    console.log('\n=== סיכום כללי של ההגירה ההיסטורית ===');
    console.table(summary.map(s => ({
      'שנה': s.year,
      'סך עסקאות שהועלו': s.totalCount,
      'ללא סיווג': s.uncategorizedCount
    })));
  } else {
    await migrateSingleYear(targetYear);
  }
}

run().catch(err => {
  console.error('\n❌ שגיאה בהגירה:', err);
  process.exit(1);
});
