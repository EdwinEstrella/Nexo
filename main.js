const { app, BrowserWindow, ipcMain } = require('electron/main')
const { nativeImage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { autoUpdater } = require('electron-updater')
const log = require('electron-log')

const UPDATE_STATE_FILE = 'updater-state.json'

function normalizeVersion (value) {
  return String(value || '').trim().replace(/^v/i, '')
}

function getUpdateStateFilePath () {
  return path.join(app.getPath('userData'), UPDATE_STATE_FILE)
}

function loadPersistedUpdateState () {
  try {
    const fp = getUpdateStateFilePath()
    if (!fs.existsSync(fp)) return {}
    const raw = fs.readFileSync(fp, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
    return {}
  } catch (_) {
    return {}
  }
}

function savePersistedUpdateState (partial) {
  try {
    const fp = getUpdateStateFilePath()
    const current = loadPersistedUpdateState()
    const next = { ...current, ...partial }
    fs.writeFileSync(fp, JSON.stringify(next, null, 2), 'utf8')
    return next
  } catch (err) {
    console.warn('[updater:save-state]', err?.message || err)
    return null
  }
}

function clearPersistedUpdateState () {
  try {
    const fp = getUpdateStateFilePath()
    if (fs.existsSync(fp)) fs.unlinkSync(fp)
  } catch (err) {
    console.warn('[updater:clear-state]', err?.message || err)
  }
}

const updateRuntimeState = {
  phase: 'idle',
  remoteVersion: null,
  percent: 0,
  downloadedVersion: null,
  releaseDate: null,
  releaseNotes: null,
  error: null,
  updatedAt: null
}

function setUpdateState (patch) {
  Object.assign(updateRuntimeState, patch || {}, { updatedAt: new Date().toISOString() })
}

function getTargetWindow () {
  const focused = BrowserWindow.getFocusedWindow()
  if (focused && !focused.isDestroyed()) return focused
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow
  const all = BrowserWindow.getAllWindows()
  return all.find((w) => !w.isDestroyed()) || null
}

function sendUpdateEvent (channel, payload) {
  const w = getTargetWindow()
  if (w) w.webContents.send(channel, payload)
}

function stringifyUpdaterMeta (meta) {
  try {
    return JSON.stringify(meta)
  } catch (_) {
    return String(meta)
  }
}

function logUpdaterEvent (tag, meta, level = 'info') {
  const label = `[updater:${tag}]`
  const text = stringifyUpdaterMeta(meta)
  if (level === 'error') {
    log.error(label, text)
    console.error(label, meta)
    return
  }
  log.info(label, text)
  console.info(label, meta)
}

function buildUpdateErrorPayload (stage, err) {
  const message = err?.message ? String(err.message) : String(err || 'Error desconocido')
  const stack = typeof err?.stack === 'string'
    ? err.stack.split('\n').slice(0, 8).join('\n')
    : null
  return {
    message,
    stage: String(stage || 'unknown'),
    code: err?.code ? String(err.code) : null,
    cause: err?.cause?.message ? String(err.cause.message) : null,
    stack,
    phase: updateRuntimeState.phase,
    packaged: app.isPackaged,
    platform: process.platform,
    at: new Date().toISOString()
  }
}

let autoUpdaterConfigured = false

function resolveWindowIcon () {
  const pngPath = path.join(__dirname, 'Logo.png')
  const icoPath = path.join(__dirname, 'Logo.ico')
  try {
    if (fs.existsSync(pngPath)) {
      const img = nativeImage.createFromPath(pngPath)
      if (!img.isEmpty()) return img
    }
  } catch (_) {}
  try {
    if (fs.existsSync(icoPath)) return nativeImage.createFromPath(icoPath)
  } catch (_) {}
  return undefined
}

/**
 * El entry CJS del SDK hace require("@insforge/shared-schemas"), que es solo ESM y falla en Electron.
 * import() carga el bundle ESM (.mjs), que resuelve bien shared-schemas.
 */
let insforge = null

let mainWindow = null

function slugifyCompany (value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function getTenantById (tenantId) {
  if (!tenantId) return null
  const { data, error } = await insforge.database
    .from('nexo_tenants')
    .select('*')
    .eq('id', tenantId)
    .maybeSingle()
  if (error || !data) return null
  return data
}

async function ensureTenantForCompany (companyName) {
  const name = String(companyName || '').trim()
  if (!name) return null
  const baseSlug = slugifyCompany(name) || 'empresa'

  const byName = await insforge.database
    .from('nexo_tenants')
    .select('*')
    .eq('name', name)
    .maybeSingle()
  if (byName?.data) return byName.data

  const bySlug = await insforge.database
    .from('nexo_tenants')
    .select('*')
    .eq('slug', baseSlug)
    .maybeSingle()
  if (bySlug?.data) return bySlug.data

  for (let i = 0; i < 50; i += 1) {
    const candidateSlug = i === 0 ? baseSlug : `${baseSlug}-${i + 1}`
    const exists = await insforge.database
      .from('nexo_tenants')
      .select('id')
      .eq('slug', candidateSlug)
      .maybeSingle()
    if (exists?.data) continue

    const { data: inserted, error } = await insforge.database
      .from('nexo_tenants')
      .insert([{
        name,
        slug: candidateSlug,
        status: 'active',
        is_blocked: false
      }])
      .select('*')
      .maybeSingle()

    if (!error && inserted) return inserted
    const msg = String(error?.message || '')
    if (!msg.toLowerCase().includes('duplicate')) {
      console.warn('[ensureTenantForCompany]', msg || error)
      return null
    }
  }
  return null
}

async function createTenantForSelfSignup (companyName) {
  const name = String(companyName || '').trim()
  if (!name) {
    return { ok: false, error: 'Debes indicar el nombre de tu empresa para crear la cuenta.' }
  }
  const baseSlug = slugifyCompany(name) || 'empresa'

  const byName = await insforge.database
    .from('nexo_tenants')
    .select('id,name')
    .eq('name', name)
    .maybeSingle()
  if (byName?.data) {
    return {
      ok: false,
      error: 'Esta empresa ya está registrada. Solicita acceso a un administrador de tu empresa.'
    }
  }

  const bySlug = await insforge.database
    .from('nexo_tenants')
    .select('id,slug')
    .eq('slug', baseSlug)
    .maybeSingle()
  if (bySlug?.data) {
    return {
      ok: false,
      error: 'Esta empresa ya está registrada. Solicita acceso a un administrador de tu empresa.'
    }
  }

  for (let i = 0; i < 50; i += 1) {
    const candidateSlug = i === 0 ? baseSlug : `${baseSlug}-${i + 1}`
    const { data: inserted, error } = await insforge.database
      .from('nexo_tenants')
      .insert([{
        name,
        slug: candidateSlug,
        status: 'active',
        is_blocked: false
      }])
      .select('*')
      .maybeSingle()

    if (!error && inserted?.id) return { ok: true, tenant: inserted }

    const msg = String(error?.message || '').toLowerCase()
    if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('23505')) continue
    return { ok: false, error: error?.message || 'No se pudo crear la empresa para esta cuenta.' }
  }

  return { ok: false, error: 'No se pudo asignar un identificador único para tu empresa.' }
}

async function getCurrentUserMerged () {
  const current = await insforge.auth.getCurrentUser()
  if (current?.error || !current?.data?.user?.id) {
    return { success: false, error: 'Sesión inválida o expirada' }
  }
  await mergeNexoProfile(current.data.user)
  return { success: true, user: current.data.user }
}

function isSuperAdminUser (user) {
  const role = String(user?.profile?.app_role || user?.nexo_profile?.app_role || '').toLowerCase()
  return role === 'super_admin' || role === 'app_admin'
}

async function requireSuperAdminGuard () {
  const current = await getCurrentUserMerged()
  if (!current.success) return current
  if (!isSuperAdminUser(current.user)) {
    return { success: false, error: 'Acceso denegado: requiere rol super_admin' }
  }
  return { success: true, user: current.user }
}

async function assertScopedIdOwnership ({ table, id, tenantId, idColumn = 'id', tenantColumn = 'tenant_id' }) {
  const scopeId = String(id || '').trim()
  if (!scopeId || !tenantId) return { success: true }
  try {
    const { data, error } = await insforge.database
      .from(table)
      .select(`${idColumn},${tenantColumn}`)
      .eq(idColumn, scopeId)
      .maybeSingle()
    if (error) return { success: true }
    if (data && data[tenantColumn] && String(data[tenantColumn]) !== String(tenantId)) {
      return { success: false, error: `Conflicto de aislamiento multi-tenant en ${table}.` }
    }
    return { success: true }
  } catch (_) {
    return { success: true }
  }
}

async function ensureTenantMembership ({ tenantId, userId }) {
  if (!tenantId || !userId) return
  const existing = await insforge.database
    .from('nexo_tenant_members')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle()
  if (existing?.data) return

  const { error } = await insforge.database
    .from('nexo_tenant_members')
    .insert([{
      tenant_id: tenantId,
      user_id: userId,
      member_role: 'owner'
    }])
  if (error) {
    const msg = String(error.message || error)
    if (!msg.toLowerCase().includes('duplicate')) {
      console.warn('[ensureTenantMembership]', msg)
    }
  }
}

async function ensureTenantsFromEmpresaProfiles () {
  const { data: profiles, error } = await insforge.database
    .from('nexo_profiles')
    .select('user_id, company, app_role')
    .eq('app_role', 'empresa')
    .not('company', 'is', null)

  if (error || !Array.isArray(profiles)) {
    if (error) console.warn('[ensureTenantsFromEmpresaProfiles]', error.message || error)
    return
  }

  for (const p of profiles) {
    const company = String(p.company || '').trim()
    if (!company) continue
    const tenant = await ensureTenantForCompany(company)
    if (!tenant?.id) continue
    await ensureTenantMembership({ tenantId: tenant.id, userId: p.user_id })
    await insforge.database
      .from('nexo_profiles')
      .update({ default_tenant_id: tenant.id })
      .eq('user_id', p.user_id)
  }
}

async function findTenantForUser (user) {
  if (!user?.id) return null
  try {
    const member = await insforge.database
      .from('nexo_tenant_members')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (member?.data?.tenant_id) {
      const byId = await getTenantById(member.data.tenant_id)
      if (byId) return byId
    }
  } catch (_) {}

  const company = user?.profile?.company || user?.nexo_profile?.company || null
  if (!company) return null
  try {
    const bySlug = await insforge.database
      .from('nexo_tenants')
      .select('*')
      .eq('slug', String(company).trim().toLowerCase().replace(/\s+/g, '-'))
      .maybeSingle()
    if (bySlug?.data) return bySlug.data
  } catch (_) {}
  try {
    const byName = await insforge.database
      .from('nexo_tenants')
      .select('*')
      .eq('name', company)
      .maybeSingle()
    if (byName?.data) return byName.data
  } catch (_) {}
  return null
}

/**
 * Une public.nexo_profiles al objeto usuario (rol multi-tenant / super admin).
 */
async function mergeNexoProfile (user) {
  if (!user?.id) return user
  try {
    const { data, error } = await insforge.database
      .from('nexo_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error || !data) return user

    user.profile = user.profile && typeof user.profile === 'object' ? user.profile : {}
    user.profile.app_role = data.app_role || user.profile.app_role
    if (data.company != null && data.company !== '') user.profile.company = data.company
    if (data.full_name && !user.profile.name) user.profile.name = data.full_name
    user.nexo_profile = data

    const tenant = await findTenantForUser(user)
    if (tenant) {
      user.nexo_tenant = tenant
      user.company_blocked = Boolean(
        tenant.is_blocked === true ||
        tenant.status === 'blocked' ||
        tenant.status === 'suspended'
      )
    } else {
      user.company_blocked = false
    }
  } catch (e) {
    console.warn('[mergeNexoProfile]', e?.message || e)
  }
  return user
}

async function insertNexoProfileEmpresa ({ userId, email, fullName, company }) {
  const row = {
    user_id: userId,
    email,
    full_name: fullName || null,
    company: company && String(company).trim() ? String(company).trim() : null,
    app_role: 'empresa'
  }
  const { error } = await insforge.database.from('nexo_profiles').insert([row])
  if (error) {
    const msg = String(error.message || error).toLowerCase()
    if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('23505')) {
      const { data: existing } = await insforge.database
        .from('nexo_profiles')
        .select('app_role')
        .eq('user_id', userId)
        .maybeSingle()
      if (existing?.app_role === 'super_admin') return
      await insforge.database
        .from('nexo_profiles')
        .update({
          email,
          full_name: row.full_name,
          company: row.company
        })
        .eq('user_id', userId)
      return
    }
    console.warn('[insertNexoProfileEmpresa]', error.message || error)
  }
}

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 360,
    minHeight: 480,
    title: 'Nexo',
    icon: resolveWindowIcon(),
    frame: false,
    titleBarStyle: 'hidden',
    show: false,
    /* Evita frame blanco mientras Chromium pinta la nueva página (navegación entre HTML). */
    backgroundColor: '#f9f9ff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  })

  mainWindow.loadFile('index.html')

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
  })

  // Notify renderer when window is maximized/unmaximized
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized', true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximized', false)
  })
}

