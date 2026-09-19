import Svg, { Circle, Path } from 'react-native-svg';
import { px, colour } from '../styles/theme';

export type PlayerIconName =
  | 'back'
  | 'previous'
  | 'rewind'
  | 'play'
  | 'pause'
  | 'forward'
  | 'next'
  | 'options'
  | 'close'
  | 'restart'
  | 'volume'
  | 'mute';

/**
 * The transport glyphs, with the same path data as the web client's
 * `PlayerIcon` and `PlaybackIcons`.
 *
 * Copied rather than redrawn: these are small shapes at a fixed 24-unit
 * viewBox, and an eyeballed redraw would differ in weight from the same button
 * on the web client sitting next to it on a desk.
 */
export function PlayerIcon({
  name,
  // `<svg width="20" height="20">` on the web client's `PlaybackIcons`. A raw
  // number here is CSS px drawn as dp, which on this panel is twice the size —
  // the same fault `theme.ts` carried, in the one place that does not go
  // through it. It filled the transport buttons where the web client's glyph
  // sits inside one.
  size = px(20),
  color = colour.heading,
}: {
  name: PlayerIconName;
  size?: number;
  color?: string;
}): React.JSX.Element {
  const stroke = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (name) {
    case 'back':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M14.5 5 7.5 12l7 7M8 12h9" {...stroke} />
        </Svg>
      );
    case 'previous':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M6 5h2v14H6V5Zm12 1-8 6 8 6V6Z" fill={color} />
        </Svg>
      );
    case 'rewind':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M10.5 6 4.5 12l6 6V6Zm8 0-6 6 6 6V6Z" fill={color} />
        </Svg>
      );
    case 'play':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M8 5.2v13.6L19 12 8 5.2Z" fill={color} />
        </Svg>
      );
    case 'pause':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M7.5 6h3v12h-3V6Zm6 0h3v12h-3V6Z" fill={color} />
        </Svg>
      );
    case 'forward':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="m13.5 6 6 6-6 6V6Zm-8 0 6 6-6 6V6Z" fill={color} />
        </Svg>
      );
    case 'next':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M16 5h2v14h-2V5ZM6 6l8 6-8 6V6Z" fill={color} />
        </Svg>
      );
    case 'options':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={6} cy={12} r={1.5} fill={color} />
          <Circle cx={12} cy={12} r={1.5} fill={color} />
          <Circle cx={18} cy={12} r={1.5} fill={color} />
        </Svg>
      );
    case 'close':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="m6 6 12 12M18 6 6 18" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
      );
    case 'restart':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M7.1 7.2H3.7V3.8" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M4 7.1A8.2 8.2 0 1 1 3.9 17" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
          <Path d="M10 8.2v7.6l6-3.8-6-3.8Z" fill={color} />
        </Svg>
      );
    case 'volume':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M4 10v4h3l4 3V7l-4 3H4Z" fill={color} />
          <Path d="M14 9.2a4 4 0 0 1 0 5.6M16.6 6.8a7.3 7.3 0 0 1 0 10.4" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
      );
    case 'mute':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M4 10v4h3l4 3V7l-4 3H4Z" fill={color} />
          <Path d="m15 9 5 6M20 9l-5 6" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
        </Svg>
      );
  }
}
