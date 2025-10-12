// Name: NeConnect
// ID: NeConnect
// Description: Create and manage host-based P2P connections for online games.
// By: nyantorusabu
// License: MIT

(function (Scratch) {
"use strict";

const menuIconURI =
"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGl0bGU+TmVDb25uZWN0IEljb248L3RpdGxlPjxnIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0iZXZlbm9kZCI+PHJlY3QgZmlsbD0iIzQ2QkZGRiIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIvPjxwYXRoIGQ9Ik0yMC4wMTEgMTBMMTAgMTUuNTEydjkuMDYybDEwLjAxMSA1LjQyNUwzMCAyNC41NzRWMTUuNTEyTDIwLjAxMSAxMHptMCAuOTM4bDguOTg5IDUuMDMxLjg2Ni40ODZ2Ny45NzFsLS44NjYuNDg2LTguOTg5IDUuMDMxLTEwLjAxMS01LjQyNS0uODQ4LS40Nzd2LTguMTMxbC44NDgtLjQ3N0wyMCAxMC45Mzh6TTIwIDI3LjY1bDgtNC4yNzV2LTEuMjQ3bC04IDQuNTY1djF6bS04LTUuNTIyVjE4LjJsOCA0LjU2N3YxLjI0N2wtOC00LjU2N3ptOC05LjM3NWwtOCA0LjU2N3YxLjI0N2w4LTQuNTY1di0xLjI0N3ptOCA0LjU2N3YxLjI0N2wtOCA0LjU2N3YtMS4yNDdsOC00LjU2N3oiIGZpbGw9IiNGRkYiLz48L2c+PC9zdmc+";
const blockIconURI = menuIconURI;

const loadPeerJS = () => {
if (window.Peer) return Promise.resolve();
return new Promise((resolve, reject) => {
const script = document.createElement("script");
script.src = "https://unpkg.com/peerjs/dist/peerjs.min.js";
script.onload = resolve;
script.onerror = reject;
document.body.appendChild(script);
});
};

const HEARTBEAT_INTERVAL = 1000; // 1 seconds
const HEARTBEAT_TIMEOUT = 10000; // 10 seconds

class NeConnect {
constructor() {
    this._reset();
    // 拡張機能の初期化時にライブラリ読み込みを開始し、そのPromiseを保存する
    this.peerJsPromise = loadPeerJS().catch(err => {
      console.error("Failed to load PeerJS library", err);
      // エラーを再スローして、awaitで捕捉できるようにする
      throw err;
    });
}

getInfo() {
return {
id: "NeConnect", name: "NeConnect", menuIconURI: menuIconURI, blockIconURI: blockIconURI, color1: "#46BFFF", color2: "#2A99FF", color3: "#1A88FF",
blocks: [
{ opcode: "createRoom", blockType: Scratch.BlockType.COMMAND, text: "部屋 [ROOM] をホスト [USER] として作る", arguments: { ROOM: { type: Scratch.ArgumentType.STRING, defaultValue: "my-room" }, USER: { type: Scratch.ArgumentType.STRING, defaultValue: "host" } } },
{ opcode: "joinRoom", blockType: Scratch.BlockType.COMMAND, text: "部屋 [ROOM] に [USER] として参加する", arguments: { ROOM: { type: Scratch.ArgumentType.STRING, defaultValue: "my-room" }, USER: { type: Scratch.ArgumentType.STRING, defaultValue: "client" } } },
{ opcode: "connectToRoom", blockType: Scratch.BlockType.COMMAND, text: "部屋 [ROOM] に [USER] として接続する", arguments: { ROOM: { type: Scratch.ArgumentType.STRING, defaultValue: "my-room" }, USER: { type: Scratch.ArgumentType.STRING, defaultValue: "user" } } },
{ opcode: "leaveRoom", blockType: Scratch.BlockType.COMMAND, text: "部屋から退出する" },
{ opcode: "kickUser", blockType: Scratch.BlockType.COMMAND, text: "[USER] をキックする (ホストのみ)", arguments: { USER: { type: Scratch.ArgumentType.STRING, menu: "usersMenu" } } },
"---",
{ opcode: "isRoomConnected", blockType: Scratch.BlockType.BOOLEAN, text: "接続されている" },
{ opcode: "_isHost", blockType: Scratch.BlockType.BOOLEAN, text: "ホスト" },
{ opcode: "getRoomName", blockType: Scratch.BlockType.REPORTER, text: "現在のルームID" },
{ opcode: "getUsers", blockType: Scratch.BlockType.REPORTER, text: "接続中のユーザーリスト" },
{ opcode: "getHostName", blockType: Scratch.BlockType.REPORTER, text: "ホストのユーザー名" },
{ opcode: "getUserName", blockType: Scratch.BlockType.REPORTER, text: "自分のユーザー名" },
"---",
{ opcode: "sendDataAll", blockType: Scratch.BlockType.COMMAND, text: "[DATA] を全員に送信する", arguments: { DATA: { type: Scratch.ArgumentType.STRING, defaultValue: "hello" } } },
{ opcode: "sendDataTo", blockType: Scratch.BlockType.COMMAND, text: "[DATA] を [USER] に送信する", arguments: { DATA: { type: Scratch.ArgumentType.STRING, defaultValue: "hello" }, USER: { type: Scratch.ArgumentType.STRING, menu: "usersMenu" } } },
{ opcode: "whenDataReceived", blockType: Scratch.BlockType.HAT, text: "データを受信したとき", isEdgeActivated: false },
{ opcode: "getSender", blockType: Scratch.BlockType.REPORTER, text: "送信元のユーザー名" },
{ opcode: "getReceivedData", blockType: Scratch.BlockType.REPORTER, text: "受信したデータ" },
"---",
{ opcode: "setDataProcessingMode", blockType: Scratch.BlockType.COMMAND, text: "データの処理方式を [MODE] にする", arguments: { MODE: { type: Scratch.ArgumentType.STRING, menu: "dataModeMenu", defaultValue: "Set" } } },
{ opcode: "getDataProcessingMode", blockType: Scratch.BlockType.REPORTER, text: "現在の処理方式" },
{ opcode: "nextData", blockType: Scratch.BlockType.COMMAND, text: "次のデータ" },
{ opcode: "getStoredDataCount", blockType: Scratch.BlockType.REPORTER, text: "保持しているデータの数" },
"---",
{ opcode: "whenUserJoined", blockType: Scratch.BlockType.HAT, text: "ユーザーが参加したとき", isEdgeActivated: false },
{ opcode: "getJoinedUser", blockType: Scratch.BlockType.REPORTER, text: "参加したユーザー名" },
{ opcode: "whenUserLeft", blockType: Scratch.BlockType.HAT, text: "ユーザーが退出したとき", isEdgeActivated: false },
{ opcode: "getLeftUser", blockType: Scratch.BlockType.REPORTER, text: "退出したユーザー名" },
{ opcode: "whenDisconnected", blockType: Scratch.BlockType.HAT, text: "接続が終了したとき", isEdgeActivated: false },
{ opcode: "getDisconnectionReason", blockType: Scratch.BlockType.REPORTER, text: "接続終了の理由" },
"---",
{ opcode: "joinVoiceChat", blockType: Scratch.BlockType.COMMAND, text: "ボイスチャットに参加" },
{ opcode: "leaveVoiceChat", blockType: Scratch.BlockType.COMMAND, text: "ボイスチャットから退出" },
{ opcode: "setMute", blockType: Scratch.BlockType.COMMAND, text: "[MUTE] にする", arguments: { MUTE: { type: Scratch.ArgumentType.STRING, menu: "muteMenu" } } },
{ opcode: "setVolume", blockType: Scratch.BlockType.COMMAND, text: "[USER] の音量を [VOLUME] にする", arguments: { USER: { type: Scratch.ArgumentType.STRING, menu: "vcUsersMenu" }, VOLUME: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 } } },
{ opcode: "isInVoiceChat", blockType: Scratch.BlockType.BOOLEAN, text: "ボイスチャットに参加している" },
{ opcode: "isMuted", blockType: Scratch.BlockType.BOOLEAN, text: "ミュートしている" },
],
menus: {
usersMenu: { acceptReporters: true, items: "_getUsersMenu" },
vcUsersMenu: { acceptReporters: true, items: "_getUsersMenuWithAll" },
muteMenu: {
acceptReporters: true,
items: [
{ text: "ミュート", value: "true" },
{ text: "ミュート解除", value: "false" }
]
},
dataModeMenu: {
acceptReporters: true,
items: [
{ text: "Set", value: "Set" },
{ text: "Add", value: "Add" }
]
}
},
};
}

_sdbm(str) {
let hash = 0;
for (let i = 0; i < str.length; i++) {
hash = str.charCodeAt(i) + (hash << 6) + (hash << 16) - hash;
}
return "neconnect-" + (hash >>> 0).toString(16);
}

_reset(reason = '') {
if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
if (this.hostHeartbeatTimeout) clearTimeout(this.hostHeartbeatTimeout);
if (this.clientHeartbeatTimers) {
this.clientHeartbeatTimers.forEach(timeout => clearTimeout(timeout));
}

this.leaveVoiceChat();
this.isExiting = true;
if (this.peer) {
this.peer.destroy();
}
this.peer = null;
this.roomName = null;
this.userName = null;
this.isHost = false;
this.connections = new Map();
this.users = [];
this.hostName = "";
this.dataQueue = [];
this.dataProcessingMode = 'Set';
this.isNewDataAvailable = false;
this.isConnected = false;
this.lastJoinedUser = '';
this.didUserJoin = false;
this.lastLeftUser = '';
this.didUserLeave = false;
this._isMuted = false;
this.heartbeatInterval = null;
this.hostHeartbeatTimeout = null;
this.clientHeartbeatTimers = new Map();

if (reason) {
this.disconnectionReason = reason;
this.wasDisconnected = true;
setTimeout(() => Scratch.vm.runtime.startHats("NeConnect_whenDisconnected"), 50);
} else {
this.disconnectionReason = '';
this.wasDisconnected = false;
}
}

_initializePeer(id) {
return new Promise((resolve, reject) => {
this.peer = new window.Peer(id, { /*debug: 2*/ });
this.peer.once('open', resolve);
this.peer.once('error', reject);
this.peer.on('disconnected', () => {
if (!this.isExiting) {
console.log('Reconnecting...');
this.peer.reconnect();
}
});
});
}

// --- Room Management ---
async createRoom({ ROOM, USER }) {
    // ライブラリの読み込みが完了するまで待機
    try {
        await this.peerJsPromise;
    } catch {
        this._reset("ライブラリの読み込みに失敗しました");
        return;
    }
    // 既に接続中の場合は何もしない
    if (this.peer) return;

    this._reset();
    this.isExiting = false;
    this.isHost = true;
    this.roomName = ROOM;
    this.userName = USER;
    this.hostName = USER;
    this.users = [USER];
    const peerId = this._sdbm(this.roomName);
    try {
        await this._initializePeer(peerId);
        console.log(`Host is ready. PeerID: ${peerId}`);
        this.isConnected = true;
        this._setupGlobalHandlers();
    } catch (err) {
        if (err.type === 'unavailable-id') {
            this._reset(`ユーザー名が既に使用されています`);
        } else {
            this._reset(`サーバーへの接続に失敗: ${err.type}`);
        }
    }
}
async joinRoom({ ROOM, USER }) {
    // ライブラリの読み込みが完了するまで待機
    try {
        await this.peerJsPromise;
    } catch {
        this._reset("ライブラリの読み込みに失敗しました");
        return;
    }
    // 既に接続中の場合は何もしない
    if (this.peer) return;

    this._reset();
    this.isExiting = false;
    this.isHost = false;
    this.roomName = ROOM;
    this.userName = USER;
    const peerId = this._sdbm(`${this.roomName}_${this.userName}`);
    try {
        await this._initializePeer(peerId);
    } catch (err) {
        this._reset(`サーバーへの接続に失敗: ${err.type}`);
        return;
    }

    return new Promise(resolve => {
        const hostPeerId = this._sdbm(this.roomName);
        const conn = this.peer.connect(hostPeerId, { metadata: { userName: this.userName }, reliable: true });

        let connectionTimeout, onOpen, onError, onPeerError;

        const cleanup = () => {
            clearTimeout(connectionTimeout);
            conn.off('open', onOpen);
            conn.off('error', onError);
            if (this.peer) {
                this.peer.off('error', onPeerError);
            }
        };

        connectionTimeout = setTimeout(() => {
            cleanup();
            this._reset('接続がタイムアウトしました');
            resolve();
        }, 10000);

        onOpen = () => {
            cleanup();
            this._setupGlobalHandlers();
            this._addConnectionEventHandlers(conn);
            this.connections.set(this.roomName, conn);
            this.isConnected = true;

            this._startHostHeartbeatCheck();
            this.heartbeatInterval = setInterval(() => {
                if (conn.open) {
                    conn.send({ type: 'system', sub: 'heartbeat' });
                } else {
                    clearInterval(this.heartbeatInterval);
                }
            }, HEARTBEAT_INTERVAL);

            console.log(`Successfully connected to host. My PeerID: ${peerId}`);
            resolve();
        };

        onError = (err) => {
            cleanup();
            console.error("Connection error:", err);
            this._reset(`ホストへの接続に失敗しました`);
            resolve();
        };

        onPeerError = (err) => {
            if (err.type === 'peer-unavailable') {
                cleanup();
                this._reset(`ルーム「${ROOM}」が見つかりませんでした`);
                resolve();
            }
        };

        conn.once('open', onOpen);
        conn.once('error', onError);
        this.peer.once('error', onPeerError);
    });
}

async connectToRoom({ ROOM, USER }) {
    // ライブラリの読み込みが完了するまで待機
    try {
        await this.peerJsPromise;
    } catch {
        this._reset("ライブラリの読み込みに失敗しました");
        return;
    }
    // 既に接続中の場合は何もしない
    if (this.peer) return;

    this._reset();
    this.isExiting = false;
    this.roomName = ROOM;
    this.userName = USER;
    // まずクライアントとして接続を試みるためのPeer IDを作成
    const peerId = this._sdbm(`${this.roomName}_${this.userName}`);
    try {
        await this._initializePeer(peerId);
    } catch (err) {
        this._reset(`サーバーへの接続に失敗: ${err.type}`);
        return;
    }

    return new Promise(resolve => {
        const hostPeerId = this._sdbm(this.roomName);
        const conn = this.peer.connect(hostPeerId, { metadata: { userName: this.userName }, reliable: true });

        let connectionTimeout, onOpen, onError, onPeerError;

        const cleanup = () => {
            clearTimeout(connectionTimeout);
            conn.off('open', onOpen);
            conn.off('error', onError);
            if (this.peer) {
                this.peer.off('error', onPeerError);
            }
        };

        // 接続に失敗した場合に、自分がホストとして部屋を作成する処理
        const createNewRoom = () => {
            console.log(`Room '${ROOM}' not found or timed out. Creating it.`);
            // クライアント用のPeerを破棄
            if (this.peer) {
                this.isExiting = true;
                this.peer.destroy();
                this.isExiting = false;
            }
            this.peer = null;
            // ホストとして部屋を作成
            this.createRoom({ ROOM, USER }).then(resolve);
        };

        connectionTimeout = setTimeout(() => {
            cleanup();
            createNewRoom();
        }, 10000); // 10秒でタイムアウト

        onOpen = () => {
            // 接続成功。クライアントとして参加
            cleanup();
            this.isHost = false; // クライアントであることを明示
            this._setupGlobalHandlers();
            this._addConnectionEventHandlers(conn);
            this.connections.set(this.roomName, conn);
            this.isConnected = true;
            this._startHostHeartbeatCheck();
            this.heartbeatInterval = setInterval(() => {
                if (conn.open) {
                    conn.send({ type: 'system', sub: 'heartbeat' });
                } else {
                    clearInterval(this.heartbeatInterval);
                }
            }, HEARTBEAT_INTERVAL);
            console.log(`Successfully connected to host. My PeerID: ${peerId}`);
            resolve();
        };

        onError = (err) => {
            console.error("Connection error:", err);
            // peer-unavailableエラーはonPeerErrorで処理されるので、ここでは何もしない
        };

        onPeerError = (err) => {
            if (err.type === 'peer-unavailable') {
                cleanup();
                createNewRoom();
            }
        };

        conn.once('open', onOpen);
        conn.once('error', onError);
        this.peer.once('error', onPeerError);
    });
}

leaveRoom() {
this._reset("部屋から退出しました");
}

kickUser({ USER }) {
if (!this.isHost || !USER) return;
const conn = this.connections.get(USER);
if (conn) {
conn.send({ type: 'system', sub: 'kicked' });
setTimeout(() => conn.close(), 200);
}
}

// --- Connection Handlers ---
_startHostHeartbeatCheck() {
    if (this.isHost || this.isExiting) return;
    clearTimeout(this.hostHeartbeatTimeout);
    this.hostHeartbeatTimeout = setTimeout(() => {
        if (!this.isExiting) {
            this._reset("ホストからの応答がありませんでした");
        }
    }, HEARTBEAT_TIMEOUT);
}

_setupGlobalHandlers() {
this.peer.on('connection', (conn) => {
if (this.isHost) {
this._addConnectionEventHandlers(conn);
} else {
conn.close();
}
});
this.peer.on('call', (call) => {
if (this.localStream) {
call.answer(this.localStream);
this._handleCall(call);
} else {
console.log("Received a call but not in voice chat. Rejecting.");
}
});
}
_addConnectionEventHandlers(conn) {
conn.on('open', () => {
const remoteUserName = conn.metadata.userName;
if (this.isHost) {
    this.connections.set(remoteUserName, conn);
    this.users.push(remoteUserName);
    this._resetClientHeartbeat(remoteUserName);
    conn.send({ type: 'system', sub: 'initial-state', payload: { users: this.users, host: this.hostName } });
    this._broadcastData({ type: 'system', sub: 'user-joined', payload: { userName: remoteUserName } }, [remoteUserName]);
    this.lastJoinedUser = remoteUserName;
    this.didUserJoin = true;
    Scratch.vm.runtime.startHats("NeConnect_whenUserJoined");
}
});

conn.on('data', (data) => this._handleData(conn.metadata.userName || this.hostName, data));
if (this.isHost) {
conn.on('close', () => this._removeUser(conn.metadata.userName, '接続が切れました'));
conn.on('error', () => this._removeUser(conn.metadata.userName, 'エラーが発生しました'));
} else {
conn.on('close', () => { if (!this.isExiting) this._reset("ホストがルームを解散しました"); });
conn.on('error', () => { if (!this.isExiting) this._reset("ホストとの接続が切断されました"); });
}
}

_resetClientHeartbeat(userName) {
    if (this.clientHeartbeatTimers.has(userName)) {
        clearTimeout(this.clientHeartbeatTimers.get(userName));
    }
    const timeout = setTimeout(() => {
        console.log(`Heartbeat timeout for ${userName}. Removing user.`);
        this._removeUser(userName, '応答がありませんでした');
    }, HEARTBEAT_TIMEOUT);
    this.clientHeartbeatTimers.set(userName, timeout);
}

_removeUser(userName, reason = '') {
if (!userName || !this.connections.has(userName)) return;

if (this.clientHeartbeatTimers.has(userName)) {
    clearTimeout(this.clientHeartbeatTimers.get(userName));
    this.clientHeartbeatTimers.delete(userName);
}

this.connections.delete(userName);
this.users = this.users.filter(u => u !== userName);
if (this.voiceConnections && this.voiceConnections.has(userName)) {
this.voiceConnections.get(userName).close();
this.voiceConnections.delete(userName);
}
if (this.audioElements && this.audioElements.has(userName)) {
this.audioElements.get(userName).remove();
this.audioElements.delete(userName);
}
if (this.isHost) {
this._broadcastData({ type: 'system', sub: 'user-left', payload: { userName: userName } });
this.lastLeftUser = userName;
this.didUserLeave = true;
Scratch.vm.runtime.startHats("NeConnect_whenUserLeft");
}
}

// --- Data Transmission ---
_handleData(senderName, data) {
if (typeof data !== 'object' || !data.type) return;

const processReceivedUserData = (from, content) => {
    const newData = { sender: from, content: content };
    if (this.dataProcessingMode === 'Set') {
        this.dataQueue = [newData];
    } else { // 'Add' mode
        this.dataQueue.push(newData);
    }
    this.isNewDataAvailable = true;
    Scratch.vm.runtime.startHats("NeConnect_whenDataReceived");
};

if (data.type === 'system') {
switch (data.sub) {
case 'initial-state':
this.users = data.payload.users;
this.hostName = data.payload.host;
break;
case 'user-joined':
const joinedUserName = data.payload.userName;
if (!this.users.includes(joinedUserName)) {
this.users.push(joinedUserName);
this.lastJoinedUser = joinedUserName;
this.didUserJoin = true;
Scratch.vm.runtime.startHats("NeConnect_whenUserJoined");
if (this.localStream) {
this._callUser(joinedUserName);
}
}
break;
case 'user-left':
const leftUserName = data.payload.userName;
this.users = this.users.filter(u => u !== leftUserName);
this.lastLeftUser = leftUserName;
this.didUserLeave = true;
Scratch.vm.runtime.startHats("NeConnect_whenUserLeft");
break;
case 'kicked':
this._reset("ホストによってキックされました");
break;
case 'heartbeat':
    if (this.isHost) {
        this._resetClientHeartbeat(senderName);
        const conn = this.connections.get(senderName);
        if (conn && conn.open) {
            conn.send({ type: 'system', sub: 'heartbeat-ack' });
        }
    }
    break;
case 'heartbeat-ack':
    if (!this.isHost) {
        this._startHostHeartbeatCheck();
    }
    break;
}
} else if (data.type === 'relay' && this.isHost) {
const message = { type: 'user-data', from: senderName, payload: data.payload };
if (data.to === 'all') {
this._broadcastData(message, [senderName]);
processReceivedUserData(senderName, data.payload);
} else if (data.to === this.userName) {
processReceivedUserData(senderName, data.payload);
} else {
const targetConn = this.connections.get(data.to);
if (targetConn) targetConn.send(message);
}
} else if (data.type === 'user-data') {
processReceivedUserData(data.from, data.payload);
}
}

_broadcastData(data, excludeUsers = []) {
this.connections.forEach((conn, userName) => {
if (!excludeUsers.includes(userName) && conn.open && userName !== this.roomName) {
conn.send(data);
}
});
}

sendDataAll({ DATA }) {
if (!this.isConnected) return;
if (this.isHost) {
this._broadcastData({ type: 'user-data', from: this.userName, payload: DATA });
} else {
const conn = this.connections.get(this.roomName);
if (conn && conn.open) {
conn.send({ type: "relay", to: "all", payload: DATA });
}
}
}

sendDataTo({ DATA, USER }) {
if (!this.isConnected || !USER || USER === this.userName) return;
if (this.isHost) {
const conn = this.connections.get(USER);
if (conn && conn.open) {
conn.send({ type: 'user-data', from: this.userName, payload: DATA });
}
} else {
const conn = this.connections.get(this.roomName);
if (conn && conn.open) {
conn.send({ type: 'relay', to: USER, payload: DATA });
}
}
}
// --- Data Handling ---
setDataProcessingMode({ MODE }) {
    if (MODE === 'Set' || MODE === 'Add') {
        this.dataProcessingMode = MODE;
    }
    this.dataQueue = [];
    this.isNewDataAvailable = false;
}

getDataProcessingMode() {
    return this.dataProcessingMode;
}

nextData() {
    if (this.dataProcessingMode === 'Set') {
        this.dataQueue = [];
    } else {
        if (this.dataQueue.length > 0) {
            this.dataQueue.shift();
        }
    }
}

getStoredDataCount() {
    return this.dataQueue.length;
}

// --- Voice Chat ---
isInVoiceChat() {
return !!this.localStream;
}
isMuted() {
return this.isInVoiceChat() && this._isMuted;
}

async joinVoiceChat() {
if (!this.isConnected || this.localStream) return;
try {
this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
this._isMuted = false;
this.voiceConnections = new Map();
this.audioElements = new Map();

this.users.forEach(user => {
if (user !== this.userName) {
this._callUser(user);
}
});
} catch (err) {
console.error("Error getting user media:", err);
this.localStream = null;
}
}

leaveVoiceChat() {
if (this.localStream) {
this.localStream.getTracks().forEach(track => track.stop());
this.localStream = null;
}
if (this.voiceConnections) {
this.voiceConnections.forEach(conn => conn.close());
this.voiceConnections.clear();
}
if (this.audioElements) {
this.audioElements.forEach(audio => audio.remove());
this.audioElements.clear();
}
}
setMute({ MUTE }) {
if (this.localStream) {
const isMuted = MUTE === 'true';
this.localStream.getAudioTracks().forEach(track => {
track.enabled = !isMuted;
});
this._isMuted = isMuted;
}
}
setVolume({ USER, VOLUME }) {
const volume = Math.max(0, Math.min(1, VOLUME / 100));
if (USER === '全員') {
this.audioElements.forEach(audio => {
audio.volume = volume;
});
} else {
const audio = this.audioElements.get(USER);
if (audio) {
audio.volume = volume;
}
}
}

_callUser(userName) {
let targetPeerId;
if (userName === this.hostName) {
targetPeerId = this._sdbm(this.roomName);
} else {
targetPeerId = this._sdbm(`${this.roomName}_${userName}`);
}

const call = this.peer.call(targetPeerId, this.localStream, { metadata: { userName: this.userName } });
if (call) {
this._handleCall(call);
}
}

_handleCall(call) {
const remoteUserName = call.metadata.userName;
this.voiceConnections.set(remoteUserName, call);

call.on('stream', (remoteStream) => {
let audio = this.audioElements.get(remoteUserName);
if (!audio) {
audio = document.createElement('audio');
this.audioElements.set(remoteUserName, audio);
}
audio.srcObject = remoteStream;
audio.play().catch(e => console.warn("Audio play failed, likely requires user interaction.", e));
});
call.on('close', () => {
this._removeUserAudio(remoteUserName);
});
call.on('error', () => {
this._removeUserAudio(remoteUserName);
});
}

_removeUserAudio(userName) {
const audio = this.audioElements.get(userName);
if (audio) {
audio.remove();
this.audioElements.delete(userName);
}
if (this.voiceConnections.has(userName)) {
this.voiceConnections.delete(userName);
}
}

// --- Reporters ---
isRoomConnected() { return this.isConnected; }
_isHost() { return this.isHost; }
getRoomName() { return this.roomName || ""; }
getUsers() { return JSON.stringify(this.users); }
getHostName() { return this.hostName; }
getUserName() { return this.userName || ""; }
whenDataReceived() {
if (this.isNewDataAvailable) {
this.isNewDataAvailable = false;
return true;
}
return false;
}
whenDisconnected() {
if (this.wasDisconnected) {
this.wasDisconnected = false;
return true;
}
return false;
}
whenUserJoined() {
if (this.didUserJoin) {
this.didUserJoin = false;
return true;
}
return false;
}
whenUserLeft() {
if (this.didUserLeave) {
this.didUserLeave = false;
return true;
}
return false;
}
getReceivedData() {
    if (this.dataQueue.length > 0) {
        return this.dataQueue[0].content;
    }
    return "";
}
getSender() {
    if (this.dataQueue.length > 0) {
        return this.dataQueue[0].sender;
    }
    return "";
}
getDisconnectionReason() { return this.disconnectionReason; }
getJoinedUser() { return this.lastJoinedUser; }
getLeftUser() { return this.lastLeftUser; }
_getUsersMenu() {
const users = this.users.filter(u => u !== this.userName);
if (users.length === 0) return [""];
return users;
}
_getUsersMenuWithAll() {
const users = this.users.filter(u => u !== this.userName);
if (users.length === 0) return ["全員"];
return ["全員", ...users];
}
}
Scratch.extensions.register(new NeConnect());
})(Scratch);