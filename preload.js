const { contextBridge, ipcRenderer } = require('electron')

function isPrintThermalPayload (v) {
  if (v == null || typeof v !== 'object') return false
  const o = v
  if (typeof o.html !== 'string' || o.html.length === 0) return false
  if (o.html.length > 5_000_000) return false
  if (o.deviceName !== undefined && typeof o.deviceName !== 'string') return false
  if (o.silent !== undefined && typeof o.silent !== 'boolean') return false
  if (o.paperWidthMm !== undefined && (typeof o.paperWidthMm !== 'number' || !Number.isFinite(o.paperWidthMm))) return false
  return true
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  getVersions: () => process.versions,
  onWindowMaximized: (callback) => ipcRenderer.on('window-maximized', (_, isMaximized) => callback(isMaximized)),

  // Authentication - expone funciones de autenticación de forma segura
  auth: {
    signUp: (email, password, name, company) =>
      ipcRenderer.invoke('auth:signUp', { email, password, name, company }),
    signIn: (email, password) => ipcRenderer.invoke('auth:signIn', { email, password }),
    signOut: () => ipcRenderer.invoke('auth:signOut'),
    getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
    updateProfile: (profileData) => ipcRenderer.invoke('auth:updateProfile', profileData),
    requestPasswordChange: (currentPassword) =>
      ipcRenderer.invoke('auth:requestPasswordChange', { currentPassword }),
    confirmPasswordChange: (code, newPassword) =>
      ipcRenderer.invoke('auth:confirmPasswordChange', { code, newPassword }),
    updateSecuritySettings: (settings) =>
      ipcRenderer.invoke('auth:updateSecuritySettings', settings)
  },
  admin: {
    listCompanies: () => ipcRenderer.invoke('admin:listCompanies'),
    setCompanyBlocked: (companyId, blocked) => ipcRenderer.invoke('admin:setCompanyBlocked', { companyId, blocked }),
    deleteCompany: (companyId) => ipcRenderer.invoke('admin:deleteCompany', { companyId })
  },
  portfolio: {
    getState: () => ipcRenderer.invoke('portfolio:getState'),
    saveSettings: (partial) => ipcRenderer.invoke('portfolio:saveSettings', partial),
    createLoan: (payload) => ipcRenderer.invoke('portfolio:createLoan', payload),
    applyPayment: (payload) => ipcRenderer.invoke('portfolio:applyPayment', payload),
    importLegacyState: (state) => ipcRenderer.invoke('portfolio:importLegacyState', state)
  },
  listPrinters: () => ipcRenderer.invoke('printers:list'),
  printThermal: (opts) => {
    if (!isPrintThermalPayload(opts)) {
      return Promise.resolve({ ok: false, error: 'Payload de impresión inválido' })
    }
    return ipcRenderer.invoke('print:thermal', opts)
  },
  checkForUpdates: () => ipcRenderer.send('update:check-for-updates'),
  downloadUpdate: () => ipcRenderer.send('update:download-update'),
  installUpdate: () => ipcRenderer.send('update:install-update'),
  getUpdateState: () => ipcRenderer.invoke('update:get-state'),
  onUpdateEvents: (handlers = {}) => {
    const subs = []
    const bind = (channel, key, map = (x) => x) => {
      if (typeof handlers[key] !== 'function') return
      const fn = (_event, payload) => handlers[key](map(payload))
      ipcRenderer.on(channel, fn)
      subs.push(() => ipcRenderer.removeListener(channel, fn))
    }
    bind('update:checking', 'onChecking')
    bind('update:available', 'onUpdateAvailable')
    bind('update:not-available', 'onUpdateNotAvailable')
    bind('update:download-progress', 'onDownloadProgress')
    bind('update:downloaded', 'onUpdateDownloaded')
    bind('update:error', 'onUpdateError', (x) => {
      if (x && typeof x === 'object') return x
      return { message: String(x || 'Error desconocido') }
    })
    return () => {
      subs.forEach((unsub) => {
        try { unsub() } catch (_) {}
      })
    }
  }
})

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }
})