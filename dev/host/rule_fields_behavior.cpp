#include <cassert>
#include <cmath>
#include <iostream>
class Print;
#include "../../src/system/RuleFields.h"
static void near(float a,float b){assert(std::fabs(a-b)<.00001f);}
int main(){
    JsonDocument input;
    assert(!deserializeJson(input,R"({"threshold":31.25,"on_value":0.81,"off_value":0.12,"hysteresis":2.5,"input_min":-3,"input_max":7,"output_min":0.2,"output_max":0.9,"target_fixed":62,"target_low":42,"target_high":95,"target_input_min":-5,"target_input_max":8,"response_gain":0.014,"integral_gain":0.007,"deadband":0.4})"));
    Config::Rule r{};RuleFields::read(r,input.as<JsonObjectConst>());
    near(r.threshold,31.25);near(r.onValue,.81);near(r.offValue,.12);near(r.hysteresis,2.5);
    near(r.inputMin,-3);near(r.inputMax,7);near(r.outputMin,.2);near(r.outputMax,.9);
    near(r.targetFixed,62);near(r.targetLow,42);near(r.targetHigh,95);
    near(r.targetInputMin,-5);near(r.targetInputMax,8);near(r.responseGain,.014);near(r.integralGain,.007);near(r.deadband,.4);
    JsonDocument output;RuleFields::write(output.to<JsonObject>(),r);
    assert(output.size()==16);
    for(JsonPairConst field:input.as<JsonObjectConst>())near(output[field.key()].as<float>(),field.value().as<float>());
    JsonDocument empty;RuleFields::read(r,empty.to<JsonObject>());
    near(r.threshold,0);near(r.onValue,1);near(r.offValue,0);near(r.hysteresis,0);
    near(r.inputMin,0);near(r.inputMax,1);near(r.outputMin,0);near(r.outputMax,1);
    near(r.targetFixed,0);near(r.targetLow,0);near(r.targetHigh,1);near(r.targetInputMin,0);near(r.targetInputMax,1);
    near(r.responseGain,.01);near(r.integralGain,.001);near(r.deadband,0);
    std::cout<<"Rule JSON: all 16 float values, names and old-file defaults round-trip unchanged.\n";
}
