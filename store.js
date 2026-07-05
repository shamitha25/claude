/**
 * Store module for managing application state and localStorage persistence
 * Handles conversations, messages, settings, and persona data
 */

import { generateId, formatTime, storage, eventEmitter } from './utils.js';

// Store keys for localStorage
const STORE_KEYS = {
    CONVERSATIONS: 'claude_conversations',
    CURRENT_CONVERSATION: 'claude_current_conversation',
    SETTINGS: 'claude_settings',
    PERSONA: 'claude_persona'
};

// Default settings
const DEFAULT_SETTINGS = {
    theme: 'system',
    latency: 500,
    streamSpeed: 30
};

// Default persona
const DEFAULT_PERSONA = 'helpful';

// Store state
let conversations = [];
let currentConversationId = null;
let settings = { ...DEFAULT_SETTINGS };
let currentPersona = DEFAULT_PERSONA;

/**
 * Initialize the store by loading data from localStorage
 */
export function initializeStore() {
    // Load conversations
    const savedConversations = storage.get(STORE_KEYS.CONVERSATIONS, []);
    conversations = savedConversations;
    
    // Load current conversation
    currentConversationId = storage.get(STORE_KEYS.CURRENT_CONVERSATION, null);
    
    // Load settings
    const savedSettings = storage.get(STORE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    settings = { ...DEFAULT_SETTINGS, ...savedSettings };
    
    // Load persona
    currentPersona = storage.get(STORE_KEYS.PERSONA, DEFAULT_PERSONA);
    
    // If no conversations exist, check if we should import sample data
    if (conversations.length === 0) {
        eventEmitter.emit('store:empty');
    }
    
    eventEmitter.emit('store:initialized');
}

/**
 * Get all conversations
 */
export function getConversations() {
    return [...conversations];
}

/**
 * Get a specific conversation by ID
 */
export function getConversation(id) {
    return conversations.find(conv => conv.id === id) || null;
}

/**
 * Get the current conversation
 */
export function getCurrentConversation() {
    if (!currentConversationId) return null;
    return getConversation(currentConversationId);
}

/**
 * Create a new conversation
 */
export function createConversation(name = null) {
    const id = generateId();
    const conversation = {
        id,
        name: name || `New Conversation`,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    
    conversations.unshift(conversation);
    saveConversations();
    setCurrentConversation(id);
    
    eventEmitter.emit('conversation:created', conversation);
    return conversation;
}

/**
 * Update a conversation
 */
export function updateConversation(id, updates) {
    const index = conversations.findIndex(conv => conv.id === id);
    if (index === -1) return null;
    
    conversations[index] = {
        ...conversations[index],
        ...updates,
        updatedAt: Date.now()
    };
    
    saveConversations();
    eventEmitter.emit('conversation:updated', conversations[index]);
    return conversations[index];
}

/**
 * Delete a conversation
 */
export function deleteConversation(id) {
    const index = conversations.findIndex(conv => conv.id === id);
    if (index === -1) return false;
    
    conversations.splice(index, 1);
    saveConversations();
    
    // If we deleted the current conversation, set a new one
    if (currentConversationId === id) {
        currentConversationId = conversations.length > 0 ? conversations[0].id : null;
        saveCurrentConversation();
    }
    
    eventEmitter.emit('conversation:deleted', id);
    return true;
}

/**
 * Set the current conversation
 */
export function setCurrentConversation(id) {
    currentConversationId = id;
    saveCurrentConversation();
    eventEmitter.emit('conversation:current-changed', id);
}

/**
 * Add a message to a conversation
 */
export function addMessage(conversationId, message) {
    const conversation = getConversation(conversationId);
    if (!conversation) return null;
    
    const newMessage = {
        id: generateId(),
        role: message.role, // 'user' or 'assistant'
        content: message.content,
        timestamp: Date.now(),
        ...message.metadata
    };
    
    conversation.messages.push(newMessage);
    conversation.updatedAt = Date.now();
    
    // Move conversation to top of list
    const index = conversations.findIndex(conv => conv.id === conversationId);
    if (index > 0) {
        conversations.splice(index, 1);
        conversations.unshift(conversation);
    }
    
    saveConversations();
    eventEmitter.emit('message:added', newMessage, conversationId);
    return newMessage;
}

/**
 * Update a message
 */
export function updateMessage(conversationId, messageId, updates) {
    const conversation = getConversation(conversationId);
    if (!conversation) return null;
    
    const messageIndex = conversation.messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return null;
    
    conversation.messages[messageIndex] = {
        ...conversation.messages[messageIndex],
        ...updates
    };
    
    conversation.updatedAt = Date.now();
    saveConversations();
    
    eventEmitter.emit('message:updated', conversation.messages[messageIndex], conversationId);
    return conversation.messages[messageIndex];
}

/**
 * Delete a message
 */
export function deleteMessage(conversationId, messageId) {
    const conversation = getConversation(conversationId);
    if (!conversation) return false;
    
    const messageIndex = conversation.messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return false;
    
    conversation.messages.splice(messageIndex, 1);
    conversation.updatedAt = Date.now();
    saveConversations();
    
    eventEmitter.emit('message:deleted', messageId, conversationId);
    return true;
}

/**
 * Get messages for a conversation
 */
export function getMessages(conversationId) {
    const conversation = getConversation(conversationId);
    return conversation ? [...conversation.messages] : [];
}

/**
 * Search conversations by name
 */
export function searchConversations(query) {
    if (!query || query.trim() === '') {
        return getConversations();
    }
    
    const lowerQuery = query.toLowerCase();
    return conversations.filter(conv => 
        conv.name.toLowerCase().includes(lowerQuery) ||
        conv.messages.some(msg => msg.content.toLowerCase().includes(lowerQuery))
    );
}

/**
 * Get settings
 */
export function getSettings() {
    return { ...settings };
}

/**
 * Update settings
 */
export function updateSettings(newSettings) {
    settings = { ...settings, ...newSettings };
    saveSettings();
    eventEmitter.emit('settings:updated', settings);
    return settings;
}

/**
 * Get current persona
 */
export function getPersona() {
    return currentPersona;
}

/**
 * Set persona
 */
export function setPersona(persona) {
    currentPersona = persona;
    storage.set(STORE_KEYS.PERSONA, persona);
    eventEmitter.emit('persona:changed', persona);
    return persona;
}

/**
 * Get persona configuration
 */
export function getPersonaConfig(persona) {
    const personas = {
        helpful: {
            name: 'Helpful',
            systemPrompt: 'You are a helpful, friendly assistant. Provide clear, accurate, and thoughtful responses. Be encouraging and supportive.',
            tone: 'friendly',
            style: 'conversational'
        },
        creative: {
            name: 'Creative',
            systemPrompt: 'You are a creative and imaginative assistant. Think outside the box, use vivid language, and explore innovative ideas. Be artistic and expressive.',
            tone: 'artistic',
            style: 'expressive'
        },
        technical: {
            name: 'Technical',
            systemPrompt: 'You are a technical expert. Provide precise, detailed, and accurate information. Use appropriate terminology and explain complex concepts clearly.',
            tone: 'professional',
            style: 'analytical'
        },
        concise: {
            name: 'Concise',
            systemPrompt: 'You are a concise assistant. Provide brief, direct answers without unnecessary elaboration. Get straight to the point.',
            tone: 'direct',
            style: 'brief'
        }
    };
    
    return personas[persona] || personas.helpful;
}

/**
 * Import sample data
 */
export function importSampleData(sampleConversations) {
    if (!Array.isArray(sampleConversations)) return false;
    
    // Add sample conversations to existing ones
    sampleConversations.forEach(sampleConv => {
        const conversation = {
            id: generateId(),
            name: sampleConv.name,
            messages: sampleConv.messages.map(msg => ({
                id: generateId(),
                role: msg.role,
                content: msg.content,
                timestamp: sampleConv.createdAt || Date.now()
            })),
            createdAt: sampleConv.createdAt || Date.now(),
            updatedAt: sampleConv.updatedAt || Date.now()
        };
        
        conversations.push(conversation);
    });
    
    saveConversations();
    
    // Set first sample as current if no current conversation
    if (!currentConversationId && conversations.length > 0) {
        setCurrentConversation(conversations[0].id);
    }
    
    eventEmitter.emit('store:data-imported');
    return true;
}

/**
 * Clear all data
 */
export function clearAllData() {
    conversations = [];
    currentConversationId = null;
    settings = { ...DEFAULT_SETTINGS };
    currentPersona = DEFAULT_PERSONA;
    
    storage.remove(STORE_KEYS.CONVERSATIONS);
    storage.remove(STORE_KEYS.CURRENT_CONVERSATION);
    storage.remove(STORE_KEYS.SETTINGS);
    storage.remove(STORE_KEYS.PERSONA);
    
    eventEmitter.emit('store:cleared');
    return true;
}

/**
 * Export all data
 */
export function exportData() {
    return {
        conversations: getConversations(),
        currentConversationId,
        settings: getSettings(),
        persona: getPersona(),
        exportedAt: Date.now()
    };
}

/**
 * Save conversations to localStorage
 */
function saveConversations() {
    storage.set(STORE_KEYS.CONVERSATIONS, conversations);
}

/**
 * Save current conversation to localStorage
 */
function saveCurrentConversation() {
    storage.set(STORE_KEYS.CURRENT_CONVERSATION, currentConversationId);
}

/**
 * Save settings to localStorage
 */
function saveSettings() {
    storage.set(STORE_KEYS.SETTINGS, settings);
}

/**
 * Get conversation statistics
 */
export function getConversationStats() {
    const totalConversations = conversations.length;
    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
    const userMessages = conversations.reduce((sum, conv) => 
        sum + conv.messages.filter(msg => msg.role === 'user').length, 0);
    const assistantMessages = conversations.reduce((sum, conv) => 
        sum + conv.messages.filter(msg => msg.role === 'assistant').length, 0);
    
    return {
        totalConversations,
        totalMessages,
        userMessages,
        assistantMessages
    };
}

/**
 * Get recent conversations (last 5)
 */
export function getRecentConversations(limit = 5) {
    return conversations.slice(0, limit);
}

/**
 * Get conversation preview text
 */
export function getConversationPreview(conversationId) {
    const conversation = getConversation(conversationId);
    if (!conversation || conversation.messages.length === 0) {
        return 'No messages yet';
    }
    
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const role = lastMessage.role === 'user' ? 'You: ' : 'Claude: ';
    return role + lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : '');
}
