/**
 * Generator module for simulating AI responses
 * Uses deterministic heuristics: keyword matching, canned replies, echo/paraphrase templates
 * Supports streaming-like output with timed chunks
 */

import { sleep, eventEmitter } from './utils.js';
import { getPersonaConfig } from './store.js';

// Generation state
let isGenerating = false;
let cancelGeneration = false;
let currentAbortController = null;

// Keyword-based canned responses
const KEYWORD_RESPONSES = {
    greetings: {
        keywords: ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'],
        responses: [
            "Hello! How can I help you today?",
            "Hi there! What would you like to discuss?",
            "Hey! I'm here to assist you. What's on your mind?",
            "Greetings! How may I be of service?"
        ]
    },
    thanks: {
        keywords: ['thank', 'thanks', 'appreciate', 'grateful'],
        responses: [
            "You're welcome! Is there anything else I can help with?",
            "Happy to help! Let me know if you need anything else.",
            "My pleasure! Don't hesitate to ask if you have more questions.",
            "You're very welcome! I'm always here to assist."
        ]
    },
    goodbye: {
        keywords: ['bye', 'goodbye', 'see you', 'farewell', 'take care'],
        responses: [
            "Goodbye! Have a wonderful day!",
            "Take care! Feel free to come back anytime.",
            "See you later! It was great chatting with you.",
            "Farewell! Don't hesitate to return if you need help."
        ]
    },
    help: {
        keywords: ['help', 'assist', 'support', 'need help'],
        responses: [
            "I'd be happy to help! Could you tell me more about what you need assistance with?",
            "Of course! What specific problem or question can I help you with?",
            "I'm here to assist. Please describe what you'd like help with, and I'll do my best.",
            "Help is on the way! What would you like to know or accomplish?"
        ]
    },
    weather: {
        keywords: ['weather', 'temperature', 'forecast', 'rain', 'sunny'],
        responses: [
            "I don't have access to real-time weather data, but I'd recommend checking a weather app or website for accurate forecasts!",
            "While I can't check the current weather, I can help you understand weather patterns or suggest resources for forecasts.",
            "For the most up-to-date weather information, I'd suggest using a dedicated weather service. Is there anything weather-related I can explain?"
        ]
    },
    time: {
        keywords: ['time', 'clock', 'what time'],
        responses: [
            `The current time is ${new Date().toLocaleTimeString()}. Is there anything else you'd like to know?`,
            `It's ${new Date().toLocaleTimeString()} right now. How can I help you further?`
        ]
    },
    date: {
        keywords: ['date', 'today', 'what day'],
        responses: [
            `Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`,
            `The date today is ${new Date().toLocaleDateString()}. Anything else you'd like to know?`
        ]
    },
    code: {
        keywords: ['code', 'programming', 'function', 'algorithm', 'debug'],
        responses: [
            "I'd be happy to help with code! Could you share the specific code or describe the programming challenge you're facing?",
            "Programming is one of my strengths. What language or problem are you working with?",
            "Let's tackle this coding question together. Can you provide more details about what you're trying to achieve?"
        ]
    },
    joke: {
        keywords: ['joke', 'funny', 'humor', 'laugh'],
        responses: [
            "Why do programmers prefer dark mode? Because light attracts bugs! 🐛",
            "Why did the developer go broke? Because he used up all his cache! 💰",
            "What's a computer's favorite snack? Microchips! 🍟",
            "Why do Java developers wear glasses? Because they don't C#! 👓"
        ]
    },
    meaning: {
        keywords: ['meaning', 'purpose', 'life', 'existential'],
        responses: [
            "That's a profound question! The meaning of life is something philosophers have debated for centuries. What aspects are you most curious about?",
            "The search for meaning is deeply personal. Many find purpose through relationships, creativity, knowledge, or helping others. What resonates with you?",
            "Existential questions are fascinating! While there's no universal answer, exploring what gives your life meaning can be a rewarding journey."
        ]
    }
};

// Echo and paraphrase templates
const ECHO_TEMPLATES = [
    "I understand you're saying: \"{input}\". Let me elaborate on that.",
    "You mentioned \"{input}\". Here's my perspective on that.",
    "That's an interesting point about \"{input}\". Let me share some thoughts.",
    "Regarding \"{input}\" - I think there are several aspects to consider."
];

const PARAPHRASE_TEMPLATES = [
    "So what you're asking is essentially: {paraphrase}. Is that correct?",
    "To rephrase your question: {paraphrase}. Here's what I think about that.",
    "I hear you saying {paraphrase}. Let me address that.",
    "If I understand correctly, you're wondering about {paraphrase}."
];

