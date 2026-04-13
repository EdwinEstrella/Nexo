/**
 * Multi-tenant Nexo:
 * - Tabla public.nexo_profiles (fuente de verdad de app_role vía main process + SDK DB).
 * - app_role "empresa" → portal SaaS; "super_admin" → solo dashboard NEXO (legacy: "app_admin").
 */
;(function (global) {
    const APP_ROLE_SUPER_ADMIN = 'super_admin'
    const APP_ROLE_EMPRESA = 'empresa'
    /** @deprecated compat con perfiles antiguos */
    const APP_ROLE_ADMIN_LEGACY = 'app_admin'

    function profile (user) {
        if (!user || typeof user !== 'object') return {}
        const p = user.profile && typeof user.profile === 'object' ? user.profile : {}
        const m =
            (user.user_metadata && typeof user.user_metadata === 'object' && user.user_metadata) ||
            (user.metadata && typeof user.metadata === 'object' && user.metadata) ||
            {}
        return { ...m, ...p }
    }

    function appRole (user) {
        const r = profile(user).app_role
        return typeof r === 'string' && r ? r : null
    }

    function isSuperAdmin (user) {
        const r = appRole(user)
        return r === APP_ROLE_SUPER_ADMIN || r === APP_ROLE_ADMIN_LEGACY
    }

    function homePath (user) {
        if (isSuperAdmin(user)) return 'dashboard.html'
        return 'portal.html'
    }

    global.NexoAuth = {
        APP_ROLE_SUPER_ADMIN,
        APP_ROLE_EMPRESA,
        APP_ROLE_ADMIN_LEGACY,
        profile,
        appRole,
        homePath,
        isSuperAdmin,
        /** @deprecated use isSuperAdmin */
        isAppAdmin: isSuperAdmin
    }
})(typeof window !== 'undefined' ? window : globalThis)
