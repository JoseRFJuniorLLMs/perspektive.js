/**
 * interaction/ContextMenu.tsx — Cyberpunk context menu for node interaction
 *
 * Appears on right-click on a node or selection.
 * Styled with the perspektive.js cyberpunk aesthetic:
 *   - Dark background (rgba(2, 6, 23, 0.95))
 *   - Neon cyan borders and accents (#00f0ff)
 *   - Monospace font throughout
 *   - Glow effects on hover
 *
 * Default items: Focus, Expand Neighbors, Hide, Pin/Unpin, Copy ID,
 *                separator, Select All of Type
 *
 * Closes on: click outside, Escape key, or clicking an item.
 * Clamped to viewport boundaries so it never goes off-screen.
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import type { ContextMenuItem, InteractionCallbacks } from './types';
import type { NodeData } from '../components/PerspektiveEngine';
import { useSelection } from './useSelection';

// ==========================================
// TYPES
// ==========================================

export interface ContextMenuProps {
  /** Whether the menu is visible */
  visible: boolean;
  /** Screen position (pixels) where the menu should appear */
  position: { x: number; y: number };
  /** Node IDs the context menu applies to */
  targetIds: string[];
  /** All nodes (needed for "Select All of Type") */
  nodes: NodeData[];
  /** Custom menu items (replaces defaults if provided) */
  customItems?: ContextMenuItem[];
  /** Interaction callbacks */
  callbacks?: InteractionCallbacks;
  /** Close handler */
  onClose: () => void;
}

// ==========================================
// STYLES (Cyberpunk Dark Theme)
// ==========================================

const MENU_STYLES = {
  container: {
    position: 'fixed' as const,
    zIndex: 10000,
    minWidth: 220,
    maxWidth: 300,
    background: 'rgba(2, 6, 23, 0.95)',
    border: '1px solid #00f0ff',
    borderRadius: 4,
    padding: '4px 0',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: 12,
    color: '#e2e8f0',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 0 20px rgba(0, 240, 255, 0.3), 0 8px 32px rgba(0, 0, 0, 0.8)',
    userSelect: 'none' as const,
    animation: 'perspektive-ctx-fadein 0.1s ease-out',
  },
  item: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: '8px 16px',
    cursor: 'pointer',
    transition: 'background 0.15s ease, color 0.15s ease',
    border: 'none',
    background: 'transparent',
    color: '#e2e8f0',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    width: '100%',
    textAlign: 'left' as const,
  },
  itemHover: {
    background: 'rgba(0, 240, 255, 0.1)',
    color: '#00f0ff',
    textShadow: '0 0 8px rgba(0, 240, 255, 0.5)',
  },
  itemDisabled: {
    opacity: 0.35,
    cursor: 'not-allowed',
  },
  separator: {
    height: 1,
    background: 'linear-gradient(90deg, transparent, #00f0ff40, transparent)',
    margin: '4px 12px',
  },
  icon: {
    marginRight: 10,
    fontSize: 14,
    width: 20,
    textAlign: 'center' as const,
    flexShrink: 0,
  },
  shortcut: {
    marginLeft: 16,
    fontSize: 10,
    color: '#64748b',
    flexShrink: 0,
  },
  header: {
    padding: '6px 16px 4px',
    fontSize: 10,
    color: '#00f0ff',
    fontWeight: 'bold' as const,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    borderBottom: '1px solid rgba(0, 240, 255, 0.15)',
    marginBottom: 2,
  },
} as const;

