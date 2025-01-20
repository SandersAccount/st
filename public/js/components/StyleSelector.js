export class StyleSelector extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.currentIndex = 0;
        this.styles = [];
        this.selectedStyle = null;

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    position: relative;
                }

                .style-carousel {
                    position: relative;
                    width: 100%;
                    margin: 0 auto;
                }

                .style-container {
                    display: flex;
                    gap: 10px;
                    overflow-x: hidden;
                    scroll-behavior: smooth;
                    padding: 10px 0;
                    align-items: flex-start;
                    position: relative;
                }

                .nav-button {
                    position: absolute;
                    top: 40%;
                    transform: translateY(-50%);
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: rgba(0, 0, 0, 0.6);
                    border: none;
                    cursor: pointer;
                    padding: 0;
                    z-index: 2;
                }

                .nav-button::before {
                    content: '';
                    width: 10px;
                    height: 10px;
                    border: solid #fff;
                    border-width: 0 2px 2px 0;
                    display: inline-block;
                    position: absolute;
                    top: 50%;
                    left: 50%;
                }

                .nav-button.prev::before {
                    transform: translate(-25%, -50%) rotate(135deg);
                }

                .nav-button.next::before {
                    transform: translate(-75%, -50%) rotate(-45deg);
                }

                .nav-button:hover {
                    background: rgba(0, 0, 0, 0.8);
                }

                .nav-button.prev {
                    left: -16px;
                }

                .nav-button.next {
                    right: -16px;
                }

                .style-item {
                    min-width: 90px;
                    width: 90px;
                    text-align: center;
                    cursor: pointer;
                    transition: transform 0.2s;
                    padding: 0;
                    margin: 0;
                    position: relative;
                }

                .style-item:hover {
                    transform: translateY(-2px);
                }

                .style-item img {
                    width: 90px;
                    height: 90px;
                    border-radius: 8px;
                    object-fit: cover;
                    border: 3px solid transparent;
                    transition: border-color 0.2s;
                    background: rgb(51 51 51);
                    padding: 0;
                    margin: 0;
                    display: block;
                }

                .style-item.selected img {
                    border-color: #4CAF50;
                }

                .style-item .style-name {
                    margin-top: 8px;
                    font-size: 0.9rem;
                    color: #fff;
                    opacity: 0.8;
                    width: 90px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .loading {
                    text-align: center;
                    padding: 20px;
                    color: #999;
                }
            </style>
            <div class="style-carousel">
                <button class="nav-button prev" id="prevBtn"></button>
                <div class="style-container" id="styleContainer">
                    <div class="loading">Loading styles...</div>
                </div>
                <button class="nav-button next" id="nextBtn"></button>
            </div>
        `;

        this.setupNavigation();
    }

    async connectedCallback() {
        await this.loadStyles();
    }

    setupNavigation() {
        const container = this.shadowRoot.querySelector('.style-container');
        const prevBtn = this.shadowRoot.querySelector('.nav-button.prev');
        const nextBtn = this.shadowRoot.querySelector('.nav-button.next');

        prevBtn.addEventListener('click', () => {
            container.scrollBy({ left: -320, behavior: 'smooth' });
        });

        nextBtn.addEventListener('click', () => {
            container.scrollBy({ left: 320, behavior: 'smooth' });
        });
    }

    async loadStyles() {
        try {
            // Always fetch styles ordered by the order field
            const response = await fetch('/api/styles?sortBy=order&sortOrder=asc');
            if (!response.ok) {
                throw new Error('Failed to fetch styles');
            }
            this.styles = await response.json();

            // Add "No Style" option at the beginning
            this.styles.unshift({
                _id: 'none',
                name: 'No Style',
                prompt: '',
                imageUrl: '/images/no-style.png'
            });

            this.renderStyles();
        } catch (error) {
            console.error('Error loading styles:', error);
            const container = this.shadowRoot.querySelector('.style-container');
            container.innerHTML = `
                <div class="loading">
                    Failed to load styles. Please try again later.
                </div>
            `;
        }
    }

    renderStyles() {
        const container = this.shadowRoot.querySelector('.style-container');
        container.innerHTML = this.styles.map(style => {
            const imageUrl = style.imageUrl || '/images/placeholder.png';
            return `
                <div class="style-item ${this.selectedStyle?._id === style._id ? 'selected' : ''}" data-id="${style._id}">
                    <img 
                        src="${imageUrl}" 
                        alt="${style.name}"
                        onerror="this.onerror=null; this.src='/images/placeholder.png';"
                    >
                    <div class="style-name">${style.name}</div>
                </div>
            `;
        }).join('');

        // Add click handlers for style selection
        container.querySelectorAll('.style-item').forEach(item => {
            item.addEventListener('click', () => {
                const styleId = item.dataset.id;
                this.selectedStyle = this.styles.find(s => s._id === styleId);
                
                // Update selected state visually
                container.querySelectorAll('.style-item').forEach(i => {
                    i.classList.toggle('selected', i.dataset.id === styleId);
                });

                // Dispatch change event
                this.dispatchEvent(new CustomEvent('styleChange', {
                    detail: { style: this.selectedStyle }
                }));
            });
        });
    }

    getSelectedStyle() {
        return this.selectedStyle;
    }

    getSelectedStylePrompt() {
        return this.selectedStyle?.prompt || '';
    }
}

if (!customElements.get('style-selector')) {
    customElements.define('style-selector', StyleSelector);
}
