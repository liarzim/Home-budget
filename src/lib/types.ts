export type TransactionType = 'expense' | 'income' | 'transfer';
export type CategoryType = 'expense' | 'income';
export type BudgetPeriod = 'monthly' | 'yearly';
export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Household {
  id: string;
  name: string;
  currency: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  role?: MemberRole;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: MemberRole;
  is_default: boolean;
  joined_at: string;
  profile?: Profile;
}

export interface Category {
  id: string;
  household_id: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  parent_id?: string | null;
  is_system?: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessMapping {
  id: string;
  household_id: string;
  pattern: string;
  category_id: string;
  priority: number;
  is_regex: boolean;
  created_at: string;
  updated_at: string;
  category?: Category;
}

export interface Transaction {
  id: string;
  household_id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  category_id: string | null;
  transaction_type: TransactionType;
  payee_name: string;
  original_description?: string | null;
  payment_method?: string;
  card_last_digits?: string | null;
  is_hidden: boolean; // Soft delete / filter flag
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  category?: Category;
}

export interface Budget {
  id: string;
  household_id: string;
  category_id: string;
  period_type: BudgetPeriod;
  year: number;
  month?: number | null; // 1-12 for monthly, null for yearly
  limit_amount: number;
  created_at: string;
  updated_at: string;
  category?: Category;
  spent_amount?: number; // Computed field
}

export interface Savings {
  id: string;
  household_id: string;
  account_name: string;
  institution?: string | null;
  year: number;
  opening_balance: number;
  closing_balance: number;
  target_amount?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  user: Profile | null;
  households: Household[];
  activeHousehold: Household | null;
  isAuthenticated: boolean;
  isDemoMode: boolean;
}
