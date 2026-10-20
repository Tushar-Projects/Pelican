import test from 'node:test';
import assert from 'node:assert/strict';
import sessionsRouter, { isHost } from '../src/routes/sessions.js';
import Session from '../src/models/Session.js';

function createMockResponse() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

// Retrieve handlers directly from router stack
const patchLayer = sessionsRouter.stack.find(
  (l) => l.route && l.route.path === '/:code' && l.route.methods.patch
);
const patchHandler = patchLayer.route.stack[patchLayer.route.stack.length - 1].handle;

const deleteLayer = sessionsRouter.stack.find(
  (l) => l.route && l.route.path === '/:code' && l.route.methods.delete
);
const deleteHandler = deleteLayer.route.stack[deleteLayer.route.stack.length - 1].handle;

test('Session host authorization helper (isHost)', async (t) => {
  await t.test('returns true when session hostUserId matches user _id', () => {
    assert.equal(isHost({ hostUserId: 'u123' }, { _id: 'u123' }), true);
  });

  await t.test('returns true when hostUserId and user _id have toString() equality', () => {
    const hostId = { toString: () => '671542f0a1b2c3d4e5f60001' };
    const userId = { toString: () => '671542f0a1b2c3d4e5f60001' };
    assert.equal(isHost({ hostUserId: hostId }, { _id: userId }), true);
  });

  await t.test('returns false when session hostUserId does not match user _id', () => {
    assert.equal(isHost({ hostUserId: 'u123' }, { _id: 'u456' }), false);
  });

  await t.test('returns false for guest sessions where hostUserId is null or undefined', () => {
    assert.equal(isHost({ hostUserId: null }, { _id: 'u123' }), false);
    assert.equal(isHost({ hostUserId: undefined }, { _id: 'u123' }), false);
    assert.equal(isHost({}, { _id: 'u123' }), false);
  });

  await t.test('returns false when user is null, undefined, or missing _id', () => {
    assert.equal(isHost({ hostUserId: 'u123' }, null), false);
    assert.equal(isHost({ hostUserId: 'u123' }, undefined), false);
    assert.equal(isHost({ hostUserId: 'u123' }, {}), false);
  });
});

test('PATCH /sessions/:code host authorization', async (t) => {
  const originalFindOne = Session.findOne;

  t.afterEach(() => {
    Session.findOne = originalFindOne;
  });

  await t.test('returns 404 if session is not found', async () => {
    Session.findOne = async () => null;

    const req = {
      params: { code: 'ABC234' },
      user: { _id: 'user1' },
      body: { extendMinutes: 15 },
    };
    const res = createMockResponse();

    await patchHandler(req, res);

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { error: 'Session not found' });
  });

  await t.test('returns 403 when session is a guest session (hostUserId is null)', async () => {
    Session.findOne = async () => ({
      _id: 's1',
      code: 'ABC234',
      hostUserId: null,
      save: async () => {},
    });

    const req = {
      params: { code: 'ABC234' },
      user: { _id: 'user1' },
      body: { extendMinutes: 15 },
    };
    const res = createMockResponse();

    await patchHandler(req, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'Only the session host can modify this session' });
  });

  await t.test('returns 403 when caller is not the session host', async () => {
    Session.findOne = async () => ({
      _id: 's1',
      code: 'ABC234',
      hostUserId: 'hostUser1',
      save: async () => {},
    });

    const req = {
      params: { code: 'ABC234' },
      user: { _id: 'otherUser2' },
      body: { extendMinutes: 15 },
    };
    const res = createMockResponse();

    await patchHandler(req, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'Only the session host can modify this session' });
  });

  await t.test('succeeds with 200 when caller is the session host', async () => {
    let saved = false;
    const sessionObj = {
      _id: 's1',
      code: 'ABC234',
      hostUserId: 'hostUser1',
      expiresAt: new Date(Date.now() + 60000),
      save: async function () {
        saved = true;
      },
    };
    Session.findOne = async () => sessionObj;

    const req = {
      params: { code: 'ABC234' },
      user: { _id: 'hostUser1' },
      body: { extendMinutes: 15 },
    };
    const res = createMockResponse();

    await patchHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(saved, true);
    assert.ok(res.body && res.body.session);
    assert.equal(res.body.session.code, 'ABC234');
  });
});

test('DELETE /sessions/:code host authorization', async (t) => {
  const originalFindOne = Session.findOne;
  const originalDeleteOne = Session.deleteOne;

  t.afterEach(() => {
    Session.findOne = originalFindOne;
    Session.deleteOne = originalDeleteOne;
  });

  await t.test('returns 404 if session is not found', async () => {
    Session.findOne = async () => null;

    const req = {
      params: { code: 'ABC234' },
      user: { _id: 'user1' },
    };
    const res = createMockResponse();

    await deleteHandler(req, res);

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { error: 'Session not found' });
  });

  await t.test('returns 403 when session is a guest session (hostUserId is null)', async () => {
    Session.findOne = async () => ({
      _id: 's1',
      code: 'ABC234',
      hostUserId: null,
    });

    const req = {
      params: { code: 'ABC234' },
      user: { _id: 'user1' },
    };
    const res = createMockResponse();

    await deleteHandler(req, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'Only the session host can modify this session' });
  });

  await t.test('returns 403 when caller is not the session host', async () => {
    Session.findOne = async () => ({
      _id: 's1',
      code: 'ABC234',
      hostUserId: 'hostUser1',
    });

    const req = {
      params: { code: 'ABC234' },
      user: { _id: 'otherUser2' },
    };
    const res = createMockResponse();

    await deleteHandler(req, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'Only the session host can modify this session' });
  });

  await t.test('succeeds with 204 when caller is the session host', async () => {
    let deletedId = null;
    Session.findOne = async () => ({
      _id: 's1',
      code: 'ABC234',
      hostUserId: 'hostUser1',
    });
    Session.deleteOne = async (query) => {
      deletedId = query._id;
      return { deletedCount: 1 };
    };

    const req = {
      params: { code: 'ABC234' },
      user: { _id: 'hostUser1' },
    };
    const res = createMockResponse();

    await deleteHandler(req, res);

    assert.equal(res.statusCode, 204);
    assert.equal(deletedId, 's1');
  });
});
