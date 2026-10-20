import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../src/middleware/auth.js';
import User from '../src/models/User.js';

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
  };
  return res;
}

test('Auth middleware (requireAuth)', async (t) => {
  const secret = process.env.JWT_SECRET || 'change_me';

  await t.test('returns 401 when Authorization header is completely missing', async () => {
    const req = { headers: {} };
    const res = createMockResponse();
    let nextCalled = false;

    await requireAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: 'Authorization token required' });
  });

  await t.test('returns 401 when Authorization header does not start with Bearer', async () => {
    const req = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };
    const res = createMockResponse();
    let nextCalled = false;

    await requireAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: 'Authorization token required' });
  });

  await t.test('returns 401 when Bearer token is empty or whitespace', async () => {
    const req = { headers: { authorization: 'Bearer   ' } };
    const res = createMockResponse();
    let nextCalled = false;

    await requireAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: 'Authorization token required' });
  });

  await t.test('returns 401 when token is malformed / invalid JWT', async () => {
    const req = { headers: { authorization: 'Bearer this-is-not-a-valid-token' } };
    const res = createMockResponse();
    let nextCalled = false;

    await requireAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: 'Invalid or expired token' });
  });

  await t.test('returns 401 when token was signed with a different secret', async () => {
    const wrongSecretToken = jwt.sign({ userId: 'u123' }, 'wrong_secret');
    const req = { headers: { authorization: `Bearer ${wrongSecretToken}` } };
    const res = createMockResponse();
    let nextCalled = false;

    await requireAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: 'Invalid or expired token' });
  });

  await t.test('returns 401 when token has expired', async () => {
    const expiredToken = jwt.sign({ userId: 'u123' }, secret, { expiresIn: '-1s' });
    const req = { headers: { authorization: `Bearer ${expiredToken}` } };
    const res = createMockResponse();
    let nextCalled = false;

    await requireAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: 'Invalid or expired token' });
  });

  await t.test('returns 401 when token is valid but user is not found in database (mocked DB)', async () => {
    const validToken = jwt.sign({ userId: 'u_nonexistent' }, secret);
    const req = { headers: { authorization: `Bearer ${validToken}` } };
    const res = createMockResponse();
    let nextCalled = false;

    // Mock User.findById to return null without hitting MongoDB
    const originalFindById = User.findById;
    User.findById = () => ({
      select: () => Promise.resolve(null),
    });

    try {
      await requireAuth(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 401);
      assert.deepEqual(res.body, { error: 'User not found' });
    } finally {
      User.findById = originalFindById;
    }
  });

  await t.test('calls next() and populates req.user when token and user are valid (mocked DB)', async () => {
    const mockUser = {
      _id: 'u_valid_123',
      name: 'Alice Pelican',
      email: 'alice@pelican.test',
    };
    const validToken = jwt.sign({ userId: mockUser._id }, secret);
    const req = { headers: { authorization: `Bearer ${validToken}` } };
    const res = createMockResponse();
    let nextCalled = false;

    // Mock User.findById to return the mock user
    const originalFindById = User.findById;
    User.findById = (id) => ({
      select: () => Promise.resolve(id === mockUser._id ? mockUser : null),
    });

    try {
      await requireAuth(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(res.statusCode, null);
      assert.deepEqual(req.user, mockUser);
    } finally {
      User.findById = originalFindById;
    }
  });
});
