import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { checkPlatformSurface, type PlaybackCapabilities } from '@machafoundation/core';
import { androidTvPlatform } from '../platform/AndroidTvPlatform';
import { useMacha } from '../app/MachaProvider';
import { useRefreshableAsync } from '../hooks/useAsync';
import {
  getBootstrapEndpoints,
  getDiscoveredEndpoints,
  setBootstrapEndpoints,
} from '../state/client';
import { Focusable } from '../components/Focusable';
import { Button } from '../components/Button';
import { TvTextInput } from '../components/TvTextInput';
import { failureTrailEnabled, setFailureTrailEnabled } from '../diagnostics/failureTrailSetting';
import { PageTitle } from '../components/Status';
import { usePageFocusScroll } from '../hooks/usePageFocusScroll';
import { colour, font, pageGutter, radius, rem, type } from '../styles/theme';
import { version as clientVersion } from '../../package.json';
import { catalogueStatusText, errorText, isSignedOut, serverStatusText } from '../text/viewerText';

/**
 * Settings, laid out as the web client's is.
 *
 * **Its shape, section for section**: the brand hero with the one line that
 * says whether the system is working, a row of status cards for Server,
 * Catalogue and Client, Connection — where the endpoints are *edited* rather
 * than listed — and Diagnostics. This screen had a read-only endpoint list and
 * two blocks that client does not have, which is what Tom read as "nothing like
 * the web client" off the set.
 *
 * **The two blocks that stay are the reason this client exists.** Hardware
 * decoding is what `MediaCodecList` actually answered, and the platform surface
 * is what core's contract found here; neither has a web counterpart because
 * neither question arises in a browser. They come last, so the screen reads the
 * same as that one until it runs out of shared ground. The decoder panel is not
 * decoration: the worst failure in this client is silent — a probe narrower
 * than the truth means the node transcodes a library that would have
 * direct-played, the picture still works, and nothing prompts anyone to look.
 *
 * **Endpoints are the one control a bricked set needs.** A television has no
 * address bar, so when a cluster stops answering this is the only way to point
 * the client somewhere else — which is why Settings stays reachable from behind
 * the login wall (`App.tsx`), and why editing belongs here rather than in a
 * developer build.
 */
