import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';
import { t, formatCategoryName } from '../lib/i18n';

export const BusinessMappingView: React.FC = () => {
  const { businessMappings, categories, addBusinessMapping, language, dir } = useAuth();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [patternInput, setPatternInput] = useState('');
  const [selectedCatId, setSelectedCatId] = useState(categories[0]?.id || '');

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (patternInput.trim() && selectedCatId) {
      addBusinessMapping(patternInput.trim(), selectedCatId);
      setPatternInput('');
      setIsAddModalOpen(false);
    }
  };

  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>{t('mappingTitle', language)}</h2>
          <p style={styles.subtitle}>{t('mappingSub', language)}</p>
        </div>

        <button
          style={styles.addRuleBtn}
          onClick={() => setIsAddModalOpen(true)}
        >
          <Plus size={16} color="#FFFFFF" />
          <span>{t('btnAddRule', language)}</span>
        </button>
      </div>

      {/* Rules List */}
      <div style={styles.rulesList}>
        {businessMappings.map((rule) => {
          const category = categories.find((c) => c.id === rule.category_id);
          return (
            <div key={rule.id} style={styles.ruleCard}>
              <div style={styles.rulePatternBox}>
                <Sparkles size={14} color="var(--primary)" />
                <span style={styles.patternText}>{rule.pattern}</span>
              </div>

              <ArrowIcon size={16} color="var(--text-muted)" />

              <div style={styles.categoryTargetWrap}>
                {category ? (
                  <span
                    style={{
                      ...styles.categoryBadge,
                      backgroundColor: `${category.color}15`,
                      borderColor: `${category.color}40`,
                      color: category.color,
                    }}
                  >
                    <span
                      style={{ ...styles.categoryDot, backgroundColor: category.color }}
                    />
                    {formatCategoryName(category.name, language)}
                  </span>
                ) : (
                  <span style={styles.unknownCategory}>{t('unknownCategory', language)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Rule Modal */}
      {isAddModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard} className="animate-fade-in">
            <h3 style={styles.modalTitle}>{t('newRuleTitle', language)}</h3>
            <p style={styles.modalSubtitle}>{t('newRuleSub', language)}</p>

            <form onSubmit={handleSaveRule}>
              <div style={styles.formGroup}>
                <label style={styles.inputLabel}>{t('fieldKeyword', language)}</label>
                <input
                  style={styles.textInput}
                  type="text"
                  placeholder={language === 'he' ? 'לדוגמה: שופרסל, וולט, פז, ביט' : 'e.g. BIT, WOLT, AM:PM, OSHEK'}
                  value={patternInput}
                  onChange={(e) => setPatternInput(e.target.value)}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.inputLabel}>{t('fieldAssignCategory', language)}</label>
                <div style={styles.catSelectList}>
                  {categories.map((cat) => {
                    const isSelected = selectedCatId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        style={{
                          ...styles.catSelectRow,
                          ...(isSelected ? styles.catSelectRowActive : {}),
                        }}
                        onClick={() => setSelectedCatId(cat.id)}
                      >
                        <span
                          style={{ ...styles.categoryDot, backgroundColor: cat.color }}
                        />
                        <span
                          style={{
                            fontSize: '0.8125rem',
                            color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                            fontWeight: isSelected ? '700' : '500',
                          }}
                        >
                          {formatCategoryName(cat.name, language)} (
                          {cat.type === 'expense'
                            ? (language === 'he' ? 'הוצאה' : 'expense')
                            : (language === 'he' ? 'הכנסה' : 'income')}
                          )
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={styles.modalActionRow}>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => setIsAddModalOpen(false)}
                >
                  {t('cancel', language)}
                </button>
                <button type="submit" style={styles.submitBtn}>
                  {t('saveRuleBtn', language)}
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
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  addRuleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '600',
  },
  rulesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  ruleCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--bg-surface)',
    padding: '16px 20px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    boxShadow: 'var(--shadow-sm)',
  },
  rulePatternBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--bg-surface-subtle)',
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
  },
  patternText: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-primary)',
  },
  categoryTargetWrap: {
    minWidth: '180px',
    textAlign: 'right',
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
  categoryDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  unknownCategory: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modalCard: {
    width: '100%',
    maxWidth: '480px',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    boxShadow: 'var(--shadow-xl)',
  },
  modalTitle: {
    fontSize: '1.125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  modalSubtitle: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    marginBottom: '16px',
  },
  formGroup: {
    marginBottom: '16px',
  },
  inputLabel: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  textInput: {
    width: '100%',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    padding: '9px 12px',
    color: 'var(--text-primary)',
  },
  catSelectList: {
    maxHeight: '180px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    backgroundColor: 'var(--bg-surface-subtle)',
    padding: '6px',
    borderRadius: 'var(--radius-sm)',
  },
  catSelectRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    textAlign: 'left',
    width: '100%',
  },
  catSelectRowActive: {
    backgroundColor: 'var(--primary-light)',
  },
  modalActionRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px',
  },
  cancelBtn: {
    padding: '9px 16px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface-subtle)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  submitBtn: {
    padding: '9px 18px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    fontSize: '0.8125rem',
    fontWeight: '600',
  },
};
