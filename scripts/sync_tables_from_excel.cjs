const XLSX = require('xlsx');
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

const filePath = 'C:/Users/micha/Downloads/תקציב שנתי/סיכום הכנסות הוצאת - 2025 .xlsx';

// Macro category definitions
const MACROS_DEF = [
  { name: 'הוצאות קבועות', type: 'expense', color: '#4F46E5', icon: 'Lock', order: 1 },
  { name: 'הוצאות משתנות', type: 'expense', color: '#F59E0B', icon: 'ShoppingBag', order: 2 },
  { name: 'הוצאות עונתיות ומשפחה', type: 'expense', color: '#EC4899', icon: 'Calendar', order: 3 },
  { name: 'חיסכון והשקעות', type: 'expense', color: '#06B6D4', icon: 'PiggyBank', order: 4 },
  { name: 'משכורות והכנסות', type: 'income', color: '#10B981', icon: 'TrendingUp', order: 5 },
];

// Mapping category name to macro name
const CAT_TO_MACRO = {
  'ביטוח': 'הוצאות קבועות',
  'רכב ותחבורה': 'הוצאות קבועות',
  'הלוואות ומשכנתא': 'הוצאות קבועות',
  'שירותי בנקאות': 'הוצאות קבועות',
  'שכירות דירה': 'הוצאות קבועות',
  'קניית דירה/ שכירות': 'הוצאות קבועות',

  'מזון ומשקאות': 'הוצאות משתנות',
  'ביגוד והנעלה': 'הוצאות משתנות',
  'בריאות': 'הוצאות משתנות',
  'בית וגן': 'הוצאות משתנות',
  'מוצרי חשמל ותקשורת': 'הוצאות משתנות',
  'בילוי ומסעדות': 'הוצאות משתנות',
  'מתנות ומזכרות': 'הוצאות משתנות',
  'שונות': 'הוצאות משתנות',
  'מזומן': 'הוצאות משתנות',

  'נופש': 'הוצאות עונתיות ומשפחה',
  'חוגים': 'הוצאות עונתיות ומשפחה',
  'חינוך ומשפחה': 'הוצאות עונתיות ומשפחה',
  'ילדים': 'הוצאות עונתיות ומשפחה',
  'בית ספר': 'הוצאות עונתיות ומשפחה',
  'מטפלת/ מעון': 'הוצאות עונתיות ומשפחה',
  'תרבות ופנאי': 'הוצאות עונתיות ומשפחה',

  'חיסכון': 'חיסכון והשקעות',
  'חיסכון (בנק)': 'חיסכון והשקעות',
  'חיסכון (מיטב)': 'חיסכון והשקעות',
  'השקעות (בנק)': 'חיסכון והשקעות',

  'משכורות': 'משכורות והכנסות',
  'משכורת מיכאל': 'משכורות והכנסות',
  'משכורת אורנה': 'משכורות והכנסות',
  'צבא': 'משכורות והכנסות',
  'ביטוח לאומי': 'משכורות והכנסות',
  'החזר ביטוח שיניים': 'משכורות והכנסות',
  'אחר': 'משכורות והכנסות',
};

