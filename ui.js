/**
 * UI module for DOM manipulation and event handling
 * Manages all UI interactions, rendering, and event listeners
 */

import { 
    formatTime, 
    escapeHtml, 
    debounce, 
    applyTheme, 
    getSystemTheme,
    eventEmitter 
} from './utils.js';
import { 
    getConversations, 
    getCurrentConversation, 
    createConversation, 
    deleteConversation, 
    updateConversation,
    addMessage,
    updateMessage,
    deleteMessage,
    setCurrentConversation,
    searchConversations,
    getSettings,
    updateSettings,
    getPersona,
    setPersona,
    getPersonaConfig,
    getConversationPreview,
    clearAllData,
    importSampleData
} from './store.js';
import { 
    generateStreamingResponse, 
    cancelCurrentGeneration, 
    getIsGenerating 
} from './generator.js';

// DOM element references
const elements = {};

// Current streaming message state
let currentStreamingMessage = null;
let streamingContent = '';

/**
 * Initialize UI by caching DOM elements and setting up event listeners
 */
export function initializeUI() {
    cacheElements();
    setupEventListeners();
    setupStoreListeners();
    applyInitialTheme();
    render();
}

/**
 * Cache frequently used DOM elements
 */
function cacheElements() {
    elements.app = document.getElementById('app');
    elements.sidebar = document.querySelector('.sidebar');
    elements.newConversationBtn = document.getElementById('new-conversation-btn');
    elements.conversationSearch = document.getElementById('conversation-search');
    elements.conversationListContainer = document.getElementById('conversation-list-container');
    elements.mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    elements.assistantName = document.getElementById('assistant-name');
    elements.assistantStatus = document.getElementById('assistant-status');
    elements.personaBtn = document.getElementById('persona-btn');
    elements.currentPersona = document.getElementById('current-persona');
    elements.personaDropdown = document.getElementById('persona-dropdown');
    elements.themeToggle = document.getElementById('theme-toggle');
    elements.settingsBtn = document.getElementById('settings-btn');
    elements.messagesList = document.getElementById('messages-list');
    elements.emptyState = document.getElementById('empty-state');
    elements.typingIndicator = document.getElementById('typing-indicator');
    elements.messageInput = document.getElementById('message-input');
    elements.sendBtn = document.getElementById('send-btn');
    elements.attachBtn = document.getElementById('attach-btn');
    elements.optionsBtn = document.getElementById('options-btn');
    elements.settingsModal = document.getElementById('settings-modal');
    elements.renameModal = document.getElementById('rename-modal');
    elements.editMessageModal = document.getElementById('edit-message-modal');
    elements.importModal = document.getElementById('import-modal');
    elements.toastContainer = document.getElementById('toast-container');
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // New conversation
    elements.newConversationBtn.addEventListener('click', handleNewConversation);
    
    // Search
    elements.conversationSearch.addEventListener('input', debounce(handleSearch, 300));
    
    // Mobile menu toggle
    elements.mobileMenuToggle.addEventListener('click', toggleMobileSidebar);
    
    // Persona selector
    elements.personaBtn.addEventListener('click', togglePersonaDropdown);
    document.querySelectorAll('.persona-option').forEach(option => {
        option.addEventListener('click', handlePersonaChange);
    });
    
    // Theme toggle
    elements.themeToggle.addEventListener('click', handleThemeToggle);
    
    // Settings
    elements.settingsBtn.addEventListener('click', openSettingsModal);
    
    // Message input
    elements.messageInput.addEventListener('input', handleMessageInput);
    elements.messageInput.addEventListener('keydown', handleMessageKeydown);
    
    // Send button
    elements.sendBtn.addEventListener('click', handleSendMessage);
    
    // Attach button (simulated)
    elements.attachBtn.addEventListener('click', handleAttach);
    
    // Options button
    elements.optionsBtn.addEventListener('click', handleOptions);
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
    
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', closeAllModals);
    });
    
    // Settings modal
    document.getElementById('latency-slider').addEventListener('input', handleLatencyChange);
    document.getElementById('stream-speed-slider').addEventListener('input', handleStreamSpeedChange);
    document.querySelectorAll('input[name="theme"]').forEach(radio => {
        radio.addEventListener('change', handleThemeRadioChange);
    });
    document.getElementById('clear-data-btn').addEventListener('click', handleClearData);
    document.querySelector('#settings-modal .modal-save').addEventListener('click', saveSettings);
    document.querySelector('#settings-modal .modal-cancel').addEventListener('click', closeAllModals);
    
    // Rename modal
    document.querySelector('#rename-modal .modal-save').addEventListener('click', saveConversationRename);
    document.querySelector('#rename-modal .modal-cancel').addEventListener('click', closeAllModals);
    
    // Edit message modal
    document.querySelector('#edit-message-modal .modal-save').addEventListener('click', saveMessageEdit);
    document.querySelector('#edit-message-modal .modal-cancel').addEventListener('click', closeAllModals);
    
    // Import modal
    document.querySelector('#import-modal .modal-save').addEventListener('click', handleImportSampleData);
    document.querySelector('#import-modal .modal-cancel').addEventListener('click', closeAllModals);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', handleDocumentClick);
    
    // Close mobile sidebar when clicking outside
    document.addEventListener('click', handleMobileSidebarClick);
    
    // System theme change listener
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', handleSystemThemeChange);
}

