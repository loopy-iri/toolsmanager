<script setup>
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import {
  Activity, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Bell, Boxes, CalendarClock,
  Check, CircleCheck, ClipboardCheck, ClipboardList, Clock3, HardHat,
  History, KeyRound, LayoutDashboard, LockKeyhole, LogOut, Menu, Package, PackageCheck, Plus, RefreshCw, RotateCcw,
  Search, ShieldCheck, SlidersHorizontal, TriangleAlert, UserRound, Wrench, X
} from 'lucide-vue-next'

const api = '/api'
const state = ref({users: [], tools: [], requests: [], audit: []})
const view = ref(window.location.hash.replace('#', '') || 'dashboard')
const mobile = ref(false)
const loading = ref(true)
const error = ref('')
const query = ref('')
const toast = ref({message: '', tone: 'success'})
const sessionUser = ref(null)
const authLoading = ref(true)
const loginPending = ref(false)
const loginError = ref('')
const loginForm = ref({username: '', password: ''})
const actionPending = ref('')
const requestDialog = ref(null)
const returnDialog = ref(null)
const passwordDialog = ref(null)
const requestError = ref('')
const returnError = ref('')
const serviceError = ref('')
const passwordError = ref('')
const requestTrigger = ref(null)
const form = ref({toolId: 't1', quantity: 1, purpose: '', neededUntil: '', priority: 'normal', emergencyReason: ''})
const returnForm = ref({requestId: '', condition: 'سالم', notes: ''})
const passwordForm = ref({currentPassword: '', newPassword: '', confirmation: ''})
const filters = ref({toolCategory: 'all', toolCondition: 'all', requestStatus: 'all', requestPriority: 'all'})
const hashHandler = () => { view.value = window.location.hash.replace('#', '') || 'dashboard' }

const roleLabel = {technician: 'تکنسین', storekeeper: 'انباردار', supervisor: 'سرپرست'}
const statusLabel = {queued: 'در صف انتظار', ready: 'آماده تحویل', checked_out: 'تحویل شده', returned: 'بازگشت شده', overdue: 'معوق', damaged: 'آسیب‌دیده', rejected: 'رد شده'}
const actionLabel = {approve: 'تایید درخواست', checkout: 'ثبت تحویل', return: 'ثبت بازگشت', reject: 'رد درخواست', restore: 'بازگشت به سرویس'}
const conditionLabel = {سالم: 'سالم', 'نیازمند بازرسی': 'نیازمند بازرسی', 'آسیب‌دیده': 'آسیب‌دیده'}
const activityLabel = {approve: 'تایید درخواست', checkout: 'تحویل ابزار', return: 'ثبت بازگشت', reject: 'رد درخواست', restore: 'بازگشت ابزار به سرویس', change_password: 'تغییر رمز عبور', 'ثبت درخواست': 'ثبت درخواست'}

const userMap = computed(() => Object.fromEntries(state.value.users.map(user => [user.id, user])))
const toolMap = computed(() => Object.fromEntries(state.value.tools.map(tool => [tool.id, tool])))
const currentUser = computed(() => userMap.value[sessionUser.value?.id] || sessionUser.value || {})
const canManage = computed(() => ['storekeeper', 'supervisor'].includes(currentUser.value.role))
const categories = computed(() => [...new Set(state.value.tools.map(tool => tool.category))])
const filteredTools = computed(() => state.value.tools.filter(tool => {
  const text = `${tool.name} ${tool.code} ${tool.category} ${tool.location}`.toLowerCase()
  const matchesQuery = !query.value || text.includes(query.value.toLowerCase())
  const matchesCategory = filters.value.toolCategory === 'all' || tool.category === filters.value.toolCategory
  const matchesCondition = filters.value.toolCondition === 'all' || tool.condition === filters.value.toolCondition
  return matchesQuery && matchesCategory && matchesCondition
}))
const filteredRequests = computed(() => state.value.requests.filter(request => {
  const tool = toolMap.value[request.toolId]
  const user = userMap.value[request.requesterId]
  const text = `${tool?.name || ''} ${user?.name || ''} ${request.purpose || ''}`.toLowerCase()
  return (!query.value || text.includes(query.value.toLowerCase())) &&
    (filters.value.requestStatus === 'all' || request.status === filters.value.requestStatus) &&
    (filters.value.requestPriority === 'all' || request.priority === filters.value.requestPriority)
}))
const queue = computed(() => state.value.requests.filter(request => ['queued', 'ready', 'checked_out', 'overdue'].includes(request.status)).sort((a, b) => {
  const priority = (a.priority === 'urgent' ? 0 : 1) - (b.priority === 'urgent' ? 0 : 1)
  return priority || new Date(a.requestedAt) - new Date(b.requestedAt)
}))
const overdue = computed(() => state.value.requests.filter(request => request.status === 'overdue'))
const active = computed(() => state.value.requests.filter(request => ['checked_out', 'overdue'].includes(request.status)))
const ready = computed(() => state.value.requests.filter(request => request.status === 'ready'))
const serviceTools = computed(() => state.value.tools.filter(tool => tool.serviceCount > 0 || tool.condition !== 'سالم'))
const availableUnits = computed(() => state.value.tools.reduce((sum, tool) => sum + tool.available, 0))
const totalUnits = computed(() => state.value.tools.reduce((sum, tool) => sum + tool.total, 0))
const todayLabel = computed(() => new Intl.DateTimeFormat('fa-IR', {weekday: 'long', month: 'long', day: 'numeric'}).format(new Date()))

