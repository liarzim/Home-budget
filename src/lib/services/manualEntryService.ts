import { supabase, isSupabaseConfigured } from '../supabase';
import { ManualEntryFormData, Transaction, Category } from '../types';

export interface ManualEntryResult {
  success: boolean;
  transaction?: Transaction;
  error?: string;
}

/**
 * Validates and creates a manual transaction in Supabase and the active household ledger.
 */
export async function createManualTransaction(
  householdId: string,
  formData: ManualEntryFormData,
  categories: Category[],
  isDemoMode: boolean = false
): Promise<ManualEntryResult> {
  // 1. Strict Form Validation
  const numericAmount = parseFloat(formData.amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return {
      success: false,
      error: 'Please enter a valid positive amount.',
    };
  }

  const cleanPayee = formData.payee_name.trim();
  if (!cleanPayee) {
    return {
      success: false,
      error: 'Please specify a Payee or Description for the transaction.',
    };
  }

  if (!formData.date || !/^\d{4}-\d{2}-\d{2}$/.test(formData.date)) {
    return {
      success: false,
      error: 'Please provide a valid transaction date (YYYY-MM-DD).',
    };
  }

  // Determine effective transaction type
  const isSavingsType = formData.transaction_type === 'savings';
  const effectiveTxType: Transaction['transaction_type'] =
    formData.transaction_type === 'income' ? 'income' : 'expense';

  // If savings deposit and no category picked, find or default to Savings category
  let categoryId = formData.category_id || null;
  if (isSavingsType && !categoryId) {
    const savingsCat = categories.find(
      (c) => c.name.includes('חיסכון') || c.name.toLowerCase().includes('savings')
    );
    if (savingsCat) categoryId = savingsCat.id;
  }

  const notesText = isSavingsType
    ? `[Savings Deposit] ${formData.notes || ''}`.trim()
    : formData.notes?.trim() || null;

  const newTx: Transaction = {
    id: `tx-man-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    household_id: householdId,
    date: formData.date,
    amount: numericAmount,
    category_id: categoryId,
    transaction_type: effectiveTxType,
    payee_name: cleanPayee,
    original_description: 'Manual User Entry',
    payment_method: formData.payment_method || 'credit_card',
    card_last_digits: formData.card_last_digits?.trim() || null,
    is_hidden: Boolean(formData.is_hidden),
    notes: notesText,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (isDemoMode || !isSupabaseConfigured) {
    return {
      success: true,
      transaction: newTx,
    };
  }

  try {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        household_id: newTx.household_id,
        date: newTx.date,
        amount: newTx.amount,
        category_id: newTx.category_id,
        transaction_type: newTx.transaction_type,
        payee_name: newTx.payee_name,
        original_description: newTx.original_description,
        payment_method: newTx.payment_method,
        card_last_digits: newTx.card_last_digits,
        is_hidden: newTx.is_hidden,
        notes: newTx.notes,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting manual transaction to Supabase:', error.message);
      return {
        success: false,
        error: `Database insertion failed: ${error.message}`,
      };
    }

    return {
      success: true,
      transaction: data || newTx,
    };
  } catch (err: any) {
    console.error('Exception creating manual transaction:', err);
    return {
      success: false,
      error: err.message || 'An unexpected error occurred while saving the transaction.',
    };
  }
}