/**
 * Setup store event listeners
 */
function setupStoreListeners() {
    eventEmitter.on('conversation:created', renderConversationList);
    eventEmitter.on('conversation:updated', renderConversationList);
    eventEmitter.on('conversation:deleted', renderConversationList);
    eventEmitter.on('conversation:current-changed', handleCurrentConversationChange);
    eventEmitter.on('message:added', renderMessages);
    eventEmitter.on('message:updated', renderMessages);
    eventEmitter.on('message:deleted', renderMessages);
    eventEmitter.on('settings:updated', handleSettingsUpdated);
    eventEmitter.on('persona:changed', handlePersonaChanged);
    eventEmitter.on('store:empty', showImportModal);
    eventEmitter.on('store:cleared', () => {
        render();
        showToast('All data cleared', 'success');
    });
    eventEmitter.on('store:data-imported', () => {
        render();
        showToast('Sample data imported', 'success');
    });
}

/**
 * Apply initial theme
 */
function applyInitialTheme() {
    const settings = getSettings();
    applyTheme(settings.theme);
}

/**
 * Render the entire UI
 */
function render() {
    renderConversationList();
    renderMessages();
    renderPersona();
    renderSettings();
}

/**
 * Render conversation list
 */
function renderConversationList() {
    const conversations = getConversations();
    const currentConversation = getCurrentConversation();
    
    elements.conversationListContainer.innerHTML = '';
    
    if (conversations.length === 0) {
        elements.conversationListContainer.innerHTML = `
            <div class="empty-conversations">
                <p style="text-align: center; color: var(--text-tertiary); padding: var(--spacing-lg);">
                    No conversations yet
                </p>
            </div>
        `;
        return;
    }
    
    conversations.forEach(conversation => {
        const item = document.createElement('div');
        item.className = `conversation-item ${conversation.id === currentConversation?.id ? 'active' : ''}`;
        item.dataset.id = conversation.id;
        
        const initials = conversation.name.substring(0, 2).toUpperCase();
        const preview = getConversationPreview(conversation.id);
        
        item.innerHTML = `
            <div class="conversation-icon">${escapeHtml(initials)}</div>
            <div class="conversation-info">
                <div class="conversation-name">${escapeHtml(conversation.name)}</div>
                <div class="conversation-preview">${escapeHtml(preview)}</div>
            </div>
            <div class="conversation-actions">
                <button class="conversation-action-btn rename" title="Rename conversation">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button class="conversation-action-btn delete" title="Delete conversation">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;
        
        // Click to select conversation
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.conversation-actions')) {
                setCurrentConversation(conversation.id);
                if (isMobile()) {
                    toggleMobileSidebar();
                }
            }
        });
        
        // Rename button
        item.querySelector('.rename').addEventListener('click', (e) => {
            e.stopPropagation();
            openRenameModal(conversation.id);
        });
        
        // Delete button
        item.querySelector('.delete').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this conversation?')) {
                deleteConversation(conversation.id);
                showToast('Conversation deleted', 'success');
            }
        });
        
        elements.conversationListContainer.appendChild(item);
    });
}

/**
 * Render messages for current conversation
 */
function renderMessages() {
    const currentConversation = getCurrentConversation();
    
    if (!currentConversation || currentConversation.messages.length === 0) {
        elements.messagesList.innerHTML = '';
        elements.emptyState.style.display = 'flex';
        elements.emptyState.classList.remove('hidden');
        return;
    }
    
    elements.emptyState.style.display = 'none';
    elements.emptyState.classList.add('hidden');
    
    elements.messagesList.innerHTML = '';
    
    currentConversation.messages.forEach(message => {
        const messageEl = createMessageElement(message, currentConversation.id);
        elements.messagesList.appendChild(messageEl);
    });
    
    scrollToBottom();
}

/**
 * Create a message element
 */
function createMessageElement(message, conversationId) {
    const div = document.createElement('div');
    div.className = `message ${message.role}`;
    div.dataset.id = message.id;
    
    const avatar = message.role === 'assistant' ? 'C' : 'U';
    const time = formatTime(message.timestamp);
    
    div.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="message-text">${escapeHtml(message.content)}</div>
            </div>
            <div class="message-meta">
                <span class="message-time">${time}</span>
                <div class="message-actions">
                    <button class="message-action-btn copy" title="Copy message">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                    <button class="message-action-btn edit" title="Edit message">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="message-action-btn delete" title="Delete message">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Edit button
    // Copy button
    div.querySelector('.copy').addEventListener('click', () => {
        navigator.clipboard.writeText(message.content).then(() => {
            showToast('Message copied', 'success');
        }).catch(() => {
            showToast('Failed to copy message', 'error');
        });
    });

    // Edit button
    div.querySelector('.edit').addEventListener('click', () => {
        openEditMessageModal(conversationId, message.id);
    });
    
    // Delete button
    div.querySelector('.delete').addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this message?')) {
            deleteMessage(conversationId, message.id);
            showToast('Message deleted', 'success');
        }
    });
    
    return div;
}

/**
 * Render persona selector
 */
function renderPersona() {
    const persona = getPersona();
    const config = getPersonaConfig(persona);
    
    elements.currentPersona.textContent = config.name;
    
    document.querySelectorAll('.persona-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.persona === persona) {
            option.classList.add('active');
        }
    });
}

/**
 * Render settings in modal
 */
function renderSettings() {
    const settings = getSettings();
    
    document.getElementById('latency-slider').value = settings.latency;
    document.getElementById('latency-value').textContent = `${settings.latency}ms`;
    
    document.getElementById('stream-speed-slider').value = settings.streamSpeed;
    document.getElementById('stream-speed-value').textContent = `${settings.streamSpeed}ms`;
    
    const themeRadio = document.querySelector(`input[name="theme"][value="${settings.theme}"]`);
    if (themeRadio) {
        themeRadio.checked = true;
    }
}

/**
 * Handle new conversation
 */
function handleNewConversation() {
    const conversation = createConversation();
    showToast('New conversation created', 'success');
    elements.messageInput.focus();
}

/**
 * Handle search
 */
function handleSearch(e) {
    const query = e.target.value;
    const results = searchConversations(query);
    
    elements.conversationListContainer.innerHTML = '';
    
    if (results.length === 0) {
        elements.conversationListContainer.innerHTML = `
            <div class="empty-conversations">
                <p style="text-align: center; color: var(--text-tertiary); padding: var(--spacing-lg);">
                    No conversations found
                </p>
            </div>
        `;
        return;
    }
    
    const currentConversation = getCurrentConversation();
    
    results.forEach(conversation => {
        const item = document.createElement('div');
        item.className = `conversation-item ${conversation.id === currentConversation?.id ? 'active' : ''}`;
        item.dataset.id = conversation.id;
        
        const initials = conversation.name.substring(0, 2).toUpperCase();
        const preview = getConversationPreview(conversation.id);
        
        item.innerHTML = `
            <div class="conversation-icon">${escapeHtml(initials)}</div>
            <div class="conversation-info">
                <div class="conversation-name">${escapeHtml(conversation.name)}</div>
                <div class="conversation-preview">${escapeHtml(preview)}</div>
            </div>
            <div class="conversation-actions">
                <button class="conversation-action-btn rename" title="Rename conversation">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button class="conversation-action-btn delete" title="Delete conversation">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;
        
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.conversation-actions')) {
                setCurrentConversation(conversation.id);
                if (isMobile()) {
                    toggleMobileSidebar();
                }
            }
        });
        
        item.querySelector('.rename').addEventListener('click', (e) => {
            e.stopPropagation();
            openRenameModal(conversation.id);
        });
        
        item.querySelector('.delete').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this conversation?')) {
                deleteConversation(conversation.id);
                showToast('Conversation deleted', 'success');
            }
        });
        
        elements.conversationListContainer.appendChild(item);
    });
}