function setView(next) { view.value = next; window.location.hash = next; mobile.value = false; query.value = '' }
function formatDate(value) { return value ? new Date(value).toLocaleString('fa-IR', {dateStyle: 'short', timeStyle: 'short'}) : '—' }
function relativeDue(request) {
  const diff = new Date(request.neededUntil).getTime() - Date.now()
  if (request.status === 'overdue' || diff < 0) return 'از موعد گذشته'
  const hours = Math.round(diff / 3600000)
  return hours < 24 ? `${Math.max(hours, 1)} ساعت مانده` : `${Math.round(hours / 24)} روز مانده`
}
function showToast(message, tone = 'success') {
  toast.value = {message, tone}
  window.clearTimeout(showToast.timer)
  showToast.timer = window.setTimeout(() => { toast.value = {message: '', tone: 'success'} }, 4000)
}
function isEligible(tool) { return !tool?.trainingRequired || currentUser.value.training?.includes(tool.category) }
function openRequest() {
  requestError.value = ''
  requestTrigger.value = document.activeElement
  form.value = {...form.value, purpose: '', emergencyReason: ''}
  requestDialog.value?.showModal()
  nextTick(() => requestDialog.value?.querySelector('select')?.focus())
}
function closeRequest() { requestDialog.value?.close() }
function openReturn(request) {
  returnError.value = ''
  returnForm.value = {requestId: request.id, condition: 'سالم', notes: ''}
  returnDialog.value?.showModal()
  nextTick(() => returnDialog.value?.querySelector('select')?.focus())
}
function closeReturn() { returnDialog.value?.close() }
function openPassword() { passwordError.value = ''; passwordForm.value = {currentPassword: '', newPassword: '', confirmation: ''}; passwordDialog.value?.showModal(); nextTick(() => passwordDialog.value?.querySelector('input')?.focus()) }
function closePassword() { passwordDialog.value?.close() }
function onDialogClose(dialogType) {
  if (dialogType === 'request') { requestError.value = ''; nextTick(() => requestTrigger.value?.focus?.()) }
  if (dialogType === 'return') { returnError.value = '' }
  if (dialogType === 'password') { passwordError.value = '' }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(`${api}/state`)
    if (response.status === 401) { sessionUser.value = null; throw new Error('auth') }
    if (!response.ok) throw new Error('state')
    state.value = await response.json()
  } catch (loadError) { if (loadError.message !== 'auth') error.value = 'اطلاعات از سرور دریافت نشد. اتصال و سرویس API را بررسی کنید.' }
  finally { loading.value = false }
}
async function runAction(id, action, extra = {}) {
  if (action === 'reject' && !window.confirm('این درخواست رد شود؟')) return
  actionPending.value = `${action}:${id}`
  try {
    const response = await fetch(`${api}/requests/${id}/action`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action, ...extra})})
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'عملیات انجام نشد')
    showToast(actionLabel[action] || 'عملیات انجام شد')
    await load()
  } catch (requestErrorValue) { showToast(requestErrorValue.message, 'error') }
  finally { actionPending.value = '' }
}
async function submitRequest() {
  requestError.value = ''
  if (!isEligible(toolMap.value[form.value.toolId])) { requestError.value = 'شما آموزش لازم برای دسته‌بندی ابزار انتخاب‌شده را ندارید.'; return }
  actionPending.value = 'request'
  try {
    const response = await fetch(`${api}/requests`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(form.value)})
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'درخواست ثبت نشد')
    closeRequest(); showToast('درخواست در صف عملیات ثبت شد'); await load()
  } catch (requestErrorValue) { requestError.value = requestErrorValue.message }
  finally { actionPending.value = '' }
}
async function submitReturn() {
  returnError.value = ''
  actionPending.value = `return:${returnForm.value.requestId}`
  try {
    const response = await fetch(`${api}/requests/${returnForm.value.requestId}/action`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'return', condition: returnForm.value.condition, notes: returnForm.value.notes})})
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'بازگشت ثبت نشد')
    closeReturn(); showToast(returnForm.value.condition === 'سالم' ? 'بازگشت سالم ثبت شد' : 'ابزار به صف بازرسی منتقل شد'); await load()
  } catch (requestErrorValue) { returnError.value = requestErrorValue.message }
  finally { actionPending.value = '' }
}
async function restoreTool(tool) {
  serviceError.value = ''
  actionPending.value = `restore:${tool.id}`
  try {
    const response = await fetch(`${api}/tools/${tool.id}/service`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({quantity: 1})})
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'بازگشت به سرویس انجام نشد')
    showToast('ابزار دوباره قابل تحویل شد'); await load()
  } catch (requestErrorValue) { serviceError.value = requestErrorValue.message; showToast(requestErrorValue.message, 'error') }
  finally { actionPending.value = '' }
}
async function changePassword() {
  passwordError.value = ''
  if (passwordForm.value.newPassword !== passwordForm.value.confirmation) { passwordError.value = 'تکرار رمز عبور با رمز جدید یکسان نیست.'; return }
  actionPending.value = 'password'
  try {
    const response = await fetch(`${api}/auth/password`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(passwordForm.value)})
    if (!response.ok) { const result = await response.json(); throw new Error(result.error || 'تغییر رمز انجام نشد') }
    closePassword(); showToast('رمز عبور با موفقیت تغییر کرد')
  } catch (passwordFailure) { passwordError.value = passwordFailure.message }
  finally { actionPending.value = '' }
}
function statusClass(value) { return `status-${value}` }
function activityText(event) { return activityLabel[event.action] || event.action }
function actorName(event) { return userMap.value[event.actorId]?.name || 'سیستم' }

