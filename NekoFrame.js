// Name: NekoFrame
// ID: NekoFrame
// Description: Embed a page on the Stage
// By: nyantorusabu

(function (Scratch) {
  "use strict";

  class NekoFrame {
    constructor() {
      this.frames = new Map();
      this.lastMessage = "";
      this.lastSender = "";
      this._boundOnMessage = this._onMessage.bind(this);
      this._boundUpdateFrames = this._updateFrames.bind(this);
      this._resizeObserver = null;
      this._mutationObserver = null;
      this._intersectionObserver = null;
      this.observersStarted = false;
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
            text: "[ID] で [URL] を開く",
            arguments: {
              ID: { type: Scratch.ArgumentType.STRING, defaultValue: "default" },
              URL: { type: Scratch.ArgumentType.STRING, defaultValue: "https://example.com" },
            },
          },
          {
            opcode: "openHTML",
            blockType: Scratch.BlockType.COMMAND,
            text: "[ID] で HTML [HTML] を開く",
            arguments: {
              ID: { type: Scratch.ArgumentType.STRING, defaultValue: "default" },
              HTML: { type: Scratch.ArgumentType.STRING, defaultValue: "<h1>Hello, World!</h1>" },
            },
          },
          {
            opcode: "show",
            blockType: Scratch.BlockType.COMMAND,
            text: "[ID] を表示",
            arguments: {
              ID: { type: Scratch.ArgumentType.STRING, defaultValue: "default" },
            },
          },
          {
            opcode: "hide",
            blockType: Scratch.BlockType.COMMAND,
            text: "[ID] を非表示",
            arguments: {
              ID: { type: Scratch.ArgumentType.STRING, defaultValue: "default" },
            },
          },
          {
            opcode: "close",
            blockType: Scratch.BlockType.COMMAND,
            text: "[ID] を閉じる",
            arguments: {
              ID: { type: Scratch.ArgumentType.STRING, defaultValue: "default" },
            },
          },
          {
            opcode: "setX",
            blockType: Scratch.BlockType.COMMAND,
            text: "[ID] の X座標を [X] に設定",
            arguments: {
              ID: { type: Scratch.ArgumentType.STRING, defaultValue: "default" },
              X: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
            },
          },
          {
            opcode: "setY",
            blockType: Scratch.BlockType.COMMAND,
            text: "[ID] の Y座標を [Y] に設定",
            arguments: {
              ID: { type: Scratch.ArgumentType.STRING, defaultValue: "default" },
              Y: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
            },
          },
          {
            opcode: "setWidth",
            blockType: Scratch.BlockType.COMMAND,
            text: "[ID] の幅を [WIDTH] に設定",
            arguments: {
              ID: { type: Scratch.ArgumentType.STRING, defaultValue: "default" },
              WIDTH: { type: Scratch.ArgumentType.NUMBER, defaultValue: 480 },
            },
          },
          {
            opcode: "setHeight",
            blockType: Scratch.BlockType.COMMAND,
            text: "[ID] の高さを [HEIGHT] に設定",
            arguments: {
              ID: { type: Scratch.ArgumentType.STRING, defaultValue: "default" },
              HEIGHT: { type: Scratch.ArgumentType.NUMBER, defaultValue: 360 },
            },
          },
          {
            opcode: "setInteractive",
            blockType: Scratch.BlockType.COMMAND,
            text: "[ID] のインタラクティブを [INTERACTIVE] に設定",
            arguments: {
              ID: { type: Scratch.ArgumentType.STRING, defaultValue: "default" },
              INTERACTIVE: {
                type: Scratch.ArgumentType.STRING,
                menu: "booleanMenu",
                defaultValue: "true",
              },
            },
          },
          {
            opcode: "renameFrame",
            blockType: Scratch.BlockType.COMMAND,
            text: "フレーム [ID] を [NEW_ID] にリネーム",
            arguments: {
              ID: { type: Scratch.ArgumentType.STRING, defaultValue: "default" },
              NEW_ID: { type: Scratch.ArgumentType.STRING, defaultValue: "new" },
            },
          },
          {
            opcode: "allFrames",
            blockType: Scratch.BlockType.REPORTER,
            text: "すべてのフレーム",
          },
          "---",
          {
            opcode: "whenMessageReceived",
            blockType: Scratch.BlockType.HAT,
            text: "メッセージを受け取ったとき",
            isEdgeActivated: false,
          },
          {
            opcode: "messageSender",
            blockType: Scratch.BlockType.REPORTER,
            text: "メッセージの送信元",
          },
          {
            opcode: "receivedMessage",
            blockType: Scratch.BlockType.REPORTER,
            text: "受け取ったメッセージ",
          },
          {
            opcode: "sendMessage",
            blockType: Scratch.BlockType.COMMAND,
            text: "[ID] にメッセージ [MESSAGE] を送信",
            arguments: {
              ID: { type: Scratch.ArgumentType.STRING, defaultValue: "default" },
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

    async open({ ID, URL }) {
      const id = String(ID || "").trim();
      const url = String(URL || "").trim();
      if (!id || !url) return;

      if (await this._canEmbed(url)) {
        this._removeFrame(id);

        const iframe = this._createIframe(url, id);
        document.body.appendChild(iframe);

        const instance = {
          iframe,
          x: 0,
          y: 0,
          width: -1,
          height: -1,
          visible: true,
          interactive: true,
        };
        this.frames.set(id, instance);

        if (!this.observersStarted) {
          window.addEventListener("message", this._boundOnMessage);
          this._startAutoUpdate();
          this.observersStarted = true;
        }
        this._updateFrames();
      }
    }

    async openHTML({ ID, HTML }) {
      const id = String(ID || "").trim();
      const html = String(HTML || "").trim();
      if (!id || !html) return;

      const url = `data:text/html,${encodeURIComponent(html)}`;
      if (await this._canEmbed(url)) {
        this._removeFrame(id);

        const iframe = this._createIframe(url, id);
        document.body.appendChild(iframe);

        const instance = {
          iframe,
          x: 0,
          y: 0,
          width: -1,
          height: -1,
          visible: true,
          interactive: true,
        };
        this.frames.set(id, instance);

        if (!this.observersStarted) {
          window.addEventListener("message", this._boundOnMessage);
          this._startAutoUpdate();
          this.observersStarted = true;
        }
        this._updateFrames();
      }
    }

    show({ ID }) {
      const id = String(ID || "").trim();
      const instance = this.frames.get(id);
      if (instance) {
        instance.visible = true;
        this._updateFrames();
      }
    }

    hide({ ID }) {
      const id = String(ID || "").trim();
      const instance = this.frames.get(id);
      if (instance) {
        instance.visible = false;
        this._updateFrames();
      }
    }

    close({ ID }) {
      const id = String(ID || "").trim();
      this._removeFrame(id);
      if (this.frames.size === 0) {
        this._stopObservers();
        window.removeEventListener("message", this._boundOnMessage);
        this.observersStarted = false;
      }
    }

    setX({ ID, X }) {
      const id = String(ID || "").trim();
      const instance = this.frames.get(id);
      if (instance) {
        instance.x = Scratch.Cast.toNumber(X);
        this._updateFrames();
      }
    }

    setY({ ID, Y }) {
      const id = String(ID || "").trim();
      const instance = this.frames.get(id);
      if (instance) {
        instance.y = Scratch.Cast.toNumber(Y);
        this._updateFrames();
      }
    }

    setWidth({ ID, WIDTH }) {
      const id = String(ID || "").trim();
      const instance = this.frames.get(id);
      if (instance) {
        instance.width = Scratch.Cast.toNumber(WIDTH);
        this._updateFrames();
      }
    }

    setHeight({ ID, HEIGHT }) {
      const id = String(ID || "").trim();
      const instance = this.frames.get(id);
      if (instance) {
        instance.height = Scratch.Cast.toNumber(HEIGHT);
        this._updateFrames();
      }
    }

    setInteractive({ ID, INTERACTIVE }) {
      const id = String(ID || "").trim();
      const instance = this.frames.get(id);
      if (instance) {
        instance.interactive = Scratch.Cast.toBoolean(INTERACTIVE);
        this._updateFrames();
      }
    }

    renameFrame({ ID, NEW_ID }) {
      const id = String(ID || "").trim();
      const newId = String(NEW_ID || "").trim();
      if (!id || !newId || id === newId) return;
      if (this.frames.has(id) && !this.frames.has(newId)) {
        const instance = this.frames.get(id);
        this.frames.delete(id);
        this.frames.set(newId, instance);
        this._updateFrames();
      }
    }

    sendMessage({ ID, MESSAGE }) {
      const id = String(ID || "").trim();
      const msg = String(MESSAGE || "");
      const instance = this.frames.get(id);
      if (instance && instance.iframe && instance.iframe.contentWindow) {
        try {
          instance.iframe.contentWindow.postMessage(msg, "*");
        } catch (e) {
          // ignore
        }
      }
    }

    whenMessageReceived() {
      return true;
    }

    receivedMessage() {
      return this.lastMessage;
    }

    messageSender() {
      return this.lastSender;
    }

    allFrames() {
      return JSON.stringify(Array.from(this.frames.keys()));
    }

    // --- Internal Utilities ---

    _createIframe(src, id) {
      const iframe = document.createElement("iframe");
      iframe.id = `nekoframe-iframe-${id}`;
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
          "allow-presentation",
          "allow-scripts",
          "allow-storage-access-by-user-activation",
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

    _updateFrames() {
      const canvas = this._findStageCanvas();
      if (!canvas || !this._isElementVisible(canvas)) {
        for (const instance of this.frames.values()) {
          instance.iframe.style.display = "none";
        }
        return;
      }

      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        for (const instance of this.frames.values()) {
          instance.iframe.style.display = "none";
        }
        return;
      }

      const effectiveZ = this._getEffectiveZIndex(canvas);

      for (const instance of this.frames.values()) {
        if (!instance.visible) {
          instance.iframe.style.display = "none";
          continue;
        }

        instance.iframe.style.display = "block";
        instance.iframe.style.visibility = "visible";

        // width/height: if negative use the canvas size (default behavior)
        let w = instance.width >= 0 ? instance.width : rect.width;
        let h = instance.height >= 0 ? instance.height : rect.height;

        // Compute position centered on the stage's center (Scratch coordinate system)
        // CHANGED: center-based positioning so resizing remains centered
        const centerX = rect.left + window.scrollX + rect.width / 2;
        const centerY = rect.top + window.scrollY + rect.height / 2;

        // instance.x is Scratch-style X (right positive), instance.y is Scratch-style Y (up positive)
        // left/top position (top-left corner of iframe) should be:
        //   left = centerX + x - width/2
        //   top  = centerY - y - height/2
        const x = Number(instance.x) || 0;
        const y = Number(instance.y) || 0;
        const left = centerX + x - w / 2;
        const top = centerY - y - h / 2;

        instance.iframe.style.width = `${w}px`;
        instance.iframe.style.height = `${h}px`;
        instance.iframe.style.left = `${left}px`;
        instance.iframe.style.top = `${top}px`;

        instance.iframe.style.pointerEvents = instance.interactive ? "auto" : "none";
        instance.iframe.style.zIndex = effectiveZ + 1;
      }
    }

    _onMessage(e) {
      for (const [id, instance] of this.frames.entries()) {
        if (e.source === instance.iframe.contentWindow) {
          try {
            const data = e.data;
            this.lastMessage = typeof data === "string" ? data : JSON.stringify(data);
          } catch (err) {
            this.lastMessage = "[unserializable message]";
          }
          this.lastSender = id;

          try {
            Scratch.vm.runtime.startHats("nekoframe_whenMessageReceived");
          } catch (err) {
            // ignore
          }
          break;
        }
      }
    }

    _removeFrame(id) {
      const instance = this.frames.get(id);
      if (instance) {
        if (instance.iframe && instance.iframe.parentElement) {
          try {
            instance.iframe.parentElement.removeChild(instance.iframe);
          } catch (e) {}
        }
        this.frames.delete(id);
      }
      this._updateFrames();
    }

    _startAutoUpdate() {
      const canvas = this._findStageCanvas();
      if (!canvas) return;

      // ResizeObserver for size changes
      if (window.ResizeObserver) {
        try {
          this._resizeObserver = new ResizeObserver(() => this._updateFrames());
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
          this._mutationObserver = new MutationObserver(() => this._updateFrames());
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
              entries.forEach(() => this._updateFrames());
            },
            { threshold: [0, 0.5, 1] }
          );
          this._intersectionObserver.observe(canvas);
        } catch (e) {}
      }

      // Additional event listeners for scroll and resize
      window.addEventListener("resize", this._boundUpdateFrames);
      window.addEventListener("scroll", this._boundUpdateFrames);
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
      window.removeEventListener("resize", this._boundUpdateFrames);
      window.removeEventListener("scroll", this._boundUpdateFrames);
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
