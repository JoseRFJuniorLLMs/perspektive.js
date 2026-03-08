/**
 * search/SearchBar.tsx — Cyberpunk-themed search input for node filtering
 *
 * Positioned absolute top-left (below the HUD title area).
 * Features:
 * - Real-time filtering with 150ms debounce
 * - Match count display ("42 / 1,234 nodes")
 * - Clear button (X) to reset search
 * - Keyboard shortcuts: Ctrl+F or / to focus, Escape to clear
 * - Neon cyan border with glow on focus
 *
 * This component lives in the HTML overlay layer (not inside the R3F Canvas).
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useFilter } from './useFilter';

// ==========================================
// PROPS
// ==========================================

export interface SearchBarProps {
  /**
   * Total number of nodes in the graph (used for "X / total nodes" display).
   * If omitted, falls back to the internal node count from the filter store.
   */
  totalNodes?: number;
  /**
   * Enable hybrid search toggle (vector + text combined search).
   * When enabled, shows a toggle button next to the search input.
   */
  enableHybridSearch?: boolean;
  /**
   * Callback when hybrid search is triggered.
   * Receives the query text. Caller is responsible for API call.
   */
  onHybridSearch?: (query: string) => void;
}

// ==========================================
// STYLES
// ==========================================

const STYLES = {
  container: {
    position: 'absolute' as const,
    top: 120,
    left: 20,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  inputWrapper: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
  },
  input: {
    width: 280,
    padding: '8px 36px 8px 12px',
    background: 'rgba(0,0,0,0.7)',
    border: '1px solid #00f0ff',
    borderRadius: 4,
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: 13,
    outline: 'none',
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
    backdropFilter: 'blur(4px)',
  },
  inputFocused: {
    boxShadow: '0 0 15px rgba(0,240,255,0.4)',
    borderColor: '#00f0ff',
  },
  inputActive: {
    boxShadow: '0 0 10px rgba(0,240,255,0.25)',
    borderColor: '#00f0ff',
  },
  clearButton: {
    position: 'absolute' as const,
    right: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    fontFamily: 'monospace',
    fontSize: 14,
    cursor: 'pointer',
    padding: '2px 4px',
    lineHeight: 1,
    transition: 'color 0.15s ease',
  },
  matchCount: {
    color: '#64748b',
    fontFamily: 'monospace',
    fontSize: 11,
    whiteSpace: 'nowrap' as const,
    userSelect: 'none' as const,
  },
  matchCountActive: {
    color: '#00f0ff',
  },
} as const;

// ==========================================
// COMPONENT
// ==========================================

/**
 * Cyberpunk search bar for filtering graph nodes in real-time.
 * Place this component as a sibling of the R3F `<Canvas>`, not inside it.
 */
export const SearchBar = ({ totalNodes, enableHybridSearch, onHybridSearch }: SearchBarProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [localValue, setLocalValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [hybridMode, setHybridMode] = useState(false);

  const { matchedIds, isActive, setSearch, resetFilters, _nodes } = useFilter();

  const total = totalNodes ?? _nodes.length;
  const matchCount = matchedIds.size;

  // --- Debounced search dispatch ---
  const dispatchSearch = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSearch(text);
      }, 150);
    },
    [setSearch],
  );

  // --- Input change handler ---
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value;
      setLocalValue(text);
      dispatchSearch(text);
    },
    [dispatchSearch],
  );

  // --- Clear search ---
  const handleClear = useCallback(() => {
    setLocalValue('');
    setSearch('');
    inputRef.current?.focus();
  }, [setSearch]);

  // --- Keyboard shortcut: Ctrl+F or / to focus ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F or Cmd+F: focus the search bar
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }

      // / key when not already in an input: focus search bar
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }

      // Escape: clear search and blur
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        handleClear();
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClear, resetFilters]);

  // --- Cleanup debounce on unmount ---
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // --- Determine visual state ---
  const hasText = localValue.length > 0;
  const inputStyle: React.CSSProperties = {
    ...STYLES.input,
    ...(isFocused ? STYLES.inputFocused : hasText ? STYLES.inputActive : {}),
  };

  const matchStyle: React.CSSProperties = {
    ...STYLES.matchCount,
    ...(isActive ? STYLES.matchCountActive : {}),
  };

  return (
    <div style={STYLES.container}>
      <div style={STYLES.inputWrapper}>
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Search nodes..."
          spellCheck={false}
          autoComplete="off"
          style={inputStyle}
        />
        {hasText && (
          <button
            onClick={handleClear}
            style={STYLES.clearButton}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.color = '#00f0ff';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.color = '#64748b';
            }}
            title="Clear search (Esc)"
            aria-label="Clear search"
          >
            X
          </button>
        )}
      </div>
      {enableHybridSearch && (
        <button
          onClick={() => {
            const next = !hybridMode;
            setHybridMode(next);
            if (next && localValue.length > 0) {
              onHybridSearch?.(localValue);
            }
          }}
          style={{
            background: hybridMode ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
            border: `1px solid ${hybridMode ? '#8b5cf6' : '#334155'}`,
            color: hybridMode ? '#8b5cf6' : '#64748b',
            padding: '6px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontSize: 9,
            fontWeight: 'bold',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap' as const,
          }}
          title="Toggle Hybrid Search (Vector + Text)"
        >
          {hybridMode ? 'HYBRID' : 'TEXT'}
        </button>
      )}
      <span style={matchStyle}>
        {isActive
          ? `${matchCount.toLocaleString()} / ${total.toLocaleString()} nodes`
          : `${total.toLocaleString()} nodes`}
      </span>
    </div>
  );
};
