import { forwardRef, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusable } from '../hooks/useTvNavigation';
import type { TvDirection } from '../hooks/tvFocus';
import { colour, radius } from '../styles/theme';

export interface FocusableProps {
  /** A stable id, for moving focus here by name. See `useFocusable`. */
  focusId?: string;
  children: ReactNode | ((state: { focused: boolean }) => ReactNode);
  onSelect?: () => void;
  disabled?: boolean;
  defaultFocus?: boolean;
  scope?: string;
  style?: StyleProp<ViewStyle>;
  /** Style applied only while focused, on top of `style`. */
  focusedStyle?: StyleProp<ViewStyle>;
  /** Draw the standard focus ring. Off for elements with their own focus treatment. */
  ring?: boolean;
  /** Focus arrived or left; rows use it to scroll the focused card into view. */
  onFocusChange?: (focused: boolean) => void;
  /**
   * This element's box in its parent's coordinates, for a scroller following
   * focus. (`useFocusable` measures in window coordinates, wrong for `scrollTo`.)
   */
  onExtent?: (box: { x: number; y: number; width: number; height: number }) => void;
  /** Directions this element keeps rather than yielding to the focus scorer. */
  ownsDirection?: (direction: TvDirection) => boolean;
  onDirection?: (direction: TvDirection) => void;
  /** A side rail, reachable sideways from any row (the alphabet strip). */
  rail?: boolean;
}

/**
 * One D-pad-focusable element: `data-tv-focusable="true"` plus its
 * `:focus-visible` rule (`outline: 1px solid var(--focus)`). The border is
 * always present and only changes colour: the focus scorer reads these
 * rectangles, so focus must not resize the element.
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
    rail,
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
    rail,
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
        const { x, y, width, height } = event.nativeEvent.layout;
        onExtent?.({ x, y, width, height });
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
    // Stands in for `box-shadow: 0 0 14px var(--accent-glow)`: Android's
    // `elevation` cannot cast a coloured glow.
    backgroundColor: colour.accentFocusWash,
  },
});
