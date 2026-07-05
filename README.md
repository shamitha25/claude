# Claude-like Assistant Web App

A modern, responsive single-page web application that replicates the look and behavior of an AI assistant interface. Built entirely with vanilla HTML, CSS, and JavaScript - no backend or external APIs required.

## Features

### Core Functionality
- **Two-column responsive layout**: Left sidebar for conversation list, right main area for chat
- **Message bubbles**: User and assistant messages with distinct styling
- **Compose area**: Text input with send button, attachment button, and options menu
- **Conversation management**: Create new conversations, rename, delete
- **Message editing**: Edit and delete individual messages
- **Conversation search**: Filter conversations by name
- **Theme toggle**: Switch between light and dark modes
- **Persona presets**: Pre-defined system prompt templates for different AI personalities
- **Settings modal**: Configure simulated latency and theme preferences

### AI Simulation
- **Deterministic response generator**: Client-side simulation using heuristics
  - Keyword matching with canned replies
  - Echo/paraphrase templates
  - Structured answer templates
- **Streaming-like output**: Text revealed in timed chunks
- **Typing indicator**: Visual feedback during generation
- **Cancel generation**: Stop ongoing response generation

### Accessibility
- Semantic HTML with proper ARIA roles
- Keyboard navigation support
- Focus management
- Screen reader friendly

### Data Persistence
- All conversations saved to localStorage
- Settings persisted across sessions
- Sample data import capability

## File Structure

```
claude-assistant/
├── index.html          # Main HTML structure
├── styles.css          # All styling and responsive design
├── app.js              # Main application entry point
├── store.js            # localStorage data management
├── ui.js               # DOM manipulation and event handlers
├── generator.js       # AI response simulation
├── utils.js            # Helper functions
├── sample-data.json    # Demo conversations
└── README.md           # This file
```

## How to Run Locally

### Option 1: Direct File Open
1. Clone or download the project files
2. Open `index.html` in any modern web browser
3. The app will work immediately (no server required)

### Option 2: Local Server (Recommended)
```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (with http-server)
npx http-server

# Using PHP
php -S localhost:8000
```



Then navigate to `http://localhost:8000` in your browser.

## Usage Guide

### First Launch
- The app loads with sample demo conversations
- Settings are initialized with defaults
- Theme follows system preference (light/dark)

### Creating Conversations
- Click "New Conversation" button in sidebar
- Or use keyboard shortcut: `Ctrl/Cmd + N`

### Managing Conversations
- **Rename**: Click conversation name or use context menu
- **Delete**: Click delete icon in conversation list
- **Search**: Use search input to filter conversations

### Sending Messages
- Type in the compose area and press Enter or click Send
- Use Shift+Enter for new lines
- Attach files (simulated - shows file name in message)

### Editing Messages
- Hover over a message to reveal edit/delete buttons
- Click edit to modify message content
- Click delete to remove the message

### Persona Presets
- Click the persona selector in the header
- Choose from predefined personalities (Helpful, Creative, Technical, Concise)
- Each preset uses different system prompt templates

### Settings
- Click the settings icon in the header
- Adjust simulated response latency
- Change default theme
- Clear all data (reset to factory state)

## Replacing the Simulated Generator with a Real LLM

### Step 1: Backend Setup
Create a secure backend proxy to handle API calls:

```javascript
// Example Node.js/Express backend
const express = require('express');
const app = express();

app.post('/api/chat', async (req, res) => {
  const { messages, persona } = req.body;
  
  // Call your LLM API here (e.g., OpenAI, Anthropic, etc.)
  const response = await callLLMAPI(messages, persona);
  
  res.json(response);
});

app.listen(3000);
```

### Step 2: Modify generator.js
Replace the deterministic generator with API calls:

```javascript
async function generateResponse(userMessage, conversationHistory, persona) {
  try {
    const response = await fetch('http://your-backend.com/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: conversationHistory,
        persona: persona
      })
    });
    
    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error('API Error:', error);
    return 'Sorry, I encountered an error generating a response.';
  }
}
```

### Step 3: Handle Streaming
For real-time streaming responses:

```javascript
async function generateStreamingResponse(userMessage, onChunk, onComplete) {
  const response = await fetch('http://your-backend.com/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userMessage })
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    onChunk(chunk);
  }
  
  onComplete();
}
```

### Step 4: Security Considerations
- Never expose API keys in client-side code
- Use environment variables for sensitive data
- Implement rate limiting on your backend
- Add authentication for production use
- Validate and sanitize all inputs

### Step 5: Update UI
Modify `ui.js` to handle real API states:
- Loading states during API calls
- Error handling and retry logic
- Connection status indicators
- copy to clipboard feature added
## Browser Compatibility

- Chrome/Edge: 90+
- Firefox: 88+
- Safari: 14+
- Opera: 76+

## Technical Details

### localStorage
- Stores conversations, settings, and user preferences
- Approximate limit: 5-10MB per domain
- Data persists across browser sessions

### Responsive Breakpoints
- Mobile: < 768px (sidebar hidden, toggle button)
- Tablet: 768px - 1024px (sidebar collapsible)
- Desktop: > 1024px (full two-column layout)

### CSS Animations
- Message bubble entry: 0.3s ease-out
- Theme transition: 0.2s ease-in-out
- Typing indicator: 1.5s infinite loop

## License

MIT License - Feel free to use and modify for your projects.

## Contributing

This is a demonstration project. For improvements:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## Support

For issues or questions, please open an issue in the repository.
