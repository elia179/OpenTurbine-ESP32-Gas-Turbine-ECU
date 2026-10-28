//go:build windows

package main

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestVerificationProgressAndReadRetry(t *testing.T) {
	old := http.DefaultTransport
	defer func() { http.DefaultTransport = old }()
	calls := 0
	http.DefaultTransport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.Method != "GET" {
			t.Fatal("verification must never write")
		}
		body := `{"project":"OpenTurbine","firmware_version":"2.6.1","target":"esp32-s3","build_id":"test"}`
		status := 200
		if r.URL.Path == "/index.html" {
			calls++
			if calls == 1 {
				status = 503
				body = "booting"
			} else {
				body = "verified dashboard"
			}
		}
		return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})
	var packed bytes.Buffer
	writer := gzip.NewWriter(&packed)
	writer.Write([]byte("verified dashboard"))
	writer.Close()
	file := filepath.Join(t.TempDir(), "index.html.gz")
	os.WriteFile(file, packed.Bytes(), 0600)
	messages := []string{}
	err := verifyUpdatedECUWithProgress("2.6.1", "esp32-s3", "test", []string{file}, func(s string) { messages = append(messages, s) })
	if err != nil {
		t.Fatal(err)
	}
	log := strings.Join(messages, "\n")
	for _, text := range []string{"firmware version", "Checking dashboard file 1 of 1", "Retrying 2/3", "Verified dashboard file 1 of 1"} {
		if !strings.Contains(log, text) {
			t.Fatalf("missing %q: %s", text, log)
		}
	}
	if calls != 2 {
		t.Fatalf("expected one read retry, got %d calls", calls)
	}
}

func TestVerificationRejectsWrongIdentityWithoutAssetRequests(t *testing.T) {
	old := http.DefaultTransport
	defer func() { http.DefaultTransport = old }()
	calls := 0
	http.DefaultTransport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"project":"Other","firmware_version":"2.6.1"}`)), Header: make(http.Header)}, nil
	})
	if verifyUpdatedECU("2.6.1", "esp32-s3", "test", []string{"must-not-read.gz"}) == nil {
		t.Fatal("wrong device accepted")
	}
	if calls != 1 {
		t.Fatal("identity mismatch must not be retried or followed by uploads")
	}
}

func TestReconnectRejectsHTTPErrorAndOtherDevice(t *testing.T) {
	old := http.DefaultTransport
	defer func() { http.DefaultTransport = old }()
	for _, tc := range []struct {
		status int
		body   string
	}{{503, `{"project":"OpenTurbine"}`}, {200, `{"project":"Other"}`}} {
		http.DefaultTransport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: tc.status, Body: io.NopCloser(strings.NewReader(tc.body)), Header: make(http.Header)}, nil
		})
		if waitForECU(5*time.Millisecond) == nil {
			t.Fatal("not-ready device accepted")
		}
	}
}

func TestVerificationHonorsCancelledDeadline(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	old := http.DefaultTransport
	defer func() { http.DefaultTransport = old }()
	http.DefaultTransport = roundTripFunc(func(r *http.Request) (*http.Response, error) { return nil, context.Canceled })
	if _, err := readVerificationURL(ctx, "http://192.168.4.1/api/device_info", nil); err == nil {
		t.Fatal("cancelled context accepted")
	}
}

func TestCurrentPCBProfileContainer(t *testing.T) {
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	pkg := &Package{Root: root, Manifest: Manifest{Version: "2.6.1", Targets: map[string]ManifestTarget{
		"esp32s3dev": {PCBProfile: PCBProfilePartition{Address: "0x610000", Size: 65536}},
	}}}
	pkg.Manifest.Version = "2.6.0"
	if _, _, err := buildCustomPCBProfile(pkg, "esp32s3dev", filepath.Join(root, "pcb_profiles", "official", "openturbine-s3-20261028.otpcb.json")); err == nil {
		t.Fatal("new profile accepted with old firmware")
	}
	pkg.Manifest.Version = "2.6.1"
	path, _, err := buildCustomPCBProfile(pkg, "esp32s3dev", filepath.Join(root, "pcb_profiles", "official", "openturbine-s3-20261028.otpcb.json"))
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(path)
	bytes, err := os.ReadFile(path)
	if err != nil || len(bytes) < 100 {
		t.Fatal("profile container missing", err)
	}
}

func TestCurrentPCBRejectsInvalidIndicatorEndpoints(t *testing.T) {
	root, _ := filepath.Abs("../..")
	source, err := os.ReadFile(filepath.Join(root, "pcb_profiles", "official", "openturbine-s3-20261028.otpcb.json"))
	if err != nil {
		t.Fatal(err)
	}
	pkg := &Package{Root: root, Manifest: Manifest{Version: "2.6.1", Targets: map[string]ManifestTarget{
		"esp32s3dev": {PCBProfile: PCBProfilePartition{Address: "0x610000", Size: 65536}},
	}}}
	for _, tc := range []string{"shared-channel", "missing-device", "missing-gpio"} {
		t.Run(tc, func(t *testing.T) {
			var profile map[string]any
			if err := json.Unmarshal(source, &profile); err != nil {
				t.Fatal(err)
			}
			fixed := profile["fixed_functions"].(map[string]any)
			led := fixed["status_led"].(map[string]any)
			switch tc {
			case "shared-channel":
				led["channel"] = float64(7)
			case "missing-device":
				led["device"] = "not_fitted"
			case "missing-gpio":
				delete(led, "device")
				delete(led, "channel")
			}
			mutated, _ := json.Marshal(profile)
			path := filepath.Join(t.TempDir(), "profile.json")
			if err := os.WriteFile(path, mutated, 0600); err != nil {
				t.Fatal(err)
			}
			if _, _, err := buildCustomPCBProfile(pkg, "esp32s3dev", path); err == nil {
				t.Fatal("invalid indicator endpoint accepted")
			}
		})
	}
}
