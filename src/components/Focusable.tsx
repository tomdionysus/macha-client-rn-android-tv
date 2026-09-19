import { forwardRef, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusable } from '../hooks/useTvNavigation';
import type { TvDirection } from '../hooks/tvFocus';
import { colour, radius } from '../styles/theme';

export interface FocusableProps {
  /** A stable id, when something else moves focus here by name. See `useFocusable`. */
  focusId?: string;
  children: ReactNode | ((state: { focused: boolean }) => ReactNode);
  onSelect?: () => void;
  disabled?: boolean;
  defaultFocus?: boolean;
  scope?: string;
  style?: StyleProp<ViewStyle>;
  /** Style applied only while focused, on top of `style`. */
  focusedStyle?: StyleProp<ViewStyle>;
  /**
   * Draw the standard focus ring. Off for elements whose focus treatment is
   * entirely their own, as the web client does for cards and episode stills.
   */
  ring?: boolean;
  /**
   * Notified when focus arrives or leaves.
   *
   * Rows use this to scroll the focused card into view — the RN equivalent of
   * the web client's `next.scrollIntoView(false)` after it moves selection.
   */
  onFocusChange?: (focused: boolean) => void;
  /**
   * This element's box within its parent, as laid out.
   *
   * For a scroller that has to follow focus. `useFocusable` already measures
   * every focusable, but in *window* coordinates for the focus scorer, which is
   * the wrong frame for `scrollTo` — and a second `onLayout` cannot be added to
   * the view below from outside, since the first belongs to the registry.
   */
  onExtent?: (extent: { y: number; height: number }) => void;
  /** Directions this element keeps rather than yielding to the focus scorer. */
  ownsDirection?: (direction: TvDirection) => boolean;
  onDirection?: (direction: TvDirection) => void;
}

/**
 * One D-pad-focusable element — the RN equivalent of
 * `data-tv-focusable="true"` plus its `:focus-visible` rule.
 *
 * base.css draws focus with `outline: 1px solid var(--focus)` and a glow.
 * React Native has no outline, and a border that appears on focus would
 * reflow the element, so the border is always present and only its colour
 * changes. That keeps the geometry stable, which matters more here than it
 * does on the web: the focus scorer reads these rectangles, so an element that
 * resizes when focused would move the targets around it.
 */
export const Focusable = forwardRef<View, FocusableProps>(function Focusable(
  {
    children,
    focusId,
    onSelect,
    disabled,
    defaultFocus,
    scope,
    style,
    focusedStyle,
    ring = true,
    onFocusChange,
    onExtent,
    ownsDirection,
    onDirection,
  },
  _forwardedRef,
) {
  const { focused, onLayout, ref } = useFocusable({
    id: focusId,
    onSelect,
    disabled,
    defaultFocus,
    scope,
    ownsDirection,
    onDirection,
  });

  const previous = useRef(focused);
  useEffect(() => {
    if (previous.current === focused) return;
    previous.current = focused;
    onFocusChange?.(focused);
  }, [focused, onFocusChange]);

  return (
    <View
      ref={ref}
      onLayout={(event) => {
        onLayout(event);
        const { y, height } = event.nativeEvent.layout;
        onExtent?.({ y, height });
      }}
      style={[
        ring ? styles.ring : null,
        ring && focused ? styles.ringFocused : null,
        style,
        focused ? focusedStyle : null,
      ]}
    >
      {typeof children === 'function' ? children({ focused }) : children}
    </View>
  );
});

const styles = StyleSheet.create({
  ring: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.control,
  },
  ringFocused: {
    borderColor: colour.focus,
    // `box-shadow: 0 0 14px var(--accent-glow)` has no direct RN equivalent —
    // Android's `elevation` casts a black shadow, not a coloured glow — so the
    // wash carries the emphasis instead. It reads the same at three metres.
    backgroundColor: colour.accentFocusWash,
  },
});
