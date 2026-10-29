#include <stdlib.h>

// The application is built with -fno-exceptions and has no C++ catch boundary.
// libstdc++'s prebuilt mutex-error helper nevertheless constructs system_error,
// which links the locale/iostream runtime just to terminate on an unhandled
// lock failure. Keep that fatal behavior without allocating an exception.
// Retain the error code in the core dump for diagnosis.
extern "C" {
volatile int g_cppSystemError = 0;

[[noreturn]] void __wrap__ZSt20__throw_system_errori(int error) {
    g_cppSystemError = error;
    abort();
}
}
