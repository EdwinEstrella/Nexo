/**
 * Sidebar — variantes:
 * - admin: panel super admin (NEXO, navegación operativa)
 * - portal: cliente SaaS / portal institucional (Figma 1:1281)
 */

class Sidebar {
    constructor (options = {}) {
        this.container = options.container || document.body
        this.variant = options.variant === 'portal' ? 'portal' : 'admin'
        this.activePage = options.activePage || 'dashboard'
        this.onNavigate = options.onNavigate || this.defaultNavigation
        this.portalProfile = options.portalProfile || {
            name: 'Usuario',
            role: 'Institución',
            initials: 'NX'
        }

        this.adminPages = [
            { id: 'companies', label: 'Empresas', icon: this.getCompaniesIcon() }
        ]

        this.portalPages = [
            { id: 'dashboard', label: 'Dashboard', icon: this.getDashboardIcon() },
            { id: 'loans', label: 'Préstamos', icon: this.getLoansIcon() },
            { id: 'analytics', label: 'Análisis', icon: this.getAnalyticsIcon() },
            { id: 'clients', label: 'Clientes', icon: this.getClientsIcon() },
            { id: 'loan-request', label: 'Nuevo préstamo', icon: this.getNewLoanIcon() },
            { id: 'settings', label: 'Configuración', icon: this.getSettingsIcon() }
        ]

        this.adminFooterLinks = [
            { id: 'support', label: 'Soporte', icon: this.getSupportIcon() },
            { id: 'signout', label: 'Cerrar Sesión', icon: this.getSignOutIcon() }
        ]

        this.init()
    }

    init () {
        this.render()
        this.attachEvents()
    }

    render () {
        if (this.variant === 'portal') {
            this.renderPortal()
        } else {
            this.renderAdmin()
        }
        this.adjustMainContent()
    }

    renderAdmin () {
        const sidebarHTML = `
            <aside class="sidebar sidebar--admin" id="sidebar" data-sidebar-variant="admin">
                <div class="sidebar-header">
                    <a href="index.html" class="sidebar-logo">
                        <div class="sidebar-logo-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="#000e24" stroke-width="2.5">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                <polyline points="9,22 9,12 15,12 15,22"/>
                            </svg>
                        </div>
                        <span class="sidebar-logo-text">NEXO</span>
                    </a>
                </div>

                <nav class="sidebar-nav">
                    ${this.adminPages.map(page => `
                        <button
                            type="button"
                            class="sidebar-link ${page.id === this.activePage ? 'active' : ''}"
                            data-page="${page.id}"
                            aria-label="${page.label}"
                            aria-current="${page.id === this.activePage ? 'page' : 'false'}"
                        >
                            ${page.icon}
                            <span>${page.label}</span>
                        </button>
                    `).join('')}
                </nav>

                <div class="sidebar-footer">
                    ${this.adminFooterLinks.map(link => `
                        <button
                            type="button"
                            class="sidebar-link"
                            data-action="${link.id}"
                            aria-label="${link.label}"
                        >
                            ${link.icon}
                            <span>${link.label}</span>
                        </button>
                    `).join('')}
                </div>
            </aside>

            <button type="button" class="sidebar-toggle" id="sidebar-toggle" aria-label="Abrir o cerrar menú">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="3" y1="12" x2="21" y2="12"/>
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
            </button>

            <div class="sidebar-overlay" id="sidebar-overlay" aria-hidden="true"></div>
        `
        this.container.insertAdjacentHTML('afterbegin', sidebarHTML)
    }

    renderPortal () {
        const sidebarHTML = `
            <aside class="sidebar sidebar--portal" id="sidebar" data-node-id="1:1281" data-sidebar-variant="portal">
                <div class="sidebar-portal-head">
                    <div class="sidebar-portal-brand">
                        <div class="sidebar-portal-title">Lending Ledger</div>
                        <div class="sidebar-portal-tagline">Portal institucional</div>
                    </div>
                </div>

                <nav class="sidebar-nav sidebar-nav--portal">
                    ${this.portalPages.map(page => `
                        <button
                            type="button"
                            class="sidebar-link sidebar-link--portal ${page.id === this.activePage ? 'active' : ''}"
                            data-page="${page.id}"
                            aria-label="${page.label}"
                            aria-current="${page.id === this.activePage ? 'page' : 'false'}"
                        >
                            ${page.icon}
                            <span>${page.label}</span>
                        </button>
                    `).join('')}
                </nav>

                <div class="sidebar-portal-footer">
                    <button type="button" class="sidebar-portal-signout" data-action="signout">
                        Cerrar sesión
                    </button>
                </div>
            </aside>

            <button type="button" class="sidebar-toggle sidebar-toggle--portal" id="sidebar-toggle" aria-label="Abrir o cerrar menú">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="3" y1="12" x2="21" y2="12"/>
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
            </button>

            <div class="sidebar-overlay" id="sidebar-overlay" aria-hidden="true"></div>
        `
        this.container.insertAdjacentHTML('afterbegin', sidebarHTML)
    }

