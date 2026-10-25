import { test } from "node:test";
import assert from "node:assert/strict";
import { ChallengeService } from "../server/challenges";
import { ChallengeRepository } from "../server/repository";
import { addDays, todayInZone } from "../shared/dates";

test("дефект: сервер принимает startDate за пределами +7 дней", async () => {
  const repository = new ChallengeRepository(":memory:");
  const service = new ChallengeService(repository);
  
  // Устанавливаем фиксированную дату для теста (2026-10-24)
  const fixedDate = new Date("2026-10-24T12:00:00Z");
  
  const challengeInput = {
    title: "Тестовый челлендж",
    startDate: addDays(todayInZone("UTC"), 8), // сегодня + 8 дней — недопустимо!
    duration: 7,
    timeZone: "UTC",
  };

  // Сервер должен отклонить дату за пределами +7 дней
  try {
    await service.create("user-123", challengeInput);
    assert.fail("Сервер должен отклонить startDate за пределами +7 дней");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /startDate|дата старта|недопустимый диапазон/i);
  }
});
