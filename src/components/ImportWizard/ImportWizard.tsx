import React, { useState } from 'react';
import {
  UploadCloud,
  Sliders,
  TableProperties,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  ParsedFile,
  ColumnMapping,
  TransformedImportRow,
  ImportBatchSummary,
  Transaction,
} from '../../lib/types';
import {
  suggestInitialMapping,
  buildSheetFromGrid,
  transformRowsWithMapping,
} from '../../lib/parser';
import { FileUploadStep } from './FileUploadStep';
import { ColumnMappingStep } from './ColumnMappingStep';
import { PreviewStep } from './PreviewStep';
import { ImportSuccessStep } from './ImportSuccessStep';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const ImportWizard: React.FC = () => {
  const {
    activeHousehold,
    categories,
    businessMappings,
    setActiveTab,
    addBatchTransactions,
    isDemoMode,
  } = useAuth();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [transformedRows, setTransformedRows] = useState<TransformedImportRow[]>([]);
  const [importSummary, setImportSummary] = useState<ImportBatchSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currencySymbol = activeHousehold?.currency === 'ILS' ? '₪' : activeHousehold?.currency || '$';

  const activeSheet = parsedFile?.sheets.find((s) => s.name === parsedFile.activeSheetName);

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

  // Navigate to Step 3: Run Transformation
  const handleProceedToPreview = () => {
    if (!activeSheet || !columnMapping) return;
    const rows = transformRowsWithMapping(
      activeSheet.rows,
      columnMapping,
      businessMappings,
      categories
    );
    setTransformedRows(rows);
    setCurrentStep(3);
  };

  // Row toggles in Step 3
  const handleToggleRow = (rowId: string) => {
    setTransformedRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, selected: !r.selected } : r))
    );
  };

  const handleToggleAll = (selectAll: boolean) => {
    setTransformedRows((prev) => prev.map((r) => ({ ...r, selected: selectAll })));
  };

  const handleRowCategoryChanged = (rowId: string, categoryId: string) => {
    setTransformedRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, category_id: categoryId || null } : r))
    );
  };

  // Step 4: Commit to Ledger
  const handleCommitImport = async () => {
    if (!activeHousehold) return;
    setIsSubmitting(true);

    const selectedRows = transformedRows.filter((r) => r.selected && r.isValid);
    if (selectedRows.length === 0) {
      setIsSubmitting(false);
      return;
    }

    const newTransactions: Transaction[] = selectedRows.map((row) => ({
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      household_id: activeHousehold.id,
      date: row.date,
      amount: row.amount,
      category_id: row.category_id,
      transaction_type: row.transaction_type,
      payee_name: row.payee_name,
      original_description: row.notes,
      payment_method: row.payment_method,
      card_last_digits: row.card_last_digits,
      is_hidden: false,
      notes: row.auto_matched_rule ? `Auto-mapped by rule: ${row.auto_matched_rule}` : row.notes,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // In-memory update and Supabase sync via AuthContext
    addBatchTransactions(newTransactions);

    // Set summary stats
    const totalIncome = selectedRows
      .filter((r) => r.transaction_type === 'income')
      .reduce((sum, r) => sum + r.amount, 0);

    const totalExpense = selectedRows
      .filter((r) => r.transaction_type === 'expense')
      .reduce((sum, r) => sum + r.amount, 0);

    const autoCategorizedCount = selectedRows.filter((r) => r.category_id && r.auto_matched_rule).length;

    setImportSummary({
      totalRows: transformedRows.length,
      validRows: selectedRows.length,
      invalidRows: transformedRows.length - selectedRows.length,
      totalIncome,
      totalExpense,
      autoCategorizedCount,
    });

    setIsSubmitting(false);
    setCurrentStep(4);
  };

  const handleReset = () => {
    setCurrentStep(1);
    setParsedFile(null);
    setColumnMapping(null);
    setTransformedRows([]);
    setImportSummary(null);
  };

  const steps = [
    { num: 1, title: 'Upload File', icon: UploadCloud },
    { num: 2, title: 'Map Columns', icon: Sliders },
    { num: 3, title: 'Preview & Validate', icon: TableProperties },
    { num: 4, title: 'Imported', icon: CheckCircle2 },
  ];

  return (
    <div style={styles.container}>
      {/* Wizard Header Stepper */}
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

        {currentStep === 3 && (
          <PreviewStep
            rows={transformedRows}
            categories={categories}
            currencySymbol={currencySymbol}
            onToggleRow={handleToggleRow}
            onToggleAll={handleToggleAll}
            onRowCategoryChanged={handleRowCategoryChanged}
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
            {currentStep > 1 && (
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
            {parsedFile && (
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
                <span>Preview Transformed Data</span>
                <ArrowRight size={16} color="#FFFFFF" />
              </button>
            )}

            {currentStep === 3 && (
              <button
                style={{
                  ...styles.nextBtn,
                  backgroundColor: 'var(--success)',
                }}
                disabled={isSubmitting || transformedRows.filter((r) => r.selected).length === 0}
                onClick={handleCommitImport}
              >
                <CheckCircle2 size={16} color="#FFFFFF" />
                <span>
                  {isSubmitting
                    ? 'Importing...'
                    : `Confirm & Import ${transformedRows.filter((r) => r.selected).length} Transactions`}
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