    attachEvents () {
        document.querySelectorAll('#sidebar .sidebar-link[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                const pageId = e.currentTarget.dataset.page
                this.navigate(pageId)
            })
        })

        document.querySelectorAll('#sidebar [data-action]').forEach(el => {
            el.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action
                this.handleAction(action)
            })
        })

        const toggle = document.getElementById('sidebar-toggle')
        const overlay = document.getElementById('sidebar-overlay')
        const sidebar = document.getElementById('sidebar')

        if (toggle && sidebar) {
            toggle.addEventListener('click', () => {
                sidebar.classList.toggle('open')
                overlay.classList.toggle('show')
            })
        }

        if (overlay && sidebar) {
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open')
                overlay.classList.remove('show')
            })
        }
    }

    /**
     * Solo marca el ítem activo (p. ej. historial popstate o navegación SPA sin recargar).
     */
    setActiveNavOnly (pageId) {
        document.querySelectorAll('#sidebar .sidebar-link[data-page]').forEach(link => {
            link.classList.remove('active')
            link.setAttribute('aria-current', 'false')
        })

        const activeLink = document.querySelector(`#sidebar [data-page="${pageId}"]`)
        if (activeLink) {
            activeLink.classList.add('active')
            activeLink.setAttribute('aria-current', 'page')
        }

        this.activePage = pageId
    }

    navigate (pageId) {
        this.setActiveNavOnly(pageId)
        this.onNavigate(pageId)

        const sidebar = document.getElementById('sidebar')
        const overlay = document.getElementById('sidebar-overlay')
        if (sidebar) sidebar.classList.remove('open')
        if (overlay) overlay.classList.remove('show')
    }

    updatePortalProfile ({ name, role, initials }) {
        if (name != null) this.portalProfile.name = name
        if (role != null) this.portalProfile.role = role
        if (initials != null) this.portalProfile.initials = initials
    }

    handleAction (action) {
        switch (action) {
            case 'support':
                console.log('Abrir soporte')
                break
            case 'signout':
                void this.signOut()
                break
        }
    }

    async signOut () {
        if (!confirm('¿Cerrar sesión?')) return
        try {
            if (typeof window !== 'undefined' && window.electronAPI?.auth?.signOut) {
                const r = await window.electronAPI.auth.signOut()
                if (r && r.success === false) console.warn('[signOut]', r.error)
            }
        } catch (e) {
            console.warn('[signOut]', e)
        }
        try {
            localStorage.removeItem('userSession')
            localStorage.removeItem('user')
        } catch (_) {}
        window.location.href = 'index.html'
    }

    defaultNavigation (pageId) {
        console.log('Navegando a:', pageId)
    }

    adjustMainContent () {
        const mainContent = document.querySelector('.main-content') || document.querySelector('main') || document.querySelector('.content')
        if (mainContent && !mainContent.classList.contains('main-content-with-sidebar')) {
            mainContent.classList.add('main-content-with-sidebar')
        }
    }

    getDashboardIcon () {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
            </svg>
        `
    }

    getLoansIcon () {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <rect x="2" y="5" width="20" height="14" rx="2"/>
                <line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
        `
    }

    getClientsIcon () {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
        `
    }

    getDocumentsIcon () {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
        `
    }

    getNewLoanIcon () {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
        `
    }

    getCompaniesIcon () {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M3 21h18"/>
                <rect x="5" y="7" width="4" height="14"/>
                <rect x="10" y="3" width="4" height="18"/>
                <rect x="15" y="10" width="4" height="11"/>
            </svg>
        `
    }

    getUsersIcon () {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
        `
    }

    getPaymentsIcon () {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
        `
    }

    getPaymentIcon () {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                <line x1="1" y1="10" x2="23" y2="10"/>
                <circle cx="8" cy="21" r="1"/>
                <circle cx="19" cy="21" r="1"/>
                <path d="M2 8l1 1 4-4"/>
            </svg>
        `
    }

    getAnalyticsIcon () {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
        `
    }

    getSettingsIcon () {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
        `
    }

    getSupportIcon () {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
        `
    }

    getSignOutIcon () {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16,17 21,12 16,7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
        `
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Sidebar
}
