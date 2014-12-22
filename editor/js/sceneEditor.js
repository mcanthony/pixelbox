/*


	Properties:


	Object type - instance of template	
		dynamic updates when template is edited
	* Global instance refreshing can occur on selection change, if any objects selected are or descendents of instances
		
	When renaming objects, if instance, don't allow duplicate names globally
	
	custom properties def.props
		
	
		
		
		
		
	NEXT:
	
	
	Meta field for all objects
	"custom" objects (Container)
	
	mouse move tool (with Shift?)
	
	make transform(max scale) affect pointSize
	
	? camera FOV / updateViewPortUniform code is incorrect
	
	? Camera default + template
			

	LATER:

	[Swap Asset]

	add under View:
		[x] Show labels

	add textures to planes
	texture as a resource

*/

function EditSceneScene(){
	
	this.initUndo();
	
	this.shift = false;
	this.ctrl = false;
	this.alt = false;
	
	this.selectedObjects = [];
	
	this.mouseCoord = {x: 0, y: 0};
		
	this.canvasInteractionsEnabled = true;
	this.disableCanvasInteractionsOnRelease = false;
	
	this.version = '1.0';
}

EditSceneScene.prototype = {

/* ------------------- ------------------- ------------------- ------------------- ------------------- Undo functions */

	resetAssets:function(){
		var children = this.scene.recursiveRemoveChildren([this.camera, this.axis, this.ambient, this.scene.fog]);
		// clean up
		for(var i = 0; i < children.length; i++){
			var obj = children[i];
			if(obj.dispose) obj.dispose();
			else if(obj.shadowMap) obj.shadowMap.dispose();
		}
		for(var a in assets.cache.files){
			THREE.PixelBox.prototype.dispose(assets.cache.files[a]);
		}
		// clear assets
		assets.cache.clear();
		// clean up / dispose of assets cached in undo
		var checkArgs = function(arg){
			if(typeof(arg)!='object') return;
			for(var p in arg){
				var val = arg[p];
				if(typeof(val)!='object') continue;
				if(val && val instanceof THREE.Object3D){
					if(val instanceof THREE.PointCloud) val.dispose();
					checkArgs(p.children);
				} else if(val && val.frameData && val.width){
					THREE.PixelBox.prototype.dispose(val);
				}
			}
		}		
		// process undo and redo
		for(var i = 0; i < this._undo.length; i++){
			checkArgs(this._undo[i].undo);	
			checkArgs(this._undo[i].redo);	
		}
		for(var i = 0; i < this._redo.length; i++){
			checkArgs(this._redo[i].undo);	
			checkArgs(this._redo[i].redo);	
		}
	},

	/* undo queue */
	initUndo:function(){
		this._undoing = false;
		this._undo = [];
		this._redo = [];
		this.undoChanged();
	},
	
	/* joins last n undos into one action */
	joinUndoActions: function(n){
		var newItem = [];
		for(var i = this._undo.length - n; i < this._undo.length; i++){
			newItem.push(this._undo[i]);
		}
		this._undo.splice(this._undo.length - n, n);
		this._undo.push(newItem);
	},
	
	/* if previous-1 undo action can be merged with last one, merge them */
	mergeUndo:function(){
		var undo1 = this._undo[this._undo.length - 1];
		var undo2 = this._undo[this._undo.length - 2];
		if(undo1.mergeable && undo2.mergeable && undo1.name == undo2.name){
			// merge to undo2
			switch(undo1.name){
			case 'moveBy':
			case 'moveTo':
			case 'rotateBy':
			case 'rotateTo':
			case 'scaleBy':
			case 'scaleTo':
			case 'cameraFOV':
			case 'cameraZoom':
				// compare operands
				if(undo1.redo[1].length != undo2.redo[1].length) return;
				for(var i = 0; i < undo1.redo[1].length; i++){
					if(undo1.redo[1][i][0] != undo2.redo[1][i][0]) {
						return;
					}
				}
				break;
			default:
				console.log("merged undo type without checing args: "+undo1.name);
				break;
			// case 'sceneMaxShadows':
			}
			
			// merge and remove undo1
			undo2.redo = undo1.redo;
			this._undo.pop(); 
		}
	},
	
	/* replaces references to object with another object,
		used after updating an asset in scene.
	*/		
	replaceReferencesInUndo:function(rep){
		var updateRecurse = function(arg){
			if(typeof(arg)!='object') return;
			for(var p in arg){
				var val = arg[p];
				if(typeof(val)!='object') continue;
				if(val && val instanceof THREE.Object3D){
					if(rep[val.uuid]){
						// found, replace
						arg[p] = rep[val.uuid];
					}
					continue;
				}
				updateRecurse(val);
			}
		}
		// process undo and redo
		for(var i = 0; i < this._undo.length; i++){
			updateRecurse(this._undo[i].undo);	
			updateRecurse(this._undo[i].redo);	
		}
		for(var i = 0; i < this._redo.length; i++){
			updateRecurse(this._redo[i].undo);	
			updateRecurse(this._redo[i].redo);	
		}
	},
	
	undoChanged:function(){
		if(this._undo.length > 1) this.mergeUndo();
		
		$('#undo').button({label:"Undo" + (this._undo.length ? (' ('+this._undo.length+')') : ''), disabled: !this._undo.length});
		$('#redo').button({label:"Redo" + (this._redo.length ? (' ('+this._redo.length+')') : ''), disabled: !this._redo.length});
		
		// update helpers
		if(this.container) {
			for(var i = 0, l = this.scene.children.length; i < l; i++){
				var obj = this.scene.children[i];
				if(obj.isHelper) {
					obj.update();
				}
			}
		}
	},
	
	/* add undo item: { undo:[function, args . . .], redo:[function, args . . .] } */
	addUndo:function(item){
		if(this.playing) this.stop();
	
		if(!this._undoing){
			this._undo.push(item);
			this._redo.length = 0;
			this.undoChanged();
			
			// limit undo buffer size
			if(this._undo.length > 100){
				this._undo.splice(0, 1);
			}
		}	
	},
	performUndo:function(){
		if(this._undo.length){
			var item = this._undo.pop();
			this._redo.push(item);
			this._undoing = true;
			if(item instanceof Array){
				for(var i = item.length - 1; i >= 0; i--){
					var uitem = item[i];
					if(uitem.name) console.log('<< '+uitem.name);
					uitem.undo[0].apply(editScene, uitem.undo.slice(1));				
				}
			} else {
				if(item.name) console.log('<< '+item.name);
				item.undo[0].apply(editScene, item.undo.slice(1));
			}
			this._undoing = false;
			this.undoChanged();
			this.refreshProps();
		}
	},
	performRedo:function(){
		if(this._redo.length){
			var item = this._redo.pop();
			this._undo.push(item);
			this._undoing = true;
			if(item instanceof Array){
				for(var i = 0; i < item.length; i++){
					var uitem = item[i];
					if(uitem.name) console.log('>> '+uitem.name);
					uitem.redo[0].apply(editScene, uitem.redo.slice(1));				
				}
			} else {
				if(item.name) console.log('>> '+item.name);
				item.redo[0].apply(editScene, item.redo.slice(1));
			}
			this._undoing = false;
			this.undoChanged();
			this.refreshProps();
		}
	},

/* ------------------- ------------------- ------------------- ------------------- ------------------- Mouse handling */
	
	mouseDown:function(e){
		this.lazyMouse = new THREE.Vector2(e.pageX, e.pageY);
		this.mouseMoved = false;
		
		this.ctrl = e.ctrlKey;
		this.shift = e.shiftKey;
		this.alt = e.altKey;
		
		// ignore right button
		if(e.button === 2 || !this.canvasInteractionsEnabled || $(e.target).hasClass('object-label')) return;
		
		// blur input boxes
		if(e.target.nodeName.toLowerCase()=='canvas') editScene.blur();

		/*if(this._pasteMode && this.intersectingPaste && !this.ctrl){
			this.startPasteMove();
		} else if(this.canStroke) { 
			this.startStroke();
		} else if(this.movingMaskEnabled && this.intersectingMask){
			this.startMaskMove();
		}*/
	},

	mouseUp:function(e){
		/*
		if(this.stroking){
			this.finishStroke();
		} else if(this.movingMask){
			this.finishMaskMove();
		} else if(this.movingPaste){
			this.finishPasteMove();
		} 
		*/

		if(this.disableCanvasInteractionsOnRelease){
			this.disableCanvasInteractions();
			this.disableCanvasInteractionsOnRelease = false;
		}
		
		// hide opened menus
		$('.submenu').hide();
		
		if(window.editorHidden){
			window.editorHidden = false;
			$('.editor.ui-widget-header').show();
		}
		
		if(!this.mouseMoved && e.target.nodeName == 'CANVAS' && e.button === 0){
			var p = new THREE.Vector3(2 * (e.clientX / window.innerWidth) - 1, 1 - 2 * ( e.clientY / window.innerHeight ), 0);
			p.unproject(this.camera);
			this.raycaster.set(this.camera.position, p.sub(this.camera.position).normalize());
			var intersects = this.raycaster.intersectObject(this.container, true);
			// clicked on object
			if(intersects.length){
				//console.log(intersects);
				this.objectClicked(intersects[0].object);
			// clicked in empty space
			} else if(!(this.shift || this.ctrl || this.alt)){
				this.objectClicked(null);
			}
		}
	},

	mouseMove:function(e){
		this.mouseCoord = { x: e.pageX, y: e.pageY };
		
		if(this.lazyMouse){
			var lazyMouse = new THREE.Vector2(e.pageX, e.pageY);
			var dist = this.lazyMouse.distanceToSquared(lazyMouse);
			if(dist > 5){
				this.mouseMoved = true;
				this.lazyMouse = null;
			}
		}
		
		/*
		// trace ray
		var screenPoint = new THREE.Vector3((this.mouseCoord.x / window.innerWidth ) * 2 - 1, -(this.mouseCoord.y / window.innerHeight ) * 2 + 1, 1.0);
		screenPoint.unproject(this.camera);
		this.raycaster.set(this.camera.position, screenPoint.sub(this.camera.position).normalize());

		// mask intersection
		if(this._pasteMode){
			this.intersectingPaste = this.raycaster.intersectObject(this.paste, false);
			this.intersectingPaste = this.intersectingPaste.length ? this.intersectingPaste[0] : null;
			this.intersectingMask = null;
		} else {
			this.intersectingMask = this.raycaster.intersectObject(this.maskBox, false);
			this.intersectingMask = this.intersectingMask.length ? this.intersectingMask[0] : null;
			this.intersectingPaste = null;
		}
		
		this.canStroke = !this.ctrl && !this.playing && !this.movingMaskEnabled && !this.movingMask && (this.intersectingMask);
		
		if(this.stroking){
			var lazyMouse = new THREE.Vector2(e.pageX, e.pageY);
			var dist = this.lazyMouse.distanceToSquared(lazyMouse);
			if(dist > 5){
				this.lazyMouse = lazyMouse;
				this.continueStroke();
			}
			
			if(!window.editorHidden){
				window.editorHidden = true;
				$('.editor.ui-widget-header').hide();
			}
		} else if(this.movingMask){
			this.continueMaskMove();
			if(!window.editorHidden){
				window.editorHidden = true;
				$('.editor.ui-widget-header').hide();
			}
		} else if(this.movingPaste){
			this.continuePasteMove();
			if(!window.editorHidden){
				window.editorHidden = true;
				$('.editor.ui-widget-header').hide();
			}
		} else if(!(this.controls.busy())) { 
			this.controls.panEnabled = this.controls.zoomEnabled = !(this.movingMask || this.movingMaskEnabled);
			this.controls.rotateEnabled = (!this.intersectingPaste || this.ctrl) && !this.canStroke && this.controls.zoomEnabled;
		}*/
	},

	/* move selection in camera-aligned coord sys */
	moveTool:function(dx, dy){
		// scale
		if(this.alt && this.ctrl){
			var s = 0.25 * (dx ? dx : dy);
			this.scaleSelectionBy(new THREE.Vector3(s, s, s));
		// regular rotate
		} else if(this.alt){
			var r = new THREE.Vector3();
			r.set(dy,dx,null);
			this.rotateSelectionBy(r);
		// alternate rotate
		} else if(this.ctrl){
			var r = new THREE.Vector3();
			r.set(0,dy,dx);
			this.rotateSelectionBy(r);
		// move
		} else {
			// find which plane the camera is aligned with
			var camVector = new THREE.Vector3(0,0, -1);
			var camUp = new THREE.Vector3(0,1,0);
			camVector.applyQuaternion(this.camera.quaternion);
			camUp.applyQuaternion(this.camera.quaternion);
	
			var planes = [
				new THREE.Vector3(1,0,0),
				new THREE.Vector3(-1,0,0),
				new THREE.Vector3(0,1,0),
				new THREE.Vector3(0,-1,0),
				new THREE.Vector3(0,0,1),
				new THREE.Vector3(0,0,-1) ];
	
			var minDot = 1, minDotIndex = -1, dot;
			for(var i = 0; i < 6; i++){
				dot = camVector.dot(planes[i]);
				if(dot < minDot){ minDot = dot; minDotIndex = i; }
			}
			
			// additional dots for up/down positions
			var xdot = planes[0].dot(camUp);
			var zdot = planes[4].dot(camUp);
			
			var xdir = new THREE.Vector3(), ydir = new THREE.Vector3();
			switch(minDotIndex){
			case 0: xdir.set(0,0,-1); ydir.set(0,1,0); break;
			case 1: xdir.set(0,0,1); ydir.set(0,1,0); break;
			case 4: xdir.set(1,0,0); ydir.set(0,1,0); break;
			case 5: xdir.set(-1,0,0); ydir.set(0,1,0); break;
			case 2:
				if(Math.abs(zdot) > Math.abs(xdot)){
					if(zdot < 0){
						xdir.set(1,0,0); ydir.set(0,0,-1);
					} else {
						xdir.set(-1,0,0); ydir.set(0,0,1);
					}
				} else {
					if(xdot < 0){
						xdir.set(0,0,-1); ydir.set(-1,0,0);
					} else {
						xdir.set(0,0,1); ydir.set(1,0,0);
					}
				}
				break;
			case 3:
				if(Math.abs(zdot) > Math.abs(xdot)){
					if(zdot < 0){
						xdir.set(-1,0,0); ydir.set(0,0,-1);
					} else {
						xdir.set(1,0,0); ydir.set(0,0,1);
					}
				} else {
					if(xdot < 0){
						xdir.set(0,0,1); ydir.set(-1,0,0);
					} else {
						xdir.set(0,0,-1); ydir.set(1,0,0);
					}
				}
				break;
			}
			
			xdir.multiplyScalar(dx);
			ydir.multiplyScalar(dy);
			var posInc = xdir.clone().add(ydir);
			
			this.moveSelectionBy(posInc);
		}
		this.refreshProps();
	},


/* ------------------- ------------------- ------------------- ------------------- ------------------- Add, copy, paste, delete */

	objectAddedRecusive:function(obj){
		if(obj.helper && !obj.helper.parent){
			this.scene.add(obj.helper);
		}
		for(var i = 0; i < obj.children.length; i++){
			this.objectAddedRecusive(obj.children[i]);
		}
	},
	
	objectDeletedRecusive:function(obj){
		if(obj.htmlLabel){
			obj.htmlLabel.remove();
			delete obj.htmlLabel;
		}
		if(obj.htmlRow){
			obj.htmlRow.remove();
			delete obj.htmlRow;
		}
		if(obj.helper && obj.helper.parent){
			obj.helper.parent.remove(obj.helper);
		}
		if(obj.shadowMap){
			// renderer.webgl.clearTarget(obj.shadowMap);
			obj.shadowMap.dispose();
			obj.shadowMap = null;
		}

		for(var i = 0; i < obj.children.length; i++){
			this.objectDeletedRecusive(obj.children[i]);
		}
	},

	deleteObjects:function(objs){
		for(var i = 0; i < objs.length; i++){
			var obj = objs[i];
			if(obj.selected) this.selectObject(obj, false);
			this.objectDeletedRecusive(obj);
			obj.parent.remove(objs[i]);
		}
		this.updateLights = true;
		this.refreshScene();
		this.refreshAssets();
		this.refreshProps();
	},
	
	addObjects:function(objParArr){
		for(var i = 0; i < objParArr.length; i++){
			var obj = objParArr[i][0];
			var p = objParArr[i][1];
			p.add(obj);
			this.objectAddedRecusive(obj);
		}
		this.updateTextLabels(this.container, 0);
		this.refreshScene();
		this.refreshAssets();
		this.updateLights = true;
	},
	
	deleteSelection:function(){
		var doArr = [];
		var undoArr = [];
		for(var i = 0; i < this.selectedObjects.length; i++){
			var obj = this.selectedObjects[i];
			if(obj.isAnchor) continue;
			undoArr.push([obj, obj.parent]);
			doArr.push(obj);
		}
		
		if(doArr.length) { 
			this.addUndo({name:"delete", redo:[this.deleteObjects, doArr], undo:[this.addObjects, undoArr] });
			this.deselectAll();
			this.deleteObjects(doArr);
		}
	},
	
	copySelection:function(){
		var toCopy = [];
		var copiedAssets = {};
		for(var i = 0; i < this.selectedObjects.length; i++){
			var obj = this.selectedObjects[i];
			if(obj.isAnchor) continue;
			toCopy.push(obj);
		}
		// check hierarchy
		for(var i = toCopy.length - 1; i >= 0; i--){
			var obj = toCopy[i];
			for(var j = toCopy.length - 1; j >= 0; j--){
				if(i == j) continue;
				var obj2 = toCopy[j];
				if(obj2.isDescendentOf(obj)){
					toCopy.splice(i, 1);
					break;
				}
			}
		}
		if(!toCopy.length) return;
		// copy assets
		function addAssetsRecursive(obj){
			if(obj instanceof THREE.PointCloud){
				if(!copiedAssets[obj.asset.name]){
					copiedAssets[obj.asset.name] = obj.asset.importedAsset;
				}
			}
			for(var j = 0; j < obj.children.length; j++){
				addAssetsRecursive(obj.children[j]);
			}
		}
		for(var i = toCopy.length - 1; i >= 0; i--){
			var obj = toCopy[i];
			addAssetsRecursive(obj);
			toCopy[i] = obj.serialize(null);
		}
		
		// copied
		this.sceneCopyItem = {objects:toCopy,assets:copiedAssets}; 

		// store
		localStorage_setItem("sceneCopy", JSON.stringify(this.sceneCopyItem));
		console.log(this.sceneCopyItem);
		
	},
	
	cutSelection:function(){
		this.copySelection();
		this.deleteSelection();
	},
	
	pasteSelection:function(e){
		if(this.objectPickMode){ this.objectPickMode(null); }
		
		var pasteTarget;
		if(e.shiftKey || (e.target && e.target.id == 'edit-paste-into')) pasteTarget = this.selectedObjects.length ? this.selectedObjects[0] : this.container;
		else pasteTarget = this.selectedObjects.length ? this.selectedObjects[0].parent : this.container;
		
		this.deselectAll();
		
		// import assets
		var importedAssetsUndoItem = [];
		for(var aname in this.sceneCopyItem.assets){
			var asset = this.sceneCopyItem.assets[aname];
			if(!assets.cache.files[aname]){
				asset = _.deepClone(asset, 100);
				importedAssetsUndoItem.push({name:"addAsset",undo:[editScene.deleteAsset, asset],
											redo:[editScene.importSceneAsset, asset]});
	      		editScene.importSceneAsset(asset);
			}
		}
		
		var addedObjects = this.populateObject(pasteTarget, this.sceneCopyItem.objects, { helpers: true, keepSceneCamera:true, noNameReferences:true });
		this.updateLights = true;
		var doAdd = [];
		var undoAdd = [];
		for(var i = 0; i < addedObjects.length; i++){
			var obj = addedObjects[i];
			if(obj instanceof THREE.Camera && obj.isDefault) obj.isDefault = false;
			var isTopLevel = (this.sceneCopyItem.objects.indexOf(obj.def) != -1);
			if(isTopLevel){
				doAdd.push([obj, pasteTarget]);
				undoAdd.push(obj);
			}
		}
		
		if(importedAssetsUndoItem.length){
			importedAssetsUndoItem.push({name:"paste", redo:[this.addObjects, doAdd], undo:[this.deleteObjects, undoAdd] });
			this.addUndo(importedAssetsUndoItem);
		} else {
			this.addUndo({name:"paste", redo:[this.addObjects, doAdd], undo:[this.deleteObjects, undoAdd] });
		}
		
		this.refreshScene();
		
		this.updateTextLabels(this.container, 0);
		for(var i = 0; i < addedObjects.length; i++) {
			if(this.sceneCopyItem.objects.indexOf(addedObjects[i].def) != -1){
				this.selectObject(addedObjects[i], true);
			}
		}
		this.selectionChanged();
		this.controls.center.copy(pasteTarget.parent.localToWorld(pasteTarget.position.clone()));
		this.camera.lookAt(this.controls.center);
		this.refreshAssets();
		//this.controls.focus(pasteTarget, true);
	},
	
/* ------------------- ------------------- ------------------- ------------------- ------------------- Reparent */
	
	parentObjects:function(objArr){
		for(var i = 0; i < objArr.length; i++){
			var obj = objArr[i][0];
			var np = objArr[i][1];
			np.add(obj);
		}
		this.refreshScene();
	},
	
	reparentDraggedRowsTo:function(newParent){
		//console.log("Reparent ",this.reparentObjects," to ",newParent);
		
		var doArr = [];
		var undoArr = [];
		for(var i = 0; i < this.reparentObjects.length; i++){
			var obj = this.reparentObjects[i];
			undoArr.push([obj, obj.parent ]);
			doArr.push([obj, newParent]);
		}
		this.addUndo({name:"reparent", redo:[this.parentObjects, doArr], undo:[this.parentObjects, undoArr] });
		this.parentObjects(doArr);
	},
	
/* ------------------- ------------------- ------------------- ------------------- ------------------- Container & display functions */

	/* called after new doc is created to recreate container with axis */
	createContainer:function(){
		// clear container
		if(this.container){
			var children = this.scene.recursiveRemoveChildren([this.camera, this.axis, this.ambient, this.scene.fog]);
		} else if(!this.axis){
			var axis = this.axis = new THREE.AxisHelper(10);
			axis.raycast = function(){ return; };// skip raycase
			this.scene.add(axis);
		}
		
		this.container = new THREE.Object3D();
		this.container.visibleRecursive = true;
		this.scene.add(this.container);
		
		// add placeholder shadow lights
		// couldn't get adding dynamic shadows after scene has been created any other way
		var maxShadows = 8;
		this.placeHolderLights = [];
		while(maxShadows){
			var sun = new THREE.DirectionalLight(0x0, 1);
			sun.castShadow = true;
			sun.shadowMapWidth = sun.shadowMapHeight = 128;
			this.scene.add(sun);
			this.placeHolderLights.push(sun);
			maxShadows--;
		}

	},
	
	resetZoom:function(){
		this.camera.position.set(512, 512, 512);
		this.camera.lookAt(new THREE.Vector3(0,0,0));
		this.controls.focus(this.container, true);
	},
	
	/* updates text labels on all elements in container, recursive */
	updateTextLabels: function(cont, depth){
		if(!cont) return;
		var p = new THREE.Vector3();
		var windowInnerWidth = window.innerWidth;
		var windowInnerHeight = window.innerHeight;
		for(var i = 0; i < cont.children.length; i++){
			var obj = cont.children[i];
			if(obj.isHelper){
				if(obj['update']) obj.update();
				continue;
			}
			if(!obj.htmlLabel){
				obj.htmlLabel = $('<label id="'+obj.uuid+'" class="object-label" style="color:'+this.automaticColorForIndex(obj.id, 1, false)+'"/>').text(obj.name);
				if(obj.isAnchor) obj.htmlLabel.css({'background-color':'transparent', 'font-size':'8px','font-weight':'normal'});
				var type = (obj instanceof THREE.PointCloud) ? 'PixelBox' : (obj.def ? obj.def.asset : 0);
				if(type) obj.htmlLabel.addClass(type);
				if(obj.isTemplate) obj.htmlLabel.addClass('template');
				if(!obj.visible) obj.htmlLabel.css({visibility: 'hidden'});
				obj.htmlLabel.click(this.objectLabelClicked);
				$(document.body).append(obj.htmlLabel);
			}
			p.set(0,0,0);
			obj.localToWorld(p);
			p.project(this.camera);
			var offs = depth * (obj.isAnchor ? -5 : 8);
			var lw, lh;
			if(obj.htmlLabel.labelWidth){
				lw = obj.htmlLabel.labelWidth;
				lh = obj.htmlLabel.labelHeight;
			} else {
				obj.htmlLabel.labelWidth = lw = obj.htmlLabel.width();
				obj.htmlLabel.labelHeight = lh = obj.htmlLabel.height();
			}
			var x = Math.max(0, Math.min(windowInnerWidth - lw - 20, 
								Math.floor(windowInnerWidth * 0.5 * p.x + windowInnerWidth * 0.5 - lw * 0.5)));
			var y = Math.max(0, Math.min(windowInnerHeight - lh - 10, 
					Math.floor(windowInnerHeight * 0.5 - windowInnerHeight * 0.5 * p.y - lh * 0.5) + offs));
			if(p.z < 0 || p.z > 1.0) {
				y = 0;
			}
			if(obj.htmlLabel.labelX != x || obj.htmlLabel.labelY != y){
				obj.htmlLabel.offset({top:(obj.htmlLabel.labelY = y), left:(obj.htmlLabel.labelX = x)});
				obj.htmlLabel.css({zIndex: parseInt(1 + (1 - p.z) * 10000)});
			}
			this.updateTextLabels(obj, depth + 1);
		}
	},

/* ------------------- ------------------- ------------------- ------------------- ------------------- Util */


	/* used during loading */
	populateObject: Scene.prototype.populateObject,

	linkObjects: Scene.prototype.linkObjects,
	
	getObjectFromPool:function(){ return null; },
	
	hashStringToInt:function(s){
	  return s.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);              
	},
	
	automaticColorForIndex: function(id, alpha, returnColorObject){
		var i = (typeof(id) == 'string' ? this.hashStringToInt(id) : id);
	
		var hue = ((i + (i % 2 ? 5 : 1)) % 10) * 0.1;
		var sat = 0.9 - 0.6 * (Math.floor(i * 0.1) % 5) / 5;
		var color = new THREE.Color();
		color.setHSL(hue, sat, 0.6);
		
		if(returnColorObject) return color;
		
		return 'rgba('+Math.floor(color.r * 255.0)+','+Math.floor(color.g * 255.0)+','+Math.floor(color.b * 255.0)+','+alpha+')';
	},
	
	download:function(filename, contents) {
		if(typeof(contents) == 'object') contents = JSON.stringify(contents);
		if(chrome && chrome.storage){
			chrome.fileSystem.chooseEntry({type: 'saveFile', suggestedName: filename}, function(writableFileEntry) {
			    writableFileEntry.createWriter(function(writer) {
			      writer.onwriteend = function(e) {
			      	this.onwriteend = null;
			      	this.truncate(this.position);
			        console.log('write complete');
			      };
			      writer.write(new Blob([[contents]], {type: 'application/json'}));
			    });
			});
		} else {
			// bounce the file off of server
			var form = $('<form action="downloadFile.php" method="post" target="_blank"><input type="hidden" name="filename"/><input type="hidden" name="data"/></div>');
			$('input[name=filename]', form).val(filename);
			$('input[name=data]', form).val(contents);
			form[0].submit();
		}
	},

