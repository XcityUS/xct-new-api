package controller

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

var agentProxyHTTPClient = &http.Client{
	Timeout: 5 * time.Minute,
}

func walletBaseURL() string {
	return strings.TrimSuffix(os.Getenv("WALLET_BASE_URL"), "/")
}

func walletAPIKey() string {
	return os.Getenv("WALLET_API_KEY")
}

// AgentProxy forwards requests to Tokenhub A2A endpoint.
// Route: /api/agent/*path (requires TokenAuth)
//
// The caller authenticates with an xct-new-api Token (Bearer). We forward the
// request to Tokenhub using the server-side TOKENHUB_API_KEY, then record a
// usage log entry with agent_id extracted from the path.
func AgentProxy(c *gin.Context) {
	base := tokenhubBaseURL()
	if base == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "Tokenhub integration not configured (TOKENHUB_BASE_URL not set)",
		})
		return
	}

	subPath := c.Param("path")
	if subPath == "" {
		subPath = "/"
	}

	// Extract agent_id: first path segment of subPath (e.g. /some-agent-id/run → some-agent-id)
	agentID := extractAgentID(subPath)

	targetURL := base + "/agent" + subPath
	if c.Request.URL.RawQuery != "" {
		targetURL += "?" + c.Request.URL.RawQuery
	}

	// Read request body
	reqBody, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "failed to read request body"})
		return
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), c.Request.Method, targetURL, bytes.NewReader(reqBody))
	if err != nil {
		common.SysLog(fmt.Sprintf("agent_proxy: failed to build request: %v", err))
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
		return
	}

	// Forward headers from client, replace Authorization with server-side key
	for k, vals := range c.Request.Header {
		lower := strings.ToLower(k)
		if lower == "authorization" || lower == "host" || lower == "content-length" {
			continue
		}
		for _, v := range vals {
			req.Header.Add(k, v)
		}
	}
	apiKey := tokenhubAPIKey()
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}

	userId := c.GetInt("id")
	tokenId := c.GetInt("token_id")

	startTime := time.Now()
	resp, err := agentProxyHTTPClient.Do(req)
	if err != nil {
		common.SysLog(fmt.Sprintf("agent_proxy: upstream request failed: %v", err))
		recordAgentUsage(c, userId, tokenId, agentID, 0, http.StatusBadGateway, time.Since(startTime))
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "failed to reach Tokenhub agent endpoint"})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		common.SysLog(fmt.Sprintf("agent_proxy: failed to read upstream response: %v", err))
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
		return
	}

	elapsed := time.Since(startTime)
	recordAgentUsage(c, userId, tokenId, agentID, len(body), resp.StatusCode, elapsed)

	// Debit wallet if configured
	if walletBaseURL() != "" && resp.StatusCode < 300 {
		go tryWalletDebit(userId, agentID, len(body))
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/json"
	}
	c.Data(resp.StatusCode, contentType, body)
}

func extractAgentID(subPath string) string {
	trimmed := strings.TrimPrefix(subPath, "/")
	parts := strings.SplitN(trimmed, "/", 2)
	if len(parts) > 0 && parts[0] != "" {
		return parts[0]
	}
	return ""
}

func recordAgentUsage(c *gin.Context, userId, tokenId int, agentID string, responseBytes, statusCode int, elapsed time.Duration) {
	if !common.LogConsumeEnabled {
		return
	}
	other := map[string]interface{}{
		"agent_id":       agentID,
		"status_code":    statusCode,
		"response_bytes": responseBytes,
		"elapsed_ms":     elapsed.Milliseconds(),
	}
	tokenName := c.GetString("token_name")
	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:    userId,
		LogType:   model.LogTypeConsume,
		Content:   fmt.Sprintf("Agent proxy call: agent_id=%s status=%d", agentID, statusCode),
		ChannelId: 0,
		ModelName: "agent:" + agentID,
		Quota:     0,
		TokenId:   tokenId,
		Group:     c.GetString("group"),
		Other:     other,
	})
	_ = tokenName
}

func tryWalletDebit(userId int, agentID string, responseBytes int) {
	wBase := walletBaseURL()
	if wBase == "" {
		return
	}
	wKey := walletAPIKey()

	payload, err := common.Marshal(map[string]interface{}{
		"user_id":        userId,
		"agent_id":       agentID,
		"response_bytes": responseBytes,
		"source":         "agent_proxy",
	})
	if err != nil {
		common.SysLog(fmt.Sprintf("wallet_debit: marshal error: %v", err))
		return
	}

	req, err := http.NewRequest(http.MethodPost, wBase+"/api/debit", bytes.NewReader(payload))
	if err != nil {
		common.SysLog(fmt.Sprintf("wallet_debit: request build error: %v", err))
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if wKey != "" {
		req.Header.Set("Authorization", "Bearer "+wKey)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		common.SysLog(fmt.Sprintf("wallet_debit: request failed: %v", err))
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		common.SysLog(fmt.Sprintf("wallet_debit: unexpected status %d for user=%d agent=%s", resp.StatusCode, userId, agentID))
	}
}
