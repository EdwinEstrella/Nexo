const { app, BrowserWindow, ipcMain } = require('electron/main')
const { nativeImage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

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

function registerAuthIpc () {
  ipcMain.handle('admin:listCompanies', async () => {
    try {
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

  ipcMain.handle('auth:signUp', async (event, { email, password, name, company }) => {
  try {
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
      if (company && String(company).trim()) {
        const tenant = await ensureTenantForCompany(company)
        if (tenant?.id) {
          await ensureTenantMembership({ tenantId: tenant.id, userId: u.id })
          await insforge.database
            .from('nexo_profiles')
            .update({ default_tenant_id: tenant.id })
            .eq('user_id', u.id)
        }
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
}

async function bootstrap () {
  const { createClient } = await import('@insforge/sdk')
  insforge = createClient({
    baseUrl: 'https://nexo.azokia.com',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTYwMzR9.BWGjlHUNysNu8zQofMIxru4yimpk-Wd2ANZAqC0xXvQ'
  })
  registerAuthIpc()
}

bootstrap()
  .then(() => {
    app.whenReady().then(() => {
      createWindow()

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