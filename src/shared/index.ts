/**
 * Shared barrel export for common utilities
 */

export type { Result, Ok, Err } from './result';
export { ok, err, isOk, isErr } from './result';

export {
    TimeLabError,
    DataValidationError,
    StorageError,
    ChartError,
    FileProcessingError,
} from './errors';

export {
    LRUCache,
    memoize,
    memoizeAsync,
    debounce,
    throttle,
    PerformanceTimer,
    shallowEqual,
    deepFreeze,
    BatchProcessor,
    LazyValue,
    ObjectPool,
} from './performance';

export type {
    // Branded types
    ProjectId,
    LabelDefinitionId,
    TimeSeriesLabelId,
    DataSourceId,
    ChartId,
    // Utility types
    PartialExcept,
    RequiredFields,
    RequiredPropKeys,
    DeepReadonly,
    Mutable,
    DeepMutable,
    NonNullable,
    ValueOf,
    ArrayElement,
    WithOptional,
    WithRequired,
    // Event types
    EventEmitter,
    EventListener,
    EventHandlerMap,
    // Configuration types
    ConfigWithDefaults,
    Options,
    Merge,
    DeepMerge,
    // Service types
    ServiceMethod,
    ServiceInterface,
    ServiceMethods,
    AsyncServiceMethods,
    // Validation types
    ValidationResult,
    Validator,
    Schema,
    // Storage types
    StorageKey,
    StorageOperation,
    // Time types
    Timestamp,
    Duration,
    ISODateString,
    TimeZone,
    // Number types
    PositiveNumber,
    NonNegativeNumber,
    Percentage,
    Decimal,
} from './types';

export {
    // Branded type guards and factories
    isProjectId,
    isLabelDefinitionId,
    isTimeSeriesLabelId,
    isDataSourceId,
    isChartId,
    createProjectId,
    createLabelDefinitionId,
    createTimeSeriesLabelId,
    createDataSourceId,
    createChartId,
    // Storage utilities
    createStorageKey,
    // Time utilities
    createTimestamp,
    createDuration,
    createISODateString,
    createTimeZone,
    // Number utilities
    createPositiveNumber,
    createNonNegativeNumber,
    createPercentage,
    createDecimal,
} from './types';

export { THEMES, THEME_METADATA, isValidTheme, getThemeDisplayName } from './themes';

export type {
    Theme,
    ThemeAttribute,
    ThemeDataAttribute,
    ThemeVariablePrefix,
    ThemeClassName,
    ThemeStorageKey,
    ThemeEventName,
    SystemTheme,
    BaseTheme,
    AccessibilityTheme,
    ColorVariantTheme,
    ThemeConfig,
    ThemeMetadata,
    ThemeSelector,
    ThemeSelectorString,
    ThemeCustomProperty,
    ThemeUtilityFunction,
    ValidThemeConfig,
    ThemeCSSVariableMap,
    ThemeSwitcher,
    ThemeCSSClass,
    ThemeMediaQuery,
    ThemeTransitionConfig,
} from './themes';
