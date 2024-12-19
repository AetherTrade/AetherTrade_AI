document.addEventListener('DOMContentLoaded', function() {
    // Flash Message Handler
    const flashMessages = document.querySelectorAll('.flash-message');
    flashMessages.forEach(message => {
        // Auto-dismiss flash messages after 5 seconds
        setTimeout(() => {
            message.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => message.remove(), 300);
        }, 5000);

        // Add close button functionality
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.className = 'flash-close';
        closeBtn.onclick = () => message.remove();
        message.appendChild(closeBtn);
    });

    // Navigation Active State
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-links a').forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });

    // Cyberpunk Glitch Effect
    const glitchElements = document.querySelectorAll('.nav-brand');
    glitchElements.forEach(element => {
        element.addEventListener('mouseover', () => {
            element.style.animation = 'glitch 0.5s infinite';
        });
        element.addEventListener('mouseout', () => {
            element.style.animation = 'none';
        });
    });

    // Smooth Scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}); 