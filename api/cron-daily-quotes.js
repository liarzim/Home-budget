// Vercel Serverless Function: End-Of-Day Daily Securities Quotes & Portfolio Snapshot Cron
// Scheduled daily at 23:55 Israel Time (20:55 UTC summer / 21:55 UTC winter)

import { createClient } from '@supabase/supabase-js';
import { fetchYahooQuote, fetchBizportalQuote } from './quote.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-vercel-cron');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Security Check: Support Vercel native cron, CRON_SECRET token, or dev mode
  const authHeader = req.headers.authorization || '';
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCronHeader = req.headers['x-vercel-cron'] === '1';
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const querySecret = url.searchParams.get('secret');

  const isAuthorized =
    !cronSecret ||
    isVercelCronHeader ||
    authHeader === `Bearer ${cronSecret}` ||
    querySecret === cronSecret ||
    authHeader.length > 20; // Supabase JWT token from authenticated user manual sync

  if (!isAuthorized) {
    return res.status(401).json({ success: false, error: 'Unauthorized cron request' });
  }

  try {
    const supabaseUrl =
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      'https://placeholder.supabase.co';
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY;

    if (!supabaseKey) {
      throw new Error('Supabase credentials not available on server environment');
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    // 1. Get Israel Date (YYYY-MM-DD)
    const israelDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    // 2. Fetch USD / ILS exchange rate
    let usdRate = 3.70;
    try {
      const usdQuote = await fetchYahooQuote('USDILS=X', 'current');
      if (usdQuote?.success && usdQuote.price > 0) {
        usdRate = usdQuote.price;
      }
    } catch (e) {
      console.warn('Could not fetch USDILS rate, using fallback 3.70', e);
    }

    // 3. Query all investments from database
    const { data: investments, error: invErr } = await supabase
      .from('investments')
      .select('*');

    if (invErr) {
      throw new Error(`Failed to query investments: ${invErr.message}`);
    }

    if (!investments || investments.length === 0) {
      return res.status(200).json({
        success: true,
        date: israelDate,
        message: 'No investments in database to record',
        securitiesCount: 0,
        snapshotsCount: 0,
      });
    }

    // 4. Collect unique securities
    const uniqueSecurities = new Map();
    for (const inv of investments) {
      const key = inv.ticker ? inv.ticker.trim().toUpperCase() : String(inv.security_number || '').trim();
      if (key && !uniqueSecurities.has(key)) {
        uniqueSecurities.set(key, {
          ticker: inv.ticker || '',
          security_number: inv.security_number ? String(inv.security_number).trim() : '',
          currency: inv.currency || 'ILS',
          name: inv.name || inv.ticker,
        });
      }
    }

    // 5. Fetch closing price for each unique security
    const quotesMap = new Map();
    for (const [key, sec] of uniqueSecurities.entries()) {
      let quote = null;
      const secNum = sec.security_number;
      const sym = sec.ticker;

      if (/^\d{6,8}$/.test(secNum)) {
        quote = await fetchBizportalQuote(secNum, 'current');
      }
      if ((!quote || !quote.success) && sym) {
        quote = await fetchYahooQuote(sym, 'current');
      }
      if ((!quote || !quote.success) && /^\d{6,8}$/.test(sym)) {
        quote = await fetchBizportalQuote(sym, 'current');
      }

      if (quote && quote.success && quote.price != null) {
        quotesMap.set(key, quote);
      }
    }

    // 6. Save closing prices to public.security_daily_prices
    const priceRows = [];
    for (const [key, quote] of quotesMap.entries()) {
      const sec = uniqueSecurities.get(key);
      priceRows.push({
        ticker: sec.ticker || sec.security_number,
        security_number: sec.security_number || null,
        price_date: israelDate,
        closing_price: quote.price,
        currency: quote.currency || sec.currency || 'ILS',
        source: quote.source || 'Automated End-Of-Day Cron',
      });
    }

    if (priceRows.length > 0) {
      const { error: priceErr } = await supabase
        .from('security_daily_prices')
        .upsert(priceRows, { onConflict: 'ticker,price_date' });

      if (priceErr) {
        console.warn('Warning saving to security_daily_prices:', priceErr.message);
      }
    }

    // 7. Update current_price on public.investments
    for (const inv of investments) {
      const key = inv.ticker ? inv.ticker.trim().toUpperCase() : String(inv.security_number || '').trim();
      const quote = quotesMap.get(key);
      if (quote && quote.price != null) {
        await supabase
          .from('investments')
          .update({
            current_price: quote.price,
            updated_at: new Date().toISOString(),
          })
          .eq('id', inv.id);
      }
    }

    // 8. Generate daily snapshot per household
    const householdsMap = new Map();
    for (const inv of investments) {
      if (!householdsMap.has(inv.household_id)) {
        householdsMap.set(inv.household_id, []);
      }
      householdsMap.get(inv.household_id).push(inv);
    }

    let snapshotsSavedCount = 0;
    for (const [householdId, hInvs] of householdsMap.entries()) {
      let totalInvestedILS = 0;
      let currentValueILS = 0;
      const snapshotItems = [];

      for (const inv of hInvs) {
        const key = inv.ticker ? inv.ticker.trim().toUpperCase() : String(inv.security_number || '').trim();
        const quote = quotesMap.get(key);
        const price = quote?.price ?? Number(inv.current_price) ?? 0;
        const rate = inv.currency === 'USD' ? usdRate : 1;

        const tranches = Array.isArray(inv.tranches) ? inv.tranches : [];
        const totalShares = tranches.reduce((sum, tr) => sum + (Number(tr.shares) || 0), 0);
        const totalCostNative = tranches.reduce((sum, tr) => {
          const c = tr.total_cost && Number(tr.total_cost) > 0
            ? Number(tr.total_cost)
            : (Number(tr.shares) || 0) * (Number(tr.price_per_share) || 0);
          return sum + c;
        }, 0);

        const costILS = totalCostNative * rate;
        const valueILS = totalShares * price * rate;
        const profitILS = valueILS - costILS;
        const returnPct = costILS > 0 ? (profitILS / costILS) * 100 : 0;

        totalInvestedILS += costILS;
        currentValueILS += valueILS;

        snapshotItems.push({
          ticker: inv.ticker,
          security_number: inv.security_number,
          name: inv.name,
          currency: inv.currency,
          total_shares: totalShares,
          current_price: price,
          total_cost: Number(costILS.toFixed(2)),
          market_value: Number(valueILS.toFixed(2)),
          profit: Number(profitILS.toFixed(2)),
          return_pct: Number(returnPct.toFixed(2)),
        });
      }

      const totalProfitILS = currentValueILS - totalInvestedILS;
      const totalReturnPct = totalInvestedILS > 0 ? (totalProfitILS / totalInvestedILS) * 100 : 0;

      const snapshotId = `daily-${householdId}-${israelDate}`;
      const { error: snapErr } = await supabase
        .from('investment_snapshots')
        .upsert(
          {
            id: snapshotId,
            household_id: householdId,
            period_type: 'daily',
            period_label: `סגירה יומית ${israelDate}`,
            date: israelDate,
            items: snapshotItems,
            total_invested: Number(totalInvestedILS.toFixed(2)),
            total_value: Number(currentValueILS.toFixed(2)),
            total_profit: Number(totalProfitILS.toFixed(2)),
            total_return_pct: Number(totalReturnPct.toFixed(2)),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (!snapErr) {
        snapshotsSavedCount++;
      } else {
        console.warn('Warning saving daily snapshot:', snapErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      date: israelDate,
      usdRate,
      securitiesUpdated: priceRows.length,
      snapshotsSaved: snapshotsSavedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Daily cron error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error executing daily securities cron',
    });
  }
}
