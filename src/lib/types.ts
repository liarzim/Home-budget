export type TransactionType = 'expense' | 'income' | 'transfer';
export type CategoryType = 'expense' | 'income';
export type BudgetPeriod = 'monthly' | 'yearly';
export type MemberRole = 'super_admin' | 'owner' | 'admin' | 'user' | 'member' | 'viewer';

export const SUPER_USER_EMAILS = ['michael.liarzi@gmail.com'];

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
  members_count?: number;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: MemberRole;
  is_default: boolean;
  joined_at: string;
  profile?: Profile;
  email?: string;
  full_name?: string;
}

export interface MacroCategory {
  id: string;
  household_id: string;
  name: string;
  type: 'expense' | 'income';
  color: string;
  icon: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  household_id: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  parent_id?: string | null;
  macro_category_id?: string | null;
  is_system?: boolean;
  created_at: string;
  updated_at: string;
  macro_category?: MacroCategory;
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

export interface CardMapping {
  id: string;
  household_id: string;
  raw_pattern: string; // Raw credit card name or bank provider pattern from statement e.g. "כרטיס ויזה כאל 1234"
  display_name: string; // Friendly display source name e.g. "ויזה כאל זהב (אישי)"
  card_last_digits?: string | null;
  payment_type?: 'credit_card' | 'bank_transfer' | 'cash' | 'direct_debit' | 'other';
  color?: string;
  created_at: string;
  updated_at: string;
}

export interface BankAccount {
  id: string;
  household_id: string;
  provider_name: string;
  account_number_masked: string;
  account_type: 'checking' | 'credit_card' | 'savings' | 'investment';
  currency: string;
  current_balance: number;
  sync_status: 'active' | 'syncing' | 'error' | 'disconnected';
  last_synced_at: string | null;
  auth_token_ref?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
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
  source_reference_id?: string | null; // Deduplication ref for Open Banking webhooks
  bank_account_id?: string | null;
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

// ==========================================
// DATA INGESTION & COLUMN MAPPING TYPES
// ==========================================

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Record<string, any>[];
  rawGrid: any[][];
  headerRowIndex: number;
}

export interface ParsedFile {
  fileName: string;
  fileSize: number;
  fileType: 'xlsx' | 'xls' | 'csv';
  sheets: ParsedSheet[];
  activeSheetName: string;
}

export type AmountMappingMode = 'single' | 'debit_credit';

export interface ColumnMapping {
  dateColumn: string;
  payeeColumn: string;
  amountMode: AmountMappingMode;
  amountColumn: string;
  debitColumn?: string;
  creditColumn?: string;
  categoryColumn?: string;
  paymentMethodColumn?: string;
  cardDigitsColumn?: string;
  notesColumn?: string;
  dateFormat?: string;
  reverseAmountSign?: boolean;
}

export interface TransformedImportRow {
  id: string;
  originalRowIndex: number;
  date: string; // YYYY-MM-DD
  payee_name: string;
  amount: number;
  transaction_type: TransactionType;
  category_id: string | null;
  auto_matched_rule?: string;
  payment_method: string;
  card_last_digits: string | null;
  notes: string | null;
  is_hidden: boolean; // Soft delete / hide flag in preview
  isValid: boolean;
  validationError?: string;
  selected: boolean;
}

export interface ImportBatchSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  hiddenRowsCount: number;
  totalIncome: number;
  totalExpense: number;
  autoCategorizedCount: number;
}

// ==========================================
// DASHBOARD & DRILL-DOWN VISUALIZATION TYPES
// ==========================================

export interface CategoryDrillDown {
  category: Category;
  actualAmount: number;
  budgetAmount: number;
  transactions: Transaction[];
  percentageOfBudget: number;
}

export interface MacroGroup {
  id: string;
  name: string;
  hebrewName: string;
  type: 'expense' | 'income';
  color?: string;
  icon: string;
  totalAmount: number;
  totalBudget: number;
  categories: CategoryDrillDown[];
}

export interface SavingsDistributionItem {
  type: string;
  label: string;
  amount: number;
  percentage: number;
  color: string;
  monthlyDeposit?: number;
}

export interface SavingsYearlySummary {
  year: number;
  startOfYearBaseline: number;
  currentTotal: number;
  netGrowth: number;
  netGrowthPercentage: number;
  monthlyAverageDeposit: number;
  items: SavingsDistributionItem[];
}

// ==========================================
// MANUAL ENTRY & HISTORICAL INGESTION TYPES
// ==========================================

export interface ManualEntryFormData {
  date: string;
  amount: string;
  transaction_type: 'expense' | 'income' | 'savings';
  category_id: string;
  payee_name: string;
  payment_method: string;
  card_last_digits?: string;
  notes?: string;
  is_hidden?: boolean;
}

export interface HistoricalCategoryMonthlyRow {
  categoryName: string;
  categoryType: 'expense' | 'income';
  monthlyAmounts: Record<number, number>; // month 1-12 -> amount
}

export interface HistoricalYearlySheetData {
  year: number;
  title: string;
  expenseRows: HistoricalCategoryMonthlyRow[];
  incomeRows: HistoricalCategoryMonthlyRow[];
  savingsRows: {
    accountName: string;
    institution: string;
    openingBalance: number;
    closingBalance: number;
  }[];
}

export interface HistoricalImportResult {
  success: boolean;
  year: number;
  transactionsGenerated: number;
  savingsGenerated: number;
  error?: string;
}