/* ------------------- ------------------- ------------------- ------------------- ------------------- Document functions */

	/* clear localStore */
	resetLocalStorage:function(){
		$('<div id="editor-reset" class="editor">\
		<div class="center">This will reset the editor\'s stored preferences and stored "Hold" object.</div>\
		</div>').dialog({
	      resizable: false, width: 400, height:220, modal: true, dialogClass:'no-close', title:"Reset LocalStorage?",
	      buttons: { 
	      "Cancel": function() { 
	      	$(this).dialog("close"); 
	      },
	      "Reset": function() { 
	      	localStorage_clear();
	      	$(this).dialog("close"); 
	      	if(chrome && chrome.storage){
		      	chrome.runtime.reload();
	      	} else {
	      		window.location.reload();
	      	}
	      } },
	      close: function(){ $(this).remove(); editScene.enableCanvasInteractions(true); }
		});
		editScene.disableCanvasInteractions(true);
	},
	
	/* store localStore */
	holdDoc:function(){	
		function doHold(){
			var data = editScene.exportScene(true, false);
			localStorage_setItem('holdScene', data);
		}
		
		if(localStorage_getItem('holdScene')){
			$('<div id="editor-hold" class="editor">\
			<div class="center">This will replace current "Hold" scene.</div>\
			<span class="info">Hold scene is auto-loaded on editor start.</span>\
			</div>').dialog({
		      resizable: false, width: 400, height:220, modal: true, dialogClass:'no-close', title:"Replace Hold?",
		      buttons: { 
		      "Replace": function() { 
		      	doHold();
		      	$(this).dialog("close"); 
		      },
		      "Cancel": function() { 
		      	$(this).dialog("close"); 
		      }
		      },
		      close: function(){ $(this).remove(); editScene.enableCanvasInteractions(true); }
			});
			editScene.disableCanvasInteractions(true);
		} else doHold();
	},
	
	/* restore */
	fetchDoc:function(){
		var data = localStorage_getItem('holdScene');
		if(!data) return;
		
		$('<div id="editor-reset" class="editor">\
		<div class="center">Ths will replace current scene with the one stored in "Hold".</div>\
		</div>').dialog({
	      resizable: false, width: 400, height:220, modal: true, dialogClass:'no-close', title:"Restore from Hold?",
	      buttons: { 
	      "Cancel": function() { 
	      	$(this).dialog("close"); 
	      },
	      "Restore": function() {
	      	editScene.newDocFromData(JSON.parse(data));
	      	$(this).dialog("close"); 
	      } },
	      close: function(){ $(this).remove(); editScene.enableCanvasInteractions(true); }
		});
		editScene.disableCanvasInteractions(true);
	},

	/* export doc */
	saveDoc:function(){
		function refresh(){
			var single = $('#editor-save #export-single')[0].checked;
			var compress = $('#editor-save #export-smaller')[0].checked;
			$('#drop-files').empty();
			
			var file = $('<span class="file scene handcursor"/>').text(editScene.doc.name+'.scene');
			file.click(function(){ editScene.download(editScene.doc.name+'.scene', editScene.exportScene(single, compress)); });
			$('#drop-files').append(file);
			
			if(!single){
				for(var assetName in assets.cache.files){
					var assetFileName = assetName+'.b64';
					var asset = assets.cache.files[assetName];
					file = $('<span class="file handcursor"/>').text(assetFileName);
					file.click((function(assetFileName,asset,compress){
						return function(){ editScene.download(assetFileName, editScene.exportAsset(asset, !compress, compress)); };})(assetFileName,asset,compress));
					$('#drop-files').append(file);
				}
			}			
		}
	
		var dlg = $('<div id="editor-save" class="editor">\
		<div class="center">\
		<input type="radio" id="export-faster" name="export-compress" value="false"/><label for="export-faster">Faster load / bigger file</label>\
		<span class="separator-left"/>\
		<input type="radio" id="export-smaller" name="export-compress" value="true"/><label for="export-smaller">LZString - compressed</label><hr/>\
		<input type="radio" id="export-single" name="export-single" value="true"/><label for="export-single">Single file</label>\
		<span class="separator-left"/>\
		<input type="radio" id="export-multiple" name="export-single" value="false"/><label for="export-multiple">Separate assets</label><hr/>\
		<span class="info">Left-click to save files</span>\
		<div id="drop-files"/>\
		</div>\
		</div>');
		
		var opt = localStorage_getItem('export-compress');
		$('#export-'+(opt === 'true' ? 'smaller' : 'faster'), dlg)[0].checked = true;
		opt = localStorage_getItem('export-single');
		$('#export-'+(opt === 'false' ? 'multiple' : 'single'), dlg)[0].checked = true;
		$('#export-faster,#export-smaller', dlg).change(function(e){ localStorage_setItem('export-compress', $(this).val().toString()); refresh(); });
		$('#export-single,#export-multiple', dlg).change(function(e){ localStorage_setItem('export-single', $(this).val().toString()); refresh(); });
		
		editScene.disableCanvasInteractions(true);
		
		dlg.dialog({
	      resizable: false, width: 550, height:400, modal: true, dialogClass:'no-close', title:"Export",
	      buttons: { OK: function() { $(this).dialog("close"); } },
	      open: refresh,
	      close: function(){ $(this).remove(); editScene.enableCanvasInteractions(true); }
		});

	},

	/* export doc */
	loadDoc:function(){
		$('.ui-dialog .editor').dialog("close");

		$('<div id="editor-load" class="editor">\
		<span class="info">Drag &amp; drop files below.</span>\
		<span class="info">Accepting .scene file to load scene, and .b64 files to load or replace PixelBox assets.</span>\
		<span class="info">This operation is not undo-able.</span>\
		<div id="drop-files"/>\
		</div>').dialog({
	      resizable: false, width: 400, height:400, modal: true, dialogClass:'no-close', title:"Import",
	      buttons: { 
	      	"Import": function() {
	      	
	      		// unload assets first if loading a scene
	      		for(var i in editScene.toImport){
		      		if(editScene.toImport[i].name.indexOf('.scene') > 0){
		      			//editScene.newDoc(true, false);
			      		//assets.unload();
			      		editScene.resetAssets();
			      		break;
		      		}
	      		}
	      	
	      		var reader = new FileReader();
	      		reader.onload = editScene.fileImported;
	      		reader.readAsText(editScene.toImport[0]);
		      	
		      	$(this).dialog("close"); 
	      	},
	      	"Cancel": function() { 
	      		$(this).dialog("close"); 
	      	},
	      },	      
	      close: function(){ $(this).remove(); editScene.enableCanvasInteractions(true); }
		});
		
		editScene.disableCanvasInteractions(true);
	},

	/* new document */
	newDoc:function(e){
		if(e === true){
			this.doc = {
				name: "newScene",
				clearColor: new THREE.Color(0x333333),
				ambient: new THREE.Color(0),
				fogColor: new THREE.Color(0),
				fogNear: 1000,
				fogFar: 10000
			};
			this.clearColor = this.doc.clearColor.getHex();
			this.deselectAll();
			$('.object-label').remove();
			this.createContainer();
			this.newDocFromData(_.deepClone(this.defaultSceneDef,100));
			this.refreshAssets();
			this.refreshProps();
			this.refreshScene();
		} else {
			if(!$('#new-doc').length){
				$('body').append('<div id="new-doc" class="center no-close">\
				Create new scene?\
				</div>');
			    $('#new-width,#new-height,#new-depth').spinner({min: 4, max: 256, step: 4 });
			}
	      	editScene.disableCanvasInteractions(true);
			$('#new-doc').dialog({
		      resizable: false, width: 250, height:260, modal: true, dialogClass:'no-close', title:"Create New",
		      buttons: {
		        "Create": function() {
			      editScene.resetAssets();
		          editScene.newDoc(true);
		          $(this).dialog("close");
		        },
		        Cancel: function() {
		          $(this).dialog("close");
		        }
		      },
		      close: function(){ 
		      	editScene.enableCanvasInteractions(true);
		      	$(this).remove();
		      }
		    });
	    }
	},

	/* imports frames from JSON'ed object */
	newDocFromData:function(dataObject){
	
		this.deselectAll();
		$('.object-label').remove();
		this.createContainer();
		
		this.doc = dataObject;
		
		// update props
		this.doc.clearColor = new THREE.Color(this.doc.clearColor ? parseInt(this.doc.clearColor,16) : 0);
		this.doc.ambient = new THREE.Color(this.doc.ambient ? parseInt(this.doc.ambient,16) : 0);
		this.doc.fogColor = new THREE.Color(this.doc.fogColor ? parseInt(this.doc.fogColor,16) : 0);
		this.clearColor = this.doc.clearColor.getHex();
		this.ambient.color.copy(this.doc.ambient);
		this.scene.fog.color.copy(this.doc.fogColor);
		this.scene.fog.near = this.doc.fogNear;
		this.scene.fog.far = this.doc.fogFar;
		
		// add assets to cache if needed
		for(var i in dataObject.assets){
			var asset = dataObject.assets[i];
			// compressed PixelBox asset
			if(typeof(asset) == 'string'){
				var json = LZString.decompressFromBase64(asset);
				if(!json){
					console.error("Failed to LZString decompressFromBase64: ", asset);
					continue;
				}
				try {
					asset = JSON.parse(json);
				} catch(e){
					console.error("Failed to parse JSON ",e,json);
				}
			}
			// add asset to cache if needed
			if(!assets.cache.get(asset.name)){
				asset.importedAsset = _.deepClone(asset, 100);
				assets.cache.add(asset.name, asset);
				THREE.PixelBox.prototype.processPixelBoxFrames(asset);
			}
		}
		
		// populate
		var opts = { helpers: true, keepSceneCamera:true, noNameReferences: true, templates: dataObject.templates };
		var addedObjects = this.populateObject(this.container, dataObject.layers, opts);
		if(dataObject.containsTemplates){
			for(var ti = 0; ti < dataObject.containsTemplates.length; ti++){
				var td = dataObject.templates[dataObject.containsTemplates[ti]];
				if(td) this.populateObject(this.container, [ dataObject.templates[dataObject.containsTemplates[ti]] ], opts);
			}
		}
		this.linkObjects(addedObjects, this.container);
		this.updateLights = true;
		
		// clear undo queue
		this.initUndo();
		this.resetZoom();
		
		// refresh
		this.refreshScene();
		this.refreshAssets();
		this.refreshProps();
		
		this.showMessage(this.doc.name);
	},
	
	createDataObject:function(options){
		var obj = {
			name:(options['name'] ? options['name'] : null),
			assets:(options['assets'] ? options['assets'] : {})
		};
		
		return obj;
	},
	
	onDragFilesOver:function(e){
		e.preventDefault();
		e.stopPropagation();
		if(e.type == 'dragover' && !$('#editor-load').length){
			editScene.toImport = [];
			editScene.loadDoc();
		}
	},
	
	onDropFiles:function(e){
		e.preventDefault();
		e.stopPropagation();
		document.body.focus();
		var evt = e.originalEvent;
		var dt = evt.dataTransfer;
		if(dt){
			var added = $('#drop-files span.file');
			for(var i = 0; i < dt.files.length; i++){
				var nfd = dt.files[i];
				var ext = nfd.name.substr(nfd.name.lastIndexOf('.')+1);
				if(!nfd.size || (ext != 'b64' && ext != 'scene')) continue;
				
				// skip if already there
				var skip = false;
				for(var f = 0; f < added.length; f++){
					var fd = $(added[f]).data();
					if(fd && fd.name == nfd.name) {
						skip = true;
						break;
					}
				}
				if(skip) continue;
				// add
				var ax = $('<a>[X]</a>&nbsp;').click(function(){
					var name = $(this).parent().data().name;
					$(this).parent().remove();
					for(var i = 0; i < editScene.toImport.length; i++){ 
						if(editScene.toImport[i].name == name) { editScene.toImport.splice(i, 1); return; }
					}
				});
				var span = $('<span class="file"></span>').addClass(ext).text(nfd.name).data(nfd).prepend(ax);
				added.push(span[0]);
				// scene imported last
				if(ext == 'scene'){ // first
					editScene.toImport.push(nfd);
				// assets first
				} else {
					editScene.toImport.splice(0, 0, nfd);
				}
				$('#drop-files').append(span);
			}
			//console.log(dt);
		}
	},
	
	/* called for each dragged in imported file */
	fileImported:function(e){
		var data = e.target.result;
		
		editScene.toImport.splice(0, 1);
	   	
  		// parse
  		if(data.length) {
	  		var err = null;
	  		if(data.substr(0,1) != '{'){
	  			try {
	  				data = LZString.decompressFromBase64(data);
	  				if(!data) throw 1;
	  			} catch(e) {
	  				err = "Unable to LZString decompress string (File size: "+e.loaded+")";
	  			}
	  		}
	  		
	  		if(!err){
	  			try {
	  				data = JSON.parse(data);
	  			} catch(e){ err = "Unable to parse JSON (File size: "+e.loaded+")"; console.error(e); }
	  		}
	  		
	  		if(err){
	      		alert(err);
	      	} else {
		      	//console.log(data);
		      	
		      	// asset
		      	if(data.width){
			     	// replace scene asset with updated one
			     	editScene.importSceneAsset(data);
			    // scene
		      	} else {
			   		editScene.newDocFromData(data);
		      	}	
	      	}
      	}	
      	
      	// next
      	if(editScene.toImport.length){
	   		var reader = new FileReader();
	   		reader.onload = editScene.fileImported;
	   		reader.readAsText(editScene.toImport[0]);
	   	}
	},
	
/* ------------------- ------------------- ------------------- ------------------- ------------------- Scene & asset functions */

	assetUpdated:function(newAsset){
		this.showMessage('<em>'+newAsset.name+'</em> updated');

		var prevAsset = assets.cache.files[newAsset.name];
		if(prevAsset){
			this.addUndo({name:"updateAsset",undo:[this.importSceneAsset, prevAsset],redo:[this.importSceneAsset, newAsset]});
		}
		this.importSceneAsset(newAsset);
	},

	/* called to update placeholders, or to replace existing assets */
	importSceneAsset: function(newAsset){
		if(!newAsset.importedAsset){
			// just imported
			newAsset.importedAsset = _.deepClone(newAsset, 100);
			THREE.PixelBox.prototype.processPixelBoxFrames(newAsset);
     	}
	
		var replaced = [];
		var replaceUndoObjects = { };
		do {
			replaced.length = 0;
			var trav = function(obj3d){
				var newObj = null;
				// Replace placeholder with imported asset
				if(obj3d.isPlaceholder && obj3d.def.asset == newAsset.name){
					newObj = new THREE.PixelBox(newAsset);
					// transplant children
					for(var i = obj3d.children.length - 1; i >= 0; i--){
						var child = obj3d.children[i];
						obj3d.remove(child);
						// anchored child is added to new obj's anchor of same name
						if(child.anchored && newObj.anchors[child.anchored]){
							newObj.anchors[child.anchored].add(child);
						// transplant
						} else {
							newObj.add(child);
							child.anchored = false;
						}
						if(child.def && child.def.target && typeof(child.def.target) == 'string' && newObj.anchors[child.def.target]){
							replaceUndoObjects[child.def.target.uuid] = newObj.anchors[child.def.target];
							child.target = newObj.anchors[child.def.target];
						}
					}
					
				// Replace existing asset
				} else if(obj3d instanceof THREE.PointCloud && obj3d.geometry.data != newAsset && obj3d.geometry.data.name == newAsset.name){
					newObj = new THREE.PixelBox(newAsset);
					// transplant children
					for(var i = obj3d.children.length - 1; i >= 0; i--){
						var child = obj3d.children[i];
						// transplant anchor's children to new anchor with same name
						if(child.isAnchor) {
							replaceUndoObjects[child.uuid] = newObj.anchors[child.name];
							for(var j = child.children.length - 1; j >= 0; j--){
								var subchild = child.children[j];
								child.remove(subchild);
								// anchored subchild is added to new obj's anchor of same name
								if(newObj.anchors[child.name]){
									newObj.anchors[child.name].add(subchild);
								// no mathing anchor in new object, add as child, keep anchor def
								} else {
									newObj.add(subchild);
									subchild.anchored = subchild.def.anchor = child.name;
								}
								// subchild had named target (anchor name)
								if(subchild.def.target && typeof(subchild.def.target) == 'string' && newObj.anchors[subchild.def.target]){
									replaceUndoObjects[subchild.target.uuid] = newObj.anchors[subchild.def.target];
									subchild.target = newObj.anchors[subchild.def.target];
								}
								// update helper
								if(subchild.helper) subchild.helper.update(); 
							}
							// delete html
							if(child.htmlLabel) child.htmlLabel.remove();
							if(child.htmlRow) child.htmlRow.remove();
							child.htmlLabel = child.htmlRow = null;
							
						// regular, non-anchor child
						} else {
							obj3d.remove(child);
							// anchored child is added to new obj's anchor of same name
							if(child.anchored && newObj.anchors[child.anchored]){
								newObj.anchors[child.anchored].add(child);
							// transplant
							} else {
								newObj.add(child);
								child.anchored = false;
							}
							// update helper
							if(child.helper) child.helper.update();
						}						
					}
				}
				
				// populate new object
				if(newObj){
					newObj.anchored = obj3d.anchored;
					newObj.isTemplate = obj3d.isTemplate;
					newObj.visible = obj3d.visible;
					
					// update name
					if(obj3d.name){
						if(obj3d.anchored){
							obj3d.parent.parent[obj3d.name] = newObj;
						} else {
							obj3d.parent[obj3d.name] = newObj;
						}
					}
				
					// copy common props
					newObj.def = obj3d.def;
					newObj.name = obj3d.name;
					newObj.position.copy(obj3d.position);
					newObj.scale.copy(obj3d.scale);
					newObj.rotation.copy(obj3d.rotation);
					
					var layer = newObj.def;
					// copy pixelbox props from def
					if(layer.pointSize != undefined) { 
						newObj.pointSize = layer.pointSize;
					} else {
						var maxScale = Math.max(newObj.scale.x, newObj.scale.y, newObj.scale.z);
						newObj.pointSize = maxScale + 0.1;
					}
					if(layer.alpha != undefined) { 
						newObj.alpha = layer.alpha;
					}			
					if(layer.cullBack != undefined) newObj.cullBack = layer.cullBack;
					if(layer.occlusion != undefined) newObj.occlusion = layer.occlusion;
					if(layer.tint != undefined) { 
						if(layer.tint instanceof String) newObj.tint.set(parseInt(layer.tint, 16));
						else newObj.tint.copy(layer.tint);
					} else {
						newObj.tint.set(0xffffff);
					}
					if(layer.add != undefined) { 
						newObj.addColor.set(parseInt(layer.add, 16));
					} else {
						newObj.addColor.set(0x0);
					}					
					if(layer.stipple != undefined) { 
						newObj.stipple = layer.stipple;
					} else {
						newObj.stipple = 0;
					}
					if(layer.animSpeed != undefined) newObj.animSpeed = layer.animSpeed;
					if(newObj instanceof THREE.PointCloud && layer.animOption != undefined){
						editScene.pixelboxApplyAnimationParams(newObj);
					}					
					
					// add to same parent
					replaced.push([obj3d, newObj]);
				}			
			};
			this.container.traverse(trav);
			
			// replace/reparent objects
			for(var i = 0; i < replaced.length; i++){ 
				var oldObj = replaced[i][0];
				var newObj = replaced[i][1];
				replaceUndoObjects[oldObj.uuid] = newObj;
				var p = oldObj.parent;
				// delete html
				if(oldObj.htmlLabel) oldObj.htmlLabel.remove();
				if(oldObj.htmlRow) oldObj.htmlRow.remove();
				oldObj.htmlLabel = oldObj.htmlRow = null;
				p.remove(oldObj);
				p.add(newObj);
			}
					
		} while(replaced.length);
		
		// dispose of old asset
		/* var oldAsset = assets.cache.get(newAsset.name);
		if(oldAsset){ THREE.PixelBox.prototype.dispose(oldAsset); } */
		
		// add new asset to cache
		assets.cache.add(newAsset.name, newAsset);
		
		// update undo references
		/* editScene.replaceReferencesInUndo(replaceUndoObjects); */
		
		// refresh
		editScene.refreshAssets();
		editScene.refreshScene();
		editScene.refreshProps();
	},
	
	setSceneAmbientColor:function(hex){
		editScene.addUndo({name:'sceneAmbientColor',
			undo:[editScene.setSceneAmbientColor, editScene.doc.ambient.getHexString()],
			redo:[editScene.setSceneAmbientColor, hex]});

		$('#scene-ambient-color').css({backgroundColor: hex});
		editScene.ambient.color.setHex(parseInt(hex,16));
		editScene.doc.ambient.copy(editScene.ambient.color);
	},
	
	setSceneFogColor:function(hex){
		editScene.addUndo({name:'sceneAmbientColor',
			undo:[editScene.setSceneFogColor, editScene.doc.fogColor.getHexString()],
			redo:[editScene.setSceneFogColor, hex]});

		$('#scene-fog-color').css({backgroundColor: hex});
		editScene.scene.fog.color.setHex(parseInt(hex,16));
		editScene.doc.fogColor.copy(editScene.scene.fog.color);
	},
	
	setSceneFogNear:function(val){
		this.addUndo({name:"setFogNear", mergeable:true, undo:[this.setSceneFogNear, this.doc.fogNear], redo:[this.setSceneFogNear, val]});
		this.scene.fog.near = val;
		this.doc.fogNear = val;
	},

	setSceneFogFar:function(val){
		this.addUndo({name:"setFogFar", mergeable:true, undo:[this.setSceneFogFar, this.doc.fogFar], redo:[this.setSceneFogFar, val]});
		this.scene.fog.far = val;
		this.doc.fogFar = val;
	},
	
	setSceneClearColor:function(hex){
		editScene.addUndo({name:'sceneClearColor',
			undo:[editScene.setSceneClearColor, editScene.doc.clearColor.getHexString()],
			redo:[editScene.setSceneClearColor, hex]});

		$('#scene-color').css({backgroundColor: hex});
		editScene.clearColor = parseInt(hex,16);
		editScene.doc.clearColor.setHex(editScene.clearColor);
		localStorage_setItem('editor-scene-bg-color', hex);
	},
	
	setSceneMaxShadows:function(maxShadows){
		this.addUndo({name:"setMaxShadows", mergeable:true, undo:[this.setSceneMaxShadows, this.doc.maxShadows], redo:[this.setSceneMaxShadows, maxShadows]});
		this.doc.maxShadows = maxShadows;
	},
		
	exportScene:function(single, compress){
		var obj = {
			name: this.doc.name,
			maxShadows: this.doc.maxShadows,
			clearColor: this.doc.clearColor.getHexString(),
			ambient: this.doc.ambient.getHexString(),
			fogColor: this.doc.fogColor.getHexString(),
			fogNear: this.doc.fogNear,
			fogFar: this.doc.fogFar,
			layers:[],
			templates:{}
		}
		
		// validate scene names
		var doArr = [];
		var undoArr = [];
		var usedTemplateNames = {};
		this.container.traverse(function(obj3d){
			var usedNames = {};
			for(var i = 0; i < obj3d.children.length; i++){
				var child = obj3d.children[i];
				if(child.isTemplate){
					var childName = child.name;
					if(!childName.length){
						doArr.push([child, '_']);
						undoArr.push([child, '']);
						childName = '_';
					}
					if(usedTemplateNames[childName]){
						doArr.push([child, childName + (usedTemplateNames[childName]++).toString()]);
						undoArr.push([child, childName]);
					} else {
						usedTemplateNames[childName] = 1;
					}
				} else if(child.name.length){
					if(usedNames[child.name]){
						doArr.push([child, child.name + (usedNames[child.name]++).toString()]);
						undoArr.push([child, child.name]);
					} else {
						usedNames[child.name] = 1;	
					}
				}
			}
		});
		if(doArr.length){
			this.addUndo({name:"rename", redo:[this.renameObjects, doArr], undo:[this.renameObjects, undoArr] });
			this.renameObjects(doArr);
		}
				
		var cont = this.container.serialize(obj.templates);
		obj.layers = cont.layers;
		if(cont.containsTemplates) obj.containsTemplates = cont.containsTemplates;
		
		if(single){
			obj.assets = {};
			for(var assetName in assets.cache.files){
				var asset = assets.cache.files[assetName];
				obj.assets[assetName] = editScene.exportAsset(asset, !compress, false);
			}
		}
		
		var ss = JSON.stringify(obj, null, (compress ? undefined : '\t'));
		if(compress){
			ss = LZString.compressToBase64(ss);
		}
		
		return ss;
	},
	
	exportAsset:function(asset, raw, compress){
		var processedAsset = asset;
		asset = asset.importedAsset;
		
		var obj = {
			name:asset.name,
			width:asset.width, height:asset.height, depth:asset.depth,
			floor: asset.floor,
			optimize: asset.optimize,
			smoothNormals: asset.smoothNormals,
			occlusion: asset.occlusion,
			pointSize: asset.pointSize,
			frames:[],
			anchors:asset.anchors,
			anims: asset.anims,
			meta: asset.meta
		};
		
		if(raw){
			if(typeof(asset.frames[0]) == 'string'){
				// frames need to be converted to raw
				var model = new THREE.PixelBox(processedAsset);
				
				// process frames
				for(var f = 0; f < asset.frames.length; f++){
					model.frame = f;
					model.encodeRawFrame(obj, f);
				}				
			// already raw		
			} else {
				obj.frames = asset.frames;
			}
		} else {
			// process frames
			var hw = asset.width * 0.5, hh = asset.height * 0.5, hd = asset.depth * 0.5;
			var c = new THREE.Color();
			for(var f = 0; f < asset.frames.length; f++){
				// convert frame
				var convertedFrame = new Array(asset.width * asset.height * asset.depth);
				var currFrame = asset.frames[f];
				// already converted
				if(typeof(currFrame) == 'string') continue;
				for(var i = 0; i < currFrame.o.length; i++){
					var x = Math.floor(currFrame.p[i * 3] + hw);
					var y = Math.floor(currFrame.p[i * 3 + 1] + hh);
					var z = Math.floor(currFrame.p[i * 3 + 2] + hd);
					var n = new THREE.Vector3(currFrame.n[i * 3], currFrame.n[i * 3 + 1], currFrame.n[i * 3 + 2]);
					c.setRGB(currFrame.c[i * 4],currFrame.c[i * 4 + 1], currFrame.c[i * 4 + 2]);
					var a = currFrame.c[i * 4 + 3];
					var addr = x * asset.height * asset.depth + y * asset.depth + z;
					convertedFrame[addr] = { x:x, y:y, z:z, c:c.getHex(), a:a, b: Math.max(0, n.length() - 1.0) };
				}
				
				// encode
				THREE.PixelBox.encodeFrame(convertedFrame, obj);
			}
			delete obj.assembledFrames;
		}		
		
		if(compress){
			var ss = JSON.stringify(obj);
			if(compress){
				ss = LZString.compressToBase64(ss);
			}
			return ss;	
		}		
		
		return obj;
	},

