import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Layers,
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
  EyeOff,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Filter,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { t, formatCategoryName } from '../../lib/i18n';
import { Category, BusinessMapping, CardMapping, MacroCategory } from '../../lib/types';

type SystemTab = 'macros' | 'expenses' | 'incomes' | 'merchants' | 'cards';

export const SystemTablesScreen: React.FC = () => {
  const {
    macroCategories,
    categories,
    businessMappings,
    cardMappings,
    addMacroCategory,
    updateMacroCategory,
    deleteMacroCategory,
    batchAddMacroCategories,
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
    seedDefaultHouseholdData,
    showHiddenNotice,
    setShowHiddenNotice,
    language,
    dir,
  } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<SystemTab>('macros');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [macroFilter, setMacroFilter] = useState<string>('all');
  const [macroTypeFilter, setMacroTypeFilter] = useState<string>('all');

  const [isSeeding, setIsSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  // Modals for CRUD
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Form states for manual Add/Edit
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#4F46E5');
  const [formIcon, setFormIcon] = useState('ShoppingBag');
  const [formMacroType, setFormMacroType] = useState<'expense' | 'income'>('expense');
  const [formDisplayOrder, setFormDisplayOrder] = useState(1);
  const [formMacroId, setFormMacroId] = useState<string>('');
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

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const incomeCategories = categories.filter((c) => c.type === 'income');

  // Reset all filters & sorting
  const handleResetFilters = () => {
    setSearchQuery('');
    setSortField('');
    setSortDirection('asc');
    setCategoryFilter('all');
    setMacroFilter('all');
    setMacroTypeFilter('all');
  };

  const handleSwitchTab = (tab: SystemTab) => {
    setActiveSubTab(tab);
    setPreviewRows(null);
    handleResetFilters();
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // 1. MACROS (Filtered & Sorted)
  let processedMacros = macroCategories.filter((m) => {
    const matchesSearch =
      !searchQuery ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.type === 'expense' ? 'הוצאה' : 'הכנסה').includes(searchQuery);
    const matchesType = macroTypeFilter === 'all' || m.type === macroTypeFilter;
    return matchesSearch && matchesType;
  });

  if (sortField) {
    processedMacros = [...processedMacros].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name, 'he');
      } else if (sortField === 'type') {
        cmp = a.type.localeCompare(b.type);
      } else if (sortField === 'display_order') {
        cmp = (a.display_order ?? 0) - (b.display_order ?? 0);
      } else if (sortField === 'linkedCount') {
        const aCount = categories.filter((c) => c.macro_category_id === a.id).length;
        const bCount = categories.filter((c) => c.macro_category_id === b.id).length;
        cmp = aCount - bCount;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }

  // 2. EXPENSES (Filtered & Sorted)
  let processedExpenses = expenseCategories.filter((c) => {
    const matchesSearch =
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      formatCategoryName(c.name, language).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.macro_category_id &&
        macroCategories
          .find((m) => m.id === c.macro_category_id)
          ?.name.toLowerCase()
          .includes(searchQuery.toLowerCase()));
    const matchesMacro = macroFilter === 'all' || c.macro_category_id === macroFilter;
    return matchesSearch && matchesMacro;
  });

  if (sortField) {
    processedExpenses = [...processedExpenses].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        const aName = formatCategoryName(a.name, language);
        const bName = formatCategoryName(b.name, language);
        cmp = aName.localeCompare(bName, 'he');
      } else if (sortField === 'macro') {
        const aMacro = macroCategories.find((m) => m.id === a.macro_category_id)?.name || '';
        const bMacro = macroCategories.find((m) => m.id === b.macro_category_id)?.name || '';
        cmp = aMacro.localeCompare(bMacro, 'he');
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }

  // 3. INCOMES (Filtered & Sorted)
  let processedIncomes = incomeCategories.filter((c) => {
    const matchesSearch =
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      formatCategoryName(c.name, language).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.macro_category_id &&
        macroCategories
          .find((m) => m.id === c.macro_category_id)
          ?.name.toLowerCase()
          .includes(searchQuery.toLowerCase()));
    const matchesMacro = macroFilter === 'all' || c.macro_category_id === macroFilter;
    return matchesSearch && matchesMacro;
  });

  if (sortField) {
    processedIncomes = [...processedIncomes].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        const aName = formatCategoryName(a.name, language);
        const bName = formatCategoryName(b.name, language);
        cmp = aName.localeCompare(bName, 'he');
      } else if (sortField === 'macro') {
        const aMacro = macroCategories.find((m) => m.id === a.macro_category_id)?.name || '';
        const bMacro = macroCategories.find((m) => m.id === b.macro_category_id)?.name || '';
        cmp = aMacro.localeCompare(bMacro, 'he');
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }

  // 4. MERCHANTS (Filtered & Sorted)
  let processedMerchants = businessMappings.filter((m) => {
    const cat = categories.find((c) => c.id === m.category_id);
    const catName = cat ? formatCategoryName(cat.name, language) : '';
    const matchesSearch =
      !searchQuery ||
      m.pattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
      catName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === 'all' ||
      m.category_id === categoryFilter ||
      (categoryFilter === 'uncategorized' && !m.category_id);
    return matchesSearch && matchesCategory;
  });

  if (sortField) {
    processedMerchants = [...processedMerchants].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'pattern') {
        cmp = a.pattern.localeCompare(b.pattern, 'he');
      } else if (sortField === 'category') {
        const aCat = categories.find((c) => c.id === a.category_id);
        const bCat = categories.find((c) => c.id === b.category_id);
        const aName = aCat ? formatCategoryName(aCat.name, language) : '';
        const bName = bCat ? formatCategoryName(bCat.name, language) : '';
        cmp = aName.localeCompare(bName, 'he');
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }

  // 5. CARDS (Filtered & Sorted)
  let processedCards = cardMappings.filter((c) => {
    const matchesSearch =
      !searchQuery ||
      c.raw_pattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.card_last_digits && c.card_last_digits.includes(searchQuery));
    return matchesSearch;
  });

  if (sortField) {
    processedCards = [...processedCards].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'raw_pattern') {
        cmp = a.raw_pattern.localeCompare(b.raw_pattern, 'he');
      } else if (sortField === 'display_name') {
        cmp = a.display_name.localeCompare(b.display_name, 'he');
      } else if (sortField === 'card_last_digits') {
        cmp = (a.card_last_digits || '').localeCompare(b.card_last_digits || '');
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }

  // Template Downloader
  const handleDownloadTemplate = () => {
    let csvContent = '';
    let fileName = '';

    if (activeSubTab === 'macros') {
      csvContent = '\uFEFFשם קבוצת על,סוג (הוצאה / הכנסה),צבע (HEX),אייקון,סדר תצוגה\nהוצאות קבועות (דיור ורכב),הוצאה,#4F46E5,Lock,1\nהוצאות משתנות (מזון ובילויים),הוצאה,#F59E0B,ShoppingBag,2\nהוצאות עונתיות ונופש,הוצאה,#EC4899,Calendar,3\nמשכורות והכנסות עיקריות,הכנסה,#10B981,Briefcase,4\nקצבאות ומענקים,הכנסה,#06B6D4,Gift,5\n';
      fileName = 'תבנית_קבוצות_על.csv';
    } else if (activeSubTab === 'expenses') {
      csvContent = '\uFEFFשם קטגוריה,קבוצת על,צבע (קוד HEX),אייקון\nסופרמרקט ומזון,הוצאות משתנות (מזון, בילויים, קניות),#10B981,shopping-cart\nביגוד והנעלה,הוצאות משתנות (מזון, בילויים, קניות),#EC4899,shirt\nשכירות ומשכנתה,הוצאות קבועות (דיור, רכב, ביטוח),#4F46E5,home\nנופש בחו"ל,הוצאות עונתיות, נופש ושנתיות,#8B5CF6,plane\n';
      fileName = 'תבנית_סוגי_הוצאות.csv';
    } else if (activeSubTab === 'incomes') {
      csvContent = '\uFEFFשם קטגוריית הכנסה,קבוצת על,צבע (קוד HEX),אייקון\nמשכורת ראשית,משכורות והכנסות עיקריות,#10B981,briefcase\nשכר דירה מהשקעה,קצבאות והכנסות נוספות,#4F46E5,building\nקצבאות ובונוסים,קצבאות והכנסות נוספות,#F59E0B,gift\n';
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
      if (activeSubTab === 'macros') {
        const normalized = rawData.map((row: any, idx: number) => {
          const name = row['שם קבוצת על'] || row['שם קבוצה'] || row['שם'] || row['Name'] || Object.values(row)[0];
          const typeStr = String(row['סוג (הוצאה / הכנסה)'] || row['סוג'] || row['Type'] || 'expense').toLowerCase();
          const type: 'expense' | 'income' = typeStr.includes('הכנסה') || typeStr === 'income' ? 'income' : 'expense';
          const color = row['צבע (HEX)'] || row['צבע'] || row['Color'] || (type === 'income' ? '#10B981' : '#4F46E5');
          const icon = row['אייקון'] || row['Icon'] || (type === 'income' ? 'Briefcase' : 'ShoppingBag');
          const order = Number(row['סדר תצוגה'] || row['סדר'] || row['Order'] || idx + 1);

          return {
            name: String(name || '').trim(),
            type,
            color,
            icon,
            display_order: order,
          };
        }).filter((r) => r.name);

        setPreviewRows(normalized);
      } else if (activeSubTab === 'expenses' || activeSubTab === 'incomes') {
        const normalized = rawData.map((row: any) => {
          const name = row['שם קטגוריה'] || row['שם קטגוריית הכנסה'] || row['שם'] || row['קטגוריה'] || row['Category'] || row['Name'] || Object.values(row)[0];
          const macroName = row['קבוצת על'] || row['קבוצה'] || row['Macro Group'] || row['Group'] || '';
          const color = row['צבע (קוד HEX)'] || row['צבע'] || row['Color'] || (activeSubTab === 'incomes' ? '#10B981' : '#4F46E5');
          const icon = row['אייקון'] || row['Icon'] || (activeSubTab === 'incomes' ? 'briefcase' : 'tag');
          
          // Match Macro Category ID
          const matchedMacro = macroCategories.find(
            (m) =>
              m.name.toLowerCase() === String(macroName || '').toLowerCase() ||
              m.name.toLowerCase().includes(String(macroName || '').toLowerCase())
          );

          return {
            name: String(name || '').trim(),
            macro_category_id: matchedMacro?.id || null,
            macro_name: matchedMacro?.name || macroName || (language === 'he' ? 'כללי' : 'General'),
            color,
            icon,
            type: activeSubTab === 'incomes' ? 'income' : 'expense',
          };
        }).filter((r) => r.name);

        setPreviewRows(normalized);
      } else if (activeSubTab === 'merchants') {
        const normalized = rawData.map((row: any) => {
          const pattern = row['שם בית עסק / מילת מפתח'] || row['בית עסק'] || row['מילת מפתח'] || row['תבנית'] || row['Pattern'] || row['Merchant'] || Object.values(row)[0];
          const catName = row['קטגוריית יעד'] || row['קטגוריה'] || row['סוג הוצאה'] || row['Category'] || Object.values(row)[1];
          
          const matchedCat = categories.find(
            (c) =>
              c.name.toLowerCase() === String(catName || '').toLowerCase() ||
              formatCategoryName(c.name, 'he').toLowerCase() === String(catName || '').toLowerCase()
          );

          return {
            pattern: String(pattern || '').toUpperCase().trim(),
            category_id: matchedCat?.id || categories[0]?.id || '',
            category_name: matchedCat ? formatCategoryName(matchedCat.name, language) : String(catName || 'ללא סיווג'),
          };
        }).filter((r) => r.pattern);

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
        }).filter((r) => r.raw_pattern);

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

    if (activeSubTab === 'macros') {
      batchAddMacroCategories(previewRows);
    } else if (activeSubTab === 'expenses' || activeSubTab === 'incomes') {
      batchAddCategories(previewRows);
    } else if (activeSubTab === 'merchants') {
      batchAddBusinessMappings(
        previewRows.map((r) => ({ pattern: r.pattern, category_id: r.category_id }))
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
    setFormIcon(activeSubTab === 'incomes' ? 'Briefcase' : 'ShoppingBag');
    setFormMacroType(activeSubTab === 'incomes' ? 'income' : 'expense');
    setFormDisplayOrder(macroCategories.length + 1);

    const defaultMacro = macroCategories.find((m) =>
      activeSubTab === 'incomes' ? m.type === 'income' : m.type === 'expense'
    );
    setFormMacroId(defaultMacro?.id || '');

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
    if (activeSubTab === 'macros') {
      setFormName(item.name);
      setFormMacroType(item.type);
      setFormColor(item.color || '#4F46E5');
      setFormIcon(item.icon || 'ShoppingBag');
      setFormDisplayOrder(item.display_order || 1);
    } else if (activeSubTab === 'expenses' || activeSubTab === 'incomes') {
      setFormName(item.name);
      setFormColor(item.color || '#4F46E5');
      setFormIcon(item.icon || 'tag');
      setFormMacroId(item.macro_category_id || '');
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
      if (activeSubTab === 'macros') {
        updateMacroCategory(editingItem.id, formName, formColor, formIcon, formDisplayOrder);
      } else if (activeSubTab === 'expenses' || activeSubTab === 'incomes') {
        updateCategory(editingItem.id, formName, formColor, formIcon, formMacroId || null);
      } else if (activeSubTab === 'merchants') {
        updateBusinessMapping(editingItem.id, formPattern, formTargetCatId);
      } else if (activeSubTab === 'cards') {
        updateCardMapping(editingItem.id, formRawCard, formDisplayName, formLastDigits, formColor);
      }
    } else {
      // Add
      if (activeSubTab === 'macros') {
        addMacroCategory(formName, formMacroType, formColor, formIcon, formDisplayOrder);
      } else if (activeSubTab === 'expenses') {
        addCategory(formName, 'expense', formColor, formIcon, formMacroId || null);
      } else if (activeSubTab === 'incomes') {
        addCategory(formName, 'income', formColor, formIcon, formMacroId || null);
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
      if (activeSubTab === 'macros') {
        deleteMacroCategory(item.id);
      } else if (activeSubTab === 'expenses' || activeSubTab === 'incomes') {
        deleteCategory(item.id);
      } else if (activeSubTab === 'merchants') {
        deleteBusinessMapping(item.id);
      } else if (activeSubTab === 'cards') {
        deleteCardMapping(item.id);
      }
    }
  };

  // Helper to render sortable column header with visual icons
  const renderSortableTh = (title: string, field: string, styleExtra?: React.CSSProperties) => {
    const isSorted = sortField === field;
    return (
      <th
        style={{
          ...styles.th,
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'all 0.15s ease',
          backgroundColor: isSorted ? 'rgba(79, 70, 229, 0.08)' : undefined,
          color: isSorted ? 'var(--primary)' : 'var(--text-secondary)',
          ...styleExtra,
        }}
        onClick={() => handleSort(field)}
        title={language === 'he' ? `לחץ למיון לפי ${title}` : `Click to sort by ${title}`}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span>{title}</span>
          {isSorted ? (
            sortDirection === 'asc' ? (
              <ArrowUp size={13} color="var(--primary)" />
            ) : (
              <ArrowDown size={13} color="var(--primary)" />
            )
          ) : (
            <ArrowUpDown size={12} color="var(--text-muted)" style={{ opacity: 0.4 }} />
          )}
        </div>
      </th>
    );
  };

  return (
    <div style={styles.container}>
      {/* Top Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>{t('systemTablesTitle', language)}</h1>
          <p style={styles.pageSub}>{t('systemTablesSub', language)}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            style={styles.guideBtn}
            onClick={() => setShowSqlGuide(!showSqlGuide)}
          >
            <Sparkles size={16} color="var(--primary)" />
            <span>
              {language === 'he'
                ? 'סקריפט SQL ל-Supabase DB'
                : 'Supabase SQL Script'}
            </span>
          </button>

          <button
            style={styles.seedBtn}
            disabled={isSeeding}
            onClick={async () => {
              setIsSeeding(true);
              await seedDefaultHouseholdData();
              setIsSeeding(false);
              setSeedSuccess(true);
              setTimeout(() => setSeedSuccess(false), 4000);
            }}
          >
            <Sparkles size={16} />
            <span>
              {isSeeding
                ? language === 'he'
                  ? 'טוען נתונים...'
                  : 'Seeding...'
                : seedSuccess
                ? language === 'he'
                  ? '✓ נתונים נטענו בהצלחה!'
                  : '✓ Seeded Successfully!'
                : language === 'he'
                ? '✨ אתחל קבוצות על וסיווגים מומלצים'
                : '✨ Seed Default Categories'}
            </span>
          </button>
        </div>
      </div>

      {/* Supabase SQL Migration Guide Banner */}
      {showSqlGuide && (
        <div style={styles.sqlGuideCard} className="animate-fade-in">
          <div style={styles.sqlGuideHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--primary)" />
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                {language === 'he'
                  ? 'יצירת טבלאות קבוצות על והמרות ב-Supabase PostgreSQL'
                  : 'Create Macro Categories & Payment Tables in Supabase'}
              </strong>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                style={styles.copySqlBtn}
                onClick={() => {
                  const sql = `-- 1. Helper Functions (if not already created)
CREATE OR REPLACE FUNCTION public.get_user_households(user_uuid UUID)
RETURNS TABLE (household_id UUID)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
    SELECT hm.household_id FROM public.household_members hm WHERE hm.user_id = user_uuid;
$$;

CREATE OR REPLACE FUNCTION public.is_household_member(h_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.household_members hm
        WHERE hm.household_id = h_id AND hm.user_id = auth.uid()
    );
$$;

-- 2. Create Macro_Categories Table
CREATE TABLE IF NOT EXISTS public.macro_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
    color TEXT NOT NULL DEFAULT '#4F46E5',
    icon TEXT NOT NULL DEFAULT 'ShoppingBag',
    display_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_macro_categories_household ON public.macro_categories(household_id);
CREATE INDEX IF NOT EXISTS idx_macro_categories_type ON public.macro_categories(type);

ALTER TABLE public.macro_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view macro categories in their households" ON public.macro_categories;
CREATE POLICY "Users can view macro categories in their households"
    ON public.macro_categories FOR SELECT
    USING (household_id IN (SELECT public.get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Users can insert macro categories in their households" ON public.macro_categories;
CREATE POLICY "Users can insert macro categories in their households"
    ON public.macro_categories FOR INSERT
    WITH CHECK (household_id IN (SELECT public.get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Users can update macro categories in their households" ON public.macro_categories;
CREATE POLICY "Users can update macro categories in their households"
    ON public.macro_categories FOR UPDATE
    USING (household_id IN (SELECT public.get_user_households(auth.uid())))
    WITH CHECK (household_id IN (SELECT public.get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Users can delete macro categories in their households" ON public.macro_categories;
CREATE POLICY "Users can delete macro categories in their households"
    ON public.macro_categories FOR DELETE
    USING (household_id IN (SELECT public.get_user_households(auth.uid())));

-- 3. Link categories with macro_category_id
ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS macro_category_id UUID REFERENCES public.macro_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_categories_macro_cat ON public.categories(macro_category_id);

-- 4. Create Payment_Method_Mappings Table
CREATE TABLE IF NOT EXISTS public.payment_method_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    raw_pattern TEXT NOT NULL,
    display_name TEXT NOT NULL,
    card_last_digits TEXT,
    payment_type TEXT NOT NULL DEFAULT 'credit_card' CHECK (payment_type IN ('credit_card', 'bank_transfer', 'cash', 'standing_order', 'check', 'other')),
    color TEXT DEFAULT '#4F46E5',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_mappings_household ON public.payment_method_mappings(household_id);
CREATE INDEX IF NOT EXISTS idx_payment_mappings_pattern ON public.payment_method_mappings(raw_pattern);

ALTER TABLE public.payment_method_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view payment mappings in their households" ON public.payment_method_mappings;
CREATE POLICY "Users can view payment mappings in their households"
    ON public.payment_method_mappings FOR SELECT
    USING (household_id IN (SELECT public.get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Users can insert payment mappings in their households" ON public.payment_method_mappings;
CREATE POLICY "Users can insert payment mappings in their households"
    ON public.payment_method_mappings FOR INSERT
    WITH CHECK (household_id IN (SELECT public.get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Users can update payment mappings in their households" ON public.payment_method_mappings;
CREATE POLICY "Users can update payment mappings in their households"
    ON public.payment_method_mappings FOR UPDATE
    USING (household_id IN (SELECT public.get_user_households(auth.uid())))
    WITH CHECK (household_id IN (SELECT public.get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Users can delete payment mappings in their households" ON public.payment_method_mappings;
CREATE POLICY "Users can delete payment mappings in their households"
    ON public.payment_method_mappings FOR DELETE
    USING (household_id IN (SELECT public.get_user_households(auth.uid())));`;
                  navigator.clipboard.writeText(sql);
                  setSqlCopied(true);
                  setTimeout(() => setSqlCopied(false), 2500);
                }}
              >
                {sqlCopied ? '✓ הועתק ללוח!' : '📋 העתק סקריפט SQL'}
              </button>

              <a
                href="https://supabase.com/dashboard/project/hhrpcjkdkghnnqtqqqlo/sql/new"
                target="_blank"
                rel="noreferrer"
                style={styles.openSupabaseBtn}
              >
                🔗 פתח Supabase SQL Editor
              </a>
            </div>
          </div>
          <p style={styles.sqlGuideText}>
            {language === 'he'
              ? 'אם הטבלאות עדיין לא נוצרו ב-Supabase Database, לחץ על "העתק סקריפט SQL", פתח את ה-SQL Editor ב-Supabase והדבק להרצה מיידית (או השתמש בכפתור האתחול למעלה).'
              : 'If these tables are not yet created in your Supabase DB, copy this SQL and run it in the Supabase SQL Editor.'}
          </p>
        </div>
      )}

      {/* General Display Preferences Card */}
      <div style={styles.preferencesCard}>
        <div style={styles.prefLeft}>
          <div style={styles.prefIconWrap}>
            <EyeOff size={18} color="var(--primary)" />
          </div>
          <div>
            <div style={styles.prefTitle}>
              {language === 'he'
                ? 'אפשר ניהול והצגת תנועות מוסתרות (Soft-Delete)'
                : 'Enable Hidden Transactions Management & Visibility'}
            </div>
            <div style={styles.prefDesc}>
              {language === 'he'
                ? 'מציג את כפתור "הצג מוסתרות" בטבלת התנועות ואת אפשרות "שמור כתנועה מוסתרת" בטופסי הרישום'
                : 'Shows the "Show Hidden" button in the transactions list and the hidden checkbox in transaction forms'}
            </div>
          </div>
        </div>
        <label style={styles.switchLabel}>
          <input
            type="checkbox"
            checked={showHiddenNotice}
            onChange={(e) => setShowHiddenNotice(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: '700',
              color: showHiddenNotice ? 'var(--primary)' : 'var(--text-muted)',
            }}
          >
            {showHiddenNotice
              ? language === 'he'
                ? 'מופעל (מוצג במערכת)'
                : 'Enabled (Visible)'
              : language === 'he'
              ? 'כבוי (מוסתר כברירת מחדל)'
              : 'Disabled (Hidden by default)'}
          </span>
        </label>
      </div>

      {/* System Table Dropdown Selector */}
      <div style={styles.tableSelectorCard}>
        <div style={styles.tableSelectorHeader}>
          <div style={styles.tableSelectorIconWrap}>
            {activeSubTab === 'macros' ? (
              <Layers size={22} color="var(--primary)" />
            ) : activeSubTab === 'expenses' ? (
              <FolderTree size={22} color="var(--primary)" />
            ) : activeSubTab === 'incomes' ? (
              <Tag size={22} color="var(--primary)" />
            ) : activeSubTab === 'merchants' ? (
              <ArrowRightLeft size={22} color="var(--primary)" />
            ) : (
              <CreditCard size={22} color="var(--primary)" />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.tableSelectorLabel}>
              {language === 'he' ? 'בחר טבלת מערכת לעריכה וניהול:' : 'Select System Table to Manage:'}
            </label>
            <div style={styles.selectDropdownWrap}>
              <select
                style={styles.tableSelectDropdown}
                value={activeSubTab}
                onChange={(e) => handleSwitchTab(e.target.value as SystemTab)}
              >
                <option value="macros">
                  {language === 'he'
                    ? `1. קבוצות על (הוצאות קבועות / משתנות) — [${macroCategories.length} פריטים]`
                    : `1. Macro Groups (Fixed / Variable) — [${macroCategories.length} items]`}
                </option>
                <option value="expenses">
                  {language === 'he'
                    ? `2. סוגי הוצאות וקטגוריות — [${expenseCategories.length} פריטים]`
                    : `2. Expense Categories — [${expenseCategories.length} items]`}
                </option>
                <option value="incomes">
                  {language === 'he'
                    ? `3. סוגי הכנסות — [${incomeCategories.length} פריטים]`
                    : `3. Income Categories — [${incomeCategories.length} items]`}
                </option>
                <option value="merchants">
                  {language === 'he'
                    ? `4. טבלת המרה מבית עסק לסוג הוצאה (כללי סיווג) — [${businessMappings.length} כללים]`
                    : `4. Merchant to Category Auto-Mapping — [${businessMappings.length} rules]`}
                </option>
                <option value="cards">
                  {language === 'he'
                    ? `5. טבלת כרטיסי אשראי ומקורות תשלום — [${cardMappings.length} כרטיסים]`
                    : `5. Credit Cards & Payment Sources — [${cardMappings.length} cards]`}
                </option>
              </select>
              <div style={styles.selectChevron}>
                <ChevronDown size={18} color="var(--primary)" />
              </div>
            </div>
          </div>
          <div style={styles.tableActiveBadge}>
            <span style={styles.activeBadgeCount}>
              {activeSubTab === 'macros'
                ? macroCategories.length
                : activeSubTab === 'expenses'
                ? expenseCategories.length
                : activeSubTab === 'incomes'
                ? incomeCategories.length
                : activeSubTab === 'merchants'
                ? businessMappings.length
                : cardMappings.length}
            </span>
            <span style={styles.activeBadgeLabel}>
              {language === 'he' ? 'רשומות בטבלה' : 'records'}
            </span>
          </div>
        </div>
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
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </label>
          </div>
        </div>

        {uploadError && (
          <div style={styles.errorBanner}>
            <AlertCircle size={16} />
            <span>{uploadError}</span>
          </div>
        )}

        {isUploading && (
          <div style={styles.uploadingNotice}>
            <span>טוען ומנתח קובץ נתונים...</span>
          </div>
        )}
      </div>

      {/* Data Preview & Verification Modal */}
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
                  {activeSubTab === 'macros' ? (
                    <>
                      <th style={styles.th}>{t('colCategoryName', language)}</th>
                      <th style={styles.th}>{t('colType', language)}</th>
                      <th style={styles.th}>{t('colColor', language)}</th>
                      <th style={styles.th}>{t('colDisplayOrder', language)}</th>
                    </>
                  ) : activeSubTab === 'expenses' || activeSubTab === 'incomes' ? (
                    <>
                      <th style={styles.th}>{t('colCategoryName', language)}</th>
                      <th style={styles.th}>{t('colMacroCategory', language)}</th>
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
                    {activeSubTab === 'macros' ? (
                      <>
                        <td style={{ ...styles.td, fontWeight: '700' }}>{row.name}</td>
                        <td style={styles.td}>
                          <span style={row.type === 'income' ? styles.incomeTag : styles.expenseTag}>
                            {row.type === 'income' ? 'הכנסה' : 'הוצאה'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ ...styles.colorPreviewDot, backgroundColor: row.color }} />
                            {row.color}
                          </span>
                        </td>
                        <td style={styles.td}>{row.display_order}</td>
                      </>
                    ) : activeSubTab === 'expenses' || activeSubTab === 'incomes' ? (
                      <>
                        <td style={{ ...styles.td, fontWeight: '700' }}>{row.name}</td>
                        <td style={styles.td}>
                          <span style={styles.macroPill}>{row.macro_name}</span>
                        </td>
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
          <div style={styles.toolbarLeft}>
            {/* Search Input */}
            <div style={styles.searchWrap}>
              <Search size={16} color="var(--text-muted)" />
              <input
                style={styles.searchInput}
                type="text"
                placeholder={t('searchTable', language)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                  onClick={() => setSearchQuery('')}
                >
                  <X size={14} color="var(--text-muted)" />
                </button>
              )}
            </div>

            {/* Filter Dropdown for Merchants (Target Category) */}
            {activeSubTab === 'merchants' && (
              <div style={styles.filterWrap}>
                <Filter size={14} color="var(--text-muted)" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={styles.filterSelect}
                >
                  <option value="all">{language === 'he' ? 'כל הקטגוריות' : 'All Categories'}</option>
                  <option value="uncategorized">{language === 'he' ? 'ללא קטגוריה' : 'Uncategorized'}</option>
                  {[...categories]
                    .sort((a, b) =>
                      formatCategoryName(a.name, language).localeCompare(
                        formatCategoryName(b.name, language),
                        'he'
                      )
                    )
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {formatCategoryName(cat.name, language)} ({cat.type === 'expense' ? 'הוצאה' : 'הכנסה'})
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Filter Dropdown for Expenses (Macro Group) */}
            {activeSubTab === 'expenses' && (
              <div style={styles.filterWrap}>
                <Filter size={14} color="var(--text-muted)" />
                <select
                  value={macroFilter}
                  onChange={(e) => setMacroFilter(e.target.value)}
                  style={styles.filterSelect}
                >
                  <option value="all">{language === 'he' ? 'כל קבוצות העל' : 'All Macro Groups'}</option>
                  {macroCategories
                    .filter((m) => m.type === 'expense')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Filter Dropdown for Incomes (Macro Group) */}
            {activeSubTab === 'incomes' && (
              <div style={styles.filterWrap}>
                <Filter size={14} color="var(--text-muted)" />
                <select
                  value={macroFilter}
                  onChange={(e) => setMacroFilter(e.target.value)}
                  style={styles.filterSelect}
                >
                  <option value="all">{language === 'he' ? 'כל קבוצות העל' : 'All Macro Groups'}</option>
                  {macroCategories
                    .filter((m) => m.type === 'income')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Filter Dropdown for Macros (Type: Expense / Income) */}
            {activeSubTab === 'macros' && (
              <div style={styles.filterWrap}>
                <Filter size={14} color="var(--text-muted)" />
                <select
                  value={macroTypeFilter}
                  onChange={(e) => setMacroTypeFilter(e.target.value)}
                  style={styles.filterSelect}
                >
                  <option value="all">{language === 'he' ? 'כל הסוגים' : 'All Types'}</option>
                  <option value="expense">{language === 'he' ? 'הוצאות בלבד' : 'Expenses only'}</option>
                  <option value="income">{language === 'he' ? 'הכנסות בלבד' : 'Income only'}</option>
                </select>
              </div>
            )}

            {/* Clear Filters & Sort Button */}
            {(searchQuery ||
              categoryFilter !== 'all' ||
              macroFilter !== 'all' ||
              macroTypeFilter !== 'all' ||
              sortField) && (
              <button
                type="button"
                onClick={handleResetFilters}
                style={styles.clearFilterBtn}
                title={language === 'he' ? 'נקה סינונים ואיפוס מיון' : 'Clear filters & reset sort'}
              >
                <RotateCcw size={13} />
                <span>{language === 'he' ? 'נקה סינון' : 'Clear'}</span>
              </button>
            )}

            {/* Results Count Pill */}
            <span style={styles.countPill}>
              {activeSubTab === 'macros'
                ? language === 'he'
                  ? `מציג ${processedMacros.length} מתוך ${macroCategories.length}`
                  : `Showing ${processedMacros.length} of ${macroCategories.length}`
                : activeSubTab === 'expenses'
                ? language === 'he'
                  ? `מציג ${processedExpenses.length} מתוך ${expenseCategories.length}`
                  : `Showing ${processedExpenses.length} of ${expenseCategories.length}`
                : activeSubTab === 'incomes'
                ? language === 'he'
                  ? `מציג ${processedIncomes.length} מתוך ${incomeCategories.length}`
                  : `Showing ${processedIncomes.length} of ${incomeCategories.length}`
                : activeSubTab === 'merchants'
                ? language === 'he'
                  ? `מציג ${processedMerchants.length} מתוך ${businessMappings.length}`
                  : `Showing ${processedMerchants.length} of ${businessMappings.length}`
                : language === 'he'
                ? `מציג ${processedCards.length} מתוך ${cardMappings.length}`
                : `Showing ${processedCards.length} of ${cardMappings.length}`}
            </span>
          </div>

          <button style={styles.addBtn} onClick={handleOpenAddModal}>
            <Plus size={16} />
            <span>
              {activeSubTab === 'macros'
                ? t('btnAddMacroCat', language)
                : activeSubTab === 'expenses'
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
                {activeSubTab === 'macros' ? (
                  <>
                    {renderSortableTh(t('colCategoryName', language), 'name')}
                    {renderSortableTh(t('colType', language), 'type')}
                    <th style={styles.th}>{t('colColor', language)}</th>
                    {renderSortableTh(t('colDisplayOrder', language), 'display_order')}
                    {renderSortableTh(t('colLinkedCategories', language), 'linkedCount')}
                    <th style={{ ...styles.th, textAlign: 'center' }}>{t('colActions', language)}</th>
                  </>
                ) : activeSubTab === 'expenses' || activeSubTab === 'incomes' ? (
                  <>
                    {renderSortableTh(t('colCategoryName', language), 'name')}
                    {renderSortableTh(t('colMacroCategory', language), 'macro')}
                    {renderSortableTh(t('colType', language), 'type')}
                    <th style={styles.th}>{t('colColor', language)}</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>{t('colActions', language)}</th>
                  </>
                ) : activeSubTab === 'merchants' ? (
                  <>
                    {renderSortableTh(t('colMerchantPattern', language), 'pattern')}
                    {renderSortableTh(t('colTargetCategory', language), 'category')}
                    <th style={{ ...styles.th, textAlign: 'center' }}>{t('colActions', language)}</th>
                  </>
                ) : (
                  <>
                    {renderSortableTh(t('colRawCardName', language), 'raw_pattern')}
                    {renderSortableTh(t('colDisplayCardName', language), 'display_name')}
                    {renderSortableTh(t('colLastDigits', language), 'card_last_digits')}
                    <th style={{ ...styles.th, textAlign: 'center' }}>{t('colActions', language)}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {/* 1. MACRO CATEGORIES TABLE */}
              {activeSubTab === 'macros' &&
                (processedMacros.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={styles.emptyTableTd}>
                      {language === 'he'
                        ? 'לא נמצאו קבוצות על תואמות לחיפוש או הסינון'
                        : 'No macro groups found matching search/filter'}
                    </td>
                  </tr>
                ) : (
                  processedMacros.map((macro) => {
                    const linkedCount = categories.filter((c) => c.macro_category_id === macro.id).length;
                    return (
                      <tr key={macro.id} style={styles.tr}>
                        <td style={styles.td}>
                          <div style={styles.catCell}>
                            <span style={{ ...styles.colorPreviewDot, backgroundColor: macro.color }} />
                            <span style={styles.cellBold}>{macro.name}</span>
                          </div>
                        </td>
                        <td style={styles.td}>
                          <span style={macro.type === 'income' ? styles.incomeTag : styles.expenseTag}>
                            {macro.type === 'income' ? 'הכנסה' : 'הוצאה'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                            {macro.color}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.orderBadge}>{macro.display_order || 1}</span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.linkedCountBadge}>
                            {linkedCount} {language === 'he' ? 'קטגוריות משויכות' : 'Categories'}
                          </span>
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <div style={styles.actionButtons}>
                            <button
                              style={styles.editBtn}
                              onClick={() => handleOpenEditModal(macro)}
                              title="ערוך"
                            >
                              <Edit3 size={14} color="var(--primary)" />
                            </button>
                            <button
                              style={styles.deleteBtn}
                              onClick={() => handleDeleteItem(macro)}
                              title="מחק"
                            >
                              <Trash2 size={14} color="var(--danger)" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ))}

              {/* 2. EXPENSE CATEGORIES TABLE */}
              {activeSubTab === 'expenses' &&
                (processedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={styles.emptyTableTd}>
                      {language === 'he'
                        ? 'לא נמצאו סוגי הוצאות תואמים לחיפוש או הסינון'
                        : 'No expense categories found matching search/filter'}
                    </td>
                  </tr>
                ) : (
                  processedExpenses.map((cat) => {
                    const linkedMacro = macroCategories.find((m) => m.id === cat.macro_category_id);
                    return (
                      <tr key={cat.id} style={styles.tr}>
                        <td style={styles.td}>
                          <div style={styles.catCell}>
                            <span style={{ ...styles.colorPreviewDot, backgroundColor: cat.color }} />
                            <span style={styles.cellBold}>{formatCategoryName(cat.name, language)}</span>
                            {cat.is_system && <span style={styles.systemTag}>מערכת</span>}
                          </div>
                        </td>
                        <td style={styles.td}>
                          {linkedMacro ? (
                            <span
                              style={{
                                ...styles.macroPill,
                                backgroundColor: `${linkedMacro.color}15`,
                                borderColor: `${linkedMacro.color}40`,
                                color: linkedMacro.color,
                              }}
                            >
                              <span style={{ ...styles.colorPreviewDot, backgroundColor: linkedMacro.color }} />
                              {linkedMacro.name}
                            </span>
                          ) : (
                            <span style={styles.unassignedMacro}>
                              {language === 'he' ? 'ללא שיוך (ברירת מחדל: משתנות)' : 'Unassigned (Variable)'}
                            </span>
                          )}
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
                    );
                  })
                ))}

              {/* 3. INCOME CATEGORIES TABLE */}
              {activeSubTab === 'incomes' &&
                (processedIncomes.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={styles.emptyTableTd}>
                      {language === 'he'
                        ? 'לא נמצאו סוגי הכנסות תואמים לחיפוש או הסינון'
                        : 'No income categories found matching search/filter'}
                    </td>
                  </tr>
                ) : (
                  processedIncomes.map((cat) => {
                    const linkedMacro = macroCategories.find((m) => m.id === cat.macro_category_id);
                    return (
                      <tr key={cat.id} style={styles.tr}>
                        <td style={styles.td}>
                          <div style={styles.catCell}>
                            <span style={{ ...styles.colorPreviewDot, backgroundColor: cat.color }} />
                            <span style={styles.cellBold}>{formatCategoryName(cat.name, language)}</span>
                            {cat.is_system && <span style={styles.systemTag}>מערכת</span>}
                          </div>
                        </td>
                        <td style={styles.td}>
                          {linkedMacro ? (
                            <span
                              style={{
                                ...styles.macroPill,
                                backgroundColor: `${linkedMacro.color}15`,
                                borderColor: `${linkedMacro.color}40`,
                                color: linkedMacro.color,
                              }}
                            >
                              <span style={{ ...styles.colorPreviewDot, backgroundColor: linkedMacro.color }} />
                              {linkedMacro.name}
                            </span>
                          ) : (
                            <span style={styles.unassignedMacro}>
                              {language === 'he' ? 'ללא שיוך' : 'Unassigned'}
                            </span>
                          )}
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
                    );
                  })
                ))}

              {/* 4. MERCHANT MAPPING RULES TABLE */}
              {activeSubTab === 'merchants' &&
                (processedMerchants.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={styles.emptyTableTd}>
                      {language === 'he'
                        ? 'לא נמצאו כללי שיוך בתי עסק תואמים לחיפוש או הסינון'
                        : 'No merchant rules found matching search/filter'}
                    </td>
                  </tr>
                ) : (
                  processedMerchants.map((rule) => {
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
                  })
                ))}

              {/* 5. CREDIT CARDS & EXPENSE SOURCES TABLE */}
              {activeSubTab === 'cards' &&
                (processedCards.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={styles.emptyTableTd}>
                      {language === 'he'
                        ? 'לא נמצאו מקורות תשלום תואמים לחיפוש או הסינון'
                        : 'No card sources found matching search/filter'}
                    </td>
                  </tr>
                ) : (
                  processedCards.map((card) => (
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
                        {card.card_last_digits ? (
                          <span style={styles.digitsBadge}>•••• {card.card_last_digits}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
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
                  ))
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Add / Edit Modal */}
      {isAddModalOpen && (
        <div style={styles.modalOverlay} className="animate-fade-in">
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {editingItem ? t('editItemTitle', language) : t('newItemTitle', language)}
              </h3>
              <button style={styles.closeBtn} onClick={() => setIsAddModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveModal}>
              {/* Form for MACROS */}
              {activeSubTab === 'macros' ? (
                <>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>{language === 'he' ? 'שם קבוצת על' : 'Macro Group Name'}</label>
                    <input
                      style={styles.input}
                      type="text"
                      placeholder="לדוגמה: הוצאות קבועות, הוצאות משתנות, הוצאות עונתיות"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>{language === 'he' ? 'סוג קבוצה' : 'Group Type'}</label>
                    <select
                      style={styles.select}
                      value={formMacroType}
                      onChange={(e) => setFormMacroType(e.target.value as 'expense' | 'income')}
                    >
                      <option value="expense">{language === 'he' ? 'הוצאה' : 'Expense'}</option>
                      <option value="income">{language === 'he' ? 'הכנסה' : 'Income'}</option>
                    </select>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>{language === 'he' ? 'סדר תצוגה במסך הראשי' : 'Display Order'}</label>
                    <input
                      style={styles.input}
                      type="number"
                      min={1}
                      max={99}
                      value={formDisplayOrder}
                      onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
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
              ) : activeSubTab === 'expenses' || activeSubTab === 'incomes' ? (
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
                    <label style={styles.label}>{t('colMacroCategory', language)}</label>
                    <select
                      style={styles.select}
                      value={formMacroId}
                      onChange={(e) => setFormMacroId(e.target.value)}
                    >
                      <option value="">{language === 'he' ? '— ללא שיוך (ברירת מחדל) —' : '— None (Default) —'}</option>
                      {macroCategories
                        .filter((m) => (activeSubTab === 'incomes' ? m.type === 'income' : m.type === 'expense'))
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                    </select>
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
  preferencesCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--bg-surface)',
    padding: '16px 20px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    boxShadow: 'var(--shadow-sm)',
    flexWrap: 'wrap',
    gap: '16px',
  },
  prefLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  prefIconWrap: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: 'var(--primary-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefTitle: {
    fontSize: '0.875rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  prefDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  switchLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    backgroundColor: 'var(--bg-surface-subtle)',
    padding: '8px 14px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
  },
  tableSelectorCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '16px 20px',
    boxShadow: 'var(--shadow-sm)',
  },
  tableSelectorHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  tableSelectorIconWrap: {
    width: '46px',
    height: '46px',
    borderRadius: '12px',
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tableSelectorLabel: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  selectDropdownWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    maxWidth: '580px',
  },
  tableSelectDropdown: {
    width: '100%',
    padding: '10px 16px',
    paddingLeft: '38px',
    fontSize: '0.9375rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '2px solid var(--primary)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-sm)',
    transition: 'all 0.2s ease',
  },
  selectChevron: {
    position: 'absolute',
    left: '12px',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
  },
  tableActiveBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 18px',
    flexShrink: 0,
  },
  activeBadgeCount: {
    fontSize: '1.25rem',
    fontWeight: '900',
    color: 'var(--primary)',
    lineHeight: 1.1,
  },
  activeBadgeLabel: {
    fontSize: '0.6875rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    marginTop: '2px',
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
  uploadingNotice: {
    marginTop: '12px',
    fontSize: '0.8125rem',
    color: 'var(--primary)',
    fontWeight: '600',
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
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 12px',
    minWidth: '220px',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    fontSize: '0.8125rem',
    color: 'var(--text-primary)',
    width: '100%',
  },
  filterWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 10px',
  },
  filterSelect: {
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  clearFilterBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    color: 'var(--text-secondary)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  countPill: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-surface-subtle)',
    padding: '4px 10px',
    borderRadius: '12px',
    border: '1px solid var(--border-main)',
  },
  emptyTableTd: {
    textAlign: 'center',
    padding: '36px 20px',
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
    fontWeight: '500',
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
  orderBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
  },
  linkedCountBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    fontSize: '0.75rem',
    fontWeight: '700',
  },
  macroPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid var(--border-main)',
    fontSize: '0.75rem',
    fontWeight: '700',
  },
  unassignedMacro: {
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontStyle: 'italic',
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
  guideBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    color: 'var(--text-primary)',
    fontSize: '0.8125rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
  seedBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    fontSize: '0.8125rem',
    fontWeight: '700',
    border: 'none',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
  },
  sqlGuideCard: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--primary)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px 20px',
    boxShadow: 'var(--shadow-sm)',
  },
  sqlGuideHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '8px',
  },
  copySqlBtn: {
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--primary-light)',
    border: '1px solid var(--primary)',
    color: 'var(--primary)',
    fontSize: '0.75rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
  openSupabaseBtn: {
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    color: 'var(--text-primary)',
    fontSize: '0.75rem',
    fontWeight: '700',
    textDecoration: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
  },
  sqlGuideText: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    margin: 0,
  },
};