function setupAutoUpdater () {
  if (autoUpdaterConfigured) return
  autoUpdaterConfigured = true

  autoUpdater.logger = log
  autoUpdater.logger.transports.file.level = 'info'
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  if (process.platform === 'win32' && !process.env.CSC_LINK && !process.env.WIN_CSC_LINK) {
    autoUpdater.verifyUpdateCodeSignature = false
  }
  logUpdaterEvent('setup', {
    packaged: app.isPackaged,
    platform: process.platform,
    version: app.getVersion()
  })

  const persisted = loadPersistedUpdateState()
  const currentVersion = normalizeVersion(app.getVersion())
  const cachedDownloaded = normalizeVersion(persisted.downloadedVersion)
  if (cachedDownloaded && cachedDownloaded !== currentVersion) {
    setUpdateState({
      phase: 'ready',
      downloadedVersion: cachedDownloaded,
      remoteVersion: cachedDownloaded,
      releaseDate: persisted.releaseDate || null,
      releaseNotes: persisted.releaseNotes || null,
      percent: 100,
      error: null
    })
  } else if (cachedDownloaded && cachedDownloaded === currentVersion) {
    clearPersistedUpdateState()
  }

  autoUpdater.on('checking-for-update', () => {
    logUpdaterEvent('checking-for-update', { phase: updateRuntimeState.phase })
    if (updateRuntimeState.phase === 'ready') return
    setUpdateState({ phase: 'checking', error: null })
    sendUpdateEvent('update:checking')
  })

  autoUpdater.on('update-available', (info) => {
    logUpdaterEvent('update-available', {
      version: normalizeVersion(info?.version),
      releaseDate: info?.releaseDate || null
    })
    setUpdateState({
      phase: 'available',
      remoteVersion: normalizeVersion(info.version),
      releaseDate: info.releaseDate || null,
      releaseNotes: info.releaseNotes || null,
      error: null,
      percent: 0
    })
    sendUpdateEvent('update:available', {
      version: normalizeVersion(info.version),
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    })
  })

  autoUpdater.on('update-not-available', () => {
    logUpdaterEvent('update-not-available', { phase: updateRuntimeState.phase })
    if (updateRuntimeState.phase === 'ready') {
      sendUpdateEvent('update:downloaded', {
        version: updateRuntimeState.downloadedVersion || updateRuntimeState.remoteVersion,
        releaseDate: updateRuntimeState.releaseDate,
        releaseNotes: updateRuntimeState.releaseNotes
      })
      return
    }
    setUpdateState({
      phase: 'idle',
      remoteVersion: null,
      percent: 0,
      error: null
    })
    sendUpdateEvent('update:not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    const pct = Math.max(0, Math.min(100, Math.round(progress.percent || 0)))
    logUpdaterEvent('download-progress', {
      percent: pct,
      transferred: progress?.transferred || 0,
      total: progress?.total || 0,
      bytesPerSecond: progress?.bytesPerSecond || 0
    })
    setUpdateState({
      phase: 'downloading',
      percent: pct,
      error: null
    })
    sendUpdateEvent('update:download-progress', {
      percent: pct,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    const v = normalizeVersion(info.version)
    logUpdaterEvent('update-downloaded', {
      version: v,
      releaseDate: info?.releaseDate || null
    })
    setUpdateState({
      phase: 'ready',
      downloadedVersion: v,
      remoteVersion: v,
      percent: 100,
      releaseDate: info.releaseDate || null,
      releaseNotes: info.releaseNotes || null,
      error: null
    })
    savePersistedUpdateState({
      downloadedVersion: v,
      releaseDate: info.releaseDate || null,
      releaseNotes: info.releaseNotes || null,
      downloadedAt: new Date().toISOString()
    })
    sendUpdateEvent('update:downloaded', {
      version: v,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    })
  })

  autoUpdater.on('error', (err) => {
    const payload = buildUpdateErrorPayload('auto-updater-event', err)
    logUpdaterEvent('error', payload, 'error')
    setUpdateState({
      phase: updateRuntimeState.phase === 'ready' ? 'ready' : 'idle',
      error: payload.message
    })
    sendUpdateEvent('update:error', payload)
  })

  ipcMain.on('update:check-for-updates', () => {
    if (!app.isPackaged) {
      const payload = {
        message: 'Actualizaciones deshabilitadas: app no empaquetada',
        stage: 'check-for-updates',
        phase: updateRuntimeState.phase,
        packaged: app.isPackaged,
        platform: process.platform,
        at: new Date().toISOString()
      }
      logUpdaterEvent('check-for-updates-skipped', payload)
      setUpdateState({ phase: 'unsupported', error: null })
      return
    }
    logUpdaterEvent('check-for-updates-request', { phase: updateRuntimeState.phase })
    if (updateRuntimeState.phase === 'ready') {
      sendUpdateEvent('update:downloaded', {
        version: updateRuntimeState.downloadedVersion || updateRuntimeState.remoteVersion,
        releaseDate: updateRuntimeState.releaseDate,
        releaseNotes: updateRuntimeState.releaseNotes
      })
      return
    }
    void autoUpdater.checkForUpdates().catch((err) => {
      const payload = buildUpdateErrorPayload('check-for-updates', err)
      logUpdaterEvent('check-for-updates-failed', payload, 'error')
      setUpdateState({ phase: 'idle', error: payload.message })
      sendUpdateEvent('update:error', payload)
    })
  })

  ipcMain.on('update:download-update', () => {
    if (!app.isPackaged) {
      const payload = {
        message: 'Descarga de actualización deshabilitada: app no empaquetada',
        stage: 'download-update',
        phase: updateRuntimeState.phase,
        packaged: app.isPackaged,
        platform: process.platform,
        at: new Date().toISOString()
      }
      logUpdaterEvent('download-update-skipped', payload)
      return
    }
    logUpdaterEvent('download-update-request', { phase: updateRuntimeState.phase })
    if (updateRuntimeState.phase === 'ready') {
      sendUpdateEvent('update:downloaded', {
        version: updateRuntimeState.downloadedVersion || updateRuntimeState.remoteVersion,
        releaseDate: updateRuntimeState.releaseDate,
        releaseNotes: updateRuntimeState.releaseNotes
      })
      return
    }
    if (updateRuntimeState.phase === 'available' || updateRuntimeState.phase === 'downloading') {
      void autoUpdater.downloadUpdate().catch((err) => {
        const payload = buildUpdateErrorPayload('download-update', err)
        logUpdaterEvent('download-update-failed', payload, 'error')
        setUpdateState({ phase: 'idle', error: payload.message })
        sendUpdateEvent('update:error', payload)
      })
    }
  })

  ipcMain.on('update:install-update', () => {
    logUpdaterEvent('install-update-request', {
      phase: updateRuntimeState.phase,
      downloadedVersion: updateRuntimeState.downloadedVersion
    })
    autoUpdater.quitAndInstall(false, true)
  })

  ipcMain.handle('update:get-state', async () => {
    return { ...updateRuntimeState }
  })
}

// Window controls handlers
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize()
})

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close()
})