watch(currentUser, () => {
  const selected = toolMap.value[form.value.toolId]
  if (selected && !isEligible(selected)) form.value.toolId = state.value.tools.find(tool => isEligible(tool))?.id || ''
})
async function bootstrap() {
  authLoading.value = true
  try {
    const response = await fetch(`${api}/auth/me`)
    if (response.ok) { sessionUser.value = (await response.json()).user; await load() }
  } catch { loginError.value = 'ارتباط با سرور برقرار نشد.' }
  finally { authLoading.value = false }
}
async function login() {
  loginPending.value = true
  loginError.value = ''
  try {
    const response = await fetch(`${api}/auth/login`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(loginForm.value)})
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'ورود انجام نشد')
    sessionUser.value = result.user
    loginForm.value.password = ''
    await load()
  } catch (loginFailure) { loginError.value = loginFailure.message }
  finally { loginPending.value = false }
}
async function logout() {
  try { await fetch(`${api}/auth/logout`, {method: 'POST'}) } finally {
    sessionUser.value = null
    state.value = {users: [], tools: [], requests: [], audit: []}
    mobile.value = false
  }
}
onMounted(() => { window.addEventListener('hashchange', hashHandler); bootstrap() })
onUnmounted(() => window.removeEventListener('hashchange', hashHandler))
</script>

