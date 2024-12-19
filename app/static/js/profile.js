class ProfileManager {
    constructor() {
        this.initializeEventListeners();
        this.loadProfileData();
        this.checkTradingStatus();
    }

    initializeEventListeners() {
        const passwordForm = document.getElementById('password-change-form');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => this.handlePasswordChange(e));
        }
    }

    async checkTradingStatus() {
        try {
            const response = await fetch('/deriv-api/get-token');
            const data = await response.json();

            if (data.success && data.token) {
                this.connectWebSocket(data.token);
            } else {
                console.log('No API token found, showing demo status');
                this.updateTradingStatus(true);
            }
        } catch (error) {
            console.error('Error checking trading status:', error);
            this.updateTradingStatus(true);
        }
    }

    connectWebSocket(token) {
        const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');

        ws.onopen = () => {
            console.log('WebSocket connected, checking account type...');
            ws.send(JSON.stringify({ authorize: token }));
        };

        ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            
            if (data.msg_type === 'authorize') {
                if (data.error) {
                    console.error('Authorization failed:', data.error);
                    this.updateTradingStatus(true);
                    return;
                }
                
                const isDemo = data.authorize.is_virtual;
                console.log(`Account type detected: ${isDemo ? 'Demo' : 'Real'}`);
                this.updateTradingStatus(isDemo);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateTradingStatus(true);
        };
    }

    updateTradingStatus(isDemo) {
        const demoContent = document.getElementById('demo-status-content');
        const realContent = document.getElementById('real-status-content');
        
        if (!demoContent || !realContent) {
            console.error('Trading status elements not found');
            return;
        }

        console.log(`Updating trading status: ${isDemo ? 'Demo' : 'Real'}`);

        demoContent.style.display = 'none';
        realContent.style.display = 'none';

        if (isDemo) {
            demoContent.style.display = 'block';
            this.updateDemoStatus();
        } else {
            realContent.style.display = 'block';
            this.updateRealStatus();
        }

        const statusCard = document.getElementById('trading-status-card');
        if (statusCard) {
            statusCard.className = `dashboard-card cyber-card ${isDemo ? 'demo-status' : 'real-status'}`;
        }
    }

    updateDemoStatus() {
        const demoContent = document.getElementById('demo-status-content');
        if (demoContent) {
            const icon = demoContent.querySelector('.card-icon i');
            if (icon) {
                icon.className = 'fas fa-info-circle pulse warning-pulse';
            }
        }
    }

    updateRealStatus() {
        const realContent = document.getElementById('real-status-content');
        if (realContent) {
            const icon = realContent.querySelector('.card-icon i');
            if (icon) {
                icon.className = 'fas fa-check-circle pulse success-pulse';
            }
        }
    }

    async loadProfileData() {
        try {
            const response = await fetch('/api/user/settings');
            const data = await response.json();
            
            if (data.success) {
                this.updateProfileInfo(data.settings);
            }
        } catch (error) {
            console.error('Error loading profile data:', error);
        }
    }

    updateProfileInfo(data) {
        const emailElement = document.getElementById('user-email');
        if (emailElement && data.email) {
            emailElement.textContent = data.email;
        }

        const joinDateElement = document.getElementById('join-date');
        if (joinDateElement && data.join_date) {
            joinDateElement.textContent = new Date(data.join_date).toLocaleDateString();
        }

        const apiStatusElement = document.getElementById('api-status');
        if (apiStatusElement) {
            const status = data.api_status || 'Not Connected';
            apiStatusElement.textContent = `API Status: ${status}`;
            apiStatusElement.className = `value ${status.toLowerCase().replace(' ', '-')}`;
        }
    }

    contactAdmin() {
        window.location.href = '/auth/admin-contact';
    }

    async handlePasswordChange(event) {
        event.preventDefault();
        
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            alert('New passwords do not match');
            return;
        }

        try {
            const response = await fetch('/api/user/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });

            const data = await response.json();
            if (data.success) {
                alert('Password updated successfully');
                event.target.reset();
            } else {
                alert(data.message || 'Failed to update password');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            alert('An error occurred while changing password');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing ProfileManager');
    window.profileManager = new ProfileManager();
});