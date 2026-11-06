#pragma once
#include <ArduinoJson.h>
#include <stdint.h>
#include <string.h>

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
template<class File> void seekTail(File& file, size_t byteBudget = SIZE_MAX) {
    uint32_t offsets[120];uint16_t sizes[120];unsigned count=0,head=0;size_t bytes=0;
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
        if(count==120)bytes-=sizes[head];else ++count;
        offsets[head]=offset;sizes[head]=strlen(line)+1;
        bytes+=sizes[head];head=(head+1)%120;
        while(count && bytes>byteBudget){bytes-=sizes[(head+120-count)%120];--count;}
    }
    file.seek(count?offsets[(head+120-count)%120]:file.position());
}
}
