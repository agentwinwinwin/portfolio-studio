# Portfolio CMS Demo

通用 React + Vite / FastAPI / SQLite 作品集与内容管理框架。不包含任何真实作者资料、经历、文章、项目、联系方式或个人图片。

## 本地运行

需要 Node.js 22、Python 3.11+，在仓库根目录执行（macOS/Linux）：

```bash
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python scripts/content_bundle.py import
npm run dev
```

前端 http://127.0.0.1:5173 ，后端 http://127.0.0.1:8000 ，API 文档 http://127.0.0.1:8000/docs 。首次在本地开发者控制台创建账户，内容由使用者自行添加。导入工具只接受新环境，拒绝覆盖已有内容。

Windows 使用 `.venv\Scripts\python.exe` 安装依赖及运行导入工具；开发脚本支持对应虚拟环境，未进行 Windows 实机验证。

## 功能与结构

React 页面、Markdown 图文编辑、项目与文章管理、素材分组、图片上传和单管理员 Cookie 认证。`src/` 为界面，`backend/` 为 API，`scripts/` 为启动与内容迁移，`content/` 仅包含空示例，`tests/` 使用临时数据库验证迁移。`public/` 没有预装图片。

`npm run build` 构建前端。`.venv/bin/python -m unittest discover -s tests` 执行检查。`npm run preview` 仍需运行后端。部署参考 [部署说明](docs/DEPLOYMENT.md)，GitHub Pages 无法单独承载 Python CMS。

## 贡献、安全与许可

见 [贡献指南](CONTRIBUTING.md)、[安全说明](SECURITY.md)、[MIT 许可](LICENSE) 和 [第三方许可](THIRD_PARTY_NOTICES.md)。自有代码 MIT；第三方组件及依赖遵循各自条款。当前依赖审计与发布范围见 [发布检查](docs/RELEASE_CHECKLIST.md)。

文档组织参考 [FastAPI 官方全栈模板](https://github.com/fastapi/full-stack-fastapi-template)，组件参考 [React Bits](https://github.com/DavidHDev/react-bits)。
