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

test("startDate validation: today + 7 is allowed (inclusive boundary)", () => {
  const repository = new ChallengeRepository(":memory:");
  const service = new ChallengeService(repository, () => now);
  
  // Сегодня + 7 дней — должно быть допустимо
  const today = todayInZone("UTC", now);
  const maxDateAllowed = addDays(today, 7); // сегодня + 7 = 2026-10-31
  
  const challenge = service.create("42", {
    ...challengeInput,
    startDate: maxDateAllowed,
  });
  assert.equal(challenge.startDate, maxDateAllowed);
  repository.close();
});

test("startDate validation: today + 8 is rejected (outside boundary)", () => {
  const repository = new ChallengeRepository(":memory:");
  const service = new ChallengeService(repository, () => now);
  
  // Сегодня + 8 дней — должно быть отклонено
  const today = todayInZone("UTC", now);
  const maxDateRejected = addDays(today, 8); // сегодня + 8 = 2026-11-01
  
  try {
    service.create("42", {
      ...challengeInput,
      startDate: maxDateRejected,
    });
    assert.fail("Дата сегодня + 8 дней должна быть отклонена");
  } catch (err) {
    assert.match((err as Error).message, /startDate|дата старта/i);
  }
  repository.close();
});

test("startDate validation: different time zones use their own local date", () => {
  const repository = new ChallengeRepository(":memory:");
  
  // Создаем сервис с фиксированной датой для Asia/Tokyo
  const serviceTokyo = new ChallengeService(
    repository,
    () => new Date("2026-10-25T08:00:00Z") // В UTC это 2026-10-25 08:00
  );
  
  // В Tokyo это уже 2026-10-25 21:00 (тот же календарный день)
  const tokyoToday = todayInZone("Asia/Tokyo", new Date("2026-10-25T08:00:00Z"));
  const maxDateTokyo = addDays(tokyoToday, 7);
  
  const challenge = serviceTokyo.create("42", {
    ...challengeInput,
    startDate: maxDateTokyo,
    timeZone: "Asia/Tokyo",
  });
  assert.equal(challenge.startDate, maxDateTokyo);
  
  repository.close();
});

test("startDate validation: past dates still allowed (existing policy unchanged)", () => {
  const repository = new ChallengeRepository(":memory:");
  const service = new ChallengeService(repository, () => now);
  
  // Прошлые даты должны оставаться допустимыми (существующая политика)
  const pastDate = addDays(todayInZone("UTC"), -1);
  const challenge = service.create("42", {
    ...challengeInput,
    startDate: pastDate,
  });
  assert.equal(challenge.startDate, pastDate);
  repository.close();
});
