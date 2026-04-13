const { app, BrowserWindow, ipcMain } = require('electron/main')
const path = require('node:path')

/**
 * El entry CJS del SDK hace require("@insforge/shared-schemas"), que es solo ESM y falla en Electron.
 * import() carga el bundle ESM (.mjs), que resuelve bien shared-schemas.
 */
let insforge = null

let mainWindow = null

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
    icon: path.join(__dirname, 'Logo.ico'),
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