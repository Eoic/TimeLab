# 🎯 Run Cypress Tests for Snap Settings Dropdown

## ✅ Setup Complete!

The Cypress testing infrastructure is now fully configured with the correct user flow:

1. **Load the application** → Wait for loading screen to disappear
2. **Click "Load example" button** → This makes the chart and toolbar visible
3. **Find snap settings button** → Now visible in the toolbar
4. **Test dropdown positioning** → Check if it positions correctly vs. center of screen

## 🚀 How to Run the Tests

### Option 1: Interactive Mode (Recommended)

**Terminal 1:**

```bash
cd "/c/Users/karol/Desktop/Projects/TimeLab"
npm run dev
```

(This is already running on port 3000)

**Terminal 2:**

```bash
cd "/c/Users/karol/Desktop/Projects/TimeLab"
npx cypress open
```

Then in the Cypress GUI:

1. Click "E2E Testing"
2. Choose your browser (Chrome recommended)
3. Click "Start E2E Testing"
4. Select **`dropdown-positioning.cy.ts`**
5. Watch the test run!

### Option 2: Quick Headless Test

```bash
# In a new terminal window
cd "/c/Users/karol/Desktop/Projects/TimeLab"
npx cypress run --spec "cypress/e2e/dropdown-positioning.cy.ts" --headed
```

## 🔍 What the Tests Will Show You

### Test Flow:

1. **Loads application** → Verifies page loads
2. **Clicks "Load example"** → Triggers chart and toolbar to appear
3. **Finds snap settings button** → Confirms button is visible and clickable
4. **Measures button position** → Gets exact coordinates: `{left: 245, top: 67, width: 32, height: 32}`
5. **Clicks snap settings** → Opens the dropdown
6. **Measures dropdown position** → Gets exact coordinates: `{left: 400, top: 200, width: 180, height: 120}`
7. **Validates positioning** → Checks if dropdown is:
    - ❌ **NOT in center of screen** (current bug)
    - ✅ **Near the button** (expected behavior)
    - ✅ **Within viewport bounds**

### Multiple Viewport Tests:

- **Mobile (375px)**: Tests small screen behavior
- **Tablet (768px)**: Tests medium screen behavior
- **Desktop (1920px)**: Tests large screen behavior

## 🎯 Expected Results

### If Positioning is BROKEN (current state):

```
❌ Dropdown appears in center of screen
❌ Distance from button > 200px
❌ Test fails with exact measurements
```

### If Positioning is FIXED:

```
✅ Dropdown appears near button
✅ Distance from button < 50px
✅ Not in screen center
✅ All viewport tests pass
```

## 📊 Debug Information

The tests will log exact positioning data:

```javascript
Button position: {left: 245, top: 67, width: 32, height: 32}
Dropdown position: {left: 640, top: 360, width: 180, height: 120}
Screen center: {x: 640, y: 360}
Distance from button: 425px
```

This tells you **exactly** where elements appear and why the positioning is wrong.

## 🛠️ Next Steps After Running Tests

1. **Run the test** → See exact failure measurements
2. **Fix dropdown.ts** → Use the positioning data to debug the `repositionMenu()` method
3. **Re-run test** → Verify the fix works
4. **Test all viewports** → Ensure responsive behavior

The tests replace guesswork with **precise measurements** and **automated validation**! 🎯

## 📁 Test Files Ready to Run

- ✅ `cypress/e2e/dropdown-positioning.cy.ts` - Main positioning tests
- ✅ `cypress/e2e/basic-test.cy.ts` - Simple smoke tests
- ✅ `cypress/e2e/app.cy.ts` - General app functionality
- ✅ `cypress/component/dropdown.cy.ts` - Component-level tests

**Ready to see the exact dropdown positioning behavior? Open Cypress now!** 🚀
