import { supabase, isSupabaseConfigured } from '../supabase';
import {
  Transaction,
  Budget,
  Savings,
  Category,
  MacroCategory,
  MacroGroup,
  CategoryDrillDown,
  SavingsYearlySummary,
  SavingsDistributionItem,
} from '../types';
import { mockTransactions, mockBudgets, mockSavings } from '../mockData';

export interface MonthlyDashboardResult {
  monthStr: string; // e.g. "2026-08"
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
  savingsRate: number;
  macroGroups: MacroGroup[];
  allActiveTransactions: Transaction[];
}

/**
 * Fetches transactions and budgets for a specific month and household.
 * CRITICALLY: Excludes any transaction where is_hidden === true.
 */
export async function fetchMonthlyDashboardData(
  householdId: string,
  monthStr: string, // YYYY-MM
  categories: Category[],
  isDemoMode: boolean = false,
  macroCategories: MacroCategory[] = []
): Promise<MonthlyDashboardResult> {
  const [yearStr, mStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(mStr, 10);

  const startDate = `${yearStr}-${mStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${yearStr}-${mStr}-${String(lastDay).padStart(2, '0')}`;

  let rawTransactions: Transaction[] = [];
  let rawBudgets: Budget[] = [];

  if (isDemoMode || !isSupabaseConfigured) {
    // Demo mode: Filter in-memory mock transactions strictly where is_hidden is false and date in range
    rawTransactions = mockTransactions.filter(
      (tx) =>
        (tx.household_id === householdId || tx.household_id === 'hh-main') &&
        !tx.is_hidden &&
        tx.date >= startDate &&
        tx.date <= endDate
    );
    rawBudgets = mockBudgets.filter(
      (b) => b.household_id === householdId || b.household_id === 'hh-main'
    );
  } else {
    try {
      // Supabase query with strict is_hidden = false filter
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('household_id', householdId)
        .eq('is_hidden', false) // Exclude soft-deleted / hidden rows
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (txError) {
        console.error('Error fetching dashboard transactions:', txError.message);
      } else {
        rawTransactions = txData || [];
      }

      const { data: budgetData, error: bError } = await supabase
        .from('budgets')
        .select('*')
        .eq('household_id', householdId);

      if (bError) {
        console.error('Error fetching budgets:', bError.message);
      } else {
        rawBudgets = budgetData || [];
      }
    } catch (err) {
      console.error('Exception fetching dashboard data:', err);
    }
  }

  // Calculate high-level financial KPIs
  const totalIncome = rawTransactions
    .filter((tx) => tx.transaction_type === 'income')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const totalExpense = rawTransactions
    .filter((tx) => tx.transaction_type === 'expense')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const netCashFlow = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, (netCashFlow / totalIncome) * 100) : 0;

  // Build Macro Groups & Category Drill-Down Hierarchy
  const macroGroups = buildMacroGroups(categories, rawTransactions, rawBudgets, macroCategories);

  return {
    monthStr,
    totalIncome,
    totalExpense,
    netCashFlow,
    savingsRate,
    macroGroups,
    allActiveTransactions: rawTransactions,
  };
}

/**
 * Organizes categories and transactions into Macro Groups (Level 1) and Categories (Level 2).
 */
