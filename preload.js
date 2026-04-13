const { contextBridge, ipcRenderer } = require('electron')

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
    updateProfile: (profileData) => ipcRenderer.invoke('auth:updateProfile', profileData)
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