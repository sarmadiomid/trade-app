export {
  CHART_SLICES,
  CHART_SLICE_BEHAVIORS,
  captureChartState,
  applyChartState,
  type ChartSlice,
  type ApplyContext,
  type StageValue,
  type MarketValue,
  type ViewValue,
  type CursorValue,
} from './chart-slices';
export {
  RecordingSession,
  buildAudio,
  AUTOSAVE_INTERVAL_MS,
  type RecordingStatus,
  type RecordingEventMap,
  type RecordingSessionDeps,
  type ChallengeDraft,
} from './recording-session';
export {
  ChallengeBoard,
  type BoardMode,
  type BoardTool,
  type BoardConfig,
  type BoardEventMap,
} from './challenge-board';
export {
  LessonPlayer,
  PLAYBACK_RATES,
  type ActiveChallenge,
  type PlaybackRate,
  type PlayerMode,
  type PlayerSnapshot,
  type PlayerFrame,
  type PlayerEventMap,
} from './lesson-player';
export {
  MicError,
  requestMicrophone,
  BrowserAudioCapture,
  HtmlAudioMedia,
  VirtualMedia,
  VOICE_BITS_PER_SECOND,
  type AudioCapture,
  type PlaybackMedia,
  type MicErrorKind,
} from './audio';
export { createLessonRepository, recoverDraft, lessonsArePersistent } from './lesson-library';
