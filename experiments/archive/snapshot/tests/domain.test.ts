import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createChallengeSchema } from "../shared/contracts";
import { addDays, todayInZone } from "../shared/dates";
import { ChallengeRepository } from "../server/repository";
import { ChallengeService } from "../server/challenges";
import { challengeInput, now } from "./helpers";

test("calendar arithmetic and time zones cross boundaries without DST drift", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(
    todayInZone("Asia/Manila", new Date("2026-10-23T17:00:00Z")),
    "2026-10-24",
  );
  assert.equal(
    todayInZone("America/Los_Angeles", new Date("2026-10-24T02:00:00Z")),
    "2026-10-23",
  );
});
test("input rejects impossible dates, blank titles, fractional durations and unknown fields", () => {
  for (const patch of [
    { title: "   " },
    { startDate: "2026-02-30" },
    { duration: 0 },
    { duration: 31 },
    { duration: 1.5 },
    { timeZone: "Invalid" },
    { ownerId: "other" },
  ]) {
    assert.equal(
      createChallengeSchema.safeParse({ ...challengeInput, ...patch }).success,
      false,
    );
  }
  assert.equal(
    createChallengeSchema.parse({ ...challengeInput, title: "  Читать  " })
      .title,
    "Читать",
  );
});
test("last day is inclusive, marks are idempotent, owner is enforced, data survives reopening", () => {
  const path = join(
    mkdtempSync(join(tmpdir(), "challenge-buddy-")),
    "test.sqlite",
  );
  let clock = now;
  const repository = new ChallengeRepository(path);
  const service = new ChallengeService(repository, () => clock);
  const challenge = service.create("42", { ...challengeInput, duration: 1 });
  assert.equal(challenge.canCheckIn, true);
  assert.equal(service.checkIn("42", challenge.id, true).progress, 100);
  assert.equal(service.checkIn("42", challenge.id, true).checkIns.length, 1);
  assert.throws(
    () => service.checkIn("other", challenge.id, false),
    /не найден/,
  );
  repository.close();
  const reopened = new ChallengeRepository(path);
  const restored = new ChallengeService(reopened, () => clock);
  assert.equal(restored.get("42", challenge.id).progress, 100);
  assert.equal(restored.checkIn("42", challenge.id, false).progress, 0);
  assert.equal(restored.checkIn("42", challenge.id, false).progress, 0);
  clock = new Date("2026-10-25T10:00:00Z");
  assert.equal(restored.get("42", challenge.id).status, "finished");
  assert.throws(() => restored.checkIn("42", challenge.id, true), /вне срока/);
  reopened.close();
});
test("future challenge cannot be checked in", () => {
  const repository = new ChallengeRepository(":memory:");
  const service = new ChallengeService(repository, () => now);
  const challenge = service.create("42", {
    ...challengeInput,
    startDate: "2026-10-25",
  });
  assert.equal(challenge.status, "upcoming");
  assert.throws(() => service.checkIn("42", challenge.id, true), /вне срока/);
  repository.close();
});
