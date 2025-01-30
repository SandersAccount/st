import { showToast } from './Toast.js';

export function createImageCard(imageUrl, prompt, generationId) {
    const card = document.createElement('div');
    card.className = 'image-card';
    
    card.innerHTML = `
        <div class="image-container">
            <img src="${imageUrl}" alt="${prompt || 'Generated image'}" loading="lazy">
            <div class="image-actions">
                <button class="action-button show-prompt" title="Show Prompt">
                    <svg class="icon" width="24" height="24" viewBox="0 0 256 256">
                        <use href="/images/icons/ph-file-code-light.svg#icon"></use>
                    </svg>
                </button>
                <button class="action-button add-to-collection" title="Add to Collection">
                    <svg class="icon" width="24" height="24" viewBox="0 0 256 256">
                        <use href="/images/icons/ph-folder-simple-plus-light.svg#icon"></use>
                    </svg>
                </button>
                <button class="action-button download" title="Download">
                    <svg class="icon" width="24" height="24" viewBox="0 0 256 256">
                        <use href="/images/icons/ph-download-simple-light.svg#icon"></use>
                    </svg>
                </button>
                <button class="action-button upscale" title="Upscale">
                    <svg class="icon" width="24" height="24" viewBox="0 0 256 256">
                        <use href="/images/icons/ph-arrow-square-up-right-light.svg#icon"></use>
                    </svg>
                </button>
                <button class="action-button delete" title="Delete">
                    <svg class="icon" width="24" height="24" viewBox="0 0 256 256">
                        <use href="/images/icons/ph-trash-light.svg#icon"></use>
                    </svg>
                </button>
            </div>
        </div>
        <div class="image-info">
            <p class="prompt">${prompt || 'No prompt provided'}</p>
        </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .image-actions {
            position: absolute;
            right: 47px;
            top: 17%;
            transform: translateY(-50%);
            display: flex;
            flex-direction: column;
            gap: 6px;
            opacity: 0;
            transition: opacity 0.2s;
            z-index: 10;
        }

        .image-container:hover .image-actions {
            opacity: 1;
        }

        .action-button {
            width: 42px;
            height: 42px;
            border-radius: 6px;
            background-color: rgba(0, 0, 0, 0.75);
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            padding: 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .action-button:hover {
            background-color: rgba(0, 0, 0, 0.9);
            transform: scale(1.05);
        }

        .action-button .icon {
            width: 30px;
            height: 30px;
            color: white;
        }

        .action-button:hover .icon {
            transform: scale(1.1);
        }

        .image-container {
            position: relative;
            overflow: hidden;
            border-radius: 12px;
        }

        .image-container img {
            width: 100%;
            height: auto;
            display: block;
        }

        /* Add tooltip styles */
        .action-button::after {
            content: attr(title);
            position: absolute;
            right: calc(100% + 8px);
            top: 50%;
            transform: translateY(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 14px;
            white-space: nowrap;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s;
        }

        .action-button:hover::after {
            opacity: 1;
        }
    `;
    card.appendChild(style);

    // Add event listeners
    const showPromptBtn = card.querySelector('.show-prompt');
    showPromptBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const toast = document.createElement('toast-notification');
        document.body.appendChild(toast);
        toast.show(prompt || 'No prompt available', 'info');
    });

    const addToCollectionBtn = card.querySelector('.add-to-collection');
    addToCollectionBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const collectionModal = document.querySelector('collection-modal');
        if (collectionModal) {
            collectionModal.setImageData({
                imageUrl,
                prompt
            });
            collectionModal.show();
        }
    });

    const downloadBtn = card.querySelector('.download');
    downloadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        downloadImage(imageUrl);
    });

    const upscaleBtn = card.querySelector('.upscale');
    upscaleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const toast = document.createElement('toast-notification');
        document.body.appendChild(toast);
        toast.show('Upscale feature coming soon!', 'info');
    });

    // Handle delete button click
    const deleteBtn = card.querySelector('.delete');
    deleteBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Dispatch delete event to be handled by collections.js
        const event = new CustomEvent('deleteImage', {
            detail: { imageUrl, generationId },
            bubbles: true
        });
        card.dispatchEvent(event);
    });

    return card;
}

function downloadImage(url) {
    try {
        // Open the download URL in a new window
        window.open(`/api/download?imageUrl=${encodeURIComponent(url)}`, '_blank');
        
        // Show success message
        const toast = document.createElement('toast-notification');
        document.body.appendChild(toast);
        toast.show('Image download started', 'info');
    } catch (error) {
        console.error('Error downloading image:', error);
        const toast = document.createElement('toast-notification');
        document.body.appendChild(toast);
        toast.show('Failed to download image', 'error');
    }
}
