import test, {after, before, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const databasePath = path.join(os.tmpdir(), `toolmanager-${process.pid}.sqlite`);
process.env.NODE_ENV = 'test';
process.env.TOOLMANAGER_DATABASE_PATH = databasePath;
process.env.TOOLMANAGER_INITIAL_PASSWORD = 'TestPassword123!';
const {app, seed, resetForTests, closeDatabase} = await import('../src/index.js');
let server;
let base;
let technicianCookie;
let managerCookie;

before(() => new Promise(resolve => {
  server = app.listen(0, '127.0.0.1', () => {
    base = `http://127.0.0.1:${server.address().port}/api`;
    resolve();
  });
}));

after(() => new Promise(resolve => server.close(() => {
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(databasePath + suffix, {force: true});
  resolve();
})));

beforeEach(async () => {
  const data = structuredClone(seed);
  const tool = data.tools.find(item => item.id === 't4');
  tool.total = 1;
  tool.available = 1;
  data.requests = data.requests.filter(request => request.toolId !== 't4');
  resetForTests(data);
  technicianCookie = await login('ali');
  managerCookie = await login('maryam');
});

async function login(username) {
  const response = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username, password: 'TestPassword123!'})
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}

async function post(url, body, cookie = technicianCookie) {
  const response = await fetch(base + url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Cookie: cookie},
    body: JSON.stringify(body)
  });
  const responseBody = response.status === 204 ? null : await response.json();
  return {response, body: responseBody};
}

async function getState(cookie = technicianCookie) {
  const response = await fetch(base + '/state', {headers: {Cookie: cookie}});
  assert.equal(response.status, 200);
  return response.json();
}

const request = (priority = 'normal') => ({
  toolId: 't4', quantity: 1, purpose: 'تست ابزار', neededUntil: '2030-01-01T12:00', priority,
  ...(priority === 'urgent' ? {emergencyReason: 'توقف کار'} : {})
});

test('protected endpoints require authentication', async () => {
  const response = await fetch(base + '/state');
  assert.equal(response.status, 401);
});

test('request identity comes from the authenticated session', async () => {
  const created = await post('/requests', {...request(), requesterId: 'u2'});
  assert.equal(created.response.status, 201);
  assert.equal(created.body.requesterId, 'u1');
});

test('training eligibility is enforced', async () => {
  const {response, body} = await post('/requests', {...request(), toolId: 't2'}, await login('zahra'));
  assert.equal(response.status, 400);
  assert.match(body.error, /آموزش/);
});

test('ready requests reserve stock and later requests queue', async () => {
  const first = await post('/requests', request());
  const second = await post('/requests', request());
  assert.equal(first.body.status, 'ready');
  assert.equal(second.body.status, 'queued');
  assert.equal(second.body.queuePosition, 1);
});

test('urgent requests move to the front of the queue', async () => {
  const data = structuredClone(seed);
  const tool = data.tools.find(item => item.id === 't4');
  tool.total = 1;
  tool.available = 0;
  data.requests = data.requests.filter(item => item.toolId !== 't4');
  resetForTests(data);
  technicianCookie = await login('ali');
  const normal = await post('/requests', request());
  const urgent = await post('/requests', request('urgent'));
  const state = await getState();
  assert.equal(state.requests.find(item => item.id === urgent.body.id).queuePosition, 1);
  assert.equal(state.requests.find(item => item.id === normal.body.id).queuePosition, 2);
});

test('technicians cannot perform stock actions', async () => {
  const created = (await post('/requests', request())).body;
  const result = await post(`/requests/${created.id}/action`, {action: 'checkout'});
  assert.equal(result.response.status, 403);
});

test('damaged return stays out of stock until service completes', async () => {
  const created = (await post('/requests', request())).body;
  let result = await post(`/requests/${created.id}/action`, {action: 'checkout'}, managerCookie);
  assert.equal(result.body.status, 'checked_out');
  result = await post(`/requests/${created.id}/action`, {action: 'return', condition: 'آسیب‌دیده', notes: 'ترک بدنه'}, managerCookie);
  assert.equal(result.body.status, 'damaged');
  let state = await getState(managerCookie);
  assert.equal(state.tools.find(item => item.id === 't4').available, 0);
  assert.equal(state.tools.find(item => item.id === 't4').serviceCount, 1);
  result = await post('/tools/t4/service', {quantity: 1}, managerCookie);
  assert.equal(result.body.available, 1);
  assert.equal(result.body.serviceCount, 0);
});

test('invalid request transition is rejected', async () => {
  const created = (await post('/requests', request())).body;
  await post(`/requests/${created.id}/action`, {action: 'checkout'}, managerCookie);
  const result = await post(`/requests/${created.id}/action`, {action: 'checkout'}, managerCookie);
  assert.equal(result.response.status, 409);
});

test('past due checkout becomes overdue', async () => {
  const data = structuredClone(seed);
  data.requests.push({...request(), requesterId: 'u1', id: 'late', requestedAt: '2020-01-01T00:00:00Z', neededUntil: '2020-01-02T00:00:00Z', status: 'checked_out', queuePosition: 0});
  resetForTests(data);
  technicianCookie = await login('ali');
  const state = await getState();
  assert.equal(state.requests.find(item => item.id === 'late').status, 'overdue');
});

test('authenticated users can rotate their password', async () => {
  const result = await post('/auth/password', {currentPassword: 'TestPassword123!', newPassword: 'NewTestPassword456!', confirmation: 'NewTestPassword456!'});
  assert.equal(result.response.status, 204);
  const response = await fetch(base + '/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: 'ali', password: 'NewTestPassword456!'})});
  assert.equal(response.status, 200);
});
