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
const PARENT_HOME_GARDEN_ID = '1225d468-3be6-44cd-9685-969be28b8294';
const MACRO_FIXED_ID = '4e455730-3ae8-4228-9374-d36b10807b03';     // הוצאות קבועות
const MACRO_VARIABLE_ID = '1814a98e-5ac1-4a92-8fb0-f415d0422bcc';  // הוצאות משתנות

async function run() {
  console.log("Checking categories in Supabase via Admin Client...");
  const { data: cats, error: catErr } = await supabase
    .from('categories')
    .select('*')
    .eq('household_id', HOUSEHOLD_ID);

  if (catErr) {
    console.error("Error fetching categories:", catErr);
    return;
  }

  const parentCat = cats.find(c => c.id === PARENT_HOME_GARDEN_ID);
  console.log("Parent Category:", parentCat?.name, parentCat?.id);

  // Check if child categories already exist
  let fixedChild = cats.find(c => c.name === 'חשבונות ומיסי בית' && c.parent_id === PARENT_HOME_GARDEN_ID);
  if (!fixedChild) {
    console.log("Creating child category: חשבונות ומיסי בית (Fixed)...");
    const { data: newCat, error: insertErr } = await supabase
      .from('categories')
      .insert({
        household_id: HOUSEHOLD_ID,
        name: 'חשבונות ומיסי בית',
        type: 'expense',
        color: '#3B82F6',
        icon: 'home',
        parent_id: PARENT_HOME_GARDEN_ID,
        macro_category_id: MACRO_FIXED_ID,
        is_system: false
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Error creating fixed child category:", insertErr);
      return;
    }
    fixedChild = newCat;
    console.log("Created fixed child category:", fixedChild.id);
  } else {
    console.log("Found existing fixed child category:", fixedChild.id);
    await supabase.from('categories').update({
      parent_id: PARENT_HOME_GARDEN_ID,
      macro_category_id: MACRO_FIXED_ID
    }).eq('id', fixedChild.id);
  }

  let variableChild = cats.find(c => c.name === 'תחזוקה, ציוד וגינה' && c.parent_id === PARENT_HOME_GARDEN_ID);
  if (!variableChild) {
    console.log("Creating child category: תחזוקה, ציוד וגינה (Variable)...");
    const { data: newCat, error: insertErr } = await supabase
      .from('categories')
      .insert({
        household_id: HOUSEHOLD_ID,
        name: 'תחזוקה, ציוד וגינה',
        type: 'expense',
        color: '#10B981',
        icon: 'wrench',
        parent_id: PARENT_HOME_GARDEN_ID,
        macro_category_id: MACRO_VARIABLE_ID,
        is_system: false
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Error creating variable child category:", insertErr);
      return;
    }
    variableChild = newCat;
    console.log("Created variable child category:", variableChild.id);
  } else {
    console.log("Found existing variable child category:", variableChild.id);
    await supabase.from('categories').update({
      parent_id: PARENT_HOME_GARDEN_ID,
      macro_category_id: MACRO_VARIABLE_ID
    }).eq('id', variableChild.id);
  }

  // Fetch all transactions currently under PARENT_HOME_GARDEN_ID
  console.log("\nFetching transactions for parent 'בית וגן'...");
  let allTx = [];
  let from = 0;
  const batchSize = 1000;
  while (true) {
    const { data: txBatch, error: txErr } = await supabase
      .from('transactions')
      .select('id, date, amount, original_description, payee_name, notes, category_id')
      .eq('household_id', HOUSEHOLD_ID)
      .eq('category_id', PARENT_HOME_GARDEN_ID)
      .range(from, from + batchSize - 1);

    if (txErr) {
      console.error("Error fetching transactions:", txErr);
      return;
    }
    if (!txBatch || txBatch.length === 0) break;
    allTx = allTx.concat(txBatch);
    if (txBatch.length < batchSize) break;
    from += batchSize;
  }

  console.log(`Found ${allTx.length} transactions currently under parent 'בית וגן'.`);

  const fixedKeywords = ['ארנונה', 'הבאר השלישית', 'מיים', 'מים', 'ועד בית', 'שטראוס מים', 'תמי 4', 'תמי4'];

  const fixedTxIds = [];
  const varTxIds = [];

  for (const tx of allTx) {
    const text = ((tx.payee_name || '') + ' ' + (tx.original_description || '') + ' ' + (tx.notes || '')).toLowerCase();
    const isFixed = fixedKeywords.some(kw => text.includes(kw));
    if (isFixed) {
      fixedTxIds.push(tx.id);
    } else {
      varTxIds.push(tx.id);
    }
  }

  console.log(`Classified: ${fixedTxIds.length} into 'חשבונות ומיסי בית' (Fixed), ${varTxIds.length} into 'תחזוקה, ציוד וגינה' (Variable).`);

  // Batch update transactions
  if (fixedTxIds.length > 0) {
    for (let i = 0; i < fixedTxIds.length; i += 200) {
      const chunk = fixedTxIds.slice(i, i + 200);
      const { error: updErr } = await supabase
        .from('transactions')
        .update({ category_id: fixedChild.id })
        .in('id', chunk);
      if (updErr) console.error("Error updating fixed chunk:", updErr);
    }
    console.log(`Updated ${fixedTxIds.length} transactions to 'חשבונות ומיסי בית'`);
  }

  if (varTxIds.length > 0) {
    for (let i = 0; i < varTxIds.length; i += 200) {
      const chunk = varTxIds.slice(i, i + 200);
      const { error: updErr } = await supabase
        .from('transactions')
        .update({ category_id: variableChild.id })
        .in('id', chunk);
      if (updErr) console.error("Error updating variable chunk:", updErr);
    }
    console.log(`Updated ${varTxIds.length} transactions to 'תחזוקה, ציוד וגינה'`);
  }

  // Update business_mapping
  console.log("\nUpdating business_mapping rules...");
  const { data: mappings } = await supabase
    .from('business_mapping')
    .select('*')
    .eq('household_id', HOUSEHOLD_ID)
    .eq('category_id', PARENT_HOME_GARDEN_ID);

  console.log(`Found ${mappings ? mappings.length : 0} business mappings currently pointing to parent 'בית וגן'.`);

  if (mappings && mappings.length > 0) {
    for (const m of mappings) {
      const pat = m.pattern.toLowerCase();
      const isFixed = fixedKeywords.some(kw => pat.includes(kw));
      const targetCatId = isFixed ? fixedChild.id : variableChild.id;
      await supabase
        .from('business_mapping')
        .update({ category_id: targetCatId })
        .eq('id', m.id);
      console.log(`Updated mapping pattern "${m.pattern}" -> ${isFixed ? 'חשבונות ומיסי בית' : 'תחזוקה, ציוד וגינה'}`);
    }
  }

  // Add specific mappings if missing
  const newMappings = [
    { pattern: 'ארנונה', category_id: fixedChild.id },
    { pattern: 'הבאר השלישית', category_id: fixedChild.id },
    { pattern: 'שטראוס מים', category_id: fixedChild.id },
    { pattern: 'ועד בית', category_id: fixedChild.id },
    { pattern: 'הום סנטר', category_id: variableChild.id },
    { pattern: 'טמבור', category_id: variableChild.id },
    { pattern: 'זר פור יו', category_id: variableChild.id },
    { pattern: 'KSP', category_id: variableChild.id }
  ];

  for (const nm of newMappings) {
    const { data: existing } = await supabase
      .from('business_mapping')
      .select('id')
      .eq('household_id', HOUSEHOLD_ID)
      .ilike('pattern', nm.pattern);
    if (!existing || existing.length === 0) {
      await supabase.from('business_mapping').insert({
        household_id: HOUSEHOLD_ID,
        pattern: nm.pattern,
        category_id: nm.category_id,
        priority: 10
      });
      console.log(`Inserted new mapping "${nm.pattern}"`);
    }
  }

  console.log("\nSplit successfully completed!");
}

run();
