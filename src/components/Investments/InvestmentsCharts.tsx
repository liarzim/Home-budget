import React, { useState, useMemo, useRef, useEffect } from 'react';
import { InvestmentAsset, InvestmentPeriodicSnapshot, SecurityType } from '../../lib/types';
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
  Filter,
  Check,
  X,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Search,
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

  // Filter state: Asset Type ('all' or specific SecurityType like 'stock', 'etf', etc.)
  const [selectedAssetType, setSelectedAssetType] = useState<string>('all');
  // Filter state: Specific Securities (array of asset IDs; empty = all in selected type)
  const [selectedSecurityIds, setSelectedSecurityIds] = useState<string[]>([]);
  const [isSecDropdownOpen, setIsSecDropdownOpen] = useState(false);
  const [secSearchQuery, setSecSearchQuery] = useState('');
  const secDropdownRef = useRef<HTMLDivElement>(null);

  // Close securities dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (secDropdownRef.current && !secDropdownRef.current.contains(event.target as Node)) {
        setIsSecDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Distinct available asset types based on actual user holdings
  const availableAssetTypes = useMemo(() => {
    const map = new Map<string, number>();
    investments.forEach((asset) => {
      const t = asset.asset_type || 'stock';
      map.set(t, (map.get(t) || 0) + 1);
    });
    return Array.from(map.entries()).map(([type, count]) => ({
      type: type as SecurityType,
      count,
      label: SECURITY_TYPE_LABELS[type as SecurityType] || {
        he: type,
        en: type,
        icon: '🏷️',
      },
    }));
  }, [investments]);

  // Securities available under the currently selected asset type (or all if 'all')
  const securitiesForSelection = useMemo(() => {
    if (selectedAssetType === 'all') {
      return investments;
    }
    return investments.filter((a) => a.asset_type === selectedAssetType);
  }, [investments, selectedAssetType]);

  // Filtered securities for dropdown list based on search query
  const filteredSecuritiesForDropdown = useMemo(() => {
    if (!secSearchQuery.trim()) {
      return securitiesForSelection;
    }
    const q = secSearchQuery.toLowerCase().trim();
    return securitiesForSelection.filter(
      (s) =>
        s.ticker.toLowerCase().includes(q) ||
        (s.name && s.name.toLowerCase().includes(q))
    );
  }, [securitiesForSelection, secSearchQuery]);

  // Filtered investments based on user selection
  const filteredInvestments = useMemo(() => {
    return investments.filter((asset) => {
      if (selectedAssetType !== 'all' && asset.asset_type !== selectedAssetType) {
        return false;
      }
      if (selectedSecurityIds.length > 0 && !selectedSecurityIds.includes(asset.id)) {
        return false;
      }
      return true;
    });
  }, [investments, selectedAssetType, selectedSecurityIds]);

  // Summary (cost, value, profit, return) for the filtered subset
  const filteredSummary = useMemo(() => {
    const isFiltered = selectedAssetType !== 'all' || selectedSecurityIds.length > 0;
    if (!isFiltered) {
      return portfolioSummary;
    }

    let totalCost = 0;
    let totalVal = 0;

    filteredInvestments.forEach((asset) => {
      const rate = asset.currency === 'USD' ? usdRate : 1;
      asset.tranches.forEach((tr) => {
        const costILS =
          (tr.total_cost && tr.total_cost > 0
            ? tr.total_cost
            : tr.shares * tr.price_per_share) * rate;
        totalCost += costILS;
      });
      const totalShares = asset.tranches.reduce((sum, tr) => sum + tr.shares, 0);
      totalVal += totalShares * asset.current_price * rate;
    });

    const totalProfit = totalVal - totalCost;
    const totalReturnPct = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    return {
      totalInvestedILS: totalCost,
      currentValueILS: totalVal,
      totalProfitILS: totalProfit,
      totalReturnPct,
    };
  }, [filteredInvestments, portfolioSummary, selectedAssetType, selectedSecurityIds, usdRate]);

  // Filter snapshots according to selected securities if filter is active
  const relevantSnapshots = useMemo(() => {
    const isFiltered = selectedAssetType !== 'all' || selectedSecurityIds.length > 0;
    if (!isFiltered) return snapshots;

    const allowedTickers = new Set(filteredInvestments.map((a) => a.ticker.toUpperCase()));
    return snapshots
      .map((s) => {
        const matchingItems = (s.items || []).filter((item) =>
          allowedTickers.has(item.ticker.toUpperCase())
        );
        const sCost = matchingItems.reduce((acc, it) => acc + (it.total_cost || 0), 0);
        const sVal = matchingItems.reduce((acc, it) => acc + (it.market_value || 0), 0);
        const sProfit = sVal - sCost;
        const sRet = sCost > 0 ? (sProfit / sCost) * 100 : 0;
        return {
          ...s,
          total_invested: sCost,
          total_value: sVal,
          total_profit: sProfit,
          total_return_pct: sRet,
        };
      })
      .filter((s) => s.total_invested > 0 || s.total_value > 0);
  }, [snapshots, filteredInvestments, selectedAssetType, selectedSecurityIds]);

  // 1. Flatten all purchase tranches from filtered investments with costs and current profits
  const allPurchases = useMemo(() => {
    const list: TranchePointDetail[] = [];

    filteredInvestments.forEach((asset) => {
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
  }, [filteredInvestments, usdRate]);

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
            cost: filteredSummary.totalInvestedILS,
            value: filteredSummary.currentValueILS,
            profit: filteredSummary.totalProfitILS,
            returnPct: filteredSummary.totalReturnPct,
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

      // Total filtered summary point at the end
      const totalCost = filteredSummary.totalInvestedILS;
      const liveVal =
        simulationMode === 'loss' ? totalCost * 0.85 : filteredSummary.currentValueILS;
      const liveProfit = liveVal - totalCost;
      const liveReturnPct = totalCost > 0 ? (liveProfit / totalCost) * 100 : 0;

      points.push({
        id: 'total-portfolio-live',
        label: isHe
          ? selectedSecurityIds.length === 1
            ? 'מצב נוכחי (חי)'
            : 'סה"כ מחושב (חי)'
          : 'Calculated Live',
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

    const sortedSnapshots = [...relevantSnapshots].sort((a, b) => a.date.localeCompare(b.date));

    const points: ChartDataPoint[] = [];

    if (sortedPurchaseDates.length > 0) {
      // If there's only 1 purchase date
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
    } else {
      // No purchases and no snapshots: show live point
      const totalCost = filteredSummary.totalInvestedILS;
      const liveVal =
        simulationMode === 'loss' ? totalCost * 0.85 : filteredSummary.currentValueILS;
      const liveProfit = liveVal - totalCost;
      const liveReturnPct = totalCost > 0 ? (liveProfit / totalCost) * 100 : 0;

      points.push({
        id: 'current-live-only',
        label: isHe ? 'מצב נוכחי (חי)' : 'Current Live',
        date: todayISO,
        cost: totalCost,
        value: liveVal,
        profit: liveProfit,
        returnPct: simulationMode === 'loss' ? -15.0 : liveReturnPct,
        isLive: true,
      });

      return points;
    }

    // Current live point at the end
    const totalCost = filteredSummary.totalInvestedILS;
    const liveVal =
      simulationMode === 'loss' ? totalCost * 0.85 : filteredSummary.currentValueILS;
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
  }, [allPurchases, relevantSnapshots, filteredSummary, simulationMode, timelineViewMode, isHe, selectedSecurityIds]);

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
  const padding = { top: 35, right: 30, bottom: 45, left: 82 };

  const innerWidth = svgWidth - padding.left - padding.right;
  const innerHeight = svgHeight - padding.top - padding.bottom;

  const niceCeil = (num: number) => {
    if (num <= 0) return 10;
    if (num <= 10) return 10;
    if (num <= 20) return 20;
    if (num <= 50) return Math.ceil(num / 5) * 5;
    if (num <= 100) return Math.ceil(num / 10) * 10;
    if (num <= 500) return Math.ceil(num / 50) * 50;
    if (num <= 1000) return Math.ceil(num / 100) * 100;
    if (num <= 10000) return Math.ceil(num / 1000) * 1000;
    if (num <= 100000) return Math.ceil(num / 5000) * 5000;
    if (num <= 1000000) return Math.ceil(num / 50000) * 50000;
    return Math.ceil(num / 100000) * 100000;
  };

  const rawMin =
    chartDataPoints.length > 0
      ? Math.min(...chartDataPoints.map((p) => Math.min(p.cost, p.value)))
      : 0;
  const rawMax =
    chartDataPoints.length > 0
      ? Math.max(...chartDataPoints.map((p) => Math.max(p.cost, p.value)))
      : 100;

  // Investment values and costs start from baseline 0 ILS so yellow area shows actual capital from 0
  const minVal = rawMin < 0 ? rawMin * 1.1 : 0;
  const maxVal = niceCeil(rawMax > 0 ? rawMax * 1.15 : 100);
  const valRange = Math.max(1, maxVal - minVal);

  const formatYAxisValue = (val: number) => {
    const abs = Math.abs(val);
    if (abs < 0.01) return '₪0';

    if (maxVal >= 1_000_000) {
      const m = val / 1_000_000;
      return `₪${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
    }
    if (maxVal >= 50_000) {
      return `₪${Math.round(val / 1000)}k`;
    }
    if (maxVal >= 10_000) {
      const k = val / 1000;
      return `₪${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
    }
    if (maxVal >= 1000) {
      return `₪${Math.round(val).toLocaleString('en-US')}`;
    }
    if (maxVal >= 100) {
      return `₪${Math.round(val)}`;
    }
    return `₪${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}`;
  };

  const getX = (index: number) => {
    if (chartDataPoints.length <= 1) return padding.left + innerWidth / 2;
    return padding.left + (index / (chartDataPoints.length - 1)) * innerWidth;
  };

  const getY = (val: number) => {
    return padding.top + innerHeight - ((val - minVal) / valRange) * innerHeight;
  };

  const zeroY = getY(minVal);

  // Visible ticks on X-axis (Smart sampling so labels never collide)
  const visibleTickIndices = useMemo(() => {
    const total = chartDataPoints.length;
    if (total <= 6) {
      return new Set(chartDataPoints.map((_, i) => i));
    }
    const targetTicks = 6;
    const set = new Set<number>();
    set.add(0);
    set.add(total - 1);
    const step = (total - 1) / (targetTicks - 1);
    for (let k = 1; k < targetTicks - 1; k++) {
      set.add(Math.round(k * step));
    }
    return set;
  }, [chartDataPoints]);

  const formatAxisDate = (dateStr?: string, label?: string) => {
    if (label && (label.includes('מצב נוכחי') || label.includes('Current Live') || label.includes('סה"כ התיק'))) {
      return isHe ? 'מצב נוכחי' : 'Current';
    }
    if (!dateStr) {
      if (label && label.length > 12) return label.slice(0, 10);
      return label || '';
    }
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const yr = parts[0].slice(-2);
      const mo = parts[1];
      const da = parts[2];
      return `${da}/${mo}/${yr}`;
    }
    return label || dateStr;
  };

  // Generate SVG path strings
  // A. Cost line (Dashed)
  const costPoints = chartDataPoints.map((p, i) => `${getX(i)},${getY(p.cost)}`);
  const costPathD = costPoints.length > 0 ? `M ${costPoints.join(' L ')}` : '';

  // B. Yellow Area under Cost Line (down to bottom)
  const yellowAreaD =
    costPoints.length > 0
      ? `M ${costPoints[0]} L ${costPoints.slice(1).join(' L ')} L ${getX(
          chartDataPoints.length - 1
        )},${zeroY} L ${getX(0)},${zeroY} Z`
      : '';

  // C. Value line (Solid)
  const valPoints = chartDataPoints.map((p, i) => `${getX(i)},${getY(p.value)}`);
  const valPathD = valPoints.length > 0 ? `M ${valPoints.join(' L ')}` : '';

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
          type: d1 > 0 ? 'profit' : 'loss',
          path: `M ${x1},${yVal1} L ${xMid},${yMid} L ${x1},${yCost1} Z`,
        });

        // Segment 2 (from xMid to x2)
        segments.push({
          type: d2 > 0 ? 'profit' : 'loss',
          path: `M ${xMid},${yMid} L ${x2},${yVal2} L ${x2},${yCost2} Z`,
        });
      } else {
        // Standard non-crossing quad polygon
        // If either endpoint is at loss and overall diff is negative/loss, render in bright red
        const isLoss = (d1 <= 0 && d2 < 0) || (d1 < 0 && d2 <= 0) || (d1 + d2 < 0);
        segments.push({
          type: isLoss ? 'loss' : 'profit',
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
                  {(() => {
                    if (!isHe) {
                      if (selectedSecurityIds.length === 1 && filteredInvestments[0]) {
                        return `Growth vs Cost: ${filteredInvestments[0].ticker} (${filteredInvestments[0].name})`;
                      }
                      if (selectedAssetType !== 'all') {
                        return `Growth vs Cost: ${selectedAssetType} (${filteredInvestments.length} securities)`;
                      }
                      if (selectedSecurityIds.length > 1) {
                        return `Growth vs Cost: ${filteredInvestments.length} Selected Securities`;
                      }
                      return 'Portfolio Growth vs. Cost Basis (Cumulative P&L)';
                    }
                    if (selectedSecurityIds.length === 1 && filteredInvestments[0]) {
                      return `צמיחת שווי ועלות השקעה: ${filteredInvestments[0].name || filteredInvestments[0].ticker} (${filteredInvestments[0].ticker})`;
                    }
                    if (selectedAssetType !== 'all') {
                      const typeLabel = SECURITY_TYPE_LABELS[selectedAssetType as SecurityType]?.he || selectedAssetType;
                      return `צמיחת שווי מול עלות: ${typeLabel} (${filteredInvestments.length} ניירות)`;
                    }
                    if (selectedSecurityIds.length > 1) {
                      return `צמיחת שווי מול עלות: ${filteredInvestments.length} ניירות נבחרים (${filteredInvestments.map((a) => a.ticker).join(', ')})`;
                    }
                    return 'צמיחת שווי התיק מול עלות ההשקעה (רווח מצטבר)';
                  })()}
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

          {/* FILTER TOOLBAR: BY SECURITY TYPE & SPECIFIC SECURITIES */}
          <div style={chartStyles.filterToolbar}>
            <div style={chartStyles.filterToolbarHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={chartStyles.filterIconCircle}>
                  <Filter size={15} color="#2563EB" />
                </div>
                <div>
                  <strong style={{ fontSize: '0.85rem', color: '#1E293B', display: 'block' }}>
                    {isHe ? 'פילוח וסינון הגרף לפי ניירות ערך או סיווג' : 'Filter Graph by Securities or Asset Class'}
                  </strong>
                  <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                    {isHe ? 'לחץ על סוג נייר או על שמות הניירות למטה כדי לבודד אותם בגרף' : 'Select asset types or individual securities below to isolate on chart'}
                  </span>
                </div>
              </div>
              {(selectedAssetType !== 'all' || selectedSecurityIds.length > 0) && (
                <button
                  type="button"
                  style={chartStyles.clearFilterBtn}
                  onClick={() => {
                    setSelectedAssetType('all');
                    setSelectedSecurityIds([]);
                  }}
                  title={isHe ? 'איפוס והצגת כל התיק' : 'Reset filter'}
                >
                  <RotateCcw size={12} />
                  <span>{isHe ? 'הצג את כל התיק' : 'Show All'}</span>
                </button>
              )}
            </div>

            {/* DROPDOWN & CHECKBOX CONTROLS */}
            <div style={chartStyles.dropdownsRow}>
              {/* 1. Asset Type Dropdown */}
              <div style={chartStyles.dropdownField}>
                <label style={chartStyles.dropdownLabel}>
                  <Filter size={14} color="#2563EB" />
                  <span>{isHe ? 'סוג נייר ערך:' : 'Security Type:'}</span>
                </label>
                <div style={chartStyles.selectWrapper}>
                  <select
                    value={selectedAssetType}
                    onChange={(e) => {
                      setSelectedAssetType(e.target.value);
                      setSelectedSecurityIds([]);
                    }}
                    style={chartStyles.selectElement}
                  >
                    <option value="all">
                      {isHe ? `כל הסוגים (${investments.length} ניירות)` : `All Types (${investments.length})`}
                    </option>
                    {availableAssetTypes.map((item) => (
                      <option key={item.type} value={item.type}>
                        {item.label.icon} {isHe ? item.label.he : item.label.en} ({item.count})
                      </option>
                    ))}
                  </select>
                  <div style={chartStyles.selectChevronWrap}>
                    <ChevronDown size={15} color="#64748B" />
                  </div>
                </div>
              </div>

              {/* 2. Securities Dropdown with Checkboxes */}
              {securitiesForSelection.length > 0 && (
                <div style={chartStyles.dropdownField} ref={secDropdownRef}>
                  <label style={chartStyles.dropdownLabel}>
                    <Layers size={14} color="#6366F1" />
                    <span>{isHe ? 'ניירות ערך (סימון ב-Checkbox):' : 'Securities (Checkbox Selection):'}</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    {/* Trigger Button */}
                    <button
                      type="button"
                      onClick={() => setIsSecDropdownOpen((prev) => !prev)}
                      style={{
                        ...chartStyles.dropdownTriggerBtn,
                        ...(selectedSecurityIds.length > 0 ? chartStyles.dropdownTriggerActive : {}),
                      }}
                    >
                      <div style={chartStyles.dropdownTriggerTextWrap}>
                        <span style={chartStyles.triggerBadge}>
                          {selectedSecurityIds.length === 0
                            ? isHe
                              ? `כל הניירות (${securitiesForSelection.length})`
                              : `All Securities (${securitiesForSelection.length})`
                            : selectedSecurityIds.length === 1
                            ? (() => {
                                const found = investments.find((i) => i.id === selectedSecurityIds[0]);
                                return found ? `${found.ticker} - ${found.name || found.ticker}` : '1 נבחר';
                              })()
                            : isHe
                            ? `${selectedSecurityIds.length} ניירות נבחרו מתוך ${securitiesForSelection.length}`
                            : `${selectedSecurityIds.length} of ${securitiesForSelection.length} selected`}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {selectedSecurityIds.length > 0 && (
                          <span
                            role="button"
                            tabIndex={0}
                            style={chartStyles.triggerClearIconBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSecurityIds([]);
                            }}
                            title={isHe ? 'נקה בחירה' : 'Clear'}
                          >
                            <X size={12} />
                          </span>
                        )}
                        {isSecDropdownOpen ? (
                          <ChevronUp size={16} color="#64748B" />
                        ) : (
                          <ChevronDown size={16} color="#64748B" />
                        )}
                      </div>
                    </button>

                    {/* Floating Dropdown Menu with Checkboxes */}
                    {isSecDropdownOpen && (
                      <div style={chartStyles.dropdownPanel}>
                        {/* Search Input */}
                        <div style={chartStyles.panelSearchBox}>
                          <Search size={14} color="#94A3B8" />
                          <input
                            type="text"
                            placeholder={isHe ? 'חיפוש נייר לפי שם או מספר/סימול...' : 'Search ticker or name...'}
                            value={secSearchQuery}
                            onChange={(e) => setSecSearchQuery(e.target.value)}
                            style={chartStyles.panelSearchInput}
                            autoFocus
                          />
                          {secSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setSecSearchQuery('')}
                              style={chartStyles.searchClearBtn}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>

                        {/* Dropdown Action Toolbar */}
                        <div style={chartStyles.panelActionsRow}>
                          <label style={chartStyles.selectAllLabel}>
                            <input
                              type="checkbox"
                              checked={
                                selectedSecurityIds.length === securitiesForSelection.length &&
                                securitiesForSelection.length > 0
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSecurityIds(securitiesForSelection.map((s) => s.id));
                                } else {
                                  setSelectedSecurityIds([]);
                                }
                              }}
                              style={chartStyles.checkboxControl}
                            />
                            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#1E293B' }}>
                              {isHe ? 'בחר הכל' : 'Select All'}
                            </span>
                          </label>

                          <button
                            type="button"
                            onClick={() => setSelectedSecurityIds([])}
                            style={chartStyles.panelClearBtn}
                          >
                            <RotateCcw size={11} />
                            <span>{isHe ? 'איפוס / כל התיק' : 'Show All'}</span>
                          </button>
                        </div>

                        {/* Items List with Checkboxes */}
                        <div style={chartStyles.panelListScroll}>
                          {filteredSecuritiesForDropdown.length === 0 ? (
                            <div style={chartStyles.panelEmptySearch}>
                              <span>{isHe ? 'לא נמצא נייר תואם' : 'No matching securities'}</span>
                            </div>
                          ) : (
                            filteredSecuritiesForDropdown.map((sec) => {
                              const isChecked = selectedSecurityIds.includes(sec.id);
                              const rate = sec.currency === 'USD' ? usdRate : 1;
                              const totalShares = sec.tranches.reduce((sum, tr) => sum + tr.shares, 0);
                              const currentVal = totalShares * sec.current_price * rate;
                              const totalCost = sec.tranches.reduce(
                                (sum, tr) =>
                                  sum +
                                  (tr.total_cost && tr.total_cost > 0
                                    ? tr.total_cost
                                    : tr.shares * tr.price_per_share) * rate,
                                0
                              );
                              const profit = currentVal - totalCost;
                              const retPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;

                              return (
                                <label
                                  key={sec.id}
                                  style={{
                                    ...chartStyles.panelItemRow,
                                    backgroundColor: isChecked ? '#EFF6FF' : 'transparent',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setSelectedSecurityIds(selectedSecurityIds.filter((id) => id !== sec.id));
                                      } else {
                                        setSelectedSecurityIds([...selectedSecurityIds, sec.id]);
                                      }
                                    }}
                                    style={chartStyles.checkboxControl}
                                  />
                                  <div style={chartStyles.panelItemContent}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                      <span style={chartStyles.panelTickerBadge}>{sec.ticker}</span>
                                      <span style={chartStyles.panelNameText} title={sec.name}>
                                        {sec.name || sec.ticker}
                                      </span>
                                    </div>
                                    <div style={chartStyles.panelStatWrap}>
                                      <span
                                        style={{
                                          fontSize: '0.72rem',
                                          fontWeight: '700',
                                          color: profit >= 0 ? '#059669' : '#DC2626',
                                          direction: 'ltr',
                                        }}
                                      >
                                        {profit >= 0 ? '+' : ''}
                                        {retPct.toFixed(1)}%
                                      </span>
                                      <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                                        ₪{Math.round(currentVal).toLocaleString('en-US')}
                                      </span>
                                    </div>
                                  </div>
                                </label>
                              );
                            })
                          )}
                        </div>

                        {/* Footer inside dropdown */}
                        <div style={chartStyles.panelFooter}>
                          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                            {selectedSecurityIds.length === 0
                              ? isHe
                                ? 'מציג את כל הניירות בסוג זה'
                                : 'Showing all securities'
                              : isHe
                              ? `נבחרו ${selectedSecurityIds.length} ניירות`
                              : `${selectedSecurityIds.length} selected`}
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsSecDropdownOpen(false)}
                            style={chartStyles.panelCloseBtn}
                          >
                            {isHe ? 'סגור' : 'Close'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Active Filter Info & Reset Button */}
            {(selectedAssetType !== 'all' || selectedSecurityIds.length > 0) && (
              <div style={chartStyles.activeFilterSummaryBar}>
                <div style={chartStyles.activeFilterBadge}>
                  <span>
                    {isHe
                      ? `סינון פעיל: ${filteredInvestments.length} ניירות (${filteredInvestments.map((a) => a.ticker).join(', ')})`
                      : `Active Filter: ${filteredInvestments.length} securities (${filteredInvestments.map((a) => a.ticker).join(', ')})`}
                  </span>
                </div>
                <div style={chartStyles.activeFilterStats}>
                  <span>
                    {isHe ? 'עלות:' : 'Cost:'}{' '}
                    <strong>₪{Math.round(filteredSummary.totalInvestedILS).toLocaleString('en-US')}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    {isHe ? 'שווי:' : 'Value:'}{' '}
                    <strong>₪{Math.round(filteredSummary.currentValueILS).toLocaleString('en-US')}</strong>
                  </span>
                  <span>•</span>
                  <span style={{ color: filteredSummary.totalProfitILS >= 0 ? '#059669' : '#DC2626' }}>
                    {isHe ? 'רווח/הפסד:' : 'P&L:'}{' '}
                    <strong>
                      {filteredSummary.totalProfitILS >= 0 ? '+' : ''}
                      ₪{Math.round(filteredSummary.totalProfitILS).toLocaleString('en-US')} (
                      {filteredSummary.totalReturnPct >= 0 ? '+' : ''}
                      {filteredSummary.totalReturnPct.toFixed(2)}%)
                    </strong>
                  </span>
                </div>
                <button
                  type="button"
                  style={chartStyles.clearFilterBtn}
                  onClick={() => {
                    setSelectedAssetType('all');
                    setSelectedSecurityIds([]);
                  }}
                  title={isHe ? 'נקה סינון והצג את כל התיק' : 'Clear filter'}
                >
                  <X size={13} />
                  <span>{isHe ? 'נקה סינון' : 'Clear Filter'}</span>
                </button>
              </div>
            )}
          </div>

          {filteredInvestments.length === 0 ? (
            <div style={chartStyles.filterEmptyState}>
              <div style={chartStyles.emptyFilterIconWrap}>
                <Filter size={32} color="#94A3B8" />
              </div>
              <h5 style={chartStyles.emptyFilterTitle}>
                {isHe ? 'לא נמצאו ניירות ערך התואמים לסינון' : 'No securities found matching this filter'}
              </h5>
              <p style={chartStyles.emptyFilterSub}>
                {isHe
                  ? 'נסה לבחור סוג נייר אחר או לנקות את הסינון להצגת כל התיק.'
                  : 'Try selecting another type or clear filter to view the entire portfolio.'}
              </p>
              <button
                type="button"
                style={chartStyles.clearFilterBtn}
                onClick={() => {
                  setSelectedAssetType('all');
                  setSelectedSecurityIds([]);
                }}
              >
                <X size={14} />
                <span>{isHe ? 'איפוס סינון' : 'Reset Filter'}</span>
              </button>
            </div>
          ) : (
            /* SVG Chart */
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
                  <stop offset="0%" stopColor="#EF4444" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#DC2626" stopOpacity="0.5" />
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

              {/* Vertical Y-Axis Line */}
              <line
                x1={padding.left}
                y1={padding.top}
                x2={padding.left}
                y2={padding.top + innerHeight}
                stroke="#CBD5E1"
                strokeWidth="1.5"
              />

              {/* Horizontal Milestone Grid Lines & Numbers */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = padding.top + innerHeight * ratio;
                const val = maxVal - ratio * valRange;
                return (
                  <g key={ratio}>
                    {/* Horizontal grid line across the chart */}
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={padding.left + innerWidth}
                      y2={y}
                      stroke={ratio === 1 ? '#CBD5E1' : '#E2E8F0'}
                      strokeDasharray={ratio === 1 ? undefined : '2 2'}
                      strokeWidth={ratio === 1 ? 1.5 : 1}
                    />

                    {/* Small tick mark extending left from the axis line */}
                    <line
                      x1={padding.left - 5}
                      y1={y}
                      x2={padding.left}
                      y2={y}
                      stroke="#94A3B8"
                      strokeWidth="1.5"
                    />

                    {/* Y-axis milestone text moved comfortably to the left with a clear gap from the axis */}
                    <text
                      x={padding.left - 16}
                      y={y + 3.5}
                      fill="#64748B"
                      fontSize="10"
                      fontWeight="600"
                      textAnchor="end"
                    >
                      {formatYAxisValue(val)}
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

              {/* 4. Portfolio Value Line (Solid: Green on profit, Bright Red on loss) */}
              <path
                d={valPathD}
                fill="none"
                stroke={
                  simulationMode === 'loss' || filteredSummary.totalProfitILS < 0
                    ? '#DC2626'
                    : '#059669'
                }
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
                const isFirstPt = idx === 0;
                const isLastPt = idx === chartDataPoints.length - 1;
                const isProf =
                  p.value > p.cost
                    ? true
                    : p.value < p.cost
                    ? false
                    : (filteredSummary.totalProfitILS >= 0 && simulationMode !== 'loss');

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

                    {/* Value Point (Green on profit, Bright Red on loss, Amber at initial purchase) */}
                    <circle
                      cx={x}
                      cy={yVal}
                      r={isHovered ? 7.5 : 5.5}
                      fill={isFirstPt ? '#D97706' : (isProf ? '#10B981' : '#EF4444')}
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                    />

                    {/* Direct Value Badges on key points */}
                    {(isHovered || isFirstPt || isLastPt || chartDataPoints.length <= 4) && (() => {
                      const costText = `₪${p.cost >= 10000 ? Math.round(p.cost / 1000) + 'k' : (p.cost >= 1000 ? Math.round(p.cost).toLocaleString('en-US') : (p.cost % 1 === 0 ? p.cost.toFixed(0) : p.cost.toFixed(1)))}`;
                      const valText = `₪${p.value >= 10000 ? Math.round(p.value / 1000) + 'k' : (p.value >= 1000 ? Math.round(p.value).toLocaleString('en-US') : (p.value % 1 === 0 ? p.value.toFixed(0) : p.value.toFixed(1)))}`;
                      const cW = Math.max(34, costText.length * 6.5 + 8);
                      const vW = Math.max(34, valText.length * 6.5 + 8);

                      // Alignment: at start (isFirstPt), place above the start of the line inside chart area (x + 4); at end (isLastPt), place inside (x - vW - 6)
                      const cX = isFirstPt ? x + 4 : isLastPt ? x - cW - 6 : x + 6;
                      const vX = isFirstPt ? x + 4 : isLastPt ? x - vW - 6 : x + 6;
                      const vY = isFirstPt ? yVal - 18 : yVal + (p.value >= p.cost ? -18 : 6);
                      const diffSignificant = Math.abs(p.value - p.cost) > 0.05;

                      const badgeStroke = isFirstPt ? '#D97706' : (isProf ? '#059669' : '#DC2626');
                      const badgeTextFill = isFirstPt ? '#B45309' : (isProf ? '#059669' : '#DC2626');

                      return (
                        <g pointerEvents="none">
                          {diffSignificant && !isFirstPt && (
                            <g>
                              <rect
                                x={cX}
                                y={yCost - 18}
                                width={cW}
                                height={15}
                                rx={3}
                                fill="rgba(255, 255, 255, 0.94)"
                                stroke="#D97706"
                                strokeWidth={1}
                              />
                              <text
                                x={cX + cW / 2}
                                y={yCost - 7}
                                fill="#B45309"
                                fontSize="9"
                                fontWeight="700"
                                textAnchor="middle"
                              >
                                {costText}
                              </text>
                            </g>
                          )}
                          <g>
                            <rect
                              x={vX}
                              y={vY}
                              width={vW}
                              height={15}
                              rx={3}
                              fill="rgba(255, 255, 255, 0.94)"
                              stroke={badgeStroke}
                              strokeWidth={1}
                            />
                            <text
                              x={vX + vW / 2}
                              y={vY + 11}
                              fill={badgeTextFill}
                              fontSize="9.5"
                              fontWeight="800"
                              textAnchor="middle"
                            >
                              {valText}
                            </text>
                          </g>
                        </g>
                      );
                    })()}

                    {/* X-axis Label & Tick Mark */}
                    {(() => {
                      const isTickVisible = visibleTickIndices.has(idx);
                      const axisLabel = formatAxisDate(p.date, p.label);
                      const isFirst = idx === 0;
                      const isLast = idx === chartDataPoints.length - 1;
                      const textAnchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
                      const tickX = isFirst ? x + 2 : isLast ? x - 2 : x;

                      if (isTickVisible) {
                        return (
                          <g key={`tick-${p.id}`}>
                            {/* Tick line mark */}
                            <line
                              x1={x}
                              y1={padding.top + innerHeight}
                              x2={x}
                              y2={padding.top + innerHeight + 5}
                              stroke="#CBD5E1"
                              strokeWidth="1.5"
                            />
                            {/* Milestone Text */}
                            <text
                              x={tickX}
                              y={padding.top + innerHeight + 19}
                              fill={isHovered ? '#0F172A' : '#64748B'}
                              fontSize={isHovered ? '11' : '10'}
                              fontWeight={isHovered ? '800' : '600'}
                              textAnchor={textAnchor}
                            >
                              {axisLabel}
                            </text>
                          </g>
                        );
                      }

                      // If point is not a milestone tick, but is hovered: render dynamic hover pill tag
                      if (isHovered) {
                        const pillW = Math.max(56, axisLabel.length * 7.5 + 12);
                        return (
                          <g key={`hover-tick-${p.id}`}>
                            <line
                              x1={x}
                              y1={padding.top + innerHeight}
                              x2={x}
                              y2={padding.top + innerHeight + 6}
                              stroke="#1E293B"
                              strokeWidth="2"
                            />
                            <rect
                              x={x - pillW / 2}
                              y={padding.top + innerHeight + 7}
                              width={pillW}
                              height={19}
                              rx={4}
                              fill="#1E293B"
                            />
                            <text
                              x={x}
                              y={padding.top + innerHeight + 20}
                              fill="#FFFFFF"
                              fontSize="10"
                              fontWeight="700"
                              textAnchor="middle"
                            >
                              {axisLabel}
                            </text>
                          </g>
                        );
                      }

                      return null;
                    })()}
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
                    {(() => {
                      const pt = chartDataPoints[hoveredPointIndex];
                      const formattedD = pt.date ? formatDate(pt.date) : '';
                      if (pt.label.includes('מצב נוכחי') || pt.label.includes('Current Live') || pt.label.includes('סה"כ התיק')) {
                        return `${pt.label} (${formattedD})`;
                      }
                      if (formattedD && pt.label.includes(formattedD)) {
                        return pt.label;
                      }
                      return formattedD ? `${pt.label} (${formattedD})` : pt.label;
                    })()}
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
          )}
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
  filterToolbar: {
    backgroundColor: '#F8FAFC',
    borderRadius: '12px',
    border: '1.5px solid #CBD5E1',
    padding: '14px 16px',
    marginBottom: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  filterToolbarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '10px',
    borderBottom: '1px solid #E2E8F0',
    flexWrap: 'wrap',
    gap: '8px',
  },
  filterIconCircle: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#EFF6FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownsRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  dropdownField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: '1 1 240px',
    minWidth: '220px',
    position: 'relative',
  },
  dropdownLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.78rem',
    fontWeight: '700',
    color: '#334155',
  },
  selectWrapper: {
    position: 'relative',
    width: '100%',
  },
  selectElement: {
    width: '100%',
    padding: '8px 30px 8px 12px',
    borderRadius: '8px',
    border: '1.5px solid #CBD5E1',
    backgroundColor: '#FFFFFF',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: '#1E293B',
    appearance: 'none',
    cursor: 'pointer',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  },
  selectChevronWrap: {
    position: 'absolute',
    top: '50%',
    left: '10px',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
  },
  dropdownTriggerBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1.5px solid #CBD5E1',
    backgroundColor: '#FFFFFF',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: '#1E293B',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.15s ease',
    textAlign: 'right',
  },
  dropdownTriggerActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#F8FAFC',
    boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.15)',
  },
  dropdownTriggerTextWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  triggerBadge: {
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: '#1E293B',
  },
  triggerClearIconBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    backgroundColor: '#F1F5F9',
    color: '#64748B',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  dropdownPanel: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    width: '100%',
    minWidth: '300px',
    backgroundColor: '#FFFFFF',
    borderRadius: '10px',
    border: '1px solid #CBD5E1',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
    zIndex: 100,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '380px',
  },
  panelSearchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderBottom: '1px solid #E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  panelSearchInput: {
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    fontSize: '0.8rem',
    width: '100%',
    color: '#1E293B',
  },
  searchClearBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94A3B8',
    padding: 0,
    display: 'flex',
  },
  panelActionsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    borderBottom: '1px solid #F1F5F9',
    backgroundColor: '#FAFAFA',
  },
  selectAllLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  panelClearBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    fontSize: '0.72rem',
    fontWeight: '600',
    color: '#6366F1',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  panelListScroll: {
    overflowY: 'auto',
    maxHeight: '220px',
    padding: '4px 0',
  },
  panelEmptySearch: {
    padding: '16px',
    textAlign: 'center',
    fontSize: '0.78rem',
    color: '#94A3B8',
  },
  panelItemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '7px 12px',
    cursor: 'pointer',
    transition: 'background-color 0.12s ease',
    userSelect: 'none',
  },
  checkboxControl: {
    width: '16px',
    height: '16px',
    accentColor: '#2563EB',
    cursor: 'pointer',
    flexShrink: 0,
  },
  panelItemContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    minWidth: 0,
    gap: '8px',
  },
  panelTickerBadge: {
    fontSize: '0.72rem',
    fontWeight: '800',
    color: '#1E40AF',
    backgroundColor: '#EFF6FF',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid #BFDBFE',
    flexShrink: 0,
  },
  panelNameText: {
    fontSize: '0.78rem',
    fontWeight: '600',
    color: '#334155',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  panelStatWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  panelFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    borderTop: '1px solid #E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  panelCloseBtn: {
    padding: '3px 10px',
    borderRadius: '6px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#FFFFFF',
    fontSize: '0.72rem',
    fontWeight: '700',
    color: '#334155',
    cursor: 'pointer',
  },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  filterLabelGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    minWidth: '120px',
    fontSize: '0.78rem',
    fontWeight: '700',
    color: '#475569',
  },
  filterLabelText: {
    fontSize: '0.78rem',
    fontWeight: '700',
    color: '#475569',
  },
  filterChipsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
    flex: 1,
  },
  filterChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 11px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#FFFFFF',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#334155',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
    color: '#FFFFFF',
    fontWeight: '700',
    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
  },
  filterSubChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #E2E8F0',
    backgroundColor: '#FFFFFF',
    fontSize: '0.72rem',
    fontWeight: '600',
    color: '#475569',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  filterSubChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
    color: '#4338CA',
    fontWeight: '700',
    boxShadow: '0 1px 3px rgba(99, 102, 241, 0.2)',
  },
  chipBadgeCount: {
    padding: '1px 5px',
    borderRadius: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    fontSize: '0.68rem',
  },
  tickerNameHint: {
    fontSize: '0.68rem',
    opacity: 0.8,
  },
  activeFilterSummaryBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '8px',
    borderTop: '1px dashed #CBD5E1',
    flexWrap: 'wrap',
    gap: '10px',
    fontSize: '0.75rem',
  },
  activeFilterBadge: {
    color: '#1E40AF',
    fontWeight: '700',
  },
  activeFilterStats: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#475569',
  },
  clearFilterBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 9px',
    borderRadius: '6px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#FFFFFF',
    fontSize: '0.72rem',
    fontWeight: '600',
    color: '#DC2626',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  filterEmptyState: {
    padding: '40px 20px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: '12px',
    border: '1px dashed #CBD5E1',
    margin: '12px 0',
  },
  emptyFilterIconWrap: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: '#EFF6FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
  },
  emptyFilterTitle: {
    fontSize: '0.9375rem',
    fontWeight: '700',
    color: '#1E293B',
    margin: '0 0 6px',
  },
  emptyFilterSub: {
    fontSize: '0.8125rem',
    color: '#64748B',
    maxWidth: '360px',
    lineHeight: '1.4',
    margin: '0 0 14px',
  },
};
