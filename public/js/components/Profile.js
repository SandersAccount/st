// Profile.js
export function createProfilePage(container) {
    const profile = document.createElement('div');
    profile.className = 'profile-container';

    // Create tabs
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'profile-tabs';
    
    const tabs = ['Personal Info', 'Subscription', 'Credits'];
    const tabButtons = tabs.map(tab => {
        const button = document.createElement('button');
        button.textContent = tab;
        button.className = 'profile-tab';
        button.addEventListener('click', () => switchTab(tab));
        return button;
    });
    
    tabsContainer.append(...tabButtons);
    profile.appendChild(tabsContainer);

    // Create content sections
    const contentContainer = document.createElement('div');
    contentContainer.className = 'profile-content';
    profile.appendChild(contentContainer);

    // Personal Info Section
    const personalInfo = document.createElement('div');
    personalInfo.className = 'profile-section personal-info active';
    personalInfo.innerHTML = `
        <h2>Personal Info</h2>
        <div class="info-field">
            <label>Nickname</label>
            <div class="field-content">
                <span class="field-value"></span>
                <button class="edit-btn">Edit</button>
            </div>
        </div>
        <div class="info-field">
            <label>Bio</label>
            <div class="field-content">
                <span class="field-value bio-placeholder">Briefly introduce yourself in this space...</span>
                <button class="edit-btn">Edit</button>
            </div>
        </div>
        <div class="info-field">
            <label>Social Media Links</label>
            <div class="field-content">
                <button class="add-btn">Add</button>
            </div>
        </div>
        <div class="info-field">
            <label>Email Address</label>
            <div class="field-content">
                <span class="field-value"></span>
                <button class="modify-btn">Modify an Email</button>
            </div>
        </div>
    `;

    // Subscription Section  
    const subscription = document.createElement('div');
    subscription.className = 'profile-section subscription';
    subscription.innerHTML = `
        <h2>Your Standard Plan <span class="status-badge active">ACTIVE</span></h2>
        <div class="subscription-grid">
            <div class="subscription-card">
                <h3>Usage Details</h3>
                <div class="usage-details">
                    <div class="usage-item">
                        <label>Credits</label>
                        <div class="usage-value">
                            <span class="remaining-credits">0</span>
                            <span>Credits</span>
                        </div>
                    </div>
                    <div class="usage-item">
                        <label>Sticker Generations</label>
                        <div class="usage-value">0</div>
                    </div>
                    <div class="usage-item">
                        <label>Collections</label>
                        <div class="usage-value">0</div>
                    </div>
                </div>
                <button class="buy-credits-btn">Buy more credits</button>
            </div>
            <div class="subscription-card">
                <h3>Standard Plan Features</h3>
                <ul class="plan-features">
                    <li>1000 credits</li>
                    <li>150 generations</li>
                    <li>General commercial terms</li>
                    <li>Optional credit top ups</li>
                    <li>3 concurrent fast jobs</li>
                    <li>Unlimited collections</li>
                </ul>
            </div>
            <div class="subscription-card">
                <h3>Billing & Payment</h3>
                <div class="billing-details">
                    <div class="billing-item">
                        <label>Price</label>
                        <div>$30 / mo</div>
                    </div>
                    <div class="billing-item">
                        <label>Billing period</label>
                        <div>Monthly</div>
                    </div>
                    <div class="billing-item">
                        <label>Renewal date</label>
                        <div class="renewal-date"></div>
                    </div>
                </div>
                <div class="billing-actions">
                    <button class="edit-billing-btn">Edit Billing</button>
                    <button class="view-invoices-btn">View Invoices</button>
                </div>
            </div>
        </div>
        <div class="subscription-actions">
            <button class="cancel-plan-btn">Cancel Plan</button>
            <button class="change-plan-btn">Change Plan</button>
        </div>
    `;

    // Credits Section
    const credits = document.createElement('div');
    credits.className = 'profile-section credits';
    credits.innerHTML = `
        <div class="credits-header">
            <h2>My Credits</h2>
            <a href="#" class="about-credits">About Credits?</a>
        </div>
        <div class="credits-amount">
            <div class="leaf-icon">🍃</div>
            <span class="amount">0</span>
            <button class="buy-credits-btn">Buy Credits</button>
        </div>
        <div class="credits-alert">
            <span class="alert-icon">ℹ️</span>
            <p>You have <span class="expiring-credits">0</span> credits that will expire within 30 days.</p>
            <p class="alert-note">You don't need to manually select to use credits that are about to expire, as the system will automatically prioritize the use of the expiring credits.</p>
        </div>
        <div class="credits-details">
            <div class="details-header">
                <h3>Credits Details</h3>
                <select class="records-filter">
                    <option value="all">All records</option>
                </select>
            </div>
            <table class="credits-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Refill/Consume</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
        </div>
    `;

    contentContainer.append(personalInfo, subscription, credits);
    container.appendChild(profile);

    // Tab switching logic
    function switchTab(tabName) {
        // Update tab button states
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.textContent === tabName);
        });

        // Update content visibility
        const sections = contentContainer.children;
        for (let section of sections) {
            section.classList.remove('active');
            if (section.classList.contains(tabName.toLowerCase().replace(' ', '-'))) {
                section.classList.add('active');
            }
        }
    }

    // Initialize with Personal Info tab
    switchTab('Personal Info');

    // Load user data
    loadUserData();
}

async function loadUserData() {
    try {
        const response = await fetch('/api/profile', {
            credentials: 'include'
        });
        const userData = await response.json();

        // Update personal info
        document.querySelector('.personal-info .field-value').textContent = userData.nickname || '';
        document.querySelector('.personal-info .bio-placeholder').textContent = userData.bio || 'Briefly introduce yourself in this space...';
        document.querySelector('.personal-info .field-value:last-of-type').textContent = userData.email || '';

        // Update subscription info
        document.querySelector('.remaining-credits').textContent = userData.credits || 0;
        document.querySelector('.renewal-date').textContent = new Date(userData.subscription?.renewalDate).toLocaleDateString() || 'N/A';

        // Update credits info
        document.querySelector('.credits .amount').textContent = userData.credits || 0;
        document.querySelector('.expiring-credits').textContent = userData.expiringCredits || 0;

        // Load credit history
        if (userData.creditHistory) {
            const tbody = document.querySelector('.credits-table tbody');
            tbody.innerHTML = userData.creditHistory.map(entry => `
                <tr>
                    <td>${new Date(entry.time).toLocaleString()}</td>
                    <td class="${entry.type}">${entry.amount}</td>
                    <td>${entry.details}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}