// Structured answer templates
const STRUCTURED_TEMPLATES = {
    explanation: [
        "Here's a breakdown:\n\n1. First, {point1}\n2. Next, {point2}\n3. Finally, {point3}\n\nDoes that help clarify things?",
        "Let me explain this step by step:\n\n• {point1}\n• {point2}\n• {point3}\n\nHope this makes sense!"
    ],
    comparison: [
        "Here's a comparison:\n\n**Similarities:**\n- {similarity1}\n- {similarity2}\n\n**Differences:**\n- {difference1}\n- {difference2}\n\nLet me know if you'd like more details."
    ],
    list: [
        "Here are some key points:\n\n• {item1}\n• {item2}\n• {item3}\n• {item4}\n\nWould you like me to elaborate on any of these?"
    ]
};

// Fallback responses when no pattern matches
const FALLBACK_RESPONSES = [
    "That's an interesting question! Could you tell me more about what you're looking for?",
    "I'd be happy to help with that. Can you provide a bit more context or detail?",
    "Great question! Let me think about that for a moment. What specific aspect would you like me to focus on?",
    "I appreciate you asking! To give you the best answer, could you share a bit more information?",
    "That's something I can definitely help with. What would be most useful for you to know?",
    "Interesting! I'd love to explore that topic with you. What direction would you like to take the conversation?",
    "Thanks for asking! Let me share some thoughts on that. What's your perspective on this?",
    "I understand you're curious about this. What specific information would be most helpful for you?"
];

/**
 * Generate a response based on user input using deterministic heuristics
 */
export function generateResponse(userMessage, conversationHistory, persona = 'helpful') {
    const lowerMessage = userMessage.toLowerCase();
    const personaConfig = getPersonaConfig(persona);
    
    // Check for keyword matches
    for (const category of Object.values(KEYWORD_RESPONSES)) {
        for (const keyword of category.keywords) {
            if (lowerMessage.includes(keyword)) {
                const response = category.responses[Math.floor(Math.random() * category.responses.length)];
                return adaptResponseToPersona(response, persona);
            }
        }
    }
    
    // Check for questions
    if (lowerMessage.includes('?') || lowerMessage.startsWith('what') || lowerMessage.startsWith('how') || lowerMessage.startsWith('why') || lowerMessage.startsWith('when') || lowerMessage.startsWith('where') || lowerMessage.startsWith('who')) {
        return generateQuestionResponse(userMessage, persona);
    }
    
    // Check for statements that might need elaboration
    if (conversationHistory.length > 0) {
        const lastAssistantMessage = conversationHistory[conversationHistory.length - 1];
        if (lastAssistantMessage && lastAssistantMessage.role === 'assistant') {
            return generateFollowUpResponse(userMessage, persona);
        }
    }
    
    // Use echo template for short messages
    if (userMessage.split(' ').length <= 5) {
        const template = ECHO_TEMPLATES[Math.floor(Math.random() * ECHO_TEMPLATES.length)];
        return template.replace('{input}', userMessage);
    }
    
    // Fallback to random response
    const fallback = FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
    return adaptResponseToPersona(fallback, persona);
}

/**
 * Adapt response based on persona
 */
function adaptResponseToPersona(response, persona) {
    const personaConfig = getPersonaConfig(persona);
    
    switch (persona) {
        case 'creative':
            return addCreativeFlair(response);
        case 'technical':
            return addTechnicalPrecision(response);
        case 'concise':
            return makeConcise(response);
        case 'helpful':
        default:
            return response;
    }
}

/**
 * Add creative flair to response
 */
function addCreativeFlair(response) {
    const creativePrefixes = [
        "Imagine this: ",
        "Picture this scenario: ",
        "Here's a creative take: ",
        "Let's explore this artistically: "
    ];
    
    const prefix = creativePrefixes[Math.floor(Math.random() * creativePrefixes.length)];
    return prefix + response;
}

/**
 * Add technical precision to response
 */
function addTechnicalPrecision(response) {
    // Add structured formatting
    if (!response.includes('•') && !response.includes('1.')) {
        return response + "\n\nLet me know if you need more technical details.";
    }
    return response;
}

/**
 * Make response more concise
 */