async function syncTables() {
  console.log('=== עדכון טבלאות מערכת על בסיס לשונית טבלאות ===\n');

  // 1. Ensure Household
  let { data: hhs } = await supabase.from('households').select('*');
  let household = hhs && hhs.length > 0 ? hhs[0] : null;

  if (!household) {
    console.log('יוצר משק בית ראשי: משפחת ליארזי (אורנה ומיכאל)...');
    const { data: newHh, error: hhErr } = await supabase
      .from('households')
      .insert({
        name: 'משפחת ליארזי (אורנה ומיכאל)',
        currency: 'ILS',
      })
      .select()
      .single();

    if (hhErr) {
      throw new Error(`Failed to create household: ${hhErr.message}`);
    }
    household = newHh;
  }

  const hhId = household.id;
  console.log(`✓ משק בית פעיל: ${household.name} (ID: ${hhId})`);

  // 2. Read Sheet 'טבלאות'
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets['טבלאות'];
  if (!sheet) {
    throw new Error("Sheet 'טבלאות' not found in Excel file!");
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // 3. Upsert Macro Categories
  console.log('\n1. מעדכן קבוצות על (Macro Categories)...');
  const macroMap = {}; // name -> id
  for (const m of MACROS_DEF) {
    const { data: existing } = await supabase
      .from('macro_categories')
      .select('id')
      .eq('household_id', hhId)
      .eq('name', m.name)
      .maybeSingle();

    if (existing) {
      macroMap[m.name] = existing.id;
    } else {
      const { data: created } = await supabase
        .from('macro_categories')
        .insert({
          household_id: hhId,
          name: m.name,
          type: m.type,
          color: m.color,
          icon: m.icon,
          display_order: m.order,
        })
        .select()
        .single();
      if (created) macroMap[m.name] = created.id;
    }
  }
  console.log(`✓ קבוצות על הוגדרו בהצלחה: ${Object.keys(macroMap).length}`);

  // 4. Extract categories from sheet
  const expenseCatNames = new Set();
  const incomeCatNames = new Set(['משכורת מיכאל', 'משכורת אורנה']); // Add dedicated split salary categories
  const merchantRules = [];
  const cardRules = [];

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    if (row[0] && String(row[0]).trim()) expenseCatNames.add(String(row[0]).trim());
    if (row[2] && String(row[2]).trim()) incomeCatNames.add(String(row[2]).trim());
    if (row[6] && row[7]) {
      merchantRules.push({
        merchant: String(row[6]).trim(),
        category: String(row[7]).trim()
      });
    }
    if (row[9] && row[10]) {
      cardRules.push({
        source: String(row[9]).trim(),
        targetCard: String(row[10]).trim()
      });
    }
  }

  // 5. Insert Categories
  console.log('\n2. מעדכן קטגוריות הוצאה והכנסה...');
  const catMap = {}; // name -> id

  // Process Expense Categories
  for (const name of expenseCatNames) {
    const macroName = CAT_TO_MACRO[name] || 'הוצאות משתנות';
    const macroId = macroMap[macroName] || null;

    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('household_id', hhId)
      .eq('name', name)
      .eq('type', 'expense')
      .maybeSingle();

    if (existing) {
      catMap[name] = existing.id;
    } else {
      const { data: created } = await supabase
        .from('categories')
        .insert({
          household_id: hhId,
          name,
          type: 'expense',
          macro_category_id: macroId,
        })
        .select()
        .single();
      if (created) catMap[name] = created.id;
    }
  }

  // Process Income Categories
  for (const name of incomeCatNames) {
    const macroId = macroMap['משכורות והכנסות'] || null;

    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('household_id', hhId)
      .eq('name', name)
      .eq('type', 'income')
      .maybeSingle();

    if (existing) {
      catMap[name] = existing.id;
    } else {
      const { data: created } = await supabase
        .from('categories')
        .insert({
          household_id: hhId,
          name,
          type: 'income',
          macro_category_id: macroId,
        })
        .select()
        .single();
      if (created) catMap[name] = created.id;
    }
  }
  console.log(`✓ קטגוריות הוגדרו בהצלחה: ${Object.keys(catMap).length}`);

  // 6. Insert Card Mappings
  console.log('\n3. מעדכן כרטיסי אשראי ומקורות תשלום...');
  let cardCount = 0;
  for (const c of cardRules) {
    const digitsMatch = c.source.match(/(\d{4})/);
    const lastDigits = digitsMatch ? digitsMatch[1] : null;

    const { data: existing } = await supabase
      .from('payment_method_mappings')
      .select('id')
      .eq('household_id', hhId)
      .eq('raw_pattern', c.source)
      .maybeSingle();

    if (!existing) {
      await supabase
        .from('payment_method_mappings')
        .insert({
          household_id: hhId,
          raw_pattern: c.source,
          display_name: c.targetCard,
          card_last_digits: lastDigits,
          payment_type: 'credit_card',
        });
      cardCount++;
    }
  }
  console.log(`✓ כללי כרטיסים נשמרו: ${cardCount} חדשים (מתוך ${cardRules.length})`);

  // 7. Insert Business Mappings
  console.log('\n4. מעדכן כללי מיפוי בתי עסק (1,308 כללים)...');
  let bmBatch = [];
  let bmInserted = 0;

  for (const rule of merchantRules) {
    const catId = catMap[rule.category] || catMap['שונות'] || null;
    if (!catId) continue;

    bmBatch.push({
      household_id: hhId,
      pattern: rule.merchant,
      category_id: catId,
      priority: 10,
      is_regex: false,
    });

    if (bmBatch.length >= 100) {
      const { error } = await supabase.from('business_mapping').insert(bmBatch);
      if (error) console.warn('Batch error:', error.message);
      else bmInserted += bmBatch.length;
      bmBatch = [];
    }
  }

  if (bmBatch.length > 0) {
    const { error } = await supabase.from('business_mapping').insert(bmBatch);
    if (!error) bmInserted += bmBatch.length;
  }

  console.log(`✓ כללי בתי עסק שנטענו בהצלחה: ${bmInserted}`);
  console.log('\n=== סיום עדכון טבלאות מערכת בהצלחה! ===');
}

syncTables().catch(err => {
  console.error('Error syncing tables:', err);
});
