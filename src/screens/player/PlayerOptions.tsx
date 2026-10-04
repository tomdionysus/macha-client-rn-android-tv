import { createContext, useContext } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  OfferedMode,
  PlaybackMode,
  PlaybackPreferencesUpdate,
  PlaybackSession,
  PlaybackInstructionReport,
  PlaybackUpdate,
  PlaybackVersions,
  VersionStep,
} from '@machafoundation/core';
import { Focusable } from '../../components/Focusable';
import { colour, focusFrame, px, radius, rem, type, vh } from '../../styles/theme';
import { qualityChoiceText, qualityLabel } from '../../text/viewerText';
import {
  assumptionNote,
  audioProcessingNote,
  instructionNote,
  MODE_LABELS,
  modeChoices,
  modeObjectionNote,
  noteIsWarning,
  qualityChoices,
  streamLabel,
} from './playbackOptions';

/**
 * Playback options: mode, quality, audio, subtitles. The web client's
 * `PlayerOptions` as D-pad rows, with the rules in `playbackOptions.ts`. The
 * panel takes its own focus scope, so the transport is unreachable while open.
 */
export const OPTIONS_SCOPE = 'player-options';

/**
 * Down from the last group leaves the panel for the transport. Context, not a
 * prop: only the last group's options get it, and which group is last varies.
 */
const ExitDown = createContext<(() => void) | undefined>(undefined);

