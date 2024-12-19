document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('mainSidebar');
    const toggle = document.getElementById('sidebarToggle');
    const navItems = document.querySelectorAll('.nav-item');
    const navbar = document.querySelector('.navbar');
    
    // Adjust sidebar top position based on navbar height
    if (navbar) {
        const navbarHeight = navbar.offsetHeight;
        sidebar.style.top = `${navbarHeight}px`;
        sidebar.style.height = `calc(100vh - ${navbarHeight}px)`;
    }
    
    // Initialize sidebar state from localStorage
    const sidebarState = localStorage.getItem('sidebarCollapsed');
    if (sidebarState === 'true' && window.innerWidth <= 1024) {
        sidebar.classList.add('collapsed');
    }

    // Toggle sidebar
    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    });

    // Handle hover effects
    navItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
            if (item.querySelector('span')) {
                const tooltip = document.createElement('div');
                tooltip.className = 'nav-tooltip';
                tooltip.textContent = item.querySelector('span').textContent;
                
                if (sidebar.classList.contains('collapsed')) {
                    item.appendChild(tooltip);
                }
            }
        });

        item.addEventListener('mouseleave', () => {
            const tooltip = item.querySelector('.nav-tooltip');
            if (tooltip) {
                tooltip.remove();
            }
        });
    });

    // Handle window resize for both width and navbar height changes
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (window.innerWidth > 1024) {
                sidebar.classList.remove('collapsed');
            }
            
            // Readjust sidebar position on resize
            if (navbar) {
                const navbarHeight = navbar.offsetHeight;
                sidebar.style.top = `${navbarHeight}px`;
                sidebar.style.height = `calc(100vh - ${navbarHeight}px)`;
            }
        }, 250);
    });

    // Add smooth transitions when hovering over nav items
    navItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
            item.style.transform = 'translateX(5px)';
        });

        item.addEventListener('mouseleave', () => {
            item.style.transform = 'translateX(0)';
        });
    });

    // Handle active state
    const currentPath = window.location.pathname;
    navItems.forEach(item => {
        if (item.getAttribute('href') === currentPath) {
            item.classList.add('active');
        }
    });
}); 