ipcMain.handle('printers:list', async () => {
  const w = mainWindow || BrowserWindow.getAllWindows()[0]
  if (!w) return []
  try {
    const list = await w.webContents.getPrintersAsync()
    return list.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      description: p.description || '',
      isDefault: Boolean(p.isDefault)
    }))
  } catch (e) {
    console.error('[printers:list]', e)
    return []
  }
})

ipcMain.handle('print:thermal', async (_event, opts) => {
  const html = opts && typeof opts.html === 'string' ? opts.html : ''
  if (!html || html.length > 5_000_000) {
    return { ok: false, error: 'HTML de impresión inválido' }
  }
  return new Promise((resolve) => {
    const printWin = new BrowserWindow({
      width: 400,
      height: 720,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false
      }
    })
    const fail = (msg) => {
      if (!printWin.isDestroyed()) printWin.close()
      resolve({ ok: false, error: msg })
    }
    const timer = setTimeout(() => fail('Tiempo de impresión agotado'), 45000)
    printWin.webContents.once('did-fail-load', (_e, code, desc) => {
      clearTimeout(timer)
      fail(`Carga fallida: ${code} ${desc}`)
    })
    printWin.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        const silent = Boolean(opts.silent && opts.deviceName)
        printWin.webContents.print(
          {
            silent,
            printBackground: true,
            deviceName: opts.deviceName || undefined
          },
          (success, failureReason) => {
            clearTimeout(timer)
            if (!printWin.isDestroyed()) printWin.close()
            if (success) resolve({ ok: true })
            else resolve({ ok: false, error: String(failureReason || 'Error de impresión') })
          }
        )
      }, 450)
    })
    const url = 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
    printWin.loadURL(url).catch((err) => {
      clearTimeout(timer)
      fail(err instanceof Error ? err.message : String(err))
    })
  })
})

