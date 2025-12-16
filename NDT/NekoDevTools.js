(function() {
if (window.NDT) return;

// ScratchVM
window.NDT = {};
if (typeof vm !== 'undefined') {
    NDT.VM = vm;
} else if(document.getElementById('app')) {
    NDT.VM = Object.values(document.getElementById('app'))[0].child.updateQueue.lastEffect.deps[1].scratchGui.vm;
} else {
    NDT.VM = null;
}
if (!NDT.VM) {
    Log('e', 'ScratchVMへのアクセスに失敗しました!\nScratchVMの仕様が変更された可能性があります');
    NDT = undefined;
    return;
}
NDT.RT = NDT.VM.runtime;


// Info/Option
NDT.Info = {};
NDT.Info.Ver = '0.0.18';
NDT.Info.Message = `NDT.NDTEventを追加`;
NDT.Option = {};
NDT.Option.DisCheck = false;
NDT.Option.DisStepEvent = false;


// Obj
NDT.Sprite = {};
NDT.Spr = NDT.Sprite;
NDT.Event = {};
NDT.Eve = NDT.Event;
NDT.Spr.Position = {};
NDT.Spr.Pos = NDT.Spr.Position;
NDT.Spr.Event = {};
NDT.Spr.Eve = NDT.Spr.Event;
NDT.Spr.Variable = {};
NDT.Spr.Var = NDT.Spr.Variable;
NDT.Spr.List = {};
NDT.Variable = {};
NDT.Var = NDT.Variable;
NDT.List = {};


// Reload
NDT.Reload = function() {
    NDT.Spr.All = NDT.VM.runtime.targets;
    NDT.Spr.IDList = NDT.Spr.All.map(s => s.id);
    NDT.Spr.NameList = NDT.Spr.All.map(s => s.getName());
}
NDT.Reload();
NDT.RT.on('PROJECT_LOADED', () => {
    NDT.Reload();
});
NDT.VM.addListener('targetsUpdate', (data) => {
    NDT.Reload();
});


// NDTEvent
const Eve = new EventTarget();
NDT.NDTEvent = {};
NDT.NDTEvent.Add = function(name, handler) {
    Eve.addEventListener(name, handler);
};

NDT.NDTEvent.Remove = function(name, handler) {
    Eve.removeEventListener(name, handler);
};

NDT.NDTEvent.Dispatch = function(name) {
    Eve.dispatchEvent(new Event(name));
};
NDT.Step = NDT.RT._step;
NDT.RT._step = function() {
    if (NDT.Option.DisStepEvent) {
        NDT.Step.call(this);
        return;
    }
    NDT.NDTEvent.Dispatch('StepBefore');
    NDT.Step.call(this);
    NDT.NDTEvent.Dispatch('StepAfter');
}

// NDTMain
// Event
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
NDT.Spr.Get = function(SprID) {
    ChkType('s', SprID);
    const Sprites = NDT.Spr.All;
    let Out = Sprites.find(s => s.id == SprID);
    if (!Out) {
        Out = Sprites.find(s => s.getName() == SprID);
        if (!Out) {
            Log('e', `${SprID}というスプライトは見つかりませんでした`);
            return;
        }
    }
    return Out;
}
NDT.Spr.Runtime = function(SprID) {
    return NDT.Spr.Get(SprID).runtime;
}
NDT.Spr.RT = function(SprID) {
    return NDT.Spr.Runtime(SprID);
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
NDT.Spr.Delete = function(SprID) {
    ChkType('s', SprID);
    const Id = NDT.Spr.Get(SprID).id;
    NDT.VM.deleteSprite(SprID);
}
NDT.Spr.Rename = function(SprID, NewName) {
    ChkType('s', SprID);
    ChkType('s', NewName);
    const Id = NDT.Spr.Get(SprID).id;
    if (!Id) return;
    const Pos = NDT.Spr.IDList.indexOf(Id);
    NDT.Spr.All[Pos].sprite.name = NewName;
}
NDT.Spr.Visible = function(SprID, Show = null) {
    const Spr = NDT.Spr.Get(SprID);
    if (!Spr) return;
    if (Show !== null) {
        Spr.visible = Show;
    }
    return Spr.visible;
},
NDT.Spr.Size = function(SprID, ToSize = null) {
    const Spr = NDT.Spr.Get(SprID);
    if (!Spr) return;
    if (ToSize !== null) {
        Spr.size = ToSize;
    }
    return Spr.size;
}

NDT.Spr.Pos.Get = function(SprID) {
    const Spr = NDT.Spr.Get(SprID);
    if (!Spr) return;
    return { x: Spr.x, y: Spr.y, Dir: Spr.direction };
}
NDT.Spr.Pos.Goto = function(SprID, ToX = null, ToY = null) {
    const Spr = NDT.Spr.Get(SprID);
    if (!Spr) return;
    if (ToX !== null) Spr.x = ToX;
    if (ToY !== null) Spr.y = ToY;
    return { x: Spr.x, y: Spr.y };
}
NDT.Spr.Pos.MoveXY = function(SprID, StepX = null, StepY = null) {
    const Spr = NDT.Spr.Get(SprID);
    if (!Spr) return;
    if (StepX !== null) Spr.x += StepX;
    if (StepY !== null) Spr.y += StepY;
    return { x: Spr.x, y: Spr.y };
}
NDT.Spr.Pos.Move = function(SprID, Steps) {
    const Spr = NDT.Spr.Get(SprID);
    if (!Spr) return;
    const Radians = Math.PI / 180 * (90 - Spr.direction);
    const StepX = Steps * Math.cos(Radians);
    const StepY = Steps * Math.sin(Radians);
    Spr.x += StepX;
    Spr.y += StepY;
    return { x: Spr.x, y: Spr.y };
}
NDT.Spr.Pos.SetDir = function(SprID, Dir = null) {
    const Spr = NDT.Spr.Get(SprID);
    if (!Spr) return;
    if (Dir !== null) Spr.direction = Dir;
    return { Dir: direction };
}
NDT.Spr.Pos.Turn = function(SprID, Dir) {
    const Spr = NDT.Spr.Get(SprID);
    if (!Spr) return;
    if (Dir) Spr.direction += Dir;
    return { Dir: Spr.direction };
}

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

NDT.Spr.Var.All = function(SprID) {
    const target = NDT.Spr.Get(SprID);
    if (!target) return;
    return Object.values(target.variables).filter(v => v.type == '');
}
NDT.Spr.Var.IDList = function(SprID) {
    return NDT.Spr.Var.All(SprID).map(v => v.id);
}
NDT.Spr.Var.NameList = function(SprID) {
    return NDT.Spr.Var.All(SprID).map(v => v.name);
}
NDT.Spr.Var.GetFull = function(SprID, VarID) {
    ChkType('s', SprID);
    ChkType('s', VarID);
    const target = NDT.Spr.Get(SprID);
    if (!target) return;
    const Vars = Object.values(target.variables);
    let Out = Vars.find(v => v.id === VarID && v.type == '');
    if (!Out) {
        Out = Vars.find(v => v.name === VarID && v.type == '');
        if (!Out) {
            Log('e', `スプライト${SprID}に${VarID}というローカル変数は見つかりませんでした`);
            return;
        }
    }
    return Out;
}
NDT.Spr.Var.Get = function(SprID, VarID) {
    return NDT.Spr.Var.GetFull(SprID, VarID,).value;
}
NDT.Spr.Var.Set = function(SprID, VarID, Value) {
    NDT.Spr.Var.GetFull(SprID, VarID).value = Value;
}
NDT.Spr.Var.Change = function(SprID, VarID, Value) {
    NDT.Spr.Var.GetFull(SprID, VarID).value += Value;
}
NDT.Spr.Var.Rename = function(SprID, VarID, NewName) {
    NDT.Spr.Var.GetFull(SprID, VarID).name = NewName;
}
NDT.Spr.Var.Create = function(SprID, VarName) {
    const UID = GenerateUid();
    NDT.Spr.Get(SprID).createVariable(UID, VarName, '');
}
NDT.Spr.Var.Delete = function(SprID, VarID) {
    const ID = NDT.Spr.Var.GetFull(SprID, VarID).id;
    NDT.Spr.Get(SprID).deleteVariable(ID);
}

NDT.Spr.List.All = function(SprID) {
    const target = NDT.Spr.Get(SprID);
    if (!target) return;
    return Object.values(target.variables).filter(v => v.type == 'list');
}
NDT.Spr.List.IDList = function(SprID) {
    return NDT.Spr.List.All(SprID).map(v => v.id);
}
NDT.Spr.List.NameList = function(SprID) {
    return NDT.Spr.List.All(SprID).map(v => v.name);
}
NDT.Spr.List.GetFull = function(SprID, VarID) {
    ChkType('s', SprID);
    ChkType('s', VarID);
    const target = NDT.Spr.Get(SprID);
    if (!target) return;
    const Vars = Object.values(target.variables);
    let Out = Vars.find(v => v.id === VarID && v.type == 'list');
    if (!Out) {
        Out = Vars.find(v => v.name === VarID && v.type == 'list');
        if (!Out) {
            Log('e', `スプライト${SprID}に${VarID}というローカルリストは見つかりませんでした`);
            return;
        }
    }
    return Out;
}
NDT.Spr.List.Get = function(SprID, VarID) {
    return NDT.Spr.List.GetFull(SprID, VarID,).value;
}
NDT.Spr.List.SetArray = function(SprID, VarID, Value) {
    const List = NDT.Spr.List.Get(SprID, VarID);
    List.length = 0;
    List.push(...Value);
}
NDT.Spr.List.Create = function(SprID, VarName) {
    const UID = GenerateUid();
    NDT.Spr.Get(SprID).createVariable(UID, VarName, 'list');
}
NDT.Spr.List.Delete = function(SprID, VarID) {
    const ID = NDT.Spr.List.GetFull(SprID, VarID).id;
    NDT.Spr.Get(SprID).deleteVariable(ID);
}
NDT.Spr.List.Rename = function(SprID, VarID, NewName) {
    NDT.Spr.List.GetFull(SprID, VarID).name = NewName;
}


// Variable
NDT.Var.All = function() {
    const SprID = NDT.Spr.All.find(s => s.isStage).id;
    if (!SprID) {
        Log('e', 'ステージを発見できませんでした');
        return;
    }
    return NDT.Spr.Var.All(SprID);
}
NDT.Var.IDList = function() {
    return NDT.Var.All().map(v => v.id);
}
NDT.Var.NameList = function() {
    return NDT.Var.All().map(v => v.name);
}
NDT.Var.GetFull = function(VarID) {
    ChkType('s', VarID);
    const target = NDT.Spr.All.find(s => s.isStage);
    if (!target) {
        Log('e', 'ステージを発見できませんでした');
        return;
    }
    const Vars = Object.values(target.variables);
    let Out = Vars.find(v => v.id === VarID && v.type == '');
    if (!Out) {
        Out = Vars.find(v => v.name === VarID && v.type == '');
        if (!Out) {
            Log('e', `${VarID}というグローバル変数は見つかりませんでした`);
            return;
        }
    }
    return Out;
}
NDT.Var.Get = function(VarID) {
    return NDT.Var.GetFull(VarID).value;
}
NDT.Var.Set = function(VarID, Value){
    NDT.Var.GetFull(VarID).value = Value;
}
NDT.Var.Change = function(VarID, Value){
    NDT.Var.GetFull(VarID).value += Value;
}
NDT.Var.Create = function(VarName) {
    NDT.RT.createNewGlobalVariable(VarName);
}
NDT.Var.Delete = function(VarID) {
    ChkType('s', VarID);
    const SprID = NDT.Spr.All.find(s => s.isStage).id;
    if (!SprID) {
        Log('e', 'ステージを発見できませんでした');
        return;
    }
    NDT.Spr.Get(SprID).deleteVariable(NDT.Var.GetFull(VarID).id);
}
NDT.Var.Rename = function(VarID, NewName){
    NDT.Var.GetFull(VarID).name = NewName;
}


// List
NDT.List.All = function() {
    const SprID = NDT.Spr.All.find(s => s.isStage).id;
    if (!SprID) {
        Log('e', 'ステージを発見できませんでした');
        return;
    }
    return NDT.Spr.List.All(SprID);
}
NDT.List.IDList = function() {
    return NDT.List.All().map(v => v.id);
}
NDT.List.NameList = function() {
    return NDT.List.All().map(v => v.name);
}
NDT.List.GetFull = function(VarID) {
    ChkType('s', VarID);
    const target = NDT.Spr.All.find(s => s.isStage);
    if (!target) {
        Log('e', 'ステージを発見できませんでした');
        return;
    }
    const Vars = Object.values(target.variables);
    let Out = Vars.find(v => v.id === VarID && v.type == 'list');
    if (!Out) {
        Out = Vars.find(v => v.name === VarID && v.type == 'list');
        if (!Out) {
            Log('e', `${VarID}というグローバルリストは見つかりませんでした`);
            return;
        }
    }
    return Out;
}
NDT.List.Get = function(VarID) {
    return NDT.List.GetFull(VarID).value;
}
NDT.List.SetArray = function(VarID, Value) {
    const List = NDT.List.Get(VarID);
    List.length = 0;
    List.push(...Value);
}
NDT.List.Create = function(VarName) {
    NDT.RT.createNewGlobalVariable(VarName, undefined, 'list');
}
NDT.List.Delete = function(VarID) {
    ChkType('s', VarID);
    const SprID = NDT.Spr.All.find(s => s.isStage).id;
    if (!SprID) {
        Log('e', 'ステージを発見できませんでした');
        return;
    }
    NDT.Spr.Get(SprID).deleteVariable(NDT.List.GetFull(VarID).id);
}
NDT.List.Rename = function(VarID, NewName){
    NDT.List.GetFull(VarID).name = NewName;
}


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
        Log('e', `引数に指定できない型が指定されています!:\n入力=>${typeof data} 要求=>${lstype}`)
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
// ランダムなIDの生成
function GenerateUid() {
    return Math.random().toString(36).substring(2, 12) +
        Math.random().toString(36).substring(2, 12);
};


// イベント
document.dispatchEvent(new Event("NDT_Loaded"));
Log('l', `NDT V${NDT.Info.Ver} is Loaded.`);
Log('l', `Update:\n${NDT.Info.Message}`)
})();