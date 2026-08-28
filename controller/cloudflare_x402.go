package controller

// L-016: Cloudflare x402 integration — dashboard API (sub-task 4)
//
// Routes (added to router/api-router.go under RootAuth):
//   GET  /api/cloudflare-x402/status   — read settings + per-project status
//   PUT  /api/cloudflare-x402/settings — update settings (persisted via option system)
//   GET  /api/cloudflare-x402/projects — list CF Pages projects with x402 flag

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

// GetCloudflareX402Status returns the current x402 settings and per-project
// enable status. Used by the admin dashboard page.
func GetCloudflareX402Status(c *gin.Context) {
	settings := system_setting.GetCloudflareX402Settings()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    settings,
	})
}

// UpdateCloudflareX402Settings persists x402 settings changes.
// Accepts a partial JSON body; only provided fields are updated.
func UpdateCloudflareX402Settings(c *gin.Context) {
	settings := system_setting.GetCloudflareX402Settings()

	if err := c.ShouldBindJSON(settings); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request body: " + err.Error(),
		})
		return
	}

	// Validate route_percent is in [0, 100]
	if settings.RoutePercent < 0 || settings.RoutePercent > 100 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "route_percent must be between 0 and 100",
		})
		return
	}

	// Persist via the existing option system
	if err := model.UpdateOption("cloudflare_x402.enabled", strconv.FormatBool(settings.Enabled)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := model.UpdateOption("cloudflare_x402.facilitator_url", settings.FacilitatorURL); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := model.UpdateOption("cloudflare_x402.x401_fallback_url", settings.X401FallbackURL); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	routePercentStr := strconv.Itoa(settings.RoutePercent)
	if err := model.UpdateOption("cloudflare_x402.route_percent", routePercentStr); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "x402 settings updated",
		"data":    settings,
	})
}

// GetCloudflareX402Projects returns the list of CF Pages projects with their
// x402 enable status. Scope: max 10 projects (current: 4 sites).
func GetCloudflareX402Projects(c *gin.Context) {
	settings := system_setting.GetCloudflareX402Settings()

	type projectStatus struct {
		Name    string `json:"name"`
		Enabled bool   `json:"enabled"`
	}

	projects := make([]projectStatus, 0, len(settings.Projects))
	for name, enabled := range settings.Projects {
		projects = append(projects, projectStatus{Name: name, Enabled: enabled})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    projects,
	})
}

// ToggleCloudflareX402Project enables or disables x402 for a specific CF Pages
// project. Persisted to the option store so it survives restarts.
//
// PUT /api/cloudflare-x402/projects/:project
// Body: { "enabled": true }
func ToggleCloudflareX402Project(c *gin.Context) {
	project := c.Param("project")
	if project == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "project name required"})
		return
	}

	var body struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	settings := system_setting.GetCloudflareX402Settings()

	// Enforce the scope limit: no more than 10 CF Pages projects
	if _, exists := settings.Projects[project]; !exists && len(settings.Projects) >= 10 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "CF Pages project limit (10) reached",
		})
		return
	}

	settings.Projects[project] = body.Enabled

	projectsJSON, err := common.Marshal(settings.Projects)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := model.UpdateOption("cloudflare_x402.projects", string(projectsJSON)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"project": project, "enabled": body.Enabled},
	})
}
