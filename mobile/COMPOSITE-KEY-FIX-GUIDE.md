# Table Slot Composite Key Fix Guide

## Problem
The mobile app has duplicate row data issues because image/fader data structures use only column names as keys (e.g., `colImageloop["col02"]`), causing all rows to share the same data arrays.

## Solution
Use composite keys combining row index + column name: `colImageloop["0-col02"]`, `colImageloop["1-col02"]`, etc.

## Required Changes in `/mobile/www/assets/js/slot-table.js`

### 1. Update cleanupTableState function (lines ~30-60)
Replace the array-based timeout clearing with object key iteration:

```javascript
// Clear ALL column image timeouts (now using composite keys)
Object.keys(colImageTimeout).forEach(key => {
    if (colImageTimeout[key]) {
        clearTimeout(colImageTimeout[key]);
        delete colImageTimeout[key];
    }
});

// Clear ALL column fader timeouts (now using composite keys)
Object.keys(colFaderTimeout).forEach(key => {
    if (colFaderTimeout[key]) {
        clearTimeout(colFaderTimeout[key]);
        delete colFaderTimeout[key];
    }
});
```

### 2. In row processing loop (~line 350-400)
Add composite key creation and use it for ALL array operations:

```javascript
for (const [zindex, col] of objColList.entries()) {
    var colNumber = col[0]
    const compositeKey = colRowIndex + '-' + colNumber; // ADD THIS LINE
    
    // Change all these from colNumber to compositeKey:
    colImageCurIndex[compositeKey] = 0
    colImageloop[compositeKey] = []
    colFaderCurIndex[compositeKey] = 0
    colFaderloop[compositeKey] = []
    if (colFaderTimeout[compositeKey]) { clearTimeout(colFaderTimeout[compositeKey]) }
    if (colImageTimeout[compositeKey]) { clearTimeout(colImageTimeout[compositeKey]) }
```

### 3. Image column processing (~line 370-400)
Use compositeKey in push operations:

```javascript
colImageloop[compositeKey].push(contentObj)  // was colImageloop[colNumber]

// At the end:
if (colImageloop[compositeKey].length > 0) {
    await appendColumnImage(colImageloop[compositeKey][0], colNumber, colRowIndex);
}
```

### 4. Fader column processing (~line 405-420)
Use compositeKey in push operations:

```javascript
colFaderloop[compositeKey].push(contentObj)  // was colFaderloop[colNumber]

// At the end:
appendColumnFader(colFaderloop[compositeKey][0], colNumber, colRowIndex)
```

### 5. Helper functions (~line 423-590)
These functions need compositeKey parameter and usage:

**changeColImageMedia:**
```javascript
function changeColImageMedia(colNumber, rowIndex) {
    const compositeKey = rowIndex + '-' + colNumber;
    if (colImageloop[compositeKey].length == 1) {
        colImageCurIndex[compositeKey] = 0
    }
    if (colImageCurIndex[compositeKey] >= colImageloop[compositeKey].length) {
        colImageCurIndex[compositeKey] = 0
    }
    appendColumnImage(colImageloop[compositeKey][colImageCurIndex[compositeKey]], colNumber, rowIndex)
    colImageCurIndex[compositeKey]++
}
```

**appendColumnImage:**
```javascript
async function appendColumnImage(item, colNumber, rowIndex) {
    const compositeKey = rowIndex + '-' + colNumber;
    if (colImageTimeout[compositeKey]) {
        clearTimeout(colImageTimeout[compositeKey])
    }
    // ... media loading code ...
    
    // At the end:
    colImageTimeout[compositeKey] = setTimeout(function () {
        changeColImageMedia(colNumber, rowIndex)
    }, 20000)
}
```

**changeColTextFader:**
```javascript
function changeColTextFader(colNumber, rowIndex) {
    const compositeKey = rowIndex + '-' + colNumber;
    if (colFaderloop[compositeKey].length == 1) {
        colFaderCurIndex[compositeKey] = 0
    }
    if (colFaderCurIndex[compositeKey] >= colFaderloop[compositeKey].length) {
        colFaderCurIndex[compositeKey] = 0
    }
    appendColumnFader(colFaderloop[compositeKey][colFaderCurIndex[compositeKey]], colNumber, rowIndex)
    colFaderCurIndex[compositeKey]++
}
```

**appendColumnFader:**
```javascript
function appendColumnFader(item, colNumber, rowIndex) {
    const compositeKey = rowIndex + '-' + colNumber;
    if (colFaderTimeout[compositeKey]) {
        clearTimeout(colFaderTimeout[compositeKey])
    }
    // ... fader rendering ...
    
    if (colFaderCurIndex[compositeKey] >= 1) { /* fadeIn/Out */ }
    
    colFaderTimeout[compositeKey] = setTimeout(function () {
        changeColTextFader(colNumber, rowIndex)
    }, 20000)
}
```

## Testing
After applying the fix:
1. Sync to Android: `npm run sync:android`
2. Build APK: `cd android && ./gradlew assembleDebug`
3. Load XML with multiple rows having same destinations
4. Verify each row maintains its own independent fader/image data

## Expected Result
- Row 1 (Chengdu): Shows "3U.png" + "CZ.png" cycling correctly
- Row 2 (Bangkok): Shows "SQ.png" + "NZ.png" + "SK.png" + ... cycling correctly  
- No cross-contamination between rows
