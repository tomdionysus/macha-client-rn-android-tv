import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  PlaybackMode,
  PlaybackPreferencesUpdate,
  PlaybackSession,
  PlaybackInstructionReport,
  PlaybackUpdate,
} from '@macha/core';
import { Focusable } from '../../components/Focusable';
import { colour, font, radius, rem, type } from '../../styles/theme';
import {
  assumptionNote,
  audioProcessingNote,
  instructionNote,
  MODE_LABELS,
  MODE_TRANSFORMS,
  noteIsWarning,
  streamLabel,
} from './playbackOptions';

/**
 * Playback options — mode, quality, audio, subtitles, source.
 *
 * The web client's `PlayerOptions`, re-laid for a remote. Same groups in the
 * same order and the same rules behind them (`playbackOptions.ts`), but the
 * controls are rows a D-pad crosses rather than inline buttons, and the whole
 * panel takes its own focus scope so the transport underneath cannot be reached
 * while it is open.
 *
 * **Why this matters more here than on the web.** Forcing a mode by hand is how
 * a downmix problem gets isolated, and the notes under the mode row are the
 * only place on a television where a silently-transcoding library can show
 * itself — there is no console anyone will open.
 */
export const OPTIONS_SCOPE = 'player-options';

export function PlayerOptions({
  session,
  pendingPreferences,
  instruction,
  onApply,
}: {
  session: PlaybackSession;
  pendingPreferences?: PlaybackPreferencesUpdate;
  instruction?: PlaybackInstructionReport;
  onApply: (update: PlaybackUpdate) => void;
}): React.JSX.Element {
  const effective = { ...session.preferences, ...pendingPreferences };
  const selectedAudio = pendingPreferences?.audioStream ?? session.selected.audioStream;
  const selectedSubtitle = pendingPreferences?.subtitleStream === null
    ? -1
    : pendingPreferences?.subtitleStream ?? session.selected.subtitleStream;

  /**
   * "Auto" is no longer a value the server understands — the client decides.
   * `'choose'` is a core-side sentinel that never reaches the wire: the
   * coordinator re-runs the instruction chooser against this media's facts and
   * this platform's policy, then sends a concrete mode.
   *
   * Sent on every press rather than clearing the field, so Auto means the same
   * thing mid-playback as it does at the start. An absent mode would leave the
   * server on whatever it was already doing, and the control would highlight
   * while changing nothing.
   */
  const applyMode = (value: PlaybackMode | 'choose') =>
    onApply({
      preferences: value === 'choose' ? { mode: value } : { mode: value, ...MODE_TRANSFORMS[value] },
    });
  const chosenByViewer = effective.mode !== undefined && effective.mode !== 'choose';
  const applyPreferences = (update: PlaybackPreferencesUpdate) => onApply({ preferences: update });

  const note = instructionNote(instruction);
  const assumed = assumptionNote(instruction);

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Playback options</Text>
      <ScrollView contentContainerStyle={styles.groups} scrollEnabled={false}>
        <Group label="Mode">
          <Option label="Auto" selected={!chosenByViewer} onSelect={() => applyMode('choose')} defaultFocus />
          {session.options.modes.map((candidate) => (
            <Option
              key={candidate}
              label={MODE_LABELS[candidate] ?? candidate}
              selected={effective.mode === candidate}
              onSelect={() => applyMode(candidate)}
            />
          ))}
        </Group>

        {note ? <Note text={note} warning={noteIsWarning(instruction)} /> : null}
        {assumed ? <Note text={assumed} warning /> : null}

        {session.options.canChangeQuality ? (
          <Group label="Quality">
            <Option
              label="Original"
              selected={effective.maxHeight === null && effective.maxBitrate === null}
              onSelect={() => applyPreferences({ maxHeight: null, maxBitrate: null })}
            />
            {session.options.qualityHeights.map((height) => (
              <Option
                key={height}
                label={`${height}p`}
                selected={effective.maxHeight === height}
                onSelect={() => applyPreferences({ maxHeight: height })}
              />
            ))}
          </Group>
        ) : null}

        {session.options.audioStreams.length > 0 ? (
          <>
            <Group label="Audio">
              {session.options.audioStreams.map((stream) => (
                <Option
                  key={stream.index}
                  label={streamLabel(stream, `Audio ${stream.index}`)}
                  selected={selectedAudio === stream.index}
                  onSelect={() => applyPreferences({ audioStream: stream.index, audioLanguage: '' })}
                />
              ))}
            </Group>
            <Note text={audioProcessingNote(session.transform.audio, session.output.audio?.codec)} />
          </>
        ) : null}

        {session.options.subtitleStreams.length > 0 ? (
          <Group label="Subtitles">
            <Option
              label="Off"
              selected={selectedSubtitle < 0}
              onSelect={() => applyPreferences({ subtitleStream: null, subtitleLanguage: '' })}
            />
            {session.options.subtitleStreams.map((stream) => (
              <Option
                key={stream.index}
                label={streamLabel(stream, `Subtitle ${stream.index}`)}
                selected={selectedSubtitle === stream.index}
                onSelect={() => applyPreferences({ subtitleStream: stream.index, subtitleLanguage: '' })}
              />
            ))}
          </Group>
        ) : null}

        {session.options.canSwitchMedia && session.options.mediaIds.length > 1 ? (
          <Group label="Source">
            {session.options.mediaIds.map((mediaId, index) => (
              <Option
                key={mediaId}
                label={`Source ${index + 1}`}
                selected={session.mediaId === mediaId}
                onSelect={() => onApply({ mediaId })}
              />
            ))}
          </Group>
        ) : null}
      </ScrollView>
      <Text style={styles.dismissHint}>Back to close</Text>
    </View>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.groupOptions}>{children}</View>
    </View>
  );
}

