// ==UserScript==
// @name         ScienceReadingDownloader
// @namespace    http://tampermonkey.net/
// @version      2.5
// @description  自动重命名和静默下载。
// @author       Gemini & TsXor
// @match        https://book.sciencereading.cn/shop/book/Booksimple/show.do*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const BUTTON_ID = "sr-hack-download-btn";
    const LOG_PREFIX = "[SR-Downloader]";

    // === 1. 核心破解逻辑 ===
    const hackLogic = async (pdfui, customFileName) => {
        console.log("iframe: 逻辑开始执行...", customFileName);

        const downloadBlob = (blob, name) => {
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = name;
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(link.href);
            }, 1000);
        };

        const mergeArrayBuffers = (arrayBuffers) => {
            let totalLength = 0;
            for (const buffer of arrayBuffers) totalLength += buffer.byteLength;
            const mergedBuffer = new ArrayBuffer(totalLength);
            const uint8Array = new Uint8Array(mergedBuffer);
            let offset = 0;
            for (const buffer of arrayBuffers) {
                const sourceArray = new Uint8Array(buffer);
                uint8Array.set(sourceArray, offset);
                offset += sourceArray.length;
            }
            return mergedBuffer;
        };

        async function dumpBookmarks(api) {
            async function dump(data) {
                const children = await Promise.all((await api.getBookmarkChildren(data.id)).map(dump));
                return { data, children };
            }
            return await Promise.all((await api.getBookmarkChildren()).map(dump));
        }

        async function loadBookmarks(api, tree) {
            if(!tree) return;
            async function load(node, parent) {
                node.data.id = await api.addBookmark({
                    color: node.data.color,
                    destination: {
                        pageIndex: node.data.page,
                        left: node.data.left,
                        top: node.data.top,
                        zoomFactor: node.data.zoomFactor,
                        zoomMode: node.data.zoomMode,
                    },
                    style: { bold: node.data.isBold, italic: node.data.isItalic },
                    title: node.data.title,
                    destId: parent ? parent.data.id : undefined,
                    relationship: 1,
                });
                await Promise.all(node.children.map(child => load(child, node)));
            }
            await Promise.all(tree.map(node => load(node, null)));
        }

        try {
            if (!pdfui) throw new Error("PDFUI 未就绪");
            const bookmarkApi = await pdfui.getBookmarkDataService();
            const doc = await pdfui.getCurrentPDFDoc();
            if (!doc) throw new Error("文档未加载");

            const fileName = doc.getFileName();
            const count = doc.getPageCount();

            // === 关键回归：一次性提取所有页面 ===
            // 虽然这样就没有详细进度条了（会卡在“处理中”一会），但保证了文件结构的完整性
            window.parent.postMessage({ type: 'SR_PROGRESS', msg: `正在打包全书 (${count}页)...` }, '*');
            const pages = mergeArrayBuffers(await doc.extractPages([[0, count - 1]]));

            window.parent.postMessage({ type: 'SR_PROGRESS', msg: '正在处理书签...' }, '*');
            const bookmarks = await dumpBookmarks(bookmarkApi);

            window.parent.postMessage({ type: 'SR_PROGRESS', msg: '正在重组文档...' }, '*');
            const newDoc = await pdfui.createNewDoc(customFileName || fileName);

            await newDoc.insertPages({ file: pages, startIndex: 0, endIndex: count - 1 });
            await newDoc.removePage(newDoc.getPageCount() - 1); // 移除新建文档自带的空白页
            await loadBookmarks(bookmarkApi, bookmarks);

            window.parent.postMessage({ type: 'SR_PROGRESS', msg: '正在下载...' }, '*');
            const file = await newDoc.getFile();

            downloadBlob(file, customFileName || fileName);

            return "SUCCESS";

        } catch (e) {
            throw (e.message || e.toString());
        }
    };

    // === 2. 页面信息抓取 ===
    function getBookMetadata() {
        try {
            let title = document.querySelector('.book_detail_title span b')?.innerText.trim() || "Untitled";
            let author = "Unknown";
            let isbn = "000000";

            const rows = document.querySelectorAll('.book_info_row');
            rows.forEach(row => {
                const label = row.querySelector('.book_detail_title_width')?.innerText;
                const valueDiv = row.querySelector('.col-md-9, .col-md-8');
                if (label && valueDiv) {
                    const text = valueDiv.innerText.trim();
                    if (label.includes("作者")) author = text.split(';')[0].trim();
                    else if (label.includes("ISBN")) isbn = text;
                }
            });

            const safeName = `${title}_${author}_${isbn}.pdf`
                .replace(/[\/\\:*?"<>|]/g, "_")
                .replace(/\s+/g, "_");

            return safeName;
        } catch (e) {
            return "ScienceReading_Book.pdf";
        }
    }

    // === 3. 主页面交互逻辑 ===
    function init() {
        const urlParams = new URLSearchParams(window.location.search);
        const bookId = urlParams.get('id');
        if (!bookId) return;

        window.addEventListener('message', function(e) {
            if (e.data && e.data.type === 'SR_PROGRESS') {
                updateBtnStatus(e.data.msg, '#e67e22');
            }
        });

        const checkBtnInterval = setInterval(() => {
            const targetArea = document.querySelector('.book_operation');
            if (targetArea) {
                clearInterval(checkBtnInterval);
                injectButton(targetArea, bookId);
            }
        }, 500);
    }

    function injectButton(container, bookId) {
        if (document.getElementById(BUTTON_ID)) return;

        const btn = document.createElement('button');
        btn.id = BUTTON_ID;
        btn.innerHTML = '<i class="fa fa-bolt"></i> 静默破解下载';
        btn.className = "btn";
        // 样式：自适应宽度，确保文字不换行
        btn.style.cssText = "background-color: #d9534f; color: white; margin-left: 10px; border: none; cursor: pointer; padding: 6px 15px; border-radius: 4px; vertical-align: middle; transition: all 0.3s; min-width: 160px; width: auto; white-space: nowrap;";

        btn.onclick = (e) => {
            e.preventDefault();
            const fileName = getBookMetadata();
            startBackgroundProcess(bookId, fileName);
        };

        const descriptionSpan = container.querySelector('span');
        if (descriptionSpan) {
            descriptionSpan.style.display = "block";
            descriptionSpan.style.width = "100%";
            descriptionSpan.style.marginTop = "10px";
            descriptionSpan.style.marginLeft = "0px";
            descriptionSpan.style.color = "#999";
            container.insertBefore(btn, descriptionSpan);
        } else {
            container.appendChild(btn);
        }
    }

    function updateBtnStatus(text, color = '#d9534f', disabled = true) {
        const btn = document.getElementById(BUTTON_ID);
        if (!btn) return;
        if (btn.innerText !== text) btn.innerText = text;
        btn.style.backgroundColor = color;
        if (disabled) {
            btn.setAttribute('disabled', 'disabled');
            btn.style.cursor = 'wait';
            btn.style.opacity = '0.9';
        } else {
            btn.removeAttribute('disabled');
            btn.style.cursor = 'pointer';
            btn.style.opacity = '1';
        }
    }

    function startBackgroundProcess(bookId, fileName) {
        console.log(LOG_PREFIX, "启动流程...", fileName);
        updateBtnStatus("正在初始化...", "#5bc0de");

        const oldFrame = document.getElementById('sr-hack-frame');
        if (oldFrame) oldFrame.remove();

        const iframe = document.createElement('iframe');
        iframe.id = 'sr-hack-frame';
        iframe.src = `https://book.sciencereading.cn/shop/book/Booksimple/onlineRead.do?id=${bookId}&readMark=1`;
        // 离屏渲染，防止 display:none 导致 SDK 崩溃
        iframe.style.cssText = "position: absolute; top: -10000px; left: -10000px; width: 1024px; height: 768px; visibility: visible;";
        document.body.appendChild(iframe);

        let attempts = 0;
        const maxAttempts = 120;

        const checkFrame = setInterval(async () => {
            attempts++;
            if (attempts > maxAttempts) {
                clearInterval(checkFrame);
                iframe.remove();
                updateBtnStatus("超时：请刷新重试", "red", false);
                return;
            }

            try {
                const subWin = iframe.contentWindow;
                if (subWin && subWin.pdfui) {
                    try {
                        const doc = await subWin.pdfui.getCurrentPDFDoc();
                        if (doc) {
                            clearInterval(checkFrame);
                            console.log(LOG_PREFIX, "注入代码...");

                            const script = subWin.document.createElement('script');
                            script.textContent = `(${hackLogic.toString()})(window.pdfui, "${fileName}")
                                .then(() => {
                                    window.parent.postMessage({ type: 'SR_DONE' }, '*');
                                })
                                .catch(err => {
                                    console.error("Hack Logic Error:", err);
                                    window.parent.postMessage({ type: 'SR_ERROR', msg: err }, '*');
                                });`;
                            subWin.document.body.appendChild(script);
                        }
                    } catch (docErr) {}
                }
            } catch (e) {}
        }, 1000);

        const resultListener = function(e) {
            if (e.data.type === 'SR_DONE') {
                updateBtnStatus("下载完成!", "#5cb85c", false);
                window.removeEventListener('message', resultListener);
                setTimeout(() => {
                    iframe.remove();
                    updateBtnStatus("⚡ 静默破解下载", "#d9534f", false);
                }, 5000);
            } else if (e.data.type === 'SR_ERROR') {
                console.error(LOG_PREFIX, e.data.msg);
                updateBtnStatus("失败: " + e.data.msg.substring(0, 10), "red", false);
                window.removeEventListener('message', resultListener);
                iframe.remove();
            }
        };
        window.addEventListener('message', resultListener);
    }

    init();
})();
