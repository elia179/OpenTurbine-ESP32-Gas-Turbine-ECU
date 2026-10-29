// Use the same reveal path as a user on short viewports. Focus then pins the
// visible action bar while Playwright performs its pointer/stability checks.
async function clickSaveControls(page, selector = '#btn-save') {
  const handle = page.getByRole('button', {name:/Show save controls/});
  if (await handle.isVisible()) await handle.click();
  const save = page.locator(selector);
  await save.focus();
  await save.click();
}

module.exports = {clickSaveControls};