/**
 * Handle current conversation change
 */
function handleCurrentConversationChange(id) {
    renderConversationList();
    renderMessages();
    
    // Update assistant status
    if (id) {
        elements.assistantStatus.textContent = 'Online';
    } else {
        elements.assistantStatus.textContent = 'No conversation selected';
    }
}

/**
 * Toggle mobile sidebar
 */
function toggleMobileSidebar() {
    elements.sidebar.classList.toggle('open');
    const isOpen = elements.sidebar.classList.contains('open');
    elements.mobileMenuToggle.setAttribute('aria-expanded', isOpen);
}

/**
 * Handle mobile sidebar click outside
 */
function handleMobileSidebarClick(e) {
    if (isMobile() && elements.sidebar.classList.contains('open')) {
        if (!elements.sidebar.contains(e.target) && !elements.mobileMenuToggle.contains(e.target)) {
            toggleMobileSidebar();
        }
    }
}

/**
 * Toggle persona dropdown
 */
function togglePersonaDropdown() {
    elements.personaDropdown.classList.toggle('show');
    elements.personaBtn.setAttribute('aria-expanded', elements.personaDropdown.classList.contains('show'));
}

/**
 * Handle persona change
 */
function handlePersonaChange(e) {
    const persona = e.target.dataset.persona;
    setPersona(persona);
    elements.personaDropdown.classList.remove('show');
    elements.personaBtn.setAttribute('aria-expanded', 'false');
    showToast(`Persona changed to ${e.target.textContent}`, 'success');
}