export function PlayerOptions({
  session,
  pendingPreferences,
  instruction,
  versions,
  offeredModes,
  onApply,
  onPlayVersion,
  onDismiss,
}: {
  session: PlaybackSession;
  pendingPreferences?: PlaybackPreferencesUpdate;
  instruction?: PlaybackInstructionReport;
  versions?: PlaybackVersions;
  /** Core's verdict per mode for the file playing; undefined without facts. */
  offeredModes?: readonly OfferedMode[];
  onApply: (update: PlaybackUpdate) => void;
  onPlayVersion: (step: VersionStep) => void;
  /** Called on Down from the last row. */
  onDismiss: () => void;
}): React.JSX.Element {
  const qualityRow = qualityChoices(
    versions?.steps ?? [],
    session.options.qualityHeights,
    session.options.canChangeQuality,
  );
  const hasQuality = qualityRow.length > 0;
  const hasAudio = session.options.audioStreams.length > 0;
  const hasSubtitles = session.options.subtitleStreams.length > 0;
  const lastGroup = hasSubtitles
    ? 'subtitles'
    : hasAudio
      ? 'audio'
      : hasQuality
        ? 'quality'
        : 'mode';

  const effective = { ...session.preferences, ...pendingPreferences };
  const selectedAudio = pendingPreferences?.audioStream ?? session.selected.audioStream;
  const selectedSubtitle = pendingPreferences?.subtitleStream === null
    ? -1
    : pendingPreferences?.subtitleStream ?? session.selected.subtitleStream;

  /**
   * `'choose'` is core's sentinel for Auto and never reaches the wire: the
   * coordinator re-runs the chooser and sends a concrete mode. Sent on every
   * press, since an absent mode changes nothing. The mode is sent alone:
   * naming it clears the stream transforms and quality caps server-side.
   */
  const applyMode = (value: PlaybackMode | 'choose') => onApply({ preferences: { mode: value } });
  const chosenByViewer = effective.mode !== undefined && effective.mode !== 'choose';
  const applyPreferences = (update: PlaybackPreferencesUpdate) => onApply({ preferences: update });

  const modes = modeChoices(session.options.modes, offeredModes);
  const objections = modeObjectionNote(modes);
  const note = instructionNote(instruction);
  const assumed = assumptionNote(instruction);

  return (
    <View style={styles.panel}>
      <ScrollView contentContainerStyle={styles.groups} scrollEnabled={false}>
        <Group label="Mode" exitDown={lastGroup === 'mode' ? onDismiss : undefined}>
          <Option label="Auto" selected={!chosenByViewer} onSelect={() => applyMode('choose')} defaultFocus />
          {modes.map(({ mode: candidate }) => (
            <Option
              key={candidate}
              label={MODE_LABELS[candidate] ?? candidate}
              selected={effective.mode === candidate}
              onSelect={() => applyMode(candidate)}
            />
          ))}
        </Group>

        {objections ? <Note text={objections} warning /> : null}

        {note ? <Note text={note} warning={noteIsWarning(instruction)} /> : null}
        {assumed ? <Note text={assumed} warning /> : null}

        {/* The item's versions, then any smaller cap the node offers. */}
        {hasQuality ? (
          <>
            <Group label="Quality" exitDown={lastGroup === 'quality' ? onDismiss : undefined}>
              {qualityRow.map((choice) =>
                choice.kind === 'version' ? (
                  <Option
                    key={`v${choice.step.quality}`}
                    label={qualityLabel(choice.step.quality)}
                    selected={instruction?.quality === choice.step.quality}
                    onSelect={() => onPlayVersion(choice.step)}
                  />
                ) : choice.kind === 'cap' ? (
                  <Option
                    key={`c${choice.height}`}
                    label={`${choice.height}p`}
                    selected={effective.maxHeight === choice.height}
                    onSelect={() => applyPreferences({ maxHeight: choice.height })}
                  />
                ) : (
                  <Option
                    key="original"
                    label="Original"
                    selected={effective.maxHeight === null && effective.maxBitrate === null}
                    onSelect={() => applyPreferences({ maxHeight: null, maxBitrate: null })}
                  />
                ),
              )}
            </Group>
            {versions && !instruction?.chosenByViewer && qualityChoiceText(versions) ? (
              <Note text={qualityChoiceText(versions)!} />
            ) : null}
          </>
        ) : null}

        {session.options.audioStreams.length > 0 ? (
          <>
            <Group label="Audio" exitDown={lastGroup === 'audio' ? onDismiss : undefined}>
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
          <Group label="Subtitles" exitDown={lastGroup === 'subtitles' ? onDismiss : undefined}>
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

      </ScrollView>
    </View>
  );
}

function Group({
  label,
  children,
  exitDown,
}: {
  label: string;
  children: React.ReactNode;
  exitDown?: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.groupOptions}>
        <ExitDown.Provider value={exitDown}>{children}</ExitDown.Provider>
      </View>
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
  const exitDown = useContext(ExitDown);

  return (
    <Focusable
      ring={false}
      scope={OPTIONS_SCOPE}
      defaultFocus={defaultFocus}
      onSelect={onSelect}
      // Only the last group's options claim Down; elsewhere it is the scorer's.
      ownsDirection={exitDown ? (direction) => direction === 'down' : undefined}
      onDirection={exitDown ? (direction) => direction === 'down' && exitDown() : undefined}
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
   * margin: 0 0 1rem; padding: .8rem 0 .2rem; overflow-y: auto }`
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
  /** `.player-option-group { grid-template-columns: 6.5rem 1fr; gap: .8rem }` */
  group: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: rem(0.8),
  },
  /**
   * `.player-option-group > span { padding-top: .45rem; color: var(--text-faint);
   * font-size: .78rem; text-transform: uppercase; letter-spacing: .08em }`
   */
  groupLabel: {
    width: rem(6.5),
    paddingTop: rem(0.45),
    color: colour.textFaint,
    fontSize: type.eyebrow,
    letterSpacing: type.eyebrow * 0.08,
    textTransform: 'uppercase',
  },
  /** `.player-option-group > div { display: flex; flex-wrap: wrap; gap: .4rem }` */
  groupOptions: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rem(0.4),
  },
  /**
   * `.player-option-group button { border: 1px solid #3a3a40; border-radius: 999px;
   * padding: .42rem .7rem; background: #09090ab8; color: #bcbcc2; font-size: .82rem }`
   */
  option: {
    paddingHorizontal: rem(0.7),
    paddingVertical: rem(0.42),
    borderRadius: radius.pill,
    // `focusFrame.border`, not base.css's 1px, which is unreadable from the
    // sofa (measured on the TCL set). Always present, so focus moves nothing.
    borderWidth: focusFrame.border,
    borderColor: colour.inputBorder,
    backgroundColor: colour.optionSurface,
  },
  /**
   * `:hover, :focus-visible, .selected { border-color: var(--focus);
   * background: var(--accent-surface-strong); color: #dedee2 }`
   * Split here: the fill carries selection only, the border focus only.
   */
  optionSelected: {
    backgroundColor: colour.accentSurfaceStrong,
  },
  optionFocused: {
    borderColor: colour.focus,
  },
  optionLabel: {
    color: colour.optionText,
    fontSize: type.small,
  },
  optionLabelActive: {
    color: colour.heading,
  },
  /** `.player-option-note { grid-column: 2; color: var(--text-faint); font-size: .75rem }` */
  note: {
    marginLeft: rem(7.3),
    color: colour.textFaint,
    fontSize: type.faint,
    lineHeight: type.faint * 1.35,
  },
  /** The only on-screen signal that the chooser fell back or lacked facts. */
  noteWarning: {
    color: colour.text,
  },
});