/* ------------------- ------------------- ------------------- ------------------- ------------------- Scene panel & object picking */

	sceneSortFunc:function(a, b){
		if(a.isHelper) return 1;
		if(b.isHelper) return -1;
		
		// compare types
		var atype = a.isAnchor ? ' anchor' : (a.def ? a.def.asset.toLowerCase() : '?');
		var btype = b.isAnchor ? ' anchor' : (b.def ? b.def.asset.toLowerCase() : '?');
		if(atype < btype) return -1;
		if(btype < atype) return 1;

		// compare names
		var aname = a.name ? (a.name.length ? a.name : '(Object)') : '(Object)';
		var bname = b.name ? (b.name.length ? b.name : '(Object)') : '(Object)';
		if(aname < bname) return -1;
		if(bname < aname) return 1;
		if(a.id < b.id) return -1;
		return 1;
	},
	
	refreshScene:function(){
		var list = $('#scene-list');
		
		var sceneRow = $('#scene', list);
		if(!sceneRow.length){
		 	sceneRow = $('<div class="row" id="scene"><div class="selection"/><div class="droptarget"/><a class="toggle">-</a><label/></div>');
		 	list.append(sceneRow);
 			sceneRow.click(this.objectRowClicked);
 			list.disableSelection();
		} else {
			sceneRow.children('div.row').detach();
		}
		sceneRow.children('label:first').text(this.doc.name);
		
		// traverse
		editScene.container.children.sort(editScene.sceneSortFunc);
		editScene.container.traverse(function(obj3d){
			// don't show helpers
			if(obj3d.isHelper || obj3d == editScene.container || obj3d.parent.isHelper) return;
			
			// sort children
			obj3d.children.sort(editScene.sceneSortFunc);
			
			// create a new row			
			var type = (obj3d.isAnchor ? 'Anchor' : (obj3d instanceof THREE.PointCloud ? obj3d.geometry.data.name : obj3d.def.asset));
			if(!obj3d.htmlRow) {
				var color = editScene.automaticColorForIndex(obj3d.id, 1.0);
				obj3d.htmlRow = $('<div class="row" id="row-'+obj3d.uuid+'">\<div class="selection"/><div class="droptarget"/>\
				<a class="toggle">-</a><div class="tiny-swatch" style="background-color:'+color+'"/><label alt="'+obj3d.uuid+'"/>\
				<span class="type"/></div>');
				
				// type
				obj3d.htmlRow.addClass(obj3d instanceof THREE.PointCloud ? 'PixelBox' : type);
				
				// placeholder
				if(obj3d.isPlaceholder) obj3d.htmlRow.addClass('missing');
				
				// click
				obj3d.htmlRow.click(editScene.objectRowClicked).dblclick(editScene.objectRowDoubleClicked);
				
				// draggable
				if(!obj3d.isAnchor) { 
					var h = $('<div class="row helper" alt="'+obj3d.uuid+'"></div>');
					obj3d.htmlRow.children('label:first').addClass('draggable').draggable({
						//axis:'y',
						appendTo:list,
						containment:list,
						scroll:false,
						delay:300,
						cursorAt: { left: 5, top: 5 },
						revert:'invalid',
						helper:function(){ return h[0]; },
						start:editScene.dragRowStarted,
						stop:editScene.dragRowStopped
					});
				}

			} else {
				obj3d.htmlRow.children('div.row').detach();
			}
			
			// update row
			var name = obj3d.name;
			obj3d.htmlRow.children('label:first').text(name);
			obj3d.htmlRow.children('span.type:first').text(type);
			
			if(obj3d.visible){
				obj3d.htmlRow.removeClass('hidden');
			} else { 
				obj3d.htmlRow.addClass('hidden');
			}
			if(obj3d.isTemplate) { 
				obj3d.htmlRow.addClass('template');
			} else {
				obj3d.htmlRow.removeClass('template');
			}			
			if(obj3d.children.length){
				obj3d.htmlRow.children('a.toggle').css({visibility:'visible'});
			} else {
				obj3d.htmlRow.children('a.toggle').css({visibility:'hidden'});
			}
			if(obj3d.selected) { 
				obj3d.htmlRow.addClass('selected');
				if(obj3d.htmlLabel) obj3d.htmlLabel.addClass('selected');
			} else {
				obj3d.htmlRow.removeClass('selected');
				if(obj3d.htmlLabel) obj3d.htmlLabel.removeClass('selected');
			}
			if(obj3d.isDefault) { 
				obj3d.htmlRow.addClass('default');
			} else {
				obj3d.htmlRow.removeClass('default');
			}
			
			// update object helper and label visibility
			obj3d.visibleRecursive = obj3d.visible && obj3d.parent.visibleRecursive;
			if(obj3d.helper) obj3d.helper.visible = obj3d.visibleRecursive && obj3d.selected;
			if(obj3d.htmlLabel){
				if(obj3d.visibleRecursive){
					obj3d.htmlLabel.css({visibility:'visible'});
				} else {
					obj3d.htmlLabel.css({visibility:'hidden'});
				}
			}
			
			// add to parent row
			var prow = sceneRow;
			if(obj3d.parent != editScene.container){
				prow = $('#row-'+obj3d.parent.uuid, list);
			}
			prow.append(obj3d.htmlRow);
		});
	},

	dragRowStarted:function(event, ui){
		var draggedObj = editScene.container.getObjectByUUID(ui.helper.attr('alt'),true);
		this.autoScrollTimer = setInterval(editScene.autoScrollScenePanel.bind(ui.helper), 300);
		
		// populate helper
		var draggedObjects = [];
		if(draggedObj.selected){
			draggedObjects = editScene.selectedObjects;
		} else {
			draggedObjects = [draggedObj];
		}
		ui.helper.empty();
		for(var i = draggedObjects.length - 1; i >= 0; i--){
			var obj3d = draggedObjects[i];
			if(obj3d.isAnchor) { draggedObjects.splice(i, 1); continue; }
			var color = editScene.automaticColorForIndex(obj3d.id, 1.0);
			var type = obj3d.isAnchor ? 'Anchor' : (obj3d.def ? obj3d.def.asset : '?');
			var h = $('<li><div class="tiny-swatch" style="background-color:'+color+'"/><label/></li>');
//				<span class="type">'+type+'</span></li>');
			h.children('label').text(draggedObjects[i].name);
			ui.helper.append(h);
		}
		//$(event.target).draggable('option','cursorAt',{left:Math.floor(ui.helper.width()*0.5), top:Math.floor(ui.helper.height()*0.5)});
		editScene.reparentObjects = draggedObjects;		
		
		// add droppable class to droppable rows
		$('#scene-list #scene,#scene-list #scene div.row').each(function(i, el){
			var uuid = el.id.substr(4);
			var obj = ((uuid == 'e') ? editScene.container : editScene.container.getObjectByUUID(uuid, true));
			var invalid = false;
			for(var i = 0; i < draggedObjects.length; i++){
				if(obj == draggedObjects[i] || obj.isDescendentOf(draggedObjects[i])){
					invalid = true;
					break;
				}
			}
			if(!invalid){
				var dd = $(el).children('div.droptarget');
				dd.addClass('droppable');
			}
		});
		
		$('#scene-list div.row > div.droptarget.droppable').droppable({
			accept: ".draggable",
			greedy: true,
			//activeClass: "ui-state-hover",
			hoverClass: "active",
			drop: function( event, ui ) {
				//console.log(event, ui);
				var targId = $(event.target).closest('.row').attr('id').substr(4);
				var obj = ((targId == 'e') ? editScene.container : editScene.container.getObjectByUUID(targId, true));
				editScene.reparentDraggedRowsTo(obj);
			}
		});
	},
	
	dragRowStopped:function(event, ui){
		editScene.rowDropTarget = null;
		$('#scene-list div.row > div.droptarget.droppable').removeClass('droppable').droppable('destroy');
		editScene.reparentObjects = null;
		
		if(this.autoScrollTimer) clearInterval(this.autoScrollTimer);
		this.autoScrollTimer = 0;
	},
	
	autoScrollScenePanel:function(){
		var list = $('#scene-list');
		var listHeight = list.height();
		var topOffs = list.offset();
		var rowOffs = this.offset();
		var top = rowOffs.top - topOffs.top;
		var p;
		if(top < 40){
			p = list.scrollTop() + (top - 40);
		} else if(top > listHeight - 40){
			p = list.scrollTop() + (top - (listHeight - 40));	
		}
		list.animate({ scrollTop:p }, 250);
	},
	
	objectRowDoubleClicked:function(e){
		// find object
		var targ = $(e.target);
		var row = targ.closest('.row');
		var rid = row.attr('id');
		var uuid = rid.substr(4);
		
		if(targ.hasClass('toggle')){ return; }
		
		// find object
		var object = (rid == 'scene') ? editScene.container : editScene.container.getObjectByUUID(uuid);
		
		if(object) {
			editScene.controls.focus(object, true);
		}
	},
	objectRowClicked:function(e){
		// find object
		var targ = $(e.target);
		var row = targ.closest('.row');
		var rid = row.attr('id');
		var uuid = rid.substr(4);
		
		e.stopPropagation();
		
		if(targ.hasClass('toggle')){
			row.toggleClass('collapsed');
			var collapsed = false;
			if(row.hasClass('collapsed')){
				targ.text('+');
				collapsed = true;
			} else {
				targ.text('-');
			}
			
			// collapse all on the same level
			if(e.shiftKey){
				var sibs = row.siblings('.row');
				if(collapsed){
					sibs.addClass('collapsed').children('a.toggle').text('+');
				} else {
					sibs.removeClass('collapsed').children('a.toggle').text('-');
				}
				
			}
			return;			
		}
		
		if(rid == 'scene') {
			editScene.deselectAll();
			editScene.refreshProps();
			return;
		}
		
		// find object
		var object = editScene.container.getObjectByUUID(uuid);
		if(!(editScene.shift || editScene.ctrl || editScene.alt)){
			editScene.deselectAll();
			editScene.selectObject(object, true);
		}		
		else if(editScene.ctrl) editScene.selectObject(object, !object.selected);
		else if(editScene.alt) editScene.selectObject(object, false);
		else if(editScene.shift){
			var prevSib = row.prevAll('.row.selected:first');
			if(prevSib.length){
				// select up to this one
				var sibs = prevSib.nextUntil(row, '.row').add(row);
				sibs.each(function(i, el){
					var uuid = el.id.substr(4);
					var obj = editScene.container.getObjectByUUID(uuid);
					editScene.selectObject(obj, true);
				});
			} else {
				prevSib = row.nextAll('.row.selected:first');
				if(prevSib.length){
					var sibs = prevSib.prevUntil(row, '.row').add(row);
					sibs.each(function(i, el){
						var uuid = el.id.substr(4);
						var obj = editScene.container.getObjectByUUID(uuid);
						editScene.selectObject(obj, true);
					});
				} else {
					editScene.selectObject(object, true);
				}
			}
		}
		editScene.selectionChanged();
	},

	objectLabelClicked:function(e){
		var uuid = e.target.id;//.substr(4);
		var obj = editScene.container.getObjectByUUID(uuid);
		editScene.objectClicked(obj);
		editScene.selectionChanged();
	},
	
	objectClicked:function(object){
		if(object){
			if(this.shift) this.selectObject(object, true);
			else if(this.ctrl) this.selectObject(object, !object.selected);
			else if(this.alt) this.selectObject(object, false);
			else {
				this.deselectAll();
				this.selectObject(object, true);
			}
		} else this.deselectAll();
		editScene.selectionChanged();
	},

	deselectAll:function(){
		if(!this.container || this.objectPickMode) return;
		this.selectedObjects.length = 0;
		this.container.traverse(function(obj){ 
			obj.selected = false;
			if(obj.helper) obj.helper.visible = false;
			if(obj.htmlLabel) obj.htmlLabel.removeClass('selected');
			if(obj.htmlRow) obj.htmlRow.removeClass('selected');
		});
		
		window.selectedObject = null;
	},
	
	selectObject:function(obj, select){
		// pick object mode
		if(this.objectPickMode){
			this.objectPickMode(obj);
			return;
		}
		
		obj.selected = select;
		if(obj.helper) obj.helper.visible = select && obj.visibleRecursive;
		var sp = this.selectedObjects.indexOf(obj);
		
		if(select && sp === -1) this.selectedObjects.push(obj);
		else if(!select && sp >= 0) this.selectedObjects.splice(sp, 1);
		
		if(obj.htmlLabel) { 
			if(select) 
				obj.htmlLabel.addClass('selected');
			else 
				obj.htmlLabel.removeClass('selected');
		}
		if(obj.htmlRow) { 
			if(select) 
				obj.htmlRow.addClass('selected');
			else 
				obj.htmlRow.removeClass('selected');
		}
		
		window.selectedObject = this.selectedObjects.length ? this.selectedObjects[this.selectedObjects.length - 1] : null;
	},
	
	selectObjectsByAsset:function(e){
		var assetName = $(e.target).attr('name');
		if(!(editScene.shift || editScene.alt)) editScene.deselectAll();
		editScene.container.traverse(function(obj){
			if(obj instanceof THREE.PointCloud && obj.geometry.data.name == assetName){
				editScene.selectObject(obj, !editScene.alt);
			}
		});
		
		editScene.selectionChanged();
	},
	
	selectionChanged:function(){
		// scroll last selected obj into view in scene panel
		if(this.selectedObjects.length){
			var lastObj = this.selectedObjects[this.selectedObjects.length - 1];
			var list = $('#scene-list');
			var listHeight = list.height();
			var topOffs = list.offset();
			if(lastObj.htmlRow){
				var rowOffs = lastObj.htmlRow.offset();
				var top = rowOffs.top - topOffs.top;
				var p;
				if(top < 0){
					p = list.scrollTop() + top;
				} else if(top > listHeight - 40){
					p = list.scrollTop() + (top - (listHeight - 40));
				}
				//console.log(p);
				list.animate({ scrollTop:p }, 250);
			}
		}
		
		// refresh props panel
		this.refreshProps();
	},

/* ------------------- ------------------- ------------------- ------------------- ------------------- Assets panel */

	
	assetEdit:function(e){
		var row = $(e.target).closest('.row');
		var origAsset = assets.cache.get(row.prop('asset'));
		if(!origAsset){
			// alert("Asset "+row.prop('asset')+" hasn't been loaded.\nTODO: prompt to create new.");
			console.warn("Asset "+row.prop('asset')+" hasn't been loaded.\nTODO: prompt to create new.");
			return;
		}
		var asset = _.deepClone(origAsset.importedAsset, 100);
		console.log("Editing ",asset);
		if(chrome && chrome.storage){
			chrome.app.window.create('editor/editor.html', { 
				id: asset.name,
				outerBounds: {
			      width: Math.max(800, window.outerWidth),
			      height: Math.max(600, window.outerHeight)
			    }
			 }, function(win){
			 	if(!win.contentWindow.loadAsset){
			 		win.contentWindow.loadAsset = asset;
			 		win.contentWindow.sceneEditor = editScene;
			 	}
			 	win.focus();
			});
		} else {
			var win = window.open('editor.html', '_blank');
		 	win.loadAsset = asset;
		 	win.sceneEditor = editScene;
		 	win.focus();
		}
	},

	refreshAssets:function(){
		var prevSelected = $('#asset-list div.selected').attr('id');
		$('#asset-list').children().remove();

		var rows = [];
		var allAssets = {};
		// reset use counts
		for(var key in assets.cache.files){
			assets.cache.files[key].used = 0;
		}
		// traverse and count
		editScene.container.traverse(function(obj3d){
			if(obj3d.isPlaceholder){	
				if(!allAssets[obj3d.def.asset]) allAssets[obj3d.def.asset] = { used: 1, name:obj3d.def.asset, missing:true };
				else allAssets[obj3d.def.asset].used++;
			} else if(obj3d instanceof THREE.PointCloud){
				assets.cache.files[obj3d.geometry.data.name].used++;
			}
		});
		_.extend(allAssets, assets.cache.files);
		// traverse scene to update use counts
		for(var i in allAssets){
			var asset = allAssets[i];
			var id = asset.name.replace(/\W|\s+/g,'-');
			var color = this.automaticColorForIndex(rows.length, 1.0);
			if(asset.missing) color = '#333';
			var newRow = $('<div class="row" id="asset-row-'+id+'"><div class="tiny-swatch" style="background-color:'+color+'"/><label/><span class="used"><a>used '+asset.used+'</a></span></div>');
			newRow.find('label').text(asset.name);
			newRow.prop('asset', asset.name);
			newRow.find('a').attr('name', asset.name).click(editScene.selectObjectsByAsset);
			if(asset.missing) newRow.addClass('missing');
			if(newRow.attr('id') == prevSelected) newRow.addClass('selected');
			newRow.click(this.assetSelect.bind(this));
			newRow.dblclick(this.assetEdit.bind(this));
			rows.push(newRow);
		}
		
		rows.sort(function(a,b){
			if(a.name < b.name) return -1;
			if(a.name > b.name) return 1;
			return 0;
		});	
		
		if(rows.length) rows.push($('<hr/><div style="height:4em;"/>'));
		
		$('#asset-list').append(rows);
		
		if(prevSelected) $('#'+prevSelected).trigger('click');
	},

	assetSelect:function(e){
		var row = $(e.target).closest('.row');
		$('#asset-list .row').removeClass('selected');
		
		if(row.length){
			row = row.get(0);
			$(row).addClass('selected');
		}
	},
	
	renameAsset:function(oldName, newName){
		assets.cache.files[newName] = assets.cache.files[oldName];
		assets.cache.files[newName].name = newName;
		assets.cache.files[newName].importedAsset.name = newName;
		delete assets.cache.files[oldName];
		
		this.refreshAssets();
		this.refreshScene();
		this.refreshProps();
	},
	
	assetRename:function(e){
		var selectedAsset = $('#asset-list .row.selected');
		if(!selectedAsset.length) return;

		var dlg = $('<div id="editor-rename" class="editor">\
		<span class="info">Enter new name for <em/>.</span>\
		<div class="center pad5"><input type="text" id="asset-name" size="20"/></div>\
		</div>');
		
		var oldName = $('label:first', selectedAsset).text();
		$('span.info:first em', dlg).text(oldName);		
		//
		var dlgDef = {
	      resizable: false, width: 330, height:270, modal: true, dialogClass:'no-close', title:"Rename Asset",
	      buttons: { 
	      	"Rename": function() {
	      		var newName = $('#asset-name').val().trim();
	      		newName = newName.substr(0,1).toLowerCase()+newName.substr(1); //lowercase first
	      		var err = null;
	      		if(oldName != newName){
		      		if(!newName.length) err = "Asset name can't be empty";
		      		if(assets.cache.files[newName] != undefined) err = "Asset with this name already exists";
		      		if(err){
		      			$('#editor-rename #asset-name').val(newName).focus().select();
			      		$('#editor-rename > span').last().removeClass('info').addClass('error center').text(err);
			      		return;
		      		} else {
		      			selectedAsset.prop('asset', newName);
		      			editScene.addUndo({name:"renameAsset",undo:[editScene.renameAsset, newName, oldName],redo:[editScene.renameAsset, oldName, newName]});
		      			editScene.renameAsset(oldName, newName);
		      		}
	      		}		      	
		      	$('#editor-rename').dialog("close"); 
	      	},
	      	"Cancel": function() { 
	      		$(this).dialog("close"); 
	      	},
	      },	      
	      close: function(){ $(this).remove(); editScene.enableCanvasInteractions(true); }
		};
		dlg.dialog(dlgDef);
		
		editScene.disableCanvasInteractions(true);
		$('#asset-name', dlg).val(oldName).focus().select().keypress(function(e){ if(e.which == 13) dlgDef.buttons.Rename(); });

	},
	
	assetNew:function(e){
		var dlg = $('<div id="editor-new-asset" class="editor">\
		<span class="info">Enter new asset name.</span>\
		<span class="info">This operation is not undo-able.</span>\
		<div class="center pad5"><input type="text" id="asset-name" size="20" tabindex="0"/>\
		<br/><br/>\
		<label for="asset-x" class="right-align w2">Width</label><input class="center" type="text" size="1" tabindex="1" id="asset-x" value="8"/>\
		<label for="asset-y" class="right-align w2">Height</label><input class="center" type="text" size="1" tabindex="2" id="asset-y" value="8"/>\
		<label for="asset-z" class="right-align w2">Depth</label><input class="center" type="text" size="1" tabindex="3" id="asset-z" value="8"/></div>\
		</div>');
		
		var dlgDef = {
	      resizable: false, width: 440, height:320, modal: true, dialogClass:'no-close', title:"New Asset",
	      buttons: { 
	      	"Create": function() {
		      	var newName = $('#asset-name').val().trim();
	      		newName = newName.substr(0,1).toLowerCase()+newName.substr(1); //lowercase first
	      		var err = null;
	      		if(!newName.length) err = "Asset name can't be empty";
	      		if(assets.cache.files[newName] != undefined) err = "Asset with this name already exists";
	      		var xx = parseInt($('#asset-x').val());
	      		var yy = parseInt($('#asset-y').val());
	      		var zz = parseInt($('#asset-z').val());
	      		if(isNaN(xx) || xx <= 0 || xx > 256 || isNaN(yy) || yy <= 0 || yy > 256 || isNaN(zz) || zz <= 0 || zz > 256){
		      		err = "Asset dimensions must be between 1 and 256";
	      		} 
	      		if(err){
	      			$('#editor-new-asset #asset-name').val(newName).focus().select();
		      		$('#editor-new-asset > span').last().removeClass('info').addClass('error center').text(err);
		      		return;
	      		} else {
	      			var asset = {"name":newName,
					"width":xx,
					"height":yy,
					"depth":zz,
					"floor":false,
					"optimize":true,
					"smoothNormals":0.5,
					"occlusion":0.75,
					"pointSize":1,
					"frames":[{"p":[],"n":[],"c":[],"o":[]}]
					};
					editScene.addUndo({name:"addAsset",undo:[editScene.deleteAsset, asset],redo:[editScene.importSceneAsset, asset]});
	      			editScene.importSceneAsset(asset);
	      		}
	      				      	
		      	$('#editor-new-asset').dialog("close"); 
	      	},
	      	"Cancel": function() { 
	      		$(this).dialog("close"); 
	      	},
	      },	      
	      close: function(){ $(this).remove(); editScene.enableCanvasInteractions(true); }
		};
		dlg.dialog(dlgDef);
		
		editScene.disableCanvasInteractions(true);
		$('#asset-x,#asset-y,#asset-z').spinner({min:1,max:256,step:1});
		$('input', dlg).keypress(function(e){ if(e.which == 13) dlgDef.buttons.Create(); });
		$('#asset-name', dlg).focus();
	},

	deleteAsset:function(asset){
		delete assets.cache.files[asset.name];
		editScene.refreshAssets();
	},
	deleteAssetWithName:function(assetName){
		// gather affected objects
		var objsAdd = [];
		var objs = [];
		function trav(obj){
			if(obj instanceof THREE.PointCloud && obj.geometry.data.name == assetName){
				objsAdd.push([obj, obj.parent]);
				objs.push(obj);
			} else {
				for(var i = 0; i < obj.children.length; i++){
					trav(obj.children[i]);
				}
			}
		};
		trav(this.container);
		var asset = assets.cache.get(assetName);
		if(objs.length){
		    this.addUndo([
		    	{name:"deleteObjects", undo:[this.addObjects, objsAdd], redo:[this.deleteObjects, objs]},
		    	{name:"deleteAsset",undo:[this.importSceneAsset, asset],redo:[this.deleteAsset, asset]}
		    ]);
		    this.deleteObjects(objs);
		    this.deleteAsset(asset);
		} else {
		    this.addUndo({name:"deleteAsset",undo:[this.importSceneAsset, asset],redo:[this.deleteAsset, asset]});
		    this.deleteAsset(asset);
		}
	},
	assetDelete:function(e){
		var selectedAsset = $('#asset-list .row.selected');
		if(!selectedAsset.length) return;

		var dlg = $('<div id="editor-delete-asset" class="editor">\
		<p class="center">Delete <em/>?</p>\
		<span class="info">This will also delete all scene objects of the same type.</span>\
		</div>');
		
		var assetName = $('label:first', selectedAsset).text();
		$('p:first em', dlg).text(assetName);		
		//
		var dlgDef = {
	      resizable: false, width: 280, height:270, modal: true, dialogClass:'no-close', title:"Delete Asset",
	      buttons: { 
	      	"Delete": function() {
	      		editScene.deleteAssetWithName(assetName);
		      	$(this).dialog("close"); 
	      	},
	      	"Cancel": function() { 
	      		$(this).dialog("close"); 
	      	},
	      },	      
	      close: function(){ $(this).remove(); editScene.enableCanvasInteractions(true); }
		};
		dlg.dialog(dlgDef);
		
		editScene.disableCanvasInteractions(true);
	},
	
	assetAdd:function(e){
		var selectedAsset = $('#asset-list .row.selected');
		if(!selectedAsset.length) return;
		var assetName = $('label:first', selectedAsset).text();
		
		editScene.addObjectMenuItemClicked(e, assetName);
	},

