import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const port = positiveInteger(process.env.PORT, 3000);
const host = process.env.HOST || '0.0.0.0';
const databasePath = path.resolve(process.env.TOOLMANAGER_DATABASE_PATH || path.join(__dirname, '..', 'data', 'toolmanager.sqlite'));
const legacyDataPath = path.join(__dirname, '..', 'data.json');
const sessionHours = positiveInteger(process.env.SESSION_TTL_HOURS, 12);
const appOrigin = process.env.APP_ORIGIN || `http://localhost:${port}`;
const cookieSecure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProduction;
const initialPassword = process.env.TOOLMANAGER_INITIAL_PASSWORD || (isProduction ? '' : 'ToolManager123!');

export const seed = {
  users: [
    {id: 'u1', username: 'ali', name: 'علی رضایی', role: 'technician', team: 'تعمیرات مکانیک', active: true, training: ['برق', 'مکانیک']},
    {id: 'u2', username: 'maryam', name: 'مریم احمدی', role: 'storekeeper', team: 'انبار مرکزی', active: true, training: ['برق', 'مکانیک', 'ایمنی']},
    {id: 'u3', username: 'hossein', name: 'حسین کریمی', role: 'supervisor', team: 'نگهداری', active: true, training: ['برق']},
    {id: 'u4', username: 'zahra', name: 'زهرا موسوی', role: 'technician', team: 'تعمیرات عمومی', active: true, training: ['عمومی']}
  ],
  tools: [
    {id: 't1', code: 'TL-101', name: 'دریل شارژی صنعتی', category: 'برق', total: 3, available: 2, serviceCount: 0, location: 'قفسه A-12', condition: 'سالم', trainingRequired: true, icon: 'drill'},
    {id: 't2', code: 'TL-204', name: 'آچار ترکمتر', category: 'مکانیک', total: 2, available: 1, serviceCount: 1, location: 'قفسه B-04', condition: 'نیازمند بازرسی', trainingRequired: true, icon: 'wrench'},
    {id: 't3', code: 'TL-330', name: 'مولتی‌متر کلمپی', category: 'برق', total: 4, available: 3, serviceCount: 0, location: 'قفسه A-03', condition: 'سالم', trainingRequired: true, icon: 'zap'},
    {id: 't4', code: 'TL-415', name: 'ست آچار آلن', category: 'عمومی', total: 8, available: 7, serviceCount: 0, location: 'قفسه C-01', condition: 'سالم', trainingRequired: false, icon: 'settings'},
    {id: 't5', code: 'TL-522', name: 'مینی فرز صنعتی', category: 'برق', total: 2, available: 2, serviceCount: 0, location: 'قفسه A-09', condition: 'سالم', trainingRequired: true, icon: 'circle-dot'}
  ],
  requests: [
    {id: 'r1', requesterId: 'u1', toolId: 't1', quantity: 1, purpose: 'تعویض موتور پمپ خط ۲', priority: 'urgent', emergencyReason: 'توقف خط تولید', requestedAt: '2026-08-14T07:20:00Z', neededUntil: '2026-08-15T16:00:00Z', status: 'ready', queuePosition: 0, approverId: 'u3'},
    {id: 'r2', requesterId: 'u1', toolId: 't2', quantity: 1, purpose: 'تنظیم گشتاور فلنج', priority: 'normal', requestedAt: '2026-08-14T06:10:00Z', neededUntil: '2026-08-15T18:00:00Z', status: 'queued', queuePosition: 1},
    {id: 'r3', requesterId: 'u3', toolId: 't3', quantity: 1, purpose: 'بازرسی تابلو برق', priority: 'normal', requestedAt: '2026-08-13T09:00:00Z', neededUntil: '2026-08-14T10:00:00Z', status: 'overdue', queuePosition: 0, checkedOutAt: '2026-08-13T10:00:00Z'},
    {id: 'r4', requesterId: 'u4', toolId: 't4', quantity: 1, purpose: 'سرویس حفاظ دستگاه بسته‌بندی', priority: 'normal', requestedAt: '2026-08-14T08:15:00Z', neededUntil: '2026-08-16T12:00:00Z', status: 'checked_out', queuePosition: 0, checkedOutAt: '2026-08-14T08:30:00Z'}
  ],
  audit: [
    {id: 'a4', actorId: 'u2', action: 'checkout', entity: 'r4', timestamp: '2026-08-14T08:30:00Z', detail: 'ست آچار آلن'},
    {id: 'a3', actorId: 'u3', action: 'approve', entity: 'r1', timestamp: '2026-08-14T07:35:00Z', detail: 'دریل شارژی صنعتی'},
    {id: 'a2', actorId: 'u1', action: 'ثبت درخواست', entity: 'r1', timestamp: '2026-08-14T07:20:00Z', detail: 'دریل شارژی صنعتی'},
    {id: 'a1', actorId: 'u2', action: 'checkout', entity: 'r3', timestamp: '2026-08-13T10:00:00Z', detail: 'مولتی‌متر کلمپی'}
  ]
};

