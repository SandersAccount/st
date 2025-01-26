import { Toast, showToast } from './Toast.js';

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
                width: 90%;
                max-width: 500px;
                color: white;
            }

            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 10px;
                border-bottom: 1px solid #333;
            }

            .modal-header h2 {
                margin: 0;
                color: white;
                font-size: 1.5rem;
                font-weight: 500;
            }

            .close-modal {
                background: none;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
            }

            .collections-list {
                margin-bottom: 20px;
                max-height: 300px;
                overflow-y: auto;
            }

            .collection-item {
                background-color: #2a2a2a;
                border-radius: 6px;
                padding: 12px;
                margin-bottom: 8px;
                cursor: pointer;
                transition: background-color 0.2s;
            }

            .collection-item:hover {
                background-color: #333;
            }

            .collection-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .collection-name {
                color: white;
                font-size: 1rem;
                font-weight: 500;
                margin: 0;
            }

            .image-count {
                color: #888;
                font-size: 0.9rem;
            }

            .collection-item.create-new {
                background-color: transparent;
                border: 2px dashed #4a5568;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 8px;
            }

            .collection-item.create-new:hover {
                border-color: #4CAF50;
            }

            .collection-item.create-new i {
                color: #4CAF50;
            }

            .collection-item.create-new span {
                color: #4CAF50;
                font-size: 1rem;
            }

            .divider {
                text-align: center;
                margin: 20px 0;
                color: #666;
            }
        `;

        this.shadowRoot.innerHTML = `
            <style>${style}</style>
            <div class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Add to Collection</h2>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="collections-list">
                        <!-- Collections will be loaded here -->
                    </div>
                </div>
            </div>
        `;

        // Close on overlay click
        this.shadowRoot.querySelector('.close-modal').addEventListener('click', () => {
            this.hide();
        });
    }

    static get observedAttributes() {
        return ['exclude-collection'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'exclude-collection' && oldValue !== newValue) {
            this._excludeCollectionId = newValue;
            // Refresh collections list if modal is open
            if (this.isVisible) {
                this.fetchCollections();
            }
        }
    }

    async fetchCollections() {
        try {
            const response = await fetch('/api/collections', {
                credentials: 'include'  // Add this to include auth cookies
            });
            if (!response.ok) throw new Error('Failed to fetch collections');
            let collections = await response.json();
            console.log('Fetched collections:', collections); // Debug log
            
            // Filter out the excluded collection if one is set
            if (this._excludeCollectionId) {
                collections = collections.filter(c => c._id !== this._excludeCollectionId);
            }

            this.collections = collections;
            console.log('Processed collections:', this.collections);
            this.renderCollections();
        } catch (error) {
            console.error('Error fetching collections:', error);
            showToast('Failed to load collections', 'error');
        }
    }

    renderCollections() {
        const listElement = this.shadowRoot.querySelector('.collections-list');
        if (!listElement) return;

        // Clear existing content
        listElement.innerHTML = '';

        if (this.collections.length === 0) {
            // If no collections, just show the create new button
            listElement.innerHTML = `
                <div class="collection-item create-new">
                    <i class="fas fa-plus"></i>
                    <span>Create New Collection</span>
                </div>
            `;
            
            // Add click handler
            const createNewBtn = listElement.querySelector('.create-new');
            if (createNewBtn) {
                createNewBtn.addEventListener('click', () => this.showNewCollectionDialog());
            }
        } else {
            // Create the HTML for all collections
            this.collections.forEach(collection => {
                const collectionItem = document.createElement('div');
                collectionItem.className = 'collection-item';
                
                collectionItem.innerHTML = `
                    <div class="collection-content">
                        <div class="collection-name">${collection.title || 'Untitled Collection'}</div>
                        <div class="image-count">${collection.stats?.imageCount || 0} images</div>
                    </div>
                `;

                collectionItem.addEventListener('click', () => {
                    this.addToCollection(collection._id);
                });

                listElement.appendChild(collectionItem);
            });

            // Add the create new button at the end
            const createNewBtn = document.createElement('div');
            createNewBtn.className = 'collection-item create-new';
            createNewBtn.innerHTML = `
                <i class="fas fa-plus"></i>
                <span>Create New Collection</span>
            `;
            createNewBtn.addEventListener('click', () => this.showNewCollectionDialog());
            listElement.appendChild(createNewBtn);
        }
    }

    async show() {
        console.log('Showing modal'); // Debug log
        if (!this.imageData) return; // Don't show if no image data
        this.isVisible = true;
        const modal = this.shadowRoot.querySelector('.modal');
        if (modal) {
            modal.style.display = 'block';
        }
        this.fetchCollections(); // Fetch collections when showing the modal
    }

    hide() {
        console.log('Hiding modal'); // Debug log
        this.isVisible = false;
        const modal = this.shadowRoot.querySelector('.modal');
        if (modal) {
            modal.style.display = 'none';
        }
        // Clear the exclude collection when hiding
        this._excludeCollectionId = null;
        this.removeAttribute('exclude-collection');
    }

    async createNewCollection(title) {
        try {
            const response = await fetch('/api/collections', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ title })
            });

            if (!response.ok) {
                throw new Error('Failed to create collection');
            }

            // Reload collections and show modal
            await this.fetchCollections();
            this.show();
        } catch (error) {
            console.error('Error creating collection:', error);
            showToast('Failed to create collection', 'error');
        }
    }

    setImageData(data) {
        // Accept either a string URL or an object with imageUrl
        const imageUrl = typeof data === 'string' ? data : data?.imageUrl;
        
        if (!imageUrl) {
            console.error('Invalid image data:', data);
            return;
        }
        
        this.imageData = {
            imageUrl,
            prompt: typeof data === 'object' ? data.prompt || '' : '',
            generationId: typeof data === 'object' ? data.generationId || '' : ''
        };
    }

    async addToCollection(collectionId) {
        try {
            if (!this.imageData || !this.imageData.imageUrl) {
                throw new Error('No image data available');
            }

            const response = await fetch(`/api/collections/${collectionId}/images`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    imageUrl: this.imageData.imageUrl,
                    prompt: this.imageData.prompt,
                    generationId: this.imageData.generationId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to add to collection');
            }

            // Show success message
            showToast('Added to collection', 'success');

            // Hide modal
            this.hide();

            // Dispatch event to notify parent components
            this.dispatchEvent(new CustomEvent('imageAddedToCollection', {
                bubbles: true,
                composed: true,
                detail: {
                    collectionId,
                    imageUrl: this.imageData.imageUrl
                }
            }));

        } catch (error) {
            console.error('Error adding to collection:', error);
            showToast('Failed to add to collection', 'error');
        }
    }

    showNewCollectionDialog() {
        const newCollectionModal = document.createElement('new-collection-modal');
        if (!newCollectionModal.parentElement) {
            document.body.appendChild(newCollectionModal);
        }
        newCollectionModal.showNewCollectionDialog();
    }
}

export function setupCollectionModal() {
    // Listen for addToCollection events
    window.addEventListener('addToCollection', (e) => {
        const modal = document.querySelector('collection-modal');
        if (!modal) return;

        const { imageUrl, prompt, generationId } = e.detail;
        modal.setImageData({
            imageUrl,
            prompt,
            generationId
        });
        modal.show();
    });
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
                    background: #1E1E1E;
                    border-radius: 12px;
                    width: 90%;
                    max-width: 400px;
                    padding: 20px;
                }

                .modal-title {
                    color: #fff;
                    font-size: 1.2rem;
                    margin: 0 0 20px;
                }

                .input-group {
                    margin-bottom: 20px;
                }

                input {
                    width: 94%;
                    padding: 10px;
                    border: 1px solid #333;
                    border-radius: 6px;
                    background: #2a2a2a;
                    color: #fff;
                    font-size: 1rem;
                }

                input:focus {
                    outline: none;
                    border-color: #4CAF50;
                }

                .button-group {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                }

                button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 6px;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }

                .create-btn {
                    background: #4CAF50;
                    color: white;
                }

                .create-btn:hover {
                    background: #45a049;
                }

                .cancel-btn {
                    background: transparent;
                    color: #999;
                }

                .cancel-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
            </style>
            <div class="overlay">
                <div class="modal">
                    <h3 class="modal-title">Create New Collection</h3>
                    <div class="input-group">
                        <input type="text" id="collectionName" placeholder="Enter collection name">
                    </div>
                    <div class="button-group">
                        <button class="cancel-btn">Cancel</button>
                        <button class="create-btn">Create</button>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        const overlay = this.shadowRoot.querySelector('.overlay');
        const cancelBtn = this.shadowRoot.querySelector('.cancel-btn');
        const createBtn = this.shadowRoot.querySelector('.create-btn');
        const input = this.shadowRoot.querySelector('#collectionName');

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.hide();
        });

        cancelBtn.addEventListener('click', () => this.hide());

        createBtn.addEventListener('click', () => this.createCollection());

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createCollection();
        });
    }

    async createCollection() {
        const input = this.shadowRoot.querySelector('#collectionName');
        const name = input.value.trim();

        if (!name) {
            showToast('Please enter a collection name', 'error');
            return;
        }

        try {
            const response = await fetch('/api/collections', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title: name })
            });

            if (!response.ok) throw new Error('Failed to create collection');

            const collection = await response.json();
            showToast('Collection created successfully!', 'success');
            this.hide();
            
            // Dispatch event to notify collection creation
            window.dispatchEvent(new CustomEvent('collectionCreated', {
                detail: { collection }
            }));

            // Clear input
            input.value = '';
        } catch (error) {
            console.error('Error creating collection:', error);
            showToast('Failed to create collection', 'error');
        }
    }

    showNewCollectionDialog() {
        this.classList.add('active');
        const input = this.shadowRoot.querySelector('#collectionName');
        input.value = '';
        input.focus();
    }

    hide() {
        this.classList.remove('active');
    }
}

customElements.define('collection-modal', CollectionModal);
customElements.define('new-collection-modal', NewCollectionModal);
