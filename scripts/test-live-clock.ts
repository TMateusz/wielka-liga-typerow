import assert from "node:assert/strict";
import {
  formatLiveClockDisplay,
  needsExternalLiveMinute,
  normalizeExternalLiveClock,
  normalizeLiveClock,
  parseLiveMinuteValue,
} from "../shared/live-clock.js";

assert.equal(needsExternalLiveMinute("live"), true);
assert.equal(needsExternalLiveMinute("67"), false);
assert.equal(needsExternalLiveMinute("HT"), false);
assert.equal(normalizeLiveClock("live"), null);
assert.equal(normalizeLiveClock("45+2"), "45+2");
assert.equal(parseLiveMinuteValue("90'+7'"), "90+7");
assert.equal(normalizeExternalLiveClock("90'+7'"), "90+7");
assert.equal(normalizeExternalLiveClock("67'"), "67");
assert.equal(formatLiveClockDisplay("67"), "67′");
assert.equal(formatLiveClockDisplay("45+2"), "45+2′");
assert.equal(formatLiveClockDisplay("HT"), "Przerwa");
assert.equal(formatLiveClockDisplay("live"), null);

console.log("live-clock tests OK");
