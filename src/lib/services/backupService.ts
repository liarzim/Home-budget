import { supabase } from '../supabase';
import { SystemBackupRecord, BackupType } from '../types';

export const BACKUP_TABLES = [
  'households',
  'household_members',
  'profiles',
  'macro_categories',
  'categories',
  'business_mapping',
  'payment_method_mappings',
  'transactions',
  'budgets',
  'savings',
  'investments',
  'investment_snapshots',
  'security_daily_prices',
] as const;

const LOCAL_RETENTION_KEY = 'home_budget_backup_retention_days';
export const DEFAULT_RETENTION_DAYS = 30;

export function getSavedRetentionDays(): number {
  try {
    const val = localStorage.getItem(LOCAL_RETENTION_KEY);
    if (val) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_RETENTION_DAYS;
}

export function saveRetentionDays(days: number): void {
  try {
    localStorage.setItem(LOCAL_RETENTION_KEY, String(days));
  } catch (e) {
    // ignore
  }
}

/**
 * Fetch all backup records sorted newest to oldest
 */
export async function fetchBackups(householdId?: string): Promise<SystemBackupRecord[]> {
  try {
    let query = supabase
      .from('system_backups')
      .select('id, created_at, date, type, household_id, household_name, total_rows, file_size_kb, tables_summary, status, retention_days')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (householdId && householdId !== 'all') {
      query = query.or(`household_id.eq.${householdId},household_id.eq.all`);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Error fetching backups from Supabase:', error.message);
      return [];
    }

    return (data || []) as SystemBackupRecord[];
  } catch (err) {
    console.error('Exception fetching backups:', err);
    return [];
  }
}

/**
 * Fetch a single backup's full payload (lazy load payload to save bandwidth)
 */
export async function fetchBackupPayload(backupId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('system_backups')
      .select('backup_payload')
      .eq('id', backupId)
      .single();

    if (error || !data) {
      console.warn('Error fetching backup payload:', error?.message);
      return null;
    }
    return data.backup_payload;
  } catch (err) {
    console.error('Exception fetching backup payload:', err);
    return null;
  }
}

/**
 * Create a new backup (manual or scheduled)
 */
export async function createBackup(params: {
  type?: BackupType;
  householdId?: string;
  householdName?: string;
  retentionDays?: number;
}): Promise<SystemBackupRecord> {
  const type = params.type || 'manual';
  const householdId = params.householdId || 'all';
  const householdName = params.householdName || 'כלל המשפחות והמערכת';
  const retentionDays = params.retentionDays || getSavedRetentionDays();

  const now = new Date();
  const dateISO = now.toISOString().split('T')[0];
  const timestampClean = now.toISOString().replace(/[:.]/g, '-');
  const backupId = `bkp_${timestampClean}`;

  const payload: { backup_timestamp: string; tables: Record<string, { count: number; rows: any[] }> } = {
    backup_timestamp: now.toISOString(),
    tables: {},
  };

  let totalRows = 0;
  const tablesSummary: Record<string, number> = {};

  for (const table of BACKUP_TABLES) {
    try {
      let query = supabase.from(table).select('*');
      if (householdId !== 'all' && ['transactions', 'budgets', 'savings', 'investments', 'investment_snapshots'].includes(table)) {
        query = query.eq('household_id', householdId);
      }
      const { data, error } = await query;
      if (!error && data) {
        payload.tables[table] = { count: data.length, rows: data };
        tablesSummary[table] = data.length;
        totalRows += data.length;
      } else {
        payload.tables[table] = { count: 0, rows: [] };
        tablesSummary[table] = 0;
      }
    } catch (tblErr) {
      console.warn(`Table ${table} backup error:`, tblErr);
      payload.tables[table] = { count: 0, rows: [] };
      tablesSummary[table] = 0;
    }
  }

  const jsonStr = JSON.stringify(payload);
  const fileSizeKb = Math.round(jsonStr.length / 1024);

  const backupRecord: SystemBackupRecord = {
    id: backupId,
    created_at: now.toISOString(),
    date: dateISO,
    type,
    household_id: householdId,
    household_name: householdName,
    total_rows: totalRows,
    file_size_kb: fileSizeKb,
    tables_summary: tablesSummary,
    backup_payload: payload,
    status: 'completed',
    retention_days: retentionDays,
  };

  const { error: insertErr } = await supabase.from('system_backups').insert(backupRecord);
  if (insertErr) {
    console.error('Error inserting backup to DB:', insertErr.message);
    throw new Error(`שגיאה בשמירת הגיבוי: ${insertErr.message}`);
  }

  // Enforce retention policy
  try {
    await cleanOldBackups(retentionDays, householdId);
  } catch (cleanErr) {
    console.warn('Retention cleanup warning:', cleanErr);
  }

  return backupRecord;
}

