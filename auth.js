// auth.js - Módulo de autenticación para el renderer process
import { createClient } from '@insforge/sdk'

// Configuración de InsForge
const insforgeConfig = {
  baseUrl: 'https://nexo.azokia.com',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTYwMzR9.BWGjlHUNysNu8zQofMIxru4yimpk-Wd2ANZAqC0xXvQ'
}

// Crear cliente de InsForge
const insforge = createClient(insforgeConfig)

// Servicio de autenticación
const authService = {
  // Registro de usuario
  async signUp({ email, password, name, company }) {
    try {
      const { data, error } = await insforge.auth.signUp({
        email,
        password,
        name,
        redirectTo: window.location.href
      })

      if (error) {
        console.error('Error en signUp:', error)
        return { success: false, error: error.message || 'Error al registrar usuario' }
      }

      // Guardar información adicional en metadata
      if (data?.user && company) {
        console.log('Usuario registrado con éxito:', data.user)
        // Aquí podrías actualizar el perfil con la empresa usando setProfile
        await this.updateProfile({ company })
      }

      return { success: true, data }
    } catch (error) {
      console.error('Excepción en signUp:', error)
      return { success: false, error: error.message || 'Error al registrar usuario' }
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
        console.error('Error en signIn:', error)
        return { success: false, error: error.message || 'Credenciales inválidas' }
      }

      // Guardar sesión en localStorage
      if (data?.accessToken) {
        localStorage.setItem('accessToken', data.accessToken)
        localStorage.setItem('user', JSON.stringify(data.user))
      }

      return { success: true, data }
    } catch (error) {
      console.error('Excepción en signIn:', error)
      return { success: false, error: error.message || 'Error al iniciar sesión' }
    }
  },

  // Cerrar sesión
  async signOut() {
    try {
      const { error } = await insforge.auth.signOut()

      if (error) {
        console.error('Error en signOut:', error)
        return { success: false, error: error.message || 'Error al cerrar sesión' }
      }

      // Limpiar localStorage
      localStorage.removeItem('accessToken')
      localStorage.removeItem('user')

      return { success: true }
    } catch (error) {
      console.error('Excepción en signOut:', error)
      return { success: false, error: error.message || 'Error al cerrar sesión' }
    }
  },

  // Obtener usuario actual
  async getCurrentUser() {
    try {
      const { data, error } = await insforge.auth.getCurrentUser()

      if (error) {
        console.error('Error en getCurrentUser:', error)
        return { success: false, error: error.message || 'Error al obtener usuario' }
      }

      return { success: true, user: data.user }
    } catch (error) {
      console.error('Excepción en getCurrentUser:', error)
      return { success: false, error: error.message || 'Error al obtener usuario' }
    }
  },

  // Actualizar perfil del usuario
  async updateProfile(profileData) {
    try {
      const { data, error } = await insforge.auth.setProfile(profileData)

      if (error) {
        console.error('Error en updateProfile:', error)
        return { success: false, error: error.message || 'Error al actualizar perfil' }
      }

      // Actualizar localStorage
      const user = this.getStoredUser()
      if (user) {
        const updatedUser = { ...user, profile: { ...user.profile, ...profileData } }
        localStorage.setItem('user', JSON.stringify(updatedUser))
      }

      return { success: true, data }
    } catch (error) {
      console.error('Excepción en updateProfile:', error)
      return { success: false, error: error.message || 'Error al actualizar perfil' }
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
    try {
      return user ? JSON.parse(user) : null
    } catch (error) {
      console.error('Error al parsear usuario del localStorage:', error)
      return null
    }
  },

  // Obtener token del localStorage
  getStoredToken() {
    return localStorage.getItem('accessToken')
  },

  // Verificar si el email está verificado
  isEmailVerified() {
    const user = this.getStoredUser()
    return user?.emailVerified || false
  }
}

// Exportar para uso global
window.authService = authService
window.insforge = insforge

export { authService, insforge }