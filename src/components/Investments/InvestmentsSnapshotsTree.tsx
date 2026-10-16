import React, { useState, useMemo } from 'react';
import { InvestmentPeriodicSnapshot, InvestmentSnapshotItem } from '../../lib/types';
import { formatDate, normalizeToISODate, healSnapshotDate } from '../../lib/i18n';
import {
  Folder,
  FolderOpen,
  Calendar,
  Layers,
  Clock,
  ChevronDown,
  ChevronUp,
  Download,
  Trash2,
  Plus,
  Sparkles,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  FileSpreadsheet,
  Globe,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface InvestmentsSnapshotsTreeProps {
  snapshots: InvestmentPeriodicSnapshot[];
  onOpenSnapshotModal: (type: 'year' | 'quarter' | 'month' | 'current', defaultDate?: string) => void;
  onExportSnapshotCSV: (snapshot: InvestmentPeriodicSnapshot) => void;
  onDeleteSnapshot: (id: string) => void;
  onQuickFetch?: (periodType: 'year_end' | 'quarter_end' | 'month_end', year: number, quarter?: number, month?: number) => void;
  isHe: boolean;
}

const HEBREW_MONTH_NAMES = [
  '',
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

export const InvestmentsSnapshotsTree: React.FC<InvestmentsSnapshotsTreeProps> = ({
  snapshots,
  onOpenSnapshotModal,
  onExportSnapshotCSV,
  onDeleteSnapshot,
  onQuickFetch,
  isHe,
}) => {
  // Tree expansion states
  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({
    2026: true,
    2025: false,
  });

  const [expandedQuarters, setExpandedQuarters] = useState<Record<string, boolean>>({
    '2026-1': true,
    '2026-2': false,
    '2026-3': false,
    '2026-4': false,
    '2025-4': true,
  });

  const [expandedSnapshotItems, setExpandedSnapshotItems] = useState<Record<string, boolean>>({});

  // Toggle year
  const toggleYear = (year: number) => {
    setExpandedYears((prev) => ({
      ...prev,
      [year]: !prev[year],
    }));
  };

  // Toggle quarter (key: `${year}-${quarter}`)
  const toggleQuarter = (qKey: string) => {
    setExpandedQuarters((prev) => ({
      ...prev,
      [qKey]: !prev[qKey],
    }));
  };

  // Toggle snapshot items table
  const toggleSnapshotItems = (snapId: string) => {
    setExpandedSnapshotItems((prev) => ({
      ...prev,
      [snapId]: !prev[snapId],
    }));
  };

  // Expand All / Collapse All
  const handleExpandAll = () => {
    const years: Record<number, boolean> = {};
    const quarters: Record<string, boolean> = {};
    treeData.forEach((y) => {
      years[y.year] = true;
      y.quarters.forEach((q) => {
        quarters[`${y.year}-${q.quarter}`] = true;
      });
    });
    setExpandedYears(years);
    setExpandedQuarters(quarters);
  };

  const handleCollapseAll = () => {
    setExpandedYears({});
    setExpandedQuarters({});
    setExpandedSnapshotItems({});
  };

  // Group snapshots into Year -> Quarter -> Months
  const treeData = useMemo(() => {
    const yearMap = new Map<
      number,
      {
        year: number;
        quarters: Map<
          number,
          {
            quarter: number;
            months: Map<number, InvestmentPeriodicSnapshot[]>;
            quarterSnapshot?: InvestmentPeriodicSnapshot;
          }
        >;
        yearSnapshot?: InvestmentPeriodicSnapshot;
        allSnapshots: InvestmentPeriodicSnapshot[];
      }
    >();

    // Process all snapshots
    snapshots.forEach((snap) => {
      const isoDate = healSnapshotDate(snap);
      const parts = isoDate.split('-');
      const y = parseInt(parts[0], 10) || new Date().getFullYear();
      const m = parseInt(parts[1], 10) || 1;
      const q = Math.ceil(m / 3);

      if (!yearMap.has(y)) {
        yearMap.set(y, {
          year: y,
          quarters: new Map(),
          allSnapshots: [],
        });
      }

      const yEntry = yearMap.get(y)!;
      yEntry.allSnapshots.push(snap);

      if (snap.period_type === 'year' || snap.period_label.includes('שנה') || m === 12) {
        if (!yEntry.yearSnapshot || isoDate >= normalizeToISODate(yEntry.yearSnapshot.date)) {
          yEntry.yearSnapshot = snap;
        }
      }

      if (!yEntry.quarters.has(q)) {
        yEntry.quarters.set(q, {
          quarter: q,
          months: new Map(),
        });
      }

      const qEntry = yEntry.quarters.get(q)!;
      if (snap.period_type === 'quarter' || snap.period_label.includes('רבעון')) {
        if (!qEntry.quarterSnapshot || isoDate >= normalizeToISODate(qEntry.quarterSnapshot.date)) {
          qEntry.quarterSnapshot = snap;
        }
      }

      if (!qEntry.months.has(m)) {
        qEntry.months.set(m, []);
      }
      qEntry.months.get(m)!.push(snap);
    });

    // Ensure current year (e.g. 2026) is always present even if empty
    const currentYear = new Date().getFullYear();
    if (!yearMap.has(currentYear)) {
      yearMap.set(currentYear, {
        year: currentYear,
        quarters: new Map(),
        allSnapshots: [],
      });
    }

    // Sort years descending
    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => b - a);

    return sortedYears.map((year) => {
      const yData = yearMap.get(year)!;

      // 4 Quarters: Q4, Q3, Q2, Q1 descending
      const sortedQuarters = [4, 3, 2, 1].map((q) => {
        const qData = yData.quarters.get(q);
        const quarterMonths =
          q === 1 ? [3, 2, 1] : q === 2 ? [6, 5, 4] : q === 3 ? [9, 8, 7] : [12, 11, 10];

        const monthNodes = quarterMonths.map((m) => {
          const snaps = qData?.months.get(m) || [];
          return {
            month: m,
            monthNameHe: HEBREW_MONTH_NAMES[m],
            snapshots: snaps,
            hasData: snaps.length > 0,
          };
        });

        // Last month of quarter: March (3) for Q1, June (6) for Q2, September (9) for Q3, December (12) for Q4
        const lastMonthOfQ = q * 3;
        const lastMonthNode = monthNodes.find((mn) => mn.month === lastMonthOfQ);
        const lastMonthSnap = lastMonthNode && lastMonthNode.snapshots.length > 0
          ? lastMonthNode.snapshots[0]
          : undefined;

        // Effective Quarter Snapshot: either explicit quarterSnapshot or the snapshot from the last month of the quarter
        const effectiveQuarterSnap = qData?.quarterSnapshot || lastMonthSnap;
        const isFromLastMonth = !qData?.quarterSnapshot && Boolean(lastMonthSnap);

        const hasQuarterData = Boolean(
          qData && (effectiveQuarterSnap || monthNodes.some((mn) => mn.hasData))
        );

        return {
          quarter: q,
          quarterLabelHe: `רבעון Q${q} (${HEBREW_MONTH_NAMES[(q - 1) * 3 + 1]} - ${HEBREW_MONTH_NAMES[q * 3]})`,
          quarterSnapshot: effectiveQuarterSnap,
          isFromLastMonth,
          lastMonthNameHe: HEBREW_MONTH_NAMES[lastMonthOfQ],
          months: monthNodes,
          hasData: hasQuarterData,
        };
      });

      // Effective Year Snapshot: explicit year snapshot OR snapshot from end of December (month 12)
      const q4Data = yData.quarters.get(4);
      const decSnaps = q4Data?.months.get(12);
      const decSnap = decSnaps && decSnaps.length > 0 ? decSnaps[0] : undefined;

      const effectiveYearSnap = yData.yearSnapshot || decSnap;
      const isYearFromDec = !yData.yearSnapshot && Boolean(decSnap);

      // Latest snapshot for year (prioritizing effectiveYearSnap, otherwise latest available)
      const sortedSnaps = [...yData.allSnapshots].sort((a, b) =>
        normalizeToISODate(b.date).localeCompare(normalizeToISODate(a.date))
      );
      const latestSnap = effectiveYearSnap || sortedSnaps[0];

      return {
        year,
        yearLabel: `שנת ${year}`,
        yearSnapshot: effectiveYearSnap,
        isYearFromDec,
        latestSnapshot: latestSnap,
        quarters: sortedQuarters,
        allSnapshots: yData.allSnapshots,
        totalSnapshotsCount: yData.allSnapshots.length,
      };
    });
  }, [snapshots]);

  return (
    <div style={treeStyles.container} className="animate-fade-in">
      {/* Top Header Card */}
      <div style={treeStyles.headerCard}>
        <div style={treeStyles.headerLeft}>
          <div style={treeStyles.iconBadge}>
            <Clock size={20} color="#2563EB" />
          </div>
          <div>
            <h3 style={treeStyles.title}>
              {isHe
                ? 'עץ צילומי מצב וסגירות תקופתיות (שנה ⟵ רבעונים ⟵ חודשים)'
                : 'Periodic Snapshots Hierarchy (Year ⟶ Quarters ⟶ Months)'}
            </h3>
            <p style={treeStyles.subtitle}>
              {isHe
                ? 'מבנה היררכי מסודר לניהול ביצועי התיק. לחץ על שנה או רבעון לפתיחת הפירוט, צפה ברווח הנקודתי והורד דוחות Excel.'
                : 'Collapsible tree structure for annual, quarterly, and monthly portfolio milestones.'}
            </p>
          </div>
        </div>

        <div style={treeStyles.headerActions}>
          <button style={treeStyles.expandAllBtn} onClick={handleExpandAll} title={isHe ? 'פתח את כל העץ' : 'Expand All'}>
            <Maximize2 size={13} />
            <span>{isHe ? 'פתח הכל' : 'Expand All'}</span>
          </button>
          <button style={treeStyles.expandAllBtn} onClick={handleCollapseAll} title={isHe ? 'סגור את כל העץ' : 'Collapse All'}>
            <Minimize2 size={13} />
            <span>{isHe ? 'סגור הכל' : 'Collapse All'}</span>
          </button>
          <button
            style={treeStyles.quickSnapshotBtn}
            onClick={() => onOpenSnapshotModal('current')}
          >
            <Plus size={14} />
            <span>{isHe ? '+ סגירה חדשה' : '+ New Milestone'}</span>
          </button>
        </div>
      </div>

      {/* Tree Hierarchy Root */}
      <div style={treeStyles.treeWrapper}>
        {snapshots.length === 0 ? (
          <div style={treeStyles.emptyTreeCard}>
            <div style={treeStyles.emptyTreeIcon}>
              <Clock size={36} color="#94A3B8" />
            </div>
            <h4 style={treeStyles.emptyTreeTitle}>
              {isHe ? 'אין עדיין סגירות תקופה שמורות' : 'No Periodic Milestones Yet'}
            </h4>
            <p style={treeStyles.emptyTreeText}>
              {isHe
                ? 'באפשרותך לבצע סגירת תקופה (חודש / רבעון / שנה) כדי לעקוב אחר ביצועי התיק לאורך זמן, או לפנות לסעיף משיכת שערי סגירה תקופתיים.'
                : 'Create periodic milestones to monitor your portfolio growth over time.'}
            </p>
            <button
              style={treeStyles.createFirstSnapshotBtn}
              onClick={() => onOpenSnapshotModal('current')}
            >
              <Plus size={15} />
              <span>{isHe ? '+ צור סגירת תקופה ראשונה' : '+ Create First Milestone'}</span>
            </button>
          </div>
        ) : (
          treeData.map((yNode) => {
            const isYearOpen = Boolean(expandedYears[yNode.year]);
          const latest = yNode.latestSnapshot;
          const isYearProfit = latest ? latest.total_profit >= 0 : true;

          return (
            <div key={yNode.year} style={treeStyles.yearBlock}>
              {/* LEVEL 1: YEAR ROW (דרג 1 - שנה) */}
              <div
                style={{
                  ...treeStyles.yearRow,
                  backgroundColor: isYearOpen ? '#F8FAFC' : '#FFFFFF',
                  borderColor: isYearOpen ? '#BFDBFE' : '#E2E8F0',
                }}
              >
                <div style={treeStyles.rowMainInfo} onClick={() => toggleYear(yNode.year)}>
                  <button style={treeStyles.chevronBtn} type="button">
                    {isYearOpen ? <ChevronUp size={18} color="#2563EB" /> : <ChevronDown size={18} color="#64748B" />}
                  </button>

                  <div style={treeStyles.nodeIconWrap}>
                    {isYearOpen ? <FolderOpen size={20} color="#2563EB" /> : <Folder size={20} color="#3B82F6" />}
                  </div>

                  <div style={treeStyles.nodeTitleGroup}>
                    <span style={treeStyles.yearTitleText}>{yNode.yearLabel}</span>
                    <span style={treeStyles.countBadge}>
                      {yNode.totalSnapshotsCount} {isHe ? 'סגירות רשומות' : 'Milestones'}
                    </span>
                    {yNode.yearSnapshot && (
                      <span style={treeStyles.yearEndBadge}>
                        <CheckCircle2 size={11} color="#16A34A" />
                        <span>
                          {yNode.isYearFromDec
                            ? (isHe ? 'סגירה שנתית (לפי דצמבר)' : 'Annual Closure (Dec)')
                            : (isHe ? 'סגירה שנתית קיימת' : 'Year-End Closed')}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Year Metrics & Actions */}
                <div style={treeStyles.rowMetricsAndActions}>
                  {latest ? (
                    <div style={treeStyles.metricsGroup}>
                      <div style={treeStyles.metricBox}>
                        <span style={treeStyles.metricLabel}>
                          {yNode.yearSnapshot
                            ? (isHe ? 'שווי תיק (סוף שנה):' : 'Year-End Valuation:')
                            : (isHe ? 'שווי תיק (עדכני):' : 'Valuation:')}
                        </span>
                        <strong style={treeStyles.metricValBold}>
                          ₪{latest.total_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </strong>
                      </div>

                      <div style={treeStyles.metricBox}>
                        <span style={treeStyles.metricLabel}>{isHe ? 'עלות הקרן:' : 'Cost Basis:'}</span>
                        <span style={treeStyles.metricCostVal}>
                          ₪{latest.total_invested.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </span>
                      </div>

                      <div style={treeStyles.metricBox}>
                        <span style={treeStyles.metricLabel}>{isHe ? 'רווח/הפסד:' : 'P&L:'}</span>
                        <strong
                          dir="ltr"
                          style={{
                            color: isYearProfit ? '#059669' : '#DC2626',
                            direction: 'ltr',
                            display: 'inline-block',
                          }}
                        >
                          {isYearProfit ? '+' : '-'}₪{Math.abs(latest.total_profit).toLocaleString('en-US', { maximumFractionDigits: 0 })}{' '}
                          ({latest.total_return_pct >= 0 ? '+' : '-'}{Math.abs(latest.total_return_pct).toFixed(2)}%)
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <span style={treeStyles.noDataSubText}>
                      {isHe ? 'אין צילומי מצב שמורים לשנה זו' : 'No snapshots for this year'}
                    </span>
                  )}

                  <div style={treeStyles.actionButtonsRow}>
                    {yNode.yearSnapshot ? (
                      <button
                        style={treeStyles.exportMiniBtn}
                        onClick={() => onExportSnapshotCSV(yNode.yearSnapshot!)}
                        title={isHe ? 'הורד דוח שנתי (Excel)' : 'Download Annual Report'}
                      >
                        <Download size={13} color="#2563EB" />
                        <span>{isHe ? 'דוח שנתי' : 'Annual Excel'}</span>
                      </button>
                    ) : (
                      onQuickFetch && (
                        <button
                          style={treeStyles.quickFetchBtn}
                          onClick={() => onQuickFetch('year_end', yNode.year, 4, 12)}
                          title={isHe ? 'משוך שערים מסוף דצמבר וסגור שנה' : 'Fetch Dec 31 closing quotes'}
                        >
                          <Sparkles size={13} color="#2563EB" />
                          <span>{isHe ? '+ סגירת שנת ' + yNode.year : '+ Close Year'}</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* LEVEL 2: QUARTERS IN THIS YEAR (דרג 2 - רבעונים) */}
              {isYearOpen && (
                <div style={treeStyles.quartersContainer}>
                  {yNode.quarters.map((qNode) => {
                    const qKey = `${yNode.year}-${qNode.quarter}`;
                    const isQuarterOpen = Boolean(expandedQuarters[qKey]);
                    const qSnap = qNode.quarterSnapshot;
                    const isQProfit = qSnap ? qSnap.total_profit >= 0 : true;

                    return (
                      <div key={qKey} style={treeStyles.quarterBlock}>
                        {/* Quarter Row Header */}
                        <div
                          style={{
                            ...treeStyles.quarterRow,
                            backgroundColor: isQuarterOpen ? '#F1F5F9' : '#FFFFFF',
                            borderColor: isQuarterOpen ? '#CBD5E1' : '#E2E8F0',
                          }}
                        >
                          <div style={treeStyles.rowMainInfo} onClick={() => toggleQuarter(qKey)}>
                            <button style={treeStyles.chevronSmallBtn} type="button">
                              {isQuarterOpen ? (
                                <ChevronUp size={16} color="#3B82F6" />
                              ) : (
                                <ChevronDown size={16} color="#94A3B8" />
                              )}
                            </button>

                            <div style={treeStyles.treeBranchConnector}>├──</div>

                            <div style={treeStyles.quarterIconWrap}>
                              <Layers size={16} color="#3B82F6" />
                            </div>

                            <div style={treeStyles.nodeTitleGroup}>
                              <span style={treeStyles.quarterTitleText}>{qNode.quarterLabelHe}</span>
                              {qSnap && (
                                <span style={treeStyles.quarterSnapBadge}>
                                  <CheckCircle2 size={11} color="#2563EB" style={{ marginLeft: 3 }} />
                                  <span>
                                    {qNode.isFromLastMonth
                                      ? (isHe ? `סגירת רבעון (לפי ${qNode.lastMonthNameHe})` : `Quarter End (${qNode.lastMonthNameHe})`)
                                      : (isHe ? 'סגירת רבעון שמורה' : 'Quarter Snapshot')}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quarter Metrics & Actions */}
                          <div style={treeStyles.rowMetricsAndActions}>
                            {qSnap ? (
                              <div style={treeStyles.metricsGroup}>
                                <div style={treeStyles.metricBox}>
                                  <span style={treeStyles.metricLabel}>{isHe ? 'שווי בסוף רבעון:' : 'Valuation:'}</span>
                                  <strong>₪{qSnap.total_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>
                                </div>
                                <div style={treeStyles.metricBox}>
                                  <span style={treeStyles.metricLabel}>{isHe ? 'עלות הקרן:' : 'Cost Basis:'}</span>
                                  <span style={treeStyles.metricCostVal}>
                                    ₪{qSnap.total_invested.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                                <div style={treeStyles.metricBox}>
                                  <span style={treeStyles.metricLabel}>{isHe ? 'רווח/הפסד:' : 'P&L:'}</span>
                                  <strong
                                    dir="ltr"
                                    style={{
                                      color: isQProfit ? '#059669' : '#DC2626',
                                      direction: 'ltr',
                                      display: 'inline-block',
                                    }}
                                  >
                                    {isQProfit ? '+' : '-'}₪{Math.abs(qSnap.total_profit).toLocaleString('en-US', { maximumFractionDigits: 0 })}{' '}
                                    ({qSnap.total_return_pct >= 0 ? '+' : '-'}{Math.abs(qSnap.total_return_pct).toFixed(2)}%)
                                  </strong>
                                </div>
                              </div>
                            ) : (
                              <span style={treeStyles.noDataSubText}>
                                {isHe ? 'אין סגירת רבעון רשמית עדיין' : 'No quarter-end closure'}
                              </span>
                            )}

                            <div style={treeStyles.actionButtonsRow}>
                              {qSnap ? (
                                <button
                                  style={treeStyles.exportMiniBtn}
                                  onClick={() => onExportSnapshotCSV(qSnap)}
                                  title={isHe ? 'הורד דוח רבעוני (Excel)' : 'Download Quarter Report'}
                                >
                                  <Download size={13} color="#2563EB" />
                                  <span>{isHe ? 'דוח רבעון' : 'Quarter Excel'}</span>
                                </button>
                              ) : (
                                onQuickFetch && (
                                  <button
                                    style={treeStyles.quickFetchBtn}
                                    onClick={() =>
                                      onQuickFetch('quarter_end', yNode.year, qNode.quarter, qNode.quarter * 3)
                                    }
                                    title={isHe ? 'משוך שערים לסוף רבעון' : 'Fetch quarter closing quotes'}
                                  >
                                    <Sparkles size={12} color="#2563EB" />
                                    <span>{isHe ? `+ סגירת Q${qNode.quarter}` : `+ Close Q${qNode.quarter}`}</span>
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        </div>

                        {/* LEVEL 3: MONTHS IN THIS QUARTER (דרג 3 - חודשים) */}
                        {isQuarterOpen && (
                          <div style={treeStyles.monthsContainer}>
                            {qNode.months.map((mNode) => {
                              return (
                                <div key={mNode.month} style={treeStyles.monthWrapper}>
                                  {mNode.snapshots.length > 0 ? (
                                    mNode.snapshots.map((snap) => {
                                      const isSnapProfit = snap.total_profit >= 0;
                                      const isItemsOpen = Boolean(expandedSnapshotItems[snap.id]);

                                      return (
                                        <div key={snap.id} style={treeStyles.monthCard}>
                                          <div style={treeStyles.monthRow}>
                                            <div style={treeStyles.rowMainInfo}>
                                              <div style={treeStyles.treeBranchConnectorSub}>│ └──</div>
                                              <div style={treeStyles.monthIconWrap}>
                                                <Calendar size={15} color="#059669" />
                                              </div>
                                              <div>
                                                <div style={treeStyles.monthLabelTitle}>
                                                  <strong>{snap.period_label}</strong>
                                                  <span style={treeStyles.monthDateText}>({formatDate(snap.date)})</span>
                                                </div>
                                                {snap.notes && (
                                                  <div style={treeStyles.snapshotNote}>{snap.notes}</div>
                                                )}
                                              </div>
                                            </div>

                                            {/* Month Snapshot Metrics */}
                                            <div style={treeStyles.rowMetricsAndActions}>
                                              <div style={treeStyles.metricsGroup}>
                                                <div style={treeStyles.metricBox}>
                                                  <span style={treeStyles.metricLabel}>
                                                    {isHe ? 'שווי במועד זה:' : 'Valuation:'}
                                                  </span>
                                                  <strong>
                                                    ₪{snap.total_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                                  </strong>
                                                </div>
                                                <div style={treeStyles.metricBox}>
                                                  <span style={treeStyles.metricLabel}>
                                                    {isHe ? 'עלות הקרן:' : 'Cost:'}
                                                  </span>
                                                  <span>
                                                    ₪{snap.total_invested.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                                  </span>
                                                </div>
                                                <div style={treeStyles.metricBox}>
                                                  <span style={treeStyles.metricLabel}>
                                                    {isHe ? 'רווח/הפסד:' : 'P&L:'}
                                                  </span>
                                                  <strong
                                                    dir="ltr"
                                                    style={{
                                                      color: isSnapProfit ? '#059669' : '#DC2626',
                                                      direction: 'ltr',
                                                      display: 'inline-block',
                                                    }}
                                                  >
                                                    {isSnapProfit ? '+' : '-'}₪{Math.abs(snap.total_profit).toLocaleString('en-US', { maximumFractionDigits: 0 })}{' '}
                                                    ({snap.total_return_pct >= 0 ? '+' : '-'}{Math.abs(snap.total_return_pct).toFixed(2)}%)
                                                  </strong>
                                                </div>
                                                <div style={treeStyles.metricBox}>
                                                  <span style={treeStyles.metricLabel}>
                                                    {isHe ? 'ניירות פעילים:' : 'Assets:'}
                                                  </span>
                                                  <span>{snap.assets_count}</span>
                                                </div>
                                              </div>

                                              {/* Actions for this Month Snapshot */}
                                              <div style={treeStyles.actionButtonsRow}>
                                                {snap.items && snap.items.length > 0 && (
                                                  <button
                                                    style={{
                                                      ...treeStyles.toggleItemsBtn,
                                                      backgroundColor: isItemsOpen ? '#EFF6FF' : '#F8FAFC',
                                                      color: isItemsOpen ? '#2563EB' : '#475569',
                                                    }}
                                                    onClick={() => toggleSnapshotItems(snap.id)}
                                                    title={isHe ? 'הצג/הסתר פירוט ניירות שערכו בסגירה זו' : 'Toggle holdings breakdown'}
                                                  >
                                                    {isItemsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                    <span>{isHe ? `פירוט ניירות (${snap.items.length})` : 'Holdings'}</span>
                                                  </button>
                                                )}

                                                <button
                                                  style={treeStyles.exportMiniBtn}
                                                  onClick={() => onExportSnapshotCSV(snap)}
                                                  title={isHe ? 'הורד דוח סגירה זו ל-Excel' : 'Download Excel'}
                                                >
                                                  <Download size={13} color="#2563EB" />
                                                  <span>{isHe ? 'דוח Excel' : 'Excel'}</span>
                                                </button>

                                                <button
                                                  style={treeStyles.deleteMiniBtn}
                                                  onClick={() => onDeleteSnapshot(snap.id)}
                                                  title={isHe ? 'מחק צילום מצב זה' : 'Delete'}
                                                >
                                                  <Trash2 size={13} color="#EF4444" />
                                                </button>
                                              </div>
                                            </div>
                                          </div>

                                          {/* LEVEL 4: HOLDINGS BREAKDOWN TABLE (דרג 4 - פירוט ניירות) */}
                                          {isItemsOpen && snap.items && snap.items.length > 0 && (
                                            <div style={treeStyles.itemsTableWrap} className="animate-fade-in">
                                              <div style={treeStyles.itemsHeader}>
                                                <Sparkles size={14} color="#2563EB" />
                                                <span>
                                                  {isHe
                                                    ? `פירוט ניירות שערכו בצילום מצב: ${snap.period_label}`
                                                    : `Holdings breakdown at: ${snap.period_label}`}
                                                </span>
                                              </div>
                                              <table style={treeStyles.subTable}>
                                                <thead>
                                                  <tr style={treeStyles.subThRow}>
                                                    <th style={treeStyles.subTh}>{isHe ? 'סימול / מספר' : 'Symbol'}</th>
                                                    <th style={treeStyles.subTh}>{isHe ? 'שם נייר' : 'Name'}</th>
                                                    <th style={treeStyles.subTh}>{isHe ? 'מקור' : 'Source'}</th>
                                                    <th style={treeStyles.subTh}>{isHe ? 'שער סגירה' : 'Price'}</th>
                                                    <th style={treeStyles.subTh}>{isHe ? 'כמות' : 'Shares'}</th>
                                                    <th style={treeStyles.subTh}>{isHe ? 'עלות רכישה' : 'Cost'}</th>
                                                    <th style={treeStyles.subTh}>{isHe ? 'שווי במועד זה' : 'Valuation'}</th>
                                                    <th style={treeStyles.subTh}>{isHe ? 'רווח/הפסד' : 'P&L'}</th>
                                                    <th style={treeStyles.subTh}>{isHe ? 'תשואה' : 'Yield'}</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {snap.items.map((it) => {
                                                    const itProf = it.profit >= 0;
                                                    return (
                                                      <tr key={it.asset_id} style={treeStyles.subTr}>
                                                        <td style={treeStyles.subTd}>
                                                          <span style={treeStyles.tickerBadge}>{it.ticker}</span>
                                                          {(it.security_number || (/^\d+$/.test(it.ticker) ? it.ticker : null)) && (
                                                            <span style={treeStyles.secNumSub}>#{it.security_number || it.ticker}</span>
                                                          )}
                                                        </td>
                                                        <td style={treeStyles.subTd}>
                                                          <strong>{it.name}</strong>
                                                        </td>
                                                        <td style={treeStyles.subTd}>
                                                          <span style={treeStyles.sourcePill}>
                                                            {it.quote_source || '—'}
                                                          </span>
                                                        </td>
                                                        <td style={treeStyles.subTd}>
                                                          <strong style={{ color: '#2563EB' }}>
                                                            {it.currency === 'USD' ? '$' : '₪'}
                                                            {it.market_price.toFixed(2)}
                                                          </strong>
                                                        </td>
                                                        <td style={treeStyles.subTd}>{it.shares}</td>
                                                        <td style={treeStyles.subTd}>
                                                          {it.currency === 'USD' ? '$' : '₪'}
                                                          {it.total_cost.toLocaleString('en-US', {
                                                            minimumFractionDigits: 2,
                                                          })}
                                                        </td>
                                                        <td style={treeStyles.subTd}>
                                                          <strong>
                                                            {it.currency === 'USD' ? '$' : '₪'}
                                                            {it.market_value.toLocaleString('en-US', {
                                                              minimumFractionDigits: 2,
                                                            })}
                                                          </strong>
                                                        </td>
                                                        <td style={treeStyles.subTd}>
                                                          <span
                                                            dir="ltr"
                                                            style={{
                                                              color: itProf ? '#059669' : '#DC2626',
                                                              fontWeight: '700',
                                                              direction: 'ltr',
                                                              display: 'inline-block',
                                                            }}
                                                          >
                                                            {itProf ? '+' : '-'}{it.currency === 'USD' ? '$' : '₪'}
                                                            {Math.abs(it.profit).toLocaleString('en-US', {
                                                              minimumFractionDigits: 2,
                                                              maximumFractionDigits: 2,
                                                            })}
                                                          </span>
                                                        </td>
                                                        <td style={treeStyles.subTd}>
                                                          <span
                                                            dir="ltr"
                                                            style={{
                                                              ...treeStyles.yieldBadge,
                                                              backgroundColor: itProf ? '#DCFCE7' : '#FEE2E2',
                                                              color: itProf ? '#15803D' : '#B91C1C',
                                                              direction: 'ltr',
                                                              display: 'inline-block',
                                                            }}
                                                          >
                                                            {itProf ? '+' : '-'}
                                                            {Math.abs(it.return_pct).toFixed(2)}%
                                                          </span>
                                                        </td>
                                                      </tr>
                                                    );
                                                  })}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                  ) : (
                                    /* Month has no snapshot yet */
                                    <div style={treeStyles.emptyMonthRow}>
                                      <div style={treeStyles.rowMainInfo}>
                                        <div style={treeStyles.treeBranchConnectorSub}>│ └──</div>
                                        <div style={treeStyles.emptyMonthIconWrap}>
                                          <Calendar size={13} color="#94A3B8" />
                                        </div>
                                        <span style={treeStyles.emptyMonthName}>
                                          {mNode.monthNameHe} {yNode.year}
                                        </span>
                                        <span style={treeStyles.emptyMonthHint}>
                                          ({isHe ? 'טרם נשמר צילום מצב' : 'No milestone saved'})
                                        </span>
                                      </div>

                                      {onQuickFetch && (
                                        <button
                                          style={treeStyles.fetchMonthBtn}
                                          onClick={() =>
                                            onQuickFetch('month_end', yNode.year, qNode.quarter, mNode.month)
                                          }
                                          title={isHe ? 'משוך שערים לסוף חודש זה' : 'Fetch quotes for this month'}
                                        >
                                          <Sparkles size={11} color="#2563EB" />
                                          <span>{isHe ? `+ סגירת חודש ${mNode.monthNameHe}` : '+ Close Month'}</span>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }))}
      </div>
    </div>
  );
};

const treeStyles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E2E8F0',
    padding: '18px 22px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '14px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  iconBadge: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    backgroundColor: '#EFF6FF',
    border: '1px solid #BFDBFE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: '800',
    color: '#0F172A',
    margin: '0 0 4px',
  },
  subtitle: {
    fontSize: '0.8125rem',
    color: '#64748B',
    margin: 0,
    maxWidth: '650px',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  expandAllBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    backgroundColor: '#F1F5F9',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#334155',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  quickSnapshotBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    borderRadius: '8px',
    border: 'none',
    fontSize: '0.8125rem',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
  },
  treeWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  yearBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  yearRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 18px',
    borderRadius: '14px',
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    flexWrap: 'wrap',
    gap: '12px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
  },
  rowMainInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
    minWidth: '240px',
  },
  chevronBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: '2px',
  },
  chevronSmallBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: '2px',
  },
  nodeIconWrap: {
    display: 'flex',
    alignItems: 'center',
  },
  nodeTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  yearTitleText: {
    fontSize: '1.0625rem',
    fontWeight: '800',
    color: '#0F172A',
  },
  countBadge: {
    padding: '2px 8px',
    backgroundColor: '#EFF6FF',
    borderRadius: '12px',
    fontSize: '0.6875rem',
    fontWeight: '700',
    color: '#2563EB',
    border: '1px solid #BFDBFE',
  },
  yearEndBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    backgroundColor: '#DCFCE7',
    borderRadius: '12px',
    fontSize: '0.6875rem',
    fontWeight: '700',
    color: '#15803D',
  },
  rowMetricsAndActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  metricsGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    fontSize: '0.8125rem',
    flexWrap: 'wrap',
  },
  metricBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  metricLabel: {
    color: '#64748B',
    fontSize: '0.75rem',
  },
  metricValBold: {
    color: '#0F172A',
    fontWeight: '800',
  },
  metricCostVal: {
    color: '#475569',
    fontWeight: '600',
  },
  noDataSubText: {
    fontSize: '0.75rem',
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  actionButtonsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  exportMiniBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 9px',
    backgroundColor: '#EFF6FF',
    border: '1px solid #BFDBFE',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#2563EB',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  quickFetchBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 10px',
    backgroundColor: '#F0FDF4',
    border: '1px solid #BBF7D0',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#16A34A',
    cursor: 'pointer',
  },
  quartersContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    paddingLeft: '18px',
    paddingRight: '18px',
  },
  quarterBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  quarterRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    flexWrap: 'wrap',
    gap: '10px',
  },
  treeBranchConnector: {
    color: '#94A3B8',
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  treeBranchConnectorSub: {
    color: '#CBD5E1',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    marginLeft: '6px',
    marginRight: '6px',
  },
  quarterIconWrap: {
    display: 'flex',
    alignItems: 'center',
  },
  quarterTitleText: {
    fontSize: '0.9375rem',
    fontWeight: '700',
    color: '#1E293B',
  },
  quarterSnapBadge: {
    padding: '2px 6px',
    backgroundColor: '#EFF6FF',
    borderRadius: '6px',
    fontSize: '0.6875rem',
    fontWeight: '700',
    color: '#2563EB',
  },
  monthsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    paddingLeft: '24px',
    paddingRight: '24px',
    marginTop: '4px',
  },
  monthWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  monthCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '10px',
    border: '1px solid #E2E8F0',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
  },
  monthRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  monthIconWrap: {
    display: 'flex',
    alignItems: 'center',
  },
  monthLabelTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.875rem',
    color: '#0F172A',
  },
  monthDateText: {
    fontSize: '0.75rem',
    color: '#64748B',
    fontWeight: 'normal',
  },
  snapshotNote: {
    fontSize: '0.6875rem',
    color: '#64748B',
    marginTop: '2px',
  },
  toggleItemsBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid #CBD5E1',
    fontSize: '0.6875rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
  deleteMiniBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5px',
    backgroundColor: '#FEE2E2',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  emptyMonthRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 14px',
    backgroundColor: '#FAFAFA',
    borderRadius: '8px',
    border: '1px dashed #E2E8F0',
  },
  emptyMonthIconWrap: {
    display: 'flex',
    alignItems: 'center',
  },
  emptyMonthName: {
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: '#64748B',
  },
  emptyMonthHint: {
    fontSize: '0.6875rem',
    color: '#94A3B8',
  },
  fetchMonthBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: '#EFF6FF',
    border: '1px solid #BFDBFE',
    borderRadius: '6px',
    fontSize: '0.6875rem',
    fontWeight: '700',
    color: '#2563EB',
    cursor: 'pointer',
  },
  itemsTableWrap: {
    backgroundColor: '#F8FAFC',
    borderTop: '1px solid #E2E8F0',
    padding: '12px',
    overflowX: 'auto',
  },
  itemsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: '8px',
  },
  subTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.75rem',
    backgroundColor: '#FFFFFF',
    borderRadius: '6px',
    overflow: 'hidden',
    border: '1px solid #E2E8F0',
  },
  subThRow: {
    backgroundColor: '#F1F5F9',
    borderBottom: '1px solid #CBD5E1',
  },
  subTh: {
    padding: '8px 10px',
    textAlign: 'inherit',
    fontWeight: '700',
    color: '#475569',
    whiteSpace: 'nowrap',
  },
  subTr: {
    borderBottom: '1px solid #F1F5F9',
  },
  subTd: {
    padding: '8px 10px',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  },
  tickerBadge: {
    padding: '2px 5px',
    backgroundColor: '#F1F5F9',
    borderRadius: '4px',
    fontWeight: '800',
    fontSize: '0.75rem',
    color: '#0F172A',
    border: '1px solid #CBD5E1',
    marginRight: '4px',
    marginLeft: '4px',
  },
  secNumSub: {
    fontSize: '0.6875rem',
    color: '#64748B',
  },
  sourcePill: {
    padding: '1px 5px',
    backgroundColor: '#F8FAFC',
    borderRadius: '4px',
    border: '1px solid #E2E8F0',
    fontSize: '0.6875rem',
    color: '#475569',
  },
  yieldBadge: {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: '800',
    fontSize: '0.6875rem',
  },
  emptyTreeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E2E8F0',
    padding: '48px 24px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
  },
  emptyTreeIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#F1F5F9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  emptyTreeTitle: {
    fontSize: '1.125rem',
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: '8px',
  },
  emptyTreeText: {
    fontSize: '0.875rem',
    color: '#64748B',
    maxWidth: '480px',
    lineHeight: '1.5',
    marginBottom: '20px',
  },
  createFirstSnapshotBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 18px',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    borderRadius: '10px',
    border: 'none',
    fontWeight: '700',
    fontSize: '0.875rem',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
  },
};
