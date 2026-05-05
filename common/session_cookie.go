package common

import (
	"net/http"
	"strings"
)

// ParseSessionSameSite resolves the SESSION_COOKIE_SAMESITE env value into the
// http.SameSite enum used by gin-contrib/sessions.
//
// Recognized values (case-insensitive, whitespace-trimmed): "lax", "none",
// "default", "strict". Any other input — including the empty string — falls
// back to Strict so deployments without explicit configuration retain the
// historical, most-restrictive default.
func ParseSessionSameSite(v string) http.SameSite {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "lax":
		return http.SameSiteLaxMode
	case "none":
		return http.SameSiteNoneMode
	case "default":
		return http.SameSiteDefaultMode
	default:
		return http.SameSiteStrictMode
	}
}
