import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { BackHandler, type View, type LayoutChangeEvent } from 'react-native';
import { tvFocus, type TvCommand, type TvDirection } from './tvFocus';
import { addTvKeyListener } from '../../modules/macha-player/tvInput';

/**
 * Map the TV remote to the web client's command vocabulary.
 *
 * `select` is the D-pad centre and is the same gesture as the web client's
 * `activate`. Media keys are handled separately below, because they act on
 * playback rather than on focus.
 *
 * `back` is **not** here. It arrives through `BackHandler` instead — see
 * `useTvNavigation` — because only that can answer the platform synchronously
 * about whether the app consumed it.
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
}

/**
 * Attach the D-pad to the focus registry.
 *
 * Mounted once, at the app root, exactly as the web client attaches its
 * listener to `document` once.
 */
export function useTvNavigation(options: TvNavigationOptions = {}): void {
  const latest = useRef(options);
  latest.current = options;

  /**
   * Keys arrive from this client's own native bridge, not from
   * `useTVEventHandler`.
   *
   * React Native's TV event path does not exist in a bridgeless build —
   * `useTVEventHandler` waits on `onHWKeyEvent`, which only the legacy
   * `ReactRootView` emits. The consequence was not a subtle one: **the D-pad
   * did nothing at all**, on a client whose entire interface is a D-pad, and
   * nothing off-device could show it. `MachaTvInputModule.kt` records the full
   * chain.
   */
  useEffect(
    () =>
      addTvKeyListener((event) => {
        const handlers = latest.current;

        // Something else owns the remote — the platform IME, typically. Every
        // key belongs to it, including the transport keys, which would
        // otherwise act on playback the viewer cannot see behind it.
        if (tvFocus.suspended) return;

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
          default:
            break;
        }

        const command = COMMANDS[event.eventType];
        if (command) tvFocus.handle(command);
      }),
    [],
  );

  /**
   * Back, through the one mechanism that can answer the platform in time.
   *
   * `hardwareBackPress` is synchronous: returning true consumes the press and
   * false lets Android finish the activity. The key bridge cannot do that — it
   * would have to decide before JavaScript had seen the event — so guessing
   * there would either trap the viewer in the app or drop them out of it.
   */
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // Suspended means the IME has it, and Back is how a viewer closes the
      // keyboard. Yielding is the whole point.
      if (tvFocus.suspended) return false;
      return latest.current.onBack?.() ?? false;
    });
    return () => subscription.remove();
  }, []);
}

export interface UseFocusableOptions {
  /**
   * A stable id, when something else needs to move focus here by name.
   *
   * Defaults to React's generated id, which is fine for a focusable nobody
   * addresses. The alphabet strip is the case that needs this: jumping to a
   * letter means *selecting* that title's card, not merely scrolling to it —
   * on a D-pad, scrolling without moving focus leaves the next press jumping
   * straight back to wherever focus actually was.
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
}

export interface UseFocusableResult {
  focused: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
  ref: React.RefObject<View | null>;
}

/**
 * Register one focusable, the equivalent of `data-tv-focusable="true"`.
 *
 * Geometry comes from `measureInWindow` rather than `onLayout`'s local
 * coordinates: the scorer compares rectangles across the whole screen, and
 * layout-relative positions would make items in different parents
 * incomparable — which shows up as focus jumping to the wrong row.
 */
export function useFocusable(options: UseFocusableOptions = {}): UseFocusableResult {
  const generated = useId();
  const id = options.id ?? generated;
  const ref = useRef<View | null>(null);
  const [focused, setFocused] = useState(false);
  const latest = useRef(options);
  latest.current = options;

  // A layout effect, not a passive one: registration must not lose the race
  // with Fabric's `onLayout`, which is dispatched from native as soon as
  // layout commits. The registry holds early rectangles either way, but
  // registering first keeps the common path simple.
  useLayoutEffect(() => {
    return tvFocus.register({
      id,
      disabled: options.disabled,
      defaultFocus: options.defaultFocus,
      scope: options.scope,
      activate: () => latest.current.onSelect?.(),
      onFocusChange: setFocused,
      ownsDirection: (direction) => latest.current.ownsDirection?.(direction) ?? false,
      onDirection: (direction) => latest.current.onDirection?.(direction),
    });
  }, [id, options.disabled, options.defaultFocus, options.scope]);

  const onLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      // `measureInWindow` rather than the layout event's own coordinates: the
      // scorer compares rectangles across the whole screen, and parent-relative
      // positions would make items in different rows incomparable.
      //
      // Its callback routinely lands *before* this focusable has registered —
      // the registry holds early rectangles rather than dropping them, which is
      // why it navigates by geometry at all. See `TvFocusRegistry.pendingRects`.
      ref.current?.measureInWindow((left, top, width, height) => {
        if (width > 0 && height > 0) tvFocus.measure(id, { left, top, width, height });
      });
    },
    [id],
  );

  return { focused, onLayout, ref };
}
