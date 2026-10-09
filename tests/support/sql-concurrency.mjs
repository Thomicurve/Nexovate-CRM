import assert from "node:assert/strict";

const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
const response = (stdout) => JSON.parse(stdout.split(/\r?\n/).find((line) => line.startsWith("{")));
const actorSQL = (actor, statement, hold = false) => `
  \\set VERBOSITY verbose
  BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claim.sub', '${actor}', true);
  ${statement};
  ${hold ? "SELECT pg_sleep(3);" : ""}
  COMMIT;
`;

export async function runConcurrency({ sql, session }) {
  sql(`INSERT INTO public.crm_members VALUES (1,'${first}'),(2,'${second}');`);
  const client = response(sql(actorSQL(first,
    "SELECT public.create_client('10000000-0000-4000-8000-000000000001','{\"name\":\"Carrera\"}')")));

  async function waitUntil(condition, label) {
    const deadline = Date.now() + 4_000;
    while (Date.now() < deadline) {
      if (sql(condition) === "t") return;
      await new Promise((accept) => setTimeout(accept, 30));
    }
    throw new Error(`Concurrencia: ${label} no observado`);
  }

  async function overlap(name, actorA, queryA, actorB, queryB) {
    const aName = `${name}-a`;
    const bName = `${name}-b`;
    const a = session(actorSQL(actorA, queryA, true), aName);
    await waitUntil(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='${aName}' AND wait_event='PgSleep');`, "primera transacción mantiene locks");
    const b = session(actorSQL(actorB, queryB), bName);
    await waitUntil(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='${bName}' AND wait_event_type='Lock');`, "segunda conexión espera lock real");
    const pids = JSON.parse(sql(`SELECT json_agg(pid) FROM pg_stat_activity WHERE application_name IN ('${aName}','${bName}');`));
    assert.equal(pids.length, 2);
    assert.notEqual(pids[0], pids[1]);
    const results = await Promise.all([a, b]);
    console.log(`Concurrencia ${name}: conexiones PostgreSQL distintas ${pids.join("/")}, espera Lock observada.`);
    return results;
  }

  const [winner, conflict] = await overlap("wu004-version", first,
    `SELECT public.change_client_status('10000000-0000-4000-8000-000000000002','${client.id}',1,'Cerrado')`, second,
    `SELECT public.change_client_status('10000000-0000-4000-8000-000000000003','${client.id}',1,'Reunión agendada')`);
  assert.equal(winner.status, 0, winner.stderr);
  assert.equal(conflict.status, 3);
  assert.match(conflict.stderr, /PT409: client_version_conflict/);
  assert.equal(response(winner.stdout).version, 2);
  sql(`SELECT test_support.assert_true(
    (SELECT version=2 AND status='Cerrado' FROM public.clients WHERE id='${client.id}'), 'concurrent exactly one write');
    SELECT test_support.assert_true((SELECT count(*)=2 FROM public.client_transitions WHERE client_id='${client.id}'), 'only initial and winner events');
    SELECT test_support.assert_true((SELECT actor_id='${first}' FROM public.client_transitions WHERE client_id='${client.id}' AND to_status='Cerrado'), 'winner actor persisted');
    SELECT test_support.assert_true(NOT EXISTS(SELECT 1 FROM public.client_milestones WHERE client_id='${client.id}' AND status='Reunión agendada'), 'loser leaves no milestone');
    SELECT test_support.assert_true(NOT EXISTS(SELECT 1 FROM crm_private.client_requests WHERE request_id='10000000-0000-4000-8000-000000000003'), 'loser leaves no ledger');`);

  const replayQuery = "SELECT public.create_client('10000000-0000-4000-8000-000000000004','{\"name\":\"Replay concurrente\"}')";
  const [original, replay] = await overlap("wu004-replay", first, replayQuery, first, replayQuery);
  assert.equal(original.status, 0, original.stderr);
  assert.equal(replay.status, 0, replay.stderr);
  assert.deepEqual(response(original.stdout), response(replay.stdout));
  const replayId = response(original.stdout).id;
  sql(`SELECT test_support.assert_true((SELECT count(*)=1 FROM public.clients WHERE id='${replayId}'), 'concurrent replay one client');
    SELECT test_support.assert_true((SELECT count(*)=1 FROM public.client_transitions WHERE client_id='${replayId}'), 'concurrent replay one event');
    SELECT test_support.assert_true((SELECT count(*)=1 FROM public.client_milestones WHERE client_id='${replayId}'), 'concurrent replay one milestone');
    SELECT test_support.assert_true((SELECT count(*)=1 FROM crm_private.client_requests WHERE actor_id='${first}' AND request_id='10000000-0000-4000-8000-000000000004' AND response IS NOT NULL), 'concurrent replay one completed request');`);
  console.log("PASS WU004 version conflict and concurrent idempotent replay");
  const [accepted, mismatch] = await overlap("wu004-mismatch", first,
    "SELECT public.create_client('10000000-0000-4000-8000-000000000005','{\"name\":\"Original\"}')", first,
    "SELECT public.create_client('10000000-0000-4000-8000-000000000005','{\"name\":\"Changed\"}')");
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(mismatch.status, 3);
  assert.match(mismatch.stderr, /22023: idempotency_payload_mismatch/);
  sql("SELECT test_support.assert_true(NOT EXISTS(SELECT 1 FROM public.clients WHERE name='Changed'), 'concurrent changed payload leaves no client');");
  console.log("PASS WU004 concurrent changed-payload rejection");
  const target = response(sql(actorSQL(first, "SELECT public.create_client(gen_random_uuid(),'{\"name\":\"Delete race\"}')")));
  const deleteQuery = `SELECT public.delete_client('70000000-0000-4000-8000-000000000002','${target.id}',1)`;
  const [deleted, replayDelete] = await overlap("wu002-delete-replay", first, deleteQuery, first, deleteQuery);
  assert.equal(deleted.status, 0, deleted.stderr);
  assert.equal(replayDelete.status, 0, replayDelete.stderr);
  assert.deepEqual(response(deleted.stdout), response(replayDelete.stdout));
  sql(`SELECT test_support.assert_true((SELECT version=2 AND deleted_at IS NOT NULL FROM public.clients WHERE id='${target.id}'),'delete replay one version');`);
  const race = response(sql(actorSQL(first, "SELECT public.create_client(gen_random_uuid(),'{\"name\":\"Delete versus update\"}')")));
  const [deleteWinner, editLoser] = await overlap("wu002-delete-update", first,
    `SELECT public.delete_client(gen_random_uuid(),'${race.id}',1)`, second,
    `SELECT public.update_client(gen_random_uuid(),'${race.id}',1,'{\"name\":\"Lost edit\"}')`);
  assert.equal(deleteWinner.status, 0, deleteWinner.stderr);
  assert.equal(editLoser.status, 3);
  assert.match(editLoser.stderr, /P0002: client_not_found/);
  const inverse = response(sql(actorSQL(first, "SELECT public.create_client(gen_random_uuid(),'{\"name\":\"Update versus delete\"}')")));
  const [editWinner, deleteLoser] = await overlap("wu002-update-delete", first,
    `SELECT public.update_client(gen_random_uuid(),'${inverse.id}',1,'{\"name\":\"Current\"}')`, second,
    `SELECT public.delete_client(gen_random_uuid(),'${inverse.id}',1)`);
  assert.equal(editWinner.status, 0, editWinner.stderr);
  assert.equal(deleteLoser.status, 3);
  assert.match(deleteLoser.stderr, /PT409: client_version_conflict/);
  sql(`SELECT test_support.assert_true((SELECT deleted_at IS NULL AND version=2 AND name='Current' FROM public.clients WHERE id='${inverse.id}'),'stale delete retains updated client');`);
  console.log("PASS WU002 delete replay and both delete/update concurrency orders");
}
