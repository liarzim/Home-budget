import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';
import { formatDate, normalizeToISODate } from '../../lib/i18n';

interface IsraeliDateInputProps {
  value: string;
  onChange: (displayValue: string, isoValue: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  required?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  title?: string;
}

export const IsraeliDateInput: React.FC<IsraeliDateInputProps> = ({
  value,
  onChange,
  placeholder = 'DD/MM/YYYY',
  style,
  inputStyle,
  required,
  autoFocus,
  disabled,
  title,
}) => {
  const hiddenDateInputRef = useRef<HTMLInputElement>(null);

  const handleOpenPicker = () => {
    if (disabled) return;
    if (hiddenDateInputRef.current) {
      if (typeof hiddenDateInputRef.current.showPicker === 'function') {
        hiddenDateInputRef.current.showPicker();
      } else {
        hiddenDateInputRef.current.click();
      }
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const iso = normalizeToISODate(raw);
    onChange(raw, iso);
  };

  const handleNativePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedISO = e.target.value; // Returns YYYY-MM-DD
    if (pickedISO) {
      const formatted = formatDate(pickedISO);
      onChange(formatted, pickedISO);
    }
  };

  const currentISO = normalizeToISODate(value);

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: '100%',
        ...style,
      }}
    >
      <input
        type="text"
        value={value}
        onChange={handleTextChange}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        disabled={disabled}
        title={title || 'הזן תאריך בפורמט DD/MM/YYYY או בחר מהיומן'}
        style={{
          width: '100%',
          paddingLeft: '34px',
          direction: 'ltr',
          textAlign: 'right',
          fontFamily: 'monospace, sans-serif',
          fontSize: '0.9rem',
          fontWeight: '600',
          borderRadius: '6px',
          border: '1px solid #CBD5E1',
          padding: '8px 12px 8px 34px',
          outline: 'none',
          backgroundColor: '#FFFFFF',
          color: '#0F172A',
          boxSizing: 'border-box',
          ...inputStyle,
        }}
      />

      {/* Calendar Button */}
      <div
        style={{
          position: 'absolute',
          left: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          zIndex: 2,
        }}
        onClick={handleOpenPicker}
        title="בחר תאריך מלוח שנה"
      >
        <Calendar size={16} color="#2563EB" style={{ pointerEvents: 'none' }} />
        {/* Hidden Native Date Picker */}
        <input
          ref={hiddenDateInputRef}
          type="date"
          value={currentISO}
          onChange={handleNativePickerChange}
          style={{
            position: 'absolute',
            opacity: 0,
            width: '1px',
            height: '1px',
            pointerEvents: 'none',
          }}
          tabIndex={-1}
        />
      </div>
    </div>
  );
};
