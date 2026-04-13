const { createClient } = require('@insforge/sdk')

// Configuración de InsForge
const insforgeConfig = {
  baseUrl: 'https://nexo.azokia.com',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTYwMzR9.BWGjlHUNysNu8zQofMIxru4yimpk-Wd2ANZAqC0xXvQ'
}

// Crear cliente de InsForge
const insforge = createClient(insforgeConfig)

// Funciones de autenticación
const authService = {
  // Registro de usuario
  async signUp({ email, password, name }) {
    try {
      const { data, error } = await insforge.auth.signUp({
        email,
        password,
        name,
        redirectTo: window.location.href
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: error.message }
    }
  },

  // Iniciar sesión
  async signIn({ email, password }) {
    try {
      const { data, error } = await insforge.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        return { success: false, error: error.message }
      }

      // Guardar sesión
      if (data?.accessToken) {
        localStorage.setItem('accessToken', data.accessToken)
        localStorage.setItem('user', JSON.stringify(data.user))
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: error.message }
    }
  },

  // Cerrar sesión
  async signOut() {
    try {
      const { error } = await insforge.auth.signOut()

      if (error) {
        return { success: false, error: error.message }
      }

      // Limpiar localStorage
      localStorage.removeItem('accessToken')
      localStorage.removeItem('user')

      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  },

  // Obtener usuario actual
  async getCurrentUser() {
    try {
      const { data, error } = await insforge.auth.getCurrentUser()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, user: data.user }
    } catch (error) {
      return { success: false, error: error.message }
    }
  },

  // Verificar si hay sesión activa
  isAuthenticated() {
    const token = localStorage.getItem('accessToken')
    const user = localStorage.getItem('user')
    return !!(token && user)
  },

  // Obtener usuario del localStorage
  getStoredUser() {
    const user = localStorage.getItem('user')
    return user ? JSON.parse(user) : null
  },

  // Obtener token del localStorage
  getStoredToken() {
    return localStorage.getItem('accessToken')
  }
}

module.exports = { insforge, authService }