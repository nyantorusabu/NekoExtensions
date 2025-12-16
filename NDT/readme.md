**注意: これは拡張機能ではありません**  
# NekoDevTools
NekoDevTools(NDT)はScratchVMにある程度簡単にアクセスできるようになる何かです。  
バニラでも**多分**使えるしTurboWarpのようなMod環境でも**多分**使えます。  
コンソールなどでNDTを実行後``NDT``でアクセスできます。  
詳しい使い方はやる気が出たら書きます。
# 使い方
下のコードをブックマークして実行するかコンソールから直接実行するとNDTが壊れてなければ起動メッセージが出て起動します。
```js
javascript:(function(){if(window.NDT){return} const s=document.createElement('script');s.src='https://nyantorusabu.github.io/NekoExtensions/NDT/NekoDevTools.js';document.body.appendChild(s)})();
```  
起動しなかったらぁ...Issue立てといてください。  
Issueの立て方わからんかったらScratchかDiscordで伝えてください。
# 現在使えるもの
- ``NDT.VM`` - ScratchVMに直接アクセスできます。
- ``NDT.RT`` - Runtimeにアクセスできます。ただのショートカット。
- ``NDT.Event`` or ``NDT.Eve`` - イベント関係。
- ``NDT.Sprite`` or ``NDT.Spr`` - スプライト関係。
- ``NDT.Sprite.Variable`` or ``NDT.Sprite.Var`` - ローカル変数関係。
- ``NDT.Variable`` or ``NDT.Var`` - グローバル変数関係。
- ``NDT.NDTEvent`` or ``NDT.NEve`` - NDTのイベント関係
- ``NDT.Option`` - 設定
- ``NDT.Info`` - NDTの情報
# 設定できる項目
- ``NDT.Option.DisCheck`` - Boolean(真偽値) - 有効にすると実行時型チェックを行わないようになります。軽量化に。
- ``NDT.Option.DisNDTEvent`` - Boolean(真偽値) - 有効にするとNDTEventのイベント送信がなくなります。こちらも軽量化に。
# 型チェックについて
NDTは関数を実行するときに一部の引数の型を確認します。  
型が間違っていた場合エラーを吐きます(処理は止めません)  
無効にしたい場合は``NDT.Option.DisCheck``を有効にしてください。
# NDTEventについて
NDTはScratchのイベントに加えて色々独自のイベントがあります。  
``NDT.NDTEvent.Add(name, handler)``でイベントを受け取れます。  
無効にしたい場合は``NDT.Option.DisNDTEvent``を有効にしてください。  
使い方の例とか無いんでここには一覧だけ置いときます。  
- ``STEP_BEFORE`` - Stepの前に発火します
- ``STEP_AFTER`` - Stepの後に発火します
- ``FLAG_BEFORE`` - 緑の旗が押される前に発火します
- ``FLAG_AFTER`` - 緑の旗が押された後に発火します
- ``MESSAGE_BEFORE`` - 何らかのメッセージが送信される前に発火します
- ``MESSAGE_AFTER`` - 何らかのメッセージが送信された後に発火します
# サンプル
1. ``NDT.Eve.Flag()`` - 緑の旗を押す
2. ``NDT.Eve.Stop()`` - すべて停止
3. ``NDT.Spr.Rename(NDT.Var.Get('hoge'), NDT.Var.Get('hogege'))`` - スプライト名がグローバル変数"hoge"内の値になっているスプライトの名前をグローバル変数"hogege"内の値にする
# ライセンス
NDTはMITライセンスです。改変、配布などなど自由!