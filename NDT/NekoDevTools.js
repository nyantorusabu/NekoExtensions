// 色々使う関数
// 短縮表現変換
function Abbreviation(code, ...link) {
    for (const word of link) {
        if (code.toLowerCase().startsWith(word.toLowerCase()[0])) {
            return word;
        }
    }
    Log('w', `引数として想定されていない値が入力されました: ${code}`)
    return code;
}
// ログ
function Log(type = 'log', output) {
    const lstype = Abbreviation(
        type,
        'log',
        'warn',
        'error'
    )
    console[lstype](`[NDT] ${output}`)
}
// 型チェック
function ChkType(type, data) {
    if (NDT.Option.DisCheck) return;
    const lstype = Abbreviation(
        type,
        'Number',
        'String',
        'Symbol',
        'Boolean',
        'BigInt',
        'Undefined',
        'Null',
        'Object',
        'Function'
    )
    if ((typeof data).toLowerCase() !== lstype.toLowerCase()) {
        Log('e', `引数に指定できない型が指定されています!: 入力=>${typeof data} 要求=>${lstype}`)
    }
}
// ファイルのアップロード
async function FileUpload(...exts) {
	const [handle] = await window.showOpenFilePicker({
		types: [{
			accept: {
				"*/*": exts
			}
		}]
	});
	const file = await handle.getFile();
	const reader = new FileReader();
	return new Promise(resolve => {
		reader.onload = e => resolve(e.target.result);
		reader.readAsDataURL(file)
	})
}



// NDT本体
// ScratchVM
window.NDT = {};
if (typeof vm !== 'undefined') {
    NDT.VM = vm;
} else {
    NDT.VM = Object.values(document.getElementById('app'))[0].child.updateQueue.lastEffect.deps[1].scratchGui.vm;
}
NDT.RT = NDT.VM.runtime;


// Info/Option
NDT.Info = {};
NDT.Info.Ver = '0.0.1';
NDT.Info.Message = `NDT.Infoを追加`;
NDT.Option = {};
NDT.Option.DisCheck = false;


// Event
NDT.Event = {};
NDT.Eve = NDT.Event;
NDT.Event.Flag = function() {
    NDT.VM.greenFlag();
}
NDT.Event.Stop = function() {
    NDT.VM.stopAll();
}
NDT.Event.Message = function(Message) {
    ChkType('s', Message);
    NDT.VM.broadcastMessage(Message);
}


// Sprite
NDT.Sprite = {};
NDT.Spr = NDT.Sprite;
NDT.Spr.ALL = NDT.VM.runtime.targets;
NDT.Spr.List = NDT.Spr.ALL.map(s => s.id);

NDT.Spr.Get = function(SprID) {
    ChkType('s', SprID);
    const Sprites = NDT.Spr.ALL;
    const IDS = Sprites.find(s => s.id === SprID);
    if (IDS) return IDS;
    const NAMES = Sprites.find(s => s.getName() === SprID);
    if (NAMES) return NAMES;
    Log('e', `${SprID}というスプライトは見つかりませんでした`)
}
NDT.Spr.Add = async function(URL) {
    ChkType('s', URL);
    const res = await fetch(URL);
    const json = await res.arrayBuffer();
    try {
        await NDT.VM.addSprite(json);
    } catch (e) {
        console.error(e);
    }
}
NDT.Spr.Upload = async function() {
    NDT.Spr.Add(await FileUpload('.sprite3'));
}
NDT.Spr.Remove = function(SprID) {
    ChkType('s', SprID);
    const Id = NDT.Spr.Get(SprID).id;
    NDT.VM.deleteSprite(SprID);
}
NDT.Spr.Rename = function(SprID, NewName) {
    ChkType('s', SprID);
    ChkType('s', NewName);
    const Id = NDT.Spr.Get(SprID).id;
    if (!Id) return;
    const Pos = NDT.Spr.List.indexOf(Id);
    NDT.Spr.ALL[Pos].sprite.name = NewName;
}

NDT.Spr.Event = {};
NDT.Spr.Eve = NDT.Spr.Event;
NDT.Spr.Eve.Flag = function(SprID) {
    ChkType('s', SprID);
    const target = NDT.Spr.Get(SprID);
    if (!target) return;
    NDT.RT.startHats('event_whenflagclicked', {}, target);
}
NDT.Spr.Eve.Stop = function(SprID) {
    ChkType('s', SprID);
    const target = NDT.Spr.Get(SprID);
    if (!target) return;
    NDT.RT.stopForTarget(target);
}
NDT.Spr.Eve.Message = function(SprID, Message) {
    ChkType('s', SprID);
    ChkType('s', Message);
    const target = NDT.Spr.Get(SprID);
    if (!target) return;
    NDT.RT.startHats('event_whenbroadcastreceived', { BROADCAST_OPTION: Message }, target);
}

