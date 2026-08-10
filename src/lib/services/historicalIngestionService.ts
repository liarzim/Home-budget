import { supabase, isSupabaseConfigured } from '../supabase';
import {
  Transaction,
  Savings,
  Category,
  HistoricalYearlySheetData,
  HistoricalImportResult,
} from '../types';

/**
 * Backend utility service to ingest historical aggregated monthly summaries
 * (e.g. yearly summary workbooks like 'סיכום הכנסות הוצאות - 2026 .xlsx')
 * and map them accurately into canonical Transactions and Savings tables.
 */
export async function ingestHistoricalYearlySummary(
  householdId: string,
  data: HistoricalYearlySheetData,
  categories: Category[],
  isDemoMode: boolean = false
): Promise<HistoricalImportResult> {
  const { year, expenseRows, incomeRows, savingsRows } = data;
  const canonicalTransactions: Partial<Transaction>[] = [];
  const canonicalSavings: Partial<Savings>[] = [];

  // Helper to match category by name or create virtual mapping
  const findCategory = (catName: string, type: 'expense' | 'income') => {
    const norm = catName.trim().toLowerCase();
    return categories.find((c) => c.type === type && c.name.toLowerCase().includes(norm));
  };

  // 1. Process Expense Rows across Months 1-12
  expenseRows.forEach((row) => {
    const matchedCategory = findCategory(row.categoryName, 'expense');

    for (let month = 1; month <= 12; month++) {
      const amount = row.monthlyAmounts[month];
      if (amount && amount > 0) {
        const mStr = String(month).padStart(2, '0');
        const synthDate = `${year}-${mStr}-01`;

        canonicalTransactions.push({
          household_id: householdId,
          date: synthDate,
          amount: Number(amount),
          category_id: matchedCategory?.id || null,
          transaction_type: 'expense',
          payee_name: row.categoryName,
          original_description: `Historical Summary ${year} (Month ${month})`,
          payment_method: 'bank_transfer',
          is_hidden: false,
          notes: `Ingested from aggregated yearly summary: ${row.categoryName}`,
        });
      }
    }
  });

  // 2. Process Income Rows across Months 1-12
  incomeRows.forEach((row) => {
    const matchedCategory = findCategory(row.categoryName, 'income');

    for (let month = 1; month <= 12; month++) {
      const amount = row.monthlyAmounts[month];
      if (amount && amount > 0) {
        const mStr = String(month).padStart(2, '0');
        const synthDate = `${year}-${mStr}-01`;

        canonicalTransactions.push({
          household_id: householdId,
          date: synthDate,
          amount: Number(amount),
          category_id: matchedCategory?.id || null,
          transaction_type: 'income',
          payee_name: row.categoryName,
          original_description: `Historical Income Summary ${year} (Month ${month})`,
          payment_method: 'bank_transfer',
          is_hidden: false,
          notes: `Ingested from aggregated yearly summary: ${row.categoryName}`,
        });
      }
    }
  });

  // 3. Process Savings Baseline Rows
  savingsRows.forEach((s) => {
    canonicalSavings.push({
      household_id: householdId,
      account_name: s.accountName,
      institution: s.institution || 'Investment Institution',
      year,
      opening_balance: Number(s.openingBalance) || 0,
      closing_balance: Number(s.closingBalance) || 0,
      notes: `Historical baseline summary for year ${year}`,
    });
  });

  if (isDemoMode || !isSupabaseConfigured) {
    return {
      success: true,
      year,
      transactionsGenerated: canonicalTransactions.length,
      savingsGenerated: canonicalSavings.length,
    };
  }

  try {
    // Bulk insert transactions in chunks of 100
    const CHUNK_SIZE = 100;
    for (let i = 0; i < canonicalTransactions.length; i += CHUNK_SIZE) {
      const chunk = canonicalTransactions.slice(i, i + CHUNK_SIZE);
      const { error: txErr } = await supabase.from('transactions').insert(chunk);
      if (txErr) {
        throw new Error(`Failed to insert historical transactions: ${txErr.message}`);
      }
    }

    // Insert or update savings records for the year
    if (canonicalSavings.length > 0) {
      const { error: sErr } = await supabase.from('savings').insert(canonicalSavings);
      if (sErr) {
        throw new Error(`Failed to insert historical savings: ${sErr.message}`);
      }
    }

    return {
      success: true,
      year,
      transactionsGenerated: canonicalTransactions.length,
      savingsGenerated: canonicalSavings.length,
    };
  } catch (err: any) {
    console.error('Historical ingestion error:', err);
    return {
      success: false,
      year,
      transactionsGenerated: canonicalTransactions.length,
      savingsGenerated: canonicalSavings.length,
      error: err.message || 'Historical ingestion failed.',
    };
  }
}
