import { Toast } from './Toast.js';

export class CollectionModal extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this.imageData = null;
        this.prompt = null;
        this.collections = [];
        this.isVisible = false;
        this._excludeCollectionId = null;

        const style = `
            .modal {
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.5);
            }

            .modal-content {
                background-color: #1a1a1a;
                margin: 15% auto;
                padding: 20px;
                border-radius: 8px;
                width: 80%;
                max-width: 500px;
                position: relative;
            }

            .collections-list {
                max-height: 300px;
                overflow-y: auto;
                margin: 20px 0;
            }

            .collection-item {
                padding: 10px;
                margin: 5px 0;
                background: #2a2a2a;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.3s;
            }

            .collection-item:hover {
                background: #3a3a3a;
            }

            .collection-title {
                font-weight: bold;
            }

            .collection-count {
                float: right;
                color: #888;
            }

            .new-collection-button {
                display: inline-flex;
                align-items: center;
                padding: 8px 16px;
                background: #2196F3;
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
                transition: background-color 0.3s;
            }

            .new-collection-button:hover {
                background: #1976D2;
            }

            .new-collection-button svg {
                margin-right: 8px;
            }
        `;

        this.shadowRoot.innerHTML = `
            <style>${style}</style>
            <div class="modal">
                <div class="modal-content">
                    <h3>Save to Collection</h3>
                    <div class="collections-list"></div>
                    <div class="new-collection-option">
                        <button class="new-collection-button">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                            Create New Collection
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        const modal = this.shadowRoot.querySelector('.modal');
        const newCollectionButton = this.shadowRoot.querySelector('.new-collection-button');

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hide();
            }
        });

        newCollectionButton.addEventListener('click', () => {
            this.showNewCollectionDialog();
        });
    }

    async fetchCollections() {
        try {
            const response = await fetch('/api/collections');
            if (!response.ok) throw new Error('Failed to fetch collections');
            this.collections = await response.json();
            this.renderCollections();
        } catch (error) {
            console.error('Error fetching collections:', error);
            const toast = document.createElement('toast-notification');
            document.body.appendChild(toast);
            toast.show('Failed to load collections', 'error');
        }
    }

    renderCollections() {
        const list = this.shadowRoot.querySelector('.collections-list');
        list.innerHTML = '';

        this.collections.forEach(collection => {
            if (collection._id === this._excludeCollectionId) return;

            const item = document.createElement('div');
            item.className = 'collection-item';
            item.innerHTML = `
                <span class="collection-title">${collection.title}</span>
                <span class="collection-count">${collection.images?.length || 0} images</span>
            `;

            item.addEventListener('click', () => this.addToCollection(collection._id));
            list.appendChild(item);
        });
    }

    async addToCollection(collectionId) {
        try {
            const response = await fetch(`/api/collections/${collectionId}/images`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imageUrl: this.imageData.imageUrl,
                    prompt: this.imageData.prompt
                })
            });

            if (!response.ok) throw new Error('Failed to add to collection');

            this.hide();
            const toast = document.createElement('toast-notification');
            document.body.appendChild(toast);
            toast.show('Image added to collection', 'success');

            // Notify that image was added to collection
            window.dispatchEvent(new CustomEvent('imageAddedToCollection', {
                detail: { collectionId, imageUrl: this.imageData.imageUrl }
            }));
        } catch (error) {
            console.error('Error adding to collection:', error);
            const toast = document.createElement('toast-notification');
            document.body.appendChild(toast);
            toast.show('Failed to add to collection', 'error');
        }
    }

    showNewCollectionDialog() {
        const newCollectionModal = document.createElement('new-collection-modal');
        if (!newCollectionModal.parentElement) {
            document.body.appendChild(newCollectionModal);
        }
        newCollectionModal.showNewCollectionDialog();
    }

    setImageData(data) {
        this.imageData = data;
    }

    show() {
        this.fetchCollections();
        const modal = this.shadowRoot.querySelector('.modal');
        modal.style.display = 'block';
        this.isVisible = true;
    }

    hide() {
        const modal = this.shadowRoot.querySelector('.modal');
        modal.style.display = 'none';
        this.isVisible = false;
    }
}

class NewCollectionModal extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: none;
                }

                :host(.active) {
                    display: block;
                }

                .overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }

                .modal {
                    background: #1a1a1a;
                    padding: 20px;
                    border-radius: 8px;
                    width: 90%;
                    max-width: 400px;
                }

                h3 {
                    margin-top: 0;
                }

                input {
                    width: 100%;
                    padding: 8px;
                    margin: 10px 0;
                    border: 1px solid #333;
                    border-radius: 4px;
                    background: #2a2a2a;
                    color: white;
                }

                .buttons {
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

                .cancel {
                    background: #424242;
                    color: white;
                }

                .create {
                    background: #2196F3;
                    color: white;
                }

                button:hover {
                    opacity: 0.9;
                }
            </style>
            <div class="overlay">
                <div class="modal">
                    <h3>Create New Collection</h3>
                    <input type="text" placeholder="Collection name" />
                    <div class="buttons">
                        <button class="cancel">Cancel</button>
                        <button class="create">Create</button>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        const overlay = this.shadowRoot.querySelector('.overlay');
        const cancelButton = this.shadowRoot.querySelector('.cancel');
        const createButton = this.shadowRoot.querySelector('.create');
        const input = this.shadowRoot.querySelector('input');

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.hide();
            }
        });

        cancelButton.addEventListener('click', () => {
            this.hide();
        });

        createButton.addEventListener('click', () => {
            this.createCollection();
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createCollection();
            }
        });
    }

    async createCollection() {
        const input = this.shadowRoot.querySelector('input');
        const title = input.value.trim();

        if (!title) {
            this.showToast('Please enter a collection name', 'error');
            return;
        }

        try {
            const response = await fetch('/api/collections', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title })
            });

            if (!response.ok) throw new Error('Failed to create collection');

            this.showToast('Collection created successfully', 'success');
            this.hide();
            
            // Notify that a new collection was created
            window.dispatchEvent(new CustomEvent('collectionCreated'));
        } catch (error) {
            console.error('Error creating collection:', error);
            this.showToast('Failed to create collection', 'error');
        }
    }

    showToast(message, type) {
        const toast = document.querySelector('toast-notification') || document.createElement('toast-notification');
        if (!toast.parentElement) {
            document.body.appendChild(toast);
        }
        toast.show(message, type);
    }

    showNewCollectionDialog() {
        this.classList.add('active');
        const input = this.shadowRoot.querySelector('input');
        input.value = '';
        input.focus();
    }

    hide() {
        this.classList.remove('active');
    }
}

// Register custom elements
customElements.define('collection-modal', CollectionModal);
customElements.define('new-collection-modal', NewCollectionModal);
