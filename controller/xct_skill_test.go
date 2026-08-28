package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupXctSkillControllerTest(t *testing.T) {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}
	model.DB = db
	model.LOG_DB = db
	if err := db.AutoMigrate(&model.XctSkill{}); err != nil {
		t.Fatalf("failed to migrate xct_skills: %v", err)
	}

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
}

// newXctSkillTestRouter 注册与生产一致的只读路由（省略认证中间件，认证由中间件层单独保证）
func newXctSkillTestRouter() *gin.Engine {
	router := gin.New()
	router.GET("/v1/xct-skills", ListXctSkills)
	router.GET("/v1/xct-skills/:id", GetXctSkill)
	return router
}

func seedXctSkill(t *testing.T, title string, slug string, enabled bool) *model.XctSkill {
	t.Helper()
	skill := &model.XctSkill{
		DisplayTitle:         title,
		SystemPromptTemplate: "You are " + title + ".",
		Enabled:              enabled,
	}
	if slug != "" {
		skill.XctMetadata = model.JSONValue(`{"xct_agent_slug":"` + slug + `"}`)
	}
	if err := skill.Insert(); err != nil {
		t.Fatalf("failed to seed skill: %v", err)
	}
	return skill
}

type xctSkillListResponse struct {
	Data       []map[string]json.RawMessage `json:"data"`
	HasMore    bool                         `json:"has_more"`
	NextCursor string                       `json:"next_cursor"`
}

func TestXctSkillListCursorWalkOverHTTP(t *testing.T) {
	setupXctSkillControllerTest(t)
	router := newXctSkillTestRouter()

	expected := make([]string, 0, 5)
	for i := 0; i < 5; i++ {
		skill := seedXctSkill(t, fmt.Sprintf("Skill %d", i), "", true)
		expected = append(expected, skill.SkillId)
	}
	seedXctSkill(t, "Disabled", "", false)

	walked := make([]string, 0, 5)
	cursor := ""
	for page := 0; ; page++ {
		if page > 10 {
			t.Fatal("pagination did not terminate")
		}
		url := "/v1/xct-skills?limit=2"
		if cursor != "" {
			url += "&cursor=" + cursor
		}
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, url, nil)
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("unexpected status %d: %s", w.Code, w.Body.String())
		}
		var resp xctSkillListResponse
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to parse response: %v", err)
		}
		for _, row := range resp.Data {
			var skillId string
			if err := json.Unmarshal(row["skill_id"], &skillId); err != nil {
				t.Fatalf("row missing skill_id: %v", err)
			}
			if _, ok := row["xct_metadata"]; !ok {
				t.Fatal("row missing xct_metadata")
			}
			walked = append(walked, skillId)
		}
		if !resp.HasMore || resp.NextCursor == "" {
			break
		}
		cursor = resp.NextCursor
	}
	if len(walked) != len(expected) {
		t.Fatalf("expected %d enabled skills, walked %d", len(expected), len(walked))
	}
	for i := range expected {
		if walked[i] != expected[i] {
			t.Fatalf("row %d: expected %s, got %s", i, expected[i], walked[i])
		}
	}
}

func TestXctSkillGetByIdAndSlugFallback(t *testing.T) {
	setupXctSkillControllerTest(t)
	router := newXctSkillTestRouter()

	skill := seedXctSkill(t, "Mentor", "mentor", true)

	for _, key := range []string{skill.SkillId, "mentor"} {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/v1/xct-skills/"+key, nil)
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("lookup by %q: unexpected status %d", key, w.Code)
		}
		var resp struct {
			Data struct {
				SkillId              string `json:"skill_id"`
				SystemPromptTemplate string `json:"system_prompt_template"`
			} `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to parse response: %v", err)
		}
		if resp.Data.SkillId != skill.SkillId {
			t.Fatalf("lookup by %q: expected skill %s, got %s", key, skill.SkillId, resp.Data.SkillId)
		}
		if resp.Data.SystemPromptTemplate == "" {
			t.Fatalf("lookup by %q: system_prompt_template missing", key)
		}
	}

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/v1/xct-skills/no-such-skill", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for unknown skill, got %d", w.Code)
	}

	// disabled 技能对 /v1 不可见
	disabled := seedXctSkill(t, "Hidden", "hidden", false)
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/v1/xct-skills/"+disabled.SkillId, nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for disabled skill, got %d", w.Code)
	}
}