export function SettingsScreen(): React.JSX.Element {
  const { services } = useMacha();
  const { scroller, measureViewport, measureRow, revealRow } = usePageFocusScroll(SCROLL_LEAD);

  const [capabilities, setCapabilities] = useState<PlaybackCapabilities | undefined>();
  const [error, setError] = useState<Error | undefined>();
  // Seeded from storage once. The setting is only ever changed from this
  // control, so there is nothing to subscribe to.
  const [trailEnabled, setTrailEnabled] = useState(failureTrailEnabled);
  // Probed once: the answer cannot change while the app is running.
  const surface = useMemo(() => checkPlatformSurface(), []);

  const server = useRefreshableAsync(() => services.serverApi.status(), [services.serverApi]);
  const catalogue = useRefreshableAsync(
    () => services.catalogueApi.status(),
    [services.catalogueApi],
  );

  const [endpoints, setEndpoints] = useState(() => getBootstrapEndpoints().join(', '));
  const [endpointNotice, setEndpointNotice] = useState<string | undefined>();

  useEffect(() => {
    androidTvPlatform
      .capabilities()
      .then(setCapabilities)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause : new Error(String(cause))),
      );
  }, []);

  /**
   * The one line a person actually reads on this screen.
   *
   * The web client's ladder in its order: an unreachable server outranks an
   * unreachable catalogue, which outranks a catalogue still synchronising.
   * Reproduced rather than reinvented, because "Ready" has to mean the same
   * thing on both clients — a viewer comparing them is entitled to that much.
   */
  // Signed out is not an outage (§1.12): it outranks the rest of the ladder,
  // which would otherwise report a 401 as "catalogue unavailable".
  const signedOut =
    isSignedOut(server.error) ||
    isSignedOut(catalogue.error) ||
    server.value?.httpStatus === 401 ||
    server.value?.httpStatus === 403;
  const overallState = signedOut
    ? "Signed out: sign in to see this server's state"
    : server.error
    ? 'Server unavailable'
    : catalogue.error
      ? 'Server online; catalogue unavailable'
      : catalogue.value?.ready
        ? 'Ready'
        : catalogue.loading || server.loading
          ? 'Checking system state…'
          : 'Server online; catalogue synchronising';

  const saveEndpoints = () => {
    const parsed = endpoints
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (parsed.length === 0) {
      setEndpointNotice('Give at least one endpoint, for example http://macha-node:7438');
      return;
    }
    setBootstrapEndpoints(parsed);
    // Stated rather than implied. The registry is built from this list once, at
    // startup, so the endpoints are saved now and adopted on the next launch —
    // and a viewer who is not told that concludes the change did nothing.
    setEndpointNotice('Saved. Restart the app to connect to these.');
  };

  return (
    <View style={styles.fill} onLayout={measureViewport}>
      <ScrollView ref={scroller} contentContainerStyle={styles.page} scrollEnabled={false}>
        {/* `.settings-hero`: logo, eyebrow, name, and the state line. */}
        <View style={styles.hero}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.heroLogo}
            contentFit="contain"
          />
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Media server</Text>
            <PageTitle>Macha</PageTitle>
            <Text style={styles.heroState}>{overallState}</Text>
          </View>
        </View>

        {/* `.settings-status-grid` — three cards, in the same order. */}
        <View style={styles.statusGrid}>
          <StatusCard
            label="Server"
            state={server.error ? 'Unavailable' : server.value ? 'Online' : 'Checking…'}
            rows={[
              ['Version', server.value?.version ?? (server.loading ? 'Checking…' : 'Not reported')],
              [
                'Playback',
                signedOut
                  ? 'Sign in required'
                  : server.error
                  ? 'Unavailable'
                  : server.value?.playbackAvailable
                    ? 'Available'
                    : 'Unavailable',
              ],
            ]}
            error={server.error ? errorText(server.error) : (server.value ? serverStatusText(server.value) : undefined)}
          />
          <StatusCard
            label="Catalogue"
            state={
              signedOut
                ? 'Sign in required'
                : catalogue.error
                ? 'Unavailable'
                : catalogue.value?.ready
                  ? 'Ready'
                  : catalogue.value
                    ? 'Synchronising'
                    : 'Checking…'
            }
            rows={[
              ['Items', catalogue.value ? String(catalogue.value.items) : '—'],
              [
                'Artwork',
                catalogue.value
                  ? `${catalogue.value.local_artwork_objects}/${catalogue.value.artwork_objects} local`
                  : '—',
              ],
              ['Generation', catalogue.value ? String(catalogue.value.metadata_generation) : '—'],
            ]}
            error={catalogue.error ? errorText(catalogue.error) : (catalogue.value ? catalogueStatusText(catalogue.value) : undefined)}
          />
          <StatusCard label="Client" state="Android TV" rows={[['Version', clientVersion]]} />
        </View>

        {/* `.settings-connection`, and the reason a television needs it. */}
        <View style={styles.section} onLayout={measureRow('connection')}>
          <Text style={styles.heading}>Connection</Text>
          <Text style={styles.label}>Macha bootstrap API endpoints</Text>
          <TvTextInput
            value={endpoints}
            onChangeText={(value) => {
              setEndpoints(value);
              setEndpointNotice(undefined);
            }}
            onSubmit={saveEndpoints}
            placeholder="http://macha-node:7438"
          />
          <Button
            label="Save endpoints"
            onSelect={saveEndpoints}
            onFocusChange={(focused) => focused && revealRow('connection')}
            style={styles.buttonPlacement}
          />
          {endpointNotice ? <Text style={styles.notice}>{endpointNotice}</Text> : null}
          {getDiscoveredEndpoints().length > 0 ? (
            <>
              <Text style={styles.label}>Discovered</Text>
              {getDiscoveredEndpoints().map((endpoint) => (
                <Text key={endpoint} style={styles.value}>
                  {endpoint}
                </Text>
              ))}
            </>
          ) : null}
        </View>

        {/* `.settings-diagnostics`. */}
        <View style={styles.section} onLayout={measureRow('diagnostics')}>
          <Text style={styles.heading}>Diagnostics</Text>
          <Focusable
            onSelect={() => {
              const next = !trailEnabled;
              setFailureTrailEnabled(next);
              setTrailEnabled(next);
            }}
            onFocusChange={(focused) => focused && revealRow('diagnostics')}
            style={styles.toggle}
            focusedStyle={styles.toggleFocused}
          >
            <View style={styles.toggleRow}>
              <Text style={styles.value}>Show extended playback logging</Text>
              <Text style={[styles.toggleState, trailEnabled && styles.toggleStateOn]}>
                {trailEnabled ? 'On' : 'Off'}
              </Text>
            </View>
          </Focusable>
          {/*
            The web client's label reads "…on errors", because on that client
            it is only ever on errors. Here it is also the running trail and
            the session id, which is why the words differ: a television is the
            one host where the buffer cannot be read any other way — a release
            build writes no console and the set's `adb` is over the link its
            own notes call the unreliable half.
          */}
          <Text style={styles.note}>
            Prints the last warnings and errors under the failure message on the player, and, while
            a film is running, the session id and the trail as it fills. A television has no
            console, so without this a failover and a dead node look identical from across the room
            — and a failover that recovers silently leaves no trace at all.
          </Text>
        </View>

        {/*
          Past here is this platform's own, and has no web counterpart: a
          browser cannot ask either question.
        */}
        <View style={styles.section} onLayout={measureRow('decoding')}>
          <Text style={styles.heading}>Hardware decoding</Text>
          {error ? <Text style={styles.error}>{errorText(error)}</Text> : null}
          {capabilities ? (
            <>
              <Capability name="Video" value={capabilities.videoCodecs.join(', ')} />
              <Capability name="Audio" value={capabilities.audioCodecs.join(', ')} />
              <Capability name="Containers" value={capabilities.containers.join(', ')} />
              <Capability name="HLS video" value={(capabilities.hlsVideoCodecs ?? []).join(', ')} />
              <Capability name="HLS audio" value={(capabilities.hlsAudioCodecs ?? []).join(', ')} />
              <Capability name="Bit depth" value={String(capabilities.videoBitDepth ?? 8)} />
              <Capability
                name="HDR"
                value={capabilities.hdr.length > 0 ? capabilities.hdr.join(', ') : 'SDR only'}
              />
              <Capability
                name="Dolby Vision"
                value={
                  capabilities.dolbyVision && capabilities.dolbyVision.length > 0
                    ? `profiles ${capabilities.dolbyVision.join(', ')}`
                    : 'none'
                }
              />
              <Capability
                name="Decoder limit"
                value={
                  capabilities.maxWidth && capabilities.maxHeight
                    ? `${capabilities.maxWidth}×${capabilities.maxHeight}`
                    : 'unreported'
                }
              />
            </>
          ) : (
            <Text style={styles.value}>Reading MediaCodecList…</Text>
          )}
          <Text style={styles.note}>
            Read from the platform decoder list, not a browser probe. AC-3 and E-AC-3 here mean this
            set direct-plays surround audio the WebView client had to have transcoded.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Platform surface</Text>
          {surface.map((finding) => (
            <View key={finding.name} style={styles.row}>
              <Text style={styles.rowName}>{finding.name}</Text>
              <Text
                style={[
                  styles.rowValue,
                  finding.status === 'absent' && finding.required && styles.error,
                  !finding.required && finding.status !== 'present' && styles.rowValueMuted,
                ]}
              >
                {finding.detail ?? finding.status}
              </Text>
            </View>
          ))}
          <Text style={styles.note}>
            Required members must all be present; optional ones absent here are expected on Hermes and
            are handled by core's own guards.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/** `.settings-status-card`: a label, a state, and a short definition list. */
