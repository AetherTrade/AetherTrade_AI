document.addEventListener('DOMContentLoaded', function() {
    // Optimize particles for mobile
    const isMobile = window.innerWidth <= 768;
    
    particlesJS('particles-js', {
        particles: {
            number: { 
                value: isMobile ? 20 : 40 // Reduce particles on mobile
            },
            color: { value: '#dc143c' },
            shape: { type: 'circle' },
            opacity: {
                value: 0.5,
                random: true
            },
            size: {
                value: 3,
                random: true
            },
            line_linked: {
                enable: true,
                distance: 150,
                color: '#dc143c',
                opacity: 0.4,
                width: 1
            },
            move: {
                enable: true,
                speed: 2
            }
        },
        interactivity: {
            detect_on: 'canvas',
            events: {
                onhover: {
                    enable: true,
                    mode: 'repulse'
                }
            }
        }
    });

    // Prevent double-tap zoom on iOS
    document.querySelectorAll('.btn-primary, .cyber-link').forEach(element => {
        element.addEventListener('touchend', function(e) {
            e.preventDefault();
            this.click();
        });
    });

    // Handle mobile keyboard appearance
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            if (isMobile) {
                document.querySelector('.auth-container').style.paddingBottom = '300px';
            }
        });
        
        input.addEventListener('blur', function() {
            document.querySelector('.auth-container').style.paddingBottom = '';
        });
    });

    // Optimize touch events
    let touchStartY;
    document.addEventListener('touchstart', function(e) {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    // Prevent pull-to-refresh on mobile
    document.addEventListener('touchmove', function(e) {
        const touchY = e.touches[0].clientY;
        const touchDiff = touchY - touchStartY;
        
        if (touchDiff > 0 && window.scrollY === 0) {
            e.preventDefault();
        }
    }, { passive: false });

    const registerForm = document.querySelector('.register-form');
    const passwordToggles = document.querySelectorAll('.password-toggle');
    const submitButton = registerForm.querySelector('button[type="submit"]');
    
    // Password visibility toggle
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const input = this.previousElementSibling;
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    });

    // Form validation
    registerForm.addEventListener('submit', function(e) {
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        removeErrors();

        if (!validateForm(username, email, password, confirmPassword)) {
            e.preventDefault();
            handleFormError();
            return;
        }

        // Show loading state
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
        submitButton.disabled = true;
    });

    function validateForm(username, email, password, confirmPassword) {
        let isValid = true;

        if (!username || username.length < 3) {
            showError('username', 'Username must be at least 3 characters');
            isValid = false;
        }

        if (!validateEmail(email)) {
            showError('email', 'Please enter a valid email address');
            isValid = false;
        }

        if (password.length < 8) {
            showError('password', 'Password must be at least 8 characters');
            isValid = false;
        }

        if (password !== confirmPassword) {
            showError('confirm-password', 'Passwords do not match');
            isValid = false;
        }

        return isValid;
    }

    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function showError(inputId, message) {
        const input = document.getElementById(inputId);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i>${message}`;
        
        // Ensure error is visible on mobile
        const parent = input.parentNode.parentNode;
        parent.appendChild(errorDiv);
        
        // Scroll error into view on mobile
        if (isMobile) {
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        input.classList.add('error');
    }

    function removeErrors() {
        document.querySelectorAll('.error-message').forEach(error => error.remove());
        document.querySelectorAll('.error').forEach(input => input.classList.remove('error'));
    }

    // Input animations
    document.querySelectorAll('.register-form input').forEach(input => {
        input.addEventListener('focus', function() {
            this.parentNode.classList.add('focused');
        });

        input.addEventListener('blur', function() {
            if (!this.value) {
                this.parentNode.classList.remove('focused');
            }
        });
    });

    // Add vibration feedback for errors on mobile
    function handleFormError() {
        if ('vibrate' in navigator) {
            navigator.vibrate(200);
        }
    }
}); 