export class CollectionSelector {
    constructor() {
        this.modal = this.createModal();
        document.body.appendChild(this.modal);
        this.setupEventListeners();
        this.collectionModal = document.querySelector('collection-modal');
    }

    createModal() {
        const modal = document.createElement('div');
        modal.className = 'collection-selector-modal modal';
        modal.innerHTML = `
            <div class="modal-content collection-selector">
                <h3>Save to Collection</h3>
                <div class="collections-list"></div>
                <div class="new-collection-option">
                    <div class="new-collection-button">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        <span>Create New Collection</span>
                    </div>
                </div>
            </div>
        `;
        return modal;
    }

    setupEventListeners() {
        // Close when clicking outside
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });

        // Handle new collection button
        const newCollectionBtn = this.modal.querySelector('.new-collection-button');
        newCollectionBtn.addEventListener('click', () => {
            this.hide();
            // Show the new collection modal
            if (this.collectionModal) {
                this.collectionModal.showNewCollectionDialog();
            }
        });

        // Listen for collection creation
        window.addEventListener('collectionCreated', () => {
            this.loadCollections();
        });
    }

    async loadCollections() {
        try {
            const response = await fetch('/api/collections');
            if (!response.ok) throw new Error('Failed to load collections');
            
            const collections = await response.json();
            this.renderCollections(collections);
        } catch (error) {
            console.error('Error loading collections:', error);
        }
    }

    renderCollections(collections) {
        const list = this.modal.querySelector('.collections-list');
        list.innerHTML = '';

        collections.forEach(collection => {
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
            // Get the generation card element
            const generationCard = document.querySelector(`generation-card[data-id="${this.currentGenerationId}"]`);
            if (!generationCard) {
                throw new Error('Generation card not found');
            }

            // Get image data from the generation card
            const imageData = generationCard.getImageData();

            const response = await fetch(`/api/collections/${collectionId}/images`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imageUrl: imageData.imageUrl,
                    prompt: imageData.prompt
                })
            });

            if (!response.ok) throw new Error('Failed to add to collection');
                window.dispatchEvent(new CustomEvent('imageAddedToCollection', {
                detail: { collectionId }
            }));
            
            this.hide();
            // Create a toast notification
            const toast = document.createElement('toast-notification');
            document.body.appendChild(toast);
            toast.show('Image added to collection', 'success');

            // Notify that image was added to collection
            window.dispatchEvent(new CustomEvent('imageAddedToCollection', {
                detail: { collectionId, imageUrl: imageData.imageUrl }
            }));
        } catch (error) {
            console.error('Error adding to collection:', error);
            const toast = document.createElement('toast-notification');
            document.body.appendChild(toast);
            toast.show('Failed to add to collection', 'error');
        }
    }

    show(generationId) {
        this.currentGenerationId = generationId;
        this.loadCollections();
        this.modal.classList.add('active');
    }

    hide() {
        this.modal.classList.remove('active');
    }
}
