import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Database,
  TrendingUp,
  Receipt,
  PiggyBank,
  Sparkles,
  Calendar,
  Layers,
  Search,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  parseHistoricalYearlyExcel,
  ParsedHistoricalYearlySummary,
} from '../../lib/services/historicalExcelParser';
import {
  transformHistoricalDataToCanonical,
  executeHistoricalMigration,
  MigrationOptions,
  MigrationResult,
} from '../../lib/services/historicalMigrationService';

export const HistoricalMigrationScreen: React.FC = () => {
  const {
    activeHousehold,
    categories,
    isDemoMode,
    addBatchTransactions,
    setActiveTab,
  } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedHistoricalYearlySummary | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Active Preview Tab
  const [activePreviewTab, setActivePreviewTab] = useState<'itemized' | 'income' | 'matrix' | 'savings'>('itemized');
  const [searchQuery, setSearchQuery] = useState('');

  // Options
  const [options, setOptions] = useState<MigrationOptions>({
    includeItemizedTransactions: true,
    includeIncomeRows: true,
    includeSavingsBaselines: true,
    useAggregatedExpensesIfNoItemized: true,
  });

  // Migration Execution State
  const [isMigrating, setIsMigrating] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);

  const currencySymbol = activeHousehold?.currency === 'ILS' ? '₪' : activeHousehold?.currency || '$';

  // Handle File Upload
  const handleFileUpload = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    setParsedData(null);
    setMigrationResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const summary = parseHistoricalYearlyExcel(buffer, file.name);

      if (summary.itemizedTransactions.length === 0 && summary.incomeRows.length === 0 && summary.expenseMatrix.length === 0) {
        throw new Error('No compatible historical sheets (הכנסות, הוצאות, or 1-12) could be found in this workbook.');
      }

      setParsedData(summary);
    } catch (err: any) {
      console.error('Historical parse error:', err);
      setParseError(err?.message || 'Failed to parse Excel file. Please ensure it has the expected yearly sheets.');
    } finally {
      setIsParsing(false);
    }
  };

  // Trigger File Input
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Run Migration
  const handleRunMigration = async () => {
    if (!parsedData || !activeHousehold) return;

    setIsMigrating(true);
    setProgressPct(0);
    setProgressStatus('Transforming records into canonical format...');

    try {
      const canonicalData = transformHistoricalDataToCanonical(
        parsedData,
        activeHousehold.id,
        categories,
        options
      );

      const result = await executeHistoricalMigration(
        canonicalData,
        activeHousehold.id,
        isDemoMode,
        (pct, status) => {
          setProgressPct(pct);
          setProgressStatus(status);
        }
      );

      if (result.success) {
        addBatchTransactions(canonicalData.transactions);
      }

      setMigrationResult(result);
    } catch (err: any) {
      setMigrationResult({
        success: false,
        transactionsInserted: 0,
        incomeInserted: 0,
        savingsInserted: 0,
        categoriesCreated: 0,
        error: err?.message || 'Migration execution failed.',
      });
    } finally {
      setIsMigrating(false);
    }
  };

  // Filtered Itemized Transactions
  const filteredItemized = (parsedData?.itemizedTransactions || []).filter((tx) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      tx.payee.toLowerCase().includes(q) ||
      tx.categoryName.toLowerCase().includes(q) ||
      (tx.notes && tx.notes.toLowerCase().includes(q)) ||
      tx.date.includes(q)
    );
  });

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.headerRow}>
        <div>
          <div style={styles.badge}>
            <Database size={12} color="var(--primary)" />
            <span>Admin Migration Hub</span>
          </div>
          <h1 style={styles.pageTitle}>Historical Yearly Summary Ingestion</h1>
          <p style={styles.pageSubtitle}>
            Ingest complete historical multi-sheet spreadsheets (such as <code>סיכום הכנסות הוצאות - 2026.xlsx</code>) directly into Supabase.
          </p>
        </div>

        {parsedData && (
          <button
            style={styles.resetBtn}
            onClick={() => {
              setParsedData(null);
              setMigrationResult(null);
            }}
          >
            Upload Another Year
          </button>
        )}
      </div>

      {/* Upload Zone */}
      {!parsedData && (
        <div
          style={styles.dropZone}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".xlsx, .xls"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />

          <div style={styles.uploadIconWrap}>
            <UploadCloud size={36} color="var(--primary)" />
          </div>

          <h3 style={styles.dropTitle}>
            {isParsing ? 'Parsing Historical Workbook...' : 'Select or Drop Yearly Excel Summary'}
          </h3>
          <p style={styles.dropSub}>
            Supports multi-sheet workbooks with <code>הכנסות</code>, <code>הוצאות</code>, and monthly sheets <code>1</code> to <code>12</code>.
          </p>

          <button
            type="button"
            style={styles.browseBtn}
            disabled={isParsing}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            <FileSpreadsheet size={16} />
            <span>Browse Excel File</span>
          </button>
        </div>
      )}

      {/* Parsing Error */}
      {parseError && (
        <div style={styles.errorBanner}>
          <AlertCircle size={20} color="var(--danger)" />
          <span>{parseError}</span>
        </div>
      )}

      {/* Parsed Preview Section */}
      {parsedData && !migrationResult?.success && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Overview KPI Summary Cards */}
          <div style={styles.kpiGrid}>
            <div style={styles.kpiCard}>
              <div style={styles.kpiTop}>
                <span style={styles.kpiLabel}>Detected Year</span>
                <Calendar size={18} color="var(--primary)" />
              </div>
              <div style={styles.kpiValue}>{parsedData.year}</div>
              <div style={styles.kpiSub}>From {parsedData.fileName}</div>
            </div>

            <div style={styles.kpiCard}>
              <div style={styles.kpiTop}>
                <span style={styles.kpiLabel}>Itemized Transactions</span>
                <Receipt size={18} color="var(--primary)" />
              </div>
              <div style={styles.kpiValue}>
                {parsedData.itemizedTransactions.length.toLocaleString()}
              </div>
              <div style={styles.kpiSub}>
                Total: {currencySymbol} {parsedData.totalItemizedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div style={styles.kpiCard}>
              <div style={styles.kpiTop}>
                <span style={styles.kpiLabel}>Income Stream</span>
                <TrendingUp size={18} color="var(--success-text)" />
              </div>
              <div style={{ ...styles.kpiValue, color: 'var(--success-text)' }}>
                {currencySymbol} {parsedData.totalIncomeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div style={styles.kpiSub}>{parsedData.incomeRows.length} Monthly entries</div>
            </div>

            <div style={styles.kpiCard}>
              <div style={styles.kpiTop}>
                <span style={styles.kpiLabel}>Savings Baseline</span>
                <PiggyBank size={18} color="#8B5CF6" />
              </div>
              <div style={{ ...styles.kpiValue, color: '#8B5CF6' }}>
                {parsedData.savingsAccounts.length} Accounts
              </div>
              <div style={styles.kpiSub}>Opening & closing net balances</div>
            </div>
          </div>

          {/* Migration Execution Card */}
          <div style={styles.executionCard}>
            <div style={styles.executionHeader}>
              <div>
                <h3 style={styles.executionTitle}>Migration Options & Configuration</h3>
                <p style={styles.executionSub}>
                  Target Household: <strong>{activeHousehold?.name}</strong> ({activeHousehold?.currency})
                </p>
              </div>

              <button
                style={styles.runMigrationBtn}
                disabled={isMigrating}
                onClick={handleRunMigration}
              >
                <Sparkles size={16} />
                <span>{isMigrating ? 'Migrating Data...' : 'Execute Historical Migration'}</span>
              </button>
            </div>

            {/* Migration Checkbox Options */}
            <div style={styles.optionsRow}>
              <label style={styles.optionLabel}>
                <input
                  type="checkbox"
                  checked={options.includeItemizedTransactions}
                  onChange={(e) => setOptions({ ...options, includeItemizedTransactions: e.target.checked })}
                />
                <span>Ingest Granular Transactions (Sheets 1-12) ({parsedData.itemizedTransactions.length} rows)</span>
              </label>

              <label style={styles.optionLabel}>
                <input
                  type="checkbox"
                  checked={options.includeIncomeRows}
                  onChange={(e) => setOptions({ ...options, includeIncomeRows: e.target.checked })}
                />
                <span>Ingest Monthly Income Streams ({parsedData.incomeRows.length} entries)</span>
              </label>

              <label style={styles.optionLabel}>
                <input
                  type="checkbox"
                  checked={options.includeSavingsBaselines}
                  onChange={(e) => setOptions({ ...options, includeSavingsBaselines: e.target.checked })}
                />
                <span>Ingest Savings Baseline Accounts ({parsedData.savingsAccounts.length} accounts)</span>
              </label>
            </div>

            {/* Progress Bar */}
            {isMigrating && (
              <div style={styles.progressContainer}>
                <div style={styles.progressBarWrap}>
                  <div style={{ ...styles.progressBarFill, width: `${progressPct}%` }} />
                </div>
                <div style={styles.progressStatusText}>
                  <span>{progressStatus}</span>
                  <span style={{ fontWeight: '700' }}>{progressPct}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Tabbed Preview Area */}
          <div style={styles.previewContainer}>
            {/* Tab Buttons */}
            <div style={styles.tabsHeader}>
              <button
                style={{
                  ...styles.tabBtn,
                  ...(activePreviewTab === 'itemized' ? styles.tabBtnActive : {}),
                }}
                onClick={() => setActivePreviewTab('itemized')}
              >
                <Receipt size={15} />
                <span>Itemized Transactions ({parsedData.itemizedTransactions.length})</span>
              </button>

              <button
                style={{
                  ...styles.tabBtn,
                  ...(activePreviewTab === 'income' ? styles.tabBtnActive : {}),
                }}
                onClick={() => setActivePreviewTab('income')}
              >
                <TrendingUp size={15} />
                <span>Income Streams ({parsedData.incomeRows.length})</span>
              </button>

              <button
                style={{
                  ...styles.tabBtn,
                  ...(activePreviewTab === 'matrix' ? styles.tabBtnActive : {}),
                }}
                onClick={() => setActivePreviewTab('matrix')}
              >
                <Layers size={15} />
                <span>Expense Matrix ({parsedData.expenseMatrix.length})</span>
              </button>

              <button
                style={{
                  ...styles.tabBtn,
                  ...(activePreviewTab === 'savings' ? styles.tabBtnActive : {}),
                }}
                onClick={() => setActivePreviewTab('savings')}
              >
                <PiggyBank size={15} />
                <span>Savings Accounts ({parsedData.savingsAccounts.length})</span>
              </button>
            </div>

            {/* Tab 1: Itemized Transactions */}
            {activePreviewTab === 'itemized' && (
              <div>
                <div style={styles.searchBarRow}>
                  <div style={styles.searchWrap}>
                    <Search size={16} color="var(--text-muted)" />
                    <input
                      style={styles.searchInput}
                      type="text"
                      placeholder="Search transactions by merchant, category, or date..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div style={styles.countTag}>
                    Showing {filteredItemized.length} of {parsedData.itemizedTransactions.length}
                  </div>
                </div>

                <div style={styles.previewTableWrap}>
                  <div style={styles.previewTableHeader}>
                    <div style={{ flex: 1 }}>Month</div>
                    <div style={{ flex: 1.2 }}>Date</div>
                    <div style={{ flex: 3 }}>Payee / Merchant</div>
                    <div style={{ flex: 2 }}>Category</div>
                    <div style={{ flex: 1.5 }}>Card / Digits</div>
                    <div style={{ flex: 1.5, textAlign: 'right' }}>Amount</div>
                  </div>

                  {filteredItemized.slice(0, 100).map((tx, idx) => (
                    <div key={idx} style={styles.previewTableRow}>
                      <div style={{ flex: 1 }}>
                        <span style={styles.monthBadge}>Month {tx.monthIndex}</span>
                      </div>
                      <div style={{ flex: 1.2, color: 'var(--text-secondary)' }}>{tx.date}</div>
                      <div style={{ flex: 3, fontWeight: '600' }}>{tx.payee}</div>
                      <div style={{ flex: 2 }}>
                        <span style={styles.categoryPill}>{tx.categoryName}</span>
                      </div>
                      <div style={{ flex: 1.5, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {tx.cardLastDigits ? `*${tx.cardLastDigits}` : tx.cardName || '-'}
                      </div>
                      <div style={{ flex: 1.5, textAlign: 'right', fontWeight: '700' }}>
                        {currencySymbol} {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}

                  {filteredItemized.length > 100 && (
                    <div style={styles.moreRowsNote}>
                      Showing first 100 records of {filteredItemized.length}. All {filteredItemized.length} will be migrated upon execution.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Income Streams */}
            {activePreviewTab === 'income' && (
              <div style={styles.previewTableWrap}>
                <div style={styles.previewTableHeader}>
                  <div style={{ flex: 1.5 }}>Month</div>
                  <div style={{ flex: 3 }}>Income Source</div>
                  <div style={{ flex: 2, textAlign: 'right' }}>Monthly Inflow</div>
                </div>
                {parsedData.incomeRows.map((inc, idx) => (
                  <div key={idx} style={styles.previewTableRow}>
                    <div style={{ flex: 1.5, fontWeight: '600' }}>
                      {inc.monthName} (Month {inc.monthIndex})
                    </div>
                    <div style={{ flex: 3 }}>{inc.sourceName}</div>
                    <div style={{ flex: 2, textAlign: 'right', fontWeight: '700', color: 'var(--success-text)' }}>
                      + {currencySymbol} {inc.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 3: Aggregated Expense Matrix */}
            {activePreviewTab === 'matrix' && (
              <div style={styles.previewTableWrap}>
                <div style={styles.previewTableHeader}>
                  <div style={{ flex: 3 }}>Category</div>
                  <div style={{ flex: 1.5, textAlign: 'right' }}>Yearly Total</div>
                  <div style={{ flex: 2, textAlign: 'right' }}>Active Months</div>
                </div>
                {parsedData.expenseMatrix.map((mat, idx) => (
                  <div key={idx} style={styles.previewTableRow}>
                    <div style={{ flex: 3, fontWeight: '600' }}>{mat.categoryName}</div>
                    <div style={{ flex: 1.5, textAlign: 'right', fontWeight: '700' }}>
                      {currencySymbol} {mat.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ flex: 2, textAlign: 'right', color: 'var(--text-muted)' }}>
                      {Object.keys(mat.monthlyAmounts).length} months
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 4: Savings Accounts */}
            {activePreviewTab === 'savings' && (
              <div style={styles.previewTableWrap}>
                <div style={styles.previewTableHeader}>
                  <div style={{ flex: 3 }}>Account Name</div>
                  <div style={{ flex: 2, textAlign: 'right' }}>Opening Balance (01.01)</div>
                  <div style={{ flex: 2, textAlign: 'right' }}>Closing Balance (31.12)</div>
                  <div style={{ flex: 1.5, textAlign: 'right' }}>Year</div>
                </div>
                {parsedData.savingsAccounts.map((acc, idx) => (
                  <div key={idx} style={styles.previewTableRow}>
                    <div style={{ flex: 3, fontWeight: '600' }}>{acc.accountName}</div>
                    <div style={{ flex: 2, textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>
                      {currencySymbol} {acc.openingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ flex: 2, textAlign: 'right', fontWeight: '700', color: '#8B5CF6' }}>
                      {currencySymbol} {acc.closingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ flex: 1.5, textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {acc.year}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Migration Success Modal */}
      {migrationResult?.success && (
        <div style={styles.successCard}>
          <div style={styles.successIconWrap}>
            <CheckCircle2 size={44} color="var(--success-text)" />
          </div>
          <h2 style={styles.successTitle}>Historical Data Migration Completed!</h2>
          <p style={styles.successSubtitle}>
            The records from <strong>{parsedData?.fileName}</strong> were successfully written to your canonical database.
          </p>

          <div style={styles.resultStatsGrid}>
            <div style={styles.statBox}>
              <div style={styles.statNum}>{migrationResult.transactionsInserted}</div>
              <div style={styles.statLbl}>Expenses Ingested</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statNum}>{migrationResult.incomeInserted}</div>
              <div style={styles.statLbl}>Income Records</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statNum}>{migrationResult.savingsInserted}</div>
              <div style={styles.statLbl}>Savings Baselines</div>
            </div>
          </div>

          <div style={styles.successActions}>
            <button
              style={styles.primaryActionBtn}
              onClick={() => setActiveTab('dashboard')}
            >
              <span>View Main Dashboard</span>
              <ArrowRight size={16} />
            </button>
            <button
              style={styles.secondaryActionBtn}
              onClick={() => setActiveTab('transactions')}
            >
              <span>View Ingested Ledger</span>
            </button>
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
  },
  headerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    borderRadius: '100px',
    fontSize: '0.75rem',
    fontWeight: '700',
    marginBottom: '8px',
  },
  pageTitle: {
    fontSize: '1.75rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  pageSubtitle: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    margin: '4px 0 0',
  },
  resetBtn: {
    padding: '8px 16px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
  dropZone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '2px dashed var(--border-main)',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s ease',
  },
  uploadIconWrap: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  dropTitle: {
    fontSize: '1.125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  dropSub: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    margin: '6px 0 20px',
    maxWidth: '460px',
  },
  browseBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 22px',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 18px',
    backgroundColor: 'var(--danger-light)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--danger-text)',
    fontSize: '0.875rem',
    fontWeight: '500',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  kpiCard: {
    backgroundColor: 'var(--bg-surface)',
    padding: '18px 20px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    boxShadow: 'var(--shadow-sm)',
  },
  kpiTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  kpiLabel: {
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  kpiValue: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  kpiSub: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '4px',
  },
  executionCard: {
    backgroundColor: 'var(--bg-surface)',
    padding: '20px 24px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    boxShadow: 'var(--shadow-sm)',
  },
  executionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
    marginBottom: '16px',
  },
  executionTitle: {
    fontSize: '1.0625rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  executionSub: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    margin: '2px 0 0',
  },
  runMigrationBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 22px',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: '700',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
  },
  optionsRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  optionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.8125rem',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
  progressContainer: {
    marginTop: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  progressBarWrap: {
    width: '100%',
    height: '8px',
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: 'var(--primary)',
    borderRadius: '4px',
    transition: 'width 0.2s ease',
  },
  progressStatusText: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  previewContainer: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
  },
  tabsHeader: {
    display: 'flex',
    backgroundColor: 'var(--bg-surface-subtle)',
    borderBottom: '1px solid var(--border-main)',
    overflowX: 'auto',
  },
  tabBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 18px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  tabBtnActive: {
    borderBottomColor: 'var(--primary)',
    color: 'var(--primary)',
    backgroundColor: 'var(--bg-surface)',
  },
  searchBarRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-subtle)',
    gap: '12px',
    flexWrap: 'wrap',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--bg-surface-subtle)',
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
    flex: 1,
    maxWidth: '400px',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    width: '100%',
    fontSize: '0.8125rem',
  },
  countTag: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  previewTableWrap: {
    overflowX: 'auto',
  },
  previewTableHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 16px',
    backgroundColor: 'var(--bg-surface-subtle)',
    borderBottom: '1px solid var(--border-main)',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
  },
  previewTableRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-subtle)',
    fontSize: '0.8125rem',
  },
  monthBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    fontSize: '0.6875rem',
    fontWeight: '700',
  },
  categoryPill: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-surface-subtle)',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  moreRowsNote: {
    padding: '14px 16px',
    textAlign: 'center',
    fontSize: '0.8125rem',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-surface-subtle)',
  },
  successCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '48px 24px',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    textAlign: 'center',
    boxShadow: 'var(--shadow-md)',
  },
  successIconWrap: {
    marginBottom: '16px',
  },
  successTitle: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: 0,
  },
  successSubtitle: {
    fontSize: '0.9375rem',
    color: 'var(--text-secondary)',
    margin: '6px 0 24px',
  },
  resultStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    width: '100%',
    maxWidth: '500px',
    marginBottom: '28px',
  },
  statBox: {
    padding: '14px',
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-main)',
  },
  statNum: {
    fontSize: '1.375rem',
    fontWeight: '800',
    color: 'var(--primary)',
  },
  statLbl: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  successActions: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  primaryActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: '700',
    border: 'none',
    cursor: 'pointer',
  },
  secondaryActionBtn: {
    padding: '10px 20px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
};
