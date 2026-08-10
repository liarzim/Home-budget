import React, { useState } from 'react';
import { X, Save, Edit3, Trash2, EyeOff } from 'lucide-react';
import { Transaction, Category } from '../../lib/types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface EditTransactionModalProps {
  transaction: Transaction | null;
  categories: Category[];
  currencySymbol: string;
  isDemoMode: boolean;
  onClose: () => void;
  onSave: (updatedTx: Transaction) => void;
  onHide: (txId: string) => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  categories,
  currencySymbol,
  isDemoMode,
  onClose,
  onSave,
  onHide,
}) => {
  if (!transaction) return null;

  const [payeeName, setPayeeName] = useState(transaction.payee_name);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [categoryId, setCategoryId] = useState(transaction.category_id || '');
  const [notes, setNotes] = useState(transaction.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const updated: Transaction = {
      ...transaction,
      payee_name: payeeName.trim(),
      amount: parseFloat(amount) || transaction.amount,
      category_id: categoryId || null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (!isDemoMode && isSupabaseConfigured) {
      try {
        await supabase
          .from('transactions')
          .update({
            payee_name: updated.payee_name,
            amount: updated.amount,
            category_id: updated.category_id,
            notes: updated.notes,
            updated_at: updated.updated_at,
          })
          .eq('id', transaction.id);
      } catch (err) {
        console.error('Error updating transaction in Supabase:', err);
      }
    }

    onSave(updated);
    setIsSaving(false);
    onClose();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} className="animate-fade-in">
        <div style={styles.header}>
          <div style={styles.headerTitleWrap}>
            <Edit3 size={18} color="var(--primary)" />
            <h3 style={styles.title}>Edit Transaction</h3>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>
            <X size={18} color="var(--text-secondary)" />
          </button>
        </div>

        <form onSubmit={handleSave} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Payee / Business Name</label>
            <input
              type="text"
              style={styles.input}
              value={payeeName}
              onChange={(e) => setPayeeName(e.target.value)}
              required
            />
          </div>

          <div style={styles.formRow}>
            <div style={{ flex: 1, ...styles.formGroup }}>
              <label style={styles.label}>Amount ({currencySymbol})</label>
              <input
                type="number"
                step="0.01"
                style={styles.input}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div style={{ flex: 1, ...styles.formGroup }}>
              <label style={styles.label}>Category</label>
              <select
                style={styles.select}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">-- Unassigned --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Notes / Description</label>
            <input
              type="text"
              style={styles.input}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add memo or transaction note..."
            />
          </div>

          <div style={styles.actions}>
            <button
              type="button"
              style={styles.hideBtn}
              onClick={() => {
                onHide(transaction.id);
                onClose();
              }}
              title="Hide this transaction from calculations (is_hidden = true)"
            >
              <EyeOff size={15} color="var(--danger)" />
              <span>Hide Row</span>
            </button>

            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
              <button type="button" style={styles.cancelBtn} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" style={styles.submitBtn} disabled={isSaving}>
                <Save size={15} color="#FFFFFF" />
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modal: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    width: '100%',
    maxWidth: '480px',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border-main)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  headerTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  title: {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
  },
  form: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  formRow: {
    display: 'flex',
    gap: '12px',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
  },
  input: {
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-strong)',
    backgroundColor: 'var(--bg-surface)',
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  select: {
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-strong)',
    backgroundColor: 'var(--bg-surface)',
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    outline: 'none',
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '12px',
    paddingTop: '16px',
    borderTop: '1px solid var(--border-subtle)',
  },
  hideBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: 'var(--danger-light)',
    border: '1px solid #FECACA',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--danger-text)',
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '8px 14px',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
