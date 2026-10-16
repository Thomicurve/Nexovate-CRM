import assert from "node:assert/strict";
const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
const response = (stdout) => JSON.parse(stdout.split(/\r?\n/).find((line) => line.startsWith("{")));
const asMember = (query) => `BEGIN; SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claim.sub','${first}',true); ${query}; COMMIT;`;
export async function runCommentConcurrency({ sql, overlap }) {
  const createClient = () => response(sql(asMember("SELECT public.create_client(gen_random_uuid(),'{\"name\":\"Comment race\"}')")));
  const createComment = (client) => response(sql(asMember(`SELECT public.create_client_comment(gen_random_uuid(),'${client.id}','Original')`))).comment;
  const target = createClient();
  const query = `SELECT public.create_client_comment('a0000000-0000-4000-8000-000000000001','${target.id}','One comment')`;
  const [created, replay] = await overlap("comments-replay", first, query, first, query);
  assert.equal(created.status, 0, created.stderr);
  assert.equal(replay.status, 0, replay.stderr);
  assert.deepEqual(response(created.stdout), response(replay.stdout));
  sql(`SELECT test_support.assert_true((SELECT count(*)=1 FROM public.client_comments WHERE client_id='${target.id}'),'replay exactly once');`);
  const original = `SELECT public.create_client_comment('a0000000-0000-4000-8000-000000000002','${target.id}','Original')`;
  const changed = `SELECT public.create_client_comment('a0000000-0000-4000-8000-000000000002','${target.id}','Changed')`;
  const [accepted, mismatch] = await overlap("comments-mismatch", first, original, first, changed);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(mismatch.status, 3);
  assert.match(mismatch.stderr, /22023: idempotency_payload_mismatch/);
  const comment = response(created.stdout).comment;
  const archive = `SELECT public.archive_client_comment('a0000000-0000-4000-8000-000000000003','${target.id}','${comment.id}')`;
  const [archived, archiveReplay] = await overlap("comments-archive-replay", first, archive, first, archive);
  assert.equal(archived.status, 0, archived.stderr);
  assert.equal(archiveReplay.status, 0, archiveReplay.stderr);
  assert.deepEqual(response(archived.stdout), response(archiveReplay.stdout));
  // Two allowed actors race on legacy: only the first archive owns its metadata.
  const legacy = createClient();
  const legacyId = sql(`INSERT INTO public.client_comments(client_id,body,legacy,imported_at) VALUES('${legacy.id}','Legacy',true,clock_timestamp()) RETURNING id;`).split(/\r?\n/)[0];
  const [legacyFirst, legacySecond] = await overlap("comments-legacy-archive", first,
    `SELECT public.archive_client_comment(gen_random_uuid(),'${legacy.id}','${legacyId}')`, second,
    `SELECT public.archive_client_comment(gen_random_uuid(),'${legacy.id}','${legacyId}')`);
  assert.equal(legacyFirst.status, 0, legacyFirst.stderr);
  assert.equal(legacySecond.status, 0, legacySecond.stderr);
  assert.deepEqual(response(legacyFirst.stdout).comment, response(legacySecond.stdout).comment);
  assert.equal(response(legacySecond.stdout).comment.archived_by, first);
  for (const operation of ["create", "archive"]) {
    for (const deleteFirst of [true, false]) {
      const client = createClient();
      const item = createComment(client);
      const mutation = operation === "create" ? `SELECT public.create_client_comment(gen_random_uuid(),'${client.id}','Race')` :
        `SELECT public.archive_client_comment(gen_random_uuid(),'${client.id}','${item.id}')`;
      const deletion = `SELECT public.delete_client(gen_random_uuid(),'${client.id}',1)`;
      const [a, b] = await overlap(`comments-${operation}-${deleteFirst ? "delete-first" : "delete-last"}`, first,
        deleteFirst ? deletion : mutation, first, deleteFirst ? mutation : deletion);
      assert.equal(a.status, 0, a.stderr);
      if (deleteFirst) {
        assert.equal(b.status, 3);
        assert.match(b.stderr, /P0002: client_not_found/);
      } else assert.equal(b.status, 0, b.stderr);
      sql(`SELECT test_support.assert_true((SELECT version=2 AND deleted_at IS NOT NULL FROM public.clients WHERE id='${client.id}'),'comments leave edit version intact before deletion');
        SELECT test_support.assert_true((SELECT count(*)=${operation === "create" && !deleteFirst ? 2 : 1} FROM public.client_comments WHERE client_id='${client.id}'),'delete retains exact physical comment history');
        SELECT test_support.assert_true((SELECT (archived_at IS NOT NULL)=${operation === "archive" && !deleteFirst} FROM public.client_comments WHERE id='${item.id}'),'archive/delete serialized metadata');`);
    }
  }
  console.log("PASS comments: concurrent replay, collision, archive replay, competing legacy actors, both create/delete and archive/delete orders");
}
