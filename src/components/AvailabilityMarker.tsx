import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { MediaSummary } from '@machafoundation/core';
import { availabilityMarker, type AvailabilityMarkerKind } from './availability';
import { colour, rem } from '../styles/theme';

/**
 * A title's availability marker on a dark disc, or nothing.
 *
 * `overlay` places it at the artwork's top left, mirroring the Continue
 * Watching remove button at the top right; without it, it sits inline before
 * a heading. Icons only: a television has no hover to carry the web client's
 * tooltip.
 */
export function AvailabilityMarker({
  media,
  overlay = false,
  style,
}: {
  media: Pick<MediaSummary, 'availability'>;
  overlay?: boolean;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element | null {
  const kind = availabilityMarker(media);
  if (!kind) return null;
  return (
    <View style={[styles.disc, overlay && styles.overlay, style]}>
      <MarkerIcon kind={kind} size={rem(1.2)} />
    </View>
  );
}

function MarkerIcon({ kind, size }: { kind: AvailabilityMarkerKind; size: number }): React.JSX.Element {
  switch (kind) {
    case 'partial':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 3 22 20.5H2Z" stroke={colour.availabilityWarning} strokeWidth={2} strokeLinejoin="round" />
          <Path d="M12 9.5v5" stroke={colour.availabilityWarning} strokeWidth={2.2} strokeLinecap="round" />
          <Circle cx="12" cy="17.6" r="1.25" fill={colour.availabilityWarning} />
        </Svg>
      );
    case 'unavailable':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="9" stroke={colour.availabilityWarning} strokeWidth={2.2} />
          <Path d="M5.6 18.4 18.4 5.6" stroke={colour.availabilityWarning} strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
      );
    case 'unknown':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M8.6 9a3.5 3.5 0 1 1 5.1 3.1c-1 .5-1.7 1.3-1.7 2.4v.6"
            stroke={colour.availabilityUnknown}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <Circle cx="12" cy="19.2" r="1.4" fill={colour.availabilityUnknown} />
        </Svg>
      );
  }
}

const styles = StyleSheet.create({
  // The size and fill of `.card-close-button`, so the two corners match.
  disc: {
    width: rem(1.8),
    height: rem(1.8),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rem(0.9),
    backgroundColor: colour.markerSurface,
  },
  // `.continue-card-remove`'s inset, on the opposite corner.
  overlay: {
    position: 'absolute',
    top: rem(0.78),
    left: rem(0.78),
  },
});
