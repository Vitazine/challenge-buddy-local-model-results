import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { buildApp } from "../server/app";
import { ChallengeRepository } from "../server/repository";
import { ChallengeService } from "../server/challenges";
import { challengeInput, now, signedInitData, token } from "./helpers";

const headers = { authorization: `tma ${signedInitData()}` };
const other = { authorization: `tma ${signedInitData(43)}` };

test("archive API: ownership, retry, history, both mark methods and list isolation", async (t) => {
  let clock = now;
  const app = await buildApp({
    databasePath: ":memory:",
    botToken: token,
    clock: () => clock,
  });
  t.after(() => app.close());
  const created = (
    await app.inject({
      method: "POST",
      url: "/api/challenges",
      headers,
      payload: challengeInput,
    })
  ).json();
  assert.equal(created.archivedAt, null);
  const detailUrl = `/api/challenges/${created.id}`;
  const archiveUrl = `${detailUrl}/archive`;
  const checkUrl = `${detailUrl}/check-ins/today`;
  const before = (
    await app.inject({ method: "PUT", url: checkUrl, headers })
  ).json();
  for (const url of [
    archiveUrl,
    "/api/challenges/00000000-0000-4000-8000-000000000000/archive",
  ]) {
    const response = await app.inject({ method: "PUT", url, headers: other });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, "NOT_FOUND");
  }
  assert.equal(
    (await app.inject({ method: "PUT", url: archiveUrl })).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: archiveUrl,
        headers,
        payload: { ownerId: "43" },
      })
    ).statusCode,
    422,
  );
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: "/api/challenges/invalid/archive",
        headers,
      })
    ).statusCode,
    422,
  );
  const archived = await app.inject({
    method: "PUT",
    url: archiveUrl,
    headers,
  });
  assert.equal(archived.statusCode, 200);
  assert.equal(archived.json().archivedAt, now.toISOString());
  assert.equal(archived.json().canCheckIn, false);
  assert.equal(archived.json().status, before.status);
  assert.equal(archived.json().progress, before.progress);
  assert.deepEqual(archived.json().checkIns, before.checkIns);
  assert.equal(archived.json().ownerId, undefined);
  clock = new Date(now.getTime() + 1000);
  const retry = await app.inject({ method: "PUT", url: archiveUrl, headers });
  assert.deepEqual(retry.json(), archived.json());
  for (const method of ["PUT", "DELETE"] as const) {
    const rejected = await app.inject({ method, url: checkUrl, headers });
    assert.equal(rejected.statusCode, 409);
    assert.equal(rejected.json().error.code, "CHALLENGE_ARCHIVED");
    assert.equal(
      (await app.inject({ method, url: checkUrl, headers: other })).statusCode,
      404,
    );
  }
  assert.deepEqual(
    (await app.inject({ url: detailUrl, headers })).json(),
    archived.json(),
  );
  assert.equal(
    (await app.inject({ url: detailUrl, headers: other })).statusCode,
    404,
  );
  for (const suffix of ["", "?archived=false"]) {
    const list = (
      await app.inject({ url: `/api/challenges${suffix}`, headers })
    ).json();
    assert.equal(list.total, 0);
    assert.deepEqual(list.items, []);
  }
  const list = (
    await app.inject({ url: "/api/challenges?archived=true", headers })
  ).json();
  assert.equal(list.total, 1);
  assert.deepEqual(list.items, [archived.json()]);
  const hidden = (
    await app.inject({ url: "/api/challenges?archived=true", headers: other })
  ).json();
  assert.equal(hidden.total, 0);
  assert.deepEqual(hidden.items, []);
  for (const query of [
    "archived=1",
    "archived=FALSE",
    "archived=",
    "archived=true&archived=false",
    "ownerId=43",
  ]) {
    assert.equal(
      (await app.inject({ url: `/api/challenges?${query}`, headers }))
        .statusCode,
      422,
    );
  }
});

