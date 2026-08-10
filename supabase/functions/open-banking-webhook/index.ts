// Follow this setup guide to deploy with Supabase CLI:
// https://supabase.com/docs/guides/functions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

interface ExternalTransactionPayload {
  source_reference_id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  type?: 'expense' | 'income' | 'transfer';
  payee_name: string;
  original_description?: string;
  payment_method?: string;
  card_last_digits?: string;
  notes?: string;
}

interface WebhookBody {
  household_id: string;
  bank_account_id: string;
  account_provider?: string;
  new_balance?: number;
  transactions: ExternalTransactionPayload[];
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Validate HTTP Method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method Not Allowed. Use POST.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Webhook Secret Validation
    const webhookSecret = req.headers.get('x-webhook-secret');
    const expectedSecret = Deno.env.get('OPEN_BANKING_WEBHOOK_SECRET');

    if (expectedSecret && webhookSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid Webhook Secret.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Parse Request Body
    const body: WebhookBody = await req.json();
    const { household_id, bank_account_id, transactions, new_balance } = body;

    if (!household_id || !bank_account_id || !Array.isArray(transactions)) {
      return new Response(
        JSON.stringify({ error: 'Invalid payload: household_id, bank_account_id, and transactions array are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 6. Fetch Business Mappings for Auto-Classification
    const { data: mappings, error: mapErr } = await supabase
      .from('business_mapping')
      .select('pattern, category_id, priority')
      .eq('household_id', household_id)
      .order('priority', { ascending: false });

    if (mapErr) {
      console.warn('Could not fetch business mappings:', mapErr.message);
    }

    // 7. Auto-Classify & Format Canonical Transactions
    const nowIso = new Date().toISOString();
    let autoClassifiedCount = 0;

    const canonicalTransactions = transactions.map((extTx) => {
      let matchedCategoryId: string | null = null;
      const cleanPayee = (extTx.payee_name || '').trim();
      const payeeUpper = cleanPayee.toUpperCase();

      // Evaluate classification rules
      if (mappings && mappings.length > 0) {
        for (const rule of mappings) {
          if (rule.pattern && payeeUpper.includes(rule.pattern.toUpperCase())) {
            matchedCategoryId = rule.category_id;
            autoClassifiedCount++;
            break;
          }
        }
      }

      return {
        id: `tx-ob-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        household_id,
        bank_account_id,
        source_reference_id: extTx.source_reference_id || `ob-ref-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        date: extTx.date || nowIso.split('T')[0],
        amount: Math.abs(extTx.amount || 0),
        category_id: matchedCategoryId,
        transaction_type: extTx.type || (extTx.amount < 0 ? 'expense' : 'expense'),
        payee_name: cleanPayee || 'Open Banking Transaction',
        original_description: extTx.original_description || 'Direct Open Banking Sync',
        payment_method: extTx.payment_method || 'credit_card',
        card_last_digits: extTx.card_last_digits || null,
        is_hidden: false,
        notes: extTx.notes || null,
        created_at: nowIso,
        updated_at: nowIso,
      };
    });

    // 8. Bulk Upsert Transactions (Deduplication via source_reference_id)
    const { data: insertedData, error: insertErr } = await supabase
      .from('transactions')
      .upsert(canonicalTransactions, {
        onConflict: 'household_id, source_reference_id',
        ignoreDuplicates: true,
      })
      .select('id');

    if (insertErr) {
      console.error('Failed to insert Open Banking transactions:', insertErr);
      throw new Error(`Database insertion failed: ${insertErr.message}`);
    }

    // 9. Update Bank Account Sync Status & Balance
    const updatePayload: Record<string, any> = {
      last_synced_at: nowIso,
      sync_status: 'active',
    };
    if (typeof new_balance === 'number') {
      updatePayload.current_balance = new_balance;
    }

    const { error: accErr } = await supabase
      .from('bank_accounts')
      .update(updatePayload)
      .eq('id', bank_account_id);

    if (accErr) {
      console.warn('Notice: Could not update bank_accounts sync state:', accErr.message);
    }

    // 10. Return Structured Success Response
    const responsePayload = {
      success: true,
      received_count: transactions.length,
      inserted_count: insertedData?.length || 0,
      auto_classified_count: autoClassifiedCount,
      bank_account_id,
      synced_at: nowIso,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Open Banking webhook execution error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
