//go:build windows

package main

import (
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestPCBSelectsMatchingN8R2FirmwareBeforeErase(t *testing.T) {
	profile := ManifestPCBProfile{ID: "pcb", Revision: "next", File: "pcb.bin", SHA256: "digest", FirmwareTarget: "esp32s3n8r2"}
	image := ManifestTarget{PCBProfile: PCBProfilePartition{OfficialProfiles: []ManifestPCBProfile{profile}}}
	pkg := &Package{Manifest: Manifest{Targets: map[string]ManifestTarget{"esp32s3n8r2": image}}}
	selected, err := officialProfileTarget(pkg, "esp32s3dev", profile)
	if err != nil || selected != "esp32s3n8r2" {
		t.Fatalf("matching image was not selected: %s %v", selected, err)
	}
	if _, err := officialProfileTarget(pkg, "esp32dev", profile); err == nil {
		t.Fatal("allowed S3 firmware on Classic")
	}
	changed := profile
	changed.SHA256 = "different"
	if _, err := officialProfileTarget(pkg, "esp32s3dev", changed); err == nil {
		t.Fatal("accepted mismatched profile/image")
	}
	delete(pkg.Manifest.Targets, "esp32s3n8r2")
	if _, err := officialProfileTarget(pkg, "esp32s3dev", profile); err == nil {
		t.Fatal("silently fell back when matching image was absent")
	}
}

func TestOTAUsesN8R2IdentityAndNeverDowngradesMissingImage(t *testing.T) {
	old := http.DefaultTransport
	defer func() { http.DefaultTransport = old }()
	calls := 0
	http.DefaultTransport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		if r.Method != "GET" || r.URL.Path != "/api/device_info" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"target":"esp32s3n8r2","chip":"ESP32-S3"}`)), Header: make(http.Header)}, nil
	})
	pkg := &Package{Manifest: Manifest{Targets: map[string]ManifestTarget{"esp32s3dev": {}, "esp32s3n8r2": {}}}}
	target, err := chooseTargetForOTA(pkg)
	if err != nil || target != "esp32s3n8r2" {
		t.Fatalf("lost memory variant: %s %v", target, err)
	}
	delete(pkg.Manifest.Targets, "esp32s3n8r2")
	if _, err := chooseTargetForOTA(pkg); err == nil {
		t.Fatal("accepted generic S3 image for known N8R2")
	}
	if calls != 2 {
		t.Fatalf("unexpected fallback requests: %d", calls)
	}
}

func TestHardwareIdentityFallbackKeepsN8R2(t *testing.T) {
	old := http.DefaultTransport
	defer func() { http.DefaultTransport = old }()
	http.DefaultTransport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		status, body := 404, ""
		if r.URL.Path == "/api/hardware" {
			status, body = 200, `{"platform":"esp32s3","firmware_target":"esp32s3n8r2"}`
		}
		return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})
	pkg := &Package{Manifest: Manifest{Targets: map[string]ManifestTarget{"esp32s3dev": {}, "esp32s3n8r2": {}}}}
	target, err := chooseTargetForOTA(pkg)
	if err != nil || target != "esp32s3n8r2" {
		t.Fatalf("hardware fallback lost memory variant: %s %v", target, err)
	}
}
