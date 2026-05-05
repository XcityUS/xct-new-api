package common

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseSessionSameSite(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want http.SameSite
	}{
		{name: "lax lowercase", in: "lax", want: http.SameSiteLaxMode},
		{name: "lax mixed case", in: "Lax", want: http.SameSiteLaxMode},
		{name: "lax with whitespace", in: "  lax\n", want: http.SameSiteLaxMode},
		{name: "none", in: "none", want: http.SameSiteNoneMode},
		{name: "none uppercase", in: "NONE", want: http.SameSiteNoneMode},
		{name: "default", in: "default", want: http.SameSiteDefaultMode},
		{name: "strict", in: "strict", want: http.SameSiteStrictMode},
		{name: "empty string falls back to strict", in: "", want: http.SameSiteStrictMode},
		{name: "unknown value falls back to strict", in: "unknown", want: http.SameSiteStrictMode},
		{name: "garbage falls back to strict", in: "🤷", want: http.SameSiteStrictMode},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, ParseSessionSameSite(tt.in))
		})
	}
}
