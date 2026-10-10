import { expect, it } from "vitest";
import { requiresRegistrationTimeConfirmation } from "./schedule-selection";

const original = { id: "slot-1", name: "第一棒", scheduledAt: "2026-12-20T10:00:00Z" };
const next = { id: "slot-2", name: "第二棒", scheduledAt: "2026-12-20T11:00:00Z" };

it("does not interrupt first registration or edits that keep the reserved time", () => {
  expect(requiresRegistrationTimeConfirmation(undefined, next)).toBe(false);
  expect(requiresRegistrationTimeConfirmation(original, original)).toBe(false);
});

it("requires confirmation before replacing a reserved time", () => {
  expect(requiresRegistrationTimeConfirmation(original, next)).toBe(true);
  expect(requiresRegistrationTimeConfirmation(original, next, { from: original, to: next })).toBe(false);
});

it("requires fresh confirmation if the reservation or displayed time changes", () => {
  const confirmation = { from: original, to: next };
  expect(requiresRegistrationTimeConfirmation({ ...original, id: "slot-3" }, next, confirmation)).toBe(true);
  expect(requiresRegistrationTimeConfirmation(original, { ...next, scheduledAt: "2026-12-20T12:00:00Z" }, confirmation)).toBe(true);
});
