import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { Focusable } from './Focusable';
import { SettingsIcon, UserIcon } from './NavIcons';
import { px, colour, font, layout, pageGutter, radius, rem, type } from '../styles/theme';

export interface NavItem {
  key: string;
  label: string;
}

/**
 * The application top bar, from `.topbar` in base.css.
 *
 * The web client's three-column grid — brand, centred nav, trailing controls —
 * is reproduced with flex, since the grid there exists only to keep the nav
 * optically centred while the outer cells size to content.
 *
 * **The platform badge is gone, as it is there.** That client's own note says
 * it "labelled the build on every screen for the benefit of nobody but a
 * developer", and Status reports the platform beside the codec probes that give
 * it meaning. This carried "Android TV" in the same slot for the same bad
 * reason.
 *
 * The trailing pair is that client's `topbar-trailing`: who the viewer is, and
 * a cog to the settings screen. Identity is a glyph and a name rather than an
 * avatar, because *am I signed in as the right person* is the one question it
 * exists to answer at a glance.
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
  /** Who the session belongs to, when it belongs to anyone. */
  username?: string;
  /** Selecting the account signs out. Omitted when there is nobody to sign out. */
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

      {/* `.topbar-trailing { display: flex; align-items: center; gap: .75rem }` */}
      <View style={styles.trailing}>
        {/*
          * **Focusable, because a television has no other way out of an
          * account.** This was a plain `View` until 2026-09-21: drawn, never
          * registered, so the D-pad walked from Status straight to the cog and
          * skipped it. There was no sign-out behind it either, and none
          * anywhere else in the client — so a viewer on a set could not leave
          * an account at all, short of clearing the app's data.
          */}
        {username ? (
          <Focusable
            ring={false}
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
          ring={false}
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
  /** `.topbar-trailing { display: flex; align-items: center; gap: .75rem; margin-left: auto }`. */
  trailing: {
    minWidth: px(110),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: rem(0.75),
  },
  /**
   * `AccountMenu`'s trigger, reduced to what a remote can use.
   *
   * That client opens an overflow with sign-out and account links; there is no
   * `OverflowMenu` here yet (§4.3), and identity still has to be visible —
   * *am I signed in as the right person* is the question it exists to answer.
   * So the name is shown and the menu is not, rather than the control being
   * left out until the menu exists.
   */
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
