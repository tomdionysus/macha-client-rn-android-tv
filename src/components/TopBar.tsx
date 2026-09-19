import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { Focusable } from './Focusable';
import { px, colour, font, layout, pageGutter, radius, rem, type } from '../styles/theme';

export interface NavItem {
  key: string;
  label: string;
}

/**
 * The application top bar, from `.topbar` in base.css.
 *
 * The web client's three-column grid — brand, centred nav, platform badge —
 * is reproduced with flex, since the grid there exists only to keep the nav
 * optically centred while the outer cells size to content.
 */
export function TopBar({
  items,
  active,
  onSelect,
  badge,
}: {
  items: NavItem[];
  active: string;
  onSelect: (key: string) => void;
  badge?: string;
}): React.JSX.Element {
  return (
    <View style={styles.topbar}>
      <View style={styles.brand}>
        <Image source={require('../../assets/icon.png')} style={styles.logo} contentFit="contain" />
        <Text style={styles.brandName}>Macha</Text>
      </View>

      <View style={styles.nav}>
        {items.map((item) => (
          <Focusable
            key={item.key}
            ring={false}
            onSelect={() => onSelect(item.key)}
            style={[styles.navItem, active === item.key && styles.navItemActive]}
            focusedStyle={styles.navItemFocused}
          >
            {({ focused }) => (
              <Text style={[styles.navLabel, (active === item.key || focused) && styles.navLabelActive]}>
                {item.label}
              </Text>
            )}
          </Focusable>
        ))}
      </View>

      <View style={styles.badgeCell}>{badge ? <Text style={styles.badge}>{badge}</Text> : null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  // `.topbar { min-height: 62px; padding: .45rem 3vw; gap: 2rem }` over
  // `--navigation-surface`, whose two stops are close enough at this opacity
  // that a flat fill is indistinguishable on a panel.
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rem(2),
    minHeight: layout.topbarHeight,
    paddingVertical: rem(0.45),
    paddingHorizontal: pageGutter,
    backgroundColor: '#0e0e0ff7',
  },
  // `.brand-link { gap: .65rem }`
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rem(0.65),
    minWidth: px(110),
  },
  // `.app-logo { width: 42px; height: 42px }`
  logo: {
    width: px(42),
    height: px(42),
  },
  // `.brand-name { color: #d8d8dc; font-size: 1.08rem; font-weight: 500 }`
  brandName: {
    color: '#d8d8dc',
    fontSize: rem(1.08),
    fontWeight: font.weightMedium,
    letterSpacing: 0.14,
  },
  // `.topbar nav { display: flex; gap: .25rem; justify-content: center }`
  nav: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: rem(0.25),
  },
  // `.topbar nav a { padding: .65rem .9rem; border-radius: .55rem }`
  navItem: {
    paddingVertical: rem(0.65),
    paddingHorizontal: rem(0.9),
    borderRadius: radius.control,
  },
  // `.topbar nav a.active { background: var(--accent-surface) }`
  navItemActive: {
    backgroundColor: colour.accentSurface,
  },
  // `.section-subnav a:focus-visible { background: var(--accent-focus-wash) }`
  navItemFocused: {
    backgroundColor: colour.accentSurfaceStrong,
    borderColor: colour.focus,
  },
  navLabel: {
    color: colour.textDim,
    fontWeight: font.weightMedium,
    fontSize: type.body,
  },
  navLabelActive: {
    color: colour.text,
  },
  badgeCell: {
    minWidth: px(110),
    alignItems: 'flex-end',
  },
  // `.platform-badge { text-transform: uppercase; font-size: .72rem; letter-spacing: .14em }`
  badge: {
    color: colour.textFaint,
    textTransform: 'uppercase',
    fontSize: type.badge,
    letterSpacing: type.badge * 0.14,
  },
});
