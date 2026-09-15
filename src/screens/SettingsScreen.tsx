import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { checkPlatformSurface, type PlaybackCapabilities } from '@machafoundation/core';
import { androidTvPlatform } from '../platform/AndroidTvPlatform';
import { getBootstrapEndpoints, getDiscoveredEndpoints } from '../state/client';
import { Focusable } from '../components/Focusable';
import { failureTrailEnabled, setFailureTrailEnabled } from '../diagnostics/failureTrailSetting';
import { PageTitle } from '../components/Status';
import { colour, font, pageGutter, radius, rem, type } from '../styles/theme';

/**
 * Settings, and the place the decoder evidence is made visible.
 *
 * The capability panel is not decoration. The worst failure mode in this
 * client is silent: if the hardware probe returns something narrower than the
 * truth, the node transcodes a library that would have direct-played, the
 * picture still works, and nothing prompts anyone to look. A log line on a
 * television is not a symptom — so what was actually read off `MediaCodecList`
 * is shown here where a person can check it against the file being played.
 */
export function SettingsScreen(): React.JSX.Element {
  const [capabilities, setCapabilities] = useState<PlaybackCapabilities | undefined>();
  const [error, setError] = useState<Error | undefined>();
  // Seeded from storage once. The setting is only ever changed from this
  // control, so there is nothing to subscribe to.
  const [trailEnabled, setTrailEnabled] = useState(failureTrailEnabled);
  // Probed once: the answer cannot change while the app is running.
  const surface = useMemo(() => checkPlatformSurface(), []);

  useEffect(() => {
    androidTvPlatform
      .capabilities()
      .then(setCapabilities)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause : new Error(String(cause))),
      );
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <PageTitle>Settings</PageTitle>

      <View style={styles.section}>
        <Text style={styles.label}>Cluster endpoints</Text>
        {getBootstrapEndpoints().map((endpoint) => (
          <Text key={endpoint} style={styles.value}>
            {endpoint}
          </Text>
        ))}
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

      <View style={styles.section}>
        <Text style={styles.label}>Hardware decoding</Text>
        {error ? <Text style={styles.error}>{error.message}</Text> : null}
        {capabilities ? (
          <>
            <Capability name="Video" value={capabilities.videoCodecs.join(', ')} />
            <Capability name="Audio" value={capabilities.audioCodecs.join(', ')} />
            <Capability name="Containers" value={capabilities.containers.join(', ')} />
            <Capability name="HLS video" value={(capabilities.hlsVideoCodecs ?? []).join(', ')} />
            <Capability name="HLS audio" value={(capabilities.hlsAudioCodecs ?? []).join(', ')} />
            <Capability name="Bit depth" value={String(capabilities.videoBitDepth ?? 8)} />
            <Capability name="HDR" value={capabilities.hdr.length > 0 ? capabilities.hdr.join(', ') : 'SDR only'} />
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

      {/*
        Measured on the device rather than assumed. Core declares the platform
        surface it may use, but that is a compile-time boundary — whether this
        host supplies it is a separate question, and the answers differ per
        host: Chromium 47 on the Samsung set has no AbortController at all and
        is met by a polyfill the web client installs.
      */}
      <View style={styles.section}>
        <Text style={styles.label}>Platform surface</Text>
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

      {/*
        The first editable control on this screen.

        It is here rather than behind a build flag because the person who
        needs it is standing in front of the television with a remote, and a
        flag would mean a rebuild, a reinstall and a lost repro. It is off by
        default because the trail is for whoever is debugging, not for
        whoever is watching.
      */}
      <View style={styles.section}>
        <Text style={styles.label}>Diagnostics</Text>
        <Focusable
          onSelect={() => {
            const next = !trailEnabled;
            setFailureTrailEnabled(next);
            setTrailEnabled(next);
          }}
          style={styles.toggle}
          focusedStyle={styles.toggleFocused}
        >
          <View style={styles.toggleRow}>
            <Text style={styles.value}>Show evidence when playback fails</Text>
            <Text style={[styles.toggleState, trailEnabled && styles.toggleStateOn]}>
              {trailEnabled ? 'On' : 'Off'}
            </Text>
          </View>
        </Focusable>
        <Text style={styles.note}>
          Prints the last warnings and errors under the failure message on the player. A television
          has no console, so without this a failover and a dead node look identical from across the
          room.
        </Text>
      </View>
    </ScrollView>
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

const styles = StyleSheet.create({
  page: {
    paddingTop: rem(1),
    paddingBottom: rem(4),
  },
  section: {
    paddingHorizontal: pageGutter,
    marginBottom: rem(2.2),
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
  /**
   * The border is always present and only its colour changes on focus, as
   * `Focusable` documents: the focus scorer reads these rectangles, so a
   * control that resized when focused would move the targets around it.
   */
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
