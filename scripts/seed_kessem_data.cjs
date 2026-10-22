const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

function signAdminJwt() {
  const secret = 'HomeBudgetSuperSecretJWTKey2026AtLeast32Chars!';
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { role: 'postgres', iss: 'supabase', iat: Math.floor(Date.now() / 1000), exp: 2100000000 };
  const b64H = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64P = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(b64H + '.' + b64P).digest('base64url');
  return b64H + '.' + b64P + '.' + sig;
}

const supabase = createClient('https://budget-db.liarzi.com', signAdminJwt());

// 20 historical conversion lots (all converted on 2024-04-11, keeping original acquisition date for tax)
// Followed by actual trades 2024-2026
const rawTransactions = [
  { id: 'tr-k-01', date: '2014-01-22', orig_date: '2014-01-22', type: 'convert', shares: 61550.11, price_per_share: 0.995228, fee: 0, total_cost: 61256.42, notes: 'המרה מקרן 5119433 (רכישה מקורית 22/01/2014 | שער מקורי 99.5228 אג\')' },
  { id: 'tr-k-02', date: '2014-08-19', orig_date: '2014-08-19', type: 'convert', shares: 29060.20, price_per_share: 0.999466, fee: 0, total_cost: 29044.68, notes: 'המרה מקרן 5119433 (רכישה מקורית 19/08/2014 | שער מקורי 99.9466 אג\')' },
  { id: 'tr-k-03', date: '2014-12-15', orig_date: '2014-12-15', type: 'convert', shares: 26066.87, price_per_share: 1.000246, fee: 0, total_cost: 26073.27, notes: 'המרה מקרן 5119433 (רכישה מקורית 15/12/2014 | שער מקורי 100.0246 אג\')' },
  { id: 'tr-k-04', date: '2016-12-09', orig_date: '2016-12-09', type: 'convert', shares: 57060.26, price_per_share: 1.000647, fee: 0, total_cost: 57097.18, notes: 'המרה מקרן 5119433 (רכישה מקורית 09/12/2016 | שער מקורי 100.0647 אג\')' },
  { id: 'tr-k-05', date: '2017-07-27', orig_date: '2017-07-27', type: 'convert', shares: 29559.08, price_per_share: 1.001090, fee: 0, total_cost: 29591.31, notes: 'המרה מקרן 5119433 (רכישה מקורית 27/07/2017 | שער מקורי 100.1090 אג\')' },
  { id: 'tr-k-06', date: '2018-01-10', orig_date: '2018-01-10', type: 'convert', shares: 57933.31, price_per_share: 1.001419, fee: 0, total_cost: 58015.54, notes: 'המרה מקרן 5119433 (רכישה מקורית 10/01/2018 | שער מקורי 100.1419 אג\')' },
  { id: 'tr-k-07', date: '2019-05-08', orig_date: '2019-05-08', type: 'convert', shares: 31405.36, price_per_share: 1.001843, fee: 0, total_cost: 31463.23, notes: 'המרה מקרן 5119433 (רכישה מקורית 08/05/2019 | שער מקורי 100.1843 אג\')' },
  { id: 'tr-k-08', date: '2019-08-30', orig_date: '2019-08-30', type: 'convert', shares: 42873.86, price_per_share: 1.003040, fee: 0, total_cost: 43004.21, notes: 'המרה מקרן 5119433 (רכישה מקורית 30/08/2019 | שער מקורי 100.3040 אג\')' },
  { id: 'tr-k-09', date: '2020-02-24', orig_date: '2020-02-24', type: 'convert', shares: 56247.26, price_per_share: 1.004438, fee: 0, total_cost: 56496.86, notes: 'המרה מקרן 5119433 (רכישה מקורית 24/02/2020 | שער מקורי 100.4438 אג\')' },
  { id: 'tr-k-10', date: '2020-06-16', orig_date: '2020-06-16', type: 'convert', shares: 19897.77, price_per_share: 1.005136, fee: 0, total_cost: 19999.97, notes: 'המרה מקרן 5119433 (רכישה מקורית 16/06/2020 | שער מקורי 100.5136 אג\')' },
  { id: 'tr-k-11', date: '2020-08-04', orig_date: '2020-08-04', type: 'convert', shares: 29843.15, price_per_share: 1.005236, fee: 0, total_cost: 29999.41, notes: 'המרה מקרן 5119433 (רכישה מקורית 04/08/2020 | שער מקורי 100.5236 אג\')' },
  { id: 'tr-k-12', date: '2020-12-24', orig_date: '2020-12-24', type: 'convert', shares: 25979.24, price_per_share: 1.005335, fee: 0, total_cost: 26117.85, notes: 'המרה מקרן 5119433 (רכישה מקורית 24/12/2020 | שער מקורי 100.5335 אג\')' },
  { id: 'tr-k-13', date: '2021-06-11', orig_date: '2021-06-11', type: 'convert', shares: 50718.93, price_per_share: 1.005535, fee: 0, total_cost: 50999.67, notes: 'המרה מקרן 5119433 (רכישה מקורית 11/06/2021 | שער מקורי 100.5535 אג\')' },
  { id: 'tr-k-14', date: '2021-08-20', orig_date: '2021-08-20', type: 'convert', shares: 15970.73, price_per_share: 1.005934, fee: 0, total_cost: 16065.50, notes: 'המרה מקרן 5119433 (רכישה מקורית 20/08/2021 | שער מקורי 100.5934 אג\')' },
  { id: 'tr-k-15', date: '2021-12-14', orig_date: '2021-12-14', type: 'convert', shares: 34787.29, price_per_share: 1.006034, fee: 0, total_cost: 34997.20, notes: 'המרה מקרן 5119433 (רכישה מקורית 14/12/2021 | שער מקורי 100.6034 אג\')' },
  { id: 'tr-k-16', date: '2022-01-25', orig_date: '2022-01-25', type: 'convert', shares: 20871.77, price_per_share: 1.006134, fee: 0, total_cost: 20999.80, notes: 'המרה מקרן 5119433 (רכישה מקורית 25/01/2022 | שער מקורי 100.6134 אג\')' },
  { id: 'tr-k-17', date: '2022-08-19', orig_date: '2022-08-19', type: 'convert', shares: 59058.02, price_per_share: 1.008329, fee: 0, total_cost: 59549.94, notes: 'המרה מקרן 5119433 (רכישה מקורית 19/08/2022 | שער מקורי 100.8329 אג\')' },
  { id: 'tr-k-18', date: '2022-08-24', orig_date: '2022-08-24', type: 'convert', shares: 11337.23, price_per_share: 1.008529, fee: 0, total_cost: 11433.93, notes: 'המרה מקרן 5119433 (רכישה מקורית 24/08/2022 | שער מקורי 100.8529 אג\')' },
  { id: 'tr-k-19', date: '2023-02-08', orig_date: '2023-02-08', type: 'convert', shares: 6921.18, price_per_share: 1.018409, fee: 0, total_cost: 7048.59, notes: 'המרה מקרן 5119433 (רכישה מקורית 08/02/2023 | שער מקורי 101.8409 אג\')' },
  { id: 'tr-k-20', date: '2023-08-17', orig_date: '2023-08-17', type: 'convert', shares: 48587.57, price_per_share: 1.040863, fee: 0, total_cost: 50572.98, notes: 'המרה מקרן 5119433 (רכישה מקורית 17/08/2023 | שער מקורי 104.0863 אג\')' },

  // Actual trades 2024-2026
  { id: 'tr-k-21', date: '2024-11-11', type: 'sell', shares: -45549, price_per_share: 1.098500, fee: 0, total_cost: 50035.58, notes: 'מכירה במיטב טרייד (פדיון 50,035.58 ₪ | שער מקורי 109.85 אג\')' },
  { id: 'tr-k-22', date: '2024-11-25', type: 'sell', shares: -18183, price_per_share: 1.100200, fee: 0, total_cost: 20004.94, notes: 'מכירה במיטב טרייד (פדיון 20,004.94 ₪ | שער מקורי 110.02 אג\')' },
  { id: 'tr-k-23', date: '2025-03-31', type: 'sell', shares: -53744, price_per_share: 1.116700, fee: 0, total_cost: 60015.92, notes: 'מכירה במיטב טרייד (פדיון 60,015.92 ₪ | שער מקורי 111.67 אג\')' },
  { id: 'tr-k-24', date: '2025-07-11', type: 'buy', shares: 1521, price_per_share: 1.131098, fee: 0, total_cost: 1720.40, notes: 'קנייה רגילה במיטב טרייד (עלות 1,720.40 ₪ | שער מקורי 113.1098 אג\')' },
  { id: 'tr-k-25', date: '2025-08-12', type: 'buy', shares: 4403, price_per_share: 1.135601, fee: 0, total_cost: 5000.05, notes: 'קנייה רגילה במיטב טרייד (עלות 5,000.05 ₪ | שער מקורי 113.5601 אג\')' },
  { id: 'tr-k-26', date: '2025-11-07', type: 'sell', shares: -4356, price_per_share: 1.147801, fee: 0, total_cost: 4999.82, notes: 'מכירה במיטב טרייד (פדיון 4,999.82 ₪ | שער מקורי 114.7801 אג\')' },
  { id: 'tr-k-27', date: '2026-06-16', type: 'sell', shares: -4258, price_per_share: 1.174500, fee: 0, total_cost: 5001.02, notes: 'מכירה במיטב טרייד (פדיון 5,001.02 ₪ | שער מקורי 117.45 אג\')' },
  { id: 'tr-k-28', date: '2026-08-19', type: 'sell', shares: -8463, price_per_share: 1.181700, fee: 0, total_cost: 10000.73, notes: 'מכירה במיטב טרייד (פדיון 10,000.73 ₪ | שער מקורי 118.17 אג\')' }
];

