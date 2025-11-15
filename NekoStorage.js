// Name: NekoStorage
// ID: NekoStorage
// Description: IndexedDBを使用して大容量のデータを保存する。
// By: nyantorusabu
(function (Scratch) {
    'use strict';

    class NekoStorage {
        constructor(runtime) {
            this.runtime = runtime;
            this.dbName = 'NekoStorage';
            this.storeName = 'nekostore';
            this.namespace = 'default';
            this._openDB();
        }

        getInfo() {
            return {
                id: 'NekoStorage',
                name: 'NekoStorage',
                blocks: [
                    { opcode: 'setNamespace', blockType: Scratch.BlockType.COMMAND, text: '名前空間IDを [NameSpaceID] にする', arguments: { NameSpaceID: { type: Scratch.ArgumentType.STRING, defaultValue: 'default' } } },
                    { opcode: 'getNamespace', blockType: Scratch.BlockType.REPORTER, text: '現在の名前空間ID' },
                    "---",
                    { opcode: 'saveData', blockType: Scratch.BlockType.COMMAND, text: '[ID] に [Data] を保存', arguments: { ID: { type: Scratch.ArgumentType.STRING, defaultValue: 'key' }, Data: { type: Scratch.ArgumentType.STRING, defaultValue: 'value' } } },
                    { opcode: 'deleteData', blockType: Scratch.BlockType.COMMAND, text: '[ID] を削除', arguments: { ID: { type: Scratch.ArgumentType.STRING, defaultValue: 'key' } } },
                    { opcode: 'clearNamespace', blockType: Scratch.BlockType.COMMAND, text: 'データをすべて削除' },
                    "---",
                    { opcode: 'listKeys', blockType: Scratch.BlockType.REPORTER, text: 'データ一覧' },
                     { opcode: 'getData', blockType: Scratch.BlockType.REPORTER, text: '[ID] のデータ', arguments: { ID: { type: Scratch.ArgumentType.STRING, defaultValue: 'key' } } },
                    "---",
                    { opcode: 'getQuota', blockType: Scratch.BlockType.REPORTER, text: '保存可能なサイズ' },
                    { opcode: 'getRemaining', blockType: Scratch.BlockType.REPORTER, text: '残りのサイズ' },
                    { opcode: 'getTotalSize', blockType: Scratch.BlockType.REPORTER, text: '全体の消費サイズ' },
                    { opcode: 'getSize', blockType: Scratch.BlockType.REPORTER, text: '[ID] の消費サイズ', arguments: { ID: { type: Scratch.ArgumentType.STRING, defaultValue: 'key' } } }
                ],
                menus: {}
            };
        }

        _openDB() {
            this._dbPromise = new Promise((resolve, reject) => {
                const req = indexedDB.open(this.dbName, 1);
                req.onupgradeneeded = (ev) => {
                    const db = ev.target.result;
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        db.createObjectStore(this.storeName, { keyPath: 'key' });
                    }
                };
                req.onsuccess = (ev) => {
                    this.db = ev.target.result;
                    resolve(this.db);
                };
                req.onerror = (ev) => reject(ev.target.error);
            });
        }

        async _withStore(mode, action) {
            const db = await this._dbPromise;
            return new Promise((resolve, reject) => {
                const tx = db.transaction([this.storeName], mode);
                const store = tx.objectStore(this.storeName);
                try { action(store, resolve, reject); } catch (e) { reject(e); }
                tx.onerror = (ev) => reject(ev.target.error);
            });
        }

        setNamespace(args) {
            this.namespace = String(args.NameSpaceID || 'default');
        }

        async saveData(args) {
            const id = String(args.ID || '');
            const value = args.Data ?? '';
            const key = `${this.namespace}:${id}`;
            const record = { key, namespace: this.namespace, id, value, timestamp: Date.now() };
            await this._withStore('readwrite', (store, resolve, reject) => {
                const req = store.put(record);
                req.onsuccess = () => resolve(true);
                req.onerror = (ev) => reject(ev.target.error);
            });
        }

        async getData(args) {
            const id = String(args.ID || '');
            const key = `${this.namespace}:${id}`;
            try {
                const rec = await this._withStore('readonly', (store, resolve, reject) => {
                    const req = store.get(key);
                    req.onsuccess = (ev) => resolve(ev.target.result);
                    req.onerror = (ev) => reject(ev.target.error);
                });
                if (!rec) return '';
                const v = rec.value;
                if (typeof v === 'string') return v;
                try { return JSON.stringify(v); } catch { return String(v); }
            } catch { return ''; }
        }

        async deleteData(args) {
            const id = String(args.ID || '');
            const key = `${this.namespace}:${id}`;
            await this._withStore('readwrite', (store, resolve, reject) => {
                const req = store.delete(key);
                req.onsuccess = () => resolve(true);
                req.onerror = (ev) => reject(ev.target.error);
            });
        }

        async clearNamespace() {
            const nsPrefix = `${this.namespace}:`;
            await this._withStore('readwrite', (store, resolve, reject) => {
                const req = store.openCursor();
                req.onsuccess = (ev) => {
                    const cursor = ev.target.result;
                    if (!cursor) return resolve(true);
                    if (String(cursor.key).startsWith(nsPrefix)) cursor.delete();
                    cursor.continue();
                };
                req.onerror = (ev) => reject(ev.target.error);
            });
        }

        // 現在の名前空間ID
        getNamespace() {
            return this.namespace;
        }

        // データ一覧（JSON Array文字列で返す。各要素は文字列ID）
        async listKeys() {
            const nsPrefix = `${this.namespace}:`;
            return await this._withStore('readonly', (store, resolve, reject) => {
                const keys = [];
                const req = store.openCursor();
                req.onsuccess = (ev) => {
                    const cursor = ev.target.result;
                    if (!cursor) return resolve(JSON.stringify(keys));
                    const key = cursor.key;
                    if (String(key).startsWith(nsPrefix)) keys.push(String(key).replace(nsPrefix, ''));
                    cursor.continue();
                };
                req.onerror = (ev) => reject(ev.target.error);
            });
        }

        // [ID] の消費サイズ（byte）
        async getSize(args) {
            const id = String(args.ID || '');
            const key = `${this.namespace}:${id}`;
            try {
                const rec = await this._withStore('readonly', (store, resolve, reject) => {
                    const req = store.get(key);
                    req.onsuccess = (ev) => resolve(ev.target.result);
                    req.onerror = (ev) => reject(ev.target.error);
                });
                if (!rec) return 0;
                const v = rec.value;
                let str;
                if (typeof v === 'string') str = v;
                else {
                    try { str = JSON.stringify(v); } catch { str = String(v); }
                }
                if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str).length;
                return str.length;
            } catch (e) {
                return 0;
            }
        }

        // 全体の消費サイズ（現在の名前空間全体、byte）
        async getTotalSize() {
            const nsPrefix = `${this.namespace}:`;
            return await this._withStore('readonly', (store, resolve, reject) => {
                let total = 0;
                const req = store.openCursor();
                req.onsuccess = (ev) => {
                    const cursor = ev.target.result;
                    if (!cursor) return resolve(total);
                    const key = cursor.key;
                    if (String(key).startsWith(nsPrefix)) {
                        const rec = cursor.value;
                        let v = rec && rec.value;
                        let str;
                        if (typeof v === 'string') str = v;
                        else {
                            try { str = JSON.stringify(v); } catch { str = String(v); }
                        }
                        if (typeof TextEncoder !== 'undefined') total += new TextEncoder().encode(str).length;
                        else total += (str ? str.length : 0);
                    }
                    cursor.continue();
                };
                req.onerror = (ev) => reject(ev.target.error);
            });
        }

        // 保存可能なサイズ（ブラウザが報告するクォータ。byte単位。利用できない場合は -1 を返す）
        async getQuota() {
            try {
                if (navigator.storage && navigator.storage.estimate) {
                    const { quota } = await navigator.storage.estimate();
                    return quota ? Math.floor(quota) : -1;
                }
            } catch (e) {}
            return -1;
        }

        // 残りのサイズ（quota - usage。利用できない場合は -1）
        async getRemaining() {
            try {
                if (navigator.storage && navigator.storage.estimate) {
                    const { quota, usage } = await navigator.storage.estimate();
                    if (typeof quota === 'number' && typeof usage === 'number') return Math.max(0, Math.floor(quota - usage));
                    return -1;
                }
            } catch (e) {}
            return -1;
        }

        _shutdown() { if (this.db) this.db.close(); }
        _getStatus() { return { status: 2, msg: 'NekoStorage ready' }; }
    }
    Scratch.extensions.register(new NekoStorage());
})(window.Scratch);
