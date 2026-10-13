// Vercel Serverless Function to fetch real-time and historical quotes
// Sources: Yahoo Finance (Global / US / Crypto / Currencies) & Bizportal (Israeli Securities by ID)

export async function fetchYahooQuote(symbol, periodType, year, month, quarter) {
  try {
    const isHistorical = periodType && periodType !== 'current';
    // For historical, we fetch daily candles for up to 5 years
    const range = isHistorical ? '5y' : '5d';
    const interval = '1d';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!res.ok) {
      throw new Error(`Yahoo returned status ${res.status}`);
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      throw new Error('No chart data found for ' + symbol);
    }

    const meta = result.meta || {};
    let currency = meta.currency || 'USD';
    let currentPrice = meta.regularMarketPrice ?? null;
    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0]?.close || [];

    const isAgorot = currency === 'ILA' || currency === 'ILX' || symbol.toUpperCase().endsWith('.TA');
    if (isAgorot) {
      currency = 'ILS';
    }

    // If current is requested or no timestamps
    if (!isHistorical || timestamps.length === 0) {
      let finalPrice = currentPrice ?? quotes[quotes.length - 1] ?? null;
      if (finalPrice != null && isAgorot) {
        finalPrice = Number((finalPrice / 100).toFixed(4));
      }
      return {
        symbol,
        source: 'Yahoo Finance',
        currency,
        price: finalPrice,
        date: new Date().toISOString().split('T')[0],
        success: true
      };
    }

    // Build historical points sorted latest to oldest
    const points = [];
    for (let i = timestamps.length - 1; i >= 0; i--) {
      if (quotes[i] != null) {
        const d = new Date(timestamps[i] * 1000);
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth() + 1;
        const dtStr = d.toISOString().split('T')[0];
        points.push({ date: dtStr, year: y, month: m, price: quotes[i] });
      }
    }

    // Determine target month & year
    let targetYear = parseInt(year, 10);
    let targetMonth = parseInt(month, 10);

    if (periodType === 'year_end') {
      targetMonth = 12; // December end
    } else if (periodType === 'quarter_end') {
      const q = parseInt(quarter, 10);
      targetMonth = q === 1 ? 3 : q === 2 ? 6 : q === 3 ? 9 : 12;
    }

    // Find the latest trading day in that targetYear and targetMonth
    const matchedPoint = points.find(p => p.year === targetYear && p.month === targetMonth);

    if (matchedPoint) {
      let hp = matchedPoint.price;
      if (isAgorot) hp = hp / 100;
      return {
        symbol,
        source: 'Yahoo Finance',
        currency,
        price: Number(hp.toFixed(4)),
        date: matchedPoint.date,
        periodType,
        targetYear,
        targetMonth,
        success: true
      };
    }

    // Fallback if not found in that exact month: find nearest earlier point
    const earlierPoint = points.find(p => p.year < targetYear || (p.year === targetYear && p.month <= targetMonth));
    if (earlierPoint) {
      let ep = earlierPoint.price;
      if (isAgorot) ep = ep / 100;
      return {
        symbol,
        source: 'Yahoo Finance (Fallback Nearest)',
        currency,
        price: Number(ep.toFixed(4)),
        date: earlierPoint.date,
        periodType,
        success: true
      };
    }

    // Otherwise return latest price
    let lp = currentPrice ?? quotes[quotes.length - 1] ?? null;
    if (lp != null && isAgorot) lp = lp / 100;
    return {
      symbol,
      source: 'Yahoo Finance',
      currency,
      price: lp != null ? Number(lp.toFixed(4)) : null,
      date: points[0]?.date || new Date().toISOString().split('T')[0],
      periodType,
      success: true
    };
  } catch (err) {
    return { symbol, success: false, error: err.message };
  }
}

