# 吴宗河作品集 · Portfolio

> **横向翻页作品集（Swiss International Style × Blueprint）**  
> 「路网决策与 Agent 产品都真实做过，现在把两者接起来。」  
> 定位：AI Product · Agent · Mobility | 腾讯地图 AI 产品经理培训生（导航 Agent 方向）· 2027 届

---

## 📖 项目简介

本项目为吴宗河（Zonghe Wu）的个人作品集单页网站，采用 **PPT 样式的全屏横向翻页** 形态，视觉风格结合了 **瑞士国际主义风格（Swiss International Style）** 的秩序骨架与 **工程蓝图（Blueprint）** 的技术制图美学。

- **在线访问**：[https://jonah-wu23.github.io/portfolio/](https://jonah-wu23.github.io/portfolio/)
- **个人主页**：[https://jonah-wu23.github.io](https://jonah-wu23.github.io)
- **技术栈**：纯静态单页（手写 HTML5 + 原生 CSS3 + 原生 JavaScript，无构建依赖，零外部框架）

---

## 🖥️ 核心项目展示

1. **Navigation Buddy · 导航 Agent 原型**
   - 从「最快路线」到「懂我的路线」：效用 ≠ ETA、偏好是软约束、记忆可见可控可溯源可删、解释先于惊喜。
   - 在线体验：[https://navigation-buddy.vercel.app](https://navigation-buddy.vercel.app)
   - 自检页：[https://navigation-buddy.vercel.app/selfcheck](https://navigation-buddy.vercel.app/selfcheck)
   - 源码仓库：[https://github.com/Jonah-Wu23/navigation-buddy](https://github.com/Jonah-Wu23/navigation-buddy)

2. **留乘智行 · 需求响应公交智能调度系统**
   - OSM 三层图结构（558 站点、16,740 边），承接曼哈顿 270 万订单；寻路重构为评估候选路综合代价与流失感知。
   - 源码仓库：[https://github.com/Jonah-Wu23/Churn-Aware-GNN-RL](https://github.com/Jonah-Wu23/Churn-Aware-GNN-RL)

3. **HSR Partner Harness · 角色 × Agent 双轨 AI 搭档工作台**
   - 流程闭环：用户 ↔ 人格化 Buddy → 结构化委派 → Agent 真实执行 → 结果回传 → Buddy 继续审视。
   - 项目站：[https://jonah-wu23.github.io/HSR_Partner_Harness/](https://jonah-wu23.github.io/HSR_Partner_Harness/)
   - 源码仓库：[https://github.com/Jonah-Wu23/HSR_Partner_Harness](https://github.com/Jonah-Wu23/HSR_Partner_Harness)

4. **Anima Companion · 多模态 3D AI 角色陪伴产品**
   - 0→1 产品规范落地，知识库注入、跨轮回读、VAD-ASR-LLM-TTS 链路与线上运维。
   - 在线产品：[https://anima-companion.fun](https://anima-companion.fun)
   - 源码仓库：[https://github.com/Jonah-Wu23/anima-companion](https://github.com/Jonah-Wu23/anima-companion)

---

## 🛠️ 本地预览与调试

在仓库根目录下直接启动任意静态 HTTP 服务器即可：

```bash
# 使用 Python 内置静态服务器（推荐）
python -m http.server 8000
```

打开浏览器访问 `http://localhost:8000` 即可实时预览。

---

## 🚀 部署说明

- **部署源**：本仓库根目录直接作为 GitHub Pages 源（部署分支：`main` / 路径：`/root`）。
- **部署流程**：任何推送到 `main` 分支的提交将通过 GitHub Pages 自动部署上线。
- **静态资源优化**：根目录包含 `.nojekyll` 文件，防止 GitHub Pages 过滤下划线等特殊目录。

---

## 📂 仓库结构

```
portfolio/site/
├── index.html                 # 作品集主页面骨架与导航
├── favicon.svg                # 瑞士红底白字 W 矢量图标 (64x64)
├── og.png                     # 社交分享卡片 (1200x630, Swiss x Blueprint)
├── links.txt                  # 全站外部链接清单（供 QA 点验）
├── .nojekyll                  # GitHub Pages 忽略 Jekyll 构建标记
├── .gitignore                 # Git 忽略文件
├── README.md                  # 项目说明文档
├── slides/                    # 10 张幻灯片 HTML 片段
│   ├── 01-cover.html          # 01 封面
│   ├── 02-index.html          # 02 目录
│   ├── 03-nb-judgment.html    # 03 Navigation Buddy 产品判断
│   ├── 04-nb-demo.html        # 04 Navigation Buddy 闭环演示
│   ├── 05-nb-evidence.html    # 05 Navigation Buddy 工程证据
│   ├── 06-lc-network.html     # 06 留乘智行 路网架构
│   ├── 07-lc-results.html     # 07 留乘智行 验证与评价
│   ├── 08-hsr.html            # 08 HSR Partner Harness 双轨工作台
│   ├── 09-anima.html          # 09 Anima Companion 陪伴产品
│   └── 10-contact.html        # 10 开源项目与联系方式
├── assets/
│   ├── css/
│   │   ├── tokens.css         # 设计令牌（颜色、字体、几何规范）
│   │   └── main.css           # 基础重置、组件与蓝图样式、打印样式
│   ├── js/
│   │   ├── flip.js            # 横向翻页引擎（滚轮、键盘、手势、深链、节能）
│   │   └── main.js            # 页面初始化与交互胶水层
│   └── img/                   # 项目实拍截图与证据图片
└── _preview/                  # 临时测试与开发自验工具（不入主干）
    └── make-og.py             # og.png 生成脚本
```

---

## 📬 联系方式

- **姓名**：吴宗河（Zonghe Wu）
- **电话**：13646028118
- **邮箱**：[3582584159@qq.com](mailto:3582584159@qq.com)
- **GitHub**：[https://github.com/Jonah-Wu23](https://github.com/Jonah-Wu23)
- **B 站主页**：[https://space.bilibili.com/328348048](https://space.bilibili.com/328348048)
