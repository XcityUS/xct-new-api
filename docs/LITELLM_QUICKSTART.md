# LiteLLM Integration - Quick Start Guide

## 5 分钟快速集成指南

本指南帮助您在 5 分钟内完成 xct-new-api 与 xct-litellm (tokenhub.xcity.one) 的集成。

## 前置条件

- [x] xct-new-api 已部署并运行
- [x] 有 xct-new-api 管理员权限
- [x] 已从 xcity-home 获取 LiteLLM virtual key（方案 A）或准备创建 service key（方案 B）

## 快速开始（方案 A: 用户 Key）

### 步骤 1: 获取 LiteLLM Key

1. 访问 xcity-home (https://xcity.one)
2. 注册并登录
3. 生成 LiteLLM virtual key
4. 复制 key（格式: `sk-xxxxxxxxxxxxxxxx`）

### 步骤 2: 创建 Channel

**选项 A: 通过管理界面**

1. 登录 xct-new-api 管理后台
2. 导航到 "渠道管理" → "添加渠道"
3. 填写以下信息:
   ```
   渠道类型: OpenAI
   渠道名称: LiteLLM Router
   Base URL: https://tokenhub.xcity.one
   密钥: sk-xxxxxxxxxxxxxxxx (你的 LiteLLM key)
   模型列表: gpt-4,gpt-3.5-turbo,claude-3-opus-20240229
   状态: 启用
   ```
4. 点击保存

**选项 B: 通过 SQL**

```sql
-- MySQL
INSERT INTO channels (type, name, base_url, `key`, models, status, weight, created_time)
VALUES (
    1,
    'LiteLLM Router',
    'https://tokenhub.xcity.one',
    'sk-xxxxxxxxxxxxxxxx',
    'gpt-4,gpt-3.5-turbo,claude-3-opus-20240229',
    1,
    100,
    UNIX_TIMESTAMP()
);

-- SQLite
INSERT INTO channels (type, name, base_url, key, models, status, weight, created_time)
VALUES (
    1,
    'LiteLLM Router',
    'https://tokenhub.xcity.one',
    'sk-xxxxxxxxxxxxxxxx',
    'gpt-4,gpt-3.5-turbo,claude-3-opus-20240229',
    1,
    100,
    strftime('%s', 'now')
);
```

**选项 C: 通过 API**

```bash
curl -X POST http://localhost:3000/api/channel \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": 1,
    "name": "LiteLLM Router",
    "base_url": "https://tokenhub.xcity.one",
    "key": "sk-xxxxxxxxxxxxxxxx",
    "models": "gpt-4,gpt-3.5-turbo,claude-3-opus-20240229",
    "status": 1,
    "weight": 100
  }'
```

### 步骤 3: 测试集成

```bash
# 发送测试请求
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_XCT_NEW_API_TOKEN" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {
        "role": "user",
        "content": "Hello! Please respond with just the word OK."
      }
    ]
  }'
```

**预期输出:**
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-3.5-turbo",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "OK"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 1,
    "total_tokens": 11
  }
}
```

### 步骤 4: 验证路由

**检查 xct-new-api 日志:**
```bash
# 查看最近的请求日志
tail -f /path/to/xct-new-api/logs/app.log | grep -i litellm
```

应该看到类似输出:
```
[INFO] Channel selected: LiteLLM Router (ID: 123)
[INFO] Request URL: https://tokenhub.xcity.one/v1/chat/completions
[INFO] Response received: 200 OK
```

**检查 LiteLLM 日志（在 xcity-home）:**

1. 登录 xcity-home
2. 查看 SpendLog
3. 确认有新的请求记录，包含:
   - API Key: 你的 virtual key
   - Model: gpt-3.5-turbo
   - Tokens: 11 (或接近的数值)
   - Cost: 相应的成本

## 快速开始（方案 B: Service Key）

### 步骤 1: 创建 Service Key

1. 在 xcity-home 创建一个专用的 service key
2. 设置足够高的预算和 RPM 限制
3. 将所有需要的模型添加到白名单

### 步骤 2: 配置默认 Channel

使用相同的方式创建 channel，但使用 service key:

```sql
INSERT INTO channels (type, name, base_url, `key`, models, status, weight, created_time)
VALUES (
    1,
    'LiteLLM Service',
    'https://tokenhub.xcity.one',
    'sk-service-xxxxxxxxxxxxxxxx',
    'gpt-4,gpt-4-turbo,gpt-3.5-turbo,claude-3-opus-20240229,claude-3-sonnet-20240229',
    1,
    100,
    UNIX_TIMESTAMP()
);
```

### 步骤 3: 配置内部配额管理

在 xct-new-api 中为每个用户配置配额限制，因为 LiteLLM 层面只能看到统一的 service key。

## 迁移现有 Channels

如果已有 OpenAI channels，可以使用迁移脚本:

```bash
# 查看会改变什么（dry run）
./bin/migrate_to_litellm.sh --dry-run

