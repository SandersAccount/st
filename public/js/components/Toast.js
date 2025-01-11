export class Toast extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    show(message, type = 'success', duration = 4000) {
        const style = document.createElement('style');
        style.textContent = `
            .toast {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #333;
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                z-index: 10000;
                transition: opacity 0.3s, transform 0.3s;
                opacity: 0;
            }
            .toast.show {
                opacity: 1;
            }
            .toast.success { background: #4CAF50; }
            .toast.error { background: #f44336; }
            .toast.warning { background: #ff9800; }
            .toast.info { background: #2196F3; }
        `;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        this.shadowRoot.innerHTML = '';
        this.shadowRoot.appendChild(style);
        this.shadowRoot.appendChild(toast);

        // Show toast
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Hide and remove toast
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                // Remove the entire custom element from DOM
                this.remove();
            }, 300);
        }, duration);
    }
}

export function showToast(message, type = 'success') {
    // Remove any existing toasts
    const existingToasts = document.querySelectorAll('toast-notification');
    existingToasts.forEach(toast => toast.remove());

    // Create and show new toast
    const toast = document.createElement('toast-notification');
    document.body.appendChild(toast);
    toast.show(message, type, 4000);
}

customElements.define('toast-notification', Toast);