function StatusCard({
  label,
  state,
  rows,
  error,
}: {
  label: string;
  state: string;
  rows: [string, string][];
  error?: string;
}): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardState}>{state}</Text>
      {rows.map(([name, value]) => (
        <View key={name} style={styles.row}>
          <Text style={styles.rowName}>{name}</Text>
          <Text style={styles.rowValue}>{value}</Text>
        </View>
      ))}
      {error ? <Text style={styles.cardError}>{error}</Text> : null}
    </View>
  );
}

function Capability({ name, value }: { name: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowName}>{name}</Text>
      <Text style={styles.rowValue}>{value || '—'}</Text>
    </View>
  );
}

/**
 * Breathing room above and below a control scrolled to.
 *
 * One line of text. Flush against the edge of a panel reads as cut off from
 * three metres, where there is no scrollbar to say otherwise.
 */
const SCROLL_LEAD = rem(1.5);

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  page: {
    paddingTop: rem(1),
    paddingBottom: rem(4),
  },
  /** `.settings-hero { display: flex; align-items: center; gap: 1.2rem }`. */
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rem(1.2),
    paddingHorizontal: pageGutter,
    marginBottom: rem(1.6),
  },
  heroLogo: {
    width: rem(4.6),
    height: rem(4.6),
  },
  heroCopy: {
    flex: 1,
  },
  /** `.eyebrow { text-transform: uppercase; letter-spacing: .08em }`. */
  eyebrow: {
    color: colour.textFaint,
    fontSize: type.eyebrow,
    textTransform: 'uppercase',
    letterSpacing: type.eyebrow * 0.08,
  },
  heroState: {
    color: colour.textDim,
    fontSize: type.subtitle,
  },
  /** `.settings-status-grid { display: grid; gap: .9rem }`, laid across on a TV. */
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rem(0.9),
    paddingHorizontal: pageGutter,
    marginBottom: rem(2),
  },
  card: {
    flexGrow: 1,
    flexBasis: rem(16),
    padding: rem(0.9),
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colour.hairline,
    backgroundColor: colour.surface,
  },
  cardLabel: {
    color: colour.textFaint,
    fontSize: type.eyebrow,
    textTransform: 'uppercase',
    letterSpacing: type.eyebrow * 0.08,
  },
  cardState: {
    color: colour.heading,
    fontSize: type.subtitle,
    fontWeight: font.weightMedium,
    marginBottom: rem(0.5),
  },
  cardError: {
    marginTop: rem(0.4),
    color: colour.error,
    fontSize: type.faint,
  },
  section: {
    paddingHorizontal: pageGutter,
    marginBottom: rem(2.2),
  },
  heading: {
    color: colour.heading,
    fontSize: type.h2,
    fontWeight: font.weightMedium,
    marginBottom: rem(0.6),
  },
  // `.settings label { display: block; color: var(--text-dim); margin: 1rem 0 .45rem }`
  label: {
    color: colour.textDim,
    marginTop: rem(1),
    marginBottom: rem(0.45),
    fontSize: type.body,
  },
  value: {
    color: colour.text,
    fontSize: type.body,
    marginBottom: rem(0.2),
  },
  notice: {
    marginTop: rem(0.5),
    color: colour.textDim,
    fontSize: type.small,
  },
  /** `.settings button { margin: .7rem 0 }`, left-aligned under its field. */
  buttonPlacement: {
    alignSelf: 'flex-start',
    marginTop: rem(0.8),
  },
  // `.player-option-group { grid-template-columns: 6.5rem 1fr }`
  row: {
    flexDirection: 'row',
    gap: rem(0.8),
    marginBottom: rem(0.35),
  },
  rowName: {
    width: rem(9),
    color: colour.textFaint,
    fontSize: type.eyebrow,
    textTransform: 'uppercase',
    letterSpacing: type.eyebrow * 0.08,
    paddingTop: rem(0.15),
  },
  rowValue: {
    flex: 1,
    color: colour.text,
    fontSize: type.body,
  },
  rowValueMuted: {
    color: colour.textFaint,
  },
  note: {
    marginTop: rem(1),
    color: colour.textFaint,
    fontSize: type.faint,
    lineHeight: type.faint * 1.35,
    maxWidth: rem(46),
  },
  error: {
    color: colour.error,
    fontWeight: font.weightMedium,
  },
  toggle: {
    alignSelf: 'flex-start',
    minWidth: rem(24),
    paddingVertical: rem(0.6),
    paddingHorizontal: rem(0.9),
    borderRadius: radius.control,
    backgroundColor: colour.surface2,
  },
  toggleFocused: {
    backgroundColor: colour.surface3,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rem(1.5),
  },
  toggleState: {
    color: colour.textFaint,
    fontSize: type.body,
    fontWeight: font.weightMedium,
  },
  toggleStateOn: {
    color: colour.focus,
  },
});
