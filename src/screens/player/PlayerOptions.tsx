import { createContext, useContext } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
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
import { ceilingText, qualityLabel, versionHowLabel } from '../../text/viewerText';
import {
  assumptionNote,
  audioProcessingNote,
  instructionNote,
  MODE_LABELS,
  noteIsWarning,
  playingVersion,
  streamLabel,
} from './playbackOptions';

/**
 * Playback options — mode, quality, audio, subtitles, version.
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

/**
 * How a viewer leaves the panel downwards.
 *
 * **Back closed it and nothing else did**, so a viewer who had walked down to
 * the subtitle row and pressed Down again met a wall: the panel owns the D-pad
 * outright while it is open, so there was no candidate below and the press did
 * nothing at all. Reported off the set. Down from the last row now returns to
 * the transport, which is where Down from the bottom of anything should go.
 *
 * Carried through context rather than threaded as a prop because the options
 * that need it are generated inside `map`s three groups deep, and only the last
 * group's are entitled to it — which group that is depends on what this session
 * can actually change.
 */
const ExitDown = createContext<(() => void) | undefined>(undefined);

export function PlayerOptions({
  session,
  pendingPreferences,
  instruction,
  versions,
  onApply,
  onPlayVersion,
  onDismiss,
}: {
  session: PlaybackSession;
  pendingPreferences?: PlaybackPreferencesUpdate;
  instruction?: PlaybackInstructionReport;
  versions?: PlaybackVersions;
  onApply: (update: PlaybackUpdate) => void;
  /** A version picked here, which core plays as the viewer's choice. */
  onPlayVersion: (step: VersionStep) => void;
  /** Down from the last row, which is how the panel is left without Back. */
  onDismiss: () => void;
}): React.JSX.Element {
  const hasQuality = session.options.canChangeQuality;
  const hasAudio = session.options.audioStreams.length > 0;
  const hasSubtitles = session.options.subtitleStreams.length > 0;
  // The detail page's rule: shown only when there is a choice.
  const steps = versions && versions.steps.length > 1 ? versions.steps : [];
  const hasVersions = steps.length > 0;
  const lastGroup = hasVersions
    ? 'version'
    : hasSubtitles
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
        <Group label="Mode" exitDown={lastGroup === 'mode' ? onDismiss : undefined}>
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
          <Group label="Quality" exitDown={lastGroup === 'quality' ? onDismiss : undefined}>
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

        {/*
          Version replaces Source, which server 0.58.0 left empty: core maps
          `media_ids` to `[]`, so the group never drew. The same set the detail
          page offers (Tom, 2026-09-25), and a pick is the viewer's choice.
        */}
        {hasVersions ? (
          <>
            <Group label="Version" exitDown={lastGroup === 'version' ? onDismiss : undefined}>
              {steps.map((step) => (
                <Option
                  key={step.quality}
                  label={`${qualityLabel(step.quality)} · ${versionHowLabel(step)}`}
                  selected={playingVersion(steps, session, pendingPreferences) === step}
                  onSelect={() => onPlayVersion(step)}
                />
              ))}
            </Group>
            {versions?.limitedBy && !instruction?.chosenByViewer ? (
              <Note text={ceilingText(versions.limitedBy)} />
            ) : null}
          </>
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
      // Only the last group's options claim Down, and only to leave: anywhere
      // else it is the scorer's, moving to the group below.
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
    // `focusFrame.border`, not base.css's 1px: measured on `.133`, 2026-09-23,
    // a one-pixel focus border on these chips could not be read from the sofa
    // — three attempts to reach Transcode by D-pad landed elsewhere unseen.
    // Always present, so nothing moves when focus lands.
    borderWidth: focusFrame.border,
    borderColor: colour.inputBorder,
    backgroundColor: colour.optionSurface,
  },
  /**
   * `:hover, :focus-visible, .selected { border-color: var(--focus);
   * background: var(--accent-surface-strong); color: #dedee2 }` — one rule for
   * all three on the web, and selected and focused are different things here, so
   * the border carries focus and the fill carries selection — **only**. Focus
   * used to take the fill too, which made a focused chip indistinguishable
   * from a selected one.
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
