// Fixture only: NEVER install this simulated-driver program on a power PCB.
#define OT_PCB_POWER_TEST
#include "../../../../src/hal/actuators/PcbPowerStage.cpp"
#undef digitalWrite
#undef digitalRead
#undef pinMode
static bool begun=false;
static String input;
static constexpr int signals[]={1,6,7,9,10,16};
void setup(){
 Serial.begin(115200);
 for(int p:PcbPowerStage::profile()->powerInh){gpio_set_level(static_cast<gpio_num_t>(p),0);pinMode(p,OUTPUT);}
 Serial.println("PWM_PROBE fixture-only; FREQ hz then ARM_NO_LOAD");
}
void loop(){
 if(begun)PcbPowerStage::service(true);
 while(Serial.available()){
  char c=Serial.read();if(c=='\r')continue;
  if(c!='\n'){if(input.length()<80)input+=c;continue;}
  if(input.startsWith("FREQ ")&&!begun){
   uint32_t hz=input.substring(5).toInt();bool ok=hz>=100&&hz<=20000;
   if(ok)for(int p:PcbPowerStage::profile()->powerInh)ok=PcbPowerStage::attach(p,hz)&&ok;
   Serial.println(ok?"OK FREQ":"ERR FREQ");
  }else if(input=="MIXED"&&!begun){
   const uint32_t rates[]={5000,1000,2000,4000,10000,2500};bool ok=true;
   for(int i=0;i<6;i++)ok=PcbPowerStage::attach(PcbPowerStage::profile()->powerInh[i],rates[i])&&ok;
   Serial.println(ok?"OK MIXED":"ERR MIXED");
  }else if(input=="ARM_NO_LOAD"&&!begun){
   bool ok=PcbPowerStage::waves[0].attached;
   for(int i=0;i<6&&ok;i++){
    ok=ledcAttach(signals[i],i<3?50:1000,i<3?14:10);
    if(ok){ledcWrite(signals[i],i<3?1229:512);auto& c=HardwareConfig::channelRegistry.outputs[i];c.pin=signals[i];c.driver=ChannelRegistry::Pwm;}
   }
   HardwareConfig::channelRegistry.outputCount=6;
   if(ok){PcbPowerStage::begin(true);begun=true;}
   Serial.println(ok?"OK ARM":"ERR ARM");
  }else if(input.startsWith("SET ")&&begun){
   float d=input.substring(4).toFloat();for(int p:PcbPowerStage::profile()->powerInh)PcbPowerStage::write(p,d);
   Serial.println("OK SET");
  }else if(input=="FAULT"&&begun){Mock::driver[0][0]=1;Serial.println("OK FAULT");
  }else if(input=="CLEAR"&&begun){Serial.println(PcbPowerStage::acknowledgeFault()?"OK CLEAR":"ERR CLEAR");
  }else if(input=="STALL"&&begun){delay(100);PcbPowerStage::checkDeadline();Serial.println("OK STALL");
  }else if(input=="STATUS"){
   bool ledcOk=begun;for(int i=0;i<6&&ledcOk;i++)ledcOk=std::abs(int(ledcReadFreq(signals[i]))-(i<3?50:1000))<=1;
   Serial.printf("STATUS %s latch=%u timers=%u ledc=%u ledc_ok=%u\n",PcbPowerStage::stateName(),unsigned(Mock::regs[1]),
    unsigned(std::count_if(std::begin(PcbPowerStage::waves),std::end(PcbPowerStage::waves),[](const auto& w){return w.attached;})),unsigned(HardwareConfig::channelRegistry.outputCount),unsigned(ledcOk));
  }else Serial.println("ERR COMMAND");
  input="";
 }
 delay(1);
}
