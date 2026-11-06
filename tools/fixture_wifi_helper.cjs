// Unloaded-fixture tests may rejoin their explicitly selected AP after reboot.
// Never restart an already-associated connection while DHCP/HTTP settles.
const {execFileSync}=require('node:child_process');
function joinFixtureWifi(profile,{run=execFileSync,platform=process.platform}={}) {
  if(platform!=='win32')return false;
  const status=run('netsh',['wlan','show','interfaces'],{encoding:'utf8',windowsHide:true,timeout:5000});
  const ssids=String(status).split(/\r?\n/).map(line=>line.match(/^\s*SSID\s*:\s*(.*?)\s*$/)).filter(Boolean).map(match=>match[1]);
  if(ssids.includes(profile))return false;
  run('netsh',['wlan','connect','name='+profile],{stdio:'ignore',windowsHide:true,timeout:5000});
  return true;
}
module.exports={joinFixtureWifi};
