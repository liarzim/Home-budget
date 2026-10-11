import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { InvestmentAsset, InvestmentTranche } from '../../lib/types';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
  Percent,
  Coins,
  ShieldCheck,
  Scale,
  RefreshCw,
  X,
} from 'lucide-react';

export const InvestmentsView: React.FC = () => {
  const {
    investments,
    addInvestmentAsset,
    updateInvestmentAsset,
    deleteInvestmentAsset,
    addInvestmentTranche,
    deleteInvestmentTranche,
    activeHousehold,
    language,
    dir,
  } = useAuth();

  const isHe = language === 'he';

  // Currency view toggle: 'original' | 'ILS' | 'USD'
  const [currencyMode, setCurrencyMode] = useState<'original' | 'ILS' | 'USD'>('original');
  const [usdRate, setUsdRate] = useState<number>(3.70); // 1 USD = 3.70 ILS
  const [isRateEditing, setIsRateEditing] = useState<boolean>(false);

  // Expanded asset rows (to view purchase tranches)
  const [expandedAssetIds, setExpandedAssetIds] = useState<Record<string, boolean>>({
    'inv-sample-user': true, // Open user sample by default
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'new_asset' | 'add_tranche'>('new_asset');
  const [selectedAssetIdForTranche, setSelectedAssetIdForTranche] = useState<string>('');

  // Form Fields
  const [formTicker, setFormTicker] = useState('');
  const [formName, setFormName] = useState('');
  const [formCurrency, setFormCurrency] = useState<'USD' | 'ILS'>('USD');
  const [formAssetType, setFormAssetType] = useState<InvestmentAsset['asset_type']>('stock');
  const [formCurrentPrice, setFormCurrentPrice] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formShares, setFormShares] = useState<string>('');
  const [formPricePerShare, setFormPricePerShare] = useState<string>('');
  const [formFee, setFormFee] = useState<string>('0');
  const [formNotes, setFormNotes] = useState<string>('');

  // Inline Quick Price Edit
  const [editingPriceAssetId, setEditingPriceAssetId] = useState<string | null>(null);
  const [inlinePriceInput, setInlinePriceInput] = useState<string>('');

  // Info Accordion toggle
  const [isFormulaExpanded, setIsFormulaExpanded] = useState<boolean>(false);

  const toggleExpand = (assetId: string) => {
    setExpandedAssetIds((prev) => ({
      ...prev,
      [assetId]: !prev[assetId],
    }));
  };

  // Helper calculation for an asset
  const calculateAssetMetrics = (asset: InvestmentAsset) => {
    const totalShares = asset.tranches.reduce((sum, tr) => sum + tr.shares, 0);
    const totalCost = asset.tranches.reduce(
      (sum, tr) => sum + tr.shares * tr.price_per_share + (tr.fee || 0),
      0
    );
    const avgPrice = totalShares > 0 ? totalCost / totalShares : 0;
    const currentValue = totalShares * asset.current_price;
    const profit = currentValue - totalCost;
    const returnPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    return {
      totalShares,
      totalCost,
      avgPrice,
      currentValue,
      profit,
      returnPct,
    };
  };

  // Portfolio Totals in selected currency
  const portfolioSummary = useMemo(() => {
    let totalInvestedILS = 0;
    let currentValueILS = 0;

    investments.forEach((asset) => {
      const { totalCost, currentValue } = calculateAssetMetrics(asset);
      const mult = asset.currency === 'USD' ? usdRate : 1;
      totalInvestedILS += totalCost * mult;
      currentValueILS += currentValue * mult;
    });

    const totalProfitILS = currentValueILS - totalInvestedILS;
    const totalReturnPct = totalInvestedILS > 0 ? (totalProfitILS / totalInvestedILS) * 100 : 0;
    const estimatedTaxILS = Math.max(0, totalProfitILS) * 0.25; // 25% capital gains tax
    const netProfitILS = totalProfitILS - estimatedTaxILS;

    return {
      totalInvestedILS,
      currentValueILS,
      totalProfitILS,
      totalReturnPct,
      estimatedTaxILS,
      netProfitILS,
    };
  }, [investments, usdRate]);

  // Format currency value based on mode
  const formatVal = (amount: number, assetCurrency: 'USD' | 'ILS', forceCurrency?: 'ILS' | 'USD') => {
    const targetCurr = forceCurrency || (currencyMode === 'original' ? assetCurrency : currencyMode);
    let convertedAmount = amount;

    if (currencyMode === 'ILS' && assetCurrency === 'USD') {
      convertedAmount = amount * usdRate;
    } else if (currencyMode === 'USD' && assetCurrency === 'ILS') {
      convertedAmount = amount / (usdRate || 1);
    }

    const symbol = targetCurr === 'USD' ? '$' : '₪';
    return `${symbol}${convertedAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const handleOpenAddModal = (mode: 'new_asset' | 'add_tranche', asset?: InvestmentAsset) => {
    setModalMode(mode);
    if (mode === 'add_tranche' && asset) {
      setSelectedAssetIdForTranche(asset.id);
      setFormTicker(asset.ticker);
      setFormName(asset.name);
      setFormCurrency(asset.currency);
      setFormCurrentPrice(asset.current_price.toString());
    } else {
      setSelectedAssetIdForTranche('');
      setFormTicker('');
      setFormName('');
      setFormCurrency('USD');
      setFormAssetType('stock');
      setFormCurrentPrice('');
    }
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormShares('');
    setFormPricePerShare('');
    setFormFee('0');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sharesNum = parseFloat(formShares);
    const priceNum = parseFloat(formPricePerShare);
    const feeNum = parseFloat(formFee) || 0;
    const currentPriceNum = parseFloat(formCurrentPrice) || priceNum;

    if (isNaN(sharesNum) || sharesNum <= 0 || isNaN(priceNum) || priceNum < 0) {
      alert(isHe ? 'אנא הזן מספר מניות ומחיר קנייה תקינים' : 'Please enter valid shares and price');
      return;
    }

    if (modalMode === 'new_asset') {
      if (!formTicker.trim()) {
        alert(isHe ? 'אנא הזן סימול/טיקר לנייר' : 'Please enter a ticker');
        return;
      }
      addInvestmentAsset({
        household_id: activeHousehold?.id || 'hh-main',
        ticker: formTicker.trim().toUpperCase(),
        name: formName.trim() || formTicker.trim().toUpperCase(),
        currency: formCurrency,
        current_price: currentPriceNum,
        asset_type: formAssetType,
        target_allocation_pct: 0,
        tranches: [
          {
            id: `tr-${Date.now()}`,
            date: formDate,
            shares: sharesNum,
            price_per_share: priceNum,
            fee: feeNum,
            notes: formNotes.trim() || undefined,
          },
        ],
      });
    } else if (modalMode === 'add_tranche' && selectedAssetIdForTranche) {
      addInvestmentTranche(selectedAssetIdForTranche, {
        date: formDate,
        shares: sharesNum,
        price_per_share: priceNum,
        fee: feeNum,
        notes: formNotes.trim() || undefined,
      });
      // Also update current market price if provided
      if (!isNaN(currentPriceNum) && currentPriceNum > 0) {
        updateInvestmentAsset(selectedAssetIdForTranche, { current_price: currentPriceNum });
      }
    }

    setIsModalOpen(false);
  };

  const handleSaveInlinePrice = (assetId: string) => {
    const num = parseFloat(inlinePriceInput);
    if (!isNaN(num) && num > 0) {
      updateInvestmentAsset(assetId, { current_price: num });
    }
    setEditingPriceAssetId(null);
  };

  return (
    <div style={styles.container} dir={dir}>
      {/* Top Header */}
      <div style={styles.headerRow}>
        <div>
          <div style={styles.badgeRow}>
            <div style={styles.topicBadge}>
              <TrendingUp size={14} color="#2563EB" />
              <span>{isHe ? 'שוק ההון והשקעות' : 'Capital Markets & Wealth'}</span>
            </div>
          </div>
          <h1 style={styles.title}>
            {isHe ? 'ביצועי תיק השקעות' : 'Investment Portfolio & Yield'}
          </h1>
          <p style={styles.subtitle}>
            {isHe
              ? 'חישוב מחיר קנייה ממוצע משוקלל, השוואה לשער נוכחי, רווח/הפסד ריאלי וחלוקה לפי פעימות רכישה.'
              : 'Weighted average purchase cost, live market comparison, dollar & percentage returns per tranche.'}
          </p>
        </div>

        {/* Action Controls */}
        <div style={styles.headerActions}>
          {/* Currency Display Filter */}
          <div style={styles.currencyToggleGroup}>
            <button
              style={{
                ...styles.toggleBtn,
                ...(currencyMode === 'original' ? styles.toggleBtnActive : {}),
              }}
              onClick={() => setCurrencyMode('original')}
            >
              {isHe ? 'מטבע מקור' : 'Original'}
            </button>
            <button
              style={{
                ...styles.toggleBtn,
                ...(currencyMode === 'ILS' ? styles.toggleBtnActive : {}),
              }}
              onClick={() => setCurrencyMode('ILS')}
            >
              ₪ שקלים
            </button>
            <button
              style={{
                ...styles.toggleBtn,
                ...(currencyMode === 'USD' ? styles.toggleBtnActive : {}),
              }}
              onClick={() => setCurrencyMode('USD')}
            >
              $ דולרים
            </button>
          </div>

          {/* USD Exchange Rate Setting */}
          <div style={styles.usdRateBox}>
            <span style={styles.usdRateLabel}>1$ =</span>
            {isRateEditing ? (
              <input
                type="number"
                step="0.01"
                value={usdRate}
                onChange={(e) => setUsdRate(parseFloat(e.target.value) || 3.7)}
                onBlur={() => setIsRateEditing(false)}
                autoFocus
                style={styles.usdRateInput}
              />
            ) : (
              <button
                style={styles.usdRatePill}
                onClick={() => setIsRateEditing(true)}
                title={isHe ? 'לחץ לעדכון שער הדולר' : 'Click to edit USD rate'}
              >
                <span>₪{usdRate.toFixed(2)}</span>
                <Edit2 size={11} color="var(--text-secondary)" />
              </button>
            )}
          </div>

          {/* Add New Stock / Tranche Button */}
          <button
            style={styles.addAssetBtn}
            onClick={() => handleOpenAddModal('new_asset')}
          >
            <Plus size={16} color="#FFFFFF" />
            <span>{isHe ? '+ הוסף נייר ערך' : '+ Add Asset'}</span>
          </button>
        </div>
      </div>

      {/* Aggregate Portfolio KPI Cards */}
      <div style={styles.kpiGrid}>
        {/* Card 1: Total Cost */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiTopRow}>
            <span style={styles.kpiLabel}>
              {isHe ? 'סך עלות ההשקעה' : 'Total Cost Basis'}
            </span>
            <div style={{ ...styles.kpiIconWrap, backgroundColor: '#EFF6FF' }}>
              <Coins size={18} color="#2563EB" />
            </div>
          </div>
          <div style={styles.kpiMainValue}>
            ₪{portfolioSummary.totalInvestedILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div style={styles.kpiSubText}>
            {isHe ? 'סך כל פעימות הרכישה שבוצעו' : 'Sum of all purchase tranches'}
          </div>
        </div>

        {/* Card 2: Current Portfolio Value */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiTopRow}>
            <span style={styles.kpiLabel}>
              {isHe ? 'שווי שוק נוכחי' : 'Current Market Value'}
            </span>
            <div style={{ ...styles.kpiIconWrap, backgroundColor: '#F0FDF4' }}>
              <DollarSign size={18} color="#16A34A" />
            </div>
          </div>
          <div style={{ ...styles.kpiMainValue, color: '#0F172A' }}>
            ₪{portfolioSummary.currentValueILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div style={styles.kpiSubText}>
            {isHe ? 'מבוסס על שערי השוק המעודכנים' : 'Based on latest market prices'}
          </div>
        </div>

        {/* Card 3: Total Profit & Yield */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiTopRow}>
            <span style={styles.kpiLabel}>
              {isHe ? 'רווח/הפסד כולל (P&L)' : 'Total Gain / Loss'}
            </span>
            <div
              style={{
                ...styles.kpiIconWrap,
                backgroundColor: portfolioSummary.totalProfitILS >= 0 ? '#ECFDF5' : '#FEF2F2',
              }}
            >
              {portfolioSummary.totalProfitILS >= 0 ? (
                <TrendingUp size={18} color="#059669" />
              ) : (
                <TrendingDown size={18} color="#DC2626" />
              )}
            </div>
          </div>
          <div
            style={{
              ...styles.kpiMainValue,
              color: portfolioSummary.totalProfitILS >= 0 ? '#059669' : '#DC2626',
            }}
          >
            {portfolioSummary.totalProfitILS >= 0 ? '+' : ''}
            ₪{portfolioSummary.totalProfitILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div style={styles.kpiBadgeYieldRow}>
            <span
              style={{
                ...styles.yieldPill,
                backgroundColor: portfolioSummary.totalProfitILS >= 0 ? '#DCFCE7' : '#FEE2E2',
                color: portfolioSummary.totalProfitILS >= 0 ? '#15803D' : '#B91C1C',
              }}
            >
              {portfolioSummary.totalProfitILS >= 0 ? '+' : ''}
              {portfolioSummary.totalReturnPct.toFixed(2)}%
            </span>
            <span style={styles.kpiSubText}>
              {isHe ? 'תשואה משוקללת' : 'Total Return'}
            </span>
          </div>
        </div>

        {/* Card 4: Estimated Tax (25% in Israel) */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiTopRow}>
            <span style={styles.kpiLabel}>
              {isHe ? 'מס רווחי הון משוער (25%)' : 'Est. Capital Gains Tax'}
            </span>
            <div style={{ ...styles.kpiIconWrap, backgroundColor: '#FEF3C7' }}>
              <Scale size={18} color="#D97706" />
            </div>
          </div>
          <div style={{ ...styles.kpiMainValue, color: '#B45309' }}>
            ₪{portfolioSummary.estimatedTaxILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div style={styles.kpiSubText}>
            {isHe
              ? `רווח נקי משוער לאחר מס: ₪${portfolioSummary.netProfitILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
              : `Net after tax: ₪${portfolioSummary.netProfitILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          </div>
        </div>
      </div>

      {/* Educational Formula & Tax Guidance Box */}
      <div style={styles.formulaAccordionBox}>
        <button
          style={styles.formulaAccordionHeader}
          onClick={() => setIsFormulaExpanded(!isFormulaExpanded)}
        >
          <div style={styles.formulaHeaderLeft}>
            <Info size={18} color="#2563EB" />
            <span style={styles.formulaTitle}>
              {isHe
                ? 'כיצד מחושבים הביצועים והרווח בתיק? (נוסחת פעימות, עמלות, שערי מט"ח ומס)'
                : 'How is performance calculated? (Weighted Tranches, Fees, FX & Tax)'}
            </span>
          </div>
          {isFormulaExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {isFormulaExpanded && (
          <div style={styles.formulaBody} className="animate-fade-in">
            <div style={styles.formulaGrid}>
              <div style={styles.formulaStepCard}>
                <div style={styles.stepNum}>1</div>
                <div>
                  <div style={styles.stepTitle}>
                    {isHe ? 'סך עלות ההשקעה' : 'Total Cost Basis'}
                  </div>
                  <div style={styles.stepDesc}>
                    {isHe
                      ? 'סוכמים את כל פעימות הרכישה: (כמות מניות × שער קנייה) + עמלות מסחר.'
                      : 'Sum of all tranches: (Shares × Purchase Price) + Commissions.'}
                  </div>
                </div>
              </div>

              <div style={styles.formulaStepCard}>
                <div style={styles.stepNum}>2</div>
                <div>
                  <div style={styles.stepTitle}>
                    {isHe ? 'מחיר קנייה ממוצע משוקלל' : 'Weighted Average Cost'}
                  </div>
                  <div style={styles.stepDesc}>
                    {isHe
                      ? 'מחלקים את סך עלות הרכישות בסך כל המניות שבידך.'
                      : 'Total Cost Basis divided by Total Accumulated Shares.'}
                  </div>
                </div>
              </div>

              <div style={styles.formulaStepCard}>
                <div style={styles.stepNum}>3</div>
                <div>
                  <div style={styles.stepTitle}>
                    {isHe ? 'שווי נוכחי של הפוזיציה' : 'Current Market Value'}
                  </div>
                  <div style={styles.stepDesc}>
                    {isHe
                      ? 'מכפילים את סך המניות בשער המניה הנוכחי בשוק.'
                      : 'Total Shares multiplied by current Market Price.'}
                  </div>
                </div>
              </div>

              <div style={styles.formulaStepCard}>
                <div style={styles.stepNum}>4</div>
                <div>
                  <div style={styles.stepTitle}>
                    {isHe ? 'רווח כספי ותשואה (%)' : 'P&L and Return %'}
                  </div>
                  <div style={styles.stepDesc}>
                    {isHe
                      ? 'רווח שקלי/דולרי = שווי נוכחי פחות סך ההשקעה. תשואה = (רווח / סך השקעה) × 100.'
                      : 'P&L = Current Value - Cost. Yield % = (Profit / Cost) × 100.'}
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.taxNotesBox}>
              <div style={styles.taxNotesTitle}>
                <ShieldCheck size={16} color="#059669" />
                <span>
                  {isHe
                    ? 'נקודות מרכזיות: עמלות, הפרשי שער ומס רווחי הון בישראל'
                    : 'Important: Commissions, FX Rates, and Capital Gains Tax in Israel'}
                </span>
              </div>
              <ul style={styles.taxNotesList}>
                <li>
                  <strong>{isHe ? 'עמלות קנייה ומכירה:' : 'Trading Fees:'}</strong>{' '}
                  {isHe
                    ? 'עמלות הקנייה מתווספות אוטומטית לעלות ההשקעה ומקטינות את הרווח לצורך חישוב מדויק ונטו.'
                    : 'Commissions are added directly to the cost basis, reducing real taxable gain.'}
                </li>
                <li>
                  <strong>{isHe ? 'הפרשי שערי מט"ח:' : 'Currency Exchange (FX):'}</strong>{' '}
                  {isHe
                    ? `במניות דולריות, תנודות שער החליפין (כגון שער של ₪${usdRate}) משפיעות ישירות על הרווח השקלי. ניתן לצפות בערכים בשקלים או בדולרים.`
                    : 'For USD assets, currency fluctuations directly impact ILS performance.'}
                </li>
                <li>
                  <strong>{isHe ? 'שיטת חישוב מס (FIFO מול ממוצע):' : 'Tax Methods (FIFO vs Average):'}</strong>{' '}
                  {isHe
                    ? 'בישראל, בעת מכירה חלקית, ברירת המחדל בחשבונות מסחר ישראליים היא לרוב שיטת FIFO (ראשון נכנס - ראשון נמכר), בעוד שבמערכות ניהול ביצועים משתמשים בממוצע משוקלל. מס רווחי הון עומד על 25% מהרווח הריאלי.'
                    : 'Israel applies 25% tax on real capital gains, typically calculated via FIFO or average cost.'}
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Main Assets Table */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeaderBar}>
          <div style={styles.tableTitleGroup}>
            <Layers size={18} color="#2563EB" />
            <h3 style={styles.tableTitle}>
              {isHe ? 'פירוט ניירות ערך ופוזיציות' : 'Holdings & Positions'}
            </h3>
            <span style={styles.assetCountBadge}>
              {investments.length} {isHe ? 'ניירות' : 'Assets'}
            </span>
          </div>

          <div style={styles.tableLegend}>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendDot, backgroundColor: '#059669' }} />
              {isHe ? 'רווח' : 'Gain'}
            </span>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendDot, backgroundColor: '#DC2626' }} />
              {isHe ? 'הפסד' : 'Loss'}
            </span>
          </div>
        </div>

        <div style={styles.tableResponsiveWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thRow}>
                <th style={styles.thCell}>{isHe ? 'נייר ערך / טיקר' : 'Asset / Ticker'}</th>
                <th style={styles.thCell}>{isHe ? 'סך מניות' : 'Total Shares'}</th>
                <th style={styles.thCell}>{isHe ? 'מחיר קנייה ממוצע' : 'Avg. Cost'}</th>
                <th style={styles.thCell}>{isHe ? 'שער נוכחי בשוק' : 'Market Price'}</th>
                <th style={styles.thCell}>{isHe ? 'סך השקעה' : 'Total Cost'}</th>
                <th style={styles.thCell}>{isHe ? 'שווי נוכחי' : 'Current Value'}</th>
                <th style={styles.thCell}>{isHe ? 'רווח / הפסד' : 'P&L'}</th>
                <th style={styles.thCell}>{isHe ? 'תשואה' : 'Yield'}</th>
                <th style={{ ...styles.thCell, textAlign: 'center' }}>{isHe ? 'פעימות' : 'Tranches'}</th>
                <th style={{ ...styles.thCell, textAlign: 'center' }}>{isHe ? 'פעולות' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {investments.length === 0 ? (
                <tr>
                  <td colSpan={10} style={styles.emptyTd}>
                    <div style={styles.emptyBox}>
                      <Coins size={36} color="var(--text-muted)" />
                      <div style={styles.emptyTitle}>
                        {isHe ? 'אין עדיין ניירות ערך בתיק' : 'No investment holdings yet'}
                      </div>
                      <p style={styles.emptySub}>
                        {isHe
                          ? 'לחץ על "+ הוסף נייר ערך" כדי להתחיל לעקוב אחרי המניות וקרנות הסל שלך.'
                          : 'Click "+ Add Asset" to start tracking your stocks, ETFs and tranches.'}
                      </p>
                      <button
                        style={styles.addAssetBtn}
                        onClick={() => handleOpenAddModal('new_asset')}
                      >
                        <Plus size={15} color="#FFFFFF" />
                        <span>{isHe ? 'הוסף נייר ערך ראשון' : 'Add First Asset'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                investments.map((asset) => {
                  const metrics = calculateAssetMetrics(asset);
                  const isExpanded = Boolean(expandedAssetIds[asset.id]);
                  const isProfit = metrics.profit >= 0;

                  return (
                    <React.Fragment key={asset.id}>
                      <tr
                        style={{
                          ...styles.trRow,
                          backgroundColor: isExpanded ? 'var(--bg-surface-subtle, #F8FAFC)' : 'transparent',
                        }}
                      >
                        {/* Ticker & Name */}
                        <td style={styles.tdCell}>
                          <div style={styles.assetNameBlock}>
                            <div style={styles.tickerPill}>
                              {asset.ticker}
                            </div>
                            <div>
                              <div style={styles.assetFullName}>{asset.name}</div>
                              <span style={styles.assetTypeTag}>
                                {asset.currency} • {asset.asset_type.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Total Shares */}
                        <td style={styles.tdCell}>
                          <span style={styles.boldCellText}>
                            {metrics.totalShares.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                          </span>
                        </td>

                        {/* Weighted Avg Cost */}
                        <td style={styles.tdCell}>
                          <span style={styles.cellText}>
                            {formatVal(metrics.avgPrice, asset.currency)}
                          </span>
                        </td>

                        {/* Market Price with Quick Edit */}
                        <td style={styles.tdCell}>
                          {editingPriceAssetId === asset.id ? (
                            <div style={styles.inlineEditWrap}>
                              <input
                                type="number"
                                step="any"
                                value={inlinePriceInput}
                                onChange={(e) => setInlinePriceInput(e.target.value)}
                                autoFocus
                                style={styles.inlinePriceInput}
                              />
                              <button
                                style={styles.inlineSaveBtn}
                                onClick={() => handleSaveInlinePrice(asset.id)}
                              >
                                ✓
                              </button>
                              <button
                                style={styles.inlineCancelBtn}
                                onClick={() => setEditingPriceAssetId(null)}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div style={styles.priceDisplayRow}>
                              <span style={styles.boldCellText}>
                                {formatVal(asset.current_price, asset.currency)}
                              </span>
                              <button
                                style={styles.inlineEditTriggerBtn}
                                onClick={() => {
                                  setEditingPriceAssetId(asset.id);
                                  setInlinePriceInput(asset.current_price.toString());
                                }}
                                title={isHe ? 'עדכן שער שוק נוכחי' : 'Edit current price'}
                              >
                                <Edit2 size={12} color="var(--primary)" />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Total Cost */}
                        <td style={styles.tdCell}>
                          <span style={styles.cellText}>
                            {formatVal(metrics.totalCost, asset.currency)}
                          </span>
                        </td>

                        {/* Current Value */}
                        <td style={styles.tdCell}>
                          <span style={{ ...styles.boldCellText, color: '#0F172A' }}>
                            {formatVal(metrics.currentValue, asset.currency)}
                          </span>
                        </td>

                        {/* Profit / Loss */}
                        <td style={styles.tdCell}>
                          <span
                            style={{
                              ...styles.boldCellText,
                              color: isProfit ? '#059669' : '#DC2626',
                            }}
                          >
                            {isProfit ? '+' : ''}
                            {formatVal(metrics.profit, asset.currency)}
                          </span>
                        </td>

                        {/* Yield % */}
                        <td style={styles.tdCell}>
                          <span
                            style={{
                              ...styles.yieldBadge,
                              backgroundColor: isProfit ? '#DCFCE7' : '#FEE2E2',
                              color: isProfit ? '#15803D' : '#B91C1C',
                            }}
                          >
                            {isProfit ? '+' : ''}
                            {metrics.returnPct.toFixed(2)}%
                          </span>
                        </td>

                        {/* Tranches Expand Toggle */}
                        <td style={{ ...styles.tdCell, textAlign: 'center' }}>
                          <button
                            style={{
                              ...styles.trancheExpandBtn,
                              ...(isExpanded ? styles.trancheExpandBtnActive : {}),
                            }}
                            onClick={() => toggleExpand(asset.id)}
                            title={isHe ? 'הצג/הסתר פעימות רכישה' : 'Toggle tranches'}
                          >
                            <span>{asset.tranches.length} {isHe ? 'פעימות' : 'tranches'}</span>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>

                        {/* Actions */}
                        <td style={{ ...styles.tdCell, textAlign: 'center' }}>
                          <div style={styles.actionsRow}>
                            <button
                              style={styles.addTrancheSmallBtn}
                              onClick={() => handleOpenAddModal('add_tranche', asset)}
                              title={isHe ? 'הוסף פעימת קנייה נוספת' : 'Add purchase tranche'}
                            >
                              <Plus size={13} color="var(--primary)" />
                              <span>{isHe ? 'פעימה' : 'Tranche'}</span>
                            </button>
                            <button
                              style={styles.deleteAssetBtn}
                              onClick={() => {
                                if (
                                  confirm(
                                    isHe
                                      ? `האם למחוק את ${asset.ticker} וכל פעימות הרכישה שלו?`
                                      : `Delete ${asset.ticker} and all its tranches?`
                                  )
                                ) {
                                  deleteInvestmentAsset(asset.id);
                                }
                              }}
                              title={isHe ? 'מחק נייר ערך' : 'Delete asset'}
                            >
                              <Trash2 size={14} color="#EF4444" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Tranche Drill-Down Sub-Table */}
                      {isExpanded && (
                        <tr style={styles.trancheSubTr}>
                          <td colSpan={10} style={styles.trancheSubTd}>
                            <div style={styles.trancheSubContainer} className="animate-fade-in">
                              <div style={styles.trancheSubHeader}>
                                <div style={styles.trancheSubTitle}>
                                  <Calendar size={14} color="#2563EB" />
                                  <span>
                                    {isHe
                                      ? `פירוט פעימות רכישה עבור ${asset.ticker} (${asset.name}):`
                                      : `Purchase Tranche History for ${asset.ticker}:`}
                                  </span>
                                </div>
                                <button
                                  style={styles.addTrancheSubBtn}
                                  onClick={() => handleOpenAddModal('add_tranche', asset)}
                                >
                                  <Plus size={13} color="#2563EB" />
                                  <span>{isHe ? '+ הוסף פעימה חדשה' : '+ Add Tranche'}</span>
                                </button>
                              </div>

                              <table style={styles.trancheTable}>
                                <thead>
                                  <tr style={styles.trancheThRow}>
                                    <th style={styles.trancheTh}>#</th>
                                    <th style={styles.trancheTh}>{isHe ? 'תאריך רכישה' : 'Date'}</th>
                                    <th style={styles.trancheTh}>{isHe ? 'כמות מניות' : 'Shares'}</th>
                                    <th style={styles.trancheTh}>{isHe ? 'שער קנייה' : 'Price / Share'}</th>
                                    <th style={styles.trancheTh}>{isHe ? 'עמלה' : 'Trading Fee'}</th>
                                    <th style={styles.trancheTh}>{isHe ? 'סך עלות פעימה' : 'Tranche Cost'}</th>
                                    <th style={styles.trancheTh}>{isHe ? 'שווי נוכחי' : 'Current Value'}</th>
                                    <th style={styles.trancheTh}>{isHe ? 'רווח/הפסד פעימה' : 'Tranche P&L'}</th>
                                    <th style={styles.trancheTh}>{isHe ? 'תשואה' : 'Yield'}</th>
                                    <th style={styles.trancheTh}>{isHe ? 'הערות' : 'Notes'}</th>
                                    <th style={{ ...styles.trancheTh, textAlign: 'center' }}>
                                      {isHe ? 'מחק' : 'Delete'}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {asset.tranches.map((tr, idx) => {
                                    const trCost = tr.shares * tr.price_per_share + (tr.fee || 0);
                                    const trVal = tr.shares * asset.current_price;
                                    const trProfit = trVal - trCost;
                                    const trYield = trCost > 0 ? (trProfit / trCost) * 100 : 0;
                                    const isTrProfit = trProfit >= 0;

                                    return (
                                      <tr key={tr.id} style={styles.trancheTr}>
                                        <td style={styles.trancheTd}>
                                          <span style={styles.trancheIndexPill}>
                                            {idx + 1}
                                          </span>
                                        </td>
                                        <td style={styles.trancheTd}>{tr.date}</td>
                                        <td style={styles.trancheTd}>
                                          <strong>{tr.shares}</strong>
                                        </td>
                                        <td style={styles.trancheTd}>
                                          {formatVal(tr.price_per_share, asset.currency)}
                                        </td>
                                        <td style={styles.trancheTd}>
                                          {tr.fee ? formatVal(tr.fee, asset.currency) : '—'}
                                        </td>
                                        <td style={styles.trancheTd}>
                                          <strong>{formatVal(trCost, asset.currency)}</strong>
                                        </td>
                                        <td style={styles.trancheTd}>
                                          {formatVal(trVal, asset.currency)}
                                        </td>
                                        <td style={styles.trancheTd}>
                                          <span
                                            style={{
                                              color: isTrProfit ? '#059669' : '#DC2626',
                                              fontWeight: '700',
                                            }}
                                          >
                                            {isTrProfit ? '+' : ''}
                                            {formatVal(trProfit, asset.currency)}
                                          </span>
                                        </td>
                                        <td style={styles.trancheTd}>
                                          <span
                                            style={{
                                              ...styles.yieldPillSmall,
                                              backgroundColor: isTrProfit ? '#DCFCE7' : '#FEE2E2',
                                              color: isTrProfit ? '#15803D' : '#B91C1C',
                                            }}
                                          >
                                            {isTrProfit ? '+' : ''}
                                            {trYield.toFixed(2)}%
                                          </span>
                                        </td>
                                        <td style={styles.trancheTd}>
                                          <span style={styles.notesText}>{tr.notes || '—'}</span>
                                        </td>
                                        <td style={{ ...styles.trancheTd, textAlign: 'center' }}>
                                          <button
                                            style={styles.deleteTrancheBtn}
                                            onClick={() => {
                                              if (
                                                confirm(
                                                  isHe
                                                    ? 'האם למחוק פעימת רכישה זו?'
                                                    : 'Delete this purchase tranche?'
                                                )
                                              ) {
                                                deleteInvestmentTranche(asset.id, tr.id);
                                              }
                                            }}
                                            title={isHe ? 'מחק פעימה' : 'Delete tranche'}
                                          >
                                            <Trash2 size={13} color="#EF4444" />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Asset or Tranche */}
      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard} className="animate-fade-in">
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleRow}>
                <Coins size={20} color="#2563EB" />
                <h3 style={styles.modalTitle}>
                  {modalMode === 'new_asset'
                    ? isHe
                      ? 'הוספת נייר ערך חדש ופעימת רכישה'
                      : 'Add New Investment & First Tranche'
                    : isHe
                    ? `הוספת פעימת רכישה ל-${formTicker}`
                    : `Add Purchase Tranche to ${formTicker}`}
                </h3>
              </div>
              <button
                style={styles.modalCloseBtn}
                onClick={() => setIsModalOpen(false)}
              >
                <X size={18} color="var(--text-secondary)" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} style={styles.modalForm}>
              {modalMode === 'new_asset' && (
                <>
                  <div style={styles.formRow2}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        {isHe ? 'טיקר / סימול (Ticker) *' : 'Ticker Symbol *'}
                      </label>
                      <input
                        style={styles.formInput}
                        type="text"
                        placeholder="e.g. AAPL, VOO, TA125"
                        value={formTicker}
                        onChange={(e) => setFormTicker(e.target.value)}
                        required
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        {isHe ? 'שם החברה / הנייר' : 'Asset Name'}
                      </label>
                      <input
                        style={styles.formInput}
                        type="text"
                        placeholder="e.g. Apple Inc., מדד ת״א 125"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={styles.formRow2}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        {isHe ? 'מטבע הנייר' : 'Currency'}
                      </label>
                      <select
                        style={styles.formSelect}
                        value={formCurrency}
                        onChange={(e) => setFormCurrency(e.target.value as any)}
                      >
                        <option value="USD">USD ($) - דולר ארה״ב</option>
                        <option value="ILS">ILS (₪) - שקל ישראלי</option>
                      </select>
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        {isHe ? 'סוג הנכס' : 'Asset Type'}
                      </label>
                      <select
                        style={styles.formSelect}
                        value={formAssetType}
                        onChange={(e) => setFormAssetType(e.target.value as any)}
                      >
                        <option value="stock">{isHe ? 'מניה (Stock)' : 'Stock'}</option>
                        <option value="etf">{isHe ? 'קרן סל מחקה (ETF)' : 'ETF'}</option>
                        <option value="mutual_fund">{isHe ? 'קרן נאמנות' : 'Mutual Fund'}</option>
                        <option value="bond">{isHe ? 'אג״ח (Bond)' : 'Bond'}</option>
                        <option value="crypto">{isHe ? 'קריפטו (Crypto)' : 'Crypto'}</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Tranche Details */}
              <div style={styles.sectionDivider}>
                <span>{isHe ? 'פרטי פעימת הרכישה' : 'Purchase Tranche Details'}</span>
              </div>

              <div style={styles.formRow3}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    {isHe ? 'תאריך קנייה *' : 'Purchase Date *'}
                  </label>
                  <input
                    style={styles.formInput}
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    {isHe ? 'כמות מניות *' : 'Shares Count *'}
                  </label>
                  <input
                    style={styles.formInput}
                    type="number"
                    step="any"
                    placeholder="e.g. 10"
                    value={formShares}
                    onChange={(e) => setFormShares(e.target.value)}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    {isHe
                      ? `מחיר קנייה למניה (${formCurrency === 'USD' ? '$' : '₪'}) *`
                      : `Price per Share (${formCurrency === 'USD' ? '$' : '₪'}) *`}
                  </label>
                  <input
                    style={styles.formInput}
                    type="number"
                    step="any"
                    placeholder="e.g. 100"
                    value={formPricePerShare}
                    onChange={(e) => setFormPricePerShare(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={styles.formRow2}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    {isHe
                      ? `שער מניה נוכחי בשוק (${formCurrency === 'USD' ? '$' : '₪'})`
                      : `Current Market Price (${formCurrency === 'USD' ? '$' : '₪'})`}
                  </label>
                  <input
                    style={styles.formInput}
                    type="number"
                    step="any"
                    placeholder="e.g. 130"
                    value={formCurrentPrice}
                    onChange={(e) => setFormCurrentPrice(e.target.value)}
                  />
                  <span style={styles.inputHelper}>
                    {isHe ? 'אם לא הוזן, ייקבע לפי שער הקנייה' : 'Defaults to purchase price if empty'}
                  </span>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    {isHe
                      ? `עמלת קנייה (${formCurrency === 'USD' ? '$' : '₪'})`
                      : `Trading Fee (${formCurrency === 'USD' ? '$' : '₪'})`}
                  </label>
                  <input
                    style={styles.formInput}
                    type="number"
                    step="any"
                    placeholder="0"
                    value={formFee}
                    onChange={(e) => setFormFee(e.target.value)}
                  />
                  <span style={styles.inputHelper}>
                    {isHe ? 'תווסף לעלות הרכישה להקטנת המס' : 'Added to cost basis'}
                  </span>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>
                  {isHe ? 'הערות לפעימה (אופציונלי)' : 'Notes / Remarks (Optional)'}
                </label>
                <input
                  style={styles.formInput}
                  type="text"
                  placeholder="e.g. קנייה בפעימה חודשית"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>

              {/* Dynamic Live Calculation Preview */}
              {parseFloat(formShares) > 0 && parseFloat(formPricePerShare) > 0 && (
                <div style={styles.liveCalculationBox}>
                  <div style={styles.calcPreviewTitle}>
                    <Sparkles size={14} color="#2563EB" />
                    <span>{isHe ? 'סיכום פעימה זו:' : 'Tranche Calculation Preview:'}</span>
                  </div>
                  <div style={styles.calcPreviewRow}>
                    <span>
                      {isHe ? 'עלות רכישה כוללת:' : 'Total Cost:'}{' '}
                      <strong>
                        {formCurrency === 'USD' ? '$' : '₪'}
                        {(
                          parseFloat(formShares) * parseFloat(formPricePerShare) +
                          (parseFloat(formFee) || 0)
                        ).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </strong>
                    </span>
                    {parseFloat(formCurrentPrice) > 0 && (
                      <span>
                        {isHe ? 'רווח נוכחי לפעימה:' : 'Current Tranche Gain:'}{' '}
                        <strong
                          style={{
                            color:
                              parseFloat(formCurrentPrice) >= parseFloat(formPricePerShare)
                                ? '#059669'
                                : '#DC2626',
                          }}
                        >
                          {formCurrency === 'USD' ? '$' : '₪'}
                          {(
                            parseFloat(formShares) * parseFloat(formCurrentPrice) -
                            (parseFloat(formShares) * parseFloat(formPricePerShare) +
                              (parseFloat(formFee) || 0))
                          ).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Form Action Buttons */}
              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.modalCancelBtn}
                  onClick={() => setIsModalOpen(false)}
                >
                  {isHe ? 'ביטול' : 'Cancel'}
                </button>
                <button type="submit" style={styles.modalSubmitBtn}>
                  {modalMode === 'new_asset'
                    ? isHe
                      ? 'צור נייר ערך ופעימה ראשונה'
                      : 'Create Asset & First Tranche'
                    : isHe
                    ? 'הוסף פעימת רכישה'
                    : 'Add Purchase Tranche'}
                </button>
              </div>
            </form>
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
    gap: '24px',
    paddingBottom: '40px',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '16px',
  },
  badgeRow: {
    marginBottom: '6px',
  },
  topicBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    backgroundColor: '#EFF6FF',
    borderRadius: '16px',
    border: '1px solid #BFDBFE',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#1D4ED8',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: '800',
    color: 'var(--text-primary, #0F172A)',
    letterSpacing: '-0.02em',
    marginBottom: '6px',
  },
  subtitle: {
    fontSize: '0.9375rem',
    color: 'var(--text-secondary, #64748B)',
    maxWidth: '700px',
    lineHeight: '1.5',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  currencyToggleGroup: {
    display: 'flex',
    backgroundColor: 'var(--bg-surface-subtle, #F1F5F9)',
    padding: '3px',
    borderRadius: '10px',
    border: '1px solid var(--border-main, #E2E8F0)',
  },
  toggleBtn: {
    padding: '6px 12px',
    borderRadius: '7px',
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary, #64748B)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    color: 'var(--primary, #2563EB)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
  },
  usdRateBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#FFFFFF',
    padding: '5px 10px',
    borderRadius: '10px',
    border: '1px solid var(--border-main, #E2E8F0)',
    fontSize: '0.8125rem',
  },
  usdRateLabel: {
    fontWeight: '700',
    color: 'var(--text-secondary, #64748B)',
  },
  usdRatePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '700',
    color: '#0F172A',
  },
  usdRateInput: {
    width: '60px',
    padding: '2px 4px',
    borderRadius: '4px',
    border: '1px solid var(--primary, #2563EB)',
    fontSize: '0.8125rem',
    fontWeight: '700',
    textAlign: 'center',
  },
  addAssetBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 16px',
    backgroundColor: 'var(--primary, #2563EB)',
    color: '#FFFFFF',
    borderRadius: '10px',
    border: 'none',
    fontSize: '0.875rem',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
    transition: 'background-color 0.15s ease',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
  },
  kpiCard: {
    backgroundColor: '#FFFFFF',
    padding: '20px',
    borderRadius: '16px',
    border: '1px solid var(--border-main, #E2E8F0)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  kpiTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  kpiLabel: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-secondary, #64748B)',
  },
  kpiIconWrap: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiMainValue: {
    fontSize: '1.625rem',
    fontWeight: '800',
    color: 'var(--text-primary, #0F172A)',
    letterSpacing: '-0.02em',
    marginBottom: '6px',
  },
  kpiSubText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted, #94A3B8)',
  },
  kpiBadgeYieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  yieldPill: {
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '800',
  },
  formulaAccordionBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid var(--border-main, #E2E8F0)',
    overflow: 'hidden',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
  },
  formulaAccordionHeader: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'inherit',
  },
  formulaHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  formulaTitle: {
    fontSize: '0.9375rem',
    fontWeight: '700',
    color: 'var(--text-primary, #0F172A)',
  },
  formulaBody: {
    padding: '0 20px 20px',
    borderTop: '1px solid #F1F5F9',
  },
  formulaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
    marginTop: '16px',
  },
  formulaStepCard: {
    display: 'flex',
    gap: '12px',
    backgroundColor: 'var(--bg-surface-subtle, #F8FAFC)',
    padding: '14px',
    borderRadius: '12px',
    border: '1px solid var(--border-main, #E2E8F0)',
  },
  stepNum: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8125rem',
    fontWeight: '800',
    flexShrink: 0,
  },
  stepTitle: {
    fontSize: '0.875rem',
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: '4px',
  },
  stepDesc: {
    fontSize: '0.75rem',
    color: '#64748B',
    lineHeight: '1.45',
  },
  taxNotesBox: {
    marginTop: '18px',
    padding: '14px 18px',
    backgroundColor: '#F0FDF4',
    borderRadius: '12px',
    border: '1px solid #BBF7D0',
  },
  taxNotesTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.875rem',
    fontWeight: '800',
    color: '#166534',
    marginBottom: '8px',
  },
  taxNotesList: {
    margin: 0,
    paddingLeft: '20px',
    paddingRight: '20px',
    fontSize: '0.8125rem',
    color: '#1E293B',
    lineHeight: '1.6',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid var(--border-main, #E2E8F0)',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
  },
  tableHeaderBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 24px',
    borderBottom: '1px solid var(--border-main, #E2E8F0)',
  },
  tableTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  tableTitle: {
    fontSize: '1.0625rem',
    fontWeight: '800',
    color: '#0F172A',
    margin: 0,
  },
  assetCountBadge: {
    padding: '2px 8px',
    borderRadius: '12px',
    backgroundColor: '#EFF6FF',
    color: '#2563EB',
    fontSize: '0.75rem',
    fontWeight: '700',
  },
  tableLegend: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    fontSize: '0.75rem',
    color: 'var(--text-secondary, #64748B)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  tableResponsiveWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'inherit',
  },
  thRow: {
    backgroundColor: 'var(--bg-surface-subtle, #F8FAFC)',
    borderBottom: '1px solid var(--border-main, #E2E8F0)',
  },
  thCell: {
    padding: '12px 16px',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-secondary, #64748B)',
    whiteSpace: 'nowrap',
  },
  trRow: {
    borderBottom: '1px solid var(--border-main, #E2E8F0)',
    transition: 'background-color 0.15s ease',
  },
  tdCell: {
    padding: '14px 16px',
    fontSize: '0.875rem',
    verticalAlign: 'middle',
  },
  assetNameBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  tickerPill: {
    padding: '4px 8px',
    backgroundColor: '#F1F5F9',
    borderRadius: '8px',
    fontWeight: '800',
    fontSize: '0.8125rem',
    color: '#0F172A',
    letterSpacing: '0.02em',
    border: '1px solid #CBD5E1',
  },
  assetFullName: {
    fontWeight: '700',
    color: '#0F172A',
  },
  assetTypeTag: {
    fontSize: '0.6875rem',
    color: '#64748B',
  },
  boldCellText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  cellText: {
    color: '#334155',
  },
  priceDisplayRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  inlineEditTriggerBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '3px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineEditWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  inlinePriceInput: {
    width: '75px',
    padding: '4px 6px',
    borderRadius: '6px',
    border: '1px solid var(--primary, #2563EB)',
    fontSize: '0.8125rem',
    fontWeight: '700',
  },
  inlineSaveBtn: {
    padding: '4px 6px',
    backgroundColor: '#059669',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: '700',
  },
  inlineCancelBtn: {
    padding: '4px 6px',
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.75rem',
  },
  yieldBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '6px',
    fontWeight: '800',
    fontSize: '0.75rem',
  },
  trancheExpandBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 10px',
    backgroundColor: '#F1F5F9',
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#334155',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  trancheExpandBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
    color: '#2563EB',
  },
  actionsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  addTrancheSmallBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    padding: '4px 8px',
    backgroundColor: '#EFF6FF',
    border: '1px solid #BFDBFE',
    borderRadius: '6px',
    color: '#2563EB',
    fontSize: '0.6875rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
  deleteAssetBtn: {
    padding: '5px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trancheSubTr: {
    backgroundColor: '#F8FAFC',
    borderBottom: '2px solid #CBD5E1',
  },
  trancheSubTd: {
    padding: '12px 20px 20px',
  },
  trancheSubContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    border: '1px solid #E2E8F0',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
  },
  trancheSubHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  trancheSubTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.875rem',
    fontWeight: '800',
    color: '#1E293B',
  },
  addTrancheSubBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 10px',
    backgroundColor: '#EFF6FF',
    border: '1px solid #BFDBFE',
    borderRadius: '6px',
    color: '#2563EB',
    fontSize: '0.75rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
  trancheTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.8125rem',
  },
  trancheThRow: {
    backgroundColor: '#F1F5F9',
    borderBottom: '1px solid #CBD5E1',
  },
  trancheTh: {
    padding: '8px 10px',
    fontSize: '0.6875rem',
    fontWeight: '700',
    color: '#475569',
    textAlign: 'inherit',
  },
  trancheTr: {
    borderBottom: '1px solid #F1F5F9',
  },
  trancheTd: {
    padding: '10px',
    color: '#1E293B',
  },
  trancheIndexPill: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.6875rem',
    fontWeight: '800',
    color: '#475569',
  },
  yieldPillSmall: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '0.6875rem',
    fontWeight: '800',
  },
  notesText: {
    fontSize: '0.75rem',
    color: '#64748B',
    fontStyle: 'italic',
  },
  deleteTrancheBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
  },
  emptyTd: {
    padding: '40px 20px',
    textAlign: 'center',
  },
  emptyBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    maxWidth: '400px',
    margin: '0 auto',
  },
  emptyTitle: {
    fontSize: '1.125rem',
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySub: {
    fontSize: '0.875rem',
    color: '#64748B',
    margin: 0,
    lineHeight: '1.5',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 9999,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '20px',
    border: '1px solid #E2E8F0',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '24px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '14px',
    borderBottom: '1px solid #F1F5F9',
  },
  modalTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  modalTitle: {
    fontSize: '1.125rem',
    fontWeight: '800',
    color: '#0F172A',
    margin: 0,
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '6px',
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formRow2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  formRow3: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '12px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    textAlign: 'inherit',
  },
  formLabel: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: '#334155',
  },
  formInput: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #CBD5E1',
    fontSize: '0.875rem',
    outline: 'none',
  },
  formSelect: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #CBD5E1',
    fontSize: '0.875rem',
    backgroundColor: '#FFFFFF',
    outline: 'none',
  },
  inputHelper: {
    fontSize: '0.6875rem',
    color: '#64748B',
  },
  sectionDivider: {
    display: 'flex',
    alignItems: 'center',
    margin: '8px 0',
    fontSize: '0.8125rem',
    fontWeight: '800',
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
    padding: '6px 12px',
    borderRadius: '8px',
  },
  liveCalculationBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: '10px',
    border: '1px dashed #93C5FD',
    padding: '12px',
  },
  calcPreviewTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.75rem',
    fontWeight: '800',
    color: '#1E40AF',
    marginBottom: '6px',
  },
  calcPreviewRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8125rem',
    color: '#334155',
    flexWrap: 'wrap',
    gap: '8px',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '10px',
    paddingTop: '16px',
    borderTop: '1px solid #F1F5F9',
  },
  modalCancelBtn: {
    padding: '10px 16px',
    backgroundColor: '#F1F5F9',
    color: '#475569',
    borderRadius: '10px',
    border: 'none',
    fontWeight: '700',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  modalSubmitBtn: {
    padding: '10px 20px',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    borderRadius: '10px',
    border: 'none',
    fontWeight: '700',
    fontSize: '0.875rem',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
  },
};
