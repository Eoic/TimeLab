# Chart Axis Configuration Fix - Final Analysis

## 🎯 Issues Addressed

### Primary Issue

**User Report:** "Chart is always stuck on timestamp_ms, regardless of which value is chosen from the x axis dropdown."

### Root Cause Analysis

The issue appears to stem from multiple potential causes that have been systematically addressed:

1. **Index Column Handling:** The special "index" option wasn't properly handled in data retrieval
2. **X-Axis Type Mapping:** Dropdown values didn't map correctly to ECharts axis types
3. **Event Handler Issues:** Dropdown changes might not have been triggering chart updates
4. **Data Source Confusion:** User might be looking at example data instead of CSV data

## 🔧 Applied Fixes

### Fix 1: Enhanced Index Handling in CSV Processor

**File:** `src/data/csvProcessor.ts`
**Issue:** `getData()` method failed when "index" was selected as x-axis
**Solution:** Added special case handling for "index" to use row indices instead of column lookup

```typescript
// BEFORE:
getData(xColumn: string, yColumn: string) {
    const xIndex = this.columns.indexOf(xColumn); // ❌ "index" returns -1
    const yIndex = this.columns.indexOf(yColumn);
    if (xIndex === -1 || yIndex === -1) return []; // ❌ Always empty for "index"
}

// AFTER:
getData(xColumn: string, yColumn: string) {
    const useXIndex = xColumn === 'index';
    const useYIndex = yColumn === 'index';
    const xIndex = useXIndex ? -1 : this.columns.indexOf(xColumn);
    const yIndex = useYIndex ? -1 : this.columns.indexOf(yColumn);

    // ✅ Handle index specially, check only non-index columns for existence
    if (!useXIndex && xIndex === -1) return [];
    if (!useYIndex && yIndex === -1) return [];

    return this.parsedData.map((row, index) => {
        const xValue = useXIndex ? index : /* column data */;
        const yValue = useYIndex ? index : /* column data */;
        return [xValue, yValue];
    });
}
```

### Fix 2: Corrected X-Axis Type Mapping

**File:** `src/charts/timeSeries.ts`
**Issue:** Dropdown values ("index", "time", "numeric") didn't map to ECharts types ("category", "time", "value")
**Solution:** Implemented proper mapping logic

```typescript
// BEFORE:
const xType =
    xTypeValue && ['category', 'time', 'value'].includes(xTypeValue)
        ? (xTypeValue as 'category' | 'time' | 'value')
        : 'category'; // ❌ "index" and "numeric" never matched

// AFTER:
const xType = (() => {
    switch (xTypeValue) {
        case 'time':
            return 'time'; // ✅ Direct mapping
        case 'numeric':
            return 'value'; // ✅ Proper mapping
        case 'index':
        default:
            return 'category'; // ✅ Default for index/unknown
    }
})();
```

### Fix 3: Enhanced Dropdown Event Handling

**File:** `src/charts/timeSeries.ts`
**Issue:** Dropdown value reading and event handling improvements
**Solution:** Improved type casting and added debugging

```typescript
// BEFORE:
const xColumn = (xDropdown as HTMLSelectElement).value || 'index';
xDropdown?.addEventListener('change', updateChart);

// AFTER:
const xColumn = (xDropdown as { value?: string } | null)?.value || 'index';
xDropdown?.addEventListener('change', () => {
    console.log('X dropdown changed to:', (xDropdown as { value?: string } | null)?.value);
    updateChart();
});
```

### Fix 4: Added Comprehensive Debugging

**Added Debug Logging:** Console output for:

- Dropdown value changes
- Chart update function calls
- Configuration generation
- Data retrieval with source information

## 🧪 Testing Instructions

### Step 1: Load Data

1. Open the application at `http://localhost:3002`
2. **IMPORTANT:** Make sure to load actual data, not just example data
    - Use "Upload Data" to load the CSV file from `data/CurveDataExporter_Tool_LVPA-1_20250602_230.csv`
    - OR use "Add Example Data" button (which has columns: timestamp_ms, press_force_kN, piezo_strain_microstrain)

### Step 2: Test Axis Selections

1. Open browser developer console (F12) to monitor debug output
2. Test these scenarios:

#### Test A: Index X-Axis

- Set X-axis dropdown to "index"
- Set Y-axis dropdown to any data column
- **Expected:** Chart shows with sequential indices (0, 1, 2, ...) on X-axis
- **Debug Output:** Should show `xColumn: 'index'` in console

#### Test B: Different Column Selections

- Set X-axis to "Winkel" (or "timestamp_ms" if using example data)
- Set Y-axis to "Total press force" (or "press_force_kN" if using example data)
- **Expected:** Chart shows angle/time vs force
- Then swap: X-axis to "Total press force", Y-axis to "Winkel"
- **Expected:** Different chart (axes swapped)

#### Test C: X-Axis Type Configuration

- Set X-axis column to any data column
- Change "X axis type" dropdown:
    - "Index (category)" → Should use category axis
    - "Time (date/time)" → Should use time axis
    - "Numeric (value axis)" → Should use value axis
- **Expected:** Different rendering behavior for each type

### Step 3: Monitor Debug Output

Watch console for these debug messages:

```
X dropdown changed to: [selected_value]
Y dropdown changed to: [selected_value]
updateChart called with: {xColumn: "...", yColumn: "..."}
Generated config: {xColumn: "...", yColumn: "...", xType: "..."}
Retrieved data for columns: {xColumn: "...", yColumn: "...", dataLength: ..., ...}
```

## 🔍 Troubleshooting

### Issue: Still shows "timestamp_ms" data

**Likely Cause:** You're looking at example data instead of CSV data
**Solution:**

1. Check which data source is active in the Series Navigation
2. Upload the actual CSV file if needed
3. Verify dropdown options match your data columns

### Issue: Dropdown changes don't trigger console logs

**Likely Cause:** Event listeners not working
**Solution:**

1. Refresh the page
2. Check if chart initialization completed successfully
3. Verify no JavaScript errors in console

### Issue: Chart shows but wrong data

**Likely Cause:** Column mapping or data retrieval issue
**Solution:**

1. Check debug output for data retrieval
2. Verify column names match between dropdown and data
3. Check if data source has the expected columns

## 📊 Expected Data Sources

### CSV File Data (CurveDataExporter_Tool_LVPA-1_20250602_230.csv)

Columns: Winkel, Force left, Force right, Total press force, Kanal LENKIMAS DS, Kanal LENKIMAS OS, Kanal TARP PUANSONU, Kanal ROUND PUNCH, OS DOUBLE, DS DOUBLE, PLOTIS OS, SLIDE

### Example Data (from "Add Example Data" button)

Columns: timestamp_ms, press_force_kN, piezo_strain_microstrain

## 🎯 Success Criteria

✅ **X-axis "index" selection:** Chart renders with row indices  
✅ **Different column selections:** Each selection shows different chart  
✅ **X-axis type changes:** Properly affect chart rendering  
✅ **Debug output:** Console shows all expected logs  
✅ **No "stuck" behavior:** Chart updates responsively to dropdown changes

## 🔧 Status: READY FOR TESTING

All identified issues have been addressed. The chart axis configuration should now work correctly with proper debug output to help identify any remaining issues.