NDT.Spr.Variable = {};
NDT.Spr.Var = NDT.Spr.Variable;
NDT.Spr.Var.All = function(SprID) {
    ChkType('s', SprID);
    const target = NDT.Spr.Get(SprID);
    if (!target) return;
    return Object.values(target.variables);
}
NDT.Spr.Var.List = function(SprID) {
    ChkType('s', SprID);
    const target = NDT.Spr.Get(SprID);
    if (!target) return;
    return Object.values(target.variables).map(v => v.id);
}
NDT.Spr.Var.GetFull = function(SprID, VarID) {
    ChkType('s', SprID);
    ChkType('s', VarID);
    const target = NDT.Spr.Get(SprID);
    if (!target) return;
    const Vars = target.variables;
    const IDS = Vars.find(v => v.id === VarID);
    if (IDS) return IDS;
    const NAMES = Vars.find(v => v.name === VarID);
    if (NAMES) return NAMES;
    Log('e', `スプライト${SprID}に${VarID}というローカル変数は見つかりませんでした`);
}
NDT.Spr.Var.Get = function(SprID, VarID) {
    return NDT.Spr.Var.GetFull(SprID, VarID,).value;
}
NDT.Spr.Variable.Set = function(SprID, VarID, Value) {
    ChkType('s', SprID);
    ChkType('s', VarID);
    const Id = NDT.Spr.Get(SprID).id;
    if (!Id) return;
    const Pos = NDT.Spr.List.indexOf(Id);
    const Var = NDT.Spr.Var.Get(SprID, VarID);
    if (!Var) return;
    NDT.Spr.ALL[Pos].variables[Var.id].value = Value;
}
NDT.Spr.Variable.Add = function(SprID, VarID, Value) {
    ChkType('s', SprID);
    ChkType('s', VarID);
    const Id = NDT.Spr.Get(SprID).id;
    if (!Id) return;
    const Pos = NDT.Spr.List.indexOf(Id);
    const Var = NDT.Spr.Var.Get(SprID, VarID);
    if (!Var) return;
    NDT.Spr.ALL[Pos].variables[Var.id].value += Value;
}
NDT.Spr.Variable.Rename = function(SprID, VarID, NewName) {
    ChkType('s', SprID);
    ChkType('s', VarID);
    ChkType('s', NewName);
    const Id = NDT.Spr.Get(SprID).id;
    if (!Id) return;
    const Pos = NDT.Spr.List.indexOf(Id);
    const Var = NDT.Spr.Var.Get(SprID, VarID);
    if (!Var) return;
    NDT.Spr.ALL[Pos].variables[Var.id].name = NewName;
}


// Variable
NDT.Variable = {};
NDT.Var = NDT.Variable;
NDT.Var.All = function() {
    const SprID = NDT.Spr.ALL.find(s => s.isStage).id;
    if (!SprID) {
        Log('e', 'ステージを発見できませんでした');
        return;
    }
    return Object.values(NDT.Spr.Var.All(SprID));
}
NDT.Var.List = function() {
    return NDT.Var.All().map(v => v.id);
}
NDT.Var.GetFull = function(VarID) {
    ChkType('s', VarID);
    const target = NDT.Spr.ALL.find(s => s.isStage);
    if (!target) {
        Log('e', 'ステージを発見できませんでした');
        return;
    }
    const Vars = Object.values(target.variables);
    const IDS = Vars.find(v => v.id === VarID);
    if (IDS) return IDS;
    const NAMES = Vars.find(v => v.name === VarID);
    if (NAMES) return NAMES;
    Log('e', `${VarID}というグローバル変数は見つかりませんでした`);
}
NDT.Var.Get = function(VarID) {
    return NDT.Var.GetFull(VarID).value;
}
NDT.Var.Set = function(VarID, Value){
    ChkType('s', VarID);
    const SprID = NDT.Spr.ALL.find(s => s.isStage).id;
    if (!SprID) {
        Log('e', 'ステージを発見できませんでした');
        return;
    }
    const Pos = NDT.Spr.List.indexOf(SprID);
    const Var = NDT.Var.Get(VarID);
    if (!Var) return;
    NDT.Spr.ALL[Pos].variables[Var.id].value = Value;
}
NDT.Var.Add = function(VarID, Value){
    ChkType('s', VarID);
    const SprID = NDT.Spr.ALL.find(s => s.isStage).id;
    if (!SprID) {
        Log('e', 'ステージを発見できませんでした');
        return;
    }
    const Pos = NDT.Spr.List.indexOf(SprID);
    const Var = NDT.Var.Get(VarID);
    if (!Var) return;
    NDT.Spr.ALL[Pos].variables[Var.id].value += Value;
}
NDT.Var.Rename = function(VarID, NewName){
    ChkType('s', VarID);
    ChkType('s', NewName);
    const SprID = NDT.Spr.ALL.find(s => s.isStage).id;
    if (!SprID) {
        Log('e', 'ステージを発見できませんでした');
        return;
    }
    const Pos = NDT.Spr.List.indexOf(SprID);
    const Var = NDT.Var.Get(VarID);
    if (!Var) return;
    NDT.Spr.ALL[Pos].variables[Var.id].name = NewName;
}


// イベント
document.dispatchEvent(new Event("NDT_Loaded"));