class GluonChat {
    constructor() {
        this.chatHistory = document.getElementById('chat-history');
        this.userInput = document.getElementById('userInput');
        this.sendButton = document.getElementById('sendButton');
        this.errorToast = document.getElementById('error-toast');
        this.welcomeMessage = document.querySelector('.welcome-message');
        this.mediaButton = document.getElementById('mediaButton');
        this.mediaInput = document.getElementById('mediaInput');
        this.selectedFile = null;
        
        this.API_KEY = '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';
        this.API_URL = 'https://openrouter.ai/api/v1/chat/completions';
        
        this.initializeEventListeners();

        // Configure MathJax for better rendering
        window.MathJax = {
            tex: {
                inlineMath: [['\\(', '\\)']],
                displayMath: [['\\[', '\\]']],
                processEscapes: true,
                packages: ['base', 'ams', 'noerrors', 'noundefined'],
                macros: {
                    // Common physics macros
                    vec: ['\\boldsymbol{#1}', 1],
                    abs: ['\\left|#1\\right|', 1],
                    norm: ['\\left\\|#1\\right\\|', 1]
                }
            },
            svg: {
                fontCache: 'global',
                scale: 1.2
            },
            options: {
                enableMenu: false,
                renderActions: {
                    addMenu: [],
                    checkLoading: []
                }
            }
        };

        // Fix for mobile viewport height
        this.setViewportHeight();
        window.addEventListener('resize', this.setViewportHeight.bind(this));
    }

    initializeEventListeners() {
        this.userInput.addEventListener('input', this.handleInput.bind(this));
        this.userInput.addEventListener('keydown', this.handleKeyDown.bind(this));
        this.sendButton.addEventListener('click', this.handleSend.bind(this));
        
        // Add media input listeners
        this.mediaButton.addEventListener('click', () => this.mediaInput.click());
        this.mediaInput.addEventListener('change', this.handleMediaSelect.bind(this));
    }

