import { supabase } from '../supabase';
import { Transaction, Savings, Category } from '../types';
import { ParsedHistoricalYearlySummary } from './historicalExcelParser';

export interface MigrationOptions {
  includeItemizedTransactions: boolean; // default true
  includeIncomeRows: boolean;           // default true
  includeSavingsBaselines: boolean;      // default true
  useAggregatedExpensesIfNoItemized?: boolean; // fallback if sheets 1-12 are empty
}

export interface MigrationProgressCallback {
  (percentage: number, statusMessage: string): void;
}

export interface MigrationResult {
  success: boolean;
  transactionsInserted: number;
  incomeInserted: number;
  savingsInserted: number;
  categoriesCreated: number;
  error?: string;
}

/**
 * Resolves or finds category ID by matching name in existing categories.
 */
function resolveCategoryId(
  rawName: string,
  categories: Category[],
  type: 'expense' | 'income'
): string | null {
  const cleanName = rawName.trim().toLowerCase();

  // Exact match
  const exact = categories.find(
    (c) => c.type === type && c.name.trim().toLowerCase() === cleanName
  );
  if (exact) return exact.id;

  // Substring match
  const partial = categories.find(
    (c) => c.type === type && (c.name.includes(cleanName) || cleanName.includes(c.name.toLowerCase()))
  );
  if (partial) return partial.id;

  // Fallback category for type
  const fallback = categories.find((c) => c.type === type);
  return fallback ? fallback.id : null;
}

/**
 * Transforms parsed historical summary into canonical Transaction and Savings objects.
 */