/* ------------------- ------------------- ------------------- ------------------- ------------------- Name */

	renameObjects:function(objNameArr){
		for(var i = 0; i < objNameArr.length; i++){
			var obj = objNameArr[i][0];
			obj.name = objNameArr[i][1];
			if(obj.htmlLabel){
				obj.htmlLabel.text(obj.name);
				obj.htmlLabel.labelWidth = obj.htmlLabel.labelWidth = 0;
			}
			if(obj.htmlRow){
				obj.htmlRow.children('label').first().text(obj.name);
			}
		}
		this.refreshScene();
	},

	renameScene:function(newName){
		this.doc.name = newName;
		$('#scene-list #scene > label').text(newName);
	},

	nameChanged:function(e){
		var doArr = [];
		var undoArr = [];
		var newName = $('#prop-name').val().replace(/\W+/g,'_'); // replace non-word chars with _
		if(newName.match(/^\d+/)){ // prepend _ if starts with a digit
			newName = '_'+newName;
		}
		for(var i = 0; i < this.selectedObjects.length; i++){
			var obj = this.selectedObjects[i];
			undoArr.push([obj, obj.name ]);
			doArr.push([obj, newName]);
		}
		
		if(undoArr.length){ 
			this.addUndo({name:"rename", redo:[this.renameObjects,doArr], undo:[this.renameObjects, undoArr] });
			this.renameObjects(doArr);
		} else {
			this.addUndo({name:"renameScene", redo:[this.renameScene,newName], undo:[this.renameScene, this.doc.name] });
			this.renameScene(newName);
		}
		
		this.refreshProps();
	},

/* ------------------- ------------------- ------------------- ------------------- ------------------- Move, scale, rotate, visible, template */

	setObjectsVisible:function(objArr){
		for(var i = 0; i < objArr.length; i++){
			var obj = objArr[i][0];
			var val = objArr[i][1];
			obj.visible = val;
		}
		this.refreshScene(); // refreshes labels visibility
	},

	setObjectsTemplate:function(objArr){
		for(var i = 0; i < objArr.length; i++){
			var obj = objArr[i][0];
			var val = objArr[i][1];
			obj.isTemplate = val;
			if(val){
				obj.htmlLabel.addClass('template');
				obj.htmlRow.addClass('template');
			} else {
				obj.htmlLabel.removeClass('template');
				obj.htmlRow.removeClass('template');
			}
		}
	},

	moveObjects:function(objPosArr){
		for(var i = 0; i < objPosArr.length; i++){
			var obj = objPosArr[i][0];
			obj.position.copy(objPosArr[i][1]);
			if(obj.helper) {
				obj.updateMatrixWorld(true);
				obj.helper.update();
			}
		}
	},

	moveSelectionTo: function(pos){
		var objPosArr = [];
		var undoPosArr = [];
		for(var i = 0; i < this.selectedObjects.length; i++){
			var obj = this.selectedObjects[i];
			if(obj.isAnchor) continue;
			undoPosArr.push([obj, obj.position.clone() ]);
			objPosArr.push([obj,
				new THREE.Vector3(	(pos.x === null ? obj.position.x : pos.x),
									(pos.y === null ? obj.position.y : pos.y),
									(pos.z === null ? obj.position.z : pos.z))
			]);
		}
		
		if(objPosArr.length) this.addUndo({name:"moveTo", mergeable:true, redo:[this.moveObjects, objPosArr], undo:[this.moveObjects, undoPosArr] });
		
		this.moveObjects(objPosArr);
		return objPosArr.length;
	},

	moveSelectionBy: function(pos){
		var objPosArr = [];
		var undoPosArr = [];
		for(var i = 0; i < this.selectedObjects.length; i++){
			var obj = this.selectedObjects[i];
			if(obj.isAnchor) continue;
			undoPosArr.push([obj, obj.position.clone() ]);
			objPosArr.push([obj,
				new THREE.Vector3(	obj.position.x + (pos.x === null ? 0 : pos.x),
									obj.position.y + (pos.y === null ? 0 : pos.y),
									obj.position.z + (pos.z === null ? 0 : pos.z))
			]);
		}
		
		this.moveObjects(objPosArr);		
		if(objPosArr.length) this.addUndo({name:"moveBy", mergeable:true, redo:[this.moveObjects, objPosArr], undo:[this.moveObjects, undoPosArr] });
	},

	rotateObjects:function(objRotArr){
		for(var i = 0; i < objRotArr.length; i++){
			var obj = objRotArr[i][0];
			var rot = objRotArr[i][1];
			if((obj instanceof THREE.DirectionalLight || obj instanceof THREE.SpotLight)){
				if(rot instanceof THREE.Object3D){
					obj.target = rot;
				} else if(rot instanceof THREE.Vector3){
					if(obj.target.parent){
						obj.target = new THREE.Object3D();	
					}
					obj.target.position.copy(rot);
				}
			} else {
				obj.rotation.copy(rot);
			}
			if(obj.helper) {
				obj.updateMatrixWorld(true);
				obj.helper.update();
			}
		}
	},

	rotateSelectionTo: function(rot){
		var objRotArr = [];
		var undoRotArr = [];
		var degToRad = Math.PI / 180;
		for(var i = 0; i < this.selectedObjects.length; i++){
			var obj = this.selectedObjects[i];
			if(obj.isAnchor) continue;
			undoRotArr.push([obj, obj.rotation.clone() ]);
			objRotArr.push([obj,
				new THREE.Euler(	(rot.x === null ? obj.rotation.x : (rot.x * degToRad)),
									(rot.y === null ? obj.rotation.y : (rot.y * degToRad)),
									(rot.z === null ? obj.rotation.z : (rot.z * degToRad)))
			]);
		}
		
		this.rotateObjects(objRotArr);
		if(objRotArr.length) this.addUndo({name:"rotateTo", mergeable:true, redo:[this.rotateObjects, objRotArr], undo:[this.rotateObjects, undoRotArr] });
		return objRotArr.length;
	},

	rotateSelectionBy: function(rot){
		var objRotArr = [];
		var undoRotArr = [];
		var degToRad = Math.PI / 180;
		for(var i = 0; i < this.selectedObjects.length; i++){
			var obj = this.selectedObjects[i];
			if(obj.isAnchor) continue;
			undoRotArr.push([obj, obj.rotation.clone() ]);
			objRotArr.push([obj,
				new THREE.Euler(	obj.rotation.x + (rot.x === null ? 0 : (rot.x * degToRad)),
									obj.rotation.y + (rot.y === null ? 0 : (rot.y * degToRad)),
									obj.rotation.z + (rot.z === null ? 0 : (rot.z * degToRad)))
			]);
		}
		
		if(objRotArr.length) this.addUndo({name:"rotateBy", mergeable:true, redo:[this.rotateObjects, objRotArr], undo:[this.rotateObjects, undoRotArr] });
		
		this.rotateObjects(objRotArr);
		
	},
	
	scaleObjects:function(objScaleArr){
		for(var i = 0; i < objScaleArr.length; i++){
			objScaleArr[i][0].scale.copy(objScaleArr[i][1]);
		}
	},

	scaleSelectionTo: function(scale){
		var objScaleArr = [];
		var undoScaleArr = [];
		for(var i = 0; i < this.selectedObjects.length; i++){
			var obj = this.selectedObjects[i];
			if(obj.isAnchor) continue;
			undoScaleArr.push([obj, obj.scale.clone() ]);
			objScaleArr.push([obj,
				new THREE.Vector3(	(scale.x === null ? obj.scale.x : scale.x),
									(scale.y === null ? obj.scale.y : scale.y),
									(scale.z === null ? obj.scale.z : scale.z))
			]);
		}
		
		this.scaleObjects(objScaleArr);
		if(objScaleArr.length) this.addUndo({name:"scaleTo", mergeable:true, redo:[this.scaleObjects, objScaleArr], undo:[this.scaleObjects, undoScaleArr] });
		
		return objScaleArr.length;
	},

	scaleSelectionBy: function(scale){
		var objScaleArr = [];
		var undoScaleArr = [];
		for(var i = 0; i < this.selectedObjects.length; i++){
			var obj = this.selectedObjects[i];
			if(obj.isAnchor) continue;
			undoScaleArr.push([obj, obj.scale.clone() ]);
			objScaleArr.push([obj,
				new THREE.Vector3(	obj.scale.x + (scale.x === null ? 0 : scale.x),
									obj.scale.y + (scale.y === null ? 0 : scale.y),
									obj.scale.z + (scale.z === null ? 0 : scale.z))
			]);
		}
		
		if(objScaleArr.length) this.addUndo({name:"scaleBy", mergeable:true, redo:[this.scaleObjects, objScaleArr], undo:[this.scaleObjects, undoScaleArr] });
		
		this.scaleObjects(objScaleArr);
		
	},
	
	lookAtSelection: function(targ){
		if(targ.selected) return;
		targ.updateMatrixWorld(true);
		
		var objRotArr = [];
		var undoRotArr = [];
		var degToRad = Math.PI / 180;
		var wp = new THREE.Vector3();
		var lp = new THREE.Vector3();
		wp.setFromMatrixPosition(targ.matrixWorld);
		
		for(var i = 0; i < this.selectedObjects.length; i++){
			var obj = this.selectedObjects[i];
			if(obj.isAnchor) continue;
			if(obj instanceof THREE.DirectionalLight || obj instanceof THREE.SpotLight){
				// if(targ.isAnchor && (targ.parent == obj.parent || (obj.parent.isAnchor && obj.parent.parent == targ.parent))){
				undoRotArr.push([obj, obj.target ]);
				obj.target = targ;
				objRotArr.push([obj, targ]);
			} else {
				undoRotArr.push([obj, obj.rotation.clone() ]);
				obj.updateMatrixWorld(true);
				lp.copy(wp); 
				obj.parent.worldToLocal(lp);
				obj.lookAt(lp);
				objRotArr.push([obj, obj.rotation.clone()]);
			}
		}
		if(!objRotArr.length) return;
		this.addUndo({name:"lookAt", redo:[this.rotateObjects, objRotArr], undo:[this.rotateObjects, undoRotArr] });
		this.refreshProps();
	},
	
	lookAtClicked:function(e){
		if($(e.target).attr('disabled')) return;
		if(editScene.objectPickMode){
			editScene.objectPickMode(null);
			return;
		}
		
		$('#look-at').addClass('active');
		$('canvas,.object-label,#scene-list div.row:not(.selected),#scene-list div.row:not(.selected) > label').css('cursor','cell');
		editScene.objectPickMode = function(obj){
			if(obj){
				editScene.lookAtSelection(obj);
			}
			$('#look-at').removeClass('active');
			editScene.objectPickMode = null;
			$('canvas,.object-label,#scene-list div.row:not(.selected),#scene-list div.row:not(.selected) > label').css('cursor','');
		};
	},
	
	updateStoredPosition:function(){
		this.storedTransform = this.storedTransform ? this.storedTransform : {pos:null,rot:null,scale:null};
		if(this.storedTransform.pos){
			var tt = '{'+(this.storedTransform.pos[0] != '' ? this.storedTransform.pos[0] : '*') + ','
					+(this.storedTransform.pos[1] != '' ? this.storedTransform.pos[1] : '*') + ','
					+(this.storedTransform.pos[2] != '' ? this.storedTransform.pos[2] : '*') + '}';
			$('#store-pos').attr('disabled','disabled').attr('title',tt);
			$('#clear-pos').removeAttr('disabled').attr('title',tt);
		} else {
			$('#store-pos').removeAttr('disabled').removeAttr('title');
			$('#clear-pos').attr('disabled','disabled').removeAttr('title');
		}
		if(this.storedTransform.rot){
			var tt = '{'+(this.storedTransform.rot[0] != '' ? this.storedTransform.rot[0] : '*') + ','
					+(this.storedTransform.rot[1] != '' ? this.storedTransform.rot[1] : '*') + ','
					+(this.storedTransform.rot[2] != '' ? this.storedTransform.rot[2] : '*') + '}';
			$('#store-rot').attr('disabled','disabled').attr('title',tt);
			$('#clear-rot').removeAttr('disabled').attr('title',tt);
		} else {
			$('#store-rot').removeAttr('disabled').removeAttr('title');
			$('#clear-rot').attr('disabled','disabled').removeAttr('title');	
		}
		if(this.storedTransform.scale){
			var tt = '{'+(this.storedTransform.scale[0] != '' ? this.storedTransform.scale[0] : '*') + ','
					+(this.storedTransform.scale[1] != '' ? this.storedTransform.scale[1] : '*') + ','
					+(this.storedTransform.scale[2] != '' ? this.storedTransform.scale[2] : '*') + '}';
			$('#store-scale').attr('disabled','disabled').attr('title',tt);
			$('#clear-scale').removeAttr('disabled').attr('title',tt);
		} else {
			$('#store-scale').removeAttr('disabled').removeAttr('title');
			$('#clear-scale').attr('disabled','disabled').removeAttr('title');
		}
		
		if((this.storedTransform.pos || this.storedTransform.rot || this.storedTransform.scale) && !($('#prop-x').attr('disabled'))){
			$('#restore-pos').removeAttr('disabled');
		} else {
			$('#restore-pos').attr('disabled','disabled');	
		}

	},
	
	restorePosition:function(){
		var v = new THREE.Vector3();
		var numAffected = 0;
		if(this.storedTransform.pos){
			v.x = this.storedTransform.pos[0] === '' ? null : parseFloat(this.storedTransform.pos[0]);
			v.y = this.storedTransform.pos[1] === '' ? null : parseFloat(this.storedTransform.pos[1]);
			v.z = this.storedTransform.pos[2] === '' ? null : parseFloat(this.storedTransform.pos[2]);
			if(this.moveSelectionTo(v)) numAffected++;
		}
		if(this.storedTransform.rot){
			v.x = this.storedTransform.rot[0] === '' ? null : parseFloat(this.storedTransform.rot[0]);
			v.y = this.storedTransform.rot[1] === '' ? null : parseFloat(this.storedTransform.rot[1]);
			v.z = this.storedTransform.rot[2] === '' ? null : parseFloat(this.storedTransform.rot[2]);
			if(this.rotateSelectionTo(v)) numAffected++;
		}
		if(this.storedTransform.scale){
			v.x = this.storedTransform.scale[0] === '' ? null : parseFloat(this.storedTransform.scale[0]);
			v.y = this.storedTransform.scale[1] === '' ? null : parseFloat(this.storedTransform.scale[1]);
			v.z = this.storedTransform.scale[2] === '' ? null : parseFloat(this.storedTransform.scale[2]);
			if(this.scaleSelectionTo(v)) numAffected++;
		}
		
		if(numAffected > 1){
			this.joinUndoActions(numAffected);
		}
		this.undoChanged();
		this.refreshProps();
	},
	
	storePosition:function(e){
		if($(e.target).attr('disabled')) return;
		editScene.storedTransform.pos = [$('#prop-x').val(), $('#prop-y').val(), $('#prop-z').val()];
		editScene.updateStoredPosition();
	},

	storeRotation:function(e){
		if($(e.target).attr('disabled')) return;
		editScene.storedTransform.rot = [$('#prop-rx').val(), $('#prop-ry').val(), $('#prop-rz').val()];
		editScene.updateStoredPosition();
	},

	storeScale:function(e){
		if($(e.target).attr('disabled')) return;
		editScene.storedTransform.scale = [$('#prop-sx').val(), $('#prop-sy').val(), $('#prop-sz').val()];
		editScene.updateStoredPosition();
	},

	clearStorePosition:function(e){
		if($(e.target).attr('disabled')) return;
		editScene.storedTransform.pos = null;
		editScene.updateStoredPosition();
	},

	clearStoreRotation:function(e){
		if($(e.target).attr('disabled')) return;
		editScene.storedTransform.rot = null;
		editScene.updateStoredPosition();
	},

	clearStoreScale:function(e){
		if($(e.target).attr('disabled')) return;
		editScene.storedTransform.scale = null;
		editScene.updateStoredPosition();
	},
	
	positionSpinnerChange:function(e){
		var targ = $(e.target);
		var targId = e ? targ.attr('id') : null;
		
		// check if value actually changed
		var prevVal = targ.data('prevVal').toString();
		if(targ.val().toString() === prevVal) return;
		
		var newPos = new THREE.Vector3();
		newPos.set(null,null,null);
		var newVal = parseFloat(targ.spinner('value'));
		if(isNaN(newVal)) newVal = null;
		switch(targId){
		case 'prop-x':
			newPos.x = newVal;
			break;
		case 'prop-y':
			newPos.y = newVal;
			break;
		case 'prop-z':
			newPos.z = newVal;
			break;			
		}
		
		if(newPos.x === null && newPos.y === null && newPos.z === null) return;
		
		if(e.type == 'spinstop' && $(e.currentTarget).hasClass('ui-spinner-button') && prevVal == ''){
			editScene.moveSelectionBy(newPos);
			targ.attr('placeholder','M').val('');
		} else {
			editScene.moveSelectionTo(newPos);
			targ.attr('placeholder','');
		}

		targ.data('prevVal', targ.val());
	},

	rotationSpinnerChange:function(e){
		var targ = $(e.target);
		var targId = e ? targ.attr('id') : null;
		
		// check if value actually changed
		var prevVal = targ.data('prevVal').toString();
		if(targ.val().toString() === prevVal) return;
		
		var newPos = new THREE.Vector3();
		newPos.set(null,null,null);
		var newVal = parseFloat(targ.spinner('value'));
		if(isNaN(newVal)) newVal = null;
		switch(targId){
		case 'prop-rx':
			newPos.x = newVal;
			break;
		case 'prop-ry':
			newPos.y = newVal;
			break;
		case 'prop-rz':
			newPos.z = newVal;
			break;			
		}
		
		if(newPos.x === null && newPos.y === null && newPos.z === null) return;
		
		if(e.type == 'spinstop' && $(e.currentTarget).hasClass('ui-spinner-button') && prevVal == ''){
			editScene.rotateSelectionBy(newPos);
			targ.attr('placeholder','M').val('');
		} else {
			editScene.rotateSelectionTo(newPos);
			targ.attr('placeholder','');
		}

		targ.data('prevVal', targ.val());
	},
	
	scaleSpinnerChange:function(e){
		var targ = $(e.target);
		var targId = e ? targ.attr('id') : null;
		
		// check if value actually changed
		var prevVal = targ.data('prevVal').toString();
		if(targ.val().toString() === prevVal) return;
		
		var newPos = new THREE.Vector3();
		newPos.set(null,null,null);
		var newVal = parseFloat(targ.spinner('value'));
		if(isNaN(newVal)) newVal = null;
		switch(targId){
		case 'prop-sx':
			newPos.x = newVal;
			break;
		case 'prop-sy':
			newPos.y = newVal;
			break;
		case 'prop-sz':
			newPos.z = newVal;
			break;			
		}
		
		if(newPos.x === null && newPos.y === null && newPos.z === null) return;
		
		if(e.type == 'spinstop' && $(e.currentTarget).hasClass('ui-spinner-button') && prevVal == ''){
			editScene.scaleSelectionBy(newPos);
			targ.attr('placeholder','M').val('');
		} else {
			editScene.scaleSelectionTo(newPos);
			targ.attr('placeholder','');
		}

		targ.data('prevVal', targ.val());
	},

	visibleChanged:function(e){
		var doArr = [];
		var undoArr = [];
		var newVal = $('#prop-visible')[0].checked;
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			if(obj.isAnchor) continue;
			doArr.push([obj, newVal]);
			undoArr.push([obj, obj.visible]);
		}
		
		if(!doArr.length) return;
		
		editScene.setObjectsVisible(doArr);
		editScene.addUndo({name:'setVisible',undo:[editScene.setObjectsVisible, undoArr], redo:[editScene.setObjectsVisible, doArr]} );
		editScene.refreshProps();
	},

	templateChanged:function(e){
		var doArr = [];
		var undoArr = [];
		var newVal = $('#prop-template')[0].checked;
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			if(obj.isAnchor) continue;
			doArr.push([obj, newVal]);
			undoArr.push([obj, obj.visible]);
		}
		
		if(!doArr.length) return;
		
		editScene.setObjectsTemplate(doArr);
		editScene.addUndo({name:'setTemplate',undo:[editScene.setObjectsTemplate, undoArr], redo:[editScene.setObjectsTemplate, doArr]} );
		editScene.refreshProps();
	},
	
	castShadowChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'castShadow';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
			if(obj.shadowMap){
				// renderer.webgl.clearTarget(obj.shadowMap);
				obj.shadowMap.dispose();
				obj.shadowMap = null;
			}
		}
		editScene.addUndo({name:"castShadow", undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
		this.updateLights = true;
	},

	receiveShadowChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'receiveShadow';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:"receiveShadow", undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);	
		this.updateLights = true;
	},
	
	transformObjectToCam:function(e){
		var objPosArr = [];
		var objRotArr = [];
		var undoPosArr = [];
		var undoRotArr = [];
		var pos = this.camera.position;
		var rot = this.camera.rotation;
		for(var i = 0; i < this.selectedObjects.length; i++){
			var obj = this.selectedObjects[i];
			if(obj.isAnchor) continue;
			undoPosArr.push([obj, obj.position.clone() ]);
			objPosArr.push([obj, obj.parent.worldToLocal(pos.clone()) ]);
			if(obj instanceof THREE.DirectionalLight || obj instanceof THREE.SpotLight){
				var newTarg = new THREE.Object3D();
				newTarg.position.copy(pos);
				newTarg.rotation.copy(rot);
				newTarg.translateZ(-100);
				undoRotArr.push([obj, obj.target ]);
				objRotArr.push([obj, newTarg ]);
			} else {
				var parentRot = new THREE.Quaternion();
				obj.parent.updateMatrixWorld(true);
				parentRot.setFromRotationMatrix(obj.parent.matrixWorld);
				var newRot = new THREE.Quaternion();
				newRot.setFromRotationMatrix(this.camera.matrixWorld);
				newRot.multiply(parentRot.inverse());
				var r = new THREE.Euler();
				r.setFromQuaternion(newRot);
				if(e.altKey){
					if(e.shiftKey) r.y += Math.PI * 0.5;
					else r.y -= Math.PI * 0.5;
				} else {
					if(e.shiftKey) r.y += Math.PI;
				}
				
				undoRotArr.push([obj, obj.rotation.clone() ]);
				objRotArr.push([obj, r]);
				
				obj.rotation.copy(r);
			}
			this.refreshProps();
		}
		
		this.addUndo([
			{name:"moveTo", mergeable:true, redo:[this.moveObjects, objPosArr], undo:[this.moveObjects, undoPosArr]},
			{name:"rotateTo", mergeable:true, redo:[this.rotateObjects, objRotArr], undo:[this.rotateObjects, undoRotArr] }			
		]);
		
		this.moveObjects(objPosArr);
		this.rotateObjects(objRotArr);
	},
	
	transformCamToObject:function(e){
		var obj = this.selectedObjects[0];
		var wp = new THREE.Vector3();
		if(obj instanceof THREE.DirectionalLight || obj instanceof THREE.SpotLight){
			this.camera.position.copy(obj.position);
			obj.parent.localToWorld(this.camera.position);
			this.camera.updateMatrixWorld( true );
			obj.target.updateMatrixWorld(true);
			wp.setFromMatrixPosition(obj.target.matrixWorld);
			this.controls.center.copy(wp);
			this.camera.lookAt(wp);
		} else {
			obj.updateMatrixWorld( true );
			this.camera.position.setFromMatrixPosition(obj.matrixWorld);
			if(e.altKey){
				wp.set(e.shiftKey ? 100 : -100,0,0);
			} else {
				wp.set(0,0, e.shiftKey ? 100 : -100);
			}
			obj.localToWorld(wp);
			this.camera.lookAt(wp);
			this.controls.center.copy(wp);
		}
	},

	
/* ------------------- ------------------- ------------------- ------------------- ------------------- Camera panel */

	
	setObjectProperty:function(arr, prop){
		for(var i = 0; i < arr.length; i++){
			var obj = arr[i][0];
			var val = arr[i][1];
			if(obj[prop] instanceof THREE.Color){
				obj[prop].setHex(val);
			} else {
				obj[prop] = val;
			}
			if(obj instanceof THREE.Camera){
				obj.updateProjectionMatrix();				
			}
			if(obj.helper) obj.helper.update();
		}
	},
	
	cameraFovChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'fov';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:"cameraFOV", mergeable:true, undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
	},

	cameraZoomChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'zoom';
		val *= 0.01;
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:"cameraZoom", mergeable:true, undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
	},

	cameraNearChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'near';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:"cameraNear", mergeable:true, undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
	},

	cameraFarChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'far';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:"cameraFar", mergeable:true, undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
		
	},

	setCameraDefault:function(cam, val){
		this.container.traverse(function(obj){
			if(obj instanceof THREE.Camera){
				if(obj == cam){
					obj.isDefault = val;
				} else if(val){
					obj.isDefault = false;
				}
			}
		});
		editScene.doc.defaultCamera = val ? cam : null;
		editScene.refreshScene();
	},
	cameraDefaultChanged:function(val){
		if(editScene.selectedObjects.length != 1) return;
		var cam = editScene.selectedObjects[0];
		if(editScene.doc.defaultCamera && editScene.doc.defaultCamera != cam){
			editScene.addUndo([
				{name:"cameraDefault",undo:[editScene.setCameraDefault, editScene.doc.defaultCamera, true], redo:[editScene.setCameraDefault, editScene.doc.defaultCamera, false]},
				{name:"cameraDefault",undo:[editScene.setCameraDefault, cam, !!cam.isDefault], redo:[editScene.setCameraDefault, cam, val]}]);
			
		} else {
			editScene.addUndo({name:"cameraDefault",undo:[editScene.setCameraDefault, cam, !!cam.isDefault],
													redo:[editScene.setCameraDefault, cam, val]});
		}
		editScene.setCameraDefault(cam, val);
	},

