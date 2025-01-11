// Credit packages configuration
const creditPackages = [
    { credits: 100, discount: 0, price: 10.00 },
    { credits: 200, discount: 4, price: 19.20 },
    { credits: 300, discount: 6, price: 28.20 },
    { credits: 400, discount: 8, price: 36.80 },
    { credits: 500, discount: 10, price: 45.00 },
    { credits: 600, discount: 12, price: 52.80 },
    { credits: 700, discount: 14, price: 60.20 },
    { credits: 800, discount: 16, price: 67.20 },
    { credits: 900, discount: 18, price: 73.80 },
    { credits: 1000, discount: 20, price: 80.00 }
];

class CreditsPopup {
    constructor() {
        this.createPopupElement();
        this.setupEventListeners();
    }

    createPopupElement() {
        const popup = document.createElement('div');
        popup.className = 'credits-popup';
        popup.innerHTML = `
            <div class="credits-popup-content">
                <div class="credits-popup-header">
                    <h2>Buy Credits</h2>
                    <button class="close-button">&times;</button>
                </div>
                <div class="credits-popup-body">
                    <div class="credits-slider-container">
                        <input type="range" min="100" max="1000" step="100" value="100" class="credits-slider">
                        <div class="credits-value">
                            <span class="selected-credits">100</span> Credits
                        </div>
                    </div>
                    <div class="credits-info">
                        <div class="price-info">
                            <div class="original-price">$10.00</div>
                            <div class="discount">0% OFF</div>
                            <div class="final-price">Final Price: $10.00</div>
                        </div>
                    </div>
                    <button class="buy-credits-button">Buy Credits</button>
                </div>
            </div>
        `;
        document.body.appendChild(popup);

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .credits-popup {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 1000;
                justify-content: center;
                align-items: center;
            }

            .credits-popup-content {
                background: #1E1E1E;
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                padding: 24px;
                color: #fff;
            }

            .credits-popup-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 24px;
            }

            .credits-popup-header h2 {
                margin: 0;
                font-size: 24px;
            }

            .close-button {
                background: none;
                border: none;
                color: #fff;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
            }

            .credits-slider-container {
                margin-bottom: 24px;
            }

            .credits-slider {
                width: 100%;
                margin-bottom: 12px;
            }

            .credits-value {
                text-align: center;
                font-size: 18px;
            }

            .selected-credits {
                font-weight: bold;
                color: #ff1cf7;
            }

            .credits-info {
                background: #2A2A2A;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 24px;
            }

            .price-info {
                text-align: center;
            }

            .original-price {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 8px;
            }

            .discount {
                color: #ff1cf7;
                font-weight: bold;
                margin-bottom: 8px;
            }

            .final-price {
                font-size: 18px;
            }

            .buy-credits-button {
                width: 100%;
                background: #ff1cf7;
                color: #fff;
                border: none;
                border-radius: 8px;
                padding: 12px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: background 0.2s ease;
            }

            .buy-credits-button:hover {
                background: #ff45f9;
            }
        `;
        document.head.appendChild(style);
    }

    setupEventListeners() {
        const popup = document.querySelector('.credits-popup');
        const closeButton = popup.querySelector('.close-button');
        const slider = popup.querySelector('.credits-slider');
        const buyButton = popup.querySelector('.buy-credits-button');

        closeButton.addEventListener('click', () => this.hide());
        popup.addEventListener('click', (e) => {
            if (e.target === popup) this.hide();
        });

        slider.addEventListener('input', (e) => {
            const credits = parseInt(e.target.value);
            const package = creditPackages.find(p => p.credits === credits);
            
            popup.querySelector('.selected-credits').textContent = credits;
            popup.querySelector('.original-price').textContent = `$${package.price.toFixed(2)}`;
            popup.querySelector('.discount').textContent = `${package.discount}% OFF`;
            popup.querySelector('.final-price').textContent = `Final Price: $${package.price.toFixed(2)}`;
        });

        buyButton.addEventListener('click', async () => {
            const credits = parseInt(slider.value);
            try {
                const response = await fetch('/api/credits/request', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ credits })
                });

                if (response.ok) {
                    alert('Credit purchase request sent to admin!');
                    this.hide();
                } else {
                    throw new Error('Failed to request credits');
                }
            } catch (error) {
                console.error('Error requesting credits:', error);
                alert('Failed to request credits. Please try again.');
            }
        });
    }

    show() {
        const popup = document.querySelector('.credits-popup');
        popup.style.display = 'flex';
    }

    hide() {
        const popup = document.querySelector('.credits-popup');
        popup.style.display = 'none';
    }
}

// Initialize the popup
const creditsPopup = new CreditsPopup();

// Export for use in other files
window.creditsPopup = creditsPopup;