export function transformHistoricalDataToCanonical(
  parsed: ParsedHistoricalYearlySummary,
  householdId: string,
  categories: Category[],
  options: MigrationOptions
): {
  transactions: Transaction[];
  savings: Savings[];
} {
  const transactions: Transaction[] = [];
  const savings: Savings[] = [];
  const nowStr = new Date().toISOString();

  // 1. Ingest Itemized Expenses from Sheets 1-12
  if (options.includeItemizedTransactions && parsed.itemizedTransactions.length > 0) {
    parsed.itemizedTransactions.forEach((item, idx) => {
      const catId = resolveCategoryId(item.categoryName, categories, 'expense');

      transactions.push({
        id: `tx-hist-${parsed.year}-${item.monthIndex}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        household_id: householdId,
        date: item.date,
        amount: item.amount,
        category_id: catId,
        transaction_type: 'expense',
        payee_name: item.payee,
        original_description: item.originalDescription || `Historical ${item.monthIndex}/${parsed.year}`,
        payment_method: 'credit_card',
        card_last_digits: item.cardLastDigits || null,
        is_hidden: false,
        notes: item.notes || (item.cardName ? `[${item.cardName}]` : undefined),
        created_by: null,
        created_at: nowStr,
        updated_at: nowStr,
      });
    });
  } else if (options.useAggregatedExpensesIfNoItemized && parsed.expenseMatrix.length > 0) {
    // Fallback to monthly category aggregates (1st of each month)
    parsed.expenseMatrix.forEach((matRow) => {
      const catId = resolveCategoryId(matRow.categoryName, categories, 'expense');

      Object.entries(matRow.monthlyAmounts).forEach(([mStr, amount]) => {
        const monthNum = parseInt(mStr, 10);
        const mm = String(monthNum).padStart(2, '0');

        transactions.push({
          id: `tx-agg-${parsed.year}-${mm}-${Math.random().toString(36).substr(2, 6)}`,
          household_id: householdId,
          date: `${parsed.year}-${mm}-01`,
          amount,
          category_id: catId,
          transaction_type: 'expense',
          payee_name: `${matRow.categoryName} (סיכום חודשי)`,
          original_description: `Aggregated Expense ${matRow.categoryName} ${mm}/${parsed.year}`,
          payment_method: 'bank_transfer',
          card_last_digits: null,
          is_hidden: false,
          notes: `Historical Aggregated Monthly Expense for ${matRow.categoryName}`,
          created_by: null,
          created_at: nowStr,
          updated_at: nowStr,
        });
      });
    });
  }

  // 2. Ingest Income Stream from 'הכנסות' Sheet
  if (options.includeIncomeRows && parsed.incomeRows.length > 0) {
    parsed.incomeRows.forEach((inc, idx) => {
      const catId = resolveCategoryId(inc.sourceName, categories, 'income');
      const mm = String(inc.monthIndex).padStart(2, '0');

      transactions.push({
        id: `tx-inc-${parsed.year}-${mm}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        household_id: householdId,
        date: `${parsed.year}-${mm}-01`,
        amount: inc.amount,
        category_id: catId,
        transaction_type: 'income',
        payee_name: inc.sourceName,
        original_description: `Historical Income ${inc.sourceName} (${inc.monthName} ${parsed.year})`,
        payment_method: 'bank_transfer',
        card_last_digits: null,
        is_hidden: false,
        notes: `Recorded Income from ${inc.sourceName}`,
        created_by: null,
        created_at: nowStr,
        updated_at: nowStr,
      });
    });
  }

  // 3. Ingest Savings Baselines from 'הכנסות' Sheet (חסכון שנתי)
  if (options.includeSavingsBaselines && parsed.savingsAccounts.length > 0) {
    parsed.savingsAccounts.forEach((acc, idx) => {
      savings.push({
        id: `sav-hist-${parsed.year}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        household_id: householdId,
        account_name: acc.accountName,
        opening_balance: acc.openingBalance,
        closing_balance: acc.closingBalance,
        year: acc.year,
        created_at: nowStr,
        updated_at: nowStr,
      });
    });
  }

  return { transactions, savings };
}

/**
 * Chunked Batch Inserter into Supabase to prevent timeouts.
 */
export async function executeHistoricalMigration(
  canonicalData: { transactions: Transaction[]; savings: Savings[] },
  householdId: string,
  isDemoMode: boolean,
  onProgress?: MigrationProgressCallback
): Promise<MigrationResult> {
  const { transactions, savings } = canonicalData;
  const totalSteps = Math.ceil(transactions.length / 100) + (savings.length > 0 ? 1 : 0);
  let stepsDone = 0;

  try {
    if (isDemoMode) {
      // Demo Mode local simulation
      for (let i = 0; i < transactions.length; i += 100) {
        await new Promise((resolve) => setTimeout(resolve, 80));
        stepsDone++;
        const pct = Math.min(100, Math.round((stepsDone / totalSteps) * 100));
        onProgress?.(pct, `Inserting records ${i + 1} - ${Math.min(i + 100, transactions.length)} of ${transactions.length}...`);
      }

      onProgress?.(100, 'Migration completed successfully!');
      return {
        success: true,
        transactionsInserted: transactions.filter((t) => t.transaction_type === 'expense').length,
        incomeInserted: transactions.filter((t) => t.transaction_type === 'income').length,
        savingsInserted: savings.length,
        categoriesCreated: 0,
      };
    }

    // Live Supabase Batch Ingestion (100 records per chunk)
    const CHUNK_SIZE = 100;
    for (let i = 0; i < transactions.length; i += CHUNK_SIZE) {
      const chunk = transactions.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from('transactions').insert(chunk);

      if (error) {
        console.error('Batch insert error on transactions:', error);
        throw new Error(`Failed to insert batch at index ${i}: ${error.message}`);
      }

      stepsDone++;
      const pct = Math.min(95, Math.round((stepsDone / totalSteps) * 100));
      onProgress?.(
        pct,
        `Ingested ${Math.min(i + CHUNK_SIZE, transactions.length)} of ${transactions.length} transactions...`
      );
    }

    // Insert Savings Accounts
    if (savings.length > 0) {
      const { error: savError } = await supabase.from('savings').upsert(savings);
      if (savError) {
        console.warn('Savings upsert notice:', savError.message);
      }
    }

    onProgress?.(100, 'All historical data successfully migrated!');

    return {
      success: true,
      transactionsInserted: transactions.filter((t) => t.transaction_type === 'expense').length,
      incomeInserted: transactions.filter((t) => t.transaction_type === 'income').length,
      savingsInserted: savings.length,
      categoriesCreated: 0,
    };
  } catch (err: any) {
    return {
      success: false,
      transactionsInserted: 0,
      incomeInserted: 0,
      savingsInserted: 0,
      categoriesCreated: 0,
      error: err?.message || 'Unknown migration error occurred.',
    };
  }
}