/* ------------------- ------------------- ------------------- ------------------- ------------------- Light panel */

	lightAngleChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'angle';
		val = Math.PI * val / 180;
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:"lightAngle", mergeable:true, undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
	},

	lightIntensityChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'intensity';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:"lightIntensity", mergeable:true, undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
	},
	
	lightDistanceChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'distance';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:"lightDistance", mergeable:true, undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
	},

	lightExponentChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'exponent';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:"lightExponent", mergeable:true, undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
	},
	
	setGroundLightColor:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'groundColor';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj.storedColor]);
			obj.storedColor = val;
		}
		editScene.addUndo({name:"lightGroundColor", undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
	},

	setLightColor:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'color';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj.storedColor]);
			obj.storedColor = val;
		}
		editScene.addUndo({name:"lightColor", undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
	},
	
	lightShadowBiasChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'shadowBias';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj.shadowBias]);
		}
		editScene.addUndo({name:"shadowBias", mergeable:true, undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
	},

	lightShadowNearChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'shadowCameraNear';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj.shadowCameraNear]);
			if(obj.shadowCamera){
				if(obj.shadowCamera.parent){
					obj.shadowCamera.parent.remove(obj.shadowCamera);
				}
				obj.shadowCamera = null;
			}
		}
		editScene.addUndo({name:"shadowCameraNear", mergeable:true, undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
	},

	lightShadowFarChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'shadowCameraFar';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj.shadowCameraFar]);
			if(obj.shadowCamera){
				if(obj.shadowCamera.parent){
					obj.shadowCamera.parent.remove(obj.shadowCamera);
				}
				obj.shadowCamera = null;
			}
		}
		editScene.addUndo({name:"shadowCameraFar", mergeable:true, undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
	},

	lightShadowVolWidthChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'shadowCameraRight';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj.shadowCameraRight * 2]);
			if(obj.shadowCamera){
				if(obj.shadowCamera.parent){
					obj.shadowCamera.parent.remove(obj.shadowCamera);
				}
				obj.shadowCamera = null;
				obj.shadowCameraLeft = -val * 0.5;
			}
		}
		editScene.addUndo({name:"shadowCameraRight", mergeable:true, undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
	},

	lightShadowVolHeightChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'shadowCameraTop';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj.shadowCameraTop * 2]);
			if(obj.shadowCamera){
				if(obj.shadowCamera.parent){
					obj.shadowCamera.parent.remove(obj.shadowCamera);
				}
				obj.shadowCamera = null;
				obj.shadowCameraBottom = -val * 0.5;
			}
		}
		editScene.addUndo({name:"shadowCameraTop", mergeable:true, undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
	},
	
	lightShadowMapWidthChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'shadowMapWidth';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj.shadowMapWidth]);
			if(obj.shadowMap){
				obj.shadowMap.dispose();
				obj.shadowMap = null;
			}
		}
		editScene.addUndo({name:"shadowMapWidth", mergeable:true, undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
	},

	lightShadowMapHeightChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'shadowMapHeight';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj.shadowMapHeight]);
			if(obj.shadowMap){
				obj.shadowMap.dispose();
				obj.shadowMap = null;
			}
		}
		editScene.addUndo({name:"shadowMapHeight", mergeable:true, undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
	},
	
/* ------------------- ------------------- ------------------- ------------------- ------------------- PixelBox panel */

	setAnimProperty:function(arr, prop){
		for(var i = 0; i < arr.length; i++){
			var obj = arr[i][0];
			var val = arr[i][1];
			if(prop == 'animSpeed'){
				obj[prop] = val;
			} else {
				obj.def[prop] = val;
			}
			this.pixelboxApplyAnimationParams(obj);
		}		
	},
	
	restartAllAnims:function(){
		editScene.container.traverseVisible(function(obj){
			if(obj instanceof THREE.PointCloud){
				obj.stopAnim();
				obj.frame = 0;
				editScene.pixelboxApplyAnimationParams(obj);
			}
		});
	},
	
	pixelboxApplyAnimationParams:function(obj3d){
		var layer = obj3d.def;
		if(layer.animName != undefined && obj3d.animNamed(layer.animName) != undefined){
			var animOption = layer.animOption ? layer.animOption : 'gotoAndStop';
			var animFrame = layer.animFrame != undefined ? layer.animFrame : 0;
			
			if(animOption == 'loopAnim'){
				obj3d.loopAnim(layer.animName, Infinity, false);
			} else if(animOption == 'loopFrom') { 
				obj3d.gotoAndStop(layer.animName, animFrame + 1); 
				obj3d.loopAnim(layer.animName, Infinity, true);
			} else if(animOption == 'playAnim') { 
				obj3d.playAnim(layer.animName);
			} else {
				obj3d.gotoAndStop(layer.animName, animFrame);
			}
		} else {
			obj3d.stopAnim();
			obj3d.frame = layer.animFrame != undefined ? layer.animFrame : 0;
		}
	},

	pixelboxPointSizeChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'pointSize';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:prop, mergeable:true, undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
		editScene.refreshProps();
	},

	pixelboxStippleChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'stipple';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:'pixelBoxStipple', mergeable:true, undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
		editScene.refreshProps();
	},

	pixelboxAlphaChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'alpha';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:'pixelBoxAlpha', mergeable:true, undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
		editScene.refreshProps();
	},

	pixelboxOcclusionChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'occlusion';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:prop, mergeable:true, undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
		editScene.refreshProps();
	},

	pixelboxCullBackChanged:function(e){
		var val = $('#pixelbox-cullBack')[0].checked;
		var doArr = [];
		var undoArr = [];
		var prop = 'cullBack';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:prop, mergeable:true, undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
		editScene.refreshProps();
	},

	pixelboxAnimSpeedChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'animSpeed';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:prop, mergeable:true, undo:[editScene.setAnimProperty, undoArr, prop],
											redo:[editScene.setAnimProperty, doArr, prop]});
		editScene.setAnimProperty(doArr, prop);
		editScene.refreshProps();
	},
	
	pixelboxAnimTypeChanged:function(e){
		var val = $('#panel-pixelbox input[name=pixelbox-animOption]:checked').val();
		var doArr = [];
		var undoArr = [];
		var prop = 'animOption';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:prop, mergeable:true, undo:[editScene.setAnimProperty, undoArr, prop],
											redo:[editScene.setAnimProperty, doArr, prop]});
		editScene.setAnimProperty(doArr, prop);
		editScene.refreshProps();
	},

	pixelboxStartFrameChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'animFrame';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:prop, mergeable:true, undo:[editScene.setAnimProperty, undoArr, prop],
											redo:[editScene.setAnimProperty, doArr, prop]});
		editScene.setAnimProperty(doArr, prop);
		editScene.refreshProps();
	},
	
	pixelboxAnimNameChanged:function(e){
		var val = $('#pixelbox-animName')[0].value;
		var doArr = [];
		var undoArr = [];
		var prop = 'animName';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:prop, mergeable:true, undo:[editScene.setAnimProperty, undoArr, prop],
											redo:[editScene.setAnimProperty, doArr, prop]});
		editScene.setAnimProperty(doArr, prop);
		editScene.refreshProps();
	},

	pixelboxSetTint:function(val){//int
		var doArr = [];
		var undoArr = [];
		var prop = 'tint';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj.storedColor]);
			obj.storedColor = val;
		}
		editScene.addUndo({name:"tint", undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
		editScene.refreshProps();
	},

	pixelboxSetAddColor:function(val){//int
		var doArr = [];
		var undoArr = [];
		var prop = 'addColor';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj.storedColor]);
			obj.storedColor = val;
		}
		editScene.addUndo({name:"addColor", undo:[editScene.setObjectProperty, undoArr, prop],
											redo:[editScene.setObjectProperty, doArr, prop]});
		editScene.setObjectProperty(doArr, prop);
		editScene.refreshProps();
	},


/* ------------------- ------------------- ------------------- ------------------- ------------------- Geometry panel */

	setMaterialProperty:function(arr, prop){
		for(var i = 0; i < arr.length; i++){
			var obj = arr[i][0];
			var val = arr[i][1];
			if(obj.material[prop] instanceof THREE.Color){
				obj.material[prop].set(val);
			} else {
				obj.material[prop] = val;
			}
		}		
	},

	geometryStippleChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'stipple';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:'geometryStipple', mergeable:true, undo:[editScene.setMaterialProperty, undoArr, prop],
											redo:[editScene.setMaterialProperty, doArr, prop]});
		editScene.setMaterialProperty(doArr, prop);
		editScene.refreshProps();
	},

	geometryAlphaChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'alpha';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:'geometryStipple', mergeable:true, undo:[editScene.setMaterialProperty, undoArr, prop],
											redo:[editScene.setMaterialProperty, doArr, prop]});
		editScene.setMaterialProperty(doArr, prop);
		editScene.refreshProps();
	},

	geometryBrightnessChanged:function(val){
		var doArr = [];
		var undoArr = [];
		var prop = 'brightness';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj[prop]]);
		}
		editScene.addUndo({name:'brightness', mergeable:true, undo:[editScene.setMaterialProperty, undoArr, prop],
											redo:[editScene.setMaterialProperty, doArr, prop]});
		editScene.setMaterialProperty(doArr, prop);
		editScene.refreshProps();
	},

	setGeometryTint:function(val){//int
		var doArr = [];
		var undoArr = [];
		var prop = 'tint';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj.storedColor]);
			obj.storedColor = val;
		}
		editScene.addUndo({name:"tint", undo:[editScene.setMaterialProperty, undoArr, prop],
											redo:[editScene.setMaterialProperty, doArr, prop]});
		editScene.setMaterialProperty(doArr, prop);
		editScene.refreshProps();
	},
	
	setGeometryAddColor:function(val){//int
		var doArr = [];
		var undoArr = [];
		var prop = 'addColor';
		for(var i = 0; i < editScene.selectedObjects.length; i++){
			var obj = editScene.selectedObjects[i];
			doArr.push([obj, val]);
			undoArr.push([obj, obj.storedColor]);
			obj.storedColor = val;
		}
		editScene.addUndo({name:"addColor", undo:[editScene.setMaterialProperty, undoArr, prop],
											redo:[editScene.setMaterialProperty, doArr, prop]});
		editScene.setMaterialProperty(doArr, prop);
		editScene.refreshProps();
	},