function registerAuthIpc () {
  ipcMain.handle('admin:listCompanies', async () => {
    try {
      const guard = await requireSuperAdminGuard()
      if (!guard.success) return guard
      await ensureTenantsFromEmpresaProfiles()

      const { data, error } = await insforge.database
        .from('nexo_tenants')
        .select('id,name,slug,status,is_blocked,created_at,updated_at')
        .order('updated_at', { ascending: false })

      if (!error && Array.isArray(data) && data.length > 0) {
        return { success: true, companies: data }
      }

      const { data: profileRows, error: profileError } = await insforge.database
        .from('nexo_profiles')
        .select('company')
        .eq('app_role', 'empresa')
        .not('company', 'is', null)

      if (profileError) {
        return { success: false, error: profileError.message || 'No se pudieron listar empresas' }
      }

      const unique = [...new Set((profileRows || []).map((r) => String(r.company || '').trim()).filter(Boolean))]
      const companies = unique.map((name, i) => ({
        id: `profile-company-${i + 1}`,
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        status: 'active',
        is_blocked: false,
        created_at: null,
        updated_at: null,
        source: 'profiles_fallback'
      }))
      return { success: true, companies }
    } catch (error) {
      return { success: false, error: error.message || 'No se pudieron listar empresas' }
    }
  })

  ipcMain.handle('admin:setCompanyBlocked', async (event, { companyId, blocked }) => {
    try {
      const guard = await requireSuperAdminGuard()
      if (!guard.success) return guard
      if (!companyId) {
        return { success: false, error: 'companyId es requerido' }
      }
      const nextStatus = blocked ? 'blocked' : 'active'
      const payload = {
        is_blocked: Boolean(blocked),
        status: nextStatus,
        updated_at: new Date().toISOString()
      }
      const { data, error } = await insforge.database
        .from('nexo_tenants')
        .update(payload)
        .eq('id', companyId)
        .select('id')

      if (error) {
        return { success: false, error: error.message || 'No se pudo actualizar empresa' }
      }
      if (!Array.isArray(data) || data.length === 0) {
        return { success: false, error: 'Empresa no encontrada en nexo_tenants' }
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message || 'No se pudo actualizar empresa' }
    }
  })

  ipcMain.handle('admin:deleteCompany', async (event, { companyId }) => {
    try {
      const guard = await requireSuperAdminGuard()
      if (!guard.success) return guard
      const tenantId = String(companyId || '').trim()
      if (!tenantId) {
        return { success: false, error: 'companyId es requerido' }
      }

      const { data: tenant, error: tenantErr } = await insforge.database
        .from('nexo_tenants')
        .select('id,name')
        .eq('id', tenantId)
        .maybeSingle()
      if (tenantErr) {
        return { success: false, error: tenantErr.message || 'No se pudo validar la empresa a eliminar' }
      }
      if (!tenant?.id) {
        return { success: false, error: 'Empresa no encontrada en nexo_tenants' }
      }

      const userCandidates = new Set()
      try {
        const { data: members } = await insforge.database
          .from('nexo_tenant_members')
          .select('user_id')
          .eq('tenant_id', tenantId)
        ;(members || []).forEach((m) => {
          if (m?.user_id) userCandidates.add(String(m.user_id))
        })
      } catch (_) {}

      try {
        const { data: profilesByTenant } = await insforge.database
          .from('nexo_profiles')
          .select('user_id')
          .eq('default_tenant_id', tenantId)
        ;(profilesByTenant || []).forEach((p) => {
          if (p?.user_id) userCandidates.add(String(p.user_id))
        })
      } catch (_) {}

      try {
        const { data: profilesByCompany } = await insforge.database
          .from('nexo_profiles')
          .select('user_id')
          .eq('app_role', 'empresa')
          .eq('company', tenant.name)
        ;(profilesByCompany || []).forEach((p) => {
          if (p?.user_id) userCandidates.add(String(p.user_id))
        })
      } catch (_) {}

      const { data: deletedRows, error: deleteErr } = await insforge.database
        .from('nexo_tenants')
        .delete()
        .eq('id', tenantId)
        .select('id')
      if (deleteErr) {
        return { success: false, error: deleteErr.message || 'No se pudo eliminar la empresa' }
      }
      if (!Array.isArray(deletedRows) || deletedRows.length === 0) {
        return { success: false, error: 'La empresa no pudo eliminarse' }
      }

      let deletedProfiles = 0
      for (const userId of userCandidates) {
        const stillMember = await insforge.database
          .from('nexo_tenant_members')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle()
        if (stillMember?.data?.id) continue

        const profileDelete = await insforge.database
          .from('nexo_profiles')
          .delete()
          .eq('user_id', userId)
          .eq('app_role', 'empresa')
          .select('user_id')
        if (!profileDelete.error && Array.isArray(profileDelete.data) && profileDelete.data.length > 0) {
          deletedProfiles += profileDelete.data.length
        }
      }

      return {
        success: true,
        deleted: {
          tenantId,
          tenantName: tenant.name || null,
          companyRows: deletedRows.length,
          empresaProfiles: deletedProfiles
        }
      }
    } catch (error) {
      return { success: false, error: error.message || 'No se pudo eliminar la empresa' }
    }
  })

  ipcMain.handle('auth:signUp', async (event, { email, password, name, company }) => {
  try {
    const companyName = String(company || '').trim()
    if (!companyName) {
      return { success: false, error: 'La empresa es requerida para registrar la cuenta.' }
    }
    const existing = await insforge.database
      .from('nexo_tenants')
      .select('id')
      .eq('name', companyName)
      .maybeSingle()
    const existingSlug = await insforge.database
      .from('nexo_tenants')
      .select('id')
      .eq('slug', slugifyCompany(companyName) || 'empresa')
      .maybeSingle()
    if (existing?.data?.id || existingSlug?.data?.id) {
      return {
        success: false,
        error: 'Esta empresa ya existe. Tu cuenta debe ser habilitada por un administrador de esa empresa.'
      }
    }

    const { data, error } = await insforge.auth.signUp({
      email,
      password,
      name,
      redirectTo: 'file://' + path.join(__dirname, 'index.html')
    })

    if (error) {
      return { success: false, error: error.message || 'Error al registrar usuario' }
    }

    // Registro público = tenant empresa; fila en nexo_profiles + perfil auth.
    if (data?.user) {
      const u = data.user
      const patch = { app_role: 'empresa' }
      if (company && String(company).trim()) patch.company = String(company).trim()
      const { error: profileError } = await insforge.auth.setProfile(patch)
      if (profileError) {
        console.warn('[auth:signUp] setProfile empresa:', profileError.message || profileError)
      }
      await insertNexoProfileEmpresa({
        userId: u.id,
        email: u.email,
        fullName: name,
        company
      })
      if (companyName) {
        const tenantResult = await createTenantForSelfSignup(companyName)
        if (!tenantResult.ok || !tenantResult.tenant?.id) {
          return {
            success: false,
            error: tenantResult.error || 'No se pudo provisionar el tenant de la nueva empresa.'
          }
        }
        const tenant = tenantResult.tenant
        await ensureTenantMembership({ tenantId: tenant.id, userId: u.id })
        await insforge.database
          .from('nexo_profiles')
          .update({ default_tenant_id: tenant.id })
          .eq('user_id', u.id)
      }
      await mergeNexoProfile(data.user)
    }

    return { success: true, data }
  } catch (error) {
    return { success: false, error: error.message || 'Error al registrar usuario' }
  }
})

ipcMain.handle('auth:signIn', async (event, { email, password }) => {
  try {
    const { data, error } = await insforge.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      return { success: false, error: error.message || 'Credenciales inválidas' }
    }

    if (data?.user) {
      await mergeNexoProfile(data.user)
    }

    return { success: true, data }
  } catch (error) {
    return { success: false, error: error.message || 'Error al iniciar sesión' }
  }
})

