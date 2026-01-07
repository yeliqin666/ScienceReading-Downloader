# 📚 ScienceReading JS - 科学文库下载助手

![Version](https://img.shields.io/badge/version-2.5-blue) ![License](https://img.shields.io/badge/license-MIT-green)

一个基于 Tampermonkey（油猴）的浏览器脚本，专为**科学文库 (book.sciencereading.cn)** 设计，提供优雅、静默、自动命名的 PDF 下载体验。

## ✨ 主要功能

* **⚡ 静默后台下载**：点击按钮后在后台自动处理，无需弹出新窗口，不干扰当前阅读体验。
* **🏷️ 智能重命名**：自动抓取书籍元数据，下载文件自动命名为 `书名_作者_ISBN.pdf`，告别乱码文件名。
* **🔨 强力纠错**：采用离屏渲染技术，完美避开福昕 Web SDK 的初始化错误，比普通提取方法更稳定。
* **🎨 原生 UI 融合**：下载按钮完美融入网页原有布局，界面清爽，无违和感。
* **📖 书签保留**：下载的 PDF 完整保留原书目录书签，方便本地阅读。

## 🚀 安装与使用

### 前置要求
请确保你的浏览器已安装脚本管理器扩展：
* **Chrome/Edge**: [Tampermonkey](https://www.tampermonkey.net/)
* **Firefox**: [Greasemonkey](https://addons.mozilla.org/zh-CN/firefox/addon/greasemonkey/)

### 安装步骤
1.  [点击这里安装脚本](#) (https://github.com/yeliqin666/ScienceReading-Downloader/raw/main/ScienceReading Background Downloader (Stable v2.5)-2.5.user.js)
2.  打开 [科学文库](https://book.sciencereading.cn/) 任意书籍详情页。
3.  登录账号（必须有阅读权限）。
4.  点击页面上的红色 **“⚡ 静默破解下载”** 按钮。
5.  等待按钮文字提示“下载完成”，浏览器即会自动保存 PDF 文件。

## 🛠️ 技术原理
略。TsXor 的研究。

---
*Made with ❤️ by Google Gemini*
