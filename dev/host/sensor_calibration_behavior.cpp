#include <Arduino.h>
#include <cassert>
#include <iostream>
static constexpr int ADC_11db = 3;
inline void analogSetAttenuation(int) {}
inline void analogReadResolution(int) {}
inline int analogRead(int) { return 0; }
#include "../../src/hal/sensors/PiecewiseCalibration.h"
#include "../../src/hal/sensors/NTCSensor.h"

static bool near(float a, float b) { return std::fabs(a-b) < .001f; }
template<class T> struct Probe : T {
    Probe() : T(32, "probe") {}
    void feed(int raw) { for (int i=0;i<4;i++) this->_avg.push(raw); }
};
int main() {
    const uint16_t raw[] = {200,2000};
    const float pressure[] = {0,3.6f};
    assert(near(PiecewiseCalibration::apply(2700,2,raw,pressure),5));
    assert(near(PiecewiseCalibration::apply(100,2,raw,pressure),-.2f));
    assert(near(PiecewiseCalibration::apply(200,2,raw,pressure),0));
    assert(near(PiecewiseCalibration::apply(2000,2,raw,pressure),3.6f));
    const float falling[] = {5,1.4f};
    assert(near(PiecewiseCalibration::apply(2700,2,raw,falling),0));
    assert(near(PiecewiseCalibration::apply(100,2,raw,falling),5.2f));
    const float command[] = {.2f,.8f};
    assert(near(PiecewiseCalibration::applyClamped(100,2,raw,command),.2f));
    assert(near(PiecewiseCalibration::applyClamped(2700,2,raw,command),.8f));
    const uint16_t duplicate[] = {200,200};
    assert(std::isnan(PiecewiseCalibration::apply(300,2,duplicate,pressure)));
    assert(std::isnan(PiecewiseCalibration::apply(NAN,2,raw,pressure)));
    assert(std::isnan(PiecewiseCalibration::apply(INFINITY,2,raw,pressure)));
    assert(std::isnan(PiecewiseCalibration::apply(300,7,raw,pressure)));
    assert(std::isnan(PiecewiseCalibration::apply(300,2,nullptr,pressure)));
    const uint16_t narrow[] = {1,2};
    const float huge[] = {0,3e38f};
    assert(std::isnan(PiecewiseCalibration::apply(4095,2,narrow,huge)));
    const uint16_t multiRaw[] = {100,1000,2000};
    const float multiVal[] = {-1,2,3};
    assert(near(PiecewiseCalibration::apply(2500,3,multiRaw,multiVal),3.5f));
    assert(near(PiecewiseCalibration::apply(0,3,multiRaw,multiVal),-1.0f-1.0f/3));

    Probe<AnalogLinearSensor> linear;
    linear.setCal({200,2000,0,3.6f});linear.feed(2700);
    assert(near(linear.getValue(),5) && linear.isHealthy());
    linear.feed(100);assert(near(linear.getValue(),-.2f) && linear.isHealthy());
    linear.feed(0);assert(!linear.isHealthy());
    linear.feed(4095);assert(!linear.isHealthy());
    linear.setCal({200,200,0,1});linear.feed(500);
    assert(std::isnan(linear.getValue()) && !linear.isHealthy());
    linear.setCal({0,1,0,3e38f});
    assert(std::isnan(linear.getValue()) && !linear.isHealthy());
    assert(linear.finiteValue() == 0);

    Probe<AnalogPolySensor> poly;
    poly.setCal({.000001f,0,0,0,100,200});
    poly.feed(150);assert(near(poly.getValue(),3.375f));
    poly.feed(250);assert(near(poly.getValue(),14) && poly.isHealthy());
    poly.feed(50);assert(near(poly.getValue(),-.5f));
    poly.setCal({0,0,1,0,100,100});assert(!poly.isHealthy());
    assert(std::isnan(CalibrationMath::polynomial(500,NAN,0,1,0,100,200)));
    // A fitted polynomial's upper tangent can point against the end-to-end
    // trend. Keep the edge value and extend the secant slope in that case.
    assert(near(CalibrationMath::polynomial(5,0,-1,6,0,0,4),10));

    Probe<NTCSensor> ntc;NTCCal cal;
    ntc.setCal(cal);ntc.feed(2048);assert(std::fabs(ntc.getValue()-25)<.1 && ntc.isHealthy());
    cal.useRawPoly=true;cal.c=-.1f;cal.d=200;cal.polyXMin=1000;cal.polyXMax=2000;
    ntc.setCal(cal);ntc.feed(500);assert(near(ntc.getValue(),150) && ntc.isHealthy());
    ntc.feed(2500);assert(near(ntc.getValue(),-50) && ntc.isHealthy());
    // Even explicitly broad validity settings cannot make NTC rails healthy.
    ntc.setHealthyRawRange(0,4095);ntc.feed(4095);assert(!ntc.isHealthy());
    ntc.feed(0);assert(!ntc.isHealthy());
    std::cout << "Sensor extrapolation: rising/falling and multi-segment curves, bounded commands, 3.6-to-5 bar regression, linear/polynomial tails, NTC rails and invalid/overflow rejection passed\n";
}
