/**
 * Integration test for loading screen functionality
 * Run this in the browser console to test loading screen behavior
 */

import {
    initializeLoadingScreen,
    markLoadingStepComplete,
    getLoadingState,
    forceCompleteLoading,
} from '../src/ui/loadingScreen';

declare global {
    interface Window {
        testLoadingScreen: () => void;
        getLoadingDebugInfo: () => void;
        forceComplete: () => void;
    }
}

// Test function that can be called from browser console
window.testLoadingScreen = () => {
    console.log('🧪 Testing Loading Screen Progress...');

    // Initialize if not already done
    initializeLoadingScreen();

    const requiredSteps = [
        'app-initialized',
        'project-toolbar-initialized',
        'ui-setup',
        'chart-initialized',
        'dropdowns-setup',
        'data-loaded',
        'themes-ready',
        'label-definitions-loaded',
    ];

    let stepIndex = 0;

    const progressInterval = setInterval(() => {
        if (stepIndex < requiredSteps.length) {
            const step = requiredSteps[stepIndex];

            if (!step) {
                return;
            }

            markLoadingStepComplete(step);
            stepIndex++;
        } else {
            clearInterval(progressInterval);
            console.log('✅ All steps completed! Loading should finish soon.');
        }
    }, 1000); // Complete one step every second
};

// Debug info function
window.getLoadingDebugInfo = () => {
    const state = getLoadingState();
    if (state) {
        console.log('🔍 Loading Screen Debug Info:');
        console.log('- Complete:', state.isComplete);
        console.log('- Progress:', state.progress + '%');
        console.log('- Completed Steps:', state.completedSteps);
        console.log('- Remaining Steps:', state.remainingSteps);

        // Check DOM elements
        const loadingScreen = document.getElementById('loading-screen');
        const spinner = document.querySelector('.loading-spinner');
        const percentage = document.querySelector('.loading-percentage');
        const status = document.querySelector('.loading-status');

        console.log('🎯 DOM Elements:');
        console.log('- Loading Screen:', loadingScreen ? '✅ Found' : '❌ Missing');
        console.log('- Spinner:', spinner ? '✅ Found' : '❌ Missing');
        console.log(
            '- Percentage Text:',
            percentage ? `✅ Found (${percentage.textContent})` : '❌ Missing'
        );
        console.log('- Status Text:', status ? `✅ Found` : '❌ Missing');

        // Check CSS animations
        if (spinner) {
            const spinnerStyle = window.getComputedStyle(spinner);
            const animation = spinnerStyle.animation || spinnerStyle.webkitAnimation;
            console.log('- Spinner Animation:', animation ? '✅ Active' : '❌ Not running');
        }
    } else {
        console.log('❌ Loading manager not initialized');
    }
};

// Force complete function
window.forceComplete = () => {
    console.log('🔧 Force completing loading screen...');
    forceCompleteLoading();
};

// Auto-run debug info when this script loads
if (typeof window !== 'undefined') {
    console.log('🚀 Loading Screen Test Suite Loaded!');
    console.log('Available functions:');
    console.log('- window.testLoadingScreen() - Test progress simulation');
    console.log('- window.getLoadingDebugInfo() - Show current state');
    console.log('- window.forceComplete() - Force completion');

    // Auto-debug on load
    setTimeout(() => {
        window.getLoadingDebugInfo();
    }, 1000);
}
