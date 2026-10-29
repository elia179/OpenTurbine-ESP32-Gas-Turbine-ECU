#pragma once
#include <Arduino.h>
#include <vector>
#include <deque>
class HardwareSerial {
public:
    std::vector<uint8_t> bytes;
    std::deque<uint8_t> incoming;
    int capacity=4096;
    explicit HardwareSerial(int = 0) {}
    void setTxBufferSize(size_t size){capacity=static_cast<int>(size);}
    void begin(uint32_t,int,int,int){}
    int available() const {return static_cast<int>(incoming.size());}
    int read(){if(incoming.empty())return -1;int value=incoming.front();incoming.pop_front();return value;}
    int availableForWrite() const { return std::max(0,capacity-static_cast<int>(bytes.size())); }
    size_t write(const uint8_t* data,size_t count){bytes.insert(bytes.end(),data,data+count);return count;}
    size_t write(uint8_t data){bytes.push_back(data);return 1;}
};
#ifndef SERIAL_8N1
#define SERIAL_8N1 0
#endif
