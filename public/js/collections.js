import { createTopbar } from './components/Topbar.js';

// Initialize everything after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    createTopbar(); 
    loadCollections();
    loadGenerations();

    // Add delete image event listener
    document.addEventListener('deleteImage', async (e) => {
        const { imageUrl, generationId } = e.detail;
        
        // Remove any existing confirmation modals first
        const existingModal = document.querySelector('.confirmation-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create and show a custom confirmation modal
        const modal = document.createElement('div');
        modal.className = 'confirmation-modal';
        modal.innerHTML = `
            <div class="confirmation-content">
                <h3>Delete Image</h3>
                <p>Are you sure you want to delete this image? This action cannot be undone.</p>
                <div class="confirmation-buttons">
                    <button class="cancel-btn">Cancel</button>
                    <button class="delete-btn">Delete</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Add styles if they don't exist
        if (!document.querySelector('#confirmation-modal-styles')) {
            const styles = document.createElement('style');
            styles.id = 'confirmation-modal-styles';
            styles.textContent = `
                .confirmation-modal {
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
                .confirmation-content {
                    background: #1a1a1a;
                    padding: 24px;
                    border-radius: 8px;
                    max-width: 400px;
                    width: 90%;
                }
                .confirmation-buttons {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 24px;
                }
                .cancel-btn, .delete-btn {
                    padding: 8px 16px;
                    border-radius: 4px;
                    border: none;
                    cursor: pointer;
                }
                .cancel-btn {
                    background: #333;
                    color: #fff;
                }
                .delete-btn {
                    background: #dc3545;
                    color: #fff;
                }
            `;
            document.head.appendChild(styles);
        }

        // Handle cancel
        const cancelBtn = modal.querySelector('.cancel-btn');
        cancelBtn.addEventListener('click', () => modal.remove());

        // Handle delete
        const deleteBtn = modal.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', async () => {
            try {
                deleteBtn.disabled = true; // Prevent double-clicks
                const response = await fetch(`/api/generations/${generationId}`, {
                    method: 'DELETE',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error('Failed to delete image');
                }

                // Remove the modal immediately after successful deletion
                modal.remove();

                // Show success message
                showToast('Image deleted successfully', 'success');

                // Remove the image card from the UI
                const card = document.querySelector(`[generation-id="${generationId}"]`);
                if (card) {
                    card.remove();
                }

                // Refresh the collections
                loadCollections();
            } catch (error) {
                console.error('Error deleting image:', error);
                showToast('Failed to delete image', 'error');
                deleteBtn.disabled = false; // Re-enable the button on error
            } finally {
                // Ensure the modal is removed even if there was an error
                modal.remove();
            }
        });
    });

    // Setup new collection modal handlers
    const newCollectionModal = document.getElementById('newCollectionModal');
    const newCollectionForm = document.getElementById('newCollectionForm');
    const cancelCollectionBtn = document.getElementById('cancelCollectionBtn');

    if (newCollectionModal && newCollectionForm && cancelCollectionBtn) {
        // Close modal when clicking cancel
        cancelCollectionBtn.addEventListener('click', () => {
            newCollectionModal.style.display = 'none';
        });

        // Handle form submission
        newCollectionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('collectionTitle').value;
            
            try {
                const response = await fetch('/api/collections', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ title })
                });

                if (!response.ok) throw new Error('Failed to create collection');
                
                showToast('Collection created successfully', 'success');
                newCollectionModal.style.display = 'none';
                newCollectionForm.reset();
                loadCollections(); // Refresh collections
            } catch (error) {
                console.error('Error creating collection:', error);
                showToast('Failed to create collection', 'error');
            }
        });

        // Show modal when clicking create new collection
        document.querySelector('.create-new')?.addEventListener('click', () => {
            newCollectionModal.style.display = 'block';
        });
    }
});

async function loadCollections() {
    try {
        const response = await fetch('/api/collections', {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to load collections');
        
        const collections = await response.json();
        displayCollections(collections);
    } catch (error) {
        console.error('Error loading collections:', error);
        showToast('Failed to load collections', 'error');
    }
}

function displayCollections(collections) {
    const container = document.querySelector('.collections-grid');
    if (!container) return;

    // Clear existing content
    container.innerHTML = '';

    // Add "Create New Collection" card first
    container.appendChild(createNewCollectionCard());

    // Add collection cards
    collections.forEach(collection => {
        const card = document.createElement('div');
        card.className = 'collection-card';
        
        // Create preview grid
        const previewGrid = document.createElement('div');
        previewGrid.className = 'collection-preview';

        // Get all images for the collection
        const images = collection.images || [];
        
        // Create 6 preview slots (2x3 grid)
        for (let i = 0; i < 6; i++) {
            const imgContainer = document.createElement('div');
            
            if (i < images.length) {
                // Add image if available
                imgContainer.className = 'preview-image';
                const img = document.createElement('img');
                img.src = images[i].imageUrl;
                img.alt = collection.title;
                img.loading = 'lazy';
                imgContainer.appendChild(img);
            } else {
                // Add empty slot
                imgContainer.className = 'preview-image empty';
            }
            
            previewGrid.appendChild(imgContainer);
        }

        card.appendChild(previewGrid);

        // Add collection info
        const info = document.createElement('div');
        info.className = 'collection-info';
        info.innerHTML = `
            <h3 class="collection-name">${collection.title}</h3>
            <p class="collection-count">${collection.stats?.imageCount || 0} images</p>
        `;
        card.appendChild(info);

        // Make the card clickable
        card.addEventListener('click', () => {
            window.location.href = `/collection/${collection._id}`;
        });

        container.appendChild(card);
    });
}

function createNewCollectionCard() {
    const card = document.createElement('div');
    card.className = 'collection-card create-new';
    
    const iconContainer = document.createElement('div');
    iconContainer.className = 'create-new-icon';
    
    const icon = document.createElement('i');
    icon.className = 'fas fa-plus';
    
    const text = document.createElement('span');
    text.textContent = 'Create New Collection';
    
    iconContainer.appendChild(icon);
    iconContainer.appendChild(text);
    card.appendChild(iconContainer);

    card.addEventListener('click', () => {
        document.getElementById('newCollectionModal').classList.add('active');
    });

    return card;
}

async function loadGenerations() {
    try {
        const response = await fetch('/api/generations/recent', {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to load generations');
        
        const generations = await response.json();
        const collections = await fetch('/api/collections', {
            credentials: 'include'
        }).then(res => res.json());
        displayGenerations(generations, collections);
    } catch (error) {
        console.error('Error loading generations:', error);
    }
}

function displayGenerations(generations, collections) {
    const grid = document.querySelector('.generations-grid');
    if (!grid) return;
    
    grid.innerHTML = '';

    const collectionImageUrls = new Set();
    collections.forEach(collection => {
        if (collection.images) {
            collection.images.forEach(image => collectionImageUrls.add(image.imageUrl));
        }
    });

    const displayedImageUrls = new Set();
    generations.forEach(generation => {
        if (!collectionImageUrls.has(generation.imageUrl) && !displayedImageUrls.has(generation.imageUrl)) {
            console.log('Creating card for generation:', generation);
            const card = document.createElement('generation-card');
            console.log('Card created, setting attributes...');
            card.setAttribute('image-url', generation.imageUrl);
            card.setAttribute('prompt', generation.prompt || '');
            card.setAttribute('generation-id', generation._id); 
            console.log('Attributes set:', {
                imageUrl: card.getAttribute('image-url'),
                prompt: card.getAttribute('prompt'),
                id: card.getAttribute('generation-id')
            });
            grid.appendChild(card);
            displayedImageUrls.add(generation.imageUrl);
            console.log('Card appended to grid');
        }
    });
}

// Handle new collection creation
document.querySelector('.new-collection')?.addEventListener('click', () => {
    // TODO: Implement collection creation modal
    console.log('Create new collection clicked');
});

// Dropdown option handlers
function handlePrompt(generation) {
    console.log('View Prompt selected', generation);
    // Add your prompt viewing logic here
}

function handleAddToCollection(generation) {
    console.log('Add to Collection selected', generation);
    const imageData = {
        imageUrl: generation.imageUrl,
        prompt: generation.prompt,
        generationId: generation._id
    };
    
    // Show collection selector modal
    const collectionModal = document.createElement('collection-modal');
    collectionModal.setAttribute('image-data', JSON.stringify(imageData));
    document.body.appendChild(collectionModal);
}

function handleDownload(generation) {
    console.log('Download selected', generation);
    // Add your download logic here
}

function handleUpscale(generation) {
    console.log('Upscale selected', generation);
    // Add your upscale logic here
}

function handleMoveToTrash(generation) {
    console.log('Move to Trash selected', generation);
    // Add your Move to Trash handling logic here
}

function showToast(message, type) {
    const toast = document.createElement('toast-notification');
    document.body.appendChild(toast);
    toast.show(message, type);
}

// Export functions that need to be accessed from other modules
export {
    handleAddToCollection,
    handlePrompt,
    handleDownload,
    handleUpscale,
    handleMoveToTrash,
    showToast
};

export async function addToExistingCollection(collectionId, imageData) {
    try {
        const response = await fetch(`/api/collections/${collectionId}/images`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(imageData),
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to add image to collection');
        }

        // Create and show a success toast
        const toast = document.createElement('toast-notification');
        document.body.appendChild(toast);
        toast.show('Image added to collection', 'success');

        // Dispatch event to refresh collections
        window.dispatchEvent(new CustomEvent('imageAddedToCollection'));
    } catch (error) {
        console.error('Error:', error);
        const toast = document.createElement('toast-notification');
        document.body.appendChild(toast);
        toast.show('Failed to add image to collection', 'error');
    }
}
