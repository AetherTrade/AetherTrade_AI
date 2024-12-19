document.addEventListener('DOMContentLoaded', function() {
    // Initialize particles.js
    const isMobile = window.innerWidth <= 768;
    
    particlesJS('particles-js', {
        particles: {
            number: { value: isMobile ? 20 : 40 },
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

    const loginForm = document.querySelector('.login-form');
    const passwordToggle = document.querySelector('.password-toggle');
    const submitButton = loginForm.querySelector('button[type="submit"]');
    
    // Password visibility toggle
    if (passwordToggle) {
        passwordToggle.addEventListener('click', function() {
            const input = document.getElementById('password');
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }

    // Form validation and submission
    loginForm.addEventListener('submit', function(e) {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        removeErrors();

        if (!validateForm(email, password)) {
            e.preventDefault();
            if ('vibrate' in navigator) {
                navigator.vibrate(200);
            }
            return;
        }

        // Add loading state
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        submitButton.disabled = true;
    });

    function validateForm(email, password) {
        let isValid = true;

        if (!email || !validateEmail(email)) {
            showError('email', 'Please enter a valid email address');
            isValid = false;
        }

        if (!password) {
            showError('password', 'Please enter your password');
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
        input.parentNode.parentNode.appendChild(errorDiv);
        input.classList.add('error');

        if (isMobile) {
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    function removeErrors() {
        document.querySelectorAll('.error-message').forEach(error => error.remove());
        document.querySelectorAll('.error').forEach(input => input.classList.remove('error'));
    }

    // Handle mobile keyboard
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
}); 