# 创建备份并执行迁移
./bin/migrate_to_litellm.sh --backup
```

或手动更新:

```sql
-- 更新所有 OpenAI channels 指向 LiteLLM
UPDATE channels 
SET base_url = 'https://tokenhub.xcity.one'
WHERE type = 1 
  AND (base_url = '' OR base_url = 'https://api.openai.com');

-- 验证更新
SELECT id, name, type, base_url FROM channels WHERE type = 1;
```

## 常见问题

### Q1: 请求返回 401 错误

**解决方案:**
1. 确认 LiteLLM key 有效: 在 xcity-home 中检查 key 状态
2. 确认 key 格式正确: 应该是 `sk-` 开头
3. 测试 key 直接访问 LiteLLM:
   ```bash
   curl https://tokenhub.xcity.one/v1/models \
     -H "Authorization: Bearer sk-xxxxxxxxxxxxxxxx"
   ```

### Q2: 请求返回 429 限流错误

**解决方案:**
1. 检查 LiteLLM key 的 RPM 限制
2. 在 xcity-home 中增加限流阈值
3. 实现客户端重试逻辑

### Q3: 某些模型不可用

**解决方案:**
1. 确认模型在 LiteLLM key 的白名单中
2. 在 xcity-home 中添加模型到白名单
3. 更新 xct-new-api channel 的模型列表

### Q4: Base URL 应该填什么？

**正确配置:**
- ✅ `https://tokenhub.xcity.one`
- ✅ `https://tokenhub.xcity.one/`

**错误配置:**
- ❌ `https://tokenhub.xcity.one/v1` (路径会被自动添加)
- ❌ `http://tokenhub.xcity.one` (应该用 HTTPS)

### Q5: 如何验证请求确实通过了 LiteLLM？

**方法 1: 查看 xct-new-api 日志**
```bash
grep "tokenhub.xcity.one" /path/to/logs/app.log
```

**方法 2: 查看 LiteLLM SpendLog**
- 登录 xcity-home
- 查看 SpendLog，应该看到新的请求记录

**方法 3: 使用不同的模型名称**
```bash
# 请求一个只有 LiteLLM 支持的模型别名
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"model": "gpt-4-turbo", "messages": [...]}'
```

## 下一步

- 📖 阅读完整文档: [docs/LITELLM_INTEGRATION.md](./LITELLM_INTEGRATION.md)
- 🔧 配置限流和预算: 在 xcity-home 中配置
- 📊 设置监控: 监控请求成功率、延迟和成本
- 🔐 配置 Key 轮换: 定期更新 API keys

## 获取帮助

- GitHub Issues: https://github.com/XcityUS/xct-new-api/issues
- 文档: [docs/LITELLM_INTEGRATION.md](./LITELLM_INTEGRATION.md)
- 示例配置: [docs/litellm_channel_example.json](./litellm_channel_example.json)

## 检查清单

完成以下步骤确保集成成功:

- [ ] 获取 LiteLLM virtual key
- [ ] 在 xct-new-api 中创建 LiteLLM channel
- [ ] Channel 的 BaseURL 设置为 `https://tokenhub.xcity.one`
- [ ] 发送测试请求并收到成功响应
- [ ] 在 xct-new-api 日志中看到请求发送到 tokenhub.xcity.one
- [ ] 在 xcity-home SpendLog 中看到请求记录
- [ ] 测试限流功能正常工作
- [ ] 测试不同模型都能正常调用
- [ ] 配置监控和告警
- [ ] 通知用户更新 API keys（如果迁移现有系统）

---

🎉 恭喜！您已成功将 xct-new-api 集成到 xct-litellm！
