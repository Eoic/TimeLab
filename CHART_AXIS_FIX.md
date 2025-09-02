# Chart Axis Configuration Fix Summary

## 🎯 Issues Resolved

### Issue #1: X-axis "index" selection renders nothing

**Root Cause:** The `getData()` method in `csvProcessor.ts` tried to find a column named "index" in the CSV data, which doesn't exist. When `indexOf("index")` returned -1, the method returned an empty array.

**Fix:** Added special case handling for "index" to use row indices (0, 1, 2, ...) instead of column lookup.

### Issue #2: Different x-axis column selections render the same chart

**Root Cause:** X-axis type mapping was broken. The dropdown used values like "index", "time", "numeric" but the chart configuration expected "category", "time", "value". This caused incorrect axis type configuration.

**Fix:** Implemented proper mapping:

- "index" → "category"
- "time" → "time"
- "numeric" → "value"

## 🔧 Files Modified

### 1. `src/data/csvProcessor.ts`

```typescript
// BEFORE:
getData(xColumn: string, yColumn: string): ReadonlyArray<readonly [number, number]> {
    const xIndex = this.columns.indexOf(xColumn);
    const yIndex = this.columns.indexOf(yColumn);

    if (xIndex === -1 || yIndex === -1) {
        return []; // ❌ Failed for "index"
    }
    // ...
}

// AFTER:
getData(xColumn: string, yColumn: string): ReadonlyArray<readonly [number, number]> {
    // Handle special case for "index" - use row index instead of column data
    const useXIndex = xColumn === 'index';
    const useYIndex = yColumn === 'index';

    const xIndex = useXIndex ? -1 : this.columns.indexOf(xColumn);
    const yIndex = useYIndex ? -1 : this.columns.indexOf(yColumn);

    // Check if non-index columns exist
    if (!useXIndex && xIndex === -1) return [];
    if (!useYIndex && yIndex === -1) return [];

    return this.parsedData.map((row, index) => {
        const xValue = useXIndex ? index : /* column data */;
        const yValue = useYIndex ? index : /* column data */;
        return [xValue, yValue] as const;
    });
}
```

### 2. `src/charts/timeSeries.ts`

```typescript
// BEFORE:
const xType: 'category' | 'time' | 'value' =
    xTypeValue && ['category', 'time', 'value'].includes(xTypeValue)
        ? (xTypeValue as 'category' | 'time' | 'value')
        : 'category'; // ❌ "index" and "numeric" never matched

// AFTER:
const xType: 'category' | 'time' | 'value' = (() => {
    switch (xTypeValue) {
        case 'time':
            return 'time';
        case 'numeric':
            return 'value';
        case 'index':
        default:
            return 'category';
    }
})();
```

## ✅ Expected Behavior After Fix

1. **X-axis "index" selection:** Chart renders with sequential row indices (0, 1, 2, ...) on the X-axis
2. **Different column selections:** Each column selection renders different data on the corresponding axis
3. **X-axis type configuration:** "Index (category)", "Time (date/time)", and "Numeric (value axis)" options properly affect chart rendering
4. **All axis combinations:** Work correctly without conflicts

## 🧪 Test Cases

To verify the fix:

1. Load CSV data (should auto-load from `data/CurveDataExporter_Tool_LVPA-1_20250602_230.csv`)
2. Test X-axis "index" + Y-axis any column → Should show chart
3. Test X-axis "Winkel" + Y-axis "Total press force" → Should show angle vs force chart
4. Test X-axis "Total press force" + Y-axis "Winkel" → Should show different chart (axes swapped)
5. Test X-axis type changes → Should affect chart rendering behavior

## 🔍 Technical Details

### ECharts Integration

- `category` axis: Used for discrete categories, perfect for indices
- `time` axis: Used for time series data
- `value` axis: Used for continuous numeric data

### Data Flow

```
User Selection → Dropdown Values → getCurrentChartConfig() →
Type Mapping → updateDisplay() → getData() → ECharts Rendering
```

### Special "Index" Handling

The "index" option is synthetic - it doesn't correspond to a CSV column but generates row indices (0, 1, 2, ...) for use as axis values.

## 🎉 Status: RESOLVED

Both major axis configuration issues have been fixed and the chart should now respond correctly to all axis selection changes.