/* ------------------- ------------------- ------------------- ------------------- ------------------- Properties panel */

	previewScene:function(e){
	 	var loadScene = editScene.exportScene(true, false);
	 	console.log(JSON.parse(loadScene));
		if(chrome && chrome.storage){
			chrome.app.window.create('editor/preview.html', { 
				outerBounds: {
			      width: Math.max(400, Math.floor(window.outerWidth / 2)),
			      height: Math.max(300, Math.floor(window.outerHeight / 2))
			    }
			 }, function(win){
		 		win.contentWindow.loadScene = loadScene;
			 	win.focus();
			});
		} else {
			var win = window.open('preview.html', '_blank');
	 		win.loadScene = loadScene;
		 	win.focus();
		}
	},

	refreshProps:function(){
		$('#editor-props > h1').text('Properties' + (this.selectedObjects.length ? (' ('+this.selectedObjects.length+')') : ''));
		$('#editor-props .panels > .panel').hide();
		if(!this.selectedObjects.length){
			$('#prop-name').attr('placeholder','Scene name').val(this.doc.name);
			$('#prop-object-type').text('Scene');
			$('#panel-scene').show();
			// scene panel
			$('#scene-color').css({backgroundColor: this.doc.clearColor.getHexString()});
			$('#scene-fog-color').css({backgroundColor: this.doc.fogColor.getHexString()});
			$('#scene-ambient-color').css({backgroundColor: this.doc.ambient.getHexString()});
			$('#scene-max-shadows').val(this.doc.maxShadows != undefined ? this.doc.maxShadows : 0).data('prevVal', $('#scene-max-shadows').val().toString());
			$('#scene-fog-near').val(this.doc.fogNear != undefined ? this.doc.fogNear : this.scene.fog.near).data('prevVal', $('#scene-fog-near').val().toString());
			$('#scene-fog-far').val(this.doc.fogFar != undefined ? this.doc.fogFar : this.scene.fog.far).data('prevVal', $('#scene-fog-far').val().toString());
			return;
		}
		$('#prop-name').attr('placeholder','Object name');
		$('#prop-object-type').text('');
		$('#panel-move').show();

		$('#editor-props input[type=checkbox].multiple,#panel-pixelbox input[name=pixelbox-animOption].multiple').removeClass('multiple').removeAttr('checked');
		
		$('#pixelbox-animName').empty().append('<option value=""/>');
		
		var prevObj = null;
		var mults = {};
		var containsAnchors = false;
		var containsContainers = false;
		var containsPointClouds = false;
		var containsInstances = false;
		var containsCameras = false;
		var containsGeometry = false;
		var containsSpotLights = false;
		var containsDirLights = false;
		var containsHemiLights = false;
		var containsPointLights = false;
		var radToDeg = 180 / Math.PI;
		var commonType = null;
			
		function getType(o){
			if(o.def){
				switch(o.def.asset){
				case 'Camera':
				case 'OrthographicCamera':
					return 'Camera';
				default:
					return (o instanceof THREE.PointCloud) ? 'PixelBox' : o.def.asset;
				}
			} else if(o.isAnchor){
				return 'Anchor';
			}
			return null;
		}	
			
		for(var i = 0; i < this.selectedObjects.length; i++){
			var obj = this.selectedObjects[i];
			// name
			if(prevObj && prevObj.name != obj.name){
				$('#prop-name').attr('placeholder','Multiple').val('');
				mults['name'] = true;
			} else if(!mults['name']){
				$('#prop-name').attr('placeholder','Object name').val(obj.name);
			}
			
			// excludes
			containsAnchors = containsAnchors || (!!obj.isAnchor);
			containsContainers = containsContainers | (obj.isContainer);
			containsPointClouds = containsPointClouds | (obj instanceof THREE.PointCloud);
			containsInstances = containsInstances | (obj.isInstance);
			containsCameras = containsCameras | (obj instanceof THREE.Camera);
			containsGeometry = containsGeometry | (obj instanceof THREE.Mesh);
			containsSpotLights = containsSpotLights | (obj instanceof THREE.SpotLight);
			containsDirLights = containsDirLights | (obj instanceof THREE.DirectionalLight);
			containsHemiLights = containsHemiLights | (obj instanceof THREE.HemisphereLight);
			containsPointLights = containsPointLights | (obj instanceof THREE.PointLight);
			
			// type
			var type = getType(obj);
			var prevType = prevObj ? getType(prevObj) : null;
			
			if(prevObj && prevType != type){
				$('#prop-object-type').text('Multiple types');
				mults['type'] = true;
				commonType = null;
			} else if(!mults['type']){
				$('#prop-object-type').text(this.selectedObjects.length > 1 ? type : (obj.isAnchor ? 'Anchor' : ((obj instanceof THREE.PointCloud) ? 'PixelBox' : obj.def.asset)));
				commonType = type;
			} 
			
			// visible
			if(prevObj && prevObj.visible != obj.visible){
				$('#prop-visible').addClass('multiple')[0].checked = false;
				mults['visible'] = true;
			} else if(!mults['visible']){
				$('#prop-visible')[0].checked = obj.visible;
			}
			// template
			if(prevObj && prevObj.isTemplate != obj.isTemplate){
				$('#prop-template').addClass('multiple')[0].checked = false;
				mults['template'] = true;
			} else if(!mults['template']){
				$('#prop-template')[0].checked = obj.isTemplate;
			}
			// cast
			if(prevObj && prevObj.castShadow != obj.castShadow){
				$('#prop-cast-shadow').addClass('multiple')[0].checked = false;
				mults['cast'] = true;
			} else if(!mults['cast']){
				$('#prop-cast-shadow')[0].checked = obj.castShadow;
			}
			// receive
			if(prevObj && prevObj.receiveShadow != obj.receiveShadow){
				$('#prop-receive-shadow').addClass('multiple')[0].checked = false;
				mults['receive'] = true;
			} else if(!mults['receive']){
				$('#prop-receive-shadow')[0].checked = obj.receiveShadow;
			}
			
			//x
			if(prevObj && prevObj.position.x != obj.position.x){
				$('#prop-x').attr('placeholder','M').val('').data('prevVal',''); mults['x'] = true;
			} else if(!mults['x']){
				$('#prop-x').attr('placeholder','').val(obj.position.x).data('prevVal', obj.position.x.toString());
			}
			//y
			if(prevObj && prevObj.position.y != obj.position.y){
				$('#prop-y').attr('placeholder','M').val('').data('prevVal',''); mults['y'] = true;
			} else if(!mults['x']){
				$('#prop-y').attr('placeholder','').val(obj.position.y).data('prevVal', obj.position.y.toString());
			}
			//z
			if(prevObj && prevObj.position.z != obj.position.z){
				$('#prop-z').attr('placeholder','M').val('').data('prevVal',''); mults['z'] = true;
			} else if(!mults['z']){
				$('#prop-z').attr('placeholder','').val(obj.position.z).data('prevVal', obj.position.z.toString());
			}
			//rx
			if(prevObj && prevObj.rotation.x != obj.rotation.x){
				$('#prop-rx').attr('placeholder','M').val('').data('prevVal',''); mults['rx'] = true;
			} else if(!mults['rx']){
				var newVal = Math.round(radToDeg * obj.rotation.x);
				$('#prop-rx').attr('placeholder','').val(newVal).data('prevVal', newVal);
			}
			//ry
			if(prevObj && prevObj.rotation.y != obj.rotation.y){
				$('#prop-ry').attr('placeholder','M').val('').data('prevVal',''); mults['ry'] = true;
			} else if(!mults['ry']){
				var newVal = Math.round(radToDeg * obj.rotation.y);
				$('#prop-ry').attr('placeholder','').val(newVal).data('prevVal', newVal);
			}
			//rz
			if(prevObj && prevObj.rotation.z != obj.rotation.z){
				$('#prop-rz').attr('placeholder','M').val('').data('prevVal',''); mults['rz'] = true;
			} else if(!mults['rz']){
				var newVal = Math.round(radToDeg * obj.rotation.z);
				$('#prop-rz').attr('placeholder','').val(newVal).data('prevVal', newVal);
			}
			//sx
			if(prevObj && prevObj.scale.x != obj.scale.x){
				$('#prop-sx').attr('placeholder','M').val('').data('prevVal',''); mults['sx'] = true;
			} else if(!mults['sx']){
				var newVal = fake0(obj.scale.x);
				$('#prop-sx').attr('placeholder','').val(newVal).data('prevVal', newVal);
			}
			//ry
			if(prevObj && prevObj.scale.y != obj.scale.y){
				$('#prop-sy').attr('placeholder','M').val('').data('prevVal',''); mults['sy'] = true;
			} else if(!mults['sy']){
				var newVal = fake0(obj.scale.y);
				$('#prop-sy').attr('placeholder','').val(newVal).data('prevVal', newVal);
			}
			//rz
			if(prevObj && prevObj.scale.z != obj.scale.z){
				$('#prop-sz').attr('placeholder','M').val('').data('prevVal',''); mults['sz'] = true;
			} else if(!mults['sz']){
				var newVal = fake0(obj.scale.z);
				$('#prop-sz').attr('placeholder','').val(newVal).data('prevVal', newVal);
			}
			
			// camera
			if(commonType == 'Camera'){
				if(prevObj && prevObj.fov != obj.fov){
					$('#cam-fov').attr('placeholder','M').val('').data('prevVal',''); mults['cam-fov'] = true;
				} else if(!mults['cam-fov']){
					var newVal = obj.fov;
					$('#cam-fov').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.zoom != obj.zoom){
					$('#cam-zoom').attr('placeholder','M').val('').data('prevVal',''); mults['cam-zoom'] = true;
				} else if(!mults['cam-zoom']){
					var newVal = Math.floor(obj.zoom * 100);
					$('#cam-zoom').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.near != obj.near){
					$('#cam-near').attr('placeholder','M').val('').data('prevVal',''); mults['cam-near'] = true;
				} else if(!mults['cam-near']){
					var newVal = obj.near;
					$('#cam-near').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.far != obj.far){
					$('#cam-far').attr('placeholder','M').val('').data('prevVal',''); mults['cam-far'] = true;
				} else if(!mults['cam-far']){
					var newVal = obj.far;
					$('#cam-far').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(this.selectedObjects.length == 1){
					$('#cam-default')[0].checked = !!obj.isDefault;
				}
				if(prevObj && prevObj.def.asset != obj.def.asset){
					mults['cam-type'] = true;
					$('#cam-fov,label[for=cam-fov],#cam-zoom,label[for=cam-zoom]').hide();
				} else if(!mults['cam-type'] && obj.def.asset == 'Camera'){
					$('#cam-fov,label[for=cam-fov]').show();
					$('#cam-zoom,label[for=cam-zoom]').hide();
				} else if(!mults['cam-type'] && obj.def.asset == 'OrthographicCamera'){
					$('#cam-fov,label[for=cam-fov]').hide();
					$('#cam-zoom,label[for=cam-zoom]').show();
				}

			} else 
			
			// lights
			if(obj instanceof THREE.Light){
				if(prevObj && prevObj.color && prevObj.color.getHex() != obj.color.getHex()){
					$('#light-color').css({backgroundColor:'transparent'}); mults['light-color'] = true;
				} else if(!mults['light-color']){
					$('#light-color').css({backgroundColor:'#'+obj.color.getHexString()});
				}
				if(obj instanceof THREE.HemisphereLight){
					if(prevObj && prevObj.groundColor && prevObj.groundColor.getHex() != obj.groundColor.getHex()){
						$('#light-ground-color').css({backgroundColor:'transparent'}); mults['light-ground-color'] = true;
					} else if(!mults['light-ground-color']){
						$('#light-ground-color').css({backgroundColor:'#'+obj.groundColor.getHexString()});
					}
				}
				if(prevObj && prevObj.intensity != obj.intensity){
					$('#light-intensity').attr('placeholder','M').val('').data('prevVal',''); mults['light-intensity'] = true;
				} else if(!mults['light-intensity']){
					var newVal = notNaN(parseFloat(obj.intensity));
					$('#light-intensity').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.distance != obj.distance){
					$('#light-distance').attr('placeholder','M').val('').data('prevVal',''); mults['light-distance'] = true;
				} else if(!mults['light-distance']){
					var newVal = notNaN(parseFloat(obj.distance));
					$('#light-distance').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.exponent != obj.exponent){
					$('#light-exponent').attr('placeholder','M').val('').data('prevVal',''); mults['light-exponent'] = true;
				} else if(!mults['light-exponent']){
					var newVal = notNaN(parseFloat(obj.exponent));
					$('#light-exponent').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.angle != obj.angle){
					$('#light-angle').attr('placeholder','M').val('').data('prevVal',''); mults['light-angle'] = true;
				} else if(!mults['light-angle']){
					var newVal = notNaN(parseFloat(obj.angle * radToDeg));
					$('#light-angle').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				
				if(prevObj && prevObj.shadowBias != obj.shadowBias){
					$('#light-shadow-bias').attr('placeholder','M').val('').data('prevVal',''); mults['light-shadow-bias'] = true;
				} else if(!mults['light-shadow-bias']){
					var newVal = notNaN(parseFloat(obj.shadowBias));
					$('#light-shadow-bias').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.shadowCameraNear != obj.shadowCameraNear){
					$('#light-shadow-near').attr('placeholder','M').val('').data('prevVal',''); mults['light-shadow-near'] = true;
				} else if(!mults['light-shadow-near']){
					var newVal = notNaN(parseFloat(obj.shadowCameraNear));
					$('#light-shadow-near').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.shadowCameraFar != obj.shadowCameraFar){
					$('#light-shadow-far').attr('placeholder','M').val('').data('prevVal',''); mults['light-shadow-far'] = true;
				} else if(!mults['light-shadow-far']){
					var newVal = notNaN(parseFloat(obj.shadowCameraFar));
					$('#light-shadow-far').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.shadowCameraRight != obj.shadowCameraRight){
					$('#light-shadow-vol-width').attr('placeholder','M').val('').data('prevVal',''); mults['light-shadow-vol-width'] = true;
				} else if(!mults['light-shadow-vol-width']){
					var newVal = notNaN(parseFloat(obj.shadowCameraRight)) * 2;
					$('#light-shadow-vol-width').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.shadowCameraTop != obj.shadowCameraTop){
					$('#light-shadow-vol-height').attr('placeholder','M').val('').data('prevVal',''); mults['light-shadow-vol-height'] = true;
				} else if(!mults['light-shadow-vol-height']){
					var newVal = notNaN(parseFloat(obj.shadowCameraTop)) * 2;
					$('#light-shadow-vol-height').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.shadowMapWidth != obj.shadowMapWidth){
					$('#light-shadow-map-width').attr('placeholder','M').val('').data('prevVal',''); mults['light-shadow-map-width'] = true;
				} else if(!mults['light-shadow-map-width']){
					var newVal = notNaN(parseFloat(obj.shadowMapWidth));
					$('#light-shadow-map-width').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.shadowMapHeight != obj.shadowMapHeight){
					$('#light-shadow-map-height').attr('placeholder','M').val('').data('prevVal',''); mults['light-shadow-map-height'] = true;
				} else if(!mults['light-shadow-map-height']){
					var newVal = notNaN(parseFloat(obj.shadowMapHeight));
					$('#light-shadow-map-height').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.target && obj.target && prevObj.target != obj.target){
					$('#light-target').attr('placeholder','M').val('').data('prevVal',''); mults['light-target'] = true;
				} else if(obj.target && !mults['light-target']){
					var newVal = obj.target.name ? obj.target.name : '';
					$('#light-target').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
			} else 
			if(commonType == 'Geometry'){
				if(prevObj && prevObj.material.stipple != obj.material.stipple){
					$('#geometry-stipple').attr('placeholder','M').val('').data('prevVal',''); mults['geometry-stipple'] = true;
				} else if(!mults['geometry-stipple']){
					var newVal = obj.material.stipple;
					$('#geometry-stipple').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.material.alpha != obj.material.alpha){
					$('#geometry-alpha').attr('placeholder','M').val('').data('prevVal',''); mults['geometry-alpha'] = true;
				} else if(!mults['geometry-alpha']){
					var newVal = obj.material.alpha;
					$('#geometry-alpha').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.material.brightness != obj.material.brightness){
					$('#geometry-brightness').attr('placeholder','M').val('').data('prevVal',''); mults['geometry-brightness'] = true;
				} else if(!mults['geometry-occlusion']){
					var newVal = obj.material.brightness;
					$('#geometry-brightness').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.material.tint.getHex() != obj.material.tint.getHex()){
					$('#geometry-tint').css({backgroundColor:'transparent'}); mults['geometry-tint'] = true;
				} else if(!mults['geometry-tint']){
					$('#geometry-tint').css({backgroundColor:'#'+obj.material.tint.getHexString()});
				}
				if(prevObj && prevObj.material.addColor.getHex() != obj.material.addColor.getHex()){
					$('#geometry-addColor').css({backgroundColor:'transparent'}); mults['geometry-addColor'] = true;
				} else if(!mults['geometry-addColor']){
					$('#geometry-addColor').css({backgroundColor:'#'+obj.material.addColor.getHexString()});
				}
			} else 
			if(commonType == 'PixelBox'){
				if(prevObj && prevObj.pointSize != obj.pointSize){
					$('#pixelbox-pointSize').attr('placeholder','M').val('').data('prevVal',''); mults['pointSize'] = true;
				} else if(!mults['pointSize']){
					var newVal = obj.pointSize;
					$('#pixelbox-pointSize').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.stipple != obj.stipple){
					$('#pixelbox-stipple').attr('placeholder','M').val('').data('prevVal',''); mults['stipple'] = true;
				} else if(!mults['stipple']){
					var newVal = obj.stipple;
					$('#pixelbox-stipple').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.alpha != obj.alpha){
					$('#pixelbox-alpha').attr('placeholder','M').val('').data('prevVal',''); mults['pixelbox-alpha'] = true;
				} else if(!mults['pixelbox-alpha']){
					var newVal = obj.alpha;
					$('#pixelbox-alpha').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.occlusion != obj.occlusion){
					$('#pixelbox-occlusion').attr('placeholder','M').val('').data('prevVal',''); mults['occlusion'] = true;
				} else if(!mults['occlusion']){
					var newVal = obj.occlusion;
					$('#pixelbox-occlusion').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.cullBack != obj.cullBack){
					$('#pixelbox-cullBack').addClass('multiple')[0].checked = false;
					mults['cullBack'] = true;
				} else if(!mults['cullBack']){
					$('#pixelbox-cullBack')[0].checked = obj.cullBack;
				}
				if(prevObj && prevObj.def['animOption'] != obj.def['animOption']){
					$('#panel-pixelbox input[name=pixelbox-animOption]').addClass('multiple').attr('checked',false);
					mults['animOption'] = true;
				} else if(!mults['animOption']){
					var animOption = obj.def['animOption'] ? obj.def['animOption'] : 'gotoAndStop';
					$('#panel-pixelbox input[value='+animOption+']')[0].checked = true;
				}
				if(prevObj && prevObj.animSpeed != obj.animSpeed){
					$('#pixelbox-animSpeed').attr('placeholder','M').val('').data('prevVal',''); mults['animSpeed'] = true;
				} else if(!mults['animSpeed']){
					var newVal = obj.animSpeed;
					$('#pixelbox-animSpeed').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				
				// add anims to anim name box
				var sel = $('#pixelbox-animName');
				for(var aname in obj.asset.anims){
					var opt = $('option[value='+aname+']');
					if(!opt.length){
						opt = $('<option/>').text(aname).val(aname);
						sel.append(opt);
					}
				}
				if(prevObj && (prevObj.def['animName'] != obj.def['animName'])){
					mults['animName'] = true;
				} else if(!mults['animName']){
					var animName = obj.def['animName'];
					if(animName != undefined && obj.animNamed(animName)){
						$('#pixelbox-animName').val(animName);
					}
				}			
				if(prevObj && prevObj.def['animFrame'] != obj.def['animFrame']){
					$('#pixelbox-animFrame').attr('placeholder','M').val('').data('prevVal',''); mults['animFrame'] = true;
				} else if(!mults['animFrame']){
					var newVal = obj.def['animFrame'] ? obj.def['animFrame'] : 0;
					$('#pixelbox-animFrame').attr('placeholder','').val(newVal).data('prevVal', newVal);
				}
				if(prevObj && prevObj.tint.getHex() != obj.tint.getHex()){
					$('#pixelbox-tint').css({backgroundColor:'transparent'}); mults['pixelbox-tint'] = true;
				} else if(!mults['pixelbox-tint']){
					$('#pixelbox-tint').css({backgroundColor:'#'+obj.tint.getHexString()});
				}
				if(prevObj && prevObj.addColor.getHex() != obj.addColor.getHex()){
					$('#pixelbox-add').css({backgroundColor:'transparent'}); mults['pixelbox-add'] = true;
				} else if(!mults['pixelbox-add']){
					$('#pixelbox-add').css({backgroundColor:'#'+obj.addColor.getHexString()});
				}

			}
			
			// end loop
			prevObj = obj;
		}
		
		if(commonType == 'Camera'){
			$('#panel-camera').show();
			if(this.selectedObjects.length != 1) {
				$('#cam-default,#cam-default~label:first').attr('disabled', 'disabled').addClass('multiple').removeAttr('checked');
			} else {
				$('#cam-default,#cam-default~label:first').removeAttr('disabled').removeClass('multiple');
			}			
		}
		
		if(commonType == 'Geometry'){
			$('#panel-geometry').show();
		}
		
		if(commonType == 'PixelBox'){
			$('#panel-pixelbox').show();
			if(mults['animName']){
				$('#pixelbox-animName').prepend('<option value="" selected="selected">- multiple -</option>');
			}
		}
		
		if((containsDirLights || containsHemiLights || containsPointLights || containsSpotLights) &&
			!(containsAnchors || containsCameras || containsContainers || containsInstances || containsGeometry || containsPointClouds)){
			$('#panel-light').show();
			
			$('#light-distance,#light-exponent,#light-angle').spinner('enable');
			$('#light-shadow-bias,#light-shadow-near,#light-shadow-far,#light-shadow-vol-width,#light-shadow-vol-height,#light-shadow-map-width,#light-shadow-map-height').spinner('enable');
			
			if(containsDirLights || containsPointLights || containsHemiLights) $('#light-exponent,#light-angle').spinner('disable');
			if(containsHemiLights) $('#light-distance').spinner('disable');
			if(containsHemiLights || containsPointLights){
				$('#light-shadow-bias,#light-shadow-near,#light-shadow-far,#light-shadow-vol-width,#light-shadow-vol-height,#light-shadow-map-width,#light-shadow-map-height').spinner('disable');
			}
			if(containsDirLights) $('#light-distance').spinner('disable');
			if(containsSpotLights) $('#light-shadow-vol-width,#light-shadow-vol-height').spinner('disable');
			if((containsDirLights || containsSpotLights) && !(containsHemiLights || containsPointLights)){
				$('#light-target').show();
			} else {
				$('#light-target').hide();
			}
		}
		
		// disable move if anchors selected
		if(containsAnchors){
			$('#panel-move input[type=text]').attr('disabled','disabled').spinner('disable');
			$('#panel-move input[type=checkbox]').attr('disabled','disabled');
			$('#look-at,#prop-name,#obj-from-cam').attr('disabled','disabled');
		} else {
			$('#panel-move input[type=text]').removeAttr('disabled').spinner('enable');
			$('#panel-move input[type=checkbox]').removeAttr('disabled');
			$('#look-at,#prop-name,#obj-from-cam').removeAttr('disabled');			
		}
		
		// only hemi lights have ground color
		$('#light-ground-color').css({display: ((containsSpotLights || containsDirLights || containsPointLights) ? 'none' : 'inline-block')});
		
		if(this.selectedObjects.length == 1){
			$('#obj-from-cam').removeAttr('disabled');
		} else {
			$('#obj-from-cam').attr('disabled','disabled');
		}
		
		this.updateStoredPosition();
		
		// if(containsSpotLights || containsDirLights){ $('#look-at').attr('disabled', 'disabled'); }
	},
	
/* ------------------- ------------------- ------------------- ------------------- ------------------- UI functions */

	/* create main editor UI*/
	addUI:function(){
// menu bar
		$('body').append(
		'<div id="menu-bar" class="absolute-pos upper-left editor">\
		<ul class="horizontal"><li>\
		<a id="file">File</a></li><li><a id="edit">Edit</a></li><li><a id="view">View</a></li><li><a id="help">Help</a></li></ul>\
		</div>\
		<ul class="editor absolute-pos submenu shortcuts" id="file-submenu">\
			<li id="file-new">New Scene<em>Ctrl + N</em></li>\
			<hr/>\
			<li id="file-load">Import</li>\
			<li id="file-export">Export</li>\
			<hr/>\
			<li id="file-hold">Hold</li>\
			<li id="file-fetch">Fetch</li>\
			<hr/>\
			<li id="file-reset">Reset editor</li>\
		</ul>\
		<ul class="editor absolute-pos submenu shortcuts" id="edit-submenu">\
			<li id="edit-cut">Cut <em><span class="ctrl"/>X</em></li>\
			<li id="edit-copy">Copy <em><span class="ctrl"/>C</em></li>\
			<li id="edit-paste">Paste <em><span class="ctrl"/>V</em></li>\
			<li id="edit-paste-into">Paste Into <em>Shift+<span class="ctrl"/>V</em></li>\
			<hr/>\
			<li id="edit-delete">Delete selection <em>Delete</em></li>\
		</ul>\
		<ul class="editor absolute-pos submenu" id="view-submenu">\
			<li id="reset-zoom">Reset zoom</li>\
		</ul>\
		<div class="editor absolute-pos upper-right pad5" id="undo-buttons">\
			<button id="redo">Redo</button>&nbsp;\
			<button id="undo">Undo</button>\
		</div>');
		
// file menu
		$('#file').click(function(){
			$('.submenu').hide();
			var pos = $(this).offset();
			pos.top += $(this).height();
			$('#file-submenu').css(pos).show();
		});
		$('#file-new').click(editScene.newDoc.bind(editScene));
		$('#file-load').click(editScene.loadDoc);
		$('#file-export').click(editScene.saveDoc);
		$('#file-reset').click(editScene.resetLocalStorage);
		$('#file-hold').click(editScene.holdDoc);
		$('#file-fetch').click(editScene.fetchDoc);
		$('#file-submenu').menu().hide();

// edit menu
		$('#edit').click(function(){
			$('.submenu').hide();
			var pos = $(this).offset();
			pos.top += $(this).height();
			$('#edit-submenu').css(pos).show();
		});
		$('#edit-submenu').menu().hide();
		$('#edit-delete').click(this.deleteSelection.bind(this));
		$('#edit-copy').click(editScene.copySelection.bind(editScene));
		$('#edit-cut').click(editScene.cutSelection.bind(editScene));
		$('#edit-paste').click(editScene.pasteSelection.bind(editScene));
		$('#edit-paste-into').click(editScene.pasteSelection.bind(editScene));
		
// view menu
		$('#view').click(function(){
			$('.submenu').hide();
			var pos = $(this).offset();
			pos.top += $(this).height();
			$('#view-submenu').css(pos).show();
		});
		$('#reset-zoom').click(editScene.resetZoom.bind(editScene));
		$('#view-submenu').menu().hide();
		
// help menu
		$('#help').click(editScene.showHelp);
	
	
// properties
	$('body').append(
		'<div id="editor-props" class="ui-widget-header ui-corner-all editor floating-panel">\
		<h1>Properties</h1>\
		<hr/>\
		<div id="panel-common" class="panel">\
			<label for="prop-name" class="w2">Name</label><input type="text" size="10" id="prop-name"/>\
			<span id="prop-object-type">Nothing selected</span>\
		</div>\
		<div class="panels">\
			<div id="panel-move" class="panel"><h4>Object3D</h4>\
			<input tabindex="9" type="checkbox" id="prop-visible"/><label for="prop-visible" class="w3">Visible</label>\
			<input tabindex="10" type="checkbox" id="prop-template"/><label for="prop-template" class="w32">Template</label>\
			<hr/><input tabindex="11" type="checkbox" id="prop-cast-shadow"/><label for="prop-cast-shadow" class="w32">Cast Shadow</label>\
			<input tabindex="12" type="checkbox" id="prop-receive-shadow"/><label for="prop-receive-shadow" class="w32">Receive Shadow</label>\
			<hr/><label for="prop-x" class="w0 right-align">X</label><input tabindex="0" type="text" class="center position" id="prop-x" size="1"/>\
			<label for="prop-rx" class="w1 right-align">Rot X</label><input tabindex="3" type="text" class="center rotation" id="prop-rx" size="1"/>\
			<label for="prop-sx" class="w1 right-align">Scale X</label><input tabindex="6" type="text" class="center scale" id="prop-sx" size="1"/><br/>\
			<label for="prop-y" class="w0 right-align">Y</label><input tabindex="1" type="text" class="center position" id="prop-y" size="1"/>\
			<label for="prop-ry" class="w1 right-align">Rot Y</label><input tabindex="4" type="text" class="center rotation" id="prop-ry" size="1"/>\
			<label for="prop-sy" class="w1 right-align">Scale Y</label><input tabindex="7" type="text" class="center scale" id="prop-sy" size="1"/><br/>\
			<label for="prop-z" class="w0 right-align">Z</label><input tabindex="2" type="text" class="center position" id="prop-z" size="1"/>\
			<label for="prop-rz" class="w1 right-align">Rot Z</label><input tabindex="5" type="text" class="center rotation" id="prop-rz" size="1"/>\
			<label for="prop-sz" class="w1 right-align">Scale Z</label><input tabindex="8" type="text" class="center scale" id="prop-sz" size="1"/><br/>\
			<hr/><div class="sub">Store <a id="store-pos">XYZ</a> <a id="store-rot">rotation</a> <a id="store-scale">scale</a><span class="separator-left"/><a id="restore-pos" disabled="disabled">restore</a>\
			<span class="separator-left"/><a id="look-at">look at</a></div>\
			<div class="sub">Clear <a id="clear-pos">XYZ</a> <a id="clear-rot">rotation</a> <a id="clear-scale">scale</a>\
			<span class="separator-left"/><a id="obj-from-cam">from view</a><span class="separator-left"/><a id="obj-to-cam">to view</a></div>\
			</div>\
		</div>\
		</div>');
		
// common
		$('#prop-name').change(this.nameChanged.bind(this));
		
// object3d
		function checkBoxValueChanged(setValueFunc){
			return function(e){
				var targ = $(e.target);
				setValueFunc.call(editScene, e.target.checked);
			}	
		};
		$('#panel-move input.position').spinner({step:1, change:this.positionSpinnerChange, stop:this.positionSpinnerChange });//
		$('#panel-move input.rotation').spinner({step:5, change:this.rotationSpinnerChange, stop:this.rotationSpinnerChange});//
		$('#panel-move input.scale').spinner({step:0.25, change:this.scaleSpinnerChange, stop:this.scaleSpinnerChange});//
		$('#prop-cast-shadow').click(checkBoxValueChanged(this.castShadowChanged));
		$('#prop-receive-shadow').click(checkBoxValueChanged(this.receiveShadowChanged));
		$('#prop-visible').click(this.visibleChanged);
		$('#prop-template').click(this.templateChanged);
		$('#look-at').click(this.lookAtClicked);
		$('#store-pos').click(this.storePosition);
		$('#store-rot').click(this.storeRotation);
		$('#store-scale').click(this.storeScale);
		$('#clear-pos').click(this.clearStorePosition);
		$('#clear-rot').click(this.clearStoreRotation);
		$('#clear-scale').click(this.clearStoreScale);
		$('#restore-pos').click(this.restorePosition.bind(this));
		$('#obj-from-cam').click(this.transformObjectToCam.bind(this));
		$('#obj-to-cam').click(this.transformCamToObject.bind(this));
		
// scene panel
		$('#editor-props .panels').append('<div id="panel-scene" class="panel"><h4>Scene</h4>\
			<label for="scene-max-shadows" class="w32 pad5 right-align">Max shadows</label><input tabindex="3" type="text" class="center" id="scene-max-shadows" size="1"/><br/>\
			<label class="w32 right-align pad5">Clear color</label><div id="scene-color" class="color-swatch"/><br/>\
			<label class="w32 right-align pad5">Ambient</label><div id="scene-ambient-color" class="color-swatch"/><br/>\
			<label class="w32 right-align pad5">Fog color</label><div id="scene-fog-color" class="color-swatch"/><br/>\
			<label for="scene-fog-near" class="w32 pad5 right-align">Fog Near</label><input tabindex="1" type="text" class="center" id="scene-fog-near" size="2"/>\
			<label for="scene-fog-far" class="w1 pad5 right-align"> Far</label><input tabindex="2" type="text" class="center" id="scene-fog-far" size="2"/>\
			</div>');
		
		function valueChanged(setValueFunc){
			return function(e){
				var targ = $(e.target);
				// check if value actually changed
				var prevVal = targ.data('prevVal').toString();
				if(targ.val().toString() === prevVal) return;
				var newVal = parseFloat(targ.spinner('value'));
				if(isNaN(newVal)) newVal = 0;
				setValueFunc.call(editScene, newVal);
				targ.data('prevVal', targ.val());
			}	
		};
		var vc = valueChanged(this.setSceneMaxShadows);
		$('#scene-max-shadows').spinner({step:1, min:0, max:8, change:vc, stop:vc});
		vc = valueChanged(this.setSceneFogNear);
		$('#scene-fog-near').spinner({step:10, min:0, change:vc, stop:vc});//
		vc = valueChanged(this.setSceneFogFar);
		$('#scene-fog-far').spinner({step:10, min:0, change:vc, stop:vc});//
		function colorPickerOnShow(dom){ 
			$(dom).css({zIndex: 10000001});
			var src = $(this);
			var css = src.css('background-color');
			if(css != 'transparent'){
				var clr = new THREE.Color(css);
				var hex = clr.getHexString();
				$(src).data('prevVal', hex);
				src.colpickSetColor(hex, true);
			}
		};
		$('#scene-color').colpick({
			colorScheme:'dark',
			onShow:colorPickerOnShow,
			onHide:function(){ editScene.clearColor = editScene.doc.clearColor.getHex(); /* revert */ },
			onSubmit:function(hsb, hex, rgb, el){
				editScene.setSceneClearColor(hex);
				$(el).colpickHide();
			},
			onChange:function(hsb, hex, rgb, el){
				editScene.clearColor = parseInt(hex,16);				
			}
		});
		$('#scene-ambient-color').colpick({
			colorScheme:'dark',
			onShow:colorPickerOnShow,
			onHide:function(){ editScene.ambient.color.copy(editScene.doc.ambient); /* revert */ },
			onSubmit:function(hsb, hex, rgb, el){
				editScene.setSceneAmbientColor(hex);
				$(el).colpickHide();
			},
			onChange:function(hsb, hex, rgb, el){
				editScene.ambient.color.setHex(parseInt(hex,16));
			}
		});
		$('#scene-fog-color').colpick({
			colorScheme:'dark',
			onShow:colorPickerOnShow,
			onHide:function(){ editScene.scene.fog.color.copy(editScene.doc.fogColor); /* revert */ },
			onSubmit:function(hsb, hex, rgb, el){
				editScene.setSceneFogColor(hex);
				$(el).colpickHide();
			},
			onChange:function(hsb, hex, rgb, el){
				editScene.scene.fog.color.setHex(parseInt(hex,16));
			}
		});

// camera panel
		$('#editor-props .panels').append('<div id="panel-camera" class="panel"><h4>Camera</h4>\
			<input tabindex="3" type="checkbox" id="cam-default"/><label for="cam-default" class="w3">Default camera</label>\
			<hr/>\
			<label for="cam-fov" class="w1 pad5 right-align">FOV</label><input tabindex="0" type="text" class="center" id="cam-fov" size="1"/>\
			<label for="cam-zoom" class="w1 pad5 right-align">Zoom</label><input tabindex="0" type="text" class="center" id="cam-zoom" size="1"/><br/>\
			<label for="cam-near" class="w1 pad5 right-align">Near</label><input tabindex="1" type="text" class="center" id="cam-near" size="2"/>\
			<label for="cam-far" class="w1 pad5 right-align"> Far</label><input tabindex="2" type="text" class="center" id="cam-far" size="2"/><br/>\
			</div>');
		var vc = valueChanged(this.cameraFovChanged);
		$('#cam-fov').spinner({step:5, min:1, max:180, change:vc, stop:vc});
		var vc = valueChanged(this.cameraZoomChanged);
		$('#cam-zoom').spinner({step:1, min:1, change:vc, stop:vc});
		vc = valueChanged(this.cameraNearChanged);
		$('#cam-near').spinner({step:10, min:0, change:vc, stop:vc});//
		vc = valueChanged(this.cameraFarChanged);
		$('#cam-far').spinner({step:10, min:1, change:vc, stop:vc});//
		$('#cam-default').click(this.cameraDefaultChanged);

// Light panel
		$('#editor-props .panels').append('<div id="panel-light" class="panel"><h4>Light</h4>\
			<label class="w3 right-align pad5">Color</label><div id="light-color" class="color-swatch"/>&nbsp;\
			<div id="light-ground-color" class="color-swatch"/>\
			<label for="light-target" class="w3 right-align pad5">Target</label><input type="text" size="10" id="light-target" readonly="readonly"/><br/>\
			<label for="light-intensity" class="w3 pad5 right-align">Intensity</label><input tabindex="0" type="text" class="center" id="light-intensity" size="2"/>\
			<label for="light-shadow-near" class="w32 pad5 right-align">Shadow Near</label><input tabindex="0" type="text" class="center" id="light-shadow-near" size="2"/>\
			<br/>\
			<label for="light-distance" class="w3 pad5 right-align">Distance</label><input tabindex="1" type="text" class="center" id="light-distance" size="2"/>\
			<label for="light-shadow-far" class="w32 pad5 right-align">Shadow Far</label><input tabindex="0" type="text" class="center" id="light-shadow-far" size="2"/>\
			<br/>\
			<label for="light-exponent" class="w3 pad5 right-align">Exponent</label><input tabindex="2" type="text" class="center" id="light-exponent" size="2"/>\
			<label for="light-shadow-vol-width" class="w32 pad5 right-align">Vol. Width</label><input tabindex="0" type="text" class="center" id="light-shadow-vol-width" size="2"/>\
			<br/>\
			<label for="light-angle" class="w3 pad5 right-align">Angle</label><input tabindex="3" type="text" class="center" id="light-angle" size="2"/>\
			<label for="light-shadow-vol-height" class="w32 pad5 right-align">Vol. Height</label><input tabindex="0" type="text" class="center" id="light-shadow-vol-height" size="2"/>\
			<br/>\
			<label for="light-shadow-map-width" class="w3 pad5 right-align">Map Width</label><input tabindex="0" type="text" class="center" id="light-shadow-map-width" size="2"/>\
			<label for="light-shadow-map-height" class="w32 pad5 right-align">Map Height</label><input tabindex="0" type="text" class="center" id="light-shadow-map-height" size="2"/>\
			<br/>\
			<label for="light-shadow-bias" class="w32 pad5 right-align">Shadow Bias</label><input tabindex="0" type="text" class="center" id="light-shadow-bias" size="4"/>\
			</div>');
		$('#light-color').colpick({
			colorScheme:'dark',
			onShow:function(dom){ 
				$(dom).css({zIndex: 10000001});
				var src = $(this);
				var css = src.css('background-color');
				// store preselection color
				for(var i = 0; i < editScene.selectedObjects.length; i++){
					var obj = editScene.selectedObjects[i];
					obj.storedColor = obj.color.getHex();
				}
				if(css != 'transparent'){
					var clr = new THREE.Color(css);
					var hex = clr.getHexString();
					$(src).data('prevVal', hex);
					src.colpickSetColor(hex, true);
				}
			},
			onHide:function(){ 
				for(var i = 0; i < editScene.selectedObjects.length; i++){
					var obj = editScene.selectedObjects[i];
					obj.color.setHex(obj.storedColor);
				}
			},
			onSubmit:function(hsb, hex, rgb, el){
				editScene.setLightColor(parseInt(hex,16));
				$('#light-color').css({backgroundColor:'#'+hex});
				$(el).colpickHide();
			},
			onChange:function(hsb, hex, rgb, el){
				var newColor = parseInt(hex,16);
				for(var i = 0; i < editScene.selectedObjects.length; i++){
					var obj = editScene.selectedObjects[i];
					obj.color.setHex(newColor);
				}
			}
		});
		$('#light-ground-color').colpick({
			colorScheme:'dark',
			onShow:function(dom){ 
				$(dom).css({zIndex: 10000001});
				var src = $(this);
				var css = src.css('background-color');
				// store preselection color
				for(var i = 0; i < editScene.selectedObjects.length; i++){
					var obj = editScene.selectedObjects[i];
					obj.storedColor = obj.groundColor.getHex();
				}
				if(css != 'transparent'){
					var clr = new THREE.Color(css);
					var hex = clr.getHexString();
					$(src).data('prevVal', hex);
					src.colpickSetColor(hex, true);
				}
			},
			onHide:function(){ 
				for(var i = 0; i < editScene.selectedObjects.length; i++){
					var obj = editScene.selectedObjects[i];
					obj.groundColor.setHex(obj.storedColor);
				}
			},
			onSubmit:function(hsb, hex, rgb, el){
				editScene.setGroundLightColor(parseInt(hex,16));
				$(el).colpickHide();
				$('#light-ground-color').css({backgroundColor:'#'+hex});
			},
			onChange:function(hsb, hex, rgb, el){
				var newColor = parseInt(hex,16);
				for(var i = 0; i < editScene.selectedObjects.length; i++){
					var obj = editScene.selectedObjects[i];
					obj.groundColor.setHex(newColor);
				}
			}
		});
		vc = valueChanged(this.lightIntensityChanged);
		$('#light-intensity').spinner({step:0.1, min:0, change:vc, stop:vc});
		vc = valueChanged(this.lightDistanceChanged);
		$('#light-distance').spinner({step:1, min:0, change:vc, stop:vc});
		vc = valueChanged(this.lightExponentChanged);
		$('#light-exponent').spinner({step:1, min:0, change:vc, stop:vc});
		vc = valueChanged(this.lightAngleChanged);
		$('#light-angle').spinner({step:5, min:0, max:180, change:vc, stop:vc});
		
		vc = valueChanged(this.lightShadowBiasChanged);
		$('#light-shadow-bias').spinner({step:0.0001, change:vc, stop:vc});
		vc = valueChanged(this.lightShadowNearChanged);
		$('#light-shadow-near').spinner({step:1, min:0, change:vc, stop:vc});
		vc = valueChanged(this.lightShadowFarChanged);
		$('#light-shadow-far').spinner({step:1, min:1, change:vc, stop:vc});
		vc = valueChanged(this.lightShadowVolWidthChanged);
		$('#light-shadow-vol-width').spinner({step:1, min:1, change:vc, stop:vc});
		vc = valueChanged(this.lightShadowVolHeightChanged);
		$('#light-shadow-vol-height').spinner({step:1, min:1, change:vc, stop:vc});
		vc = valueChanged(this.lightShadowMapWidthChanged);
		$('#light-shadow-map-width').spinner({step:256, min:64, max: 2048, change:vc, stop:vc});
		vc = valueChanged(this.lightShadowMapHeightChanged);
		$('#light-shadow-map-height').spinner({step:256, min:64, max: 2048, change:vc, stop:vc});

// pixelbox panel
		$('#editor-props .panels').append('<div id="panel-pixelbox" class="panel"><h4>PixelBox</h4>\
			<label for="pixelbox-pointSize" class="w32 pad5 right-align">Point size</label><input tabindex="0" type="text" class="center" id="pixelbox-pointSize" size="1"/>\
			<label for="pixelbox-stipple" class="w32 pad5 right-align">Stipple</label><input tabindex="1" type="text" class="center" id="pixelbox-stipple" size="1"/><br/>\
			<label for="pixelbox-alpha" class="w32 pad5 right-align">Alpha</label><input tabindex="2" type="text" class="center" id="pixelbox-alpha" size="1"/>\
			<label for="pixelbox-occlusion" class="w32 pad5 right-align">Occlusion</label><input tabindex="3" type="text" class="center" id="pixelbox-occlusion" size="1"/><hr/>\
			<label class="w32 right-align pad5">Color tint</label><div id="pixelbox-tint" class="color-swatch"/>\
			<label class="w31 right-align pad5">Add</label><div id="pixelbox-add" class="color-swatch"/><hr/>\
			<input tabindex="4" type="checkbox" id="pixelbox-cullBack"/><label for="pixelbox-cullBack" class="w3">Cull backface</label>\
			<hr/>\
			<label for="pixelbox-animSpeed" class="w4 pad5 right-align">Animation speed</label><input tabindex="5" type="text" class="center" id="pixelbox-animSpeed" size="1"/>\
			<a id="anim-restart" class="sub float-right">restart all</a><br/>\
			<input type="radio" name="pixelbox-animOption" tabindex="6" id="pixelbox-gotoAndStop" value="gotoAndStop"/>\
			<label for="pixelbox-gotoAndStop" class="w32 pad5 left-align">gotoAndStop</label>\
			<input type="radio" name="pixelbox-animOption" tabindex="7" id="pixelbox-playAnim" value="playAnim"/>\
			<label for="pixelbox-playAnim" class="w32 pad5 left-align">playAnim</label><br/>\
			<input type="radio" name="pixelbox-animOption" tabindex="8" id="pixelbox-loopAnim" value="loopAnim"/>\
			<label for="pixelbox-loopAnim" class="w32 pad5 left-align">loopAnim</label>\
			<input type="radio" name="pixelbox-animOption" tabindex="9" id="pixelbox-loopFrom" value="loopFrom"/>\
			<label for="pixelbox-loopFrom" class="w32 pad5 left-align">loopFrom</label><br/>\
			<label class="w1 right-align pad5">Anim </label><select id="pixelbox-animName" tabindex="10" class="w4"/>\
			<label for="pixelbox-animFrame" class="w2 right-align pad5">Frame</label><input tabindex="11" class="center" type="text" id="pixelbox-animFrame" size="1"/>\
			</div>');

		$('#anim-restart').click(this.restartAllAnims);
		vc = valueChanged(this.pixelboxPointSizeChanged);
		$('#pixelbox-pointSize').spinner({step:0.1, min:0, change:vc, stop:vc});
		vc = valueChanged(this.pixelboxStippleChanged);
		$('#pixelbox-stipple').spinner({step:1, min:0, max:2, change:vc, stop:vc});
		vc = valueChanged(this.pixelboxAlphaChanged);
		$('#pixelbox-alpha').spinner({step:0.1, min:0, max:1, change:vc, stop:vc});
		vc = valueChanged(this.pixelboxOcclusionChanged);
		$('#pixelbox-occlusion').spinner({step:0.1, min:0, max:1, change:vc, stop:vc});
		$('#pixelbox-cullBack').click(this.pixelboxCullBackChanged);
		vc = valueChanged(this.pixelboxAnimSpeedChanged);
		$('#pixelbox-animSpeed').spinner({step:0.1, change:vc, stop:vc});
		$('#panel-pixelbox input[name=pixelbox-animOption]').click(this.pixelboxAnimTypeChanged);
		vc = valueChanged(this.pixelboxStartFrameChanged);
		$('#pixelbox-animFrame').spinner({step:1, min:0, change:vc, stop:vc});
		$('#pixelbox-animName').change(this.pixelboxAnimNameChanged);
		$('#pixelbox-tint').colpick({
			colorScheme:'dark',
			onShow:function(dom){ 
				$(dom).css({zIndex: 10000001});
				var src = $(this);
				var css = src.css('background-color');
				// store preselection color
				for(var i = 0; i < editScene.selectedObjects.length; i++){
					var obj = editScene.selectedObjects[i];
					obj.storedColor = obj.tint.getHex();
				}
				if(css != 'transparent'){
					var clr = new THREE.Color(css);
					var hex = clr.getHexString();
					$(src).data('prevVal', hex);
					src.colpickSetColor(hex, true);
				}
			},
			onHide:function(){ 
				for(var i = 0; i < editScene.selectedObjects.length; i++){
					var obj = editScene.selectedObjects[i];
					obj.tint.setHex(obj.storedColor);
				}
			},
			onSubmit:function(hsb, hex, rgb, el){
				editScene.pixelboxSetTint(parseInt(hex,16));
				$(el).colpickHide();
				$('#pixelbox-tint').css({backgroundColor:'#'+hex});
			},
			onChange:function(hsb, hex, rgb, el){
				var newColor = parseInt(hex,16);
				for(var i = 0; i < editScene.selectedObjects.length; i++){
					var obj = editScene.selectedObjects[i];
					obj.tint.setHex(newColor);
				}
			}
		});
		$('#pixelbox-add').colpick({
			colorScheme:'dark',
			onShow:function(dom){ 
				$(dom).css({zIndex: 10000001});
				var src = $(this);
				var css = src.css('background-color');
				// store preselection color
				for(var i = 0; i < editScene.selectedObjects.length; i++){
					var obj = editScene.selectedObjects[i];
					obj.storedColor = obj.addColor.getHex();
				}
				if(css != 'transparent'){
					var clr = new THREE.Color(css);
					var hex = clr.getHexString();
					$(src).data('prevVal', hex);
					src.colpickSetColor(hex, true);
				}
			},
			onHide:function(){ 
				for(var i = 0; i < editScene.selectedObjects.length; i++){
					var obj = editScene.selectedObjects[i];
					obj.addColor.setHex(obj.storedColor);
				}
			},
			onSubmit:function(hsb, hex, rgb, el){
				editScene.pixelboxSetAddColor(parseInt(hex,16));
				$(el).colpickHide();
				$('#pixelbox-add').css({backgroundColor:'#'+hex});
			},
			onChange:function(hsb, hex, rgb, el){
				var newColor = parseInt(hex,16);
				for(var i = 0; i < editScene.selectedObjects.length; i++){
					var obj = editScene.selectedObjects[i];
					obj.addColor.setHex(newColor);
				}
			}
		});	

// Plane/mesh panel
		$('#editor-props .panels').append('<div id="panel-geometry" class="panel"><h4>Geometry</h4>\
			<label class="w32 right-align pad5">Color tint</label><div id="geometry-tint" class="color-swatch"/>\
			<label class="w31 right-align pad5">Add</label><div id="geometry-addColor" class="color-swatch"/><hr/>\
			<label for="geometry-alpha" class="w32 pad5 right-align">Alpha</label><input tabindex="0" type="text" class="center" id="geometry-alpha" size="1"/>\
			<label for="geometry-brightness" class="w32 pad5 right-align">Brightness</label><input tabindex="1" type="text" class="center" id="geometry-brightness" size="1"/>\
			<label for="geometry-stipple" class="w32 pad5 right-align">Stipple</label><input tabindex="2" type="text" class="center" id="geometry-stipple" size="1"/>\
			</div>');
		vc = valueChanged(this.geometryStippleChanged);
		$('#geometry-stipple').spinner({step:1, min:0, max:2, change:vc, stop:vc});
		vc = valueChanged(this.geometryAlphaChanged);
		$('#geometry-alpha').spinner({step:0.1, min:0, max:1, change:vc, stop:vc});
		vc = valueChanged(this.geometryBrightnessChanged);
		$('#geometry-brightness').spinner({step:0.1, change:vc, stop:vc});

		$('#geometry-tint').colpick({
			colorScheme:'dark',
			onShow:function(dom){ 
				$(dom).css({zIndex: 10000001});
				var src = $(this);
				var css = src.css('background-color');
				// store preselection color
				for(var i = 0; i < editScene.selectedObjects.length; i++){
					var obj = editScene.selectedObjects[i];
					obj.storedColor = obj.material.tint.getHex();
				}
				if(css != 'transparent'){
					var clr = new THREE.Color(css);
					var hex = clr.getHexString();
					$(src).data('prevVal', hex);
					src.colpickSetColor(hex, true);
				}
			},
			onHide:function(){ 
				for(var i = 0; i < editScene.selectedObjects.length; i++){
					var obj = editScene.selectedObjects[i];
					obj.material.tint.setHex(obj.storedColor);
				}
			},
			onSubmit:function(hsb, hex, rgb, el){
				editScene.setGeometryTint(parseInt(hex,16));
				$('#geometry-tint').css({backgroundColor:'#'+hex});
				$(el).colpickHide();
			},
			onChange:function(hsb, hex, rgb, el){
				var newColor = parseInt(hex,16);
				for(var i = 0; i < editScene.selectedObjects.length; i++){
					var obj = editScene.selectedObjects[i];
					obj.material.tint.setHex(newColor);
				}
			}
		});
		$('#geometry-addColor').colpick({
			colorScheme:'dark',
			onShow:function(dom){ 
				$(dom).css({zIndex: 10000001});
				var src = $(this);
				var css = src.css('background-color');
				// store preselection color
				for(var i = 0; i < editScene.selectedObjects.length; i++){
					var obj = editScene.selectedObjects[i];
					obj.storedColor = obj.material.addColor.getHex();
				}
				if(css != 'transparent'){
					var clr = new THREE.Color(css);
					var hex = clr.getHexString();
					$(src).data('prevVal', hex);
					src.colpickSetColor(hex, true);
				}
			},
			onHide:function(){ 
				for(var i = 0; i < editScene.selectedObjects.length; i++){
					var obj = editScene.selectedObjects[i];
					obj.material.addColor.setHex(obj.storedColor);
				}
			},
			onSubmit:function(hsb, hex, rgb, el){
				editScene.setGeometryAddColor(parseInt(hex,16));
				$('#geometry-addColor').css({backgroundColor:'#'+hex});
				$(el).colpickHide();
			},
			onChange:function(hsb, hex, rgb, el){
				var newColor = parseInt(hex,16);
				for(var i = 0; i < editScene.selectedObjects.length; i++){
					var obj = editScene.selectedObjects[i];
					obj.material.addColor.setHex(newColor);
				}
			}
		});

		var savePosOnDrop = function(e, ui) { localStorage_setItem(ui.helper.context.id + '-x', ui.position.left); localStorage_setItem(ui.helper.context.id + '-y', ui.position.top); };
		var bringToFront = function(e, ui){ $('body').append(ui.helper.context); }
		function makeDraggablePanel(id, defX, defY, defH, onResizeHandler){
			var panel = $('#'+id);
			var dw = panel.width();
			var dh = panel.height();
			panel.resizable({
				containment:"body",
				minHeight:200,
				minWidth:parseInt(panel.css('min-width')),
				maxWidth:parseInt(panel.css('min-width')),
				stop: function(e, ui){
					var h = ui.size.height;
					localStorage_setItem(ui.helper.context.id + '-height', h);
				},
				resize: onResizeHandler
			});
			var coll = localStorage_getItem(id+'-collapsed'); 
			if(coll === 'true') { 
				panel.addClass('collapsed').resizable('disable');
			} else {
				var h = parseInt(localStorage_getItem(id+'-height'));
				panel.css('height', h ? h : defH);
			}
			if(onResizeHandler) onResizeHandler();
			dh = panel.height();
			var dx = localStorage_getItem(id+'-x');
			var dy = localStorage_getItem(id+'-y');
			dx = Math.min((dx === null) ? defX : dx, window.innerWidth - dw);
			dy = Math.min((dy === null) ? defY : dy, window.innerHeight - dh);
			panel.offset({left:dx, top: dy}).draggable({ snap: ".editor", containment: "body", cancel: '.ui-widget,input,a,button,#scene-list,select', 
															start: bringToFront, stop: savePosOnDrop });
			panel.mousedown(function(){ $('.floating-panel').css({zIndex:1000000}); $(this).css({zIndex:1000001}); $('.submenu').hide();});
		}
		
// scene graph window
		$('body').append(
		'<div id="editor-scene" class="ui-widget-header ui-corner-all editor floating-panel">\
		<h1>Scene</h1>\
		<hr/>\
		<button id="scene-add">Add Object</button>\
		<div class="float-right"><button id="test-scene">Preview</button></div>\
		<hr/>\
		<div id="scene-list"></div>\
		<hr/>\
		<button id="scene-delete">Delete</button>\
		</div>\
		<ul id="scene-add-menu" class="editor submenu absolute-pos shortcuts">\
			<li id="scene-add-asset">PixelBox Asset ...<em>&#10095;</em></li><hr/>\
			<li id="scene-add-instance">Instance (Template) ...<em>&#10095;</em></li>\
			<li id="scene-add-container">Object3D (Container)</li><hr/>\
			<li id="scene-add-geometry">Geometry</li><hr/>\
			<li id="scene-add-hemi">Hemisphere Light (Ambient)</li>\
			<li id="scene-add-dir">Directional Light</li>\
			<li id="scene-add-spot">Spot Light</li>\
			<li id="scene-add-point">Point Light</li><hr/>\
			<li id="scene-add-camera">Perspective Camera</li>\
			<li id="scene-add-ortho-camera">Orthographic Camera</li>\
  		</ul>\
		</ul>');
		$('#scene-add').button({icons:{secondary:'ui-icon-triangle-1-n'}}).click(function(){
		    $('#scene-add-menu').show().position({
	            at: "right top",
	            my: "right bottom",
	            of: this
	          });	       
          return false;
	    })
	    $('#scene-add-menu').hide().menu().click(this.addObjectMenuItemClicked.bind(this));
	    $('#scene-dupe').button();
	    $('#scene-delete').button().click(this.deleteSelection.bind(this));
		$('#test-scene').button().click(this.previewScene.bind(this));

// assets
		$('body').append(
		'<div id="editor-assets" class="ui-widget-header ui-corner-all editor floating-panel">\
		<h1>Assets</h1>\
		<hr/>\
		<button id="asset-add">Add to Scene</button><span class="separator-left"/>\
		<button id="asset-new">New</button>\
		<hr/>\
		<div id="asset-list"></div>\
		<hr/>\
		<button id="asset-rename">Rename</button>\
		<button id="asset-delete" class="float-right">Delete</button>\
		</div>');
		$('#asset-new').button().click(this.assetNew.bind(this));
		$('#asset-add').button().click(this.assetAdd);
		$('#asset-rename').button().click(this.assetRename.bind(this));
	    $('#asset-delete').button().click(this.assetDelete.bind(this));
	    
	    makeDraggablePanel('editor-scene', 0, 40, window.innerHeight * 0.5 - 60, function(){
	    	var h = $('#editor-scene').height();
	    	$('#scene-list').css('height', h - 140);
	    });
   		makeDraggablePanel('editor-props', 0, window.innerHeight * 0.5, window.innerHeight * 0.5 - 20, function(){
	    	var h = $('#editor-props').height();
	    	$('#editor-props .panels').height(h - 100);
	    });
	    makeDraggablePanel('editor-assets', window.innerWidth - $('#editor-assets').width() - 20, window.innerHeight * 0.7, window.innerHeight * 0.3 - 20, function(){
    		var h = $('#editor-assets').height();
    		$('#asset-list').css('height', h - 140);
	    });

// replace shortcut text
		$('.editor .ctrl').append(navigator.appVersion.indexOf("Mac")!=-1 ? '&#8984; ':'Ctrl + ');//⌘
	
// undo/redo
		$('#undo').button().click(this.performUndo.bind(this));
		$('#redo').button().click(this.performRedo.bind(this));
		
// protect canvas when over UI
		$('.editor').hover(editScene.disableCanvasInteractions.bind(editScene),
							editScene.enableCanvasInteractions.bind(editScene));
		$("div").disableSelection();
		
// add collapse buttons
		$('#editor-props,#editor-scene,#editor-assets').prepend('<a class="toggleCollapse">[-]</a>');
		$('.editor a.toggleCollapse').each(function(i, el){
			el = $(el);
			if(el.parent().hasClass('collapsed')) el.text('[+]'); 
		});
		$('.toggleCollapse').click(function(){
			var parent = $(this).parent();
			parent.toggleClass('collapsed');
			var collapsed = parent.hasClass('collapsed');
			$(this).text(collapsed ? '[+]' : '[-]');
			var dw = parent.width(), dh = parent.height();
			var pos = parent.offset();
			parent.offset({left:Math.min(pos.left, window.innerWidth - dw - 20),
							top: Math.min(pos.top, window.innerHeight - dh - 20)});
			var parentid = parent.get(0).id;
			if(collapsed){
				parent.resizable('disable');
				parent.css('height','');
			} else {
				parent.resizable('enable');
				parent.css('height', parseInt(localStorage_getItem(parentid+'-height')));
			}
			localStorage_setItem(parentid+'-collapsed', collapsed);
			parent.resizable('option','resize')();
		});
		
// focus/blur
		$('input').on('focus',function(e){editScene.focusedTextField = e.target; editScene.disableKeyboardShortcuts();})
				  .on('blur',function(e){editScene.focusedTextField = null; editScene.enableKeyboardShortcuts();})
				  .on('keyup',function(e){ if(e.which == 13) e.target.blur(); });
		
		$(window).on('dragover', this.onDragFilesOver);
		$(window).on('dragleave', this.onDragFilesOver);
		$(window).on('drop', this.onDropFiles);
		
		this.enableCanvasInteractions(true);
	},
	
	/* dispose of main UI */
	removeUI:function(){
		$('.editor').remove();
		$('body').off('mouseup.editor');
	},
	
	addObjectMenuItemClicked:function(e, asset, instance){
		var objDef = null;
		var addTarget;
		var addPos = new THREE.Vector3();
		// add into
		if(e.shiftKey) {
			addTarget = this.selectedObjects.length ? this.selectedObjects[0] : this.container;
		// add next to
		} else {
			addTarget = this.selectedObjects.length ? this.selectedObjects[0].parent : this.container;
			if(this.selectedObjects.length) addPos.copy(this.selectedObjects[0].position);
		}
		var addWorldPos = addTarget.parent.localToWorld(addPos.clone());
		
		switch(e.target.id){
		case 'scene-add-asset':
		
		// populate:
			$('#scene-add-submenu').remove();
			var submenu = $('<ul id="scene-add-submenu" class="editor submenu absolute-pos">');
			var numRows = 0;
			for(var aname in assets.cache.files){
				var row = $('<li/>');
				row.text(aname);
				var func = (function(assetName){ 
					return function(e){
						editScene.addObjectMenuItemClicked(e, assetName);
					};
				})(aname);
				row.click(func);
				submenu.append(row);
				numRows++;
			}
			if(!numRows) submenu.append('<span class="info">- No Assets in Scene -</span>');			
			submenu.menu().position({
	            at: "right top",
	            my: "right bottom",
	            of: $('#scene-add')
	          });
	        $('body').append(submenu);
			break;					
		case 'scene-add-instance':
			$('#scene-add-submenu').remove();
			var submenu = $('<ul id="scene-add-submenu" class="editor submenu absolute-pos">');
			var numRows = 0;
			editScene.container.traverse(function(obj){
				if(obj.isTemplate){
					var row = $('<li/>');
					row.text(obj.name);
					var func = (function(templateName){ 
						return function(e){
							editScene.addObjectMenuItemClicked(e, null, templateName);
						};
					})(aname);
					row.click(func);
					submenu.append(row);
					numRows++;
				}
			});
			if(!numRows) submenu.append('<span class="info">- No Templates in Scene -</span>');			
			submenu.menu().position({
	            at: "right top",
	            my: "right bottom",
	            of: $('#scene-add')
	          });
	        $('body').append(submenu);
			
			return;
		case 'scene-add-container':
			objDef = { asset: 'Object3D', name:'container' };
			break;
			
		case 'scene-add-geometry':
			objDef = { asset: 'Geometry', type:'Plane', name:'floor', color:'999999', receiveShadow:true, scale:[100,100,100], rotation:[-90,0,0] };
			break;
		
		case 'scene-add-hemi':
			objDef = { asset: 'HemisphereLight', name:'ambient', colors:["2f62ff", "333399"], intensity:0.5 };
			break;
			
		case 'scene-add-dir':
			objDef = { asset: 'DirectionalLight', name:'sun', castShadow: true, receiveShadow: false, color:"ffffff", intensity:0.5,
						target:[addWorldPos.x, addWorldPos.y - 100, addWorldPos.z] };
			break;
		
		case 'scene-add-spot':
			objDef = { asset: 'SpotLight', name:'spotlight', castShadow: true, receiveShadow: false, color:"ffffff", 
				intensity:0.5, angle:30, distance:100, target:[addWorldPos.x, addWorldPos.y - 100, addWorldPos.z] };
			break;
		
		case 'scene-add-point':
			objDef = { asset: 'PointLight', name:'pointlight', color:"ffffff", intensity:0.5, distance:10 };
			break;
			
		case 'scene-add-camera':
			objDef = { asset: 'Camera', name:'camera', fov:60, near:1, far:500 };
			break;
			
		case 'scene-add-ortho-camera':
			objDef = { asset: 'OrthographicCamera', name:'camera', fov:60, near:1, far:500 };
			break;
		
		default:
			if(asset){
				var anims = assets.cache.files[asset].anims;
				var anames = _.keys(anims);
				var firstAnim = anames.length ? anames[0] : '';				
				objDef = { asset: asset, name:asset, animOption: 'gotoAndStop', animFrame: 0, animName: firstAnim };
			}
			
			if(instance){
				// find instance
				var instanceObject = null;
				editScene.container.traverse(function(obj){
					if(!instanceObject && obj.isTemplate && obj.name == instance){
						instanceObject = obj;
					}
				});
				if(!instanceObject) return;
				
				// NEXT check nesting
				// walk up parent line, if encountering instance of "instance", fail
			}
			break;
		
		}
		
		if(objDef){
			objDef.position = [addPos.x, addPos.y, addPos.z];
			this.deselectAll();
			
			var addedObject = (this.populateObject(addTarget, [ objDef ], { helpers: true, keepSceneCamera:true, noNameReferences:true }))[0];
			var doAdd = [ [addedObject, addTarget] ];
			var undoAdd = [ addedObject ];
			this.addUndo({name:"addObject", redo:[this.addObjects, doAdd], undo:[this.deleteObjects, undoAdd] });
			
			this.refreshScene();
			this.updateLights = true;

			this.updateTextLabels(this.container, 0);
			this.selectObject(addedObject, true);
			
			this.camera.lookAt(addWorldPos);
			this.controls.center.copy(addWorldPos);
			
			this.selectionChanged();
			this.refreshProps();
		}	
	},

	showHelp:function(){
		$('.submenu').hide();
		if(!$('#help-view').length){
			$('body').append('<div id="help-view" class="no-close">\
			<span class="info">PixelBox and related tools created by Kirill Edelman.<br/>\
			Huge thanks to mrdoob for creating <a href="http://threejs.org/" target="_blank">three.js</a></span>\
			<hr/>\
			<h2>Shortcuts</h2>\
			<em>Ctrl + N</em> create new<br/>\
			<em>Ctrl + S</em> hold<br/>\
			<em>Ctrl + E</em> export data<br/>\
			<br/>\
			<em><span class="ctrl"/>C</em> copy selection<br/>\
			<em><span class="ctrl"/>X</em> cut selection<br/>\
			<em><span class="ctrl"/>V</em> paste selection<br/>\
			</div>');
		}
		
		$('#help-view .ctrl').append(navigator.appVersion.indexOf("Mac")!=-1 ? '⌘ ':'Ctrl + ');
		
		editScene.disableCanvasInteractions(true);
		$('#help-view').dialog({
	      resizable: false, width: 500, height:500, modal: true, dialogClass:'no-close', title:"Help",
	      buttons: { OK: function() { $(this).dialog("close"); } },
	      close: function(){ $(this).remove(); editScene.enableCanvasInteractions(true); }
	      });
	},
	
	// unfocus from text field or 
	blur:function(){
		if(editScene.focusedTextField) editScene.focusedTextField.blur();
		$('div,span').blur();
	},
	
	disableCanvasInteractions:function(all){
		if(this.controls.busy()) { 
			this.disableCanvasInteractionsOnRelease = true;
		} else {
			this.canvasInteractionsEnabled = false;
		}
		
		if(all === true){
			$(window).off('mouseup.editor mousedown.editor mousemove.editor');
			this.disableKeyboardShortcuts();
		}
	},
	
	enableCanvasInteractions:function(all){
		this.disableCanvasInteractionsOnRelease = false;
		this.canvasInteractionsEnabled = true;
		if(all === true){
			this.disableKeyboardShortcuts();
			this.enableKeyboardShortcuts();
			$(window).off('.editor');
			$(window).on('keydown.editor', this.keyDown.bind(this));
			$(window).on('keyup.editor', this.keyUp.bind(this));
			$(window).on('mouseup.editor', this.mouseUp.bind(this));
			$(window).on('mousemove.editor', this.mouseMove.bind(this));
			$(window).on('mousedown.editor', this.mouseDown.bind(this));
		}
	},

/* ------------------- ------------------- ------------------- ------------------- ------------------- Keyboard functions */

	enableKeyboardShortcuts:function(){
		//key('ctrl+n,⌘+n', function(){ editScene.newDoc(); return false; });
		key('ctrl+z,⌘+z', function(){ editScene.performUndo(); return false; });
		key('ctrl+shift+z,⌘+shift+z', function(){ editScene.performRedo(); return false; });
		//key('ctrl+shift+c,⌘+shift+c', function(){ editScene.frameRangeCopy({}); return false; });
		//key('ctrl+shift+v,⌘+shift+v', function(){ editScene.frameRangePaste({}); return false; });
		//key('ctrl+shift+x,⌘+shift+x', function(){ editScene.frameRangeCut({}); return false; });
		key('ctrl+c,⌘+c', function(){ editScene.copySelection(); return false; });
		key('ctrl+v,⌘+v', function(){ editScene.pasteSelection({shiftKey:false}); return false; });
		key('shift+ctrl+v,shift+⌘+v', function(){ editScene.pasteSelection({shiftKey:true}); return false; });
		key('ctrl+x,⌘+x', function(){ editScene.cutSelection(); return false; });
		//key('escape', function(){ editScene.cancelPaste(); return false; });
		//key('ctrl+s,⌘+s', function(){ editScene.holdDoc(); return false; });
		//key('ctrl+e,⌘+e', function(){ editScene.saveDoc(); return false; });
	},

	disableKeyboardShortcuts:function(){
		//key.unbind('ctrl+n,⌘+n');
		key.unbind('ctrl+z,⌘+z');
		key.unbind('ctrl+shift+z,⌘+shift+z');
		key.unbind('ctrl+c,⌘+c');
		key.unbind('ctrl+x,⌘+x');
		key.unbind('ctrl+v,⌘+v');
		key.unbind('shift+ctrl+v,shift+⌘+v');
		//key.unbind('ctrl+shift+c,⌘+shift+c');
		//key.unbind('ctrl+shift+x,⌘+shift+x');
		//key.unbind('ctrl+shift+v,⌘+shift+v');
		//key.unbind('escape');
		//key.unbind('ctrl+s,⌘+s');
		//key.unbind('ctrl+e,⌘+e');*/
	},

	/* shortcuts */
	keyUp:function(e){
		if(editScene.focusedTextField || (e.target && (e.target.tagName == 'INPUT' || e.target.tagName == 'TEXTAREA'))) return;
	
		e.preventDefault();
		if($('.ui-dialog').length) return;

		switch(e.which){
		case 90: // Z
			if(e.shiftKey) editScene.performRedo();
			else editScene.performUndo();
			break;
		case 16:
			editScene.shift = false;
			break;
		case 17:
			editScene.ctrl = false;
			break;
		case 18:
			editScene.alt = false;
			break;
		}
	},
	
	keyDown:function(e){
		// process tabbing inside panels
		if(e.target && (e.target.tagName == 'INPUT' || e.target.tagName == 'TEXTAREA')){
			if (e.which == 9) {
	            e.preventDefault();
	            var targ = $(e.target);
	            var tabIndex = targ.attr('tabindex');
	            var siblings = [];
	            if(targ.hasClass('ui-spinner-input')){
		            siblings = targ.parent().parent().find(':tabbable'+(tabIndex != undefined ? '[tabindex]' : ''));
	            } else {
		            siblings = targ.parent().find(':tabbable'+(tabIndex != undefined ? '[tabindex]' : ''));
		        }
		        var index = siblings.index(targ);
		        if(index != -1){
		        	if(tabIndex != undefined){
		        		tabIndex = parseInt(tabIndex);
		        		if(e.shiftKey){
		        			tabIndex--;
		        			if(tabIndex < 0) tabIndex = siblings.length - 1;
		        		} else {
		        			tabIndex = (tabIndex + 1) % siblings.length;
		        		}
		        		siblings.filter('[tabindex='+tabIndex+']').focus().select();
		        	} else {
			        	if(e.shiftKey){
			        		index--;
			        		if(index < 0) index = siblings.length - 1;
			        	} else {
			        		index = (index + 1) % siblings.length;
			        	}
			        	siblings.eq(index).focus().select();
		        	}
		        }
	        }
	        return;
		}
		if(editScene.focusedTextField) return;
		
		e.preventDefault();
		e.stopPropagation();
		
		if($('.ui-dialog').length && e.which != 13) return;
		
		switch(e.which){
		case 16:
			editScene.shift = true;
			break;
		case 17:
			editScene.ctrl = true;
			editScene.controls.rotateEnabled = !editScene.shift;
			break;
		case 18:
			editScene.alt = true;
			break;
		case 219:// [
			//editScene.maskPlaneStep(-1);
			break;
		case 221:// ]
			//editScene.maskPlaneStep(1);
			break;
		case 188:// <
			//editScene.currentFrame--;
			break;
		case 190:// >
			//editScene.currentFrame++;
			break;
		case 8: // del
		case 46: // back
			editScene.deleteSelection();
			break;
		case 187: // +
			//editScene.maskInflate(null, 1);
			break;
		case 189:// -
			//editScene.maskInflate(null, -1);
			break;
		case 13: // enter
			var btn = $('.ui-dialog .ui-dialog-buttonset button').first();
			if(btn.length) btn.trigger('click');
			break;
		case 37: // left
			editScene.moveTool(-(e.shiftKey ? 5 : 1),0);
			break;
		case 39: // right
			editScene.moveTool((e.shiftKey ? 5 : 1),0);
			break;
		case 38: // up
			editScene.moveTool(0,(e.shiftKey ? 5 : 1));
			break;
		case 40: // down
			editScene.moveTool(0,-(e.shiftKey ? 5 : 1));
			break;
		case 32: // space
			break;
			
		case 27: // esc
			if(editScene.objectPickMode){
				editScene.objectPickMode(null);
			}
			break;
			
		default:
			console.log(e);
			break;
		}
	},
	
	showMessage:function(html){
		var msg = $('div.bigMessage');
		msg.each(function(i, el){
			var offs = $(el).offset();
			$(el).offset({top:offs.top + 100, left: offs.left });
		});
		msg = $('<div class="bigMessage"/>').html(html);
		$('body').append(msg);
		msg.offset({top: 60, left: Math.floor(0.5 * (window.innerWidth - msg.width())) });
		setTimeout(function(){ msg.fadeOut(function(){ msg.remove(); }); }, 2000);
	},

/* ------------------- ------------------- ------------------- ------------------- ------------------- Framework */

	/* initialize */
	init:function(){
		// defaults
		var bgc = localStorage_getItem('editor-scene-bg-color');
		this.clearColor = (bgc !== null ? parseInt(bgc,16) : 0x333333);	
		
		// setup scene
		this.scene = new THREE.Scene();
		this.scene.fog = new THREE.Fog(0x0, 1000, 10000);
		
		// ambient
		this.ambient = new THREE.AmbientLight(0x0);
		this.scene.add(this.ambient);

		// camera
		this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 2000000 );
		this.camera.position.set(512, 512, 512);
		this.camera.lookAt(new THREE.Vector3(0,0,0));
		this.scene.add(this.camera);
		this.controls = new THREE.EditorControls(this.camera, document.body);//renderer.webgl.domElement);
	    this.controls.panEnabled = this.controls.rotateEnabled = this.controls.zoomEnabled = true;
	    
   		// projector & mouse picker
		this.projector = new THREE.Projector();
		this.raycaster = new THREE.Raycaster( new THREE.Vector3(), new THREE.Vector3(), 0.01, this.camera.far ) ;
		this.projectorPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);

		// create render target
		var renderTargetParameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat, stencilBuffer: false };
		this.fbo = new THREE.WebGLRenderTarget( window.innerWidth * renderer.scale,
												window.innerHeight * renderer.scale, renderTargetParameters );
					
		renderer.webgl.shadowMapEnabled = true;
		renderer.webgl.shadowMapSoft = true;
		renderer.webgl.shadowMapType = THREE.PCFSoftShadowMap;
		
		this.defaultSceneDef = {
			name:'newScene',
			maxShadows:2,
			clearColor:'333333',
			ambient:'000000',
			fogColor:'003399',
			fogNear:1000, fogFar:10000,
			layers:[
			{	"name": "camera",
				"asset": "Camera",
				"position": [0,50,100],
				"lookAt": [0,0,0],
				"isDefault": true
			},
			{	"name": "sun",
				"asset": "DirectionalLight",
				"position": [0, 150, 0],
				"target": [0, 0, 0],
				"color": "FFFFFF",			
				"castShadow": true,
				"shadowBias": -0.00015,
				"intensity": 0.5,
				"shadowVolumeWidth": 256,
				"shadowVolumeHeight": 256,
				"shadowMapWidth": 1024
			},
			{	"name": "ambient",
				"asset": "HemisphereLight",
				"colors": ["2f62ff", "333399"],
				"position": [0, 170, 0],
				"intensity": 0.4
			}]
		};
		
		// fetch copy object
		try {
			this.sceneCopyItem = localStorage_getItem("sceneCopy");
			if(this.sceneCopyItem) this.sceneCopyItem = JSON.parse(this.sceneCopyItem);
		} catch(e){ console.log(e); }
	},
	
	/* callbacks */
	onWillAdd:function(){
		$(window).on('resize.editScene',this.onResized.bind(this));
	},		
	onAdded:function(){
		this.addUI();
		
		editScene.enableCanvasInteractions(true);
		
		document.addEventListener("contextmenu", function(e) {
			if(editScene.ctrl || e.ctrlKey || $(e.target).hasClass('object-label')){
				e.preventDefault();
				//editScene.mouseDown(e);
				//e.stopPropagation();
				if(!$(e.target).hasClass('object-label')) $(e.target).trigger('click');
			}
			return false;
		}, false);
		
		// ready to display scene
		var data = localStorage_getItem('holdScene');
      	if(data){ 
      		this.newDocFromData(JSON.parse(data));
      	} else {
			this.newDoc(true);
		}
		this.resetZoom();
	},
	
	onWillRemove:function(){ 
		this.removeUI();
		$(window).off('.editor');
		editScene.disableKeyboardShortcuts();
	},
	onRemoved:function(){
		this.controls.panEnabled = this.controls.rotateEnabled = this.controls.zoomEnabled = false;
		$(window).off('.editor');
	},
	
	render:function( delta, rtt ) {
		renderer.webgl.setClearColor( this.clearColor, 1 );
		if (rtt) renderer.webgl.render( this.scene, this.camera, this.fbo, true );
		else renderer.webgl.render( this.scene, this.camera );
		
		this.updateTextLabels(this.container, 0);
		if(this.updateLights){
			THREE.PixelBox.updateLights(this.scene, true);
			this.updateLights = false;
		}
		
		if(this.placeHolderLights){
			while(this.placeHolderLights.length){
				var sun = this.placeHolderLights[0];
				this.scene.remove(sun);
				this.placeHolderLights.splice(0,1);
				sun.shadowMap.dispose();
			}
		}
	},
	
	onResized: function(e){
		if($(e.target).hasClass('floating-panel')) return;
		
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();
		var renderTargetParameters = { 
			minFilter: THREE.LinearFilter, 
			magFilter: THREE.LinearFilter, 
			format: THREE.RGBFormat, 
			stencilBuffer: false };
		this.fbo = new THREE.WebGLRenderTarget( window.innerWidth * renderer.scale, window.innerHeight * renderer.scale, renderTargetParameters );
		
		localStorage_setItem('windowWidth',window.outerWidth);
		localStorage_setItem('windowHeight',window.outerHeight);
    },
};