/**
 * Handle theme toggle
 */
function handleThemeToggle() {
    const settings = getSettings();
    let newTheme;
    
    if (settings.theme === 'light') {
        newTheme = 'dark';
    } else if (settings.theme === 'dark') {
        newTheme = 'system';
    } else {
        newTheme = 'light';
    }
    
    updateSettings({ theme: newTheme });
    applyTheme(newTheme);
}

/**
 * Handle theme radio change
 */
function handleThemeRadioChange(e) {
    const theme = e.target.value;
    applyTheme(theme);
}

/**
 * Handle system theme change
 */
function handleSystemThemeChange(e) {
    const settings = getSettings();
    if (settings.theme === 'system') {
        applyTheme('system');
    }
}

/**
 * Open settings modal
 */
function openSettingsModal() {
    renderSettings();
    elements.settingsModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

/**
 * Handle latency slider change
 */
function handleLatencyChange(e) {
    document.getElementById('latency-value').textContent = `${e.target.value}ms`;
}

/**
 * Handle stream speed slider change
 */
function handleStreamSpeedChange(e) {
    document.getElementById('stream-speed-value').textContent = `${e.target.value}ms`;
}

/**
 * Save settings
 */
function saveSettings() {
    const latency = parseInt(document.getElementById('latency-slider').value);
    const streamSpeed = parseInt(document.getElementById('stream-speed-slider').value);
    const theme = document.querySelector('input[name="theme"]:checked').value;
    
    updateSettings({ latency, streamSpeed, theme });
    applyTheme(theme);
    
    closeAllModals();
    showToast('Settings saved', 'success');
}

/**
 * Handle settings updated
 */
function handleSettingsUpdated(settings) {
    // Settings are already applied
}

/**
 * Handle clear data
 */
function handleClearData() {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
        clearAllData();
        closeAllModals();
    }
}

