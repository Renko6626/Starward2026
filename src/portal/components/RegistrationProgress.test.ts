import { expect, it } from "vitest";
import { getRegistrationProgress } from "./RegistrationProgress";

it("shows rejection even when the backend demotes the participant to withdrawn", () => {
  const progress = getRegistrationProgress("rejected", "withdrawn");
  expect(progress.label).toBe("审核未通过");
  expect(progress.rejected).toBe(true);
  expect(progress.withdrawn).toBe(false);
});

it("distinguishes an actual withdrawal from an unsent registration", () => {
  expect(getRegistrationProgress("withdrawn", "withdrawn").label).toBe("已撤回");
  expect(getRegistrationProgress(undefined, "pending").label).toBe("未报名");
});

it("shows the review and approved stages after submission", () => {
  expect(getRegistrationProgress("pending", "pending").label).toBe("报名待审核");
  expect(getRegistrationProgress("approved", "approved").label).toBe("报名已通过");
});