    handleInput(e) {
        const input = e.target.value.trim();
        this.sendButton.disabled = !input;
        
        // Preview LaTeX in real-time
        if (input.includes('$') || input.includes('\\[') || input.includes('\\(')) {
            const previewDiv = document.getElementById('math-preview') || (() => {
                const div = document.createElement('div');
                div.id = 'math-preview';
                div.className = 'math-preview';
                this.userInput.parentNode.insertBefore(div, this.userInput.nextSibling);
                return div;
            })();
            
            previewDiv.innerHTML = this.formatMathExpression(input);
            MathJax.typesetPromise([previewDiv]);
        } else {
            const previewDiv = document.getElementById('math-preview');
            if (previewDiv) previewDiv.remove();
        }
    }

    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!this.sendButton.disabled) {
                this.handleSend();
            }
        }
    }

    async handleSend() {
        const message = this.userInput.value.trim();
        if (!message) {
            if (this.selectedFile) {
                this.showError('Please add a message with your file');
            }
            return;
        }

        // Remove welcome message on first interaction
        if (this.welcomeMessage) {
            this.welcomeMessage.remove();
            this.welcomeMessage = null;
        }

        // Add user message
        this.addMessage(message, 'user');
        
        // Clear input and disable send button
        this.userInput.value = '';
        this.sendButton.disabled = true;

        // Show response status
        const statusIndicator = this.addResponseStatus();

        try {
            const response = await this.sendToAPI(message);
            // Remove status indicator
            statusIndicator.remove();
            // Add AI response
            this.addMessage(response, 'ai');
        } catch (error) {
            statusIndicator.remove();
            this.showError(error.message);
        }

        this.scrollToBottom();
    }

    async sendToAPI(message) {
        try {
            let formData = new FormData();
            if (this.selectedFile) {
                formData.append('file', this.selectedFile);
                message = `[File attached: ${this.selectedFile.name}] ${message}`;
                this.selectedFile = null; // Clear selected file after sending
            }

            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.API_KEY}`,
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'GluonChat',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'deepseek/deepseek-r1:free',
                    messages: [{ role: 'user', content: message }],
                })
            });

            if (!response.ok) {
                throw new Error('I am busy, please try again in a few seconds');
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || 'I am busy, please try again in a few seconds';
        } catch (error) {
            throw new Error('I am busy, please try again in a few seconds');
        }
    }

    addResponseStatus() {
        const statusDiv = document.createElement('div');
        statusDiv.className = 'typing-indicator';
        statusDiv.innerHTML = `
            Thinking
            <div class="dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        this.chatHistory.appendChild(statusDiv);
        this.scrollToBottom();
        return statusDiv;
    }

    scrollToBottom() {
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }

    formatMathExpression(text) {
        // Don't modify already properly formatted LaTeX
        if (text.includes('\\[') || text.includes('\\]') || 
            text.includes('\\(') || text.includes('\\)')) {
            return text;
        }

        // Handle display math (equations on their own line)
        text = text.replace(/\n\s*\$(.*?)\$\s*\n/g, '\n\\[\n$1\n\\]\n');
        text = text.replace(/\n\s*\$\$(.*?)\$\$\s*\n/g, '\n\\[\n$1\n\\]\n');
        
        // Handle inline math with better spacing
        text = text.replace(/\$(.*?)\$/g, ' \\($1\\) ');
        
        // Handle special cases
        text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '{\\frac{$1}{$2}}');
        text = text.replace(/\\sqrt\{([^}]+)\}/g, '{\\sqrt{$1}}');
        text = text.replace(/\\vec\{([^}]+)\}/g, '{\\vec{$1}}');
        text = text.replace(/\\hat\{([^}]+)\}/g, '{\\hat{$1}}');
        
        // Add spacing around operators
        text = text.replace(/([=+\-*/])/g, ' $1 ');
        
        return text.trim();
    }

    addMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';

        // Format and render content
        const formattedContent = this.formatMathExpression(content);
        messageContent.innerHTML = marked.parse(formattedContent);

        messageDiv.appendChild(messageContent);

        // Add button group
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'button-group';

        // Add copy button
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
        `;
        
        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(content);
            copyButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
            `;
            setTimeout(() => {
                copyButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                `;
            }, 2000);
        });
        
        buttonGroup.appendChild(copyButton);

        // Add resend button for user messages
        if (type === 'user') {
            const resendButton = document.createElement('button');
            resendButton.className = 'resend-button';
            resendButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                </svg>
            `;
            
            resendButton.addEventListener('click', async () => {
                // Find and remove the next AI message
                const nextMessage = messageDiv.nextElementSibling;
                if (nextMessage && nextMessage.classList.contains('ai-message')) {
                    nextMessage.remove();
                }

                // Show response status
                const statusIndicator = this.addResponseStatus();

                try {
                    const response = await this.sendToAPI(content);
                    // Remove status indicator
                    statusIndicator.remove();
                    // Add new AI response
                    this.addMessage(response, 'ai');
                } catch (error) {
                    statusIndicator.remove();
                    this.showError(error.message);
                }

                this.scrollToBottom();
            });

            buttonGroup.appendChild(resendButton);
        }

        messageDiv.appendChild(buttonGroup);
        this.chatHistory.appendChild(messageDiv);

        // Render math with error handling
        if (window.MathJax) {
            MathJax.typesetPromise([messageContent])
                .then(() => {
                    this.scrollToBottom();
                })
                .catch(err => {
                    console.error('MathJax error:', err);
                    // Fallback to plain text if rendering fails
                    messageContent.textContent = content;
                    this.scrollToBottom();
                });
        }
    }

    showError(message) {
        this.errorToast.textContent = message;
        this.errorToast.style.display = 'block';
        
        setTimeout(() => {
            this.errorToast.style.display = 'none';
        }, 3000);
    }

    handleMediaSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.selectedFile = file;
            
            // If it's an image, show preview without adding a message
            if (file.type.startsWith('image/')) {
                const previewDiv = document.createElement('div');
                previewDiv.className = 'media-preview-container';
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewDiv.innerHTML = `
                        <img src="${e.target.result}" class="media-preview" />
                        <span class="file-name">${file.name}</span>
                        <button class="remove-media">×</button>
                    `;
                    
                    // Add remove button functionality
                    previewDiv.querySelector('.remove-media').addEventListener('click', () => {
                        previewDiv.remove();
                        this.selectedFile = null;
                        this.mediaInput.value = '';
                    });
                };
                reader.readAsDataURL(file);
                
                // Add preview above input
                const inputContainer = document.querySelector('.input-container');
                inputContainer.insertBefore(previewDiv, inputContainer.firstChild);
            } else {
                // For non-image files, just show the filename
                const previewDiv = document.createElement('div');
                previewDiv.className = 'media-preview-container';
                previewDiv.innerHTML = `
                    <span class="file-name">${file.name}</span>
                    <button class="remove-media">×</button>
                `;
                
                previewDiv.querySelector('.remove-media').addEventListener('click', () => {
                    previewDiv.remove();
                    this.selectedFile = null;
                    this.mediaInput.value = '';
                });
                
                const inputContainer = document.querySelector('.input-container');
                inputContainer.insertBefore(previewDiv, inputContainer.firstChild);
            }
        }
    }

    setViewportHeight() {
        // First we get the viewport height and we multiple it by 1% to get a value for a vh unit
        let vh = window.innerHeight * 0.01;
        // Then we set the value in the --vh custom property to the root of the document
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
}

// Initialize the chat when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.gluonChat = new GluonChat();
}); 