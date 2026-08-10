import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  FolderTree,
  Tag,
  ArrowRightLeft,
  CreditCard,
  UploadCloud,
  Download,
  Plus,
  Edit3,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  X,
  Sparkles,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { t, formatCategoryName } from '../../lib/i18n';
import { Category, BusinessMapping, CardMapping } from '../../lib/types';

type SystemTab = 'expenses' | 'incomes' | 'merchants' | 'cards';

export const SystemTablesScreen: React.FC = () => {
  const {
    categories,
    businessMappings,
    cardMappings,
    addCategory,
    updateCategory,
    deleteCategory,
    batchAddCategories,
    addBusinessMapping,
    updateBusinessMapping,
    deleteBusinessMapping,
    batchAddBusinessMappings,
    addCardMapping,
    updateCardMapping,
    deleteCardMapping,
    batchAddCardMappings,
    language,
    dir,
  } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<SystemTab>('expenses');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals for CRUD
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Form states for manual Add/Edit
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#4F46E5');
  const [formIcon, setFormIcon] = useState('tag');
  const [formPattern, setFormPattern] = useState('');
  const [formTargetCatId, setFormTargetCatId] = useState('');
  const [formRawCard, setFormRawCard] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formLastDigits, setFormLastDigits] = useState('');

  // File Upload & Preview State
  const [isUploading, setIsUploading] = useState(false);
  const [previewRows, setPreviewRows] = useState<any[] | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const incomeCategories = categories.filter((c) => c.type === 'income');

  // Filtered lists based on search
  const filteredExpenses = expenseCategories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    formatCategoryName(c.name, language).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredIncomes = incomeCategories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    formatCategoryName(c.name, language).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMerchants = businessMappings.filter((m) => {
    const cat = categories.find((c) => c.id === m.category_id);
    const catName = cat ? formatCategoryName(cat.name, language) : '';
    return (
      m.pattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
      catName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const filteredCards = cardMappings.filter((c) =>
    c.raw_pattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.card_last_digits && c.card_last_digits.includes(searchQuery))
  );

  // Template Downloader
  const handleDownloadTemplate = () => {
    let csvContent = '';
    let fileName = '';

    if (activeSubTab === 'expenses') {
      csvContent = '\uFEFFשם קטגוריה,צבע (קוד HEX),אייקון\nסופרמרקט ומזון,#10B981,shopping-cart\nביגוד והנעלה,#EC4899,shirt\nאחזקת הבית וחשבונות,#4F46E5,home\n';
      fileName = 'תבנית_סוגי_הוצאות.csv';
    } else if (activeSubTab === 'incomes') {
      csvContent = '\uFEFFשם קטגוריית הכנסה,צבע (קוד HEX),אייקון\nמשכורת ראשית,#10B981,briefcase\nשכר דירה מהשקעה,#4F46E5,building\nקצבאות ובונוסים,#F59E0B,gift\n';
      fileName = 'תבנית_סוגי_הכנסות.csv';
    } else if (activeSubTab === 'merchants') {
      csvContent = '\uFEFFשם בית עסק / מילת מפתח,קטגוריית יעד\nSHUFERSAL,Groceries & Supermarket\nPAZ,Transportation & Fuel\nSUPER-PHARM,Healthcare & Pharmacy\n';
      fileName = 'תבנית_המרה_מבית_עסק_לסוג_הוצאה.csv';
    } else if (activeSubTab === 'cards') {
      csvContent = '\uFEFFשם כרטיס מקורי בדוח,שם כרטיס להצגה (מקור הוצאה),4 ספרות,צבע\nכרטיס ויזה כאל 1234,ויזה כאל זהב (אישי),1234,#4F46E5\nישראכרט 9876,מאסטרקארד משותף,9876,#10B981\nהעברה בנקאית לאומי,עו״ש בנק לאומי,,#06B6D4\n';
      fileName = 'תבנית_המרה_מכרטיס_למקור_הוצאה.csv';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  // File Upload Handler (Excel / CSV)
  const handleFileUpload = async (file: File) => {
    setUploadError(null);
    setPreviewFileName(file.name);
    setIsUploading(true);

    try {
      const isCsv = file.name.endsWith('.csv');
      let rawData: any[] = [];

      if (isCsv) {
        const text = await file.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        rawData = parsed.data;
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        rawData = XLSX.utils.sheet_to_json(worksheet);
      }

      if (!rawData || rawData.length === 0) {
        setUploadError(language === 'he' ? 'הקובץ ריק או שאינו מכיל שורות נתונים תקינות' : 'File is empty or contains no valid rows');
        setIsUploading(false);
        return;
      }

      // Normalize based on active tab
      if (activeSubTab === 'expenses' || activeSubTab === 'incomes') {
        const normalized = rawData.map((row: any) => {
          const name = row['שם קטגוריה'] || row['שם קטגוריית הכנסה'] || row['שם'] || row['קטגוריה'] || row['Category'] || row['Name'] || Object.values(row)[0];
          const color = row['צבע (קוד HEX)'] || row['צבע'] || row['Color'] || (activeSubTab === 'incomes' ? '#10B981' : '#4F46E5');
          const icon = row['אייקון'] || row['Icon'] || (activeSubTab === 'incomes' ? 'briefcase' : 'tag');
          return { name: String(name || '').trim(), color, icon, type: activeSubTab === 'incomes' ? 'income' : 'expense' };
        }).filter(r => r.name);

        setPreviewRows(normalized);
      } else if (activeSubTab === 'merchants') {
        const normalized = rawData.map((row: any) => {
          const pattern = row['שם בית עסק / מילת מפתח'] || row['בית עסק'] || row['מילת מפתח'] || row['תבנית'] || row['Pattern'] || row['Merchant'] || Object.values(row)[0];
          const catName = row['קטגוריית יעד'] || row['קטגוריה'] || row['סוג הוצאה'] || row['Category'] || Object.values(row)[1];
          
          // Match category ID by name or localized name
          const matchedCat = categories.find(c =>
            c.name.toLowerCase() === String(catName || '').toLowerCase() ||
            formatCategoryName(c.name, 'he').toLowerCase() === String(catName || '').toLowerCase()
          );

          return {
            pattern: String(pattern || '').toUpperCase().trim(),
            category_id: matchedCat?.id || categories[0]?.id || '',
            category_name: matchedCat ? formatCategoryName(matchedCat.name, language) : String(catName || 'ללא סיווג'),
          };
        }).filter(r => r.pattern);

        setPreviewRows(normalized);
      } else if (activeSubTab === 'cards') {
        const normalized = rawData.map((row: any) => {
          const rawPattern = row['שם כרטיס מקורי בדוח'] || row['שם כרטיס מקורי'] || row['תבנית'] || row['Raw Card Name'] || row['Pattern'] || Object.values(row)[0];
          const displayName = row['שם כרטיס להצגה (מקור הוצאה)'] || row['שם כרטיס להצגה'] || row['מקור הוצאה'] || row['Display Name'] || Object.values(row)[1];
          const digits = row['4 ספרות'] || row['ספרות'] || row['Digits'] || row['Last 4'] || '';
          const color = row['צבע'] || row['Color'] || '#4F46E5';
          return {
            raw_pattern: String(rawPattern || '').trim(),
            display_name: String(displayName || rawPattern || '').trim(),
            card_last_digits: digits ? String(digits).slice(-4) : null,
            payment_type: 'credit_card' as const,
            color,
          };
        }).filter(r => r.raw_pattern);

        setPreviewRows(normalized);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error parsing file');
    } finally {
      setIsUploading(false);
    }
  };

  // Commit batch import from preview
  const handleConfirmImport = () => {
    if (!previewRows || previewRows.length === 0) return;

    if (activeSubTab === 'expenses' || activeSubTab === 'incomes') {
      batchAddCategories(previewRows);
    } else if (activeSubTab === 'merchants') {
      batchAddBusinessMappings(
        previewRows.map(r => ({ pattern: r.pattern, category_id: r.category_id }))
      );
    } else if (activeSubTab === 'cards') {
      batchAddCardMappings(previewRows);
    }

    setPreviewRows(null);
    setPreviewFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormColor(activeSubTab === 'incomes' ? '#10B981' : '#4F46E5');
    setFormIcon(activeSubTab === 'incomes' ? 'briefcase' : 'tag');
    setFormPattern('');
    setFormTargetCatId(categories[0]?.id || '');
    setFormRawCard('');
    setFormDisplayName('');
    setFormLastDigits('');
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: any) => {
    setEditingItem(item);
    if (activeSubTab === 'expenses' || activeSubTab === 'incomes') {
      setFormName(item.name);
      setFormColor(item.color || '#4F46E5');
      setFormIcon(item.icon || 'tag');
    } else if (activeSubTab === 'merchants') {
      setFormPattern(item.pattern);
      setFormTargetCatId(item.category_id);
    } else if (activeSubTab === 'cards') {
      setFormRawCard(item.raw_pattern);
      setFormDisplayName(item.display_name);
      setFormLastDigits(item.card_last_digits || '');
      setFormColor(item.color || '#4F46E5');
    }
    setIsAddModalOpen(true);
  };

  // Save manual Add or Edit
  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      // Edit
      if (activeSubTab === 'expenses' || activeSubTab === 'incomes') {
        updateCategory(editingItem.id, formName, formColor, formIcon);
      } else if (activeSubTab === 'merchants') {
        updateBusinessMapping(editingItem.id, formPattern, formTargetCatId);
      } else if (activeSubTab === 'cards') {
        updateCardMapping(editingItem.id, formRawCard, formDisplayName, formLastDigits, formColor);
      }
    } else {
      // Add
      if (activeSubTab === 'expenses') {
        addCategory(formName, 'expense', formColor, formIcon);
      } else if (activeSubTab === 'incomes') {
        addCategory(formName, 'income', formColor, formIcon);
      } else if (activeSubTab === 'merchants') {
        addBusinessMapping(formPattern, formTargetCatId);
      } else if (activeSubTab === 'cards') {
        addCardMapping(formRawCard, formDisplayName, formLastDigits, formColor);
      }
    }
    setIsAddModalOpen(false);
  };

  // Delete handler with safety confirm
  const handleDeleteItem = (item: any) => {
    const label = item.name || item.pattern || item.display_name || item.raw_pattern;
    const confirmPrompt =
      language === 'he'
        ? `האם אתה בטוח שברצונך למחוק את "${label}"?`
        : `Are you sure you want to delete "${label}"?`;

    if (confirm(confirmPrompt)) {
      if (activeSubTab === 'expenses' || activeSubTab === 'incomes') {
        deleteCategory(item.id);
      } else if (activeSubTab === 'merchants') {
        deleteBusinessMapping(item.id);
      } else if (activeSubTab === 'cards') {
        deleteCardMapping(item.id);
      }
    }
  };

  return (
    <div style={styles.container}>
      {/* Top Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>{t('systemTablesTitle', language)}</h1>
          <p style={styles.pageSub}>{t('systemTablesSub', language)}</p>
        </div>
      </div>

      {/* 4 System Sub-Tabs */}
      <div style={styles.tabNav}>
        <button
          style={{
            ...styles.subTabBtn,
            ...(activeSubTab === 'expenses' ? styles.subTabBtnActive : {}),
          }}
          onClick={() => {
            setActiveSubTab('expenses');
            setPreviewRows(null);
            setSearchQuery('');
          }}
        >
          <FolderTree size={16} />
          <span>1. {t('tabExpenseCategories', language)}</span>
          <span style={styles.countBadge}>{expenseCategories.length}</span>
        </button>

        <button
          style={{
            ...styles.subTabBtn,
            ...(activeSubTab === 'incomes' ? styles.subTabBtnActive : {}),
          }}
          onClick={() => {
            setActiveSubTab('incomes');
            setPreviewRows(null);
            setSearchQuery('');
          }}
        >
          <Tag size={16} />
          <span>2. {t('tabIncomeCategories', language)}</span>
          <span style={styles.countBadge}>{incomeCategories.length}</span>
        </button>

        <button
          style={{
            ...styles.subTabBtn,
            ...(activeSubTab === 'merchants' ? styles.subTabBtnActive : {}),
          }}
          onClick={() => {
            setActiveSubTab('merchants');
            setPreviewRows(null);
            setSearchQuery('');
          }}
        >
          <ArrowRightLeft size={16} />
          <span>3. {t('tabMerchantMappings', language)}</span>
          <span style={styles.countBadge}>{businessMappings.length}</span>
        </button>

        <button
          style={{
            ...styles.subTabBtn,
            ...(activeSubTab === 'cards' ? styles.subTabBtnActive : {}),
          }}
          onClick={() => {
            setActiveSubTab('cards');
            setPreviewRows(null);
            setSearchQuery('');
          }}
        >
          <CreditCard size={16} />
          <span>4. {t('tabCardMappings', language)}</span>
          <span style={styles.countBadge}>{cardMappings.length}</span>
        </button>
      </div>

      {/* Excel / CSV File Upload Dropzone Bar */}
      <div style={styles.uploadSection}>
        <div style={styles.uploadHeader}>
          <div style={styles.uploadTitleWrap}>
            <FileSpreadsheet size={20} color="var(--primary)" />
            <div>
              <h3 style={styles.uploadHeading}>{t('uploadDropzoneTitle', language)}</h3>
              <p style={styles.uploadSub}>{t('uploadDropzoneSub', language)}</p>
            </div>
          </div>

          <div style={styles.uploadActionsRow}>
            <button style={styles.templateBtn} onClick={handleDownloadTemplate}>
              <Download size={15} />
              <span>{t('btnDownloadTemplate', language)}</span>
            </button>

            <label style={styles.fileInputLabel}>
              <UploadCloud size={16} />
              <span>{t('btnUploadFile', language)}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>
        </div>

        {uploadError && (
          <div style={styles.errorBanner}>
            <AlertCircle size={16} color="var(--danger)" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      {/* Preview Confirmation Box (When File is selected) */}
      {previewRows && (
        <div style={styles.previewContainer} className="animate-fade-in">
          <div style={styles.previewHeader}>
            <div style={styles.previewInfo}>
              <CheckCircle2 size={18} color="var(--success)" />
              <div>
                <span style={styles.previewTitleText}>{t('previewTitle', language)}</span>
                <span style={styles.previewSubText}>
                  ({previewFileName}) — {previewRows.length} {t('rowsToImport', language)}
                </span>
              </div>
            </div>

            <div style={styles.previewActions}>
              <button
                style={styles.cancelPreviewBtn}
                onClick={() => {
                  setPreviewRows(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                {t('cancel', language)}
              </button>
              <button style={styles.confirmImportBtn} onClick={handleConfirmImport}>
                <CheckCircle2 size={16} />
                <span>{t('btnConfirmImport', language)}</span>
              </button>
            </div>
          </div>

          {/* Table Preview */}
          <div style={styles.previewTableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  {activeSubTab === 'expenses' || activeSubTab === 'incomes' ? (
                    <>
                      <th style={styles.th}>{t('colCategoryName', language)}</th>
                      <th style={styles.th}>{t('colColor', language)}</th>
                      <th style={styles.th}>{t('colIcon', language)}</th>
                    </>
                  ) : activeSubTab === 'merchants' ? (
                    <>
                      <th style={styles.th}>{t('colMerchantPattern', language)}</th>
                      <th style={styles.th}>{t('colTargetCategory', language)}</th>
                    </>
                  ) : (
                    <>
                      <th style={styles.th}>{t('colRawCardName', language)}</th>
                      <th style={styles.th}>{t('colDisplayCardName', language)}</th>
                      <th style={styles.th}>{t('colLastDigits', language)}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 10).map((row, idx) => (
                  <tr key={idx} style={styles.tr}>
                    <td style={styles.td}>{idx + 1}</td>
                    {activeSubTab === 'expenses' || activeSubTab === 'incomes' ? (
                      <>
                        <td style={{ ...styles.td, fontWeight: '700' }}>{row.name}</td>
                        <td style={styles.td}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ ...styles.colorPreviewDot, backgroundColor: row.color }} />
                            {row.color}
                          </span>
                        </td>
                        <td style={styles.td}>{row.icon}</td>
                      </>
                    ) : activeSubTab === 'merchants' ? (
                      <>
                        <td style={{ ...styles.td, fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                          {row.pattern}
                        </td>
                        <td style={styles.td}>{row.category_name}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ ...styles.td, fontFamily: 'var(--font-mono)' }}>{row.raw_pattern}</td>
                        <td style={{ ...styles.td, fontWeight: '700', color: 'var(--primary)' }}>{row.display_name}</td>
                        <td style={styles.td}>{row.card_last_digits || '—'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {previewRows.length > 10 && (
              <div style={styles.moreRowsText}>
                +{previewRows.length - 10} שורות נוספות שייובאו בהצלחה
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Table Toolbar & List */}
      <div style={styles.tableCard}>
        <div style={styles.tableToolbar}>
          <div style={styles.searchWrap}>
            <Search size={16} color="var(--text-muted)" />
            <input
              style={styles.searchInput}
              type="text"
              placeholder={t('searchTable', language)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button style={styles.addBtn} onClick={handleOpenAddModal}>
            <Plus size={16} />
            <span>
              {activeSubTab === 'expenses'
                ? t('btnAddExpenseCat', language)
                : activeSubTab === 'incomes'
                ? t('btnAddIncomeCat', language)
                : activeSubTab === 'merchants'
                ? t('btnAddRule', language)
                : t('btnAddCardMapping', language)}
            </span>
          </button>
        </div>

        {/* Dynamic Table Body */}
        <div style={styles.tableResponsive}>
          <table style={styles.table}>
            <thead>
              <tr>
                {activeSubTab === 'expenses' || activeSubTab === 'incomes' ? (
                  <>
                    <th style={styles.th}>{t('colCategoryName', language)}</th>
                    <th style={styles.th}>{t('colType', language)}</th>
                    <th style={styles.th}>{t('colColor', language)}</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>{t('colActions', language)}</th>
                  </>
                ) : activeSubTab === 'merchants' ? (
                  <>
                    <th style={styles.th}>{t('colMerchantPattern', language)}</th>
                    <th style={styles.th}>{t('colTargetCategory', language)}</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>{t('colActions', language)}</th>
                  </>
                ) : (
                  <>
                    <th style={styles.th}>{t('colRawCardName', language)}</th>
                    <th style={styles.th}>{t('colDisplayCardName', language)}</th>
                    <th style={styles.th}>{t('colLastDigits', language)}</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>{t('colActions', language)}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {activeSubTab === 'expenses' &&
                filteredExpenses.map((cat) => (
                  <tr key={cat.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={styles.catCell}>
                        <span style={{ ...styles.colorPreviewDot, backgroundColor: cat.color }} />
                        <span style={styles.cellBold}>{formatCategoryName(cat.name, language)}</span>
                        {cat.is_system && <span style={styles.systemTag}>מערכת</span>}
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.expenseTag}>הוצאה</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{cat.color}</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <div style={styles.actionButtons}>
                        <button
                          style={styles.editBtn}
                          onClick={() => handleOpenEditModal(cat)}
                          title="ערוך"
                        >
                          <Edit3 size={14} color="var(--primary)" />
                        </button>
                        <button
                          style={styles.deleteBtn}
                          onClick={() => handleDeleteItem(cat)}
                          title="מחק"
                        >
                          <Trash2 size={14} color="var(--danger)" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

              {activeSubTab === 'incomes' &&
                filteredIncomes.map((cat) => (
                  <tr key={cat.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={styles.catCell}>
                        <span style={{ ...styles.colorPreviewDot, backgroundColor: cat.color }} />
                        <span style={styles.cellBold}>{formatCategoryName(cat.name, language)}</span>
                        {cat.is_system && <span style={styles.systemTag}>מערכת</span>}
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.incomeTag}>הכנסה</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{cat.color}</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <div style={styles.actionButtons}>
                        <button
                          style={styles.editBtn}
                          onClick={() => handleOpenEditModal(cat)}
                          title="ערוך"
                        >
                          <Edit3 size={14} color="var(--primary)" />
                        </button>
                        <button
                          style={styles.deleteBtn}
                          onClick={() => handleDeleteItem(cat)}
                          title="מחק"
                        >
                          <Trash2 size={14} color="var(--danger)" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

              {activeSubTab === 'merchants' &&
                filteredMerchants.map((rule) => {
                  const cat = categories.find((c) => c.id === rule.category_id);
                  return (
                    <tr key={rule.id} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={styles.patternBox}>
                          <Sparkles size={13} color="var(--primary)" />
                          <span style={styles.patternText}>{rule.pattern}</span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        {cat ? (
                          <span
                            style={{
                              ...styles.categoryBadge,
                              backgroundColor: `${cat.color}15`,
                              borderColor: `${cat.color}40`,
                              color: cat.color,
                            }}
                          >
                            <span style={{ ...styles.colorPreviewDot, backgroundColor: cat.color }} />
                            {formatCategoryName(cat.name, language)}
                          </span>
                        ) : (
                          <span style={styles.unknownCategory}>ללא קטגוריה</span>
                        )}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <div style={styles.actionButtons}>
                          <button
                            style={styles.editBtn}
                            onClick={() => handleOpenEditModal(rule)}
                            title="ערוך"
                          >
                            <Edit3 size={14} color="var(--primary)" />
                          </button>
                          <button
                            style={styles.deleteBtn}
                            onClick={() => handleDeleteItem(rule)}
                            title="מחק"
                          >
                            <Trash2 size={14} color="var(--danger)" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {activeSubTab === 'cards' &&
                filteredCards.map((card) => (
                  <tr key={card.id} style={styles.tr}>
                    <td style={styles.td}>
                      <span style={styles.rawCardText}>{card.raw_pattern}</span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.displayCardWrap}>
                        <CreditCard size={15} color={card.color || 'var(--primary)'} />
                        <span style={styles.displayCardName}>{card.display_name}</span>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.digitsBadge}>{card.card_last_digits ? `•••• ${card.card_last_digits}` : '—'}</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <div style={styles.actionButtons}>
                        <button
                          style={styles.editBtn}
                          onClick={() => handleOpenEditModal(card)}
                          title="ערוך"
                        >
                          <Edit3 size={14} color="var(--primary)" />
                        </button>
                        <button
                          style={styles.deleteBtn}
                          onClick={() => handleDeleteItem(card)}
                          title="מחק"
                        >
                          <Trash2 size={14} color="var(--danger)" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isAddModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard} className="animate-fade-in">
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {editingItem ? t('editItemTitle', language) : t('newItemTitle', language)}
              </h3>
              <button style={styles.closeBtn} onClick={() => setIsAddModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveModal}>
              {activeSubTab === 'expenses' || activeSubTab === 'incomes' ? (
                <>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>{t('colCategoryName', language)}</label>
                    <input
                      style={styles.input}
                      type="text"
                      placeholder="לדוגמה: הוצאות רכב, מכולת, שכר דירה"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>{t('colColor', language)}</label>
                    <div style={styles.colorPickerRow}>
                      {['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#EF4444', '#8B5CF6', '#06B6D4', '#64748B'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          style={{
                            ...styles.colorCircle,
                            backgroundColor: c,
                            outline: formColor === c ? '3px solid var(--text-primary)' : 'none',
                          }}
                          onClick={() => setFormColor(c)}
                        />
                      ))}
                    </div>
                  </div>
                </>
              ) : activeSubTab === 'merchants' ? (
                <>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>{t('colMerchantPattern', language)}</label>
                    <input
                      style={styles.input}
                      type="text"
                      placeholder="לדוגמה: SHUFERSAL, WOLT, AM:PM, BIT"
                      value={formPattern}
                      onChange={(e) => setFormPattern(e.target.value)}
                      required
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>{t('colTargetCategory', language)}</label>
                    <select
                      style={styles.select}
                      value={formTargetCatId}
                      onChange={(e) => setFormTargetCatId(e.target.value)}
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {formatCategoryName(cat.name, language)} ({cat.type === 'expense' ? 'הוצאה' : 'הכנסה'})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>{t('colRawCardName', language)}</label>
                    <input
                      style={styles.input}
                      type="text"
                      placeholder="לדוגמה: כרטיס ויזה כאל 1234 או ישראכרט"
                      value={formRawCard}
                      onChange={(e) => setFormRawCard(e.target.value)}
                      required
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>{t('colDisplayCardName', language)}</label>
                    <input
                      style={styles.input}
                      type="text"
                      placeholder="לדוגמה: ויזה כאל זהב (אישי מיכאל)"
                      value={formDisplayName}
                      onChange={(e) => setFormDisplayName(e.target.value)}
                      required
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>{t('colLastDigits', language)}</label>
                    <input
                      style={styles.input}
                      type="text"
                      maxLength={4}
                      placeholder="לדוגמה: 1234"
                      value={formLastDigits}
                      onChange={(e) => setFormLastDigits(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.modalCancelBtn}
                  onClick={() => setIsAddModalOpen(false)}
                >
                  {t('cancel', language)}
                </button>
                <button type="submit" style={styles.modalSaveBtn}>
                  {t('save', language)}
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
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
  },
  pageTitle: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  pageSub: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginTop: '4px',
  },
  tabNav: {
    display: 'flex',
    gap: '10px',
    borderBottom: '1px solid var(--border-main)',
    paddingBottom: '12px',
    overflowX: 'auto',
  },
  subTabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 18px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-main)',
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  },
  subTabBtnActive: {
    backgroundColor: 'var(--primary)',
    borderColor: 'var(--primary)',
    color: '#FFFFFF',
    boxShadow: 'var(--shadow-sm)',
  },
  countBadge: {
    padding: '2px 8px',
    borderRadius: '12px',
    backgroundColor: 'rgba(0,0,0,0.08)',
    fontSize: '0.75rem',
    fontWeight: '700',
  },
  uploadSection: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '20px',
    boxShadow: 'var(--shadow-sm)',
  },
  uploadHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
  },
  uploadTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  uploadHeading: {
    fontSize: '0.9375rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  uploadSub: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  uploadActionsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  templateBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    color: 'var(--text-secondary)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  fileInputLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    fontSize: '0.8125rem',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
  },
  errorBanner: {
    marginTop: '12px',
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--danger-light)',
    color: 'var(--danger-text)',
    fontSize: '0.8125rem',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  previewContainer: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '2px solid var(--primary)',
    padding: '20px',
    boxShadow: 'var(--shadow-md)',
  },
  previewHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  previewInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  previewTitleText: {
    display: 'block',
    fontSize: '0.9375rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  previewSubText: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
  },
  previewActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  cancelPreviewBtn: {
    padding: '8px 14px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  confirmImportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 18px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--success)',
    color: '#FFFFFF',
    fontSize: '0.8125rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
  previewTableWrapper: {
    overflowX: 'auto',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
  },
  tableCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
  },
  tableToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-main)',
    flexWrap: 'wrap',
    gap: '12px',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 12px',
    minWidth: '260px',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    fontSize: '0.8125rem',
    color: 'var(--text-primary)',
    width: '100%',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    fontSize: '0.8125rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  tableResponsive: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'right',
  },
  th: {
    padding: '12px 18px',
    backgroundColor: 'var(--bg-surface-subtle)',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border-main)',
  },
  tr: {
    borderBottom: '1px solid var(--border-main)',
    transition: 'background-color 0.15s ease',
  },
  td: {
    padding: '14px 18px',
    fontSize: '0.8125rem',
    color: 'var(--text-primary)',
  },
  catCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  cellBold: {
    fontWeight: '700',
  },
  colorPreviewDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  systemTag: {
    fontSize: '0.6875rem',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-surface-subtle)',
    color: 'var(--text-muted)',
  },
  expenseTag: {
    fontSize: '0.75rem',
    padding: '3px 8px',
    borderRadius: '4px',
    backgroundColor: 'var(--danger-light)',
    color: 'var(--danger-text)',
    fontWeight: '600',
  },
  incomeTag: {
    fontSize: '0.75rem',
    padding: '3px 8px',
    borderRadius: '4px',
    backgroundColor: 'var(--success-light)',
    color: 'var(--success-text)',
    fontWeight: '600',
  },
  patternBox: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'var(--bg-surface-subtle)',
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid var(--border-main)',
  },
  patternText: {
    fontFamily: 'var(--font-mono)',
    fontWeight: '700',
    fontSize: '0.8125rem',
  },
  categoryBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  unknownCategory: {
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
  },
  rawCardText: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8125rem',
  },
  displayCardWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  displayCardName: {
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  digitsBadge: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  actionButtons: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  editBtn: {
    padding: '6px',
    borderRadius: '4px',
    backgroundColor: 'var(--primary-light)',
    border: 'none',
    cursor: 'pointer',
  },
  deleteBtn: {
    padding: '6px',
    borderRadius: '4px',
    backgroundColor: 'var(--danger-light)',
    border: 'none',
    cursor: 'pointer',
  },
  moreRowsText: {
    padding: '10px',
    textAlign: 'center',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-surface-subtle)',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modalCard: {
    width: '100%',
    maxWidth: '460px',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    boxShadow: 'var(--shadow-xl)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  modalTitle: {
    fontSize: '1.125rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  closeBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    padding: '9px 12px',
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  select: {
    width: '100%',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    padding: '9px 12px',
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  colorPickerRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  colorCircle: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '24px',
  },
  modalCancelBtn: {
    padding: '9px 16px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface-subtle)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-main)',
    cursor: 'pointer',
  },
  modalSaveBtn: {
    padding: '9px 20px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    fontSize: '0.8125rem',
    fontWeight: '700',
    border: 'none',
    cursor: 'pointer',
  },
};
