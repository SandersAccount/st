export class InputModal extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.options = [];
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    updateOptions(options) {
        this.options = options;
        const select = this.shadowRoot.querySelector('select');
        if (select) {
            select.innerHTML = this.options.map(option => 
                `<option value="${option.value}">${option.label}</option>`
            ).join('');
        }
    }

    show() {
        this.shadowRoot.querySelector('.modal').classList.add('show');
    }

    hide() {
        this.shadowRoot.querySelector('.modal').classList.remove('show');
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                .modal {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 1000;
                    justify-content: center;
                    align-items: center;
                }

                .modal.show {
                    display: flex;
                }

                .modal-content {
                    background: #2a2a2a;
                    padding: 20px;
                    border-radius: 8px;
                    width: 90%;
                    max-width: 400px;
                }

                h2 {
                    color: white;
                    margin-top: 0;
                }

                select {
                    width: 100%;
                    padding: 8px;
                    margin: 10px 0;
                    background: #3a3a3a;
                    border: 1px solid #4a4a4a;
                    color: white;
                    border-radius: 4px;
                }

                .button-group {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    margin-top: 20px;
                }

                button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }

                button.primary {
                    background: #4CAF50;
                    color: white;
                }

                button.secondary {
                    background: #666;
                    color: white;
                }

                button:hover {
                    opacity: 0.9;
                }
            </style>
            <div class="modal">
                <div class="modal-content">
                    <h2>${this.getAttribute('title') || 'Select Collection'}</h2>
                    <select>
                        ${this.options.map(option => 
                            `<option value="${option.value}">${option.label}</option>`
                        ).join('')}
                    </select>
                    <div class="button-group">
                        <button class="secondary" data-action="cancel">Cancel</button>
                        <button class="primary" data-action="submit">Move</button>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        const modal = this.shadowRoot.querySelector('.modal');
        const cancelButton = this.shadowRoot.querySelector('button[data-action="cancel"]');
        const submitButton = this.shadowRoot.querySelector('button[data-action="submit"]');

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hide();
            }
        });

        cancelButton.addEventListener('click', () => {
            this.hide();
        });

        submitButton.addEventListener('click', () => {
            const select = this.shadowRoot.querySelector('select');
            const selectedValue = select.value;
            
            this.dispatchEvent(new CustomEvent('modalSubmit', {
                detail: { value: selectedValue },
                bubbles: true,
                composed: true
            }));
        });
    }
}

customElements.define('input-modal', InputModal);
