// Name: NekoFramePage
// ID: NekoFramePage
// Description: Communicate with NekoFrame via messages
// By: nyantorusabu

(function (Scratch) {
  "use strict";

  class NekoFramePage {
    constructor() {
      this.lastMessage = "";
      this._boundOnMessage = this._onMessage.bind(this);
      window.addEventListener("message", this._boundOnMessage);
    }

    getInfo() {
      return {
        id: "nekoframepage",
        name: "NekoFramePage",
        color1: "#4CAF50",
        color2: "#43A047",
        color3: "#388E3C",
        blocks: [
          {
            opcode: "whenMessageReceived",
            blockType: Scratch.BlockType.HAT,
            text: "親ページからメッセージを受け取ったとき",
            isEdgeActivated: false,
          },
          {
            opcode: "receivedMessage",
            blockType: Scratch.BlockType.REPORTER,
            text: "親ページから受け取ったメッセージ",
          },
          {
            opcode: "sendMessage",
            blockType: Scratch.BlockType.COMMAND,
            text: "親ページにメッセージ [MESSAGE] を送信",
            arguments: {
              MESSAGE: { type: Scratch.ArgumentType.STRING, defaultValue: "" },
            },
          },
        ],
      };
    }

    sendMessage({ MESSAGE }) {
      const msg = String(MESSAGE || "");
      try {
        window.parent.postMessage(msg, "*");
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

    _onMessage(e) {
      try {
        const data = e.data;
        this.lastMessage = typeof data === "string" ? data : JSON.stringify(data);
      } catch (err) {
        this.lastMessage = "[unserializable message]";
      }

      try {
        Scratch.vm.runtime.startHats("nekoframepage_whenMessageReceived");
      } catch (err) {
        // ignore
      }
    }
  }

  Scratch.extensions.register(new NekoFramePage());
})(Scratch);