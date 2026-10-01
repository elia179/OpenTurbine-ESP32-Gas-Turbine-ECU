---
layout: document
title: OpenTurbine developer documentation and source build
description: Build OpenTurbine from source, validate firmware and web changes, package the Windows Setup Tool, or integrate the OpenTurbine Cluster protocol.
lede: Build source, validate changes, package releases, or integrate the OpenTurbine Cluster protocol.
---

For installation without a source build, use [the Windows Setup Tool]({{ '/get-started/' | relative_url }}).

Run the existing browser audits with `npm ci` then `npm run audit:ui`. Build both supported firmware environments and filesystem images before release. Check each release's notes for its signing status.

## Useful entry points

- [Build and development documentation](https://github.com/elia179/OpenTurbine-ESP32-Gas-Turbine-ECU/tree/main/docs) covers the firmware and web workflows.
- [Setup Tool packaging](https://github.com/elia179/OpenTurbine-ESP32-Gas-Turbine-ECU/blob/main/docs/SETUP_TOOL.md) describes the Windows release artifact.
- [OTC Cluster protocol](https://github.com/elia179/OpenTurbine-ESP32-Gas-Turbine-ECU/blob/main/docs/OTC_CLUSTER_PROTOCOL.md) is the integration reference.

Record verification results and signing status before publishing a release.
