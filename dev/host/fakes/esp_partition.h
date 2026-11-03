#pragma once
#include <cstdint>
#include <cstring>
#include <vector>
constexpr int ESP_OK=0,ESP_PARTITION_TYPE_DATA=1;
using esp_partition_subtype_t=int;
struct esp_partition_t {uint32_t size=65536;};
inline std::vector<uint8_t> fakePartitionData;
inline const esp_partition_t* esp_partition_find_first(int,int,const char*){static esp_partition_t p;return &p;}
inline int esp_partition_read(const esp_partition_t*,uint32_t at,void* dst,size_t n){if(at+n>fakePartitionData.size())return -1;memcpy(dst,fakePartitionData.data()+at,n);return 0;}