editScene = new EditSceneScene();

/* scene serializing */
THREE.Object3D.prototype.getNearestTemplate = function(){
	if(this.isTemplate) return this;
	if(!this.parent) return null;
	return this.parent.getNearestTemplate();
};

THREE.Object3D.prototype.getReferenceName = function(){
	var nameString = (this.isAnchor ? '$' : '') + this.name;
	if(this.parent && this.parent.name && this.parent.name.length && !this.parent.isTemplate){
		return this.parent.getReferenceName() + '.' + nameString;
	}
	return nameString;
};

THREE.Object3D.prototype.serialize = function(templates){
	var def = {
		name: this.name
	};
	// common props
	var radToDeg = 180 / Math.PI;
	if(this.position.x || this.position.y || this.position.z) def.position = [this.position.x, this.position.y, this.position.z];
	if(this.rotation.x || this.rotation.y || this.rotation.z) def.rotation = [this.rotation.x * radToDeg, this.rotation.y * radToDeg, this.rotation.z * radToDeg];
	if(this.scale.x != 1.0 || this.scale.y != 1.0 || this.scale.z != 1.0) {
		if(this.scale.x != this.scale.y || this.scale.y != this.scale.z || this.scale.y != this.scale.x){
			def.scale = [this.scale.x, this.scale.y, this.scale.z];
		} else {
			def.scale = this.scale.x;
		}
	}
	if(this.castShadow !== undefined) def.castShadow = this.castShadow;
	if(this.receiveShadow !== undefined) def.receiveShadow = this.receiveShadow;
	if(!this.visible) def.visible = false;
	if(this.children.length) def.layers = [];
	if(this.isTemplate) def.isTemplate = true;
	
	// types
	if(this instanceof THREE.Camera){
		if(this instanceof THREE.PerspectiveCamera){
			def.asset =  'Camera';
			def.fov = this.fov;
		} else {
			def.asset =  'OrthographicCamera';
			def.zoom = this.zoom;
		}
		def.near = this.near;
		def.far = this.far;
		def.isDefault = !!this.isDefault;
	} else if(this instanceof THREE.DirectionalLight){
		def.asset = 'DirectionalLight';
		if(this.shadowCameraRight != 128) def.shadowVolumeWidth = this.shadowCameraRight * 2;
		if(this.shadowCameraTop != 128) def.shadowVolumeHeight = this.shadowCameraTop * 2;
		def.shadowBias = this.shadowBias;
		def.color = this.color.getHexString();
		def.intensity = this.intensity;
		def.shadowMapWidth = Math.max(this.shadowMapWidth, this.shadowMapHeight);
		var myTemplate = this.getNearestTemplate();
		var targetTemplate = this.target.getNearestTemplate();
		if(myTemplate != targetTemplate || !this.target.parent || !this.target.name){
			this.target.updateMatrixWorld(true);
			var p = new THREE.Vector3();
			this.target.localToWorld(p);
			def.target = [p.x,p.y,p.z];
		} else {
			def.target = '#'+this.target.getReferenceName();
		}
	} else if(this instanceof THREE.SpotLight){
		def.asset = 'SpotLight';
		def.shadowBias = this.shadowBias;
		def.shadowMapWidth = Math.max(this.shadowMapWidth, this.shadowMapHeight);
		def.color = this.color.getHexString();
		def.intensity = this.intensity;
		def.distance = this.distance;
		def.exponent = this.exponent;
		def.angle = this.angle * radToDeg;
		// target is under the same parent/anchor
		var myTemplate = this.getNearestTemplate();
		var targetTemplate = this.target.getNearestTemplate();
		if(myTemplate != targetTemplate || !this.target.parent || !this.target.name){
			this.target.updateMatrixWorld(true);
			var p = new THREE.Vector3();
			this.target.localToWorld(p);
			def.target = [p.x,p.y,p.z];
		} else {
			def.target = '#'+this.target.getReferenceName();
		}
	} else if(this instanceof THREE.PointLight){
		def.asset = 'PointLight';
		def.color = this.color.getHexString();
		def.intensity = this.intensity;
		def.distance = this.distance;
	
	} else if(this instanceof THREE.HemisphereLight){
		def.asset = 'HemisphereLight';
		def.colors = [this.color.getHexString(), this.groundColor.getHexString()];
		def.intensity = this.intensity;
	
	} else if(this instanceof THREE.Mesh){
		def.asset = 'Geometry';
		if(this.geometry instanceof THREE.PlaneBufferGeometry){
			def.mesh = 'Plane';
		} // other types can be added later	
		
		def.tint = this.material.tint.getHexString();
		def.addColor = this.material.addColor.getHexString();
		if(this.material.alpha != 1.0) def.alpha = this.material.alpha;
		if(this.material.brightness != 0) def.brightness = this.material.brightness;
		if(this.material.stipple != 0) def.stipple = this.material.stipple;
		
	} else if(this.isContainer){
		def.asset = 'Object3D';
	
	} else if(this instanceof THREE.PointCloud || this.isPlaceholder){
		if(this.isPlaceholder){
			def.asset = this.def.asset;
			if(this.def.pointSize != undefined) def.pointSize = this.def.pointSize;
			if(this.def.alpha != undefined) def.alpha = this.def.alpha;
			if(this.def.cullBack != undefined) def.cullBack = this.def.cullBack;
			if(this.def.occlusion != undefined) def.occlusion = this.def.occlusion;
			if(this.def.tint != undefined) def.tint = this.def.tint;
			if(this.def.add != undefined) def.add = this.def.add;
			if(this.def.stipple != undefined) def.stipple = this.def.stipple;
			if(this.def.animSpeed != undefined) def.animSpeed = this.def.animSpeed;
			
			// process anchored children
			for(var i = 0; i < this.children.length; i++){
				// skip anchors
				var child = this.children[i];
				if(child.anchored) {
					var cdef = child.serialize(templates);
					cdef.anchor = child.anchored;
					if(child.isTemplate && templates) {
						//delete cdef.name;
						templates[child.name] = cdef;
						if(!def.containsTemplates){ def.containsTemplates = [ child.name ]; }
						else def.containsTemplates.push(child.name);
					} else {
						def.layers.push(cdef);
					}
				}
			}
		} else {
			def.asset = this.geometry.data.name;
			def.pointSize = this.pointSize;
			if(this.alpha != 1.0) def.alpha = this.alpha;
			if(!this.cullBack) def.cullBack = true;
			if(this.occlusion != 1.0) def.occlusion = this.occlusion;
			if(this.tint.getHex() != 0xffffff) def.tint = this.tint.getHexString();
			if(this.addColor.getHex() != 0) def.add = this.addColor.getHexString();
			if(this.stipple) def.stipple = this.stipple;
			if(this.animSpeed != 1.0) def.animSpeed = this.animSpeed;
			
			// add anchored children
			for(var aname in this.anchors){
				var anchor = this.anchors[aname];
				for(var i = 0; i < anchor.children.length; i++){
					var child = anchor.children[i];
					child.anchored = aname;
					var cdef = child.serialize(templates);
					cdef.anchor = aname;
					if(child.isTemplate && templates) {
						//delete cdef.name;
						templates[child.name] = cdef;
						if(!def.containsTemplates){ def.containsTemplates = [ child.name ]; }
						else def.containsTemplates.push(child.name);
					} else {
						def.layers.push(cdef);
					}				
				}
			}
		}
		if(this.def.animName != undefined) def.animName = this.def.animName;
		if(this.def.animOption != undefined) def.animOption = this.def.animOption;
		if(this.def.animFrame != undefined) def.animFrame = this.def.animFrame;
		
	} else {
		//console.log("Serializing an unknown type", this);
		def.asset = 'Object3D';
	}
	
	// process children
	for(var i = 0; i < this.children.length; i++){
		// skip anchors
		var child = this.children[i];
		if(child.isAnchor || (child.anchored && this.isAnchor)) continue;
		var cdef = child.serialize(templates);
		if(child.isTemplate && templates) {
			// delete cdef.name;
			templates[child.name] = cdef;
			if(!def.containsTemplates){ def.containsTemplates = [ child.name ]; }
			else def.containsTemplates.push(child.name);
		} else {
			def.layers.push(cdef);
		}
	}
	
	if(def.layers && !def.layers.length) delete def.layers;
	
	// update and return
	this.def = def;
	return def;
};

