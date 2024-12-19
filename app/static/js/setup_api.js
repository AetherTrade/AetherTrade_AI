document.addEventListener('DOMContentLoaded', function() {
    // Initialize particles.js
    particlesJS.load('particles-js', '/static/particles.json', function() {
        console.log('particles.js loaded');
    });

    const passwordToggle = document.querySelector('.password-toggle');
    const apiKeyInput = document.getElementById('deriv_api_key');
    const setupForm = document.querySelector('.api-setup-form');
    const accountTypeInputs = document.querySelectorAll('input[name="account_type"]');
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.status-text');

    let validationTimeout;
    let ws = null;

    const adminContactUrl = setupForm.dataset.adminContactUrl;

    // Show/Hide API Key
    passwordToggle.addEventListener('click', function() {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            passwordToggle.classList.remove('fa-eye-slash');
            passwordToggle.classList.add('fa-eye');
        } else {
            apiKeyInput.type = 'password';
            passwordToggle.classList.remove('fa-eye');
            passwordToggle.classList.add('fa-eye-slash');
        }
    });

    // Validate API key and account type
    async function validateApiKey(apiKey) {
        return new Promise((resolve, reject) => {
            try {
                // Close existing connection if any
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }

                // Create new WebSocket connection
                ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');

                ws.onopen = function() {
                    console.log('WebSocket connected');
                    ws.send(JSON.stringify({
                        authorize: apiKey
                    }));
                };

                ws.onmessage = function(msg) {
                    const data = JSON.parse(msg.data);
                    
                    if (data.error) {
                        resetAccountTypeHighlight();
                        resolve({ 
                            valid: false, 
                            message: data.error.message || 'Invalid API key'
                        });
                        return;
                    }

                    const accountType = data.authorize.is_virtual ? 'demo' : 'real';
                    
                    // Check if real account is allowed - use userHasRealAccountApproval from template
                    if (accountType === 'real' && !window.userHasRealAccountApproval) {
                        resetAccountTypeHighlight();
                        resolve({
                            valid: false,
                            message: 'Real account access requires admin approval. Please use a demo account or contact admin.',
                            requiresApproval: true
                        });
                        return;
                    }

                    highlightAccountType(accountType);
                    resolve({ 
                        valid: true, 
                        message: `Valid ${accountType} account connected (Balance: ${data.authorize.balance})`,
                        accountType: accountType
                    });
                };

                ws.onerror = function(error) {
                    console.error('WebSocket error:', error);
                    reject(new Error('Connection error'));
                };

                // Set connection timeout
                setTimeout(() => {
                    if (ws.readyState !== WebSocket.OPEN) {
                        ws.close();
                        reject(new Error('Connection timeout'));
                    }
                }, 10000);

            } catch (error) {
                console.error('Validation setup error:', error);
                reject(error);
            }
        });
    }

    // Update highlightAccountType function to automatically select the radio button
    function highlightAccountType(type) {
        resetAccountTypeHighlight();
        const demoOption = document.querySelector('.account-option input[value="demo"]').parentElement;
        const realOption = document.querySelector('.account-option input[value="real"]').parentElement;
        const demoRadio = document.querySelector('input[value="demo"]');
        const realRadio = document.querySelector('input[value="real"]');
        
        if (type === 'demo') {
            demoOption.classList.add('highlight-demo');
            realOption.classList.add('disabled');
            demoRadio.checked = true;  // Automatically select demo radio
            realRadio.disabled = true;  // Disable real account option
        } else {
            realOption.classList.add('highlight-real');
            demoOption.classList.add('disabled');
            realRadio.checked = true;  // Automatically select real radio
            demoRadio.disabled = true;  // Disable demo account option
        }
    }

    // Update resetAccountTypeHighlight function
    function resetAccountTypeHighlight() {
        const demoRadio = document.querySelector('input[value="demo"]');
        const realRadio = document.querySelector('input[value="real"]');
        
        document.querySelectorAll('.account-option').forEach(option => {
            option.classList.remove('highlight-demo', 'highlight-real', 'disabled');
        });
        
        // Reset radio buttons
        demoRadio.disabled = false;
        realRadio.disabled = false;
    }

    // Remove the account type change handler since it's now automatic
    accountTypeInputs.forEach(input => {
        input.disabled = true; // Disable manual selection initially
    });

    // Update status display
    function updateStatus(isValidating = false, isValid = false, message = '') {
        statusIndicator.className = 'status-indicator';
        if (isValidating) {
            statusIndicator.classList.add('validating');
            statusText.textContent = 'Validating account...';
        } else {
            statusIndicator.classList.add(isValid ? 'valid' : 'invalid');
            statusText.textContent = message;
        }
    }

    // API key input handler with error handling
    apiKeyInput.addEventListener('input', function() {
        clearTimeout(validationTimeout);
        const apiKey = this.value.trim();
        
        if (apiKey.length >= 8) {
            updateStatus(true);
            validationTimeout = setTimeout(async () => {
                try {
                    const result = await validateApiKey(apiKey);
                    updateStatus(false, result.valid, result.message);
                } catch (error) {
                    console.error('Validation error:', error);
                    updateStatus(false, false, 'Connection error. Please try again.');
                }
            }, 500);
        } else {
            updateStatus(false, false, 'Enter your API key');
        }
    });

    // Form submission handler with correct routing
    setupForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const apiKey = apiKeyInput.value.trim();
        const selectedType = document.querySelector('input[name="account_type"]:checked').value;
        
        if (!apiKey) {
            showCyberAlert('Please enter your Deriv API key');
            return;
        }

        updateStatus(true);
        try {
            const result = await validateApiKey(apiKey);
            
            if (result.valid) {
                if (selectedType === 'real' && !window.userHasRealAccountApproval) {
                    showCyberAlert('Real account access requires admin approval. Please use a demo account or contact admin.');
                    return;
                }

                // Send API key to server using fetch
                const response = await fetch('/deriv-api/store-token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': document.querySelector('input[name="csrf_token"]').value
                    },
                    body: JSON.stringify({
                        api_key: apiKey,
                        account_type: selectedType
                    })
                });

                const data = await response.json();

                if (data.success) {
                    showCyberAlert('Account connected successfully!', 'success');
                    setTimeout(() => {
                        window.location.href = '/dashboard/user';
                    }, 1000);
                } else {
                    throw new Error(data.error || 'Failed to save API key');
                }
            } else {
                showCyberAlert(result.message);
            }
        } catch (error) {
            console.error('Submission error:', error);
            showCyberAlert('Connection error. Please try again.');
        }
    });

    // Cyberpunk-style alert function
    function showCyberAlert(message, type = 'error') {
        // Remove any existing alerts first
        const existingAlerts = document.querySelectorAll('.alert');
        existingAlerts.forEach(alert => {
            if (!alert.classList.contains('persistent-alert')) {
                alert.remove();
            }
        });

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        
        if (message.includes('Real account access requires admin approval')) {
            alertDiv.classList.add('persistent-alert');
            const messageText = message.split('HERE')[0];
            alertDiv.innerHTML = `
                <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : 'check-circle'}"></i>
                ${messageText}
                <button class="button contact-admin-btn" onclick="window.location.href='${adminContactUrl}'">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24">
                        <path d="m18 0 8 12 10-8-4 20H4L0 4l10 8 8-12z"></path>
                    </svg>
                    Contact Admin
                </button>
            `;
        } else {
            alertDiv.innerHTML = `<i class="fas fa-${type === 'error' ? 'exclamation-triangle' : 'check-circle'}"></i> ${message}`;
            setTimeout(() => {
                alertDiv.remove();
            }, 3000);
        }
        
        setupForm.insertBefore(alertDiv, setupForm.firstChild);
    }

    // Add smooth scroll handling
    const setupCard = document.querySelector('.setup-card');
    
    setupCard.addEventListener('wheel', function(e) {
        // Prevent default only if the card can scroll
        if (this.scrollHeight > this.clientHeight) {
            e.preventDefault();
            
            // Smooth scroll
            const delta = e.deltaY;
            this.scrollTop += delta;
        }
    }, { passive: false });

    // Prevent body scroll when mouse is over the card
    setupCard.addEventListener('mouseenter', function() {
        document.body.style.overflow = 'hidden';
    });

    setupCard.addEventListener('mouseleave', function() {
        document.body.style.overflow = 'auto';
    });
}); 