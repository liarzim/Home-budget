// Vercel Serverless Function: End-Of-Day Daily Securities Quotes & Portfolio Snapshot Cron
// Scheduled daily at 23:55 Israel Time (20:55 UTC summer / 21:55 UTC winter)

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { fetchYahooQuote, fetchBizportalQuote } from './quote.js';

function getAdminJwt() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
  const secret =
    process.env.SUPABASE_JWT_SECRET ||
    process.env.GOTRUE_JWT_SECRET ||
    'HomeBudgetSuperSecretJWTKey2026AtLeast32Chars!';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      role: 'postgres',
      iss: 'supabase',
      iat: Math.floor(Date.now() / 1000) - 60,
      exp: Math.floor(Date.now() / 1000) + 86400,
    })
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

const HEBREW_MONTHS = [
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
      'https://budget-db.liarzi.com';
    const supabaseKey = getAdminJwt();

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

    const [yearNum, monthNum, dayNum] = israelDate.split('-').map(Number);
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();

    // Check if end of period
    const forceMonthEnd = url.searchParams.get('force_month_end') === 'true';
    const isLastDayOfMonth = forceMonthEnd || dayNum === daysInMonth;
    const quarterNum = Math.ceil(monthNum / 3);
    const isQuarterEnd = isLastDayOfMonth && (monthNum === 3 || monthNum === 6 || monthNum === 9 || monthNum === 12);
    const isYearEnd = isLastDayOfMonth && monthNum === 12;

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

    // 3. Query all investments (support client body if manual sync sent them)
    let bodyData = null;
    if (req.body) {
      try {
        bodyData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      } catch (err) {
        console.warn('Could not parse req.body:', err);
      }
    }

    let investments = [];
    if (bodyData?.investments && Array.isArray(bodyData.investments) && bodyData.investments.length > 0) {
      investments = bodyData.investments;
    } else {
      const { data: dbInvs, error: invErr } = await supabase
        .from('investments')
        .select('*');

      if (invErr) {
        console.warn(`Failed to query investments from DB: ${invErr.message}`);
      }
      investments = dbInvs || [];
    }

    if (!investments || investments.length === 0) {
      return res.status(200).json({
        success: true,
        date: israelDate,
        message: 'No investments in database to record',
        securitiesUpdated: 0,
        securitiesCount: 0,
        snapshotsCount: 0,
        monthlySnapshotsSaved: 0,
        quarterlySnapshotsSaved: 0,
        yearlySnapshotsSaved: 0,
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

    let dailyPricesWarning = null;
    if (priceRows.length > 0) {
      try {
        const { error: priceErr } = await supabase
          .from('security_daily_prices')
          .upsert(priceRows, { onConflict: 'ticker,price_date' });

        if (priceErr) {
          console.warn('Warning saving to security_daily_prices:', priceErr.message);
          dailyPricesWarning = priceErr.message;
        }
      } catch (err) {
        console.warn('Exception saving to security_daily_prices:', err);
        dailyPricesWarning = err.message;
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

    // 8. Generate daily and periodic snapshots per household
    const householdsMap = new Map();
    for (const inv of investments) {
      if (!householdsMap.has(inv.household_id)) {
        householdsMap.set(inv.household_id, []);
      }
      householdsMap.get(inv.household_id).push(inv);
    }

    let dailySnapshotsSaved = 0;
    let monthlySnapshotsSaved = 0;
    let quarterlySnapshotsSaved = 0;
    let yearlySnapshotsSaved = 0;

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
        const validTranches = tranches.filter((tr) => {
          if ((Number(tr.shares) || 0) <= 0 || (Number(tr.price_per_share) || 0) <= 0) return false;
          const trDate = tr.date ? tr.date.split('T')[0] : '';
          if (trDate && trDate > israelDate) return false;
          return true;
        });

        const totalShares = validTranches.reduce((sum, tr) => sum + (Number(tr.shares) || 0), 0);
        if (totalShares <= 0) continue; // Asset not yet purchased on or before this snapshot date

        const totalCostNative = validTranches.reduce((sum, tr) => {
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

      // 8a. Daily snapshot
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

      if (!snapErr) dailySnapshotsSaved++;

      // 8b. End of Month snapshot: populate periodic snapshots tree
      if (isLastDayOfMonth) {
        const monthSnapId = `month-${householdId}-${yearNum}-${String(monthNum).padStart(2, '0')}`;
        const monthLabel = `סגירת חודש ${HEBREW_MONTHS[monthNum]} ${yearNum}`;
        const { error: mErr } = await supabase
          .from('investment_snapshots')
          .upsert(
            {
              id: monthSnapId,
              household_id: householdId,
              period_type: 'month',
              period_label: monthLabel,
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

        if (!mErr) monthlySnapshotsSaved++;

        // 8c. End of Quarter snapshot (if month 3, 6, 9, 12)
        if (isQuarterEnd) {
          const qSnapId = `quarter-${householdId}-${yearNum}-Q${quarterNum}`;
          const qLabel = `סיום רבעון Q${quarterNum} ${yearNum}`;
          const { error: qErr } = await supabase
            .from('investment_snapshots')
            .upsert(
              {
                id: qSnapId,
                household_id: householdId,
                period_type: 'quarter',
                period_label: qLabel,
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

          if (!qErr) quarterlySnapshotsSaved++;
        }

        // 8d. End of Year snapshot (if December 31)
        if (isYearEnd) {
          const ySnapId = `year-${householdId}-${yearNum}`;
          const yLabel = `סיכום שנת ${yearNum}`;
          const { error: yErr } = await supabase
            .from('investment_snapshots')
            .upsert(
              {
                id: ySnapId,
                household_id: householdId,
                period_type: 'year',
                period_label: yLabel,
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

          if (!yErr) yearlySnapshotsSaved++;
        }
      }
    }

    // 9. Retention & Cleanup: If end of month, delete older daily records keeping only the last 7 days
    let cleanedOldDailyPrices = false;
    let cleanedOldDailySnapshots = false;

    if (isLastDayOfMonth) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const cutoffDateStr = cutoff.toISOString().split('T')[0];

      // Delete old daily prices from security_daily_prices older than 7 days
      const { error: delPriceErr } = await supabase
        .from('security_daily_prices')
        .delete()
        .lt('price_date', cutoffDateStr);

      if (!delPriceErr) cleanedOldDailyPrices = true;

      // Delete only daily snapshots older than 7 days (month/quarter/year snapshots are NEVER deleted)
      const { error: delSnapErr } = await supabase
        .from('investment_snapshots')
        .delete()
        .eq('period_type', 'daily')
        .lt('date', cutoffDateStr);

      if (!delSnapErr) cleanedOldDailySnapshots = true;
    }

    return res.status(200).json({
      success: true,
      date: israelDate,
      usdRate,
      securitiesUpdated: priceRows.length,
      dailySnapshotsSaved,
      isLastDayOfMonth,
      isQuarterEnd,
      isYearEnd,
      monthlySnapshotsSaved,
      quarterlySnapshotsSaved,
      yearlySnapshotsSaved,
      cleanedOldDailyPrices,
      cleanedOldDailySnapshots,
      dailyPricesWarning,
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
