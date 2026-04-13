// auth-loader.js - Carga el módulo de autenticación y lo inicializa
import { authService } from './auth.js'

// Hacer disponible authService globalmente
window.authService = authService

console.log('AuthService cargado y disponible globalmente')

// Emitir evento personalizado cuando el servicio está listo
window.dispatchEvent(new CustomEvent('authServiceReady'))