ipcMain.handle('auth:signOut', async () => {
  try {
    const { error } = await insforge.auth.signOut()

    if (error) {
      return { success: false, error: error.message || 'Error al cerrar sesión' }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message || 'Error al cerrar sesión' }
  }
})

ipcMain.handle('auth:getCurrentUser', async () => {
  try {
    const { data, error } = await insforge.auth.getCurrentUser()

    if (error) {
      return { success: false, error: error.message || 'Error al obtener usuario' }
    }

    if (data?.user) {
      await mergeNexoProfile(data.user)
    }

    return { success: true, user: data.user }
  } catch (error) {
    return { success: false, error: error.message || 'Error al obtener usuario' }
  }
})

ipcMain.handle('auth:updateProfile', async (event, profileData) => {
  try {
    const { data, error } = await insforge.auth.setProfile(profileData)

    if (error) {
      return { success: false, error: error.message || 'Error al actualizar perfil' }
    }

    return { success: true, data }
  } catch (error) {
    return { success: false, error: error.message || 'Error al actualizar perfil' }
  }
})

ipcMain.handle('auth:updateSecuritySettings', async (event, settings) => {
  try {
    const timeoutRaw = Number(settings?.session_timeout_min)
    const timeoutAllowed = new Set([0, 15, 30, 60, 120])
    const sessionTimeoutMin = timeoutAllowed.has(timeoutRaw) ? timeoutRaw : 30
    const patch = {
      session_timeout_min: sessionTimeoutMin,
      twofa_enabled: false,
      twofa_status: 'en_desarrollo'
    }
    const { data, error } = await insforge.auth.setProfile(patch)
    if (error) {
      return { success: false, error: error.message || 'No se pudo guardar configuración de seguridad' }
    }
    return { success: true, data, security: patch }
  } catch (error) {
    return { success: false, error: error.message || 'No se pudo guardar configuración de seguridad' }
  }
})

ipcMain.handle('auth:requestPasswordChange', async (event, { currentPassword }) => {
  try {
    const current = await insforge.auth.getCurrentUser()
    if (current?.error || !current?.data?.user?.email) {
      return { success: false, error: 'No hay una sesión activa para cambiar la contraseña' }
    }
    const email = String(current.data.user.email)
    const pwd = String(currentPassword || '')
    if (!pwd) {
      return { success: false, error: 'Debes indicar tu contraseña actual' }
    }

    const reauth = await insforge.auth.signInWithPassword({ email, password: pwd })
    if (reauth?.error) {
      return { success: false, error: 'La contraseña actual no es válida' }
    }

    let resetMethod = 'code'
    try {
      const cfg = await insforge.auth.getPublicAuthConfig()
      const candidate = String(cfg?.data?.resetPasswordMethod || '').toLowerCase()
      if (candidate === 'link' || candidate === 'code') resetMethod = candidate
    } catch (_) {}

    const sendReq = { email }
    if (resetMethod === 'link') {
      sendReq.redirectTo = 'file://' + path.join(__dirname, 'index.html')
    }
    const sent = await insforge.auth.sendResetPasswordEmail(sendReq)
    if (sent?.error) {
      return { success: false, error: sent.error.message || 'No se pudo iniciar el cambio de contraseña' }
    }

    return {
      success: true,
      flow: resetMethod,
      message: resetMethod === 'link'
        ? 'Se envió un enlace a tu correo para completar el cambio de contraseña.'
        : 'Se envió un código a tu correo para completar el cambio de contraseña.'
    }
  } catch (error) {
    return { success: false, error: error.message || 'No se pudo iniciar el cambio de contraseña' }
  }
})

