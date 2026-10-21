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
  const date = `${year}-${String(m).padStart(2, '0')}-01`;

  // 1. חיסכון formula with + (e.g. 650.85 + 1000)
  if (cat === 'חיסכון' && formula.includes('+')) {
    const parts = formula.split('+').map(p => parseFloat(p)).filter(p => !isNaN(p));
    return [
      { date, payee: 'מקפת', amount: parts[0], category: 'חיסכון', notes: 'מקפת (' + comment.replace(/[\r\n]+/g, ', ') + ')' },
      { date, payee: 'אקסלנס גמל להשקעה', amount: parts[1] || 1000, category: 'חיסכון', notes: 'אקסלנס גמל להשקעה' }
    ];
  }

  // 2. בית וגן formula with + (ארנונה + מים)
  if (cat === 'בית וגן' && formula.includes('+')) {
    const parts = formula.split('+').map(p => parseFloat(p)).filter(p => !isNaN(p));
    const arnona = Math.max(...parts);
    const mayim = Math.min(...parts);
    return [
      { date, payee: 'ארנונה', amount: arnona, category: 'בית וגן', notes: 'ארנונה (' + comment.replace(/[\r\n]+/g, ', ') + ')' },
      { date, payee: 'הבאר השלישית (מים)', amount: mayim, category: 'בית וגן', notes: 'הבאר השלישית (מים)' }
    ];
  }

  // 3. בריאות formula with + (e.g. 1000.92 + 200)
  if (cat === 'בריאות' && formula.includes('+')) {
    const parts = formula.split('+').map(p => parseFloat(p)).filter(p => !isNaN(p));
    return parts.map((amt, idx) => ({
      date,
      payee: idx === 0 ? 'כללית מושלם' : 'הוצאת בריאות נוספת',
      amount: amt,
      category: 'בריאות',
      notes: comment ? comment.replace(/[\r\n]+/g, ', ') : `בריאות חלק ${idx + 1}`
    }));
  }

  // Single cell
  let payee = cat;
  if (cat === 'ביטוח' && comment) payee = comment.split('\n')[0].trim();
  else if (cat === 'חוגים' && comment.includes('פילאטיס')) payee = 'סטודיו פילאטיס';
  else if (cat === 'חיסכון (מיטב)') payee = 'הפקדה למיטב טרייד';

  return [{
    date,
    payee,
    amount: val,
    category: cat,
    notes: comment ? comment.replace(/[\r\n]+/g, ', ') : ''
  }];
}

async function migrateSingleYear(year) {
  console.log(`\n=================================================`);
  console.log(`🚀 מתחיל תהליך הגירה וטעינה לשנת ${year}`);
  console.log(`=================================================`);

  // Locate file
  const fileNamePossibilities = [
    `סיכום הכנסות הוצאת - ${year}.xlsx`,
    `סיכום הכנסות הוצאת - ${year} .xlsx`
  ];
  let filePath = null;
  for (const fn of fileNamePossibilities) {
    const cand = path.join(BASE_DIR, fn);
    if (fs.existsSync(cand)) {
      filePath = cand;
      break;
    }
  }

  if (!filePath) {
    console.error(`❌ לא נמצא קובץ אקסל עבור שנת ${year} בתיקייה: ${BASE_DIR}`);
    return null;
  }

  console.log(`קובץ מקור: ${filePath}`);
  const wb = XLSX.readFile(filePath);

  // 1. Fetch Categories and Mappings from Supabase
  const { data: dbCategories, error: catErr } = await supabase
    .from('categories')
    .select('id, name, macro_category_id');

  if (catErr || !dbCategories) {
    throw new Error('שגיאה בטעינת קטגוריות מה-DB: ' + (catErr ? catErr.message : 'ריק'));
  }

  const catMap = new Map();
  dbCategories.forEach(c => {
    if (c && c.name) {
      catMap.set(String(c.name).trim(), c.id);
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
        const catName = String(cCell.v).trim();
        const catId = catMap.get(catName);
        if (catId && !busMap.has(busName)) {
          busMap.set(busName, catId);
        }
      }
    }
  }

  const transactionsToInsert = [];
  const uncategorizedItems = [];

  // 2. PARSE INCOME SHEET
  const incSheet = wb.Sheets['הכנסות'];
  if (incSheet) {
    console.log(`מנתח הכנסות ומשכורות לשנת ${year}...`);
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
            category_id: catMap.get(catName) || fallbackCatId,
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
            let catId = catMap.get(item.category);
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

  // 4. PARSE CREDIT CARDS TRANSACTIONS (Sheets 1 to 12)
  console.log(`מנתח עסקאות כרטיסי אשראי (חודשים 1 עד 12) לשנת ${year}...`);
  for (let m = 1; m <= 12; m++) {
    const s = wb.Sheets[String(m)];
    if (!s) continue;
    const range = XLSX.utils.decode_range(s['!ref'] || 'A1:H100');

    for (let r = 1; r <= range.e.r; r++) {
      const cardCell = s[XLSX.utils.encode_cell({ r, c: 0 })];
      const payeeCell = s[XLSX.utils.encode_cell({ r, c: 1 })];
      const dateCell = s[XLSX.utils.encode_cell({ r, c: 2 })];
      const amountCell = s[XLSX.utils.encode_cell({ r, c: 3 })];
      const detailsCell = s[XLSX.utils.encode_cell({ r, c: 6 })];

      if (!payeeCell || !amountCell || amountCell.v === undefined) continue;

      const payeeRaw = String(payeeCell.v).trim();
      const payeeNorm = payeeRaw.toLowerCase();
      const amount = Number(amountCell.v);
      if (isNaN(amount) || amount === 0) continue;

      // Parse Date
      let txDate = `${year}-${String(m).padStart(2, '0')}-01`;
      if (dateCell) {
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
      const cardStr = cardCell ? String(cardCell.v).trim() : '';
      const cardDigits = extractLastDigits(cardStr);

      // Match Category
      let catId = busMap.get(payeeNorm);
      const isUncategorized = !catId;

      if (!catId) {
        catId = fallbackCatId;
        uncategorizedItems.push({
          year,
          month: m,
          date: txDate,
          payee: payeeRaw,
          amount,
          card: cardStr,
          details: detailsCell ? String(detailsCell.v).trim() : ''
        });
      }

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
        notes: [
          cardStr ? `כרטיס: ${cardStr}` : '',
          detailsCell?.v ? String(detailsCell.v).trim() : '',
          isUncategorized ? '[דורש סיווג]' : ''
        ].filter(Boolean).join(' | '),
        is_hidden: false
      });
    }
  }

  console.log(`\nסך הכל נאספו ${transactionsToInsert.length} עסקאות לשנת ${year}.`);
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

  console.log(`מזריק ${transactionsToInsert.length} עסקאות ב-batches של 100...`);
  const CHUNK = 100;
  let inserted = 0;
  for (let i = 0; i < transactionsToInsert.length; i += CHUNK) {
    const chunk = transactionsToInsert.slice(i, i + CHUNK);
    const { error: insErr } = await supabase.from('transactions').insert(chunk);
    if (insErr) {
      console.error(`שגיאה בהזרקת מקטע ${i}:`, insErr.message);
      throw insErr;
    }
    inserted += chunk.length;
    process.stdout.write(`\rנשמרו: ${inserted} / ${transactionsToInsert.length}...`);
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
  const targetYear = process.argv[2] || '2024';
  if (targetYear === 'all') {
    const years = ['2024', '2023', '2022', '2021', '2020'];
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
