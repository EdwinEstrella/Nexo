/**
 * Sidebar Component - Shared Navigation
 * Implements the Nexo sidebar navigation with Spanish localization
 */

class Sidebar {
    constructor(options = {}) {
        this.container = options.container || document.body;
        this.activePage = options.activePage || 'dashboard';
        this.onNavigate = options.onNavigate || this.defaultNavigation;
        this.pages = [
            { id: 'dashboard', label: 'Dashboard', icon: this.getDashboardIcon() },
            { id: 'companies', label: 'Empresas', icon: this.getCompaniesIcon() },
            { id: 'users', label: 'Usuarios', icon: this.getUsersIcon() },
            { id: 'payments', label: 'Pagos', icon: this.getPaymentsIcon() },
            { id: 'analytics', label: 'Analíticas', icon: this.getAnalyticsIcon() },
            { id: 'settings', label: 'Configuración', icon: this.getSettingsIcon() }
        ];
        this.footerLinks = [
            { id: 'support', label: 'Soporte', icon: this.getSupportIcon() },
            { id: 'signout', label: 'Cerrar Sesión', icon: this.getSignOutIcon() }
        ];

        this.init();
    }

    init() {
        this.render();
        this.attachEvents();
    }

    render() {
        const sidebarHTML = `
            <aside class="sidebar" id="sidebar">
                <!-- Header -->
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

                <!-- Navigation -->
                <nav class="sidebar-nav">
                    ${this.pages.map(page => `
                        <button
                            class="sidebar-link ${page.id === this.activePage ? 'active' : ''}"
                            data-page="${page.id}"
                            aria-label="${page.label}"
                        >
                            ${page.icon}
                            <span>${page.label}</span>
                        </button>
                    `).join('')}
                </nav>

                <!-- Footer -->
                <div class="sidebar-footer">
                    ${this.footerLinks.map(link => `
                        <button
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

            <!-- Mobile Toggle -->
            <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Toggle menu">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="3" y1="12" x2="21" y2="12"/>
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
            </button>

            <!-- Overlay -->
            <div class="sidebar-overlay" id="sidebar-overlay"></div>
        `;

        this.container.insertAdjacentHTML('afterbegin', sidebarHTML);
        this.adjustMainContent();
    }

    attachEvents() {
        // Navigation clicks
        document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                const pageId = e.currentTarget.dataset.page;
                this.navigate(pageId);
            });
        });

        // Footer action clicks
        document.querySelectorAll('.sidebar-link[data-action]').forEach(link => {
            link.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleAction(action);
            });
        });

        // Mobile toggle
        const toggle = document.getElementById('sidebar-toggle');
        const overlay = document.getElementById('sidebar-overlay');
        const sidebar = document.getElementById('sidebar');

        if (toggle) {
            toggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                overlay.classList.toggle('show');
            });
        }

        if (overlay) {
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('show');
            });
        }
    }

    navigate(pageId) {
        // Update active state
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.classList.remove('active');
        });

        const activeLink = document.querySelector(`[data-page="${pageId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        // Call navigation handler
        this.onNavigate(pageId);

        // Close mobile menu
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('show');
    }

    handleAction(action) {
        switch(action) {
            case 'support':
                console.log('Abrir soporte');
                // TODO: Implementar soporte
                break;
            case 'signout':
                if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
                    // Clear session and redirect to login
                    localStorage.removeItem('userSession');
                    window.location.href = 'index.html';
                }
                break;
        }
    }

    defaultNavigation(pageId) {
        console.log('Navegando a:', pageId);
        // Default navigation - can be overridden
    }

    adjustMainContent() {
        // Add margin to main content if it exists
        const mainContent = document.querySelector('.main-content') || document.querySelector('main') || document.querySelector('.content');
        if (mainContent && !mainContent.classList.contains('main-content-with-sidebar')) {
            mainContent.classList.add('main-content-with-sidebar');
        }
    }

    // SVG Icons
    getDashboardIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
            </svg>
        `;
    }

    getCompaniesIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 21h18"/>
                <rect x="5" y="7" width="4" height="14"/>
                <rect x="10" y="3" width="4" height="18"/>
                <rect x="15" y="10" width="4" height="11"/>
            </svg>
        `;
    }

    getUsersIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
        `;
    }

    getPaymentsIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
        `;
    }

    getAnalyticsIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
        `;
    }

    getSettingsIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
        `;
    }

    getSupportIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
        `;
    }

    getSignOutIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16,17 21,12 16,7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
        `;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Sidebar;
}