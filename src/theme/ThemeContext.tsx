/**
 * ThemeContext.tsx -- React context provider for perspektive.js theming
 *
 * Provides:
 *   - `PerspektiveThemeProvider` -- wraps the component tree with a theme context
 *   - `useTheme()`              -- returns the full current theme + setter
 *   - `useThemeValue(path)`     -- returns a specific nested value from the theme
 *
 * Theme transitions are handled via internal animation state. When `setTheme`
 * is called, the provider lerps from the old theme to the new one over
 * `transitionDuration` milliseconds using `requestAnimationFrame`.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import type { PerspektiveTheme } from './types';
import { defaultTheme } from './presets';
import { interpolateTheme } from './utils';

// ==========================================
// CONTEXT TYPES
// ==========================================

/** Value exposed by the theme context. */
export interface ThemeContextValue {
  /** The currently active (possibly interpolated) theme. */
  theme: PerspektiveTheme;
  /**
   * Replace the current theme. When `animate` is true (default), the
   * transition will be smoothly interpolated over `transitionDuration` ms.
   */
  setTheme: (theme: PerspektiveTheme, animate?: boolean) => void;
  /** Whether a theme transition animation is currently in progress. */
  isTransitioning: boolean;
}

// ==========================================
// CONTEXT
// ==========================================

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ==========================================
// PROVIDER
// ==========================================

/** Props for PerspektiveThemeProvider. */
export interface PerspektiveThemeProviderProps {
  /** The initial theme. Defaults to `cyberpunk` if omitted. */
  theme?: PerspektiveTheme;
  /** Duration of smooth theme transitions in milliseconds. Default: 400. */
  transitionDuration?: number;
  /** Child components that will have access to the theme. */
  children: ReactNode;
}

/**
 * Provides a `PerspektiveTheme` to all descendant components via React context.
 *
 * Supports smooth animated transitions between themes. Wrap your
 * `<Canvas>` and overlay UI inside this provider.
 *
 * @example
 * ```tsx
 * import { PerspektiveThemeProvider, midnight } from 'perspektive.js/theme';
 *
 * function App() {
 *   return (
 *     <PerspektiveThemeProvider theme={midnight} transitionDuration={500}>
 *       <PerspektiveEngine collection="eva" />
 *     </PerspektiveThemeProvider>
 *   );
 * }
 * ```
 */
export function PerspektiveThemeProvider({
  theme: initialTheme,
  transitionDuration = 400,
  children,
}: PerspektiveThemeProviderProps) {
  const [currentTheme, setCurrentTheme] = useState<PerspektiveTheme>(
    initialTheme ?? defaultTheme,
  );
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Refs for animation state -- avoids re-renders during interpolation
  const animRef = useRef<{
    from: PerspektiveTheme;
    to: PerspektiveTheme;
    startTime: number;
    duration: number;
    rafId: number;
  } | null>(null);

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current.rafId);
      }
    };
  }, []);

  // Sync with external theme prop changes
  useEffect(() => {
    if (initialTheme && initialTheme.name !== currentTheme.name) {
      setCurrentTheme(initialTheme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTheme]);

  const animateTransition = useCallback(
    (from: PerspektiveTheme, to: PerspektiveTheme, duration: number) => {
      // Cancel any in-flight animation
      if (animRef.current) {
        cancelAnimationFrame(animRef.current.rafId);
      }

      setIsTransitioning(true);
      const startTime = performance.now();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1.0);

        // Ease-in-out cubic for smooth feel
        const eased = t < 0.5
          ? 4 * t * t * t
          : 1 - Math.pow(-2 * t + 2, 3) / 2;

        const interpolated = interpolateTheme(from, to, eased);
        setCurrentTheme(interpolated);

        if (t < 1.0) {
          animRef.current = {
            from,
            to,
            startTime,
            duration,
            rafId: requestAnimationFrame(tick),
          };
        } else {
          // Ensure we land exactly on the target theme
          setCurrentTheme(to);
          setIsTransitioning(false);
          animRef.current = null;
        }
      };

      animRef.current = {
        from,
        to,
        startTime,
        duration,
        rafId: requestAnimationFrame(tick),
      };
    },
    [],
  );

  const setTheme = useCallback(
    (newTheme: PerspektiveTheme, animate = true) => {
      if (animate && transitionDuration > 0) {
        // Start from current rendered theme (possibly mid-transition)
        animateTransition(currentTheme, newTheme, transitionDuration);
      } else {
        // Cancel any in-flight animation
        if (animRef.current) {
          cancelAnimationFrame(animRef.current.rafId);
          animRef.current = null;
        }
        setIsTransitioning(false);
        setCurrentTheme(newTheme);
      }
    },
    [currentTheme, transitionDuration, animateTransition],
  );

  // Memoize the context value to avoid unnecessary re-renders in consumers
  // that only read theme but don't call setTheme.
  const contextValue = useMemo<ThemeContextValue>(
    () => ({ theme: currentTheme, setTheme, isTransitioning }),
    [currentTheme, setTheme, isTransitioning],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// ==========================================
// HOOKS
// ==========================================

/**
 * Access the current perspektive.js theme and the setter to change it.
 *
 * Must be called within a `<PerspektiveThemeProvider>`.
 *
 * @returns `{ theme, setTheme, isTransitioning }`
 *
 * @example
 * ```tsx
 * const { theme, setTheme } = useTheme();
 * // Switch to paper theme
 * setTheme(paper);
 * ```
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error(
      'useTheme() must be used within a <PerspektiveThemeProvider>. ' +
      'Wrap your component tree with <PerspektiveThemeProvider> to provide a theme.',
    );
  }
  return ctx;
}

/**
 * Read a specific nested value from the current theme using a dot-separated path.
 *
 * This is a convenience wrapper around `useTheme()` that drills into the
 * theme object by path. The result is memoized against the full theme
 * reference so it only recalculates when the theme changes.
 *
 * @param path - Dot-separated path into the theme (e.g. `'nodes.byType.Episodic.color'`)
 * @returns The value at that path, or `undefined` if the path does not exist.
 *
 * @example
 * ```tsx
 * const bloomIntensity = useThemeValue('bloom.intensity'); // 1.5
 * const episodicColor = useThemeValue('nodes.byType.Episodic.color'); // '#00f0ff'
 * ```
 */
export function useThemeValue<T = unknown>(path: string): T | undefined {
  const { theme } = useTheme();

  return useMemo(() => {
    const keys = path.split('.');
    let current: unknown = theme;
    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return current as T | undefined;
  }, [theme, path]);
}
