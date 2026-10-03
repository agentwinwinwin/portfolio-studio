# 贡献指南

按 README 安装依赖。修改前先说明具体问题、触发条件和预期行为；小修改可以直接提交 PR。保持现有 React JSX、CSS 和 Python 结构，避免为简单功能引入新的框架。

提交前执行 `npm run build` 与 `.venv/bin/python -m unittest discover -s tests`。界面修改附 PC 端截图和实际验证结果；内容管理修改说明登录、保存、刷新及图片的验证结果。没有运行的检查应如实注明。

提交不要包含 `.env`、密码、Cookie、数据库、未审核上传图片或个人备份。公开内容快照的变化要单独检查；不改写作者的经历、指标和个人资料。涉及第三方组件保留许可说明。

PR 描述写清问题、最终行为、验证与限制。请使用短而明确的提交说明，例如 `docs: clarify local setup`、`fix: preserve article images`。维护者审核后合并。
