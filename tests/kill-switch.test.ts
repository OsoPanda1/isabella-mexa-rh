/**
 * Tests: Kill-Switch module
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  activateKillSwitch,
  executeNextStep,
  resolveKillSwitch,
  getKillSwitchStatus,
} from "../src/lib/kill-switch";

describe("kill-switch", () => {
  it("starts in normal state", () => {
    const status = getKillSwitchStatus();
    expect(status.state).toBe("normal");
  });

  it("activates with trigger and transitions state", () => {
    const event = activateKillSwitch("Suspicious egress detected", "SEV-1");
    expect(event.eventId).toBeTruthy();
    expect(event.severity).toBe("SEV-1");
    expect(event.previousState).toBe("normal");
    expect(event.newState).toBe("egress-frozen");
    expect(event.actions.length).toBeGreaterThan(0);
  });

  it("executes automated steps sequentially", () => {
    const event = activateKillSwitch("Test activation");
    const updated = executeNextStep(event.eventId)!;
    expect(updated).toBeTruthy();

    const completedSteps = updated.actions.filter((a) => a.status === "completed");
    expect(completedSteps.length).toBeGreaterThanOrEqual(1);
  });

  it("resolves after approval", () => {
    const event = activateKillSwitch("Manual test");
    // Execute a few steps
    executeNextStep(event.eventId);
    executeNextStep(event.eventId);
    executeNextStep(event.eventId);

    const resolved = resolveKillSwitch(event.eventId, "admin-user");
    expect(resolved).toBe(true);

    const status = getKillSwitchStatus();
    expect(status.state).toBe("normal");
  });

  it("returns false for unknown event", () => {
    const resolved = resolveKillSwitch("nonexistent-id", "admin");
    expect(resolved).toBe(false);
  });

  it("returns undefined for unknown event step", () => {
    const result = executeNextStep("nonexistent-id");
    expect(result).toBeUndefined();
  });

  it("lists steps with correct structure", () => {
    const status = getKillSwitchStatus();
    expect(status.steps.length).toBe(10);
    expect(status.steps[0].action).toContain("FREEZE_EGRESS");
    expect(status.steps[9].action).toContain("RESUME");
    expect(status.steps.some((s) => s.humanRequired)).toBe(true);
  });
});
