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
const FILE_PATH = 'C:/Users/micha/Downloads/תקציב שנתי/סיכום הכנסות הוצאת - 2025 .xlsx';

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

function parseManualCell(cat, m, cell) {
  const val = Number(cell.v);
  const formula = cell.f || '';
  const rawComment = cell.c ? cell.c[0].t : '';
  const comment = cleanComment(rawComment);
  const date = `2025-${String(m).padStart(2, '0')}-01`;

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

  // 3. בריאות formula with + (e.g. 13.62 + 199.49)
  if (cat === 'בריאות' && formula.includes('+')) {
    const parts = formula.split('+').map(p => parseFloat(p)).filter(p => !isNaN(p));
    return parts.map((amt, idx) => ({
      date, payee: 'בריאות', amount: amt, category: 'בריאות', notes: 'סעיף בריאות ' + (idx + 1)
    }));
  }

  // 4. Other comments with breakdown (e.g. השקעות (בנק))
  if (comment) {
    const lines = comment.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);
    let parsedLines = [];
    for (const line of lines) {
      const match = line.match(/^([0-9,.]+)\s*₪?\s*[-–]\s*(.+)$/) || line.match(/^(.+?)\s*[-–]\s*([0-9,.]+)\s*₪?$/);
      if (match) {
        let amtStr = match[1], nameStr = match[2];
        if (isNaN(parseFloat(amtStr.replace(/,/g, '')))) {
          amtStr = match[2];
          nameStr = match[1];
        }
        const parsedAmt = parseFloat(amtStr.replace(/,/g, ''));
        if (!isNaN(parsedAmt)) {
          parsedLines.push({ name: nameStr.trim(), amount: parsedAmt });
        }
      }
    }
    const sumParsed = parsedLines.reduce((s, p) => s + p.amount, 0);
    if (parsedLines.length > 1 && Math.abs(sumParsed - val) < 50) {
      return parsedLines.map(pl => ({
        date, payee: pl.name, amount: pl.amount, category: cat, notes: pl.name + ' (מתוך הוצאה ידנית ' + cat + ')'
      }));
    }

    let payee = cat;
    const singleMatch = comment.match(/^([0-9,.]+)\s*₪?\s*[-–]\s*(.+)$/);
    if (singleMatch) {
      payee = singleMatch[2].trim();
    } else if (lines.length === 1 && lines[0].length < 40) {
      payee = lines[0].replace(/[-–]/g, '').trim();
    }
    return [{ date, payee, amount: val, category: cat, notes: comment }];
  }

  // Default
  return [{ date, payee: cat, amount: val, category: cat, notes: 'הוצאה ידנית' }];
}

