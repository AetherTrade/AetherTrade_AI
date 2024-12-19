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

    const form = document.querySelector('.auth-form');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const submitButton = document.querySelector('button[type="submit"]');
    const passwordToggles = document.querySelectorAll('.password-toggle');
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.querySelector('.strength-text');

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

    // Password strength checker
    function checkPasswordStrength(password) {
        let strength = 0;
        const requirements = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[^A-Za-z0-9]/.test(password)
        };

        Object.entries(requirements).forEach(([key, valid]) => {
            const element = document.getElementById(key);
            if (valid) {
                strength++;
                element.classList.add('valid');
                element.querySelector('i').className = 'fas fa-check-circle';
            } else {
                element.classList.remove('valid');
                element.querySelector('i').className = 'fas fa-circle';
            }
        });

        return {
            score: strength,
            requirements: requirements
        };
    }

    // Update password strength indicator
    passwordInput.addEventListener('input', function() {
        const result = checkPasswordStrength(this.value);
        const percentage = (result.score / 5) * 100;
        
        strengthBar.style.width = `${percentage}%`;
        strengthBar.style.background = `
            ${percentage <= 20 ? 'var(--error-color)' :
            percentage <= 40 ? 'var(--warning-color)' :
            percentage <= 60 ? '#ffd700' :
            percentage <= 80 ? '#9acd32' :
            'var(--success-color)'}
        `;

        strengthText.textContent = `
            ${percentage <= 20 ? 'Very Weak' :
            percentage <= 40 ? 'Weak' :
            percentage <= 60 ? 'Medium' :
            percentage <= 80 ? 'Strong' :
            'Very Strong'}
        `;

        validateForm();
    });

    // Validate form
    function validateForm() {
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        const strength = checkPasswordStrength(password);

        const isValid = 
            strength.score >= 4 && 
            password === confirmPassword && 
            password.length > 0;

        submitButton.disabled = !isValid;
        return isValid;
    }

    confirmPasswordInput.addEventListener('input', validateForm);

    // Form submission
    form.addEventListener('submit', function(e) {
        if (!validateForm()) {
            e.preventDefault();
            return;
        }

        // Add loading state
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting Password...';
        submitButton.disabled = true;

        // Let the form submit naturally
        return true;
    });

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