// ==========================================
// KEYFRAME INJECTION (one-time)
// ==========================================

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes perspektive-ctx-fadein {
      from { opacity: 0; transform: scale(0.95) translateY(-4px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

// ==========================================
// DEFAULT MENU ITEMS FACTORY
// ==========================================

function buildDefaultItems(
  targetIds: string[],
  nodes: NodeData[],
  callbacks: InteractionCallbacks | undefined,
  selection: ReturnType<typeof useSelection>,
): ContextMenuItem[] {
  const targetNodes = nodes.filter(n => targetIds.includes(n.id));
  const primaryType = targetNodes.length > 0 ? targetNodes[0].node_type : null;
  const allPinned = targetIds.every(id => selection.isPinned(id));

  return [
    {
      label: 'Focus',
      icon: '\u25CE',  // ◎
      action: (ids) => {
        if (ids.length > 0) callbacks?.onFocus?.(ids[0]);
      },
      disabled: targetIds.length === 0,
      shortcut: 'F',
    },
    {
      label: 'Expand Neighbors',
      icon: '\u2726',  // ✦
      action: (ids) => {
        if (ids.length > 0) callbacks?.onExpandNeighbors?.(ids[0]);
      },
      disabled: targetIds.length === 0,
      shortcut: 'E',
    },
    {
      label: 'Hide',
      icon: '\u2298',  // ⊘
      action: (ids) => {
        selection.hideNodes(ids);
        callbacks?.onHide?.(ids);
      },
      disabled: targetIds.length === 0,
      shortcut: 'H',
    },
    {
      label: allPinned ? 'Unpin' : 'Pin',
      icon: '\u25C8',  // ◈
      action: (ids) => {
        selection.togglePin(ids);
        callbacks?.onTogglePin?.(ids, !allPinned);
      },
      disabled: targetIds.length === 0,
      shortcut: 'P',
    },
    {
      label: 'Copy ID',
      icon: '\u2398',  // ⎘
      action: (ids) => {
        const text = ids.join('\n');
        navigator.clipboard.writeText(text).catch(() => {
          // Fallback: noop if clipboard not available
        });
      },
      disabled: targetIds.length === 0,
      shortcut: 'C',
    },
    {
      label: `Select All "${primaryType || '?'}"`,
      icon: '\u229B',  // ⊛
      action: () => {
        if (primaryType) {
          selection.selectByType(primaryType, nodes);
          const selectedOfType = nodes.filter(n => n.node_type === primaryType).map(n => n.id);
          callbacks?.onSelect?.(selectedOfType);
        }
      },
      separator: true,
      disabled: !primaryType,
    },
    {
      label: 'Select All',
      icon: '\u229E',  // ⊞
      action: () => {
        const allIds = nodes.map(n => n.id);
        selection.selectAll(allIds);
        callbacks?.onSelect?.(allIds);
      },
      shortcut: 'Ctrl+A',
    },
    {
      label: 'Deselect All',
      icon: '\u2296',  // ⊖
      action: () => {
        selection.deselectAll();
        callbacks?.onDeselect?.();
      },
      disabled: selection.selectedIds.size === 0,
    },
    {
      label: 'Show All Hidden',
      icon: '\u25C9',  // ◉
      action: () => {
        selection.showAll();
      },
      separator: true,
      disabled: selection.hiddenIds.size === 0,
    },
  ];
}

// ==========================================
// COMPONENT
// ==========================================

export const ContextMenu = ({
  visible,
  position,
  targetIds,
  nodes,
  customItems,
  callbacks,
  onClose,
}: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const selection = useSelection();

  // Inject keyframe animation styles once
  useEffect(() => {
    injectStyles();
  }, []);

  // Build menu items
  const items = useMemo(() => {
    if (customItems && customItems.length > 0) return customItems;
    return buildDefaultItems(targetIds, nodes, callbacks, selection);
  }, [customItems, targetIds, nodes, callbacks, selection]);

  // Close on Escape key
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Use a microtask delay to avoid closing immediately from the same right-click
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visible, onClose]);

  // Clamp position to viewport boundaries
  const clampedPosition = useMemo(() => {
    if (!visible || typeof window === 'undefined') return position;

    const menuWidth = 240; // Estimated width
    const menuHeight = items.length * 36 + 20; // Estimated height
    const padding = 8;

    const maxX = window.innerWidth - menuWidth - padding;
    const maxY = window.innerHeight - menuHeight - padding;

    return {
      x: Math.max(padding, Math.min(position.x, maxX)),
      y: Math.max(padding, Math.min(position.y, maxY)),
    };
  }, [position, visible, items.length]);

  // Handle item click
  const handleItemClick = useCallback(
    (item: ContextMenuItem) => {
      if (item.disabled) return;
      item.action(targetIds);
      onClose();
    },
    [targetIds, onClose]
  );

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      style={{
        ...MENU_STYLES.container,
        left: clampedPosition.x,
        top: clampedPosition.y,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header showing target info */}
      <div style={MENU_STYLES.header}>
        {targetIds.length === 1
          ? `NODE ${targetIds[0].substring(0, 12)}...`
          : `${targetIds.length} NODES SELECTED`}
      </div>

      {/* Menu Items */}
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`}>
          {/* Separator before this item */}
          {item.separator && <div style={MENU_STYLES.separator} />}

          {/* Menu item button */}
          <button
            style={{
              ...MENU_STYLES.item,
              ...(item.disabled ? MENU_STYLES.itemDisabled : {}),
            }}
            onClick={() => handleItemClick(item)}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                Object.assign(e.currentTarget.style, {
                  background: MENU_STYLES.itemHover.background,
                  color: MENU_STYLES.itemHover.color,
                  textShadow: MENU_STYLES.itemHover.textShadow,
                });
              }
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, {
                background: 'transparent',
                color: '#e2e8f0',
                textShadow: 'none',
              });
            }}
            disabled={item.disabled}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>
              {item.icon && <span style={MENU_STYLES.icon}>{item.icon}</span>}
              <span>{item.label}</span>
            </span>
            {item.shortcut && (
              <span style={MENU_STYLES.shortcut}>{item.shortcut}</span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
};
