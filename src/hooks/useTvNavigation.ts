import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, type View, type LayoutChangeEvent } from 'react-native';
import { tvFocus, type TvCommand, type TvDirection } from './tvFocus';
import { addTvKeyListener } from '../../modules/macha-player/tvInput';

/**
 * The TV remote in the web client's command vocabulary. `select` is the D-pad
 * centre, its `activate`. `back` arrives through `BackHandler` instead, which
 * can answer the platform synchronously.
 */
const COMMANDS: Record<string, TvCommand> = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  select: 'activate',
};

export interface TvNavigationOptions {
  /** Return true when Back was consumed; false lets the platform handle it. */
  onBack?: () => boolean;
  onPlayPause?: () => void;
  onRewind?: () => void;
  onFastForward?: () => void;
  onStop?: () => void;
  /** The remote's own next / previous keys. */
  onNext?: () => void;
  onPrevious?: () => void;
}

/** Attach the D-pad to the focus registry. Mount once, at the app root. */
export function useTvNavigation(options: TvNavigationOptions = {}): void {
  const latest = useRef(options);
  latest.current = options;

  // Keys come from this client's native bridge: `useTVEventHandler` does
  // nothing in a bridgeless build. See `MachaTvInputModule.kt`.
  useEffect(
    () =>
      addTvKeyListener((event) => {
        const handlers = latest.current;

        // Suspended: every key, transport keys included, belongs to the IME.
        // A suspension whose holder went away would disable the remote for
        // good, so if no keyboard is on screen it is stale and is dropped.
        if (tvFocus.suspended) {
          if (Keyboard.isVisible()) return;
          tvFocus.resumeAll();
        }

        switch (event.eventType) {
          case 'playPause':
            handlers.onPlayPause?.();
            return;
          case 'rewind':
            handlers.onRewind?.();
            return;
          case 'fastForward':
            handlers.onFastForward?.();
            return;
          case 'stop':
            handlers.onStop?.();
            return;
          case 'next':
            handlers.onNext?.();
            return;
          case 'previous':
            handlers.onPrevious?.();
            return;
          default:
            break;
        }

        const command = COMMANDS[event.eventType];
        if (command) tvFocus.handle(command);
      }),
    [],
  );

  // `hardwareBackPress` answers synchronously: true consumes the press, false
  // lets Android finish the activity. The key bridge cannot do that.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // Suspended means the IME has it; Back closes the keyboard.
      if (tvFocus.suspended) return false;
      return latest.current.onBack?.() ?? false;
    });
    return () => subscription.remove();
  }, []);
}

export interface UseFocusableOptions {
  /**
   * A stable id, for moving focus here by name (the alphabet strip's jump).
   * Defaults to React's generated id.
   */
  id?: string;
  /** Called on D-pad centre. The web client's `element.click()`. */
  onSelect?: () => void;
  disabled?: boolean;
  /** Receives focus when its scope becomes active — `data-tv-default-focus`. */
  defaultFocus?: boolean;
  scope?: string;
  /** Keep these directions instead of moving focus. See `Focusable.ownsDirection`. */
  ownsDirection?: (direction: TvDirection) => boolean;
  onDirection?: (direction: TvDirection) => void;
  /** A side rail, reachable sideways from any row. See `Focusable.rail` in `tvFocus.ts`. */
  rail?: boolean;
}

export interface UseFocusableResult {
  focused: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
  ref: React.RefObject<View | null>;
}

/**
 * Register one focusable, the equivalent of `data-tv-focusable="true"`.
 * Geometry comes from `measureInWindow`: the scorer compares rectangles across
 * the screen, and `onLayout`'s parent-relative coordinates are not comparable.
 */
export function useFocusable(options: UseFocusableOptions = {}): UseFocusableResult {
  const generated = useId();
  const id = options.id ?? generated;
  const ref = useRef<View | null>(null);
  const [focused, setFocused] = useState(false);
  const latest = useRef(options);
  latest.current = options;

  // A layout effect, so registration usually precedes Fabric's `onLayout`.
  useLayoutEffect(() => {
    return tvFocus.register({
      id,
      disabled: latest.current.disabled,
      defaultFocus: options.defaultFocus,
      scope: options.scope,
      activate: () => latest.current.onSelect?.(),
      onFocusChange: setFocused,
      ownsDirection: (direction) => latest.current.ownsDirection?.(direction) ?? false,
      onDirection: (direction) => latest.current.onDirection?.(direction),
      rail: options.rail,
    });
  }, [id, options.defaultFocus, options.scope, options.rail]);

  // `disabled` is patched in place: re-registering deletes the entry's
  // rectangle, and the screen drops to sequential order until it is laid out
  // again. A selected element that becomes disabled yields to the default.
  const firstDisabled = useRef(true);
  useLayoutEffect(() => {
    if (firstDisabled.current) {
      firstDisabled.current = false;
      return;
    }
    tvFocus.update(id, { disabled: options.disabled });
    if (options.disabled && tvFocus.selected() === id) {
      tvFocus.select(undefined);
      tvFocus.focusDefault();
    }
  }, [id, options.disabled]);

  const onLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      // This callback often lands before registration; the registry holds it (`pendingRects`).
      ref.current?.measureInWindow((left, top, width, height) => {
        if (width > 0 && height > 0) tvFocus.measure(id, { left, top, width, height });
      });
    },
    [id],
  );

  return { focused, onLayout, ref };
}
