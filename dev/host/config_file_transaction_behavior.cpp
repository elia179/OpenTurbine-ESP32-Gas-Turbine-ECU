#include "../../src/system/ConfigFileTransaction.h"
#include <cassert>
#include <iostream>
#include <map>
#include <string>

namespace {
constexpr const char* primary = "/ecu_config.json";
constexpr const char* stage = "/ecu_config.tmp";
constexpr auto backup = ConfigFileTransaction::backupPath;
using ConfigFileTransaction::InstallResult;

struct FakeFs {
    std::map<std::string, std::string> files;
    bool failInstall = false;
    bool failRestore = false;
    bool failRemoveBackup = false;

    bool exists(const char* path) const { return files.count(path) != 0; }

    bool rename(const char* from, const char* to) {
        assert(!ConfigFileTransaction::isStable(ConfigFileTransaction::readVersion()));
        if (exists(to) || (std::string(from) == stage && failInstall) ||
            (std::string(from) == backup && failRestore)) return false;
        auto node = files.extract(from);
        if (node.empty()) return false;
        node.key() = to;
        files.insert(std::move(node));
        return true;
    }

    bool remove(const char* path) {
        if (std::string(path) == backup && failRemoveBackup) return false;
        return files.erase(path) != 0;
    }
};
}

int main() {
    using ConfigFileTransaction::isStable;
    using ConfigFileTransaction::readVersion;
    const auto initialVersion = readVersion();
    assert(isStable(initialVersion));
    {
        const ConfigFileTransaction::Mutation outer;
        const auto firstWrite = readVersion();
        assert(!isStable(firstWrite));
        {
            const ConfigFileTransaction::Mutation inner;
            assert(!isStable(readVersion()));
        }
        assert(!isStable(readVersion()));
        assert(readVersion() != firstWrite);
    }
    assert(isStable(readVersion()) && readVersion() != initialVersion);
    FakeFs fs;
    assert(ConfigFileTransaction::recoverBackup(fs, primary));
    fs.files = {{backup, "old engine"}, {stage, "new engine"}};
    fs.failRestore = fs.failInstall = true;
    assert(!ConfigFileTransaction::recoverBackup(fs, primary));
    assert(ConfigFileTransaction::install(fs, stage, primary) == InstallResult::InstallFailed);
    assert(!fs.exists(primary) && fs.files.at(backup) == "old engine");
    fs.failRestore = false;
    assert(ConfigFileTransaction::recoverBackup(fs, primary));
    assert(ConfigFileTransaction::install(fs, stage, primary) == InstallResult::InstallFailed);
    assert(fs.files.at(primary) == "old engine" && !fs.exists(backup));

    fs.failRestore = true;
    assert(ConfigFileTransaction::install(fs, stage, primary) == InstallResult::RollbackFailed);
    assert(!fs.exists(primary) && fs.files.at(backup) == "old engine");
    fs.failInstall = false;
    assert(ConfigFileTransaction::install(fs, stage, primary) == InstallResult::Saved);
    assert(fs.files.at(primary) == "new engine" && !fs.exists(backup));

    fs.files = {{primary, "new engine"}, {backup, "old engine"}, {stage, "third engine"}};
    fs.failRemoveBackup = true;
    assert(ConfigFileTransaction::install(fs, stage, primary) == InstallResult::PreserveFailed);
    assert(fs.files.at(primary) == "new engine" && fs.files.at(backup) == "old engine");
    fs.failRemoveBackup = false;
    const auto previousFile = readVersion();
    assert(ConfigFileTransaction::install(fs, stage, primary) == InstallResult::Saved);
    assert(isStable(readVersion()) && readVersion() != previousFile);
    assert(fs.files.at(primary) == "third engine" && !fs.exists(backup));
    std::cout << "Configuration save and recovery preserve the last committed engine file through injected filesystem failures.\n";
}
