import { StyleSheet, Text, View } from 'react-native';
import type { MediaSummary } from '@machafoundation/core';
import { LazyArtwork } from '../../components/LazyArtwork';
import { useMacha } from '../../app/MachaProvider';
import { trackFacts } from '../../text/viewerText';
import { colour, font, rem, vh, vw } from '../../styles/theme';

/**
 * A track in the player: its artwork, and what it is beneath it.
 *
 * Without this a track played over a black video surface with nothing on it.
 * Tom asked, 2026-09-24, for the artist, album, year and track below the
 * artwork; this is the web client's `.audio-player-*` presentation, ported
 * from `macha-client` `src/styles/base.css` 869–878 as they stood in that
 * tree the same evening (**uncommitted there**, so re-check them when they
 * land). The radial gradient behind it is not ported: React Native has none
 * built in, and the plain background is what the gradient fades to.
 */
export function AudioPresentation({ track }: { track: MediaSummary }): React.JSX.Element {
  const { services } = useMacha();
  const artwork = track.artwork?.poster ?? track.artwork?.thumbnail;
  const facts = trackFacts(track);
  return (
    <View style={styles.fill} pointerEvents="none">
      <View style={styles.art}>
        {artwork ? (
          <LazyArtwork api={services.mediaApi} artwork={artwork} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderGlyph}>{track.title.charAt(0).toUpperCase()}</Text>
          </View>
        )}
      </View>
      {facts.artist || facts.album || facts.track ? (
        <View style={styles.facts}>
          {facts.artist ? <Text style={styles.artist} numberOfLines={1}>{facts.artist}</Text> : null}
          {facts.album ? <Text style={styles.album} numberOfLines={1}>{facts.album}</Text> : null}
          {facts.track ? <Text style={styles.trackLine} numberOfLines={1}>{facts.track.toUpperCase()}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

/** `.audio-player-art { width: min(42vh, 38vw, 420px) }` */
const ART = Math.min(vh(42), vw(38), 420);
/** `.audio-player-art { top: 44% }`, centred on that line. */
const ART_CENTRE = vh(44);

const styles = StyleSheet.create({
  fill: StyleSheet.absoluteFill,
  /** `.audio-player-art` — centred, rounded, on `--surface-2`. */
  art: {
    position: 'absolute',
    left: (vw(100) - ART) / 2,
    top: ART_CENTRE - ART / 2,
    width: ART,
    height: ART,
    /** `.audio-player-art { border-radius: .8rem }` — not `radius.card`, which is .75rem. */
    borderRadius: rem(0.8),
    overflow: 'hidden',
    backgroundColor: colour.surface2,
  },
  image: { width: '100%', height: '100%' },
  /** `.audio-player-placeholder` — the web client's glyph is a note; the TV uses the initial, as its cards do. */
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderGlyph: { fontFamily: font.family, fontSize: rem(7), color: colour.audioPlaceholderGlyph },
  /** `.audio-player-facts { top: calc(44% + half the art + 1.3rem); width: min(90vw, 36rem) }` */
  facts: {
    position: 'absolute',
    top: ART_CENTRE + ART / 2 + rem(1.3),
    left: (vw(100) - Math.min(vw(90), rem(36))) / 2,
    width: Math.min(vw(90), rem(36)),
    alignItems: 'center',
  },
  /** `.audio-player-artist { color: #f2f2f4; font-size: 1.35rem; font-weight: 600 }` */
  artist: { fontFamily: font.family, color: colour.audioArtist, fontSize: rem(1.35), fontWeight: font.weightSemibold },
  /** `.audio-player-album { margin-top: .3rem; color: var(--text-dim); font-size: 1.05rem }` */
  album: { fontFamily: font.family, marginTop: rem(0.3), color: colour.textDim, fontSize: rem(1.05) },
  /** `.audio-player-track { margin-top: .35rem; color: var(--text-faint); font-size: .85rem; letter-spacing: .06em; uppercase }` */
  trackLine: {
    fontFamily: font.family,
    marginTop: rem(0.35),
    color: colour.textFaint,
    fontSize: rem(0.85),
    letterSpacing: rem(0.85) * 0.06,
  },
});
