#pragma once
#include <ArduinoJson.h>
#include <stdint.h>

// Bounded reader shared by the browser JSON and CSV routes. Never use the
// recorder's lazy/estimated count to select a tail from a possibly damaged file.
namespace RecentEventLog {
template<class File> bool next(File& file,char* line,size_t capacity) {
    while(file.available()) {
        int n=file.readBytesUntil('\n',line,capacity-1);
        if(n==(int)capacity-1) { while(file.available()&&file.read()!='\n'){} continue; }
        while(n>0&&(line[n-1]=='\r'||line[n-1]==' '||line[n-1]=='\t'))--n;
        if(n>0&&line[n-1]==',')--n;
        while(n>0&&(line[n-1]==' '||line[n-1]=='\t'))--n;
        line[n]=0;
        if(n>=2&&line[0]=='{'&&line[n-1]=='}')return true;
    }
    return false;
}
template<class File> void seekTail(File& file) {
    uint32_t offsets[120];unsigned count=0,head=0;
#ifdef ARDUINO
    unsigned scanned=0;
#endif
    char line[640];JsonDocument doc;
    while(file.available()) {
        const uint32_t offset=file.position();
        if(!next(file,line,sizeof(line)))break;
        #ifdef ARDUINO
        if(++scanned%32==0)delay(0);
        #endif
        doc.clear();if(deserializeJson(doc,line)||!doc["ev"].template is<const char*>())continue;
        offsets[head]=offset;head=(head+1)%120;if(count<120)++count;
    }
    file.seek(count?offsets[count<120?0:head]:file.position());
}
}
