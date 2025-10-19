// Name: NekoRecorder
// ID: nekoRecorder
// Description: プロジェクトを簡単に録画します
// By: nyantorusabu

(function(Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error(' Video Recorder extension must be run unsandboxed');
  }

  const vm = Scratch.vm;
  const renderer = vm.renderer;
  const stageCanvas = renderer.canvas;

  class NekoRecorder {
    constructor() {
      this.mediaRecorder = null;
      this.recordedChunks = [];
      this.isRecording = false;
      this.isPaused = false;
      this.isMicrophoneEnabled = false;
      this.isProjectSoundEnabled = true;
      this.combinedStream = null;
      this.micStream = null;
      this.micSourceNode = null; // save mic source so we can disconnect later
      this.projectAudioDestinationNode = null;
      this.stopPromise = null;
      this._connectedInputNode = false; // flag to avoid double-disconnect

      this.captureWidth = vm.runtime.stageWidth;
      this.captureHeight = vm.runtime.stageHeight;
      this.captureX = 0; // Center X of capture area in Scratch coords
      this.captureY = 0; // Center Y of capture area in Scratch coords

      this.startTime = 0;
      this.pausedTime = 0;
      this.totalPausedDuration = 0;
      this.finalDuration = 0;

      this.recordingCanvas = document.createElement('canvas');
      this.recordingContext = this.recordingCanvas.getContext('2d');
      this.animationFrameId = null;

      this.lastBlob = null; // store last blob for export
      this.lastBlobUrl = null; // store last blob URL
      this.lastMime = 'video/webm';

      // 新規: 録画FPS設定
      // デフォルト: 30. 0 を指定すると TurboWarp（実行環境）のFPSに自動で合わせる。
      this.fps = 30;

      // Option: automatically revoke previous blob when creating a new one
      // We will revoke previous URLs on startRecording to ensure only last is kept.
    }

    getInfo() {
      return {
        id: 'nekoRecorder',
        name: 'NekoRecorder',
        color1: '#FF4D4D',
        color2: '#FF3333',
        color3: '#E60000',
        blocks: [
          { opcode: 'startRecording', blockType: Scratch.BlockType.COMMAND, text: '録画を開始' },
          { opcode: 'pauseOrResumeRecording', blockType: Scratch.BlockType.COMMAND, text: '録画を一時停止/再開' },
          { opcode: 'stopRecording', blockType: Scratch.BlockType.COMMAND, text: '録画を停止' },
          '---',
          { opcode: 'getIsRecording', blockType: Scratch.BlockType.BOOLEAN, text: '録画中' },
          { opcode: 'getIsPaused', blockType: Scratch.BlockType.BOOLEAN, text: '一時停止中' },
          { opcode: 'getRecordingLength', blockType: Scratch.BlockType.REPORTER, text: '録画時間' },
          '---',
          { opcode: 'setProjectSound', blockType: Scratch.BlockType.COMMAND, text: 'プロジェクト音声を記録する: [STATE]', arguments: { STATE: { type: Scratch.ArgumentType.STRING, menu: 'enabledDisabled', defaultValue: '有効' } } },
          { opcode: 'getIsProjectSoundEnabled', blockType: Scratch.BlockType.BOOLEAN, text: 'プロジェクト音声を記録している' },
          { opcode: 'setMicrophone', blockType: Scratch.BlockType.COMMAND, text: 'マイクを記録する: [STATE]', arguments: { STATE: { type: Scratch.ArgumentType.STRING, menu: 'enabledDisabled', defaultValue: '無効' } } },
          { opcode: 'getIsMicrophoneEnabled', blockType: Scratch.BlockType.BOOLEAN, text: 'マイクを記録している' },
          '---',
          { opcode: 'exportVideo', blockType: Scratch.BlockType.REPORTER, text: '録画を[TYPE]で書き出す', arguments: { TYPE: { type: Scratch.ArgumentType.STRING, menu: 'format', defaultValue: 'Blob URL' } } },
          { opcode: 'revokeExportUrl', blockType: Scratch.BlockType.COMMAND, text: '最後のURLを破棄する' },
          '---',
          { opcode: 'setCaptureSizeToStage', blockType: Scratch.BlockType.COMMAND, text: '録画サイズをステージに合わせる' },
          { opcode: 'setCaptureSize', blockType: Scratch.BlockType.COMMAND, text: '録画サイズを幅 [W] 、高さ[H] にする', arguments: { W: { type: Scratch.ArgumentType.NUMBER, defaultValue: 480 }, H: { type: Scratch.ArgumentType.NUMBER, defaultValue: 360 } } },
          { opcode: 'getCaptureDimension', blockType: Scratch.BlockType.REPORTER, text: '録画の[DIMENSION]', arguments: { DIMENSION: { type: Scratch.ArgumentType.STRING, menu: 'dimension', defaultValue: '幅' } } },
          { opcode: 'setCaptureOrigin', blockType: Scratch.BlockType.COMMAND, text: '録画のx座標を [X] 、y座標を [Y] にする', arguments: { X: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }, Y: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 } } },
          { opcode: 'getCaptureOrigin', blockType: Scratch.BlockType.REPORTER, text: '録画の [COORDINATE] 座標', arguments: { COORDINATE: { type: Scratch.ArgumentType.STRING, menu: 'coordinate', defaultValue: 'x' } } },

          // 新規: FPS を設定するブロック
          { opcode: 'setFPS', blockType: Scratch.BlockType.COMMAND, text: 'FPSを[NUM]にする', arguments: { NUM: { type: Scratch.ArgumentType.NUMBER, defaultValue: 30 } } }
        ],
        menus: {
          enabledDisabled: { acceptReporters: true, items: ['有効', '無効'] },
          dimension: { acceptReporters: true, items: ['幅', '高さ'] },
          coordinate: { acceptReporters: true, items: ['x', 'y'] },
          format: { acceptReporters: true, items: ['Blob URL', 'Data URL'] }
        }
      };
    }

    _drawLoop() {
      const stageWidth = vm.runtime.stageWidth, stageHeight = vm.runtime.stageHeight;
      const canvasWidth = stageCanvas.width, canvasHeight = stageCanvas.height;
      const scaleX = canvasWidth / stageWidth, scaleY = canvasHeight / stageHeight;
      const scratchX = this.captureX - this.captureWidth / 2, scratchY = this.captureY + this.captureHeight / 2;
      const sourceX = (scratchX + stageWidth / 2) * scaleX, sourceY = (-scratchY + stageHeight / 2) * scaleY;
      const sourceWidth = this.captureWidth * scaleX, sourceHeight = this.captureHeight * scaleY;
      this.recordingContext.drawImage(stageCanvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, this.captureWidth, this.captureHeight);
      this.animationFrameId = requestAnimationFrame(() => this._drawLoop());
    }

    // Try to detect the runtime's FPS (TurboWarp / Scratch VM may expose several properties)
    _detectRuntimeFPS() {
      try {
        if (!vm || !vm.runtime) return 30;
        const r = vm.runtime;
        const candidates = [
          r.currentFramerate,
          r.currentFrameRate,
          r.frameRate,
          r.targetFrameRate,
          r.targetFramerate,
          r.turboFps,
          r.turboFPS,
          r.msPerFrame ? Math.round(1000 / r.msPerFrame) : null
        ];
        for (const v of candidates) {
          if (typeof v === 'number' && isFinite(v) && v > 0) return Math.max(1, Math.round(v));
        }
      } catch (e) { /* ignore */ }
      return 30; // sensible default
    }

    async _setupStreams() {
      this.recordingCanvas.width = this.captureWidth; this.recordingCanvas.height = this.captureHeight;
      this._drawLoop();

      // Decide FPS to request from captureStream
      let fpsToUse;
      if (typeof this.fps === 'number' && this.fps === 0) {
        fpsToUse = this._detectRuntimeFPS();
      } else {
        fpsToUse = Math.max(1, Math.round(Number(this.fps) || 30));
      }

      const videoStream = this.recordingCanvas.captureStream(fpsToUse);
      const videoTracks = videoStream.getVideoTracks();
      if (videoTracks.length === 0) { console.error("Fatal: Could not create video stream."); return null; }

      const audioEngine = vm.runtime.audioEngine;
      const audioContext = audioEngine ? audioEngine.audioContext : null;
      let finalAudioTracks = [];

      // Create destination node only when we actually need to mix project audio or mic into the stream.
      if (audioContext && (this.isProjectSoundEnabled || this.isMicrophoneEnabled)) {
        if (audioContext.state === 'suspended') await audioContext.resume();
        this.projectAudioDestinationNode = audioContext.createMediaStreamDestination();

        // Mix project audio if enabled and inputNode exists
        if (this.isProjectSoundEnabled && audioEngine.inputNode) {
          try {
            audioEngine.inputNode.connect(this.projectAudioDestinationNode);
            this._connectedInputNode = true;
          } catch (err) {
            console.warn('Could not connect project audio inputNode:', err);
          }
        }

        // Mix microphone if enabled
        if (this.isMicrophoneEnabled) {
          try {
            this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const micSourceNode = audioContext.createMediaStreamSource(this.micStream);
            micSourceNode.connect(this.projectAudioDestinationNode);
            this.micSourceNode = micSourceNode;
          } catch (err) { console.error('Mic error:', err); }
        }

        finalAudioTracks = this.projectAudioDestinationNode.stream.getAudioTracks();
      } else if (!audioContext && this.isMicrophoneEnabled) {
        // Fallback to only mic if project audio is not available but mic is enabled
        try {
          this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          finalAudioTracks = this.micStream.getAudioTracks();
        } catch (err) { console.error('Mic error:', err); }
      } else {
        // No audio requested: finalAudioTracks remains empty and we only return video tracks
        finalAudioTracks = [];
      }

      // Combine video + audio tracks into one MediaStream
      const combined = new MediaStream();
      videoTracks.forEach(t => combined.addTrack(t));
      finalAudioTracks.forEach(t => combined.addTrack(t));
      this.combinedStream = combined;
      return this.combinedStream;
    }

    _cleanupStreams() {
      if (this.animationFrameId) { cancelAnimationFrame(this.animationFrameId); this.animationFrameId = null; }

      if (this.combinedStream) {
        try { this.combinedStream.getTracks().forEach(track => track.stop()); } catch (e) { /* ignore */ }
        this.combinedStream = null;
      }

      if (this.micStream) {
        try { this.micStream.getTracks().forEach(track => track.stop()); } catch (e) { /* ignore */ }
        this.micStream = null;
      }

      if (this.micSourceNode) {
        try { this.micSourceNode.disconnect(); } catch (e) { /* ignore */ }
        this.micSourceNode = null;
      }

      if (this.projectAudioDestinationNode) {
        try {
          if (this._connectedInputNode && vm.runtime.audioEngine && vm.runtime.audioEngine.inputNode) {
            try { vm.runtime.audioEngine.inputNode.disconnect(this.projectAudioDestinationNode); } catch (e) { /* ignore */ }
          }
        } catch (e) { /* ignore */ }
        this.projectAudioDestinationNode = null;
        this._connectedInputNode = false;
      }
    }

    async startRecording() {
      if (this.isRecording) return;

      // Revoke and clear any previous blob/url to ensure blob is overwritten each time
      if (this.lastBlobUrl) {
        try { URL.revokeObjectURL(this.lastBlobUrl); } catch (e) { /* ignore */ }
        this.lastBlobUrl = null;
      }
      this.lastBlob = null;

      this.finalDuration = 0; this.recordedChunks = [];
      this.combinedStream = await this._setupStreams();
      if (!this.combinedStream || this.combinedStream.getVideoTracks().length === 0) { console.error("Recording start failed: Could not create media stream."); this._cleanupStreams(); return; }

      // Choose best supported mime type
      let mime = 'video/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) mime = 'video/webm;codecs=vp9';
        else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) mime = 'video/webm;codecs=vp8';
        else if (MediaRecorder.isTypeSupported('video/webm')) mime = 'video/webm';
      }
      this.lastMime = mime;

      try {
        this.mediaRecorder = new MediaRecorder(this.combinedStream, { mimeType: mime });
      } catch (e) {
        // Fallback: try without mimeType
        try { this.mediaRecorder = new MediaRecorder(this.combinedStream); } catch (err) { console.error('MediaRecorder creation failed:', err); this._cleanupStreams(); return; }
      }

      this.stopPromise = new Promise(resolve => { this.mediaRecorder.onstop = () => { this._cleanupStreams(); resolve(); }; });
      this.mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) this.recordedChunks.push(e.data); };

      this.mediaRecorder.start();
      this.isRecording = true; this.isPaused = false;
      this.startTime = Date.now(); this.totalPausedDuration = 0;

      // Keep lastBlob until overwritten on next startRecording/stopRecording; we've already cleared it above.
    }

    pauseOrResumeRecording() {
      if (!this.isRecording || !this.mediaRecorder) return;
      if (this.isPaused) { try { this.mediaRecorder.resume(); } catch (e) { /* ignore */ } this.isPaused = false; this.totalPausedDuration += Date.now() - this.pausedTime; }
      else { try { this.mediaRecorder.pause(); } catch (e) { /* ignore */ } this.isPaused = true; this.pausedTime = Date.now(); }
    }

    async stopRecording() {
      if (!this.isRecording || !this.mediaRecorder || this.mediaRecorder.state === 'inactive') return;
      try { this.mediaRecorder.stop(); } catch (e) { /* ignore */ }
      await this.stopPromise;

      const stopTime = this.isPaused ? this.pausedTime : Date.now();
      this.finalDuration = Math.max(0, (stopTime - this.startTime - this.totalPausedDuration) / 1000);
      this.isRecording = false; this.isPaused = false;

      // Create blob and blob url for export (Blob URL is much lighter than DataURL and recommended)
      if (this.recordedChunks.length > 0) {
        try {
          // Revoke previous URL if exists to avoid leaking
          if (this.lastBlobUrl) { try { URL.revokeObjectURL(this.lastBlobUrl); } catch (e) { /* ignore */ } }

          const blob = new Blob(this.recordedChunks, { type: this.lastMime || 'video/webm' });
          this.lastBlob = blob;
          this.lastBlobUrl = URL.createObjectURL(blob);
        } catch (e) { console.error('Could not create blob/url:', e); }
      }
    }

    getIsRecording() { return this.isRecording; }
    getIsPaused() { return this.isPaused; }
    getIsMicrophoneEnabled() { return this.isMicrophoneEnabled; }
    getIsProjectSoundEnabled() { return this.isProjectSoundEnabled; }
    getRecordingLength() {
      if (this.finalDuration > 0) return this.finalDuration.toFixed(2);
      if (!this.isRecording) return 0;
      const currentTime = this.isPaused ? this.pausedTime : Date.now();
      return Math.max(0, (currentTime - this.startTime - this.totalPausedDuration) / 1000).toFixed(2);
    }

    setMicrophone({ STATE }) { this.isMicrophoneEnabled = STATE === '有効'; }
    setProjectSound({ STATE }) { this.isProjectSoundEnabled = STATE === '有効'; }

    // 新規: FPS を設定するブロック実装
    setFPS({ NUM }) {
      const n = Number(NUM);
      if (isNaN(n)) return;
      // allow 0 (auto) or positive integer
      this.fps = Math.max(0, Math.round(n));
    }

    setCaptureSizeToStage() { this.captureWidth = vm.runtime.stageWidth; this.captureHeight = vm.runtime.stageHeight; }
    setCaptureSize({ W, H }) { this.captureWidth = Math.max(1, W); this.captureHeight = Math.max(1, H); }
    getCaptureDimension({ DIMENSION }) { return DIMENSION === '幅' ? this.captureWidth : this.captureHeight; }
    setCaptureOrigin({ X, Y }) { this.captureX = X; this.captureY = Y; }
    getCaptureOrigin({ COORDINATE }) { return COORDINATE === 'x' ? this.captureX : this.captureY; }

    // Export: return either Blob URL (fast) or Data URL (base64). If Data URL requested, returns a Promise that resolves to the string.
    exportVideo({ TYPE }) {
      // Normalize TYPE values from menu
      const type = TYPE || 'Blob URL';

      if (this.isRecording) { console.warn('Please stop recording before exporting.'); return ''; }

      if (!this.recordedChunks || this.recordedChunks.length === 0) { console.warn('No recording data to export.'); return ''; }

      // Ensure lastBlob exists
      if (!this.lastBlob) {
        try {
          const blob = new Blob(this.recordedChunks, { type: this.lastMime || 'video/webm' });
          // Revoke previous URL if any
          if (this.lastBlobUrl) { try { URL.revokeObjectURL(this.lastBlobUrl); } catch (e) { /* ignore */ } }
          this.lastBlob = blob;
          this.lastBlobUrl = URL.createObjectURL(blob);
        } catch (e) {
          console.error('Could not create blob for export:', e);
          return '';
        }
      }

      if (type === 'Blob URL') {
        return this.lastBlobUrl || '';
      }

      // Data URL requested: return a Promise that resolves with data URL
      return new Promise((resolve) => {
        try {
          // FileReader is used for data URL conversion
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => { console.error('FileReader failed'); resolve(''); };
          reader.readAsDataURL(this.lastBlob);
        } catch (e) { console.error('Could not create data url:', e); resolve(''); }
      });
    }

    // Optional helper: allow user to revoke last blob url to free memory
    revokeExportUrl() {
      if (this.lastBlobUrl) {
        try { URL.revokeObjectURL(this.lastBlobUrl); } catch (e) { /* ignore */ }
        this.lastBlobUrl = null;
      }
      // Also clear lastBlob (so it can be recreated on next export)
      this.lastBlob = null;
    }
  }
  Scratch.extensions.register(new NekoRecorder());
})(Scratch);
