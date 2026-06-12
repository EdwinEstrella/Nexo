(function () {
    const tones = new Set(['info', 'success', 'warning', 'error'])
    const state = {
        root: null,
        toastStack: null,
        activeModal: null,
        lastFocused: null
    }

    function normalizeOptions (input, fallbackTitle = 'Nexo') {
        if (typeof input === 'string') return { title: fallbackTitle, message: input }
        return input && typeof input === 'object' ? { ...input } : { title: fallbackTitle, message: '' }
    }

    function toneOf (tone) {
        return tones.has(tone) ? tone : 'info'
    }

    function ensureSurface () {
        if (state.root && state.toastStack) return

        state.root = document.getElementById('nexo-dialog-root') || document.createElement('div')
        state.root.id = 'nexo-dialog-root'
        state.root.className = 'nexo-dialog-root'
        if (!state.root.isConnected) document.body.appendChild(state.root)

        state.toastStack = document.getElementById('nexo-toast-stack') || document.createElement('div')
        state.toastStack.id = 'nexo-toast-stack'
        state.toastStack.className = 'nexo-toast-stack'
        state.toastStack.setAttribute('aria-live', 'polite')
        state.toastStack.setAttribute('aria-relevant', 'additions')
        if (!state.toastStack.isConnected) document.body.appendChild(state.toastStack)
    }

    function createButton (label, variant) {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = `nexo-dialog__button nexo-dialog__button--${variant}`
        button.textContent = label
        return button
    }

    function closeModal (modal, value, resolve) {
        if (!modal || !modal.isConnected) return
        modal.remove()
        state.activeModal = null
        const target = state.lastFocused
        state.lastFocused = null
        if (target && typeof target.focus === 'function' && target.isConnected) {
            try { target.focus() } catch (_) {}
        }
        resolve(value)
    }

    function showModal (options, config) {
        ensureSurface()
        const opts = normalizeOptions(options)
        const tone = toneOf(opts.tone || config.tone || 'info')

        return new Promise((resolve) => {
            if (state.activeModal?.close) state.activeModal.close(config.cancelValue)
            state.lastFocused = document.activeElement

            const overlay = document.createElement('div')
            overlay.className = `nexo-dialog nexo-dialog--${tone}`
            overlay.setAttribute('role', 'presentation')

            const panel = document.createElement('section')
            panel.className = 'nexo-dialog__panel'
            panel.setAttribute('role', 'dialog')
            panel.setAttribute('aria-modal', 'true')

            const title = document.createElement('h2')
            title.className = 'nexo-dialog__title'
            title.textContent = opts.title || config.defaultTitle
            title.id = `nexo-dialog-title-${Date.now()}`
            panel.setAttribute('aria-labelledby', title.id)

            const message = document.createElement('p')
            message.className = 'nexo-dialog__message'
            message.textContent = opts.message || ''

            const actions = document.createElement('div')
            actions.className = 'nexo-dialog__actions'

            let input = null
            if (config.kind === 'prompt') {
                const label = document.createElement('label')
                label.className = 'nexo-dialog__label'
                label.textContent = opts.label || 'Value'

                input = document.createElement('input')
                input.className = 'nexo-dialog__input'
                input.type = 'text'
                input.value = opts.defaultValue || ''
                input.placeholder = opts.placeholder || ''
                input.required = Boolean(opts.required)

                label.appendChild(input)
                panel.append(title, message, label)
            } else {
                panel.append(title, message)
            }

            const cancelText = opts.cancelText || config.cancelText
            if (cancelText) {
                const cancel = createButton(cancelText, 'secondary')
                cancel.addEventListener('click', () => closeModal(overlay, config.cancelValue, resolve))
                actions.appendChild(cancel)
            }

            const confirm = createButton(opts.confirmText || config.confirmText, tone === 'error' || tone === 'warning' ? 'danger' : 'primary')
            confirm.addEventListener('click', () => {
                if (config.kind === 'prompt') {
                    const value = String(input?.value || '').trim()
                    if (opts.required && !value) {
                        input?.focus()
                        return
                    }
                    closeModal(overlay, value || null, resolve)
                    return
                }
                closeModal(overlay, config.confirmValue, resolve)
            })
            actions.appendChild(confirm)
            panel.appendChild(actions)
            overlay.appendChild(panel)

            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) closeModal(overlay, config.cancelValue, resolve)
            })
            overlay.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    event.preventDefault()
                    closeModal(overlay, config.cancelValue, resolve)
                    return
                }
                if (event.key === 'Tab') trapFocus(event, panel)
            })

            overlay.close = (value) => closeModal(overlay, value, resolve)
            state.activeModal = overlay
            state.root.appendChild(overlay)
            window.setTimeout(() => (input || confirm).focus(), 0)
        })
    }

    function trapFocus (event, panel) {
        const focusable = [...panel.querySelectorAll('button, input, textarea, select, [tabindex]:not([tabindex="-1"])')]
            .filter((el) => !el.disabled && el.offsetParent !== null)
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
        }
    }

    function notify (options) {
        ensureSurface()
        const opts = normalizeOptions(options)
        const mode = opts.mode || 'toast'
        if (mode === 'modal') return alertDialog(opts)

        const tone = toneOf(opts.tone || 'info')
        const toast = document.createElement('article')
        toast.className = `nexo-toast nexo-toast--${tone}`
        toast.setAttribute('role', tone === 'error' ? 'alert' : 'status')

        const title = document.createElement('strong')
        title.className = 'nexo-toast__title'
        title.textContent = opts.title || (tone === 'success' ? 'Success' : 'Notice')

        const message = document.createElement('p')
        message.className = 'nexo-toast__message'
        message.textContent = opts.message || ''

        const close = createButton('Close', 'ghost')
        close.className = 'nexo-toast__close'
        close.setAttribute('aria-label', 'Close notification')
        close.textContent = '×'
        close.addEventListener('click', () => toast.remove())

        toast.append(title, message, close)
        state.toastStack.appendChild(toast)
        window.setTimeout(() => toast.remove(), Number(opts.durationMs) || 4500)
        return Promise.resolve()
    }

    function alertDialog (options) {
        return showModal(options, {
            kind: 'alert',
            tone: 'info',
            defaultTitle: 'Notice',
            confirmText: 'OK',
            confirmValue: undefined,
            cancelValue: undefined
        })
    }

    function confirmDialog (options) {
        return showModal(options, {
            kind: 'confirm',
            tone: 'warning',
            defaultTitle: 'Confirm action',
            confirmText: 'Confirm',
            cancelText: 'Cancel',
            confirmValue: true,
            cancelValue: false
        })
    }

    function promptDialog (options) {
        return showModal(options, {
            kind: 'prompt',
            tone: 'info',
            defaultTitle: 'Input required',
            confirmText: 'Continue',
            cancelText: 'Cancel',
            cancelValue: null
        })
    }

    window.NexoDialogs = {
        notify,
        alert: alertDialog,
        confirm: confirmDialog,
        prompt: promptDialog
    }
})()
