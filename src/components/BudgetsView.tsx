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
  X
} from 'lucide-react';
import { t, formatCategoryName } from '../lib/i18n';

const MONTH_NAMES_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

export const BudgetsView: React.FC = () => {
  const {
    budgets,
    categories,
    macroCategories,
    transactions,
    activeHousehold,
    language,
    saveYearlyBudgetPlan
  } = useAuth();

  const currency = activeHousehold?.currency === 'ILS' ? '₪' : activeHousehold?.currency || '$';

  // Navigation & Mode States
  const [viewMode, setViewMode] = useState<'planner' | 'tracking'>('planner');
  const [selectedYear, setSelectedYear] = useState<number>(2027);
  const [selectedMonth, setSelectedMonth] = useState<number>(1); // Default to January for 2027 planning
  const [matrixView, setMatrixView] = useState<boolean>(false);

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

  // Load existing budgets into local state when selectedYear or budgets change
  useEffect(() => {
    const yearBudgets = budgets.filter((b) => b.year === selectedYear);
    const newState: Record<string, Record<number, number>> = {};

    categories.forEach((cat) => {
      newState[cat.id] = {};
      for (let m = 1; m <= 12; m++) {
        newState[cat.id][m] = 0;
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
  }, [selectedYear, budgets, categories]);

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

  // Calculate Historical Monthly Averages per Category from real transactions
  const categoryStats = useMemo(() => {
    const stats: Record<string, { last6MonthsAvg: number; prevYearAvg: number; last3MonthsAvg: number }> = {};
    const now = new Date();

    categories.forEach((cat) => {
      const catTxs = transactions.filter((t) => !t.is_hidden && t.category_id === cat.id);

      // Last 6 months (May 2026 - Oct 2026)
      const last6MonthsTxs = catTxs.filter((t) => t.date >= '2026-04-01' && t.date <= '2026-09-30');
      const sum6 = last6MonthsTxs.reduce((acc, t) => acc + Number(t.amount), 0);
      const avg6 = Math.round(sum6 / 6);

      // Last 3 months (Jul 2026 - Sep 2026)
      const last3MonthsTxs = catTxs.filter((t) => t.date >= '2026-07-01' && t.date <= '2026-09-30');
      const sum3 = last3MonthsTxs.reduce((acc, t) => acc + Number(t.amount), 0);
      const avg3 = Math.round(sum3 / 3);

      // Previous Year (2026 data across active months)
      const year2026Txs = catTxs.filter((t) => t.date >= '2026-01-01' && t.date <= '2026-10-31');
      const sum2026 = year2026Txs.reduce((acc, t) => acc + Number(t.amount), 0);
      const avgPrev = Math.round(sum2026 / 10);

      stats[cat.id] = {
        last6MonthsAvg: avg6,
        last3MonthsAvg: avg3,
        prevYearAvg: avgPrev,
      };
    });

    return stats;
  }, [categories, transactions]);

  // Apply Smart Suggestions
  const handleApplySmartSuggestions = () => {
    const factor = 1 + smartAdjustment / 100;
    setPlanState((prev) => {
      const nextState: Record<string, Record<number, number>> = { ...prev };

      categories.forEach((cat) => {
        let suggestedAvg = 0;
        const st = categoryStats[cat.id];
        if (st) {
          if (smartSource === 'last_6_months') suggestedAvg = st.last6MonthsAvg;
          else if (smartSource === 'last_3_months') suggestedAvg = st.last3MonthsAvg;
          else suggestedAvg = st.prevYearAvg;
        }

        const calculatedVal = Math.round(suggestedAvg * factor);
        if (calculatedVal > 0) {
          nextState[cat.id] = nextState[cat.id] || {};
          for (let m = 1; m <= 12; m++) {
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

    sortedMacros.forEach((macro) => {
      const cats = categories.filter((c) => c.macro_category_id === macro.id);
      if (cats.length > 0) {
        groups.push({ macro, categories: cats });
      }
    });

    // Unassigned categories (if any)
    const unassigned = categories.filter(
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
          {groupedCategories.map(({ macro, categories: cats }) => {
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
              macroHistoricalAvg += categoryStats[cat.id]?.last6MonthsAvg || 0;
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
                        ממוצע ביצוע חודשי: {currency}{macroHistoricalAvg.toLocaleString()}
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
                    <table style={styles.categoriesTable}>
                      <thead>
                        <tr>
                          <th style={{ ...styles.thCell, textAlign: 'right', width: '30%' }}>קטגוריה</th>
                          <th style={{ ...styles.thCell, textAlign: 'center', width: '20%' }}>ממוצע הוצאה (אמת)</th>
                          {matrixView ? (
                            MONTH_NAMES_HE.map((m, idx) => (
                              <th key={idx} style={{ ...styles.thCell, textAlign: 'center' }}>
                                {m}
                              </th>
                            ))
                          ) : (
                            <>
                              <th style={{ ...styles.thCell, textAlign: 'center', width: '25%' }}>
                                תקציב מתוכנן ({MONTH_NAMES_HE[selectedMonth - 1]})
                              </th>
                              <th style={{ ...styles.thCell, textAlign: 'center', width: '25%' }}>פעולות מהירות</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {cats.map((cat) => {
                          const stats = categoryStats[cat.id] || { last6MonthsAvg: 0, prevYearAvg: 0, last3MonthsAvg: 0 };
                          const currentVal = planState[cat.id]?.[selectedMonth] || 0;

                          return (
                            <tr key={cat.id} style={styles.catRow}>
                              {/* Category Name */}
                              <td style={styles.tdCell}>
                                <div style={styles.categoryNameCol}>
                                  <div
                                    style={{
                                      ...styles.categoryDot,
                                      backgroundColor: cat.color || macro.color || 'var(--primary)',
                                    }}
                                  />
                                  <span style={styles.catNameText}>{cat.name}</span>
                                </div>
                              </td>

                              {/* Historical Average Badge */}
                              <td style={{ ...styles.tdCell, textAlign: 'center' }}>
                                <div style={styles.avgBadge}>
                                  <span>{currency} {stats.last6MonthsAvg.toLocaleString()}</span>
                                  <span style={styles.avgBadgeSub}>ממוצע חצי-שנתי</span>
                                </div>
                              </td>

                              {/* Matrix View (12 columns) vs Single Month View */}
                              {matrixView ? (
                                Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                                  const mVal = planState[cat.id]?.[m] || 0;
                                  return (
                                    <td key={m} style={{ ...styles.tdCell, padding: '4px' }}>
                                      <input
                                        type="number"
                                        min="0"
                                        step="50"
                                        value={mVal === 0 ? '' : mVal}
                                        onChange={(e) => handleAmountChange(cat.id, m, e.target.value)}
                                        placeholder="0"
                                        style={styles.matrixInput}
                                      />
                                    </td>
                                  );
                                })
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
                                        placeholder="0"
                                        style={styles.amountInput}
                                      />
                                    </div>
                                  </td>

                                  {/* Quick Actions: Copy to all months */}
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
                                      {stats.last6MonthsAvg > 0 && (
                                        <button
                                          onClick={() =>
                                            handleAmountChange(cat.id, selectedMonth, String(stats.last6MonthsAvg))
                                          }
                                          style={styles.quickActionSubBtn}
                                          title="קבע לפי הממוצע בפועל"
                                        >
                                          <span>לפי ממוצע</span>
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
                    </table>
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
            {groupedCategories.map(({ macro, categories: cats }) => (
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
    overflowX: 'auto',
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
    fontWeight: '700',
    color: 'var(--text-primary)',
    fontSize: '0.8125rem',
  },
  avgBadgeSub: {
    fontSize: '0.625rem',
    fontWeight: '500',
    color: 'var(--text-muted)',
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
    padding: '4px 2px',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    textAlign: 'center',
    width: '100%',
    minWidth: '55px',
    outline: 'none',
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
