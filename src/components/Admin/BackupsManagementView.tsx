import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Database,
  Moon,
  Clock,
  Sparkles,
  RefreshCw,
  Download,
  Trash2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Search,
  Filter,
  Calendar,
  Layers,
  FileText,
  UploadCloud,
  Check,
  X,
  ChevronDown,
  Info,
} from 'lucide-react';
import { SystemBackupRecord, BackupType } from '../../lib/types';
import { formatDate } from '../../lib/i18n';
import {
  fetchBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
  downloadBackupFile,
  cleanOldBackups,
  getSavedRetentionDays,
  saveRetentionDays,
} from '../../lib/services/backupService';

export const BackupsManagementView: React.FC = () => {
  const { isSuperUser, activeHousehold, allSystemHouseholds, households, language } = useAuth();
  const isHe = language === 'he';

  const [backups, setBackups] = useState<SystemBackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHouseholdFilter, setSelectedHouseholdFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | BackupType>('all');

  // Retention Settings
  const [retentionDays, setRetentionDays] = useState<number>(getSavedRetentionDays());
  const [isRetentionSaved, setIsRetentionSaved] = useState(false);
  const [isCleaningOld, setIsCleaningOld] = useState(false);

  // Restore Modal State
  const [restoreModalBackup, setRestoreModalBackup] = useState<SystemBackupRecord | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgressMsg, setRestoreProgressMsg] = useState('');
  const [restoreProgressPct, setRestoreProgressPct] = useState(0);

  // Delete Confirmation Modal State
  const [deleteModalBackup, setDeleteModalBackup] = useState<SystemBackupRecord | null>(null);

  // Load backups on mount
  const loadBackupsData = async () => {
    setLoading(true);
    try {
      const data = await fetchBackups();
      setBackups(data);
    } catch (err: any) {
      setErrorBanner(err.message || 'שגיאה בטעינת הגיבויים');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackupsData();
  }, []);

  // Save retention days
  const handleSaveRetention = () => {
    saveRetentionDays(retentionDays);
    setIsRetentionSaved(true);
    setTimeout(() => setIsRetentionSaved(false), 3000);
  };

  // Clean old backups manually
  const handleCleanOld = async () => {
    if (
      !window.confirm(
        isHe
          ? `האם לנקות גיבויים ישנים יותר מ-${retentionDays} ימים? פעולה זו תסיר גיבויים היסטוריים עודפים.`
          : `Clean backups older than ${retentionDays} days?`
      )
    ) {
      return;
    }
    setIsCleaningOld(true);
    try {
      const cleaned = await cleanOldBackups(retentionDays);
      setSuccessBanner(
        isHe
          ? `ניקוי הושלם בהצלחה: הוסרו ${cleaned} גיבויים ישנים.`
          : `Cleaned ${cleaned} older backups.`
      );
      await loadBackupsData();
    } catch (err: any) {
      setErrorBanner(err.message || 'שגיאה בניקוי גיבויים');
    } finally {
      setIsCleaningOld(false);
    }
  };

  // Create manual backup
  const handleCreateManualBackup = async () => {
    setIsCreatingBackup(true);
    setErrorBanner(null);
    try {
      const newBkp = await createBackup({
        type: 'manual',
        householdId: selectedHouseholdFilter === 'all' ? 'all' : selectedHouseholdFilter,
        householdName:
          selectedHouseholdFilter === 'all'
            ? 'כלל המשפחות והמערכת'
            : households.find((h) => h.id === selectedHouseholdFilter)?.name || 'משק בית',
        retentionDays,
      });

      setSuccessBanner(
        isHe
          ? `גיבוי מלא נוצר בהצלחה! גודל: ${newBkp.file_size_kb} KB, נשמרו ${newBkp.total_rows.toLocaleString()} רשומות.`
          : `Full backup created successfully! ${newBkp.total_rows.toLocaleString()} records.`
      );
      await loadBackupsData();
    } catch (err: any) {
      setErrorBanner(err.message || 'שגיאה ביצירת הגיבוי');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // Handle Restore
  const handleConfirmRestore = async () => {
    if (!restoreModalBackup) return;
    setIsRestoring(true);
    setRestoreProgressPct(5);
    setRestoreProgressMsg(isHe ? 'מתחיל בתהליך השחזור...' : 'Starting restore...');

    try {
      const res = await restoreBackup(restoreModalBackup.id, (msg, pct) => {
        setRestoreProgressMsg(msg);
        setRestoreProgressPct(pct);
      });

      if (res.success) {
        setSuccessBanner(res.message);
        setRestoreModalBackup(null);
        await loadBackupsData();
      } else {
        setErrorBanner(res.message);
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'שגיאה בשחזור הגיבוי');
    } finally {
      setIsRestoring(false);
    }
  };

  // Handle Delete
  const handleConfirmDelete = async () => {
    if (!deleteModalBackup) return;
    try {
      const ok = await deleteBackup(deleteModalBackup.id);
      if (ok) {
        setSuccessBanner(isHe ? 'הגיבוי נמחק בהצלחה.' : 'Backup deleted successfully.');
        setBackups((prev) => prev.filter((b) => b.id !== deleteModalBackup.id));
      } else {
        setErrorBanner(isHe ? 'שגיאה במחיקת הגיבוי.' : 'Failed to delete backup.');
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'שגיאה במחיקת הגיבוי');
    } finally {
      setDeleteModalBackup(null);
    }
  };

  // Filter and sort backups (always descending: newest to oldest)
  const filteredBackups = useMemo(() => {
    return backups
      .filter((b) => {
        // Household filter
        if (selectedHouseholdFilter !== 'all') {
          if (b.household_id !== 'all' && b.household_id !== selectedHouseholdFilter) {
            return false;
          }
        }
        // Type filter
        if (selectedTypeFilter !== 'all' && b.type !== selectedTypeFilter) {
          return false;
        }
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchDate = b.date.includes(q);
          const matchHh = b.household_name.toLowerCase().includes(q);
          const matchId = b.id.toLowerCase().includes(q);
          if (!matchDate && !matchHh && !matchId) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Strict descending sort (newest to oldest)
        const dateComp = b.date.localeCompare(a.date);
        if (dateComp !== 0) return dateComp;
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
  }, [backups, selectedHouseholdFilter, selectedTypeFilter, searchQuery]);

  // Compute stats
  const totalBackupsCount = backups.length;
  const latestBackup = backups[0];
  const totalStorageKb = backups.reduce((s, b) => s + (b.file_size_kb || 0), 0);

  return (
    <div style={styles.container}>
      {/* Top Banner Alert / Messages */}
      {successBanner && (
        <div style={styles.successBanner} className="animate-fade-in">
          <CheckCircle2 size={18} color="#059669" />
          <span>{successBanner}</span>
          <button style={styles.closeBannerBtn} onClick={() => setSuccessBanner(null)}>
            <X size={15} />
          </button>
        </div>
      )}

      {errorBanner && (
        <div style={styles.errorBanner} className="animate-fade-in">
          <AlertTriangle size={18} color="#DC2626" />
          <span>{errorBanner}</span>
          <button style={styles.closeBannerBtn} onClick={() => setErrorBanner(null)}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Main KPI Stats Bar */}
      <div style={styles.kpiGrid}>
        {/* KPI 1: Nightly Automation Status */}
        <div style={styles.kpiCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ ...styles.kpiIconBox, backgroundColor: '#EFF6FF', color: '#2563EB' }}>
              <Moon size={22} />
            </div>
            <div>
              <div style={styles.kpiTitle}>{isHe ? 'גיבוי לילי מתוזמן' : 'Nightly Scheduled Backup'}</div>
              <div style={styles.kpiValue}>
                <span style={{ color: '#059669', fontSize: '1.05rem', fontWeight: '800' }}>
                  ✓ {isHe ? 'פעיל (03:00 בלילה)' : 'Active (03:00 AM)'}
                </span>
              </div>
              <div style={styles.kpiSub}>
                {isHe
                  ? 'רץ אוטומטית בכל לילה מיד בסיום סנכרון היתרות'
                  : 'Runs automatically after nightly bank sync'}
              </div>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Backups & Retention */}
        <div style={styles.kpiCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ ...styles.kpiIconBox, backgroundColor: '#F0FDF4', color: '#059669' }}>
              <Database size={22} />
            </div>
            <div>
              <div style={styles.kpiTitle}>{isHe ? 'גיבויים שמורים' : 'Saved Backups'}</div>
              <div style={styles.kpiValue}>
                {totalBackupsCount}{' '}
                <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: '500' }}>
                  ({Math.round(totalStorageKb / 1024 * 10) / 10} MB)
                </span>
              </div>
              <div style={styles.kpiSub}>
                {isHe ? `מדיניות שמירה: ${retentionDays} ימים אחרונים` : `Retention: last ${retentionDays} days`}
              </div>
            </div>
          </div>
        </div>

        {/* KPI 3: Latest Backup Timestamp */}
        <div style={styles.kpiCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ ...styles.kpiIconBox, backgroundColor: '#FAF5FF', color: '#7C3AED' }}>
              <Clock size={22} />
            </div>
            <div>
              <div style={styles.kpiTitle}>{isHe ? 'גיבוי אחרון שבוצע' : 'Latest Backup'}</div>
              <div style={styles.kpiValue}>
                {latestBackup ? formatDate(latestBackup.date) : isHe ? 'אין גיבוי' : 'None'}
              </div>
              <div style={styles.kpiSub}>
                {latestBackup
                  ? `${latestBackup.total_rows.toLocaleString()} ${isHe ? 'רשומות' : 'rows'} (${latestBackup.file_size_kb} KB)`
                  : isHe
                  ? 'טרם נוצר גיבוי'
                  : 'No backups yet'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Retention Policy Control Card */}
      <div style={styles.retentionCard}>
        <div style={styles.retentionLeft}>
          <div style={styles.retentionIconWrap}>
            <Calendar size={18} color="#2563EB" />
          </div>
          <div>
            <div style={styles.retentionTitle}>
              {isHe ? 'הגדרת מדיניות שמירת ימי גיבוי (Retention Policy)' : 'Retention Policy Configuration'}
            </div>
            <div style={styles.retentionSub}>
              {isHe
                ? `שמירה אוטומטית של X ימי גיבוי אחרונים לכל משפחה בסדר יורד מהחדש לישן. גיבויים ישנים יותר יימחקו אוטומטית.`
                : `Retains the last X days of backups per household in descending order. Older backups are purged.`}
            </div>
          </div>
        </div>

        <div style={styles.retentionActions}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>
              {isHe ? 'שמור ימים:' : 'Retain Days:'}
            </label>
            <select
              style={styles.retentionSelect}
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
            >
              <option value={7}>7 {isHe ? 'ימים' : 'days'}</option>
              <option value={14}>14 {isHe ? 'ימים' : 'days'}</option>
              <option value={30}>30 {isHe ? 'ימים (מומלץ)' : 'days (recommended)'}</option>
              <option value={60}>60 {isHe ? 'ימים' : 'days'}</option>
              <option value={90}>90 {isHe ? 'ימים' : 'days'}</option>
              <option value={180}>180 {isHe ? 'ימים' : 'days'}</option>
              <option value={365}>365 {isHe ? 'ימים (שנה)' : 'days (1 year)'}</option>
            </select>
          </div>

          <button
            type="button"
            style={styles.retentionSaveBtn}
            onClick={handleSaveRetention}
          >
            {isRetentionSaved ? <Check size={14} /> : <CheckCircle2 size={14} />}
            <span>{isRetentionSaved ? (isHe ? 'נשמר!' : 'Saved!') : isHe ? 'שמור הגדרה' : 'Save'}</span>
          </button>

          <button
            type="button"
            style={styles.cleanOldBtn}
            onClick={handleCleanOld}
            disabled={isCleaningOld}
            title={isHe ? 'נקה עכשיו גיבויים שחורגים מכמות הימים שהוגדרה' : 'Clean backups older than retention'}
          >
            <Trash2 size={14} />
            <span>{isCleaningOld ? (isHe ? 'מנקה...' : 'Cleaning...') : isHe ? 'נקה ישנים' : 'Purge Old'}</span>
          </button>
        </div>
      </div>

      {/* Action Bar & Filters */}
      <div style={styles.filterActionBar}>
        <div style={styles.filterLeft}>
          {/* Search Input */}
          <div style={styles.searchWrap}>
            <Search size={15} color="#94A3B8" />
            <input
              type="text"
              placeholder={isHe ? 'חפש לפי תאריך או שם...' : 'Search by date or name...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
            {searchQuery && (
              <button style={styles.clearSearchBtn} onClick={() => setSearchQuery('')}>
                <X size={13} />
              </button>
            )}
          </div>

          {/* Household Selector Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="#64748B" />
            <select
              style={styles.filterSelect}
              value={selectedHouseholdFilter}
              onChange={(e) => setSelectedHouseholdFilter(e.target.value)}
            >
              <option value="all">{isHe ? '🏢 כלל המשפחות והמערכת' : 'All Households'}</option>
              {(allSystemHouseholds.length > 0 ? allSystemHouseholds : households).map((hh) => (
                <option key={hh.id} value={hh.id}>
                  🏠 {hh.name}
                </option>
              ))}
            </select>
          </div>

          {/* Backup Type Filter */}
          <select
            style={styles.filterSelect}
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value as any)}
          >
            <option value="all">{isHe ? 'כל סוגי הגיבוי' : 'All Backup Types'}</option>
            <option value="scheduled_nightly">{isHe ? '🌙 גיבוי לילי אוטומטי' : 'Nightly Scheduled'}</option>
            <option value="manual">{isHe ? '⚡ גיבוי ידני יזום' : 'Manual Backup'}</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Refresh Button */}
          <button
            type="button"
            style={styles.refreshBtn}
            onClick={loadBackupsData}
            title={isHe ? 'רענן רשימה' : 'Refresh'}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Create Backup Button */}
          <button
            type="button"
            style={styles.createBackupBtn}
            onClick={handleCreateManualBackup}
            disabled={isCreatingBackup}
          >
            <Sparkles size={16} />
            <span>
              {isCreatingBackup
                ? isHe
                  ? 'מגבה כעת את כל הטבלאות...'
                  : 'Backing up now...'
                : isHe
                ? '⚡ גבה עכשיו (גיבוי מלא)'
                : 'Run Full Backup Now'}
            </span>
          </button>
        </div>
      </div>

      {/* Backups List Table / Cards (Descending: Newest to Oldest) */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeaderRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="#2563EB" />
            <h3 style={styles.tableTitle}>
              {isHe ? 'היסטוריית גיבויים (מסודר בסדר יורד מהחדש לישן)' : 'Backup Archive (Newest to Oldest)'}
            </h3>
          </div>
          <span style={styles.countBadge}>
            {filteredBackups.length} {isHe ? 'גיבויים נמצאו' : 'backups'}
          </span>
        </div>

        {loading ? (
          <div style={styles.loadingBox}>
            <RefreshCw size={24} className="animate-spin" color="#2563EB" />
            <span>{isHe ? 'טוען היסטוריית גיבויים...' : 'Loading backup archive...'}</span>
          </div>
        ) : filteredBackups.length === 0 ? (
          <div style={styles.emptyBox}>
            <Database size={40} color="#CBD5E1" />
            <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#475569', marginTop: '12px' }}>
              {isHe ? 'לא נמצאו גיבויים התואמים את הסינון' : 'No backups found matching criteria'}
            </div>
            <p style={{ fontSize: '0.85rem', color: '#94A3B8', marginTop: '4px' }}>
              {isHe
                ? 'לחץ על "גבה עכשיו" כדי ליצור נקודת גיבוי חדשה של כלל בסיס הנתונים.'
                : 'Click "Run Full Backup Now" to create a fresh snapshot.'}
            </p>
          </div>
        ) : (
          <div style={styles.backupsList}>
            {filteredBackups.map((bkp, index) => {
              const isNightly = bkp.type === 'scheduled_nightly';
              const createdDateStr = bkp.created_at ? new Date(bkp.created_at).toLocaleString('he-IL') : bkp.date;

              return (
                <div key={bkp.id} style={styles.backupRow} className="hover-lift">
                  {/* Left: Type Icon + Info */}
                  <div style={styles.backupRowLeft}>
                    <div
                      style={{
                        ...styles.typeIconBox,
                        backgroundColor: isNightly ? '#EFF6FF' : '#FEF3C7',
                        color: isNightly ? '#2563EB' : '#D97706',
                      }}
                    >
                      {isNightly ? <Moon size={18} /> : <Sparkles size={18} />}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={styles.backupDate}>{formatDate(bkp.date)}</span>
                        <span style={styles.backupExactTime}>{createdDateStr}</span>
                        <span
                          style={{
                            ...styles.typeBadge,
                            backgroundColor: isNightly ? '#DBEAFE' : '#FEF3C7',
                            color: isNightly ? '#1E40AF' : '#92400E',
                          }}
                        >
                          {isNightly ? (isHe ? '🌙 גיבוי לילי אוטומטי (לאחר סנכרון)' : 'Nightly Auto') : (isHe ? '⚡ גיבוי ידני יזום' : 'Manual')}
                        </span>
                        {index === 0 && (
                          <span style={styles.newestBadge}>
                            ★ {isHe ? 'הכי עדכני' : 'Latest'}
                          </span>
                        )}
                      </div>

                      <div style={styles.backupMetaRow}>
                        <span>
                          <strong>{bkp.household_name || (isHe ? 'כלל המשפחות והמערכת' : 'All Households')}</strong>
                        </span>
                        <span>•</span>
                        <span>{bkp.total_rows.toLocaleString()} {isHe ? 'רשומות בסה"כ' : 'rows total'}</span>
                        <span>•</span>
                        <span>{bkp.file_size_kb} KB</span>
                        <span>•</span>
                        <span style={{ color: '#059669', fontWeight: '700' }}>✓ {isHe ? 'הושלם ותקין' : 'Completed'}</span>
                      </div>

                      {/* Tables Breakdown Pills */}
                      {bkp.tables_summary && Object.keys(bkp.tables_summary).length > 0 && (
                        <div style={styles.pillsWrap}>
                          {bkp.tables_summary.transactions !== undefined && (
                            <span style={styles.tablePill}>
                              תנועות: <strong>{bkp.tables_summary.transactions.toLocaleString()}</strong>
                            </span>
                          )}
                          {bkp.tables_summary.investments !== undefined && (
                            <span style={styles.tablePill}>
                              השקעות: <strong>{bkp.tables_summary.investments}</strong>
                            </span>
                          )}
                          {bkp.tables_summary.business_mapping !== undefined && (
                            <span style={styles.tablePill}>
                              מיפויים: <strong>{bkp.tables_summary.business_mapping.toLocaleString()}</strong>
                            </span>
                          )}
                          {bkp.tables_summary.categories !== undefined && (
                            <span style={styles.tablePill}>
                              קטגוריות: <strong>{bkp.tables_summary.categories}</strong>
                            </span>
                          )}
                          {bkp.tables_summary.investment_snapshots !== undefined && (
                            <span style={styles.tablePill}>
                              סנאפשוטים: <strong>{bkp.tables_summary.investment_snapshots}</strong>
                            </span>
                          )}
                          {bkp.tables_summary.security_daily_prices !== undefined && (
                            <span style={styles.tablePill}>
                              שערים יומיים: <strong>{bkp.tables_summary.security_daily_prices}</strong>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Action Buttons */}
                  <div style={styles.backupRowActions}>
                    {/* Restore Button */}
                    <button
                      type="button"
                      style={styles.restoreBtn}
                      onClick={() => setRestoreModalBackup(bkp)}
                      title={isHe ? 'שחזר את נתוני הגיבוי לבסיס הנתונים' : 'Restore backup to database'}
                    >
                      <RotateCcw size={14} />
                      <span>{isHe ? 'שחזר גיבוי' : 'Restore'}</span>
                    </button>

                    {/* Download JSON Button */}
                    <button
                      type="button"
                      style={styles.downloadBtn}
                      onClick={() => downloadBackupFile(bkp)}
                      title={isHe ? 'הורד קובץ JSON למחשב' : 'Download JSON file'}
                    >
                      <Download size={14} />
                      <span>JSON</span>
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      style={styles.deleteBtn}
                      onClick={() => setDeleteModalBackup(bkp)}
                      title={isHe ? 'מחק גיבוי זה' : 'Delete backup'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RESTORE MODAL */}
      {restoreModalBackup && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent} className="animate-scale-up">
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ ...styles.kpiIconBox, backgroundColor: '#EFF6FF', color: '#2563EB' }}>
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 style={styles.modalTitle}>{isHe ? 'אישור שחזור גיבוי' : 'Confirm Backup Restore'}</h3>
                  <p style={styles.modalSub}>
                    {isHe
                      ? `שחזור נקודת גיבוי מתאריך ${formatDate(restoreModalBackup.date)}`
                      : `Restore snapshot from ${formatDate(restoreModalBackup.date)}`}
                  </p>
                </div>
              </div>
              <button
                style={styles.modalCloseBtn}
                onClick={() => !isRestoring && setRestoreModalBackup(null)}
                disabled={isRestoring}
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.modalBody}>
              {/* Warning Box */}
              <div style={styles.warningBox}>
                <AlertTriangle size={20} color="#D97706" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: '800', color: '#92400E', fontSize: '0.9rem' }}>
                    {isHe ? 'שים לב: פעולת שחזור דורסת נתונים' : 'Caution: Restore operation overwrites data'}
                  </div>
                  <div style={{ color: '#B45309', fontSize: '0.82rem', marginTop: '2px', lineHeight: 1.4 }}>
                    {isHe
                      ? `פעולה זו תעדכן ותשחזר את כלל הרשומות מתוך הגיבוי (${restoreModalBackup.total_rows.toLocaleString()} רשומות). מומלץ לוודא שהגיבוי שנבחר הוא הנכון.`
                      : `This will overwrite current records with ${restoreModalBackup.total_rows.toLocaleString()} rows from this backup.`}
                  </div>
                </div>
              </div>

              {/* Backup Specs Summary */}
              <div style={styles.backupSpecsGrid}>
                <div style={styles.specBox}>
                  <span style={styles.specLabel}>{isHe ? 'תאריך גיבוי:' : 'Date:'}</span>
                  <strong style={styles.specVal}>{formatDate(restoreModalBackup.date)}</strong>
                </div>
                <div style={styles.specBox}>
                  <span style={styles.specLabel}>{isHe ? 'סוג גיבוי:' : 'Type:'}</span>
                  <strong style={styles.specVal}>
                    {restoreModalBackup.type === 'scheduled_nightly'
                      ? isHe
                        ? '🌙 לילי אוטומטי'
                        : 'Nightly'
                      : isHe
                      ? '⚡ ידני'
                      : 'Manual'}
                  </strong>
                </div>
                <div style={styles.specBox}>
                  <span style={styles.specLabel}>{isHe ? 'משק בית:' : 'Household:'}</span>
                  <strong style={styles.specVal}>{restoreModalBackup.household_name}</strong>
                </div>
                <div style={styles.specBox}>
                  <span style={styles.specLabel}>{isHe ? 'סה"כ רשומות:' : 'Total Rows:'}</span>
                  <strong style={styles.specVal}>{restoreModalBackup.total_rows.toLocaleString()}</strong>
                </div>
              </div>

              {/* Live Progress Bar during Restore */}
              {isRestoring && (
                <div style={styles.progressContainer}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: '700', color: '#1E40AF', marginBottom: '5px' }}>
                    <span>{restoreProgressMsg}</span>
                    <span>{restoreProgressPct}%</span>
                  </div>
                  <div style={styles.progressBarTrack}>
                    <div style={{ ...styles.progressBarFill, width: `${restoreProgressPct}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.cancelBtn}
                onClick={() => setRestoreModalBackup(null)}
                disabled={isRestoring}
              >
                {isHe ? 'ביטול' : 'Cancel'}
              </button>
              <button
                type="button"
                style={styles.confirmRestoreBtn}
                onClick={handleConfirmRestore}
                disabled={isRestoring}
              >
                <RotateCcw size={15} className={isRestoring ? 'animate-spin' : ''} />
                <span>{isRestoring ? (isHe ? 'משחזר נתונים...' : 'Restoring...') : isHe ? 'אשר ובצע שחזור מלא' : 'Confirm Restore'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModalBackup && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent} className="animate-scale-up">
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ ...styles.kpiIconBox, backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 style={styles.modalTitle}>{isHe ? 'מחיקת גיבוי' : 'Delete Backup'}</h3>
                  <p style={styles.modalSub}>{formatDate(deleteModalBackup.date)} ({deleteModalBackup.id})</p>
                </div>
              </div>
              <button style={styles.modalCloseBtn} onClick={() => setDeleteModalBackup(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>
                {isHe
                  ? `האם אתה בטוח שברצונך למחוק גיבוי זה לצמיתות? לא ניתן יהיה לשחזר מתוכו לאחר המחיקה.`
                  : `Are you sure you want to permanently delete this backup?`}
              </p>
            </div>

            <div style={styles.modalFooter}>
              <button type="button" style={styles.cancelBtn} onClick={() => setDeleteModalBackup(null)}>
                {isHe ? 'ביטול' : 'Cancel'}
              </button>
              <button type="button" style={styles.confirmDeleteBtn} onClick={handleConfirmDelete}>
                <Trash2 size={15} />
                <span>{isHe ? 'מחק לצמיתות' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    marginTop: '10px',
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: '10px',
    backgroundColor: '#ECFDF5',
    color: '#065F46',
    border: '1px solid #A7F3D0',
    fontSize: '0.9rem',
    fontWeight: '600',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: '10px',
    backgroundColor: '#FEF2F2',
    color: '#991B1B',
    border: '1px solid #FECACA',
    fontSize: '0.9rem',
    fontWeight: '600',
  },
  closeBannerBtn: {
    marginLeft: 'auto',
    marginRight: 0,
    background: 'none',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    opacity: 0.7,
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '14px',
  },
  kpiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '16px 18px',
    border: '1px solid #E2E8F0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
  },
  kpiIconBox: {
    width: '46px',
    height: '46px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  kpiTitle: {
    fontSize: '0.82rem',
    fontWeight: '700',
    color: '#64748B',
  },
  kpiValue: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: '#0F172A',
    marginTop: '2px',
  },
  kpiSub: {
    fontSize: '0.75rem',
    color: '#94A3B8',
    marginTop: '3px',
  },
  retentionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: '12px',
    padding: '16px 20px',
    border: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  retentionLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: '1 1 300px',
  },
  retentionIconWrap: {
    width: '38px',
    height: '38px',
    borderRadius: '9px',
    backgroundColor: '#EFF6FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  retentionTitle: {
    fontSize: '0.92rem',
    fontWeight: '800',
    color: '#1E293B',
  },
  retentionSub: {
    fontSize: '0.78rem',
    color: '#64748B',
    marginTop: '2px',
    lineHeight: 1.35,
  },
  retentionActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  retentionSelect: {
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#FFFFFF',
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#1E293B',
    cursor: 'pointer',
  },
  retentionSaveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    fontSize: '0.82rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
  cleanOldBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#FFFFFF',
    color: '#64748B',
    fontSize: '0.82rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  filterActionBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  filterLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    flex: '1 1 auto',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    padding: '6px 12px',
    minWidth: '220px',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    fontSize: '0.85rem',
    width: '100%',
    backgroundColor: 'transparent',
  },
  clearSearchBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94A3B8',
    padding: 0,
  },
  filterSelect: {
    padding: '7px 10px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#FFFFFF',
    fontSize: '0.82rem',
    fontWeight: '600',
    color: '#334155',
    cursor: 'pointer',
  },
  refreshBtn: {
    padding: '8px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#FFFFFF',
    color: '#64748B',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBackupBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#059669',
    color: '#FFFFFF',
    fontSize: '0.88rem',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    border: '1px solid #E2E8F0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    padding: '14px 18px',
    borderBottom: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
  },
  tableTitle: {
    fontSize: '0.95rem',
    fontWeight: '800',
    color: '#0F172A',
    margin: 0,
  },
  countBadge: {
    fontSize: '0.75rem',
    fontWeight: '700',
    backgroundColor: '#E2E8F0',
    color: '#475569',
    padding: '3px 8px',
    borderRadius: '12px',
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    padding: '40px',
    color: '#64748B',
    fontSize: '0.9rem',
  },
  emptyBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '50px 20px',
    textAlign: 'center',
  },
  backupsList: {
    display: 'flex',
    flexDirection: 'column',
  },
  backupRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '14px 18px',
    borderBottom: '1px solid #F1F5F9',
    transition: 'background-color 0.15s ease',
    flexWrap: 'wrap',
  },
  backupRowLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    flex: '1 1 360px',
  },
  typeIconBox: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '2px',
  },
  backupDate: {
    fontSize: '0.95rem',
    fontWeight: '800',
    color: '#0F172A',
  },
  backupExactTime: {
    fontSize: '0.78rem',
    color: '#64748B',
  },
  typeBadge: {
    fontSize: '0.72rem',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: '6px',
  },
  newestBadge: {
    fontSize: '0.7rem',
    fontWeight: '800',
    padding: '2px 6px',
    borderRadius: '6px',
    backgroundColor: '#FEF3C7',
    color: '#B45309',
  },
  backupMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.78rem',
    color: '#64748B',
    marginTop: '4px',
    flexWrap: 'wrap',
  },
  pillsWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '6px',
    flexWrap: 'wrap',
  },
  tablePill: {
    fontSize: '0.7rem',
    backgroundColor: '#F1F5F9',
    color: '#475569',
    padding: '2px 7px',
    borderRadius: '5px',
    border: '1px solid #E2E8F0',
  },
  backupRowActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  restoreBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    borderRadius: '7px',
    border: 'none',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    fontSize: '0.8rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  downloadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 10px',
    borderRadius: '7px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#FFFFFF',
    color: '#475569',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  deleteBtn: {
    padding: '6px 8px',
    borderRadius: '7px',
    border: '1px solid #FECACA',
    backgroundColor: '#FEF2F2',
    color: '#DC2626',
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '16px',
    backdropFilter: 'blur(3px)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    maxWidth: '520px',
    width: '100%',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '18px 22px',
    borderBottom: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
  },
  modalTitle: {
    fontSize: '1.05rem',
    fontWeight: '800',
    color: '#0F172A',
    margin: 0,
  },
  modalSub: {
    fontSize: '0.78rem',
    color: '#64748B',
    marginTop: '2px',
    margin: 0,
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    color: '#64748B',
    cursor: 'pointer',
    padding: 0,
  },
  modalBody: {
    padding: '20px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  warningBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    backgroundColor: '#FEF3C7',
    border: '1px solid #FDE68A',
    borderRadius: '10px',
    padding: '12px 14px',
  },
  backupSpecsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
  },
  specBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: '8px',
    padding: '10px 12px',
    border: '1px solid #E2E8F0',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  specLabel: {
    fontSize: '0.72rem',
    color: '#64748B',
  },
  specVal: {
    fontSize: '0.88rem',
    color: '#0F172A',
  },
  progressContainer: {
    backgroundColor: '#EFF6FF',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid #BFDBFE',
  },
  progressBarTrack: {
    height: '8px',
    backgroundColor: '#DBEAFE',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    transition: 'width 0.3s ease',
  },
  modalFooter: {
    padding: '14px 22px',
    borderTop: '1px solid #E2E8F0',
    backgroundColor: '#F8FAFC',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
  },
  cancelBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#FFFFFF',
    color: '#475569',
    fontSize: '0.85rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
  confirmRestoreBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 18px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    fontSize: '0.85rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
  confirmDeleteBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 18px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#DC2626',
    color: '#FFFFFF',
    fontSize: '0.85rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
};