export async function fetchBizportalQuote(securityNumber, periodType, year, month, quarter) {
  try {
    const stockID = securityNumber.trim();
    const pageUrl = `https://www.bizportal.co.il/capitalmarket/quote/generalview/${stockID}`;
    const pageRes = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const cookie = pageRes.headers.get('set-cookie') || '';
    const ajaxUrl = `https://www.bizportal.co.il/ajax/biz_papers_helper.ashx?action=get_paper_yearly_graph&request_type=1&paper_id=${stockID}&dd=${Date.now()}`;

    const res = await fetch(ajaxUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': pageUrl,
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': cookie
      }
    });

    const text = await res.text();
    if (!text.startsWith('~')) {
      throw new Error('Bizportal invalid response format');
    }

    const points = JSON.parse(text.replace('~', ''));
    if (!Array.isArray(points) || points.length === 0) {
      throw new Error('No historical points from Bizportal');
    }

    function formatBizportalPrice(rawCp) {
      let price = rawCp / 100;
      // If price is >= 500, on TASE index certificates / ETFs have C_p in hundredths of agorot (e.g. 257400 -> 25.74 ILS)
      if (price >= 500) {
        price = price / 100;
      }
      return Number(price.toFixed(4));
    }

    // Points are sorted latest to oldest: [{ D_p: 'DD/MM/YYYY', C_p: agorot }, ...]
    // Note: C_p is in Agorot -> divide by 100 to get ILS
    const isHistorical = periodType && periodType !== 'current';

    if (!isHistorical) {
      const latest = points[0];
      return {
        securityNumber,
        source: 'Bizportal TASE',
        currency: 'ILS',
        price: formatBizportalPrice(latest.C_p),
        date: latest.D_p,
        success: true
      };
    }

    let targetYear = parseInt(year, 10);
    let targetMonth = parseInt(month, 10);

    if (periodType === 'year_end') {
      targetMonth = 12;
    } else if (periodType === 'quarter_end') {
      const q = parseInt(quarter, 10);
      targetMonth = q === 1 ? 3 : q === 2 ? 6 : q === 3 ? 9 : 12;
    }

    const targetMonthStr = String(targetMonth).padStart(2, '0');
    const targetYearStr = String(targetYear);

    // Find first point (which is the latest trading day in that month)
    const match = points.find(p => {
      if (!p.D_p) return false;
      const parts = p.D_p.split('/');
      return parts[2] === targetYearStr && parts[1] === targetMonthStr;
    });

    if (match) {
      return {
        securityNumber,
        source: 'Bizportal TASE',
        currency: 'ILS',
        price: formatBizportalPrice(match.C_p),
        date: match.D_p,
        periodType,
        targetYear,
        targetMonth,
        success: true
      };
    }

    // Fallback nearest
    const nearest = points.find(p => {
      if (!p.D_p) return false;
      const parts = p.D_p.split('/');
      const y = parseInt(parts[2], 10);
      const m = parseInt(parts[1], 10);
      return y < targetYear || (y === targetYear && m <= targetMonth);
    });

    const selected = nearest || points[0];
    return {
      securityNumber,
      source: 'Bizportal TASE',
      currency: 'ILS',
      price: formatBizportalPrice(selected.C_p),
      date: selected.D_p,
      periodType,
      success: true
    };
  } catch (err) {
    return { securityNumber, success: false, error: err.message };
  }
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const symbol = url.searchParams.get('symbol') || '';
    const securityNumber = url.searchParams.get('security_number') || '';
    const periodType = url.searchParams.get('period_type') || 'current'; // current, month_end, quarter_end, year_end
    const year = url.searchParams.get('year') || String(new Date().getFullYear());
    const month = url.searchParams.get('month') || String(new Date().getMonth() + 1);
    const quarter = url.searchParams.get('quarter') || '1';

    // Batch mode: if 'assets' query parameter is present (JSON array)
    const assetsParam = url.searchParams.get('assets');
    if (assetsParam) {
      let assets = [];
      try {
        assets = JSON.parse(assetsParam);
      } catch (e) {
        assets = [];
      }

      const results = await Promise.all(assets.map(async (asset) => {
        const secNum = asset.security_number ? String(asset.security_number).trim() : '';
        const sym = asset.symbol ? String(asset.symbol).trim() : '';

        // If Israeli 6-7 digit security number, try Bizportal first
        if (/^\d{6,8}$/.test(secNum)) {
          const bpRes = await fetchBizportalQuote(secNum, periodType, year, month, quarter);
          if (bpRes.success) return { ...asset, quote: bpRes };
        }

        // Try Yahoo Finance with symbol
        if (sym) {
          const yhRes = await fetchYahooQuote(sym, periodType, year, month, quarter);
          if (yhRes.success) return { ...asset, quote: yhRes };
        }

        // Fallback: If symbol is numeric, try Bizportal
        if (/^\d{6,8}$/.test(sym)) {
          const bpRes = await fetchBizportalQuote(sym, periodType, year, month, quarter);
          if (bpRes.success) return { ...asset, quote: bpRes };
        }

        return {
          ...asset,
          quote: {
            success: false,
            error: 'No market quote found for symbol or security number'
          }
        };
      }));

      return res.status(200).json({ success: true, results });
    }

    // Single asset mode
    let quote = null;
    const secNum = securityNumber.trim();
    const sym = symbol.trim();

    if (/^\d{6,8}$/.test(secNum)) {
      quote = await fetchBizportalQuote(secNum, periodType, year, month, quarter);
    }

    if ((!quote || !quote.success) && sym) {
      quote = await fetchYahooQuote(sym, periodType, year, month, quarter);
    }

    if ((!quote || !quote.success) && /^\d{6,8}$/.test(sym)) {
      quote = await fetchBizportalQuote(sym, periodType, year, month, quarter);
    }

    if (!quote || !quote.success) {
      return res.status(404).json({
        success: false,
        error: quote?.error || 'Could not fetch quote'
      });
    }

    return res.status(200).json({ success: true, quote });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
