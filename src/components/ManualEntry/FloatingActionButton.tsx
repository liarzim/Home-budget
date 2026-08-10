import React, { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const FloatingActionButton: React.FC = () => {
  const { setActiveTab, activeTab } = useAuth();
  const [isHovered, setIsHovered] = useState(false);

  // If already on manual-entry screen, don't show or keep subtle
  if (activeTab === 'manual-entry') return null;

  return (
    <div style={styles.fabContainer}>
      {isHovered && (
        <div style={styles.tooltip} className="animate-fade-in">
          <span>+ Quick Add Transaction</span>
        </div>
      )}

      <button
        style={{
          ...styles.fabButton,
          ...(isHovered ? styles.fabButtonHovered : {}),
        }}
        onClick={() => setActiveTab('manual-entry')}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label="Add new transaction"
      >
        <Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
      </button>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  fabContainer: {
    position: 'fixed',
    bottom: '28px',
    right: '28px',
    zIndex: 999,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  tooltip: {
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: '700',
    boxShadow: 'var(--shadow-md)',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  },
  fabButton: {
    width: '56px',
    height: '56px',
    borderRadius: '28px',
    backgroundColor: 'var(--primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4)',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  fabButtonHovered: {
    transform: 'scale(1.08) translateY(-2px)',
    boxShadow: '0 12px 30px rgba(37, 99, 235, 0.55)',
  },
};
