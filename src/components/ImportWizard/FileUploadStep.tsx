import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  Sparkles,
  Layers,
  CheckCircle2,
  TableProperties,
} from 'lucide-react';
import { ParsedFile, ParsedSheet } from '../../lib/types';
import { parseFileInBrowser, buildSheetFromGrid } from '../../lib/parser';

interface FileUploadStepProps {
  parsedFile: ParsedFile | null;
  onFileParsed: (file: ParsedFile) => void;
  onSheetChanged: (sheetName: string) => void;
  onHeaderRowChanged: (headerRowIndex: number) => void;
}

export const FileUploadStep: React.FC<FileUploadStepProps> = ({
  parsedFile,
  onFileParsed,
  onSheetChanged,
  onHeaderRowChanged,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const parsed = await parseFileInBrowser(file);
      onFileParsed(parsed);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to parse file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  // Sample data loader for instant testing
  const loadSampleData = (sampleName: 'visa' | 'bank') => {
    setErrorMessage(null);
    setIsLoading(true);

    setTimeout(() => {
      try {
        let sampleGrid: any[][];
        let fileName = '';

        if (sampleName === 'visa') {
          fileName = 'פירוט חיובים לכרטיס ויזה 2285 - 09.08.26.xlsx';
          sampleGrid = [
            ['דוח עסקאות כרטיסי אשראי - ויזה כאל'],
            ['כרטיס 2285', 'תקופת חיוב: אוגוסט 2026'],
            ['תאריך עסקה', 'שם בית העסק', 'סכום חיוב', '4 ספרות', 'ענף', 'הערות'],
            ['04/08/2026', 'SHUFERSAL DEAL TEL AVIV', '842.50', '2285', 'מזון וסופרמרקט', 'קניות שבועיות'],
            ['05/08/2026', 'PAZ FILLING STATION 102', '320.00', '2285', 'דלק ותחבורה', 'תדלוק מלא'],
            ['06/08/2026', 'SUPER-PHARM DIZENGOFF', '185.00', '2285', 'פארם ובריאות', 'ויטמינים'],
            ['07/08/2026', 'NETFLIX.COM', '69.90', '2285', 'פנאי ובידור', 'מנוי חודשי'],
            ['08/08/2026', 'RAMI LEVI HASHIKMA', '654.20', '2285', 'מזון', 'סופר'],
            ['08/08/2026', 'SONOL BEN GURION', '290.00', '2285', 'דלק', 'תדלוק רכב'],
            ['09/08/2026', 'BE PHARM TLV', '95.00', '2285', 'פארם', 'תרופות'],
          ];
        } else {
          fileName = 'סיכום הכנסות הוצאות - 2026 .xlsx';
          sampleGrid = [
            ['תאריך', 'תיאור', 'חובה', 'זכות', 'מספר כרטיס', 'הערות'],
            ['2026-08-01', 'Tech Employer Ltd - Salary', '', '24500.00', '', 'משכורת חודשית'],
            ['2026-08-02', 'Landlord Properties - Rent', '6800.00', '', '', 'שכירות אוגוסט'],
            ['2026-08-03', 'Israel Electric Corp - IEC', '580.00', '', '', 'חשמל'],
            ['2026-08-05', 'SHUFERSAL DEAL 92834', '760.30', '', '2285', 'סופרמרקט'],
            ['2026-08-06', 'PAZ STATION 102', '310.00', '', '2285', 'דלק'],
            ['2026-08-07', 'Maccabi Healthcare', '140.00', '', '', 'ביטוח משלים'],
            ['2026-08-08', 'Side Consulting Revenue', '', '3200.00', '', 'הכנסה נוספת'],
          ];
        }

        const sheet = buildSheetFromGrid('Sheet 1', sampleGrid, sampleName === 'visa' ? 2 : 0);
        onFileParsed({
          fileName,
          fileSize: 28007,
          fileType: 'xlsx',
          sheets: [sheet],
          activeSheetName: sheet.name,
        });
      } catch (err: any) {
        setErrorMessage(err.message);
      } finally {
        setIsLoading(false);
      }
    }, 200);
  };

  const activeSheet = parsedFile?.sheets.find((s) => s.name === parsedFile.activeSheetName);

  return (
    <div style={styles.container} className="animate-fade-in">
      <div style={styles.header}>
        <h2 style={styles.title}>1. Upload Statement File</h2>
        <p style={styles.subtitle}>
          Upload your bank export or credit card statement in <strong>.xlsx</strong>, <strong>.xls</strong>, or <strong>.csv</strong>. All data is processed 100% locally in your browser memory.
        </p>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        style={{
          ...styles.dropzone,
          ...(isDragging ? styles.dropzoneActive : {}),
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div style={styles.iconCircle}>
          <UploadCloud size={32} color="var(--primary)" />
        </div>

        <div style={styles.dropTitle}>
          {isDragging ? 'Drop file here to parse' : 'Click to browse or drag & drop statement'}
        </div>
        <div style={styles.dropSub}>
          Supports Excel (.xlsx, .xls) and CSV (.csv) statements with Hebrew & English UTF-8 encoding
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div style={styles.errorBanner}>
          <AlertCircle size={16} color="var(--danger)" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Instant Test Sample Loader */}
      <div style={styles.sampleLoaderCard}>
        <div style={styles.sampleLoaderHeader}>
          <Sparkles size={16} color="var(--primary)" />
          <span style={styles.sampleLoaderTitle}>Test with sample statements:</span>
        </div>
        <div style={styles.sampleButtonsRow}>
          <button
            style={styles.sampleBtn}
            onClick={() => loadSampleData('visa')}
            disabled={isLoading}
          >
            <FileSpreadsheet size={14} color="var(--primary)" />
            <span>Load Israeli Visa Credit Card (.xlsx)</span>
          </button>
          <button
            style={styles.sampleBtn}
            onClick={() => loadSampleData('bank')}
            disabled={isLoading}
          >
            <FileText size={14} color="var(--success)" />
            <span>Load Income & Expenses Bank Ledger (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Parsed File Details & Sheet Inspector */}
      {parsedFile && activeSheet && (
        <div style={styles.parsedCard} className="animate-fade-in">
          <div style={styles.parsedHeader}>
            <div style={styles.fileMetaLeft}>
              <div style={styles.fileIconWrap}>
                {parsedFile.fileType === 'csv' ? (
                  <FileText size={20} color="var(--primary)" />
                ) : (
                  <FileSpreadsheet size={20} color="var(--success)" />
                )}
              </div>
              <div>
                <div style={styles.fileName}>{parsedFile.fileName}</div>
                <div style={styles.fileSizeText}>
                  {(parsedFile.fileSize / 1024).toFixed(1)} KB • {activeSheet.rows.length} rows detected • {activeSheet.headers.length} columns
                </div>
              </div>
            </div>

            <div style={styles.statusPill}>
              <CheckCircle2 size={14} color="var(--success)" />
              <span>Parsed Locally</span>
            </div>
          </div>

          {/* Multi-Sheet Picker */}
          {parsedFile.sheets.length > 1 && (
            <div style={styles.sheetSelectorRow}>
              <span style={styles.sheetLabel}>
                <Layers size={14} color="var(--text-secondary)" />
                Select Workbook Sheet:
              </span>
              <div style={styles.sheetTabs}>
                {parsedFile.sheets.map((sheet) => (
                  <button
                    key={sheet.name}
                    style={{
                      ...styles.sheetTab,
                      ...(sheet.name === parsedFile.activeSheetName ? styles.sheetTabActive : {}),
                    }}
                    onClick={() => onSheetChanged(sheet.name)}
                  >
                    {sheet.name} ({sheet.rows.length} rows)
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Header Row Index Selector */}
          <div style={styles.headerRowConfig}>
            <div style={styles.headerConfigLeft}>
              <TableProperties size={15} color="var(--primary)" />
              <div>
                <div style={styles.configTitle}>Header Row Detection</div>
                <div style={styles.configDesc}>
                  Column headers detected at row <strong>{activeSheet.headerRowIndex + 1}</strong>. Change if your statement has title lines above the table.
                </div>
              </div>
            </div>

            <div style={styles.rowSelectorWrap}>
              <label style={styles.rowSelectLabel}>Headers at Row:</label>
              <select
                style={styles.rowSelect}
                value={activeSheet.headerRowIndex}
                onChange={(e) => onHeaderRowChanged(parseInt(e.target.value, 10))}
              >
                {activeSheet.rawGrid.slice(0, 10).map((row, idx) => (
                  <option key={idx} value={idx}>
                    Row {idx + 1}: {row.filter(Boolean).slice(0, 3).join(', ') || '(Empty)'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Header preview chips */}
          <div style={styles.detectedHeadersWrap}>
            <span style={styles.detectedTitle}>Extracted Columns ({activeSheet.headers.length}):</span>
            <div style={styles.chipsContainer}>
              {activeSheet.headers.map((h, i) => (
                <span key={i} style={styles.headerChip}>
                  {h}
                </span>
              ))}
            </div>
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
    gap: '20px',
  },
  header: {
    marginBottom: '4px',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginTop: '4px',
    lineHeight: '1.5',
  },
  dropzone: {
    border: '2px dashed var(--border-strong)',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--bg-surface)',
    padding: '40px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: 'var(--shadow-sm)',
  },
  dropzoneActive: {
    borderColor: 'var(--primary)',
    backgroundColor: 'var(--primary-light)',
    transform: 'scale(1.01)',
  },
  iconCircle: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  dropTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '6px',
  },
  dropSub: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    maxWidth: '480px',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: 'var(--danger-light)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #FECACA',
    color: 'var(--danger-text)',
    fontSize: '0.8125rem',
  },
  sampleLoaderCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sampleLoaderHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sampleLoaderTitle: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  sampleButtonsRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  sampleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    transition: 'all 0.15s ease',
  },
  parsedCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '24px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  parsedHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
    paddingBottom: '16px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  fileMetaLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  fileIconWrap: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-surface-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: {
    fontSize: '0.9375rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  fileSizeText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  statusPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    backgroundColor: 'var(--success-light)',
    borderRadius: '16px',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--success-text)',
  },
  sheetSelectorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
  },
  sheetLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  sheetTabs: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  sheetTab: {
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
    backgroundColor: 'var(--bg-surface-subtle)',
    fontSize: '0.75rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
  },
  sheetTabActive: {
    backgroundColor: 'var(--primary-light)',
    borderColor: 'var(--primary)',
    color: 'var(--primary)',
    fontWeight: '700',
  },
  headerRowConfig: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--bg-surface-subtle)',
    padding: '12px 16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-main)',
    flexWrap: 'wrap',
    gap: '12px',
  },
  headerConfigLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  configTitle: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  configDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  rowSelectorWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  rowSelectLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  rowSelect: {
    padding: '6px 10px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-strong)',
    backgroundColor: 'var(--bg-surface)',
    fontSize: '0.75rem',
    color: 'var(--text-primary)',
  },
  detectedHeadersWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  detectedTitle: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
  },
  chipsContainer: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  headerChip: {
    padding: '4px 10px',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
};
