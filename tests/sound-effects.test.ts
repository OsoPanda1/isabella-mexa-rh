/**
 * Tests: soundEffects — SoundManager enabled flag, no-throw on missing AudioContext
 */
import { describe, it, expect } from "vitest";
import { soundManager } from "../src/utils/soundEffects";

describe("soundManager", () => {
  it("is enabled by default", () => {
    expect(soundManager.enabled).toBe(true);
  });

  it("does not throw when AudioContext is unavailable", () => {
    expect(() => soundManager.playBeep()).not.toThrow();
    expect(() => soundManager.playSynapseRoute()).not.toThrow();
    expect(() => soundManager.playModuleEngage()).not.toThrow();
    expect(() => soundManager.playArrival()).not.toThrow();
    expect(() => soundManager.playSuccess()).not.toThrow();
  });

  it("respects enabled=false", () => {
    soundManager.enabled = false;
    expect(() => soundManager.playBeep()).not.toThrow();
    soundManager.enabled = true;
  });
});
