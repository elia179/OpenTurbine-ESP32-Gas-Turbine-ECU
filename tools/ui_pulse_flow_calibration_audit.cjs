const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  globalThis.OT_UI_SIM_PORT = 16760 + Math.floor(Math.random() * 20);
  await import('./ui_mock_server.mjs');
  const base = 'http://127.0.0.1:' + globalThis.OT_UI_SIM_PORT;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const inputId = 'aux_flow_test';
    const hardware = await page.request.get(base + '/api/hardware').then(response => response.json());
    hardware.channel_registry.inputs.push({
      id:inputId, name:'Auxiliary flow', purpose:'general_flow', role:'flow', driver:2, pin:32, pulses_per_unit:50
    });
    const writes = [];
    await page.route(/\/api\/hardware(?:\?.*)?$/, route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({json:hardware, headers:{'X-OpenTurbine-ECU':'0123456789ab'}});
      }
      writes.push(route.request().postDataJSON());
      return route.fulfill({json:{ok:true}});
    });
    const setCount = (raw, boot_count = 4, analogRaw = 250) => page.request.post(base + '/__sim/data', {data:{
      mode:'STANDBY', boot_count, stop_switch_active:false, registry_inputs:[
        {id:inputId, raw, healthy:true},
        {id:'scavenge_flow', raw:analogRaw, healthy:true, raw_fresh:true}
      ]
    }});
    await setCount(0x7fffffce);
    await page.goto(base + '/calibration.html');
    await page.waitForFunction(() => calibrationConnected() && hasFreshCalibrationTelemetry());
    const row = page.locator('#flow-cal-' + inputId);
    const runPump = async sensor => {
      const panel = sensor.locator('.calibration-pump-controls');
      await panel.getByRole('checkbox',{name:'Use pump for calibration'}).check();
      await panel.getByRole('combobox').selectOption('oil_pump');
      await panel.getByRole('button',{name:'Run pump'}).click();
      await page.locator('#ot-dialog-confirm').click();
      const pumpStatus = panel.getByRole('status');
      await pumpStatus.filter({hasText:/Pump demand confirmed|command failed|Reload Calibration|wait for live/}).waitFor();
      assert.match(await pumpStatus.textContent(), /Pump demand confirmed/);
      return async () => {
        await panel.getByRole('button',{name:'Stop pump'}).click();
        await pumpStatus.filter({hasText:'Pump demand is zero. Let the reading settle'}).waitFor();
      };
    };
    const status = row.locator('div.wizard').getByRole('status');
    await row.getByRole('button',{name:'Capture starting count'}).click();
    await status.filter({hasText:'Starting count captured'}).waitFor();
    const stopPulsePump = await runPump(row);
    await setCount(150);
    await stopPulsePump();
    await row.getByRole('button',{name:'Capture ending count'}).click();
    await status.filter({hasText:'Counted 200 pulses'}).waitFor();
    await row.getByRole('spinbutton',{name:'Collected volume (L)'}).fill('2');
    await row.getByRole('button',{name:'Save calibration'}).click();
    await status.filter({hasText:'Saved 100 pulses/L'}).waitFor();
    const capture = {ecu_id:'0123456789ab', boot_count:4};
    assert.deepEqual(writes, [{channel_registry_calibration:{id:inputId, pulses_per_unit:100, _capture:capture}}]);

    const analog = page.locator('#flow-cal-scavenge_flow');
    await analog.getByRole('button',{name:'Capture zero flow'}).click();
    const stopAnalogPump = await runPump(analog);
    await setCount(150, 4, 1250);
    await page.waitForFunction(() => live.registry_inputs?.some(row => row.id==='scavenge_flow' && row.raw===1250));
    await analog.getByRole('spinbutton',{name:'Reference flow (L/min)'}).fill('8');
    await analog.getByRole('button',{name:'Capture reference'}).click();
    await stopAnalogPump();
    await analog.getByRole('button',{name:'Save calibration'}).click();
    await analog.locator('div.wizard').getByRole('status').filter({hasText:'Flow calibration saved'}).waitFor();
    assert.deepEqual(writes[1], {channel_registry_calibration:{id:'scavenge_flow',
      calibration_points:[{raw:250,value:0},{raw:1250,value:8}], _capture:capture}});

    await row.getByRole('button',{name:'Capture starting count'}).click();
    await status.filter({hasText:'Starting count captured'}).waitFor();
    await setCount(200);
    await row.getByRole('button',{name:'Capture ending count'}).click();
    await status.filter({hasText:'Counted 50 pulses'}).waitFor();
    assert.equal(await row.getByRole('button',{name:'Save calibration'}).isEnabled(),true);
    await setCount(30, 5);
    await page.waitForFunction(() => live.boot_count===5 && hasFreshCalibrationTelemetry());
    await status.filter({hasText:'The ECU restarted'}).waitFor();
    assert.equal(await row.getByRole('button',{name:'Save calibration'}).isDisabled(),true);
    const analogStatus = analog.locator('div.wizard').getByRole('status');
    await analogStatus.filter({hasText:'The ECU restarted'}).waitFor();
    assert.equal(await analog.getByRole('button',{name:'Save calibration'}).isDisabled(),true);
    await analog.getByRole('button',{name:'Capture zero flow'}).click();
    await row.getByRole('button',{name:'Capture starting count'}).click();
    await status.filter({hasText:'Starting count captured'}).waitFor();
    await setCount(80, 5, 1250);
    await row.getByRole('button',{name:'Capture ending count'}).click();
    await status.filter({hasText:'Counted 50 pulses'}).waitFor();
    await page.waitForFunction(() => live.registry_inputs?.some(row => row.id==='scavenge_flow' && row.raw===1250));
    await analog.getByRole('button',{name:'Capture reference'}).click();
    const rebootedSnapshot = async route => {
      const response = await route.fetch();
      await route.fulfill({response, json:{...(await response.json()),boot_count:6}});
    };
    await page.route('**/api/data',rebootedSnapshot);
    await analog.getByRole('button',{name:'Save calibration'}).click();
    await analogStatus.filter({hasText:'The ECU restarted'}).waitFor();
    assert.equal(await analog.getByRole('button',{name:'Save calibration'}).isDisabled(),true);
    await row.getByRole('button',{name:'Save calibration'}).click();
    await status.filter({hasText:'The ECU restarted'}).waitFor();
    assert.equal(writes.length,2);
    await page.unroute('**/api/data',rebootedSnapshot);
    await row.getByRole('button',{name:'Capture starting count'}).click();
    await status.filter({hasText:'Starting count captured'}).waitFor();
    await setCount(130, 5);
    await row.getByRole('button',{name:'Capture ending count'}).click();
    await status.filter({hasText:'Counted 50 pulses'}).waitFor();
    await page.route('**/api/data',async route => {
      const response = await route.fetch();
      await route.fulfill({response, headers:{...response.headers(),'X-OpenTurbine-ECU':'abcdef012345'}});
    });
    await row.getByRole('button',{name:'Save calibration'}).click();
    await status.filter({hasText:'The connected ECU changed'}).waitFor();
    assert.equal(writes.length,2);
    console.log('Flow calibration passed: pump reuse across pulse and analog sensors, independent saves, count rollover and restart rejection.');
  } finally {
    await browser.close();
  }
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
