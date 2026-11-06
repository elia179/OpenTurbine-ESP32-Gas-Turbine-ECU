#include <cassert>
#include <string>
#include <algorithm>
#include <iostream>
#include "../../src/system/RecentEventLog.h"
struct MemoryFile {
 std::string data;size_t offset=0;
 bool available(){return offset<data.size();}
 size_t position(){return offset;}
 void seek(size_t value){offset=value;}
 int read(){return available()?(unsigned char)data[offset++]:-1;}
 size_t readBytesUntil(char stop,char* out,size_t max){size_t n=0;while(available()&&n<max){char c=read();if(c==stop)break;out[n++]=c;}return n;}
};
int main(){
 MemoryFile f;
 for(int i=0;i<300;++i){
  f.data+="garbage\n{broken}\n{\"ev\":\"SNAP\",\"t\":"+std::to_string(i)+"}, \r\n";
  if(i%7==0)f.data+="{"+std::string(1000,'x')+"}\n";
 }
 f.data+="{\"ev\":\"RUN_SUMMARY\",\"t\":300}\n{unfinished";
 RecentEventLog::seekTail(f);
 char line[640];JsonDocument doc;int count=0,first=-1,last=-1;
 while(RecentEventLog::next(f,line,sizeof(line))){doc.clear();if(deserializeJson(doc,line))continue;if(!count)first=doc["t"];last=doc["t"];++count;}
 assert(count==120&&first==181&&last==300);
 MemoryFile empty;RecentEventLog::seekTail(empty);assert(!empty.available());
 MemoryFile small{"{bad}\n{\"ev\":\"BOOT\",\"t\":0}\n"};RecentEventLog::seekTail(small);assert(RecentEventLog::next(small,line,sizeof(line))); // damaged prefix is ignored by decode
 // The JSON route must keep complete newest records within its byte budget.
 MemoryFile bounded=f;bounded.seek(0);RecentEventLog::seekTail(bounded,256);
 size_t bytes=0;int newest=-1,boundedCount=0;
 while(RecentEventLog::next(bounded,line,sizeof(line))){
  doc.clear();if(deserializeJson(doc,line)||!doc["ev"].is<const char*>())continue;
  bytes+=strlen(line)+1;newest=doc["t"];++boundedCount;
 }
 assert(bytes<=256&&boundedCount>0&&newest==300);
 MemoryFile noRoom=f;noRoom.seek(0);RecentEventLog::seekTail(noRoom,1);assert(!noRoom.available());
 std::cout<<"Recent event tail: newest 120 independent of cached count; malformed, oversized, legacy commas, short and empty logs passed.\n";
}