function buildMacroGroups(
  categories: Category[],
  transactions: Transaction[],
  budgets: Budget[],
  macroCategories: MacroCategory[] = []
): MacroGroup[] {
  // Category helper to identify fixed vs variable expenses as fallback
  const fixedCategoryNames = [
    'שכירות ומשכנתה', 'דיור', 'ארנונה ומים', 'חשמל וגז', 'ביטוחים',
    'תקשורת ומנויים', 'הלוואות', 'שכירות', 'ועד בית', 'חינוך וחוגים',
    'rent', 'housing', 'mortgage', 'utilities', 'insurance', 'loans'
  ];

  const salaryCategoryNames = [
    'משכורת עיקרית', 'משכורת', 'שכר עבודה', 'salary', 'income'
  ];

  // Group transactions by category_id
  const txByCategory = new Map<string | null, Transaction[]>();
  transactions.forEach((tx) => {
    const list = txByCategory.get(tx.category_id) || [];
    list.push(tx);
    txByCategory.set(tx.category_id, list);
  });

  // If dynamic macro categories are defined, create buckets for them
  if (macroCategories.length > 0) {
    const macroBuckets = new Map<string, { macro: MacroCategory; drills: CategoryDrillDown[] }>();
    macroCategories
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      .forEach((mc) => {
        macroBuckets.set(mc.id, { macro: mc, drills: [] });
      });

    // Default fallback buckets if a category doesn't match any macro group
    const fallbackExpenseDrills: CategoryDrillDown[] = [];
    const fallbackIncomeDrills: CategoryDrillDown[] = [];

    categories.forEach((cat) => {
      const catTxs = txByCategory.get(cat.id) || [];
      const catTotal = catTxs.reduce((sum, tx) => sum + Number(tx.amount), 0);
      const catBudgetObj = budgets.find((b) => b.category_id === cat.id);
      const budgetAmount = catBudgetObj?.limit_amount || 0;
      const percentageOfBudget = budgetAmount > 0 ? (catTotal / budgetAmount) * 100 : 0;

      const drill: CategoryDrillDown = {
        category: cat,
        actualAmount: catTotal,
        budgetAmount,
        transactions: catTxs,
        percentageOfBudget,
      };

      if (cat.macro_category_id && macroBuckets.has(cat.macro_category_id)) {
        macroBuckets.get(cat.macro_category_id)!.drills.push(drill);
      } else {
        // Fallback matching
        const normName = cat.name.toLowerCase();
        if (cat.type === 'expense') {
          const isFixed = fixedCategoryNames.some((kw) => normName.includes(kw));
          const targetMacro = macroCategories.find((m) =>
            m.type === 'expense' && (isFixed ? m.name.includes('קבועות') : m.name.includes('משתנות'))
          );
          if (targetMacro && macroBuckets.has(targetMacro.id)) {
            macroBuckets.get(targetMacro.id)!.drills.push(drill);
          } else {
            fallbackExpenseDrills.push(drill);
          }
        } else {
          const isSalary = salaryCategoryNames.some((kw) => normName.includes(kw));
          const targetMacro = macroCategories.find((m) =>
            m.type === 'income' && (isSalary ? m.name.includes('משכורת') : m.name.includes('נוספות'))
          );
          if (targetMacro && macroBuckets.has(targetMacro.id)) {
            macroBuckets.get(targetMacro.id)!.drills.push(drill);
          } else {
            fallbackIncomeDrills.push(drill);
          }
        }
      }
    });

    // Handle uncategorized transactions
    const uncategorizedTxs = txByCategory.get(null) || [];
    if (uncategorizedTxs.length > 0) {
      const uncatExpenses = uncategorizedTxs.filter((tx) => tx.transaction_type === 'expense');
      const uncatIncomes = uncategorizedTxs.filter((tx) => tx.transaction_type === 'income');

      if (uncatExpenses.length > 0) {
        const uncatExpDrill: CategoryDrillDown = {
          category: {
            id: 'uncategorized-exp',
            household_id: '',
            name: 'שונות ולא מסווג (Uncategorized)',
            type: 'expense',
            icon: 'HelpCircle',
            color: '#94A3B8',
            is_system: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          actualAmount: uncatExpenses.reduce((sum, t) => sum + t.amount, 0),
          budgetAmount: 0,
          transactions: uncatExpenses,
          percentageOfBudget: 0,
        };

        // Place in first variable or fallback expense group
        const varMacro = macroCategories.find((m) => m.type === 'expense');
        if (varMacro && macroBuckets.has(varMacro.id)) {
          macroBuckets.get(varMacro.id)!.drills.push(uncatExpDrill);
        } else {
          fallbackExpenseDrills.push(uncatExpDrill);
        }
      }

      if (uncatIncomes.length > 0) {
        const uncatIncDrill: CategoryDrillDown = {
          category: {
            id: 'uncategorized-inc',
            household_id: '',
            name: 'הכנסות אחרות (Other Income)',
            type: 'income',
            icon: 'HelpCircle',
            color: '#94A3B8',
            is_system: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          actualAmount: uncatIncomes.reduce((sum, t) => sum + t.amount, 0),
          budgetAmount: 0,
          transactions: uncatIncomes,
          percentageOfBudget: 0,
        };

        const incMacro = macroCategories.find((m) => m.type === 'income');
        if (incMacro && macroBuckets.has(incMacro.id)) {
          macroBuckets.get(incMacro.id)!.drills.push(uncatIncDrill);
        } else {
          fallbackIncomeDrills.push(uncatIncDrill);
        }
      }
    }

    // Build the dynamic MacroGroup array
    const resultGroups: MacroGroup[] = [];
    macroBuckets.forEach(({ macro, drills }) => {
      drills.sort((a, b) => b.actualAmount - a.actualAmount);
      const totalAmount = drills.reduce((sum, c) => sum + c.actualAmount, 0);
      const totalBudget = drills.reduce((sum, c) => sum + c.budgetAmount, 0);

      resultGroups.push({
        id: macro.id,
        name: macro.name,
        hebrewName: macro.name,
        type: macro.type,
        color: macro.color,
        icon: macro.icon || (macro.type === 'income' ? 'Briefcase' : 'ShoppingBag'),
        totalAmount,
        totalBudget,
        categories: drills,
      });
    });

    if (fallbackExpenseDrills.length > 0) {
      const totalAmount = fallbackExpenseDrills.reduce((sum, c) => sum + c.actualAmount, 0);
      const totalBudget = fallbackExpenseDrills.reduce((sum, c) => sum + c.budgetAmount, 0);
      resultGroups.push({
        id: 'fallback_expenses',
        name: 'Other Expenses',
        hebrewName: 'הוצאות כלליות',
        type: 'expense',
        icon: 'ShoppingBag',
        color: '#6366F1',
        totalAmount,
        totalBudget,
        categories: fallbackExpenseDrills,
      });
    }

    if (fallbackIncomeDrills.length > 0) {
      const totalAmount = fallbackIncomeDrills.reduce((sum, c) => sum + c.actualAmount, 0);
      const totalBudget = fallbackIncomeDrills.reduce((sum, c) => sum + c.budgetAmount, 0);
      resultGroups.push({
        id: 'fallback_incomes',
        name: 'Other Incomes',
        hebrewName: 'הכנסות כלליות',
        type: 'income',
        icon: 'Gift',
        color: '#10B981',
        totalAmount,
        totalBudget,
        categories: fallbackIncomeDrills,
      });
    }

    return resultGroups;
  }

  // Fallback if no macroCategories provided
  const fixedDrills: CategoryDrillDown[] = [];
  const variableDrills: CategoryDrillDown[] = [];
  const salaryDrills: CategoryDrillDown[] = [];
  const otherIncomeDrills: CategoryDrillDown[] = [];

  categories.forEach((cat) => {
    const catTxs = txByCategory.get(cat.id) || [];
    const catTotal = catTxs.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const catBudgetObj = budgets.find((b) => b.category_id === cat.id);
    const budgetAmount = catBudgetObj?.limit_amount || 0;
    const percentageOfBudget = budgetAmount > 0 ? (catTotal / budgetAmount) * 100 : 0;

    const drill: CategoryDrillDown = {
      category: cat,
      actualAmount: catTotal,
      budgetAmount,
      transactions: catTxs,
      percentageOfBudget,
    };

    const normName = cat.name.toLowerCase();

    if (cat.type === 'expense') {
      const isFixed = fixedCategoryNames.some((kw) => normName.includes(kw));
      if (isFixed) {
        fixedDrills.push(drill);
      } else {
        variableDrills.push(drill);
      }
    } else {
      const isSalary = salaryCategoryNames.some((kw) => normName.includes(kw));
      if (isSalary) {
        salaryDrills.push(drill);
      } else {
        otherIncomeDrills.push(drill);
      }
    }
  });

  const uncategorizedTxs = txByCategory.get(null) || [];
  if (uncategorizedTxs.length > 0) {
    const uncatExpenses = uncategorizedTxs.filter((tx) => tx.transaction_type === 'expense');
    const uncatIncomes = uncategorizedTxs.filter((tx) => tx.transaction_type === 'income');

    if (uncatExpenses.length > 0) {
      variableDrills.push({
        category: {
          id: 'uncategorized-exp',
          household_id: '',
          name: 'שונות ולא מסווג (Uncategorized)',
          type: 'expense',
          icon: 'HelpCircle',
          color: '#94A3B8',
          is_system: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        actualAmount: uncatExpenses.reduce((sum, t) => sum + t.amount, 0),
        budgetAmount: 0,
        transactions: uncatExpenses,
        percentageOfBudget: 0,
      });
    }

    if (uncatIncomes.length > 0) {
      otherIncomeDrills.push({
        category: {
          id: 'uncategorized-inc',
          household_id: '',
          name: 'הכנסות אחרות (Other Income)',
          type: 'income',
          icon: 'HelpCircle',
          color: '#94A3B8',
          is_system: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        actualAmount: uncatIncomes.reduce((sum, t) => sum + t.amount, 0),
        budgetAmount: 0,
        transactions: uncatIncomes,
        percentageOfBudget: 0,
      });
    }
  }

  const makeGroup = (
    id: string,
    name: string,
    hebrewName: string,
    type: 'expense' | 'income',
    icon: string,
    color: string,
    categoriesList: CategoryDrillDown[]
  ): MacroGroup => {
    categoriesList.sort((a, b) => b.actualAmount - a.actualAmount);
    const totalAmount = categoriesList.reduce((sum, c) => sum + c.actualAmount, 0);
    const totalBudget = categoriesList.reduce((sum, c) => sum + c.budgetAmount, 0);

    return {
      id,
      name,
      hebrewName,
      type,
      color,
      icon,
      totalAmount,
      totalBudget,
      categories: categoriesList,
    };
  };

  return [
    makeGroup(
      'fixed_expenses',
      'Fixed Expenses',
      'הוצאות קבועות ומחייבות',
      'expense',
      'Lock',
      '#4F46E5',
      fixedDrills
    ),
    makeGroup(
      'variable_expenses',
      'Variable Living Expenses',
      'הוצאות משתנות ומחיה',
      'expense',
      'ShoppingBag',
      '#F59E0B',
      variableDrills
    ),
    makeGroup(
      'income_salary',
      'Primary Salary & Incomes',
      'משכורות עיקריות',
      'income',
      'Briefcase',
      '#10B981',
      salaryDrills
    ),
    makeGroup(
      'income_other',
      'Allowances, Grants & Side Yields',
      'קצבאות, מילואים והשקעות',
      'income',
      'Gift',
      '#06B6D4',
      otherIncomeDrills
    ),
  ];
}

/**
 * Fetches and processes yearly savings data for pie chart distribution and baseline comparison.
 */
export async function fetchYearlySavingsData(
  householdId: string,
  year: number,
  isDemoMode: boolean = false
): Promise<SavingsYearlySummary> {
  let records: Savings[] = [];

  if (isDemoMode || !isSupabaseConfigured) {
    records = mockSavings.filter(
      (s) => (s.household_id === householdId || s.household_id === 'hh-main') && s.year === year
    );
  } else {
    try {
      const { data, error } = await supabase
        .from('savings')
        .select('*')
        .eq('household_id', householdId)
        .eq('year', year)
        .order('account_name');

      if (error) {
        console.error('Error fetching savings data:', error.message);
      } else {
        records = data || [];
      }
    } catch (err) {
      console.error('Exception fetching savings:', err);
    }
  }

  // Fallback defaults if no savings exist yet
  if (records.length === 0) {
    records = [
      {
        id: 's-1',
        household_id: householdId,
        account_name: 'מיטב דש - קופת גמל להשקעה',
        institution: 'Meitav Dash',
        opening_balance: 98000,
        closing_balance: 112000,
        target_amount: 150000,
        notes: 'הפקדה חודשית ₪2,500',
        year,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 's-2',
        household_id: householdId,
        account_name: 'פקדון בנקאי נזיל',
        institution: 'Bank Hapoalim',
        opening_balance: 55000,
        closing_balance: 65000,
        target_amount: 80000,
        notes: 'פקדון חיסכון 4.1%',
        year,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 's-3',
        household_id: householdId,
        account_name: 'תיק מניות ומדד S&P 500',
        institution: 'Capital Market (IBKR)',
        opening_balance: 78000,
        closing_balance: 95000,
        target_amount: 120000,
        notes: 'השקעה במדדים עולמיים',
        year,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 's-4',
        household_id: householdId,
        account_name: 'קרן השתלמות הראל',
        institution: 'Harel Insurance',
        opening_balance: 42000,
        closing_balance: 54000,
        target_amount: 70000,
        notes: 'הפקדה שכיר+מעסיק',
        year,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }

  const startOfYearBaseline = records.reduce((sum, r) => sum + Number(r.opening_balance || 0), 0);
  const currentTotal = records.reduce((sum, r) => sum + Number(r.closing_balance || 0), 0);
  const netGrowth = currentTotal - startOfYearBaseline;
  const netGrowthPercentage = startOfYearBaseline > 0 ? (netGrowth / startOfYearBaseline) * 100 : 0;
  const monthlyAverageDeposit = netGrowth > 0 ? Math.round(netGrowth / 8) : 0;

  // Colors palette for pie chart slices
  const colors = ['#2563EB', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];

  const items: SavingsDistributionItem[] = records.map((r, idx) => {
    const amount = Number(r.closing_balance);
    const percentage = currentTotal > 0 ? (amount / currentTotal) * 100 : 0;
    return {
      type: r.id,
      label: r.account_name,
      amount,
      percentage,
      color: colors[idx % colors.length],
      monthlyDeposit: Math.round((Number(r.closing_balance) - Number(r.opening_balance)) / 8),
    };
  });

  return {
    year,
    startOfYearBaseline,
    currentTotal,
    netGrowth,
    netGrowthPercentage,
    monthlyAverageDeposit,
    items,
  };
}

/**
 * Discovers all distinct statement months available in the household ledger.
 */
export async function fetchAvailableMonths(
  householdId: string,
  isDemoMode: boolean = false
): Promise<string[]> {
  const currentMonthStr = new Date().toISOString().substring(0, 7); // e.g. "2026-08"

  if (isDemoMode || !isSupabaseConfigured) {
    const monthsSet = new Set<string>();
    monthsSet.add('2026-08');
    monthsSet.add('2026-07');
    mockTransactions.forEach((tx) => {
      if (tx.date && tx.date.length >= 7) {
        monthsSet.add(tx.date.substring(0, 7));
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }

  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('date')
      .eq('household_id', householdId)
      .order('date', { ascending: false });

    if (error || !data || data.length === 0) {
      return [currentMonthStr];
    }

    const monthsSet = new Set<string>();
    monthsSet.add(currentMonthStr);
    data.forEach((row) => {
      if (row.date && row.date.length >= 7) {
        monthsSet.add(row.date.substring(0, 7));
      }
    });

    return Array.from(monthsSet).sort().reverse();
  } catch {
    return [currentMonthStr];
  }
}
