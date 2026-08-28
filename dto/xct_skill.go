package dto

import "encoding/json"

// XctSkillRequest 管理端创建/更新 xct-skill 的请求体。
// 所有字段均为可选：创建时缺省为空值（enabled 缺省为 true）；
// 更新时仅应用请求中出现的字段（JSON 字段显式传 null 表示清空）。
type XctSkillRequest struct {
	DisplayTitle         *string         `json:"display_title"`
	Description          *string         `json:"description"`
	Version              *string         `json:"version"`
	SystemPromptTemplate *string         `json:"system_prompt_template"`
	Tools                json.RawMessage `json:"tools"`
	Pricing              json.RawMessage `json:"pricing"`
	XctMetadata          json.RawMessage `json:"xct_metadata"`
	Enabled              *bool           `json:"enabled"`
}
