import { supabase, isSupabaseConfigured } from '../supabase';
import { Transaction } from '../types';

export interface BulkInsertResult {
  success: boolean;
  insertedCount: number;
  insertedTransactions: Transaction[];
  error?: string;
}

/**
 * Performs resilient chunked bulk insertion into the Supabase 'transactions' table.
 * Chunks are limited to 100 records each to ensure reliability.
 */
export async function bulkInsertTransactions(
  householdId: string,
  transactions: Partial<Transaction>[],
  isDemoMode: boolean = false,
  onProgress?: (completed: number, total: number) => void
): Promise<BulkInsertResult> {
  const total = transactions.length;
  if (total === 0) {
    return { success: true, insertedCount: 0, insertedTransactions: [] };
  }

  // Format transactions ready for insertion
  const formattedTransactions: Transaction[] = transactions.map((t, index) => ({
    id: t.id || `tx-${Date.now()}-${index}`,
    household_id: householdId,
    date: t.date || new Date().toISOString().split('T')[0],
    billing_date: t.billing_date || null,
    amount: Number(t.amount) || 0,
    original_amount: t.original_amount !== undefined ? Number(t.original_amount) : Number(t.amount) || 0,
    original_currency: t.original_currency || 'ILS',
    category_id: t.category_id || null,
    transaction_type: t.transaction_type || 'expense',
    payee_name: String(t.payee_name || '').trim() || 'Unknown Payee',
    original_description: t.original_description || null,
    payment_method: t.payment_method || 'credit_card',
    card_last_digits: t.card_last_digits || null,
    reference_number: t.reference_number || null,
    is_hidden: Boolean(t.is_hidden), // Respects the row hiding toggle
    notes: t.notes || null,
    created_by: t.created_by || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  if (isDemoMode || !isSupabaseConfigured) {
    // In Demo / Offline mode: simulate progress
    for (let i = 0; i < total; i += 25) {
      const current = Math.min(i + 25, total);
      onProgress?.(current, total);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return {
      success: true,
      insertedCount: total,
      insertedTransactions: formattedTransactions,
    };
  }

  const CHUNK_SIZE = 100;
  let insertedSoFar = 0;

  try {
    for (let i = 0; i < total; i += CHUNK_SIZE) {
      const chunk = formattedTransactions.slice(i, i + CHUNK_SIZE);
      const payload = chunk.map((tx) => ({
        household_id: tx.household_id,
        date: tx.date,
        amount: tx.amount,
        category_id: tx.category_id,
        transaction_type: tx.transaction_type,
        payee_name: tx.payee_name,
        original_description: tx.original_description,
        payment_method: tx.payment_method,
        card_last_digits: tx.card_last_digits,
        is_hidden: tx.is_hidden,
        notes: tx.notes,
      }));

      const { data, error } = await supabase
        .from('transactions')
        .insert(payload)
        .select();

      if (error) {
        console.error('Supabase bulk insert chunk error:', error.message);
        throw new Error(`Database error on row ${i + 1}-${i + chunk.length}: ${error.message}`);
      }

      insertedSoFar += chunk.length;
      onProgress?.(insertedSoFar, total);
    }

    return {
      success: true,
      insertedCount: insertedSoFar,
      insertedTransactions: formattedTransactions,
    };
  } catch (err: any) {
    return {
      success: false,
      insertedCount: insertedSoFar,
      insertedTransactions: formattedTransactions.slice(0, insertedSoFar),
      error: err.message || 'Failed to bulk insert transactions into database',
    };
  }
}
