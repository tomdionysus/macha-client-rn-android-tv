import Svg, { Circle, Path } from 'react-native-svg';
import { colour, px } from '../styles/theme';

/**
 * The top bar's two trailing glyphs, ported from the web client.
 *
 * Both are its own geometry rather than a lookalike: `AccountMenu`'s `UserIcon`
 * and `ManageIcons`'s `SettingsIcon`, with the same paths, the same stroke
 * weight and the same 24-unit viewBox. A cog drawn from spokes reads as
 * brightness at three metres, which is why that file draws the tooth profile as
 * the outline — the note is worth keeping because the mistake is easy to repeat
 * when redrawing an icon from memory.
 *
 * Sized in CSS px through `px()`, like every other glyph here: the web client
 * draws the user at 18 and the cog at 18, and a raw number would be twice that
 * on this panel.
 */

interface NavIconProps {
  size?: number;
  colour?: string;
}

export function UserIcon({ size, colour: stroke = colour.textDim }: NavIconProps): React.JSX.Element {
  const dimension = size ?? px(18);
  return (
    <Svg width={dimension} height={dimension} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="3.6" fill="none" stroke={stroke} strokeWidth={1.6} />
      <Path
        d="M4.8 20c0-3.6 3.2-5.6 7.2-5.6s7.2 2 7.2 5.6"
        fill="none"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function SettingsIcon({ size, colour: stroke = colour.textDim }: NavIconProps): React.JSX.Element {
  const dimension = size ?? px(18);
  return (
    <Svg width={dimension} height={dimension} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19.14 12.94a7.07 7.07 0 0 0 0-1.88l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.65 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.07 7.07 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.61.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.48 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58Z"
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="2.6" fill="none" stroke={stroke} strokeWidth={1.5} />
    </Svg>
  );
}

/** The magnifier on the search field, from `.search-field`'s adornment. */
export function SearchIcon({ size, colour: stroke = colour.textDim }: NavIconProps): React.JSX.Element {
  const dimension = size ?? px(18);
  return (
    <Svg width={dimension} height={dimension} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="6.4" fill="none" stroke={stroke} strokeWidth={1.6} />
      <Path d="M15.8 15.8 20 20" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * `ManageIcons`'s `RefreshIcon`, same path, same 1.8 stroke. Search's control
 * row ends in it (`.search-bar-refresh`).
 */
export function RefreshIcon({ size, colour: stroke = colour.textDim }: NavIconProps): React.JSX.Element {
  const dimension = size ?? px(18);
  return (
    <Svg width={dimension} height={dimension} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 7v5h-5M5 17v-5h5M18.2 10A7 7 0 0 0 6.8 6.8L5 9m14 6-1.8 2.2A7 7 0 0 1 5.8 14"
        fill="none"
        stroke={stroke}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
