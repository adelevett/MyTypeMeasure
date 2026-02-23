// Original implementation for Dual-Axis Keystroke Analyzer
// Extends data structures from FlexKeyLogger by Terry Y. Tian

export const BENCHMARKS = {
  pause_time_mean: { mean: 1.646, sd: 0.783 },
  pause_before_sentences: { mean: 12.682, sd: 29.433 },
  pause_before_words: { mean: 1.398, sd: 0.825 },
  total_insertions: { mean: 307.96, sd: 344.11 },
  num_insertions: { mean: 32.95, sd: 36.005 },
  total_deletions_words: { mean: 115.218, sd: 130.943 },
  num_revisions: { mean: 125.95, sd: 85.112 },
  product_process_ratio: { mean: 0.824, sd: 0.111 },
  pause_within_words_count: { mean: 408.688, sd: 245.747 },
  rburst_length_median: { mean: 6.27, sd: 6.431 },
  characters_per_minute: { mean: 200, sd: 75 }, // Approximated for baseline
};

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function normalize(value, mean, sd) {
  if (sd === 0) return 0.5;
  const z = (value - mean) / sd;
  return clamp((z / 4) + 0.5, 0, 1);
}

function normalizeInverted(value, mean, sd) {
  return 1 - normalize(value, mean, sd);
}

