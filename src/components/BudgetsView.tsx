import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Budget, Category, MacroCategory } from '../lib/types';
import {
  Calendar,
  AlertTriangle,
  Sparkles,
  Save,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Lock,
  ShoppingBag,
  Target,
  Copy,
  BarChart3,
  Sliders,
  DollarSign,
  HelpCircle,
  X,
  RotateCcw,
  Trash2,
  Plus,
  Search,
  FolderPlus,
  Filter
} from 'lucide-react';
import { t, formatCategoryName } from '../lib/i18n';

const MONTH_NAMES_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

const MONTH_SHORT_NAMES_HE = [
  'ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני',
  'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'
];

export const BudgetsView: React.FC = () => {
  const {
    budgets,
    categories,
    macroCategories,
    transactions,
    activeHousehold,
    language,
    saveYearlyBudgetPlan,
    updateCategory,
    addCategory
  } = useAuth();

  const currency = activeHousehold?.currency === 'ILS' ? '₪' : activeHousehold?.currency || '$';

  // Navigation & Mode States
  const [viewMode, setViewMode] = useState<'planner' | 'tracking'>('planner');
  const [selectedYear, setSelectedYear] = useState<number>(2027);
  const [selectedMonth, setSelectedMonth] = useState<number>(1); // Default to January for 2027 planning
  const [matrixView, setMatrixView] = useState<boolean>(true); // Default to comprehensive matrix view

  // Macro filter: default 'fixed_only' for phase 1 planning (Fixed Expenses Only)
  const [macroFilter, setMacroFilter] = useState<'fixed_only' | 'all'>('fixed_only');

  // Add row modal state
  const [isAddRowModalOpen, setIsAddRowModalOpen] = useState(false);
  const [targetMacroForAdd, setTargetMacroForAdd] = useState<MacroCategory | null>(null);
  const [searchCatQuery, setSearchCatQuery] = useState('');
  const [newSubcatName, setNewSubcatName] = useState('');
  const [newSubcatParentId, setNewSubcatParentId] = useState<string>('');
  const [addModalTab, setAddModalTab] = useState<'existing' | 'new'>('existing');

  // Action feedback message banner
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Expanded Macro Categories
  const [expandedMacros, setExpandedMacros] = useState<Record<string, boolean>>({});

  // Local state for budget plan: categoryId -> month (1..12) -> limit_amount
  const [planState, setPlanState] = useState<Record<string, Record<number, number>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Smart suggestions modal
  const [isSmartModalOpen, setIsSmartModalOpen] = useState(false);
  const [smartSource, setSmartSource] = useState<'last_6_months' | 'prev_year' | 'last_3_months'>('last_6_months');
  const [smartAdjustment, setSmartAdjustment] = useState<number>(0); // e.g. 0%, +5%, -5%

  // Initialize expanded macros to all true once loaded
  useEffect(() => {
    if (macroCategories.length > 0 && Object.keys(expandedMacros).length === 0) {
      const initial: Record<string, boolean> = {};
      macroCategories.forEach(m => { initial[m.id] = true; });
      setExpandedMacros(initial);
    }
  }, [macroCategories]);

  // Calculate Historical Monthly Averages per Category from real 2026 transactions (10 months)
  const categoryStats = useMemo(() => {
    const stats: Record<
      string,
      {
        last6MonthsAvg: number;
        last3MonthsAvg: number;
        prevYearAvg: number;
        isBiMonthly: boolean;
        biMonthlyType: 'even' | 'odd' | null;
        avgOdd: number;
        avgEven: number;
        monthlyDefault: Record<number, number>;
      }
    > = {};

    const roundVal = (v: number) => {
      if (v <= 0) return 0;
      if (v <= 100) return Math.round(v / 5) * 5;
      return Math.round(v / 50) * 50;
    };

    categories.forEach((cat) => {
      const catTxs = transactions.filter((t) => !t.is_hidden && t.category_id === cat.id);

      // Last 6 months (May 2026 - Oct 2026)
      const last6MonthsTxs = catTxs.filter((t) => t.date >= '2026-05-01' && t.date <= '2026-10-31');
      const sum6 = last6MonthsTxs.reduce((acc, t) => acc + Number(t.amount), 0);
      const avg6 = Math.round(sum6 / 6);

      // Last 3 months (Aug 2026 - Oct 2026)
      const last3MonthsTxs = catTxs.filter((t) => t.date >= '2026-08-01' && t.date <= '2026-10-31');
      const sum3 = last3MonthsTxs.reduce((acc, t) => acc + Number(t.amount), 0);
      const avg3 = Math.round(sum3 / 3);

      // 2026 data across existing 10 months (Jan 2026 - Oct 2026)
      const year2026Txs = catTxs.filter((t) => t.date >= '2026-01-01' && t.date <= '2026-10-31');

      const monthSums: Record<number, number> = {};
      for (let m = 1; m <= 10; m++) monthSums[m] = 0;
      year2026Txs.forEach((t) => {
        const m = parseInt(t.date.substring(5, 7), 10);
        if (m >= 1 && m <= 10) {
          monthSums[m] = (monthSums[m] || 0) + Number(t.amount);
        }
      });

      const total2026 = Object.values(monthSums).reduce((a, b) => a + b, 0);
      let avg2026 = Math.round(total2026 / 10);

      // Special category rules
      if (cat.name === 'דמי חבר ואירגונים') {
        avg2026 = 30; // 30 ₪ monthly union membership
      }

      // Bi-monthly evaluation (comparing even months: 2, 4, 6, 8, 10 vs odd months: 1, 3, 5, 7, 9)
      const oddSums = [1, 3, 5, 7, 9].map((m) => monthSums[m] || 0);
      const evenSums = [2, 4, 6, 8, 10].map((m) => monthSums[m] || 0);
      const avgOdd = Math.round(oddSums.reduce((a, b) => a + b, 0) / 5);
      const avgEven = Math.round(evenSums.reduce((a, b) => a + b, 0) / 5);

      const evenHighCount = evenSums.filter((v) => v > 800).length;
      const oddHighCount = oddSums.filter((v) => v > 800).length;

      let isBiMonthly = false;
      let biMonthlyType: 'even' | 'odd' | null = null;

      // Category is bi-monthly if alternating months consistently have the large majority of expenses
      if (evenHighCount >= 3 && oddHighCount <= 1 && avgEven >= avgOdd * 2 && (avgEven - avgOdd) > 500) {
        isBiMonthly = true;
        biMonthlyType = 'even';
      } else if (oddHighCount >= 3 && evenHighCount <= 1 && avgOdd >= avgEven * 2 && (avgOdd - avgEven) > 500) {
        isBiMonthly = true;
        biMonthlyType = 'odd';
      }

      // 12 months estimated allocation
      const monthlyDefault: Record<number, number> = {};
      for (let m = 1; m <= 12; m++) {
        if (m <= 10 && monthSums[m] > 0) {
          // Match the exact historical month's spend for high accuracy
          monthlyDefault[m] = roundVal(monthSums[m]);
        } else if (isBiMonthly) {
          if (biMonthlyType === 'even') {
            monthlyDefault[m] = m % 2 === 0 ? roundVal(avgEven) : roundVal(avgOdd);
          } else {
            monthlyDefault[m] = m % 2 !== 0 ? roundVal(avgOdd) : roundVal(avgEven);
          }
        } else {
          monthlyDefault[m] = roundVal(avg2026);
        }
      }

      stats[cat.id] = {
        last6MonthsAvg: avg6,
        last3MonthsAvg: avg3,
        prevYearAvg: avg2026,
        isBiMonthly,
        biMonthlyType,
        avgOdd,
        avgEven,
        monthlyDefault,
      };
    });

    return stats;
  }, [categories, transactions]);

  // Load existing budgets into local state when selectedYear or budgets change
  // If no saved budget exists yet for selectedYear, pre-populate with the 2026 baseline estimates
  useEffect(() => {
    const yearBudgets = budgets.filter((b) => b.year === selectedYear);
    const newState: Record<string, Record<number, number>> = {};

    categories.forEach((cat) => {
      newState[cat.id] = {};
      const stat = categoryStats[cat.id];
      for (let m = 1; m <= 12; m++) {
        // If year has saved budgets in DB, initialize to 0; else pre-fill with smart baseline
        newState[cat.id][m] = yearBudgets.length > 0 ? 0 : (stat?.monthlyDefault[m] || 0);
      }
    });

    yearBudgets.forEach((b) => {
      if (!newState[b.category_id]) {
        newState[b.category_id] = {};
        for (let m = 1; m <= 12; m++) newState[b.category_id][m] = 0;
      }
      if (b.month && b.month >= 1 && b.month <= 12) {
        newState[b.category_id][b.month] = Number(b.limit_amount);
      } else if (b.period_type === 'yearly') {
        const perMonth = Math.round(Number(b.limit_amount) / 12);
        for (let m = 1; m <= 12; m++) {
          newState[b.category_id][m] = perMonth;
        }
      }
    });

    setPlanState(newState);
  }, [selectedYear, budgets, categories, categoryStats]);

  // Toggle macro expansion
  const toggleMacro = (macroId: string) => {
    setExpandedMacros((prev) => ({ ...prev, [macroId]: !prev[macroId] }));
  };

  // Update budget for a category and month
  const handleAmountChange = (categoryId: string, month: number, valueStr: string) => {
    const val = Math.max(0, parseFloat(valueStr) || 0);
    setPlanState((prev) => ({
      ...prev,
      [categoryId]: {
        ...(prev[categoryId] || {}),
        [month]: val,
      },
    }));
    setSaveSuccess(false);
  };

  // Copy one month value to all 12 months for this category
  const applyToAllMonths = (categoryId: string, sourceMonth: number) => {
    const val = planState[categoryId]?.[sourceMonth] || 0;
    setPlanState((prev) => {
      const updatedMonths: Record<number, number> = {};
      for (let m = 1; m <= 12; m++) {
        updatedMonths[m] = val;
      }
      return {
        ...prev,
        [categoryId]: updatedMonths,
      };
    });
    setSaveSuccess(false);
  };

  // Reset all 12 months for a category row
  const handleResetRow = (categoryId: string, catName?: string) => {
    setPlanState((prev) => ({
      ...prev,
      [categoryId]: {
        1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
        7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
      },
    }));
    setSaveSuccess(false);
    setActionFeedback(`שורת "${catName || 'הקטגוריה'}" אופסה ל-0 ₪ לכל 12 חודשי השנה.`);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  // Reset a specific month for a category
  const handleResetMonth = (categoryId: string, month: number, catName?: string) => {
    setPlanState((prev) => ({
      ...prev,
      [categoryId]: {
        ...(prev[categoryId] || {}),
        [month]: 0,
      },
    }));
    setSaveSuccess(false);
    setActionFeedback(`חודש ${MONTH_NAMES_HE[month - 1]} עבור "${catName || 'הקטגוריה'}" אופס ל-0 ₪.`);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  // Remove category row from current macro table
  const handleRemoveCategoryFromMacro = (cat: Category, currentMacro: MacroCategory) => {
    const isConfirmed = window.confirm(
      `האם להסיר את השורה "${cat.name}" מתכנון ${currentMacro.name}?\nנתוני התקציב לשורה זו יאופסו והיא תועבר לקבוצת "הוצאות משתנות / כללי".`
    );
    if (!isConfirmed) return;

    // 1. Zero out local plan state for this category
    setPlanState((prev) => ({
      ...prev,
      [cat.id]: {
        1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
        7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
      },
    }));

    // 2. Reassign category to variable expenses or unassigned
    const altMacro =
      macroCategories.find((m) => m.name.includes('משתנות') && m.id !== currentMacro.id) ||
      macroCategories.find((m) => m.id !== currentMacro.id);

    updateCategory(
      cat.id,
      cat.name,
      cat.color,
      cat.icon,
      altMacro ? altMacro.id : null,
      cat.parent_id
    );

    setSaveSuccess(false);
    setActionFeedback(`השורה "${cat.name}" הוסרה בהצלחה מתכנון ${currentMacro.name}.`);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  // Add an existing category to target macro
  const handleAddCategoryToMacro = (cat: Category, targetMacro: MacroCategory) => {
    updateCategory(
      cat.id,
      cat.name,
      cat.color,
      cat.icon,
      targetMacro.id,
      cat.parent_id
    );

    // If category has zero planned amounts, auto-seed with historical average or default
    const stat = categoryStats[cat.id];
    setPlanState((prev) => {
      const existing = prev[cat.id] || {};
      const updated: Record<number, number> = { ...existing };
      for (let m = 1; m <= 12; m++) {
        if (!updated[m] || updated[m] === 0) {
          updated[m] = stat?.monthlyDefault?.[m] || stat?.prevYearAvg || 0;
        }
      }
      return { ...prev, [cat.id]: updated };
    });

    setIsAddRowModalOpen(false);
    setSearchCatQuery('');
    setSaveSuccess(false);
    setActionFeedback(`הקטגוריה "${cat.name}" שויכה בהצלחה לתכנון ${targetMacro.name}.`);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  // Create brand new subcategory and add to macro
  const handleCreateAndAddSubcategory = (targetMacro: MacroCategory) => {
    if (!newSubcatName.trim()) return;

    addCategory(
      newSubcatName.trim(),
      targetMacro.type,
      targetMacro.color || '#3B82F6',
      'Tag',
      targetMacro.id,
      newSubcatParentId || null
    );

    setIsAddRowModalOpen(false);
    setNewSubcatName('');
    setNewSubcatParentId('');
    setSaveSuccess(false);
    setActionFeedback(`הקטגוריה החדשה "${newSubcatName.trim()}" נוצרה ונוספה לתכנון ${targetMacro.name}.`);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  // Parent categories (Domain folders)
  const parentCategories = useMemo(() => {
    return categories.filter((c) => !c.parent_id);
  }, [categories]);

  // Group categories by parent domain for the Add Row modal
  const categorizedForAddModal = useMemo(() => {
    const parentMap = new Map<string, Category>();
    const parentCategoryIds = new Set(categories.map((c) => c.parent_id).filter(Boolean));
    const leafCats = categories.filter((c) => !parentCategoryIds.has(c.id));

    categories.filter((c) => !c.parent_id).forEach((p) => parentMap.set(p.id, p));

    const domainGroups: {
      parent: Category | null;
      domainName: string;
      items: Category[];
    }[] = [];

    const groupedByParentId = new Map<string, Category[]>();
    const unparentedItems: Category[] = [];

    leafCats.forEach((c) => {
      // Filter by search query if present
      if (searchCatQuery.trim()) {
        const q = searchCatQuery.trim().toLowerCase();
        const pName = c.parent_id ? parentMap.get(c.parent_id)?.name.toLowerCase() || '' : '';
        if (!c.name.toLowerCase().includes(q) && !pName.includes(q)) {
          return;
        }
      }

      if (c.parent_id && parentMap.has(c.parent_id)) {
        const arr = groupedByParentId.get(c.parent_id) || [];
        arr.push(c);
        groupedByParentId.set(c.parent_id, arr);
      } else {
        unparentedItems.push(c);
      }
    });

    // Populate domains
    parentMap.forEach((parent) => {
      const items = groupedByParentId.get(parent.id) || [];
      if (items.length > 0) {
        domainGroups.push({
          parent,
          domainName: parent.name,
          items,
        });
      }
    });

    if (unparentedItems.length > 0) {
      domainGroups.push({
        parent: null,
        domainName: 'קטגוריות כלליות נוספות',
        items: unparentedItems,
      });
    }

    return domainGroups;
  }, [categories, searchCatQuery]);

  // Floating Tooltip State for hover on amounts
  const [hoveredTooltip, setHoveredTooltip] = useState<{
    title: string;
    plannedAmount?: number;
    actualAmount?: number;
    items: { name: string; amount: number }[];
    extraCount: number;
    x: number;
    y: number;
  } | null>(null);

  // Group Payees / Merchants by Category and Month from 2026 data
  const categoryPayeesMap = useMemo(() => {
    const map: Record<
      string,
      {
        byMonth: Record<number, { name: string; amount: number }[]>;
        overall: { name: string; amount: number }[];
      }
    > = {};

    categories.forEach((cat) => {
      const catTxs = transactions.filter(
        (t) => !t.is_hidden && t.category_id === cat.id && t.date >= '2026-01-01' && t.date <= '2026-10-31'
      );

      // Overall payees in 2026
      const overallMap: Record<string, number> = {};
      catTxs.forEach((t) => {
        const p = t.payee_name?.trim() || 'אחר';
        overallMap[p] = (overallMap[p] || 0) + Number(t.amount);
      });
      const overall = Object.entries(overallMap)
        .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
        .sort((a, b) => b.amount - a.amount);

      // Month by month payees
      const byMonth: Record<number, { name: string; amount: number }[]> = {};
      const stat = categoryStats[cat.id];

      for (let m = 1; m <= 12; m++) {
        let targetTxs = catTxs.filter((t) => parseInt(t.date.substring(5, 7), 10) === m);

        // Fallback for future months (e.g. 11, 12) or months with no txs
        if (targetTxs.length === 0) {
          if (stat?.isBiMonthly) {
            const isEven = m % 2 === 0;
            targetTxs = catTxs.filter((t) => {
              const txM = parseInt(t.date.substring(5, 7), 10);
              return isEven ? txM % 2 === 0 : txM % 2 !== 0;
            });
          } else {
            targetTxs = catTxs;
          }
        }

        const mPayeeMap: Record<string, number> = {};
        targetTxs.forEach((t) => {
          const p = t.payee_name?.trim() || 'אחר';
          mPayeeMap[p] = (mPayeeMap[p] || 0) + Number(t.amount);
        });

        byMonth[m] = Object.entries(mPayeeMap)
          .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
          .sort((a, b) => b.amount - a.amount);
      }

      map[cat.id] = { byMonth, overall };
    });

    return map;
  }, [categories, transactions, categoryStats]);

  // Tooltip Helper functions
  const showMonthTooltip = (e: React.MouseEvent, catId: string, catName: string, month: number) => {
    const payees = categoryPayeesMap[catId]?.byMonth[month] || [];
    if (payees.length === 0) return;
    const actualSum = payees.reduce((acc, p) => acc + p.amount, 0);
    const planned = planState[catId]?.[month] || 0;

    setHoveredTooltip({
      title: `${catName} (${MONTH_NAMES_HE[month - 1]})`,
      plannedAmount: planned,
      actualAmount: actualSum,
      items: payees.slice(0, 5),
      extraCount: Math.max(0, payees.length - 5),
      x: e.clientX,
      y: e.clientY,
    });
  };

  const showAverageTooltip = (e: React.MouseEvent, catId: string, catName: string) => {
    const payees = categoryPayeesMap[catId]?.overall || [];
    if (payees.length === 0) return;
    const avg = categoryStats[catId]?.prevYearAvg || 0;

    setHoveredTooltip({
      title: `ממוצע שנת 2026 - ${catName}`,
      plannedAmount: avg,
      items: payees.slice(0, 6),
      extraCount: Math.max(0, payees.length - 6),
      x: e.clientX,
      y: e.clientY,
    });
  };

  const showTotalTooltip = (e: React.MouseEvent, catId: string, catName: string) => {
    const payees = categoryPayeesMap[catId]?.overall || [];
    if (payees.length === 0) return;
    const catAnnualTotal = Array.from({ length: 12 }, (_, i) => i + 1).reduce(
      (sum, m) => sum + (planState[catId]?.[m] || 0),
      0
    );

    setHoveredTooltip({
      title: `סה"כ שנתי 2027 - ${catName}`,
      plannedAmount: catAnnualTotal,
      items: payees.slice(0, 6),
      extraCount: Math.max(0, payees.length - 6),
      x: e.clientX,
      y: e.clientY,
    });
  };

  // Apply Smart Suggestions
  const handleApplySmartSuggestions = () => {
    const factor = 1 + smartAdjustment / 100;
    setPlanState((prev) => {
      const nextState: Record<string, Record<number, number>> = { ...prev };

      categories.forEach((cat) => {
        const st = categoryStats[cat.id];
        if (!st) return;

        nextState[cat.id] = nextState[cat.id] || {};
        for (let m = 1; m <= 12; m++) {
          let baseVal = st.monthlyDefault[m];
          if (smartSource === 'last_6_months') baseVal = st.last6MonthsAvg;
          else if (smartSource === 'last_3_months') baseVal = st.last3MonthsAvg;

          const calculatedVal = Math.round(baseVal * factor);
          if (calculatedVal > 0) {
            nextState[cat.id][m] = calculatedVal;
          }
        }
      });

      return nextState;
    });

    setIsSmartModalOpen(false);
    setSaveSuccess(false);
  };

  // Group categories under macro categories
  const groupedCategories = useMemo(() => {
    const groups: { macro: MacroCategory; categories: Category[] }[] = [];
    const macroMap = new Map<string, MacroCategory>();
    macroCategories.forEach((m) => macroMap.set(m.id, m));

    // Sort order for macros: Income first or standard order
    const sortedMacros = [...macroCategories].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    // A category that has children serves as a parent domain folder, not a direct line item
    const parentCategoryIds = new Set(categories.map((c) => c.parent_id).filter(Boolean));
    const budgetableCategories = categories.filter((c) => !parentCategoryIds.has(c.id));

    sortedMacros.forEach((macro) => {
      const cats = budgetableCategories.filter((c) => c.macro_category_id === macro.id);
      if (cats.length > 0) {
        groups.push({ macro, categories: cats });
      }
    });

    // Unassigned categories (if any)
    const unassigned = budgetableCategories.filter(
      (c) => !c.macro_category_id || !macroMap.has(c.macro_category_id)
    );
    if (unassigned.length > 0) {
      groups.push({
        macro: {
          id: 'unassigned',
          household_id: activeHousehold?.id || '',
          name: 'שונות / ללא שיוך',
          type: 'expense',
          color: '#6B7280',
          icon: 'HelpCircle',
          display_order: 99,
          created_at: '',
          updated_at: '',
        },
        categories: unassigned,
      });
    }

    return groups;
  }, [macroCategories, categories, activeHousehold]);

  // Filtered displayed groups (Phase 1: Fixed Expenses Only, or All)
  const displayedGroupedCategories = useMemo(() => {
    if (macroFilter === 'fixed_only') {
      const fixedGroups = groupedCategories.filter((g) => g.macro.name.includes('קבועות'));
      return fixedGroups.length > 0 ? fixedGroups : groupedCategories;
    }
    return groupedCategories;
  }, [groupedCategories, macroFilter]);

  // Financial KPIs Calculations (for Selected Month or Annual Sum)
  const kpis = useMemo(() => {
    let incomePlanned = 0;
    let fixedPlanned = 0;
    let variablePlanned = 0;
    let seasonalPlanned = 0;
    let savingsPlanned = 0;
    let otherExpensesPlanned = 0;

    groupedCategories.forEach(({ macro, categories: cats }) => {
      cats.forEach((cat) => {
        let amt = 0;
        if (matrixView) {
          // Sum over all 12 months
          for (let m = 1; m <= 12; m++) {
            amt += planState[cat.id]?.[m] || 0;
          }
        } else {
          amt = planState[cat.id]?.[selectedMonth] || 0;
        }

        if (macro.type === 'income') {
          incomePlanned += amt;
        } else if (macro.name.includes('קבועות')) {
          fixedPlanned += amt;
        } else if (macro.name.includes('משתנות')) {
          variablePlanned += amt;
        } else if (macro.name.includes('עונתיות')) {
          seasonalPlanned += amt;
        } else if (macro.name.includes('חיסכון') || macro.name.includes('השקעות')) {
          savingsPlanned += amt;
        } else {
          otherExpensesPlanned += amt;
        }
      });
    });

    const totalExpenses = fixedPlanned + variablePlanned + seasonalPlanned + otherExpensesPlanned;
    const netProjected = incomePlanned - totalExpenses - savingsPlanned;
    const savingsRate = incomePlanned > 0 ? Math.round((savingsPlanned / incomePlanned) * 100) : 0;

    return {
      incomePlanned,
      fixedPlanned,
      variablePlanned,
      seasonalPlanned,
      savingsPlanned,
      totalExpenses,
      netProjected,
      savingsRate,
    };
  }, [groupedCategories, planState, selectedMonth, matrixView]);

  // Save full plan to DB
  const handleSavePlan = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    const budgetsToSave: Budget[] = [];

    Object.entries(planState).forEach(([catId, monthsMap]) => {
      Object.entries(monthsMap).forEach(([mStr, amount]) => {
        const month = parseInt(mStr, 10);
        if (amount > 0) {
          budgetsToSave.push({
            id: '',
            household_id: activeHousehold?.id || '',
            category_id: catId,
            period_type: 'monthly',
            year: selectedYear,
            month,
            limit_amount: amount,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      });
    });

    const res = await saveYearlyBudgetPlan(selectedYear, budgetsToSave);
    setIsSaving(false);

    if (res.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } else {
      setErrorMessage(res.error || 'שגיאה בשמירת התקציב');
    }
  };

  // Actual Spend helper for tracking mode
  const getCategorySpend = (categoryId: string, month: number) => {
    const monthStr = String(month).padStart(2, '0');
    return transactions
      .filter((t) => {
        if (t.is_hidden || t.category_id !== categoryId) return false;
        return t.date.startsWith(`${selectedYear}-${monthStr}`);
      })
      .reduce((sum, t) => sum + Number(t.amount), 0);
  };

  // Macro icon helper
  const getMacroIcon = (macroName: string) => {
    if (macroName.includes('הכנסות') || macroName.includes('משכורות')) return <TrendingUp size={18} />;
    if (macroName.includes('קבועות')) return <Lock size={18} />;
    if (macroName.includes('משתנות')) return <ShoppingBag size={18} />;
    if (macroName.includes('עונתיות')) return <Calendar size={18} />;
    if (macroName.includes('חיסכון') || macroName.includes('השקעות')) return <PiggyBank size={18} />;
    return <Target size={18} />;
  };

  return (
    <div style={styles.container}>
      {/* 1. Header Toolbar */}
      <div style={styles.topToolbar}>
        <div style={styles.titleArea}>
          <div style={styles.titleBadgeRow}>
            <h2 style={styles.pageTitle}>תכנון ומעקב תקציב</h2>
            <span style={styles.statusYearBadge}>{selectedYear}</span>
          </div>
          <p style={styles.pageSubtitle}>
            הגדרת יעדי הכנסה, הוצאה וחיסכון חודשיים ושנתיים עם הצעות תקציב מבוססות נתוני אמת
          </p>
        </div>

        <div style={styles.actionButtonGroup}>
          {/* Year Display - 2027 */}
          <div style={styles.yearPicker}>
            <span style={{ ...styles.yearBtn, ...styles.yearBtnActive }}>
              תקציב 2027
            </span>
          </div>

          {/* Mode Switcher: Planner vs Tracking */}
          <div style={styles.modeSwitcher}>
            <button
              onClick={() => setViewMode('planner')}
              style={{
                ...styles.modeBtn,
                ...(viewMode === 'planner' ? styles.modeBtnActive : {}),
              }}
            >
              <Sliders size={15} />
              <span>תכנון תקציבי</span>
            </button>
            <button
              onClick={() => setViewMode('tracking')}
              style={{
                ...styles.modeBtn,
                ...(viewMode === 'tracking' ? styles.modeBtnActive : {}),
              }}
            >
              <BarChart3 size={15} />
              <span>מעקב ביצוע</span>
            </button>
          </div>

          {/* Smart Budget Suggestions Button */}
          {viewMode === 'planner' && (
            <button
              onClick={() => setIsSmartModalOpen(true)}
              style={styles.smartSuggestBtn}
              title="הצעת תקציב חכמה מבוססת נתוני אמת"
            >
              <Sparkles size={16} color="#8B5CF6" />
              <span>הצעת תקציב חכמה</span>
            </button>
          )}

          {/* Save Plan Button */}
          {viewMode === 'planner' && (
            <button
              onClick={handleSavePlan}
              disabled={isSaving}
              style={{
                ...styles.saveBtn,
                backgroundColor: saveSuccess ? 'var(--success)' : 'var(--primary)',
              }}
            >
              {isSaving ? (
                <span>שומר...</span>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 size={16} />
                  <span>נשמר בהצלחה!</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>שמור תוכנית תקציב</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div style={styles.errorBanner}>
          <AlertTriangle size={18} color="var(--danger)" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. Top Balanced Cashflow KPI Cards */}
      <div style={styles.kpiContainer}>
        {/* Expected Income */}
        <div style={{ ...styles.kpiCard, borderTopColor: '#10B981' }}>
          <div style={styles.kpiHeader}>
            <span style={styles.kpiLabel}>הכנסות צפויות</span>
            <div style={{ ...styles.kpiIconWrap, backgroundColor: '#ECFDF5', color: '#10B981' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={styles.kpiValue}>
            {currency} {kpis.incomePlanned.toLocaleString()}
          </div>
          <div style={styles.kpiSub}>
            {matrixView ? 'סה"כ הכנסות לכל שנת ' + selectedYear : 'לחודש ' + MONTH_NAMES_HE[selectedMonth - 1]}
          </div>
        </div>

        {/* Planned Expenses */}
        <div style={{ ...styles.kpiCard, borderTopColor: '#EF4444' }}>
          <div style={styles.kpiHeader}>
            <span style={styles.kpiLabel}>הוצאות מתוכננות</span>
            <div style={{ ...styles.kpiIconWrap, backgroundColor: '#FEF2F2', color: '#EF4444' }}>
              <TrendingDown size={18} />
            </div>
          </div>
          <div style={styles.kpiValue}>
            {currency} {kpis.totalExpenses.toLocaleString()}
          </div>
          <div style={styles.kpiSub}>
            קבועות: {currency}{kpis.fixedPlanned.toLocaleString()} | משתנות: {currency}{kpis.variablePlanned.toLocaleString()}
          </div>
        </div>

        {/* Savings & Investments Target */}
        <div style={{ ...styles.kpiCard, borderTopColor: '#06B6D4' }}>
          <div style={styles.kpiHeader}>
            <span style={styles.kpiLabel}>יעד חיסכון והשקעה</span>
            <div style={{ ...styles.kpiIconWrap, backgroundColor: '#ECFEFF', color: '#06B6D4' }}>
              <PiggyBank size={18} />
            </div>
          </div>
          <div style={styles.kpiValue}>
            {currency} {kpis.savingsPlanned.toLocaleString()}
          </div>
          <div style={styles.kpiSub}>
            {kpis.savingsRate}% מסך ההכנסה הצפויה
          </div>
        </div>

        {/* Net Projected Balance */}
        <div
          style={{
            ...styles.kpiCard,
            borderTopColor: kpis.netProjected >= 0 ? '#10B981' : '#EF4444',
            backgroundColor: kpis.netProjected >= 0 ? 'var(--bg-surface)' : 'rgba(239, 68, 68, 0.04)',
          }}
        >
          <div style={styles.kpiHeader}>
            <span style={styles.kpiLabel}>יתרה תזרימית (מאזן)</span>
            <div
              style={{
                ...styles.kpiIconWrap,
                backgroundColor: kpis.netProjected >= 0 ? '#ECFDF5' : '#FEF2F2',
                color: kpis.netProjected >= 0 ? '#10B981' : '#EF4444',
              }}
            >
              <Target size={18} />
            </div>
          </div>
          <div
            style={{
              ...styles.kpiValue,
              color: kpis.netProjected >= 0 ? 'var(--success-text)' : 'var(--danger-text)',
            }}
          >
            {currency} {kpis.netProjected.toLocaleString()}
          </div>
          <div style={styles.kpiSub}>
            {kpis.netProjected >= 0 ? '✨ תקציב מאוזן עם עודף תזרימי' : '⚠️ גירעון תכנוני (הוצאות > הכנסות)'}
          </div>
        </div>
      </div>

      {/* 3. Month Strip Selector & Matrix View Toggle */}
      <div style={styles.monthStripBar}>
        <div style={styles.monthsStrip}>
          {MONTH_NAMES_HE.map((mName, idx) => {
            const mNum = idx + 1;
            const isSelected = !matrixView && selectedMonth === mNum;
            return (
              <button
                key={mNum}
                onClick={() => {
                  setSelectedMonth(mNum);
                  setMatrixView(false);
                }}
                style={{
                  ...styles.monthTabBtn,
                  ...(isSelected ? styles.monthTabBtnActive : {}),
                }}
              >
                <span style={styles.monthNameText}>{mName}</span>
                <span style={styles.monthNumText}>{mNum}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setMatrixView(!matrixView)}
          style={{
            ...styles.matrixToggleBtn,
            ...(matrixView ? styles.matrixToggleBtnActive : {}),
          }}
        >
          <BarChart3 size={15} />
          <span>{matrixView ? 'חזרה לתצוגה חודשית' : 'מטריצה שנתית (12 חודשים)'}</span>
        </button>
      </div>

      {/* 4. PLANNER VIEW: Hierarchical Macro Accordions */}
      {viewMode === 'planner' && (
        <div style={styles.plannerContainer}>
          {/* Phase 1 Focus Filter Bar */}
          <div style={styles.phaseFilterBar}>
            <div style={styles.phaseFilterLeft}>
              <div style={styles.phaseBadge}>
                <span style={styles.phaseBadgeNum}>שלב 1</span>
                <span>מיקוד תכנוני</span>
              </div>
              <div style={styles.phaseToggleGroup}>
                <button
                  onClick={() => setMacroFilter('fixed_only')}
                  style={{
                    ...styles.phaseToggleBtn,
                    ...(macroFilter === 'fixed_only' ? styles.phaseToggleBtnActive : {}),
                  }}
                >
                  <Lock size={15} />
                  <span>הוצאות קבועות בלבד (מומלץ לשלב ראשון)</span>
                </button>
                <button
                  onClick={() => setMacroFilter('all')}
                  style={{
                    ...styles.phaseToggleBtn,
                    ...(macroFilter === 'all' ? styles.phaseToggleBtnActive : {}),
                  }}
                >
                  <Filter size={15} />
                  <span>כלל התקציבים והקטגוריות</span>
                </button>
              </div>
            </div>
            {macroFilter === 'fixed_only' && (
              <div style={styles.phaseHint}>
                💡 התמקדות בהוצאות הידועות מראש (שכירות/משכנתא, ארנונה, חשמל, מים, אינטרנט, מנויים קבועים וכו').
              </div>
            )}
          </div>

          {/* Action Feedback Banner */}
          {actionFeedback && (
            <div
              style={{
                padding: '10px 16px',
                backgroundColor: '#ECFDF5',
                color: '#065F46',
                border: '1px solid #A7F3D0',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.875rem',
                fontWeight: '600',
              }}
            >
              <CheckCircle2 size={18} color="#10B981" />
              <span>{actionFeedback}</span>
            </div>
          )}

          {displayedGroupedCategories.map(({ macro, categories: cats }) => {
            const isExpanded = expandedMacros[macro.id] !== false;

            // Calculate macro subtotal for selected month or year
            let macroSubtotal = 0;
            let macroHistoricalAvg = 0;

            cats.forEach((cat) => {
              if (matrixView) {
                for (let m = 1; m <= 12; m++) macroSubtotal += planState[cat.id]?.[m] || 0;
              } else {
                macroSubtotal += planState[cat.id]?.[selectedMonth] || 0;
              }
              macroHistoricalAvg += categoryStats[cat.id]?.prevYearAvg || 0;
            });

            return (
              <div key={macro.id} style={styles.macroCard}>
                {/* Macro Category Header */}
                <div
                  style={{
                    ...styles.macroHeader,
                    borderRight: `5px solid ${macro.color || 'var(--primary)'}`,
                  }}
                  onClick={() => toggleMacro(macro.id)}
                >
                  <div style={styles.macroHeaderLeft}>
                    <button style={styles.chevronBtn}>
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <div style={{ ...styles.macroIconCircle, backgroundColor: `${macro.color}15`, color: macro.color }}>
                      {getMacroIcon(macro.name)}
                    </div>
                    <div>
                      <div style={styles.macroTitleRow}>
                        <span style={styles.macroTitle}>{macro.name}</span>
                        <span style={styles.categoryCountBadge}>{cats.length} קטגוריות</span>
                      </div>
                      <span style={styles.macroSub}>
                        ממוצע שנת 2026: {currency}{macroHistoricalAvg.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div style={styles.macroHeaderRight}>
                    <div style={styles.macroSubtotalBlock}>
                      <span style={styles.subtotalLabel}>
                        {matrixView ? 'סה"כ תקציב שנתי' : `תקציב ל${MONTH_NAMES_HE[selectedMonth - 1]}`}
                      </span>
                      <span style={{ ...styles.subtotalValue, color: macro.color || 'var(--text-primary)' }}>
                        {currency} {macroSubtotal.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Categories Table / Rows */}
                {isExpanded && (
                  <div style={styles.categoriesTableWrapper}>
                    <table style={{ ...styles.categoriesTable, tableLayout: matrixView ? 'fixed' : 'auto' }}>
                      <thead>
                        <tr>
                          <th style={{ ...styles.thCell, textAlign: 'right', width: matrixView ? '15%' : '28%', padding: matrixView ? '8px 4px' : '10px 16px' }}>
                            קטגוריה
                          </th>
                          <th style={{ ...styles.thCell, textAlign: 'center', width: matrixView ? '8%' : '18%', padding: matrixView ? '8px 2px' : '10px 16px' }}>
                            {matrixView ? 'ממוצע' : 'ממוצע הוצאה (אמת)'}
                          </th>
                          {matrixView ? (
                            <>
                              {MONTH_SHORT_NAMES_HE.map((m, idx) => (
                                <th key={idx} style={{ ...styles.thCell, textAlign: 'center', padding: '8px 1px', fontSize: '0.71875rem', width: '5.4%' }}>
                                  {m}
                                </th>
                              ))}
                              <th style={{ ...styles.thCell, textAlign: 'center', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', fontWeight: '800', padding: '8px 2px', fontSize: '0.71875rem', width: '7%' }}>
                                סה"כ
                              </th>
                              <th style={{ ...styles.thCell, textAlign: 'center', width: '5.2%', padding: '8px 2px', fontSize: '0.71875rem' }}>
                                פעולות
                              </th>
                            </>
                          ) : (
                            <>
                              <th style={{ ...styles.thCell, textAlign: 'center', width: '22%' }}>
                                תקציב מתוכנן ({MONTH_NAMES_HE[selectedMonth - 1]})
                              </th>
                              <th style={{ ...styles.thCell, textAlign: 'center', width: '32%' }}>פעולות מהירות</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {cats.map((cat) => {
                          const stats = categoryStats[cat.id] || { last6MonthsAvg: 0, prevYearAvg: 0, last3MonthsAvg: 0 };
                          const currentVal = planState[cat.id]?.[selectedMonth] || 0;
                          const catAnnualTotal = Array.from({ length: 12 }, (_, i) => i + 1).reduce(
                            (sum, m) => sum + (planState[cat.id]?.[m] || 0),
                            0
                          );

                          return (
                            <tr key={cat.id} style={styles.catRow}>
                              {/* Category Name */}
                              <td style={{ ...styles.tdCell, padding: matrixView ? '6px 4px' : '12px 16px' }}>
                                <div style={styles.categoryNameCol} title={cat.name}>
                                  <div
                                    style={{
                                      ...styles.categoryDot,
                                      backgroundColor: cat.color || macro.color || 'var(--primary)',
                                      width: matrixView ? '7px' : '10px',
                                      height: matrixView ? '7px' : '10px',
                                      flexShrink: 0,
                                    }}
                                  />
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                    {cat.parent_id && (() => {
                                      const parentCat = categories.find((c) => c.id === cat.parent_id);
                                      return parentCat ? (
                                        <span
                                          style={{
                                            fontSize: matrixView ? '0.65rem' : '0.75rem',
                                            color: 'var(--text-tertiary)',
                                            backgroundColor: 'var(--bg-tertiary)',
                                            padding: '1px 4px',
                                            borderRadius: '3px',
                                            flexShrink: 0,
                                          }}
                                        >
                                          {parentCat.name} ›
                                        </span>
                                      ) : null;
                                    })()}
                                    <span
                                      style={{
                                        ...styles.catNameText,
                                        fontSize: matrixView ? '0.75rem' : '0.875rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                    >
                                      {cat.name}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Historical Average Badge */}
                              <td style={{ ...styles.tdCell, textAlign: 'center', padding: matrixView ? '4px 2px' : '12px 16px' }}>
                                <div
                                  style={{ ...styles.avgBadge, padding: matrixView ? '2px 4px' : '4px 10px', cursor: 'pointer' }}
                                  onMouseEnter={(e) => showAverageTooltip(e, cat.id, cat.name)}
                                  onMouseMove={(e) => {
                                    if (hoveredTooltip) setHoveredTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
                                  }}
                                  onMouseLeave={() => setHoveredTooltip(null)}
                                >
                                  <span style={{ ...styles.avgBadgeValue, fontSize: matrixView ? '0.71875rem' : '0.8125rem' }}>
                                    {currency}{stats.prevYearAvg.toLocaleString()}
                                  </span>
                                  {!matrixView && (
                                    <span style={styles.avgBadgeSub}>ממוצע שנת 2026 (10 חודשים)</span>
                                  )}
                                  {stats.isBiMonthly && (
                                    <span
                                      style={{
                                        ...styles.biMonthlyTag,
                                        fontSize: matrixView ? '0.5625rem' : '0.625rem',
                                        padding: matrixView ? '1px 3px' : '2px 6px',
                                        marginTop: matrixView ? '1px' : '3px',
                                      }}
                                    >
                                      {matrixView ? 'דו-חודשי' : `אחת לחודשיים (${stats.biMonthlyType === 'even' ? 'חודש זוגי' : 'חודש אי-זוגי'})`}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Matrix View (12 columns + Total + Actions) vs Single Month View */}
                              {matrixView ? (
                                <>
                                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                                    const mVal = planState[cat.id]?.[m] || 0;
                                    return (
                                      <td key={m} style={{ ...styles.tdCell, padding: '2px 1px' }}>
                                        <input
                                          type="number"
                                          min="0"
                                          step="50"
                                          value={mVal === 0 ? '' : mVal}
                                          onChange={(e) => handleAmountChange(cat.id, m, e.target.value)}
                                          onMouseEnter={(e) => showMonthTooltip(e, cat.id, cat.name, m)}
                                          onMouseMove={(e) => {
                                            if (hoveredTooltip) setHoveredTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
                                          }}
                                          onMouseLeave={() => setHoveredTooltip(null)}
                                          placeholder="0"
                                          style={styles.matrixInput}
                                        />
                                      </td>
                                    );
                                  })}
                                  {/* Row Total (Sum of all months) */}
                                  <td
                                    onMouseEnter={(e) => showTotalTooltip(e, cat.id, cat.name)}
                                    onMouseMove={(e) => {
                                      if (hoveredTooltip) setHoveredTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
                                    }}
                                    onMouseLeave={() => setHoveredTooltip(null)}
                                    style={{
                                      ...styles.tdCell,
                                      textAlign: 'center',
                                      backgroundColor: 'rgba(59, 130, 246, 0.05)',
                                      fontWeight: '800',
                                      color: 'var(--text-primary)',
                                      whiteSpace: 'nowrap',
                                      fontSize: '0.75rem',
                                      padding: '4px 1px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {currency}{catAnnualTotal.toLocaleString()}
                                  </td>
                                  {/* Row Actions: Reset Row & Remove from Macro */}
                                  <td style={{ ...styles.tdCell, textAlign: 'center', padding: '2px 1px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                      <button
                                        onClick={() => handleResetRow(cat.id, cat.name)}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          cursor: 'pointer',
                                          padding: '3px 4px',
                                          borderRadius: '4px',
                                          color: 'var(--text-tertiary)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          transition: 'all 0.15s ease',
                                        }}
                                        title={`איפוס שורה: איפוס כל 12 החודשים בשורה זו ל-0 ₪`}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.color = '#F59E0B';
                                          e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.12)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.color = 'var(--text-tertiary)';
                                          e.currentTarget.style.backgroundColor = 'transparent';
                                        }}
                                      >
                                        <RotateCcw size={13} />
                                      </button>
                                      <button
                                        onClick={() => handleRemoveCategoryFromMacro(cat, macro)}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          cursor: 'pointer',
                                          padding: '3px 4px',
                                          borderRadius: '4px',
                                          color: 'var(--text-tertiary)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          transition: 'all 0.15s ease',
                                        }}
                                        title={`הסר שורה זו מתכנון ${macro.name}`}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.color = 'var(--danger)';
                                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.color = 'var(--text-tertiary)';
                                          e.currentTarget.style.backgroundColor = 'transparent';
                                        }}
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  {/* Amount Input */}
                                  <td style={{ ...styles.tdCell, textAlign: 'center' }}>
                                    <div style={styles.inputWrapper}>
                                      <span style={styles.inputCurrencyPrefix}>{currency}</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="50"
                                        value={currentVal === 0 ? '' : currentVal}
                                        onChange={(e) => handleAmountChange(cat.id, selectedMonth, e.target.value)}
                                        onMouseEnter={(e) => showMonthTooltip(e, cat.id, cat.name, selectedMonth)}
                                        onMouseMove={(e) => {
                                          if (hoveredTooltip) setHoveredTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
                                        }}
                                        onMouseLeave={() => setHoveredTooltip(null)}
                                        placeholder="0"
                                        style={styles.amountInput}
                                      />
                                    </div>
                                  </td>

                                  {/* Quick Actions: Copy to all months, Reset Row, Remove Row */}
                                  <td style={{ ...styles.tdCell, textAlign: 'center' }}>
                                    <div style={styles.quickActionsGroup}>
                                      <button
                                        onClick={() => applyToAllMonths(cat.id, selectedMonth)}
                                        style={styles.quickActionBtn}
                                        title="החל סכום זה על כל 12 חודשי השנה"
                                      >
                                        <Copy size={13} />
                                        <span>החל על כל השנה</span>
                                      </button>
                                      <button
                                        onClick={() => handleResetRow(cat.id, cat.name)}
                                        style={{ ...styles.quickActionBtn, color: '#D97706' }}
                                        title="אפס את כל 12 החודשים בשורה זו ל-0"
                                      >
                                        <RotateCcw size={13} />
                                        <span>אפס שורה</span>
                                      </button>
                                      <button
                                        onClick={() => handleRemoveCategoryFromMacro(cat, macro)}
                                        style={{ ...styles.quickActionBtn, color: 'var(--danger)' }}
                                        title={`הסר שורה זו מתכנון ${macro.name}`}
                                      >
                                        <Trash2 size={13} />
                                        <span>הסר שורה</span>
                                      </button>
                                      {stats.monthlyDefault?.[selectedMonth] > 0 && (
                                        <button
                                          onClick={() =>
                                            handleAmountChange(cat.id, selectedMonth, String(stats.monthlyDefault[selectedMonth]))
                                          }
                                          style={styles.quickActionSubBtn}
                                          title="קבע לפי הערכת מודל האמת (כולל התחשבות בדו-חודשי)"
                                        >
                                          <span>הערכה: {currency}{stats.monthlyDefault[selectedMonth]}</span>
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Matrix View Subtotals Footer */}
                      {matrixView && (
                        <tfoot>
                          <tr style={{ backgroundColor: 'var(--bg-app)', borderTop: '2px solid var(--border-main)', fontWeight: '800' }}>
                            <td style={{ ...styles.tdCell, textAlign: 'right', fontWeight: '800', padding: '6px 4px', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              סה"כ {macro.name}
                            </td>
                            <td style={{ ...styles.tdCell, textAlign: 'center', fontWeight: '800', color: 'var(--text-secondary)', padding: '6px 2px', fontSize: '0.71875rem', whiteSpace: 'nowrap' }}>
                              {currency}{macroHistoricalAvg.toLocaleString()}
                            </td>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                              const monthSum = cats.reduce((acc, cat) => acc + (planState[cat.id]?.[m] || 0), 0);
                              return (
                                <td key={m} style={{ ...styles.tdCell, textAlign: 'center', padding: '6px 1px', fontSize: '0.6875rem', whiteSpace: 'nowrap', fontWeight: '700' }}>
                                  {currency}{monthSum.toLocaleString()}
                                </td>
                              );
                            })}
                            <td
                              style={{
                                ...styles.tdCell,
                                textAlign: 'center',
                                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                                color: 'var(--primary)',
                                fontWeight: '900',
                                fontSize: '0.75rem',
                                whiteSpace: 'nowrap',
                                padding: '6px 2px',
                              }}
                            >
                              {currency}{macroSubtotal.toLocaleString()}
                            </td>
                            <td style={{ ...styles.tdCell, textAlign: 'center', padding: '6px 1px' }}></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>

                    {/* Add Category Row to this Macro */}
                    <div
                      style={{
                        padding: '10px 16px',
                        backgroundColor: 'var(--bg-surface)',
                        borderTop: '1px dashed var(--border-main)',
                        display: 'flex',
                        justifyContent: 'flex-start',
                        alignItems: 'center',
                      }}
                    >
                      <button
                        onClick={() => {
                          setTargetMacroForAdd(macro);
                          setIsAddRowModalOpen(true);
                          setSearchCatQuery('');
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(59, 130, 246, 0.08)',
                          color: 'var(--primary)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          fontSize: '0.8125rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.16)';
                          e.currentTarget.style.borderColor = 'var(--primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.08)';
                          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.25)';
                        }}
                      >
                        <Plus size={15} />
                        <span>הוסף שורה לתכנון {macro.name} (על בסיס מבנה הקטגוריות)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 5. TRACKING VIEW: Actual Spends vs Budget */}
      {viewMode === 'tracking' && (
        <div style={styles.trackingContainer}>
          <div style={styles.trackingNotice}>
            <Calendar size={18} color="var(--primary)" />
            <span>
              מעקב ביצוע בפועל מול תקציב לחודש <strong>{MONTH_NAMES_HE[selectedMonth - 1]} {selectedYear}</strong> מתוך תנועות האמת במסד הנתונים
            </span>
          </div>

          <div style={styles.trackingGrid}>
            {displayedGroupedCategories.map(({ macro, categories: cats }) => (
              <div key={macro.id} style={styles.trackingMacroSection}>
                <div style={styles.trackingMacroTitle}>
                  <div style={{ ...styles.macroIconCircle, backgroundColor: `${macro.color}15`, color: macro.color }}>
                    {getMacroIcon(macro.name)}
                  </div>
                  <span>{macro.name}</span>
                </div>

                <div style={styles.trackingCardsList}>
                  {cats.map((cat) => {
                    const planned = planState[cat.id]?.[selectedMonth] || 0;
                    const spent = getCategorySpend(cat.id, selectedMonth);
                    const pct = planned > 0 ? Math.round((spent / planned) * 100) : 0;
                    const isOver = spent > planned && planned > 0;
                    const remaining = planned - spent;

                    let barColor = '#10B981';
                    if (pct > 90 || isOver) barColor = '#EF4444';
                    else if (pct > 70) barColor = '#F59E0B';

                    return (
                      <div key={cat.id} style={styles.trackCard}>
                        <div style={styles.trackCardHeader}>
                          <div style={styles.trackCatNameWrap}>
                            <div style={{ ...styles.categoryDot, backgroundColor: cat.color || macro.color }} />
                            {cat.parent_id && (() => {
                              const parentCat = categories.find((c) => c.id === cat.parent_id);
                              return parentCat ? (
                                <span
                                  style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--text-tertiary)',
                                    backgroundColor: 'var(--bg-tertiary)',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    flexShrink: 0,
                                  }}
                                >
                                  {parentCat.name} ›
                                </span>
                              ) : null;
                            })()}
                            <span style={styles.trackCatName}>{cat.name}</span>
                          </div>
                          {isOver ? (
                            <div style={styles.overBadge}>
                              <AlertTriangle size={12} color="#EF4444" />
                              <span>חריגה!</span>
                            </div>
                          ) : (
                            <span style={styles.pctBadge}>{pct}%</span>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div style={styles.progressTrack}>
                          <div
                            style={{
                              ...styles.progressFill,
                              width: `${Math.min(100, pct)}%`,
                              backgroundColor: barColor,
                            }}
                          />
                        </div>

                        {/* Numbers */}
                        <div style={styles.trackNumbers}>
                          <div>
                            <span style={styles.spentLabel}>בוצע: </span>
                            <span style={{ fontWeight: '700', color: isOver ? 'var(--danger-text)' : 'var(--text-primary)' }}>
                              {currency} {spent.toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span style={styles.spentLabel}>תקציב: </span>
                            <span>{currency} {planned.toLocaleString()}</span>
                          </div>
                        </div>

                        <div style={styles.remainingFooter}>
                          {isOver
                            ? `חריגה של ${currency} ${Math.abs(remaining).toLocaleString()}`
                            : `נותרו עוד ${currency} ${remaining.toLocaleString()}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Smart Suggestions Modal */}
      {isSmartModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleRow}>
                <Sparkles size={20} color="#8B5CF6" />
                <h3 style={styles.modalTitle}>הצעת תקציב חכמה מבוססת נתוני אמת</h3>
              </div>
              <button onClick={() => setIsSmartModalOpen(false)} style={styles.closeBtn}>
                <X size={18} />
              </button>
            </div>

            <p style={styles.modalDesc}>
              המערכת מנתחת את היסטוריית התנועות שלך מתוך בסיס הנתונים ומחשבת תקציב מוצע מותאם אישית לכל קטגוריה לשנת {selectedYear}.
            </p>

            {/* Source selector */}
            <div style={styles.modalField}>
              <label style={styles.modalLabel}>בסיס חישוב הממוצע:</label>
              <div style={styles.modalOptionsGrid}>
                <button
                  onClick={() => setSmartSource('last_6_months')}
                  style={{
                    ...styles.modalOptionBtn,
                    ...(smartSource === 'last_6_months' ? styles.modalOptionBtnActive : {}),
                  }}
                >
                  <span style={styles.optTitle}>ממוצע 6 חודשים אחרונים (2026)</span>
                  <span style={styles.optSub}>משקף את רמת המחייה ודפוסי הצריכה העדכניים ביותר</span>
                </button>

                <button
                  onClick={() => setSmartSource('last_3_months')}
                  style={{
                    ...styles.modalOptionBtn,
                    ...(smartSource === 'last_3_months' ? styles.modalOptionBtnActive : {}),
                  }}
                >
                  <span style={styles.optTitle}>ממוצע 3 חודשים אחרונים (רבעון אחרון)</span>
                  <span style={styles.optSub}>מותאם לשינויים מידיים שנכנסו לאחרונה</span>
                </button>

                <button
                  onClick={() => setSmartSource('prev_year')}
                  style={{
                    ...styles.modalOptionBtn,
                    ...(smartSource === 'prev_year' ? styles.modalOptionBtnActive : {}),
                  }}
                >
                  <span style={styles.optTitle}>ממוצע שנת 2026 (ביצוע שנה אחרונה)</span>
                  <span style={styles.optSub}>מבוסס על נתוני האמת של שנת 2026</span>
                </button>
              </div>
            </div>

            {/* Adjustment Factor */}
            <div style={styles.modalField}>
              <label style={styles.modalLabel}>מקדם התאמה באחוזים (חיסכון או הרחבה):</label>
              <div style={styles.factorButtonsRow}>
                {[-10, -5, 0, 5, 10].map((adj) => (
                  <button
                    key={adj}
                    onClick={() => setSmartAdjustment(adj)}
                    style={{
                      ...styles.factorBtn,
                      ...(smartAdjustment === adj ? styles.factorBtnActive : {}),
                    }}
                  >
                    {adj > 0 ? `+${adj}%` : `${adj}%`}
                  </button>
                ))}
              </div>
              <span style={styles.factorHint}>
                {smartAdjustment < 0
                  ? `הפחתת יעד של ${Math.abs(smartAdjustment)}% להתייעלות וחיסכון`
                  : smartAdjustment > 0
                  ? `הגדלת תקציב של ${smartAdjustment}% ככרית ביטחון / עליות מחירים`
                  : 'לפי ממוצע האמת המדויק (ללא שינוי)'}
              </span>
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => setIsSmartModalOpen(false)} style={styles.cancelBtn}>
                ביטול
              </button>
              <button onClick={handleApplySmartSuggestions} style={styles.applyBtn}>
                <Sparkles size={16} />
                <span>החל הצעת תקציב על כל החודשים</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Row based on Category Structure Modal */}
      {isAddRowModalOpen && targetMacroForAdd && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: '640px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleRow}>
                <FolderPlus size={20} color="var(--primary)" />
                <h3 style={styles.modalTitle}>
                  הוספת שורה לתכנון: {targetMacroForAdd.name}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsAddRowModalOpen(false);
                  setSearchCatQuery('');
                }}
                style={styles.closeBtn}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ ...styles.modalDesc, marginBottom: 0 }}>
              בחר קטגוריה קיימת מתוך המבנה הטבלאי ההיררכי של הקטגוריות או צור קטגוריית משנה חדשה ישירות לקבוצה זו.
            </p>

            {/* Modal Tabs: Existing vs New */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-main)', paddingBottom: '8px' }}>
              <button
                onClick={() => setAddModalTab('existing')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  fontWeight: '700',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: addModalTab === 'existing' ? 'var(--primary)' : 'var(--bg-app)',
                  color: addModalTab === 'existing' ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                בחירה מתוך עץ הקטגוריות הקיים
              </button>
              <button
                onClick={() => setAddModalTab('new')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  fontWeight: '700',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: addModalTab === 'new' ? 'var(--primary)' : 'var(--bg-app)',
                  color: addModalTab === 'new' ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                + יצירת קטגוריית משנה חדשה
              </button>
            </div>

            {/* Tab 1: Existing Categories Tree */}
            {addModalTab === 'existing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: 0 }}>
                {/* Search Bar */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={16} style={{ position: 'absolute', right: '10px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={searchCatQuery}
                    onChange={(e) => setSearchCatQuery(e.target.value)}
                    placeholder="חיפוש קטגוריה לפי שם או תחום אב..."
                    style={{
                      width: '100%',
                      padding: '8px 34px 8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-main)',
                      backgroundColor: 'var(--bg-app)',
                      fontSize: '0.8125rem',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                  {searchCatQuery && (
                    <button
                      onClick={() => setSearchCatQuery('')}
                      style={{ position: 'absolute', left: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Categories List (Grouped by Parent Category) */}
                <div style={{ overflowY: 'auto', flex: 1, maxHeight: '340px', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {categorizedForAddModal.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                      לא נמצאו קטגוריות התואמות לחיפוש
                    </div>
                  ) : (
                    categorizedForAddModal.map((group, gIdx) => (
                      <div key={gIdx} style={{ backgroundColor: 'var(--bg-app)', borderRadius: '8px', padding: '10px 12px', border: '1px solid var(--border-main)' }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: group.parent?.color || 'var(--primary)' }} />
                          <span>{group.domainName}</span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                            ({group.items.length})
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
                          {group.items.map((cat) => {
                            const isAlreadyInTarget = cat.macro_category_id === targetMacroForAdd.id;
                            const currentMacro = macroCategories.find((m) => m.id === cat.macro_category_id);

                            return (
                              <div
                                key={cat.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 10px',
                                  backgroundColor: 'var(--bg-surface)',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-subtle)',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: cat.color || 'var(--primary)' }} />
                                  <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                                    {cat.name}
                                  </span>
                                  {currentMacro && (
                                    <span
                                      style={{
                                        fontSize: '0.6875rem',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        backgroundColor: isAlreadyInTarget ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-tertiary)',
                                        color: isAlreadyInTarget ? '#10B981' : 'var(--text-muted)',
                                        fontWeight: isAlreadyInTarget ? '700' : 'normal',
                                      }}
                                    >
                                      {isAlreadyInTarget ? '✓ משויך כעת לקבוצה זו' : `שיוך נוכחי: ${currentMacro.name}`}
                                    </span>
                                  )}
                                </div>

                                <div>
                                  {isAlreadyInTarget ? (
                                    <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: '700' }}>
                                      קיים בטבלה
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handleAddCategoryToMacro(cat, targetMacroForAdd)}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '4px 10px',
                                        borderRadius: '5px',
                                        fontSize: '0.75rem',
                                        fontWeight: '700',
                                        backgroundColor: 'var(--primary)',
                                        color: '#ffffff',
                                        border: 'none',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <Plus size={13} />
                                      <span>הוסף לתכנון</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Create New Subcategory */}
            {addModalTab === 'new' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={styles.modalField}>
                  <label style={styles.modalLabel}>תחום אב (קטגוריית אב):</label>
                  <select
                    value={newSubcatParentId}
                    onChange={(e) => setNewSubcatParentId(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-main)',
                      backgroundColor: 'var(--bg-app)',
                      fontSize: '0.8125rem',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  >
                    <option value="">ללא תחום אב (עצמאי)</option>
                    {parentCategories.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.modalField}>
                  <label style={styles.modalLabel}>שם קטגוריית המשנה החדשה:</label>
                  <input
                    type="text"
                    value={newSubcatName}
                    onChange={(e) => setNewSubcatName(e.target.value)}
                    placeholder="לדוגמה: שכר דירה, ועד בית, מנוי שירות ענן..."
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-main)',
                      backgroundColor: 'var(--bg-app)',
                      fontSize: '0.8125rem',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={styles.modalActions}>
                  <button
                    onClick={() => {
                      setIsAddRowModalOpen(false);
                      setNewSubcatName('');
                    }}
                    style={styles.cancelBtn}
                  >
                    ביטול
                  </button>
                  <button
                    onClick={() => handleCreateAndAddSubcategory(targetMacroForAdd)}
                    disabled={!newSubcatName.trim()}
                    style={{
                      ...styles.applyBtn,
                      opacity: newSubcatName.trim() ? 1 : 0.5,
                      cursor: newSubcatName.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <Plus size={16} />
                    <span>צור והוסף לתכנון {targetMacroForAdd.name}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* 7. Floating Hover Tooltip for Businesses / Payees */}
      {hoveredTooltip && (
        <div
          style={{
            position: 'fixed',
            top: Math.min(window.innerHeight - 260, hoveredTooltip.y + 14),
            left: Math.max(16, Math.min(window.innerWidth - 320, hoveredTooltip.x - 140)),
            backgroundColor: 'rgba(15, 23, 42, 0.97)',
            color: '#FFFFFF',
            padding: '12px 16px',
            borderRadius: '10px',
            boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            zIndex: 99999,
            pointerEvents: 'none',
            fontSize: '0.75rem',
            minWidth: '240px',
            maxWidth: '320px',
            lineHeight: '1.4',
            direction: 'rtl',
            textAlign: 'right',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {/* Header */}
          <div
            style={{
              fontWeight: '800',
              color: '#93C5FD',
              marginBottom: '6px',
              fontSize: '0.8125rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              paddingBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShoppingBag size={14} color="#93C5FD" />
              <span>{hoveredTooltip.title}</span>
            </div>
          </div>

          {/* Planned vs Actual Comparison Box */}
          {hoveredTooltip.plannedAmount !== undefined && hoveredTooltip.actualAmount !== undefined && (
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                padding: '6px 10px',
                borderRadius: '6px',
                marginBottom: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                fontSize: '0.6875rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>סכום בתא (יעד 2027):</span>
                <span style={{ color: '#60A5FA', fontWeight: '800' }}>
                  {currency} {hoveredTooltip.plannedAmount.toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>ביצוע בפועל ב-2026:</span>
                <span style={{ color: '#FCD34D', fontWeight: '800' }}>
                  {currency} {hoveredTooltip.actualAmount.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Business Breakdown */}
          <div style={{ fontSize: '0.6875rem', color: '#CBD5E1', marginBottom: '4px', fontWeight: '700' }}>
            מקורות ההוצאה לפי בתי עסק:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {hoveredTooltip.items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span
                  style={{
                    color: '#E2E8F0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '190px',
                  }}
                  title={item.name}
                >
                  • {item.name}
                </span>
                <span style={{ fontWeight: '700', color: '#FCD34D', flexShrink: 0 }}>
                  {currency} {item.amount.toLocaleString()}
                </span>
              </div>
            ))}
            {hoveredTooltip.extraCount > 0 && (
              <div
                style={{
                  fontSize: '0.6875rem',
                  color: '#94A3B8',
                  marginTop: '3px',
                  borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
                  paddingTop: '3px',
                }}
              >
                + עוד {hoveredTooltip.extraCount} בתי עסק נוספים
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    paddingBottom: '60px',
  },
  topToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
    backgroundColor: 'var(--bg-surface)',
    padding: '20px 24px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    boxShadow: 'var(--shadow-sm)',
  },
  titleArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  titleBadgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  pageTitle: {
    fontSize: '1.4rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  statusYearBadge: {
    fontSize: '0.8125rem',
    fontWeight: '800',
    padding: '3px 10px',
    borderRadius: '12px',
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
  },
  pageSubtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  actionButtonGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  yearPicker: {
    display: 'flex',
    backgroundColor: 'var(--bg-app)',
    padding: '3px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
  },
  yearBtn: {
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  yearBtnActive: {
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    fontWeight: '800',
    boxShadow: 'var(--shadow-sm)',
  },
  modeSwitcher: {
    display: 'flex',
    backgroundColor: 'var(--bg-app)',
    padding: '3px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
  },
  modeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  modeBtnActive: {
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    fontWeight: '700',
  },
  smartSuggestBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '700',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    color: '#8B5CF6',
    border: '1px solid rgba(139, 92, 246, 0.25)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  saveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 18px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: '#ffffff',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: 'var(--shadow-sm)',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: 'var(--danger-light)',
    color: 'var(--danger-text)',
    padding: '12px 18px',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: '600',
  },
  kpiContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
  },
  kpiCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
    border: '1px solid var(--border-main)',
    borderTopWidth: '4px',
    borderTopStyle: 'solid',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  kpiHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiLabel: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
  },
  kpiIconWrap: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  kpiSub: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  monthStripBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    backgroundColor: 'var(--bg-surface)',
    padding: '8px 12px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    flexWrap: 'wrap',
  },
  monthsStrip: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    overflowX: 'auto',
    flex: 1,
    padding: '4px 0',
  },
  monthTabBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    padding: '6px 14px',
    borderRadius: 'var(--radius-sm)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    transition: 'all 0.15s',
  },
  monthTabBtnActive: {
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    fontWeight: '800',
  },
  monthNameText: {
    fontSize: '0.8125rem',
  },
  monthNumText: {
    fontSize: '0.6875rem',
    opacity: 0.6,
  },
  matrixToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '700',
    backgroundColor: 'var(--bg-app)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-main)',
    cursor: 'pointer',
  },
  matrixToggleBtnActive: {
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    borderColor: 'var(--primary)',
  },
  phaseFilterBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    backgroundColor: 'var(--bg-surface)',
    padding: '12px 18px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-main)',
    flexWrap: 'wrap',
  },
  phaseFilterLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  phaseBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.75rem',
    fontWeight: '800',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    padding: '4px 10px',
    borderRadius: '20px',
  },
  phaseBadgeNum: {
    backgroundColor: '#D97706',
    color: '#FFFFFF',
    borderRadius: '50%',
    width: '18px',
    height: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.6875rem',
  },
  phaseToggleGroup: {
    display: 'flex',
    backgroundColor: 'var(--bg-app)',
    padding: '3px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
  },
  phaseToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  phaseToggleBtnActive: {
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    fontWeight: '700',
    boxShadow: 'var(--shadow-sm)',
  },
  phaseHint: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  plannerContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  macroCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
  },
  macroHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    cursor: 'pointer',
    backgroundColor: 'var(--bg-surface)',
    transition: 'background-color 0.2s',
  },
  macroHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  chevronBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    padding: 0,
  },
  macroIconCircle: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  macroTitle: {
    fontSize: '1rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  categoryCountBadge: {
    fontSize: '0.6875rem',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: '10px',
    backgroundColor: 'var(--bg-app)',
    color: 'var(--text-secondary)',
  },
  macroSub: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  macroHeaderRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  macroSubtotalBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  subtotalLabel: {
    fontSize: '0.6875rem',
    color: 'var(--text-secondary)',
    fontWeight: '600',
  },
  subtotalValue: {
    fontSize: '1.125rem',
    fontWeight: '800',
  },
  categoriesTableWrapper: {
    width: '100%',
    overflowX: 'hidden',
    borderTop: '1px solid var(--border-subtle)',
  },
  categoriesTable: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  thCell: {
    padding: '10px 16px',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-app)',
    borderBottom: '1px solid var(--border-subtle)',
  },
  catRow: {
    borderBottom: '1px solid var(--border-subtle)',
    transition: 'background-color 0.15s',
  },
  tdCell: {
    padding: '12px 16px',
    fontSize: '0.875rem',
  },
  categoryNameCol: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  categoryDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  catNameText: {
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  avgBadge: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: 'var(--bg-app)',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '0.8125rem',
  },
  avgBadgeValue: {
    fontWeight: '800',
    color: 'var(--text-primary)',
    fontSize: '0.8125rem',
  },
  avgBadgeSub: {
    fontSize: '0.625rem',
    fontWeight: '500',
    color: 'var(--text-muted)',
    marginTop: '1px',
  },
  biMonthlyTag: {
    fontSize: '0.625rem',
    fontWeight: '700',
    color: '#B45309',
    backgroundColor: '#FEF3C7',
    padding: '2px 6px',
    borderRadius: '4px',
    marginTop: '3px',
    display: 'inline-block',
  },
  inputWrapper: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: 'var(--bg-app)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
    padding: '2px 8px',
  },
  inputCurrencyPrefix: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: '700',
    marginRight: '4px',
  },
  amountInput: {
    border: 'none',
    background: 'transparent',
    padding: '6px 4px',
    fontSize: '0.9375rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    textAlign: 'center',
    width: '100px',
    outline: 'none',
  },
  matrixInput: {
    border: '1px solid var(--border-main)',
    backgroundColor: 'var(--bg-app)',
    borderRadius: '4px',
    padding: '4px 1px',
    fontSize: '0.71875rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    textAlign: 'center',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  },
  quickActionsGroup: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  quickActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '0.6875rem',
    fontWeight: '700',
    backgroundColor: 'var(--bg-app)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-main)',
    cursor: 'pointer',
  },
  quickActionSubBtn: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.6875rem',
    fontWeight: '600',
    backgroundColor: 'transparent',
    color: 'var(--primary)',
    border: '1px solid var(--primary-light)',
    cursor: 'pointer',
  },
  trackingContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  trackingNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    padding: '12px 18px',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
  },
  trackingGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  trackingMacroSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  trackingMacroTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '1rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  trackingCardsList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '14px',
  },
  trackCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-main)',
    padding: '16px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  trackCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackCatNameWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  trackCatName: {
    fontSize: '0.875rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  overBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: '#FEF2F2',
    color: '#EF4444',
    fontSize: '0.6875rem',
    fontWeight: '800',
  },
  pctBadge: {
    fontSize: '0.8125rem',
    fontWeight: '800',
    color: 'var(--text-secondary)',
  },
  progressTrack: {
    height: '6px',
    backgroundColor: 'var(--bg-app)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  trackNumbers: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.75rem',
  },
  spentLabel: {
    color: 'var(--text-muted)',
  },
  remainingFooter: {
    borderTop: '1px solid var(--border-subtle)',
    paddingTop: '6px',
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modalContent: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '24px',
    maxWidth: '560px',
    width: '100%',
    boxShadow: 'var(--shadow-lg)',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  modalTitle: {
    fontSize: '1.125rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
  },
  modalDesc: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    margin: 0,
  },
  modalField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  modalLabel: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  modalOptionsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  modalOptionBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '2px',
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
    backgroundColor: 'var(--bg-app)',
    cursor: 'pointer',
    textAlign: 'right',
    transition: 'all 0.15s',
  },
  modalOptionBtnActive: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  optTitle: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  optSub: {
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
  },
  factorButtonsRow: {
    display: 'flex',
    gap: '8px',
  },
  factorBtn: {
    flex: 1,
    padding: '8px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
    backgroundColor: 'var(--bg-app)',
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  factorBtnActive: {
    borderColor: '#8B5CF6',
    backgroundColor: '#8B5CF6',
    color: '#ffffff',
  },
  factorHint: {
    fontSize: '0.6875rem',
    color: 'var(--text-secondary)',
  },
  modalActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '6px',
  },
  cancelBtn: {
    padding: '8px 16px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
    backgroundColor: 'var(--bg-app)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  applyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 18px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    backgroundColor: '#8B5CF6',
    color: '#ffffff',
    fontSize: '0.8125rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
};
