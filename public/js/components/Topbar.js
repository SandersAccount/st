export async function createTopbar() {
    try {
        // Get settings
        const settingsResponse = await fetch('/api/settings');
        const settings = await settingsResponse.json();
        console.log('Loaded settings:', settings);

        const topbar = document.createElement('div');
        topbar.className = 'topbar';

        const content = document.createElement('div');
        content.className = 'topbar-content';

        // Left section with logo/text
        const leftSection = document.createElement('div');
        leftSection.className = 'topbar-left';
        
        const appTitle = document.createElement('a');
        appTitle.href = '/';
        appTitle.className = 'logo';
        
        if (settings.useLogoInstead && settings.logoUrl) {
            console.log('Using logo:', settings.logoUrl);
            const logo = document.createElement('img');
            logo.src = settings.logoUrl;
            logo.alt = settings.appName || 'Sticker Generator';
            logo.style.height = '47px';
            logo.style.width = 'auto';
            appTitle.appendChild(logo);
        } else {
            console.log('Using text:', settings.appName);
            appTitle.textContent = settings.appName || 'Sticker Generator';
        }
        
        leftSection.appendChild(appTitle);

        // Center section with navigation
        const centerSection = document.createElement('div');
        centerSection.className = 'topbar-center';

        const navItems = [
            { text: 'Generator', href: '/' },
            { text: 'Collections', href: '/collections' }
        ];

        navItems.forEach(item => {
            const link = document.createElement('a');
            link.href = item.href;
            link.className = 'nav-link';
            if (window.location.pathname === item.href) {
                link.classList.add('active');
            }
            link.textContent = item.text;
            // Add click handler to handle navigation
            link.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = item.href;
            });
            centerSection.appendChild(link);
        });

        // Right section with user info
        const rightSection = document.createElement('div');
        rightSection.className = 'topbar-right';

        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'include'
            });

            const userData = await response.json();

            if (userData) {
                // Credits indicator
                const creditsIndicator = document.createElement('div');
                creditsIndicator.className = 'credits-indicator';

                const creditsIcon = document.createElement('i');
                creditsIcon.className = 'fas fa-coins';

                const creditsCount = document.createElement('span');
                creditsCount.textContent = userData.credits || '0';
                creditsCount.id = 'topbarCredits';

                creditsIndicator.appendChild(creditsIcon);
                creditsIndicator.appendChild(creditsCount);

                // Upgrade button
                const upgradeButton = document.createElement('button');
                upgradeButton.className = 'btn-upgrade';
                upgradeButton.textContent = 'Buy Credits';
                upgradeButton.addEventListener('click', () => {
                    window.location.href = '/profile?tab=subscription';
                });

                // User menu button
                const userButton = document.createElement('button');
                userButton.className = 'user-menu-button';

                const avatar = document.createElement('div');
                avatar.className = 'user-avatar';
                avatar.textContent = userData.name ? userData.name[0].toUpperCase() : 'U';

                userButton.appendChild(avatar);

                // Add elements to right section
                rightSection.appendChild(creditsIndicator);
                rightSection.appendChild(upgradeButton);
                rightSection.appendChild(userButton);

                // User dropdown
                const dropdown = document.createElement('div');
                dropdown.className = 'user-dropdown';
                dropdown.style.display = 'none';
                dropdown.style.position = 'absolute';
                dropdown.style.top = '100%';
                dropdown.style.right = '0';
                dropdown.style.marginTop = '0.5rem';
                dropdown.style.zIndex = '1000';

                // Set credits info
                dropdown.setAttribute('data-credits', `${userData.credits || 0} credits left`);

                // Add menu items
                const menuItems = [
                    { text: 'Personal Info', href: '/profile' },
                    { text: 'Subscription', href: '/profile?tab=subscription' },
                    { text: 'Log Out', href: '#', action: handleLogout }
                ];

                menuItems.forEach(item => {
                    const menuItem = document.createElement('a');
                    menuItem.href = item.href;
                    menuItem.textContent = item.text;
                    if (item.action) {
                        menuItem.addEventListener('click', (e) => {
                            e.preventDefault();
                            item.action();
                        });
                    }
                    dropdown.appendChild(menuItem);
                });

                // Logout handler function
                function handleLogout() {
                    fetch('/api/auth/logout', {
                        method: 'POST',
                        credentials: 'include'
                    })
                    .then(response => response.json())
                    .then(() => {
                        window.location.href = '/login';
                    })
                    .catch(error => {
                        console.error('Logout error:', error);
                        alert('Failed to logout. Please try again.');
                    });
                }

                // Toggle dropdown
                userButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
                });

                document.addEventListener('click', () => {
                    dropdown.style.display = 'none';
                });

                rightSection.appendChild(dropdown);
            } else {
                const loginButton = document.createElement('a');
                loginButton.href = '/login';
                loginButton.textContent = 'Login';
                loginButton.style.color = '#ffffff';
                loginButton.style.textDecoration = 'none';
                rightSection.appendChild(loginButton);
            }

            // Listen for credit updates
            window.addEventListener('creditsUpdated', (event) => {
                if (event.detail && typeof event.detail.credits === 'number') {
                    const creditsElement = document.getElementById('topbarCredits');
                    if (creditsElement) {
                        creditsElement.textContent = event.detail.credits;
                    }
                }
            });

        } catch (error) {
            console.error('Error loading user data:', error);
        }

        // Assemble the topbar
        content.appendChild(leftSection);
        content.appendChild(centerSection);
        content.appendChild(rightSection);
        topbar.appendChild(content);

        // Insert into DOM
        const topbarElement = document.getElementById('topbar');
        if (topbarElement) {
            topbarElement.replaceChildren(topbar);
        }

        return topbar;
    } catch (error) {
        console.error('Error creating topbar:', error);
    }
}
