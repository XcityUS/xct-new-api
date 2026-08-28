package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// XctSkill 是 Xcity 市场的技能（marketplace-agent persona）存储单元。
// SkillId 为服务端生成的 uuid，对外作为稳定主键；XctMetadata 中的
// xct_agent_slug 会被冗余到 AgentSlug 列，便于按 slug 建索引查询
// （不强制唯一，查询时按 id asc 取最早创建的一条）。
// Tools 记录该技能希望可用的 MCP-portal 工具集合，Pricing 记录
// 市场定价信息（如 {"kwh_per_use": number}），两者均原样存储。
type XctSkill struct {
	Id                   int            `json:"id"`
	SkillId              string         `json:"skill_id" gorm:"type:varchar(64);uniqueIndex"`
	DisplayTitle         string         `json:"display_title" gorm:"type:varchar(255)"`
	Description          string         `json:"description" gorm:"type:text"`
	Version              *string        `json:"version" gorm:"type:varchar(64)"`
	SystemPromptTemplate string         `json:"system_prompt_template" gorm:"type:text"`
	Tools                JSONValue      `json:"tools,omitempty" gorm:"type:json"`
	Pricing              JSONValue      `json:"pricing,omitempty" gorm:"type:json"`
	XctMetadata          JSONValue      `json:"xct_metadata" gorm:"type:json"`
	AgentSlug            string         `json:"agent_slug,omitempty" gorm:"type:varchar(255);index"`
	Enabled              bool           `json:"enabled" gorm:"default:true"`
	CreatedTime          int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime          int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt            gorm.DeletedAt `json:"-" gorm:"index"`
}

// isEmptyJSONValue 判断 JSON 值是否为空（未提供或显式 null）
func isEmptyJSONValue(v JSONValue) bool {
	trimmed := strings.TrimSpace(string(v))
	return trimmed == "" || trimmed == "null"
}

