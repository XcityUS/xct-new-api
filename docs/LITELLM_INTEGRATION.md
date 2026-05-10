# xct-new-api 接入 xct-litellm (tokenhub.xcity.one) 集成指南

## 概述

本文档说明如何将 xct-new-api 配置为通过 xct-litellm (tokenhub.xcity.one) 路由所有模型请求，实现统一的认证、计费、限流和模型管理。

## 架构说明

xct-new-api 已经内置了 Channel（渠道）系统，支持通过 `base_url` 字段自定义 API 端点。由于 LiteLLM 提供 OpenAI 兼容的 API，我们可以直接使用现有的 OpenAI Channel 类型，只需将 BaseURL 指向 tokenhub.xcity.one。

### 工作原理

```
Client Request → xct-new-api → tokenhub.xcity.one (LiteLLM) → Upstream Providers
                 (Channel System)    (Model Router)           (OpenAI/Claude/etc.)
```

## 集成方案

### 方案 A: 透传用户 Key（推荐）

**描述**: xct-new-api 用户使用自己从 xcity-home 获取的 LiteLLM virtual key

**优点**:
- 用户级别的计费和限流控制
- LiteLLM SpendLog 可追踪每个用户的用量
- 符合多租户架构最佳实践
- 无需在 xct-new-api 中管理额外的内部配额逻辑

**实施步骤**:

1. **用户获取 LiteLLM Key**
   - 用户在 xcity-home 注册并获取 LiteLLM virtual key
   - 该 key 已经包含用户的预算、限流和模型白名单配置

2. **在 xct-new-api 中配置 Channel**
   - Channel Type: `OpenAI` (类型 ID = 1)
   - Base URL: `https://tokenhub.xcity.one`
   - Key: 用户的 LiteLLM virtual key (格式: `sk-xxx`)
   - Models: 根据需要配置可用模型列表

3. **请求流程**
   ```
   用户 API 请求 → xct-new-api (验证 xct-new-api token)
                 → tokenhub.xcity.one (验证 LiteLLM key + 应用限流/预算)
                 → 上游 Provider
   ```

### 方案 B: Service Key（备选）

**描述**: xct-new-api 使用统一的内部 service key，在内部跟踪用户用量

**优点**:
- 简化用户注册流程（无需在 xcity-home 注册）
- xct-new-api 完全控制内部配额管理

**缺点**:
- 无法在 LiteLLM 层面进行用户级限流和计费
- 需要在 xct-new-api 中实现额外的配额管理逻辑
- SpendLog 只能看到 service key 的总用量，无法区分用户

**实施步骤**:

1. **创建 Service Key**
   - 在 xcity-home 为 xct-new-api 创建一个专用的 service key
   - 配置足够高的预算和限流阈值

2. **在 xct-new-api 中配置默认 Channel**
   - Channel Type: `OpenAI`
   - Base URL: `https://tokenhub.xcity.one`
   - Key: xct-new-api service key
   - Models: 所有支持的模型

3. **内部用量跟踪**
   - 在 xct-new-api 中实现用户级配额管理
   - 记录每个用户的请求到内部数据库

## 配置示例

### 数据库配置（方案 A）

直接在 xct-new-api 管理界面或通过 API 创建 Channel：

```sql
INSERT INTO channels (
    type,
    name,
    base_url,
    key,
    models,
    status,
    created_time
) VALUES (
    1,                                      -- OpenAI channel type
    'LiteLLM - User Key',
    'https://tokenhub.xcity.one',
    'sk-xxxxxxxxxxxxxxxx',                 -- 用户的 LiteLLM virtual key
    'gpt-4,gpt-3.5-turbo,claude-3-opus',  -- 支持的模型列表
    1,                                      -- enabled
    UNIX_TIMESTAMP()
);
```

### 环境变量配置（可选）

如果需要在应用层面配置默认行为，可以在 `.env` 中添加：

```bash
# LiteLLM Integration
DEFAULT_CHANNEL_BASE_URL=https://tokenhub.xcity.one
DEFAULT_CHANNEL_TYPE=1  # OpenAI type
```

### 通过管理界面配置

1. 登录 xct-new-api 管理后台
2. 导航到 "渠道管理" → "添加渠道"
3. 填写以下信息:
   - **渠道类型**: OpenAI
   - **渠道名称**: LiteLLM Router
   - **Base URL**: `https://tokenhub.xcity.one`
   - **密钥**: 用户的 LiteLLM virtual key
   - **模型列表**: 根据 LiteLLM 配置选择支持的模型
   - **状态**: 启用
4. 保存配置

## Key 管理策略

### 推荐策略（方案 A）

**用户 Key 生命周期**:

1. **注册阶段**
   - 用户在 xcity-home 注册
   - 获取 LiteLLM virtual key
   
2. **绑定阶段**
   - 用户在 xct-new-api 中添加 Channel
   - 输入 LiteLLM key
   
3. **使用阶段**
   - xct-new-api 验证用户的 xct-new-api token
   - 使用用户配置的 LiteLLM key 调用 tokenhub.xcity.one
   
4. **计费阶段**
   - LiteLLM 根据 virtual key 追踪用量
   - 应用预算和限流规则
   - 记录到 SpendLog

### Key 轮换和管理

- **Key 更新**: 用户可以在 xct-new-api 管理界面更新 Channel 的 key
- **Key 吊销**: 在 xcity-home 中吊销 key 后，该 key 立即无法使用
- **多 Key 支持**: xct-new-api 支持多 Channel 配置，用户可以配置多个 LiteLLM key

## 验证标准