/**
 * Delete backups older than retentionDays
 */
export async function cleanOldBackups(retentionDays: number, householdId?: string): Promise<number> {
  if (retentionDays <= 0) return 0;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffDate = cutoff.toISOString().split('T')[0];

  try {
    let query = supabase
      .from('system_backups')
      .delete()
      .lt('date', cutoffDate);

    if (householdId && householdId !== 'all') {
      query = query.eq('household_id', householdId);
    }

    const { data, error } = await query.select('id');
    if (error) {
      console.warn('Error cleaning old backups:', error.message);
      return 0;
    }
    return data ? data.length : 0;
  } catch (err) {
    console.error('Exception cleaning old backups:', err);
    return 0;
  }
}

/**
 * Delete a specific backup by ID
 */
export async function deleteBackup(backupId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('system_backups')
      .delete()
      .eq('id', backupId);

    if (error) {
      console.error('Error deleting backup:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception deleting backup:', err);
    return false;
  }
}

/**
 * Restore a backup to database
 */
export async function restoreBackup(
  backupId: string,
  onProgress?: (msg: string, percent: number) => void
): Promise<{ success: boolean; message: string; rowsRestored: number }> {
  try {
    onProgress?.('טוען נתוני גיבוי...', 10);
    const payload = await fetchBackupPayload(backupId);

    if (!payload || !payload.tables) {
      return { success: false, message: 'קובץ הגיבוי אינו מכיל נתוני טבלאות תקינים.', rowsRestored: 0 };
    }

    let totalRestored = 0;
    const tableKeys = Object.keys(payload.tables);
    const totalTables = tableKeys.length;

    for (let i = 0; i < totalTables; i++) {
      const tbl = tableKeys[i];
      const tableData = payload.tables[tbl];
      const rows = tableData?.rows;

      const pct = Math.round(15 + ((i + 1) / totalTables) * 80);
      onProgress?.(`משחזר טבלת ${tbl} (${rows?.length || 0} רשומות)...`, pct);

      if (Array.isArray(rows) && rows.length > 0) {
        // Upsert in batches of 200
        const batchSize = 200;
        for (let b = 0; b < rows.length; b += batchSize) {
          const batch = rows.slice(b, b + batchSize);
          const { error } = await supabase.from(tbl).upsert(batch, { onConflict: 'id' });
          if (error) {
            console.warn(`Restore warning on ${tbl} batch:`, error.message);
          }
        }
        totalRestored += rows.length;
      }
    }

    onProgress?.('שחזור הושלם בהצלחה!', 100);
    return {
      success: true,
      message: `השחזור הושלם בהצלחה! שוחזרו ${totalRestored.toLocaleString()} רשומות.`,
      rowsRestored: totalRestored,
    };
  } catch (err: any) {
    console.error('Exception restoring backup:', err);
    return { success: false, message: `שגיאה בשחזור הגיבוי: ${err.message || err}`, rowsRestored: 0 };
  }
}

/**
 * Trigger browser file download of backup JSON
 */
export async function downloadBackupFile(backup: SystemBackupRecord): Promise<void> {
  let payload = backup.backup_payload;
  if (!payload) {
    payload = await fetchBackupPayload(backup.id);
  }

  const exportObj = payload || backup;
  const jsonStr = JSON.stringify(exportObj, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `system_backup_${backup.date}_${backup.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
