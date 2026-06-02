function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

const messagesNode = document.getElementById('chat-messages');
const inputNode = document.getElementById('chat-input');
const sendButton = document.getElementById('chat-send');
const statusNode = document.getElementById('chat-status');

function appendMessage(text, owner) {
    const message = document.createElement('div');
    message.className = `chat-message ${owner}-message`;
    message.innerHTML = `<div class="message-body">${text.replace(/\n/g, '<br>')}</div>`;
    messagesNode.appendChild(message);
    messagesNode.scrollTop = messagesNode.scrollHeight;
}

function appendStatus(text) {
    statusNode.textContent = text;
}

async function fetchChatHistory() {
    appendStatus('Loading previous chat history...');
    const response = await fetch('/api/ai/history/', {
        credentials: 'same-origin',
    });
    const payload = await response.json();
    if (payload.status === 'success' && Array.isArray(payload.data.history)) {
        messagesNode.innerHTML = '';
        payload.data.history.reverse().forEach(entry => {
            appendMessage(`Q: ${entry.question}`, 'user');
            appendMessage(`A: ${entry.answer}`, 'ai');
        });
    } else {
        appendMessage('Unable to load chat history at this time.', 'ai');
    }
    appendStatus('');
}

async function sendQuestion() {
    const question = inputNode.value.trim();
    if (!question) {
        appendStatus('Please type a question before sending.');
        return;
    }
    inputNode.value = '';
    appendMessage(`Q: ${question}`, 'user');
    appendStatus('Thinking...');
    messagesNode.scrollTop = messagesNode.scrollHeight;
    const token = getCookie('csrftoken');
    try {
        const response = await fetch('/api/ask-ai/', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': token || '',
            },
            body: JSON.stringify({ question }),
        });
        const payload = await response.json();
        if (payload.status === 'success') {
            appendMessage(payload.data.answer, 'ai');
            appendStatus('');
        } else {
            appendMessage(payload.message || 'Unable to process your question.', 'ai');
            appendStatus('');
        }
    } catch (error) {
        appendMessage('Server error. Please try again later.', 'ai');
        appendStatus('');
    }
}

sendButton.addEventListener('click', sendQuestion);
inputNode.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendQuestion();
    }
});

window.addEventListener('load', fetchChatHistory);

const logoutLink = document.getElementById('logout-link');
if (logoutLink) {
    logoutLink.addEventListener('click', async event => {
        event.preventDefault();
        const token = getCookie('csrftoken');
        await fetch('/api/auth/logout/', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': token || '',
            },
        });
        window.location.href = '/login/';
    });
}