function Option({
  label,
  selected,
  onSelect,
  defaultFocus,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  defaultFocus?: boolean;
}): React.JSX.Element {
  return (
    <Focusable
      ring={false}
      scope={OPTIONS_SCOPE}
      defaultFocus={defaultFocus}
      onSelect={onSelect}
      style={[styles.option, selected && styles.optionSelected]}
      focusedStyle={styles.optionFocused}
    >
      {({ focused }) => (
        <Text style={[styles.optionLabel, (selected || focused) && styles.optionLabelActive]}>
          {label}
        </Text>
      )}
    </Focusable>
  );
}

function Note({ text, warning }: { text: string; warning?: boolean }): React.JSX.Element {
  return <Text style={[styles.note, warning && styles.noteWarning]}>{text}</Text>;
}

const styles = StyleSheet.create({
  /** `.player-options`, but a panel rather than an inline block. */
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '42%',
    backgroundColor: colour.accentSurfaceStrong,
    paddingHorizontal: rem(1.6),
    paddingTop: rem(1.4),
    paddingBottom: rem(1),
    zIndex: 20,
  },
  heading: {
    color: colour.text,
    fontSize: type.h2,
    fontWeight: font.weightSemibold,
    marginBottom: rem(0.8),
  },
  groups: {
    paddingBottom: rem(1),
  },
  group: {
    marginBottom: rem(1.1),
  },
  groupLabel: {
    color: colour.textDim,
    fontSize: type.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: rem(0.4),
  },
  groupOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rem(0.5),
  },
  option: {
    paddingHorizontal: rem(0.8),
    paddingVertical: rem(0.45),
    borderRadius: radius.control,
    backgroundColor: colour.surface2,
  },
  /** The current value, which is not the same as the focused one. */
  optionSelected: {
    backgroundColor: colour.accent,
  },
  optionFocused: {
    backgroundColor: colour.surface3,
  },
  optionLabel: {
    color: colour.textDim,
    fontSize: type.small,
  },
  optionLabelActive: {
    color: colour.text,
  },
  note: {
    color: colour.textDim,
    fontSize: type.small,
    marginTop: rem(-0.6),
    marginBottom: rem(1),
  },
  /**
   * A warning is the whole point of the note: it is the only signal on this
   * platform that the chooser fell back, or decided without something it
   * should have had.
   */
  noteWarning: {
    color: colour.text,
  },
  dismissHint: {
    color: colour.textFaint,
    fontSize: type.small,
    textAlign: 'right',
  },
});
