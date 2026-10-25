import test from "node:test";
import assert from "node:assert/strict";
import { ChallengeRepository } from "../server/repository";
import { ChallengeService } from "../server/challenges";
import { addDays, todayInZone } from "../shared/dates";

test("API rejects startDate > today + 7 via direct POST (regression test)", async () => {
  const repository = new ChallengeRepository(":memory:");
  const service = new ChallengeService(repository, () => new Date("2026-10-24T10:00:00Z"));
  
  const today = todayInZone("UTC", new Date("2026-10-24T10:00:00Z"));
  const maxDateAllowed = addDays(today, 7); // 2026-10-31
  const dateOutsideBoundary = addDays(today, 8); // 2026-11-01
  
  // Тест на дату за пределами +7 дней — должно быть отклонено с 422
  try {
    service.create("user-123", {
      title: "Тест через API",
      startDate: dateOutsideBoundary,
      duration: 7,
      timeZone: "UTC",
    });
    assert.fail("Дата за пределами +7 дней должна быть отклонена");
  } catch (err) {
    assert.equal((err as Error).statusCode, 422);
    assert.match((err as Error).message, /startDate|дата старта/i);
  }
  
  // Тест на дату ровно сегодня + 7 — должно быть допустимо
  const challenge = service.create("user-123", {
    title: "Тест граница",
    startDate: maxDateAllowed,
    duration: 7,
    timeZone: "UTC",
  });
  assert.equal(challenge.startDate, maxDateAllowed);
  
  repository.close();
});

test("API accepts dates within valid range (regression)", async () => {
  const repository = new ChallengeRepository(":memory:");
  const service = new ChallengeService(repository, () => new Date("2026-10-24T10:00:00Z"));
  
  const today = todayInZone("UTC", new Date("2026-10-24T10:00:00Z"));
  
  // Прошлая дата — должна быть допустима
  const pastDate = addDays(today, -5);
  const challengePast = service.create("user-123", {
    title: "Прошлая дата",
    startDate: pastDate,
    duration: 7,
    timeZone: "UTC",
  });
  assert.equal(challengePast.startDate, pastDate);
  
  // Сегодня — должна быть допустима
  const todayChallenge = service.create("user-123", {
    title: "Сегодня",
    startDate: today,
    duration: 7,
    timeZone: "UTC",
  });
  assert.equal(todayChallenge.startDate, today);
  
  // Сегодня + 3 — должна быть допустима
  const futureDate = addDays(today, 3);
  const challengeFuture = service.create("user-123", {
    title: "Будущая дата",
    startDate: futureDate,
    duration: 7,
    timeZone: "UTC",
  });
  assert.equal(challengeFuture.startDate, futureDate);
  
  repository.close();
});
