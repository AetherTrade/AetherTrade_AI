document.addEventListener('DOMContentLoaded', function() {
    const showHideBtn = document.querySelector('.show-hide-btn');
    const apiKeyInput = document.getElementById('deriv_api_key');
    const testBtn = document.getElementById('testConnection');
    const testResult = document.getElementById('testResult');

    // Show/Hide API Key
    showHideBtn.addEventListener('click', function() {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            showHideBtn.textContent = 'Hide';
        } else {
            apiKeyInput.type = 'password';
            showHideBtn.textContent = 'Show';
        }
    });

    // Test API Connection
    testBtn.addEventListener('click', async function() {
        testBtn.disabled = true;
        testBtn.textContent = 'Testing...';
        testResult.className = 'test-result';
        
        try {
            const response = await fetch('/api/test-connection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    api_key: apiKeyInput.value
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                testResult.textContent = 'Connection successful!';
                testResult.classList.add('success');
            } else {
                testResult.textContent = 'Connection failed: ' + data.error;
                testResult.classList.add('error');
            }
        } catch (error) {
            testResult.textContent = 'Connection failed: ' + error.message;
            testResult.classList.add('error');
        }
        
        testBtn.disabled = false;
        testBtn.textContent = 'Test Connection';
    });

    // Form submission
    document.querySelector('.api-form').addEventListener('submit', function(e) {
        const apiKey = apiKeyInput.value;
        if (apiKey === '********') {
            e.preventDefault();
            alert('Please enter a new API key or leave the current one unchanged.');
        }
    });
}); 