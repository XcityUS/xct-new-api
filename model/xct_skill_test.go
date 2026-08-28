package model

import (
	"encoding/json"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

var xctSkillMigrateOnce sync.Once

func setupXctSkillTable(t *testing.T) {
	t.Helper()
	xctSkillMigrateOnce.Do(func() {
		if err := DB.AutoMigrate(&XctSkill{}); err != nil {
			panic("failed to migrate xct_skills: " + err.Error())
		}
	})
	t.Cleanup(func() {
		DB.Exec("DELETE FROM xct_skills")
	})
}

func TestXctSkillInsertAssignsUUID(t *testing.T) {
	setupXctSkillTable(t)

	skill := &XctSkill{
		DisplayTitle:         "Mentor",
		Description:          "A mentor persona",
		SystemPromptTemplate: "You are a mentor.",
		Enabled:              true,
	}
	require.NoError(t, skill.Insert())
	assert.Len(t, skill.SkillId, 32, "skill_id should be a dashless uuid")
	assert.NotZero(t, skill.CreatedTime)
	assert.NotZero(t, skill.UpdatedTime)
	// 空 xct_metadata 归一化为对象
	assert.JSONEq(t, `{}`, string(skill.XctMetadata))

	other := &XctSkill{DisplayTitle: "Other", Enabled: true}
	require.NoError(t, other.Insert())
	assert.Len(t, other.SkillId, 32)
	assert.NotEqual(t, skill.SkillId, other.SkillId)
}

func TestXctSkillSlugFallbackLookup(t *testing.T) {
	setupXctSkillTable(t)

	first := &XctSkill{
		DisplayTitle: "Mentor",
		XctMetadata:  JSONValue(`{"xct_agent_slug":"mentor"}`),
		Enabled:      true,
	}
	require.NoError(t, first.Insert())
	assert.Equal(t, "mentor", first.AgentSlug)

	// 同 slug 的第二行：查询时应返回最早创建的一行（id asc）
	second := &XctSkill{
		DisplayTitle: "Mentor v2",
		XctMetadata:  JSONValue(`{"xct_agent_slug":"mentor"}`),
		Enabled:      true,
	}
	require.NoError(t, second.Insert())

	// 按 skill_id 命中
	got, err := GetXctSkillBySkillIdOrSlug(second.SkillId, true)
	require.NoError(t, err)
	assert.Equal(t, second.Id, got.Id)

	// skill_id 未命中时回退到 slug，first-created wins
	got, err = GetXctSkillBySkillIdOrSlug("mentor", true)
	require.NoError(t, err)
	assert.Equal(t, first.Id, got.Id)

	_, err = GetXctSkillBySkillIdOrSlug("no-such-skill", true)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
}

func TestXctSkillCursorPaginationWalk(t *testing.T) {
	setupXctSkillTable(t)

	created := make([]string, 0, 5)
	for i := 0; i < 5; i++ {
		skill := &XctSkill{DisplayTitle: "Skill", Enabled: true}
		require.NoError(t, skill.Insert())
		created = append(created, skill.SkillId)
	}

	walked := make([]string, 0, 5)
	afterId := 0
	pages := 0
	for {
		skills, hasMore, err := ListXctSkills(afterId, 2, true)
		require.NoError(t, err)
		pages++
		for _, s := range skills {
			walked = append(walked, s.SkillId)
		}
		if !hasMore {
			break
		}
		require.NotEmpty(t, skills)
		afterId = skills[len(skills)-1].Id
	}
	assert.Equal(t, 3, pages)
	assert.Equal(t, created, walked, "cursor walk should return every row exactly once, in id asc order")
}

func TestXctSkillEnabledFiltering(t *testing.T) {
	setupXctSkillTable(t)

	enabled := &XctSkill{DisplayTitle: "Enabled", Enabled: true}
	require.NoError(t, enabled.Insert())
	disabled := &XctSkill{DisplayTitle: "Disabled", Enabled: false}
	require.NoError(t, disabled.Insert())

	// disabled 行确实以 enabled=false 落库（绕过 gorm default:true 的零值跳过）
	var reloaded XctSkill
	require.NoError(t, DB.First(&reloaded, disabled.Id).Error)
	assert.False(t, reloaded.Enabled)

	skills, hasMore, err := ListXctSkills(0, 10, true)
	require.NoError(t, err)
	assert.False(t, hasMore)
	require.Len(t, skills, 1)
	assert.Equal(t, enabled.SkillId, skills[0].SkillId)

	all, _, err := ListXctSkills(0, 10, false)
	require.NoError(t, err)
	assert.Len(t, all, 2)

	_, err = GetXctSkillBySkillId(disabled.SkillId, true)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	got, err := GetXctSkillBySkillId(disabled.SkillId, false)
	require.NoError(t, err)
	assert.Equal(t, disabled.Id, got.Id)
}

func TestXctSkillValidate(t *testing.T) {
	valid := &XctSkill{
		Tools:       JSONValue(`[{"server_id":"portal-1","tool":"search","note":"web search"}]`),
		Pricing:     JSONValue(`{"kwh_per_use":0.5}`),
		XctMetadata: JSONValue(`{"xct_agent_slug":"mentor"}`),
	}
	assert.NoError(t, valid.Validate())

	assert.Error(t, (&XctSkill{Tools: JSONValue(`{"server_id":"x"}`)}).Validate(), "tools must be an array")
	assert.Error(t, (&XctSkill{Tools: JSONValue(`[{"tool":"search"}]`)}).Validate(), "server_id is required")
	assert.Error(t, (&XctSkill{Tools: JSONValue(`[{"server_id":"x","note":1}]`)}).Validate(), "note must be a string")
	assert.Error(t, (&XctSkill{Pricing: JSONValue(`[1]`)}).Validate(), "pricing must be an object")
	assert.Error(t, (&XctSkill{XctMetadata: JSONValue(`"slug"`)}).Validate(), "xct_metadata must be an object")

	// 序列化时 tools/pricing 为空则省略，xct_metadata 恒为对象
	skill := &XctSkill{}
	skill.normalize()
	data, err := json.Marshal(skill)
	require.NoError(t, err)
	assert.NotContains(t, string(data), `"tools"`)
	assert.Contains(t, string(data), `"xct_metadata":{}`)
}