async function runMigration() {
  console.log(`=============================================`);
  console.log(`🚀 מתחיל תהליך טעינת נתוני 2025 למשפחת ליארזי`);
  console.log(`קובץ מקור: ${FILE_PATH}`);
  console.log(`=============================================\n`);

  if (!fs.existsSync(FILE_PATH)) {
    throw new Error(`File not found: ${FILE_PATH}`);
  }

  const wb = XLSX.readFile(FILE_PATH);

  // 1. Fetch categories
  const { data: dbCats, error: catErr } = await supabase
    .from('categories')
    .select('id, name, type');
  if (catErr) throw catErr;

  const catMap = new Map();
  dbCats.forEach(c => catMap.set(c.name.trim(), c));

  function getCatId(name) {
    if (!name) return null;
    const clean = name.trim();
    if (catMap.has(clean)) return catMap.get(clean).id;
    // fallback aliases
    if (clean === 'השקעות (בנק)') return catMap.get('חיסכון (בנק)')?.id || catMap.get('חיסכון')?.id;
    if (clean === 'שכירות דירה') return catMap.get('קניית דירה/ שכירות')?.id;
    return null;
  }

  const transactionsToInsert = [];

  // 2. Process Incomes sheet
  console.log(`--- טוען הכנסות ומשכורות (לשונית הכנסות) ---`);
  const incSheet = wb.Sheets['הכנסות'];
  if (incSheet) {
    for (let m = 1; m <= 12; m++) {
      const r = m + 3; // rows 4 to 15
      const date = `2025-${String(m).padStart(2, '0')}-01`;

      // Col 1: Salaries (משכורות)
      const salCell = incSheet[XLSX.utils.encode_cell({ r, c: 1 })];
      if (salCell && Number(salCell.v) > 0) {
        const val = Number(salCell.v);
        const f = salCell.f || '';
        let michaelSalary = val;
        let ornaSalary = 0;

        if (f.includes('+')) {
          const parts = f.split('+').map(p => parseFloat(p)).filter(p => !isNaN(p));
          if (parts.length >= 2) {
            michaelSalary = Math.max(...parts);
            ornaSalary = Math.min(...parts);
          }
        }

        // Michael's Salary
        if (michaelSalary > 0) {
          transactionsToInsert.push({
            household_id: HOUSEHOLD_ID,
            date,
            amount: michaelSalary,
            category_id: getCatId('משכורת מיכאל'),
            transaction_type: 'income',
            payee_name: 'משכורת מיכאל',
            original_description: `משכורת מיכאל ${MONTHS_NAMES[m-1]} 2025`,
            payment_method: 'bank_transfer',
            notes: f ? `נוסחה מקורית: ${f}` : null
          });
        }

        // Orna's Salary
        if (ornaSalary > 0) {
          transactionsToInsert.push({
            household_id: HOUSEHOLD_ID,
            date,
            amount: ornaSalary,
            category_id: getCatId('משכורת אורנה'),
            transaction_type: 'income',
            payee_name: 'משכורת אורנה',
            original_description: `משכורת אורנה ${MONTHS_NAMES[m-1]} 2025`,
            payment_method: 'bank_transfer',
            notes: f ? `נוסחה מקורית: ${f}` : null
          });
        }
      }

      // Col 2: צבא
      const armyCell = incSheet[XLSX.utils.encode_cell({ r, c: 2 })];
      if (armyCell && Number(armyCell.v) > 0) {
        transactionsToInsert.push({
          household_id: HOUSEHOLD_ID,
          date,
          amount: Number(armyCell.v),
          category_id: getCatId('צבא'),
          transaction_type: 'income',
          payee_name: 'צבא',
          original_description: `הכנסה צבא ${MONTHS_NAMES[m-1]} 2025`,
          payment_method: 'bank_transfer',
          notes: armyCell.f ? `נוסחה: ${armyCell.f}` : null
        });
      }

      // Col 3: ביטוח לאומי
      const blCell = incSheet[XLSX.utils.encode_cell({ r, c: 3 })];
      if (blCell && Number(blCell.v) > 0) {
        transactionsToInsert.push({
          household_id: HOUSEHOLD_ID,
          date,
          amount: Number(blCell.v),
          category_id: getCatId('ביטוח לאומי'),
          transaction_type: 'income',
          payee_name: 'ביטוח לאומי',
          original_description: `קצבת ביטוח לאומי ${MONTHS_NAMES[m-1]} 2025`,
          payment_method: 'bank_transfer'
        });
      }

      // Col 4: החזר ביטוח
      const insCell = incSheet[XLSX.utils.encode_cell({ r, c: 4 })];
      if (insCell && Number(insCell.v) > 0) {
        const comment = insCell.c ? insCell.c[0].t.replace(/[\r\n]+/g, ' ') : '';
        transactionsToInsert.push({
          household_id: HOUSEHOLD_ID,
          date,
          amount: Number(insCell.v),
          category_id: getCatId('החזר ביטוח שיניים') || getCatId('ביטוח'),
          transaction_type: 'income',
          payee_name: comment || 'החזר ביטוח',
          original_description: `החזר ביטוח ${MONTHS_NAMES[m-1]} 2025`,
          payment_method: 'bank_transfer',
          notes: comment || null
        });
      }

      // Col 5: אחר
      const othCell = incSheet[XLSX.utils.encode_cell({ r, c: 5 })];
      if (othCell && Number(othCell.v) > 0) {
        const comment = othCell.c ? othCell.c[0].t.replace(/[\r\n]+/g, ' ') : '';
        transactionsToInsert.push({
          household_id: HOUSEHOLD_ID,
          date,
          amount: Number(othCell.v),
          category_id: getCatId('אחר'),
          transaction_type: 'income',
          payee_name: comment || 'הכנסה נוספת',
          original_description: `הכנסה אחרת ${MONTHS_NAMES[m-1]} 2025`,
          payment_method: 'bank_transfer',
          notes: (othCell.f ? `נוסחה: ${othCell.f} | ` : '') + comment
        });
      }
    }
  }

  // 3. Process Manual Expenses sheet
  console.log(`--- טוען הוצאות ידניות (לשונית הוצאות ידני) ---`);
  const manSheet = wb.Sheets['הוצאות ידני'];
  if (manSheet) {
    for (let r = 1; r <= 25; r++) {
      const catCell = manSheet[XLSX.utils.encode_cell({ r, c: 0 })];
      const cat = catCell ? catCell.v : '';
      if (!cat || String(cat).includes('סה"כ')) continue;

      for (let m = 1; m <= 12; m++) {
        const cell = manSheet[XLSX.utils.encode_cell({ r, c: m })];
        if (cell && cell.v !== undefined && cell.v !== '' && Number(cell.v) > 0) {
          const items = parseManualCell(cat, m, cell);
          for (const item of items) {
            transactionsToInsert.push({
              household_id: HOUSEHOLD_ID,
              date: item.date,
              amount: item.amount,
              category_id: getCatId(item.category),
              transaction_type: 'expense',
              payee_name: item.payee,
              original_description: `הוצאה ידנית: ${item.category} (${MONTHS_NAMES[m-1]} 2025)`,
              payment_method: 'bank_transfer',
              notes: item.notes
            });
          }
        }
      }
    }
  }

  // 4. Process Credit Card sheets 1..12
  console.log(`--- טוען עסקאות אשראי מפורטות (לשוניות 1 עד 12) ---`);
  for (let m = 1; m <= 12; m++) {
    const s = wb.Sheets[String(m)];
    if (!s) continue;
    const rows = XLSX.utils.sheet_to_json(s, { header: 1, defval: '' });

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[1] || String(r[1]).includes('סה"כ') || String(r[1]).includes('סה״כ')) continue;

      const payee = String(r[1]).trim();
      const rawAmt = parseFloat(r[8] || r[3] || r[12]);
      if (isNaN(rawAmt) || rawAmt === 0) continue;
      const amount = Math.abs(rawAmt);

      const catName = String(r[11] || '').trim();
      const category_id = getCatId(catName);

      // Determine day of month
      let day = 2; // default
      const txDateStr = String(r[2] || '');
      const billDateStr = String(r[7] || '');
      const dateMatch = txDateStr.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/) ||
                        billDateStr.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
      if (dateMatch) {
        const d = parseInt(dateMatch[1], 10);
        if (d >= 1 && d <= 28) day = d;
      }

      const date = `2025-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const cardType = String(r[10] || '').trim();
      const rawCard = String(r[0] || '').trim();
      const cardLastDigits = extractLastDigits(rawCard);

      let noteParts = [];
      if (r[6]) noteParts.push(`פירוט: ${r[6]}`);
      if (r[9]) noteParts.push(`נוסף: ${r[9]}`);
      if (r[13]) noteParts.push(`הערה: ${r[13]}`);
      if (txDateStr) noteParts.push(`תאריך עסקה: ${txDateStr}`);
      if (billDateStr) noteParts.push(`תאריך חיוב: ${billDateStr}`);

      transactionsToInsert.push({
        household_id: HOUSEHOLD_ID,
        date,
        amount,
        category_id,
        transaction_type: 'expense',
        payee_name: payee,
        original_description: payee,
        payment_method: cardType || 'credit_card',
        card_last_digits: cardLastDigits,
        notes: noteParts.length > 0 ? noteParts.join(' | ') : null
      });
    }
  }

  console.log(`\n=============================================`);
  console.log(`סה"כ עסקאות שנאספו לטעינה: ${transactionsToInsert.length}`);
  const totalIncome = transactionsToInsert
    .filter(t => t.transaction_type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactionsToInsert
    .filter(t => t.transaction_type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  console.log(`סה"כ הכנסות (כולל משכורות מופרדות): ₪${totalIncome.toLocaleString('he-IL', { minimumFractionDigits: 2 })}`);
  console.log(`סה"כ הוצאות (אשראי + ידני): ₪${totalExpense.toLocaleString('he-IL', { minimumFractionDigits: 2 })}`);
  console.log(`=============================================\n`);

  // 4.5 Clean existing 2025 transactions for household to prevent duplicates
  console.log(`בודק ומנקה תנועות קיימות לשנת 2025 כדי למנוע כפילויות...`);
  const { error: delExistingErr } = await supabase
    .from('transactions')
    .delete()
    .eq('household_id', HOUSEHOLD_ID)
    .gte('date', '2025-01-01')
    .lte('date', '2025-12-31');
  if (delExistingErr) {
    console.warn(`הערה בניקוי תנועות קודמות:`, delExistingErr.message);
  }

  // 5. Batch insert into database
  console.log(`מבצע הזרקה לבסיס הנתונים בקבוצות של 100...`);
  const CHUNK_SIZE = 100;
  let insertedCount = 0;

  for (let i = 0; i < transactionsToInsert.length; i += CHUNK_SIZE) {
    const chunk = transactionsToInsert.slice(i, i + CHUNK_SIZE);
    const { error: insErr } = await supabase.from('transactions').insert(chunk);
    if (insErr) {
      console.error(`שגיאה בהזרקת מקטע ${i} - ${i + chunk.length}:`, insErr.message);
      throw insErr;
    }
    insertedCount += chunk.length;
    process.stdout.write(`\rנשמרו בהצלחה ${insertedCount} / ${transactionsToInsert.length} עסקאות...`);
  }
  console.log(`\n✓ כל ${insertedCount} העסקאות נשמרו בהצלחה בטבלת transactions!`);

  // 6. Savings records for 2025
  console.log(`\n--- עדכון טבלת חיסכון (savings) לשנת 2025 ---`);
  const savingsRecords = [
    {
      household_id: HOUSEHOLD_ID,
      account_name: 'מיטב דש',
      institution: 'מיטב דש',
      year: 2025,
      opening_balance: 821195.10,
      closing_balance: 901372.00,
      notes: 'רווח שנתי ₪80,176.90 (9.76%)'
    },
    {
      household_id: HOUSEHOLD_ID,
      account_name: 'בנק פקדונות',
      institution: 'בנק',
      year: 2025,
      opening_balance: 471585.85,
      closing_balance: 361259.51,
      notes: 'פער ₪-110,326.34'
    },
    {
      household_id: HOUSEHOLD_ID,
      account_name: 'בנק שוק הון',
      institution: 'בנק',
      year: 2025,
      opening_balance: 318644.21,
      closing_balance: 711538.09,
      notes: 'רווח וגידול ₪392,893.88 (123.3%)'
    }
  ];

  for (const sav of savingsRecords) {
    const { error: savErr } = await supabase.from('savings').upsert(sav, {
      onConflict: 'household_id,account_name,year'
    });
    if (savErr) {
      console.warn(`הערה בעדכון חיסכון ${sav.account_name}:`, savErr.message);
    } else {
      console.log(`✓ חיסכון ${sav.account_name} עודכן בהצלחה!`);
    }
  }

  console.log(`\n🎉 טעינת שנת 2025 הסתיימה בהצלחה מלאה!`);
}

runMigration().catch(err => {
  console.error('\n❌ שגיאה בטעינת נתוני 2025:', err);
  process.exit(1);
});
