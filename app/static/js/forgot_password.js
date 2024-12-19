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

    const form = document.getElementById('resetForm');
    const emailInput = document.getElementById('email');
    const submitButton = document.getElementById('submitButton');
    const validationMessage = document.querySelector('.email-validation-message');

    // Email validation
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email.toLowerCase());
    }

    // Show alert message
    function showAlert(message, type = 'info') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        form.insertBefore(alertDiv, form.firstChild);
        
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }

    // Real-time email validation
    emailInput.addEventListener('input', function() {
        const email = this.value.trim();
        
        if (email === '') {
            validationMessage.textContent = '';
            validationMessage.className = 'email-validation-message';
            submitButton.disabled = true;
        } else if (!validateEmail(email)) {
            validationMessage.textContent = 'Please enter a valid email address';
            validationMessage.className = 'email-validation-message error';
            submitButton.disabled = true;
        } else {
            validationMessage.textContent = 'Valid email address';
            validationMessage.className = 'email-validation-message success';
            submitButton.disabled = false;
        }
    });

    // Form submission
    form.addEventListener('submit', function(e) {
        const email = emailInput.value.trim();
        
        if (!validateEmail(email)) {
            e.preventDefault();
            showAlert('Please enter a valid email address', 'error');
            return;
        }

        // Add loading state
        if (submitButton) {
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            submitButton.disabled = true;
        }

        // Let the form submit naturally
        return true;
    });

    // Handle mobile keyboard
    emailInput.addEventListener('focus', function() {
        if (isMobile) {
            document.querySelector('.auth-container').style.paddingBottom = '300px';
        }
    });
    
    emailInput.addEventListener('blur', function() {
        document.querySelector('.auth-container').style.paddingBottom = '';
    });
}); 