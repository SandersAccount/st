import { CollectionSelector } from './CollectionSelector.js';
import { showToast } from './Toast.js';

export class GenerationCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._imageUrl = '';
        this._prompt = '';
        this._isUpscaled = false;
        this._id = '';
        this._isUpscaling = false;
        
        // Bind methods
        this.onclick = this.onclick.bind(this);
        this.handleShowPrompt = this.handleShowPrompt.bind(this);
        this.handleAddToCollection = this.handleAddToCollection.bind(this);
        this.handleDownload = this.handleDownload.bind(this);
        this.handleDelete = this.handleDelete.bind(this);
        this.handleEdit = this.handleEdit.bind(this);
        this.handleBgRemove = this.handleBgRemove.bind(this);
    }

    static get observedAttributes() {
        return ['image-url', 'prompt', 'is-upscaled', 'generation-id'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        
        switch (name) {
            case 'image-url':
                this._imageUrl = newValue;
                break;
            case 'prompt':
                this._prompt = newValue;
                break;
            case 'is-upscaled':
                this._isUpscaled = newValue === 'true';
                break;
            case 'generation-id':
                this._id = newValue;
                break;
        }
        
        this.render();
    }

    get imageUrl() {
        return this._imageUrl;
    }

    set imageUrl(value) {
        if (value !== this._imageUrl) {
            this._imageUrl = value;
            this.setAttribute('image-url', value);
        }
    }

    get prompt() {
        return this._prompt;
    }

    set prompt(value) {
        this._prompt = value;
        this.setAttribute('prompt', value);
    }

    get isUpscaled() {
        return this._isUpscaled;
    }

    set isUpscaled(value) {
        this._isUpscaled = value;
        this.setAttribute('is-upscaled', value);
    }

    get id() {
        return this._id;
    }

    set id(value) {
        this._id = value;
        this.setAttribute('generation-id', value);
    }

    checkAndRemoveDuplicate() {
        if (!this._imageUrl) return;
        
        // Get all generation cards
        const allCards = document.querySelectorAll('generation-card');
        const currentIndex = Array.from(allCards).indexOf(this);
        
        // Check for duplicates before this card
        allCards.forEach((card, index) => {
            if (index !== currentIndex && 
                card.getAttribute('image-url') === this._imageUrl) {
                // If this is a newer card (higher index), remove the old one
                if (currentIndex > index) {
                    card.remove();
                }
            }
        });
    }

    getImageData() {
        return {
            imageUrl: this._imageUrl,
            prompt: this._prompt,
            timestamp: new Date().toISOString()
        };
    }

    render() {
        const upscaleButton = this._isUpscaled ? '' : `
            <button class="menu-button" data-action="upscale" title="Upscale Image">
                <img src="/images/ph--arrow-square-up-right-light.svg" />
                Upscale Image
            </button>
        `;

        const hdBadge = this._isUpscaled ? `
            <div class="hd-badge">
                <img src="/images/ph--arrow-square-up-right-light.svg" />
                HD
            </div>
        ` : '';

        const template = `
            <style>
                :host {
                    display: block;
                    position: relative;
                    width: 100%;
                    height: 100%;
                }

                .image-container {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    border-radius: 8px;
                }

                img.generation-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .menu-overlay {
                    position: absolute;
                    top: 0;
                    right: 0;
                    bottom: 0;
                    padding: 12px;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-start;
                    gap: 8px;
                    opacity: 0;
                    transition: opacity 0.2s;
                    background: linear-gradient(to left, rgba(0,0,0,0.5), transparent);
                }

                .image-container:hover .menu-overlay {
                    opacity: 1;
                }

                .menu-button {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    background: rgba(255, 255, 255, 0.9);
                    color: #333;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s;
                    min-width: 100px;
                    justify-content: flex-start;
                }

                .menu-button:hover {
                    background: rgba(255, 255, 255, 1);
                    transform: translateY(-1px);
                }

                .menu-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }

                .menu-button img {
                    width: 16px;
                    height: 16px;
                }

                .menu-button[data-action="delete"]:hover {
                    background: rgba(255, 100, 100, 0.9);
                    color: white;
                }

                .menu-button[data-action="delete"]:hover img {
                    filter: brightness(0) invert(1);
                }

                .hd-badge {
                    position: absolute;
                    top: 12px;
                    left: 12px;
                    background: rgba(255, 255, 255, 0.9);
                    color: #333;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    z-index: 10;
                }

                .hd-badge img {
                    width: 14px;
                    height: 14px;
                }
            </style>
            <div class="image-container">
                <img class="generation-image" src="${this._imageUrl}" alt="${this._prompt || 'Generated image'}" />
                ${hdBadge}
                <div class="menu-overlay">
                    ${upscaleButton}
                    <button class="menu-button" data-action="collection" title="Add to Collection">
                        <img src="/images/ph--folder-simple-plus-light.svg" />
                        Add to Collection
                    </button>
                    <button class="menu-button" data-action="download" title="Download Image">
                        <img src="/images/ph--download-simple-light.svg" />
                        Download
                    </button>
                    <button class="menu-button" data-action="bgremove" title="Remove Background">
                        <img src="/images/ph--images-square-light.svg" />
                        BG Remove
                    </button>
                    <button class="menu-button" data-action="edit" title="Edit in Sticker Editor">
                        <img src="/images/ph--pencil-line-light%20(1).svg" />
                        Edit
                    </button>
                    <button class="menu-button" data-action="delete" title="Delete Image">
                        <img src="/images/ph--trash-light.svg" />
                        Delete Image
                    </button>
                </div>
            </div>
        `;

        this.shadowRoot.innerHTML = template;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add click handlers for menu buttons
        const menuButtons = this.shadowRoot.querySelectorAll('.menu-button');
        menuButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click
                const action = button.getAttribute('data-action');
                switch (action) {
                    case 'prompt':
                        this.handleShowPrompt();
                        break;
                    case 'collection':
                        this.handleAddToCollection();
                        break;
                    case 'download':
                        this.handleDownload();
                        break;
                    case 'delete':
                        this.handleDelete();
                        break;
                    case 'edit':
                        this.handleEdit();
                        break;
                    case 'bgremove':
                        this.handleBgRemove();
                        break;
                }
            });
        });

        // Add click handler for the card itself
        this.shadowRoot.querySelector('.image-container')?.addEventListener('click', this.onclick);
    }

    onclick(e) {
        // Show prompt when clicking the card
        this.handleShowPrompt();
    }

    handleShowPrompt() {
        const promptModal = document.createElement('div');
        promptModal.className = 'prompt-modal';
        promptModal.innerHTML = `
            <div class="prompt-content">
                <h3>Image Prompt</h3>
                <p>${this._prompt || 'No prompt available'}</p>
                <button class="close-btn">Close</button>
            </div>
        `;

        // Add styles if they don't exist
        if (!document.querySelector('#prompt-modal-styles')) {
            const styles = document.createElement('style');
            styles.id = 'prompt-modal-styles';
            styles.textContent = `
                .prompt-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                .prompt-content {
                    background: #1e1e1e;
                    padding: 20px;
                    border-radius: 8px;
                    max-width: 600px;
                    width: 90%;
                }
                .prompt-content h3 {
                    margin: 0 0 15px 0;
                    color: #fff;
                }
                .prompt-content p {
                    margin: 0 0 20px 0;
                    color: #ccc;
                    white-space: pre-wrap;
                    word-break: break-word;
                }
                .close-btn {
                    padding: 8px 16px;
                    border-radius: 4px;
                    border: none;
                    cursor: pointer;
                    background: #333;
                    color: #fff;
                    float: right;
                }
                .close-btn:hover {
                    background: #444;
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(promptModal);

        // Handle close button click
        const closeBtn = promptModal.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => {
            promptModal.remove();
        });

        // Close on background click
        promptModal.addEventListener('click', (e) => {
            if (e.target === promptModal) {
                promptModal.remove();
            }
        });
    }

    handleAddToCollection() {
        // Dispatch add to collection event
        const event = new CustomEvent('addToCollection', {
            bubbles: true,
            composed: true,
            detail: {
                imageUrl: this._imageUrl,
                prompt: this._prompt,
                generationId: this._id
            }
        });
        this.dispatchEvent(event);
    }

    async handleDownload() {
        try {
            const response = await fetch(this._imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `image-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showToast('Download complete!', 'success');
        } catch (error) {
            console.error('Download error:', error);
            showToast('Failed to download image', 'error');
        }
    }

    handleDelete() {
        const generationId = this.getAttribute('generation-id');
        const imageUrl = this.getAttribute('image-url');
        console.log('Deleting generation with ID:', generationId);
        
        if (!generationId) {
            console.error('No generation ID found');
            showToast('Failed to delete image: Missing ID', 'error');
            return;
        }
        
        // Dispatch delete event to be handled by collections.js
        const event = new CustomEvent('deleteImage', {
            detail: { imageUrl, generationId },
            bubbles: true
        });
        this.dispatchEvent(event);
    }

    handleEdit() {
        // Redirect to sticker editor
        const editorUrl = new URL('/sticker-editor.html', window.location.origin);
        editorUrl.searchParams.set('image', this._imageUrl);
        window.location.href = editorUrl.toString();
    }

    async handleBgRemove() {
        const bgRemoveButton = this.shadowRoot.querySelector('.menu-button[data-action="bgremove"]');
        if (!bgRemoveButton) return;

        try {
            bgRemoveButton.disabled = true;
            const loadingHtml = `
                <img src="/images/ph--images-square-light.svg" />
                Removing BG...
            `;
            bgRemoveButton.innerHTML = loadingHtml;
            
            const response = await fetch('/api/images/bgremove', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imageUrl: this._imageUrl
                })
            });

            if (!response.ok) {
                throw new Error('Failed to remove background');
            }

            const result = await response.json();
            
            // Update the image URL and refresh the card
            this._imageUrl = result.imageUrl;
            this.render();
            
            showToast('Background removed successfully!', 'success');
        } catch (error) {
            console.error('Error removing background:', error);
            showToast('Failed to remove background', 'error');
        } finally {
            if (bgRemoveButton) {
                bgRemoveButton.disabled = false;
                bgRemoveButton.innerHTML = `
                    <img src="/images/ph--images-square-light.svg" />
                    Remove BG
                `;
            }
        }
    }

    connectedCallback() {
        // Initial render
        this.render();
        
        // Setup event listeners after render
        requestAnimationFrame(() => {
            this.setupEventListeners();
        });
    }
}

// Define the custom element
if (!customElements.get('generation-card')) {
    customElements.define('generation-card', GenerationCard);
}

// Listen for collection creation to add pending image
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('collectionCreated', async (e) => {
        const pendingGenerationId = window.localStorage.getItem('pendingGenerationId');
        if (pendingGenerationId && e.detail.collection) {
            try {
                await fetch(`/api/collections/${e.detail.collection._id}/images`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ generationId: pendingGenerationId })
                });
                window.localStorage.removeItem('pendingGenerationId');
            } catch (error) {
                console.error('Error adding image to new collection:', error);
            }
        }
    });
});
