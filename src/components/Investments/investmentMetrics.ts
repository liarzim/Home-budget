import { InvestmentAsset, InvestmentTranche } from '../../lib/types';
import { normalizeToISODate } from '../../lib/i18n';

export interface AssetMetrics {
  totalShares: number;
  totalCost: number; // Open FIFO cost basis
  totalFees: number;
  avgPrice: number;
  currentValue: number;
  profit: number;
  returnPct: number;
  realizedProfit: number;
  totalProceeds: number;
  totalBoughtCost: number;
  hasSales: boolean;
}

/**
 * Calculates asset holding metrics using FIFO lot accounting.
 * Supports sales, buy tranches, conversion tranches, and optional date-bounding (upToDate).
 *
 * @param asset The investment asset with its tranches
 * @param upToDate Optional ISO date string (YYYY-MM-DD) to calculate historical open position up to that date
 */
export function calculateAssetMetrics(
  asset: InvestmentAsset,
  upToDate?: string
): AssetMetrics {
  const allTranches = asset.tranches || [];
  const tranches = upToDate
    ? allTranches.filter((tr) => normalizeToISODate(tr.date) <= upToDate)
    : allTranches;

  const hasSales = tranches.some((tr) => tr.shares < 0 || tr.type === 'sell');
  const totalFees = tranches.reduce((sum, tr) => sum + (tr.fee || 0), 0);

  if (!hasSales) {
    const totalShares = tranches.reduce((sum, tr) => sum + tr.shares, 0);
    const totalCost = tranches.reduce(
      (sum, tr) =>
        sum +
        (tr.total_cost !== undefined
          ? tr.total_cost
          : tr.shares * tr.price_per_share),
      0
    );
    const avgPrice = totalShares > 0 ? totalCost / totalShares : 0;
    const currentValue = totalShares * asset.current_price;
    const profit = currentValue - totalCost;
    const returnPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    return {
      totalShares,
      totalCost,
      totalFees,
      avgPrice,
      currentValue,
      profit,
      returnPct,
      realizedProfit: 0,
      totalProceeds: 0,
      totalBoughtCost: totalCost,
      hasSales: false,
    };
  }

  // Has sales -> FIFO lot accounting for open holdings and realized gains
  const sorted = [...tranches].sort((a, b) => {
    const d1 = normalizeToISODate(a.date);
    const d2 = normalizeToISODate(b.date);
    return d1.localeCompare(d2);
  });

  const buyLots: { remainingShares: number; unitCost: number }[] = [];
  let totalShares = 0;
  let realizedProfit = 0;
  let totalProceeds = 0;
  let totalBoughtCost = 0;

  sorted.forEach((tr) => {
    totalShares += tr.shares;
    if (tr.shares > 0) {
      const cost =
        tr.total_cost !== undefined
          ? tr.total_cost
          : tr.shares * tr.price_per_share;
      totalBoughtCost += cost;
      buyLots.push({
        remainingShares: tr.shares,
        unitCost: tr.price_per_share,
      });
    } else {
      // Sale tranche
      const sharesSold = Math.abs(tr.shares);
      const proceeds =
        tr.total_cost !== undefined
          ? tr.total_cost
          : sharesSold * tr.price_per_share;
      totalProceeds += proceeds;
      let costOfSold = 0;
      let needed = sharesSold;

      while (needed > 0.0001 && buyLots.length > 0) {
        const oldest = buyLots[0];
        const take = Math.min(needed, oldest.remainingShares);
        costOfSold += take * oldest.unitCost;
        oldest.remainingShares -= take;
        needed -= take;
        if (oldest.remainingShares <= 0.0001) {
          buyLots.shift();
        }
      }
      realizedProfit += proceeds - costOfSold;
    }
  });

  const openCostBasis = buyLots.reduce(
    (sum, lot) => sum + lot.remainingShares * lot.unitCost,
    0
  );
  const avgPrice = totalShares > 0 ? openCostBasis / totalShares : 0;
  const currentValue = totalShares * asset.current_price;
  const profit = currentValue - openCostBasis;
  const returnPct = openCostBasis > 0 ? (profit / openCostBasis) * 100 : 0;

  return {
    totalShares,
    totalCost: openCostBasis,
    totalFees,
    avgPrice,
    currentValue,
    profit,
    returnPct,
    realizedProfit,
    totalProceeds,
    totalBoughtCost,
    hasSales: true,
  };
}
