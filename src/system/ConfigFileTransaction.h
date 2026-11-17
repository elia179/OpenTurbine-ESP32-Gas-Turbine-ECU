#pragma once
#include <stdint.h>

namespace ConfigFileTransaction {
inline constexpr const char* backupPath = "/ecu_config.bak";
// Low byte counts active mutations. Upper bits change when a mutation ends.
// The combined value lets readers detect overlap without holding a lock
// across a response or blocking a configuration write on a slow client.
inline uint32_t fileVersion = 0;
inline uint32_t readVersion() { return __atomic_load_n(&fileVersion, __ATOMIC_ACQUIRE); }
inline bool isStable(uint32_t version) { return (version & 0xffu) == 0; }

class Mutation {
public:
    Mutation() { __atomic_fetch_add(&fileVersion, 1u, __ATOMIC_ACQ_REL); }
    ~Mutation() { __atomic_fetch_add(&fileVersion, 0xffu, __ATOMIC_ACQ_REL); }
    Mutation(const Mutation&) = delete;
    Mutation& operator=(const Mutation&) = delete;
};

enum class InstallResult {
    Saved,
    PreserveFailed,
    InstallFailed,
    RollbackFailed
};

template <typename FileSystem>
bool recoverBackup(FileSystem& fs, const char* path) {
    if (fs.exists(path) || !fs.exists(backupPath)) return true;
    const Mutation mutation;
    return fs.rename(backupPath, path);
}

// A backup can be the only committed configuration after an interrupted
// replacement. Keep it until a complete staged file becomes the new primary.
template <typename FileSystem>
InstallResult install(FileSystem& fs, const char* stage, const char* path) {
    const Mutation mutation;
    const bool hadPrimary = fs.exists(path);
    if (hadPrimary) {
        if ((fs.exists(backupPath) && !fs.remove(backupPath)) ||
            !fs.rename(path, backupPath))
            return InstallResult::PreserveFailed;
    }
    if (!fs.rename(stage, path)) {
        if (hadPrimary && !fs.rename(backupPath, path))
            return InstallResult::RollbackFailed;
        return InstallResult::InstallFailed;
    }
    if (fs.exists(backupPath)) fs.remove(backupPath);
    return InstallResult::Saved;
}
}  // namespace ConfigFileTransaction
