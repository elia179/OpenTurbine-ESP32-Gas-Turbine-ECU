#pragma once
// One lock covers a complete expander-CS + SPI frame + deselect transaction.
// Recursive because the board driver uses the same bounded I2C primitives.
#if defined(OT_PLATFORM_ESP32S3) && !defined(OT_HOST_TEST)
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
namespace SharedPeripheralBus {
inline StaticSemaphore_t storage;
inline SemaphoreHandle_t mutex = xSemaphoreCreateRecursiveMutexStatic(&storage);
struct Guard {
    bool locked = mutex && xSemaphoreTakeRecursive(mutex,pdMS_TO_TICKS(5)+1)==pdTRUE;
    ~Guard(){if(locked)xSemaphoreGiveRecursive(mutex);}
    explicit operator bool() const{return locked;}
};
}
#else
namespace SharedPeripheralBus { struct Guard { explicit operator bool() const{return true;} }; }
#endif