/**
 * Open rename modal
 */
function openRenameModal(conversationId) {
    const conversation = getConversation(conversationId);
    if (!conversation) return;
    
    document.getElementById('rename-input').value = conversation.name;
    document.getElementById('rename-modal').dataset.conversationId = conversationId;
    elements.renameModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    setTimeout(() => {
        document.getElementById('rename-input').focus();
        document.getElementById('rename-input').select();
    }, 100);
}

/**
 * Save conversation rename
 */
function saveConversationRename() {
    const conversationId = document.getElementById('rename-modal').dataset.conversationId;
    const newName = document.getElementById('rename-input').value.trim();
    
    if (!newName) {
        showToast('Please enter a conversation name', 'error');
        return;
    }
    
    updateConversation(conversationId, { name: newName });
    closeAllModals();
    showToast('Conversation renamed', 'success');
}

/**
 * Open edit message modal
 */
function openEditMessageModal(conversationId, messageId) {
    const conversation = getConversation(conversationId);
    if (!conversation) return;
    
    const message = conversation.messages.find(m => m.id === messageId);
    if (!message) return;
    
    document.getElementById('edit-message-input').value = message.content;
    document.getElementById('edit-message-modal').dataset.conversationId = conversationId;
    document.getElementById('edit-message-modal').dataset.messageId = messageId;
    elements.editMessageModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    setTimeout(() => {
        document.getElementById('edit-message-input').focus();
    }, 100);
}

/**
 * Save message edit
 */
function saveMessageEdit() {
    const conversationId = document.getElementById('edit-message-modal').dataset.conversationId;
    const messageId = document.getElementById('edit-message-modal').dataset.messageId;
    const newContent = document.getElementById('edit-message-input').value.trim();
    
    if (!newContent) {
        showToast('Message cannot be empty', 'error');
        return;
    }
    
    updateMessage(conversationId, messageId, { content: newContent });
    closeAllModals();
    showToast('Message updated', 'success');
}

/**
 * Show import modal
 */
function showImportModal() {
    elements.importModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

/**
 * Handle import sample data
 */
function handleImportSampleData() {
    fetch('sample-data.json')
        .then(response => response.json())
        .then(data => {
            importSampleData(data.conversations);
            closeAllModals();
        })
        .catch(error => {
            console.error('Failed to load sample data:', error);
            showToast('Failed to load sample data', 'error');
            closeAllModals();
        });
}

/**
 * Close all modals
 */
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    document.body.style.overflow = '';
}

/**
 * Handle message input
 */
function handleMessageInput(e) {
    const value = e.target.value.trim();
    elements.sendBtn.disabled = !value;
    
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
}

/**
 * Handle message keydown
 */
function handleMessageKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
}

/**
 * Handle send message
 */
