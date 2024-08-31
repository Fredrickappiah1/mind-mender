document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.querySelector('.chat-container');
    const chatInput = document.querySelector('.chat-input input');
    const chatButton = document.querySelector('.chat-input button');
  
    chatButton.addEventListener('click', () => {
      const message = chatInput.value;
      if (message.trim() === '') return;
  
      appendMessage('user', message);
      chatInput.value = '';
  
      fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      })
      .then(response => response.json())
      .then(data => {
        appendMessage('bot', data.response);
      })
      .catch(error => {
        console.error('Error:', error);
        appendMessage('bot', 'Sorry, something went wrong.');
      });
    });
  
    function appendMessage(role, text) {
      const messageElement = document.createElement('div');
      messageElement.className = `message ${role}`;
      messageElement.textContent = text;
      chatContainer.appendChild(messageElement);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  });
  