ipcMain.handle('auth:confirmPasswordChange', async (event, { code, newPassword }) => {
  try {
    const otpCode = String(code || '').trim()
    const nextPassword = String(newPassword || '')
    if (!otpCode) return { success: false, error: 'Debes introducir el código enviado por correo' }
    if (nextPassword.length < 8) {
      return { success: false, error: 'La nueva contraseña debe tener al menos 8 caracteres' }
    }
    const current = await insforge.auth.getCurrentUser()
    if (current?.error || !current?.data?.user?.email) {
      return { success: false, error: 'No hay una sesión activa para completar el cambio de contraseña' }
    }
    const email = String(current.data.user.email)

    const exchanged = await insforge.auth.exchangeResetPasswordToken({ email, code: otpCode })
    if (exchanged?.error || !exchanged?.data?.token) {
      return { success: false, error: exchanged?.error?.message || 'Código inválido o expirado' }
    }

    const reset = await insforge.auth.resetPassword({
      newPassword: nextPassword,
      otp: String(exchanged.data.token)
    })
    if (reset?.error) {
      return { success: false, error: reset.error.message || 'No se pudo actualizar la contraseña' }
    }

    return { success: true, data: reset.data }
  } catch (error) {
    return { success: false, error: error.message || 'No se pudo completar el cambio de contraseña' }
  }
})
}

function portfolioDefaultSettingsRow (tenantId) {
  return {
    tenant_id: tenantId,
    late_fee_percent: 1,
    grace_days: 2,
    payment_frequency: 'monthly',
    interest_mode: 'annual',
    reminder_days: 2,
    updated_at: new Date().toISOString()
  }
}

async function getPortfolioTenantId () {
  const { data, error } = await insforge.auth.getCurrentUser()
  if (error || !data?.user?.id) {
    return { error: 'No autenticado' }
  }
  const uid = String(data.user.id)
  await mergeNexoProfile(data.user)
  const { data: prof } = await insforge.database
    .from('nexo_profiles')
    .select('default_tenant_id')
    .eq('user_id', uid)
    .maybeSingle()
  if (prof?.default_tenant_id) {
    return { tenantId: prof.default_tenant_id }
  }
  const { data: mem } = await insforge.database
    .from('nexo_tenant_members')
    .select('tenant_id')
    .eq('user_id', uid)
    .limit(1)
    .maybeSingle()
  if (mem?.tenant_id) {
    return { tenantId: mem.tenant_id }
  }
  return { error: 'Tu cuenta no tiene empresa (tenant) asignada. Completa el registro o contacta soporte.' }
}

