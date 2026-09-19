import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  PlaybackMode,
  PlaybackPreferencesUpdate,
  PlaybackSession,
  PlaybackInstructionReport,
  PlaybackUpdate,
} from '@machafoundation/core';
import { Focusable } from '../../components/Focusable';
import { colour, px, radius, rem, type, vh } from '../../styles/theme';
import {
  assumptionNote,
  audioProcessingNote,
  instructionNote,
  MODE_LABELS,
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
   *
   * The mode is sent **alone**. Naming it clears the per-stream transforms and
   * the quality caps server-side, which is what lets the chooser re-derive them
   * — see `playbackOptions.ts` for why restating them here was wrong.
   */
  const applyMode = (value: PlaybackMode | 'choose') => onApply({ preferences: { mode: value } });
  const chosenByViewer = effective.mode !== undefined && effective.mode !== 'choose';
  const applyPreferences = (update: PlaybackPreferencesUpdate) => onApply({ preferences: update });

  const note = instructionNote(instruction);
  const assumed = assumptionNote(instruction);

  return (
    <View style={styles.panel}>
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
  /**
   * `.player-options { display: grid; gap: .65rem; max-height: min(34vh, 320px);
   * margin: 0 0 1rem; padding: .8rem 0 .2rem; overflow-y: auto }`.
   *
   * **A block inside the chrome, above the scrubber — not a pane.** It was a
   * 42%-wide panel pinned to the right edge until Tom read it against the web
   * client on the set. The groups and their order were already right; what was
   * wrong was that it covered the picture, sat somewhere the web client has
   * nothing, and drew its own heading.
   */
  panel: {
    maxHeight: Math.min(vh(34), px(320)),
    marginBottom: rem(1),
    paddingTop: rem(0.8),
    paddingBottom: rem(0.2),
  },
  groups: {
    gap: rem(0.65),
  },
  /** `.player-option-group { grid-template-columns: 6.5rem 1fr; gap: .8rem }`. */
  group: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: rem(0.8),
  },
  /**
   * `.player-option-group > span { padding-top: .45rem; color: var(--text-faint);
   * font-size: .78rem; text-transform: uppercase; letter-spacing: .08em }`.
   */
  groupLabel: {
    width: rem(6.5),
    paddingTop: rem(0.45),
    color: colour.textFaint,
    fontSize: type.eyebrow,
    letterSpacing: type.eyebrow * 0.08,
    textTransform: 'uppercase',
  },
  /** `.player-option-group > div { display: flex; flex-wrap: wrap; gap: .4rem }`. */
  groupOptions: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rem(0.4),
  },
  /**
   * `.player-option-group button { border: 1px solid #3a3a40; border-radius: 999px;
   * padding: .42rem .7rem; background: #09090ab8; color: #bcbcc2; font-size: .82rem }`.
   *
   * A pill, which is the part that read as a different interface: these were
   * rounded rectangles on a surface fill, with no border at all.
   */
  option: {
    paddingHorizontal: rem(0.7),
    paddingVertical: rem(0.42),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colour.inputBorder,
    backgroundColor: colour.optionSurface,
  },
  /**
   * `:hover, :focus-visible, .selected { border-color: var(--focus);
   * background: var(--accent-surface-strong); color: #dedee2 }` — one rule for
   * all three on the web, and selected and focused are different things here, so
   * the border carries focus and the fill carries selection.
   */
  optionSelected: {
    backgroundColor: colour.accentSurfaceStrong,
  },
  optionFocused: {
    borderColor: colour.focus,
    backgroundColor: colour.accentSurfaceStrong,
  },
  optionLabel: {
    color: colour.optionText,
    fontSize: type.small,
  },
  optionLabelActive: {
    color: colour.heading,
  },
  /** `.player-option-note { grid-column: 2; color: var(--text-faint); font-size: .75rem }`. */
  note: {
    marginLeft: rem(7.3),
    color: colour.textFaint,
    fontSize: type.faint,
    lineHeight: type.faint * 1.35,
  },
  /**
   * A warning is the whole point of the note: it is the only signal on this
   * platform that the chooser fell back, or decided without something it
   * should have had.
   */
  noteWarning: {
    color: colour.text,
  },
});