function calculateMedian(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function extractMetrics(keylog) {
  const eventsCount = keylog.EventID.length;
  if (eventsCount < 2) return null;

  const durationMs = keylog.EventTime[eventsCount - 1] - keylog.EventTime[0];
  const durationSeconds = durationMs / 1000.0;

  const finalText = typeof keylog.FinalProduct === "string"
    ? keylog.FinalProduct
    : (keylog.TextContent.length > 0 ? keylog.TextContent[keylog.TextContent.length - 1] : "");

  const finalLength = finalText.length;

  let paste_events = 0;
  let paste_characters = 0;
  let total_insertions = 0;
  let num_insertions = 0;
  let num_deletions = 0;
  let total_deletions_words = 0;
  let num_revisions = 0;

  let ikis = [];
  for (let i = 1; i < eventsCount; i++) {
    ikis.push(keylog.EventTime[i] - keylog.EventTime[i - 1]);
  }

  const PAUSE_THRESHOLD_MS = 200;
  const pauses = ikis.filter(iki => iki >= PAUSE_THRESHOLD_MS);
  const pause_time_mean = pauses.length > 0 ? (pauses.reduce((a, b) => a + b, 0) / pauses.length / 1000.0) : 0;

  let pauses_before_words = [];
  let pauses_before_sentences = [];
  let pauses_within_words = 0;

  let bursts = [];
  let currentBurstStartTime = keylog.EventTime[0];

  for (let i = 1; i < eventsCount; i++) {
    const prevOutput = keylog.Output[i - 1];
    const currOutput = keylog.Output[i];
    const activity = keylog.Activity ? keylog.Activity[i] : 'Input';
    const textChange = keylog.TextChange ? keylog.TextChange[i] : '';
    const iki = keylog.EventTime[i] - keylog.EventTime[i - 1];

    if (activity === 'Paste') {
      paste_events++;
      paste_characters += textChange && textChange !== 'NoChange' ? textChange.length : 0;
    }

    if (activity === 'Remove/Cut' || currOutput === 'Backspace') {
      num_deletions++;
      num_revisions++; // Simplified: count deletions as revisions
      total_deletions_words += 0.2; // roughly approx if we can't count exact words from backspaces
    }

    // Insertions logic: non-linear input. If cursor position < current text length
    const prevCursor = keylog.CursorPosition[i - 1];
    const prevLength = keylog.TextContent[i - 1] ? keylog.TextContent[i - 1].length : 0;
    if (activity === 'Input' && prevCursor < prevLength) {
      num_insertions++;
      total_insertions++; // Roughly 1 char per input event
      num_revisions++;
    }

    // Pause contexts
    if (iki >= PAUSE_THRESHOLD_MS) {
      if (prevOutput === 'Space' || i === 1) {
        pauses_before_words.push(iki);
      } else if (['.', '!', '?'].includes(prevOutput)) {
        pauses_before_sentences.push(iki);
      } else if (!['Space', '.', ',', '!', '?', 'Shift', 'Backspace'].includes(prevOutput) &&
        !['Space', '.', ',', '!', '?', 'Shift', 'Backspace'].includes(currOutput)) {
        pauses_within_words++;
      }
    }

    // Burst logic (R-bursts end at a revision or a long pause > 2s)
    if (activity === 'Remove/Cut' || currOutput === 'Backspace' || iki >= 2000) {
      const burstLength = (keylog.EventTime[i - 1] - currentBurstStartTime) / 1000.0;
      if (burstLength > 0) bursts.push(burstLength);
      currentBurstStartTime = keylog.EventTime[i];
    }
  }

  // Any remaining burst
  const finalBurstLength = (keylog.EventTime[eventsCount - 1] - currentBurstStartTime) / 1000.0;
  if (finalBurstLength > 0) bursts.push(finalBurstLength);

  const pause_before_words_mean = pauses_before_words.length > 0 ? (pauses_before_words.reduce((a, b) => a + b, 0) / pauses_before_words.length / 1000.0) : 0;
  const pause_before_sentences_mean = pauses_before_sentences.length > 0 ? (pauses_before_sentences.reduce((a, b) => a + b, 0) / pauses_before_sentences.length / 1000.0) : 0;

  let total_keystrokes = keylog.Activity ? keylog.Activity.filter(a => a === 'Input').length : eventsCount;
  if (total_keystrokes === 0) total_keystrokes = 1;
  const product_process_ratio = finalLength / total_keystrokes;
  const characters_per_minute = durationSeconds > 0 ? (finalLength / durationSeconds * 60) : 0;

  return {
    product_process_ratio,
    num_revisions,
    num_deletions,
    total_deletions_words,
    total_insertions,
    num_insertions,
    paste_events,
    paste_characters,
    rburst_length_median: calculateMedian(bursts),
    characters_per_minute,
    pause_time_mean,
    pause_within_words_count: pauses_within_words,
    pause_before_words: pause_before_words_mean,
    pause_before_sentences: pause_before_sentences_mean,
    durationSeconds,
    finalLength,
    totalEvents: eventsCount
  };
}

export function getCalibrationData(keylog) {
  if (!keylog || !keylog.EventID || keylog.EventID.length < 2) return null;

  const finalText = typeof keylog.FinalProduct === "string" && keylog.FinalProduct !== ""
    ? keylog.FinalProduct
    : (keylog.TextContent && keylog.TextContent.length > 0 ? keylog.TextContent[keylog.TextContent.length - 1] : "");

  if (finalText.length < 200) return null;

  let calibEventIndex = keylog.EventID.length;
  for (let i = 0; i < keylog.TextContent.length; i++) {
    if (keylog.TextContent[i] && keylog.TextContent[i].length >= 200) {
      calibEventIndex = i + 1;
      break;
    }
  }

  const slicedKeylog = {};
  for (const key in keylog) {
    if (Array.isArray(keylog[key])) {
      slicedKeylog[key] = keylog[key].slice(0, calibEventIndex);
    } else {
      slicedKeylog[key] = keylog[key];
    }
  }

  slicedKeylog.FinalProduct = slicedKeylog.TextContent[slicedKeylog.TextContent.length - 1] || "";

  const baseMetrics = extractMetrics(slicedKeylog);
  if (!baseMetrics || baseMetrics.characters_per_minute === 0) return null;

  // Use Coefficient of Variation to keep SD proportional to the new mean
  const cvCpm = BENCHMARKS.characters_per_minute.sd / BENCHMARKS.characters_per_minute.mean;
  const cvBurst = BENCHMARKS.rburst_length_median.sd / BENCHMARKS.rburst_length_median.mean;

  return {
    cpm_mean: baseMetrics.characters_per_minute,
    cpm_sd: baseMetrics.characters_per_minute * cvCpm,
    rburst_mean: baseMetrics.rburst_length_median,
    rburst_sd: baseMetrics.rburst_length_median * cvBurst,
  };
}

export function calculateDualAxis(metrics, weights, calibrationData = null) {
  if (!metrics) return null;

  // Path Shape
  const pathShape = normalize(metrics.product_process_ratio, BENCHMARKS.product_process_ratio.mean, BENCHMARKS.product_process_ratio.sd);

  // Revision Activity
  const rev1 = normalizeInverted(metrics.num_revisions, BENCHMARKS.num_revisions.mean, BENCHMARKS.num_revisions.sd);
  const rev2 = normalizeInverted(metrics.num_deletions, BENCHMARKS.num_revisions.mean, BENCHMARKS.num_revisions.sd); // approx with num_revisions sd/mean
  const rev3 = normalizeInverted(metrics.total_deletions_words, BENCHMARKS.total_deletions_words.mean, BENCHMARKS.total_deletions_words.sd);
  const rev4 = normalizeInverted(metrics.total_insertions, BENCHMARKS.total_insertions.mean, BENCHMARKS.total_insertions.sd);
  const rev5 = normalizeInverted(metrics.num_insertions, BENCHMARKS.num_insertions.mean, BENCHMARKS.num_insertions.sd);

  const revBase = (rev1 * weights.rev.num_revisions +
    rev2 * weights.rev.num_deletions +
    rev3 * weights.rev.total_deletions_words +
    rev4 * weights.rev.total_insertions +
    rev5 * weights.rev.num_insertions);

  const linearity = (pathShape * weights.groups.pathShape) + (revBase * weights.groups.revisionActivity);

  // Fluency
  let cpm_mean = BENCHMARKS.characters_per_minute.mean;
  let cpm_sd = BENCHMARKS.characters_per_minute.sd;
  let rburst_mean = BENCHMARKS.rburst_length_median.mean;
  let rburst_sd = BENCHMARKS.rburst_length_median.sd;

  if (calibrationData) {
    cpm_mean = calibrationData.cpm_mean;
    cpm_sd = calibrationData.cpm_sd || 0.001; // prevent zero division
    rburst_mean = calibrationData.rburst_mean;
    rburst_sd = calibrationData.rburst_sd || 0.001;
  }

  const flu1 = normalize(metrics.rburst_length_median, rburst_mean, rburst_sd);
  const flu2 = normalize(metrics.characters_per_minute, cpm_mean, cpm_sd);
  const fluencyBase = (flu1 * weights.flu.rburst_length_median + flu2 * weights.flu.characters_per_minute);

  // Pause Behavior
  const pb1 = normalizeInverted(metrics.pause_time_mean, BENCHMARKS.pause_time_mean.mean, BENCHMARKS.pause_time_mean.sd);
  const pb2 = normalizeInverted(metrics.pause_within_words_count, BENCHMARKS.pause_within_words_count.mean, BENCHMARKS.pause_within_words_count.sd);
  const pb3 = normalizeInverted(metrics.pause_before_words, BENCHMARKS.pause_before_words.mean, BENCHMARKS.pause_before_words.sd);
  const pb4 = normalizeInverted(metrics.pause_before_sentences, BENCHMARKS.pause_before_sentences.mean, BENCHMARKS.pause_before_sentences.sd);
  const pbBase = (pb1 * weights.pb.pause_time_mean + pb2 * weights.pb.pause_within_words_count + pb3 * weights.pb.pause_before_words + pb4 * weights.pb.pause_before_sentences);

  const spontaneityBase = (fluencyBase * weights.groups.fluency) + (pbBase * weights.groups.pauseBehavior);

  // Paste Contribution
  const pasteScore = clamp(metrics.paste_events * weights.paste.BASE_JUMP * (1 + metrics.paste_characters * weights.paste.CHAR_SCALE), 0, 0.40);

  const spontaneity = clamp(spontaneityBase + (pasteScore * weights.groups.unconstrainedAction), 0, 1);

  return {
    linearityScore: clamp(linearity, 0, 1) * 100,
    spontaneityScore: spontaneity * 100,
    components: {
      pathShape,
      revBase,
      fluencyBase,
      pbBase,
      pasteScore
    }
  };
}

export const DEFAULT_WEIGHTS = {
  groups: {
    pathShape: 0.60,
    revisionActivity: 0.40,
    fluency: 0.50,
    pauseBehavior: 0.50,
    unconstrainedAction: 1.0 // It's an additive component
  },
  rev: {
    num_revisions: 0.35,
    num_deletions: 0.25,
    total_deletions_words: 0.20,
    total_insertions: 0.10,
    num_insertions: 0.10,
  },
  flu: {
    rburst_length_median: 0.5,
    characters_per_minute: 0.5,
  },
  pb: {
    pause_time_mean: 0.40,
    pause_within_words_count: 0.30,
    pause_before_words: 0.20,
    pause_before_sentences: 0.10,
  },
  paste: {
    BASE_JUMP: 0.12,
    CHAR_SCALE: 0.0002
  }
};