function registerPortfolioIpc () {
  ipcMain.handle('portfolio:getState', async () => {
    try {
      const t = await getPortfolioTenantId()
      if (t.error) {
        return { success: false, error: t.error }
      }
      const tenantId = t.tenantId

      let { data: settingsRow, error: sErr } = await insforge.database
        .from('nexo_portfolio_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle()
      if (sErr) {
        return { success: false, error: sErr.message || 'No se pudo leer configuración de cartera' }
      }
      if (!settingsRow) {
        const row = portfolioDefaultSettingsRow(tenantId)
        const { error: insErr } = await insforge.database.from('nexo_portfolio_settings').insert([row])
        if (insErr) {
          return { success: false, error: insErr.message || 'No se pudo crear configuración de cartera' }
        }
        settingsRow = row
      }

      const { data: clients, error: cErr } = await insforge.database
        .from('nexo_clients')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
      if (cErr) {
        return { success: false, error: cErr.message || 'No se pudieron leer clientes' }
      }

      const { data: loansRaw, error: lErr } = await insforge.database
        .from('nexo_loans')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
      if (lErr) {
        return { success: false, error: lErr.message || 'No se pudieron leer préstamos' }
      }

      const loanIds = (loansRaw || []).map((l) => l.id)
      let instRows = []
      if (loanIds.length) {
        const { data: inst, error: iErr } = await insforge.database
          .from('nexo_loan_installments')
          .select('*')
          .in('loan_id', loanIds)
        if (iErr) {
          return { success: false, error: iErr.message || 'No se pudieron leer cuotas' }
        }
        instRows = inst || []
      }

      const { data: payments, error: pErr } = await insforge.database
        .from('nexo_payments')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
      if (pErr) {
        return { success: false, error: pErr.message || 'No se pudieron leer pagos' }
      }

      const settings = {
        late_fee_percent: Number(settingsRow.late_fee_percent),
        grace_days: Number(settingsRow.grace_days),
        payment_frequency: settingsRow.payment_frequency || 'monthly',
        interest_mode: settingsRow.interest_mode || 'annual',
        reminder_days: Number(settingsRow.reminder_days)
      }

      const loans = (loansRaw || []).map((loan) => {
        const insts = instRows.filter((i) => i.loan_id === loan.id).sort((a, b) => a.n - b.n)
        let docs = loan.documents
        if (docs == null) docs = []
        if (typeof docs === 'string') {
          try {
            docs = JSON.parse(docs)
          } catch (_) {
            docs = []
          }
        }
        return {
          id: loan.id,
          reference: loan.reference,
          client_id: loan.client_id,
          client_name: loan.client_name,
          product: loan.product,
          purpose: loan.purpose,
          principal: Number(loan.principal),
          term_months: Number(loan.term_months),
          interest_rate_pct: loan.interest_rate_pct != null ? Number(loan.interest_rate_pct) : null,
          late_fee_percent: loan.late_fee_percent != null ? Number(loan.late_fee_percent) : Number(settingsRow.late_fee_percent),
          grace_days: loan.grace_days != null ? Number(loan.grace_days) : Number(settingsRow.grace_days),
          interest_mode: loan.interest_mode,
          payment_frequency: loan.payment_frequency,
          start_date: loan.start_date,
          created_at: loan.created_at,
          contract_signer: loan.contract_signer || '',
          documents: Array.isArray(docs) ? docs : [],
          installments: insts.map((i) => ({
            n: Number(i.n),
            due_date: i.due_date,
            principal_target: Number(i.principal_target),
            paid_interest: Number(i.paid_interest) || 0,
            paid_principal: Number(i.paid_principal) || 0,
            paid_late_fee: Number(i.paid_late_fee) || 0
          }))
        }
      })

      const clientsOut = (clients || []).map((c) => ({
        id: c.id,
        name: c.name,
        document_type: c.document_type,
        document_number: c.document_number,
        phone: c.phone,
        address: c.address,
        email: c.email,
        created_at: c.created_at
      }))

      const paymentsOut = (payments || []).map((p) => ({
        id: p.id,
        loan_id: p.loan_id,
        installment_n: Number(p.installment_n),
        amount: Number(p.amount),
        breakdown: p.breakdown || {},
        created_at: p.created_at
      }))

      return {
        success: true,
        state: {
          settings,
          clients: clientsOut,
          loans,
          payments: paymentsOut
        }
      }
    } catch (err) {
      return { success: false, error: err.message || 'Error al cargar cartera' }
    }
  })

  ipcMain.handle('portfolio:saveSettings', async (event, partial) => {
    try {
      const t = await getPortfolioTenantId()
      if (t.error) {
        return { success: false, error: t.error }
      }
      const tenantId = t.tenantId
      const { data: existing } = await insforge.database
        .from('nexo_portfolio_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle()
      const base = existing || portfolioDefaultSettingsRow(tenantId)
      const next = {
        ...base,
        ...partial,
        tenant_id: tenantId,
        updated_at: new Date().toISOString()
      }
      const { error } = await insforge.database.from('nexo_portfolio_settings').upsert([next], { onConflict: 'tenant_id' })
      if (error) {
        return { success: false, error: error.message || 'No se pudo guardar' }
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message || 'Error al guardar políticas' }
    }
  })

  ipcMain.handle('portfolio:createLoan', async (event, payload) => {
    try {
      const t = await getPortfolioTenantId()
      if (t.error) {
        return { success: false, error: t.error }
      }
      const tenantId = t.tenantId
      const client = payload?.client
      const loan = payload?.loan
      if (!client?.id || !loan?.id || !Array.isArray(loan.installments)) {
        return { success: false, error: 'Datos de préstamo incompletos' }
      }

      const clientRow = {
        id: String(client.id),
        tenant_id: tenantId,
        name: String(client.name || ''),
        document_type: client.document_type || null,
        document_number: client.document_number || null,
        phone: client.phone || null,
        address: client.address || null,
        email: client.email || null,
        created_at: client.created_at || new Date().toISOString()
      }
      const clientOwnership = await assertScopedIdOwnership({
        table: 'nexo_clients',
        id: clientRow.id,
        tenantId
      })
      if (!clientOwnership.success) {
        return { success: false, error: clientOwnership.error }
      }
      const { error: cIns } = await insforge.database.from('nexo_clients').upsert([clientRow], { onConflict: 'id' })
      if (cIns) {
        return { success: false, error: cIns.message || 'No se pudo guardar el cliente' }
      }

      const installments = loan.installments
      const { installments: _i, ...loanFields } = loan
      const loanRow = {
        id: String(loanFields.id),
        tenant_id: tenantId,
        client_id: String(loanFields.client_id),
        reference: loanFields.reference || null,
        client_name: String(loanFields.client_name || ''),
        product: loanFields.product || 'hipotecario',
        purpose: loanFields.purpose || '',
        principal: Number(loanFields.principal) || 0,
        term_months: Number(loanFields.term_months) || 12,
        interest_rate_pct: loanFields.interest_rate_pct != null ? Number(loanFields.interest_rate_pct) : null,
        late_fee_percent: loanFields.late_fee_percent != null ? Number(loanFields.late_fee_percent) : null,
        grace_days: loanFields.grace_days != null ? Number(loanFields.grace_days) : null,
        interest_mode: loanFields.interest_mode || 'annual',
        payment_frequency: loanFields.payment_frequency || 'monthly',
        start_date: loanFields.start_date || null,
        created_at: loanFields.created_at || new Date().toISOString(),
        contract_signer: loanFields.contract_signer || '',
        documents: Array.isArray(loanFields.documents) ? loanFields.documents : []
      }
      const loanOwnership = await assertScopedIdOwnership({
        table: 'nexo_loans',
        id: loanRow.id,
        tenantId
      })
      if (!loanOwnership.success) {
        return { success: false, error: loanOwnership.error }
      }

      const { error: lIns } = await insforge.database.from('nexo_loans').insert([loanRow])
      if (lIns) {
        return { success: false, error: lIns.message || 'No se pudo crear el préstamo' }
      }

      const instPayload = installments.map((i) => ({
        loan_id: String(loan.id),
        n: Number(i.n),
        due_date: i.due_date,
        principal_target: Number(i.principal_target) || 0,
        paid_interest: Number(i.paid_interest) || 0,
        paid_principal: Number(i.paid_principal) || 0,
        paid_late_fee: Number(i.paid_late_fee) || 0
      }))
      if (instPayload.length) {
        const { error: iIns } = await insforge.database.from('nexo_loan_installments').insert(instPayload)
        if (iIns) {
          return { success: false, error: iIns.message || 'No se pudieron crear las cuotas' }
        }
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message || 'Error al crear préstamo' }
    }
  })

  ipcMain.handle('portfolio:applyPayment', async (event, payload) => {
    try {
      const t = await getPortfolioTenantId()
      if (t.error) {
        return { success: false, error: t.error }
      }
      const tenantId = t.tenantId
      const loanId = String(payload?.loan_id || '')
      const n = Number(payload?.installment_n)
      const patch = payload?.installmentPatch || {}
      const payment = payload?.payment
      if (!loanId || !n || !payment?.id) {
        return { success: false, error: 'Datos de pago incompletos' }
      }

      const { data: loanCheck } = await insforge.database
        .from('nexo_loans')
        .select('id')
        .eq('id', loanId)
        .eq('tenant_id', tenantId)
        .maybeSingle()
      if (!loanCheck) {
        return { success: false, error: 'Préstamo no encontrado' }
      }

      const { error: uErr } = await insforge.database
        .from('nexo_loan_installments')
        .update({
          paid_interest: Number(patch.paid_interest) || 0,
          paid_principal: Number(patch.paid_principal) || 0,
          paid_late_fee: Number(patch.paid_late_fee) || 0
        })
        .eq('loan_id', loanId)
        .eq('n', n)
      if (uErr) {
        return { success: false, error: uErr.message || 'No se pudo actualizar la cuota' }
      }

      const payRow = {
        id: String(payment.id),
        tenant_id: tenantId,
        loan_id: loanId,
        installment_n: n,
        amount: Number(payment.amount) || 0,
        breakdown: payment.breakdown || {},
        created_at: payment.created_at || new Date().toISOString()
      }
      const paymentOwnership = await assertScopedIdOwnership({
        table: 'nexo_payments',
        id: payRow.id,
        tenantId
      })
      if (!paymentOwnership.success) {
        return { success: false, error: paymentOwnership.error }
      }
      const { error: pErr } = await insforge.database.from('nexo_payments').insert([payRow])
      if (pErr) {
        return { success: false, error: pErr.message || 'No se pudo registrar el pago' }
      }

      const liquidated = payload?.liquidated === true
      if (liquidated) {
        await insforge.database
          .from('nexo_loan_installments')
          .delete()
          .eq('loan_id', loanId)
          .gt('n', n)
      }

      return { success: true }
    } catch (err) {
      return { success: false, error: err.message || 'Error al aplicar pago' }
    }
  })

  // Delete loan only if no payments exist
  ipcMain.handle('portfolio:deleteLoan', async (event, loanId) => {
    try {
      const t = await getPortfolioTenantId()
      if (t.error) {
        return { success: false, error: t.error }
      }
      const tenantId = t.tenantId
      const id = String(loanId || '')
      if (!id) {
        return { success: false, error: 'Id de préstamo no provisto' }
      }

      // Verify loan exists
      const { data: loanCheck } = await insforge.database
        .from('nexo_loans')
        .select('id')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle()
      if (!loanCheck) {
        return { success: false, error: 'Préstamo no encontrado' }
      }

      // Check for any payments linked to this loan
      const { data: payments, error: pErr } = await insforge.database
        .from('nexo_payments')
        .select('id')
        .eq('loan_id', id)
        .eq('tenant_id', tenantId)

      if (pErr) {
        return { success: false, error: pErr.message || 'Error al verificar pagos' }
      }
      if (payments && payments.length > 0) {
        return { success: false, error: 'No se puede eliminar: existen pagos registrados' }
      }

      // No payments; proceed to delete installments then loan
      const { error: delInstErr } = await insforge.database
        .from('nexo_loan_installments')
        .delete()
        .eq('loan_id', id)

      if (delInstErr) {
        return { success: false, error: delInstErr.message || 'Error al eliminar cuotas' }
      }

      const { error: delLoanErr } = await insforge.database
        .from('nexo_loans')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId)

      if (delLoanErr) {
        return { success: false, error: delLoanErr.message || 'Error al eliminar préstamo' }
      }

      return { success: true }
    } catch (err) {
      return { success: false, error: err.message || 'Error al eliminar préstamo' }
    }
  })

ipcMain.handle('portfolio:importLegacyState', async (event, state) => {
      try {
        if (!state || typeof state !== 'object') {
          return { success: false, error: 'Estado inválido' }
        }

        const t = await getPortfolioTenantId()
        if (t.error) {
          return { success: false, error: t.error }
        }
        const tenantId = t.tenantId

        if (state.settings && typeof state.settings === 'object') {
          await insforge.database.from('nexo_portfolio_settings').upsert([{ 
            ...portfolioDefaultSettingsRow(tenantId),
            ...state.settings,
            tenant_id: tenantId,
            updated_at: new Date().toISOString()
          }], { onConflict: 'tenant_id' })
        }

        for (const c of state.clients || []) {
          const clientRow = {
            id: String(c.id),
            tenant_id: tenantId,
            name: String(c.name || ''),
            document_type: c.document_type || null,
            document_number: c.document_number || null,
            phone: c.phone || null,
            address: c.address || null,
            email: c.email || null,
            created_at: c.created_at || new Date().toISOString()
          }
          const clientOwnership = await assertScopedIdOwnership({
            table: 'nexo_clients',
            id: clientRow.id,
            tenantId
          })
          if (!clientOwnership.success) {
            return { success: false, error: clientOwnership.error }
          }
          await insforge.database.from('nexo_clients').upsert([clientRow], { onConflict: 'id' })
        }

        for (const loan of state.loans || []) {
          const installments = loan.installments || []
          const { installments: _x, ...lf } = loan
          const loanRow = {
            id: String(lf.id),
            tenant_id: tenantId,
            client_id: String(lf.client_id),
            reference: lf.reference || null,
            client_name: String(lf.client_name || ''),
            product: lf.product || 'hipotecario',
            purpose: lf.purpose || '',
            principal: Number(lf.principal) || 0,
            term_months: Number(lf.term_months) || 12,
            interest_rate_pct: lf.interest_rate_pct != null ? Number(lf.interest_rate_pct) : null,
            late_fee_percent: lf.late_fee_percent != null ? Number(lf.late_fee_percent) : null,
            grace_days: lf.grace_days != null ? Number(lf.grace_days) : null,
            interest_mode: lf.interest_mode || 'annual',
            payment_frequency: lf.payment_frequency || 'monthly',
            start_date: lf.start_date || null,
            created_at: lf.created_at || new Date().toISOString(),
            contract_signer: lf.contract_signer || '',
            documents: Array.isArray(lf.documents) ? lf.documents : []
          }
          const loanOwnership = await assertScopedIdOwnership({
            table: 'nexo_loans',
            id: loanRow.id,
            tenantId
          })
          if (!loanOwnership.success) {
            return { success: false, error: loanOwnership.error }
          }
          await insforge.database.from('nexo_loans').upsert([loanRow], { onConflict: 'id' })
          await insforge.database.from('nexo_loan_installments').delete().eq('loan_id', loanRow.id)
          const instPayload = installments.map((i) => ({
            loan_id: loanRow.id,
            n: Number(i.n),
            due_date: i.due_date,
            principal_target: Number(i.principal_target) || 0,
            paid_interest: Number(i.paid_interest) || 0,
            paid_principal: Number(i.paid_principal) || 0,
            paid_late_fee: Number(i.paid_late_fee) || 0
          }))
          if (instPayload.length) {
            await insforge.database.from('nexo_loan_installments').insert(instPayload)
          }
        }

        for (const p of state.payments || []) {
          const payRow = {
            id: String(p.id),
            tenant_id: tenantId,
            loan_id: String(p.loan_id),
            installment_n: Number(p.installment_n),
            amount: Number(p.amount) || 0,
            breakdown: p.breakdown || {},
            created_at: p.created_at || new Date().toISOString()
          }
          const paymentOwnership = await assertScopedIdOwnership({
            table: 'nexo_payments',
            id: payRow.id,
            tenantId
          })
          if (!paymentOwnership.success) {
            return { success: false, error: paymentOwnership.error }
          }
          await insforge.database.from('nexo_payments').upsert([payRow], { onConflict: 'id' })
        }

        return { success: true }
      } catch (err) {
        return { success: false, error: err.message || 'Error al importar' }
      }
    })
}

async function bootstrap () {
  const { createClient } = await import('@insforge/sdk')
  insforge = createClient({
    baseUrl: 'https://nexo.azokia.com',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTYwMzR9.BWGjlHUNysNu8zQofMIxru4yimpk-Wd2ANZAqC0xXvQ'
  })
  registerAuthIpc()
  registerPortfolioIpc()
}

bootstrap()
  .then(() => {
    app.whenReady().then(() => {
      createWindow()
      setupAutoUpdater()
      if (app.isPackaged && updateRuntimeState.phase !== 'ready') {
        setTimeout(() => {
          void autoUpdater.checkForUpdates().catch((err) => {
            console.warn('[updater:auto-check]', err?.message || err)
          })
        }, 3500)
      } else if (!app.isPackaged) {
        setUpdateState({ phase: 'unsupported' })
      }

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow()
        }
      })
    })
  })
  .catch((err) => {
    console.error('No se pudo cargar InsForge SDK:', err)
    app.quit()
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})