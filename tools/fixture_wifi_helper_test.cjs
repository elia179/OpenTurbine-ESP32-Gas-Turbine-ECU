const assert=require('node:assert/strict');
const {joinFixtureWifi}=require('./fixture_wifi_helper.cjs');
for(const status of ['State : connected\r\nSSID : tester2\r\nAP BSSID : aa:bb', '  SSID : tester2\n']) {
  const calls=[];const run=(...args)=>{calls.push(args);return status;};
  assert.equal(joinFixtureWifi('tester2',{run,platform:'win32'}),false);
  assert.equal(calls.length,1,'A connected fixture AP must not be rejoined');
}
for(const status of ['State : disconnected', 'SSID : tester20', 'BSSID : tester2', 'SSID : other']) {
  const calls=[];const run=(...args)=>{calls.push(args);return status;};
  assert.equal(joinFixtureWifi('tester2',{run,platform:'win32'}),true);
  assert.equal(calls.length,2);assert.deepEqual(calls[1][1],['wlan','connect','name=tester2']);
}
assert.equal(joinFixtureWifi('tester2',{platform:'linux',run(){throw Error('Must not run netsh');}}),false);
console.log('PASS: fixture reconnect preserves an existing exact SSID, excludes BSSID/prefix matches and joins only when needed');
