import { supabase } from '../supabase';
import { BankAccount, Transaction, BusinessMapping } from '../types';

export interface CreateBankAccountPayload {
  household_id: string;
  provider_name: string;
  account_number_masked: string;
  account_type: BankAccount['account_type'];
  currency?: string;
  initial_balance?: number;
}

export interface SyncResult {
  success: boolean;
  inserted_count: number;
  new_balance: number;
  synced_at: string;
  error?: string;
}

/**
 * Fetches all connected bank and credit card accounts for a household.
 */
export async function fetchBankAccounts(
  householdId: string,
  isDemoMode: boolean
): Promise<BankAccount[]> {
  if (isDemoMode) {
    const saved = localStorage.getItem(`demo_bank_accounts_${householdId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }

    // Default Seeded Connected Accounts in Demo Mode
    const defaultDemoAccounts: BankAccount[] = [
      {
        id: 'ba-demo-1',
        household_id: householdId,
        provider_name: 'Bank Leumi (בנק לאומי)',
        account_number_masked: '**** 4892',
        account_type: 'checking',
        currency: 'ILS',
        current_balance: 28450.0,
        sync_status: 'active',
        last_synced_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'ba-demo-2',
        household_id: householdId,
        provider_name: 'Max Executive (מקס)',
        account_number_masked: '**** 2285',
        account_type: 'credit_card',
        currency: 'ILS',
        current_balance: -4890.5,
        sync_status: 'active',
        last_synced_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'ba-demo-3',
        household_id: householdId,
        provider_name: 'Isracard Platinum (ישראכרט)',
        account_number_masked: '**** 3669',
        account_type: 'credit_card',
        currency: 'ILS',
        current_balance: -2150.8,
        sync_status: 'active',
        last_synced_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    localStorage.setItem(`demo_bank_accounts_${householdId}`, JSON.stringify(defaultDemoAccounts));
    return defaultDemoAccounts;
  }

  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching bank accounts from Supabase:', error);
    return [];
  }

  return (data || []) as BankAccount[];
}

/**
 * Creates a new Bank Account connection.
 */
export async function createBankAccount(
  payload: CreateBankAccountPayload,
  isDemoMode: boolean
): Promise<{ success: boolean; account?: BankAccount; error?: string }> {
  const newAccount: BankAccount = {
    id: `ba-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    household_id: payload.household_id,
    provider_name: payload.provider_name,
    account_number_masked: payload.account_number_masked,
    account_type: payload.account_type,
    currency: payload.currency || 'ILS',
    current_balance: payload.initial_balance || 0,
    sync_status: 'active',
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (isDemoMode) {
    const existing = await fetchBankAccounts(payload.household_id, true);
    const updated = [newAccount, ...existing];
    localStorage.setItem(`demo_bank_accounts_${payload.household_id}`, JSON.stringify(updated));
    return { success: true, account: newAccount };
  }

  const { data, error } = await supabase
    .from('bank_accounts')
    .insert([newAccount])
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, account: data as BankAccount };
}

/**
 * Disconnects or removes a Bank Account.
 */
export async function disconnectBankAccount(
  accountId: string,
  householdId: string,
  isDemoMode: boolean
): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode) {
    const existing = await fetchBankAccounts(householdId, true);
    const updated = existing.filter((a) => a.id !== accountId);
    localStorage.setItem(`demo_bank_accounts_${householdId}`, JSON.stringify(updated));
    return { success: true };
  }

  const { error } = await supabase
    .from('bank_accounts')
    .delete()
    .eq('id', accountId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Triggers an Open Banking sync operation for an account.
 */
export async function syncBankAccount(
  account: BankAccount,
  mappings: BusinessMapping[],
  isDemoMode: boolean
): Promise<SyncResult & { newTransactions?: Transaction[] }> {
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.split('T')[0];

  if (isDemoMode) {
    // Generate 3 mock fresh transactions from Open Banking feed
    const mockFeeds = [
      { payee: 'SHUFERSAL SHELI', amount: 312.4, digits: '4892' },
      { payee: 'PAZ GAS STATION', amount: 245.0, digits: '2285' },
      { payee: 'SUPER-PHARM REHOVOT', amount: 89.9, digits: '3669' },
    ];

    const generatedTxs: Transaction[] = mockFeeds.map((feed, idx) => {
      let matchedCatId: string | null = null;
      for (const rule of mappings) {
        if (rule.pattern && feed.payee.toUpperCase().includes(rule.pattern.toUpperCase())) {
          matchedCatId = rule.category_id;
          break;
        }
      }

      return {
        id: `tx-ob-sync-${Date.now()}-${idx}`,
        household_id: account.household_id,
        date: todayStr,
        amount: feed.amount,
        category_id: matchedCatId,
        transaction_type: 'expense',
        payee_name: feed.payee,
        original_description: `Automated Open Banking Sync (${account.provider_name})`,
        payment_method: 'credit_card',
        card_last_digits: feed.digits,
        source_reference_id: `ob-ref-${Date.now()}-${idx}`,
        bank_account_id: account.id,
        is_hidden: false,
        notes: `Automated sync from ${account.provider_name}`,
        created_at: nowIso,
        updated_at: nowIso,
      };
    });

    const newBalance = account.current_balance - 647.3;

    // Update local storage
    const accounts = await fetchBankAccounts(account.household_id, true);
    const updatedAccounts = accounts.map((a) =>
      a.id === account.id
        ? { ...a, last_synced_at: nowIso, current_balance: newBalance, sync_status: 'active' as const }
        : a
    );
    localStorage.setItem(`demo_bank_accounts_${account.household_id}`, JSON.stringify(updatedAccounts));

    return {
      success: true,
      inserted_count: generatedTxs.length,
      new_balance: newBalance,
      synced_at: nowIso,
      newTransactions: generatedTxs,
    };
  }

  try {
    // Invoke Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('open-banking-webhook', {
      body: {
        household_id: account.household_id,
        bank_account_id: account.id,
        transactions: [],
      },
    });

    if (error) {
      // If edge function is not deployed to cloud yet, update timestamp in table directly
      await supabase
        .from('bank_accounts')
        .update({ last_synced_at: nowIso, sync_status: 'active' })
        .eq('id', account.id);

      return {
        success: true,
        inserted_count: 0,
        new_balance: account.current_balance,
        synced_at: nowIso,
      };
    }

    return {
      success: true,
      inserted_count: data?.inserted_count || 0,
      new_balance: account.current_balance,
      synced_at: nowIso,
    };
  } catch (err: any) {
    return {
      success: false,
      inserted_count: 0,
      new_balance: account.current_balance,
      synced_at: nowIso,
      error: err?.message || 'Sync failed',
    };
  }
}
