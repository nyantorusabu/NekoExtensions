// Name: NekoTrackingFull
// ID: NekoTrackingFull
// Description: カメラを使用してローカルで顔のいろんなパーツをトラッキングします
// By: nyantorusabu
// License: MIT
(function(Scratch) {
  'use strict';

  const SCRATCH_WIDTH = 480;
  const SCRATCH_HEIGHT = 360;
  const NOT_ACTIVE_VALUE = "not_active";

  // --- Body parts (from NekoTrackingBody) ---
  const BODY_PARTS = {
    "鼻 (Nose Tip)": 0,
    "左肩 (Left Shoulder)": 11,
    "右肩 (Right Shoulder)": 12,
    "左肘 (Left Elbow)": 13,
    "右肘 (Right Elbow)": 14,
    "左手首 (Left Wrist)": 15,
    "右手首 (Right Wrist)": 16,
    "左股関節 (Left Hip)": 23,
    "右股関節 (Right Hip)": 24,
    "左膝 (Left Knee)": 25,
    "右膝 (Right Knee)": 26,
    "左足首 (Left Ankle)": 27,
    "右足首 (Right Ankle)": 28
  };

  // --- Face parts (from NekoTrackingFace) ---
  const FACE_PARTS = {
    '鼻 (Nose Tip)': 1, '口の中心 (Mouth Center)': 13, '左目 (Left Eye - Inner)': 133,
    '右目 (Right Eye - Inner)': 362, '左耳 (Left Ear)': 234, '右耳 (Right Ear)': 454, '顎 (Chin)': 152,
  };

  const MOUTH_LANDMARKS = { TOP: 13, BOTTOM: 14, LEFT: 61, RIGHT: 291 };
  const LEFT_EYE_LANDMARKS = [33, 160, 158, 133, 153, 144];
  const RIGHT_EYE_LANDMARKS = [362, 385, 387, 263, 373, 380];
  const DEFAULT_MOUTH_AR_MAX = 0.6, MOUTH_AR_MIN = 0.05;
  const DEFAULT_EYE_AR_MAX = 0.38, EYE_AR_MIN = 0.15;

  // --- Hand parts (from NekoTrackingHand) ---
  const HAND_PARTS = {
  "手首": 0,
  "親指_付け根": 1,
  "親指_第1関節": 2,
  "親指_先端": 3,
  "人差し指_付け根": 4,
  "人差し指_第1関節": 5,
  "人差し指_第2関節": 6,
  "人差し指_先端": 7,
  "中指_付け根": 8,
  "中指_第1関節": 9,
  "中指_第2関節": 10,
  "中指_先端": 11,
  "薬指_付け根": 12,
  "薬指_第1関節": 13,
  "薬指_第2関節": 14,
  "薬指_先端": 15,
  "小指_付け根": 16,
  "小指_第1関節": 17,
  "小指_第2関節": 18,
  "小指_先端": 19
  };

  class NekoTrackingFull {
    constructor(runtime) {
      this.runtime = runtime;

      // shared video element (single webcam)
      this.video = null;

      // mediapipe vision module + fileset resolver
      this.vision = null;
      this.filesetResolver = null;

      // model instances
      this.poseLandmarker = null;
      this.faceLandmarker = null;
      this.handLandmarker = null;

      // initialization flags
      this.isInitialized = false;

      // Per-subsystem state (preserve independent behavior)
      this.cameraFlippedBody = true;
      this.cameraFlippedFace = true;
      this.cameraFlippedHand = true;

      this.isBodyActive = false;
      this.isFaceActive = false;
      this.isHandActive = false;

      this.predictionRateBody = 30;
      this.predictionRateFace = 30;
      this.predictionRateHand = 30;
      this.autoFPSBody = false;
      this.autoFPSFace = false;
      this.autoFPSHand = false;

      this.trackingPrecisionBody = 2;
      this.trackingPrecisionFace = 2;
      this.trackingPrecisionHand = 2;

      this.mouthSensitivity = 1.0;
      this.leftEyeSensitivity = 1.0;
      this.rightEyeSensitivity = 1.0;

      this.lastPoseResult = null;
      this.lastFaceResult = null;
      this.lastHandResult = null;

      this._lastRunBody = 0;
      this._lastRunFace = 0;
      this._lastRunHand = 0;

      this._rafId = null;
      this._isLoopRunning = false;

      this.loadAndInit();
    }

    async loadAndInit() {
      try {
        if (!this.vision) {
          const visionModule = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js');
          this.vision = visionModule;
        }
        this.filesetResolver = await this.vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");

        // create models (use similar options as originals)
        await this._createPoseLandmarker();
        await this._createFaceLandmarker();
        await this._createHandLandmarker();

        await this._setupWebcam(); // single shared webcam
        this.isInitialized = true;
        this._startLoop();
        console.info("NekoTrackingFull initialized.");
      } catch (e) {
        console.error("NekoTrackingFull initialization error:", e);
      }
    }

    async _createPoseLandmarker() {
      try {
        const MODEL_URL = `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`;
        const options = {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.25,
          minPosePresenceConfidence: 0.2,
          minTrackingConfidence: 0.2
        };
        this.poseLandmarker = await this.vision.PoseLandmarker.createFromOptions(this.filesetResolver, options);
        if (typeof this.poseLandmarker.setOptions === 'function') {
          try {
            await this.poseLandmarker.setOptions({
              minPoseDetectionConfidence: 0.25,
              minPosePresenceConfidence: 0.2,
              minTrackingConfidence: 0.2
            });
          } catch (e) { /* ignore */ }
        }
      } catch (e) {
        console.warn("Failed to create poseLandmarker:", e);
      }
    }

    async _createFaceLandmarker() {
      try {
        this.faceLandmarker = await this.vision.FaceLandmarker.createFromOptions(this.filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numFaces: 1
        });
      } catch (e) {
        console.warn("Failed to create faceLandmarker:", e);
      }
    }

    async _createHandLandmarker() {
      try {
        this.handLandmarker = await this.vision.HandLandmarker.createFromOptions(this.filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });
      } catch (e) {
        console.warn("Failed to create handLandmarker:", e);
      }
    }

    async _setupWebcam() {
      // Determine constraints from the highest requested precision among subsystems
      const maxPrecision = Math.max(this.trackingPrecisionBody||2, this.trackingPrecisionFace||2, this.trackingPrecisionHand||2);
      let constraints = {};
      switch(maxPrecision) {
        case 1: constraints = { width: 320, height: 240 }; break;
        case 3: constraints = { width: 640, height: 480 }; break;
        case 4: constraints = {}; break;
        case 2:
        default: constraints = { width: 480, height: 360 }; break;
      }

      try {
        if (this.video && this.video.srcObject) {
          this.video.srcObject.getTracks().forEach(track => track.stop());
        }
        if (!this.video) {
          this.video = document.createElement("video");
          this.video.style.display = "none";
          this.video.setAttribute("playsinline", "");
          document.body.appendChild(this.video);
        }

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: constraints });
          this.video.srcObject = stream;
          await new Promise(resolve => { this.video.onloadedmetadata = () => { this.video.play(); resolve(); }; });
        } else {
          throw new Error("navigator.mediaDevices.getUserMedia is not available");
        }
      } catch (e) {
        console.error("setupWebcam error:", e);
      }
    }

    // --- Prediction loop: use rAF-driven loop and per-subsystem scheduling ---
    _startLoop() {
      if (this._isLoopRunning) return;
      this._isLoopRunning = true;
      const loop = async (ts) => {
        try {
          const now = performance.now();

          // Body
          if (this.poseLandmarker) {
            const periodBody = (this.autoFPSBody || this.predictionRateBody === 0) ? 0 : (1000 / Math.max(1, this.predictionRateBody));
            if (this.isBodyActive && this.video && this.video.videoWidth > 0 && this.video.videoHeight > 0) {
              if (periodBody === 0 || (now - this._lastRunBody) >= periodBody) {
                try {
                  const result = await this.poseLandmarker.detectForVideo(this.video, now);
                  this.lastPoseResult = result;
                } catch (e) {
                  console.error("pose detect error:", e);
                  this.lastPoseResult = null;
                }
                this._lastRunBody = now;
              }
            } else {
              this.lastPoseResult = null;
            }
          }

          // Face
          if (this.faceLandmarker) {
            const periodFace = (this.autoFPSFace || this.predictionRateFace === 0) ? 0 : (1000 / Math.max(1, this.predictionRateFace));
            if (this.isFaceActive && this.video && this.video.videoWidth > 0 && this.video.videoHeight > 0) {
              if (periodFace === 0 || (now - this._lastRunFace) >= periodFace) {
                try {
                  const result = await this.faceLandmarker.detectForVideo(this.video, now);
                  this.lastFaceResult = result;
                } catch (e) {
                  console.error("face detect error:", e);
                  this.lastFaceResult = null;
                }
                this._lastRunFace = now;
              }
            } else {
              this.lastFaceResult = null;
            }
          }

          // Hand
          if (this.handLandmarker) {
            const periodHand = (this.autoFPSHand || this.predictionRateHand === 0) ? 0 : (1000 / Math.max(1, this.predictionRateHand));
            if (this.isHandActive && this.video && this.video.videoWidth > 0 && this.video.videoHeight > 0) {
              if (periodHand === 0 || (now - this._lastRunHand) >= periodHand) {
                try {
                  const result = await this.handLandmarker.detectForVideo(this.video, now);
                  this.lastHandResult = result;
                } catch (e) {
                  console.error("hand detect error:", e);
                  this.lastHandResult = null;
                }
                this._lastRunHand = now;
              }
            } else {
              this.lastHandResult = null;
            }
          }

        } catch (e) {
          console.error("NekoTrackingFull loop error:", e);
        } finally {
          this._rafId = requestAnimationFrame(loop);
        }
      };
      this._rafId = requestAnimationFrame(loop);
    }

    _stopLoop() {
      if (this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
      this._isLoopRunning = false;
    }

    // --------------------------
    // Utility functions
    // --------------------------
    _getCoordinateSafeBody(landmark, axis) {
      if (!landmark) return NOT_ACTIVE_VALUE;
      const xVal = (landmark.x !== undefined) ? Number(landmark.x) : NaN;
      const yVal = (landmark.y !== undefined) ? Number(landmark.y) : NaN;
      if (!isFinite(xVal) || !isFinite(yVal)) return NOT_ACTIVE_VALUE;
      if (axis === 'y') return (0.5 - yVal) * SCRATCH_HEIGHT;
      if (axis === 'x') {
        const xf = this.cameraFlippedBody ? (1.0 - xVal) : xVal;
        return (xf - 0.5) * SCRATCH_WIDTH;
      }
      return NOT_ACTIVE_VALUE;
    }

    _extractPoseLandmarks(result) {
      if (!result) return null;
      if (Array.isArray(result.poseLandmarks) && result.poseLandmarks.length > 0) return result.poseLandmarks;
      if (Array.isArray(result.landmarks) && result.landmarks.length > 0) {
        if (result.landmarks.length >= 33 && typeof result.landmarks[0].x === 'number') return result.landmarks;
        if (Array.isArray(result.landmarks[0]) && result.landmarks[0].length >= 33) return result.landmarks[0];
      }
      if (Array.isArray(result)) {
        for (let i = 0; i < result.length; i++) {
          if (result[i] && Array.isArray(result[i].poseLandmarks) && result[i].poseLandmarks.length >= 33) return result[i].poseLandmarks;
          if (result[i] && Array.isArray(result[i].landmarks) && result[i].landmarks.length >= 33) {
            return (Array.isArray(result[i].landmarks[0]) ? result[i].landmarks[0] : result[i].landmarks);
          }
        }
      }
      if (result.pose_landmarks && Array.isArray(result.pose_landmarks) && result.pose_landmarks.length > 0) return result.pose_landmarks;
      return null;
    }

    _getCoordinate(landmark, axis, flipped) {
      if (!landmark) return 0;
      if (axis === 'y') return (0.5 - landmark.y) * SCRATCH_HEIGHT;
      if (axis === 'x') {
        const x = flipped ? (1.0 - landmark.x) : landmark.x;
        return (x - 0.5) * SCRATCH_WIDTH;
      }
      return 0;
    }

    // --------------------------
    // Scratch extension descriptor
    // --------------------------
    getInfo() {
      return {
        id: 'NekoTrackingFull',
        name: 'NekoTracking (Full)',
        color1: '#4A90E2',
        color2: '#4482CB',
        blocks: [
          // Body blocks
          { blockType: 'label', text: 'Body'},
          { opcode: 'body_setTrackingState', blockType: Scratch.BlockType.COMMAND, text: '体のトラッキングを[STATE]にする', arguments: { STATE: { type: Scratch.ArgumentType.STRING, menu: 'TRACKING_STATE_MENU', defaultValue: 'start' } } },
          { opcode: 'body_isTrackingActive', blockType: Scratch.BlockType.BOOLEAN, text: '体のトラッキングをしている' },
          '---',
          { opcode: 'body_setCameraFlip', blockType: Scratch.BlockType.COMMAND, text: 'カメラの反転を[STATE]にする', arguments: { STATE: { type: Scratch.ArgumentType.STRING, menu: 'FLIP_STATE_MENU', defaultValue: 'true' } } },
          { opcode: 'body_isCameraFlipped', blockType: Scratch.BlockType.BOOLEAN, text: 'カメラの反転 (体)' },
          '---',
          { opcode: 'body_setPredictionRate', blockType: Scratch.BlockType.COMMAND, text: 'トラッキングの処理レートを[RATE]にする', arguments: { RATE: { type: Scratch.ArgumentType.NUMBER, defaultValue: 30 } } },
          { opcode: 'body_getPredictionRate', blockType: Scratch.BlockType.REPORTER, text: '処理のレート (体)' },
          { opcode: 'body_setTrackingPrecision', blockType: Scratch.BlockType.COMMAND, text: 'トラッキングの精度を[PRECISION]にする', arguments: { PRECISION: { type: Scratch.ArgumentType.STRING, menu: 'PRECISION_MENU', defaultValue: '2' } } },
          { opcode: 'body_getTrackingPrecision', blockType: Scratch.BlockType.REPORTER, text: 'トラッキング精度 (体)' },
          '---',
          { opcode: 'getBodyPartPosition', blockType: Scratch.BlockType.REPORTER, text: '体のパーツ[PART]の[AXIS]座標', arguments: { PART: { type: Scratch.ArgumentType.STRING, menu: 'BODY_PART_MENU', defaultValue: '左手首 (Left Wrist)' }, AXIS: { type: Scratch.ArgumentType.STRING, menu: 'AXIS_MENU', defaultValue: 'x' } } },

          // Face blocks
          '---',
          { blockType: 'label', text: 'Face'},
          {
            opcode: 'face_setTrackingState', blockType: Scratch.BlockType.COMMAND,
            text: '顔のトラッキングを[STATE]にする',
            arguments: { STATE: { type: Scratch.ArgumentType.STRING, menu: 'TRACKING_STATE_MENU', defaultValue: 'start' } }
          },
          { opcode: 'face_isTrackingActive', blockType: Scratch.BlockType.BOOLEAN, text: '顔のトラッキングをしている' },
          '---',
          {
            opcode: 'face_setCameraFlip', blockType: Scratch.BlockType.COMMAND,
            text: 'カメラの反転を[STATE]にする',
            arguments: { STATE: { type: Scratch.ArgumentType.STRING, menu: 'FLIP_STATE_MENU', defaultValue: 'true' } }
          },
          { opcode: 'face_isCameraFlipped', blockType: Scratch.BlockType.BOOLEAN, text: 'カメラの反転 (顔)' },
          '---',
          {
            opcode: 'face_setPredictionRate', blockType: Scratch.BlockType.COMMAND,
            text: 'トラッキングの処理レートを[RATE]にする',
            arguments: { RATE: { type: Scratch.ArgumentType.NUMBER, defaultValue: 30 } }
          },
          { opcode: 'face_getPredictionRate', blockType: Scratch.BlockType.REPORTER, text: '処理のレート (顔)' },
          {
            opcode: 'face_setTrackingPrecision', blockType: Scratch.BlockType.COMMAND,
            text: 'トラッキングの精度を[PRECISION]にする',
            arguments: { PRECISION: { type: Scratch.ArgumentType.STRING, menu: 'PRECISION_MENU', defaultValue: '2' } }
          },
          { opcode: 'face_getTrackingPrecision', blockType: Scratch.BlockType.REPORTER, text: 'トラッキング精度 (顔)' },
          '---',
          {
            opcode: 'getFacePartPosition', blockType: Scratch.BlockType.REPORTER,
            text: '顔のパーツ[PART]の[AXIS]座標',
            arguments: { PART: { type: Scratch.ArgumentType.STRING, menu: 'FACE_PART_MENU', defaultValue: '鼻 (Nose Tip)' }, AXIS: { type: Scratch.ArgumentType.STRING, menu: 'AXIS_MENU', defaultValue: 'x' } }
          },
          { opcode: 'getMouthOpenness', blockType: Scratch.BlockType.REPORTER, text: '口の開き具合' },
          {
            opcode: 'getEyeOpenness', blockType: Scratch.BlockType.REPORTER,
            text: '[EYE]の開き具合',
            arguments: { EYE: { type: Scratch.ArgumentType.STRING, menu: 'EYE_MENU', defaultValue: 'right' } }
          },
          '---',
          {
            opcode: 'face_setSensitivity', blockType: Scratch.BlockType.COMMAND,
            text: '[PART]の感度を[SENSITIVITY]にする',
            arguments: { PART: { type: Scratch.ArgumentType.STRING, menu: 'SENSITIVITY_PART_MENU', defaultValue: '口' }, SENSITIVITY: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1.0 } }
          },
          {
            opcode: 'face_getSensitivity', blockType: Scratch.BlockType.REPORTER,
            text: '[PART]の感度',
            arguments: { PART: { type: Scratch.ArgumentType.STRING, menu: 'SENSITIVITY_PART_MENU', defaultValue: '口' } }
          },

          // Hand blocks
          '---',
          { blockType: 'label', text: 'Hand'},
          { opcode: 'hand_setTrackingState', blockType: Scratch.BlockType.COMMAND, text: '手のトラッキングを[STATE]にする', arguments: { STATE: { type: Scratch.ArgumentType.STRING, menu: 'TRACKING_STATE_MENU', defaultValue: 'start' } } },
          { opcode: 'hand_isTrackingActive', blockType: Scratch.BlockType.BOOLEAN, text: '手のトラッキングをしている' },
          '---',
          { opcode: 'hand_setCameraFlip', blockType: Scratch.BlockType.COMMAND, text: 'カメラの反転を[STATE]にする', arguments: { STATE: { type: Scratch.ArgumentType.STRING, menu: 'FLIP_STATE_MENU', defaultValue: 'true' } } },
          { opcode: 'hand_isCameraFlipped', blockType: Scratch.BlockType.BOOLEAN, text: 'カメラの反転 (手)' },
          '---',
          { opcode: 'hand_setPredictionRate', blockType: Scratch.BlockType.COMMAND, text: 'トラッキングの処理レートを[RATE]にする', arguments: { RATE: { type: Scratch.ArgumentType.NUMBER, defaultValue: 30 } } },
          { opcode: 'hand_getPredictionRate', blockType: Scratch.BlockType.REPORTER, text: '処理のレート (手)' },
          { opcode: 'hand_setTrackingPrecision', blockType: Scratch.BlockType.COMMAND, text: 'トラッキングの精度を[PRECISION]にする', arguments: { PRECISION: { type: Scratch.ArgumentType.STRING, menu: 'PRECISION_MENU', defaultValue: '2' } } },
          { opcode: 'hand_getTrackingPrecision', blockType: Scratch.BlockType.REPORTER, text: 'トラッキング精度 (手)' },
          '---',
          { opcode: 'getHandPartPosition', blockType: Scratch.BlockType.REPORTER, text: '[HAND]手のパーツ[PART]の[AXIS]座標', arguments: { HAND: { type: Scratch.ArgumentType.STRING, menu: 'HAND_SIDE_MENU', defaultValue: 'right' }, PART: { type: Scratch.ArgumentType.STRING, menu: 'HAND_PART_MENU', defaultValue: '親指_先端' }, AXIS: { type: Scratch.ArgumentType.STRING, menu: 'AXIS_MENU', defaultValue: 'x' } } },
        ],
        menus: {
          TRACKING_STATE_MENU: { acceptReporters: true, items: [{text: '開始', value: 'start'}, {text: '停止', value: 'stop'}] },
          FLIP_STATE_MENU: { acceptReporters: true, items: [{text: '有効', value: 'true'}, {text: '無効', value: 'false'}] },
          PRECISION_MENU: { acceptReporters: true, items: [{text: '最高', value: '4'}, {text: '高', value: '3'}, {text: '中', value: '2'}, {text: '低', value: '1'}] },
          AXIS_MENU: { acceptReporters: true, items: ['x', 'y'] },
          BODY_PART_MENU: { acceptReporters: true, items: Object.keys(BODY_PARTS).map(name => ({ text: name, value: name })) },
          FACE_PART_MENU: { acceptReporters: true, items: Object.keys(FACE_PARTS).map(name => ({ text: name, value: name })) },
          EYE_MENU: { acceptReporters: true, items: [{text: '右目', value: 'right'}, {text: '左目', value: 'left'}] },
          SENSITIVITY_PART_MENU: { acceptReporters: true, items: ['口', '右目', '左目'] },
          HAND_SIDE_MENU: { acceptReporters: true, items: [{text: '右', value: 'right'}, {text: '左', value: 'left'}] },
          HAND_PART_MENU: { acceptReporters: true, items: Object.keys(HAND_PARTS).map(name => ({ text: name, value: name })) }
        }
      };
    }

    // --------------------------
    // Body methods
    // --------------------------
    body_setTrackingState(args) { this.isBodyActive = (args.STATE === 'start'); }
    body_isTrackingActive() { return this.isBodyActive; }
    body_setCameraFlip(args) { this.cameraFlippedBody = (args.STATE === 'true'); }
    body_isCameraFlipped() { return this.cameraFlippedBody; }

    body_setPredictionRate(args) {
      const raw = Number(args.RATE);
      if (!isFinite(raw) || raw <= 0) { this.predictionRateBody = 0; this.autoFPSBody = true; }
      else { this.predictionRateBody = Math.max(0, Math.floor(raw)); this.autoFPSBody = false; }
    }
    body_getPredictionRate() { return this.predictionRateBody; }

    body_setTrackingPrecision(args) {
      const newPrecision = parseInt(args.PRECISION, 10);
      if (this.trackingPrecisionBody === newPrecision) return;
      this.trackingPrecisionBody = newPrecision;
      this._setupWebcam().catch(e => console.error("Failed to reset webcam", e));
    }
    body_getTrackingPrecision() { return this.trackingPrecisionBody; }

    getBodyPartPosition(args) {
      if (!this.isBodyActive || !this.lastPoseResult) return NOT_ACTIVE_VALUE;
      const landmarksList = this._extractPoseLandmarks(this.lastPoseResult);
      if (!Array.isArray(landmarksList) || landmarksList.length < 1) return NOT_ACTIVE_VALUE;
      const partName = args.PART;
      const partIndex = BODY_PARTS[partName];
      if (partIndex === undefined) return 0;
      const landmark = landmarksList[partIndex];
      const coord = this._getCoordinateSafeBody(landmark, args.AXIS);
      if (coord === NOT_ACTIVE_VALUE || !isFinite(coord)) return NOT_ACTIVE_VALUE;
      return coord;
    }

    // --------------------------
    // Face methods
    // --------------------------
    face_setTrackingState(args) { this.isFaceActive = (args.STATE === 'start'); }
    face_isTrackingActive() { return this.isFaceActive; }
    face_setCameraFlip(args) { this.cameraFlippedFace = (args.STATE === 'true'); }
    face_isCameraFlipped() { return this.cameraFlippedFace; }

    face_setPredictionRate(args) {
      const raw = Number(args.RATE);
      if (!isFinite(raw) || raw <= 0) { this.predictionRateFace = 0; this.autoFPSFace = true; }
      else { this.predictionRateFace = Math.max(0, Math.floor(raw)); this.autoFPSFace = false; }
    }
    face_getPredictionRate() { return this.predictionRateFace; }

    face_setTrackingPrecision(args) {
      const newPrecision = parseInt(args.PRECISION, 10);
      if (this.trackingPrecisionFace === newPrecision) return;
      this.trackingPrecisionFace = newPrecision;
      this._setupWebcam().catch(e => console.error("Failed to reset webcam", e));
    }
    face_getTrackingPrecision() { return this.trackingPrecisionFace; }

    _getFlippedFacePartName(partName) {
      if (!this.cameraFlippedFace) return partName;
      try {
        const jp = (partName.split(' ')[0] || partName.split('(')[0]).trim();
        let swapped = null;
        if (jp.startsWith('左')) swapped = jp.replace('左', '右');
        else if (jp.startsWith('右')) swapped = jp.replace('右', '左');
        if (swapped) {
          const keys = Object.keys(FACE_PARTS);
          const candidate = keys.find(k => (k.split(' ')[0] || k.split('(')[0]).trim() === swapped);
          if (candidate) return candidate;
        }
      } catch (e) { /* ignore */ }
      return partName;
    }

    getFacePartPosition(args) {
      if (!this.isFaceActive || !this.lastFaceResult?.faceLandmarks?.[0]) return NOT_ACTIVE_VALUE;
      const partName = this._getFlippedFacePartName(args.PART);
      const partIndex = FACE_PARTS[partName];
      const landmark = this.lastFaceResult.faceLandmarks[0][partIndex];
      return this._getCoordinate(landmark, args.AXIS, this.cameraFlippedFace);
    }

    getMouthOpenness() {
      if (!this.isFaceActive || !this.lastFaceResult?.faceLandmarks?.[0]) return NOT_ACTIVE_VALUE;
      const landmarks = this.lastFaceResult.faceLandmarks[0];
      const top = landmarks[MOUTH_LANDMARKS.TOP], bottom = landmarks[MOUTH_LANDMARKS.BOTTOM], left = landmarks[MOUTH_LANDMARKS.LEFT], right = landmarks[MOUTH_LANDMARKS.RIGHT];
      if (!top || !bottom || !left || !right) return 0;
      const vDist = Math.hypot(top.x - bottom.x, top.y - bottom.y), hDist = Math.hypot(left.x - right.x, left.y - right.y);
      if (hDist === 0) return 0;
      const ratio = vDist / hDist;
      const currentMax = DEFAULT_MOUTH_AR_MAX / Math.max(0.01, this.mouthSensitivity);
      let openness = (ratio - MOUTH_AR_MIN) / (currentMax - MOUTH_AR_MIN);
      return Math.max(0, Math.min(1, openness));
    }

    getEyeOpenness(args) {
      if (!this.isFaceActive || !this.lastFaceResult?.faceLandmarks?.[0]) return NOT_ACTIVE_VALUE;
      const eyeRequested = args.EYE;
      const eye = this.cameraFlippedFace ? (eyeRequested === 'left' ? 'right' : 'left') : eyeRequested;
      const landmarks = this.lastFaceResult.faceLandmarks[0];
      const eyeIndices = eye === 'left' ? LEFT_EYE_LANDMARKS : RIGHT_EYE_LANDMARKS;
      const sensitivity = eyeRequested === 'left' ? this.leftEyeSensitivity : this.rightEyeSensitivity;
      const dist = (pA, pB) => Math.hypot(pA.x - pB.x, pA.y - pB.y);
      try {
        const p = eyeIndices.map(i => landmarks[i]);
        if (p.some(point => !point)) return 0;
        const v1 = dist(p[1], p[5]), v2 = dist(p[2], p[4]), h = dist(p[0], p[3]);
        if (h === 0) return 0;
        const ear = (v1 + v2) / (2 * h);
        const currentMax = DEFAULT_EYE_AR_MAX / Math.max(0.01, sensitivity);
        let openness = (ear - EYE_AR_MIN) / (currentMax - EYE_AR_MIN);
        return Math.max(0, Math.min(1, openness));
      } catch { return 0; }
    }

    face_setSensitivity(args) {
      const sensitivity = Math.max(0, Math.min(2, Number(args.SENSITIVITY) || 0));
      switch (args.PART) { case '口': this.mouthSensitivity = sensitivity; break; case '左目': this.leftEyeSensitivity = sensitivity; break; case '右目': this.rightEyeSensitivity = sensitivity; break; }
    }
    face_getSensitivity(args) {
      switch (args.PART) { case '口': return this.mouthSensitivity; case '左目': return this.leftEyeSensitivity; case '右目': return this.rightEyeSensitivity; } return 0;
    }

    // --------------------------
    // Hand methods
    // --------------------------
    hand_setTrackingState(args) { this.isHandActive = (args.STATE === 'start'); }
    hand_isTrackingActive() { return this.isHandActive; }
    hand_setCameraFlip(args) { this.cameraFlippedHand = (args.STATE === 'true'); }
    hand_isCameraFlipped() { return this.cameraFlippedHand; }

    hand_setPredictionRate(args) {
      const raw = Number(args.RATE);
      if (!isFinite(raw) || raw <= 0) { this.predictionRateHand = 0; this.autoFPSHand = true; }
      else { this.predictionRateHand = Math.max(0, Math.floor(raw)); this.autoFPSHand = false; }
    }
    hand_getPredictionRate() { return this.predictionRateHand; }

    hand_setTrackingPrecision(args) {
      const newPrecision = parseInt(args.PRECISION, 10);
      if (this.trackingPrecisionHand === newPrecision) return;
      this.trackingPrecisionHand = newPrecision;
      this._setupWebcam().catch(e => console.error("Failed to reset webcam", e));
    }
    hand_getTrackingPrecision() { return this.trackingPrecisionHand; }

    _findHandIndexBySide(side) {
      if (!this.lastHandResult) return -1;

      const handednessList = this.lastHandResult.handedness || this.lastHandResult.handednesses || this.lastHandResult.multiHandedness || this.lastHandResult.handedness_list || [];
      const landmarksList = this.lastHandResult.handLandmarks || this.lastHandResult.hand_landmarks || this.lastHandResult.multiHandLandmarks || this.lastHandResult.landmarks || [];

      if (!Array.isArray(landmarksList) || landmarksList.length === 0) return -1;

      let requestedSide = side;
      if (this.cameraFlippedHand) {
        requestedSide = (String(side).toLowerCase() === 'left') ? 'right' : 'left';
      }
      const desired = (requestedSide === 'left') ? 'Left' : 'Right';

      for (let i = 0; i < Math.min(landmarksList.length, handednessList.length || 0); i++) {
        const h = handednessList[i] || {};
        const label = (h.label || h.labelName || h.categoryName || (h.score && h.label)) || null;
        if (!label) continue;
        if (String(label).toLowerCase().startsWith(desired.toLowerCase())) return i;
      }
      return 0;
    }

    getHandPartPosition(args) {
      if (!this.isHandActive || !this.lastHandResult) return NOT_ACTIVE_VALUE;

      const landmarksList = this.lastHandResult.handLandmarks || this.lastHandResult.hand_landmarks || this.lastHandResult.multiHandLandmarks || this.lastHandResult.landmarks || [];
      if (!Array.isArray(landmarksList) || landmarksList.length === 0) return NOT_ACTIVE_VALUE;

      const partName = args.PART;
      const partIndex = HAND_PARTS[partName];
      if (partIndex === undefined) return 0;

      const handIndex = this._findHandIndexBySide(args.HAND);
      if (handIndex < 0 || !landmarksList[handIndex]) return NOT_ACTIVE_VALUE;

      const landmark = landmarksList[handIndex][partIndex];
      return this._getCoordinate(landmark, args.AXIS, this.cameraFlippedHand);
    }

  }

  Scratch.extensions.register(new NekoTrackingFull());
})(Scratch);
