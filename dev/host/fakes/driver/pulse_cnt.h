#pragma once
#include <cstdint>
using esp_err_t=int;
constexpr esp_err_t ESP_OK=0, ESP_FAIL=-1;
constexpr int PCNT_CHANNEL_EDGE_ACTION_INCREASE=1, PCNT_CHANNEL_EDGE_ACTION_HOLD=0;
struct pcnt_unit_config_t { int low_limit=0,high_limit=0,intr_priority=0; struct { unsigned accum_count=0; } flags; };
struct pcnt_glitch_filter_config_t { uint32_t max_glitch_ns=0; };
struct pcnt_chan_config_t { int edge_gpio_num=-1,level_gpio_num=-1; struct {} flags; };
struct FakePcntUnit { int count=0; bool inputConnected=false; };
struct FakePcntChannel {};
using pcnt_unit_handle_t=FakePcntUnit*;
using pcnt_channel_handle_t=FakePcntChannel*;
inline FakePcntUnit* fakePcntLastUnit=nullptr;
inline unsigned fakePcntLiveUnits=0;
inline bool fakePcntFailAllocation=false;
bool fakePcntPadIsInput(int pin);
inline const char* esp_err_to_name(esp_err_t) { return "fake PCNT error"; }
inline esp_err_t pcnt_new_unit(const pcnt_unit_config_t*,pcnt_unit_handle_t* out) {
 if(fakePcntFailAllocation)return ESP_FAIL;
 *out=new FakePcntUnit;fakePcntLastUnit=*out;++fakePcntLiveUnits;return ESP_OK;
}
inline esp_err_t pcnt_unit_set_glitch_filter(pcnt_unit_handle_t,const pcnt_glitch_filter_config_t*) { return ESP_OK; }
inline esp_err_t pcnt_new_channel(pcnt_unit_handle_t unit,const pcnt_chan_config_t* config,pcnt_channel_handle_t* out) {
 unit->inputConnected=fakePcntPadIsInput(config->edge_gpio_num);*out=new FakePcntChannel;return ESP_OK;
}
inline esp_err_t pcnt_channel_set_edge_action(pcnt_channel_handle_t,int,int) { return ESP_OK; }
inline esp_err_t pcnt_unit_enable(pcnt_unit_handle_t) { return ESP_OK; }
inline esp_err_t pcnt_unit_disable(pcnt_unit_handle_t) { return ESP_OK; }
inline esp_err_t pcnt_unit_start(pcnt_unit_handle_t) { return ESP_OK; }
inline esp_err_t pcnt_unit_stop(pcnt_unit_handle_t) { return ESP_OK; }
inline esp_err_t pcnt_unit_clear_count(pcnt_unit_handle_t unit) { unit->count=0;return ESP_OK; }
inline esp_err_t pcnt_unit_get_count(pcnt_unit_handle_t unit,int* out) { *out=unit->inputConnected?unit->count:0;return ESP_OK; }
inline esp_err_t pcnt_del_channel(pcnt_channel_handle_t channel) { delete channel;return ESP_OK; }
inline esp_err_t pcnt_del_unit(pcnt_unit_handle_t unit) { delete unit;--fakePcntLiveUnits;return ESP_OK; }