// Calculate running balance and FIFO realized gain
let runningBalance = 0;
const buyLots = [];

const tranches = rawTransactions.map((t) => {
  runningBalance += t.shares;
  const balance_after = Math.round(runningBalance * 100) / 100;
  let realized_pnl = undefined;

  if (t.shares > 0) {
    buyLots.push({
      id: t.id,
      date: t.date,
      unitCost: t.price_per_share,
      remainingShares: t.shares
    });
  } else {
    let sharesToCover = Math.abs(t.shares);
    const saleProceeds = t.total_cost || (sharesToCover * t.price_per_share);
    let costOfSold = 0;

    while (sharesToCover > 0.0001 && buyLots.length > 0) {
      const lot = buyLots[0];
      const take = Math.min(sharesToCover, lot.remainingShares);
      costOfSold += take * lot.unitCost;
      lot.remainingShares -= take;
      sharesToCover -= take;
      if (lot.remainingShares <= 0.0001) {
        buyLots.shift();
      }
    }
    realized_pnl = Math.round((saleProceeds - costOfSold) * 100) / 100;
  }

  return {
    ...t,
    balance_after,
    realized_pnl
  };
});

console.log('--- RECONCILIATION ---');
console.log('Final Balance:', runningBalance.toFixed(2), '(Expected: 587100.19)');
const remainingCost = buyLots.reduce((s, l) => s + l.remainingShares * l.unitCost, 0);
console.log('Remaining Cost Basis (FIFO):', remainingCost.toFixed(2));
console.log('Current Value @ 1.188:', (runningBalance * 1.188).toFixed(2));
console.log('Unrealized Profit:', ((runningBalance * 1.188) - remainingCost).toFixed(2));

async function updateDb() {
  const { data: asset, error: findError } = await supabase
    .from('investments')
    .select('*')
    .eq('ticker', '5127881')
    .single();

  if (findError || !asset) {
    console.error('Could not find asset 5127881:', findError);
    return;
  }

  const { error: updateError } = await supabase
    .from('investments')
    .update({
      tranches: tranches,
      current_price: 1.188,
      updated_at: new Date().toISOString()
    })
    .eq('id', asset.id);

  if (updateError) {
    console.error('Error updating DB:', updateError);
  } else {
    console.log('SUCCESS! Updated Supabase asset', asset.id, 'with all 28 tranches.');
  }
}

updateDb();
