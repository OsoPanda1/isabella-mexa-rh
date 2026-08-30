/**
 * Tests: voiceUtils — normalizeVoiceText, isStrictlyFemaleVoice, selectBestFemaleVoice
 */
import { describe, it, expect } from "vitest";
import {
  normalizeVoiceText,
  isStrictlyFemaleVoice,
  getAvailableFemaleVoices,
  selectBestFemaleVoice,
} from "../src/utils/voiceUtils";

const fakeVoice = (name: string, lang = "es-MX", voiceURI = ""): SpeechSynthesisVoice =>
  ({ name, lang, voiceURI, default: false, localService: true } as SpeechSynthesisVoice);

describe("normalizeVoiceText", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeVoiceText("  hola   mundo  ")).toBe("hola mundo");
  });
  it("truncates to maximumTextLength", () => {
    const long = "a".repeat(5000);
    const result = normalizeVoiceText(long);
    expect(result.length).toBeLessThanOrEqual(4000);
  });
});

describe("isStrictlyFemaleVoice", () => {
  it("accepts female name hints", () => {
    expect(isStrictlyFemaleVoice(fakeVoice("Google español mujer"))).toBe(true);
  });
  it("rejects male name hints", () => {
    expect(isStrictlyFemaleVoice(fakeVoice("Jorge voice"))).toBe(false);
  });
  it("accepts Spanish voices without explicit hint", () => {
    expect(isStrictlyFemaleVoice(fakeVoice("español latino"))).toBe(true);
  });
  it("rejects non-Spanish without female hint", () => {
    expect(isStrictlyFemaleVoice(fakeVoice("English voice", "en-US"))).toBe(false);
  });
});

describe("getAvailableFemaleVoices", () => {
  it("filters mixed list", () => {
    const voices = [
      fakeVoice("Google español mujer"),
      fakeVoice("Jorge voice"),
      fakeVoice("English voice", "en-US"),
    ];
    const result = getAvailableFemaleVoices(voices);
    expect(result.length).toBe(1);
    expect(result[0].name).toContain("mujer");
  });
});

describe("selectBestFemaleVoice", () => {
  it("returns null for empty list", () => {
    expect(selectBestFemaleVoice([]).voice).toBeNull();
  });
  it("prefers exact name match", () => {
    const target = fakeVoice("Google español mujer");
    const { voice } = selectBestFemaleVoice([fakeVoice("Otra voz femenina"), target], "Google español mujer");
    expect(voice?.name).toBe("Google español mujer");
  });
  it("falls back to scored best female voice", () => {
    const { voice } = selectBestFemaleVoice([fakeVoice("Google español mujer"), fakeVoice("Otra mujer")]);
    expect(voice).not.toBeNull();
  });
  it("adjusts pitch for deep voices", () => {
    const { pitchMultiplier } = selectBestFemaleVoice([fakeVoice("Deep female voice", "es-MX")]);
    expect(pitchMultiplier).toBe(1.15);
  });
});
