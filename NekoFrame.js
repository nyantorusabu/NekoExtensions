// Name: NekoFrame
// ID: NekoFrame
// Description: Embed a page on the Stage
// By: nyantorusabu

(function (Scratch) {
  "use strict";

  class NekoFrame {
    constructor() {
      this.iframe = null;
      this.lastMessage = "";
      this._boundOnMessage = this._onMessage.bind(this);
      this._boundUpdateFrame = this._updateFrame.bind(this);
      this._resizeObserver = null;
      this._mutationObserver = null;
      this._intersectionObserver = null;
      this.x = 0;
      this.y = 0;
      this.width = -1;
      this.height = -1;
      this.visible = true;
      this.interactive = true;
    }

    getInfo() {
      return {
        id: "nekoframe",
        name: "NekoFrame",
        color1: "#4CAF50",
        color2: "#43A047",
        color3: "#388E3C",
        blocks: [
          {
            opcode: "open",
            blockType: Scratch.BlockType.COMMAND,
            text: "[URL] を開く",
            arguments: {
              URL: { type: Scratch.ArgumentType.STRING, defaultValue: "https://example.com" },
            },
          },
          {
            opcode: "openHTML",
            blockType: Scratch.BlockType.COMMAND,
            text: "HTML [HTML] を開く",
            arguments: {
              HTML: { type: Scratch.ArgumentType.STRING, defaultValue: "<h1>Hello, World!</h1>" },
            },
          },
          {
            opcode: "show",
            blockType: Scratch.BlockType.COMMAND,
            text: "フレームを表示",
          },
          {
            opcode: "hide",
            blockType: Scratch.BlockType.COMMAND,
            text: "フレームを非表示",
          },
          {
            opcode: "close",
            blockType: Scratch.BlockType.COMMAND,
            text: "ページを閉じる",
          },
          {
            opcode: "setX",
            blockType: Scratch.BlockType.COMMAND,
            text: "X座標を [X] に設定",
            arguments: {
              X: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
            },
          },
          {
            opcode: "setY",
            blockType: Scratch.BlockType.COMMAND,
            text: "Y座標を [Y] に設定",
            arguments: {
              Y: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
            },
          },
          {
            opcode: "setWidth",
            blockType: Scratch.BlockType.COMMAND,
            text: "幅を [WIDTH] に設定",
            arguments: {
              WIDTH: { type: Scratch.ArgumentType.NUMBER, defaultValue: 480 },
            },
          },
          {
            opcode: "setHeight",
            blockType: Scratch.BlockType.COMMAND,
            text: "高さを [HEIGHT] に設定",
            arguments: {
              HEIGHT: { type: Scratch.ArgumentType.NUMBER, defaultValue: 360 },
            },
          },
          {
            opcode: "setInteractive",
            blockType: Scratch.BlockType.COMMAND,
            text: "インタラクティブを [INTERACTIVE] に設定",
            arguments: {
              INTERACTIVE: {
                type: Scratch.ArgumentType.STRING,
                menu: "booleanMenu",
                defaultValue: "true",
              },
            },
          },
          {
            opcode: "whenMessageReceived",
            blockType: Scratch.BlockType.HAT,
            text: "メッセージを受け取ったとき",
            isEdgeActivated: false,
          },
          {
            opcode: "receivedMessage",
            blockType: Scratch.BlockType.REPORTER,
            text: "受け取ったメッセージ",
          },
          {
            opcode: "sendMessage",
            blockType: Scratch.BlockType.COMMAND,
            text: "メッセージ [MESSAGE] を送信",
            arguments: {
              MESSAGE: { type: Scratch.ArgumentType.STRING, defaultValue: "" },
            },
          },
        ],
        menus: {
          booleanMenu: {
            acceptReporters: true,
            items: [
              { text: "true", value: "true" },
              { text: "false", value: "false" },
            ],
          },
        },
      };
    }

    async open({ URL }) {
      const url = String(URL || "").trim();
      if (!url) return;

      if (await this._canEmbed(url)) {
        this._removeIframe();

        const iframe = this._createIframe(url);
        document.body.appendChild(iframe);
        this.iframe = iframe;

        window.addEventListener("message", this._boundOnMessage);
        this._startAutoUpdate();
        this._updateFrame();
      }
    }

    async openHTML({ HTML }) {
      const html = String(HTML || "").trim();
      if (!html) return;

      const url = `data:text/html,${encodeURIComponent(html)}`;
      if (await this._canEmbed(url)) {
        this._removeIframe();

        const iframe = this._createIframe(url);
        document.body.appendChild(iframe);
        this.iframe = iframe;

        window.addEventListener("message", this._boundOnMessage);
        this._startAutoUpdate();
        this._updateFrame();
      }
    }

    show() {
      this.visible = true;
      this._updateFrame();
    }

    hide() {
      this.visible = false;
      this._updateFrame();
    }

    close() {
      this._removeIframe();
    }

    setX({ X }) {
      this.x = Scratch.Cast.toNumber(X);
      this._updateFrame();
    }

    setY({ Y }) {
      this.y = Scratch.Cast.toNumber(Y);
      this._updateFrame();
    }

    setWidth({ WIDTH }) {
      this.width = Scratch.Cast.toNumber(WIDTH);
      this._updateFrame();
    }

    setHeight({ HEIGHT }) {
      this.height = Scratch.Cast.toNumber(HEIGHT);
      this._updateFrame();
    }

    setInteractive({ INTERACTIVE }) {
      this.interactive = Scratch.Cast.toBoolean(INTERACTIVE);
      this._updateFrame();
    }

    sendMessage({ MESSAGE }) {
      const msg = String(MESSAGE || "");
      if (!this.iframe || !this.iframe.contentWindow) return;
      try {
        this.iframe.contentWindow.postMessage(msg, "*");
      } catch (e) {
        // ignore
      }
    }

    whenMessageReceived() {
      return true;
    }

    receivedMessage() {
      return this.lastMessage;
    }

    // --- Internal Utilities ---

    _createIframe(src) {
      const iframe = document.createElement("iframe");
      iframe.id = "nekoframe-iframe";
      iframe.src = src;

      iframe.setAttribute(
        "allow",
        [
          "accelerometer",
          "ambient-light-sensor",
          "autoplay",
          "camera",
          "clipboard-read",
          "clipboard-write",
          "display-capture",
          "encrypted-media",
          "fullscreen",
          "geolocation",
          "gyroscope",
          "magnetometer",
          "microphone",
          "midi",
          "payment",
          "picture-in-picture",
          "web-share",
        ].join("; ")
      );

      iframe.setAttribute("allowfullscreen", "");

      iframe.setAttribute(
        "sandbox",
        [
          "allow-downloads",
          "allow-forms",
          "allow-modals",
          "allow-orientation-lock",
          "allow-pointer-lock",
          "allow-popups",
          "allow-popups-to-escape-sandbox",
          "allow-presentation",
          "allow-same-origin",
          "allow-scripts",
          "allow-storage-access-by-user-activation",
          "allow-top-navigation",
          "allow-top-navigation-by-user-activation",
        ].join(" ")
      );

      iframe.style.position = "absolute";
      iframe.style.border = "0";

      return iframe;
    }

    _findStageCanvas() {
      const canvas = document.querySelector("canvas");
      return canvas || null;
    }

    _isElementVisible(element) {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        return false;
      }
      if (element.parentElement) {
        return this._isElementVisible(element.parentElement);
      }
      return true;
    }

    _getEffectiveZIndex(element) {
      let z = 0;
      while (element && element !== document.body) {
        const style = window.getComputedStyle(element);
        const zIndex = style.zIndex;
        if (zIndex !== "auto") {
          const num = parseInt(zIndex, 10);
          if (!isNaN(num)) {
            z += num;
          }
        }
        element = element.parentElement;
      }
      return z;
    }

    _updateFrame() {
      if (!this.iframe) return;
      const canvas = this._findStageCanvas();

      if (!canvas || !this.visible || !this._isElementVisible(canvas)) {
        this.iframe.style.display = "none";
        return;
      }

      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        this.iframe.style.display = "none";
        return;
      }

      this.iframe.style.display = "block";
      this.iframe.style.visibility = "visible";

      let w = this.width >= 0 ? this.width : rect.width;
      let h = this.height >= 0 ? this.height : rect.height;
      let left = rect.left + window.scrollX + this.x;
      let top = rect.top + window.scrollY - this.y;

      this.iframe.style.width = `${w}px`;
      this.iframe.style.height = `${h}px`;
      this.iframe.style.left = `${left}px`;
      this.iframe.style.top = `${top}px`;

      this.iframe.style.pointerEvents = this.interactive ? "auto" : "none";

      const effectiveZ = this._getEffectiveZIndex(canvas);
      this.iframe.style.zIndex = effectiveZ + 1;
    }

    _onMessage(e) {
      if (!this.iframe) return;
      if (e.source !== this.iframe.contentWindow) return;

      try {
        const data = e.data;
        this.lastMessage = typeof data === "string" ? data : JSON.stringify(data);
      } catch (err) {
        this.lastMessage = "[unserializable message]";
      }

      try {
        Scratch.vm.runtime.startHats("nekoframe_whenMessageReceived");
      } catch (err) {
        // ignore
      }
    }

    _removeIframe() {
      this._stopObservers();
      window.removeEventListener("message", this._boundOnMessage);
      window.removeEventListener("resize", this._boundUpdateFrame);
      window.removeEventListener("scroll", this._boundUpdateFrame);
      if (this.iframe && this.iframe.parentElement) {
        try {
          this.iframe.parentElement.removeChild(this.iframe);
        } catch (e) {}
      }
      this.iframe = null;
      this.lastMessage = "";
      this.x = 0;
      this.y = 0;
      this.width = -1;
      this.height = -1;
      this.visible = true;
      this.interactive = true;
    }

    _startAutoUpdate() {
      const canvas = this._findStageCanvas();
      if (!canvas) return;

      // ResizeObserver for size changes
      if (window.ResizeObserver) {
        try {
          this._resizeObserver = new ResizeObserver(() => this._updateFrame());
          this._resizeObserver.observe(canvas);
          if (canvas.parentElement) {
            this._resizeObserver.observe(canvas.parentElement);
          }
          this._resizeObserver.observe(document.body);
        } catch (e) {}
      }

      // MutationObserver for style and attribute changes
      if (window.MutationObserver) {
        try {
          this._mutationObserver = new MutationObserver(() => this._updateFrame());
          this._mutationObserver.observe(canvas, {
            attributes: true,
            attributeFilter: ["style", "class"],
            subtree: false,
          });
          if (canvas.parentElement) {
            this._mutationObserver.observe(canvas.parentElement, {
              attributes: true,
              attributeFilter: ["style", "class"],
              childList: true,
              subtree: true,
            });
          }
        } catch (e) {}
      }

      // IntersectionObserver for visibility changes
      if (window.IntersectionObserver) {
        try {
          this._intersectionObserver = new IntersectionObserver(
            (entries) => {
              entries.forEach(() => this._updateFrame());
            },
            { threshold: [0, 0.5, 1] }
          );
          this._intersectionObserver.observe(canvas);
        } catch (e) {}
      }

      // Additional event listeners for scroll and resize
      window.addEventListener("resize", this._boundUpdateFrame);
      window.addEventListener("scroll", this._boundUpdateFrame);
    }

    _stopObservers() {
      if (this._resizeObserver) {
        try {
          this._resizeObserver.disconnect();
        } catch (e) {}
        this._resizeObserver = null;
      }
      if (this._mutationObserver) {
        try {
          this._mutationObserver.disconnect();
        } catch (e) {}
        this._mutationObserver = null;
      }
      if (this._intersectionObserver) {
        try {
          this._intersectionObserver.disconnect();
        } catch (e) {}
        this._intersectionObserver = null;
      }
    }

    async _canEmbed(url) {
      if (typeof Scratch.canEmbed === "function") {
        return await Scratch.canEmbed(url);
      }
      return true; // Fallback if not available
    }
  }

  Scratch.extensions.register(new NekoFrame());
})(Scratch);