### 1. 请求路由验证

**测试步骤**:
```bash
# 通过 xct-new-api 发送请求
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_XCT_NEW_API_TOKEN" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

**预期结果**:
- 请求成功返回
- 检查 xct-new-api 日志，确认请求发送到 `https://tokenhub.xcity.one`
- 检查 LiteLLM 日志，确认收到请求

### 2. 限流和预算验证

**测试步骤**:
1. 在 xcity-home 中为测试 key 设置较低的限流阈值（如 5 RPM）
2. 通过 xct-new-api 快速发送多个请求
3. 验证达到限流后收到 429 错误

**预期结果**:
- 前 5 个请求成功
- 第 6 个请求收到 `429 Too Many Requests` 错误
- 错误信息包含 LiteLLM 的限流提示

### 3. SpendLog 追踪验证

**测试步骤**:
1. 使用不同的 LiteLLM key 发送多个请求
2. 在 xcity-home SpendLog 中查看用量记录

**预期结果**:
- 每个请求都被正确记录在 SpendLog 中
- 可以区分不同用户（不同 virtual key）的用量
- 记录包含模型名称、token 数量、成本等信息

### 4. 模型白名单验证

**测试步骤**:
1. 在 LiteLLM key 配置中只允许 `gpt-3.5-turbo`
2. 尝试通过 xct-new-api 请求 `gpt-4`

**预期结果**:
- 请求被 LiteLLM 拒绝
- 返回模型不在白名单的错误信息

## 迁移指南

### 从直连 Provider 迁移到 LiteLLM

**步骤 1: 备份现有 Channel 配置**
```bash
# 导出现有 channels 表
mysqldump -u user -p database channels > channels_backup.sql
```

**步骤 2: 更新 Channel BaseURL**
```sql
-- 将所有 OpenAI channel 指向 LiteLLM
UPDATE channels 
SET base_url = 'https://tokenhub.xcity.one' 
WHERE type = 1 AND (base_url = '' OR base_url = 'https://api.openai.com');

-- 记录变更
SELECT id, name, base_url FROM channels WHERE type = 1;
```

**步骤 3: 更新 API Keys**
- 方案 A: 通知用户更新为 LiteLLM virtual key
- 方案 B: 配置统一的 service key

**步骤 4: 渐进式迁移（推荐）**
1. 创建新的 LiteLLM channels，保留原有 channels
2. 将部分用户/请求路由到新 channels 进行测试
3. 验证无误后，逐步迁移所有流量
4. 删除旧的直连 channels

## 监控和日志

### xct-new-api 日志

关键日志点:
- Channel selection: 确认选择了正确的 LiteLLM channel
- Request URL: 确认请求发送到 `tokenhub.xcity.one`
- Response time: 监控通过 LiteLLM 的延迟

### LiteLLM 日志

在 xct-litellm 中启用详细日志:
```yaml
# config.yaml
litellm_settings:
  set_verbose: true
  
# 查看请求日志
tail -f /path/to/litellm/logs/requests.log
```

### 关键指标

1. **请求成功率**: 应该与直连 Provider 相当
2. **响应延迟**: 增加的延迟应该 < 50ms（LiteLLM 转发开销）
3. **错误率**: 监控 LiteLLM 层的错误（限流、预算超出等）
4. **成本追踪**: 通过 SpendLog 追踪实际成本

## 故障排查

### 问题 1: 请求失败，返回 401 Unauthorized

**可能原因**:
- LiteLLM key 无效或过期
- Key 权限不足

**解决方案**:
1. 验证 key 在 xcity-home 中是否有效
2. 检查 key 是否有访问所请求模型的权限
3. 使用 curl 直接测试 LiteLLM endpoint

### 问题 2: 请求被限流

**可能原因**:
- 达到 LiteLLM key 的 RPM/TPM 限制
- 达到 LiteLLM 全局限流

**解决方案**:
1. 检查 key 的限流配置
2. 实现客户端重试逻辑（exponential backoff）
3. 考虑升级 LiteLLM key 的限流阈值

### 问题 3: 某些模型不可用

**可能原因**:
- 模型不在 LiteLLM key 的白名单中
- LiteLLM 未配置该 Provider

**解决方案**:
1. 检查 LiteLLM key 的模型白名单
2. 确认 LiteLLM 已配置对应的 upstream provider
3. 在 xct-new-api channel 中移除不支持的模型

## 安全考虑

1. **Key 存储**: 
   - Channel keys 存储在 xct-new-api 数据库中
   - 确保数据库访问受限
   - 考虑加密存储敏感字段

2. **传输安全**:
   - 所有请求使用 HTTPS
   - 验证 TLS 证书

3. **访问控制**:
   - 限制谁可以创建/修改 channels
   - 审计 channel 配置变更

4. **Key 轮换**:
   - 定期轮换 service keys（方案 B）
   - 提供用户更新 key 的便捷方式（方案 A）

## 性能优化

1. **连接池**: xct-new-api 已内置 HTTP 连接池，无需额外配置

2. **缓存**: 
   - Channel 配置已缓存在内存中
   - 使用 Redis 缓存频繁访问的数据

3. **负载均衡**:
   - 如果 tokenhub.xcity.one 有多个实例，配置多个 channels
   - xct-new-api 支持 channel 权重和轮询

## 相关资源

- [xct-new-api 文档](../README.md)
- [LiteLLM 文档](https://docs.litellm.ai/)
- [OpenAI API 兼容性说明](https://platform.openai.com/docs/api-reference)

## 变更历史

- 2026-05-10: 初始版本，完成集成方案设计