function makeConcise(response) {
    // Remove excessive words
    return response
        .replace(/I'd be happy to /g, '')
        .replace(/I'd love to /g, '')
        .replace(/Let me /g, '')
        .replace(/Could you /g, '')
        .replace(/Would you like /g, '')
        .replace(/Is there anything /g, '')
        .trim();
}

/**
 * Generate response for questions
 */
function generateQuestionResponse(message, persona) {
    const lowerMessage = message.toLowerCase();
    
    // What questions
    if (lowerMessage.startsWith('what')) {
        if (lowerMessage.includes('meaning') || lowerMessage.includes('definition')) {
            return `The concept you're asking about is quite interesting. While I can provide a general understanding, the specific meaning can vary depending on context. Would you like me to elaborate on a particular aspect?`;
        }
        return `That's a great "what" question! The answer depends on the specific context you're interested in. Could you provide more details about what aspect you'd like me to address?`;
    }
    
    // How questions
    if (lowerMessage.startsWith('how')) {
        return `To explain "how" this works, I'd need to understand the specific process or mechanism you're referring to. Could you describe what you're trying to accomplish or understand?`;
    }
    
    // Why questions
    if (lowerMessage.startsWith('why')) {
        return `"Why" questions often have multiple layers - from immediate causes to deeper reasons. To give you a meaningful answer, could you share what context or situation you're thinking about?`;
    }
    
    // Default question response
    return `That's an interesting question! To provide the most helpful answer, I'd need a bit more context. What specific aspect would you like me to focus on?`;
}

/**
 * Generate follow-up response
 */
function generateFollowUpResponse(userMessage, persona) {
    const followUps = [
        "I see. Could you elaborate on that?",
        "Interesting point. What made you think about that?",
        "Thanks for sharing. What would you like to explore next?",
        "I understand. Is there anything specific you'd like me to help you with regarding this?",
        "Got it. How can I assist you further with this topic?"
    ];
    
    return followUps[Math.floor(Math.random() * followUps.length)];
}

/**
 * Generate streaming response with timed chunks
 */
export async function generateStreamingResponse(userMessage, conversationHistory, persona, onChunk, onComplete, onError) {
    if (isGenerating) {
        throw new Error('Already generating a response');
    }
    
    isGenerating = true;
    cancelGeneration = false;
    currentAbortController = new AbortController();
    
    try {
        const settings = JSON.parse(localStorage.getItem('claude_settings')) || { latency: 500, streamSpeed: 30 };
        
        // Simulate initial latency
        await sleep(settings.latency);
        
        if (cancelGeneration) {
            throw new Error('Generation cancelled');
        }
        
        // Generate the full response
        const fullResponse = generateResponse(userMessage, conversationHistory, persona);
        
        // Stream the response in chunks
        const chunks = splitIntoChunks(fullResponse, Math.floor(Math.random() * 3) + 2); // 2-4 characters per chunk
        
        for (const chunk of chunks) {
            if (cancelGeneration) {
                throw new Error('Generation cancelled');
            }
            
            onChunk(chunk);
            await sleep(settings.streamSpeed);
        }
        
        isGenerating = false;
        onComplete(fullResponse);
        
    } catch (error) {
        isGenerating = false;
        if (error.message !== 'Generation cancelled') {
            onError(error);
        }
    }
}

/**
 * Split text into chunks for streaming
 */
function splitIntoChunks(text, chunkSize) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
}

/**
 * Cancel ongoing generation
 */
export function cancelCurrentGeneration() {
    if (isGenerating) {
        cancelGeneration = true;
        if (currentAbortController) {
            currentAbortController.abort();
        }
        eventEmitter.emit('generation:cancelled');
    }
}

/**
 * Check if currently generating
 */
export function getIsGenerating() {
    return isGenerating;
}

/**
 * Get canned response by keyword
 */
export function getCannedResponse(keyword) {
    for (const [category, data] of Object.entries(KEYWORD_RESPONSES)) {
        if (data.keywords.includes(keyword.toLowerCase())) {
            return data.responses[Math.floor(Math.random() * data.responses.length)];
        }
    }
    return null;
}

/**
 * Add custom keyword response
 */
export function addCustomResponse(keyword, responses) {
    if (!Array.isArray(responses) || responses.length === 0) {
        throw new Error('Responses must be a non-empty array');
    }
    
    KEYWORD_RESPONSES.custom = {
        keywords: [keyword.toLowerCase()],
        responses
    };
}

/**
 * Remove custom response
 */
export function removeCustomResponse() {
    delete KEYWORD_RESPONSES.custom;
}

/**
 * Get all keyword categories
 */
export function getKeywordCategories() {
    return Object.keys(KEYWORD_RESPONSES);
}

/**
 * Test generator with a message
 */
export function testGenerator(message, persona = 'helpful') {
    return generateResponse(message, [], persona);
}
