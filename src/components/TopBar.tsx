import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { Focusable } from './Focusable';
import { NAV_FOCUS_PREFIX } from '../hooks/tvFocus';
import { SettingsIcon, UserIcon } from './NavIcons';
import { px, colour, font, layout, pageGutter, radius, rem, type } from '../styles/theme';

export interface NavItem {
  key: string;
  label: string;
}

/**
 * The application top bar, from `.topbar` in base.css: brand, centred nav,
 * then the account and a cog to Settings.
 */
export function TopBar({
  items,
  active,
  onSelect,
  username,
  onSignOut,
  onOpenSettings,
  settingsActive,
}: {
  items: NavItem[];
  active: string;
  onSelect: (key: string) => void;
  username?: string;
  /** Selecting the account signs out. */
  onSignOut?: () => void;
  onOpenSettings: () => void;
  settingsActive?: boolean;
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
            focusId={`${NAV_FOCUS_PREFIX}${item.key}`}
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

      {/* `.topbar-trailing { display: flex; align-items: center; gap: .75rem }` */}
      <View style={styles.trailing}>
        {/* The client's only sign-out. */}
        {username ? (
          <Focusable
            onSelect={() => onSignOut?.()}
            disabled={!onSignOut}
            style={styles.account}
            focusedStyle={styles.navItemFocused}
          >
            {({ focused }) => (
              <>
                <UserIcon />
                <Text
                  style={[styles.accountName, focused && styles.accountNameFocused]}
                  numberOfLines={1}
                >
                  {username}
                </Text>
              </>
            )}
          </Focusable>
        ) : null}
        <Focusable
          focusId={`${NAV_FOCUS_PREFIX}settings`}
          onSelect={onOpenSettings}
          style={[styles.settings, settingsActive && styles.navItemActive]}
          focusedStyle={styles.navItemFocused}
        >
          {({ focused }) => (
            <SettingsIcon colour={settingsActive || focused ? colour.text : colour.textDim} />
          )}
        </Focusable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // `.topbar { min-height: 62px; padding: .45rem 3vw; gap: 2rem }`, with
  // `--navigation-surface`'s gradient as a flat fill.
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
  // With `Focusable`'s ring, which tells focus from the active page's fill.
  navItemFocused: {
    backgroundColor: colour.accentSurfaceStrong,
  },
  navLabel: {
    color: colour.textDim,
    fontWeight: font.weightMedium,
    fontSize: type.body,
  },
  navLabelActive: {
    color: colour.text,
  },
  /** `.topbar-trailing { display: flex; align-items: center; gap: .75rem; margin-left: auto }`. */
  trailing: {
    minWidth: px(110),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: rem(0.75),
  },
  // `AccountMenu`'s trigger without its overflow menu: the name only.
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rem(0.4),
    maxWidth: rem(11),
  },
  accountNameFocused: {
    color: colour.text,
  },
  accountName: {
    color: colour.textDim,
    fontSize: type.small,
  },
  /** `.topbar-settings { padding: .3rem; border-radius: .45rem }`. */
  settings: {
    padding: rem(0.3),
    borderRadius: radius.small,
  },
});
