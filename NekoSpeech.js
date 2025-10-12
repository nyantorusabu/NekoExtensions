// Name: NekoSpeech
// ID: NekoSpeech
// Description: WebSpeechAPIを使用して音声認識を実装します。
// By: nyantorusabu
// License: MIT

(function(Scratch) {
  'use strict';
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  class NekoSpeech {
    constructor(runtime) {
      this.runtime = runtime || (Scratch.vm && Scratch.vm.runtime);
      this.active = false;
      this.speaking = false;
      this.text = '';
      this.interim = '';

      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'ja-JP';

        this.recognition.onresult = (e) => {
          const result = e.results[e.resultIndex];
          if (result.isFinal) {
            this.text += result[0].transcript;
            this.interim = '';
            if (this.speaking) {
              this.speaking = false;
              if (this.runtime && this.runtime.startHats) {
                this.runtime.startHats('nekospeech_whenDone', null);
              }
            }
          } else {
            this.interim = result[0].transcript;
            if (!this.speaking && this.interim.trim() !== '') {
              this.speaking = true;
              if (this.runtime && this.runtime.startHats) {
                this.runtime.startHats('nekospeech_whenStart', null);
              }
            }
          }
        };

        this.recognition.onend = () => {
          if (this.active) {
            try { this.recognition.start(); } catch(e) {}
          }
        };
      }
    }

    getInfo() {
      return {
        id: 'nekospeech',
        name: 'NekoSpeech',
        blocks: [
          {
            opcode: 'setRecognition',
            blockType: Scratch.BlockType.COMMAND,
            text: '音声認識を[MODE]にする',
            arguments: {
              MODE: {
                type: Scratch.ArgumentType.STRING,
                menu: 'modes',
                defaultValue: '有効'
              }
            }
          },
          { opcode: 'isActive', blockType: Scratch.BlockType.BOOLEAN, text: '音声認識が有効' },
          { opcode: 'getText', blockType: Scratch.BlockType.REPORTER, text: '認識したテキスト' },
          { opcode: 'getInterim', blockType: Scratch.BlockType.REPORTER, text: '未確定テキスト' },
          { opcode: 'clearText', blockType: Scratch.BlockType.COMMAND, text: 'テキストをクリア' },
          { opcode: 'whenStart', blockType: Scratch.BlockType.EVENT, text: '喋り始めたとき', isEdgeActivated: false },
          { opcode: 'whenDone', blockType: Scratch.BlockType.EVENT, text: '喋り終わったとき', isEdgeActivated: false },
          { opcode: 'isSpeaking', blockType: Scratch.BlockType.BOOLEAN, text: '喋っている' }
        ],
        menus: {
          modes: { items: ['有効', '無効'] }
        }
      };
    }

    setRecognition(args) {
      if (!SpeechRecognition) return;
      const mode = args.MODE;
      if (mode === '有効' && !this.active) {
        this.active = true;
        this.text = '';
        this.interim = '';
        try { this.recognition.start(); } catch(e) {}
      } else if (mode === '無効' && this.active) {
        this.active = false;
        try { this.recognition.stop(); } catch(e) {}
      }
    }

    isActive() { return this.active; }
    getText() { return this.text; }
    getInterim() { return this.interim; }
    clearText() { this.text = ''; this.interim = ''; }
    isSpeaking() { return this.speaking; }

    // イベントブロック用メソッド
    whenStart() { return true; }
    whenDone() { return true; }
  }

  Scratch.extensions.register(new NekoSpeech());
})(window.Scratch);