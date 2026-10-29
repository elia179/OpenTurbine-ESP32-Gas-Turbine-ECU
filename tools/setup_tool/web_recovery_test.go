//go:build windows

package main

import (
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestDashboardBatchRecoveryIsExplicitSafeAndBounded(t *testing.T) {
	const expired = `{"error":"Web asset chunk rejected; upload the complete set again"}`
	for _, tc := range []struct {
		name                  string
		code                  int
		body                  string
		safeError, twice      bool
		wantCalls, wantChecks int
		success               bool
	}{
		{"expired transfer", 400, expired, false, false, 5, 1, true},
		{"second expiration", 400, expired, false, true, 4, 1, false},
		{"engine no longer safe", 400, expired, true, false, 2, 1, false},
		{"other bad request", 400, `{"error":"wrong file"}`, false, false, 2, 0, false},
		{"locked", 423, expired, false, false, 2, 0, false},
		{"server failure", 500, expired, false, false, 2, 0, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			a, b := filepath.Join(dir, "app.js.gz"), filepath.Join(dir, "style.css.gz")
			os.WriteFile(a, []byte(strings.Repeat("a", 8193)), 0600)
			os.WriteFile(b, []byte("css"), 0600)
			calls, checks, reports := 0, 0, 0
			var seen []string
			old := http.DefaultTransport
			defer func() { http.DefaultTransport = old }()
			http.DefaultTransport = roundTripFunc(func(req *http.Request) (*http.Response, error) {
				calls++
				q := req.URL.Query()
				seen = append(seen, q.Get("name")+":"+q.Get("offset"))
				payload, _ := io.ReadAll(req.Body)
				if q.Get("name") == "app.js.gz" && q.Get("offset") == "0" && len(payload) != 8192 {
					t.Fatal("first chunk corrupted")
				}
				code, body := 202, `{"ok":true}`
				if calls == 2 || (tc.twice && calls == 4) {
					code, body = tc.code, tc.body
				}
				return &http.Response{StatusCode: code, Status: http.StatusText(code), Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
			})
			err := postWebAssetChunksWithRecovery("http://ecu/api/web_asset_chunk", []string{a, b}, time.Second, func() error {
				checks++
				if tc.safeError {
					return errors.New("engine running")
				}
				return nil
			}, func(string) { reports++ }, nil)
			if (err == nil) != tc.success || calls != tc.wantCalls || checks != tc.wantChecks {
				t.Fatalf("err=%v calls=%d checks=%d", err, calls, checks)
			}
			if tc.success && !reflect.DeepEqual(seen, []string{"app.js.gz:0", "app.js.gz:8192", "app.js.gz:0", "app.js.gz:8192", "style.css.gz:0"}) {
				t.Fatalf("must resend the complete set from offset zero: %v", seen)
			}
			if reports > 1 || tc.wantChecks == 0 && reports != 0 {
				t.Fatalf("unexpected recovery report count %d", reports)
			}
		})
	}
}