<template>
  <div v-if="authLoading" class="auth-screen" dir="rtl" aria-live="polite">
    <div class="auth-loading"><div class="brand-mark" aria-hidden="true">TM</div><span>در حال بررسی نشست امن...</span></div>
  </div>
  <main v-else-if="!sessionUser" class="auth-screen" dir="rtl">
    <section class="login-panel" aria-labelledby="login-title">
      <div class="login-brand"><div class="brand-mark" aria-hidden="true">TM</div><div><strong>ToolManager</strong><span>مرکز عملیات ابزار</span></div></div>
      <div class="login-heading"><span class="section-kicker">SECURE ACCESS</span><h1 id="login-title">ورود به سامانه</h1><p>برای مشاهده موجودی و ثبت یا مدیریت درخواست‌ها وارد شوید.</p></div>
      <div v-if="loginError" class="form-error" role="alert"><TriangleAlert aria-hidden="true"/><span>{{loginError}}</span></div>
      <form class="login-form" @submit.prevent="login">
        <label class="form-field"><span>نام کاربری</span><input v-model.trim="loginForm.username" name="username" autocomplete="username" inputmode="text" required autofocus/></label>
        <label class="form-field"><span>رمز عبور</span><input v-model="loginForm.password" name="password" type="password" autocomplete="current-password" required/></label>
        <button class="primary-action login-submit" :disabled="loginPending"><RefreshCw v-if="loginPending" class="spin" aria-hidden="true"/><LockKeyhole v-else aria-hidden="true"/>ورود امن</button>
      </form>
      <p class="login-footnote"><ShieldCheck aria-hidden="true"/>نشست شما روی این دستگاه و با کوکی امن نگه‌داری می‌شود.</p>
    </section>
  </main>
  <div v-else class="app-shell" dir="rtl">
    <a class="skip-link" href="#main-content">پرش به محتوای اصلی</a>
    <div v-if="mobile" class="nav-scrim" @click="mobile=false"></div>
    <aside class="sidebar" :class="{open: mobile}" aria-label="ناوبری اصلی">
      <div class="brand-lockup">
        <div class="brand-mark" aria-hidden="true">TM</div>
        <div><strong>ToolManager</strong><span>مرکز عملیات ابزار</span></div>
      </div>
      <div class="workspace-context">
        <span class="context-label">در حال کار به‌عنوان</span>
        <div class="context-user"><UserRound aria-hidden="true"/><strong>{{currentUser.name}}</strong></div>
        <small>{{roleLabel[currentUser.role] || 'کاربر'}}, {{currentUser.team}}</small>
        <button class="sidebar-link" @click="openPassword"><KeyRound aria-hidden="true"/>تغییر رمز عبور</button>
      </div>
      <nav class="primary-nav">
        <button :class="{active:view==='dashboard'}" :aria-current="view==='dashboard'?'page':undefined" @click="setView('dashboard')"><LayoutDashboard aria-hidden="true"/>داشبورد<span v-if="overdue.length" class="nav-badge">{{overdue.length}}</span></button>
        <button :class="{active:view==='inventory'}" :aria-current="view==='inventory'?'page':undefined" @click="setView('inventory')"><Boxes aria-hidden="true"/>موجودی ابزار</button>
        <button :class="{active:view==='requests'}" :aria-current="view==='requests'?'page':undefined" @click="setView('requests')"><ClipboardList aria-hidden="true"/>درخواست‌ها<span v-if="ready.length" class="nav-badge muted">{{ready.length}}</span></button>
      </nav>
      <div class="sidebar-footer"><div><span class="live-dot"></span><span>سرویس آنلاین</span></div><small>همگام‌سازی {{todayLabel}}</small></div>
    </aside>

    <main id="main-content" class="main-content">
      <header class="topbar">
        <button class="icon-button mobile-menu" aria-label="باز کردن منو" @click="mobile=!mobile"><Menu aria-hidden="true"/></button>
        <div class="page-heading"><span class="eyebrow">مرکز کنترل عملیات · {{todayLabel}}</span><h1>{{view==='dashboard'?'داشبورد عملیاتی':view==='inventory'?'موجودی و وضعیت ابزار':'صف و تاریخچه درخواست‌ها'}}</h1></div>
        <div class="topbar-actions"><span class="system-state"><span class="live-dot"></span> API متصل</span><button class="primary-action" aria-label="درخواست جدید" title="درخواست جدید" @click="openRequest"><Plus aria-hidden="true"/>درخواست جدید</button><button class="icon-button" aria-label="خروج از سامانه" title="خروج از سامانه" @click="logout"><LogOut aria-hidden="true"/></button></div>
      </header>

      <div v-if="error" class="error-banner" role="alert"><TriangleAlert aria-hidden="true"/><span>{{error}}</span><button class="text-button" @click="load">تلاش دوباره</button></div>
      <div v-if="loading" class="loading-state" aria-live="polite"><div class="loading-line wide"></div><div class="loading-line"></div><div class="loading-line short"></div></div>

      <template v-else>
        <section v-if="view==='dashboard'" aria-labelledby="dashboard-title">
          <h2 id="dashboard-title" class="sr-only">نمای کلی عملیات ابزار</h2>
          <div class="metric-strip" aria-label="شاخص‌های عملیات">
            <div class="metric"><span class="metric-icon teal"><PackageCheck aria-hidden="true"/></span><div><span>قابل تحویل</span><strong>{{availableUnits}}</strong><small>از {{totalUnits}} واحد</small></div></div>
            <div class="metric"><span class="metric-icon blue"><ClipboardCheck aria-hidden="true"/></span><div><span>در گردش</span><strong>{{active.length}}</strong><small>تحویل فعال و معوق</small></div></div>
            <div class="metric"><span class="metric-icon amber"><Clock3 aria-hidden="true"/></span><div><span>نیازمند پیگیری</span><strong>{{overdue.length}}</strong><small>تحویل معوق</small></div></div>
            <div class="metric"><span class="metric-icon red"><Wrench aria-hidden="true"/></span><div><span>صف سرویس</span><strong>{{serviceTools.reduce((sum,tool)=>sum+tool.serviceCount,0)}}</strong><small>واحد خارج از سرویس</small></div></div>
          </div>

          <div class="dashboard-grid">
            <section class="workspace-panel queue-panel">
              <div class="panel-heading"><div><span class="section-kicker">WORK QUEUE</span><h2>صف اقدام امروز</h2><p>درخواست‌های اضطراری و قدیمی‌تر در اولویت نمایش هستند.</p></div><button class="text-button" @click="setView('requests')">مشاهده همه <span aria-hidden="true">←</span></button></div>
              <div v-if="!queue.length" class="empty-state"><ClipboardCheck aria-hidden="true"/><strong>صف عملیاتی خالی است</strong><span>درخواست جدیدی برای اقدام وجود ندارد.</span></div>
              <div v-for="request in queue.slice(0,6)" :key="request.id" class="queue-row">
                <div class="queue-priority" :class="request.priority"><span class="priority-dot"></span>{{request.priority==='urgent'?'اضطراری':'عادی'}}</div>
                <div class="queue-main"><strong>{{toolMap[request.toolId]?.name}}</strong><span>{{userMap[request.requesterId]?.name}} · {{request.quantity}} واحد · {{request.purpose}}</span></div>
                <div class="queue-due" :class="{late:request.status==='overdue'}"><CalendarClock aria-hidden="true"/><span>{{relativeDue(request)}}</span><small>{{formatDate(request.neededUntil)}}</small></div>
                <span class="status-chip" :class="statusClass(request.status)">{{statusLabel[request.status]}}</span>
                <div class="row-actions">
                  <button v-if="request.status==='ready' && canManage" class="action-button primary-soft" :disabled="actionPending===`checkout:${request.id}`" @click="runAction(request.id,'checkout')"><ArrowDownToLine aria-hidden="true"/>تحویل</button>
                  <button v-if="['checked_out','overdue'].includes(request.status) && canManage" class="action-button secondary-soft" @click="openReturn(request)"><ArrowUpFromLine aria-hidden="true"/>بازگشت</button>
                  <button v-if="request.status==='queued' && canManage" class="icon-button" :aria-label="`تایید درخواست ${toolMap[request.toolId]?.name}`" :disabled="actionPending===`approve:${request.id}`" @click="runAction(request.id,'approve')"><Check aria-hidden="true"/></button>
                  <button v-if="request.status==='queued' && canManage" class="icon-button danger-icon" :aria-label="`رد درخواست ${toolMap[request.toolId]?.name}`" @click="runAction(request.id,'reject')"><X aria-hidden="true"/></button>
                </div>
              </div>
            </section>

            <div class="side-stack">
              <section class="workspace-panel alert-panel">
                <div class="panel-heading compact"><div><span class="section-kicker">ATTENTION</span><h2>نیازمند اقدام</h2></div><Bell class="panel-icon amber" aria-hidden="true"/></div>
                <div v-if="!overdue.length && !serviceTools.length" class="empty-state compact-empty"><CircleCheck aria-hidden="true"/><span>مورد فوری وجود ندارد.</span></div>
                <div v-for="request in overdue.slice(0,2)" :key="`late-${request.id}`" class="alert-line"><AlertTriangle aria-hidden="true"/><div><strong>{{toolMap[request.toolId]?.name}}</strong><span>تحویل {{userMap[request.requesterId]?.name}} معوق شده</span></div><span class="alert-tag">معوق</span></div>
                <div v-for="tool in serviceTools.slice(0,2)" :key="`service-${tool.id}`" class="alert-line"><Wrench aria-hidden="true"/><div><strong>{{tool.name}}</strong><span>{{tool.serviceCount}} واحد در صف بازرسی</span></div><button v-if="canManage" class="text-button small" @click="setView('inventory')">بررسی</button></div>
              </section>
              <section class="workspace-panel activity-panel">
                <div class="panel-heading compact"><div><span class="section-kicker">AUDIT TRAIL</span><h2>آخرین فعالیت</h2></div><History class="panel-icon" aria-hidden="true"/></div>
                <div v-for="event in state.audit.slice(0,4)" :key="event.id" class="activity-line"><span class="activity-marker"></span><div><strong>{{activityText(event)}}</strong><span>{{actorName(event)}} · {{event.detail}}</span></div><time>{{formatDate(event.timestamp)}}</time></div>
              </section>
            </div>
          </div>

          <section class="workspace-panel inventory-overview">
            <div class="panel-heading"><div><span class="section-kicker">INVENTORY SNAPSHOT</span><h2>وضعیت موجودی</h2><p>کاهش موجودی یا صف سرویس را قبل از اقدام بعدی ببینید.</p></div><button class="text-button" @click="setView('inventory')">مدیریت موجودی <span aria-hidden="true">←</span></button></div>
            <div class="inventory-grid"><div v-for="tool in state.tools" :key="tool.id" class="inventory-item"><div class="tool-symbol"><Package aria-hidden="true"/></div><div class="inventory-copy"><div><strong>{{tool.name}}</strong><span class="status-chip" :class="tool.condition==='سالم'?'status-healthy':'status-damaged'">{{conditionLabel[tool.condition]}}</span></div><small>{{tool.code}} · {{tool.location}}</small><div class="availability-track"><span :style="{width:`${(tool.available/tool.total)*100}%`}"></span></div><small>{{tool.available}} از {{tool.total}} آزاد · {{tool.serviceCount || 0}} سرویس</small></div></div></div>
          </section>
        </section>

        <section v-else-if="view==='inventory'" class="page-section" aria-labelledby="inventory-title">
          <div class="page-toolbar"><div><span class="section-kicker">ASSET REGISTER</span><h2 id="inventory-title">موجودی و وضعیت ابزار</h2><p>موجودی قابل تحویل، آموزش و واحدهای خارج از سرویس را کنترل کنید.</p></div><button class="secondary-action" @click="load"><RefreshCw aria-hidden="true"/>به‌روزرسانی</button></div>
          <div class="filter-bar"><label class="search-field"><Search aria-hidden="true"/><span class="sr-only">جست‌وجوی ابزار</span><input v-model="query" placeholder="نام، کد، دسته یا محل"/></label><label class="filter-field"><span>دسته‌بندی</span><select v-model="filters.toolCategory"><option value="all">همه دسته‌ها</option><option v-for="category in categories" :key="category" :value="category">{{category}}</option></select></label><label class="filter-field"><span>وضعیت</span><select v-model="filters.toolCondition"><option value="all">همه وضعیت‌ها</option><option value="سالم">سالم</option><option value="نیازمند بازرسی">نیازمند بازرسی</option><option value="آسیب‌دیده">آسیب‌دیده</option></select></label><span class="result-count">{{filteredTools.length}} ابزار</span></div>
          <div v-if="serviceError" class="inline-error" role="alert">{{serviceError}}</div>
          <div class="data-table-wrap"><table class="data-table"><thead><tr><th>ابزار</th><th>دسته</th><th>موجودی</th><th>محل</th><th>وضعیت</th><th>آموزش</th><th>اقدام</th></tr></thead><tbody><tr v-for="tool in filteredTools" :key="tool.id"><td><div class="table-primary"><span class="tool-symbol small"><Package aria-hidden="true"/></span><div><strong>{{tool.name}}</strong><small>{{tool.code}}</small></div></div></td><td>{{tool.category}}</td><td><strong>{{tool.available}}</strong> / {{tool.total}} آزاد<small v-if="tool.serviceCount">{{tool.serviceCount}} واحد در سرویس</small></td><td>{{tool.location}}</td><td><span class="status-chip" :class="tool.condition==='سالم'?'status-healthy':'status-damaged'">{{tool.condition}}</span></td><td><span v-if="tool.trainingRequired" class="training-label"><ShieldCheck aria-hidden="true"/>لازم</span><span v-else class="muted-label">آزاد</span></td><td><button v-if="canManage && tool.serviceCount" class="action-button secondary-soft" :disabled="actionPending===`restore:${tool.id}`" @click="restoreTool(tool)"><RotateCcw aria-hidden="true"/>بازگشت به سرویس</button><span v-else class="muted-label">بدون اقدام</span></td></tr></tbody></table></div>
          <div v-if="!filteredTools.length" class="empty-state page-empty"><Search aria-hidden="true"/><strong>نتیجه‌ای پیدا نشد</strong><span>فیلترها یا عبارت جست‌وجو را تغییر دهید.</span></div>
        </section>

        <section v-else class="page-section" aria-labelledby="requests-title">
          <div class="page-toolbar"><div><span class="section-kicker">REQUEST CONTROL</span><h2 id="requests-title">صف و تاریخچه درخواست‌ها</h2><p>یک نمای واحد برای تایید، تحویل، بازگشت و پیگیری موعدها.</p></div><button class="primary-action" @click="openRequest"><Plus aria-hidden="true"/>درخواست جدید</button></div>
          <div class="filter-bar"><label class="search-field"><Search aria-hidden="true"/><span class="sr-only">جست‌وجوی درخواست</span><input v-model="query" placeholder="ابزار، درخواست‌کننده یا شرح کار"/></label><label class="filter-field"><span>وضعیت</span><select v-model="filters.requestStatus"><option value="all">همه وضعیت‌ها</option><option v-for="(label,key) in statusLabel" :key="key" :value="key">{{label}}</option></select></label><label class="filter-field"><span>اولویت</span><select v-model="filters.requestPriority"><option value="all">همه اولویت‌ها</option><option value="urgent">اضطراری</option><option value="normal">عادی</option></select></label><span class="result-count">{{filteredRequests.length}} درخواست</span></div>
          <div class="data-table-wrap"><table class="data-table requests-table"><thead><tr><th>درخواست</th><th>درخواست‌کننده</th><th>اولویت</th><th>موعد</th><th>وضعیت</th><th>اقدام</th></tr></thead><tbody><tr v-for="request in filteredRequests" :key="request.id"><td><div class="table-primary"><span class="tool-symbol small"><ClipboardList aria-hidden="true"/></span><div><strong>{{toolMap[request.toolId]?.name}}</strong><small>{{request.purpose}}</small></div></div></td><td>{{userMap[request.requesterId]?.name}}<small>{{request.quantity}} واحد</small></td><td><span class="priority-label" :class="request.priority"><span class="priority-dot"></span>{{request.priority==='urgent'?'اضطراری':'عادی'}}</span></td><td><span :class="{late:request.status==='overdue'}">{{formatDate(request.neededUntil)}}</span><small>{{relativeDue(request)}}</small></td><td><span class="status-chip" :class="statusClass(request.status)">{{statusLabel[request.status]}}</span></td><td><div class="table-actions"><button v-if="request.status==='ready' && canManage" class="action-button primary-soft" @click="runAction(request.id,'checkout')"><ArrowDownToLine aria-hidden="true"/>تحویل</button><button v-if="['checked_out','overdue'].includes(request.status) && canManage" class="action-button secondary-soft" @click="openReturn(request)"><ArrowUpFromLine aria-hidden="true"/>بازگشت</button><button v-if="request.status==='queued' && canManage" class="icon-button" :aria-label="`تایید ${toolMap[request.toolId]?.name}`" @click="runAction(request.id,'approve')"><Check aria-hidden="true"/></button><button v-if="request.status==='queued' && canManage" class="icon-button danger-icon" :aria-label="`رد ${toolMap[request.toolId]?.name}`" @click="runAction(request.id,'reject')"><X aria-hidden="true"/></button></div></td></tr></tbody></table></div>
          <div v-if="!filteredRequests.length" class="empty-state page-empty"><ClipboardList aria-hidden="true"/><strong>درخواستی با این فیلتر پیدا نشد</strong><span>فیلترها را پاک کنید یا درخواست جدید بسازید.</span></div>
        </section>
      </template>
    </main>

    <dialog ref="requestDialog" class="modal-dialog" aria-labelledby="request-dialog-title" @close="onDialogClose('request')"><form class="modal-form" @submit.prevent="submitRequest"><div class="modal-header"><div><span class="section-kicker">NEW REQUEST</span><h2 id="request-dialog-title">ثبت درخواست ابزار</h2></div><button type="button" class="icon-button" aria-label="بستن پنجره" @click="closeRequest"><X aria-hidden="true"/></button></div><div v-if="requestError" class="form-error" role="alert"><TriangleAlert aria-hidden="true"/><span>{{requestError}}</span></div><div class="requester-context"><UserRound aria-hidden="true"/><div><span>درخواست‌کننده</span><strong>{{currentUser.name}} · {{roleLabel[currentUser.role]}}</strong></div></div><div class="form-grid"><label class="form-field"><span>ابزار <b>*</b></span><select v-model="form.toolId" required><option v-for="tool in state.tools" :key="tool.id" :value="tool.id" :disabled="!isEligible(tool)">{{tool.name}} · {{tool.available}} آزاد{{!isEligible(tool)?' · آموزش لازم':''}}</option></select><small v-if="toolMap[form.toolId] && !isEligible(toolMap[form.toolId])" class="field-help danger-text">شما آموزش این دسته را ندارید.</small></label><label class="form-field"><span>تعداد <b>*</b></span><input v-model.number="form.quantity" type="number" min="1" :max="toolMap[form.toolId]?.total || 1" required/></label><label class="form-field"><span>نیاز تا <b>*</b></span><input v-model="form.neededUntil" type="datetime-local" required/></label></div><label class="form-field"><span>شرح کاربرد <b>*</b></span><textarea v-model.trim="form.purpose" rows="3" required placeholder="مثلاً تعویض موتور پمپ خط ۲"></textarea><small class="field-help">شرح کوتاه باعث می‌شود انباردار درخواست را سریع‌تر بررسی کند.</small></label><fieldset class="priority-field"><legend>اولویت درخواست</legend><label :class="['priority-option',{selected:form.priority==='normal'}]"><input v-model="form.priority" type="radio" value="normal"/> <span><strong>عادی</strong><small>طبق نوبت صف</small></span></label><label :class="['priority-option',{selected:form.priority==='urgent'}]"><input v-model="form.priority" type="radio" value="urgent"/> <span><strong>اضطراری</strong><small>با علت توقف یا ریسک ایمنی</small></span></label></fieldset><label v-if="form.priority==='urgent'" class="form-field"><span>علت اضطرار <b>*</b></span><textarea v-model.trim="form.emergencyReason" rows="2" required placeholder="مثلاً توقف خط تولید"></textarea></label><div class="modal-actions"><button type="button" class="secondary-action" @click="closeRequest">انصراف</button><button class="primary-action" :disabled="actionPending==='request'"><RefreshCw v-if="actionPending==='request'" class="spin" aria-hidden="true"/><Plus v-else aria-hidden="true"/>ثبت درخواست</button></div></form></dialog>

    <dialog ref="returnDialog" class="modal-dialog narrow-dialog" aria-labelledby="return-dialog-title" @close="onDialogClose('return')"><form class="modal-form" @submit.prevent="submitReturn"><div class="modal-header"><div><span class="section-kicker">RETURN CHECK</span><h2 id="return-dialog-title">ثبت بازگشت و بازرسی</h2></div><button type="button" class="icon-button" aria-label="بستن پنجره" @click="closeReturn"><X aria-hidden="true"/></button></div><div v-if="returnError" class="form-error" role="alert"><TriangleAlert aria-hidden="true"/><span>{{returnError}}</span></div><p class="return-context">{{toolMap[state.requests.find(request=>request.id===returnForm.requestId)?.toolId]?.name}} · {{userMap[state.requests.find(request=>request.id===returnForm.requestId)?.requesterId]?.name}}</p><fieldset class="condition-field"><legend>وضعیت ابزار پس از بازگشت</legend><label v-for="(label,key) in conditionLabel" :key="key" :class="['condition-option',key==='سالم'?'healthy':'needs-check',{selected:returnForm.condition===key}]"><input v-model="returnForm.condition" type="radio" :value="key"/><span><strong>{{label}}</strong><small>{{key==='سالم'?'قابل تحویل بعدی':'ورود به صف بازرسی'}}</small></span></label></fieldset><label class="form-field"><span>یادداشت بازرسی</span><textarea v-model.trim="returnForm.notes" rows="3" placeholder="ترک بدنه، صدای غیرعادی یا توضیح وضعیت"></textarea></label><div class="modal-actions"><button type="button" class="secondary-action" @click="closeReturn">انصراف</button><button class="primary-action" :disabled="actionPending===`return:${returnForm.requestId}`"><RefreshCw v-if="actionPending===`return:${returnForm.requestId}`" class="spin" aria-hidden="true"/><Check v-else aria-hidden="true"/>ثبت بازگشت</button></div></form></dialog>

    <dialog ref="passwordDialog" class="modal-dialog narrow-dialog" aria-labelledby="password-dialog-title" @close="onDialogClose('password')"><form class="modal-form" @submit.prevent="changePassword"><div class="modal-header"><div><span class="section-kicker">ACCOUNT SECURITY</span><h2 id="password-dialog-title">تغییر رمز عبور</h2></div><button type="button" class="icon-button" aria-label="بستن پنجره" @click="closePassword"><X aria-hidden="true"/></button></div><div v-if="passwordError" class="form-error" role="alert"><TriangleAlert aria-hidden="true"/><span>{{passwordError}}</span></div><label class="form-field"><span>رمز عبور فعلی <b>*</b></span><input v-model="passwordForm.currentPassword" type="password" autocomplete="current-password" required/></label><label class="form-field"><span>رمز عبور جدید <b>*</b></span><input v-model="passwordForm.newPassword" type="password" autocomplete="new-password" minlength="12" required/><small class="field-help">حداقل ۱۲ نویسه؛ استفاده از مدیر رمز عبور پیشنهاد می‌شود.</small></label><label class="form-field"><span>تکرار رمز عبور جدید <b>*</b></span><input v-model="passwordForm.confirmation" type="password" autocomplete="new-password" minlength="12" required/></label><div class="modal-actions"><button type="button" class="secondary-action" @click="closePassword">انصراف</button><button class="primary-action" :disabled="actionPending==='password'"><RefreshCw v-if="actionPending==='password'" class="spin" aria-hidden="true"/><KeyRound v-else aria-hidden="true"/>ذخیره رمز جدید</button></div></form></dialog>

    <div v-if="toast.message" class="toast" :class="toast.tone" role="status" aria-live="polite"><CircleCheck v-if="toast.tone==='success'" aria-hidden="true"/><TriangleAlert v-else aria-hidden="true"/><span>{{toast.message}}</span><button class="toast-close" aria-label="بستن پیام" @click="toast={message:'',tone:'success'}"><X aria-hidden="true"/></button></div>
  </div>
</template>
