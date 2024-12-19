document.addEventListener('DOMContentLoaded', function() {
    // Get CSRF token from meta tag
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    // Common fetch options with CSRF token
    const fetchOptions = {
        headers: {
            'X-CSRF-Token': csrfToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };

    // Elements
    const searchInput = document.getElementById('searchUsers');
    const filterSelect = document.getElementById('userFilter');
    const addUserBtn = document.getElementById('addUserBtn');
    const usersTableBody = document.getElementById('usersTableBody');
    const modal = document.getElementById('userModal');
    const modalClose = document.getElementsByClassName('close')[0];
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    // Modal Functions
    function showModal(title, content) {
        modalTitle.textContent = title;
        modalBody.innerHTML = content;
        modal.style.display = 'block';
    }

    modalClose.onclick = function() {
        modal.style.display = 'none';
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }

    // User Actions
    function showUserInfo(userId) {
        // In real application, fetch user data from server
        const row = document.querySelector(`[data-userid="${userId}"]`).closest('tr');
        const username = row.cells[0].textContent;
        const email = row.cells[1].textContent;
        const role = row.cells[2].textContent;
        const status = row.cells[3].textContent;
        const lastLogin = row.cells[4].textContent;

        const content = `
            <div class="user-info">
                <div class="info-group">
                    <span class="info-label">Username</span>
                    <span class="info-value">${username}</span>
                </div>
                <div class="info-group">
                    <span class="info-label">Email</span>
                    <span class="info-value">${email}</span>
                </div>
                <div class="info-group">
                    <span class="info-label">Role</span>
                    <span class="info-value">${role}</span>
                </div>
                <div class="info-group">
                    <span class="info-label">Status</span>
                    <span class="info-value">${status}</span>
                </div>
                <div class="info-group">
                    <span class="info-label">Last Login</span>
                    <span class="info-value">${lastLogin}</span>
                </div>
            </div>
        `;

        showModal('User Information', content);
    }

    // Search functionality
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        filterUsers(searchTerm, filterSelect.value);
    });

    // Filter functionality
    filterSelect.addEventListener('change', function() {
        filterUsers(searchInput.value.toLowerCase(), this.value);
    });

    // Add user button
    addUserBtn.addEventListener('click', function() {
        // TODO: Implement add user modal
        console.log('Add user clicked');
    });

    // Edit user buttons
    document.querySelectorAll('.action-btn.edit').forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-userid');
            editUser(userId);
        });
    });

    // Delete user buttons
    document.querySelectorAll('.action-btn.delete').forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-userid');
            deleteUser(userId);
        });
    });

    // Filter users function
    function filterUsers(searchTerm, filterValue) {
        const rows = usersTableBody.getElementsByTagName('tr');
        
        Array.from(rows).forEach(row => {
            const username = row.cells[0].textContent.toLowerCase();
            const email = row.cells[1].textContent.toLowerCase();
            const role = row.cells[2].textContent.toLowerCase();
            const status = row.cells[3].textContent.toLowerCase();
            const apiStatus = row.cells[4].textContent.toLowerCase();
            
            const matchesSearch = username.includes(searchTerm) || 
                                email.includes(searchTerm);
            
            let matchesFilter = true;
            if (filterValue !== 'all') {
                matchesFilter = (filterValue === 'admin' && role === 'admin') ||
                              (filterValue === 'active' && status === 'active') ||
                              (filterValue === 'inactive' && status === 'inactive') ||
                              (filterValue === 'api_approved' && apiStatus === 'api approved') ||
                              (filterValue === 'api_pending' && apiStatus === 'pending approval');
            }
            
            row.style.display = matchesSearch && matchesFilter ? '' : 'none';
        });
    }

    // Edit user function
    function editUser(userId) {
        const row = document.querySelector(`[data-userid="${userId}"]`).closest('tr');
        const username = row.cells[0].textContent;
        const email = row.cells[1].textContent;
        const role = row.cells[2].textContent;

        const content = `
            <form id="editUserForm" class="user-form">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" name="username" value="${username}" required>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" name="email" value="${email}" required>
                </div>
                <div class="form-group">
                    <label>Role</label>
                    <select name="role">
                        <option value="user" ${role === 'User' ? 'selected' : ''}>User</option>
                        <option value="admin" ${role === 'Admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </div>
                <button type="submit" class="submit-btn">Save Changes</button>
            </form>
        `;

        showModal('Edit User', content);

        document.getElementById('editUserForm').onsubmit = async (e) => {
            e.preventDefault();
            try {
                const formData = new FormData(e.target);
                const response = await fetch(`/api/users/${userId}/edit`, {
                    method: 'POST',
                    ...fetchOptions,
                    body: JSON.stringify(Object.fromEntries(formData))
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                location.reload();
            } catch (error) {
                console.error('Error:', error);
                alert('Error updating user. Please try again.');
            }
        };
    }

    function promoteUser(userId) {
        const content = `
            <form id="promoteUserForm" class="user-form">
                <div class="warning-message">
                    <i class="fas fa-user-shield"></i>
                    <p>You are about to promote this user to an administrator role.</p>
                    <p>This will grant them full access to the admin panel.</p>
                </div>
                <div class="form-group">
                    <label>Type "PROMOTE" to confirm</label>
                    <input type="text" name="confirmation" required pattern="PROMOTE">
                </div>
                <button type="submit" class="submit-btn promote">Confirm Promotion</button>
            </form>
        `;

        showModal('Promote User', content);

        document.getElementById('promoteUserForm').onsubmit = async (e) => {
            e.preventDefault();
            try {
                const response = await fetch(`/api/users/${userId}/promote`, {
                    method: 'POST',
                    ...fetchOptions,
                    body: JSON.stringify({})
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                // Show success message
                const successContent = `
                    <div class="promotion-result">
                        <div class="success-message">
                            <i class="fas fa-check-circle"></i>
                            <p>${data.message}</p>
                        </div>
                    </div>
                `;
                showModal('Promotion Complete', successContent);
                
                // Update the UI
                setTimeout(() => {
                    location.reload();
                }, 1500);

            } catch (error) {
                console.error('Error:', error);
                alert('Error promoting user. Please try again.');
            }
        };
    }

    function suspendUser(userId) {
        const row = document.querySelector(`[data-userid="${userId}"]`).closest('tr');
        const statusBadge = row.querySelector('.status-badge');
        const isSuspended = statusBadge.classList.contains('suspended');
        const action = isSuspended ? 'unsuspend' : 'suspend';

        const content = `
            <form id="suspendUserForm" class="user-form">
                <div class="warning-message ${action}">
                    <i class="fas ${isSuspended ? 'fa-user-check' : 'fa-user-slash'}"></i>
                    <p>You are about to ${action} this user.</p>
                    <p>${isSuspended ? 
                        'This will restore their access to the system.' : 
                        'This will prevent their access to the system.'}</p>
                </div>
                <div class="form-group">
                    <label>Type "${action.toUpperCase()}" to confirm</label>
                    <input type="text" name="confirmation" required pattern="${action.toUpperCase()}">
                </div>
                <button type="submit" class="submit-btn ${action}">
                    Confirm ${action.charAt(0).toUpperCase() + action.slice(1)}
                </button>
            </form>
        `;

        showModal(`${action.charAt(0).toUpperCase() + action.slice(1)} User`, content);

        document.getElementById('suspendUserForm').onsubmit = async (e) => {
            e.preventDefault();
            try {
                const response = await fetch(`/api/users/${userId}/suspend`, {
                    method: 'POST',
                    ...fetchOptions,
                    body: JSON.stringify({})
                });

                if (!response.ok) {
                    throw new Error('Failed to suspend user');
                }

                const data = await response.json();
                
                // Show success message
                const successContent = `
                    <div class="suspension-result">
                        <div class="success-message">
                            <i class="fas fa-check-circle"></i>
                            <p>${data.message}</p>
                        </div>
                    </div>
                `;
                showModal(`${action.charAt(0).toUpperCase() + action.slice(1)} Complete`, successContent);
                
                // Update the UI
                setTimeout(() => {
                    location.reload();
                }, 1500);

            } catch (error) {
                console.error('Error:', error);
                alert('Error suspending user. Please try again.');
            }
        };
    }

    function resetPassword(userId) {
        const content = `
            <form id="resetPasswordForm" class="user-form">
                <div class="info-message">
                    <i class="fas fa-info-circle"></i>
                    <p>This will send a password reset email to the user.</p>
                </div>
                <div class="form-group">
                    <label>Confirm Action</label>
                    <div class="checkbox-group">
                        <input type="checkbox" id="sendEmail" name="sendEmail" checked>
                        <label for="sendEmail">Send reset instructions via email</label>
                    </div>
                </div>
                <button type="submit" class="submit-btn">Send Reset Link</button>
            </form>
        `;

        showModal('Reset User Password', content);

        document.getElementById('resetPasswordForm').onsubmit = async (e) => {
            e.preventDefault();
            const row = document.querySelector(`[data-userid="${userId}"]`).closest('tr');
            const userEmail = row.cells[1].textContent; // Get user's email from the table

            try {
                const formData = new FormData(e.target);
                const sendEmail = formData.get('sendEmail') === 'on';

                // Show loading state
                e.target.querySelector('button').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
                e.target.querySelector('button').disabled = true;

                const response = await fetch(`/api/users/${userId}/reset-password`, {
                    method: 'POST',
                    ...fetchOptions,
                    body: JSON.stringify({
                        email: userEmail,
                        sendEmail: sendEmail
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                // Show success message
                const successContent = `
                    <div class="password-reset-result">
                        <div class="success-message">
                            <i class="fas fa-check-circle"></i>
                            <p>Password reset initiated successfully!</p>
                        </div>
                        ${sendEmail ? `
                            <div class="email-sent">
                                <p>Reset instructions have been sent to:</p>
                                <strong>${userEmail}</strong>
                            </div>
                        ` : `
                            <div class="temp-password">
                                <strong>Temporary Password:</strong> ${data.tempPassword}
                            </div>
                        `}
                        <p class="warning">
                            ${sendEmail ? 
                                'The reset link will expire in 24 hours.' : 
                                'Please ensure the user changes this password upon next login.'}
                        </p>
                    </div>
                `;
                showModal('Password Reset Complete', successContent);

            } catch (error) {
                console.error('Error:', error);
                alert('Error resetting password. Please try again.');
            }
        };
    }

    async function deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/users/${userId}/delete`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-Token': csrfToken,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok) {
                // Remove the user row from the table
                const userRow = document.querySelector(`tr[data-userid="${userId}"]`);
                if (userRow) {
                    userRow.remove();
                }
                alert('User deleted successfully');
            } else {
                throw new Error(data.error || 'Failed to delete user');
            }
        } catch (error) {
            alert('Error deleting user: ' + error.message);
        }
    }

    function toggleApiApproval(userId) {
        const button = document.querySelector(`.api-btn[data-userid="${userId}"]`);
        const isCurrentlyApproved = button.getAttribute('data-approved') === 'true';
        const action = isCurrentlyApproved ? 'revoke' : 'approve';

        const content = `
            <div class="modal-content">
                <form id="apiApprovalForm" class="user-form">
                    <div class="warning-message ${action}">
                        <i class="fas ${isCurrentlyApproved ? 'fa-lock' : 'fa-unlock'}"></i>
                        <p>You are about to ${action} API access for this user.</p>
                        <p>${isCurrentlyApproved ? 
                            'This will prevent them from using API trading and clear their API key.' : 
                            'This will allow them to use API trading.'}</p>
                    </div>
                    <div class="form-group">
                        <label>Type "${action.toUpperCase()}" to confirm</label>
                        <input type="text" id="confirmationInput" name="confirmation" required>
                    </div>
                    <button type="submit" class="submit-btn ${action}">
                        Confirm ${action.charAt(0).toUpperCase() + action.slice(1)}
                    </button>
                </form>
            </div>
        `;

        showModal(`${action.charAt(0).toUpperCase() + action.slice(1)} API Access`, content);

        // Add form submit handler
        const form = document.getElementById('apiApprovalForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const confirmInput = document.getElementById('confirmationInput');

            if (confirmInput.value.toUpperCase() !== action.toUpperCase()) {
                showError('Please type the correct confirmation text');
                return;
            }

            try {
                const response = await fetch(`/api/users/${userId}/toggle_api_approval`, {
                    method: 'POST',
                    ...fetchOptions,
                    body: JSON.stringify({ action })
                });

                const data = await response.json();
                
                if (data.success) {
                    const row = document.querySelector(`tr[data-userid="${userId}"]`);
                    const statusBadge = row.querySelector('.status-badge');
                    const apiButton = row.querySelector('.api-btn');
                    
                    if (isCurrentlyApproved) {
                        // Update to revoked state
                        statusBadge.textContent = 'Pending Approval';
                        statusBadge.classList.remove('approved');
                        statusBadge.classList.add('pending');
                        apiButton.setAttribute('data-approved', 'false');
                        apiButton.innerHTML = `
                            Approve API
                            <svg class="svg" viewBox="0 0 512 512">
                                <path d="M336 352c97.2 0 176-78.8 176-176S433.2 0 336 0S160 78.8 160 176c0 18.7 2.9 36.8 8.3 53.7L7 391c-4.5 4.5-7 10.6-7 17v80c0 13.3 10.7 24 24 24h80c13.3 0 24-10.7 24-24v-40h40c13.3 0 24-10.7 24-24v-40h40c6.4 0 12.5-2.5 17-7l33.3-33.3c16.9 5.4 35 8.3 53.7 8.3zm40-176c-22.1 0-40-17.9-40-40s17.9-40 40-40s40 17.9 40 40s-17.9 40-40 40z"/>
                            </svg>
                        `;
                    } else {
                        // Update to approved state
                        statusBadge.textContent = 'API Approved';
                        statusBadge.classList.remove('pending');
                        statusBadge.classList.add('approved');
                        apiButton.setAttribute('data-approved', 'true');
                        apiButton.innerHTML = `
                            Revoke API
                            <svg class="svg" viewBox="0 0 512 512">
                                <path d="M336 352c97.2 0 176-78.8 176-176S433.2 0 336 0S160 78.8 160 176c0 18.7 2.9 36.8 8.3 53.7L7 391c-4.5 4.5-7 10.6-7 17v80c0 13.3 10.7 24 24 24h80c13.3 0 24-10.7 24-24v-40h40c13.3 0 24-10.7 24-24v-40h40c6.4 0 12.5-2.5 17-7l33.3-33.3c16.9 5.4 35 8.3 53.7 8.3zM376 96a40 40 0 1 1 0 80 40 40 0 1 1 0-80z"/>
                            </svg>
                        `;
                    }

                    // Show success message and close after delay
                    showModal('Success', `
                        <div class="success-message">
                            <i class="fas fa-check-circle"></i>
                            <p>${data.message}</p>
                        </div>
                    `);
                    
                    setTimeout(() => {
                        modal.style.display = 'none';
                        // Optional: reload the page to ensure all states are in sync
                        // location.reload();
                    }, 2000);
                }

            } catch (error) {
                console.error('Error:', error);
                showModal('Error', `
                    <div class="error-message">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Error updating API approval status. Please try again.</p>
                    </div>
                `);
            }
        });
    }

    // Helper function to show errors
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        
        const form = document.getElementById('apiApprovalForm');
        form.insertBefore(errorDiv, form.firstChild);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }

    // Event Listeners
    document.querySelectorAll('.info-btn').forEach(btn => {
        btn.addEventListener('click', () => showUserInfo(btn.dataset.userid));
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => editUser(btn.dataset.userid));
    });

    document.querySelectorAll('.promote-btn').forEach(btn => {
        btn.addEventListener('click', () => promoteUser(btn.dataset.userid));
    });

    document.querySelectorAll('.suspend-btn').forEach(btn => {
        btn.addEventListener('click', () => suspendUser(btn.dataset.userid));
    });

    document.querySelectorAll('.reset-btn').forEach(btn => {
        btn.addEventListener('click', () => resetPassword(btn.dataset.userid));
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteUser(btn.dataset.userid));
    });

    document.querySelectorAll('.api-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleApiApproval(btn.dataset.userid));
    });

    // Add hover effects
    const rows = usersTableBody.getElementsByTagName('tr');
    Array.from(rows).forEach(row => {
        row.addEventListener('mouseover', function() {
            this.style.transform = 'translateX(5px)';
            this.style.transition = 'transform 0.3s';
        });
        
        row.addEventListener('mouseout', function() {
            this.style.transform = 'translateX(0)';
        });
    });
}); 