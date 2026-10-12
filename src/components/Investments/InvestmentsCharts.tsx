import React, { useState, useMemo } from 'react';
import { InvestmentAsset, InvestmentPeriodicSnapshot } from '../../lib/types';
import { formatDate, normalizeToISODate } from '../../lib/i18n';
import {
  TrendingUp,
  TrendingDown,
  PieChart as PieIcon,
  BarChart3,
  Calendar,
  Sparkles,
  Info,
  DollarSign,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { SECURITY_TYPE_LABELS } from './InvestmentsView';

export interface TranchePointDetail {
  id: string;
  ticker: string;
  name: string;
  date: string;
  shares: number;
  price: number;
  currency: string;
  costILS: number;
  valueILS: number;
  profitILS: number;
  yieldPct: number;
}

export interface ChartDataPoint {
  id: string;
  label: string;
  date: string;
  cost: number;
  value: number;
  profit: number;
  returnPct: number;
  isLive?: boolean;
  tranchesInPoint?: TranchePointDetail[];
}

interface InvestmentsChartsProps {
  investments: InvestmentAsset[];
  snapshots: InvestmentPeriodicSnapshot[];
  portfolioSummary: {
    totalInvestedILS: number;
    currentValueILS: number;
    totalProfitILS: number;
    totalReturnPct: number;
  };
  usdRate: number;
  isHe: boolean;
}

export const InvestmentsCharts: React.FC<InvestmentsChartsProps> = ({
  investments,
  snapshots,
  portfolioSummary,
  usdRate,
  isHe,
}) => {
  // Toggle between real portfolio data and simulated market drop (to verify the bright red loss area)
  const [simulationMode, setSimulationMode] = useState<'normal' | 'loss'>('normal');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<'growth' | 'allocation' | 'all'>('all');
  const [timelineViewMode, setTimelineViewMode] = useState<'cumulative' | 'tranches'>('cumulative');

  // 1. Flatten all purchase tranches from investments table with costs and current profits
  const allPurchases = useMemo(() => {
    const list: TranchePointDetail[] = [];

    investments.forEach((asset) => {
      const rate = asset.currency === 'USD' ? usdRate : 1;
      asset.tranches.forEach((tr, trIdx) => {
        const iso = normalizeToISODate(tr.date);
        const costILS =
          (tr.total_cost && tr.total_cost > 0
            ? tr.total_cost
            : tr.shares * tr.price_per_share) * rate;
        const valueILS = tr.shares * asset.current_price * rate;
        const profitILS = valueILS - costILS;
        const yieldPct = costILS > 0 ? (profitILS / costILS) * 100 : 0;

        list.push({
          id: tr.id ? String(tr.id) : `${asset.id}_tr_${trIdx}`,
          ticker: asset.ticker,
          name: asset.name || asset.ticker,
          date: iso,
          shares: tr.shares,
          price: tr.price_per_share,
          currency: asset.currency,
          costILS,
          valueILS,
          profitILS,
          yieldPct,
        });
      });
    });

    list.sort((a, b) => a.date.localeCompare(b.date));
    return list;
  }, [investments, usdRate]);

  // 2. Prepare timeline points from purchases table + snapshots + current live point
  const chartDataPoints = useMemo<ChartDataPoint[]>(() => {
    const todayISO = new Date().toISOString().split('T')[0];

    // MODE B: Standalone per-tranche breakdown (shows each purchase from table with its date, cost & profit)
    if (timelineViewMode === 'tranches') {
      if (allPurchases.length === 0) {
        return [
          {
            id: 'current-live-empty',
            label: isHe ? 'מצב נוכחי (חי)' : 'Current Live',
            date: todayISO,
            cost: portfolioSummary.totalInvestedILS,
            value: portfolioSummary.currentValueILS,
            profit: portfolioSummary.totalProfitILS,
            returnPct: portfolioSummary.totalReturnPct,
            isLive: true,
          },
        ];
      }

      const points: ChartDataPoint[] = allPurchases.map((tr) => {
        const val = simulationMode === 'loss' ? tr.costILS * 0.85 : tr.valueILS;
        const prof = val - tr.costILS;
        const retPct = tr.costILS > 0 ? (prof / tr.costILS) * 100 : 0;
        return {
          id: tr.id,
          label: `${formatDate(tr.date)} (${tr.ticker})`,
          date: tr.date,
          cost: tr.costILS,
          value: val,
          profit: prof,
          returnPct: simulationMode === 'loss' ? -15.0 : retPct,
          tranchesInPoint: [tr],
        };
      });

      // Total portfolio summary point at the end
      const totalCost = portfolioSummary.totalInvestedILS;
      const liveVal =
        simulationMode === 'loss' ? totalCost * 0.85 : portfolioSummary.currentValueILS;
      const liveProfit = liveVal - totalCost;
      const liveReturnPct = totalCost > 0 ? (liveProfit / totalCost) * 100 : 0;

      points.push({
        id: 'total-portfolio-live',
        label: isHe ? 'סה"כ התיק (חי)' : 'Total Portfolio (Live)',
        date: todayISO,
        cost: totalCost,
        value: liveVal,
        profit: liveProfit,
        returnPct: simulationMode === 'loss' ? -15.0 : liveReturnPct,
        isLive: true,
      });

      return points;
    }

    // MODE A: Cumulative timeline over purchase dates (Default)
    // Group purchases by date
    const tranchesByDate = new Map<string, TranchePointDetail[]>();
    allPurchases.forEach((p) => {
      if (!tranchesByDate.has(p.date)) {
        tranchesByDate.set(p.date, []);
      }
      tranchesByDate.get(p.date)!.push(p);
    });

    const sortedPurchaseDates = Array.from(tranchesByDate.keys()).sort((a, b) =>
      a.localeCompare(b)
    );

    const sortedSnapshots = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));

    const points: ChartDataPoint[] = [];

    if (sortedPurchaseDates.length > 0) {
      // If there's only 1 purchase date across the whole portfolio
      if (sortedPurchaseDates.length === 1 && sortedSnapshots.length === 0) {
        const singleDate = sortedPurchaseDates[0];
        const trs = tranchesByDate.get(singleDate)!;
        const totalCost = trs.reduce((s, t) => s + t.costILS, 0);
        const totalVal = trs.reduce((s, t) => s + t.valueILS, 0);
        const totalProfit = totalVal - totalCost;
        const retPct = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

        // Point 1: At the moment of purchase (Cost = Value, Profit = 0)
        points.push({
          id: `initial-purchase-${singleDate}`,
          label: `${isHe ? 'מועד הרכישה' : 'Purchase Date'} (${formatDate(singleDate)})`,
          date: singleDate,
          cost: totalCost,
          value: simulationMode === 'loss' ? totalCost * 0.95 : totalCost,
          profit: simulationMode === 'loss' ? -totalCost * 0.05 : 0,
          returnPct: simulationMode === 'loss' ? -5.0 : 0,
          tranchesInPoint: trs,
        });

        // Point 2: Current Live
        const liveVal = simulationMode === 'loss' ? totalCost * 0.85 : totalVal;
        points.push({
          id: 'current-live',
          label: isHe ? 'מצב נוכחי (חי)' : 'Current Live',
          date: todayISO,
          cost: totalCost,
          value: liveVal,
          profit: liveVal - totalCost,
          returnPct: simulationMode === 'loss' ? -15.0 : retPct,
          isLive: true,
          tranchesInPoint: trs,
        });

        return points;
      }

      // Multiple purchase dates: build cumulative timeline
      let runningCost = 0;
      let runningValue = 0;

      sortedPurchaseDates.forEach((d) => {
        const trs = tranchesByDate.get(d)!;
        const dayCost = trs.reduce((s, t) => s + t.costILS, 0);
        const dayVal = trs.reduce((s, t) => s + t.valueILS, 0);

        runningCost += dayCost;
        runningValue += dayVal;

        const prof = runningValue - runningCost;
        const retPct = runningCost > 0 ? (prof / runningCost) * 100 : 0;

        const val = simulationMode === 'loss' ? runningCost * 0.85 : runningValue;
        const p = val - runningCost;
        const r = simulationMode === 'loss' ? -15.0 : retPct;

        points.push({
          id: `cum-tranche-${d}`,
          label: formatDate(d),
          date: d,
          cost: runningCost,
          value: val,
          profit: p,
          returnPct: r,
          tranchesInPoint: trs,
        });
      });
    } else if (sortedSnapshots.length > 0) {
      // Fallback if only snapshots exist without tranches
      sortedSnapshots.forEach((s) => {
        points.push({
          id: s.id,
          label: s.period_label.replace('סגירת חודש ', '').replace('סיום רבעון ', ''),
          date: s.date,
          cost: s.total_invested,
          value: simulationMode === 'loss' ? s.total_invested * 0.88 : s.total_value,
          profit: simulationMode === 'loss' ? -s.total_invested * 0.12 : s.total_profit,
          returnPct: simulationMode === 'loss' ? -12.0 : s.total_return_pct,
        });
      });
    }

    // Current live point at the end
    const totalCost = portfolioSummary.totalInvestedILS;
    const liveVal =
      simulationMode === 'loss' ? totalCost * 0.85 : portfolioSummary.currentValueILS;
    const liveProfit = liveVal - totalCost;
    const liveReturnPct = totalCost > 0 ? (liveProfit / totalCost) * 100 : 0;

    const lastPt = points[points.length - 1];
    if (!lastPt || lastPt.date !== todayISO) {
      points.push({
        id: 'current-live',
        label: isHe ? 'מצב נוכחי (חי)' : 'Current Live',
        date: todayISO,
        cost: totalCost,
        value: liveVal,
        profit: liveProfit,
        returnPct: simulationMode === 'loss' ? -15.0 : liveReturnPct,
        isLive: true,
      });
    }

    return points;
  }, [allPurchases, snapshots, portfolioSummary, simulationMode, timelineViewMode, isHe]);

  // 2. Asset Allocation Breakdown
  const allocationData = useMemo(() => {
    const map = new Map<string, { labelHe: string; labelEn: string; icon: string; valueILS: number; count: number }>();

    investments.forEach((asset) => {
      const typeKey = asset.asset_type || 'other';
      const labelCfg = SECURITY_TYPE_LABELS[asset.asset_type] || {
        he: asset.asset_type,
        en: asset.asset_type,
        icon: '🏷️',
      };

      const shares = asset.tranches.reduce((sum, tr) => sum + tr.shares, 0);
      const val = shares * asset.current_price * (asset.currency === 'USD' ? usdRate : 1);

      if (!map.has(typeKey)) {
        map.set(typeKey, {
          labelHe: labelCfg.he,
          labelEn: labelCfg.en,
          icon: labelCfg.icon,
          valueILS: 0,
          count: 0,
        });
      }

      const entry = map.get(typeKey)!;
      entry.valueILS += val;
      entry.count += 1;
    });

    const totalVal = Math.max(1, portfolioSummary.currentValueILS);
    const colors = ['#2563EB', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#64748B'];

    return Array.from(map.entries()).map(([key, data], idx) => {
      const pct = (data.valueILS / totalVal) * 100;
      return {
        key,
        ...data,
        pct,
        color: colors[idx % colors.length],
      };
    });
  }, [investments, usdRate, portfolioSummary.currentValueILS]);

  // 3. SVG Coordinates for Growth Chart
  const svgWidth = 760;
  const svgHeight = 320;
  const padding = { top: 35, right: 30, bottom: 45, left: 65 };

  const innerWidth = svgWidth - padding.left - padding.right;
  const innerHeight = svgHeight - padding.top - padding.bottom;

  const minVal = Math.min(...chartDataPoints.map((p) => Math.min(p.cost, p.value))) * 0.9;
  const maxVal = Math.max(...chartDataPoints.map((p) => Math.max(p.cost, p.value))) * 1.1;
  const valRange = Math.max(1, maxVal - minVal);

  const getX = (index: number) => {
    if (chartDataPoints.length <= 1) return padding.left + innerWidth / 2;
    return padding.left + (index / (chartDataPoints.length - 1)) * innerWidth;
  };

  const getY = (val: number) => {
    return padding.top + innerHeight - ((val - minVal) / valRange) * innerHeight;
  };

  const zeroY = getY(minVal);

  // Generate SVG path strings
  // A. Cost line (Dashed)
  const costPoints = chartDataPoints.map((p, i) => `${getX(i)},${getY(p.cost)}`);
  const costPathD = `M ${costPoints.join(' L ')}`;

  // B. Yellow Area under Cost Line (down to bottom)
  const yellowAreaD = `M ${costPoints[0]} L ${costPoints.slice(1).join(' L ')} L ${getX(
    chartDataPoints.length - 1
  )},${zeroY} L ${getX(0)},${zeroY} Z`;

  // C. Value line (Solid)
  const valPoints = chartDataPoints.map((p, i) => `${getX(i)},${getY(p.value)}`);
  const valPathD = `M ${valPoints.join(' L ')}`;

  // D. Profit / Loss Areas between Value and Cost Line (with zero-crossing split)
  const areaSegments = useMemo(() => {
    const segments: { type: 'profit' | 'loss'; path: string }[] = [];
    for (let i = 0; i < chartDataPoints.length - 1; i++) {
      const p1 = chartDataPoints[i];
      const p2 = chartDataPoints[i + 1];

      const x1 = getX(i);
      const x2 = getX(i + 1);

      const yVal1 = getY(p1.value);
      const yCost1 = getY(p1.cost);

      const yVal2 = getY(p2.value);
      const yCost2 = getY(p2.cost);

      const d1 = p1.value - p1.cost;
      const d2 = p2.value - p2.cost;

      // Check if lines cross each other between p1 and p2 (one is positive, one is negative)
      if ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) {
        const t = d1 / (d1 - d2);
        const xMid = x1 + t * (x2 - x1);
        const yMid = yCost1 + t * (yCost2 - yCost1);

        // Segment 1 (from x1 to xMid)
        segments.push({
          type: d1 >= 0 ? 'profit' : 'loss',
          path: `M ${x1},${yVal1} L ${xMid},${yMid} L ${x1},${yCost1} Z`,
        });

        // Segment 2 (from xMid to x2)
        segments.push({
          type: d2 >= 0 ? 'profit' : 'loss',
          path: `M ${xMid},${yMid} L ${x2},${yVal2} L ${x2},${yCost2} Z`,
        });
      } else {
        // Standard non-crossing quad polygon
        segments.push({
          type: d1 >= 0 || d2 >= 0 ? 'profit' : 'loss',
          path: `M ${x1},${yVal1} L ${x2},${yVal2} L ${x2},${yCost2} L ${x1},${yCost1} Z`,
        });
      }
    }
    return segments;
  }, [chartDataPoints]);

  if (investments.length === 0 && snapshots.length === 0) {
    return (
      <div style={chartStyles.container} className="animate-fade-in">
        <div style={chartStyles.emptyCard}>
          <div style={chartStyles.emptyIconWrap}>
            <TrendingUp size={36} color="#94A3B8" />
          </div>
          <h3 style={chartStyles.emptyTitle}>
            {isHe ? 'אין עדיין נתוני השקעות להצגת גרפים' : 'No Investment Data Available'}
          </h3>
          <p style={chartStyles.emptyText}>
            {isHe
              ? 'גרפי שווי מול עלות, רווח מצטבר והתפלגות אפיקי השקעה יופיעו כאן אוטומטית ברגע שתוסיף ניירות ערך או תבצע סגירת תקופה.'
              : 'Growth, P&L, and allocation charts will appear here once you add assets or record milestones.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={chartStyles.container} className="animate-fade-in">
      {/* Header & Controls */}
      <div style={chartStyles.headerRow}>
        <div>
          <div style={chartStyles.badge}>
            <Sparkles size={13} color="#2563EB" />
            <span>{isHe ? 'ניתוח ביצועים חזותי' : 'Visual Portfolio Analytics'}</span>
          </div>
          <h3 style={chartStyles.title}>
            {isHe ? 'מדדים וגרפים לתיק ההשקעות' : 'Investment Performance Charts'}
          </h3>
          <p style={chartStyles.subtitle}>
            {isHe
              ? 'צמיחת שווי התיק ביחס לעלות הקרן, חלוקת אפיקי השקעה, ומעקב רווח מצטבר בהתאם לכללי הצביעה המבוקשים.'
              : 'Portfolio growth vs cost basis, asset allocation donut, and point-in-time yield tracking.'}
          </p>
        </div>

        {/* Chart View Subtabs */}
        <div style={chartStyles.controlsGroup}>
          <div style={chartStyles.chartTabButtons}>
            <button
              style={{
                ...chartStyles.tabBtn,
                ...(activeChartTab === 'all' ? chartStyles.tabBtnActive : {}),
              }}
              onClick={() => setActiveChartTab('all')}
            >
              {isHe ? 'כל הגרפים' : 'All Charts'}
            </button>
            <button
              style={{
                ...chartStyles.tabBtn,
                ...(activeChartTab === 'growth' ? chartStyles.tabBtnActive : {}),
              }}
              onClick={() => setActiveChartTab('growth')}
            >
              <TrendingUp size={14} />
              <span>{isHe ? 'שווי מול עלות' : 'Growth vs Cost'}</span>
            </button>
            <button
              style={{
                ...chartStyles.tabBtn,
                ...(activeChartTab === 'allocation' ? chartStyles.tabBtnActive : {}),
              }}
              onClick={() => setActiveChartTab('allocation')}
            >
              <PieIcon size={14} />
              <span>{isHe ? 'התפלגות אפיקים' : 'Allocation'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* CHART 1: Growth vs Cost Basis Area Chart (User's Exact Specification) */}
      {(activeChartTab === 'all' || activeChartTab === 'growth') && (
        <div style={chartStyles.chartCard}>
          <div style={chartStyles.chartCardHeader}>
            <div style={chartStyles.chartTitleGroup}>
              <TrendingUp size={20} color="#2563EB" />
              <div>
                <h4 style={chartStyles.chartCardTitle}>
                  {isHe
                    ? 'צמיחת שווי התיק מול עלות ההשקעה (רווח מצטבר)'
                    : 'Portfolio Growth vs. Cost Basis (Cumulative P&L)'}
                </h4>
                <div style={chartStyles.legendWrap}>
                  <div style={chartStyles.legendItem}>
                    <span
                      style={{
                        ...chartStyles.legendColorBox,
                        backgroundColor: '#FACC15',
                        border: '1.5px dashed #D97706',
                      }}
                    />
                    <span>{isHe ? 'קרן השקעה (מתחת לקו המקווקו - צהוב)' : 'Cost Basis (Below dashed - Yellow)'}</span>
                  </div>
                  <div style={chartStyles.legendItem}>
                    <span
                      style={{
                        ...chartStyles.legendColorBox,
                        backgroundColor: '#10B981',
                        border: '1.5px solid #059669',
                      }}
                    />
                    <span>{isHe ? 'רווח מצטבר (מעל הקו המקווקו - ירוק)' : 'Profit Area (Above dashed - Green)'}</span>
                  </div>
                  <div style={chartStyles.legendItem}>
                    <span
                      style={{
                        ...chartStyles.legendColorBox,
                        backgroundColor: '#EF4444',
                        border: '1.5px solid #DC2626',
                      }}
                    />
                    <span>{isHe ? 'גירעון / צמיחה שלילית (אדום בוהק)' : 'Negative Growth / Loss (Bright Red)'}</span>
                  </div>
                  <div style={chartStyles.legendItem}>
                    <span style={chartStyles.dashedLineSymbol} />
                    <span>{isHe ? 'קו עלות הקרן המושקעת' : 'Cost Basis Line'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Controls: View Mode Toggle & Simulation Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* View Mode Toggle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#F1F5F9',
                  borderRadius: '8px',
                  padding: '3px',
                  border: '1px solid #CBD5E1',
                  gap: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setTimelineViewMode('cumulative')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '5px 11px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: timelineViewMode === 'cumulative' ? '#FFFFFF' : 'transparent',
                    color: timelineViewMode === 'cumulative' ? '#2563EB' : '#64748B',
                    fontWeight: timelineViewMode === 'cumulative' ? '700' : '600',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    boxShadow: timelineViewMode === 'cumulative' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                  title={
                    isHe
                      ? 'התפתחות מצטברת של שווי התיק ועלות הקרן לאורך מועדי הרכישות'
                      : 'Cumulative Growth Timeline'
                  }
                >
                  <TrendingUp size={13} color={timelineViewMode === 'cumulative' ? '#2563EB' : '#64748B'} />
                  <span>{isHe ? 'ציר זמן מצטבר' : 'Cumulative'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTimelineViewMode('tranches')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '5px 11px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: timelineViewMode === 'tranches' ? '#FFFFFF' : 'transparent',
                    color: timelineViewMode === 'tranches' ? '#2563EB' : '#64748B',
                    fontWeight: timelineViewMode === 'tranches' ? '700' : '600',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    boxShadow: timelineViewMode === 'tranches' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                  title={
                    isHe
                      ? 'הצגת רווח/הפסד ועלות לכל פעימת רכישה בודדת מטבלת הקניות'
                      : 'Per-tranche breakdown'
                  }
                >
                  <Layers size={13} color={timelineViewMode === 'tranches' ? '#2563EB' : '#64748B'} />
                  <span>{isHe ? 'לפי פעימות בודדות' : 'By Tranches'}</span>
                </button>
              </div>

              {/* Simulation Toggle */}
              <div style={chartStyles.simToggleBox}>
                <span style={chartStyles.simLabel}>
                  {isHe ? 'הדמיית צמיחה שלילית:' : 'Simulate Loss:'}
                </span>
                <button
                  type="button"
                  style={{
                    ...chartStyles.simToggleBtn,
                    backgroundColor: simulationMode === 'loss' ? '#FEE2E2' : '#F1F5F9',
                    color: simulationMode === 'loss' ? '#B91C1C' : '#475569',
                    borderColor: simulationMode === 'loss' ? '#F87171' : '#CBD5E1',
                  }}
                  onClick={() => setSimulationMode(simulationMode === 'normal' ? 'loss' : 'normal')}
                  title={
                    isHe
                      ? 'לחץ לבדיקת הצביעה באדום בוהק במצב של הפסד / שווי מתחת לעלות הקרן'
                      : 'Toggle negative growth to verify the bright red fill'
                  }
                >
                  {simulationMode === 'loss' ? (
                    <>
                      <AlertTriangle size={13} color="#DC2626" />
                      <span>{isHe ? 'תרחיש ירידת שווקים (אדום בוהק)' : 'Loss Mode Active (Bright Red)'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} color="#2563EB" />
                      <span>{isHe ? 'תרחיש רגיל (ברווח ירוק)' : 'Normal Portfolio Mode'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* SVG Chart */}
          <div style={chartStyles.svgContainer}>
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              style={chartStyles.svgElement}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                {/* Yellow Gradient for Cost Basis */}
                <linearGradient id="yellowCostGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FACC15" stopOpacity="0.65" />
                  <stop offset="100%" stopColor="#FEF08A" stopOpacity="0.18" />
                </linearGradient>

                {/* Green Gradient for Gain above dashed line */}
                <linearGradient id="greenProfitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.65" />
                  <stop offset="100%" stopColor="#34D399" stopOpacity="0.2" />
                </linearGradient>

                {/* Bright Red Gradient for Loss / Negative Growth */}
                <linearGradient id="brightRedLossGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#F87171" stopOpacity="0.35" />
                </linearGradient>

                {/* Subtle Grid Filter */}
                <pattern id="chartGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#F1F5F9" strokeWidth="1" />
                </pattern>
              </defs>

              {/* Background Grid Lines */}
              <rect
                x={padding.left}
                y={padding.top}
                width={innerWidth}
                height={innerHeight}
                fill="url(#chartGrid)"
              />

              {/* Horizontal Milestone Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = padding.top + innerHeight * ratio;
                const val = maxVal - ratio * valRange;
                return (
                  <g key={ratio}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={padding.left + innerWidth}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeDasharray="2 2"
                    />
                    <text
                      x={padding.left - 10}
                      y={y + 4}
                      fill="#94A3B8"
                      fontSize="10"
                      fontWeight="600"
                      textAnchor="end"
                    >
                      ₪{Math.round(val / 1000)}k
                    </text>
                  </g>
                );
              })}

              {/* 1. Yellow Area below Cost Line (Exact user requirement) */}
              <path d={yellowAreaD} fill="url(#yellowCostGrad)" />

              {/* 2. Profit / Loss Polygon Segments between Value and Cost */}
              {areaSegments.map((seg, idx) => (
                <path
                  key={idx}
                  d={seg.path}
                  fill={seg.type === 'profit' ? 'url(#greenProfitGrad)' : 'url(#brightRedLossGrad)'}
                />
              ))}

              {/* 3. Cost Basis Line (Dashed) */}
              <path
                d={costPathD}
                fill="none"
                stroke="#D97706"
                strokeWidth="2.5"
                strokeDasharray="6 4"
              />

              {/* 4. Portfolio Value Line (Solid) */}
              <path
                d={valPathD}
                fill="none"
                stroke={simulationMode === 'loss' ? '#DC2626' : '#059669'}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* 5. Data Points & Interactivity */}
              {chartDataPoints.map((p, idx) => {
                const x = getX(idx);
                const yCost = getY(p.cost);
                const yVal = getY(p.value);
                const isHovered = hoveredPointIndex === idx;
                const isProf = p.value >= p.cost;

                return (
                  <g
                    key={p.id}
                    onMouseEnter={() => setHoveredPointIndex(idx)}
                    onMouseLeave={() => setHoveredPointIndex(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Vertical guideline on hover */}
                    {isHovered && (
                      <line
                        x1={x}
                        y1={padding.top}
                        x2={x}
                        y2={padding.top + innerHeight}
                        stroke="#94A3B8"
                        strokeDasharray="3 3"
                        strokeWidth="1.5"
                      />
                    )}

                    {/* Cost Point (Amber) */}
                    <circle
                      cx={x}
                      cy={yCost}
                      r={isHovered ? 5.5 : 4}
                      fill="#FFFFFF"
                      stroke="#D97706"
                      strokeWidth="2"
                    />

                    {/* Value Point (Green or Bright Red) */}
                    <circle
                      cx={x}
                      cy={yVal}
                      r={isHovered ? 7.5 : 5.5}
                      fill={isProf ? '#10B981' : '#EF4444'}
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                    />

                    {/* X-axis Label */}
                    <text
                      x={x}
                      y={padding.top + innerHeight + 20}
                      fill={isHovered ? '#0F172A' : '#64748B'}
                      fontSize={isHovered ? '11' : '10'}
                      fontWeight={isHovered ? '800' : '600'}
                      textAnchor="middle"
                    >
                      {p.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Interactive Tooltip Card */}
            {hoveredPointIndex !== null && chartDataPoints[hoveredPointIndex] && (
              <div
                style={{
                  ...chartStyles.tooltipCard,
                  left: `${Math.min(
                    80,
                    Math.max(
                      15,
                      (hoveredPointIndex / Math.max(1, chartDataPoints.length - 1)) * 100
                    )
                  )}%`,
                  minWidth: '220px',
                }}
              >
                <div style={chartStyles.tooltipTitle}>
                  <Calendar size={13} color="#2563EB" />
                  <span>
                    {chartDataPoints[hoveredPointIndex].label}{' '}
                    {chartDataPoints[hoveredPointIndex].date
                      ? `(${formatDate(chartDataPoints[hoveredPointIndex].date)})`
                      : ''}
                  </span>
                </div>
                <div style={chartStyles.tooltipGrid}>
                  <div>
                    <span style={chartStyles.tooltipLabel}>{isHe ? 'שווי תיק:' : 'Valuation:'}</span>
                    <strong style={{ color: '#0F172A' }}>
                      ₪{Math.round(chartDataPoints[hoveredPointIndex].value).toLocaleString('en-US')}
                    </strong>
                  </div>
                  <div>
                    <span style={chartStyles.tooltipLabel}>{isHe ? 'עלות הקרן:' : 'Cost Basis:'}</span>
                    <strong style={{ color: '#D97706' }}>
                      ₪{Math.round(chartDataPoints[hoveredPointIndex].cost).toLocaleString('en-US')}
                    </strong>
                  </div>
                  <div>
                    <span style={chartStyles.tooltipLabel}>{isHe ? 'רווח/הפסד:' : 'Gain/Loss:'}</span>
                    {(() => {
                      const pt = chartDataPoints[hoveredPointIndex];
                      const isPtProfit = pt.profit >= 0;
                      return (
                        <strong
                          dir="ltr"
                          style={{
                            color: isPtProfit ? '#059669' : '#DC2626',
                            direction: 'ltr',
                            display: 'inline-block',
                          }}
                        >
                          {isPtProfit
                            ? `+₪${Math.round(pt.profit).toLocaleString('en-US')}`
                            : `-₪${Math.abs(Math.round(pt.profit)).toLocaleString('en-US')}`}{' '}
                          ({pt.returnPct >= 0 ? '+' : '-'}{Math.abs(pt.returnPct).toFixed(2)}%)
                        </strong>
                      );
                    })()}
                  </div>

                  {chartDataPoints[hoveredPointIndex].tranchesInPoint &&
                    chartDataPoints[hoveredPointIndex].tranchesInPoint!.length > 0 && (
                      <div
                        style={{
                          marginTop: '8px',
                          paddingTop: '8px',
                          borderTop: '1px dashed #E2E8F0',
                          fontSize: '0.72rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                        }}
                      >
                        <div style={{ fontWeight: '700', color: '#475569', marginBottom: '2px' }}>
                          {isHe ? 'פעימות רכישה במועד זה:' : 'Purchases on this date:'}
                        </div>
                        {chartDataPoints[hoveredPointIndex].tranchesInPoint!.map((t, tIdx) => (
                          <div
                            key={tIdx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '8px',
                              color: '#334155',
                              padding: '1px 0',
                            }}
                          >
                            <span>
                              <strong>{t.ticker}</strong> ({t.shares} יח' @{' '}
                              {t.currency === 'USD' ? '$' : '₪'}{t.price})
                            </span>
                            <span
                              dir="ltr"
                              style={{
                                fontWeight: '700',
                                color: t.profitILS >= 0 ? '#059669' : '#DC2626',
                                direction: 'ltr',
                              }}
                            >
                              {t.profitILS >= 0 ? '+' : ''}₪{Math.round(t.profitILS).toLocaleString('en-US')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CHART 2: Asset Allocation Donut Chart */}
      {(activeChartTab === 'all' || activeChartTab === 'allocation') && (
        <div style={chartStyles.allocationGrid}>
          <div style={chartStyles.chartCard}>
            <div style={chartStyles.chartCardHeader}>
              <div style={chartStyles.chartTitleGroup}>
                <PieIcon size={20} color="#2563EB" />
                <div>
                  <h4 style={chartStyles.chartCardTitle}>
                    {isHe ? 'התפלגות תיק ההשקעות לפי אפיקים' : 'Asset Allocation Breakdown'}
                  </h4>
                  <p style={chartStyles.chartCardSub}>
                    {isHe
                      ? 'פיזור ההשקעות בין מניות בודדות, קרנות מחקות מדד (ETF), אג״ח ופיקדונות'
                      : 'Distribution between stocks, index trackers, bonds and deposits.'}
                  </p>
                </div>
              </div>
            </div>

            <div style={chartStyles.donutContainer}>
              {/* SVG Donut */}
              <div style={chartStyles.donutSvgWrap}>
                <svg viewBox="0 0 200 200" style={chartStyles.donutSvg}>
                  {(() => {
                    let accumulatedPct = 0;
                    return allocationData.map((item) => {
                      const strokeDasharray = `${item.pct * 5.026} ${502.6}`;
                      const strokeDashoffset = `${-accumulatedPct * 5.026}`;
                      accumulatedPct += item.pct;

                      return (
                        <circle
                          key={item.key}
                          cx="100"
                          cy="100"
                          r="80"
                          fill="transparent"
                          stroke={item.color}
                          strokeWidth="28"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          transform="rotate(-90 100 100)"
                          style={{ transition: 'stroke-dasharray 0.3s ease' }}
                        />
                      );
                    });
                  })()}
                </svg>

                {/* Donut Center Text */}
                <div style={chartStyles.donutCenterText}>
                  <span style={chartStyles.donutCenterLabel}>{isHe ? 'סך הכל שווי' : 'Total Value'}</span>
                  <strong style={chartStyles.donutCenterVal}>
                    ₪{portfolioSummary.currentValueILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </strong>
                  <span style={chartStyles.donutCenterSub}>
                    {investments.length} {isHe ? 'ניירות' : 'Assets'}
                  </span>
                </div>
              </div>

              {/* Donut Legend */}
              <div style={chartStyles.allocationLegend}>
                {allocationData.map((item) => (
                  <div key={item.key} style={chartStyles.allocLegendRow}>
                    <div style={chartStyles.allocLegendLeft}>
                      <span
                        style={{
                          ...chartStyles.allocDot,
                          backgroundColor: item.color,
                        }}
                      />
                      <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                      <span style={chartStyles.allocName}>
                        {isHe ? item.labelHe : item.labelEn}
                      </span>
                    </div>
                    <div style={chartStyles.allocLegendRight}>
                      <span style={chartStyles.allocPct}>{item.pct.toFixed(1)}%</span>
                      <span style={chartStyles.allocAmount}>
                        ₪{item.valueILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Metrics & Takeaways */}
          <div style={chartStyles.metricsCard}>
            <h4 style={chartStyles.metricsTitle}>
              <Sparkles size={16} color="#2563EB" />
              <span>{isHe ? 'תובנות ומדדי מפתח לתיק' : 'Key Portfolio Highlights'}</span>
            </h4>

            <div style={chartStyles.insightsList}>
              <div style={chartStyles.insightItem}>
                <div style={chartStyles.insightIconBox}>
                  <TrendingUp size={16} color="#10B981" />
                </div>
                <div>
                  <div style={chartStyles.insightHead}>{isHe ? 'תשואה מצטברת משוקללת' : 'Total Return'}</div>
                  <div style={chartStyles.insightVal}>
                    <span dir="ltr" style={{ direction: 'ltr', display: 'inline-block' }}>
                      {portfolioSummary.totalReturnPct >= 0 ? '+' : '-'}
                      {Math.abs(portfolioSummary.totalReturnPct).toFixed(2)}%
                    </span>
                    <span
                      dir="ltr"
                      style={{
                        color: portfolioSummary.totalProfitILS >= 0 ? '#059669' : '#DC2626',
                        fontSize: '0.8125rem',
                        fontWeight: '600',
                        marginRight: '6px',
                        direction: 'ltr',
                        display: 'inline-block',
                      }}
                    >
                      ({portfolioSummary.totalProfitILS >= 0
                        ? `+₪${portfolioSummary.totalProfitILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                        : `-₪${Math.abs(portfolioSummary.totalProfitILS).toLocaleString('en-US', { maximumFractionDigits: 0 })}`})
                    </span>
                  </div>
                </div>
              </div>

              <div style={chartStyles.insightItem}>
                <div style={chartStyles.insightIconBox}>
                  <DollarSign size={16} color="#2563EB" />
                </div>
                <div>
                  <div style={chartStyles.insightHead}>{isHe ? 'סך עלות הקרן המושקעת' : 'Total Invested Capital'}</div>
                  <div style={chartStyles.insightVal}>
                    ₪{portfolioSummary.totalInvestedILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>

              <div style={chartStyles.insightItem}>
                <div style={chartStyles.insightIconBox}>
                  <Layers size={16} color="#8B5CF6" />
                </div>
                <div>
                  <div style={chartStyles.insightHead}>{isHe ? 'מספר אבני דרך וסגירות' : 'Periodic Milestones'}</div>
                  <div style={chartStyles.insightVal}>
                    {snapshots.length} {isHe ? 'סגירות היסטוריות בעץ' : 'Snapshots recorded'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const chartStyles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    marginBottom: '20px',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '12px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 8px',
    backgroundColor: '#EFF6FF',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: '4px',
  },
  title: {
    fontSize: '1.25rem',
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
  controlsGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  chartTabButtons: {
    display: 'flex',
    backgroundColor: '#F1F5F9',
    padding: '3px',
    borderRadius: '8px',
    border: '1px solid #E2E8F0',
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#64748B',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    color: '#2563EB',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E2E8F0',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
  },
  chartCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '16px',
    marginBottom: '16px',
  },
  chartTitleGroup: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
  },
  chartCardTitle: {
    fontSize: '1.0625rem',
    fontWeight: '800',
    color: '#0F172A',
    margin: '0 0 6px',
  },
  chartCardSub: {
    fontSize: '0.75rem',
    color: '#64748B',
    margin: 0,
  },
  legendWrap: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '14px',
    fontSize: '0.75rem',
    color: '#475569',
    marginTop: '6px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  legendColorBox: {
    width: '14px',
    height: '14px',
    borderRadius: '3px',
  },
  dashedLineSymbol: {
    width: '18px',
    height: '0px',
    borderTop: '2px dashed #D97706',
  },
  simToggleBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  simLabel: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#64748B',
  },
  simToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid',
    fontSize: '0.75rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  svgContainer: {
    position: 'relative',
    width: '100%',
    overflowX: 'auto',
  },
  svgElement: {
    width: '100%',
    height: 'auto',
    maxHeight: '340px',
    display: 'block',
  },
  tooltipCard: {
    position: 'absolute',
    top: '20px',
    transform: 'translateX(-50%)',
    backgroundColor: '#FFFFFF',
    border: '1px solid #BFDBFE',
    boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
    borderRadius: '10px',
    padding: '10px 14px',
    zIndex: 10,
    pointerEvents: 'none',
  },
  tooltipTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.75rem',
    fontWeight: '800',
    color: '#1E3A8A',
    marginBottom: '6px',
    borderBottom: '1px solid #EFF6FF',
    paddingBottom: '4px',
  },
  tooltipGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '0.75rem',
  },
  tooltipLabel: {
    color: '#64748B',
    marginRight: '6px',
  },
  allocationGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '16px',
  },
  donutContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: '20px',
    padding: '10px 0',
  },
  donutSvgWrap: {
    position: 'relative',
    width: '190px',
    height: '190px',
  },
  donutSvg: {
    width: '100%',
    height: '100%',
  },
  donutCenterText: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  donutCenterLabel: {
    fontSize: '0.6875rem',
    color: '#64748B',
    fontWeight: '700',
  },
  donutCenterVal: {
    fontSize: '1.0625rem',
    fontWeight: '800',
    color: '#0F172A',
  },
  donutCenterSub: {
    fontSize: '0.6875rem',
    color: '#94A3B8',
  },
  allocationLegend: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flex: 1,
    minWidth: '220px',
  },
  allocLegendRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 10px',
    backgroundColor: '#F8FAFC',
    borderRadius: '8px',
    border: '1px solid #E2E8F0',
  },
  allocLegendLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  allocDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  allocName: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: '#0F172A',
  },
  allocLegendRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  allocPct: {
    fontSize: '0.8125rem',
    fontWeight: '800',
    color: '#2563EB',
  },
  allocAmount: {
    fontSize: '0.75rem',
    color: '#64748B',
  },
  metricsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E2E8F0',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  metricsTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.9375rem',
    fontWeight: '800',
    color: '#0F172A',
    margin: 0,
  },
  insightsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  insightItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#F8FAFC',
    borderRadius: '10px',
    border: '1px solid #E2E8F0',
  },
  insightIconBox: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #E2E8F0',
  },
  insightHead: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#64748B',
  },
  insightVal: {
    fontSize: '1rem',
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyCard: {
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
  emptyIconWrap: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#F1F5F9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontSize: '1.125rem',
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '0.875rem',
    color: '#64748B',
    maxWidth: '480px',
    lineHeight: '1.5',
    margin: 0,
  },
};
