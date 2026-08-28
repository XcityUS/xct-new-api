package controller

import (
	"encoding/base64"
	"errors"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	xctSkillsDefaultLimit = 50
	xctSkillsMaxLimit     = 200
)

// encodeXctSkillCursor 将最后一行的自增 id 编码为不透明游标
func encodeXctSkillCursor(id int) string {
	return base64.RawURLEncoding.EncodeToString([]byte(strconv.Itoa(id)))
}

// decodeXctSkillCursor 解析游标；空游标表示第一页
func decodeXctSkillCursor(cursor string) (int, error) {
	if cursor == "" {
		return 0, nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return 0, err
	}
	id, err := strconv.Atoi(string(raw))
	if err != nil || id < 0 {
		return 0, errors.New("invalid cursor")
	}
	return id, nil
}

func xctSkillError(c *gin.Context, statusCode int, code string, message string) {
	c.JSON(statusCode, gin.H{
		"error": gin.H{
			"message": message,
			"type":    "invalid_request_error",
			"code":    code,
		},
	})
}

// listXctSkills 是 /v1 与管理端列表共用的实现；管理端返回全部行（含 disabled）
func listXctSkills(c *gin.Context, onlyEnabled bool) {
	limit := xctSkillsDefaultLimit
	if limitStr := c.Query("limit"); limitStr != "" {
		parsed, err := strconv.Atoi(limitStr)
		if err != nil || parsed <= 0 {
			xctSkillError(c, http.StatusBadRequest, "invalid_limit", "limit must be a positive integer")
			return
		}
		limit = parsed
	}
	if limit > xctSkillsMaxLimit {
		limit = xctSkillsMaxLimit
	}
	afterId, err := decodeXctSkillCursor(c.Query("cursor"))
	if err != nil {
		xctSkillError(c, http.StatusBadRequest, "invalid_cursor", "invalid cursor")
		return
	}
	skills, hasMore, err := model.ListXctSkills(afterId, limit, onlyEnabled)
	if err != nil {
		xctSkillError(c, http.StatusInternalServerError, "internal_error", "failed to list skills")
		return
	}
	nextCursor := ""
	if hasMore && len(skills) > 0 {
		nextCursor = encodeXctSkillCursor(skills[len(skills)-1].Id)
	}
	c.JSON(http.StatusOK, gin.H{
		"data":        skills,
		"has_more":    hasMore,
		"next_cursor": nextCursor,
	})
}

// ListXctSkills GET /v1/xct-skills （用户令牌），仅返回 enabled 的技能
func ListXctSkills(c *gin.Context) {
	listXctSkills(c, true)
}

// GetXctSkill GET /v1/xct-skills/:id （用户令牌）。
// :id 优先按 skill_id 匹配，未命中时回退到 xct_metadata 的 xct_agent_slug
func GetXctSkill(c *gin.Context) {
	idOrSlug := c.Param("id")
	skill, err := model.GetXctSkillBySkillIdOrSlug(idOrSlug, true)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			xctSkillError(c, http.StatusNotFound, "not_found", "skill not found")
		} else {
			xctSkillError(c, http.StatusInternalServerError, "internal_error", "failed to get skill")
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"data": skill,
	})
}

// GetAllXctSkills GET /api/xct-skills （管理员），返回包含 disabled 在内的全部技能，
// 分页形态与 /v1/xct-skills 一致
func GetAllXctSkills(c *gin.Context) {
	listXctSkills(c, false)
}

func applyXctSkillRequest(skill *model.XctSkill, req *dto.XctSkillRequest) {
	if req.DisplayTitle != nil {
		skill.DisplayTitle = *req.DisplayTitle
	}
	if req.Description != nil {
		skill.Description = *req.Description
	}
	if req.Version != nil {
		skill.Version = req.Version
	}
	if req.SystemPromptTemplate != nil {
		skill.SystemPromptTemplate = *req.SystemPromptTemplate
	}
	if req.Tools != nil {
		skill.Tools = model.JSONValue(req.Tools)
	}
	if req.Pricing != nil {
		skill.Pricing = model.JSONValue(req.Pricing)
	}
	if req.XctMetadata != nil {
		skill.XctMetadata = model.JSONValue(req.XctMetadata)
	}
	if req.Enabled != nil {
		skill.Enabled = *req.Enabled
	}
}

// AddXctSkill POST /api/xct-skills （管理员），skill_id 由服务端生成
func AddXctSkill(c *gin.Context) {
	var req dto.XctSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	skill := &model.XctSkill{
		Enabled: true,
	}
	applyXctSkillRequest(skill, &req)
	if err := skill.Validate(); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := skill.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, skill)
}

// UpdateXctSkill PUT /api/xct-skills/:skill_id （管理员），仅应用请求中出现的字段
func UpdateXctSkill(c *gin.Context) {
	var req dto.XctSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	skill, err := model.GetXctSkillBySkillId(c.Param("skill_id"), false)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "skill not found")
		} else {
			common.ApiError(c, err)
		}
		return
	}
	applyXctSkillRequest(skill, &req)
	if err := skill.Validate(); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := skill.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, skill)
}

// DeleteXctSkill DELETE /api/xct-skills/:skill_id （管理员）
func DeleteXctSkill(c *gin.Context) {
	if err := model.DeleteXctSkillBySkillId(c.Param("skill_id")); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "skill not found")
		} else {
			common.ApiError(c, err)
		}
		return
	}
	common.ApiSuccess(c, nil)
}
