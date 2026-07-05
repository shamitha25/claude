/**
 * Main application entry point
 * Initializes the store, UI, and sets up the application
 */

import { initializeStore } from './store.js';
import { initializeUI } from './ui.js';
import { applyTheme, getSystemTheme } from './utils.js';
import { getSettings } from './store.js';

/**
 * Initialize the application
 */
function initializeApp() {
    console.log('Initializing Claude-like Assistant...');
    
    // Initialize data store
    initializeStore();
    
    // Initialize UI
    initializeUI();
    
    // Apply theme
    const settings = getSettings();
    if (settings.theme === 'system') {
        applyTheme('system');
    } else {
        applyTheme(settings.theme);
    }
    
    // Log initialization complete
    console.log('Application initialized successfully');
    
    // Set up global error handler
    window.addEventListener('error', handleGlobalError);
    
    // Set up unhandled promise rejection handler
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
}

/**
 * Handle global errors
 */
function handleGlobalError(event) {
    console.error('Global error:', event.error);
    // Could show user-friendly error message here
}

/**
 * Handle unhandled promise rejections
 */
function handleUnhandledRejection(event) {
    console.error('Unhandled promise rejection:', event.reason);
    // Could show user-friendly error message here
}

/**
 * Wait for DOM to be ready
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

/**
 * Service Worker registration (optional, for PWA support)
 * Uncomment to enable offline support
 */
/*
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful');
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}
*/

/**
 * Export for potential module usage
 */
export { initializeApp };