if (isProduction && !fs.existsSync(databasePath) && initialPassword.length < 12) {
  throw new Error('TOOLMANAGER_INITIAL_PASSWORD must contain at least 12 characters for a new production database');
}

fs.mkdirSync(path.dirname(databasePath), {recursive: true});
const db = new DatabaseSync(databasePath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS accounts (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
`);

if (!db.prepare('SELECT 1 FROM app_state WHERE id = 1').get()) {
  const initialState = readLegacyState() || structuredClone(seed);
  const now = new Date().toISOString();
  db.prepare('INSERT INTO app_state(id, payload, updated_at) VALUES(1, ?, ?)').run(JSON.stringify(initialState), now);
  const passwordHash = hashPassword(initialPassword);
  const insertAccount = db.prepare('INSERT INTO accounts(user_id, username, password_hash) VALUES(?, ?, ?)');
  for (const user of initialState.users) insertAccount.run(user.id, user.username, passwordHash);
}

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);
app.use((req, res, next) => {
  const startedAt = performance.now();
  req.requestId = crypto.randomUUID();
  res.set({
    'Content-Security-Policy': "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-Request-Id': req.requestId
  });
  if (isProduction) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.on('finish', () => console.log(JSON.stringify({time: new Date().toISOString(), requestId: req.requestId, method: req.method, path: req.originalUrl, status: res.statusCode, durationMs: Math.round(performance.now() - startedAt)})));
  next();
});
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use(express.json({limit: '32kb', type: 'application/json'}));
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin') && req.get('origin') !== appOrigin) return res.status(403).json({error: 'مبدأ درخواست معتبر نیست'});
  next();
});

const loginAttempts = new Map();
app.post('/api/auth/login', (req, res, next) => {
  try {
    const ipKey = req.ip || req.socket.remoteAddress || 'unknown';
    const attempt = loginAttempts.get(ipKey);
    if (attempt?.blockedUntil > Date.now()) throw httpError(429, 'تلاش‌های ورود بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.');
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (!username || !password) throw httpError(400, 'نام کاربری و رمز عبور الزامی است');
    const account = db.prepare('SELECT * FROM accounts WHERE username = ?').get(username);
    const now = Date.now();
    if (!account || account.locked_until > now || !verifyPassword(password, account.password_hash)) {
      registerLoginFailure(ipKey, account);
      throw httpError(401, account?.locked_until > now ? 'حساب کاربری موقتاً قفل است' : 'نام کاربری یا رمز عبور نادرست است');
    }
    const user = currentState().users.find(item => item.id === account.user_id);
    if (!user?.active) throw httpError(403, 'حساب کاربری غیرفعال است');
    db.prepare('UPDATE accounts SET failed_attempts = 0, locked_until = 0 WHERE user_id = ?').run(account.user_id);
    loginAttempts.delete(ipKey);
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = now + sessionHours * 60 * 60 * 1000;
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
    db.prepare('INSERT INTO sessions(token_hash, user_id, expires_at, created_at) VALUES(?, ?, ?, ?)').run(tokenHash(token), user.id, expiresAt, now);
    res.setHeader('Set-Cookie', sessionCookie(token, sessionHours * 60 * 60));
    res.json({user: publicUser(user)});
  } catch (error) { next(error); }
});

app.get('/api/auth/me', authenticate, (req, res) => res.json({user: publicUser(req.user)}));
app.post('/api/auth/logout', authenticate, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.sessionHash);
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  res.status(204).end();
});
app.post('/api/auth/password', authenticate, (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (newPassword.length < 12) throw httpError(400, 'رمز عبور جدید باید حداقل ۱۲ نویسه داشته باشد');
    const account = db.prepare('SELECT password_hash FROM accounts WHERE user_id = ?').get(req.user.id);
    if (!account || !verifyPassword(currentPassword, account.password_hash)) throw httpError(400, 'رمز عبور فعلی نادرست است');
    db.prepare('UPDATE accounts SET password_hash = ?, failed_attempts = 0, locked_until = 0 WHERE user_id = ?').run(hashPassword(newPassword), req.user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').run(req.user.id, req.sessionHash);
    updateState(data => { audit(data, req.user.id, 'change_password', req.user.id, 'تغییر رمز عبور'); return null; });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.get('/api/state', authenticate, (req, res, next) => {
  try {
    const data = updateState(state => {
      const now = Date.now();
      state.requests = state.requests.map(request => request.status === 'checked_out' && new Date(request.neededUntil).getTime() < now ? {...request, status: 'overdue'} : request);
      return state;
    });
    res.json(data);
  } catch (error) { next(error); }
});

app.post('/api/requests', authenticate, (req, res, next) => {
  try {
    const result = updateState(data => {
      const {toolId, quantity = 1, purpose, neededUntil, priority = 'normal', emergencyReason} = req.body || {};
      const user = data.users.find(item => item.id === req.user.id);
      const tool = data.tools.find(item => item.id === toolId);
      const parsedQuantity = Number(quantity);
      if (!user || !tool || !String(purpose || '').trim() || !validFutureDate(neededUntil)) throw httpError(400, 'اطلاعات درخواست ناقص یا نامعتبر است');
      if (tool.trainingRequired && !user.training.includes(tool.category)) throw httpError(400, 'کاربر آموزش لازم برای این ابزار را ندارد');
      if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > tool.total) throw httpError(400, 'تعداد ابزار نامعتبر است');
      if (!['normal', 'urgent'].includes(priority)) throw httpError(400, 'اولویت درخواست نامعتبر است');
      if (priority === 'urgent' && !String(emergencyReason || '').trim()) throw httpError(400, 'علت درخواست اضطراری الزامی است');
      const available = tool.available - reserved(data, toolId) >= parsedQuantity;
      const request = {
        id: crypto.randomUUID(), requesterId: user.id, toolId, quantity: parsedQuantity,
        purpose: String(purpose).trim(), neededUntil: new Date(neededUntil).toISOString(), priority,
        emergencyReason: priority === 'urgent' ? String(emergencyReason).trim() : '',
        requestedAt: new Date().toISOString(), status: available ? 'ready' : 'queued', queuePosition: available ? 0 : 1
      };
      data.requests.push(request);
      queueRequests(data, toolId);
      audit(data, user.id, 'ثبت درخواست', request.id, tool.name);
      return request;
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

app.post('/api/requests/:id/action', authenticate, requireManager, (req, res, next) => {
  try {
    const result = updateState(data => {
      const request = data.requests.find(item => item.id === req.params.id);
      if (!request) throw httpError(404, 'درخواست یافت نشد');
      const tool = data.tools.find(item => item.id === request.toolId);
      const {action, condition = 'سالم', notes = ''} = req.body || {};
      const allowed = {approve: ['queued'], reject: ['queued'], checkout: ['ready'], return: ['checked_out', 'overdue']};
      if (!allowed[action]?.includes(request.status)) throw httpError(409, 'این اقدام برای وضعیت فعلی درخواست مجاز نیست');
      if (action === 'approve') {
        if (tool.available - reserved(data, request.toolId) < request.quantity) throw httpError(409, 'موجودی برای این درخواست هنوز آزاد نشده است');
        request.status = 'ready';
        request.approverId = req.user.id;
      }
      if (action === 'reject') request.status = 'rejected';
      if (action === 'checkout') {
        if (tool.available < request.quantity) throw httpError(409, 'موجودی کافی نیست');
        tool.available -= request.quantity;
        request.status = 'checked_out';
        request.checkedOutAt = new Date().toISOString();
      }
      if (action === 'return') {
        if (!['سالم', 'نیازمند بازرسی', 'آسیب‌دیده'].includes(condition)) throw httpError(400, 'وضعیت بازگشت معتبر نیست');
        request.returnedAt = new Date().toISOString();
        request.returnCondition = condition;
        request.returnNotes = String(notes).trim();
        request.status = condition === 'آسیب‌دیده' ? 'damaged' : 'returned';
        if (condition === 'سالم') tool.available = Math.min(tool.total, tool.available + request.quantity);
        else { tool.serviceCount += request.quantity; tool.condition = condition; }
      }
      request.queuePosition = 0;
      queueRequests(data, request.toolId);
      audit(data, req.user.id, action, request.id, String(notes).trim() || tool.name);
      return request;
    });
    res.json(result);
  } catch (error) { next(error); }
});

app.post('/api/tools/:id/service', authenticate, requireManager, (req, res, next) => {
  try {
    const result = updateState(data => {
      const tool = data.tools.find(item => item.id === req.params.id);
      if (!tool) throw httpError(404, 'ابزار یافت نشد');
      const quantity = Number(req.body?.quantity ?? 1);
      if (!Number.isInteger(quantity) || quantity < 1) throw httpError(400, 'تعداد نامعتبر است');
      if (tool.serviceCount < quantity) throw httpError(409, 'ابزاری در صف سرویس ثبت نشده است');
      tool.serviceCount -= quantity;
      tool.available = Math.min(tool.total, tool.available + quantity);
      tool.condition = tool.serviceCount ? 'نیازمند بازرسی' : 'سالم';
      audit(data, req.user.id, 'restore', tool.id, tool.name);
      return tool;
    });
    res.json(result);
  } catch (error) { next(error); }
});

app.get('/api/health', (req, res) => res.json({ok: true}));
app.get('/api/ready', (req, res) => {
  try { db.prepare('SELECT 1').get(); res.json({ok: true}); }
  catch { res.status(503).json({ok: false}); }
});
app.use('/api', (req, res) => res.status(404).json({error: 'مسیر API یافت نشد'}));

const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, {index: false, maxAge: isProduction ? '1h' : 0, setHeaders: (res, assetPath) => {
    if (assetPath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }}));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html'), {headers: {'Cache-Control': 'no-cache'}}));
}

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = Number(error.status) || (error.type === 'entity.too.large' ? 413 : 500);
  if (status >= 500) console.error(JSON.stringify({time: new Date().toISOString(), requestId: req.requestId, error: error.message, stack: error.stack}));
  res.status(status).json({error: status >= 500 ? 'خطای داخلی سرور رخ داد' : error.message});
});

function authenticate(req, res, next) {
  const token = parseCookies(req.headers.cookie).tm_session;
  if (!token) return res.status(401).json({error: 'ورود به سامانه الزامی است'});
  const hash = tokenHash(token);
  const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?').get(hash);
  if (!session || session.expires_at <= Date.now()) {
    if (session) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash);
    return res.status(401).json({error: 'نشست منقضی شده است'});
  }
  const user = currentState().users.find(item => item.id === session.user_id && item.active);
  if (!user) return res.status(401).json({error: 'حساب کاربری معتبر نیست'});
  req.user = user;
  req.sessionHash = hash;
  next();
}

function requireManager(req, res, next) {
  if (!['storekeeper', 'supervisor'].includes(req.user.role)) return res.status(403).json({error: 'این اقدام فقط برای انباردار یا سرپرست مجاز است'});
  next();
}

function currentState() { return JSON.parse(db.prepare('SELECT payload FROM app_state WHERE id = 1').get().payload); }
function updateState(change) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const data = currentState();
    const result = change(data);
    normalizeState(data);
    db.prepare('UPDATE app_state SET payload = ?, updated_at = ? WHERE id = 1').run(JSON.stringify(data), new Date().toISOString());
    db.exec('COMMIT');
    return result === data ? data : structuredClone(result);
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
function normalizeState(data) { for (const tool of data.tools) { tool.serviceCount ??= tool.condition === 'سالم' ? 0 : 1; tool.available = Math.max(0, Math.min(tool.total, tool.available)); } }
function queueRequests(data, toolId) { data.requests.filter(request => request.toolId === toolId && request.status === 'queued').sort((a, b) => (a.priority === 'urgent' ? 0 : 1) - (b.priority === 'urgent' ? 0 : 1) || new Date(a.requestedAt) - new Date(b.requestedAt)).forEach((request, index) => { request.queuePosition = index + 1; }); }
function reserved(data, toolId) { return data.requests.filter(request => request.toolId === toolId && request.status === 'ready').reduce((sum, request) => sum + request.quantity, 0); }
function audit(data, actorId, action, entity, detail) { data.audit.unshift({id: crypto.randomUUID(), actorId, action, entity, timestamp: new Date().toISOString(), detail}); data.audit = data.audit.slice(0, 1000); }
function hashPassword(password) { const salt = crypto.randomBytes(16); const hash = crypto.scryptSync(password, salt, 64); return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`; }
function verifyPassword(password, encoded) { const [algorithm, saltValue, hashValue] = String(encoded).split('$'); if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false; const expected = Buffer.from(hashValue, 'base64url'); const actual = crypto.scryptSync(password, Buffer.from(saltValue, 'base64url'), expected.length); return crypto.timingSafeEqual(actual, expected); }
function registerLoginFailure(ipKey, account) { const current = loginAttempts.get(ipKey) || {count: 0, blockedUntil: 0}; current.count += 1; if (current.count >= 10) current.blockedUntil = Date.now() + 15 * 60 * 1000; loginAttempts.set(ipKey, current); if (!account) return; const attempts = account.failed_attempts + 1; const lockedUntil = attempts >= 5 ? Date.now() + 15 * 60 * 1000 : 0; db.prepare('UPDATE accounts SET failed_attempts = ?, locked_until = ? WHERE user_id = ?').run(attempts >= 5 ? 0 : attempts, lockedUntil, account.user_id); }
function sessionCookie(value, maxAge) { return [`tm_session=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAge}`, cookieSecure ? 'Secure' : ''].filter(Boolean).join('; '); }
function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function publicUser(user) { const {training, ...safe} = user; return {...safe, training}; }
function parseCookies(header = '') { return Object.fromEntries(header.split(';').map(item => item.trim().split('=').map(decodeURIComponent)).filter(parts => parts.length === 2)); }
function positiveInteger(value, fallback) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback; }
function validFutureDate(value) { const timestamp = new Date(value).getTime(); return Number.isFinite(timestamp) && timestamp > Date.now(); }
function httpError(status, message) { return Object.assign(new Error(message), {status}); }
function readLegacyState() {
  if (!fs.existsSync(legacyDataPath) || process.env.NODE_ENV === 'test') return null;
  try {
    const legacy = JSON.parse(fs.readFileSync(legacyDataPath, 'utf8'));
    if (!['users', 'tools', 'requests', 'audit'].every(key => Array.isArray(legacy[key]))) return null;
    const usernames = Object.fromEntries(seed.users.map(user => [user.id, user.username]));
    legacy.users = legacy.users.map(user => ({...user, username: user.username || usernames[user.id] || user.id}));
    return legacy;
  } catch { return null; }
}

export function resetForTests(data = seed) {
  if (process.env.NODE_ENV !== 'test') throw new Error('resetForTests is test-only');
  db.prepare('UPDATE app_state SET payload = ?, updated_at = ? WHERE id = 1').run(JSON.stringify(data), new Date().toISOString());
  db.exec('DELETE FROM sessions; UPDATE accounts SET failed_attempts = 0, locked_until = 0;');
}
export function closeDatabase() { db.close(); }
export {app};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = app.listen(port, host, () => console.log(`ToolManager listening on http://${host}:${port}`));
  let closing = false;
  const shutdown = signal => {
    if (closing) return;
    closing = true;
    console.log(`${signal} received, shutting down`);
    server.close(() => { closeDatabase(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
