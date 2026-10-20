import test from 'node:test';
import assert from 'node:assert/strict';
import transfersRouter, { parseDateFilter } from '../src/routes/transfers.js';
import Transfer from '../src/models/Transfer.js';

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

// Retrieve GET / handler from router stack
const getLayer = transfersRouter.stack.find(
  (l) => l.route && l.route.path === '/' && l.route.methods.get
);
const getTransfersHandler = getLayer.route.stack[getLayer.route.stack.length - 1].handle;

test('Transfer date filtering helper (parseDateFilter)', async (t) => {
  await t.test('date-only `to` (YYYY-MM-DD) sets $lte to end of that day (23:59:59.999Z)', () => {
    const filter = parseDateFilter(undefined, '2026-10-20');
    assert.ok(filter.$lte instanceof Date);
    assert.equal(filter.$lte.toISOString(), '2026-10-20T23:59:59.999Z');
    assert.equal(filter.$gte, undefined);
  });

  await t.test('full ISO string for `to` passes through unchanged', () => {
    const isoString = '2026-10-20T14:30:00.000Z';
    const filter = parseDateFilter(undefined, isoString);
    assert.ok(filter.$lte instanceof Date);
    assert.equal(filter.$lte.toISOString(), isoString);
  });

  await t.test('full ISO string for `from` passes through unchanged', () => {
    const isoString = '2026-10-20T08:00:00.000Z';
    const filter = parseDateFilter(isoString, undefined);
    assert.ok(filter.$gte instanceof Date);
    assert.equal(filter.$gte.toISOString(), isoString);
  });

  await t.test('handles both `from` and date-only `to` together', () => {
    const fromIso = '2026-10-19T00:00:00.000Z';
    const toDateOnly = '2026-10-20';
    const filter = parseDateFilter(fromIso, toDateOnly);
    assert.equal(filter.$gte.toISOString(), fromIso);
    assert.equal(filter.$lte.toISOString(), '2026-10-20T23:59:59.999Z');
  });

  await t.test('returns empty object when neither `from` nor `to` is provided', () => {
    assert.deepEqual(parseDateFilter(undefined, undefined), {});
    assert.deepEqual(parseDateFilter('', ''), {});
  });

  await t.test('throws error when `from` date is invalid', () => {
    assert.throws(
      () => parseDateFilter('not-a-valid-date', undefined),
      /Invalid date parameter/
    );
  });

  await t.test('throws error when `to` date is invalid', () => {
    assert.throws(
      () => parseDateFilter(undefined, 'not-a-valid-date'),
      /Invalid date parameter/
    );
  });

  await t.test('throws error when `to` date is an out-of-range calendar day (e.g. 2026-02-31)', () => {
    assert.throws(
      () => parseDateFilter(undefined, '2026-02-31'),
      /Invalid date parameter/
    );
  });
});

test('GET /transfers date handling in route', async (t) => {
  const originalFind = Transfer.find;
  const originalCount = Transfer.countDocuments;

  let capturedFilter = null;

  t.beforeEach(() => {
    capturedFilter = null;
    Transfer.countDocuments = async (filter) => {
      capturedFilter = filter;
      return 0;
    };
    Transfer.find = (filter) => {
      capturedFilter = filter;
      return {
        sort: () => ({
          skip: () => ({
            limit: async () => [],
          }),
        }),
      };
    };
  });

  t.afterEach(() => {
    Transfer.find = originalFind;
    Transfer.countDocuments = originalCount;
  });

  await t.test('returns 400 when `from` date parameter is invalid', async () => {
    const req = {
      user: { _id: 'u1' },
      query: { from: 'invalid-date' },
    };
    const res = createMockResponse();

    await getTransfersHandler(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'Invalid date parameter' });
  });

  await t.test('returns 400 when `to` date parameter is invalid', async () => {
    const req = {
      user: { _id: 'u1' },
      query: { to: 'invalid-date' },
    };
    const res = createMockResponse();

    await getTransfersHandler(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'Invalid date parameter' });
  });

  await t.test('sets $lte to end of day (23:59:59.999Z) when query `to` is date-only YYYY-MM-DD', async () => {
    const req = {
      user: { _id: 'u1' },
      query: { to: '2026-10-20' },
    };
    const res = createMockResponse();

    await getTransfersHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(capturedFilter);
    assert.equal(capturedFilter.userId, 'u1');
    assert.ok(capturedFilter.createdAt);
    assert.equal(capturedFilter.createdAt.$lte.toISOString(), '2026-10-20T23:59:59.999Z');
  });

  await t.test('passes full ISO strings through unchanged', async () => {
    const fromIso = '2026-10-19T08:00:00.000Z';
    const toIso = '2026-10-20T17:00:00.000Z';
    const req = {
      user: { _id: 'u1' },
      query: { from: fromIso, to: toIso },
    };
    const res = createMockResponse();

    await getTransfersHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(capturedFilter);
    assert.equal(capturedFilter.createdAt.$gte.toISOString(), fromIso);
    assert.equal(capturedFilter.createdAt.$lte.toISOString(), toIso);
  });
});