/* helper for parented lights fixes */

THREE.SpotLightHelper.prototype.update = function(){

	var vector = new THREE.Vector3();
	var vector2 = new THREE.Vector3();
	
	return function(){
		// update cone like before
		var coneLength = this.light.distance ? this.light.distance : 10000;
		var coneWidth = coneLength * Math.tan( this.light.angle );
	
		this.cone.scale.set( coneWidth, coneWidth, coneLength );
	
		vector.setFromMatrixPosition( this.light.matrixWorld );
		vector2.setFromMatrixPosition( this.light.target.matrixWorld );
	
		this.cone.lookAt( vector2.sub( vector ) );
	
		this.cone.material.color.copy( this.light.color ).multiplyScalar( this.light.intensity );
	
		// reset matrix - fixes spotlights under rotated parents
		if(this.matrix == this.light.matrixWorld){
			this.matrix = new THREE.Matrix4();
		}
		
		this.position.copy(vector);
		this.updateMatrix(true);
	}
}();

THREE.DirectionalLightHelper.prototype.update = function () {

	var v1 = new THREE.Vector3();
	var v2 = new THREE.Vector3();
	var v3 = new THREE.Vector3();

	return function () {

		v1.setFromMatrixPosition( this.light.matrixWorld );
		v2.setFromMatrixPosition( this.light.target.matrixWorld );
		v3.subVectors( v2, v1 );

		this.lightPlane.lookAt( v3 );
		this.lightPlane.material.color.copy( this.light.color ).multiplyScalar( this.light.intensity );

		this.targetLine.geometry.vertices[ 1 ].copy( v3 );
		this.targetLine.geometry.verticesNeedUpdate = true;
		this.targetLine.material.color.copy( this.lightPlane.material.color );

		// reset matrix - fixes spotlights under rotated parents
		if(this.matrix == this.light.matrixWorld){
			this.matrix = new THREE.Matrix4();
		}
		
		this.position.copy(v1);
		this.updateMatrix(true);

	};

}();


function fake0(v){ if(Math.abs(v) < 0.01) return 0; else return v; }
function not0(v){ if(Math.abs(v) < 0.01 || isNaN(v)) return 0.001; else return v; }
function notNaN(v){ if(isNaN(v)) return 0; else return v; }


/* called on document load */
function documentReady(){
	// init renderer
	if(!renderer.init()){
		var err = "Your browser doesn't support WebGL";
		alert(err);
		console.error(err);
		return;
	} else {
		console.log("WebGL initialized");
	}
	
	/* stop / resume render on window focus */
	$(window).focus(function(){ 
		renderer.pause(false);
	}).blur(function(){ 
		renderer.pause(true);
	});
	
	// init localstorage, then start
	localStorage_init(function(){
		editScene.init();
		renderer.setScene(editScene);
	});
}

/* global helper functions */
function localStorage_init(onReady) {
	if(chrome && chrome.storage){
		chrome.storage.local.get(null, function(obj){
			window.storageShadow = obj;
			onReady();
		});
	} else onReady();
}

function localStorage_setItem(key, val){
	if(chrome && chrome.storage){
		var kv = {};
		window.storageShadow[key] = kv[key] = val.toString();
		chrome.storage.local.set(kv);
	} else {
		localStorage.setItem(key, val);
	}
}

function localStorage_getItem(key){
	if(chrome && chrome.storage){
		return (window.storageShadow[key] !== undefined) ? window.storageShadow[key] : null;
	} else {
		return localStorage.getItem(key);
	}
	return null;
}

function localStorage_clear(){
	if(chrome && chrome.storage){
		chrome.storage.local.clear();
		window.storageShadow = {};
	} else {
		localStorage.clear();
	}
}

/* cookies */
function createCookie(name, value, days) {
    var expires;

    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toGMTString();
    } else {
        expires = "";
    }
    document.cookie = encodeURIComponent(name) + "=" + encodeURIComponent(value) + expires + "; path=/";
}

function readCookie(name) {
    var nameEQ = encodeURIComponent(name) + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return null;
}

function eraseCookie(name) {
    createCookie(name, "", -1);
}

/* deep clone */
_.deepClone = function(obj, depth) {
	if (typeof obj !== 'object') return obj;
	if (obj === null) return null;
	if (_.isString(obj)) return obj.splice();
	if (_.isDate(obj)) return new Date(obj.getTime());
	if (_.isFunction(obj.clone)) return obj.clone();
	var clone = _.isArray(obj) ? obj.slice() : _.extend({}, obj);
	// clone array's extended props
	if(_.isArray(obj)){
	  for(var p in obj){
		  if(obj.hasOwnProperty(p) && _.isUndefined(clone[p]) && isNaN(p)){
			  clone[p] = obj[p];
		  }
	  }
	}
	if (!_.isUndefined(depth) && (depth > 0)) {
	  for (var key in clone) {
	    clone[key] = _.deepClone(clone[key], depth-1);
	  }
	}
	return clone;
};

$(document).ready(documentReady);