// ExtractXctAgentSlug 从 xct_metadata 中取出 xct_agent_slug（缺失或非字符串时返回空串）
func ExtractXctAgentSlug(meta JSONValue) string {
	if isEmptyJSONValue(meta) {
		return ""
	}
	var m map[string]interface{}
	if err := json.Unmarshal(meta, &m); err != nil {
		return ""
	}
	if v, ok := m["xct_agent_slug"]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// Validate 校验 tools / pricing / xct_metadata 三个 JSON 列的结构
func (s *XctSkill) Validate() error {
	if !isEmptyJSONValue(s.Tools) {
		if !strings.HasPrefix(strings.TrimSpace(string(s.Tools)), "[") {
			return errors.New("tools must be a JSON array")
		}
		var items []map[string]interface{}
		if err := json.Unmarshal(s.Tools, &items); err != nil {
			return errors.New("tools must be a JSON array of objects")
		}
		for i, item := range items {
			serverId, ok := item["server_id"].(string)
			if !ok || serverId == "" {
				return fmt.Errorf("tools[%d].server_id must be a non-empty string", i)
			}
			for _, key := range []string{"tool", "note"} {
				if v, exists := item[key]; exists {
					if _, ok := v.(string); !ok {
						return fmt.Errorf("tools[%d].%s must be a string", i, key)
					}
				}
			}
		}
	}
	if !isEmptyJSONValue(s.Pricing) {
		if !strings.HasPrefix(strings.TrimSpace(string(s.Pricing)), "{") {
			return errors.New("pricing must be a JSON object")
		}
		var obj map[string]interface{}
		if err := json.Unmarshal(s.Pricing, &obj); err != nil {
			return errors.New("pricing must be a JSON object")
		}
	}
	if !isEmptyJSONValue(s.XctMetadata) {
		if !strings.HasPrefix(strings.TrimSpace(string(s.XctMetadata)), "{") {
			return errors.New("xct_metadata must be a JSON object")
		}
		var obj map[string]interface{}
		if err := json.Unmarshal(s.XctMetadata, &obj); err != nil {
			return errors.New("xct_metadata must be a JSON object")
		}
	}
	return nil
}

// normalize 统一空 JSON 值并维护 AgentSlug 冗余列
func (s *XctSkill) normalize() {
	if isEmptyJSONValue(s.Tools) {
		s.Tools = nil
	}
	if isEmptyJSONValue(s.Pricing) {
		s.Pricing = nil
	}
	if isEmptyJSONValue(s.XctMetadata) {
		s.XctMetadata = JSONValue("{}")
	}
	if s.Version != nil && *s.Version == "" {
		s.Version = nil
	}
	s.AgentSlug = ExtractXctAgentSlug(s.XctMetadata)
}

// Insert 新建技能，SkillId 为空时由服务端生成 uuid
func (s *XctSkill) Insert() error {
	if s.SkillId == "" {
		s.SkillId = common.GetUUID()
	}
	now := common.GetTimestamp()
	s.CreatedTime = now
	s.UpdatedTime = now
	s.normalize()
	// gorm 对带 default:true 标签的零值字段在 INSERT 时会跳过（且可能通过
	// RETURNING 把数据库默认值回填到结构体），显式创建 disabled 技能时需要补写一次
	wantEnabled := s.Enabled
	if err := DB.Create(s).Error; err != nil {
		return err
	}
	if !wantEnabled {
		if err := DB.Model(&XctSkill{}).Where("id = ?", s.Id).Update("enabled", false).Error; err != nil {
			return err
		}
		s.Enabled = false
	}
	return nil
}

// Update 更新技能
func (s *XctSkill) Update() error {
	s.UpdatedTime = common.GetTimestamp()
	s.normalize()
	return DB.Save(s).Error
}

// GetXctSkillBySkillId 按 skill_id 查询
func GetXctSkillBySkillId(skillId string, onlyEnabled bool) (*XctSkill, error) {
	if skillId == "" {
		return nil, gorm.ErrRecordNotFound
	}
	var skill XctSkill
	query := DB.Where("skill_id = ?", skillId)
	if onlyEnabled {
		query = query.Where("enabled = ?", true)
	}
	if err := query.First(&skill).Error; err != nil {
		return nil, err
	}
	return &skill, nil
}

// GetXctSkillByAgentSlug 按冗余的 agent_slug 查询；slug 不唯一时取最早创建的一条
func GetXctSkillByAgentSlug(slug string, onlyEnabled bool) (*XctSkill, error) {
	if slug == "" {
		return nil, gorm.ErrRecordNotFound
	}
	var skill XctSkill
	query := DB.Where("agent_slug = ?", slug)
	if onlyEnabled {
		query = query.Where("enabled = ?", true)
	}
	if err := query.Order("id asc").First(&skill).Error; err != nil {
		return nil, err
	}
	return &skill, nil
}

// GetXctSkillBySkillIdOrSlug 优先按 skill_id 查询，未命中时回退到 agent_slug
func GetXctSkillBySkillIdOrSlug(idOrSlug string, onlyEnabled bool) (*XctSkill, error) {
	skill, err := GetXctSkillBySkillId(idOrSlug, onlyEnabled)
	if err == nil {
		return skill, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	return GetXctSkillByAgentSlug(idOrSlug, onlyEnabled)
}

// ListXctSkills 游标分页：返回 id > afterId 的至多 limit 条记录（按 id asc），
// 以及是否还有更多数据
func ListXctSkills(afterId int, limit int, onlyEnabled bool) ([]*XctSkill, bool, error) {
	skills := make([]*XctSkill, 0, limit+1)
	query := DB.Model(&XctSkill{}).Where("id > ?", afterId)
	if onlyEnabled {
		query = query.Where("enabled = ?", true)
	}
	if err := query.Order("id asc").Limit(limit + 1).Find(&skills).Error; err != nil {
		return nil, false, err
	}
	hasMore := len(skills) > limit
	if hasMore {
		skills = skills[:limit]
	}
	return skills, hasMore, nil
}

// DeleteXctSkillBySkillId 按 skill_id 删除（软删除）
func DeleteXctSkillBySkillId(skillId string) error {
	result := DB.Where("skill_id = ?", skillId).Delete(&XctSkill{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