test("archive pagination filters items and total identically; statuses stay calendar based", (t) => {
  const repo = new ChallengeRepository(":memory:");
  t.after(() => repo.close());
  const service = new ChallengeService(repo, () => now);
  for (let index = 0; index < 23; index++) {
    const item = service.create("42", {
      ...challengeInput,
      title: `Шаг ${index}`,
    });
    if (index < 21) service.archive("42", item.id);
  }
  const first = service.list("42", 1, 20, true);
  const last = service.list("42", 2, 20, true);
  assert.equal(first.total, 21);
  assert.equal(first.items.length, 20);
  assert.equal(last.total, 21);
  assert.equal(last.items.length, 1);
  assert.equal(
    new Set([...first.items, ...last.items].map((item) => item.id)).size,
    21,
  );
  assert.ok(first.items.every((item) => item.archivedAt !== null));
  assert.equal(service.list("42", 1, 20).total, 2);
  assert.ok(
    service.list("42", 1, 20).items.every((item) => item.archivedAt === null),
  );
  assert.equal(service.list("other", 1, 20, true).total, 0);
  for (const [startDate, status] of [
    ["2026-10-25", "upcoming"],
    ["2026-10-01", "finished"],
  ]) {
    const item = service.create("42", { ...challengeInput, startDate });
    const result = service.archive("42", item.id);
    assert.equal(result.status, status);
    assert.equal(result.canCheckIn, false);
  }
});

function databasePath(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "challenge-archive-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return join(directory, "test.sqlite");
}

test("new file becomes v2; archived history survives repeated v2 reopen", (t) => {
  const path = databasePath(t);
  const repo = new ChallengeRepository(path);
  const service = new ChallengeService(repo, () => now);
  const item = service.create("42", challengeInput);
  service.checkIn("42", item.id, true);
  const archived = service.archive("42", item.id);
  repo.close();
  for (let attempt = 0; attempt < 2; attempt++) {
    const reopened = new ChallengeRepository(path);
    try {
      assert.deepEqual(
        new ChallengeService(reopened, () => now).get("42", item.id),
        archived,
      );
    } finally {
      reopened.close();
    }
  }
  const inspect = new DatabaseSync(path);
  t.after(() => inspect.close());
  assert.equal(inspect.prepare("PRAGMA user_version").get()!.user_version, 2);
});

test("v1 migration preserves records, marks and existing indexes", (t) => {
  const path = databasePath(t);
  const old = new DatabaseSync(path);
  old.exec(`
    CREATE TABLE challenges (id TEXT PRIMARY KEY, ownerId TEXT NOT NULL, title TEXT NOT NULL,
      startDate TEXT NOT NULL, duration INTEGER NOT NULL CHECK(duration BETWEEN 1 AND 30),
      timeZone TEXT NOT NULL, createdAt TEXT NOT NULL);
    CREATE INDEX challenges_owner ON challenges(ownerId, createdAt);
    CREATE TABLE check_ins (challengeId TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      date TEXT NOT NULL, PRIMARY KEY(challengeId, date));
    INSERT INTO challenges VALUES ('legacy', '42', 'Синтетический челлендж', '2026-10-24', 7, 'Asia/Manila', '2026-10-24T00:00:00.000Z');
    INSERT INTO check_ins VALUES ('legacy', '2026-10-24');
    PRAGMA user_version = 1;
  `);
  old.close();
  const repo = new ChallengeRepository(path);
  const service = new ChallengeService(repo, () => now);
  const item = service.get("42", "legacy");
  assert.equal(item.title, "Синтетический челлендж");
  assert.equal(item.archivedAt, null);
  assert.equal(item.progress, 14);
  assert.deepEqual(item.checkIns, ["2026-10-24"]);
  service.archive("42", "legacy");
  repo.close();
  const inspect = new DatabaseSync(path);
  t.after(() => inspect.close());
  assert.equal(inspect.prepare("PRAGMA user_version").get()!.user_version, 2);
  assert.equal(
    inspect
      .prepare("SELECT name FROM sqlite_master WHERE name = 'challenges_owner'")
      .get()!.name,
    "challenges_owner",
  );
});

test("unsupported future schema is rejected without DDL, version or data changes", (t) => {
  const path = databasePath(t);
  const db = new DatabaseSync(path);
  db.exec(
    "CREATE TABLE future_data (value TEXT); INSERT INTO future_data VALUES ('synthetic'); PRAGMA user_version = 99;",
  );
  const schema = db.prepare("SELECT * FROM sqlite_master ORDER BY name").all();
  db.close();
  const bytes = readFileSync(path);
  assert.throws(
    () => new ChallengeRepository(path),
    /Неподдерживаемая версия.*99/,
  );
  assert.deepEqual(readFileSync(path), bytes);
  const inspect = new DatabaseSync(path);
  t.after(() => inspect.close());
  assert.equal(inspect.prepare("PRAGMA user_version").get()!.user_version, 99);
  assert.deepEqual(
    inspect.prepare("SELECT * FROM sqlite_master ORDER BY name").all(),
    schema,
  );
  assert.equal(
    inspect.prepare("SELECT value FROM future_data").get()!.value,
    "synthetic",
  );
});
