package controller

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func GetMarketplaceAgents(c *gin.Context) {
	agents, err := service.TokenHubListAgents()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "failed to fetch agents: " + err.Error(),
		})
		return
	}
	if agents == nil {
		agents = []service.TokenHubAgent{}
	}

	search := strings.ToLower(c.Query("search"))
	category := strings.ToLower(c.Query("category"))

	var filtered []service.TokenHubAgent
	for _, a := range agents {
		if search != "" {
			name := strings.ToLower(a.Name)
			desc := strings.ToLower(a.Description)
			if !strings.Contains(name, search) && !strings.Contains(desc, search) {
				continue
			}
		}
		if category != "" && category != "all" {
			if strings.ToLower(a.Category) != category {
				continue
			}
		}
		filtered = append(filtered, a)
	}
	if filtered == nil {
		filtered = []service.TokenHubAgent{}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items": filtered,
			"total": len(filtered),
		},
	})
}

func GetMarketplaceAgent(c *gin.Context) {
	agentID := c.Param("id")
	agent, err := service.TokenHubGetAgent(agentID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "failed to fetch agent: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    agent,
	})
}

func GetMarketplaceSkills(c *gin.Context) {
	skills, err := service.TokenHubListSkills()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "failed to fetch skills: " + err.Error(),
		})
		return
	}
	if skills == nil {
		skills = []service.TokenHubSkill{}
	}

	search := strings.ToLower(c.Query("search"))
	var filtered []service.TokenHubSkill
	for _, s := range skills {
		if search != "" {
			name := strings.ToLower(s.Name)
			desc := strings.ToLower(s.Description)
			if !strings.Contains(name, search) && !strings.Contains(desc, search) {
				continue
			}
		}
		filtered = append(filtered, s)
	}
	if filtered == nil {
		filtered = []service.TokenHubSkill{}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items": filtered,
			"total": len(filtered),
		},
	})
}
