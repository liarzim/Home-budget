// Service to fetch live & historical market quotes from Yahoo Finance and Bizportal
import { InvestmentAsset } from './types';

export interface MarketQuoteResult {
  price: number;
  date: string;
  currency: string;
  source: string;
  periodType?: string;
  success: boolean;
  error?: string;
}

export interface QuoteParams {
  periodType: 'current' | 'month_end' | 'quarter_end' | 'year_end';
  year?: number;
  month?: number;
  quarter?: number;
}

/**
 * Fetch a single quote from /api/quote, with fallback to public CORS proxy if running client-side only
 */
export async function fetchAssetQuote(
  symbol?: string,
  securityNumber?: string,
  params: QuoteParams = { periodType: 'current' }
): Promise<MarketQuoteResult> {
  const cleanSym = symbol ? symbol.trim() : '';
  const cleanSecNum = securityNumber ? securityNumber.trim() : '';

  // 1. Try local/Vercel serverless endpoint
  try {
    const q = new URLSearchParams({
      symbol: cleanSym,
      security_number: cleanSecNum,
      period_type: params.periodType,
      year: String(params.year || new Date().getFullYear()),
      month: String(params.month || (new Date().getMonth() + 1)),
      quarter: String(params.quarter || 1)
    });

    const res = await fetch(`/api/quote?${q.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.quote) {
        return {
          price: data.quote.price,
          date: data.quote.date,
          currency: data.quote.currency || 'USD',
          source: data.quote.source || 'API',
          periodType: data.quote.periodType,
          success: true
        };
      }
    }
  } catch (e) {
    console.warn('Direct /api/quote call failed, attempting fallback...', e);
  }

  // 2. Direct client fallback for Yahoo Finance via allorigins proxy (for US / Global)
  if (cleanSym) {
    try {
      const isHistorical = params.periodType !== 'current';
      const range = isHistorical ? '5y' : '5d';
      const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanSym)}?range=${range}&interval=1d`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

      const res = await fetch(proxyUrl);
      if (res.ok) {
        const data = await res.json();
        const result = data?.chart?.result?.[0];
        if (result) {
          const meta = result.meta || {};
          let currency = meta.currency || 'USD';
          const quotes = result.indicators?.quote?.[0]?.close || [];
          const timestamps = result.timestamp || [];

          const isAgorot = currency === 'ILA' || currency === 'ILX' || cleanSym.toUpperCase().endsWith('.TA');
          if (isAgorot) {
            currency = 'ILS';
          }

          if (!isHistorical || timestamps.length === 0) {
            let currentPrice = meta.regularMarketPrice ?? quotes[quotes.length - 1] ?? 0;
            if (isAgorot) {
              currentPrice = currentPrice / 100;
            }
            return {
              price: Number(currentPrice.toFixed(4)),
              date: new Date().toISOString().split('T')[0],
              currency,
              source: 'Yahoo Finance (Direct)',
              success: true
            };
          }

          // Historical match
          let targetYear = params.year || new Date().getFullYear();
          let targetMonth = params.month || (new Date().getMonth() + 1);
          if (params.periodType === 'year_end') {
            targetMonth = 12;
          } else if (params.periodType === 'quarter_end') {
            const q = params.quarter || 1;
            targetMonth = q === 1 ? 3 : q === 2 ? 6 : q === 3 ? 9 : 12;
          }

          for (let i = timestamps.length - 1; i >= 0; i--) {
            if (quotes[i] != null) {
              const d = new Date(timestamps[i] * 1000);
              const y = d.getUTCFullYear();
              const m = d.getUTCMonth() + 1;
              if (y === targetYear && m === targetMonth) {
                let p = quotes[i];
                if (isAgorot) p = p / 100;
                return {
                  price: Number(p.toFixed(4)),
                  date: d.toISOString().split('T')[0],
                  currency,
                  source: 'Yahoo Finance (Direct)',
                  periodType: params.periodType,
                  success: true
                };
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Yahoo fallback failed:', err);
    }
  }

  return {
    price: 0,
    date: new Date().toISOString().split('T')[0],
    currency: 'USD',
    source: 'None',
    success: false,
    error: 'לא נמצא ציטוט שוק עבור נייר זה'
  };
}

/**
 * Fetch quotes for multiple assets simultaneously
 */
export async function fetchBatchAssetQuotes(
  assets: InvestmentAsset[],
  params: QuoteParams = { periodType: 'current' }
): Promise<Map<string, MarketQuoteResult>> {
  const resultsMap = new Map<string, MarketQuoteResult>();

  // Attempt batch call to /api/quote
  try {
    const payload = assets.map(a => ({
      id: a.id,
      symbol: a.ticker,
      security_number: a.security_number
    }));

    const q = new URLSearchParams({
      period_type: params.periodType,
      year: String(params.year || new Date().getFullYear()),
      month: String(params.month || (new Date().getMonth() + 1)),
      quarter: String(params.quarter || 1),
      assets: JSON.stringify(payload)
    });

    const res = await fetch(`/api/quote?${q.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        for (const item of data.results) {
          if (item.quote && item.quote.success) {
            resultsMap.set(item.id, {
              price: item.quote.price,
              date: item.quote.date,
              currency: item.quote.currency || 'USD',
              source: item.quote.source || 'API',
              periodType: item.quote.periodType,
              success: true
            });
          }
        }
      }
    }
  } catch (e) {
    console.warn('Batch fetch failed, falling back to individual calls', e);
  }

  // For any asset not resolved yet, fetch individually
  for (const asset of assets) {
    if (!resultsMap.has(asset.id)) {
      const singleRes = await fetchAssetQuote(asset.ticker, asset.security_number, params);
      resultsMap.set(asset.id, singleRes);
    }
  }

  return resultsMap;
}

/**
 * Fetch current USD/ILS exchange rate from reliable sources:
 * 1. open.er-api.com (Free, real-time FX, CORS enabled)
 * 2. api.frankfurter.app (European Central Bank data)
 * 3. Yahoo Finance (ILS=X)
 * 4. Fallback default
 */
export async function fetchUsdIlsRate(): Promise<{ rate: number; source: string; success: boolean }> {
  // Source 1: open.er-api.com
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (res.ok) {
      const data = await res.json();
      const ils = data?.rates?.ILS;
      if (typeof ils === 'number' && ils > 2.0 && ils < 6.0) {
        return { rate: Number(ils.toFixed(4)), source: 'Exchange Rate API', success: true };
      }
    }
  } catch (e) {
    console.warn('open.er-api failed:', e);
  }

  // Source 2: api.frankfurter.app
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=ILS');
    if (res.ok) {
      const data = await res.json();
      const ils = data?.rates?.ILS;
      if (typeof ils === 'number' && ils > 2.0 && ils < 6.0) {
        return { rate: Number(ils.toFixed(4)), source: 'Frankfurter (ECB)', success: true };
      }
    }
  } catch (e) {
    console.warn('frankfurter failed:', e);
  }

  // Source 3: Yahoo Finance ILS=X
  try {
    const quote = await fetchAssetQuote('ILS=X');
    if (quote.success && quote.price > 2.0 && quote.price < 6.0) {
      return { rate: Number(quote.price.toFixed(4)), source: 'Yahoo Finance (ILS=X)', success: true };
    }
  } catch (e) {
    console.warn('Yahoo ILS=X failed:', e);
  }

  return { rate: 3.70, source: 'Default Fallback', success: false };
}

