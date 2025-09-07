/**
 * UI layer barrel export
 */

export { focusFirst, openModal, closeModal, installModalFocusTrap } from './dom';
export { setupDropdowns, loadLabelDefinitions } from './dropdowns';
export {
    createEmptyState,
    updateEmptyState,
    setupLabelsEmptyStates,
    type EmptyStateConfig,
} from './emptyStates';
export {
    showConfirmation,
    confirmDelete,
    confirmAction,
    type ConfirmationOptions,
} from './confirmation';
export {
    initializeLoadingScreen,
    markLoadingStepComplete,
    forceCompleteLoading,
} from './loadingScreen';