async function handleSendMessage() {
    const content = elements.messageInput.value.trim();
    if (!content) return;
    
    const currentConversation = getCurrentConversation();
    if (!currentConversation) {
        const newConversation = createConversation();
        setCurrentConversation(newConversation.id);
    }
    
    // Add user message
    addMessage(getCurrentConversation().id, {
        role: 'user',
        content
    });
    
    // Clear input
    elements.messageInput.value = '';
    elements.messageInput.style.height = 'auto';
    elements.sendBtn.disabled = true;
    
    // Show typing indicator
    showTypingIndicator();
    
    // Generate streaming response
    const conversationId = getCurrentConversation().id;
    const conversationHistory = getMessages(conversationId);
    const persona = getPersona();
    
    streamingContent = '';
    
    try {
        await generateStreamingResponse(
            content,
            conversationHistory,
            persona,
            (chunk) => {
                streamingContent += chunk;
                updateStreamingMessage(chunk);
            },
            (fullResponse) => {
                hideTypingIndicator();
                if (currentStreamingMessage) {
                    // Update the message with full content
                    updateMessage(conversationId, currentStreamingMessage.dataset.id, {
                        content: fullResponse
                    });
                    currentStreamingMessage = null;
                    streamingContent = '';
                }
            },
            (error) => {
                hideTypingIndicator();
                if (currentStreamingMessage) {
                    currentStreamingMessage.remove();
                    currentStreamingMessage = null;
                    streamingContent = '';
                }
                showToast('Failed to generate response', 'error');
            }
        );
    } catch (error) {
        hideTypingIndicator();
        if (currentStreamingMessage) {
            currentStreamingMessage.remove();
            currentStreamingMessage = null;
            streamingContent = '';
        }
        if (error.message !== 'Generation cancelled') {
            showToast('Failed to generate response', 'error');
        }
    }
}

/**
 * Update streaming message
 */
function updateStreamingMessage(chunk) {
    if (!currentStreamingMessage) {
        // Create new assistant message
        const conversationId = getCurrentConversation().id;
        const message = addMessage(conversationId, {
            role: 'assistant',
            content: streamingContent
        });
        
        if (message) {
            currentStreamingMessage = elements.messagesList.querySelector(`[data-id="${message.id}"]`);
        }
    } else {
        // Update existing message
        const textEl = currentStreamingMessage.querySelector('.message-text');
        if (textEl) {
            textEl.textContent = streamingContent;
        }
    }
    
    scrollToBottom();
}

/**
 * Show typing indicator
 */
function showTypingIndicator() {
    elements.typingIndicator.style.display = 'flex';
    scrollToBottom();
}

/**
 * Hide typing indicator
 */
function hideTypingIndicator() {
    elements.typingIndicator.style.display = 'none';
}

/**
 * Handle attach (simulated)
 */
function handleAttach() {
    showToast('File attachment is simulated in this demo', 'info');
}

/**
 * Handle options
 */
function handleOptions() {
    showToast('Additional options coming soon', 'info');
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + N: New conversation
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleNewConversation();
    }
    
    // Escape: Close modals
    if (e.key === 'Escape') {
        closeAllModals();
    }
    
    // Ctrl/Cmd + /: Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        elements.conversationSearch.focus();
    }
}

/**
 * Handle document click (close dropdowns)
 */
function handleDocumentClick(e) {
    if (!elements.personaBtn.contains(e.target) && !elements.personaDropdown.contains(e.target)) {
        elements.personaDropdown.classList.remove('show');
        elements.personaBtn.setAttribute('aria-expanded', 'false');
    }
}

/**
 * Handle persona changed
 */
function handlePersonaChanged(persona) {
    renderPersona();
}

/**
 * Scroll to bottom of messages
 */
function scrollToBottom() {
    elements.messagesList.scrollTop = elements.messagesList.scrollHeight;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Check if mobile
 */
function isMobile() {
    return window.innerWidth < 768;
}
