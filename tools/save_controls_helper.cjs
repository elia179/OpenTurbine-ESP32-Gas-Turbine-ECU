// Use the same reveal path as a user on short viewports. Focus then pins the
// visible action bar while Playwright performs its pointer/stability checks.
async function clickSaveControls(page, selector = '#btn-save') {
  const handle = page.getByRole('button', {name:/Show save controls/});
  if (await handle.isVisible()) await handle.click();
  const save = page.locator(selector);
  await save.focus();
  await save.click();
}

async function waitForEditorBaseline(page, route) {
  await page.waitForFunction(route => {
    if (!window.OTScrollControls) return false;
    if (route === 'hardware') return typeof _hardwareModelSnap !== 'undefined' && _hardwareModelSnap !== null;
    if (route === 'sequence') return typeof _sequenceEditSnap !== 'undefined' && _sequenceEditSnap !== null;
    return typeof _fieldSnap !== 'undefined' && Object.keys(_fieldSnap).length > 0;
  }, route);
}

module.exports = {clickSaveControls, waitForEditorBaseline};
