import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  Sliders,
  TableProperties,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  ParsedFile,
  ColumnMapping,
  TransformedImportRow,
  ImportBatchSummary,
  Transaction,
  BusinessMapping,
} from '../../lib/types';
import {
  suggestInitialMapping,
  buildSheetFromGrid,
  transformRowsWithMapping,
} from '../../lib/parser';
import { fetchHouseholdMappings } from '../../lib/services/mappingService';
import { bulkInsertTransactions } from '../../lib/services/transactionService';
import { FileUploadStep } from './FileUploadStep';
import { ColumnMappingStep } from './ColumnMappingStep';
import { PreviewStep } from './PreviewStep';
import { ImportSuccessStep } from './ImportSuccessStep';

export const ImportWizard: React.FC = () => {
  const {
    activeHousehold,
    categories,
    businessMappings: contextMappings,
    setActiveTab,
    addBatchTransactions,
    addBusinessMapping,
    isDemoMode,
  } = useAuth();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [transformedRows, setTransformedRows] = useState<TransformedImportRow[]>([]);
  const [importSummary, setImportSummary] = useState<ImportBatchSummary | null>(null);
  const [householdMappings, setHouseholdMappings] = useState<BusinessMapping[]>(contextMappings);

  // Bulk Insert Progress & Error State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [insertProgress, setInsertProgress] = useState<{ completed: number; total: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currencySymbol = activeHousehold?.currency === 'ILS' ? '₪' : activeHousehold?.currency || '$';
  const activeSheet = parsedFile?.sheets.find((s) => s.name === parsedFile.activeSheetName);

  // Fetch latest business mapping rules for the active household from Supabase
  useEffect(() => {
    if (activeHousehold?.id) {
      fetchHouseholdMappings(activeHousehold.id, isDemoMode).then((rules) => {
        if (rules && rules.length > 0) {
          setHouseholdMappings(rules);
        }
      });
    }
  }, [activeHousehold?.id, isDemoMode]);

  // Step 1: File Parsed Handler
  const handleFileParsed = (file: ParsedFile) => {
    setParsedFile(file);
    const initialSheet = file.sheets[0];
    if (initialSheet) {
      const autoMapping = suggestInitialMapping(initialSheet.headers);
      setColumnMapping(autoMapping);
    }
  };

  // Sheet Switcher
  const handleSheetChanged = (sheetName: string) => {
    if (!parsedFile) return;
    const targetSheet = parsedFile.sheets.find((s) => s.name === sheetName);
    if (targetSheet) {
      setParsedFile({
        ...parsedFile,
        activeSheetName: sheetName,
      });
      const autoMapping = suggestInitialMapping(targetSheet.headers);
      setColumnMapping(autoMapping);
    }
  };

  // Header Row Index Changed
  const handleHeaderRowChanged = (newHeaderIndex: number) => {
    if (!parsedFile || !activeSheet) return;
    const updatedSheet = buildSheetFromGrid(activeSheet.name, activeSheet.rawGrid, newHeaderIndex);
    const updatedSheets = parsedFile.sheets.map((s) =>
      s.name === activeSheet.name ? updatedSheet : s
    );
    setParsedFile({
      ...parsedFile,
      sheets: updatedSheets,
    });
    const autoMapping = suggestInitialMapping(updatedSheet.headers);
    setColumnMapping(autoMapping);
  };

  // Navigate to Step 3: Run Transformation & Auto-Classification
  const handleProceedToPreview = () => {
    if (!activeSheet || !columnMapping) return;
    const effectiveMappings = householdMappings.length > 0 ? householdMappings : contextMappings;
    const rows = transformRowsWithMapping(
      activeSheet.rows,
      columnMapping,
      effectiveMappings,
      categories
    );
    setTransformedRows(rows);
    setCurrentStep(3);
  };

  // Callback when a new auto-rule is saved inline from the preview table
  const handleNewMappingCreated = (newRule: BusinessMapping) => {
    setHouseholdMappings((prev) => [newRule, ...prev]);
    addBusinessMapping(newRule.pattern, newRule.category_id);
  };

  // Step 4: Perform Database Bulk Insert
  const handleCommitImport = async () => {
    if (!activeHousehold) return;
    setErrorMessage(null);
    setIsSubmitting(true);

    const selectedRows = transformedRows.filter((r) => r.selected && r.isValid);
    if (selectedRows.length === 0) {
      setErrorMessage('No valid transactions selected for import.');
      setIsSubmitting(false);
      return;
    }

    setInsertProgress({ completed: 0, total: selectedRows.length });

    try {
      // Execute chunked bulk insertion into Supabase transactions table
      const result = await bulkInsertTransactions(
        activeHousehold.id,
        selectedRows,
        isDemoMode,
        (completed, total) => setInsertProgress({ completed, total })
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to insert transactions into database');
      }

      // Add to local state
      addBatchTransactions(result.insertedTransactions);

      // Compute statistics for success screen
      const activeSelected = selectedRows.filter((r) => !r.is_hidden);
      const hiddenCount = selectedRows.filter((r) => r.is_hidden).length;

      const totalIncome = activeSelected
        .filter((r) => r.transaction_type === 'income')
        .reduce((sum, r) => sum + r.amount, 0);

      const totalExpense = activeSelected
        .filter((r) => r.transaction_type === 'expense')
        .reduce((sum, r) => sum + r.amount, 0);

      const autoCategorizedCount = selectedRows.filter(
        (r) => r.category_id && r.auto_matched_rule
      ).length;

      setImportSummary({
        totalRows: transformedRows.length,
        validRows: result.insertedCount,
        invalidRows: transformedRows.length - selectedRows.length,
        hiddenRowsCount: hiddenCount,
        totalIncome,
        totalExpense,
        autoCategorizedCount,
      });

      setCurrentStep(4);
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during database insert');
    } finally {
      setIsSubmitting(false);
      setInsertProgress(null);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setParsedFile(null);
    setColumnMapping(null);
    setTransformedRows([]);
    setImportSummary(null);
    setErrorMessage(null);
  };

  const steps = [
    { num: 1, title: 'Upload File', icon: UploadCloud },
    { num: 2, title: 'Map Columns', icon: Sliders },
    { num: 3, title: 'Preview & Classify', icon: TableProperties },
    { num: 4, title: 'Inserted', icon: CheckCircle2 },
  ];

  return (
    <div style={styles.container}>
      {/* Stepper Header */}
      <div style={styles.stepperContainer}>
        {steps.map((s, idx) => {
          const Icon = s.icon;
          const isCompleted = currentStep > s.num;
          const isCurrent = currentStep === s.num;

          return (
            <React.Fragment key={s.num}>
              <div style={styles.stepItem}>
                <div
                  style={{
                    ...styles.stepIconWrap,
                    ...(isCompleted
                      ? styles.stepIconWrapCompleted
                      : isCurrent
                      ? styles.stepIconWrapActive
                      : {}),
                  }}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={16} color="#FFFFFF" />
                  ) : (
                    <Icon
                      size={16}
                      color={isCurrent ? '#FFFFFF' : 'var(--text-secondary)'}
                    />
                  )}
                </div>
                <div style={styles.stepTextWrap}>
                  <span style={styles.stepNumLabel}>Step {s.num}</span>
                  <span
                    style={{
                      ...styles.stepTitle,
                      ...(isCurrent ? styles.stepTitleActive : {}),
                    }}
                  >
                    {s.title}
                  </span>
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div
                  style={{
                    ...styles.stepperConnector,
                    ...(currentStep > s.num ? styles.stepperConnectorActive : {}),
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Error Alert Banner if any */}
      {errorMessage && (
        <div style={styles.errorAlertBanner}>
          <AlertCircle size={16} color="var(--danger)" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Progress bar during bulk insertion */}
      {isSubmitting && insertProgress && (
        <div style={styles.progressCard} className="animate-fade-in">
          <div style={styles.progressHeader}>
            <div style={styles.progressTitleRow}>
              <Loader2 size={16} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={styles.progressTitle}>Inserting Transactions into Supabase Database...</span>
            </div>
            <span style={styles.progressNumbers}>
              {insertProgress.completed} / {insertProgress.total} records
            </span>
          </div>
          <div style={styles.progressTrack}>
            <div
              style={{
                ...styles.progressFill,
                width: `${Math.round((insertProgress.completed / insertProgress.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Step Content */}
      <div style={styles.contentBody}>
        {currentStep === 1 && (
          <FileUploadStep
            parsedFile={parsedFile}
            onFileParsed={handleFileParsed}
            onSheetChanged={handleSheetChanged}
            onHeaderRowChanged={handleHeaderRowChanged}
          />
        )}

        {currentStep === 2 && activeSheet && columnMapping && (
          <ColumnMappingStep
            sheet={activeSheet}
            mapping={columnMapping}
            onMappingChanged={setColumnMapping}
          />
        )}

        {currentStep === 3 && activeHousehold && (
          <PreviewStep
            rows={transformedRows}
            categories={categories}
            businessMappings={householdMappings}
            householdId={activeHousehold.id}
            isDemoMode={isDemoMode}
            currencySymbol={currencySymbol}
            onRowsUpdated={setTransformedRows}
            onNewMappingCreated={handleNewMappingCreated}
          />
        )}

        {currentStep === 4 && importSummary && (
          <ImportSuccessStep
            summary={importSummary}
            currencySymbol={currencySymbol}
            onViewLedger={() => setActiveTab('transactions')}
            onViewBudgets={() => setActiveTab('budgets')}
            onImportAnother={handleReset}
          />
        )}
      </div>

      {/* Bottom Navigation Toolbar */}
      {currentStep < 4 && (
        <div style={styles.navToolbar}>
          <div>
            {currentStep > 1 && !isSubmitting && (
              <button
                style={styles.backBtn}
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
              >
                <ArrowLeft size={16} color="var(--text-secondary)" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div style={styles.navRightActions}>
            {parsedFile && !isSubmitting && (
              <button style={styles.cancelBtn} onClick={handleReset}>
                <RotateCcw size={14} color="var(--text-muted)" />
                <span>Start Over</span>
              </button>
            )}

            {currentStep === 1 && (
              <button
                style={{
                  ...styles.nextBtn,
                  ...(!parsedFile ? styles.nextBtnDisabled : {}),
                }}
                disabled={!parsedFile}
                onClick={() => setCurrentStep(2)}
              >
                <span>Continue to Column Mapping</span>
                <ArrowRight size={16} color="#FFFFFF" />
              </button>
            )}

            {currentStep === 2 && (
              <button
                style={{
                  ...styles.nextBtn,
                  ...(!columnMapping?.dateColumn || !columnMapping?.payeeColumn ? styles.nextBtnDisabled : {}),
                }}
                disabled={!columnMapping?.dateColumn || !columnMapping?.payeeColumn}
                onClick={handleProceedToPreview}
              >
                <span>Proceed to Classification & Preview</span>
                <ArrowRight size={16} color="#FFFFFF" />
              </button>
            )}

            {currentStep === 3 && (
              <button
                style={{
                  ...styles.nextBtn,
                  backgroundColor: 'var(--success)',
                  ...(isSubmitting || transformedRows.filter((r) => r.selected).length === 0 ? styles.nextBtnDisabled : {}),
                }}
                disabled={isSubmitting || transformedRows.filter((r) => r.selected).length === 0}
                onClick={handleCommitImport}
              >
                {isSubmitting ? (
                  <Loader2 size={16} color="#FFFFFF" style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <CheckCircle2 size={16} color="#FFFFFF" />
                )}
                <span>
                  {isSubmitting
                    ? 'Inserting into Database...'
                    : `Confirm & Bulk Insert (${transformedRows.filter((r) => r.selected).length} rows)`}
                </span>
              </button>
            )}
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
  stepperContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '16px 24px',
    boxShadow: 'var(--shadow-sm)',
    overflowX: 'auto',
    gap: '12px',
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexShrink: 0,
  },
  stepIconWrap: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-surface-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  stepIconWrapActive: {
    backgroundColor: 'var(--primary)',
    boxShadow: '0 0 0 3px var(--primary-light)',
  },
  stepIconWrapCompleted: {
    backgroundColor: 'var(--success)',
  },
  stepTextWrap: {
    display: 'flex',
    flexDirection: 'column',
  },
  stepNumLabel: {
    fontSize: '0.6875rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  stepTitle: {
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  stepTitleActive: {
    color: 'var(--text-primary)',
    fontWeight: '800',
  },
  stepperConnector: {
    flex: 1,
    height: '2px',
    backgroundColor: 'var(--border-subtle)',
    minWidth: '24px',
  },
  stepperConnectorActive: {
    backgroundColor: 'var(--success)',
  },
  errorAlertBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 18px',
    backgroundColor: 'var(--danger-light)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #FECACA',
    color: 'var(--danger-text)',
    fontSize: '0.8125rem',
    fontWeight: '600',
  },
  progressCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--primary)',
    padding: '16px 20px',
    boxShadow: 'var(--shadow-sm)',
  },
  progressHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  progressTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  progressTitle: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  progressNumbers: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--primary)',
  },
  progressTrack: {
    height: '8px',
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'var(--primary)',
    borderRadius: '4px',
    transition: 'width 0.2s ease',
  },
  contentBody: {
    minHeight: '400px',
  },
  navToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '16px 24px',
    boxShadow: 'var(--shadow-sm)',
    flexWrap: 'wrap',
    gap: '12px',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 16px',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  navRightActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginLeft: 'auto',
  },
  cancelBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 14px',
    fontSize: '0.8125rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  nextBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    boxShadow: 'var(--shadow-sm)',
    transition: 'all 0.15s ease',
  },
  nextBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};
