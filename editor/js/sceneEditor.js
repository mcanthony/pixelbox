/*
 LinePath


 NEXT	

 Filter textbox for Scene and Assets

 Grid for mouse and Shift + move?

 [Swap Asset / Instance]

 Curve objects - define nice camera and object paths


 LATER:

 for moveTool - convert chosen axis to object parent space (same as mouse move), so the move is in the same space as camera

 */

function EditSceneScene () {
	
	this.initUndo();
	
	this.shift = false;
	this.ctrl = false;
	this.alt = false;
	
	this.selectedObjects = [];
	
	this.mouseCoord = new THREE.Vector2();
	
	this.canvasInteractionsEnabled = true;
	this.disableCanvasInteractionsOnRelease = false;
	
	this.populateObjectCallback = this.populateObjectCallback.bind( this );
	
}

EditSceneScene.prototype = {
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Undo functions */
	
	resetAssets: function () {
		var children = this.scene.recursiveRemoveChildren( [ this.camera, this.axis, this.ambient, this.scene.fog ] );
		// clean up
		for ( var i = 0; i < children.length; i++ ) {
			var obj = children[ i ];
			if ( obj.dispose ) obj.dispose( true );
			else if ( obj.shadowMap ) obj.shadowMap.dispose();
		}
		for ( var a in assets.files ) {
			THREE.PixelBoxUtil.dispose( assets.files[ a ] );
		}
		// clear assets
		assets.clear();
		// clean up / dispose of assets cached in undo
		var checkArgs = function ( arg ) {
			if ( typeof(arg) != 'object' ) return;
			for ( var p in arg ) {
				var val = arg[ p ];
				if ( typeof(val) != 'object' ) continue;
				if ( val && val instanceof THREE.Object3D ) {
					if ( val.pixelBox ) val.dispose( true );
					checkArgs( p.children );
				} else if ( val && val.frameData && val.width ) {
					THREE.PixelBoxUtil.dispose( val );
				}
			}
		}
		// process undo and redo
		for ( var i = 0; i < this._undo.length; i++ ) {
			checkArgs( this._undo[ i ].undo );
			checkArgs( this._undo[ i ].redo );
		}
		for ( var i = 0; i < this._redo.length; i++ ) {
			checkArgs( this._redo[ i ].undo );
			checkArgs( this._redo[ i ].redo );
		}
	},
	
	/* undo queue */
	initUndo: function () {
		this._undoing = false;
		this._undo = [];
		this._redo = [];
		this.undoChanged();
	},
	
	/* joins last n undos into one action */
	joinUndoActions: function ( n ) {
		var newItem = [];
		for ( var i = this._undo.length - n; i < this._undo.length; i++ ) {
			if ( _.isArray( this._undo[ i ] ) ) {
				newItem = newItem.concat( this._undo[ i ] );
			} else {
				newItem.push( this._undo[ i ] );
			}
		}
		this._undo.splice( this._undo.length - n, n );
		this._undo.push( newItem );
	},
	
	/* if previous-1 undo action can be merged with last one, merge them */
	mergeUndo: function ( forceGlue ) {
		var undo1 = this._undo[ this._undo.length - 1 ];
		var undo2 = this._undo[ this._undo.length - 2 ];
		
		// combine into an array
		if ( forceGlue ) {
			if ( !_.isArray( undo2 ) ) {
				undo2 = [ undo2 ];
			}
			if ( _.isArray( undo1 ) ) undo2 = undo2.concat( undo1 );
			else undo2.push( undo1 );
			// save it
			this._undo[ this._undo.length - 2 ] = undo2;
			this._undo.pop();
			// merge as one item (for discardable multiple items of the same type)
		} else {
			if ( undo1.mergeable && undo2.mergeable && undo1.name == undo2.name ) {
				// compare operands
				if ( undo1.redo[ 1 ].length != undo2.redo[ 1 ].length ) return;
				for ( var i = 0; i < undo1.redo[ 1 ].length; i++ ) {
					if ( undo1.redo[ 1 ][ i ][ 0 ] != undo2.redo[ 1 ][ i ][ 0 ] ) {
						return;
					}
				}
				
				// merge to undo2 and remove undo1
				undo2.redo = undo1.redo;
				this._undo.pop();
			}
		}
	},
	
	undoChanged: function () {
		if ( this._undo.length > 1 ) this.mergeUndo();
		
		$( '#undo' ).button( {
			                     label: "Undo" + (this._undo.length ? (' (' + this._undo.length + ')') : ''),
			                     disabled: !this._undo.length
		                     } );
		$( '#redo' ).button( {
			                     label: "Redo" + (this._redo.length ? (' (' + this._redo.length + ')') : ''),
			                     disabled: !this._redo.length
		                     } );
		
		// update helpers
		if ( this.container ) {
			for ( var i = 0, l = this.scene.children.length; i < l; i++ ) {
				var obj = this.scene.children[ i ];
				if ( obj.isHelper ) {
					obj.update();
				}
			}
		}
	},
	
	/* add undo item: { undo:[function, args . . .], redo:[function, args . . .] } */
	addUndo: function ( item ) {
		if ( this.playing ) this.stop();
		
		if ( !this._undoing ) {
			this._undo.push( item );
			this._redo.length = 0;
			this.undoChanged();
			
			// limit undo buffer size
			if ( this._undo.length > 100 ) {
				this._undo.splice( 0, 1 );
			}
		}
	},
	performUndo: function () {
		if ( this._undo.length ) {
			var item = this._undo.pop();
			this._redo.push( item );
			this._undoing = true;
			var undoDesc = [];
			if ( item instanceof Array ) {
				for ( var i = item.length - 1; i >= 0; i-- ) {
					var uitem = item[ i ];
					if ( uitem.name ) undoDesc.push( uitem.name );//console.log('<< '+uitem.name);
					uitem.undo[ 0 ].apply( editScene, uitem.undo.slice( 1 ) );
				}
			} else {
				if ( item.name ) undoDesc.push( item.name );//console.log('<< '+item.name);
				item.undo[ 0 ].apply( editScene, item.undo.slice( 1 ) );
			}
			this._undoing = false;
			this.undoChanged();
			this.refreshProps();
			this.rebuildInstances();
			this.showMessage( 'Undo' +
			                  (undoDesc.length ? ('<div class="info">' + undoDesc.join( ', ' ) + '</div>') : '') );
		}
	},
	performRedo: function () {
		if ( this._redo.length ) {
			var item = this._redo.pop();
			this._undo.push( item );
			this._undoing = true;
			var undoDesc = [];
			if ( item instanceof Array ) {
				for ( var i = 0; i < item.length; i++ ) {
					var uitem = item[ i ];
					if ( uitem.name ) undoDesc.push( uitem.name ); //console.log('>> '+uitem.name);
					uitem.redo[ 0 ].apply( editScene, uitem.redo.slice( 1 ) );
				}
			} else {
				if ( item.name ) undoDesc.push( item.name ); //console.log('>> '+item.name);
				item.redo[ 0 ].apply( editScene, item.redo.slice( 1 ) );
			}
			this._undoing = false;
			this.undoChanged();
			this.refreshProps();
			this.rebuildInstances();
			this.showMessage( 'Redo' +
			                  (undoDesc.length ? ('<div class="info">' + undoDesc.join( ', ' ) + '</div>') : '') );
			
		}
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Mouse handling */
	
	mouseDown: function ( e ) {
		this.ctrl = e.ctrlKey;
		this.shift = e.shiftKey;
		this.alt = e.altKey;
		
		// ignore right button
		if ( e.button === 2 || !this.canvasInteractionsEnabled ) return;
		
		this.mouseDownTime = (new Date()).getTime();
		
		if ( this.insertingPoint ) {
			this.endInsertPoint( true );
			e.stopPropagation();
			e.preventDefault();
			e.stopImmediatePropagation();
			return;
		}
		
		this.lazyMouse = new THREE.Vector2( e.pageX, e.pageY );
		this.mouseMoved = false;
		this.isMouseDown = true;
		
		this.mouseDownOnObject = null;
		
		var label = $( e.target ).hasClass( 'object-label' ) ? e.target : null
		if ( (e.target.nodeName.toLowerCase() == 'canvas' || label) && e.button === 0 /*&& !this.shift*/ ) {
			
			this.isMouseDown = true;
			
			//document.body.focus();
			this.blur();
			
			if ( label && $( label ).hasClass( 'selected' ) ) {
				var uuid = label.id;
				this.mouseDownOnObject = editScene.container.getObjectByUUID( uuid );
			} else {
				var p = new THREE.Vector3( 2 * (e.clientX / window.innerWidth) - 1, 1 - 2 * ( e.clientY / window.innerHeight ), 0 );
				p.unproject( this.camera );
				this.raycaster.set( this.camera.position, p.sub( this.camera.position ).normalize() );
				var intersects = this.raycaster.intersectObject( this.container, true );
				if ( intersects.length ) {
					this.mouseDownOnObject = intersects[ 0 ].object;
				}
			}
		}
	},
	
	mouseUp: function ( e ) {
		if ( this.disableCanvasInteractionsOnRelease ) {
			this.disableCanvasInteractions();
			this.disableCanvasInteractionsOnRelease = false;
		}
		
		//var isLabel = $(e.target).hasClass('object-label');
		
		// hide opened menus
		$( '.submenu' ).hide();
		
		if ( !this.canvasInteractionsEnabled ) return;
		
		// show UI
		if ( window.editorHidden ) {
			window.editorHidden = false;
			$( '.editor.ui-widget-header' ).show();
		}
		
		// select object if mouse hasn't moved
		if ( this.transformingObjectsMode ) {
			this.finishTransformObjects( e );
		} else if ( this.marquee ) {
			this.finishMarquee( e );
		} else if ( !this.mouseMoved && e.target.nodeName == 'CANVAS' && e.button === 0 ) {
			// clicked on object
			if ( this.mouseDownOnObject ) {
				this.objectClicked( this.mouseDownOnObject, ((new Date()).getTime() - this.mouseDownTime > 500) );
				// clicked in empty space
			} else if ( this.objectPickMode ) {
				this.objectPickMode( null );
			} else if ( !(this.shift || this.ctrl || this.alt) ) {
				this.objectClicked( null );
			}
		}
		
		this.isMouseDown = false;
	},
	
	mouseMove: function ( e ) {
		if ( !this.canvasInteractionsEnabled ) return;
		
		this.mouseCoord.set( e.pageX, e.pageY );
		
		if ( this.insertingPoint ) {
			this.continueInsertPoint( e );
			return;
		}
		
		if ( this.lazyMouse ) {
			var lazyMouse = new THREE.Vector2( e.pageX, e.pageY );
			var dist = this.lazyMouse.distanceToSquared( lazyMouse );
			if ( dist > 2 ) {
				this.mouseMoved = true;
				this.lazyMouse = null;
			}
		}
		
		if ( this.isMouseDown && this.mouseMoved ) {
			if ( this.transformingObjectsMode ) {
				this.continueTransformObjects( e );
			} else if ( this.shift && !this.marquee ) {
				this.beginMarquee( e );
			} else if ( this.marquee ) {
				this.continueMarquee( e );
			} else if ( this.mouseDownOnObject && this.mouseDownOnObject.selected ) {
				this.beginTransformObjects( e );
			}
		}
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Marquee selection */
	
	beginMarquee: function ( e ) {
		if ( this.controls.busy() ) {
			this.controls.cancel();
			this.controls.rotateEnabled = this.controls.zoomEnabled = this.controls.panEnabled = false;
		}
		
		this.marquee = $( '<div id="marquee"/>' );
		$( document.body ).append( this.marquee );
		this.marqueeBox = { x: e.clientX, y: e.clientY, x1: e.clientX, y1: e.clientY };
		this.continueMarquee( e );
	},
	
	continueMarquee: function ( e ) {
		var mb = this.marqueeBox;
		mb.x1 = e.clientX;
		mb.y1 = e.clientY;
		
		this.marquee.offset( { left: Math.min( mb.x, mb.x1 ), top: Math.min( mb.y, mb.y1 ) } );
		this.marquee.css( { width: Math.abs( mb.x - mb.x1 ), height: Math.abs( mb.y - mb.y1 ) } );
	},
	
	finishMarquee: function ( e ) {
		this.controls.rotateEnabled = this.controls.zoomEnabled = this.controls.panEnabled = true;
		
		var mb = this.marqueeBox, temp;
		if ( mb.x1 < mb.x ) {
			temp = mb.x;
			mb.x = mb.x1;
			mb.x1 = temp;
		}
		if ( mb.y1 < mb.y ) {
			temp = mb.y;
			mb.y = mb.y1;
			mb.y1 = temp;
		}
		
		var ctrlWasDown = e.ctrlKey;
		var altWasDown = e.altKey;
		
		// construct a frustum from selected volume
		
		// points and rays
		var p0 = new THREE.Vector3( 2 * (mb.x / window.innerWidth) - 1, 1 - 2 * ( mb.y / window.innerHeight ), 0 );
		p0.unproject( this.camera );
		var d0 = p0.clone().sub( this.camera.position ).normalize();
		
		var p1 = new THREE.Vector3( 2 * (mb.x1 / window.innerWidth) - 1, 1 - 2 * ( mb.y / window.innerHeight ), 0 );
		p1.unproject( this.camera );
		var d1 = p1.clone().sub( this.camera.position ).normalize();
		
		var p2 = new THREE.Vector3( 2 * (mb.x1 / window.innerWidth) - 1, 1 - 2 * ( mb.y1 / window.innerHeight ), 0 );
		p2.unproject( this.camera );
		var d2 = p2.clone().sub( this.camera.position ).normalize();
		
		var p3 = new THREE.Vector3( 2 * (mb.x / window.innerWidth) - 1, 1 - 2 * ( mb.y1 / window.innerHeight ), 0 );
		p3.unproject( this.camera );
		var d3 = p3.clone().sub( this.camera.position ).normalize();
		
		// near plane
		var nearPlane = new THREE.Plane();
		var forward = this.camera.localToWorld( new THREE.Vector3( 0, 0, -this.camera.near ) );
		var normal = forward.clone().sub( this.camera.position ).normalize();
		nearPlane.setFromNormalAndCoplanarPoint( normal, forward );
		
		// far plane
		var farPlane = new THREE.Plane();
		forward = this.camera.localToWorld( new THREE.Vector3( 0, 0, -this.camera.far ) );
		normal = this.camera.position.clone().sub( forward ).normalize();
		farPlane.setFromNormalAndCoplanarPoint( normal, forward );
		
		// left
		var leftPlane = new THREE.Plane();
		var p = p0.clone().add( d0 );
		leftPlane.setFromCoplanarPoints( p, p0, p3 );
		
		// right
		var rightPlane = new THREE.Plane();
		p = p1.clone().add( d1 );
		rightPlane.setFromCoplanarPoints( p2, p1, p );
		
		// top
		var topPlane = new THREE.Plane();
		topPlane.setFromCoplanarPoints( p, p1, p0 );
		
		// bottom
		var bottomPlane = new THREE.Plane();
		p = p2.clone().add( d2 );
		bottomPlane.setFromCoplanarPoints( p3, p2, p );
		
		var frustum = new THREE.Frustum( nearPlane, farPlane, leftPlane, rightPlane, topPlane, bottomPlane );
		var transformedFrustum = new THREE.Frustum();
		
		this.container.updateMatrixWorld( true );
		
		this.container.traverseVisible( function ( obj ) {
			var found = null;
			if ( obj == editScene.container ) return;
			if ( obj instanceof THREE.PixelBox || obj instanceof THREE.Mesh ) {
				
				obj.geometry.boundingBox = null;
				obj.geometry.computeBoundingBox();
				
				// transform frustum into object space
				var inverseMatrix = new THREE.Matrix4();
				inverseMatrix.getInverse( obj.matrixWorld );
				
				transformedFrustum.copy( frustum );
				transformedFrustum.planes[ 0 ].applyMatrix4( inverseMatrix );
				transformedFrustum.planes[ 1 ].applyMatrix4( inverseMatrix );
				transformedFrustum.planes[ 2 ].applyMatrix4( inverseMatrix );
				transformedFrustum.planes[ 3 ].applyMatrix4( inverseMatrix );
				transformedFrustum.planes[ 4 ].applyMatrix4( inverseMatrix );
				transformedFrustum.planes[ 5 ].applyMatrix4( inverseMatrix );
				
				// test if object bounding box intersect this frustum
				if ( ctrlWasDown ) {
					if ( transformedFrustum.containsBox( obj.geometry.boundingBox ) ) {
						found = obj;
					}
				} else if ( transformedFrustum.intersectsBox( obj.geometry.boundingBox ) ) {
					found = obj;
				}
			} else {
				var wp = obj.parent.localToWorld( obj.position.clone() );
				// test if wp is in camera frustum
				if ( frustum.containsPoint( wp ) ) {
					found = obj;
				}
			}
			
			if ( found ) {
				var parentInstance = obj.parentInstance();
				if ( parentInstance ) editScene.selectObject( parentInstance, true );
				else if ( !obj.parent.selected || altWasDown ) editScene.selectObject( obj, !altWasDown );
			}
		} );
		
		
		this.marquee.remove();
		this.marquee = null;
	},
	
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Mouse transform */
	
	beginTransformObjects: function ( e ) {
		if ( this.controls.busy() ) {
			this.controls.cancel();
			this.controls.rotateEnabled = this.controls.zoomEnabled = this.controls.panEnabled = false;
		}
		
		this.transformingObjectsMode = this.alt ? 2 : (this.ctrl ? 3 : 1);
		
		var normalMatrix = new THREE.Matrix3().getNormalMatrix( this.camera.matrixWorld );
		var worldUp = this.worldUp = (new THREE.Vector3( 0, 1, 0 )).applyMatrix3( normalMatrix ).normalize();
		var worldRight = this.worldRight = (new THREE.Vector3( 1, 0, 0 )).applyMatrix3( normalMatrix ).normalize();
		var upright = this.getWorldAlignedUpRightVectors();
		var worldAlignedUp = this.worldAlignedUp = upright.up;
		var worldAlignedRight = this.worldAlignedRight = upright.right;
		
		this.transformMinDistance = 1000;
		
		// eliminate nesting and store original props
		this.transformingObjects = [];
		var temp = new THREE.Vector3();
		
		for ( var i = 0, l = this.selectedObjects.length; i < l; i++ ) {
			var obj = this.selectedObjects[ i ];
			if ( obj.isAnchor || obj.isDescendantOf( this.selectedObjects ) ) continue;
			
			if ( obj instanceof THREE.LinePathHandle && obj.isControlPoint && obj.parent.lockTangents ) {
				// skip, if both handles are selected
				if ( obj.parent.preHandle.selected && obj.parent.postHandle.selected ) continue;
				
				obj.origDistance = obj.position.length();
				
				// store other's info
				var other = (obj.parent.preHandle == obj) ? obj.parent.postHandle : obj.parent.preHandle;
				other.origPosition = other.position.clone();
				other.origDistance = other.position.length();
				other.origQuaternion = other.quaternion.clone();
				other.origRotation = other.rotation.clone();
				other.origScale = other.scale.clone();
			}
			
			obj.origPosition = obj.position.clone();
			obj.origQuaternion = obj.quaternion.clone();
			obj.origRotation = obj.rotation.clone();
			obj.origScale = obj.scale.clone();
			
			//
			var objParentWorldPos = new THREE.Vector3();
			objParentWorldPos.setFromMatrixPosition( obj.parent.matrixWorld );
			
			// store transform axis
			obj.transformUp = worldUp.clone();
			obj.transformRight = worldRight.clone();
			obj.transformAlignedUp = worldAlignedUp.clone();
			obj.transformAlignedRight = worldAlignedRight.clone();
			
			obj.transformUp.add( objParentWorldPos );
			obj.parent.worldToLocal( obj.transformUp );
			obj.transformRight.add( objParentWorldPos );
			obj.parent.worldToLocal( obj.transformRight );
			obj.transformAlignedUp.add( objParentWorldPos );
			obj.parent.worldToLocal( obj.transformAlignedUp );
			obj.transformAlignedRight.add( objParentWorldPos );
			obj.parent.worldToLocal( obj.transformAlignedRight );
			
			// get distance for transform speed multiplier
			temp.copy( obj.position );
			obj.parent.localToWorld( temp );
			this.transformMinDistance = Math.min( this.transformMinDistance, this.camera.position.distanceTo( temp ) );
			
			this.transformingObjects.push( obj );
		}
		
		if ( !this.transformingObjects.length ) {
			this.showMessage( "No transformable objects" );
			$( 'body' ).css( 'cursor', 'not-allowed' );
		} else {
			$( 'body' ).css( 'cursor', 'move' );
		}
		
		this.startTransformMousePos = new THREE.Vector2( e.pageX, e.pageY );
		
		window.editorHidden = true;
		$( '.editor.ui-widget-header' ).hide();
	},
	
	continueTransformObjects: function ( e ) {
		//this.transformingObjects
		var offset = this.mouseCoord.clone();
		offset.sub( this.startTransformMousePos );
		
		if ( this.transformingObjectsMode != 2 ) {
			offset.multiplyScalar( this.transformMinDistance * 0.001 );
		}
		
		var temp = new THREE.Vector3();
		
		if ( this.shift ) {
			if ( Math.abs( offset.x ) > Math.abs( offset.y ) ) offset.y = 0;
			else offset.x = 0;
		}
		
		var rq = new THREE.Quaternion();
		
		var containsCurvePoints = {};
		
		for ( var i = 0, l = this.transformingObjects.length; i < l; i++ ) {
			var obj = this.transformingObjects[ i ];
			// move
			if ( this.transformingObjectsMode == 1 ) {
				obj.position.copy( obj.origPosition );
				if ( this.shift ) {
					temp.copy( obj.transformAlignedRight ).multiplyScalar( offset.x );
					obj.position.add( temp );
					temp.copy( obj.transformAlignedUp ).multiplyScalar( -offset.y );
					obj.position.add( temp );
				} else {
					temp.copy( obj.transformRight ).multiplyScalar( offset.x );
					obj.position.add( temp );
					temp.copy( obj.transformUp ).multiplyScalar( -offset.y );
					obj.position.add( temp );
				}
				if ( obj instanceof THREE.LinePathHandle ) {
					containsCurvePoints[ obj.parent.uuid ] = obj.isControlPoint ? obj.parent.parent : obj.parent;
					// move opposite handle
					if ( obj.isControlPoint && obj.parent.lockTangents ) {
						var other = (obj.parent.preHandle == obj) ? obj.parent.postHandle : obj.parent.preHandle;
						var distanceRatio = fake0( obj.position.length() ) / obj.origDistance;
						other.position.copy( obj.position ).normalize().multiplyScalar( -other.origDistance * distanceRatio );
					}
				}
				// rotate
			} else if ( this.transformingObjectsMode == 2 ) {
				if ( obj instanceof THREE.LinePathHandle ) continue;
				obj.quaternion.copy( obj.origQuaternion );
				rq.setFromAxisAngle( this.shift ? obj.transformAlignedUp : obj.transformUp, offset.x * 0.01 );
				rq.multiply( obj.quaternion );
				obj.quaternion.copy( rq );
				rq.setFromAxisAngle( this.shift ? obj.transformAlignedRight : obj.transformRight, offset.y * 0.01 );
				rq.multiply( obj.quaternion );
				obj.quaternion.copy( rq );
				obj.updateMatrix();
				obj.rotation.setFromQuaternion( obj.quaternion );
				// scale
			} else {
				if ( obj instanceof THREE.LinePathHandle ) continue;
				var sc = (Math.abs( offset.x ) > Math.abs( offset.y ) ? offset.x : offset.y);
				obj.scale.copy( obj.origScale );
				obj.scale.x += sc;
				obj.scale.z += sc;
				obj.scale.y += sc;
			}
			if ( obj.helper ) {
				obj.updateMatrixWorld( true );
				obj.helper.update();
			}
		}
		
		for ( var pid in containsCurvePoints ) {
			containsCurvePoints[ pid ].update();
		}
	},
	
	finishTransformObjects: function ( e ) {
		this.controls.rotateEnabled = this.controls.zoomEnabled = this.controls.panEnabled = true;
		
		// apply transform
		var doArr = [];
		var undoArr = [];
		var undoAction = null;
		
		$( 'body' ).css( 'cursor', 'default' );
		
		// move
		if ( this.transformingObjectsMode == 1 ) {
			for ( var i = 0, l = this.transformingObjects.length; i < l; i++ ) {
				var obj = this.transformingObjects[ i ];
				if ( obj instanceof THREE.LinePathHandle && obj.isControlPoint && obj.parent.lockTangents ) {
					var other = (obj.parent.preHandle == obj) ? obj.parent.postHandle : obj.parent.preHandle;
					doArr.push( [ other, other.position.clone() ] );
					undoArr.push( [ other, other.origPosition.clone() ] );
				}
				doArr.push( [ obj, obj.position.clone() ] );
				undoArr.push( [ obj, obj.origPosition.clone() ] );
				this.touchTemplate( obj );
			}
			if ( doArr.length ) undoAction = {
				name: "moveTo",
				mergeable: true,
				redo: [ this.moveObjects, doArr ],
				undo: [ this.moveObjects, undoArr ]
			};
			// rotate
		} else if ( this.transformingObjectsMode == 2 ) {
			for ( var i = 0, l = this.transformingObjects.length; i < l; i++ ) {
				var obj = this.transformingObjects[ i ];
				doArr.push( [ obj, obj.rotation.clone() ] );
				undoArr.push( [ obj, obj.origRotation.clone() ] );
				this.touchTemplate( obj );
			}
			if ( doArr.length ) undoAction = {
				name: "rotateTo",
				mergeable: true,
				redo: [ this.rotateObjects, doArr ],
				undo: [ this.rotateObjects, undoArr ]
			};
			// scale
		} else {
			for ( var i = 0, l = this.transformingObjects.length; i < l; i++ ) {
				var obj = this.transformingObjects[ i ];
				doArr.push( [ obj, obj.scale.clone() ] );
				undoArr.push( [ obj, obj.origScale.clone() ] );
				this.touchTemplate( obj );
			}
			if ( doArr.length ) undoAction = {
				name: "scaleTo",
				mergeable: true,
				redo: [ this.scaleObjects, doArr ],
				undo: [ this.scaleObjects, undoArr ]
			};
		}
		
		if ( undoAction ) this.addUndo( undoAction );
		
		this.transformingObjects.length = 0;
		this.transformingObjectsMode = false;
		
		window.editorHidden = false;
		$( '.editor.ui-widget-header' ).show();
		
		this.refreshProps();
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Keyboard transform */
	
	/* move selection in camera-aligned coord sys (using keyboard arrow keys)*/
	moveTool: function ( dx, dy ) {
		// scale
		if ( this.alt && this.ctrl ) {
			var s = 0.1 * (dx ? dx : dy);
			this.scaleSelectionBy( new THREE.Vector3( s, s, s ) );
			// regular rotate
		} else if ( this.alt ) {
			var r = new THREE.Vector3();
			r.set( dy, dx, null );
			this.rotateSelectionBy( r );
			// alternate rotate
		} else if ( this.ctrl ) {
			var r = new THREE.Vector3();
			r.set( 0, dy, dx );
			this.rotateSelectionBy( r );
			// move
		} else {
			var upright = this.getWorldAlignedUpRightVectors();
			var xdir = upright.right, ydir = upright.up;
			xdir.multiplyScalar( dx );
			ydir.multiplyScalar( dy );
			var posInc = xdir.clone().add( ydir );
			
			this.moveSelectionBy( posInc );
		}
		this.refreshProps();
	},
	
	/* 	returns { up: v3, right: v3 }
	 used for arrow-key move and shift+mouse move */
	getWorldAlignedUpRightVectors: function () {
		// find which plane the camera is aligned with
		var camVector = new THREE.Vector3( 0, 0, -1 );
		var camUp = new THREE.Vector3( 0, 1, 0 );
		camVector.applyQuaternion( this.camera.quaternion );
		camUp.applyQuaternion( this.camera.quaternion );
		
		var planes = [
			new THREE.Vector3( 1, 0, 0 ),
			new THREE.Vector3( -1, 0, 0 ),
			new THREE.Vector3( 0, 1, 0 ),
			new THREE.Vector3( 0, -1, 0 ),
			new THREE.Vector3( 0, 0, 1 ),
			new THREE.Vector3( 0, 0, -1 ) ];
		
		var minDot = 1, minDotIndex = -1, dot;
		for ( var i = 0; i < 6; i++ ) {
			dot = camVector.dot( planes[ i ] );
			if ( dot < minDot ) {
				minDot = dot;
				minDotIndex = i;
			}
		}
		
		// additional dots for up/down positions
		var xdot = planes[ 0 ].dot( camUp );
		var zdot = planes[ 4 ].dot( camUp );
		
		var xdir = new THREE.Vector3(), ydir = new THREE.Vector3();
		switch ( minDotIndex ) {
			case 0:
				xdir.set( 0, 0, -1 );
				ydir.set( 0, 1, 0 );
				break;
			case 1:
				xdir.set( 0, 0, 1 );
				ydir.set( 0, 1, 0 );
				break;
			case 4:
				xdir.set( 1, 0, 0 );
				ydir.set( 0, 1, 0 );
				break;
			case 5:
				xdir.set( -1, 0, 0 );
				ydir.set( 0, 1, 0 );
				break;
			case 2:
				if ( Math.abs( zdot ) > Math.abs( xdot ) ) {
					if ( zdot < 0 ) {
						xdir.set( 1, 0, 0 );
						ydir.set( 0, 0, -1 );
					} else {
						xdir.set( -1, 0, 0 );
						ydir.set( 0, 0, 1 );
					}
				} else {
					if ( xdot < 0 ) {
						xdir.set( 0, 0, -1 );
						ydir.set( -1, 0, 0 );
					} else {
						xdir.set( 0, 0, 1 );
						ydir.set( 1, 0, 0 );
					}
				}
				break;
			case 3:
				if ( Math.abs( zdot ) > Math.abs( xdot ) ) {
					if ( zdot < 0 ) {
						xdir.set( -1, 0, 0 );
						ydir.set( 0, 0, -1 );
					} else {
						xdir.set( 1, 0, 0 );
						ydir.set( 0, 0, 1 );
					}
				} else {
					if ( xdot < 0 ) {
						xdir.set( 0, 0, 1 );
						ydir.set( -1, 0, 0 );
					} else {
						xdir.set( 0, 0, -1 );
						ydir.set( 1, 0, 0 );
					}
				}
				break;
		}
		return { up: ydir, right: xdir };
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Add, copy, paste, delete */
	
	objectAddedRecusive: function ( obj ) {
		if ( obj.helper && !obj.helper.parent ) {
			this.scene.add( obj.helper );
		}
		for ( var i = 0; i < obj.children.length; i++ ) {
			this.objectAddedRecusive( obj.children[ i ] );
		}
	},
	
	objectDeletedRecusive: function ( obj ) {
		if ( obj.htmlLabel ) {
			obj.htmlLabel.remove();
			delete obj.htmlLabel;
		}
		if ( obj.htmlRow ) {
			obj.htmlRow.remove();
			delete obj.htmlRow;
		}
		if ( obj.helper && obj.helper.parent ) {
			obj.helper.parent.remove( obj.helper );
		}
		if ( obj.shadowMap ) {
			// renderer.webgl.clearTarget(obj.shadowMap);
			obj.shadowMap.dispose();
			obj.shadowMap = null;
		}
		
		for ( var i = 0; i < obj.children.length; i++ ) {
			this.objectDeletedRecusive( obj.children[ i ] );
		}
	},
	
	deleteObjects: function ( objs ) {
		for ( var i = 0; i < objs.length; i++ ) {
			var obj = objs[ i ];
			this.touchTemplate( obj );
			if ( obj.selected ) this.selectObject( obj, false );
			this.objectDeletedRecusive( obj );
			if ( obj instanceof THREE.LinePathHandle ) {
				this.deletePoint( obj.parent, obj, obj.curveIndex );
			} else {
				obj.parent.remove( objs[ i ] );
			}
		}
		this.updateLights = true;
		this.refreshScene();
		this.refreshAssets();
		this.refreshProps();
	},
	
	addObjects: function ( objParArr ) {
		for ( var i = 0; i < objParArr.length; i++ ) {
			var obj = objParArr[ i ][ 0 ];
			var p = objParArr[ i ][ 1 ];
			if ( obj instanceof THREE.LinePathHandle ) {
				this.addPoint( p, obj, obj.curveIndex );
			} else {
				p.add( obj );
			}
			this.objectAddedRecusive( obj );
			this.touchTemplate( obj );
			if ( obj instanceof THREE.PixelBox && !(obj instanceof THREE.LinePathHandle) ) this.pixelboxApplyAnimationParams( obj );
		}
		this.updateTextLabels( this.container, 0 );
		this.refreshScene();
		this.refreshAssets();
		this.updateLights = true;
	},
	
	deleteSelection: function () {
		
		if ( this.objectPickMode ) {
			this.objectPickMode( null );
			return;
		}
		
		var doArr = [];
		var undoArr = [];
		var toDelete = this.selectedObjects.concat( [] );
		var templates = [];
		
		var doClearTargets = [];
		var undoClearTargets = [];
		var doClearProps = [];
		var undoClearProps = [];
		
		editScene.container.traverse( function ( obj ) {
			var objWillBeRemoved = (obj.selected || obj.isDescendantOf( toDelete ));
			// find templates that will be deleted
			if ( obj.isTemplate && objWillBeRemoved ) {
				templates.push( obj.name );
			}
			// remove references to deleted objects from targets
			if ( !objWillBeRemoved ) {
				// clear targets
				if ( obj instanceof THREE.DirectionalLight || obj instanceof THREE.SpotLight ) {
					if ( toDelete.indexOf( obj.target ) >= 0 ) {
						var newTarget = new THREE.Object3D();
						doClearTargets.push( [ obj, newTarget ] );
						undoClearTargets.push( [ obj, obj.target ] );
					}
				}
				// clear props
				if ( obj.props ) {
					for ( var i = 0; i < obj.props.length; i++ ) {
						var prop = obj.props[ i ];
						if ( prop.type == 'Object3D' && toDelete.indexOf( prop.value ) >= 0 ) {
							doClearProps.push( [ prop, null ] );
							undoClearProps.push( [ prop, prop.value ] );
						}
					}
				}
			}
		} );
		// add instances of these to the list
		editScene.container.traverse( function ( obj ) {
			if ( obj.isInstance && templates.indexOf( obj.def.template ) >= 0 ) toDelete.push( obj );
		} );
		
		for ( var i = 0; i < toDelete.length; i++ ) {
			var obj = toDelete[ i ];
			if ( obj.isAnchor ) continue;
			if ( obj instanceof THREE.LinePathHandle && (obj.isControlPoint || obj.parent.path.curves.length < 2) ) continue;
			undoArr.push( [ obj, obj.parent ] );
			doArr.push( obj );
		}
		
		if ( doArr.length ) {
			this.addUndo( { name: "delete", redo: [ this.deleteObjects, doArr ], undo: [ this.addObjects, undoArr ] } );
			this.deselectAll();
			this.deleteObjects( doArr );
			
			if ( doClearTargets.length ) {
				editScene.addUndo( {
					                   name: "clearTarget",
					                   undo: [ editScene.setObjectProperty, undoClearTargets, 'target' ],
					                   redo: [ editScene.setObjectProperty, doClearTargets, 'target' ]
				                   } );
				editScene.setObjectProperty( doClearTargets, 'target' );
				editScene.joinUndoActions( 2 );
			}
			
			if ( doClearProps.length ) {
				editScene.addUndo( {
					                   name: "propertyValue",
					                   redo: [ editScene.setPropertyProp, doClearProps, 'value' ],
					                   undo: [ editScene.setPropertyProp, undoClearProps, 'value' ]
				                   } );
				editScene.setPropertyProp( doClearProps, 'value' );
				editScene.joinUndoActions( 2 );
			}
			
		}
	},
	
	copySelection: function () {
		var toCopy = [];
		var copiedAssets = {};
		for ( var i = 0; i < this.selectedObjects.length; i++ ) {
			var obj = this.selectedObjects[ i ];
			if ( obj.isAnchor || obj instanceof THREE.LinePathHandle ) continue;
			toCopy.push( obj );
		}
		// check hierarchy
		for ( var i = toCopy.length - 1; i >= 0; i-- ) {
			var obj = toCopy[ i ];
			for ( var j = toCopy.length - 1; j >= 0; j-- ) {
				var obj2 = toCopy[ j ];
				if ( obj == obj2 ) continue;
				if ( obj2.isDescendantOf( obj ) ) {
					toCopy.splice( j, 1 );
					break;
				}
			}
		}
		if ( !toCopy.length ) return;
		// copy assets
		function addAssetsRecursive ( obj ) {
			if ( obj.pixelBox && !(obj instanceof THREE.LinePathHandle) ) {
				if ( !copiedAssets[ obj.asset.name ] ) {
					copiedAssets[ obj.asset.name ] = obj.asset.importedAsset;
				}
			}
			for ( var j = 0; j < obj.children.length; j++ ) {
				addAssetsRecursive( obj.children[ j ] );
			}
		}
		
		for ( var i = toCopy.length - 1; i >= 0; i-- ) {
			var obj = toCopy[ i ];
			addAssetsRecursive( obj );
			toCopy[ i ] = obj.serialize( null );
		}
		
		// copied
		this.sceneCopyItem = { objects: toCopy, assets: copiedAssets };
		
		// store
		localStorage_setItem( "sceneCopy", JSON.stringify( this.sceneCopyItem ) );
		//console.log(this.sceneCopyItem);
		
	},
	
	cutSelection: function () {
		this.copySelection();
		this.deleteSelection();
	},
	
	pasteSelection: function ( e ) {
		if ( this.objectPickMode ) { this.objectPickMode( null ); }
		
		var pasteTarget;
		if ( e.shiftKey || (e.target && e.target.id == 'edit-paste-into') ) pasteTarget = this.selectedObjects.length ? this.selectedObjects[ 0 ] : this.container;
		else pasteTarget = this.selectedObjects.length ? this.selectedObjects[ 0 ].parent : this.container;
		
		if ( pasteTarget instanceof THREE.LinePathHandle ) pasteTarget = pasteTarget.parent.parent;
		else if ( pasteTarget instanceof THREE.LinePath || pasteTarget.collisionShape || pasteTarget.constraint ) pasteTarget = pasteTarget.parent;
		
		this.deselectAll();
		
		if ( !this.sceneCopyItem ) return;
		
		// import assets
		var importedAssetsUndoItem = [];
		for ( var aname in this.sceneCopyItem.assets ) {
			var asset = this.sceneCopyItem.assets[ aname ];
			if ( !assets.files[ aname ] ) {
				asset = _deepClone( asset, 100 );
				importedAssetsUndoItem.push( {
					                             name: "addAsset", undo: [ editScene.deleteAsset, asset ],
					                             redo: [ editScene.importSceneAsset, asset ]
				                             } );
				editScene.importSceneAsset( asset );
			}
		}
		
		var addedObjects = this.populateObject( pasteTarget, this.sceneCopyItem.objects, {
			helpers: true,
			keepSceneCamera: true,
			noNameReferences: true,
			wrapTemplates: true,
			templates: this.doc.serializedTemplates,
			skipProps: true,
			noStaticGroups: true,
			initObject: this.populateObjectCallback
		} );
		this.updateLights = true;
		var doAdd = [];
		var undoAdd = [];
		for ( var i = 0; i < addedObjects.length; i++ ) {
			var obj = addedObjects[ i ];
			if ( obj instanceof THREE.Camera && obj.isDefault ) obj.isDefault = false;
			if ( obj.parent == pasteTarget ) { // top level obj
				doAdd.push( [ obj, pasteTarget ] );
				undoAdd.push( obj );
			}
		}
		
		this.linkObjects( addedObjects, pasteTarget, function ( obj, prop, val ){

			if ( !obj.props ) obj.props = [];
			var type = ( val instanceof THREE.Object3D ) ? 'Object3D' : 'JSON';

			if ( type == 'JSON' ) {

				if ( typeof ( val ) != 'string' ) {

					val = JSON.stringify( val );

				}

			}

			obj.props.push( {

				name: prop,
				type: type,
				value: val

			});

		} );
		
		if ( importedAssetsUndoItem.length ) {
			importedAssetsUndoItem.push( {
				                             name: "paste",
				                             redo: [ this.addObjects, doAdd ],
				                             undo: [ this.deleteObjects, undoAdd ]
			                             } );
			this.addUndo( importedAssetsUndoItem );
		} else {
			this.addUndo( { name: "paste", redo: [ this.addObjects, doAdd ], undo: [ this.deleteObjects, undoAdd ] } );
		}
		
		if ( this.validateAllObjectNames() ) {
			this.mergeUndo( true );
		}
		
		this.refreshScene();
		
		this.updateTextLabels( this.container, 0 );
		for ( var i = 0; i < addedObjects.length; i++ ) {
			var obj = addedObjects[ i ];
			if ( obj.parent == pasteTarget ) {
				this.selectObject( obj, true );
			}
		}
		this.selectionChanged();
		this.refreshAssets();
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Reparent */
	
	parentObjects: function ( objArr, shiftOpt ) {
		for ( var i = 0; i < objArr.length; i++ ) {
			var obj = objArr[ i ][ 0 ];
			var np = objArr[ i ][ 1 ];
			if ( shiftOpt ) {
				// convert transform to world
				obj.updateMatrixWorld( true );
				obj.matrix.copy( obj.matrixWorld );
				obj.matrix.decompose( obj.position, obj.quaternion, obj.scale );
				obj.rotation.setFromQuaternion( obj.quaternion );
				// parent to new parent
				np.updateMatrixWorld( true );
				var inv = new THREE.Matrix4();
				inv.getInverse( np.matrixWorld );
				inv.multiply( obj.matrix );
				obj.matrix.copy( inv );
				// refresh pos/rot/sc
				obj.matrix.decompose( obj.position, obj.quaternion, obj.scale );
				obj.rotation.setFromQuaternion( obj.quaternion );
			}
			np.add( obj );
			if ( obj instanceof THREE.PixelBox ) this.pixelboxApplyAnimationParams( obj );
			this.touchTemplate( obj );
		}
		this.refreshScene();
	},
	
	reparentDraggedRowsTo: function ( newParent ) {
		if ( !this.reparentObjects || !this.reparentObjects.length ) return; // already parented
		
		var doArr = [];
		var undoArr = [];
		var shiftOpt = editScene.shift;
		for ( var i = 0; i < this.reparentObjects.length; i++ ) {
			var obj = this.reparentObjects[ i ];
			undoArr.push( [ obj, obj.parent ] );
			doArr.push( [ obj, newParent ] );
		}
		this.addUndo( {
			              name: "reparent",
			              redo: [ this.parentObjects, doArr, shiftOpt ],
			              undo: [ this.parentObjects, undoArr, shiftOpt ]
		              } );
		this.parentObjects( doArr, shiftOpt );
		
		if ( this.validateAllObjectNames() ) {
			this.mergeUndo( true );
		}
		
		// prevent parenting to many objects		
		editScene.dragRowStopped();
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Container & display functions */
	
	/* called after new doc is created to recreate container with axis */
	createContainer: function () {
		// clear container
		if ( this.container ) {
			var children = this.scene.recursiveRemoveChildren( [ this.camera, this.axis, this.ambient, this.scene.fog ] );
		} else if ( !this.axis ) {
			var axis = this.axis = new THREE.AxisHelper( 10 );
			axis.raycast = function () { return; };// skip raycase
			this.scene.add( axis );
		}
		
		this.container = new THREE.Object3D();
		this.container.visibleRecursive = true;
		this.scene.add( this.container );
		
		// add placeholder shadow lights
		// couldn't get adding dynamic shadows after scene has been created any other way
		var maxShadows = 8;
		this.placeHolderLights = [];
		while ( maxShadows ) {
			var sun = new THREE.DirectionalLight( 0x0, 1 );
			sun.castShadow = true;
			sun.shadowMapWidth = sun.shadowMapHeight = 128;
			this.scene.add( sun );
			this.placeHolderLights.push( sun );
			maxShadows--;
		}
		
	},
	
	resetZoom: function () {
		this.camera.position.set( 512, 512, 512 );
		this.camera.lookAt( new THREE.Vector3( 0, 0, 0 ) );
		this.controls.focus( this.container, true );
		
		this.scene.updateMatrixWorld( true );
		for ( var i = 0; i < this.scene.children.length; i++ ) {
			var obj = this.scene.children[ i ];
			if ( obj.isHelper ) obj.update();
		}
	},
	
	/* updates text labels on all elements in container, recursive */
	updateTextLabels: function ( cont, depth ) {
		if ( !cont || !this.labelsVisible || cont.omit || cont.isInstance ) return;
		var p = new THREE.Vector3();
		var windowInnerWidth = window.innerWidth;
		var windowInnerHeight = window.innerHeight;
		for ( var i = 0; i < cont.children.length; i++ ) {
			var obj = cont.children[ i ];
			if ( obj.isHelper ) {
				if ( obj[ 'update' ] ) obj.update();
				continue;
			}
			if ( !obj.htmlLabel ) {
				obj.htmlLabel = $( '<label id="' + obj.uuid + '" class="object-label" style="color:' + this.automaticColorForIndex( obj.id, 1, false ) + '"/>' ).text( obj.name );
				var type = obj.pixelBox ? 'PixelBox' : (obj.isAnchor ? 'Anchor' : (obj.def ? obj.def.asset : null));
				if ( type ) obj.htmlLabel.addClass( type );
				if ( obj.isTemplate ) obj.htmlLabel.addClass( 'template' );
				if ( !obj.visible ) obj.htmlLabel.css( { visibility: 'hidden' } );
				obj.htmlLabel.click( this.objectLabelClicked );
				$( document.body ).append( obj.htmlLabel );
			}
			var vis = true;
			if ( this.labelsVisible == 1 ) {
				vis = obj.selected;
			}
			obj.htmlLabel.css( { display: vis ? 'block' : 'none' } );
			if ( vis ) {
				p.set( 0, 0, 0 );
				obj.localToWorld( p );
				p.project( this.camera );
				var offs = depth * (obj.isAnchor ? -5 : 8);
				var lw, lh;
				if ( obj.htmlLabel.labelWidth ) {
					lw = obj.htmlLabel.labelWidth;
					lh = obj.htmlLabel.labelHeight;
				} else {
					obj.htmlLabel.labelWidth = lw = obj.htmlLabel.width();
					obj.htmlLabel.labelHeight = lh = obj.htmlLabel.height();
				}
				var x = Math.max( 0, Math.min( windowInnerWidth - lw - 20,
				                               Math.floor( windowInnerWidth * 0.5 * p.x + windowInnerWidth * 0.5 - lw * 0.5 ) ) );
				var y = Math.max( 0, Math.min( windowInnerHeight - lh - 10,
				                               Math.floor( windowInnerHeight * 0.5 - windowInnerHeight * 0.5 * p.y - lh * 0.5 ) + offs ) );
				if ( p.z < 0 || p.z > 1.0 ) {
					y = 0;
				}
				if ( obj.htmlLabel.labelX != x || obj.htmlLabel.labelY != y ) {
					obj.htmlLabel.offset( { top: (obj.htmlLabel.labelY = y), left: (obj.htmlLabel.labelX = x) } );
					obj.htmlLabel.css( { zIndex: parseInt( 1 + (1 - p.z) * 10000 ) } );
				}
			}
			this.updateTextLabels( obj, depth + 1 );
		}
	},
	
	setLabelsVisible: function ( mode ) {
		this.labelsVisible = mode;
		if ( mode == 0 ) {
			$( '.object-label' ).css( { display: 'none' } );
		}
		this.updateTextLabels( this.container, 0 );
	},
	
	labelsVisibleChanged: function ( e ) {
		var val = (e.target.value == 'all' ? 2 : (e.target.value == 'selected' ? 1 : 0));
		localStorage_setItem( 'labelsVisible', val );
		editScene.setLabelsVisible( val );
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Util */
	
	/* used during loading */
	populateObject: THREE.PixelBoxScene.prototype.populateObject,
	
	makeGeometryObject: THREE.PixelBoxScene.prototype.makeGeometryObject,
	
	initObjectPhysics: THREE.PixelBoxScene.prototype.initObjectPhysics,
	
	linkObjects: THREE.PixelBoxScene.prototype.linkObjects,
	
	upcycle: function () { return null; },
	
	hashStringToInt: function ( s ) {
		return s.split( "" ).reduce( function ( a, b ) {
			a = ((a << 5) - a) + b.charCodeAt( 0 );
			return a & a
		}, 0 );
	},
	
	automaticColorForIndex: function ( id, alpha, returnColorObject ) {
		var i = (typeof(id) == 'string' ? this.hashStringToInt( id ) : id);
		
		var hue = ((i + (i % 2 ? 5 : 1)) % 10) * 0.1;
		var sat = 0.9 - 0.6 * (Math.floor( i * 0.1 ) % 5) / 5;
		var color = new THREE.Color();
		color.setHSL( hue, sat, 0.6 );
		
		if ( returnColorObject ) return color;
		
		return 'rgba(' + Math.floor( color.r * 255.0 ) + ',' + Math.floor( color.g * 255.0 ) + ',' + Math.floor( color.b * 255.0 ) + ',' + alpha + ')';
	},
	
	download: function ( filename, contents ) {
		if ( typeof(contents) == 'object' && !contents.src ) contents = JSON.stringify( contents );
		if ( window[ 'chrome' ] && chrome.storage ) {
			chrome.fileSystem.chooseEntry( {
				                               type: 'saveFile',
				                               suggestedName: filename
			                               }, function ( writableFileEntry ) {
				writableFileEntry.createWriter( function ( writer ) {
					writer.onwriteend = function ( e ) {
						this.onwriteend = null;
						this.truncate( this.position );
						console.log( 'write complete' );
					};
					if ( contents.src ){

						writer.write( dataURItoBlob( contents.src ) );

					} else {

						writer.write( new Blob( [ [ contents ] ], { type: 'application/json' } ) );

					}

				} );
			} );
		} else {
			// bounce the file off of server
			var form = $( '<form action="downloadFile.php" method="post" target="_blank"><input type="hidden" name="filename"/><input type="hidden" name="data"/><input type="hidden" name="type"/></div>' );
			if ( contents.src ) {
				$( 'input[name=type]', form ).val( 'image/' + contents.ext );
				contents = contents.src.substr( contents.src.indexOf( 'base64,' ) + 7 );
			}
			$( 'input[name=filename]', form ).val( filename );
			$( 'input[name=data]', form ).val( contents );
			form[ 0 ].submit();
		}
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Document functions */
	
	/* clear localStore */
	resetLocalStorage: function () {
		$( '<div id="editor-reset" class="editor">\
		<div class="center">This will reset the editor\'s stored preferences and stored "Hold" object.</div>\
		</div>' ).dialog( {
			                             resizable: false,
			                             width: 400,
			                             height: 220,
			                             modal: true,
			                             dialogClass: 'no-close',
			                             title: "Reset LocalStorage?",
			                             buttons: {
				                             "Cancel": function () {
					                             $( this ).dialog( "close" );
				                             },
				                             "Reset": function () {
					                             localStorage_clear();
					                             $( this ).dialog( "close" );
					                             if ( window[ 'chrome' ] && chrome.storage ) {
						                             chrome.runtime.reload();
					                             } else {
						                             window.location.reload();
					                             }
				                             }
			                             },
			                             close: function () {
				                             $( this ).remove();
				                             editScene.enableCanvasInteractions( true );
			                             }
		                             } );
		editScene.disableCanvasInteractions( true );
	},
	
	/* store localStore */
	holdDoc: function () {
		function doHold () {
			var data = editScene.exportScene( true, false );
			localStorage_setItem( 'holdScene', data );
			
			console.log( JSON.parse( data ) );
		}
		
		if ( localStorage_getItem( 'holdScene' ) ) {
			$( '<div id="editor-hold" class="editor">\
			<div class="center">This will replace current "Hold" scene.</div>\
			<span class="info">Hold scene is auto-loaded on editor start.</span>\
			</div>' ).dialog( {
				                                 resizable: false,
				                                 width: 400,
				                                 height: 220,
				                                 modal: true,
				                                 dialogClass: 'no-close',
				                                 title: "Replace Hold?",
				                                 buttons: {
					                                 "Replace": function () {
						                                 doHold();
						                                 $( this ).dialog( "close" );
					                                 },
					                                 "Cancel": function () {
						                                 $( this ).dialog( "close" );
					                                 }
				                                 },
				                                 close: function () {
					                                 $( this ).remove();
					                                 editScene.enableCanvasInteractions( true );
				                                 }
			                                 } );
			editScene.disableCanvasInteractions( true );
		} else doHold();
	},
	
	/* restore */
	fetchDoc: function () {
		var data = localStorage_getItem( 'holdScene' );
		if ( !data ) return;
		
		$( '<div id="editor-reset" class="editor">\
		<div class="center">Ths will replace current scene with the one stored in "Hold".</div>\
		</div>' ).dialog( {
			                             resizable: false,
			                             width: 400,
			                             height: 220,
			                             modal: true,
			                             dialogClass: 'no-close',
			                             title: "Restore from Hold?",
			                             buttons: {
				                             "Cancel": function () {
					                             $( this ).dialog( "close" );
				                             },
				                             "Restore": function () {
					                             editScene.resetAssets();
					                             editScene.newDocFromData( JSON.parse( data ) );
					                             $( this ).dialog( "close" );
				                             }
			                             },
			                             close: function () {
				                             $( this ).remove();
				                             editScene.enableCanvasInteractions( true );
			                             }
		                             } );
		editScene.disableCanvasInteractions( true );
	},
	
	/* export doc */
	saveDoc: function () {
		function refresh () {
			var single = $( '#editor-save #export-single' )[ 0 ].checked;
			var compress = $( '#editor-save #export-smaller' )[ 0 ].checked;
			$( '#drop-files' ).empty();
			
			var file = $( '<span class="file scene handcursor"/>' ).text( editScene.doc.name + '.scene' );
			file.click( function ( e ) {
				if ( e.shiftKey ) console.log( editScene.exportScene( true, false ) );
				else editScene.download( editScene.doc.name + '.scene', editScene.exportScene( single, compress ) );
			} );
			$( '#drop-files' ).append( file );
			
			if ( !single ) {
				for ( var assetName in assets.files ) {
					var asset = assets.files[ assetName ];
					var assetFileName = assetName + '.';
					if( asset.frameData ) assetFileName += 'b64';
					else if( asset.image ) assetFileName = assetName;//+= asset.ext;
					else if( asset.xml ) assetFileName += 'xml';
					else if( asset.plist ) assetFileName += 'plist';
					else assetFileName += 'json';
					file = $( '<span class="file handcursor"/>' ).text( assetFileName );
					file.click( (function ( assetFileName, asset, compress ) {
						return function () {
							editScene.download( assetFileName, editScene.exportAsset( asset, !compress, compress, true ) );
						};
					})( assetFileName, asset, compress ) );
					$( '#drop-files' ).append( file );
				}
			}
		}
		
		var dlg = $( '<div id="editor-save" class="editor">\
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
		</div>' );
		
		var opt = localStorage_getItem( 'export-compress' );
		$( '#export-' + (opt === 'true' ? 'smaller' : 'faster'), dlg )[ 0 ].checked = true;
		opt = localStorage_getItem( 'export-single' );
		$( '#export-' + (opt === 'false' ? 'multiple' : 'single'), dlg )[ 0 ].checked = true;
		$( '#export-faster,#export-smaller', dlg ).change( function ( e ) {
			localStorage_setItem( 'export-compress', $( this ).val().toString() );
			refresh();
		} );
		$( '#export-single,#export-multiple', dlg ).change( function ( e ) {
			localStorage_setItem( 'export-single', $( this ).val().toString() );
			refresh();
		} );
		
		editScene.disableCanvasInteractions( true );
		
		dlg.dialog( {
			            resizable: false,
			            width: 550,
			            height: 400,
			            modal: true,
			            dialogClass: 'no-close',
			            title: "Export",
			            buttons: { OK: function () { $( this ).dialog( "close" ); } },
			            open: refresh,
			            close: function () {
				            $( this ).remove();
				            editScene.enableCanvasInteractions( true );
			            }
		            } );
		
	},
	
	/* export doc */
	loadDoc: function () {
		$( '.ui-dialog .editor' ).dialog( "close" );
		
		$( '<div id="editor-load" class="editor">\
		<span class="info">Drag &amp; drop files below.</span>\
		<span class="info">Accepting .scene file to load scene, .b64 files to load or replace PixelBox assets, .png and .jpg as textures, .json and .plist and .xml as data objects.</span>\
		<span class="info">This operation is not undo-able.</span>\
		<div id="drop-files"/>\
		</div>' ).dialog( {
			                             resizable: false,
			                             width: 400,
			                             height: 400,
			                             modal: true,
			                             dialogClass: 'no-close',
			                             title: "Import",
			                             buttons: {
				                             "Import": function () {
					
					                             // unload assets first if loading a scene
					                             for ( var i in editScene.toImport ) {
						                             if ( editScene.toImport[ i ].name.indexOf( '.scene' ) > 0 ) {
							                             //editScene.newDoc(true, false);
							                             //assets.unload();
							                             editScene.resetAssets();
							                             break;
						                             }
					                             }
					
					                             var reader = new FileReader();
					                             var fileExt = editScene.toImport[ 0 ].name.substr( editScene.toImport[ 0 ].name.lastIndexOf( '.' ) + 1 ).toLowerCase();
					                             var isImage = [ "jpg", "jpeg", "png" ].indexOf( fileExt ) >= 0;
					                             reader.onload = isImage ? editScene.imageImported : editScene.fileImported;
					                             if ( isImage ) reader.readAsDataURL( editScene.toImport[ 0 ] );
					                             else reader.readAsText( editScene.toImport[ 0 ] );
					
					                             $( this ).dialog( "close" );
				                             },
				                             "Cancel": function () {
					                             $( this ).dialog( "close" );
				                             }
			                             },
			                             close: function () {
				                             $( this ).remove();
				                             editScene.enableCanvasInteractions( true );
			                             }
		                             } );
		
		editScene.disableCanvasInteractions( true );
	},
	
	/* new document */
	newDoc: function ( e ) {
		if ( e === true ) {
			this.doc = {
				name: "newScene",
				clearColor: new THREE.Color( 0x333333 ),
				ambient: new THREE.Color( 0 ),
				fogColor: new THREE.Color( 0 ),
				fogNear: 1000,
				fogFar: 10000,
				templates: {}
			};
			this.clearColor = this.doc.clearColor.getHex();
			this.deselectAll();
			$( '.object-label' ).remove();
			this.createContainer();
			this.newDocFromData( _deepClone( this.defaultSceneDef, 100 ) );
			this.refreshAssets();
			this.refreshProps();
			this.refreshScene();
		} else {
			if ( !$( '#new-doc' ).length ) {
				$( 'body' ).append( '<div id="new-doc" class="center no-close">\
				Create new scene?\
				</div>' );
				$( '#new-width,#new-height,#new-depth' ).spinner( { min: 4, max: 256, step: 4 } );
			}
			editScene.disableCanvasInteractions( true );
			$( '#new-doc' ).dialog( {
				                        resizable: false,
				                        width: 250,
				                        height: 260,
				                        modal: true,
				                        dialogClass: 'no-close',
				                        title: "Create New",
				                        buttons: {
					                        "Create": function () {
						                        editScene.resetAssets();
						                        editScene.newDoc( true );
						                        $( this ).dialog( "close" );
					                        },
					                        Cancel: function () {
						                        $( this ).dialog( "close" );
					                        }
				                        },
				                        close: function () {
					                        editScene.enableCanvasInteractions( true );
					                        $( this ).remove();
				                        }
			                        } );
		}
	},
	
	/* imports frames from JSON'ed object */
	newDocFromData: function ( dataObject ) {
		
		this.deselectAll();
		$( '.object-label' ).remove();
		this.createContainer();
		
		this.doc = dataObject;
		
		// update props
		this.doc.clearColor = new THREE.Color( this.doc.clearColor ? parseInt( this.doc.clearColor, 16 ) : 0 );
		this.doc.ambient = new THREE.Color( this.doc.ambient ? parseInt( this.doc.ambient, 16 ) : 0 );
		this.doc.fogColor = new THREE.Color( this.doc.fogColor ? parseInt( this.doc.fogColor, 16 ) : 0 );
		this.clearColor = this.doc.clearColor.getHex();
		this.ambient.color.copy( this.doc.ambient );
		this.scene.fog.color.copy( this.doc.fogColor );
		this.scene.fog.near = this.doc.fogNear;
		this.scene.fog.far = this.doc.fogFar;
		this.doc.gravity = this.doc.gravity ? (new THREE.Vector3()).fromArray( this.doc.gravity ) : new THREE.Vector3();
		
		// add assets to cache if needed
		for ( var i in dataObject.assets ) {
			var asset = dataObject.assets[ i ];
			// compressed asset
			if ( typeof(asset) == 'string' ) {
				var json = LZString.decompressFromBase64( asset );
				if ( !json ) {
					console.error( "Failed to LZString decompressFromBase64: ", asset );
					continue;
				}
				try {
					asset = JSON.parse( json );
				} catch ( e ) {
					console.error( "Failed to parse JSON ", e, json );
				}
			}
			// add asset to cache if needed
			if ( !assets.get( asset.name ) ) {

				asset.importedAsset = _deepClone( asset, 100 );

				// asset is image
				if ( asset.src ) {

					asset.importedAsset = _deepClone( asset, 100 );

					asset.image = new Image();
					asset.image.src = asset.src;
					delete asset.src;

					assets.add( asset.name, asset );
					continue;

				} else if ( asset.xml ) {

					asset.importedAsset = _deepClone( asset, 100 );
					asset.xml = THREE.PixelBoxUtil.parseXml( asset.xml );

				// plist
				} else if ( asset.plist ) {

					asset.importedAsset = _deepClone( asset, 100 );
					asset.plist = THREE.PixelBoxUtil.parsePlist( asset.plist );

				// asset is PixelBox
				} else if ( asset.frames ) {
					if ( THREE.PixelBoxUtil.processPixelBoxFrames( asset ) ) assets.add( asset.name, asset );
					else console.log( "Failed to load ", asset );
					continue;
				}

				// store
				if ( asset.name ) {
					assets.add( asset.name, asset );
					continue;
				}

				console.log( "Unknown asset type:", asset );

			}
		}
		
		// populate
		var opts = {
			helpers: true,
			keepSceneCamera: true,
			noNameReferences: true,
			wrapTemplates: true,
			templates: dataObject.templates,
			skipProps: true,
			noStaticGroups: true,
			initObject: this.populateObjectCallback
		};
		var addedObjects = this.populateObject( this.container, dataObject.layers ? dataObject.layers : [], opts );
		
		// add templates
		if ( dataObject.containsTemplates ) {
			for ( var ti = 0; ti < dataObject.containsTemplates.length; ti++ ) {
				var td = dataObject.templates[ dataObject.containsTemplates[ ti ] ];
				if ( td ) {
					var addedTemplates = this.populateObject( this.container, [ td ], opts );
					this.linkObjects( addedTemplates, addedTemplates[ 0 ], true );
					addedObjects = addedObjects.concat( addedTemplates );
				}
			}
		}
		
		// link
		this.linkObjects( addedObjects, this.container, true );
		
		function dereferenceObject ( nameFragments, currentLevel ) {
			// start
			if ( typeof(nameFragments) == 'string' ) {
				nameFragments = nameFragments.split( '.' );
				if ( !nameFragments.length ) return top;
				return dereferenceObject( nameFragments, currentLevel );
				
				// descend
			} else if ( nameFragments.length ) {
				var first = nameFragments[ 0 ];
				nameFragments.splice( 0, 1 );
				var obj = null;
				if ( first.substr( 0, 1 ) == '$' ) {
					if ( currentLevel.anchors )
						obj = currentLevel.anchors[ first.substr( 1 ) ];
					else
						first = first.substr( 1 );
				}
				if ( !obj ) {
					for ( var ci = 0, cl = currentLevel.children.length; ci < cl; ci++ ) {
						if ( currentLevel.children[ ci ].name == first ) {
							obj = currentLevel.children[ ci ];
							break;
						}
					}
				}
				if ( !obj ) return null;
				if ( nameFragments.length ) return dereferenceObject( nameFragments, obj );
				return obj;
			}
			
			return null;
		}
		
		// create props objects
		for ( var i = 0; i < addedObjects.length; i++ ) {
			var obj = addedObjects[ i ];
			if ( obj.def.props ) {
				obj.props = [];
				for ( var propName in obj.def.props ) {
					var val = obj.def.props[ propName ];
					var prop = { name: propName };
					if ( val === null || (typeof(val) == 'string' && val.substr( 0, 1 ) == '#') ) {
						prop.type = "Object3D";
						var nearestTemplate = obj.nearestTemplate();
						prop.value = dereferenceObject( val.substr( 1 ), nearestTemplate ? nearestTemplate : this.container );
						if ( !prop.value ) {
							prop.type = "JSON";
							prop.value = val;
						}
					} else {
						prop.type = "JSON";
						if ( typeof(val) == 'object' ) {
							try {
								prop.value = JSON.stringify( val );
							} catch ( e ) {
								prop.value = val.toString();
							}
						} else {
							prop.value = val.toString();
						}
					}
					obj.props.push( prop );
				}
			}
		}
		
		this.updateLights = true;
		
		// clear undo queue
		this.initUndo();
		this.resetZoom();
		
		// refresh
		this.refreshTemplates();
		this.refreshScene();
		this.refreshAssets();
		this.refreshProps();
		
		// start collapsed
		var rows = $( '#scene div.row:has(div.row)' );
		rows.addClass( 'collapsed' ).find( 'a.toggle:first' ).text( '+' );
		
		this.showMessage( this.doc.name + ' loaded' );
		
		this.setLabelsVisible( this.labelsVisible );
	},
	
	createDataObject: function ( options ) {
		var obj = {
			name: (options[ 'name' ] ? options[ 'name' ] : null),
			assets: (options[ 'assets' ] ? options[ 'assets' ] : {})
		};
		
		return obj;
	},
	
	onDragFilesOver: function ( e ) {
		e.preventDefault();
		e.stopPropagation();
		if ( e.type == 'dragover' && !$( '#editor-load' ).length ) {
			editScene.toImport = [];
			editScene.loadDoc();
		}
	},
	
	onDropFiles: function ( e ) {
		e.preventDefault();
		e.stopPropagation();
		document.body.focus();
		var evt = e.originalEvent;
		var dt = evt.dataTransfer;
		if ( dt ) {
			var added = $( '#drop-files span.file' );
			for ( var i = 0; i < dt.files.length; i++ ) {
				var nfd = dt.files[ i ];
				var ext = nfd.name.substr( nfd.name.lastIndexOf( '.' ) + 1 );
				if ( !nfd.size || (ext != 'b64' && ext != 'scene' && ext != 'jpg' && ext != 'jpeg' && ext != 'png' && ext != 'json' && ext != 'xml' && ext != 'plist' ) ) continue;
				
				// skip if already there
				var skip = false;
				for ( var f = 0; f < added.length; f++ ) {
					var fd = $( added[ f ] ).data();
					if ( fd && fd.name == nfd.name ) {
						skip = true;
						break;
					}
				}
				if ( skip ) continue;
				// add
				var ax = $( '<a>[X]</a>&nbsp;' ).click( function () {
					var name = $( this ).parent().data().name;
					$( this ).parent().remove();
					for ( var i = 0; i < editScene.toImport.length; i++ ) {
						if ( editScene.toImport[ i ].name == name ) {
							editScene.toImport.splice( i, 1 );
							return;
						}
					}
				} );
				var span = $( '<span class="file"></span>' ).addClass( ext ).text( nfd.name ).data( nfd ).prepend( ax );
				added.push( span[ 0 ] );
				// scene imported last
				if ( ext == 'scene' ) { // first
					editScene.toImport.push( nfd );
					// assets first
				} else {
					editScene.toImport.splice( 0, 0, nfd );
				}
				$( '#drop-files' ).append( span );
			}
			//console.log(dt);
		}
	},
	
	/* called for each dragged in imported file */
	fileImported: function ( e ) {
		var data = e.target.result;

		var fileName = editScene.toImport.splice( 0, 1 )[ 0 ].name;
		
		// parse
		if ( data.length ) {
			
			var err = null;
			var firstChar = data.substr( 0, 1 );
			if ( firstChar != '{' && firstChar != '<') {
				try {
					data = LZString.decompressFromBase64( data );
					if ( !data ) throw 1;
				} catch ( e ) {
					err = "Unable to LZString decompress string (File size: " + e.loaded + ")";
				}
			}

			// type of file
			firstChar = data.substr( 0, 1 );
			var ext = fileName.substr( fileName.lastIndexOf( '.' ) + 1 ).toLowerCase();

			// json
			if ( firstChar == '{' ) {
				try {
					data = JSON.parse( data );
					if ( data ) err = null;
				} catch ( e ) {
					err = "Unable to parse JSON (File size: " + e.loaded + ")";
					console.error( e );
				}
			}

			if ( err ) {
				alert( err );
			} else {

				if ( ext == 'plist' ) {

					data = {
						name: fileName, //.substr( 0, fileName.lastIndexOf( '.' ) ),
						plist: data
					};

				} else if ( ext == 'xml' ) {

					data = {
						name: fileName, //.substr( 0, fileName.lastIndexOf( '.' ) ),
						xml: data
					};

				} else if ( ext == 'json' ) {//&& !data.name

					data.name = fileName; //fileName.substr( 0, fileName.lastIndexOf( '.' ) );

				}

				// scene
				if ( ext == 'scene' ) {

					editScene.newDocFromData( data );

				// asset
				} else {

					editScene.importSceneAsset( data );

				}
			}
		}
		
		// next
		if ( editScene.toImport.length ) {
			var reader = new FileReader();
			var fileExt = editScene.toImport[ 0 ].name.substr( editScene.toImport[ 0 ].name.lastIndexOf( '.' ) + 1 ).toLowerCase();
			var isImage = [ "jpg", "jpeg", "png" ].indexOf( fileExt ) >= 0;
			reader.onload = isImage ? editScene.imageImported : editScene.fileImported;
			if ( isImage ) reader.readAsDataURL( editScene.toImport[ 0 ] );
			else reader.readAsText( editScene.toImport[ 0 ] );
			
		}
	},
	
	/* called for each dragged in imported file */
	imageImported: function ( e ) {
		var data = e.target.result;
		
		var imageName = editScene.toImport.splice( 0, 1 )[ 0 ].name;
		
		// add image to assets
		if ( data.length ) {

			var asset = {
				ext: imageName.substr( imageName.lastIndexOf( '.' ) + 1).toLowerCase(),
				name: imageName, //.substr( 0, imageName.lastIndexOf( '.' ) ),
				src: data
			};

			editScene.importSceneAsset( asset );

		}
		
		// next
		if ( editScene.toImport.length ) {
			var reader = new FileReader();
			var fileExt = editScene.toImport[ 0 ].name.substr( editScene.toImport[ 0 ].name.lastIndexOf( '.' ) + 1).toLowerCase();
			var isImage = [ "jpg", "jpeg", "png" ].indexOf( fileExt ) >= 0;
			reader.onload = isImage ? editScene.imageImported : editScene.fileImported;
			if ( isImage ) reader.readAsDataURL( editScene.toImport[ 0 ] );
			else reader.readAsText( editScene.toImport[ 0 ] );
		}
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Scene & asset functions */
	
	assetUpdated: function ( newAsset ) {
		this.showMessage( newAsset.name + ' updated' );
		
		var prevAsset = assets.files[ newAsset.name ];
		if ( prevAsset ) {
			this.addUndo( {
				              name: "updateAsset",
				              undo: [ this.importSceneAsset, prevAsset ],
				              redo: [ this.importSceneAsset, newAsset ]
			              } );
		}
		this.importSceneAsset( newAsset );
	},
	
	/* called to update placeholders, or to replace existing assets */
	importSceneAsset: function ( newAsset ) {

		// create a stored copy
		if ( !newAsset.importedAsset ) {
			// just imported
			newAsset.importedAsset = _deepClone( newAsset, 100 );

			// image ?
			if ( newAsset.src ) {
				newAsset.image = new Image();
				newAsset.image.src = newAsset.src;
				delete newAsset.src;

				newAsset.texture = new THREE.Texture( newAsset.image );
				newAsset.texture.needsUpdate = true;
			} else if ( newAsset.xml ) {
				newAsset.xml = THREE.PixelBoxUtil.parseXml( newAsset.xml );
			} else if ( newAsset.plist ) {
				newAsset.plist = THREE.PixelBoxUtil.parsePlist( newAsset.plist );
			// pixelbox
			} else if( newAsset.frames && newAsset.anchors ) {
				THREE.PixelBoxUtil.processPixelBoxFrames( newAsset );
			}
		}
		
		var replaced = [];
		var replaceUndoObjects = {};
		do {
			replaced.length = 0;
			var trav = function ( obj3d ) {

				// replacing PixelBoxAsset
				if ( newAsset.frameData ) {

					var newObj = null;
					// Replace placeholder with imported asset
					if ( obj3d.isPlaceholder && obj3d.def.asset == newAsset.name ) {
						newObj = new THREE.PixelBox( newAsset );
						// transplant children
						for ( var i = obj3d.children.length - 1; i >= 0; i-- ) {
							var child = obj3d.children[ i ];
							obj3d.remove( child );
							// anchored child is added to new obj's anchor of same name
							if ( child.anchored && newObj.anchors[ child.anchored ] ) {
								newObj.anchors[ child.anchored ].add( child );
								// transplant
							} else {
								newObj.add( child );
								child.anchored = false;
							}
							if ( child.def && child.def.target && typeof(child.def.target) == 'string' && newObj.anchors[ child.def.target ] ) {
								replaceUndoObjects[ child.def.target.uuid ] = newObj.anchors[ child.def.target ];
								child.target = newObj.anchors[ child.def.target ];
							}
						}

						// Replace existing asset
					} else if ( obj3d.pixelBox && obj3d.geometry.data != newAsset && obj3d.geometry.data.name == newAsset.name ) {
						newObj = new THREE.PixelBox( newAsset );
						// transplant children
						for ( var i = obj3d.children.length - 1; i >= 0; i-- ) {
							var child = obj3d.children[ i ];
							// transplant anchor's children to new anchor with same name
							if ( child.isAnchor ) {
								replaceUndoObjects[ child.uuid ] = newObj.anchors[ child.name ];
								for ( var j = child.children.length - 1; j >= 0; j-- ) {
									var subchild = child.children[ j ];
									child.remove( subchild );
									// anchored subchild is added to new obj's anchor of same name
									if ( newObj.anchors[ child.name ] ) {
										newObj.anchors[ child.name ].add( subchild );
										// no mathing anchor in new object, add as child, keep anchor def
									} else {
										newObj.add( subchild );
										subchild.anchored = subchild.def.anchor = child.name;
									}
									// subchild had named target (anchor name)
									if ( subchild.def.target && typeof(subchild.def.target) == 'string' && newObj.anchors[ subchild.def.target ] ) {
										replaceUndoObjects[ subchild.target.uuid ] = newObj.anchors[ subchild.def.target ];
										subchild.target = newObj.anchors[ subchild.def.target ];
									}
									// update helper
									if ( subchild.helper ) subchild.helper.update();
								}
								// delete html
								if ( child.htmlLabel ) child.htmlLabel.remove();
								if ( child.htmlRow ) child.htmlRow.remove();
								child.htmlLabel = child.htmlRow = null;

								// regular, non-anchor child
							} else {
								obj3d.remove( child );
								// anchored child is added to new obj's anchor of same name
								if ( child.anchored && newObj.anchors[ child.anchored ] ) {
									newObj.anchors[ child.anchored ].add( child );
									// transplant
								} else {
									newObj.add( child );
									child.anchored = false;
								}
								// update helper
								if ( child.helper ) child.helper.update();
							}
						}
					}

					// populate new object
					if ( newObj ) {
						newObj.anchored = obj3d.anchored;
						newObj.isTemplate = obj3d.isTemplate;
						newObj.visible = obj3d.visible;

						// update name
						if ( obj3d.name ) {
							if ( obj3d.anchored ) {
								obj3d.parent.parent[ obj3d.name ] = newObj;
							} else {
								obj3d.parent[ obj3d.name ] = newObj;
							}
						}

						// copy common props
						newObj.def = obj3d.def;
						newObj.name = obj3d.name;
						newObj.cullBack = obj3d.cullBack;
						newObj.position.copy( obj3d.position );
						newObj.scale.copy( obj3d.scale );
						newObj.rotation.copy( obj3d.rotation );

						var layer = newObj.def;
						// copy pixelbox props from def
						if ( layer.pointSize != undefined ) {
							newObj.pointSize = layer.pointSize;
						} else {
							var maxScale = Math.max( newObj.scale.x, newObj.scale.y, newObj.scale.z );
							newObj.pointSize = maxScale + 0.1;
						}
						if ( layer.alpha != undefined ) {
							newObj.alpha = layer.alpha;
						}
						if ( layer.cullBack != undefined ) newObj.cullBack = layer.cullBack;
						if ( layer.occlusion != undefined ) newObj.occlusion = layer.occlusion;
						if ( layer.tint != undefined ) {
							if ( layer.tint instanceof String ) newObj.tint.set( parseInt( layer.tint, 16 ) );
							else newObj.tint.copy( layer.tint );
						} else {
							newObj.tint.set( 0xffffff );
						}
						if ( layer.add != undefined ) {
							newObj.addColor.set( parseInt( layer.add, 16 ) );
						} else {
							newObj.addColor.set( 0x0 );
						}
						if ( layer.stipple != undefined ) {
							newObj.stipple = layer.stipple;
						} else {
							newObj.stipple = 0;
						}
						if ( layer.animSpeed != undefined ) newObj.animSpeed = layer.animSpeed;
						if ( newObj.pixelBox && layer.animOption != undefined ) {
							editScene.pixelboxApplyAnimationParams( newObj );
						}

						// add to same parent
						replaced.push( [ obj3d, newObj ] );
					}

				// replacing image
				} else if ( newAsset.image ) {

					// texture
					if ( obj3d instanceof THREE.Mesh && obj3d.textureMap == newAsset.name ) {

						var sn = obj3d.sliceName;
						obj3d.sliceName = null;
						obj3d.material.map = obj3d.customDepthMaterial.map = newAsset.texture;
						obj3d.material.needsUpdate = obj3d.customDepthMaterial.needsUpdate = true;
						obj3d.sliceName = sn;

					}

				// replacing slice object
				} else if ( newAsset.plist ) {

					// update slice
					if ( obj3d instanceof THREE.Mesh && obj3d.material.map && obj3d.material.map.sliceMap && obj3d.material.sliceName ) {

						obj3d.material.map.sliceMap = null;
						var sn = obj3d.sliceName;
						obj3d.sliceName = null;
						obj3d.sliceName = sn;

					}

				// xml
				} else if ( newAsset.xml ) {


				// other json - type asset
				} else {


				}

			};
			this.container.traverse( trav );
			
			// replace/reparent objects
			for ( var i = 0; i < replaced.length; i++ ) {
				var oldObj = replaced[ i ][ 0 ];
				var newObj = replaced[ i ][ 1 ];
				replaceUndoObjects[ oldObj.uuid ] = newObj;
				var p = oldObj.parent;
				// delete html
				if ( oldObj.htmlLabel ) oldObj.htmlLabel.remove();
				if ( oldObj.htmlRow ) oldObj.htmlRow.remove();
				oldObj.htmlLabel = oldObj.htmlRow = null;
				p.remove( oldObj );
				p.add( newObj );
			}
			
		} while ( replaced.length );
		
		// add new asset to cache
		assets.add( newAsset.name, newAsset );
		
		// refresh
		editScene.refreshAssets();
		editScene.refreshScene();
		editScene.refreshProps();
	},
	
	setSceneAmbientColor: function ( hex ) {
		editScene.addUndo( {
			                   name: 'sceneAmbientColor',
			                   undo: [ editScene.setSceneAmbientColor, editScene.doc.ambient.getHexString() ],
			                   redo: [ editScene.setSceneAmbientColor, hex ]
		                   } );
		
		$( '#scene-ambient-color' ).css( { backgroundColor: hex } );
		editScene.ambient.color.setHex( parseInt( hex, 16 ) );
		editScene.doc.ambient.copy( editScene.ambient.color );
	},
	
	setSceneFogColor: function ( hex ) {
		editScene.addUndo( {
			                   name: 'sceneAmbientColor',
			                   undo: [ editScene.setSceneFogColor, editScene.doc.fogColor.getHexString() ],
			                   redo: [ editScene.setSceneFogColor, hex ]
		                   } );
		
		$( '#scene-fog-color' ).css( { backgroundColor: hex } );
		editScene.scene.fog.color.setHex( parseInt( hex, 16 ) );
		editScene.doc.fogColor.copy( editScene.scene.fog.color );
	},
	
	setSceneFogNear: function ( val ) {
		this.addUndo( {
			              name: "setFogNear",
			              mergeable: true,
			              undo: [ this.setSceneFogNear, this.doc.fogNear ],
			              redo: [ this.setSceneFogNear, val ]
		              } );
		this.scene.fog.near = val;
		this.doc.fogNear = val;
	},
	
	setSceneFogFar: function ( val ) {
		this.addUndo( {
			              name: "setFogFar",
			              mergeable: true,
			              undo: [ this.setSceneFogFar, this.doc.fogFar ],
			              redo: [ this.setSceneFogFar, val ]
		              } );
		this.scene.fog.far = val;
		this.doc.fogFar = val;
	},
	
	setSceneClearColor: function ( hex ) {
		editScene.addUndo( {
			                   name: 'sceneClearColor',
			                   undo: [ editScene.setSceneClearColor, editScene.doc.clearColor.getHexString() ],
			                   redo: [ editScene.setSceneClearColor, hex ]
		                   } );
		
		$( '#scene-color' ).css( { backgroundColor: hex } );
		editScene.clearColor = parseInt( hex, 16 );
		editScene.doc.clearColor.setHex( editScene.clearColor );
		localStorage_setItem( 'editor-scene-bg-color', hex );
	},
	
	setSceneMaxShadows: function ( maxShadows ) {
		this.addUndo( {
			              name: "setMaxShadows",
			              mergeable: true,
			              undo: [ this.setSceneMaxShadows, this.doc.maxShadows ],
			              redo: [ this.setSceneMaxShadows, maxShadows ]
		              } );
		this.doc.maxShadows = maxShadows;
	},
	
	exportScene: function ( single, compress ) {
		var obj = {
			name: this.doc.name,
			maxShadows: this.doc.maxShadows,
			clearColor: this.doc.clearColor.getHexString(),
			ambient: this.doc.ambient.getHexString(),
			fogColor: this.doc.fogColor.getHexString(),
			fogNear: this.doc.fogNear,
			fogFar: this.doc.fogFar,
			layers: [],
			templates: {}
		}
		
		if ( this.doc.physics != undefined ) {
			obj.physics = this.doc.physics;
		}
		
		if ( this.doc.gravity != undefined ) {
			obj.gravity = this.doc.gravity.toArray();
		}
		
		if ( this.doc.broadphase != undefined ) {
			obj.broadphase = this.doc.broadphase;
		}
		
		this.validateAllObjectNames();
		
		var cont = this.container.serialize( obj.templates );
		obj.layers = cont.layers;
		if ( cont.containsTemplates ) obj.containsTemplates = cont.containsTemplates;
		
		if ( single ) {
			obj.assets = {};
			for ( var assetName in assets.files ) {
				var asset = assets.files[ assetName ];
				obj.assets[ assetName ] = editScene.exportAsset( asset, !compress, false );
			}
		}
		
		var ss = JSON.stringify( obj, null, (compress ? undefined : '\t') );
		if ( compress ) {
			ss = LZString.compressToBase64( ss );
		}
		
		return ss;
	},
	
	exportAsset: function ( asset, raw, compress, forDownload ) {

		// Image
		if ( asset.image ) {

			return asset.importedAsset;

		} else if ( (asset.plist || asset.xml ) && !asset.frameData ) {

			asset = asset.importedAsset;

			if ( forDownload ){

				if ( asset.xml ) asset = asset.xml;
				else if ( asset.plist ) asset = asset.plist;

			}

			if ( asset.ready ) delete asset.ready;

		}

		var obj;

		// PixelBox
		if ( asset.frameData ) {

			var processedAsset = asset;
			asset = asset.importedAsset;

			obj = {
				name: asset.name,
				width: asset.width, height: asset.height, depth: asset.depth,
				floor: asset.floor,
				optimize: asset.optimize,
				smoothNormals: asset.smoothNormals,
				occlusion: asset.occlusion,
				pointSize: asset.pointSize,
				frames: [],
				anchors: asset.anchors,
				anims: asset.anims,
				meta: asset.meta
			};

			if ( raw ) {
				if ( typeof(asset.frames[ 0 ]) == 'string' ) {
					// frames need to be converted to raw
					var pivotlessAsset = _deepClone( asset, 100 );
					pivotlessAsset.anchors = {};
					var model = new THREE.PixelBox( pivotlessAsset );

					// process frames
					for ( var f = 0; f < asset.frames.length; f++ ) {
						model.frame = f;
						model.encodeRawFrame( obj, f );
					}
					// already raw
				} else {
					obj.frames = asset.frames;
				}
			} else {
				// process frames
				var c = new THREE.Color();
				for ( var f = 0; f < asset.frames.length; f++ ) {
					// convert frame
					var currFrame = asset.frames[ f ];
					// already converted
					if ( typeof(currFrame) == 'string' ) {
						obj.frames[ f ] = currFrame;
					} else {
						var convertedFrame = new Array( asset.width * asset.height * asset.depth );
						for ( var i = 0; i < currFrame.o.length; i++ ) {
							var x = Math.floor( currFrame.p[ i * 3 ] );// + pivot.x);
							var y = Math.floor( currFrame.p[ i * 3 + 1 ] );// + pivot.y);
							var z = Math.floor( currFrame.p[ i * 3 + 2 ] );// + pivot.z);
							var n = new THREE.Vector3( currFrame.n[ i * 3 ], currFrame.n[ i * 3 + 1 ], currFrame.n[ i * 3 + 2 ] );
							c.setRGB( currFrame.c[ i * 4 ], currFrame.c[ i * 4 + 1 ], currFrame.c[ i * 4 + 2 ] );
							var a = currFrame.c[ i * 4 + 3 ];
							var addr = x * asset.height * asset.depth + y * asset.depth + z;
							convertedFrame[ addr ] = {
								x: x,
								y: y,
								z: z,
								c: c.getHex(),
								a: a,
								b: Math.max( 0, n.length() - 1.0 )
							};
						}

						// encode
						THREE.PixelBoxUtil.encodeFrame( convertedFrame, obj );
					}
				}
				delete obj.assembledFrames;
			}

		} else {

			// json
			obj = asset;

		}

		if ( compress ) {
			var ss = ( typeof( obj ) == 'object' ) ? JSON.stringify( obj ) : obj;
			if ( compress ) {
				ss = LZString.compressToBase64( ss );
			}
			return ss;
		}
		
		return obj;
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Scene panel & object picking */
	
	sceneSortFunc: function ( a, b ) {
		if ( a.isHelper ) return 1;
		if ( b.isHelper ) return -1;
		
		// compare types
		var atype = a.isAnchor ? ' anchor' : (a.def ? a.def.asset.toLowerCase() : '?');
		var btype = b.isAnchor ? ' anchor' : (b.def ? b.def.asset.toLowerCase() : '?');
		if ( atype < btype ) return -1;
		if ( btype < atype ) return 1;
		
		// compare names
		var aname = a.name ? (a.name.length ? a.name : '(Object)') : '(Object)';
		var bname = b.name ? (b.name.length ? b.name : '(Object)') : '(Object)';
		if ( aname < bname ) return -1;
		if ( bname < aname ) return 1;
		if ( a.id < b.id ) return -1;
		return 1;
	},
	
	filterSceneChanged: function ( e ) {
		var search = e.target.value.toLowerCase().trim();
		if ( search.length ) {
			editScene.refreshScene( true );
			$( '#scene' ).addClass( 'filter' );
			$( '#scene div.row' ).each( function ( i, el ) {
				var lbl = $( 'label:first', el );
				if ( lbl.text().toLowerCase().indexOf( search ) >= 0 ) {
					$( el ).removeClass( 'filtered' );
				} else {
					$( el ).addClass( 'filtered' );
				}
			} );
		} else {
			$( '#scene' ).removeClass( 'filter' );
			editScene.refreshScene();
			$( '#scene div.row' ).removeClass( 'filtered' );
		}
	},
	
	clearSceneFilter: function ( e ) {
		$( '#filter-scene' ).val( '' );
		$( '#scene' ).removeClass( 'filter' );
		$( '#scene div.row' ).removeClass( 'filtered' );
		editScene.refreshScene();
	},
	
	refreshScene: function ( flatList ) {
		var list = $( '#scene-list' );
		
		var sceneRow = $( '#scene', list );
		if ( !sceneRow.length ) {
			sceneRow = $( '<div class="row" id="scene"><div class="selection"/><div class="droptarget"/><a class="toggle">-</a><label/></div>' );
			list.append( sceneRow );
			sceneRow.click( this.objectRowClicked );
			list.disableSelection();
		} else {
			sceneRow.children( 'div.row' ).detach();
		}
		sceneRow.children( 'label:first' ).text( this.doc.name );
		
		// traverse
		editScene.container.children.sort( editScene.sceneSortFunc );
		editScene.container.traverse( function ( obj3d ) {
			obj3d.omit = (obj3d.parent.isInstance === true) || (obj3d.parent.omit === true) || (obj3d.parent instanceof THREE.FxSprite);
			
			// don't show helpers
			if ( obj3d.isHelper || obj3d == editScene.container || obj3d.parent.isHelper || obj3d.omit ) return;
			
			// sort children
			obj3d.children.sort( editScene.sceneSortFunc );
			
			// create a new row			
			var type = '';
			if ( obj3d.isAnchor ) type = 'Anchor';
			else if ( obj3d instanceof THREE.LinePathHandle ) type = obj3d.isControlPoint ? 'ControlPoint' : 'Point';
			else if ( obj3d.pixelBox ) type = obj3d.geometry.data.name;
			else if ( obj3d.collisionShape ) type = 'CollisionShape';
			else if ( obj3d.constraint ) type = 'Constraint';
			else type = obj3d.def.asset;
			
			if ( obj3d.isInstance ) type = '[' + obj3d.def.template + ']';
			if ( !obj3d.htmlRow ) {
				var color = editScene.automaticColorForIndex( obj3d.id, 1.0 );
				obj3d.htmlRow = $( '<div class="row" id="row-' + obj3d.uuid + '">\<div class="selection"/><div class="droptarget"/>\
				<a class="toggle">-</a><div class="tiny-swatch" style="background-color:' + color + '"/><label alt="' + obj3d.uuid + '"/>\
				<span class="type"/></div>' );
				
				// type
				obj3d.htmlRow.addClass( type );
				
				// placeholder
				if ( obj3d.isPlaceholder ) obj3d.htmlRow.addClass( 'missing' );
				
				// click
				obj3d.htmlRow.click( editScene.objectRowClicked ).dblclick( editScene.objectRowDoubleClicked );
				
				// draggable
				if ( !obj3d.isAnchor && !(obj3d instanceof THREE.LinePathHandle) ) {
					var h = $( '<div class="row helper" alt="' + obj3d.uuid + '"></div>' );
					obj3d.htmlRow.children( 'label:first' ).addClass( 'draggable' ).draggable( {
						                                                                           //axis:'y',
						                                                                           appendTo: document.body,
						                                                                           /*containment:list,*/
						                                                                           scroll: false,
						                                                                           delay: 300,
						                                                                           cursorAt: {
							                                                                           left: 5,
							                                                                           top: 5
						                                                                           },
						                                                                           revert: 'invalid',
						                                                                           helper: function () { return h[ 0 ]; },
						                                                                           start: editScene.dragRowStarted,
						                                                                           stop: editScene.dragRowStopped
					                                                                           } );
				}
				
			} else {
				obj3d.htmlRow.children( 'div.row' ).detach();
			}
			
			// update row
			var name = obj3d.name;
			obj3d.htmlRow.children( 'label:first' ).text( name );
			obj3d.htmlRow.children( 'span.type:first' ).text( type );
			
			if ( obj3d.visible ) {
				obj3d.htmlRow.removeClass( 'hidden' );
			} else {
				obj3d.htmlRow.addClass( 'hidden' );
			}
			if ( obj3d.isTemplate ) {
				obj3d.htmlRow.addClass( 'template' );
			} else {
				obj3d.htmlRow.removeClass( 'template' );
			}
			if ( obj3d.children.length && !obj3d.isInstance && !(obj3d instanceof THREE.FxSprite) ) {
				obj3d.htmlRow.children( 'a.toggle' ).css( { visibility: 'visible' } );
			} else {
				obj3d.htmlRow.children( 'a.toggle' ).css( { visibility: 'hidden' } );
			}
			if ( obj3d.selected ) {
				obj3d.htmlRow.addClass( 'selected' );
				if ( obj3d.htmlLabel ) obj3d.htmlLabel.addClass( 'selected' );
			} else {
				obj3d.htmlRow.removeClass( 'selected' );
				if ( obj3d.htmlLabel ) obj3d.htmlLabel.removeClass( 'selected' );
			}
			if ( obj3d.isDefault ) {
				obj3d.htmlRow.addClass( 'default' );
			} else {
				obj3d.htmlRow.removeClass( 'default' );
			}
			
			// update object helper and label visibility
			obj3d.visibleRecursive = obj3d.visible && obj3d.parent.visibleRecursive;
			if ( obj3d.helper ) obj3d.helper.visible = obj3d.visibleRecursive && obj3d.selected;
			if ( obj3d.htmlLabel ) {
				if ( obj3d.visibleRecursive ) {
					obj3d.htmlLabel.css( { visibility: 'visible' } );
				} else {
					obj3d.htmlLabel.css( { visibility: 'hidden' } );
				}
			}
			
			// add to parent row
			var prow = sceneRow;
			if ( !flatList && obj3d.parent != editScene.container ) {
				prow = $( '#row-' + obj3d.parent.uuid, list );
			}
			prow.append( obj3d.htmlRow );
		} );
	},
	
	dragRowStarted: function ( event, ui ) {
		editScene.clearSceneFilter( true );
		var draggedObj = editScene.container.getObjectByUUID( ui.helper.attr( 'alt' ), true );
		this.autoScrollTimer = setInterval( editScene.autoScrollScenePanel.bind( ui.helper ), 100 );
		
		// populate helper
		var draggedObjects = [];
		if ( draggedObj.selected ) {
			draggedObjects = editScene.selectedObjects;
		} else {
			draggedObjects = [ draggedObj ];
		}
		ui.helper.empty();
		var containsCollisionShapes = false;
		for ( var i = draggedObjects.length - 1; i >= 0; i-- ) {
			var obj3d = draggedObjects[ i ];
			if ( obj3d.isAnchor ) {
				draggedObjects.splice( i, 1 );
				continue;
			}
			if ( obj3d.collisionShape || obj3d.constraint ) containsCollisionShapes = true;
			var color = editScene.automaticColorForIndex( obj3d.id, 1.0 );
			var type = obj3d.isAnchor ? 'Anchor' : (obj3d.def ? obj3d.def.asset : '?');
			var h = $( '<li><div class="tiny-swatch" style="background-color:' + color + '"/><label/></li>' );
//				<span class="type">'+type+'</span></li>');
			h.children( 'label' ).text( draggedObjects[ i ].name );
			ui.helper.append( h );
		}
		//$(event.target).draggable('option','cursorAt',{left:Math.floor(ui.helper.width()*0.5), top:Math.floor(ui.helper.height()*0.5)});
		editScene.reparentObjects = draggedObjects;
		
		// add droppable class to droppable rows
		$( '#scene-list #scene,#scene-list #scene div.row' ).each( function ( i, el ) {
			var uuid = el.id.substr( 4 );
			var obj = ((uuid == 'e') ? editScene.container : editScene.container.getObjectByUUID( uuid, true ));
			var invalid = false;
			for ( var i = 0; i < draggedObjects.length; i++ ) {
				// no parenting to dragged objects themselves, or instances
				if ( obj == draggedObjects[ i ] || obj.isDescendantOf( draggedObjects[ i ] ) || obj.isInstance || obj.omit ||
						
						// no parenting to line paths
					obj instanceof THREE.LinePathHandle || obj instanceof THREE.LinePath ||

						// or fx sprites
					obj instanceof THREE.FxSprite ||

						// no parenting to collision shapes
					obj.collisionShape || obj.constraint ||
						
						// collision shapes can be parented to Mesh, container, or PixelBox
					(containsCollisionShapes && !(obj instanceof THREE.Mesh || obj.isContainer || obj.isAnchor || obj instanceof THREE.PixelBox))
				
				) {
					invalid = true;
					break;
				}
			}
			if ( !invalid ) {
				var dd = $( el ).children( 'div.droptarget' );
				dd.addClass( 'droppable' );
				if ( obj.htmlLabel ) {
					obj.htmlLabel.addClass( 'droppable' );
				}
			}
		} );
		
		$( '#scene-list div.row > div.droptarget.droppable' ).droppable( {
			                                                                 accept: ".draggable",
			                                                                 tolerance: "pointer",
			                                                                 greedy: true,
			                                                                 //activeClass: "ui-state-hover",
			                                                                 hoverClass: "active",
			                                                                 over: function ( event, ui ) {
				                                                                 var row = $( event.target ).closest( '.row' );
				                                                                 if ( row.hasClass( 'collapsed' ) ) {
					                                                                 var expandTimeout = row.data( 'expandTimeout' );
					                                                                 if ( !expandTimeout ) {
						                                                                 expandTimeout = setTimeout( function () { row.data( 'expandTimeout', null ).children( 'a.toggle:first' ).trigger( 'click' ); }, 1000 );
						                                                                 row.data( 'expandTimeout', expandTimeout );
					                                                                 }
				                                                                 }
			                                                                 },
			                                                                 out: function ( event, ui ) {
				                                                                 var row = $( event.target ).closest( '.row' );
				                                                                 var expandTimeout = row.data( 'expandTimeout' );
				                                                                 if ( expandTimeout ) {
					                                                                 row.data( 'expandTimeout', null );
					                                                                 clearTimeout( expandTimeout );
				                                                                 }
			                                                                 },
			                                                                 drop: function ( event, ui ) {
				                                                                 //console.log(event, ui);
				                                                                 var targId = $( event.target ).closest( '.row' ).attr( 'id' ).substr( 4 );
				                                                                 var obj = ((targId == 'e') ? editScene.container : editScene.container.getObjectByUUID( targId, true ));
				                                                                 editScene.reparentDraggedRowsTo( obj );
			                                                                 }
		                                                                 } );
		$( 'body > label.object-label.droppable' ).droppable( {
			                                                      accept: ".draggable",
			                                                      tolerance: "pointer",
			                                                      greedy: true,
			                                                      //activeClass: "ui-state-hover",
			                                                      hoverClass: "active",
			                                                      over: function ( event, ui ) {
				                                                      var label = $( event.target );
				                                                      label.data( 'z-index', label.css( 'z-index' ) );
				                                                      label.data( 'color', label.css( 'color' ) );
				                                                      label.css( 'z-index', 20000010 );
				                                                      label.css( 'color', '' );
				                                                      var others = $( 'body > label.droppable.active' ).not( label );
				                                                      others.each( function ( i, el ) {
					                                                      editScene.dragLabelOut( { target: el } );
				                                                      } );
			                                                      },
			                                                      out: editScene.dragLabelOut,
			                                                      drop: function ( event, ui ) {
				                                                      var targId = $( event.target ).attr( 'id' );
				                                                      var obj = editScene.container.getObjectByUUID( targId, true );
				                                                      editScene.reparentDraggedRowsTo( obj );
			                                                      }
		                                                      } );
	},
	
	dragLabelOut: function ( event, ui ) {
		var label = $( event.target );
		label.css( 'z-index', label.data( 'z-index' ) );
		label.css( 'color', label.data( 'color' ) );
		label.data( 'z-index', null );
		label.data( 'color', null );
		label.removeClass( 'active' );
	},
	
	dragRowStopped: function ( event, ui ) {
		editScene.rowDropTarget = null;
		$( '#scene-list div.row > div.droptarget.droppable' ).removeClass( 'droppable' ).droppable( 'destroy' );
		$( 'body > label.object-label.droppable' ).removeClass( 'droppable' ).droppable( 'destroy' ).each( function ( i, el ) {
			var label = $( el );
			var bgc = label.data( 'color' );
			if ( bgc ) label.css( 'color', bgc ).data( 'color', null );
			bgc = label.css( 'z-index' );
			if ( bgc )label.data( 'z-index', bgc ).data( 'z-index', null );
		} );
		editScene.reparentObjects = null;
		
		if ( this.autoScrollTimer ) clearInterval( this.autoScrollTimer );
		this.autoScrollTimer = 0;
	},
	
	autoScrollScenePanel: function () {
		var list = $( '#scene-list' );
		var listHeight = list.height();
		var topOffs = list.offset();
		var lw = list.width();
		var rowOffs = this.offset();
		var top = rowOffs.top - topOffs.top;
		var p;
		if ( topOffs.x < rowOffs.x || topOffs.x > topOffs.x + lw ) return;//oob
		if ( top < 40 ) {
			p = list.scrollTop() + (top - 40);
		} else if ( top > listHeight - 40 ) {
			p = list.scrollTop() + (top - (listHeight - 40));
		}
		list.animate( { scrollTop: p }, 90 );
	},
	
	objectRowDoubleClicked: function ( e ) {
		// find object
		var targ = $( e.target );
		var row = targ.closest( '.row' );
		var rid = row.attr( 'id' );
		var uuid = rid.substr( 4 );
		
		if ( row.hasClass( 'filtered' ) ) return;
		
		if ( targ.hasClass( 'toggle' ) ) { return; }
		
		// find object
		var object = (rid == 'scene') ? editScene.container : editScene.container.getObjectByUUID( uuid );
		
		if ( object ) {
			editScene.controls.focus( object, true );
		}
	},
	objectRowClicked: function ( e ) {
		// find object
		var targ = $( e.target );
		var row = targ.closest( '.row' );
		var rid = row.attr( 'id' );
		var uuid = rid.substr( 4 );
		
		if ( row.hasClass( 'filtered' ) ) return;
		
		e.stopPropagation();
		
		if ( targ.hasClass( 'toggle' ) ) {
			row.toggleClass( 'collapsed' );
			var collapsed = false;
			if ( row.hasClass( 'collapsed' ) ) {
				targ.text( '+' );
				collapsed = true;
			} else {
				targ.text( '-' );
			}
			
			// collapse all on the same level
			if ( e.shiftKey ) {
				var sibs = row.siblings( '.row' );
				if ( collapsed ) {
					sibs.addClass( 'collapsed' ).children( 'a.toggle' ).text( '+' );
				} else {
					sibs.removeClass( 'collapsed' ).children( 'a.toggle' ).text( '-' );
				}
				
			}
			return;
		}
		
		if ( rid == 'scene' ) {
			editScene.deselectAll();
			editScene.refreshProps();
			return;
		}
		
		// find object
		var object = editScene.container.getObjectByUUID( uuid );
		if ( !(editScene.shift || editScene.ctrl || editScene.alt) ) {
			editScene.deselectAll();
			editScene.selectObject( object, true );
		}
		else if ( editScene.ctrl ) editScene.selectObject( object, !object.selected );
		else if ( editScene.alt ) editScene.selectObject( object, false );
		else if ( editScene.shift ) {
			var prevSib = row.prevAll( '.row.selected:first' );
			if ( prevSib.length ) {
				// select up to this one
				var sibs = prevSib.nextUntil( row, '.row' ).add( row );
				sibs.each( function ( i, el ) {
					if ( $( el ).hasClass( 'filtered' ) ) return;
					var uuid = el.id.substr( 4 );
					var obj = editScene.container.getObjectByUUID( uuid );
					editScene.selectObject( obj, true );
				} );
			} else {
				prevSib = row.nextAll( '.row.selected:first' );
				if ( prevSib.length ) {
					var sibs = prevSib.prevUntil( row, '.row' ).add( row );
					sibs.each( function ( i, el ) {
						if ( $( el ).hasClass( 'filtered' ) ) return;
						var uuid = el.id.substr( 4 );
						var obj = editScene.container.getObjectByUUID( uuid );
						editScene.selectObject( obj, true );
					} );
				} else {
					editScene.selectObject( object, true );
				}
			}
		}
		editScene.selectionChanged();
	},
	
	objectLabelClicked: function ( e ) {
		if ( editScene.mouseMoved ) return;
		var uuid = e.target.id;//.substr(4);
		var obj = editScene.container.getObjectByUUID( uuid );
		editScene.objectClicked( obj );
		editScene.selectionChanged();
	},
	
	objectClicked: function ( object, longClick ) {
		if ( object ) {
			// find topmost non-omit object
			if ( object.omit ) {
				while ( object != this.container && object.omit ) {
					if ( object.omit ) object = object.parent;
					else break;
				}
				if ( object == this.container ) return;
			}
			
			// long click will select first collapsed parent node
			if ( longClick ) {
				
				var row = object.htmlRow.parents( 'div.row.collapsed:first' );
				if ( row.length ) {
					var uuid = row.attr( 'id' ).substr( 4 );
					object = editScene.container.getObjectByUUID( uuid );
				}
				
			} else {
				
				// expand the scene tree
				var collapsedParents = object.htmlRow.parents( 'div.row.collapsed' );
				collapsedParents.removeClass( 'collapsed' ).find( 'a.toggle:first' ).text( '-' );
				
			}
			// select
			if ( this.shift ) this.selectObject( object, true );
			else if ( this.ctrl ) this.selectObject( object, !object.selected );
			else if ( this.alt ) this.selectObject( object, false );
			else {
				this.deselectAll();
				this.selectObject( object, true );
			}
			
		} else this.deselectAll();
		editScene.selectionChanged();
	},
	
	deselectAll: function () {
		// inserting point
		if ( this.insertingPoint ) this.endInsertPoint();
		
		if ( !this.container || this.objectPickMode ) return;
		this.selectedObjects.length = 0;
		this.container.traverse( function ( obj ) {
			obj.selected = false;
			if ( obj.helper ) obj.helper.visible = false;
			if ( obj.htmlLabel ) obj.htmlLabel.removeClass( 'selected' );
			if ( obj.htmlRow ) obj.htmlRow.removeClass( 'selected' );
		} );
		
		window.selectedObject = null;
	},
	
	selectParents: function ( e ) {
		if ( !this.selectedObjects.length ) return;
		var origSelection = this.selectedObjects.concat();
		
		if ( !(e.shiftKey || e.altKey) ) this.deselectAll();
		
		for ( var i = 0; i < origSelection.length; i++ ) {
			var obj = origSelection[ i ];
			if ( obj.parent == this.container ) {
				if ( !e.altKey ) this.selectObject( obj, true );
				continue;
			}
			this.selectObject( obj.parent, !e.altKey );
			if ( !e.altKey ) {
				// expand the scene tree
				var collapsedParents = obj.parent.htmlRow.parents( 'div.row.collapsed' );
				collapsedParents.removeClass( 'collapsed' ).find( 'a.toggle:first' ).text( '-' );
			}
		}
		
		this.selectionChanged();
		this.refreshProps();
	},
	
	selectChildren: function ( e ) {
		if ( !this.selectedObjects.length ) return;
		var origSelection = this.selectedObjects.concat();
		
		if ( !(e.shiftKey || e.altKey) ) this.deselectAll();
		
		for ( var i = 0; i < origSelection.length; i++ ) {
			var obj = origSelection[ i ];
			if ( !obj.children.length && !e.altKey ) {
				this.selectObject( obj, true );
			}
			for ( var j = 0; j < obj.children.length; j++ ) {
				this.selectObject( obj.children[ j ], !e.altKey );
				if ( !e.altKey ) {
					// expand the scene tree
					var collapsedParents = obj.children[ j ].htmlRow.parents( 'div.row.collapsed' );
					collapsedParents.removeClass( 'collapsed' ).find( 'a.toggle:first' ).text( '-' );
				}
			}
		}
		
		this.selectionChanged();
		this.refreshProps();
	},
	
	selectObject: function ( obj, select ) {
		// inserting point
		if ( this.insertingPoint ) {
			this.endInsertPoint();
			return;
		}
		
		// pick object mode
		if ( this.objectPickMode ) {
			this.objectPickMode( obj );
			return;
		}
		
		obj.selected = select;
		if ( obj.helper ) obj.helper.visible = select && obj.visibleRecursive;
		var sp = this.selectedObjects.indexOf( obj );
		
		if ( select && sp === -1 ) this.selectedObjects.push( obj );
		else if ( !select && sp >= 0 ) this.selectedObjects.splice( sp, 1 );
		
		if ( obj.htmlLabel ) {
			if ( select )
				obj.htmlLabel.addClass( 'selected' );
			else
				obj.htmlLabel.removeClass( 'selected' );
		}
		if ( obj.htmlRow ) {
			if ( select )
				obj.htmlRow.addClass( 'selected' );
			else
				obj.htmlRow.removeClass( 'selected' );
		}
		
		window.selectedObject = this.selectedObjects.length ? this.selectedObjects[ this.selectedObjects.length - 1 ] : null;
	},
	
	selectObjectsByAsset: function ( e ) {
		var assetName = $( e.target ).attr( 'name' );
		if ( !(editScene.shift || editScene.alt) ) editScene.deselectAll();
		editScene.container.traverse( function ( obj ) {
			if ( obj.pixelBox && obj.geometry.data.name == assetName ) {
				editScene.selectObject( obj, !editScene.alt );
			}
		} );
		
		editScene.selectionChanged();
	},
	
	selectionChanged: function () {
		// scroll last selected obj into view in scene panel
		var containsTemplatedObjects = false;
		if ( this.selectedObjects.length ) {
			var lastObj;
			for ( var i = 0; i < this.selectedObjects.length; i++ ) {
				lastObj = this.selectedObjects[ i ];
				if ( lastObj.nearestTemplate() ) {
					containsTemplatedObjects = true;
					break;
				}
			}
			var list = $( '#scene-list' );
			var listHeight = list.height();
			var topOffs = list.offset();
			if ( lastObj.htmlRow ) {
				var rowOffs = lastObj.htmlRow.offset();
				var top = rowOffs.top - topOffs.top;
				var p;
				if ( top < 0 ) {
					p = list.scrollTop() + top;
				} else if ( top > listHeight - 40 ) {
					p = list.scrollTop() + (top - (listHeight - 40));
				}
				//console.log(p);
				list.animate( { scrollTop: p }, 250 );
			}
		}
		
		this.refreshTemplates();
		
		if ( containsTemplatedObjects || !this.selectedObjects.length ) this.rebuildInstances();
		
		// refresh props panel
		this.refreshProps();
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Assets panel */

	previewTexture: function ( e ) {
		var row = $( e.target ).closest( '.row' );
		var asset = assets.get( row.prop( 'asset' ) );

		if ( window[ 'chrome' ] && chrome.storage ) {
			chrome.app.window.create( 'editor/texture.html', {
				id: asset.name
			}, function ( win ) {
				if ( !win.contentWindow.imageSrc ) {
					win.contentWindow.imageSrc = asset.importedAsset.src;
					win.contentWindow.imageName = asset.name;
					win.contentWindow.sceneEditor = editScene;
				}
				win.focus();
			} );
		} else {
			var win = window.open( 'texture.html', '_blank' );
			win.contentWindow.imageSrc = asset.importedAsset.src;
			win.contentWindow.imageName = asset.name;
			win.sceneEditor = editScene;
			win.focus();
		}

	},

	previewDataFile: function ( e ) {
		var row = $( e.target ).closest( '.row' );
		var asset = assets.get( row.prop( 'asset' ) );
		var data = asset.xml ? asset.xml : ( asset.plist ? asset.plist : ( JSON.stringify( asset, null, '\t') ) );
		if ( window[ 'chrome' ] && chrome.storage ) {
			chrome.app.window.create( 'editor/texture.html', {
				id: asset.name
			}, function ( win ) {
				if ( !win.contentWindow.imageSrc ) {
					win.contentWindow.assetString = data;
					win.contentWindow.assetName = asset.name;
					win.contentWindow.sceneEditor = editScene;
				}
				win.focus();
			} );
		} else {
			var win = window.open( 'texture.html', '_blank' );
			win.contentWindow.assetString = data;
			win.contentWindow.assetName = asset.name;
			win.sceneEditor = editScene;
			win.focus();
		}

	},
	
	assetEdit: function ( e ) {
		var row = $( e.target ).closest( '.row' );
		var origAsset = assets.get( row.prop( 'asset' ) );
		if ( !origAsset ) {
			// alert("Asset "+row.prop('asset')+" hasn't been loaded.\nTODO: prompt to create new.");
			console.warn( "Asset " + row.prop( 'asset' ) + " hasn't been loaded.\nTODO: prompt to create new." );
			return;
		}

		var asset = _deepClone( origAsset.importedAsset, 100 );
		console.log( "Editing ", asset );
		if ( window[ 'chrome' ] && chrome.storage ) {
			chrome.app.window.create( 'editor/editor.html', {
				id: asset.name,
				outerBounds: {
					width: Math.max( 800, window.outerWidth ),
					height: Math.max( 600, window.outerHeight )
				}
			}, function ( win ) {
				if ( !win.contentWindow.loadAsset ) {
					win.contentWindow.loadAsset = asset;
					win.contentWindow.sceneEditor = editScene;
				}
				win.focus();
			} );
		} else {
			var win = window.open( 'editor.html', '_blank' );
			win.loadAsset = asset;
			win.sceneEditor = editScene;
			win.focus();
		}
	},
	
	refreshAssets: function () {
		var prevSelected = $( '#asset-list div.selected' ).attr( 'id' );
		$( '#asset-list' ).children().remove();
		
		var rows = [];
		var allAssets = {};

		// reset use counts
		for ( var key in assets.files ) {
			assets.files[ key ].used = 0;
		}

		// traverse and count
		editScene.container.traverse( function ( obj3d ) {
			if ( obj3d.isPlaceholder ) {
				if ( !allAssets[ obj3d.def.asset ] ) allAssets[ obj3d.def.asset ] = {
					used: 1,
					name: obj3d.def.asset,
					missing: true
				};
				else allAssets[ obj3d.def.asset ].used++;
			} else if ( obj3d.pixelBox && !(obj3d instanceof THREE.LinePathHandle) ) {
				assets.files[ obj3d.geometry.data.name ].used++;
			}
		} );
		_.extend( allAssets, assets.files );

		// traverse scene to update use counts
		for ( var i in allAssets ) {
			var asset = allAssets[ i ];
			var id = asset.name.replace( /\W|\s+/g, '-' );
			var color = this.automaticColorForIndex( rows.length, 1.0 );
			if ( asset.missing ) color = '#333';
			var newRow;
			// asset is image
			if ( asset.image ) {
				newRow = $( '<div class="row" id="asset-row-' + id + '"><div class="image-swatch"/><label/><span class="used">Texture ('+asset.image.width+' x '+asset.image.height+')</span></div>' );
				newRow.assetType = 'image';

				var icon = new Image();
				icon.src = asset.importedAsset.src;
				icon.width = 35;
				$( newRow ).find( 'div.image-swatch' ).append( icon );

				newRow.dblclick( this.previewTexture.bind( this ) );

			// asset is PixelBox
			} else if ( asset.frameData || asset.placeholder ) {

				newRow = $( '<div class="row" id="asset-row-' + id + '"><div class="tiny-swatch" style="background-color:' + color + '"/><label style="font-weight:bold;"/><span class="used"><a>PixelBox (' + asset.used + ')</a></span></div>' );
				newRow.assetType = '_pixelbox';

			} else if ( asset.xml ) {

				newRow = $( '<div class="row" id="asset-row-' + id + '"><div class="tiny-swatch" style="background-color: #333;"/><label style="font-style: italic;"/><span class="used">XML</span></div>' );
				newRow.assetType = 'xml';
				newRow.dblclick( this.previewDataFile.bind( this ) );

			} else if ( asset.plist ) {

				newRow = $( '<div class="row" id="asset-row-' + id + '"><div class="tiny-swatch" style="background-color: #333;"/><label style="font-style: italic;"/><span class="used">PLIST</span></div>' );
				newRow.assetType = 'plist';
				newRow.dblclick( this.previewDataFile.bind( this ) );

			} else {

				newRow = $( '<div class="row" id="asset-row-' + id + '"><div class="tiny-swatch" style="background-color: #333;"/><label style="font-style: italic;"/><span class="used">JSON</span></div>' );
				newRow.assetType = 'json';
				newRow.dblclick( this.previewDataFile.bind( this ) );

			}
			newRow.name = asset.name;
			newRow.find( 'label' ).text( asset.name );
			newRow.prop( 'asset', asset.name ).prop( 'assetType', newRow.assetType );
			newRow.find( 'a' ).attr( 'name', asset.name ).click( editScene.selectObjectsByAsset );
			if ( asset.missing ) {
				newRow.addClass( 'missing' );
			} else if ( newRow.assetType == '_pixelbox' ) {
				var h = $( '<div class="row helper"/>' );
				h.attr( 'alt', asset.name );
				var hfunc = function ( helper ) { return function () { return helper; }; }( h[ 0 ] );
				newRow.children( 'label:first' ).addClass( 'draggable' ).draggable( {
					                                                                    appendTo: document.body,
					                                                                    scroll: false,
					                                                                    delay: 300,
					                                                                    cursorAt: { left: 5, top: 5 },
					                                                                    revert: 'invalid',
					                                                                    helper: hfunc,
					                                                                    start: editScene.dragAssetStarted,
					                                                                    stop: editScene.dragAssetStopped
				                                                                    } );
				newRow.dblclick( this.assetEdit.bind( this ) );
			}

			if ( newRow.attr( 'id' ) == prevSelected ) newRow.addClass( 'selected' );
			newRow.click( this.assetSelect.bind( this ) );
			rows.push( newRow );
		}
		
		rows.sort( function ( a, b ) {
			if ( a.assetType < b.assetType ) return -1;
			if ( a.assetType > b.assetType ) return 1;

			if ( a.name < b.name ) return -1;
			if ( a.name > b.name ) return 1;
			return 0;
		} );
		
		if ( rows.length ) rows.push( $( '<hr/><div style="height:4em;"><span class="info">double click pixelbox assets to edit</span></div>' ) );
		
		$( '#asset-list' ).append( rows );
		
		if ( prevSelected ) $( '#' + prevSelected ).trigger( 'click' );
	},
	
	dragAssetStarted: function ( event, ui ) {
		ui.helper.empty();
		var h = $( '<li><label/></li>' );
		h.children( 'label' ).text( $( ui.helper ).attr( 'alt' ) );
		ui.helper.append( h );
		
		// add droppable class to droppable rows
		$( '#scene-list #scene,#scene-list #scene div.row' ).each( function ( i, el ) {
			var uuid = el.id.substr( 4 );
			var obj = ((uuid == 'e') ? editScene.container : editScene.container.getObjectByUUID( uuid, true ));
			var invalid = obj.isInstance;
			if ( !invalid ) {
				var dd = $( el ).children( 'div.droptarget' );
				dd.addClass( 'droppable' );
				if ( obj.htmlLabel ) {
					obj.htmlLabel.addClass( 'droppable' );
				}
			}
		} );
		
		$( '#scene-list div.row > div.droptarget.droppable' ).droppable( {
			                                                                 accept: ".draggable",
			                                                                 tolerance: "pointer",
			                                                                 greedy: true,
			                                                                 //activeClass: "ui-state-hover",
			                                                                 hoverClass: "active",
			                                                                 over: function ( event, ui ) {
				                                                                 var row = $( event.target ).closest( '.row' );
				                                                                 if ( row.hasClass( 'collapsed' ) ) {
					                                                                 var expandTimeout = row.data( 'expandTimeout' );
					                                                                 if ( !expandTimeout ) {
						                                                                 expandTimeout = setTimeout( function () { row.data( 'expandTimeout', null ).children( 'a.toggle:first' ).trigger( 'click' ); }, 1000 );
						                                                                 row.data( 'expandTimeout', expandTimeout );
					                                                                 }
				                                                                 }
			                                                                 },
			                                                                 out: function ( event, ui ) {
				                                                                 var row = $( event.target ).closest( '.row' );
				                                                                 var expandTimeout = row.data( 'expandTimeout' );
				                                                                 if ( expandTimeout ) {
					                                                                 row.data( 'expandTimeout', null );
					                                                                 clearTimeout( expandTimeout );
				                                                                 }
			                                                                 },
			                                                                 drop: function ( event, ui ) {
				                                                                 //console.log(event, ui);
				                                                                 var targId = $( event.target ).closest( '.row' ).attr( 'id' ).substr( 4 );
				                                                                 var obj = ((targId == 'e') ? editScene.container : editScene.container.getObjectByUUID( targId, true ));
				                                                                 editScene.addAssetToObject( $( ui.helper ).attr( 'alt' ), obj );
			                                                                 }
		                                                                 } );
		$( 'body > label.object-label.droppable' ).droppable( {
			                                                      accept: ".draggable",
			                                                      tolerance: "pointer",
			                                                      greedy: true,
			                                                      //activeClass: "ui-state-hover",
			                                                      hoverClass: "active",
			                                                      over: function ( event, ui ) {
				                                                      var label = $( event.target );
				                                                      label.data( 'z-index', label.css( 'z-index' ) );
				                                                      label.data( 'color', label.css( 'color' ) );
				                                                      label.css( 'z-index', 20000010 );
				                                                      label.css( 'color', '' );
				                                                      var others = $( 'body > label.droppable.active' ).not( label );
				                                                      others.each( function ( i, el ) {
					                                                      editScene.dragLabelOut( { target: el } );
				                                                      } );
			                                                      },
			                                                      out: editScene.dragLabelOut,
			                                                      drop: function ( event, ui ) {
				                                                      var targId = $( event.target ).attr( 'id' );
				                                                      var obj = editScene.container.getObjectByUUID( targId, true );
				                                                      editScene.addAssetToObject( $( ui.helper ).attr( 'alt' ), obj );
			                                                      }
		                                                      } );
	},
	
	dragAssetStopped: function ( event, ui ) {
		editScene.rowDropTarget = null;
		$( '#scene-list div.row > div.droptarget.droppable' ).removeClass( 'droppable' ).droppable( 'destroy' );
		$( 'body > label.object-label.droppable' ).removeClass( 'droppable' ).droppable( 'destroy' ).each( function ( i, el ) {
			var label = $( el );
			var bgc = label.data( 'color' );
			if ( bgc ) label.css( 'color', bgc ).data( 'color', null );
			bgc = label.css( 'z-index' );
			if ( bgc )label.data( 'z-index', bgc ).data( 'z-index', null );
		} );
	},
	
	addAssetToObject: function ( assetName, obj ) {
		editScene.addObjectMenuItemClicked( { target: obj }, assetName );
	},
	
	assetSelect: function ( e ) {
		var row = $( e.target ).closest( '.row' );
		$( '#asset-list .row' ).removeClass( 'selected' );
		
		if ( row.length ) {
			row = row.get( 0 );
			$( row ).addClass( 'selected' );
			if ( $( row ).prop('assetType') != '_pixelbox' ) {
				$( '#asset-add' ).button( 'disable' );
			} else {
				$( '#asset-add' ).button( 'enable' );
			}
		}
	},
	
	renameAsset: function ( oldName, newName ) {
		assets.files[ newName ] = assets.files[ oldName ];
		assets.files[ newName ].name = newName;
		assets.files[ newName ].importedAsset.name = newName;
		delete assets.files[ oldName ];
		
		this.refreshAssets();
		this.refreshScene();
		this.refreshProps();
	},
	
	assetRename: function ( e ) {
		var selectedAsset = $( '#asset-list .row.selected' );
		if ( !selectedAsset.length ) return;
		
		var dlg = $( '<div id="editor-rename" class="editor">\
		<span class="info">Enter new name for <em/>.</span>\
		<div class="center pad5"><input type="text" id="asset-name" size="20"/></div>\
		</div>' );
		
		var oldName = $( 'label:first', selectedAsset ).text();
		$( 'span.info:first em', dlg ).text( oldName );
		//
		var dlgDef = {
			resizable: false, width: 330, height: 270, modal: true, dialogClass: 'no-close', title: "Rename Asset",
			buttons: {
				"Rename": function () {
					var newName = $( '#asset-name' ).val().trim();
					newName = newName.substr( 0, 1 ).toLowerCase() + newName.substr( 1 ); //lowercase first
					var err = null;
					if ( oldName != newName ) {
						if ( !newName.length ) err = "Asset name can't be empty";
						if ( assets.files[ newName ] != undefined ) err = "Asset with this name already exists";
						if ( err ) {
							$( '#editor-rename #asset-name' ).val( newName ).focus().select();
							$( '#editor-rename > span' ).last().removeClass( 'info' ).addClass( 'error center' ).text( err );
							return;
						} else {
							selectedAsset.prop( 'asset', newName );
							editScene.addUndo( {
								                   name: "renameAsset",
								                   undo: [ editScene.renameAsset, newName, oldName ],
								                   redo: [ editScene.renameAsset, oldName, newName ]
							                   } );
							editScene.renameAsset( oldName, newName );
						}
					}
					$( '#editor-rename' ).dialog( "close" );
				},
				"Cancel": function () {
					$( this ).dialog( "close" );
				}
			},
			close: function () {
				$( this ).remove();
				editScene.enableCanvasInteractions( true );
			}
		};
		dlg.dialog( dlgDef );
		
		editScene.disableCanvasInteractions( true );
		$( '#asset-name', dlg ).val( oldName ).focus().select().keypress( function ( e ) { if ( e.which == 13 ) dlgDef.buttons.Rename(); } );
		
	},
	
	assetNew: function ( e ) {
		var dlg = $( '<div id="editor-new-asset" class="editor">\
		<span class="info">Enter new asset name.</span>\
		<div class="center pad5"><input type="text" id="asset-name" size="20" tabindex="0"/>\
		<br/><br/>\
		<label for="asset-x" class="right-align w2">Width</label><input class="center" type="text" size="1" tabindex="1" id="asset-x" value="8"/>\
		<label for="asset-y" class="right-align w2">Height</label><input class="center" type="text" size="1" tabindex="2" id="asset-y" value="8"/>\
		<label for="asset-z" class="right-align w2">Depth</label><input class="center" type="text" size="1" tabindex="3" id="asset-z" value="8"/></div>\
		</div>' );
		
		var dlgDef = {
			resizable: false, width: 440, height: 320, modal: true, dialogClass: 'no-close', title: "New Asset",
			buttons: {
				"Create": function () {
					var newName = $( '#asset-name' ).val().trim();
					newName = newName.substr( 0, 1 ).toLowerCase() + newName.substr( 1 ); //lowercase first
					var err = null;
					if ( !newName.length ) err = "Asset name can't be empty";
					if ( assets.files[ newName ] != undefined ) err = "Asset with this name already exists";
					var xx = parseInt( $( '#asset-x' ).val() );
					var yy = parseInt( $( '#asset-y' ).val() );
					var zz = parseInt( $( '#asset-z' ).val() );
					if ( isNaN( xx ) || xx <= 0 || xx > 256 || isNaN( yy ) || yy <= 0 || yy > 256 || isNaN( zz ) || zz <= 0 || zz > 256 ) {
						err = "Asset dimensions must be between 1 and 256";
					}
					if ( err ) {
						$( '#editor-new-asset #asset-name' ).val( newName ).focus().select();
						$( '#editor-new-asset > span' ).last().removeClass( 'info' ).addClass( 'error center' ).text( err );
						return;
					} else {
						var asset = {
							"name": newName,
							"width": xx,
							"height": yy,
							"depth": zz,
							"floor": false,
							"optimize": true,
							"smoothNormals": 0.5,
							"occlusion": 0.75,
							"pointSize": 1,
							"frames": [ { "p": [], "n": [], "c": [], "o": [] } ],
							"anims": [],
							"anchors": {
								"PIVOT": [ {
									x: xx * 0.5,
									y: yy * 0.5,
									z: zz * 0.5,
									rx: 0,
									ry: 0,
									rz: 0,
									sx: 1,
									sy: 1,
									sz: 1,
									on: true,
									meta: "Object pivot"
								} ]
							}
						};
						editScene.addUndo( {
							                   name: "addAsset",
							                   undo: [ editScene.deleteAsset, asset ],
							                   redo: [ editScene.importSceneAsset, asset ]
						                   } );
						editScene.importSceneAsset( asset );
					}
					
					$( '#editor-new-asset' ).dialog( "close" );
				},
				"Cancel": function () {
					$( this ).dialog( "close" );
				}
			},
			close: function () {
				$( this ).remove();
				editScene.enableCanvasInteractions( true );
			}
		};
		dlg.dialog( dlgDef );
		
		editScene.disableCanvasInteractions( true );
		$( '#asset-x,#asset-y,#asset-z' ).spinner( { min: 1, max: 256, step: 1 } );
		$( 'input', dlg ).keypress( function ( e ) { if ( e.which == 13 ) dlgDef.buttons.Create(); } );
		$( '#asset-name', dlg ).focus();
	},
	
	deleteAsset: function ( asset ) {
		delete assets.files[ asset.name ];
		editScene.refreshAssets();
	},
	deleteAssetWithName: function ( assetName ) {
		// gather affected objects
		var objsAdd = [];
		var objs = [];
		
		function trav ( obj ) {
			if ( obj.pixelBox && obj.geometry.data.name == assetName ) {
				objsAdd.push( [ obj, obj.parent ] );
				objs.push( obj );
			} else {
				for ( var i = 0; i < obj.children.length; i++ ) {
					trav( obj.children[ i ] );
				}
			}
		}

		trav( this.container );
		var asset = assets.get( assetName );
		if ( !asset ) return;
		if ( objs.length ) {
			this.addUndo( [
				              {
					              name: "deleteObjects",
					              undo: [ this.addObjects, objsAdd ],
					              redo: [ this.deleteObjects, objs ]
				              },
				              {
					              name: "deleteAsset",
					              undo: [ this.importSceneAsset, asset ],
					              redo: [ this.deleteAsset, asset ]
				              }
			              ] );
			this.deleteObjects( objs );
			this.deleteAsset( asset );
		} else {
			this.addUndo( {
				              name: "deleteAsset",
				              undo: [ this.importSceneAsset, asset ],
				              redo: [ this.deleteAsset, asset ]
			              } );
			this.deleteAsset( asset );
		}
	},
	assetDelete: function ( e ) {
		var selectedAsset = $( '#asset-list .row.selected' );
		if ( !selectedAsset.length ) return;
		
		var dlg = $( '<div id="editor-delete-asset" class="editor">\
		<p class="center">Delete <em/>?</p>\
		<span class="info">This will also delete all scene objects of the same type.</span>\
		</div>' );
		
		var assetName = $( 'label:first', selectedAsset ).text();
		$( 'p:first em', dlg ).text( assetName );
		//
		var dlgDef = {
			resizable: false, width: 280, height: 270, modal: true, dialogClass: 'no-close', title: "Delete Asset",
			buttons: {
				"Delete": function () {
					editScene.deleteAssetWithName( assetName );
					$( this ).dialog( "close" );
				},
				"Cancel": function () {
					$( this ).dialog( "close" );
				},
			},
			close: function () {
				$( this ).remove();
				editScene.enableCanvasInteractions( true );
			}
		};
		dlg.dialog( dlgDef );
		
		editScene.disableCanvasInteractions( true );
	},
	
	assetAdd: function ( e ) {
		var selectedAsset = $( '#asset-list .row.selected' );
		if ( !selectedAsset.length ) return;
		var assetName = $( 'label:first', selectedAsset ).text();
		var asset = assets.get( assetName );

		// PixelBox ?
		if ( asset.frameData ) {

			editScene.addObjectMenuItemClicked( e, assetName );

		} else {

			console.log("Only PixelBox assets can be added to scene");

		}
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Name */
	
	renameObjects: function ( objNameArr, dontRefreshScene ) {
		var renameInstances = {};
		var hasTemplates = false;
		for ( var i = 0; i < objNameArr.length; i++ ) {
			var obj = objNameArr[ i ][ 0 ];
			var oldName = obj.name;
			obj.name = objNameArr[ i ][ 1 ];
			if ( obj.htmlLabel ) {
				obj.htmlLabel.text( obj.name );
				obj.htmlLabel.labelWidth = obj.htmlLabel.labelWidth = 0;
			}
			if ( obj.htmlRow ) {
				obj.htmlRow.children( 'label' ).first().text( obj.name );
			}
			if ( obj.isTemplate ) {
				renameInstances[ oldName ] = obj.name;
				hasTemplates = true;
			}
		}
		this.refreshTemplates( hasTemplates ? renameInstances : null );
		if ( !dontRefreshScene ) this.refreshScene();
	},
	
	renameScene: function ( newName ) {
		this.doc.name = newName;
		$( '#scene-list #scene > label' ).text( newName );
	},
	
	nameChanged: function ( e ) {
		var doArr = [];
		var undoArr = [];
		var newName = $( '#prop-name' ).val().replace( /\W+/g, '_' ); // replace non-word chars with _
		if ( newName.match( /^\d+/ ) || !newName.length ) { // prepend _ if starts with a digit
			newName = '_' + newName;
		}
		for ( var i = 0; i < this.selectedObjects.length; i++ ) {
			var obj = this.selectedObjects[ i ];
			undoArr.push( [ obj, obj.name ] );
			doArr.push( [ obj, newName ] );
			// move obj to the top of children array of its parent
			// so validateObjectName keeps this object's name
			var p = obj.parent;
			var ci = p.children.indexOf( obj );
			if ( ci != 0 ) {
				p.children.splice( ci, 1 );
				p.children.splice( 0, 0, obj );
			}
		}
		
		if ( undoArr.length ) {
			this.addUndo( {
				              name: "rename",
				              redo: [ this.renameObjects, doArr ],
				              undo: [ this.renameObjects, undoArr ]
			              } );
			this.renameObjects( doArr, true );
			// validate
			if ( this.validateAllObjectNames() ) {
				this.mergeUndo( true );
			}
			this.refreshScene();
		} else {
			this.addUndo( {
				              name: "renameScene",
				              redo: [ this.renameScene, newName ],
				              undo: [ this.renameScene, this.doc.name ]
			              } );
			this.renameScene( newName );
		}
		
		this.refreshProps();
	},
	
	validateRenameObjectNames: function ( objects, doArr, undoArr ) {
		// { "name":[ [name, name0], undefined, ... , [name5,name5], [name6] ... ], ... }
		var usedNames = {};
		
		// first pass
		for ( var i = 0, l = objects.length; i < l; i++ ) {
			var obj = objects[ i ];
			
			var digits = obj.name.match( /\d+$/ );
			if ( digits && digits.length == 1 ) digits = digits[ 0 ];
			else digits = '';
			
			var name = obj.name.substr( 0, obj.name.length - digits.length );
			
			if ( !usedNames[ name ] ) {
				usedNames[ name ] = new Array();
			}
			var nth = digits.length ? parseInt( digits ) : 0;
			if ( usedNames[ name ][ nth ] === undefined ) usedNames[ name ][ nth ] = [ obj ];
			else usedNames[ name ][ nth ].push( obj );
		}
		// second pass
		for ( var name in usedNames ) {
			var nameDigit = usedNames[ name ];
			for ( var digit = 0; digit < nameDigit.length; digit++ ) {
				// array of objects with the same name+digit
				var objects = nameDigit[ digit ];
				if ( objects === undefined ) continue;
				for ( var i = objects.length - 1; i > 0; i-- ) {
					// find first available index
					avail = 0;
					while ( nameDigit[ avail ] !== undefined ) avail++;
					// rename object
					var obj = objects[ i ];
					var newName = name + (avail == 0 ? '' : avail);
					undoArr.push( [ obj, obj.name ] );
					doArr.push( [ obj, newName ] );
					// move info
					objects.splice( i, 1 );
					nameDigit[ avail ] = [ obj ];
				}
			}
		}
	},
	
	/* returns true if changes were made */
	validateAllObjectNames: function () {
		var doArr = [];
		var undoArr = [];
		var allTemplates = [];
		
		// scene-wide validate/rename
		this.container.traverse( function ( obj3d ) {
			// instances' children are left alone
			if ( obj3d.isInstance || obj3d.parentInstance() || obj3d instanceof THREE.LinePathHandle ) return;
			
			if ( obj3d.isTemplate ) allTemplates.push( obj3d );
			
			// get all children except for templates and anchors
			var childrenSansTemplates = [];
			for ( var i = 0; i < obj3d.children.length; i++ ) {
				var child = obj3d.children[ i ];
				// templates
				if ( !child.isTemplate && !child.isAnchor ) childrenSansTemplates.push( child );
			}
			
			// validate/rename
			editScene.validateRenameObjectNames( childrenSansTemplates, doArr, undoArr );
		} );
		
		// validate/rename template names
		this.validateRenameObjectNames( allTemplates, doArr, undoArr );
		
		if ( doArr.length ) {
			this.addUndo( {
				              name: "rename",
				              redo: [ this.renameObjects, doArr ],
				              undo: [ this.renameObjects, undoArr ]
			              } );
			this.renameObjects( doArr );
			return true;
		}
		return false;
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Move, scale, rotate, visible, template */
	
	setObjectsVisible: function ( objArr ) {
		for ( var i = 0; i < objArr.length; i++ ) {
			var obj = objArr[ i ][ 0 ];
			var val = objArr[ i ][ 1 ];
			obj.visible = val;
			this.touchTemplate( obj );
		}
		this.refreshScene(); // refreshes labels visibility
	},
	
	setObjectsTemplate: function ( objArr ) {
		for ( var i = 0; i < objArr.length; i++ ) {
			var obj = objArr[ i ][ 0 ];
			var val = objArr[ i ][ 1 ];
			obj.isTemplate = val;
			if ( val ) {
				obj.htmlLabel.addClass( 'template' );
				obj.htmlRow.addClass( 'template' );
			} else {
				obj.htmlLabel.removeClass( 'template' );
				obj.htmlRow.removeClass( 'template' );
			}
			this.touchTemplate( obj );
		}
		this.refreshTemplates();
	},
	
	moveObjects: function ( objPosArr ) {
		var containsCurvePoints = {};
		for ( var i = 0; i < objPosArr.length; i++ ) {
			var obj = objPosArr[ i ][ 0 ];
			if ( obj instanceof THREE.LinePathHandle ) {
				containsCurvePoints[ obj.parent.uuid ] = obj.isControlPoint ? obj.parent.parent : obj.parent;
			}
			obj.position.copy( objPosArr[ i ][ 1 ] );
			if ( obj.helper ) {
				obj.updateMatrixWorld( true );
				obj.helper.update();
			}
			
			editScene.touchTemplate( obj );
		}
		// refresh curves
		for ( var pid in containsCurvePoints ) {
			containsCurvePoints[ pid ].update();
		}
	},
	
	transformObjects: function ( objMatrixArr ) {
		var containsCurvePoints = {};
		for ( var i = 0; i < objMatrixArr.length; i++ ) {
			var obj = objMatrixArr[ i ][ 0 ];
			if ( obj instanceof THREE.LinePathHandle ) {
				containsCurvePoints[ obj.parent.uuid ] = obj.isControlPoint ? obj.parent.parent : obj.parent;
			}
			obj.matrix.copy( objMatrixArr[ i ][ 1 ] );
			obj.matrix.decompose( obj.position, obj.quaternion, obj.scale );
			obj.rotation.setFromQuaternion( obj.quaternion );
			if ( obj.helper ) {
				obj.updateMatrixWorld( true );
				obj.helper.update();
			}
			
			editScene.touchTemplate( obj );
		}
		// refresh curves
		for ( var pid in containsCurvePoints ) {
			containsCurvePoints[ pid ].update();
		}
	},
	
	moveSelectionTo: function ( pos ) {
		var objPosArr = [];
		var undoPosArr = [];
		for ( var i = 0; i < this.selectedObjects.length; i++ ) {
			var obj = this.selectedObjects[ i ];
			if ( obj.isAnchor ) continue;
			undoPosArr.push( [ obj, obj.position.clone() ] );
			objPosArr.push( [ obj,
				                new THREE.Vector3( (pos.x === null ? obj.position.x : pos.x),
				                                   (pos.y === null ? obj.position.y : pos.y),
				                                   (pos.z === null ? obj.position.z : pos.z) )
			                ] );
		}
		
		if ( objPosArr.length ) this.addUndo( {
			                                      name: "moveTo",
			                                      mergeable: true,
			                                      redo: [ this.moveObjects, objPosArr ],
			                                      undo: [ this.moveObjects, undoPosArr ]
		                                      } );
		
		this.moveObjects( objPosArr );
		return objPosArr.length;
	},
	
	moveSelectionBy: function ( pos ) {
		var objPosArr = [];
		var undoPosArr = [];
		for ( var i = 0; i < this.selectedObjects.length; i++ ) {
			var obj = this.selectedObjects[ i ];
			if ( obj.isAnchor ) continue;
			if ( obj instanceof THREE.LinePathHandle && obj.isControlPoint && obj.parent.lockTangents ) {
				// skip, if both handles are selected
				if ( obj.parent.preHandle.selected && obj.parent.postHandle.selected ) continue;
			}
			undoPosArr.push( [ obj, obj.position.clone() ] );
			objPosArr.push( [ obj,
				                new THREE.Vector3( obj.position.x + (pos.x === null ? 0 : pos.x),
				                                   obj.position.y + (pos.y === null ? 0 : pos.y),
				                                   obj.position.z + (pos.z === null ? 0 : pos.z) )
			                ] );
		}
		
		this.moveObjects( objPosArr );
		if ( objPosArr.length ) this.addUndo( {
			                                      name: "moveBy",
			                                      mergeable: true,
			                                      redo: [ this.moveObjects, objPosArr ],
			                                      undo: [ this.moveObjects, undoPosArr ]
		                                      } );
	},
	
	rotateObjects: function ( objRotArr ) {
		var containsCurvePoints = {};
		for ( var i = 0; i < objRotArr.length; i++ ) {
			var obj = objRotArr[ i ][ 0 ];
			var rot = objRotArr[ i ][ 1 ];
			if ( (obj instanceof THREE.DirectionalLight || obj instanceof THREE.SpotLight) ) {
				if ( rot instanceof THREE.Object3D ) {
					obj.target = rot;
				} else if ( rot instanceof THREE.Vector3 ) {
					if ( obj.target.parent ) {
						obj.target = new THREE.Object3D();
					}
					obj.target.position.copy( rot );
				}
			} else {
				if ( obj instanceof THREE.LinePathHandle ) {
					containsCurvePoints[ obj.parent.uuid ] = obj.isControlPoint ? obj.parent.parent : obj.parent;
				}
				obj.rotation.copy( rot );
			}
			if ( obj.helper ) {
				obj.updateMatrixWorld( true );
				obj.helper.update();
			}
			editScene.touchTemplate( obj );
		}
		// refresh curves
		for ( var pid in containsCurvePoints ) {
			containsCurvePoints[ pid ].update();
		}
	},
	
	rotateSelectionTo: function ( rot ) {
		var objRotArr = [];
		var undoRotArr = [];
		var degToRad = Math.PI / 180;
		for ( var i = 0; i < this.selectedObjects.length; i++ ) {
			var obj = this.selectedObjects[ i ];
			if ( obj.isAnchor || obj instanceof THREE.LinePathHandle ) continue;
			undoRotArr.push( [ obj, obj.rotation.clone() ] );
			objRotArr.push( [ obj,
				                new THREE.Euler( (rot.x === null ? obj.rotation.x : (rot.x * degToRad)),
				                                 (rot.y === null ? obj.rotation.y : (rot.y * degToRad)),
				                                 (rot.z === null ? obj.rotation.z : (rot.z * degToRad)) )
			                ] );
		}
		
		this.rotateObjects( objRotArr );
		if ( objRotArr.length ) this.addUndo( {
			                                      name: "rotateTo",
			                                      mergeable: true,
			                                      redo: [ this.rotateObjects, objRotArr ],
			                                      undo: [ this.rotateObjects, undoRotArr ]
		                                      } );
		return objRotArr.length;
	},
	
	rotateSelectionBy: function ( rot ) {
		var objRotArr = [];
		var undoRotArr = [];
		var degToRad = Math.PI / 180;
		
		for ( var i = 0; i < this.selectedObjects.length; i++ ) {
			var obj = this.selectedObjects[ i ];
			if ( obj.isAnchor || obj instanceof THREE.LinePathHandle ) continue;
			undoRotArr.push( [ obj, obj.rotation.clone() ] );
			objRotArr.push( [ obj,
				                new THREE.Euler( obj.rotation.x + (rot.x === null ? 0 : (rot.x * degToRad)),
				                                 obj.rotation.y + (rot.y === null ? 0 : (rot.y * degToRad)),
				                                 obj.rotation.z + (rot.z === null ? 0 : (rot.z * degToRad)) )
			                ] );
		}
		
		if ( objRotArr.length ) this.addUndo( {
			                                      name: "rotateBy",
			                                      mergeable: true,
			                                      redo: [ this.rotateObjects, objRotArr ],
			                                      undo: [ this.rotateObjects, undoRotArr ]
		                                      } );
		
		this.rotateObjects( objRotArr );
		
	},
	
	scaleObjects: function ( objScaleArr ) {
		for ( var i = 0; i < objScaleArr.length; i++ ) {
			objScaleArr[ i ][ 0 ].scale.copy( objScaleArr[ i ][ 1 ] );
			editScene.touchTemplate( objScaleArr[ i ][ 0 ] );
		}
	},
	
	scaleSelectionTo: function ( scale ) {
		var objScaleArr = [];
		var undoScaleArr = [];
		for ( var i = 0; i < this.selectedObjects.length; i++ ) {
			var obj = this.selectedObjects[ i ];
			if ( obj.isAnchor || obj instanceof THREE.LinePathHandle ) continue;
			undoScaleArr.push( [ obj, obj.scale.clone() ] );
			objScaleArr.push( [ obj,
				                  new THREE.Vector3( (scale.x === null ? obj.scale.x : scale.x),
				                                     (scale.y === null ? obj.scale.y : scale.y),
				                                     (scale.z === null ? obj.scale.z : scale.z) )
			                  ] );
		}
		
		this.scaleObjects( objScaleArr );
		if ( objScaleArr.length ) this.addUndo( {
			                                        name: "scaleTo",
			                                        mergeable: true,
			                                        redo: [ this.scaleObjects, objScaleArr ],
			                                        undo: [ this.scaleObjects, undoScaleArr ]
		                                        } );
		
		return objScaleArr.length;
	},
	
	scaleSelectionBy: function ( scale ) {
		var objScaleArr = [];
		var undoScaleArr = [];
		for ( var i = 0; i < this.selectedObjects.length; i++ ) {
			var obj = this.selectedObjects[ i ];
			if ( obj.isAnchor || obj instanceof THREE.LinePathHandle ) continue;
			undoScaleArr.push( [ obj, obj.scale.clone() ] );
			objScaleArr.push( [ obj,
				                  new THREE.Vector3( obj.scale.x + (scale.x === null ? 0 : scale.x),
				                                     obj.scale.y + (scale.y === null ? 0 : scale.y),
				                                     obj.scale.z + (scale.z === null ? 0 : scale.z) )
			                  ] );
		}
		
		if ( objScaleArr.length ) this.addUndo( {
			                                        name: "scaleBy",
			                                        mergeable: true,
			                                        redo: [ this.scaleObjects, objScaleArr ],
			                                        undo: [ this.scaleObjects, undoScaleArr ]
		                                        } );
		
		this.scaleObjects( objScaleArr );
		
	},
	
	lookAtSelection: function ( targ ) {
		if ( targ.selected ) return;
		targ.updateMatrixWorld( true );
		
		var objRotArr = [];
		var undoRotArr = [];
		var degToRad = Math.PI / 180;
		var wp = new THREE.Vector3();
		var lp = new THREE.Vector3();
		wp.setFromMatrixPosition( targ.matrixWorld );
		
		for ( var i = 0; i < this.selectedObjects.length; i++ ) {
			var obj = this.selectedObjects[ i ];
			if ( obj.isAnchor ) continue;
			if ( obj instanceof THREE.DirectionalLight || obj instanceof THREE.SpotLight ) {
				var targetable = !(targ instanceof THREE.LinePathHandle) && (obj.nearestTemplate() == targ.nearestTemplate());
				if ( targetable ) {
					undoRotArr.push( [ obj, obj.target ] );
					obj.target = targ;
					objRotArr.push( [ obj, targ ] );
				} else {
					if ( obj.target.parent ) {
						obj.target = new THREE.Object3D();
					}
					obj.target.position.copy( targ.position );
					targ.parent.localToWorld( obj.target.position );
				}
			} else {
				undoRotArr.push( [ obj, obj.rotation.clone() ] );
				obj.updateMatrixWorld( true );
				lp.copy( wp );
				obj.parent.worldToLocal( lp );
				obj.lookAt( lp );
				objRotArr.push( [ obj, obj.rotation.clone() ] );
			}
		}
		if ( !objRotArr.length ) return false;
		this.addUndo( {
			              name: "lookAt",
			              redo: [ this.rotateObjects, objRotArr ],
			              undo: [ this.rotateObjects, undoRotArr ]
		              } );
		this.refreshProps();
		return true;
	},
	
	lookAtClicked: function ( e ) {
		if ( $( e.target ).attr( 'disabled' ) ) return;
		
		if ( e.target.id == 'light-target' && e.shiftKey ) {
			if ( e.target.value.length ) {
				var anyObj = editScene.selectedObjects[ 0 ];
				editScene.deselectAll();
				if ( anyObj.target && anyObj.target.parent ) editScene.objectClicked( anyObj.target );
			}
			return;
		}
		
		e.target.blur();
		
		if ( editScene.objectPickMode ) {
			editScene.objectPickMode( undefined ); // undefined can be "cancel"
			return;
		}
		
		$( '#look-at,#light-target' ).addClass( 'active' );
		$( 'canvas,.object-label,#scene-list div.row:not(.selected),#scene-list div.row:not(.selected) > label' ).css( 'cursor', 'cell' );
		editScene.objectPickMode = function ( obj ) {
			if ( obj ) {
				editScene.lookAtSelection( obj );
			}
			$( '#look-at,#light-target' ).removeClass( 'active' );
			editScene.objectPickMode = null;
			$( 'canvas,.object-label,#scene-list div.row:not(.selected),#scene-list div.row:not(.selected) > label' ).css( 'cursor', '' );
		};
	},
	
	updateStoredPosition: function () {
		this.storedTransform = this.storedTransform ? this.storedTransform : { pos: null, rot: null, scale: null };
		if ( this.storedTransform.pos ) {
			var tt = '{' + (this.storedTransform.pos[ 0 ] != '' ? this.storedTransform.pos[ 0 ] : '*') + ','
				+ (this.storedTransform.pos[ 1 ] != '' ? this.storedTransform.pos[ 1 ] : '*') + ','
				+ (this.storedTransform.pos[ 2 ] != '' ? this.storedTransform.pos[ 2 ] : '*') + '}';
			$( '#store-pos' ).attr( 'disabled', 'disabled' ).attr( 'title', tt );
			$( '#clear-pos' ).removeAttr( 'disabled' ).attr( 'title', tt );
		} else {
			$( '#store-pos' ).removeAttr( 'disabled' ).removeAttr( 'title' );
			$( '#clear-pos' ).attr( 'disabled', 'disabled' ).removeAttr( 'title' );
		}
		if ( this.storedTransform.rot ) {
			var tt = '{' + (this.storedTransform.rot[ 0 ] != '' ? this.storedTransform.rot[ 0 ] : '*') + ','
				+ (this.storedTransform.rot[ 1 ] != '' ? this.storedTransform.rot[ 1 ] : '*') + ','
				+ (this.storedTransform.rot[ 2 ] != '' ? this.storedTransform.rot[ 2 ] : '*') + '}';
			$( '#store-rot' ).attr( 'disabled', 'disabled' ).attr( 'title', tt );
			$( '#clear-rot' ).removeAttr( 'disabled' ).attr( 'title', tt );
		} else {
			$( '#store-rot' ).removeAttr( 'disabled' ).removeAttr( 'title' );
			$( '#clear-rot' ).attr( 'disabled', 'disabled' ).removeAttr( 'title' );
		}
		if ( this.storedTransform.scale ) {
			var tt = '{' + (this.storedTransform.scale[ 0 ] != '' ? this.storedTransform.scale[ 0 ] : '*') + ','
				+ (this.storedTransform.scale[ 1 ] != '' ? this.storedTransform.scale[ 1 ] : '*') + ','
				+ (this.storedTransform.scale[ 2 ] != '' ? this.storedTransform.scale[ 2 ] : '*') + '}';
			$( '#store-scale' ).attr( 'disabled', 'disabled' ).attr( 'title', tt );
			$( '#clear-scale' ).removeAttr( 'disabled' ).attr( 'title', tt );
		} else {
			$( '#store-scale' ).removeAttr( 'disabled' ).removeAttr( 'title' );
			$( '#clear-scale' ).attr( 'disabled', 'disabled' ).removeAttr( 'title' );
		}
		
		if ( (this.storedTransform.pos || this.storedTransform.rot || this.storedTransform.scale) && !($( '#prop-x' ).attr( 'disabled' )) ) {
			$( '#restore-pos' ).removeAttr( 'disabled' );
		} else {
			$( '#restore-pos' ).attr( 'disabled', 'disabled' );
		}
		
	},
	
	restorePosition: function () {
		var v = new THREE.Vector3();
		var numAffected = 0;
		if ( this.storedTransform.pos ) {
			v.x = this.storedTransform.pos[ 0 ] === '' ? null : parseFloat( this.storedTransform.pos[ 0 ] );
			v.y = this.storedTransform.pos[ 1 ] === '' ? null : parseFloat( this.storedTransform.pos[ 1 ] );
			v.z = this.storedTransform.pos[ 2 ] === '' ? null : parseFloat( this.storedTransform.pos[ 2 ] );
			if ( this.moveSelectionTo( v ) ) numAffected++;
		}
		if ( this.storedTransform.rot ) {
			v.x = this.storedTransform.rot[ 0 ] === '' ? null : parseFloat( this.storedTransform.rot[ 0 ] );
			v.y = this.storedTransform.rot[ 1 ] === '' ? null : parseFloat( this.storedTransform.rot[ 1 ] );
			v.z = this.storedTransform.rot[ 2 ] === '' ? null : parseFloat( this.storedTransform.rot[ 2 ] );
			if ( this.rotateSelectionTo( v ) ) numAffected++;
		}
		if ( this.storedTransform.scale ) {
			v.x = this.storedTransform.scale[ 0 ] === '' ? null : parseFloat( this.storedTransform.scale[ 0 ] );
			v.y = this.storedTransform.scale[ 1 ] === '' ? null : parseFloat( this.storedTransform.scale[ 1 ] );
			v.z = this.storedTransform.scale[ 2 ] === '' ? null : parseFloat( this.storedTransform.scale[ 2 ] );
			if ( this.scaleSelectionTo( v ) ) numAffected++;
		}
		
		if ( numAffected > 1 ) {
			this.joinUndoActions( numAffected );
		}
		this.undoChanged();
		this.refreshProps();
	},
	
	storePosition: function ( e ) {
		if ( $( e.target ).attr( 'disabled' ) ) return;
		editScene.storedTransform.pos = [ $( '#prop-x' ).val(), $( '#prop-y' ).val(), $( '#prop-z' ).val() ];
		editScene.updateStoredPosition();
	},
	
	storeRotation: function ( e ) {
		if ( $( e.target ).attr( 'disabled' ) ) return;
		editScene.storedTransform.rot = [ $( '#prop-rx' ).val(), $( '#prop-ry' ).val(), $( '#prop-rz' ).val() ];
		editScene.updateStoredPosition();
	},
	
	storeScale: function ( e ) {
		if ( $( e.target ).attr( 'disabled' ) ) return;
		editScene.storedTransform.scale = [ $( '#prop-sx' ).val(), $( '#prop-sy' ).val(), $( '#prop-sz' ).val() ];
		editScene.updateStoredPosition();
	},
	
	clearStorePosition: function ( e ) {
		if ( $( e.target ).attr( 'disabled' ) ) return;
		editScene.storedTransform.pos = null;
		editScene.updateStoredPosition();
	},
	
	clearStoreRotation: function ( e ) {
		if ( $( e.target ).attr( 'disabled' ) ) return;
		editScene.storedTransform.rot = null;
		editScene.updateStoredPosition();
	},
	
	clearStoreScale: function ( e ) {
		if ( $( e.target ).attr( 'disabled' ) ) return;
		editScene.storedTransform.scale = null;
		editScene.updateStoredPosition();
	},
	
	positionSpinnerChange: function ( e ) {
		var targ = $( e.target );
		var targId = e ? targ.attr( 'id' ) : null;
		
		// check if value actually changed
		var prevVal = targ.data( 'prevVal' ).toString();
		if ( targ.val().toString() === prevVal ) return;
		
		var newPos = new THREE.Vector3();
		newPos.set( null, null, null );
		var newVal = parseFloat( targ.spinner( 'value' ) );
		if ( isNaN( newVal ) ) newVal = null;
		switch ( targId ) {
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
		
		if ( newPos.x === null && newPos.y === null && newPos.z === null ) return;
		
		if ( e.type == 'spinstop' && $( e.currentTarget ).hasClass( 'ui-spinner-button' ) && prevVal == '' ) {
			editScene.moveSelectionBy( newPos );
			targ.attr( 'placeholder', 'M' ).val( '' );
		} else {
			editScene.moveSelectionTo( newPos );
			targ.attr( 'placeholder', '' );
		}
		
		targ.data( 'prevVal', targ.val() );
	},
	
	rotationSpinnerChange: function ( e ) {
		var targ = $( e.target );
		var targId = e ? targ.attr( 'id' ) : null;
		
		// check if value actually changed
		var prevVal = targ.data( 'prevVal' ).toString();
		if ( targ.val().toString() === prevVal ) return;
		
		var newPos = new THREE.Vector3();
		newPos.set( null, null, null );
		var newVal = parseFloat( targ.spinner( 'value' ) );
		if ( isNaN( newVal ) ) newVal = null;
		switch ( targId ) {
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
		
		if ( newPos.x === null && newPos.y === null && newPos.z === null ) return;
		
		if ( e.type == 'spinstop' && $( e.currentTarget ).hasClass( 'ui-spinner-button' ) && prevVal == '' ) {
			editScene.rotateSelectionBy( newPos );
			targ.attr( 'placeholder', 'M' ).val( '' );
		} else {
			editScene.rotateSelectionTo( newPos );
			targ.attr( 'placeholder', '' );
		}
		
		targ.data( 'prevVal', targ.val() );
	},
	
	scaleSpinnerChange: function ( e ) {
		var targ = $( e.target );
		var targId = e ? targ.attr( 'id' ) : null;
		
		// check if value actually changed
		var prevVal = targ.data( 'prevVal' ).toString();
		if ( targ.val().toString() === prevVal ) return;
		
		var newPos = new THREE.Vector3();
		newPos.set( null, null, null );
		var newVal = parseFloat( targ.spinner( 'value' ) );
		if ( isNaN( newVal ) ) newVal = null;
		switch ( targId ) {
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
		
		if ( newPos.x === null && newPos.y === null && newPos.z === null ) return;
		
		if ( e.type == 'spinstop' && $( e.currentTarget ).hasClass( 'ui-spinner-button' ) && prevVal == '' ) {
			editScene.scaleSelectionBy( newPos );
			targ.attr( 'placeholder', 'M' ).val( '' );
		} else {
			editScene.scaleSelectionTo( newPos );
			targ.attr( 'placeholder', '' );
		}
		
		targ.data( 'prevVal', targ.val() );
	},
	
	visibleChanged: function ( e ) {
		var doArr = [];
		var undoArr = [];
		var newVal = $( '#prop-visible' )[ 0 ].checked;
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			if ( obj.isAnchor ) continue;
			doArr.push( [ obj, newVal ] );
			undoArr.push( [ obj, obj.visible ] );
		}
		
		if ( !doArr.length ) return;
		
		editScene.setObjectsVisible( doArr );
		editScene.addUndo( {
			                   name: 'setVisible',
			                   undo: [ editScene.setObjectsVisible, undoArr ],
			                   redo: [ editScene.setObjectsVisible, doArr ]
		                   } );
		editScene.refreshProps();
	},
	
	templateChanged: function ( e ) {
		var doArr = [];
		var undoArr = [];
		var newVal = $( '#prop-template' )[ 0 ].checked;
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			if ( obj.isAnchor ) continue;
			doArr.push( [ obj, newVal ] );
			undoArr.push( [ obj, obj.isTemplate ] );
		}
		
		if ( !doArr.length ) return;
		
		editScene.setObjectsTemplate( doArr );
		editScene.addUndo( {
			                   name: 'setTemplate',
			                   undo: [ editScene.setObjectsTemplate, undoArr ],
			                   redo: [ editScene.setObjectsTemplate, doArr ]
		                   } );
		if ( editScene.validateAllObjectNames() ) {
			editScene.mergeUndo( true );
		}
		
		editScene.refreshProps();
	},
	
	castShadowChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'castShadow';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
			if ( obj.shadowMap ) {
				// renderer.webgl.clearTarget(obj.shadowMap);
				obj.shadowMap.dispose();
				obj.shadowMap = null;
			}
		}
		editScene.addUndo( {
			                   name: "castShadow", undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
		this.updateLights = true;
	},
	
	receiveShadowChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'receiveShadow';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: "receiveShadow", undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
		this.updateLights = true;
	},
	
	transformObjectToCam: function ( e ) {
		var objPosArr = [];
		var objRotArr = [];
		var undoPosArr = [];
		var undoRotArr = [];
		var pos = this.camera.position;
		var rot = this.camera.rotation;
		for ( var i = 0; i < this.selectedObjects.length; i++ ) {
			var obj = this.selectedObjects[ i ];
			if ( obj.isAnchor ) continue;
			undoPosArr.push( [ obj, obj.position.clone() ] );
			objPosArr.push( [ obj, obj.parent.worldToLocal( pos.clone() ) ] );
			if ( obj instanceof THREE.DirectionalLight || obj instanceof THREE.SpotLight ) {
				var newTarg = new THREE.Object3D();
				newTarg.position.copy( pos );
				newTarg.rotation.copy( rot );
				newTarg.translateZ( -100 );
				undoRotArr.push( [ obj, obj.target ] );
				objRotArr.push( [ obj, newTarg ] );
			} else {
				var parentRot = new THREE.Quaternion();
				obj.parent.updateMatrixWorld( true );
				parentRot.setFromRotationMatrix( obj.parent.matrixWorld );
				var newRot = new THREE.Quaternion();
				newRot.setFromRotationMatrix( this.camera.matrixWorld );
				newRot.multiply( parentRot.inverse() );
				var r = new THREE.Euler();
				r.setFromQuaternion( newRot );
				if ( e.altKey ) {
					if ( e.shiftKey ) r.y += Math.PI * 0.5;
					else r.y -= Math.PI * 0.5;
				} else {
					if ( e.shiftKey ) r.y += Math.PI;
				}
				
				undoRotArr.push( [ obj, obj.rotation.clone() ] );
				objRotArr.push( [ obj, r ] );
				
				obj.rotation.copy( r );
			}
			this.refreshProps();
		}
		
		this.addUndo( [
			              {
				              name: "moveTo",
				              mergeable: true,
				              redo: [ this.moveObjects, objPosArr ],
				              undo: [ this.moveObjects, undoPosArr ]
			              },
			              {
				              name: "rotateTo",
				              mergeable: true,
				              redo: [ this.rotateObjects, objRotArr ],
				              undo: [ this.rotateObjects, undoRotArr ]
			              }
		              ] );
		
		this.moveObjects( objPosArr );
		this.rotateObjects( objRotArr );
	},
	
	transformCamToObject: function ( e ) {
		var obj = this.selectedObjects[ 0 ];
		var wp = new THREE.Vector3();
		if ( obj instanceof THREE.DirectionalLight || obj instanceof THREE.SpotLight ) {
			this.camera.position.copy( obj.position );
			obj.parent.localToWorld( this.camera.position );
			this.camera.updateMatrixWorld( true );
			obj.target.updateMatrixWorld( true );
			wp.setFromMatrixPosition( obj.target.matrixWorld );
			this.controls.center.copy( wp );
			this.camera.lookAt( wp );
		} else {
			obj.updateMatrixWorld( true );
			this.camera.position.setFromMatrixPosition( obj.matrixWorld );
			if ( e.altKey ) {
				wp.set( e.shiftKey ? 100 : -100, 0, 0 );
			} else {
				wp.set( 0, 0, e.shiftKey ? 100 : -100 );
			}
			obj.localToWorld( wp );
			this.camera.lookAt( wp );
			this.controls.center.copy( wp );
		}
	},
	
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Templates */
	
	refreshTemplates: function ( renameInstances ) {
		// refresh doc's templates
		this.doc.templates = {};
		this.doc.serializedTemplates = {};
		this.container.traverse( function ( obj ) {
			if ( obj.isTemplate ) {
				editScene.doc.templates[ obj.name ] = obj;
				editScene.doc.serializedTemplates[ obj.name ] = obj.serialize( editScene.doc.templates );
			} else if ( obj.isInstance && renameInstances ) {
				if ( renameInstances[ obj.def.template ] ) {
					obj.def.template = renameInstances[ obj.def.template ];
				}
			}
			
		} );
	},
	
	rebuildInstances: function () {
		var replacements = {};
		var numRebuilt = 0;
		// check if any templates are dirty first
		for ( var t in this.doc.templates ) {
			if ( this.doc.templates[ t ].dirty ) {
				numRebuilt++;
				this.doc.serializedTemplates[ t ] = this.doc.templates[ t ].serialize( this.doc.templates );
			}
		}
		if ( !numRebuilt ) return;
		numRebuilt = 0;
		this.container.traverse( function ( obj ) {
			if ( obj.isInstance && editScene.doc.templates[ obj.def.template ].dirty ) {
				replacements[ obj.uuid ] = obj;
				numRebuilt++;
			}
		} );
		if ( numRebuilt ) {
			var opts = {
				helpers: false,
				keepSceneCamera: true,
				noNameReferences: true,
				wrapTemplates: false,
				templates: this.doc.serializedTemplates,
				skipProps: true,
				noStaticGroups: true,
				initObject: this.populateObjectCallback
			};
			for ( var uuid in replacements ) {
				var obj = replacements[ uuid ];
				var def = obj.serialize( null );
				obj.recursiveRemoveChildren();
				this.populateObject( obj, [ def ], opts );
				var newObj = obj.children[ 0 ];
				newObj.position.set( 0, 0, 0 );
				newObj.rotation.set( 0, 0, 0 );
				newObj.scale.set( 1, 1, 1 );
				newObj.visible = true;
				//console.log('rebuilt '+obj.def.template+' from ',this.doc.serializedTemplates[obj.def.template]);
			}
			this.refreshScene();
		}
		
		// clear flag		
		for ( var t in this.doc.templates ) {
			this.doc.templates[ t ].dirty = false;
		}
	},
	
	touchTemplate: function ( obj ) {
		if ( !(obj instanceof THREE.Object3D) ) return;
		var template = obj.nearestTemplate();
		while ( template ) {
			template.dirty = true;
			template = template.parent ? template.parent.nearestTemplate() : null;
		}
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Camera panel */
	
	
	setObjectProperty: function ( arr, prop ) {
		for ( var i = 0; i < arr.length; i++ ) {
			var obj = arr[ i ][ 0 ];
			var val = arr[ i ][ 1 ];
			if ( obj[ prop ] instanceof THREE.Color ) {
				obj[ prop ].setHex( val );
			} else {
				obj[ prop ] = val;
			}
			if ( obj instanceof THREE.Camera ) {
				obj.updateProjectionMatrix();
			}
			if ( obj.helper ) obj.helper.update();
			editScene.touchTemplate( obj );
		}
		editScene.refreshProps();
	},
	
	cameraFovChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'fov';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: "cameraFOV", mergeable: true, undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	cameraZoomChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'zoom';
		val *= 0.01;
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: "cameraZoom",
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	cameraNearChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'near';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: "cameraNear",
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	cameraFarChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'far';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: "cameraFar", mergeable: true, undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
		
	},
	
	setCameraDefault: function ( cam, val ) {
		this.container.traverse( function ( obj ) {
			if ( obj instanceof THREE.Camera ) {
				if ( obj == cam ) {
					obj.isDefault = val;
				} else if ( val ) {
					obj.isDefault = false;
				}
			}
		} );
		editScene.doc.defaultCamera = val ? cam : null;
		editScene.refreshScene();
	},
	cameraDefaultChanged: function ( val ) {
		if ( editScene.selectedObjects.length != 1 ) return;
		var cam = editScene.selectedObjects[ 0 ];
		if ( editScene.doc.defaultCamera && editScene.doc.defaultCamera != cam ) {
			editScene.addUndo( [
				                   {
					                   name: "cameraDefault",
					                   undo: [ editScene.setCameraDefault, editScene.doc.defaultCamera, true ],
					                   redo: [ editScene.setCameraDefault, editScene.doc.defaultCamera, false ]
				                   },
				                   {
					                   name: "cameraDefault",
					                   undo: [ editScene.setCameraDefault, cam, !!cam.isDefault ],
					                   redo: [ editScene.setCameraDefault, cam, val ]
				                   } ] );
			
		} else {
			editScene.addUndo( {
				                   name: "cameraDefault", undo: [ editScene.setCameraDefault, cam, !!cam.isDefault ],
				                   redo: [ editScene.setCameraDefault, cam, val ]
			                   } );
		}
		editScene.setCameraDefault( cam, val );
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Light panel */
	
	lightAngleChanged: function ( origVal ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'angle';
		var val = Math.PI * origVal / 180;
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
			if ( obj.shadowCamera ) {
				obj.shadowCameraFov = origVal * 2;
				if ( obj.shadowCamera.parent ) {
					obj.shadowCamera.parent.remove( obj.shadowCamera );
				}
				obj.shadowCamera = null;
			}
		}
		editScene.addUndo( {
			                   name: "lightAngle",
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	lightIntensityChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'intensity';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: "lightIntensity",
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	lightDistanceChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'distance';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: "lightDistance",
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	lightExponentChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'exponent';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: "lightExponent",
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	setGroundLightColor: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'groundColor';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.storedColor ] );
			obj.storedColor = val;
		}
		editScene.addUndo( {
			                   name: "lightGroundColor", undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	setLightColor: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'color';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.storedColor ] );
			obj.storedColor = val;
		}
		editScene.addUndo( {
			                   name: "lightColor", undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	lightShadowBiasChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'shadowBias';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.shadowBias ] );
		}
		editScene.addUndo( {
			                   name: "shadowBias",
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	lightShadowNearChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'shadowCameraNear';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.shadowCameraNear ] );
			if ( obj.shadowCamera ) {
				if ( obj.shadowCamera.parent ) {
					obj.shadowCamera.parent.remove( obj.shadowCamera );
				}
				obj.shadowCamera = null;
			}
		}
		editScene.addUndo( {
			                   name: "shadowCameraNear",
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	lightShadowFarChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'shadowCameraFar';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.shadowCameraFar ] );
			if ( obj.shadowCamera ) {
				if ( obj.shadowCamera.parent ) {
					obj.shadowCamera.parent.remove( obj.shadowCamera );
				}
				obj.shadowCamera = null;
			}
		}
		editScene.addUndo( {
			                   name: "shadowCameraFar",
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	lightShadowVolWidthChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'shadowCameraRight';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.shadowCameraRight * 2 ] );
			if ( obj.shadowCamera ) {
				if ( obj.shadowCamera.parent ) {
					obj.shadowCamera.parent.remove( obj.shadowCamera );
				}
				obj.shadowCamera = null;
				obj.shadowCameraLeft = -val * 0.5;
			}
		}
		editScene.addUndo( {
			                   name: "shadowCameraRight",
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	lightShadowVolHeightChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'shadowCameraTop';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.shadowCameraTop * 2 ] );
			if ( obj.shadowCamera ) {
				if ( obj.shadowCamera.parent ) {
					obj.shadowCamera.parent.remove( obj.shadowCamera );
				}
				obj.shadowCamera = null;
				obj.shadowCameraBottom = -val * 0.5;
			}
		}
		editScene.addUndo( {
			                   name: "shadowCameraTop",
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	lightShadowMapWidthChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'shadowMapWidth';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.shadowMapWidth ] );
			if ( obj.shadowMap ) {
				obj.shadowMap.dispose();
				obj.shadowMap = null;
			}
		}
		editScene.addUndo( {
			                   name: "shadowMapWidth",
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	lightShadowMapHeightChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'shadowMapHeight';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.shadowMapHeight ] );
			if ( obj.shadowMap ) {
				obj.shadowMap.dispose();
				obj.shadowMap = null;
			}
		}
		editScene.addUndo( {
			                   name: "shadowMapHeight",
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- PixelBox panel */
	
	setAnimProperty: function ( arr, prop ) {
		for ( var i = 0; i < arr.length; i++ ) {
			var obj = arr[ i ][ 0 ];
			var val = arr[ i ][ 1 ];
			if ( prop == 'animSpeed' ) {
				obj[ prop ] = val;
			} else {
				obj.def[ prop ] = val;
			}
			this.pixelboxApplyAnimationParams( obj );
			this.touchTemplate( obj );
		}
	},
	
	restartAllAnims: function () {
		editScene.container.traverseVisible( function ( obj ) {
			if ( obj.pixelBox || obj instanceof THREE.FxSprite ) {
				obj.stopAnim();
				obj.frame = 0;
				editScene.pixelboxApplyAnimationParams( obj );
			}
		} );
	},
	
	pixelboxApplyAnimationParams: function ( obj3d ) {
		var layer = obj3d.def;
		if ( layer.animName != undefined && obj3d.animNamed( layer.animName ) != undefined ) {
			var animOption = layer.animOption ? layer.animOption : 'gotoAndStop';
			var animFrame = layer.animFrame != undefined ? layer.animFrame : 0;
			
			if ( animOption == 'loopAnim' ) {
				obj3d.loopAnim( layer.animName, Infinity, false );
			} else if ( animOption == 'loopFrom' ) {
				obj3d.gotoAndStop( layer.animName, animFrame + 1 );
				obj3d.loopAnim( layer.animName, Infinity, true );
			} else if ( animOption == 'playAnim' ) {
				obj3d.playAnim( layer.animName );
			} else {
				obj3d.gotoAndStop( layer.animName, animFrame );
			}
		} else {
			obj3d.stopAnim();
			obj3d.frame = layer.animFrame != undefined ? layer.animFrame : 0;
		}
	},
	
	pixelboxPointSizeChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'pointSize';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: prop, mergeable: true, undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	pixelboxStippleChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'stipple';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: 'pixelBoxStipple',
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	pixelboxAlphaChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'alpha';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: 'pixelBoxAlpha',
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	pixelboxOcclusionChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'occlusion';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: prop, mergeable: true, undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	pixelboxCullBackChanged: function ( e ) {
		var val = $( '#pixelbox-cullBack' )[ 0 ].checked;
		var doArr = [];
		var undoArr = [];
		var prop = 'cullBack';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: prop, mergeable: true, undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	pixelboxGroupChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'staticGroup';
		val = val.replace( /\W+/g, '_' ); // replace non-word chars with _
		if ( val.match( /^\d+/ ) ) { // prepend _ if starts with a digit
			val = '_' + val;
		}
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: prop, mergeable: true, undo: [ editScene.setAnimProperty, undoArr, prop ],
			                   redo: [ editScene.setAnimProperty, doArr, prop ]
		                   } );
		editScene.setAnimProperty( doArr, prop );
	},
	
	pixelboxAnimSpeedChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'animSpeed';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: prop, mergeable: true, undo: [ editScene.setAnimProperty, undoArr, prop ],
			                   redo: [ editScene.setAnimProperty, doArr, prop ]
		                   } );
		editScene.setAnimProperty( doArr, prop );
		editScene.refreshProps();
	},
	
	pixelboxAnimTypeChanged: function ( e ) {
		var val = e.target.value; //$( '#panel-pixelbox input[name=pixelbox-animOption]:checked' ).val();
		var doArr = [];
		var undoArr = [];
		var prop = 'animOption';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: prop, mergeable: true, undo: [ editScene.setAnimProperty, undoArr, prop ],
			                   redo: [ editScene.setAnimProperty, doArr, prop ]
		                   } );
		editScene.setAnimProperty( doArr, prop );
		editScene.refreshProps();
	},
	
	pixelboxStartFrameChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'animFrame';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: prop, mergeable: true, undo: [ editScene.setAnimProperty, undoArr, prop ],
			                   redo: [ editScene.setAnimProperty, doArr, prop ]
		                   } );
		editScene.setAnimProperty( doArr, prop );
		editScene.refreshProps();
	},
	
	pixelboxAnimNameChanged: function ( e ) {
		var val = e.target.value; //$( '#pixelbox-animName' )[ 0 ].value;
		var doArr = [];
		var undoArr = [];
		var prop = 'animName';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: prop, mergeable: true, undo: [ editScene.setAnimProperty, undoArr, prop ],
			                   redo: [ editScene.setAnimProperty, doArr, prop ]
		                   } );
		editScene.setAnimProperty( doArr, prop );
		editScene.refreshProps();
	},

	fxSpriteDataChanged: function ( e ) {
		var val = e.target.value;
		var doArr = [];
		var undoArr = [];
		var prop = 'fxData';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: prop, mergeable: true, undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
		editScene.refreshProps();
	},
	
	pixelboxSetTint: function ( val ) {//int
		var doArr = [];
		var undoArr = [];
		var prop = 'tint';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.storedColor ] );
			obj.storedColor = val;
		}
		editScene.addUndo( {
			                   name: "tint", undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	pixelboxSetAddColor: function ( val ) {//int
		var doArr = [];
		var undoArr = [];
		var prop = 'addColor';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.storedColor ] );
			obj.storedColor = val;
		}
		editScene.addUndo( {
			                   name: "addColor", undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Geometry panel */
	
	setMaterialProperty: function ( arr, prop ) {
		for ( var i = 0; i < arr.length; i++ ) {
			var obj = arr[ i ][ 0 ];
			var val = arr[ i ][ 1 ];
			if ( obj.material[ prop ] instanceof THREE.Color ) {
				obj.material[ prop ].set( val );
			} else {
				obj.material[ prop ] = val;
			}
			editScene.touchTemplate( obj );
		}
	},

	setGeometryType: function ( arr ) {
		for ( var i = 0; i < arr.length; i++ ) {
			var obj = arr[ i ][ 0 ];
			var val = arr[ i ][ 1 ];

			var p = obj.parent;
			p.remove( obj );

			obj.def.mesh = val;
			var geom = this.makeGeometryObject( obj.def, !!(obj.collisionShape || obj.constraint) );
			obj.geometry.dispose();
			obj.geometry = geom;
			obj.geometryType = val;

			obj.material.side = (obj.geometryType == 'Plane') ? THREE.DoubleSide : (obj.def.inverted ? THREE.BackSide : THREE.FrontSide);

			p.add( obj );

			this.touchTemplate( obj );
		}
	},

	setGeometryTexture: function ( arr ) {
		for ( var i = 0; i < arr.length; i++ ) {
			var obj = arr[ i ][ 0 ];
			var val = arr[ i ][ 1 ];

			obj.textureMap = val;

			this.touchTemplate( obj );
		}
	},
	
	geometryStippleChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'stipple';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: 'geometryStipple',
			                   mergeable: true,
			                   undo: [ editScene.setMaterialProperty, undoArr, prop ],
			                   redo: [ editScene.setMaterialProperty, doArr, prop ]
		                   } );
		editScene.setMaterialProperty( doArr, prop );
		editScene.refreshProps();
	},
	
	geometryAlphaChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'alpha';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: 'geometryAlpha',
			                   mergeable: true,
			                   undo: [ editScene.setMaterialProperty, undoArr, prop ],
			                   redo: [ editScene.setMaterialProperty, doArr, prop ]
		                   } );
		editScene.setMaterialProperty( doArr, prop );
		editScene.refreshProps();
	},

	geometryAlphaThreshChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'alphaThresh';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: 'geometryAlphaThresh',
			                   mergeable: true,
			                   undo: [ editScene.setMaterialProperty, undoArr, prop ],
			                   redo: [ editScene.setMaterialProperty, doArr, prop ]
		                   } );
		editScene.setMaterialProperty( doArr, prop );
		editScene.refreshProps();
	},

	fxspriteAlphaChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'alpha';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: 'spriteAlpha',
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
		editScene.refreshProps();
	},

	fxspriteAlphaThreshChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'alphaThresh';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: 'alphaThresh',
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
		editScene.refreshProps();
	},
	
	geometryBrightnessChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'brightness';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: 'brightness',
			                   mergeable: true,
			                   undo: [ editScene.setMaterialProperty, undoArr, prop ],
			                   redo: [ editScene.setMaterialProperty, doArr, prop ]
		                   } );
		editScene.setMaterialProperty( doArr, prop );
		editScene.refreshProps();
	},

	fxspriteBrightnessChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'brightness';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: 'brightness',
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
		editScene.refreshProps();
	},

	fxspriteScaleXChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'scaleX';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: prop,
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
		editScene.refreshProps();
	},

	fxspriteScaleYChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'scaleY';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: prop,
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
		editScene.refreshProps();
	},

	fxspriteAngleChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'angle';
		var degToRad = Math.PI / 180;
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val * degToRad ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: prop,
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
		editScene.refreshProps();
	},

	setGeometryTint: function ( val ) {//int
		var doArr = [];
		var undoArr = [];
		var prop = 'tint';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.storedColor ] );
			obj.storedColor = val;
		}
		editScene.addUndo( {
			                   name: "tint", undo: [ editScene.setMaterialProperty, undoArr, prop ],
			                   redo: [ editScene.setMaterialProperty, doArr, prop ]
		                   } );
		editScene.setMaterialProperty( doArr, prop );
		editScene.refreshProps();
	},

	setFxSpriteTint: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'tint';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.storedColor ] );
			obj.storedColor = val;
		}
		editScene.addUndo( {
			                   name: "tint", undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
		editScene.refreshProps();
	},
	
	setGeometryAddColor: function ( val ) {//int
		var doArr = [];
		var undoArr = [];
		var prop = 'addColor';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.storedColor ] );
			obj.storedColor = val;
		}
		editScene.addUndo( {
			                   name: "addColor", undo: [ editScene.setMaterialProperty, undoArr, prop ],
			                   redo: [ editScene.setMaterialProperty, doArr, prop ]
		                   } );
		editScene.setMaterialProperty( doArr, prop );
		editScene.refreshProps();
	},

	setFxSpriteAddColor: function ( val ) {//int
		var doArr = [];
		var undoArr = [];
		var prop = 'addColor';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.storedColor ] );
			obj.storedColor = val;
		}
		editScene.addUndo( {
			                   name: "addColor", undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
		editScene.refreshProps();
	},

	geometryTextureChanged: function ( e ) {
		var val = e.target.value; // $( '#geometry-texture' ).val();
		if ( val === '0' ) return;

		var doArr = [];
		var undoArr = [];
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.textureMap ] );
		}
		editScene.addUndo( {
			                   name: "textureMap", undo: [ editScene.setGeometryTexture, undoArr ],
			                   redo: [ editScene.setGeometryTexture, doArr ]
		                   } );
		editScene.setGeometryTexture( doArr );
		editScene.refreshProps();
	},

	geometrySliceChanged: function ( e ) {
		var val = $( '#geometry-texture-slice' ).val();
		if ( val === '0' ) return;

		var doArr = [];
		var undoArr = [];
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.sliceName ] );
		}
		editScene.addUndo( {
			                   name: 'sliceName', undo: [ editScene.setObjectProperty, undoArr, 'sliceName' ],
			                   redo: [ editScene.setObjectProperty, doArr, 'sliceName' ]
		                   } );
		editScene.setObjectProperty( doArr, 'sliceName' );
		editScene.refreshProps();
	},

	geometryTypeChanged: function ( e ) {
		var val = $( '#geometry-type' ).val();
		if ( val === '0' ) return;
		
		var doArr = [];
		var undoArr = [];
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.geometryType ] );
		}
		editScene.addUndo( {
			                   name: "geometryType", undo: [ editScene.setGeometryType, undoArr ],
			                   redo: [ editScene.setGeometryType, doArr ]
		                   } );
		editScene.setGeometryType( doArr );
		editScene.refreshProps();
	},
	
	geometryInvertChanged: function ( e ) {
		var val = $( '#geometry-invert' )[ 0 ].checked;
		var prop = 'inverted';
		var doArr = [];
		var undoArr = [];
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, !!obj.inverted ] );
		}
		editScene.addUndo( {
			                   name: "geometryInverted", undo: [ editScene.setGeometryProperty, undoArr, prop ],
			                   redo: [ editScene.setGeometryProperty, doArr, prop ]
		                   } );
		editScene.setGeometryProperty( doArr, prop );
		editScene.refreshProps();
	},
	
	setGeometryProperty: function ( arr, prop ) {
		for ( var i = 0; i < arr.length; i++ ) {
			var obj = arr[ i ][ 0 ];
			var val = arr[ i ][ 1 ];
			
			obj.def[ prop ] = val;
			
			var p = obj.parent;
			p.remove( obj );
			
			var geom = this.makeGeometryObject( obj.def );
			obj.geometry.dispose();
			obj.geometry = geom;
			
			obj.material.side = (obj.geometryType == 'Plane') ? THREE.DoubleSide : (obj.def.inverted ? THREE.BackSide : THREE.FrontSide);

			p.add( obj );
			
			this.touchTemplate( obj );
		}
	},
	
	geometryPropChanged: function ( val, e ) {
		var targ = $( e.target );
		var prop = targ.attr( 'alt' );
		
		var doArr = [];
		var undoArr = [];
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.def[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: prop, mergeable: true, undo: [ editScene.setGeometryProperty, undoArr, prop ],
			                   redo: [ editScene.setGeometryProperty, doArr, prop ]
		                   } );
		editScene.setGeometryProperty( doArr, prop );
		editScene.refreshProps();
	},
	
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Custom props panel */
	
	renameProperty: function ( arr ) {
		for ( var i = 0; i < arr.length; i++ ) {
			var prop = arr[ i ][ 0 ];
			var name = arr[ i ][ 1 ];
			prop.name = name;
		}
	},
	
	addProperty: function ( arr ) {
		for ( var i = 0; i < arr.length; i++ ) {
			var obj = arr[ i ][ 0 ];
			var val = arr[ i ][ 1 ];
			if ( obj.props === undefined ) {
				obj.props = [];
			}
			obj.props.push( val );
			editScene.touchTemplate( obj );
		}
	},
	
	removeProperty: function ( arr ) {
		for ( var i = 0; i < arr.length; i++ ) {
			var obj = arr[ i ][ 0 ];
			var val = arr[ i ][ 1 ];
			var index = obj.props.indexOf( val );
			if ( index >= 0 ) obj.props.splice( index, 1 );
			editScene.touchTemplate( obj );
		}
	},
	
	addPropertyToSelection: function ( e ) {
		var doArr = [];
		var undoArr = [];
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			if ( obj.isAnchor ) continue;
			var newProp = { name: "propertyName", type: "JSON", value: "value" };
			doArr.push( [ obj, newProp ] );
			undoArr.push( [ obj, newProp ] );
		}
		editScene.addUndo( {
			                   name: "addProperty", undo: [ editScene.removeProperty, undoArr ],
			                   redo: [ editScene.addProperty, doArr ]
		                   } );
		editScene.addProperty( doArr );
		
		doArr = [];
		undoArr = [];
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			if ( obj.isAnchor ) continue;
			editScene.validateRenameObjectNames( obj.props, doArr, undoArr );
		}
		
		// validate props names
		if ( doArr.length ) {
			editScene.addUndo( {
				                   name: "renameProperty", undo: [ editScene.renameProperty, undoArr ],
				                   redo: [ editScene.renameProperty, doArr ]
			                   } );
			editScene.mergeUndo( true );
			editScene.renameProperty( doArr );
		}
		
		editScene.refreshProps();
	},
	
	propertyDeleteClicked: function ( e ) {
		var propRow = $( e.target ).closest( '.prop-row' );
		var propName = propRow.attr( 'alt' );
		var doArr = [];
		var undoArr = [];
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			if ( obj.isAnchor ) continue;
			var prop = obj.propByName( propName );
			doArr.push( [ obj, prop ] );
			undoArr.push( [ obj, prop ] );
		}
		editScene.addUndo( {
			                   name: "deleteProperty", redo: [ editScene.removeProperty, doArr ],
			                   undo: [ editScene.addProperty, undoArr ]
		                   } );
		editScene.removeProperty( doArr );
		editScene.refreshProps();
	},
	
	setPropertyProp: function ( arr, prop ) {
		for ( var i = 0; i < arr.length; i++ ) {
			var obj = arr[ i ][ 0 ];
			var val = arr[ i ][ 1 ];
			obj[ prop ] = val;
		}
	},
	
	replacePropertyProp: function ( arr ) {
		for ( var i = 0; i < arr.length; i++ ) {
			var obj = arr[ i ][ 0 ];
			var prop = arr[ i ][ 1 ];
			for ( var pi = 0; pi < obj.props.length; pi++ ) {
				if ( obj.props[ pi ].name == prop.name ) {
					obj.props[ pi ] = prop;
					break;
				}
			}
		}
		editScene.refreshProps();
	},
	
	propertyValueChanged: function ( e ) {
		var propRow = $( e.target ).closest( '.prop-row' );
		var propName = propRow.attr( 'alt' );
		var newVal = $( e.target ).val();
		
		var doArr = [];
		var undoArr = [];
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			if ( obj.isAnchor ) continue;
			var prop = obj.propByName( propName );
			doArr.push( [ prop, newVal ] );
			undoArr.push( [ prop, prop.value ] );
		}
		editScene.addUndo( {
			                   name: "propertyValue", redo: [ editScene.setPropertyProp, doArr, 'value' ],
			                   undo: [ editScene.setPropertyProp, undoArr, 'value' ]
		                   } );
		editScene.setPropertyProp( doArr, 'value' );
	},
	
	propertyTypeChanged: function ( e ) {
		var propRow = $( e.target ).closest( '.prop-row' );
		var propName = propRow.attr( 'alt' );
		var newVal = $( e.target ).val();
		
		var doArr = [];
		var undoArr = [];
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			if ( obj.isAnchor ) continue;
			var prop = obj.propByName( propName );
			var newProp = { name: prop.name, type: newVal, value: (newVal == 'Object3D' ? null : '') };
			doArr.push( [ obj, newProp ] );
			undoArr.push( [ obj, prop ] );
		}
		editScene.addUndo( {
			                   name: "propertyType", redo: [ editScene.replacePropertyProp, doArr ],
			                   undo: [ editScene.replacePropertyProp, undoArr ]
		                   } );
		editScene.replacePropertyProp( doArr );
	},
	
	propertyNameChanged: function ( e ) {
		var propRow = $( e.target ).closest( '.prop-row' );
		var propName = propRow.attr( 'alt' );
		var newVal = $( e.target ).val();
		
		var doArr = [];
		var undoArr = [];
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			if ( obj.isAnchor ) continue;
			var prop = obj.propByName( propName );
			doArr.push( [ prop, newVal ] );
			undoArr.push( [ prop, prop.name ] );
		}
		editScene.addUndo( {
			                   name: "propertyName", redo: [ editScene.setPropertyProp, doArr, 'name' ],
			                   undo: [ editScene.setPropertyProp, undoArr, 'name' ]
		                   } );
		editScene.setPropertyProp( doArr, 'name' );
		
		// check names
		doArr = [];
		undoArr = [];
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			if ( obj.isAnchor ) continue;
			editScene.validateRenameObjectNames( obj.props, doArr, undoArr );
		}
		
		// validate props names
		if ( doArr.length ) {
			editScene.addUndo( {
				                   name: "renameProperty", undo: [ editScene.renameProperty, undoArr ],
				                   redo: [ editScene.renameProperty, doArr ]
			                   } );
			editScene.mergeUndo( true );
			editScene.renameProperty( doArr );
		}
		
		editScene.refreshProps();
	},
	
	pickPropertyObjectClicked: function ( e ) {
		if ( $( e.target ).attr( 'disabled' ) ) return;
		
		var propRow = $( e.target ).closest( '.prop-row' );
		var propName = propRow.attr( 'alt' );
		var type = $( 'select', propRow ).val();
		
		if ( type == 'Object3D' ) {
			
			if ( e.shiftKey && e.target.value.length ) {
				var anyObj = editScene.selectedObjects[ 0 ];
				var prop = anyObj.propByName( propName );
				if ( prop.value ) {
					editScene.deselectAll();
					editScene.objectClicked( prop.value );
				}
				return;
			}
			
			e.target.blur();
			if ( editScene.objectPickMode ) {
				editScene.objectPickMode( undefined ); // undefined
				return;
			}
			$( e.target ).addClass( 'active' );
			$( 'canvas,.object-label,#scene-list div.row:not(.selected),#scene-list div.row:not(.selected) > label' ).css( 'cursor', 'cell' );
			editScene.objectPickMode = function ( picked ) {
				if ( picked !== undefined && !(picked instanceof THREE.LinePathHandle) ) {
					var doArr = [];
					var undoArr = [];
					var pickedTemplate = picked ? picked.nearestTemplate() : null;
					for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
						var obj = editScene.selectedObjects[ i ];
						if ( obj.isAnchor ) continue;
						var targetable = (obj.nearestTemplate() == pickedTemplate);
						if ( !targetable ) continue;
						var prop = obj.propByName( propName );
						doArr.push( [ prop, picked ] );
						undoArr.push( [ prop, prop.value ] );
					}
					editScene.addUndo( {
						                   name: "propertyValue", redo: [ editScene.setPropertyProp, doArr, 'value' ],
						                   undo: [ editScene.setPropertyProp, undoArr, 'value' ]
					                   } );
					editScene.setPropertyProp( doArr, 'value' );
					editScene.refreshProps();
				}
				$( '#panel-custom input' ).removeClass( 'active' );
				editScene.objectPickMode = null;
				$( 'canvas,.object-label,#scene-list div.row:not(.selected),#scene-list div.row:not(.selected) > label' ).css( 'cursor', '' );
			};
			
		}
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- LinePath curves */
	
	_createHandle: function ( positionInPath, isControlPoint, name ) { // isControlPoint is point's "parent" or null
		var handle = new THREE.LinePathHandle( isControlPoint ? 0xFFFF00 : 0xFF3300 );
		handle.isControlPoint = !!isControlPoint;
		handle.position.copy( positionInPath );
		if ( isControlPoint ) {
			isControlPoint.add( handle );
			handle.position.sub( isControlPoint.position );
		}
		handle.name = name;
		handle.selected = false;
		THREE.PixelBoxUtil.updateViewPortUniform( this.camera );
		return handle;
	},
	
	addPoint: function ( linePath, handle, index ) {
		// renumber existing children
		for ( var i = 0, nc = linePath.children.length; i < nc; i++ ) {
			var h = linePath.children[ i ];
			if ( h.curveIndex >= index ) {
				h.curveIndex++;
				h.preHandle.curveIndex++;
				h.postHandle.curveIndex++;
			}
		}
		// set index
		if ( i == 0 ) {
			handle.curveIndex = 0;
			handle.pointIndex = 0;
			handle.preHandle.curveIndex = -1;
			handle.postHandle.curveIndex = 0;
		} else {
			handle.curveIndex = index;
			handle.pointIndex = 0;
			handle.preHandle.curveIndex = index - 1;
			handle.postHandle.curveIndex = index;
		}
		
		// add handle
		linePath.add( handle );
		
		// rename
		this.updatePointNames( linePath );
		
		// rebuild
		linePath.rebuild( true );
		
		this.refreshScene();
	},
	
	updatePointNames: function ( linePath ) {
		// rename
		for ( var i = 0, nc = linePath.children.length; i < nc; i++ ) {
			var h = linePath.children[ i ];
			h.name = 'P' + (h.curveIndex);
			if ( h.htmlLabel ) h.htmlLabel.text( h.name );
			if ( h.htmlRow ) h.htmlRow.find( 'label:first' ).text( h.name );
			
			h.preHandle.name = 'CP_' + h.preHandle.curveIndex + '_' + h.preHandle.pointIndex;
			if ( h.preHandle.htmlLabel ) h.preHandle.htmlLabel.text( h.preHandle.name );
			if ( h.preHandle.htmlRow ) h.preHandle.htmlRow.find( 'label:first' ).text( h.preHandle.name );
			
			h.postHandle.name = 'CP_' + h.postHandle.curveIndex + '_' + h.postHandle.pointIndex;
			if ( h.postHandle.htmlLabel ) h.postHandle.htmlLabel.text( h.postHandle.name );
			if ( h.postHandle.htmlRow ) h.postHandle.htmlRow.find( 'label:first' ).text( h.postHandle.name );
		}
	},
	
	deletePoint: function ( linePath, handle, index ) {
		// renumber existing children
		for ( var i = 0, nc = linePath.children.length; i < nc; i++ ) {
			var h = linePath.children[ i ];
			if ( h.curveIndex > index ) {
				h.curveIndex--;
				h.preHandle.curveIndex--;
				h.postHandle.curveIndex--;
			}
		}
		
		// remove handle
		linePath.remove( handle );
		if ( handle.htmlLabel ) {
			handle.htmlLabel.remove();
			handle.htmlLabel = null;
		}
		if ( handle.preHandle.htmlLabel ) {
			handle.preHandle.htmlLabel.remove();
			handle.preHandle.htmlLabel = null;
		}
		if ( handle.postHandle.htmlLabel ) {
			handle.postHandle.htmlLabel.remove();
			handle.postHandle.htmlLabel = null;
		}
		// rename
		this.updatePointNames( linePath );
		
		// rebuild
		linePath.rebuild( true );
		
		this.refreshScene();
	},
	
	splitCurve: function ( lp, index, t ) {
		// untransform prev and next points
		/*function untransform(h){
		 var mx = h.matrix.clone();
		 var preHandleWorldPos = h.localToWorld(h.preHandle.position.clone());
		 var preHandleMx = h.preHandle.matrix.clone();
		 var postHandleWorldPos = h.localToWorld(h.postHandle.position.clone());
		 var postHandleMx = h.postHandle.matrix.clone();
		 h.rotation.set(0,0,0);
		 h.scale.set(1,1,1);
		 h.updateMatrix();
		 h.preHandle.position.copy(preHandleWorldPos);
		 h.worldToLocal(h.preHandle.position);
		 h.postHandle.position.copy(postHandleWorldPos);
		 h.worldToLocal(h.postHandle.position);
		 h.preHandle.updateMatrix();
		 h.postHandle.updateMatrix();
		 editScene.addUndo({ name: 'transformObject', 
		 undo:[ editScene.transformObjects, [ [h, mx], [h.preHandle, preHandleMx], [h.postHandle, postHandleMx ] ] ],
		 redo:[ editScene.transformObjects, [ [h, h.matrix.clone()], [h.preHandle, h.preHandle.matrix.clone()], [h.postHandle, h.postHandle.matrix.clone() ] ] ]
		 });
		
		 editScene.joinUndoActions(2);
		 }
		
		 untransform(prevPoint);
		 untransform(nextPoint);*/
		
		// split
		var curve = lp.path.curves[ index ];
		var splitPos = curve.getPoint( t );
		
		var p0 = curve.v0.clone(), p1 = curve.v1.clone(), p2 = curve.v2.clone(), p3 = curve.v3.clone();
		var p4 = p0.clone().lerp( p1, t );
		var p5 = p1.clone().lerp( p2, t );
		var p6 = p2.clone().lerp( p3, t );
		var p7 = p4.clone().lerp( p5, t );
		var p8 = p5.clone().lerp( p6, t );
		var p9 = p7.clone().lerp( p8, t );
		
		var firsthalf = [ p0, p4, p7, p9 ];
		var secondhalf = [ p9, p8, p6, p3 ];
		
		// add point
		handle = this._createHandle( p9, false, 'P' );
		handle.lockTangents = true;
		var cpHandle = this._createHandle( p7, handle, 'CP' );
		cpHandle.pointIndex = 2;
		handle.preHandle = cpHandle;
		var cpHandle = this._createHandle( p8, handle, 'CP' );
		cpHandle.pointIndex = 1;
		handle.postHandle = cpHandle;
		
		this.addUndo( {
			              name: 'addPoint',
			              undo: [ this.deletePoint, lp, handle, index + 1 ],
			              redo: [ this.addPoint, lp, handle, index + 1 ]
		              } );
		this.addPoint( lp, handle, index + 1 );
		
		// transformObjects
		// adjust neighbors
		var prevPoint = lp.getObjectByName( 'P' + (index) );
		var nextPoint = lp.getObjectByName( 'P' + (index + 2) );
		
		p4.sub( prevPoint.position );
		p6.sub( nextPoint.position );
		this.addUndo( {
			              name: 'moveObject', undo: [ this.moveObjects, [
				[ prevPoint.postHandle, prevPoint.postHandle.position.clone() ],
				[ nextPoint.preHandle, nextPoint.preHandle.position.clone() ]
			] ],
			              redo: [ this.moveObjects, [
				              [ prevPoint.postHandle, p4 ],
				              [ nextPoint.preHandle, p6 ]
			              ] ]
		              } );
		this.moveObjects( [ [ prevPoint.postHandle, p4 ], [ nextPoint.preHandle, p6 ] ] );
		this.joinUndoActions( 2 );
		
		this.undoChanged();
		this.refreshProps();
		this.touchTemplate( lp );
	},
	
	
	// P1 - split - P2 clicked
	pathSplitCurve: function ( e ) {
		var lp = this.selectedObjects[ 0 ];
		var curveIndex = $( e.target ).closest( '.point-row' ).attr( 'alt' );
		this.splitCurve( lp, parseInt( curveIndex ), 0.5 );
	},
	
	pathJoinEnds: function ( e ) {
		var startToEnd = e.target.id == 'point-join-se';
		var lp = this.selectedObjects[ 0 ];
		var point = startToEnd ? lp.getObjectByName( 'P0' ) : lp.getObjectByName( 'P' + lp.path.curves.length );
		var destination = startToEnd ? lp.getObjectByName( 'P' + lp.path.curves.length ) : lp.getObjectByName( 'P0' );
		
		var doArr = [
			[ point, destination.position.clone() ],
			[ point.preHandle, destination.preHandle.position.clone() ],
			[ point.postHandle, destination.postHandle.position.clone() ]
		];
		var undoArr = [
			[ point, point.position.clone() ],
			[ point.preHandle, point.preHandle.position.clone() ],
			[ point.postHandle, point.postHandle.position.clone() ]
		];
		this.addUndo( {
			              name: "joinPathEnds",
			              redo: [ this.moveObjects, doArr ],
			              undo: [ this.moveObjects, undoArr ]
		              } );
		this.moveObjects( doArr );
	},
	
	// + extend start | extend end + clicked
	pathAddSegment: function ( e ) {
		var lp = this.selectedObjects[ 0 ];
		var newPosition;
		var index = e.target.id == 'point-add-left' ? 0 : lp.path.curves.length + 1;
		
		// prepend
		if ( index == 0 ) {
			var p0 = lp.getObjectByName( 'P0' );
			var p1 = lp.getObjectByName( 'P1' );
			var distance = p0.position.distanceTo( p1.position );
			p1 = lp.worldToLocal( p0.localToWorld( p0.preHandle.position.clone() ) );
			p0 = p0.position.clone();
			var dir = p1.clone().sub( p0 ).normalize();
			handle = this._createHandle( p0.add( dir.clone().multiplyScalar( distance ) ), false, 'P' );
			handle.lockTangents = true;
			
			dir.multiplyScalar( 0.25 * distance );
			var cpHandle = this._createHandle( handle.position.clone().add( dir ), handle, 'CP' );
			cpHandle.pointIndex = 2;
			handle.preHandle = cpHandle;
			var cpHandle = this._createHandle( handle.position.clone().sub( dir ), handle, 'CP' );
			cpHandle.pointIndex = 1;
			handle.postHandle = cpHandle;
			
			// append
		} else {
			var p0 = lp.getObjectByName( 'P' + (lp.path.curves.length - 1) );
			var p1 = lp.getObjectByName( 'P' + (lp.path.curves.length) );
			var distance = p0.position.distanceTo( p1.position );
			p0 = p1.position.clone();
			p1 = lp.worldToLocal( p1.localToWorld( p1.postHandle.position.clone() ) );
			var dir = p1.sub( p0 ).normalize();
			handle = this._createHandle( p0.add( dir.clone().multiplyScalar( distance ) ), false, 'P' );
			handle.lockTangents = true;
			
			dir.multiplyScalar( 0.25 * distance );
			var cpHandle = this._createHandle( handle.position.clone().sub( dir ), handle, 'CP' );
			cpHandle.pointIndex = 2;
			handle.preHandle = cpHandle;
			var cpHandle = this._createHandle( handle.position.clone().add( dir ), handle, 'CP' );
			cpHandle.pointIndex = 1;
			handle.postHandle = cpHandle;
		}
		
		this.addUndo( {
			              name: 'addPoint',
			              undo: [ this.deletePoint, lp, handle, index ],
			              redo: [ this.addPoint, lp, handle, index ]
		              } );
		this.addPoint( lp, handle, index );
		
		lp.update();
		
		//setTimeout(function(){  }, 100);
		
		this.refreshProps();
		
		this.touchTemplate( lp );
	},
	
	pointMetaChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'meta';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: 'pointMeta', mergeable: true, undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
		editScene.refreshProps();
	},
	
	pointLockTangentsChanged: function ( e ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'lockTangents';
		var val = e.target.checked;
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, !!obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: prop, undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	beginInsertPoint: function () {
		this.insertingPoint = true;
		this.controls.panEnabled = this.controls.rotateEnabled = this.controls.zoomEnabled = false;
		if ( !this.insertingPointHandle ) {
			this.insertingPointHandle = new THREE.LinePathHandle( 0x00FF66 );
		}
		this.scene.add( this.insertingPointHandle );
		this.insertingPointHandle.visible = false;
		$( 'canvas' ).css( { cursor: 'crosshair' } );
	},
	
	endInsertPoint: function ( confirm ) {
		this.controls.panEnabled = this.controls.rotateEnabled = this.controls.zoomEnabled = true;
		$( 'canvas' ).css( { cursor: 'default' } );
		
		var found = false;
		if ( confirm && this.insertingPoint !== true ) {
			// find segment to split
			var lp = this.selectedObjects[ 0 ];
			var curve = null;
			var curveIndex = -1;
			var curveT = 0;
			var curvePoint = null;
			var localInsertPoint = lp.worldToLocal( this.insertingPoint.point );
			for ( var i = 0; i < lp.path.curves.length; i++ ) {
				curve = lp.path.curves[ i ];
				var step = 2.0 / curve.getLength();
				for ( var t = 0; t <= 1; t += step ) {
					curvePoint = curve.getPoint( t );
					if ( curvePoint.distanceToSquared( localInsertPoint ) <= 4 ) {
						found = true;
						curveIndex = i;
						curveT = t;
						break;
					}
				}
				if ( found ) break;
			}
			// now we have the segment to split
			if ( found ) {
				this.splitCurve( lp, curveIndex, curveT );
				this.mouseDownOnObject = lp;
			}
		}
		
		this.scene.remove( this.insertingPointHandle );
		
		this.insertingPoint = false;
	},
	
	continueInsertPoint: function ( e ) {
		var lp = this.selectedObjects[ 0 ];
		if ( !lp || !(lp instanceof THREE.LinePath) ) {
			this.endInsertPoint();
			return;
		}
		
		var p = new THREE.Vector3( 2 * (e.clientX / window.innerWidth) - 1, 1 - 2 * ( e.clientY / window.innerHeight ), 0 );
		p.unproject( this.camera );
		this.raycaster.set( this.camera.position, p.sub( this.camera.position ).normalize() );
		var intersects = this.raycaster.intersectObject( lp, false );
		if ( intersects.length ) {
			this.insertingPoint = intersects[ 0 ];
			this.insertingPointHandle.position.copy( this.insertingPoint.point );
			this.insertingPointHandle.visible = true;
			$( 'canvas' ).css( { cursor: 'cell' } );
		} else {
			$( 'canvas' ).css( { cursor: 'crosshair' } );
			this.insertingPointHandle.visible = false;
			this.insertingPoint = true;
		}
	},
	
	/* callback after object creation */
	populateObjectCallback: function ( obj, objDef ) {
		
		// custom LinePath initialization
		if ( obj instanceof THREE.LinePath ) {
			
			// selection highlight
			obj._selected = false;
			if ( obj.selected === undefined ) {
				Object.defineProperty( obj, 'selected', {
					get: function () { return this._selected; },
					set: function ( s ) {
						this._selected = s;
						this.material = s ? THREE.LinePath.prototype.sharedSelectedMaterial : THREE.LinePath.prototype.sharedMaterial;
					}
				} );
			}
			
			var parentInstance = obj.isInstance || obj.parentInstance();
			
			if ( !parentInstance ) {
				// create handles
				var lastHandle = null, handle, cpHandle;
				for ( var i = 0; i < obj.path.curves.length; i++ ) {
					var curve = obj.path.curves[ i ];
					// first handle
					if ( i == 0 ) {
						handle = this._createHandle( curve.v0, null, 'P' + i );
						handle.lockTangents = curve.v0.lockTangents;
						handle.curveIndex = i;
						handle.pointIndex = 0;
						handle.meta = curve.v0.meta;
						obj.add( handle );
						lastHandle = handle;
						
						// create pre handle
						cpHandle = this._createHandle( curve.v0.clone().sub( curve.v1 ).add( curve.v0 ), handle, 'CP_0_0' );
						cpHandle.curveIndex = -1;
						cpHandle.pointIndex = 2;
						//cpHandle.visible = false;
						handle.preHandle = cpHandle;
					}
					
					// add second handle
					handle = this._createHandle( curve.v3, null, 'P' + (i + 1) );
					handle.lockTangents = curve.v3.lockTangents;
					handle.curveIndex = i + 1;
					handle.pointIndex = 0;
					handle.meta = curve.v3.meta;
					obj.add( handle );
					
					// add control point 1
					cpHandle = this._createHandle( curve.v1, lastHandle, 'CP' + i + '_1' );
					cpHandle.curveIndex = i;
					cpHandle.pointIndex = 1;
					lastHandle.postHandle = cpHandle;
					
					// add control point 2
					cpHandle = this._createHandle( curve.v2, handle, 'CP' + (i + 1) + '_0' );
					cpHandle.curveIndex = i;
					cpHandle.pointIndex = 2;
					handle.preHandle = cpHandle;
					
					lastHandle = handle;
					
					// last point, add post handle
					if ( i + 1 == obj.path.curves.length ) {
						cpHandle = this._createHandle( curve.v3.clone().sub( curve.v2 ).add( curve.v3 ), handle, 'CP_' + (i + 1) + '_1' );
						cpHandle.curveIndex = i + 1;
						cpHandle.pointIndex = 1;
						//cpHandle.visible = false;					
						handle.postHandle = cpHandle;
					}
				}
			}
			// create line geometry, don't recreate curves
			obj.rebuild( false );
		}
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Physics */
	
	setDefProperty: function ( arr, prop ) {
		for ( var i = 0; i < arr.length; i++ ) {
			var obj = arr[ i ][ 0 ];
			var val = arr[ i ][ 1 ];
			obj.def[ prop ] = val;
			
			if ( prop == 'bodyType' ) {
				for ( var j = 0; j < obj.children.length; j++ ) {
					if ( obj.children[ j ].collisionShape ) {
						obj.children[ j ].material.color.set( val == '2' ? 0x0066FF : (val == '1' ? 0x666666 : 0xFFFFFF ) );
					}
				}
			}
		}
	},
	
	setVectorComponentDefProperty: function ( arr, prop, comp ) {
		for ( var i = 0; i < arr.length; i++ ) {
			var obj = arr[ i ][ 0 ];
			var val = arr[ i ][ 1 ];
			if ( obj.def[ prop ] === undefined ) {
				obj.def[ prop ] = new THREE.Vector3();
			}
			obj.def[ prop ][ comp ] = val;
		}
	},
	
	constraintTypeChanged: function ( e ) {
		var val = $( '#constraint-type' ).val();
		if ( val === '0' ) return;
		
		var doArr = [];
		var undoArr = [];
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.geometryType ] );
		}
		editScene.addUndo( {
			                   name: "geometryType", undo: [ editScene.setGeometryType, undoArr ],
			                   redo: [ editScene.setGeometryType, doArr ]
		                   } );
		editScene.setGeometryType( doArr );
		editScene.refreshProps();
	},
	
	constraintTargetClicked: function ( e ) {
		if ( $( e.target ).attr( 'disabled' ) ) return;
		
		if ( e.shiftKey ) {
			if ( e.target.value.length ) {
				var anyObj = editScene.selectedObjects[ 0 ];
				editScene.deselectAll();
				if ( anyObj.target && anyObj.target.parent ) editScene.objectClicked( anyObj.target );
			}
			return;
		}
		
		e.target.blur();
		
		if ( editScene.objectPickMode ) {
			editScene.objectPickMode( undefined );
			return;
		}
		
		$( '#constraint-target' ).addClass( 'active' );
		$( 'canvas,.object-label,#scene-list div.row:not(.selected),#scene-list div.row:not(.selected) > label' ).css( 'cursor', 'cell' );
		editScene.objectPickMode = function ( obj ) {
			if ( obj !== undefined ) {
				if ( obj && (obj.collisionShape || obj.constraint) ) obj = obj.parent;
				
				editScene.constraintSetTarget( obj );
			}
			$( '#constraint-target' ).removeClass( 'active' );
			editScene.objectPickMode = null;
			$( 'canvas,.object-label,#scene-list div.row:not(.selected),#scene-list div.row:not(.selected) > label' ).css( 'cursor', '' );
		};
	},
	
	constraintCollideChanged: function ( e ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'collideConnected';
		var val = e.target.checked;
		
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, !!obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: prop, undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	constraintPropertyChanged: function ( val, e ) {
		var doArr = [];
		var undoArr = [];
		var prop = e.target.id.substr( 11 );
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] !== undefined ? obj[ prop ] : 0 ] );
		}
		editScene.addUndo( {
			                   name: prop, mergeable: true, undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	constraintSetTarget: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'target';
		var newSelection = [];
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			if ( !val || obj.nearestTemplate() == val.nearestTemplate() ) {
				doArr.push( [ obj, val ] );
				undoArr.push( [ obj, obj.target ? obj.target : null ] );
				newSelection.push( obj );
			}
		}
		
		if ( doArr.length ) {
			editScene.selectedObjects = newSelection;
			editScene.addUndo( {
				                   name: 'constraintTarget',
				                   mergeable: true,
				                   undo: [ editScene.setObjectProperty, undoArr, prop ],
				                   redo: [ editScene.setObjectProperty, doArr, prop ]
			                   } );
			editScene.setObjectProperty( doArr, prop );
			if ( val ) {
				// also look at target
				if ( editScene.lookAtSelection( val ) ) editScene.joinUndoActions( 2 );
			}
		}
		
		editScene.selectionChanged();
		editScene.refreshProps();
	},
	
	physicsChanged: function ( e ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'physics';
		val = e.target.checked;
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			if ( val ) { // add defaults
				if ( obj.def.angularVelocity === undefined ) obj.def.angularVelocity = [ 0, 0, 0 ];
				if ( obj.def.velocity === undefined ) obj.def.velocity = [ 0, 0, 0 ];
				if ( obj.def.collisionGroup === undefined ) obj.def.collisionGroup = 1;
				if ( obj.def.collisionMask === undefined ) obj.def.collisionMask = 1;
				if ( obj.def.friction === undefined ) obj.def.friction = 0.3;
				if ( obj.def.restitution === undefined ) obj.def.restitution = 0.3;
				if ( obj.def.mass === undefined ) obj.def.mass = 10;
				if ( obj.def.sleep === undefined ) obj.def.sleep = false;
			}
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: "physics", mergeable: true, undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		editScene.setObjectProperty( doArr, prop );
	},
	
	scenePhysicsChanged: function ( e ) {
		var prop = 'physics';
		var val = $( e.target ).val();
		var doArr = [ [ editScene.doc, val ] ];
		var undoArr = [ [ editScene.doc, editScene.doc.physics == undefined ? '0' : editScene.doc.physics ] ];
		
		editScene.addUndo( {
			                   name: "scenePhysics",
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		
		editScene.doc.physics = val;
		editScene.refreshProps();
	},
	
	sceneBroadphaseChanged: function ( e ) {
		var prop = 'broadphase';
		var val = $( e.target ).val();
		var doArr = [ [ editScene.doc, val ] ];
		var undoArr = [ [ editScene.doc, editScene.doc.broadphase == undefined ? '0' : editScene.doc.broadphase ] ];
		
		editScene.addUndo( {
			                   name: "broadphase",
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		
		editScene.doc.broadphase = val;
	},
	
	sceneGravityChanged: function ( val, e ) {
		var prop = e.target.id.substr( -1 );
		var doArr = [ [ editScene.doc.gravity, parseFloat( val ) ] ];
		var undoArr = [ [ editScene.doc.gravity, editScene.doc.gravity[ prop ] ] ];
		
		editScene.addUndo( {
			                   name: "gravity" + prop.toUpperCase(),
			                   mergeable: true,
			                   undo: [ editScene.setObjectProperty, undoArr, prop ],
			                   redo: [ editScene.setObjectProperty, doArr, prop ]
		                   } );
		
		editScene.setObjectProperty( doArr, prop );
	},
	
	collisionChanged: function ( e ) {
		var prop = ($( e.target ).attr( 'name' ).indexOf( 'Mask' ) != -1) ? 'collisionMask' : 'collisionGroup';
		var thisBit = parseInt( $( e.target ).attr( 'alt' ) );
		var bitVal = e.target.checked;
		var doArr = [];
		var undoArr = [];
		var val, prevVal;
		e.target.blur();
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			prevVal = obj.def[ prop ];
			// set bit
			if ( bitVal ) {
				val = prevVal | Math.pow( 2, thisBit );
				// unset bit
			} else {
				val = prevVal & (0xFF - Math.pow( 2, thisBit ));
			}
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, prevVal ] );
		}
		editScene.addUndo( {
			                   name: prop, undo: [ editScene.setDefProperty, undoArr, prop ],
			                   redo: [ editScene.setDefProperty, doArr, prop ]
		                   } );
		editScene.setDefProperty( doArr, prop );
		editScene.refreshProps();
	},
	
	addCollisionShape: function ( e ) {
		var prevSelection = this.selectedObjects.concat();
		var objs = [];
		for ( var i = 0; i < prevSelection.length; i++ ) {
			this.selectedObjects = [ prevSelection[ i ] ];
			objs.push( this.addObjectMenuItemClicked( {
				                                          target: { id: 'scene-add-collision-shape' },
				                                          shiftKey: true
			                                          } ) );
		}
		if ( prevSelection.length > 1 ) this.joinUndoActions( prevSelection.length + 1 );
		this.selectedObjects = objs;
		this.selectionChanged();
		this.refreshProps();
	},
	
	addConstraint: function ( e ) {
		var prevSelection = this.selectedObjects.concat();
		var objs = [];
		for ( var i = 0; i < prevSelection.length; i++ ) {
			this.selectedObjects = [ prevSelection[ i ] ];
			objs.push( this.addObjectMenuItemClicked( { target: { id: 'scene-add-constraint' }, shiftKey: true } ) );
		}
		if ( prevSelection.length > 1 ) this.joinUndoActions( prevSelection.length + 1 );
		this.selectedObjects = objs;
		this.selectionChanged();
		this.refreshProps();
	},
	
	velocityChanged: function ( val, e ) {
		var comp = parseInt( e.target.id.substr( -1 ) );
		var doArr = [];
		var undoArr = [];
		var prop = 'velocity';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.def[ prop ] ? obj.def[ prop ][ comp ] : 0 ] );
		}
		editScene.addUndo( {
			                   name: prop + '-' + comp,
			                   mergeable: true,
			                   undo: [ editScene.setVectorComponentDefProperty, undoArr, prop, comp ],
			                   redo: [ editScene.setVectorComponentDefProperty, doArr, prop, comp ]
		                   } );
		editScene.setVectorComponentDefProperty( doArr, prop, comp );
		editScene.refreshProps();
	},
	
	angularVelocityChanged: function ( val, e ) {
		var comp = parseInt( e.target.id.substr( -1 ) );
		var doArr = [];
		var undoArr = [];
		var prop = 'angularVelocity';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.def[ prop ] ? obj.def[ prop ][ comp ] : 0 ] );
		}
		editScene.addUndo( {
			                   name: prop + '-' + comp,
			                   mergeable: true,
			                   undo: [ editScene.setVectorComponentDefProperty, undoArr, prop, comp ],
			                   redo: [ editScene.setVectorComponentDefProperty, doArr, prop, comp ]
		                   } );
		editScene.setVectorComponentDefProperty( doArr, prop, comp );
		editScene.refreshProps();
	},
	
	massChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'mass';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.def.mass || 0 ] );
		}
		editScene.addUndo( {
			                   name: prop, mergeable: true, undo: [ editScene.setDefProperty, undoArr, prop ],
			                   redo: [ editScene.setDefProperty, doArr, prop ]
		                   } );
		editScene.setDefProperty( doArr, prop );
		editScene.refreshProps();
	},
	
	dampingChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'damping';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.def.damping || 0 ] );
		}
		editScene.addUndo( {
			                   name: prop, mergeable: true, undo: [ editScene.setDefProperty, undoArr, prop ],
			                   redo: [ editScene.setDefProperty, doArr, prop ]
		                   } );
		editScene.setDefProperty( doArr, prop );
		editScene.refreshProps();
	},
	
	frictionChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'friction';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.def[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: prop, mergeable: true, undo: [ editScene.setDefProperty, undoArr, prop ],
			                   redo: [ editScene.setDefProperty, doArr, prop ]
		                   } );
		editScene.setDefProperty( doArr, prop );
		editScene.refreshProps();
	},
	
	restitutionChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'restitution';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.def[ prop ] ] );
		}
		editScene.addUndo( {
			                   name: prop, mergeable: true, undo: [ editScene.setDefProperty, undoArr, prop ],
			                   redo: [ editScene.setDefProperty, doArr, prop ]
		                   } );
		editScene.setDefProperty( doArr, prop );
		editScene.refreshProps();
	},
	
	fixedRotationChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'fixedRotation';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, !!obj.def.fixedRotation ] );
		}
		editScene.addUndo( {
			                   name: prop, mergeable: true, undo: [ editScene.setDefProperty, undoArr, prop ],
			                   redo: [ editScene.setDefProperty, doArr, prop ]
		                   } );
		editScene.setDefProperty( doArr, prop );
		editScene.refreshProps();
	},
	
	sensorChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'sensor';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, !!obj.def.sensor ] );
		}
		editScene.addUndo( {
			                   name: prop, mergeable: true, undo: [ editScene.setDefProperty, undoArr, prop ],
			                   redo: [ editScene.setDefProperty, doArr, prop ]
		                   } );
		editScene.setDefProperty( doArr, prop );
		editScene.refreshProps();
	},
	
	sleepChanged: function ( val ) {
		var doArr = [];
		var undoArr = [];
		var prop = 'sleep';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, !!obj.def.sleep ] );
		}
		editScene.addUndo( {
			                   name: prop, mergeable: true, undo: [ editScene.setDefProperty, undoArr, prop ],
			                   redo: [ editScene.setDefProperty, doArr, prop ]
		                   } );
		editScene.setDefProperty( doArr, prop );
		editScene.refreshProps();
	},
	
	bodyTypeChanged: function ( e ) {
		var val = $( '#phys-type' ).val();
		if ( val === '-' ) return;
		
		var doArr = [];
		var undoArr = [];
		var prop = 'bodyType';
		for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
			var obj = editScene.selectedObjects[ i ];
			doArr.push( [ obj, val ] );
			undoArr.push( [ obj, obj.def.bodyType || 0 ] );
		}
		editScene.addUndo( {
			                   name: prop, undo: [ editScene.setDefProperty, undoArr, prop ],
			                   redo: [ editScene.setDefProperty, doArr, prop ]
		                   } );
		editScene.setDefProperty( doArr, prop );
		editScene.refreshProps();
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Properties panel */
	
	previewScene: function ( e ) {
		
		if ( window.previewWindow ) window.previewWindow.close();
		
		var loadScene = editScene.exportScene( true, false );
		console.log( JSON.parse( loadScene ) );
		
		if ( window[ 'chrome' ] && chrome.storage ) {
			chrome.app.window.create( 'editor/preview.html', {
				outerBounds: {
					width: Math.max( 400, Math.floor( window.outerWidth / 2 ) ),
					height: Math.max( 300, Math.floor( window.outerHeight / 2 ) )
				}
			}, function ( win ) {
				win.contentWindow.loadScene = loadScene;
				win.focus();
				window.previewWindow = win;
			} );
		} else {
			var win = window.open( 'preview.html', '_blank' );
			win.loadScene = loadScene;
			win.focus();
			window.previewWindow = win;
		}
	},
	
	refreshProps: function () {
		var prevScroll = $( '#editor-props .panels' ).scrollTop();
		$( '#editor-props > h1' ).text( 'Properties' + (this.selectedObjects.length ? (' (' + this.selectedObjects.length + ')') : '') );
		$( '#editor-props .panels > .panel' ).hide();
		if ( !this.selectedObjects.length ) {
			$( '#prop-name' ).attr( 'placeholder', 'Scene name' ).val( this.doc.name );
			$( '#prop-object-type' ).text( 'Scene' );
			$( '#panel-scene' ).show();
			// scene panel
			$( '#scene-physics' ).val( this.doc.physics ? this.doc.physics : '0' );
			$( '#scene-color' ).css( { backgroundColor: this.doc.clearColor.getHexString() } );
			$( '#scene-fog-color' ).css( { backgroundColor: this.doc.fogColor.getHexString() } );
			$( '#scene-ambient-color' ).css( { backgroundColor: this.doc.ambient.getHexString() } );
			$( '#scene-max-shadows' ).val( this.doc.maxShadows != undefined ? this.doc.maxShadows : 0 ).data( 'prevVal', $( '#scene-max-shadows' ).val().toString() );
			$( '#scene-fog-near' ).val( this.doc.fogNear != undefined ? this.doc.fogNear : this.scene.fog.near ).data( 'prevVal', $( '#scene-fog-near' ).val().toString() );
			$( '#scene-fog-far' ).val( this.doc.fogFar != undefined ? this.doc.fogFar : this.scene.fog.far ).data( 'prevVal', $( '#scene-fog-far' ).val().toString() );
			// scene physics panel
			if ( this.doc.physics != undefined && this.doc.physics != '0' ) {
				$( '#panel-scene-physics' ).show();
				if ( this.doc.gravity ) {
					$( '#phys-grav-x:not(:focus)' ).data( 'prevVal', this.doc.gravity.x.toString() ).val( this.doc.gravity.x );
					$( '#phys-grav-y:not(:focus)' ).data( 'prevVal', this.doc.gravity.y.toString() ).val( this.doc.gravity.y );
					$( '#phys-grav-z:not(:focus)' ).data( 'prevVal', this.doc.gravity.z.toString() ).val( this.doc.gravity.z );
				}
				$( '#scene-broadphase' ).val( this.doc.broadphase ? this.doc.broadphase : '0' );
			}
			return;
		}
		$( '#prop-name' ).attr( 'placeholder', 'Object name' );
		$( '#prop-object-type' ).text( '' );
		$( '#panel-move' ).show();
		
		$( '#editor-props input[type=checkbox].multiple,#panel-pixelbox input[name=pixelbox-animOption].multiple' ).removeClass( 'multiple' ).removeAttr( 'checked' );
		
		$( '#pixelbox-animName' ).empty().append( '<option value=""/>' );
		$( '#props-container' ).empty();
		
		$( '#geometry-type option[value="0"],#phys-type option[value="-"],#constraint-type option[value="0"]' ).remove();
		
		var prevObj = null, prevPhysObj = null;
		var mults = {};
		var containsAnchors = false;
		var containsContainers = false;
		var containsPointClouds = false;
		var containsInstances = false;
		var containsCameras = false;
		var containsGeometry = false;
		var containsCollisionShapes = false;
		var containsConstraints = false;
		var containsSpotLights = false;
		var containsDirLights = false;
		var containsHemiLights = false;
		var containsPointLights = false;
		var containsPoints = false;
		var containsPaths = false;
		var containsFxSprites = false;
		var radToDeg = 180 / Math.PI;
		var commonType = null;
		
		function getType ( o, pbt ) {
			if ( o.def ) {
				switch ( o.def.asset ) {
					case 'Geometry':
						if ( o.collisionShape ) return 'CollisionShape';
						if ( o.constraint ) return 'Constraint';
						return 'Geometry';
					case 'Camera':
					case 'OrthographicCamera':
						return 'Camera';
					default:
						if ( o.isInstance ) return '[' + o.def.template + ']';
						return (o.pixelBox && !pbt) ? 'PixelBox' : o.def.asset;
				}
			} else if ( o.isAnchor ) {
				return 'Anchor';
			} else if ( o instanceof THREE.LinePathHandle ) {
				return o.isControlPoint ? 'ControlPoint' : 'Point';
			}
			return null;
		}
		
		for ( var i = 0, numSel = this.selectedObjects.length; i < numSel; i++ ) {
			var obj = this.selectedObjects[ i ];
			// name
			if ( prevObj && prevObj.name != obj.name ) {
				$( '#prop-name' ).attr( 'placeholder', 'Multiple' ).val( '' );
				mults[ 'name' ] = true;
			} else if ( !mults[ 'name' ] ) {
				$( '#prop-name' ).attr( 'placeholder', 'Object name' ).val( obj.name );
			}
			
			// excludes
			containsAnchors = containsAnchors || (!!obj.isAnchor);
			containsContainers = containsContainers | (obj.isContainer);
			containsPointClouds = containsPointClouds | (obj.pixelBox);
			containsInstances = containsInstances | (obj.isInstance);
			containsCameras = containsCameras | (obj instanceof THREE.Camera);
			containsGeometry = containsGeometry | (obj instanceof THREE.Mesh && !(obj.collisionShape || obj.constraint));
			containsCollisionShapes = containsCollisionShapes | (obj instanceof THREE.Mesh && obj.collisionShape);
			containsConstraints = containsConstraints | (obj instanceof THREE.Mesh && obj.constraint);
			containsSpotLights = containsSpotLights | (obj instanceof THREE.SpotLight);
			containsDirLights = containsDirLights | (obj instanceof THREE.DirectionalLight);
			containsHemiLights = containsHemiLights | (obj instanceof THREE.HemisphereLight);
			containsPointLights = containsPointLights | (obj instanceof THREE.PointLight);
			containsPoints = containsPoints | (obj instanceof THREE.LinePathHandle);
			containsPaths = containsPaths | (obj instanceof THREE.LinePath);
			containsFxSprites = containsFxSprites | (obj instanceof THREE.FxSprite);

			// type
			var type = getType( obj );
			var prevType = prevObj ? getType( prevObj ) : null;
			
			if ( prevObj && prevType != type ) {
				$( '#prop-object-type' ).text( 'Multiple types' );
				mults[ 'type' ] = true;
				commonType = null;
			} else if ( !mults[ 'type' ] ) {
				$( '#prop-object-type' ).text( this.selectedObjects.length > 1 ? type : getType( obj, true ) );
				commonType = type;
			}
			
			// visible
			if ( prevObj && prevObj.visible != obj.visible ) {
				$( '#prop-visible' ).addClass( 'multiple' )[ 0 ].checked = false;
				mults[ 'visible' ] = true;
			} else if ( !mults[ 'visible' ] ) {
				$( '#prop-visible' )[ 0 ].checked = obj.visible;
			}
			// template
			if ( prevObj && prevObj.isTemplate != obj.isTemplate ) {
				$( '#prop-template' ).addClass( 'multiple' )[ 0 ].checked = false;
				mults[ 'template' ] = true;
			} else if ( !mults[ 'template' ] ) {
				$( '#prop-template' )[ 0 ].checked = obj.isTemplate;
			}
			// visible
			if ( prevObj && prevObj.physics != obj.physics ) {
				$( '#prop-physics' ).addClass( 'multiple' )[ 0 ].checked = false;
				mults[ 'physics' ] = true;
			} else if ( !mults[ 'physics' ] ) {
				$( '#prop-physics' )[ 0 ].checked = obj.physics;
			}
			// cast
			if ( prevObj && prevObj.castShadow != obj.castShadow ) {
				$( '#prop-cast-shadow' ).addClass( 'multiple' )[ 0 ].checked = false;
				mults[ 'cast' ] = true;
			} else if ( !mults[ 'cast' ] ) {
				$( '#prop-cast-shadow' )[ 0 ].checked = obj.castShadow;
			}
			// receive
			if ( prevObj && prevObj.receiveShadow != obj.receiveShadow ) {
				$( '#prop-receive-shadow' ).addClass( 'multiple' )[ 0 ].checked = false;
				mults[ 'receive' ] = true;
			} else if ( !mults[ 'receive' ] ) {
				$( '#prop-receive-shadow' )[ 0 ].checked = obj.receiveShadow;
			}
			
			//x
			if ( prevObj && prevObj.position.x != obj.position.x ) {
				$( '#prop-x' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
				mults[ 'x' ] = true;
			} else if ( !mults[ 'x' ] ) {
				$( '#prop-x:not(:focus)' ).attr( 'placeholder', '' ).val( obj.position.x ).data( 'prevVal', obj.position.x.toString() );
			}
			//y
			if ( prevObj && prevObj.position.y != obj.position.y ) {
				$( '#prop-y' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
				mults[ 'y' ] = true;
			} else if ( !mults[ 'x' ] ) {
				$( '#prop-y:not(:focus)' ).attr( 'placeholder', '' ).val( obj.position.y ).data( 'prevVal', obj.position.y.toString() );
			}
			//z
			if ( prevObj && prevObj.position.z != obj.position.z ) {
				$( '#prop-z' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
				mults[ 'z' ] = true;
			} else if ( !mults[ 'z' ] ) {
				$( '#prop-z:not(:focus)' ).attr( 'placeholder', '' ).val( obj.position.z ).data( 'prevVal', obj.position.z.toString() );
			}
			//rx
			if ( prevObj && prevObj.rotation.x != obj.rotation.x ) {
				$( '#prop-rx' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
				mults[ 'rx' ] = true;
			} else if ( !mults[ 'rx' ] ) {
				var newVal = Math.round( radToDeg * obj.rotation.x );
				$( '#prop-rx:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
			}
			//ry
			if ( prevObj && prevObj.rotation.y != obj.rotation.y ) {
				$( '#prop-ry' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
				mults[ 'ry' ] = true;
			} else if ( !mults[ 'ry' ] ) {
				var newVal = Math.round( radToDeg * obj.rotation.y );
				$( '#prop-ry:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
			}
			//rz
			if ( prevObj && prevObj.rotation.z != obj.rotation.z ) {
				$( '#prop-rz' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
				mults[ 'rz' ] = true;
			} else if ( !mults[ 'rz' ] ) {
				var newVal = Math.round( radToDeg * obj.rotation.z );
				$( '#prop-rz:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
			}
			//sx
			if ( prevObj && prevObj.scale.x != obj.scale.x ) {
				$( '#prop-sx' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
				mults[ 'sx' ] = true;
			} else if ( !mults[ 'sx' ] ) {
				var newVal = fake0( obj.scale.x );
				$( '#prop-sx:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
			}
			//ry
			if ( prevObj && prevObj.scale.y != obj.scale.y ) {
				$( '#prop-sy' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
				mults[ 'sy' ] = true;
			} else if ( !mults[ 'sy' ] ) {
				var newVal = fake0( obj.scale.y );
				$( '#prop-sy:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
			}
			//rz
			if ( prevObj && prevObj.scale.z != obj.scale.z ) {
				$( '#prop-sz' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
				mults[ 'sz' ] = true;
			} else if ( !mults[ 'sz' ] ) {
				var newVal = fake0( obj.scale.z );
				$( '#prop-sz:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
			}
			
			// camera
			if ( commonType == 'Camera' ) {
				if ( prevObj && prevObj.fov != obj.fov ) {
					$( '#cam-fov' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'cam-fov' ] = true;
				} else if ( !mults[ 'cam-fov' ] ) {
					var newVal = obj.fov;
					$( '#cam-fov:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.zoom != obj.zoom ) {
					$( '#cam-zoom' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'cam-zoom' ] = true;
				} else if ( !mults[ 'cam-zoom' ] ) {
					var newVal = Math.floor( obj.zoom * 100 );
					$( '#cam-zoom:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.near != obj.near ) {
					$( '#cam-near' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'cam-near' ] = true;
				} else if ( !mults[ 'cam-near' ] ) {
					var newVal = obj.near;
					$( '#cam-near:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.far != obj.far ) {
					$( '#cam-far' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'cam-far' ] = true;
				} else if ( !mults[ 'cam-far' ] ) {
					var newVal = obj.far;
					$( '#cam-far:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( this.selectedObjects.length == 1 ) {
					$( '#cam-default' )[ 0 ].checked = !!obj.isDefault;
				}
				if ( prevObj && prevObj.def.asset != obj.def.asset ) {
					mults[ 'cam-type' ] = true;
					$( '#cam-fov,label[for=cam-fov],#cam-zoom,label[for=cam-zoom]' ).hide();
				} else if ( !mults[ 'cam-type' ] && obj.def.asset == 'Camera' ) {
					$( '#cam-fov,label[for=cam-fov]' ).show();
					$( '#cam-zoom,label[for=cam-zoom]' ).hide();
				} else if ( !mults[ 'cam-type' ] && obj.def.asset == 'OrthographicCamera' ) {
					$( '#cam-fov,label[for=cam-fov]' ).hide();
					$( '#cam-zoom,label[for=cam-zoom]' ).show();
				}
				
			} else
			
			// lights
			if ( obj instanceof THREE.Light ) {
				if ( prevObj && prevObj.color && prevObj.color.getHex() != obj.color.getHex() ) {
					$( '#light-color' ).css( { backgroundColor: 'transparent' } );
					mults[ 'light-color' ] = true;
				} else if ( !mults[ 'light-color' ] ) {
					$( '#light-color' ).css( { backgroundColor: '#' + obj.color.getHexString() } );
				}
				if ( obj instanceof THREE.HemisphereLight ) {
					if ( prevObj && prevObj.groundColor && prevObj.groundColor.getHex() != obj.groundColor.getHex() ) {
						$( '#light-ground-color' ).css( { backgroundColor: 'transparent' } );
						mults[ 'light-ground-color' ] = true;
					} else if ( !mults[ 'light-ground-color' ] ) {
						$( '#light-ground-color' ).css( { backgroundColor: '#' + obj.groundColor.getHexString() } );
					}
				}
				if ( prevObj && prevObj.intensity != obj.intensity ) {
					$( '#light-intensity' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'light-intensity' ] = true;
				} else if ( !mults[ 'light-intensity' ] ) {
					var newVal = notNaN( parseFloat( obj.intensity ) );
					$( '#light-intensity:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.distance != obj.distance ) {
					$( '#light-distance' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'light-distance' ] = true;
				} else if ( !mults[ 'light-distance' ] ) {
					var newVal = notNaN( parseFloat( obj.distance ) );
					$( '#light-distance:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.exponent != obj.exponent ) {
					$( '#light-exponent' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'light-exponent' ] = true;
				} else if ( !mults[ 'light-exponent' ] ) {
					var newVal = notNaN( parseFloat( obj.exponent ) );
					$( '#light-exponent:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.angle != obj.angle ) {
					$( '#light-angle' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'light-angle' ] = true;
				} else if ( !mults[ 'light-angle' ] ) {
					var newVal = notNaN( parseFloat( obj.angle * radToDeg ) );
					$( '#light-angle:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				
				if ( prevObj && prevObj.shadowBias != obj.shadowBias ) {
					$( '#light-shadow-bias' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'light-shadow-bias' ] = true;
				} else if ( !mults[ 'light-shadow-bias' ] ) {
					var newVal = notNaN( parseFloat( obj.shadowBias ) );
					$( '#light-shadow-bias:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.shadowCameraNear != obj.shadowCameraNear ) {
					$( '#light-shadow-near' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'light-shadow-near' ] = true;
				} else if ( !mults[ 'light-shadow-near' ] ) {
					var newVal = notNaN( parseFloat( obj.shadowCameraNear ) );
					$( '#light-shadow-near:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.shadowCameraFar != obj.shadowCameraFar ) {
					$( '#light-shadow-far' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'light-shadow-far' ] = true;
				} else if ( !mults[ 'light-shadow-far' ] ) {
					var newVal = notNaN( parseFloat( obj.shadowCameraFar ) );
					$( '#light-shadow-far:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.shadowCameraRight != obj.shadowCameraRight ) {
					$( '#light-shadow-vol-width' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'light-shadow-vol-width' ] = true;
				} else if ( !mults[ 'light-shadow-vol-width' ] ) {
					var newVal = notNaN( parseFloat( obj.shadowCameraRight ) );
					$( '#light-shadow-vol-width:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.shadowCameraTop != obj.shadowCameraTop ) {
					$( '#light-shadow-vol-height' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'light-shadow-vol-height' ] = true;
				} else if ( !mults[ 'light-shadow-vol-height' ] ) {
					var newVal = notNaN( parseFloat( obj.shadowCameraTop ) );
					$( '#light-shadow-vol-height:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.shadowMapWidth != obj.shadowMapWidth ) {
					$( '#light-shadow-map-width' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'light-shadow-map-width' ] = true;
				} else if ( !mults[ 'light-shadow-map-width' ] ) {
					var newVal = notNaN( parseFloat( obj.shadowMapWidth ) );
					$( '#light-shadow-map-width:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.shadowMapHeight != obj.shadowMapHeight ) {
					$( '#light-shadow-map-height' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'light-shadow-map-height' ] = true;
				} else if ( !mults[ 'light-shadow-map-height' ] ) {
					var newVal = notNaN( parseFloat( obj.shadowMapHeight ) );
					$( '#light-shadow-map-height:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.target && obj.target && prevObj.target != obj.target ) {
					$( '#light-target' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'light-target' ] = true;
				} else if ( obj.target && !mults[ 'light-target' ] ) {
					var newVal = obj.target.name ? obj.target.name : '';
					$( '#light-target' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
			} else
			
			// Geometry
			if ( commonType == 'Geometry' || commonType == 'CollisionShape' ) {
				if ( commonType == 'Geometry' ) {
					if ( prevObj && prevObj.material.stipple != obj.material.stipple ) {
						$( '#geometry-stipple' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
						mults[ 'geometry-stipple' ] = true;
					} else if ( !mults[ 'geometry-stipple' ] ) {
						var newVal = obj.material.stipple;
						$( '#geometry-stipple:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
					}
					if ( prevObj && prevObj.material.alpha != obj.material.alpha ) {
						$( '#geometry-alpha' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
						mults[ 'geometry-alpha' ] = true;
					} else if ( !mults[ 'geometry-alpha' ] ) {
						var newVal = obj.material.alpha;
						$( '#geometry-alpha:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
					}
					if ( prevObj && prevObj.material.alphaThresh != obj.material.alphaThresh ) {
						$( '#geometry-alphaThresh' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
						mults[ 'geometry-alphaThresh' ] = true;
					} else if ( !mults[ 'geometry-alphaThresh' ] ) {
						var newVal = obj.material.alphaThresh;
						$( '#geometry-alphaThresh:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
					}
					if ( prevObj && prevObj.material.brightness != obj.material.brightness ) {
						$( '#geometry-brightness' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
						mults[ 'geometry-brightness' ] = true;
					} else if ( !mults[ 'geometry-brightness' ] ) {
						var newVal = obj.material.brightness;
						$( '#geometry-brightness:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
					}
					if ( prevObj && prevObj.material.tint.getHex() != obj.material.tint.getHex() ) {
						$( '#geometry-tint' ).css( { backgroundColor: 'transparent' } );
						mults[ 'geometry-tint' ] = true;
					} else if ( !mults[ 'geometry-tint' ] ) {
						$( '#geometry-tint' ).css( { backgroundColor: '#' + obj.material.tint.getHexString() } );
					}
					if ( prevObj && prevObj.material.addColor.getHex() != obj.material.addColor.getHex() ) {
						$( '#geometry-addColor' ).css( { backgroundColor: 'transparent' } );
						mults[ 'geometry-addColor' ] = true;
					} else if ( !mults[ 'geometry-addColor' ] ) {
						$( '#geometry-addColor' ).css( { backgroundColor: '#' + obj.material.addColor.getHexString() } );
					}
					// texture geometry-texture
					$( '#geometry-texture' ).empty().append('<option value="">- no texture -</option>');
					for( var a in assets.files ){
						if ( assets.files[ a ].image ){
							$( '#geometry-texture' ).append('<option value="'+a+'">'+a+'</option>');
						} else if ( assets.files[ a ].plist && assets.files[ a ].plist.metadata ) {
							var textureAsset = assets.files[ assets.files[ a ].plist.metadata.textureFileName ];
							if ( textureAsset ) textureAsset.sliceMap = assets.files[ a ].plist;
						}
					}
					if ( prevObj && prevObj.textureMap != obj.textureMap ) {
						if ( !mults[ 'geometry-texture' ] ) {
							$( '#geometry-texture' ).prepend( '<option value="0" selected>- multiple -</option>' );
						}
						$( '#geometry-texture' ).val( '0' );
						$( '#geometry-texture-slice' ).empty();
						mults[ 'geometry-texture' ] = true;
					} else if ( !mults[ 'geometry-texture' ] ) {
						var newVal = obj.textureMap;
						$( '#geometry-texture' ).val( newVal );
						$( '#geometry-texture-slice' ).empty();

						// populate slices
						var textureAsset = assets.files[ newVal ];
						if ( textureAsset && textureAsset.sliceMap ) {
							$( '#geometry-texture-slice' ).append( '<option value=""></option>');
							for( var sn in textureAsset.sliceMap.frames ) {
								var opt = $( '<option></option>' );
								opt.attr('value', sn );
								opt.text( sn );
								$( '#geometry-texture-slice' ).append(opt);
							}
						}

						// select slice
						if ( prevObj && prevObj.sliceName != obj.sliceName ) {
							if ( !mults[ 'geometry-texture-slice' ] ) {
								$( '#geometry-texture-slice' ).prepend( '<option value="0" selected>- multiple -</option>' );
							}
							$( '#geometry-texture-slice' ).val( '0' );
							mults[ 'geometry-texture-slice' ] = true;
							$( '#geometry-texture-slice-size' ).text('');
						} else if ( !mults[ 'geometry-texture-slice' ] ) {
							var newVal = obj.sliceName;
							$( '#geometry-texture-slice' ).val( newVal );
							if(textureAsset && textureAsset.sliceMap && textureAsset.sliceMap.frames[ obj.sliceName ] ) {
								var sliceInfo = textureAsset.sliceMap.frames[ obj.sliceName ];
								$( '#geometry-texture-slice-size' ).text(sliceInfo.spriteSourceSize.x + ' x ' + sliceInfo.spriteSourceSize.y);
							} else {
								$( '#geometry-texture-slice-size' ).text('');
							}
						}

					}

					// invert
					if ( prevObj && prevObj.def.inverted != obj.def.inverted ) {
						$( '#geometry-invert' ).addClass( 'multiple' )[ 0 ].checked = false;
						mults[ 'geometry-invert' ] = true;
					} else if ( !mults[ 'geometry-invert' ] ) {
						$( '#geometry-invert' )[ 0 ].checked = obj.def.inverted;
					}
				}
				
				// filter shape types
				if ( commonType == 'CollisionShape' ) {
					if ( this.doc.physics == 'CANNON' ) {
						$( '#geometry-type option[value="Plane"]' ).text( 'Infinite Plane' );
						$( '#geometry-type option.cannon-only' ).show();
					} else {
						$( '#geometry-type option[value="Plane"]' ).text( 'Plane' );
						$( '#geometry-type option.cannon-only' ).hide();
					}
				} else {
					$( '#geometry-type option[value="Plane"]' ).text( 'Plane' );
					$( '#geometry-type option.cannon-only' ).hide();
				}
				
				// type
				if ( prevObj && prevObj.geometryType != obj.geometryType ) {
					if ( !mults[ 'geometry-type' ] ) {
						$( '#geometry-type' ).prepend( '<option value="0" selected>- multiple -</option>' );
					}
					$( '#geometry-type' ).val( '0' );
					mults[ 'geometry-type' ] = true;
					$( '#panel-geometry .subpanel' ).hide();
				} else if ( !mults[ 'geometry-type' ] ) {
					var newVal = obj.geometryType;
					$( '#geometry-type' ).val( newVal );
					$( '#panel-geometry .subpanel' ).hide();
					$( '#panel-geometry #geometry-' + newVal ).show();
					
					var panel = $( '#panel-geometry' );
					// props
					var props = [ 'width', 'height', 'depth', 'widthSegments', 'heightSegments', 'depthSegments', 'radiusSegments', 'radiusTop', 'radiusBottom' ];
					for ( var pi in props ) {
						var p = props[ pi ];
						if ( prevObj && prevObj.def[ p ] != obj.def[ p ] ) {
							$( '.geometry-' + p, panel ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
							mults[ 'geometry-' + p ] = true;
						} else if ( !mults[ 'geometry-' + p ] ) {
							var newVal = obj.def[ p ];
							$( '.geometry-' + p + ':not(:focus)', panel ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
						}
					}
					props = [ 'radius', 'phiStart', 'phiLength', 'thetaStart', 'thetaLength' ];
					for ( var pi in props ) {
						var p = props[ pi ];
						if ( prevObj && prevObj.def[ p ] != obj.def[ p ] ) {
							$( '#geometry-' + p, panel ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
							mults[ 'geometry-' + p ] = true;
						} else if ( !mults[ 'geometry-' + p ] ) {
							var newVal = obj.def[ p ];
							$( '#geometry-' + p + ':not(:focus)', panel ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
						}
					}
					if ( prevObj && prevObj.def.openEnded != obj.def.openEnded ) {
						$( '#geometry-cylinder-openEnded' ).addClass( 'multiple' )[ 0 ].checked = false;
						mults[ 'geometry-openEnded' ] = true;
					} else if ( !mults[ 'geometry-openEnded' ] ) {
						$( '#geometry-cylinder-openEnded' )[ 0 ].checked = obj.def.openEnded;
					}
					
				}
			} else
			
			// Constraint
			if ( commonType == 'Constraint' ) {
				
				$( '#panel-constraint .subpanel' ).hide();
				if ( prevObj && prevObj.geometryType != obj.geometryType ) {
					if ( !mults[ 'constraint-type' ] ) {
						$( '#constraint-type' ).prepend( '<option value="0" selected>- multiple -</option>' );
					}
					$( '#constraint-type' ).val( '0' );
					mults[ 'constraint-type' ] = true;
				} else if ( !mults[ 'constraint-type' ] ) {
					var newVal = obj.geometryType;
					$( '#constraint-type' ).val( newVal );
					$( '#constraint-' + newVal ).show();
				}
				
				if ( prevObj && prevObj.target != obj.target ) {
					$( '#constraint-target' ).attr( 'placeholder', 'Multiple' ).val( '' ).data( 'prevVal', '' );
					mults[ 'constraint-target' ] = true;
				} else if ( !mults[ 'constraint-target' ] ) {
					var newVal = (obj.target && obj.target.name) ? obj.target.name : '';
					$( '#constraint-target' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				
				if ( prevObj && prevObj.motorTargetVelocity != obj.motorTargetVelocity ) {
					$( '#constraint-motorTargetVelocity' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'motorTargetVelocity' ] = true;
				} else if ( !mults[ 'motorTargetVelocity' ] ) {
					var newVal = obj.motorTargetVelocity != undefined ? obj.motorTargetVelocity : 0;
					$( '#constraint-motorTargetVelocity:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.cullBack != obj.cullBack ) {
					$( '#constraint-collideConnected' ).addClass( 'multiple' )[ 0 ].checked = false;
					mults[ 'collideConnected' ] = true;
				} else if ( !mults[ 'collideConnected' ] ) {
					$( '#constraint-collideConnected' )[ 0 ].checked = !!obj.collideConnected;
				}
				
			} else
			
			// PixelBox
			if ( commonType == 'PixelBox' ) {
				if ( prevObj && prevObj.pointSize != obj.pointSize ) {
					$( '#pixelbox-pointSize' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'pointSize' ] = true;
				} else if ( !mults[ 'pointSize' ] ) {
					var newVal = obj.pointSize;
					$( '#pixelbox-pointSize:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.stipple != obj.stipple ) {
					$( '#pixelbox-stipple' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'stipple' ] = true;
				} else if ( !mults[ 'stipple' ] ) {
					var newVal = obj.stipple;
					$( '#pixelbox-stipple:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.alpha != obj.alpha ) {
					$( '#pixelbox-alpha' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'pixelbox-alpha' ] = true;
				} else if ( !mults[ 'pixelbox-alpha' ] ) {
					var newVal = obj.alpha;
					$( '#pixelbox-alpha:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.occlusion != obj.occlusion ) {
					$( '#pixelbox-occlusion' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'occlusion' ] = true;
				} else if ( !mults[ 'occlusion' ] ) {
					var newVal = obj.occlusion;
					$( '#pixelbox-occlusion:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.cullBack != obj.cullBack ) {
					$( '#pixelbox-cullBack' ).addClass( 'multiple' )[ 0 ].checked = false;
					mults[ 'cullBack' ] = true;
				} else if ( !mults[ 'cullBack' ] ) {
					$( '#pixelbox-cullBack' )[ 0 ].checked = obj.cullBack;
				}
				if ( prevObj && prevObj.def.staticGroup != obj.def.staticGroup ) {
					$( '#pixelbox-group' ).attr( 'placeholder', 'Multiple' ).val( '' ).data( 'prevVal', '' );
					mults[ 'pixelbox-group' ] = true;
				} else if ( !mults[ 'pixelbox-group' ] ) {
					var newVal = obj.def.staticGroup;
					$( '#pixelbox-group:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.def[ 'animOption' ] != obj.def[ 'animOption' ] ) {
					$( '#panel-pixelbox input[name=pixelbox-animOption]' ).addClass( 'multiple' ).attr( 'checked', false );
					mults[ 'animOption' ] = true;
				} else if ( !mults[ 'animOption' ] ) {
					var animOption = obj.def[ 'animOption' ] ? obj.def[ 'animOption' ] : 'gotoAndStop';
					$( '#panel-pixelbox input[value="' + animOption + '"]' )[ 0 ].checked = true;
				}
				if ( prevObj && prevObj.animSpeed != obj.animSpeed ) {
					$( '#pixelbox-animSpeed' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'animSpeed' ] = true;
				} else if ( !mults[ 'animSpeed' ] ) {
					var newVal = obj.animSpeed;
					$( '#pixelbox-animSpeed:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				
				// add anims to anim name box
				var sel = $( '#pixelbox-animName' );
				for ( var aname in obj.asset.anims ) {
					var opt = $( 'option[value="' + aname + '"]', sel );
					if ( !opt.length ) {
						opt = $( '<option></option>' ).text( aname ).val( aname );
						sel.append( opt );
					}
				}
				if ( prevObj && (prevObj.def[ 'animName' ] != obj.def[ 'animName' ]) ) {
					mults[ 'animName' ] = true;
				} else if ( !mults[ 'animName' ] ) {
					var animName = obj.def[ 'animName' ];
					if ( animName != undefined && obj.animNamed( animName ) ) {
						$( '#pixelbox-animName' ).val( animName );
					}
				}
				if ( prevObj && prevObj.def[ 'animFrame' ] != obj.def[ 'animFrame' ] ) {
					$( '#pixelbox-animFrame' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'animFrame' ] = true;
				} else if ( !mults[ 'animFrame' ] ) {
					var newVal = obj.def[ 'animFrame' ] ? obj.def[ 'animFrame' ] : 0;
					$( '#pixelbox-animFrame:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.tint.getHex() != obj.tint.getHex() ) {
					$( '#pixelbox-tint' ).css( { backgroundColor: 'transparent' } );
					mults[ 'pixelbox-tint' ] = true;
				} else if ( !mults[ 'pixelbox-tint' ] ) {
					$( '#pixelbox-tint' ).css( { backgroundColor: '#' + obj.tint.getHexString() } );
				}
				if ( prevObj && prevObj.addColor.getHex() != obj.addColor.getHex() ) {
					$( '#pixelbox-add' ).css( { backgroundColor: 'transparent' } );
					mults[ 'pixelbox-add' ] = true;
				} else if ( !mults[ 'pixelbox-add' ] ) {
					$( '#pixelbox-add' ).css( { backgroundColor: '#' + obj.addColor.getHexString() } );
				}
			} else
			
			// LinePath
			if ( commonType == 'LinePath' ) {
				if ( prevObj ) { // multiple
					$( '#point-add' ).attr( 'disabled', 'disabled' );
					$( '#path-container' ).empty().append( '<span class="info">multiple selection</span>' );
				} else if ( numSel == 1 ) {
					$( '#point-add' ).removeAttr( 'disabled' );
					var cont = $( '#path-container' ).empty();
					for ( var s = 0, sl = obj.path.curves.length; s < sl; s++ ) {
						var curve = obj.path.curves[ s ];
						var row = $( '<div class="point-row" id="curve-' + s + '" alt="' + s + '">\
						<div class="from">P' + (s) + '</div>\
						<div class="curve center"><a>split</a>\
						</div>\
						<div class="to">P' + (s + 1) + '</div></div>' );
						row.find( 'a:first' ).click( this.pathSplitCurve.bind( this ) );
						cont.append( row );
					}
				}
			} else
			
			// Point
			if ( commonType == 'Point' ) {
				if ( prevObj && prevObj.lockTangents != obj.lockTangents ) {
					$( '#point-locked' ).addClass( 'multiple' )[ 0 ].checked = false;
					mults[ 'lockTangents' ] = true;
				} else if ( !mults[ 'lockTangents' ] ) {
					$( '#point-locked' )[ 0 ].checked = obj.lockTangents;
				}
				
				if ( prevObj && prevObj.meta != obj.meta ) {
					$( '#point-meta' ).attr( 'placeholder', 'Multiple' ).val( '' ).data( 'prevVal', '' );
					mults[ 'point-meta' ] = true;
				} else if ( !mults[ 'point-meta' ] ) {
					var newVal = obj.meta ? obj.meta : '';
					$( '#point-meta:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
			} else

			// FxSprite
			if ( commonType == 'FxSprite' ) {

				if ( prevObj && prevObj.material.stipple != obj.material.stipple ) {
					$( '#fxsprite-stipple' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'fxsprite-stipple' ] = true;
				} else if ( !mults[ 'fxsprite-stipple' ] ) {
					var newVal = obj.material.stipple;
					$( '#fxsprite-stipple:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.material.alpha != obj.material.alpha ) {
					$( '#fxsprite-alpha' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'fxsprite-alpha' ] = true;
				} else if ( !mults[ 'fxsprite-alpha' ] ) {
					var newVal = obj.material.alpha;
					$( '#fxsprite-alpha:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.material.alphaThresh != obj.material.alphaThresh ) {
					$( '#fxsprite-alphaThresh' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'fxsprite-alphaThresh' ] = true;
				} else if ( !mults[ 'fxsprite-alphaThresh' ] ) {
					var newVal = obj.material.alphaThresh;
					$( '#fxsprite-alphaThresh:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.scaleX != obj.scaleX ) {
					$( '#fxsprite-scaleX' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'fxsprite-scaleX' ] = true;
				} else if ( !mults[ 'fxsprite-scaleX' ] ) {
					var newVal = obj.scaleX;
					$( '#fxsprite-scaleX:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.scaleY != obj.scaleY ) {
					$( '#fxsprite-scaleY' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'fxsprite-scaleY' ] = true;
				} else if ( !mults[ 'fxsprite-scaleY' ] ) {
					var newVal = obj.scaleY;
					$( '#fxsprite-scaleY:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.angle != obj.angle ) {
					$( '#fxsprite-angle' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'fxsprite-angle' ] = true;
				} else if ( !mults[ 'fxsprite-angle' ] ) {
					var newVal = Math.round( 180 * obj.angle / Math.PI );
					$( '#fxsprite-angle:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.material.brightness != obj.material.brightness ) {
					$( '#fxsprite-brightness' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'fxsprite-brightness' ] = true;
				} else if ( !mults[ 'fxsprite-brightness' ] ) {
					var newVal = obj.material.brightness;
					$( '#fxsprite-brightness:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.material.tint.getHex() != obj.material.tint.getHex() ) {
					$( '#fxsprite-tint' ).css( { backgroundColor: 'transparent' } );
					mults[ 'fxsprite-tint' ] = true;
				} else if ( !mults[ 'fxsprite-tint' ] ) {
					$( '#fxsprite-tint' ).css( { backgroundColor: '#' + obj.material.tint.getHexString() } );
				}
				if ( prevObj && prevObj.material.addColor.getHex() != obj.material.addColor.getHex() ) {
					$( '#fxsprite-addColor' ).css( { backgroundColor: 'transparent' } );
					mults[ 'fxsprite-addColor' ] = true;
				} else if ( !mults[ 'fxsprite-addColor' ] ) {
					$( '#fxsprite-addColor' ).css( { backgroundColor: '#' + obj.material.addColor.getHexString() } );
				}
				// texture
				$( '#fxsprite-texture' ).empty().append('<option value="">- no texture -</option>');
				for( var a in assets.files ){
					if ( assets.files[ a ].image ){
						$( '#fxsprite-texture' ).append('<option value="'+a+'">'+a+'</option>');
					} else if ( assets.files[ a ].plist && assets.files[ a ].plist.metadata ) {
						var textureAsset = assets.files[ assets.files[ a ].plist.metadata.textureFileName ];
						if ( textureAsset ) textureAsset.sliceMap = assets.files[ a ].plist;
					}
				}
				var canSelect = false;
				if ( prevObj && prevObj.textureMap != obj.textureMap ) {
					if ( !mults[ 'fxsprite-texture' ] ) {
						$( '#fxsprite-texture' ).prepend( '<option value="0" selected>- multiple -</option>' );
					}
					$( '#fxsprite-texture' ).val( '0' );
					mults[ 'fxsprite-texture' ] = true;
				} else if ( !mults[ 'fxsprite-texture' ] ) {
					var newVal = obj.textureMap;
					$( '#fxsprite-texture' ).val( newVal );
					canSelect = obj.textureMap && obj.material.map.sliceMap;
				}
				if ( canSelect ) {
					// fxdata
					$( '#fxsprite-data' ).empty().append( '<option value="">- no data -</option>' );
					for ( var a in assets.files ) {
						if ( assets.files[ a ].layerAnims ) {
							$( '#fxsprite-data' ).append( '<option value="' + a + '">' + a + '</option>' );
						}
					}
					if ( prevObj && prevObj.fxData != obj.fxData ) {
						if ( !mults[ 'fxsprite-data' ] ) {
							$( '#fxsprite-data' ).prepend( '<option value="0" selected>- multiple -</option>' );
						}
						$( '#fxsprite-data' ).val( '0' );
						mults[ 'fxsprite-data' ] = true;

						// disable animation dropdown
						$( '#fxsprite-animName' ).empty().append( '<option value="">- multiple -</option>' );

					} else if ( !mults[ 'fxsprite-data' ] ) {
						var newVal = obj.fxData;
						$( '#fxsprite-data' ).val( newVal );

						// populate anims dropdown
						$( '#fxsprite-animName' ).empty().append( '<option value="">- none -</option>' );
						if ( newVal ) {
							var anims = assets.files[ newVal ].frameLabels;
							for ( var a in anims ) {
								$( '#fxsprite-animName' ).append( '<option value="' + anims[ a ].l + '">' + anims[ a ].l + '</option>' );
							}
						}
						// set animname
						if ( prevObj && (prevObj.def[ 'animName' ] != obj.def[ 'animName' ]) ) {
							mults[ 'animName' ] = true;
						} else if ( !mults[ 'animName' ] ) {
							var animName = obj.def[ 'animName' ];
							if ( animName != undefined && obj.animNamed( animName ) ) {
								$( '#fxsprite-animName' ).val( animName );
							}
						}
					}
				} else {
					$( '#fxsprite-data' ).empty().append( '<option value="">- slice map required (Cocos2D sprite sheet .plist) -</option>' );
					$( '#fxsprite-animName' ).empty().append( '<option value="">- data required (FxSprite animation .json) -</option>' );
				}
				// anim options
				if ( prevObj && prevObj.def[ 'animOption' ] != obj.def[ 'animOption' ] ) {
					$( '#panel-fxsprite input[name=fxsprite-animOption]' ).addClass( 'multiple' ).attr( 'checked', false );
					mults[ 'animOption' ] = true;
				} else if ( !mults[ 'animOption' ] ) {
					var animOption = obj.def[ 'animOption' ] ? obj.def[ 'animOption' ] : 'gotoAndStop';
					$( '#panel-fxsprite input[value="' + animOption + '"]' )[ 0 ].checked = true;
				}
				if ( prevObj && prevObj.animSpeed != obj.animSpeed ) {
					$( '#fxsprite-animSpeed' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'animSpeed' ] = true;
				} else if ( !mults[ 'animSpeed' ] ) {
					var newVal = obj.animSpeed;
					$( '#fxsprite-animSpeed:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevObj && prevObj.def[ 'animFrame' ] != obj.def[ 'animFrame' ] ) {
					$( '#fxsprite-animFrame' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'animFrame' ] = true;
				} else if ( !mults[ 'animFrame' ] ) {
					var newVal = obj.def[ 'animFrame' ] ? obj.def[ 'animFrame' ] : 0;
					$( '#fxsprite-animFrame:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}

			}
			
			// custom properties
			if ( obj.props === undefined ) obj.props = [];
			var propsCont = $( '#props-container' );
			for ( var pi = 0, pl = obj.props.length; pi < pl; pi++ ) {
				var prop = obj.props[ pi ];
				var row = $( 'div.prop-row[alt="' + prop.name + '"]', propsCont );
				if ( !row.length ) {
					row = $( '<div class="prop-row" alt="' + prop.name + '">\
							<a>X</a><input type="text" name="name" size="14" value="' + prop.name + '"/>=\
							<select name="type"><option value="JSON">JSON</option><option value="Object3D">Object3D</option></select>\
							<input type="text" name="value" size="16"/></div>' );
					$( 'a', row ).click( editScene.propertyDeleteClicked );
					$( 'input[name="name"]', row ).change( editScene.propertyNameChanged ).on( 'keyup', this.blurOnEnter );
					$( 'select', row ).change( editScene.propertyTypeChanged );
					$( 'input[name="value"]', row ).change( editScene.propertyValueChanged ).on( 'keyup', this.blurOnEnter ).click( this.pickPropertyObjectClicked );
					propsCont.append( row );
				}
				if ( prevObj && prevObj.propByName( prop.name ).type != prop.type ) {
					if ( !$( 'select > option[value="multiple"]', row ).length ) $( 'select', row ).prepend( '<option value="multiple">- multiple -</option>' );
					$( 'select', row ).val( 'multiple' );
					mults[ 'prop-type-' + prop.name ] = true;
					$( 'input[name="value"]', row ).attr( 'disabled', 'disabled' );
				} else if ( !mults[ 'prop-type-' + prop.name ] ) {
					var newVal = prop.type;
					$( 'select', row ).val( prop.type );
					if ( newVal == 'Object3D' ) $( 'input[name="value"]', row ).attr( 'readonly', 'readonly' );
				}
				if ( prevObj && prevObj.propByName( prop.name ).name == undefined ) {
					row.addClass( 'multiple' );
					$( 'input, select, a', row ).attr( 'disabled', 'disabled' );
				}
				if ( prevObj && prevObj.propByName( prop.name ).value != prop.value ) {
					$( 'input[name="value"]', row ).attr( 'placeholder', 'multiple' ).val( '' ).data( 'prevVal', '' );
					mults[ 'prop-value-' + prop.name ] = true;
				} else if ( !mults[ 'prop-value-' + prop.name ] ) {
					var newVal = prop.value;
					if ( newVal instanceof THREE.Object3D ) newVal = newVal.name;
					$( 'input[name="value"]', row ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
			}
			$( '#props-container div.prop-row' ).each( function ( index, el ) {
				var propName = $( el ).attr( 'alt' );
				if ( !obj.propByName( propName ).name ) {
					$( el ).addClass( 'multiple' );
					$( 'input, select, a', el ).attr( 'disabled', 'disabled' );
				}
			} );
			
			// physics properties
			if ( obj.physics ) {
				
				if ( this.doc.physics == 'CANNON' ) {
					$( '#phys-type option.cannon-only' ).show();
				} else {
					$( '#phys-type option.cannon-only' ).hide();
				}
				
				// body type
				if ( prevPhysObj && prevPhysObj.def.bodyType != obj.def.bodyType ) {
					if ( !mults[ 'phys-type' ] ) {
						$( '#phys-type' ).prepend( '<option value="-" selected>- multiple -</option>' );
					}
					$( '#phys-type' ).val( '-' );
					mults[ 'phys-type' ] = true;
				} else if ( !mults[ 'phys-type' ] ) {
					var newVal = obj.def.bodyType ? obj.def.bodyType : '0';
					$( '#phys-type' ).val( newVal );
				}
				// mass
				if ( prevPhysObj && prevPhysObj.def.mass != obj.def.mass ) {
					$( '#phys-mass' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'phys-mass' ] = true;
				} else if ( !mults[ 'phys-mass' ] ) {
					var newVal = obj.def.mass ? obj.def.mass : 0;
					$( '#phys-mass:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				// damping
				if ( prevPhysObj && prevPhysObj.def.damping != obj.def.damping ) {
					$( '#phys-damping' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'phys-damping' ] = true;
				} else if ( !mults[ 'phys-damping' ] ) {
					var newVal = obj.def.damping ? obj.def.damping : 0;
					$( '#phys-damping:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				// fric
				if ( prevPhysObj && prevPhysObj.def.friction != obj.def.friction ) {
					$( '#phys-friction' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'phys-friction' ] = true;
				} else if ( !mults[ 'phys-friction' ] ) {
					var newVal = obj.def.friction;
					$( '#phys-friction:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				// restitution
				if ( prevPhysObj && prevPhysObj.def.restitution != obj.def.restitution ) {
					$( '#phys-restitution' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'phys-restitution' ] = true;
				} else if ( !mults[ 'phys-restitution' ] ) {
					var newVal = obj.def.restitution;
					$( '#phys-restitution:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				// fixed rot
				if ( prevPhysObj && prevPhysObj.def.fixedRotation != obj.def.fixedRotation ) {
					$( '#phys-fixed' ).addClass( 'multiple' )[ 0 ].checked = false;
					mults[ 'phys-fixed' ] = true;
				} else if ( !mults[ 'phys-fixed' ] ) {
					$( '#phys-fixed' )[ 0 ].checked = obj.def.fixedRotation;
				}
				// sensor
				if ( prevPhysObj && prevPhysObj.def.sensor != obj.def.sensor ) {
					$( '#phys-sensor' ).addClass( 'multiple' )[ 0 ].checked = false;
					mults[ 'phys-sensor' ] = true;
				} else if ( !mults[ 'phys-sensor' ] ) {
					$( '#phys-sensor' )[ 0 ].checked = obj.def.sensor;
				}
				if ( prevPhysObj && prevPhysObj.def.sleep != obj.def.sleep ) {
					$( '#phys-sleep' ).addClass( 'multiple' )[ 0 ].checked = false;
					mults[ 'phys-sleep' ] = true;
				} else if ( !mults[ 'phys-sleep' ] ) {
					$( '#phys-sleep' )[ 0 ].checked = obj.def.sleep;
				}
				// velocity
				if ( prevPhysObj && prevPhysObj.def.velocity[ 0 ] != obj.def.velocity[ 0 ] ) {
					$( '#phys-v0' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'phys-vx' ] = true;
				} else if ( !mults[ 'phys-vx' ] ) {
					var newVal = obj.def.velocity[ 0 ];
					$( '#phys-v0:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevPhysObj && prevPhysObj.def.velocity[ 1 ] != obj.def.velocity[ 1 ] ) {
					$( '#phys-v1' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'phys-vy' ] = true;
				} else if ( !mults[ 'phys-vy' ] ) {
					var newVal = obj.def.velocity[ 1 ];
					$( '#phys-v1:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevPhysObj && prevPhysObj.def.velocity[ 2 ] != obj.def.velocity[ 2 ] ) {
					$( '#phys-v2' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'phys-vz' ] = true;
				} else if ( !mults[ 'phys-vz' ] ) {
					var newVal = obj.def.velocity[ 2 ];
					$( '#phys-v2:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				// angular vel
				if ( prevPhysObj && prevPhysObj.def.angularVelocity[ 0 ] != obj.def.angularVelocity[ 0 ] ) {
					$( '#phys-rv0' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'phys-rvx' ] = true;
				} else if ( !mults[ 'phys-rvx' ] ) {
					var newVal = obj.def.angularVelocity[ 0 ];
					$( '#phys-rv0:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevPhysObj && prevPhysObj.def.angularVelocity[ 1 ] != obj.def.angularVelocity[ 1 ] ) {
					$( '#phys-rv1' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'phys-rvy' ] = true;
				} else if ( !mults[ 'phys-rvy' ] ) {
					var newVal = obj.def.angularVelocity[ 1 ];
					$( '#phys-rv1:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				if ( prevPhysObj && prevPhysObj.def.angularVelocity[ 2 ] != obj.def.angularVelocity[ 2 ] ) {
					$( '#phys-rv2' ).attr( 'placeholder', 'M' ).val( '' ).data( 'prevVal', '' );
					mults[ 'phys-rvz' ] = true;
				} else if ( !mults[ 'phys-rvz' ] ) {
					var newVal = obj.def.angularVelocity[ 2 ];
					$( '#phys-rv2:not(:focus)' ).attr( 'placeholder', '' ).val( newVal ).data( 'prevVal', newVal );
				}
				// collision group
				$( '#panel-physics input[name="collisionGroup"]' ).each( function ( i, el ) {
					if ( $( el ).hasClass( 'multiple' ) ) return;
					var thisBit = Math.pow( 2, i );
					el.checked = !!(obj.def.collisionGroup & thisBit);
					if ( prevPhysObj && !!(prevPhysObj.def.collisionGroup & thisBit) != el.checked ) {
						$( el ).addClass( 'multiple' );
						el.checked = false;
					}
				} );
				$( '#panel-physics input[name="collisionMask"]' ).each( function ( i, el ) {
					if ( $( el ).hasClass( 'multiple' ) ) return;
					var thisBit = Math.pow( 2, i );
					el.checked = !!(obj.def.collisionMask & thisBit);
					if ( prevPhysObj && !!(prevPhysObj.def.collisionMask & thisBit) != el.checked ) {
						$( el ).addClass( 'multiple' );
						el.checked = false;
					}
				} );
				
				prevPhysObj = obj;
			}
			
			
			// end loop
			prevObj = obj;
		}
		
		// common type
		if ( commonType == 'Camera' ) {
			$( '#panel-camera' ).show();
			if ( this.selectedObjects.length != 1 ) {
				$( '#cam-default,#cam-default~label:first' ).attr( 'disabled', 'disabled' ).addClass( 'multiple' ).removeAttr( 'checked' );
			} else {
				$( '#cam-default,#cam-default~label:first' ).removeAttr( 'disabled' ).removeClass( 'multiple' );
			}
		} else if ( commonType == 'Geometry' || commonType == 'CollisionShape' ) {
			$( '#panel-geometry' ).show();
		} else if ( commonType == 'Constraint' ) {
			$( '#panel-constraint' ).show();
		} else if ( commonType == 'PixelBox' ) {
			$( '#panel-pixelbox' ).show();
			if ( mults[ 'animName' ] ) {
				$( '#pixelbox-animName' ).prepend( '<option value="" selected="selected">- multiple -</option>' );
			}
		} else if ( commonType == 'LinePath' ) {
			$( '#panel-path' ).show();
		} else if ( commonType == 'Point' ) {
			$( '#panel-point' ).show();
		} else if ( commonType == 'FxSprite' ) {
			$( '#panel-fxsprite' ).show();
		}
		
		if ( (containsDirLights || containsHemiLights || containsPointLights || containsSpotLights) && !(containsFxSprites || containsAnchors || containsCameras || containsContainers || containsInstances || containsGeometry || containsPointClouds || containsPoints || containsPaths || containsCollisionShapes || containsConstraints) ) {
			$( '#panel-light' ).show();
			
			$( '#light-distance,#light-exponent,#light-angle' ).spinner( 'enable' );
			$( '#light-shadow-bias,#light-shadow-near,#light-shadow-far,#light-shadow-vol-width,#light-shadow-vol-height,#light-shadow-map-width,#light-shadow-map-height' ).spinner( 'enable' );
			
			if ( containsDirLights || containsPointLights || containsHemiLights ) $( '#light-exponent,#light-angle' ).spinner( 'disable' );
			if ( containsHemiLights ) $( '#light-distance' ).spinner( 'disable' );
			if ( containsHemiLights || containsPointLights ) {
				$( '#light-shadow-bias,#light-shadow-near,#light-shadow-far,#light-shadow-vol-width,#light-shadow-vol-height,#light-shadow-map-width,#light-shadow-map-height' ).spinner( 'disable' );
			}
			if ( containsDirLights ) $( '#light-distance' ).spinner( 'disable' );
			if ( containsSpotLights ) $( '#light-shadow-vol-width,#light-shadow-vol-height' ).spinner( 'disable' );
			if ( (containsDirLights || containsSpotLights) && !(containsHemiLights || containsPointLights) ) {
				$( '#light-target,#panel-light label[for="light-target"]:first' ).show();
			} else {
				$( '#light-target,#panel-light label[for="light-target"]:first' ).hide();
			}
		}
		
		// disable move if anchors selected
		if ( containsAnchors ) {
			$( '#panel-move input[type=text]' ).attr( 'disabled', 'disabled' ).spinner( 'disable' );
			$( '#panel-move input[type=checkbox]' ).attr( 'disabled', 'disabled' );
			$( '#look-at,#prop-name,#obj-from-cam' ).attr( 'disabled', 'disabled' );
		} else if ( containsPoints ) {
			$( '#panel-move input[type=text].rotation,#panel-move input[type=text].scale' ).attr( 'disabled', 'disabled' ).spinner( 'disable' );
			$( '#panel-move input[type=checkbox]' ).attr( 'disabled', 'disabled' );
			$( '#look-at,#prop-name,#obj-from-cam' ).attr( 'disabled', 'disabled' );
		} else if ( containsCollisionShapes || containsConstraints ) {
			$( '#panel-move input[type=checkbox]' ).not( '#prop-visible' ).attr( 'disabled', 'disabled' );
			// hide geometry sub-stuff
			$( '#panel-geometry .geom-only' ).hide();
		} else {
			$( '#panel-move input[type=text]' ).removeAttr( 'disabled' ).spinner( 'enable' );
			$( '#panel-move input[type=checkbox]' ).removeAttr( 'disabled' );
			$( '#look-at,#prop-name,#obj-from-cam' ).removeAttr( 'disabled' );
			$( '#panel-custom' ).show();
			// show geometry sub-stuff
			$( '#panel-geometry .geom-only' ).show();
		}
		
		// phys
		if ( this.doc.physics && !(containsDirLights || containsHemiLights || containsPointLights || containsSpotLights || containsAnchors || containsCameras || containsInstances || containsPoints || containsPaths || containsCollisionShapes || containsConstraints) && (containsContainers || containsGeometry || containsPointClouds) ) {
			$( '#prop-physics' ).removeAttr( 'disabled' );
			if ( $( '#prop-physics' )[ 0 ].checked ) $( '#panel-physics' ).show();
		} else {
			$( '#prop-physics' ).attr( 'disabled', 'disabled' );
		}
		
		if ( containsPaths ) {
			$( '#prop-cast-shadow,#prop-receive-shadow' ).attr( 'disabled', 'disabled' );
		}
		
		if ( containsInstances ) {
			$( '#prop-template,#prop-template~label:first' ).hide();
		} else {
			$( '#prop-template,#prop-template~label:first' ).show();
		}
		
		// only hemi lights have ground color
		$( '#light-ground-color' ).css( { display: ((containsSpotLights || containsDirLights || containsPointLights) ? 'none' : 'inline-block') } );
		
		if ( this.selectedObjects.length == 1 ) {
			$( '#obj-from-cam' ).removeAttr( 'disabled' );
		} else {
			$( '#obj-from-cam' ).attr( 'disabled', 'disabled' );
		}
		
		this.updateStoredPosition();
		
		// scroll to the same pos
		var cont = $( '#editor-props .panels' );
		prevScroll = Math.min( prevScroll, cont.prop( 'scrollHeight' ) - cont.innerHeight() );
		cont.scrollTop( prevScroll );
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- UI functions */
	
	/* create main editor UI*/
	addUI: function () {
// menu bar
		$( 'body' ).append(
			'<div id="menu-bar" class="absolute-pos upper-left editor">\
		<ul class="horizontal"><li>\
		<a id="file">File</a></li><li><a id="edit">Edit</a></li><li><a id="view">View</a></li><li><a id="help">Help</a></li></ul>\
		</div>\
		<ul class="editor absolute-pos submenu shortcuts" id="file-submenu">\
			<li id="file-new">New Scene</li>\
			<hr/>\
			<li id="file-load">Import</li>\
			<li id="file-export">Export<em><span class="ctrl"/> + E</em></li>\
			<hr/>\
			<li id="file-hold">Hold<em><span class="ctrl"/> + S</em></li>\
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
			<li><input type="radio" name="show-labels" value="all" id="show-labels-all"/><label for="show-labels-all" class="pad5">Show all labels</label></li>\
			<li><input type="radio" name="show-labels" value="selected" id="show-labels-selected"/><label for="show-labels-selected" class="pad5">Selected objects only</label></li>\
			<li><input type="radio" name="show-labels" value="none" id="show-labels-none"/><label for="show-labels-none" class="pad5">No labels</label></li><hr/>\
			<hr/><li id="reset-zoom">Reset zoom</li>\
		</ul>\
		<div class="editor absolute-pos upper-right pad5" id="undo-buttons">\
			<button id="redo">Redo</button>&nbsp;\
			<button id="undo">Undo</button>\
		</div>' );

// file menu
		$( '#file' ).click( function () {
			$( '.submenu' ).hide();
			var pos = $( this ).offset();
			pos.top += $( this ).height();
			$( '#file-submenu' ).css( pos ).show();
		} );
		$( '#file-new' ).click( editScene.newDoc.bind( editScene ) );
		$( '#file-load' ).click( editScene.loadDoc );
		$( '#file-export' ).click( editScene.saveDoc );
		$( '#file-reset' ).click( editScene.resetLocalStorage );
		$( '#file-hold' ).click( editScene.holdDoc );
		$( '#file-fetch' ).click( editScene.fetchDoc );
		$( '#file-submenu' ).menu().hide();
		
		// default label mode
		this.labelsVisible = localStorage_getItem( 'labelsVisible' );
		if ( this.labelsVisible === null ) this.labelsVisible = 1; // 0 = none, 1 = selected, 2 = all
		else this.labelsVisible = parseInt( this.labelsVisible );
		$( '#show-labels-' + [ 'none', 'selected', 'all' ][ this.labelsVisible ] ).attr( 'checked', 'checked' );
		$( '#view-submenu input[name=show-labels]' ).change( this.labelsVisibleChanged );

// edit menu
		$( '#edit' ).click( function () {
			$( '.submenu' ).hide();
			var pos = $( this ).offset();
			pos.top += $( this ).height();
			$( '#edit-submenu' ).css( pos ).show();
		} );
		$( '#edit-submenu' ).menu().hide();
		$( '#edit-delete' ).click( this.deleteSelection.bind( this ) );
		$( '#edit-copy' ).click( editScene.copySelection.bind( editScene ) );
		$( '#edit-cut' ).click( editScene.cutSelection.bind( editScene ) );
		$( '#edit-paste' ).click( editScene.pasteSelection.bind( editScene ) );
		$( '#edit-paste-into' ).click( editScene.pasteSelection.bind( editScene ) );

// view menu
		$( '#view' ).click( function () {
			$( '.submenu' ).hide();
			var pos = $( this ).offset();
			pos.top += $( this ).height();
			$( '#view-submenu' ).css( pos ).show();
		} );
		$( '#reset-zoom' ).click( editScene.resetZoom.bind( editScene ) );
		$( '#view-submenu' ).menu().hide();

// help menu
		$( '#help' ).click( editScene.showHelp );


// properties
		$( 'body' ).append(
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
			<input tabindex="10" type="checkbox" id="prop-template"/><label for="prop-template" class="w31">Template</label>\
			<input tabindex="11" type="checkbox" id="prop-physics"/><label for="prop-physics" class="w3">Physics</label><br/>\
			<hr/><input tabindex="12" type="checkbox" id="prop-cast-shadow"/><label for="prop-cast-shadow" class="w32">Cast Shadow</label>\
			<input tabindex="13" type="checkbox" id="prop-receive-shadow"/><label for="prop-receive-shadow" class="w32">Receive Shadow</label>\
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
		</div>' );

// common
		$( '#prop-name' ).change( this.nameChanged.bind( this ) );

// object3d
		function checkBoxValueChanged ( setValueFunc ) {
			return function ( e ) {
				var targ = $( e.target );
				setValueFunc.call( editScene, e.target.checked, e );
			}
		};
		$( '#panel-move input.position' ).spinner( {
			                                           step: 1,
			                                           change: this.positionSpinnerChange,
			                                           stop: this.positionSpinnerChange
		                                           } );//
		$( '#panel-move input.rotation' ).spinner( {
			                                           step: 5,
			                                           change: this.rotationSpinnerChange,
			                                           stop: this.rotationSpinnerChange
		                                           } );//
		$( '#panel-move input.scale' ).spinner( {
			                                        step: 0.25,
			                                        change: this.scaleSpinnerChange,
			                                        stop: this.scaleSpinnerChange
		                                        } );//
		$( '#prop-cast-shadow' ).click( checkBoxValueChanged( this.castShadowChanged ) );
		$( '#prop-receive-shadow' ).click( checkBoxValueChanged( this.receiveShadowChanged ) );
		$( '#prop-visible' ).change( this.visibleChanged );
		$( '#prop-template' ).change( this.templateChanged );
		$( '#prop-physics' ).change( this.physicsChanged );
		$( '#look-at' ).click( this.lookAtClicked );
		$( '#store-pos' ).click( this.storePosition );
		$( '#store-rot' ).click( this.storeRotation );
		$( '#store-scale' ).click( this.storeScale );
		$( '#clear-pos' ).click( this.clearStorePosition );
		$( '#clear-rot' ).click( this.clearStoreRotation );
		$( '#clear-scale' ).click( this.clearStoreScale );
		$( '#restore-pos' ).click( this.restorePosition.bind( this ) );
		$( '#obj-from-cam' ).click( this.transformObjectToCam.bind( this ) );
		$( '#obj-to-cam' ).click( this.transformCamToObject.bind( this ) );

// scene panel
		$( '#editor-props .panels' ).append( '<div id="panel-scene" class="panel"><h4>Scene</h4>\
			<label for="scene-max-shadows" class="w32 pad5 right-align">Max shadows</label><input tabindex="3" type="text" class="center" id="scene-max-shadows" size="1"/><span class="separator-left"/>\
			<select id="scene-physics" class="sub">\
			<option value="0">No physics</option>\
			<option value="CANNON">CANNON</option>\
			</select><br/>\
			<label class="w32 right-align pad5">Clear color</label><div id="scene-color" class="color-swatch"/><br/>\
			<label class="w32 right-align pad5">Ambient</label><div id="scene-ambient-color" class="color-swatch"/><br/>\
			<label class="w32 right-align pad5">Fog color</label><div id="scene-fog-color" class="color-swatch"/><br/>\
			<label for="scene-fog-near" class="w32 pad5 right-align">Fog Near</label><input tabindex="1" type="text" class="center" id="scene-fog-near" size="2"/>\
			<label for="scene-fog-far" class="w1 pad5 right-align"> Far</label><input tabindex="2" type="text" class="center" id="scene-fog-far" size="2"/>\
			</div>' );
		
		function valueChanged ( setValueFunc ) {
			return function ( e ) {
				var targ = $( e.target );
				// check if value actually changed
				var prevVal = targ.data( 'prevVal' ).toString();
				if ( targ.val().toString() === prevVal ) return;
				var newVal = parseFloat( targ.spinner( 'value' ) );
				if ( isNaN( newVal ) ) newVal = 0;
				setValueFunc.call( editScene, newVal, e );
				targ.data( 'prevVal', targ.val() );
			}
		};
		function textFieldValueChanged ( setValueFunc ) {
			return function ( e ) {
				var targ = $( e.target );
				// check if value actually changed
				var prevVal = targ.data( 'prevVal' ).toString();
				if ( targ.val().toString() === prevVal ) return;
				var newVal = targ.val();
				setValueFunc.call( editScene, newVal, e );
				targ.data( 'prevVal', targ.val() );
			}
		};
		var vc = valueChanged( this.setSceneMaxShadows );
		$( '#scene-max-shadows' ).spinner( { step: 1, min: 0, max: 8, change: vc, stop: vc } );
		$( '#scene-physics' ).change( this.scenePhysicsChanged );
		vc = valueChanged( this.setSceneFogNear );
		$( '#scene-fog-near' ).spinner( { step: 10, min: 0, change: vc, stop: vc } );//
		vc = valueChanged( this.setSceneFogFar );
		$( '#scene-fog-far' ).spinner( { step: 10, min: 0, change: vc, stop: vc } );//
		function colorPickerOnShow ( dom ) {
			$( dom ).css( { zIndex: 10000001 } );
			var src = $( this );
			var css = src.css( 'background-color' );
			var top = parseInt( $( dom ).css( 'top' ) ), height = $( dom ).outerHeight();
			if ( top + height > window.innerHeight ) $( dom ).css( 'top', window.innerHeight - height );
			if ( css != 'transparent' ) {
				var clr = new THREE.Color( css );
				var hex = clr.getHexString();
				$( src ).data( 'prevVal', hex );
				src.colpickSetColor( hex, true );
			}
		};
		$( '#scene-color' ).colpick( {
			                             colorScheme: 'dark',
			                             onShow: colorPickerOnShow,
			                             onHide: function () {
				                             editScene.clearColor = editScene.doc.clearColor.getHex();
				                             /* revert */
			                             },
			                             onSubmit: function ( hsb, hex, rgb, el ) {
				                             editScene.setSceneClearColor( hex );
				                             $( el ).colpickHide();
			                             },
			                             onChange: function ( hsb, hex, rgb, el ) {
				                             editScene.clearColor = parseInt( hex, 16 );
			                             }
		                             } );
		$( '#scene-ambient-color' ).colpick( {
			                                     colorScheme: 'dark',
			                                     onShow: colorPickerOnShow,
			                                     onHide: function () {
				                                     editScene.ambient.color.copy( editScene.doc.ambient );
				                                     /* revert */
			                                     },
			                                     onSubmit: function ( hsb, hex, rgb, el ) {
				                                     editScene.setSceneAmbientColor( hex );
				                                     $( el ).colpickHide();
			                                     },
			                                     onChange: function ( hsb, hex, rgb, el ) {
				                                     editScene.ambient.color.setHex( parseInt( hex, 16 ) );
			                                     }
		                                     } );
		$( '#scene-fog-color' ).colpick( {
			                                 colorScheme: 'dark',
			                                 onShow: colorPickerOnShow,
			                                 onHide: function () {
				                                 editScene.scene.fog.color.copy( editScene.doc.fogColor );
				                                 /* revert */
			                                 },
			                                 onSubmit: function ( hsb, hex, rgb, el ) {
				                                 editScene.setSceneFogColor( hex );
				                                 $( el ).colpickHide();
			                                 },
			                                 onChange: function ( hsb, hex, rgb, el ) {
				                                 editScene.scene.fog.color.setHex( parseInt( hex, 16 ) );
			                                 }
		                                 } );

// scene physics
		$( '#editor-props .panels' ).append( '<div id="panel-scene-physics" class="panel"><h4>Physics</h4>\
			<!--<label for="scene-broadphase" class="w32 align-right">Broadphase</label> <select id="scene-broadphase" class="sub">\
			<option value="0">NaiveBroadphase</option>\
			<option value="SAPBroadphase">SAPBroadphase</option>\
			</select><hr/>-->\
			<label for="phys-grav-x" class="w3 pad5 right-align">Gravity X</label><input tabindex="0" type="text" class="center gravity" id="phys-grav-x" size="1"/>\
			<label for="phys-grav-y" class="pad5 right-align">Y</label><input tabindex="1" type="text" class="center gravity" id="phys-grav-y" size="1"/>\
			<label for="phys-grav-z" class="pad5 right-align">Z</label><input tabindex="2" type="text" class="center gravity" id="phys-grav-z" size="1"/>\
			</div>' );
		vc = valueChanged( this.sceneGravityChanged );
		$( '#panel-scene-physics input.gravity' ).spinner( { step: 1, change: vc, stop: vc } );
		$( '#scene-broadphase' ).change( this.sceneBroadphaseChanged );

// body physics
		$( '#editor-props .panels' ).append( '<div id="panel-physics" class="panel"><h4>Physics</h4>\
			<label for="phys-type" class="w31 right-align">Body type&nbsp;</label><select id="phys-type">\
			<option value="0">Dynamic</option>\
			<option value="1">Static</option>\
			<option value="2" class="cannon-only">Kinematic</option>\
			</select><hr/>\
			<span class="sub w5">\
			<a id="phys-add-shape">+ add collision shape</a></span>\
			<span class="sub right-align w4">\
			<a id="phys-add-constraint">+ add constraint</a></span>\
			<hr/>\
			<label for="phys-mass" class="w31 right-align">Mass</label><input tabindex="0" type="text" class="center" id="phys-mass" size="1"/>\
			<label for="phys-damping" class="right-align">&nbsp;&nbsp;Linear Damping</label><input tabindex="1" type="text" class="center" id="phys-damping" size="1"/><br/>\
			<hr/>\
			<input tabindex="2" type="checkbox" id="phys-fixed"/><label for="phys-fixed" class="w33">Fixed Rotation</label>\
			<input tabindex="3" type="checkbox" id="phys-sensor"/><label for="phys-sensor" class="w3">Sensor</label>\
			<input tabindex="4" type="checkbox" id="phys-sleep"/><label for="phys-sleep" class="w3">Sleep</label>\
			<hr/>\
			<label for="phys-v0" class="w31 right-align">Velocity X</label><input tabindex="5" type="text" class="center vel" id="phys-v0" size="1"/>\
			<label for="prop-rv0" class="right-align">&nbsp;Rot Velocity X</label><input tabindex="8" type="text" class="center rvel" id="phys-rv0" size="1"/>\
			<label for="phys-v1" class="w31 right-align">Velocity Y</label><input tabindex="6" type="text" class="center vel" id="phys-v1" size="1"/>\
			<label for="prop-rv1" class="right-align">&nbsp;Rot Velocity Y</label><input tabindex="9" type="text" class="center rvel" id="phys-rv1" size="1"/>\
			<label for="phys-v2" class="w31 right-align">Velocity Z</label><input tabindex="7" type="text" class="center vel" id="phys-v2" size="1"/>\
			<label for="prop-rv2" class="right-align">&nbsp;Rot Velocity Z</label><input tabindex="10" type="text" class="center rvel" id="phys-rv2" size="1"/>\
			<hr/>\
			<label class="w32 pad5 right-align">Coll. group</label>\
			<input name="collisionGroup" type="checkbox" alt="0" class="coll"/>\
			<input name="collisionGroup" type="checkbox" alt="1" class="coll"/>\
			<input name="collisionGroup" type="checkbox" alt="2" class="coll"/>\
			<input name="collisionGroup" type="checkbox" alt="3" class="coll"/>\
			<input name="collisionGroup" type="checkbox" alt="4" class="coll"/>\
			<input name="collisionGroup" type="checkbox" alt="5" class="coll"/>\
			<input name="collisionGroup" type="checkbox" alt="6" class="coll"/>\
			<input name="collisionGroup" type="checkbox" alt="7" class="coll"/>\
			<input name="collisionGroup" type="checkbox" alt="8" class="coll"/><br/>\
			<label class="w32 pad5 right-align">Collides with</label>\
			<input name="collisionMask" type="checkbox" alt="0" class="coll"/>\
			<input name="collisionMask" type="checkbox" alt="1" class="coll"/>\
			<input name="collisionMask" type="checkbox" alt="2" class="coll"/>\
			<input name="collisionMask" type="checkbox" alt="3" class="coll"/>\
			<input name="collisionMask" type="checkbox" alt="4" class="coll"/>\
			<input name="collisionMask" type="checkbox" alt="5" class="coll"/>\
			<input name="collisionMask" type="checkbox" alt="6" class="coll"/>\
			<input name="collisionMask" type="checkbox" alt="7" class="coll"/>\
			<input name="collisionMask" type="checkbox" alt="8" class="coll"/>\
			<hr/>\
			<label for="phys-friction" class="w31 right-align">Friction</label><input tabindex="11" type="text" class="center" id="phys-friction" size="1"/>\
			<label for="phys-restitution" class="right-align">&nbsp;&nbsp;Restitution</label><input tabindex="12" type="text" class="center" id="phys-restitution" size="1"/>\
			</div>' );
		
		$( '#phys-add-shape' ).click( this.addCollisionShape.bind( this ) );
		$( '#phys-add-constraint' ).click( this.addConstraint.bind( this ) );
		
		vc = valueChanged( this.velocityChanged );
		$( '#panel-physics .vel' ).spinner( { change: vc, stop: vc } );
		vc = valueChanged( this.frictionChanged );
		$( '#phys-friction' ).spinner( { step: 0.1, change: vc, stop: vc } );
		vc = valueChanged( this.restitutionChanged );
		$( '#phys-restitution' ).spinner( { step: 0.1, change: vc, stop: vc } );
		vc = valueChanged( this.angularVelocityChanged );
		$( '#panel-physics .rvel' ).spinner( { change: vc, stop: vc } );
		vc = valueChanged( this.massChanged );
		$( '#panel-physics #phys-mass' ).spinner( { min: 0, change: vc, stop: vc } );
		vc = valueChanged( this.dampingChanged );
		$( '#panel-physics #phys-damping' ).spinner( { step: 0.05, min: 0, change: vc, stop: vc } );
		$( '#phys-fixed' ).change( checkBoxValueChanged( this.fixedRotationChanged ) );
		$( '#phys-sensor' ).change( checkBoxValueChanged( this.sensorChanged ) );
		$( '#phys-sleep' ).change( checkBoxValueChanged( this.sleepChanged ) );
		$( '#phys-type' ).change( this.bodyTypeChanged.bind( this ) );
		$( '#panel-physics input.coll' ).change( this.collisionChanged.bind( this ) );

// camera panel
		$( '#editor-props .panels' ).append( '<div id="panel-camera" class="panel"><h4>Camera</h4>\
			<input tabindex="3" type="checkbox" id="cam-default"/><label for="cam-default" class="w3">Default camera</label>\
			<hr/>\
			<label for="cam-fov" class="w1 pad5 right-align">FOV</label><input tabindex="0" type="text" class="center" id="cam-fov" size="1"/>\
			<label for="cam-zoom" class="w1 pad5 right-align">Zoom</label><input tabindex="0" type="text" class="center" id="cam-zoom" size="1"/><br/>\
			<label for="cam-near" class="w1 pad5 right-align">Near</label><input tabindex="1" type="text" class="center" id="cam-near" size="2"/>\
			<label for="cam-far" class="w1 pad5 right-align"> Far</label><input tabindex="2" type="text" class="center" id="cam-far" size="2"/><br/>\
			</div>' );
		var vc = valueChanged( this.cameraFovChanged );
		$( '#cam-fov' ).spinner( { step: 5, min: 1, max: 180, change: vc, stop: vc } );
		var vc = valueChanged( this.cameraZoomChanged );
		$( '#cam-zoom' ).spinner( { step: 1, min: 1, change: vc, stop: vc } );
		vc = valueChanged( this.cameraNearChanged );
		$( '#cam-near' ).spinner( { step: 10, min: 0, change: vc, stop: vc } );//
		vc = valueChanged( this.cameraFarChanged );
		$( '#cam-far' ).spinner( { step: 10, min: 1, change: vc, stop: vc } );//
		$( '#cam-default' ).click( this.cameraDefaultChanged );

// Light panel
		$( '#editor-props .panels' ).append( '<div id="panel-light" class="panel"><h4>Light</h4>\
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
			<label for="light-shadow-bias" class="w32 pad5 right-align">Shadow Bias</label><input tabindex="0" type="text" class="center" id="light-shadow-bias" size="8"/>\
			</div>' );
		
		$( '#light-target' ).click( this.lookAtClicked );
		$( '#light-color' ).colpick( {
			                             colorScheme: 'dark',
			                             onShow: function ( dom ) {
				                             $( dom ).css( { zIndex: 10000001 } );
				                             var src = $( this );
				                             var css = src.css( 'background-color' );
				                             var top = parseInt( $( dom ).css( 'top' ) ), height = $( dom ).outerHeight();
				                             if ( top + height > window.innerHeight ) $( dom ).css( 'top', window.innerHeight - height );
				                             // store preselection color
				                             for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
					                             var obj = editScene.selectedObjects[ i ];
					                             obj.storedColor = obj.color.getHex();
				                             }
				                             if ( css != 'transparent' ) {
					                             var clr = new THREE.Color( css );
					                             var hex = clr.getHexString();
					                             $( src ).data( 'prevVal', hex );
					                             src.colpickSetColor( hex, true );
				                             }
			                             },
			                             onHide: function () {
				                             for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
					                             var obj = editScene.selectedObjects[ i ];
					                             obj.color.setHex( obj.storedColor );
				                             }
			                             },
			                             onSubmit: function ( hsb, hex, rgb, el ) {
				                             editScene.setLightColor( parseInt( hex, 16 ) );
				                             $( '#light-color' ).css( { backgroundColor: '#' + hex } );
				                             $( el ).colpickHide();
			                             },
			                             onChange: function ( hsb, hex, rgb, el ) {
				                             var newColor = parseInt( hex, 16 );
				                             for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
					                             var obj = editScene.selectedObjects[ i ];
					                             obj.color.setHex( newColor );
				                             }
			                             }
		                             } );
		$( '#light-ground-color' ).colpick( {
			                                    colorScheme: 'dark',
			                                    onShow: function ( dom ) {
				                                    $( dom ).css( { zIndex: 10000001 } );
				                                    var src = $( this );
				                                    var css = src.css( 'background-color' );
				                                    var top = parseInt( $( dom ).css( 'top' ) ), height = $( dom ).outerHeight();
				                                    if ( top + height > window.innerHeight ) $( dom ).css( 'top', window.innerHeight - height );
				                                    // store preselection color
				                                    for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
					                                    var obj = editScene.selectedObjects[ i ];
					                                    obj.storedColor = obj.groundColor.getHex();
				                                    }
				                                    if ( css != 'transparent' ) {
					                                    var clr = new THREE.Color( css );
					                                    var hex = clr.getHexString();
					                                    $( src ).data( 'prevVal', hex );
					                                    src.colpickSetColor( hex, true );
				                                    }
			                                    },
			                                    onHide: function () {
				                                    for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
					                                    var obj = editScene.selectedObjects[ i ];
					                                    obj.groundColor.setHex( obj.storedColor );
				                                    }
			                                    },
			                                    onSubmit: function ( hsb, hex, rgb, el ) {
				                                    editScene.setGroundLightColor( parseInt( hex, 16 ) );
				                                    $( el ).colpickHide();
				                                    $( '#light-ground-color' ).css( { backgroundColor: '#' + hex } );
			                                    },
			                                    onChange: function ( hsb, hex, rgb, el ) {
				                                    var newColor = parseInt( hex, 16 );
				                                    for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
					                                    var obj = editScene.selectedObjects[ i ];
					                                    obj.groundColor.setHex( newColor );
				                                    }
			                                    }
		                                    } );
		vc = valueChanged( this.lightIntensityChanged );
		$( '#light-intensity' ).spinner( { step: 0.1, min: 0, change: vc, stop: vc } );
		vc = valueChanged( this.lightDistanceChanged );
		$( '#light-distance' ).spinner( { step: 1, min: 0, change: vc, stop: vc } );
		vc = valueChanged( this.lightExponentChanged );
		$( '#light-exponent' ).spinner( { step: 1, min: 0, change: vc, stop: vc } );
		vc = valueChanged( this.lightAngleChanged );
		$( '#light-angle' ).spinner( { step: 5, min: 0, max: 180, change: vc, stop: vc } );
		
		vc = valueChanged( this.lightShadowBiasChanged );
		$( '#light-shadow-bias' ).spinner( { step: 0.0001, change: vc, stop: vc } );
		vc = valueChanged( this.lightShadowNearChanged );
		$( '#light-shadow-near' ).spinner( { step: 1, min: 0, change: vc, stop: vc } );
		vc = valueChanged( this.lightShadowFarChanged );
		$( '#light-shadow-far' ).spinner( { step: 1, min: 1, change: vc, stop: vc } );
		vc = valueChanged( this.lightShadowVolWidthChanged );
		$( '#light-shadow-vol-width' ).spinner( { step: 1, min: 1, change: vc, stop: vc } );
		vc = valueChanged( this.lightShadowVolHeightChanged );
		$( '#light-shadow-vol-height' ).spinner( { step: 1, min: 1, change: vc, stop: vc } );
		vc = valueChanged( this.lightShadowMapWidthChanged );
		$( '#light-shadow-map-width' ).spinner( { step: 256, min: 64, max: 2048, change: vc, stop: vc } );
		vc = valueChanged( this.lightShadowMapHeightChanged );
		$( '#light-shadow-map-height' ).spinner( { step: 256, min: 64, max: 2048, change: vc, stop: vc } );

// FxSprite panel
		$( '#editor-props .panels' ).append( '<div id="panel-fxsprite" class="panel"><h4>FxSprite</h4>\
			<label class="w32 right-align pad5">Color tint</label><div id="fxsprite-tint" class="color-swatch"/>\
			<label class="w31 right-align pad5">Add</label><div id="fxsprite-addColor" class="color-swatch"/><br/>\
			<label for="fxsprite-alpha" class="w32 pad5 right-align">Alpha</label><input tabindex="0" type="text" class="center" id="fxsprite-alpha" size="1"/>\
			<label for="fxsprite-alphaThresh" class="w32 pad5 right-align">Alpha Thresh</label><input tabindex="0" type="text" class="center" id="fxsprite-alphaThresh" size="1"/><br/>\
			<label for="fxsprite-brightness" class="w32 pad5 right-align">Brightness</label><input tabindex="2" type="text" class="center" id="fxsprite-brightness" size="1"/>\
			<label for="fxsprite-stipple" class="w32 pad5 right-align">Stipple</label><input tabindex="2" type="text" class="center" id="fxsprite-stipple" size="1"/><br/>\
			<hr/>\
			<label for="fxsprite-scaleX" class="w32 pad5 right-align">Scale X</label><input type="text" class="center" id="fxsprite-scaleX" size="1"/>\
			<label for="fxsprite-scaleY" class="w2 pad5 right-align">Y</label><input type="text" class="center" id="fxsprite-scaleY" size="1"/>\
			<label for="fxsprite-angle" class="w32 pad5 right-align">Angle</label><input type="text" class="center" id="fxsprite-angle" size="2"/>\
			<hr/>\
			<label class="w31 right-align pad5">Texture</label><select id="fxsprite-texture"></select><br/>\
			<label class="w31 right-align pad5">Data</label><select id="fxsprite-data"></select>\
			<hr/>\
			<label for="fxsprite-animSpeed" class="w4 pad5 right-align">Animation speed</label><input tabindex="7" type="text" class="center" id="fxsprite-animSpeed" size="1"/>\
			<a id="anim-restart2" class="sub float-right">restart all</a><br/>\
			<input type="radio" name="fxsprite-animOption" tabindex="7" id="fxsprite-gotoAndStop" value="gotoAndStop"/>\
			<label for="fxsprite-gotoAndStop" class="w32 pad5 left-align">gotoAndStop</label>\
			<input type="radio" name="fxsprite-animOption" tabindex="8" id="fxsprite-playAnim" value="playAnim"/>\
			<label for="fxsprite-playAnim" class="w32 pad5 left-align">playAnim</label><br/>\
			<input type="radio" name="fxsprite-animOption" tabindex="9" id="fxsprite-loopAnim" value="loopAnim"/>\
			<label for="fxsprite-loopAnim" class="w32 pad5 left-align">loopAnim</label>\
			<input type="radio" name="fxsprite-animOption" tabindex="10" id="fxsprite-loopFrom" value="loopFrom"/>\
			<label for="fxsprite-loopFrom" class="w32 pad5 left-align">loopFrom</label><br/>\
			<label class="w1 right-align pad5">Anim </label><select id="fxsprite-animName" tabindex="11" class="w4"/>\
			<label for="fxsprite-animFrame" class="w2 right-align pad5">Frame</label><input tabindex="12" class="center" type="text" id="fxsprite-animFrame" size="1"/>\
			</div>');

		vc = valueChanged( this.geometryStippleChanged );
		$( '#fxsprite-stipple' ).spinner( { step: 1, min: 0, max: 2, change: vc, stop: vc } );
		vc = valueChanged( this.fxspriteAlphaChanged );
		$( '#fxsprite-alpha' ).spinner( { step: 0.1, min: 0, max: 1, change: vc, stop: vc } );
		vc = valueChanged( this.fxspriteAlphaThreshChanged );
		$( '#fxsprite-alphaThresh' ).spinner( { step: 0.1, min: 0, max: 1, change: vc, stop: vc } );
		vc = valueChanged( this.fxspriteBrightnessChanged );
		$( '#fxsprite-brightness' ).spinner( { step: 0.1, change: vc, stop: vc } );
		vc = valueChanged( this.fxspriteScaleXChanged );
		$( '#fxsprite-scaleX' ).spinner( { step: 0.1, change: vc, stop: vc } );
		vc = valueChanged( this.fxspriteScaleYChanged );
		$( '#fxsprite-scaleY' ).spinner( { step: 0.1, change: vc, stop: vc } );
		vc = valueChanged( this.fxspriteAngleChanged );
		$( '#fxsprite-angle' ).spinner( { step: 1, change: vc, stop: vc } );

		$( '#fxsprite-texture' ).change( this.geometryTextureChanged );
		$( '#fxsprite-tint' ).colpick( {
               colorScheme: 'dark',
               onShow: function ( dom ) {
                   $( dom ).css( { zIndex: 10000001 } );
                   var src = $( this );
                   var css = src.css( 'background-color' );
                   var top = parseInt( $( dom ).css( 'top' ) ), height = $( dom ).outerHeight();
                   if ( top + height > window.innerHeight ) $( dom ).css( 'top', window.innerHeight - height );
                   // store preselection color
                   for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
                       var obj = editScene.selectedObjects[ i ];
                       obj.storedColor = obj.material.tint.getHex();
                   }
                   if ( css != 'transparent' ) {
                       var clr = new THREE.Color( css );
                       var hex = clr.getHexString();
                       $( src ).data( 'prevVal', hex );
                       src.colpickSetColor( hex, true );
                   }
               },
               onHide: function () {
                   for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
                       var obj = editScene.selectedObjects[ i ];
                       obj.tint.setHex( obj.storedColor );
                   }
               },
               onSubmit: function ( hsb, hex, rgb, el ) {
                   editScene.setFxSpriteTint( parseInt( hex, 16 ) );
                   $( '#fxsprite-tint' ).css( { backgroundColor: '#' + hex } );
                   $( el ).colpickHide();
               },
               onChange: function ( hsb, hex, rgb, el ) {
                   var newColor = parseInt( hex, 16 );
                   for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
                       var obj = editScene.selectedObjects[ i ];
                       obj.tint.setHex( newColor );
                   }
               }
           } );
		$( '#fxsprite-addColor' ).colpick( {
               colorScheme: 'dark',
               onShow: function ( dom ) {
                   $( dom ).css( { zIndex: 10000001 } );
                   var src = $( this );
                   var css = src.css( 'background-color' );
                   var top = parseInt( $( dom ).css( 'top' ) ), height = $( dom ).outerHeight();
                   if ( top + height > window.innerHeight ) $( dom ).css( 'top', window.innerHeight - height );
                   // store preselection color
                   for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
                       var obj = editScene.selectedObjects[ i ];
                       obj.storedColor = obj.material.addColor.getHex();
                   }
                   if ( css != 'transparent' ) {
                       var clr = new THREE.Color( css );
                       var hex = clr.getHexString();
                       $( src ).data( 'prevVal', hex );
                       src.colpickSetColor( hex, true );
                   }
               },
               onHide: function () {
                   for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
                       var obj = editScene.selectedObjects[ i ];
                       obj.addColor.setHex( obj.storedColor );
                   }
               },
               onSubmit: function ( hsb, hex, rgb, el ) {
                   editScene.setFxSpriteAddColor( parseInt( hex, 16 ) );
                   $( '#fxsprite-addColor' ).css( { backgroundColor: '#' + hex } );
                   $( el ).colpickHide();
               },
               onChange: function ( hsb, hex, rgb, el ) {
                   var newColor = parseInt( hex, 16 );
                   for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
                       var obj = editScene.selectedObjects[ i ];
                       obj.addColor.setHex( newColor );
                   }
               }
           } );

		vc = valueChanged( this.pixelboxAnimSpeedChanged );
		$( '#fxsprite-animSpeed' ).spinner( { step: 0.1, change: vc, stop: vc } );
		$( '#panel-fxsprite input[name=fxsprite-animOption]' ).click( this.pixelboxAnimTypeChanged );
		vc = valueChanged( this.pixelboxStartFrameChanged );
		$( '#fxsprite-animFrame' ).spinner( { step: 1, min: 0, change: vc, stop: vc } );
		$( '#fxsprite-animName' ).change( this.pixelboxAnimNameChanged );
		$( '#fxsprite-data' ).change( this.fxSpriteDataChanged );

// Pixelbox panel
		$( '#editor-props .panels' ).append( '<div id="panel-pixelbox" class="panel"><h4>PixelBox</h4>\
			<label for="pixelbox-pointSize" class="w32 pad5 right-align">Point size</label><input tabindex="0" type="text" class="center" id="pixelbox-pointSize" size="1"/>\
			<label for="pixelbox-stipple" class="w32 pad5 right-align">Stipple</label><input tabindex="1" type="text" class="center" id="pixelbox-stipple" size="1"/><br/>\
			<label for="pixelbox-alpha" class="w32 pad5 right-align">Alpha</label><input tabindex="2" type="text" class="center" id="pixelbox-alpha" size="1"/>\
			<label for="pixelbox-occlusion" class="w32 pad5 right-align">Occlusion</label><input tabindex="3" type="text" class="center" id="pixelbox-occlusion" size="1"/><hr/>\
			<label class="w32 right-align pad5">Color tint</label><div id="pixelbox-tint" class="color-swatch"/>\
			<label class="w31 right-align pad5">Add</label><div id="pixelbox-add" class="color-swatch"/><hr/>\
			<input tabindex="4" type="checkbox" id="pixelbox-cullBack"/><label for="pixelbox-cullBack" class="w3">Cull backface</label>\
			<label class="w4 right-align" for="pixelbox-group">Static group</label> <input type="text" id="pixelbox-group" size="7" tabindex="6">\
			<hr/>\
			<label for="pixelbox-animSpeed" class="w4 pad5 right-align">Animation speed</label><input tabindex="7" type="text" class="center" id="pixelbox-animSpeed" size="1"/>\
			<a id="anim-restart" class="sub float-right">restart all</a><br/>\
			<input type="radio" name="pixelbox-animOption" tabindex="7" id="pixelbox-gotoAndStop" value="gotoAndStop"/>\
			<label for="pixelbox-gotoAndStop" class="w32 pad5 left-align">gotoAndStop</label>\
			<input type="radio" name="pixelbox-animOption" tabindex="8" id="pixelbox-playAnim" value="playAnim"/>\
			<label for="pixelbox-playAnim" class="w32 pad5 left-align">playAnim</label><br/>\
			<input type="radio" name="pixelbox-animOption" tabindex="9" id="pixelbox-loopAnim" value="loopAnim"/>\
			<label for="pixelbox-loopAnim" class="w32 pad5 left-align">loopAnim</label>\
			<input type="radio" name="pixelbox-animOption" tabindex="10" id="pixelbox-loopFrom" value="loopFrom"/>\
			<label for="pixelbox-loopFrom" class="w32 pad5 left-align">loopFrom</label><br/>\
			<label class="w1 right-align pad5">Anim </label><select id="pixelbox-animName" tabindex="11" class="w4"/>\
			<label for="pixelbox-animFrame" class="w2 right-align pad5">Frame</label><input tabindex="12" class="center" type="text" id="pixelbox-animFrame" size="1"/>\
			</div>' );
		
		$( '#anim-restart,#anim-restart2' ).click( this.restartAllAnims );
		vc = valueChanged( this.pixelboxPointSizeChanged );
		$( '#pixelbox-pointSize' ).spinner( { step: 0.1, min: 0, change: vc, stop: vc } );
		vc = valueChanged( this.pixelboxStippleChanged );
		$( '#pixelbox-stipple' ).spinner( { step: 1, min: 0, max: 2, change: vc, stop: vc } );
		vc = valueChanged( this.pixelboxAlphaChanged );
		$( '#pixelbox-alpha' ).spinner( { step: 0.1, min: 0, max: 1, change: vc, stop: vc } );
		vc = valueChanged( this.pixelboxOcclusionChanged );
		$( '#pixelbox-occlusion' ).spinner( { step: 0.1, min: 0, max: 1, change: vc, stop: vc } );
		$( '#pixelbox-cullBack' ).click( this.pixelboxCullBackChanged );
		
		vc = textFieldValueChanged( this.pixelboxGroupChanged.bind( this ) );
		$( '#pixelbox-group' ).change( vc ).keydown( function ( e ) {
			$( e.target ).attr( 'placeholder', '' );
			if ( e.which == 13 ) $( e.target ).data( 'prevVal', Math.random() ).trigger( 'change' ).blur();
		} );
		
		vc = valueChanged( this.pixelboxAnimSpeedChanged );
		$( '#pixelbox-animSpeed' ).spinner( { step: 0.1, change: vc, stop: vc } );
		$( '#panel-pixelbox input[name=pixelbox-animOption]' ).click( this.pixelboxAnimTypeChanged );
		vc = valueChanged( this.pixelboxStartFrameChanged );
		$( '#pixelbox-animFrame' ).spinner( { step: 1, min: 0, change: vc, stop: vc } );
		$( '#pixelbox-animName' ).change( this.pixelboxAnimNameChanged );
		$( '#pixelbox-tint' ).colpick( {
			                               colorScheme: 'dark',
			                               onShow: function ( dom ) {
				                               $( dom ).css( { zIndex: 10000001 } );
				                               var src = $( this );
				                               var css = src.css( 'background-color' );
				                               var top = parseInt( $( dom ).css( 'top' ) ), height = $( dom ).outerHeight();
				                               if ( top + height > window.innerHeight ) $( dom ).css( 'top', window.innerHeight - height );
				                               // store preselection color
				                               for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
					                               var obj = editScene.selectedObjects[ i ];
					                               obj.storedColor = obj.tint.getHex();
				                               }
				                               if ( css != 'transparent' ) {
					                               var clr = new THREE.Color( css );
					                               var hex = clr.getHexString();
					                               $( src ).data( 'prevVal', hex );
					                               src.colpickSetColor( hex, true );
				                               }
			                               },
			                               onHide: function () {
				                               for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
					                               var obj = editScene.selectedObjects[ i ];
					                               obj.tint.setHex( obj.storedColor );
				                               }
			                               },
			                               onSubmit: function ( hsb, hex, rgb, el ) {
				                               editScene.pixelboxSetTint( parseInt( hex, 16 ) );
				                               $( el ).colpickHide();
				                               $( '#pixelbox-tint' ).css( { backgroundColor: '#' + hex } );
			                               },
			                               onChange: function ( hsb, hex, rgb, el ) {
				                               var newColor = parseInt( hex, 16 );
				                               for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
					                               var obj = editScene.selectedObjects[ i ];
					                               obj.tint.setHex( newColor );
				                               }
			                               }
		                               } );
		$( '#pixelbox-add' ).colpick( {
			                              colorScheme: 'dark',
			                              onShow: function ( dom ) {
				                              $( dom ).css( { zIndex: 10000001 } );
				                              var src = $( this );
				                              var css = src.css( 'background-color' );
				                              var top = parseInt( $( dom ).css( 'top' ) ), height = $( dom ).outerHeight();
				                              if ( top + height > window.innerHeight ) $( dom ).css( 'top', window.innerHeight - height );
				                              // store preselection color
				                              for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
					                              var obj = editScene.selectedObjects[ i ];
					                              obj.storedColor = obj.addColor.getHex();
				                              }
				                              if ( css != 'transparent' ) {
					                              var clr = new THREE.Color( css );
					                              var hex = clr.getHexString();
					                              $( src ).data( 'prevVal', hex );
					                              src.colpickSetColor( hex, true );
				                              }
			                              },
			                              onHide: function () {
				                              for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
					                              var obj = editScene.selectedObjects[ i ];
					                              obj.addColor.setHex( obj.storedColor );
				                              }
			                              },
			                              onSubmit: function ( hsb, hex, rgb, el ) {
				                              editScene.pixelboxSetAddColor( parseInt( hex, 16 ) );
				                              $( el ).colpickHide();
				                              $( '#pixelbox-add' ).css( { backgroundColor: '#' + hex } );
			                              },
			                              onChange: function ( hsb, hex, rgb, el ) {
				                              var newColor = parseInt( hex, 16 );
				                              for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
					                              var obj = editScene.selectedObjects[ i ];
					                              obj.addColor.setHex( newColor );
				                              }
			                              }
		                              } );

// Geometry panel
		$( '#editor-props .panels' ).append( '<div id="panel-geometry" class="panel"><h4>Geometry</h4>\
			<label class="pad5">Type</label> <select id="geometry-type">\
			<option value="Plane">Plane</option>\
			<option value="Box">Box</option>\
			<option value="Sphere">Sphere</option>\
			<option value="Cylinder">Cylinder</option>\
			<option value="Particle" class="cannon-only">Particle</option>\
			</select>\
			<input tabindex="0" type="checkbox" id="geometry-invert" class="geom-only"/><label for="geometry-invert" class="w3 geom-only">Invert normals</label>\
			<div id="geometry-Plane" class="subpanel"><hr/>\
			<label for="geometry-plane-width" class="w31 pad5 right-align">Width</label>\
			<input alt="width" tabindex="0" type="text" class="center geometry-width" id="geometry-plane-width" size="1"/>\
			<label for="geometry-plane-widths" class="w32 pad5 right-align geom-only">Width Seg</label>\
			<input alt="widthSegments" tabindex="2" type="text" class="center geometry-widthSegments geom-only" id="geometry-plane-widths" size="1"/><br/>\
			<label for="geometry-plane-height" class="w31 pad5 right-align">Height</label>\
			<input alt="height" tabindex="1" type="text" class="center geometry-height" id="geometry-plane-height" size="1"/>\
			<label for="geometry-plane-heights" class="w32 pad5 right-align geom-only">Height Seg</label>\
			<input alt="heightSegments" tabindex="3" type="text" class="center geometry-heightSegments geom-only" id="geometry-plane-heights" size="1"/>\
			</div>\
			<div id="geometry-Box" class="subpanel"><hr/>\
			<label for="geometry-box-width" class="w31 pad5 right-align">Width</label>\
			<input alt="width" tabindex="0" type="text" class="center geometry-width" id="geometry-box-width" size="1"/>\
			<label for="geometry-box-widths" class="w32 pad5 right-align geom-only">Width Seg</label>\
			<input alt="widthSegments" tabindex="3" type="text" class="center geometry-widthSegments geom-only" id="geometry-box-widths" size="1"/><br/>\
			<label for="geometry-box-height" class="w31 pad5 right-align">Height</label>\
			<input alt="height" tabindex="1" type="text" class="center geometry-height" id="geometry-box-height" size="1"/>\
			<label for="geometry-box-heights" class="w32 pad5 right-align geom-only">Height Seg</label>\
			<input alt="heightSegments" tabindex="4" type="text" class="center geometry-heightSegments geom-only" id="geometry-box-heights" size="1"/><br/>\
			<label for="geometry-box-depth" class="w31 pad5 right-align">Depth</label>\
			<input alt="depth" tabindex="2" type="text" class="center geometry-depth" id="geometry-box-depth" size="1"/>\
			<label for="geometry-box-depths" class="w32 pad5 right-align geom-only">Depth Seg</label>\
			<input alt="depthSegments" tabindex="5" type="text" class="center geometry-depthSegments geom-only" id="geometry-box-depths" size="1"/>\
			</div>\
			<div id="geometry-Sphere" class="subpanel"><hr/>\
			<label for="geometry-radius" class="w31 pad5 right-align">Radius</label>\
			<input alt="radius" tabindex="0" type="text" class="center" id="geometry-radius" size="1"/><br class="geom-only"/>\
			<label for="geometry-sphere-widths" class="w31 pad5 right-align geom-only">Width Seg</label>\
			<input alt="widthSegments" tabindex="1" type="text" class="center geometry-widthSegments geom-only" id="geometry-sphere-widths" size="1"/>\
			<label for="geometry-sphere-heights" class="w32 pad5 right-align geom-only">Height Seg</label>\
			<input alt="heightSegments" tabindex="2" type="text" class="center geometry-heightSegments geom-only" id="geometry-sphere-heights" size="1"/><br class="geom-only"/>\
			<label for="geometry-phiStart" class="w31 pad5 right-align geom-only">Phi Start</label>\
			<input alt="phiStart" tabindex="3" type="text" class="center geom-only" id="geometry-phiStart" size="1"/>\
			<label for="geometry-phiLength" class="w32 pad5 right-align geom-only">Phi Length</label>\
			<input alt="phiLength" tabindex="4" type="text" class="center geom-only" id="geometry-phiLength" size="1"/><br class="geom-only"/>\
			<label for="geometry-thetaStart" class="w31 pad5 right-align geom-only">Theta Start</label>\
			<input alt="thetaStart" tabindex="5" type="text" class="center geom-only" id="geometry-thetaStart" size="1"/>\
			<label for="geometry-thetaLength" class="w32 pad5 right-align geom-only">Theta Length</label>\
			<input alt="thetaLength" tabindex="6" type="text" class="center geom-only" id="geometry-thetaLength" size="1"/>\
			</div>\
			<div id="geometry-Cylinder" class="subpanel"><hr/>\
			<label for="geometry-radius-top" class="w32 pad5 right-align">Radius Top</label>\
			<input alt="radiusTop" tabindex="0" type="text" class="center radius geometry-radiusTop" id="geometry-radius-top" size="1"/>\
			<label for="geometry-radius-bottom" class="w3 pad5 right-align">Bottom</label>\
			<input alt="radiusBottom" tabindex="1" type="text" class="center radius geometry-radiusBottom" id="geometry-radius-bottom" size="1"/><br/>\
			<label for="geometry-cylinder-radiusSegments" class="w32 pad5 right-align">Radius Seg</label>\
			<input alt="radiusSegments" tabindex="2" type="text" class="center geometry-radiusSegments" id="geometry-cylinder-radiusSegments" size="1"/>\
			<label for="geometry-cylinder-height" class="w3 pad5 right-align">Height</label>\
			<input alt="height" tabindex="3" type="text" class="center geometry-height" id="geometry-cylinder-height" size="1"/><br class="geom-only"/>\
			<label for="geometry-cylinder-heightSegments" class="w32 pad5 right-align geom-only">Height Seg</label>\
			<input alt="heightSegments" tabindex="4" type="text" class="center geometry-heightSegments geom-only" id="geometry-cylinder-heightSegments" size="1"/><br/>\
			<input alt="openEnded" tabindex="5" type="checkbox" class="center geom-only" id="geometry-cylinder-openEnded"/>\
			<label for="geometry-cylinder-openEnded" class="pad5 geom-only">Open ended</label>\
			</div>\
			<div id="geometry-shared" class="geom-only">\
			<hr/>\
			<label class="w32 right-align pad5">Color tint</label><div id="geometry-tint" class="color-swatch"/>\
			<label class="w31 right-align pad5">Add</label><div id="geometry-addColor" class="color-swatch"/><br/>\
			<label class="w31 right-align pad5">Texture</label><select id="geometry-texture"></select><br/>\
			<label class="w31 right-align pad5">Slice</label><select id="geometry-texture-slice"></select><span id="geometry-texture-slice-size" class="small pad5"></span><hr/>\
			<label for="geometry-alpha" class="w32 pad5 right-align">Alpha</label><input tabindex="0" type="text" class="center" id="geometry-alpha" size="1"/>\
			<label for="geometry-alphaThresh" class="w32 pad5 right-align">Alpha Thresh</label><input tabindex="0" type="text" class="center" id="geometry-alphaThresh" size="1"/>\
			<label for="geometry-stipple" class="w32 pad5 right-align">Stipple</label><input tabindex="2" type="text" class="center" id="geometry-stipple" size="1"/>\
			<label for="geometry-brightness" class="w32 pad5 right-align">Brightness</label><input tabindex="1" type="text" class="center" id="geometry-brightness" size="1"/>\
		    </div>\
			</div>' );
		vc = valueChanged( this.geometryStippleChanged );
		$( '#geometry-stipple' ).spinner( { step: 1, min: 0, max: 2, change: vc, stop: vc } );
		vc = valueChanged( this.geometryAlphaChanged );
		$( '#geometry-alpha' ).spinner( { step: 0.1, min: 0, max: 1, change: vc, stop: vc } );
		vc = valueChanged( this.geometryAlphaThreshChanged );
		$( '#geometry-alphaThresh' ).spinner( { step: 0.1, min: 0, max: 1, change: vc, stop: vc } );
		vc = valueChanged( this.geometryBrightnessChanged );
		$( '#geometry-brightness' ).spinner( { step: 0.1, change: vc, stop: vc } );
		
		$( '#geometry-texture' ).change( this.geometryTextureChanged );
		$( '#geometry-texture-slice' ).change( this.geometrySliceChanged );
		$( '#geometry-type' ).change( this.geometryTypeChanged );
		$( '#geometry-invert' ).change( this.geometryInvertChanged );
		
		var panel = $( '#panel-geometry' );
		vc = valueChanged( this.geometryPropChanged );
		$( '.geometry-width,.geometry-height,.geometry-depth', panel ).spinner( {
			                                                                        step: 1,
			                                                                        min: 1,
			                                                                        change: vc,
			                                                                        stop: vc
		                                                                        } );
		$( '.geometry-widthSegments,.geometry-heightSegments,.geometry-depthSegments,.geometry-radiusSegments', panel ).spinner( {
			                                                                                                                         step: 1,
			                                                                                                                         min: 1,
			                                                                                                                         max: 30,
			                                                                                                                         change: vc,
			                                                                                                                         stop: vc
		                                                                                                                         } );
		$( '#geometry-radius,.radius', panel ).spinner( { min: 0, change: vc, stop: vc } );
		$( '#geometry-phiStart', panel ).spinner( { step: 5, min: 0, max: 360, change: vc, stop: vc } );
		$( '#geometry-thetaStart', panel ).spinner( { step: 5, min: 0, max: 180, change: vc, stop: vc } );
		$( '#geometry-phiLength', panel ).spinner( { step: 5, min: 0, max: 360, change: vc, stop: vc } );
		$( '#geometry-thetaLength', panel ).spinner( { step: 5, min: 0, max: 180, change: vc, stop: vc } );
		$( '#geometry-cylinder-openEnded' ).change( checkBoxValueChanged( this.geometryPropChanged ) );
		
		$( '#geometry-tint' ).colpick( {
			                               colorScheme: 'dark',
			                               onShow: function ( dom ) {
				                               $( dom ).css( { zIndex: 10000001 } );
				                               var src = $( this );
				                               var css = src.css( 'background-color' );
				                               var top = parseInt( $( dom ).css( 'top' ) ), height = $( dom ).outerHeight();
				                               if ( top + height > window.innerHeight ) $( dom ).css( 'top', window.innerHeight - height );
				                               // store preselection color
				                               for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
					                               var obj = editScene.selectedObjects[ i ];
					                               obj.storedColor = obj.material.tint.getHex();
				                               }
				                               if ( css != 'transparent' ) {
					                               var clr = new THREE.Color( css );
					                               var hex = clr.getHexString();
					                               $( src ).data( 'prevVal', hex );
					                               src.colpickSetColor( hex, true );
				                               }
			                               },
			                               onHide: function () {
				                               for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
					                               var obj = editScene.selectedObjects[ i ];
					                               obj.material.tint.setHex( obj.storedColor );
				                               }
			                               },
			                               onSubmit: function ( hsb, hex, rgb, el ) {
				                               editScene.setGeometryTint( parseInt( hex, 16 ) );
				                               $( '#geometry-tint' ).css( { backgroundColor: '#' + hex } );
				                               $( el ).colpickHide();
			                               },
			                               onChange: function ( hsb, hex, rgb, el ) {
				                               var newColor = parseInt( hex, 16 );
				                               for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
					                               var obj = editScene.selectedObjects[ i ];
					                               obj.material.tint.setHex( newColor );
				                               }
			                               }
		                               } );
		$( '#geometry-addColor' ).colpick( {
			                                   colorScheme: 'dark',
			                                   onShow: function ( dom ) {
				                                   $( dom ).css( { zIndex: 10000001 } );
				                                   var src = $( this );
				                                   var css = src.css( 'background-color' );
				                                   var top = parseInt( $( dom ).css( 'top' ) ), height = $( dom ).outerHeight();
				                                   if ( top + height > window.innerHeight ) $( dom ).css( 'top', window.innerHeight - height );
				                                   // store preselection color
				                                   for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
					                                   var obj = editScene.selectedObjects[ i ];
					                                   obj.storedColor = obj.material.addColor.getHex();
				                                   }
				                                   if ( css != 'transparent' ) {
					                                   var clr = new THREE.Color( css );
					                                   var hex = clr.getHexString();
					                                   $( src ).data( 'prevVal', hex );
					                                   src.colpickSetColor( hex, true );
				                                   }
			                                   },
			                                   onHide: function () {
				                                   for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
					                                   var obj = editScene.selectedObjects[ i ];
					                                   obj.material.addColor.setHex( obj.storedColor );
				                                   }
			                                   },
			                                   onSubmit: function ( hsb, hex, rgb, el ) {
				                                   editScene.setGeometryAddColor( parseInt( hex, 16 ) );
				                                   $( '#geometry-addColor' ).css( { backgroundColor: '#' + hex } );
				                                   $( el ).colpickHide();
			                                   },
			                                   onChange: function ( hsb, hex, rgb, el ) {
				                                   var newColor = parseInt( hex, 16 );
				                                   for ( var i = 0; i < editScene.selectedObjects.length; i++ ) {
					                                   var obj = editScene.selectedObjects[ i ];
					                                   obj.material.addColor.setHex( newColor );
				                                   }
			                                   }
		                                   } );

// Constraint
		$( '#editor-props .panels' ).append( '<div id="panel-constraint" class="panel"><h4>Constraint</h4>\
		<label class="pad5">Type</label> <select id="constraint-type">\
		<option value="LockConstraint">Weld</option>\
		<option value="PointToPointConstraint">Ball Joint</option>\
		<option value="HingeConstraint">Hinge</option>\
		<option value="DistanceConstraint">Distance</option>\
		</select><label for="constraint-target" class="w32 right-align pad5">Target</label><input type="text" size="10" id="constraint-target" readonly="readonly"/><hr/>\
		<input type="checkbox" id="constraint-collideConnected"/><label for="constraint-collideConnected" class="w3">Collide Connected</label><br/>\
		<div id="constraint-HingeConstraint" class="subpanel"><hr/>\
		<label for="constraint-motorTargetVelocity" class="w5 pad5 right-align">Motor Target Velocity</label>\
		<input tabindex="0" type="text" class="center geometry-width" id="constraint-motorTargetVelocity" size="1"/><span class="sub">Deg/s</span>\
		</div>\
		</div>' );
		
		$( '#constraint-type' ).change( this.constraintTypeChanged );
		$( '#constraint-target' ).click( this.constraintTargetClicked );
		vc = valueChanged( this.constraintPropertyChanged );
		$( '#constraint-motorTargetVelocity' ).spinner( { step: 1, change: vc, stop: vc } );
		$( '#constraint-collideConnected' ).change( this.constraintCollideChanged );

// LinePath props panel
		$( '#editor-props .panels' ).append( '<div id="panel-path" class="panel"><h4>LinePath</h4>\
		<div class="sub center"><a id="point-add-left">&#8612; prepend</a> <span class="separator-left"/> \
		<a id="point-join-se">start = end</a> <span class="separator-left"/> \
		<a id="point-join-es">end = start</a> <span class="separator-left"/> \
		<a id="point-add-right"> extend &#8614;</a></div><hr/>\
		<div id="path-container"/>\
		</div>' );
		
		$( '#point-add-left,#point-add-right' ).click( this.pathAddSegment.bind( this ) );
		$( '#point-join-se,#point-join-es' ).click( this.pathJoinEnds.bind( this ) );

// Point props panel
		$( '#editor-props .panels' ).append( '<div id="panel-point" class="panel"><h4>Point</h4>\
		<input tabindex="0" type="checkbox" id="point-locked"/><label for="point-locked" class="w3">Lock Tangents</label><br/>\
		<label for="point-meta" class="w2 right-align">Meta</label> <input type="text" size="25" id="point-meta"/>\
		</div>' );
		
		$( '#point-locked' ).change( this.pointLockTangentsChanged.bind( this ) );
		vc = textFieldValueChanged( this.pointMetaChanged.bind( this ) );
		$( '#point-meta' ).change( vc ).keydown( function ( e ) {
			$( e.target ).attr( 'placeholder', '' );
			if ( e.which == 13 ) $( e.target ).data( 'prevVal', Math.random() ).trigger( 'change' ).blur();
		} );

// Custom props panel
		$( '#editor-props .panels' ).append( '<div id="panel-custom" class="panel"><h4>Custom Properties</h4>\
		<div class="sub right-align"><a id="prop-add">+ add property</a></div>\
		</hr><div id="props-container" class="center"/>\
		</div>' );
		
		$( '#prop-add' ).click( this.addPropertyToSelection.bind( this ) );
		
		var savePosOnDrop = function ( e, ui ) {
			localStorage_setItem( ui.helper.context.id + '-x', ui.position.left );
			localStorage_setItem( ui.helper.context.id + '-y', ui.position.top );
		};
		var bringToFront = function ( e, ui ) { $( 'body' ).append( ui.helper.context ); }
		
		function makeDraggablePanel ( id, defX, defY, defH, onResizeHandler ) {
			var panel = $( '#' + id );
			var dw = panel.width();
			var dh = panel.height();
			panel.resizable( {
				                 containment: "body",
				                 minHeight: 200,
				                 minWidth: parseInt( panel.css( 'min-width' ) ),
				                 maxWidth: parseInt( panel.css( 'min-width' ) ),
				                 stop: function ( e, ui ) {
					                 var h = ui.size.height;
					                 localStorage_setItem( ui.helper.context.id + '-height', h );
				                 },
				                 resize: onResizeHandler
			                 } );
			var coll = localStorage_getItem( id + '-collapsed' );
			if ( coll === 'true' ) {
				panel.addClass( 'collapsed' ).resizable( 'disable' );
			} else {
				var h = parseInt( localStorage_getItem( id + '-height' ) );
				panel.css( 'height', h ? h : defH );
			}
			if ( onResizeHandler ) onResizeHandler();
			dh = panel.height();
			var dx = localStorage_getItem( id + '-x' );
			var dy = localStorage_getItem( id + '-y' );
			dx = Math.min( (dx === null) ? defX : dx, window.innerWidth - dw );
			dy = Math.min( (dy === null) ? defY : dy, window.innerHeight - dh );
			panel.offset( { left: dx, top: dy } ).draggable( {
				                                                 snap: ".editor",
				                                                 containment: "body",
				                                                 cancel: '.ui-widget,input,a,button,#scene-list,select',
				                                                 start: bringToFront,
				                                                 stop: savePosOnDrop
			                                                 } );
			panel.mousedown( function () {
				$( '.floating-panel' ).css( { zIndex: 1000000 } );
				$( this ).css( { zIndex: 1000001 } );
				$( '.submenu' ).hide();
			} );
		}

// scene graph window
		$( 'body' ).append(
			'<div id="editor-scene" class="ui-widget-header ui-corner-all editor floating-panel">\
		<h1>Scene</h1>\
		<hr/>\
		<button id="scene-add">Add Object</button>\
		<div class="float-right"><button id="test-scene">Test Scene</button></div>\
		<hr/>\
		<div id="scene-list"></div>\
		<hr/>\
		<button id="scene-delete">Delete</button>\
		<span class="separator-left right-align w7"><input type="text" id="filter-scene" size="15" placeholder="filter by name"/>\
		<a id="filter-scene-clear" class="pad5">X</a></span>\
		</div>\
		<ul id="scene-add-menu" class="editor submenu absolute-pos shortcuts">\
			<li id="scene-add-asset">PixelBox Asset ...<em>&#10095;</em></li><hr/>\
			<li id="scene-add-instance">Instance (Template) ...<em>&#10095;</em></li>\
			<li id="scene-add-container">Object3D (Container)</li><hr/>\
			<li id="scene-add-geometry">Geometry</li><hr/>\
			<li id="scene-add-fxsprite">FxSprite</li><hr/>\
			<li id="scene-add-hemi">Hemisphere Light (Ambient)</li>\
			<li id="scene-add-dir">Directional Light</li>\
			<li id="scene-add-spot">Spot Light</li>\
			<li id="scene-add-point">Point Light</li><hr/>\
			<li id="scene-add-camera">Perspective Camera</li>\
			<li id="scene-add-ortho-camera">Orthographic Camera</li><hr/>\
			<li id="scene-add-path">Line Path</li>\
  		</ul>\
		</ul>' );
		$( '#scene-add' ).button( { icons: { secondary: 'ui-icon-triangle-1-n' } } ).click( function () {
			$( '#scene-add-menu' ).show().position( {
				                                        at: "right top",
				                                        my: "right bottom",
				                                        of: this
			                                        } );
			return false;
		} )
		$( '#scene-add-menu' ).hide().menu().click( this.addObjectMenuItemClicked.bind( this ) );
		$( '#scene-dupe' ).button();
		$( '#scene-delete' ).button().click( this.deleteSelection.bind( this ) );
		$( '#test-scene' ).button().click( this.previewScene.bind( this ) );
		
		$( '#filter-scene' ).on( 'change keyup', this.filterSceneChanged.bind( this ) );
		$( '#filter-scene-clear' ).click( this.clearSceneFilter );

// assets
		$( 'body' ).append(
			'<div id="editor-assets" class="ui-widget-header ui-corner-all editor floating-panel">\
		<h1>Assets</h1>\
		<hr/>\
		<button id="asset-add" disabled="disabled">Add to Scene</button><span class="separator-left"/>\
		<button id="asset-new">New</button>\
		<hr/>\
		<div id="asset-list"></div>\
		<hr/>\
		<button id="asset-rename">Rename</button>\
		<button id="asset-delete" class="float-right">Delete</button>\
		</div>' );
		$( '#asset-new' ).button().click( this.assetNew.bind( this ) );
		$( '#asset-add' ).button().click( this.assetAdd );
		$( '#asset-rename' ).button().click( this.assetRename.bind( this ) );
		$( '#asset-delete' ).button().click( this.assetDelete.bind( this ) );
		
		makeDraggablePanel( 'editor-scene', 0, 40, window.innerHeight * 0.5 - 60, function () {
			var h = $( '#editor-scene' ).height();
			$( '#scene-list' ).css( 'height', h - 140 );
		} );
		makeDraggablePanel( 'editor-props', 0, window.innerHeight * 0.5, window.innerHeight * 0.5 - 20, function () {
			var h = $( '#editor-props' ).height();
			$( '#editor-props .panels' ).height( h - 100 );
		} );
		makeDraggablePanel( 'editor-assets', window.innerWidth - $( '#editor-assets' ).width() - 20, window.innerHeight * 0.7, window.innerHeight * 0.3 - 20, function () {
			var h = $( '#editor-assets' ).height();
			$( '#asset-list' ).css( 'height', h - 140 );
		} );

// replace shortcut text
		$( '.editor .ctrl' ).append( navigator.appVersion.indexOf( "Mac" ) != -1 ? '&#8984; ' : 'Ctrl + ' );//⌘

// undo/redo
		$( '#undo' ).button().click( this.performUndo.bind( this ) );
		$( '#redo' ).button().click( this.performRedo.bind( this ) );

// protect canvas when over UI
		$( '.editor' ).hover( editScene.disableCanvasInteractions.bind( editScene ),
		                      editScene.enableCanvasInteractions.bind( editScene ) );
		$( "div" ).disableSelection();

// add collapse buttons
		$( '#editor-props,#editor-scene,#editor-assets' ).prepend( '<a class="toggleCollapse">[-]</a>' );
		$( '.editor a.toggleCollapse' ).each( function ( i, el ) {
			el = $( el );
			if ( el.parent().hasClass( 'collapsed' ) ) el.text( '[+]' );
		} );
		$( '.toggleCollapse' ).click( function () {
			var parent = $( this ).parent();
			parent.toggleClass( 'collapsed' );
			var collapsed = parent.hasClass( 'collapsed' );
			$( this ).text( collapsed ? '[+]' : '[-]' );
			var dw = parent.width(), dh = parent.height();
			var pos = parent.offset();
			parent.offset( {
				               left: Math.min( pos.left, window.innerWidth - dw - 20 ),
				               top: Math.min( pos.top, window.innerHeight - dh - 20 )
			               } );
			var parentid = parent.get( 0 ).id;
			if ( collapsed ) {
				parent.resizable( 'disable' );
				parent.css( 'height', '' );
			} else {
				parent.resizable( 'enable' );
				parent.css( 'height', parseInt( localStorage_getItem( parentid + '-height' ) ) );
			}
			localStorage_setItem( parentid + '-collapsed', collapsed );
			parent.resizable( 'option', 'resize' )();
		} );

// collapsible panels
		$( '#editor-props .panel h4' ).click( function () {
			var panel = $( this ).closest( '.panel' );
			panel.toggleClass( 'collapsed' );
			localStorage_setItem( panel.attr( 'id' ), panel.hasClass( 'collapsed' ) );
		} );
		
		$( '#editor-props .panel' ).each( function ( i, el ) {
			if ( localStorage_getItem( $( el ).attr( 'id' ) ) === 'true' ) {
				$( el ).addClass( 'collapsed' );
			}
		} );

// focus/blur
		$( 'input' ).on( 'focus', function ( e ) {
			editScene.focusedTextField = e.target;
			editScene.disableKeyboardShortcuts();
		} )
			.on( 'blur', function ( e ) {
				     editScene.focusedTextField = null;
				     editScene.enableKeyboardShortcuts();
			     } )
			.on( 'keyup', this.blurOnEnter );
		
		$( window ).on( 'dragover', this.onDragFilesOver );
		$( window ).on( 'dragleave', this.onDragFilesOver );
		$( window ).on( 'drop', this.onDropFiles );
		
		this.enableCanvasInteractions( true );
		
		$( '.editor' ).mouseenter( function ( e ) {
			e.stopPropagation();
			editScene.disableCanvasInteractions( false );
		} )
			.mouseleave( function ( e ) {
				             e.stopPropagation();
				             editScene.enableCanvasInteractions( false );
			             } );
		
		
		$( 'body' ).append( '<div id="blur-overlay" class="ui-widget-overlay ui-front" style="z-index:100000010;display:none;"></div>' );
		$( window ).blur( function () { $( '#blur-overlay' ).show(); } ).focus( function () { $( '#blur-overlay' ).hide(); } );
	},
	
	/* dispose of main UI */
	removeUI: function () {
		$( '.editor' ).remove();
		$( 'body' ).off( 'mouseup.editor' );
	},
	
	addObjectMenuItemClicked: function ( e, asset, instance ) {
		var objDef = null;
		var addTarget;
		var addPos = new THREE.Vector3();
		var firstSelectedNonInstance = null;
		for ( var i = 0; i < this.selectedObjects.length; i++ ) {
			if ( !this.selectedObjects[ i ].isInstance ) {
				firstSelectedNonInstance = this.selectedObjects[ i ];
				break;
			}
		}
		// add into
		if ( e.target instanceof THREE.Object3D ) {
			addTarget = e.target;
		} else if ( e.shiftKey ) {
			addTarget = firstSelectedNonInstance ? firstSelectedNonInstance : this.container;
			// add next to
		} else {
			addTarget = firstSelectedNonInstance ? firstSelectedNonInstance.parent : this.container;
			if ( this.selectedObjects.length ) addPos.copy( addTarget.position );
		}
		if ( addTarget instanceof THREE.LinePathHandle ) addTarget = addTarget.parent.parent;
		else if ( addTarget instanceof THREE.LinePath || addTarget.collisionShape || addTarget.constraint ) addTarget = addTarget.parent;
		
		var addWorldPos = addTarget.parent.localToWorld( addPos.clone() );
		
		switch ( e.target.id ) {
			case 'scene-add-asset':
				
				// populate:
				$( '#scene-add-submenu' ).remove();
				var submenu = $( '<ul id="scene-add-submenu" class="editor submenu absolute-pos">' );
				var numRows = 0;
				for ( var aname in assets.files ) {
					if ( !assets.files[ aname ].frameData ) continue;
					var row = $( '<li/>' );
					row.text( aname );
					var func = (function ( assetName ) {
						return function ( e ) {
							editScene.addObjectMenuItemClicked( e, assetName );
						};
					})( aname );
					row.click( func );
					submenu.append( row );
					numRows++;
				}
				if ( !numRows ) submenu.append( '<span class="info">- No Assets in Scene -</span>' );
				submenu.menu().position( {
					                         at: "right top",
					                         my: "right bottom",
					                         of: $( '#scene-add' )
				                         } );
				$( 'body' ).append( submenu );
				break;
			case 'scene-add-instance':
				$( '#scene-add-submenu' ).remove();
				var submenu = $( '<ul id="scene-add-submenu" class="editor submenu absolute-pos">' );
				var numRows = 0;
				for ( var i in editScene.doc.templates ) {
					var obj = editScene.doc.templates[ i ];
					var row = $( '<li/>' );
					row.text( obj.name );
					var func = (function ( templateName ) {
						return function ( e ) {
							editScene.addObjectMenuItemClicked( e, null, templateName );
						};
					})( obj.name );
					row.click( func );
					submenu.append( row );
					numRows++;
				}
				if ( !numRows ) submenu.append( '<span class="info">- No Templates in Scene -</span>' );
				submenu.menu().position( {
					                         at: "right top",
					                         my: "right bottom",
					                         of: $( '#scene-add' )
				                         } );
				$( 'body' ).append( submenu );
				
				return;
			case 'scene-add-container':
				objDef = { asset: 'Object3D', name: 'container' };
				break;
			
			case 'scene-add-geometry':
				objDef = {
					asset: 'Geometry',
					mesh: 'Sphere',
					name: 'sphere',
					color: '999999',
					receiveShadow: true,
					width: 10,
					height: 10,
					radius: 10
				};
				break;

			case 'scene-add-fxsprite':
				objDef = {
					asset: 'FxSprite',
					name: 'fxsprite',
					receiveShadow: true,
					castShadow:true,
					fxData: '',
					textureMap: '',
					angle: 0,
					scaleX: 1,
					scaleY: 1
				};
				break;
			
			case 'scene-add-collision-shape':
				var minMax = new THREE.Box3( new THREE.Vector3( -5, -5, -5 ), new THREE.Vector3( 5, 5, 5 ) );
				var radius = 10;
				if ( addTarget.geometry ) {
					addTarget.geometry.computeBoundingBox();
					addTarget.geometry.computeBoundingSphere();
					minMax = addTarget.geometry.boundingBox;
					radius = addTarget.geometry.boundingSphere.radius;
				}
				objDef = {
					asset: 'Geometry',
					mesh: 'Box',
					collisionShape: true,
					name: 'collision_shape',
					radius: radius,
					width: minMax.size().x,
					height: minMax.size().y,
					depth: minMax.size().z,
					position: minMax.center().toArray()
				};
				break;
			
			case 'scene-add-constraint':
				objDef = { asset: 'Geometry', mesh: 'PointToPointConstraint', constraint: true, name: 'constraint' };
				break;
			
			case 'scene-add-hemi':
				objDef = { asset: 'HemisphereLight', name: 'ambient', colors: [ "2f62ff", "333399" ], intensity: 0.5 };
				break;
			
			case 'scene-add-dir':
				objDef = {
					asset: 'DirectionalLight',
					name: 'sun',
					castShadow: true,
					receiveShadow: false,
					color: "ffffff",
					intensity: 0.5,
					target: [ addWorldPos.x, addWorldPos.y - 100, addWorldPos.z ]
				};
				break;
			
			case 'scene-add-spot':
				objDef = {
					asset: 'SpotLight',
					name: 'spotlight',
					castShadow: true,
					receiveShadow: false,
					color: "ffffff",
					intensity: 0.5,
					angle: 30,
					distance: 100,
					target: [ addWorldPos.x, addWorldPos.y - 100, addWorldPos.z ]
				};
				break;
			
			case 'scene-add-point':
				objDef = { asset: 'PointLight', name: 'pointlight', color: "ffffff", castShadow: false, intensity: 0.5, distance: 10 };
				break;
			
			case 'scene-add-camera':
				objDef = { asset: 'Camera', name: 'camera', fov: 60, near: 1, far: 500 };
				break;
			
			case 'scene-add-ortho-camera':
				objDef = { asset: 'OrthographicCamera', name: 'camera', fov: 60, near: 1, far: 500 };
				break;
			
			case 'scene-add-path':
				objDef = {
					asset: 'LinePath',
					name: 'path',
					segments: [ { v0: [ 0, 0, 0, 1 ], v1: [ 0, 0, 10 ], v2: [ 0, 0, 90 ], v3: [ 0, 0, 100, 1 ] } ]
				};
				break;
			
			default:
				if ( asset ) {
					var anims = assets.files[ asset ].anims;
					var anames = _.keys( anims );
					var firstAnim = anames.length ? anames[ 0 ] : '';
					objDef = {
						asset: asset,
						name: asset,
						animOption: 'gotoAndStop',
						animFrame: 0,
						animName: firstAnim
					};
				}
				
				if ( instance ) {
					// find instance
					var instanceObject = editScene.doc.templates[ instance ];
					if ( !instanceObject ) return;
					
					// check nesting
					var p = instanceObject;
					while ( p.parent != editScene.container ) {
						p = p.parent;
						if ( p.isTemplate && p.name == instance ) {
							// nested circular template
							editScene.showMessage( '<span class="error">Template nesting loop</span>' );
							return;
						}
					}
					
					// ready
					objDef = { asset: 'Instance', name: instance + '_instance', template: instance };
				}
				break;
			
		}
		
		if ( objDef ) {
			objDef.position = [ addPos.x, addPos.y, addPos.z ];
			this.deselectAll();
			
			var addedObject;
			var addedObjects = this.populateObject( addTarget, [ objDef ],
			                                        {
				                                        helpers: true,
				                                        keepSceneCamera: true,
				                                        noNameReferences: true,
				                                        wrapTemplates: true,
				                                        templates: this.doc.serializedTemplates,
				                                        skipProps: true,
				                                        noStaticGroups: true,
				                                        initObject: this.populateObjectCallback
			                                        } );
			addedObject = addTarget.children[ addTarget.children.length - 1 ];
			
			var doAdd = [ [ addedObject, addTarget ] ];
			var undoAdd = [ addedObject ];
			this.addUndo( {
				              name: "addObject",
				              redo: [ this.addObjects, doAdd ],
				              undo: [ this.deleteObjects, undoAdd ]
			              } );
			
			if ( addedObject.isInstance ) {
				this.linkObjects( addedObjects, addedObject, true );
			}
			
			this.refreshScene();
			this.updateLights = true;
			
			this.updateTextLabels( this.container, 0 );
			this.selectObject( addedObject, true );
			
			// create collapsed
			if ( addedObject.children.length ) addedObject.htmlRow.find( 'a.toggle' ).trigger( 'click' );
			
			if ( this.validateAllObjectNames() ) {
				this.mergeUndo( true );
			}
			
			this.selectionChanged();
			this.refreshProps();
		}
		
		return addedObject;
	},
	
	showHelp: function () {
		$( '.submenu' ).hide();
		if ( !$( '#help-view' ).length ) {
			$( 'body' ).append( '<div id="help-view" class="no-close">\
			<span class="info">PixelBox and related tools created by Kirill Edelman.<br/>\
			Huge thanks to mrdoob for creating <a href="http://threejs.org/" target="_blank">three.js</a><br/><br/>\
			<a href="https://github.com/kirilledelman/pixelbox" target="_blank">https://github.com/kirilledelman/pixelbox</a></span>\
			<hr/>\
			<h2>View</h2>\
			<em>LMB</em> rotate view<br/>\
			<em>Mouse Wheel</em> zoom view<br/>\
			<em>RMB</em> pan view<br/>\
			<br/>\
			<h2>File</h2>\
			<em>Ctrl + S</em> hold scene<br/>\
			<em>Ctrl + E</em> export scene data<br/>\
			<br/>\
			<h2>Selection</h2>\
			<em>Left Click</em> select object<br/>\
			<em>Shift + Drag</em> selection marquee<br/>\
			<em>Shift + Drag, Ctrl</em> selection marquee, contained only<br/>\
			<em>Shift + Click</em> add objects to selection<br/>\
			<em>Alt + Click</em> remove objects from selection<br/>\
			<em>Page Up</em> select parent<br/>\
			<em>Page Down</em> select child<br/>\
			<em>Esc</em> deselect all<br/>\
			<br/>\
			<em><span class="ctrl"/>C</em> copy selection<br/>\
			<em><span class="ctrl"/>X</em> cut selection<br/>\
			<em><span class="ctrl"/>V</em> paste<br/>\
			<em>Shift + <span class="ctrl"/> V</em> paste into selected<br/>\
			<br/>\
			<h2>Transform</h2>\
			<em>LMB</em> move selection<br/>\
			<em>Alt + LMB</em> rotate selection<br/>\
			<em>Ctrl + LMB</em> scale selection<br/>\
			<br/>\
			<em>Arrow keys</em> move selection<br/>\
			<em>Alt + Arrows</em> rotate selection YZ<br/>\
			<em>Ctrl + Arrows</em> rotate selection XZ<br/>\
			<em>Ctrl + Alt + Arrows</em> scale selection<br/>\
			<br/>\
			<h2>Undo</h2>\
			<em><span class="ctrl"/>Z</em> undo<br/>\
			<em>Shift + <span class="ctrl"/>Z</em> redo<br/>\
			<br/>\
			</div>' );
		}
		
		$( '#help-view .ctrl' ).append( navigator.appVersion.indexOf( "Mac" ) != -1 ? '&#8984; ' : 'Ctrl + ' );
		
		editScene.disableCanvasInteractions( true );
		$( '#help-view' ).dialog( {
			                          resizable: false,
			                          width: 500,
			                          height: 500,
			                          modal: true,
			                          dialogClass: 'no-close',
			                          title: "Help",
			                          buttons: { OK: function () { $( this ).dialog( "close" ); } },
			                          close: function () {
				                          $( this ).remove();
				                          editScene.enableCanvasInteractions( true );
			                          }
		                          } );
	},
	
	// unfocus from text field or 
	blur: function () {
		if ( editScene.focusedTextField ) editScene.focusedTextField.blur();
		$( 'div,span' ).blur();
	},
	
	blurOnEnter: function ( e ) { if ( e.which == 13 ) e.target.blur(); },
	
	disableCanvasInteractions: function ( all ) {
		if ( this.controls.busy() ) {
			this.disableCanvasInteractionsOnRelease = true;
		} else {
			this.canvasInteractionsEnabled = false;
		}
		
		if ( all === true ) {
			$( window ).off( 'mouseup.editor mousedown.editor mousemove.editor' );
			this.disableKeyboardShortcuts();
		}
	},
	
	enableCanvasInteractions: function ( all ) {
		this.disableCanvasInteractionsOnRelease = false;
		this.canvasInteractionsEnabled = true;
		if ( all === true ) {
			this.disableKeyboardShortcuts();
			this.enableKeyboardShortcuts();
			$( window ).off( '.editor' );
			$( window ).on( 'keydown.editor', this.keyDown.bind( this ) );
			$( window ).on( 'keyup.editor', this.keyUp.bind( this ) );
			$( window ).on( 'mouseup.editor', this.mouseUp.bind( this ) );
			$( window ).on( 'mousemove.editor', this.mouseMove.bind( this ) );
			$( window ).on( 'mousedown.editor', this.mouseDown.bind( this ) );
		}
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Keyboard functions */
	
	enableKeyboardShortcuts: function () {
		key( 'ctrl+z,⌘+z', function () {
			editScene.performUndo();
			return false;
		} );
		key( 'ctrl+shift+z,⌘+shift+z', function () {
			editScene.performRedo();
			return false;
		} );
		key( 'ctrl+c,⌘+c', function () {
			editScene.copySelection();
			return false;
		} );
		key( 'ctrl+v,⌘+v', function () {
			editScene.pasteSelection( { shiftKey: false } );
			return false;
		} );
		key( 'shift+ctrl+v,shift+⌘+v', function () {
			editScene.pasteSelection( { shiftKey: true } );
			return false;
		} );
		key( 'ctrl+x,⌘+x', function () {
			editScene.cutSelection();
			return false;
		} );
		key( 'ctrl+s,⌘+s', function () {
			editScene.holdDoc();
			return false;
		} );
		key( 'ctrl+e,⌘+e', function () {
			editScene.saveDoc();
			return false;
		} );
	},
	
	disableKeyboardShortcuts: function () {
		key.unbind( 'ctrl+z,⌘+z' );
		key.unbind( 'ctrl+shift+z,⌘+shift+z' );
		key.unbind( 'ctrl+c,⌘+c' );
		key.unbind( 'ctrl+x,⌘+x' );
		key.unbind( 'ctrl+v,⌘+v' );
		key.unbind( 'shift+ctrl+v,shift+⌘+v' );
		key.unbind( 'ctrl+s,⌘+s' );
		key.unbind( 'ctrl+e,⌘+e' );
	},
	
	/* shortcuts */
	keyUp: function ( e ) {
		if ( editScene.focusedTextField || (e.target && (e.target.tagName == 'INPUT' || e.target.tagName == 'TEXTAREA')) ) return;
		
		e.preventDefault();
		if ( $( '.ui-dialog' ).length ) return;
		
		switch ( e.which ) {
			case 90: // Z
				if ( e.shiftKey ) editScene.performRedo();
				else editScene.performUndo();
				break;
			case 16:
				editScene.shift = false;
				if ( this.transformingObjectsMode ) this.continueTransformObjects( null );
				break;
			case 17:
				editScene.ctrl = false;
				if ( editScene.insertingPoint ) editScene.endInsertPoint();
				break;
			case 18:
				editScene.alt = false;
				break;
		}
	},
	
	keyDown: function ( e ) {
		// process tabbing inside panels
		if ( e.target && (e.target.tagName == 'INPUT' || e.target.tagName == 'TEXTAREA') ) {
			if ( e.which == 9 ) {
				e.preventDefault();
				var targ = $( e.target );
				var tabIndex = targ.attr( 'tabindex' );
				var siblings = [];
				if ( targ.hasClass( 'ui-spinner-input' ) ) {
					siblings = targ.parent().parent().find( ':tabbable' + (tabIndex != undefined ? '[tabindex]' : '') );
				} else {
					siblings = targ.parent().find( ':tabbable' + (tabIndex != undefined ? '[tabindex]' : '') );
				}
				var index = siblings.index( targ );
				if ( index != -1 ) {
					if ( tabIndex != undefined ) {
						tabIndex = parseInt( tabIndex );
						if ( e.shiftKey ) {
							tabIndex--;
							if ( tabIndex < 0 ) tabIndex = siblings.length - 1;
						} else {
							tabIndex = (tabIndex + 1) % siblings.length;
						}
						siblings.filter( '[tabindex=' + tabIndex + ']' ).focus().select();
					} else {
						if ( e.shiftKey ) {
							index--;
							if ( index < 0 ) index = siblings.length - 1;
						} else {
							index = (index + 1) % siblings.length;
						}
						siblings.eq( index ).focus().select();
					}
				}
			}
			return;
		}
		if ( editScene.focusedTextField ) return;
		
		e.preventDefault();
		e.stopPropagation();
		
		if ( $( '.ui-dialog' ).length && e.which != 13 ) return;
		
		switch ( e.which ) {
			case 16:
				editScene.shift = true;
				if ( this.transformingObjectsMode ) this.continueTransformObjects( null );
				break;
			case 17:
				editScene.ctrl = true;
				
				if ( !editScene.insertingPoint && editScene.selectedObjects.length == 1 && editScene.selectedObjects[ 0 ] instanceof THREE.LinePath ) {
					editScene.beginInsertPoint();
				}
				
				break;
			case 18:
				editScene.alt = true;
				break;
			case 8: // del
			case 46: // back
				editScene.deleteSelection();
				break;
			case 13: // enter
				var btn = $( '.ui-dialog .ui-dialog-buttonset button' ).first();
				if ( btn.length ) btn.trigger( 'click' );
				break;
			case 37: // left
				editScene.moveTool( -(e.shiftKey ? 5 : 1), 0 );
				break;
			case 39: // right
				editScene.moveTool( (e.shiftKey ? 5 : 1), 0 );
				break;
			case 38: // up
				editScene.moveTool( 0, (e.shiftKey ? 5 : 1) );
				break;
			case 40: // down
				editScene.moveTool( 0, -(e.shiftKey ? 5 : 1) );
				break;
			case 32: // space
				break;
			case 33: // pageup
				editScene.selectParents( e );
				break;
			case 34: // pagedown
				editScene.selectChildren( e );
				break;
			case 27: // esc
				if ( $( '.submenu:visible' ).length ) {
					$( '.submenu' ).hide();
				} else if ( editScene.objectPickMode ) {
					editScene.objectPickMode( undefined );
				} else if ( editScene.canvasInteractionsEnabled ) {
					editScene.deselectAll();
					editScene.selectionChanged();
				}
				break;
			
			default:
				console.log( e );
				break;
		}
	},
	
	showMessage: function ( html ) {
		var newMsg = $( '<div class="bigMessage"/>' ).html( html );
		$( 'body' ).append( newMsg );
		var newMsgHeight = newMsg.outerHeight() + 20;
		var msg = $( 'div.bigMessage' ).not( newMsg );
		msg.each( function ( i, el ) {
			var offs = $( el ).offset();
			$( el ).offset( { top: offs.top + newMsgHeight, left: offs.left } );
		} );
		newMsg.offset( { top: 60, left: Math.floor( 0.5 * (window.innerWidth - newMsg.width()) ) } );
		setTimeout( function () { newMsg.fadeOut( function () { newMsg.remove(); } ); }, 2000 );
	},
	
	/* ------------------- ------------------- ------------------- ------------------- ------------------- Framework */
	
	/* initialize */
	init: function () {
		// defaults
		var bgc = localStorage_getItem( 'editor-scene-bg-color' );
		this.clearColor = (bgc !== null ? parseInt( bgc, 16 ) : 0x333333);
		
		// setup scene
		this.scene = new THREE.Scene();
		this.scene.fog = new THREE.Fog( 0x0, 1000, 10000 );
		
		// ambient
		this.ambient = new THREE.AmbientLight( 0x0 );
		this.scene.add( this.ambient );
		
		// camera
		this.camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 2000000 );
		this.camera.position.set( 512, 512, 512 );
		this.camera.lookAt( new THREE.Vector3( 0, 0, 0 ) );
		this.scene.add( this.camera );
		this.controls = new THREE.EditorControls( this.camera, document.body );//renderer.webgl.domElement);
		this.controls.panEnabled = this.controls.rotateEnabled = this.controls.zoomEnabled = true;
		
		// projector & mouse picker
		//this.projector = new THREE.Projector();
		this.raycaster = new THREE.Raycaster( new THREE.Vector3(), new THREE.Vector3(), 0.01, this.camera.far );
		this.raycaster.linePrecision = 3;
		//this.projectorPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
		
		// create render target
		var renderTargetParameters = {
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			format: THREE.RGBFormat,
			stencilBuffer: false
		};
		this.fbo = new THREE.WebGLRenderTarget( window.innerWidth * renderer.scale,
		                                        window.innerHeight * renderer.scale, renderTargetParameters );
		
		renderer.webgl.shadowMapEnabled = true;
		renderer.webgl.shadowMapSoft = true;
		renderer.webgl.shadowMapType = THREE.PCFSoftShadowMap;
		
		this.defaultSceneDef = {
			name: 'newScene',
			maxShadows: 2,
			clearColor: '333333',
			ambient: '000000',
			fogColor: '003399',
			fogNear: 1000, fogFar: 10000,
			layers: [
				{
					"name": "camera",
					"asset": "Camera",
					"position": [ 0, 50, 100 ],
					"lookAt": [ 0, 0, 0 ],
					"isDefault": true
				},
				{
					"name": "sun",
					"asset": "DirectionalLight",
					"position": [ 0, 150, 0 ],
					"target": [ 0, 0, 0 ],
					"color": "FFFFFF",
					"castShadow": true,
					"shadowBias": -0.00015,
					"intensity": 0.5,
					"shadowVolumeWidth": 256,
					"shadowVolumeHeight": 256,
					"shadowMapWidth": 1024
				},
				{
					"name": "ambient",
					"asset": "HemisphereLight",
					"colors": [ "2f62ff", "333399" ],
					"position": [ 0, 170, 0 ],
					"intensity": 0.4
				} ]
		};
		
		// fetch copy object
		try {
			this.sceneCopyItem = localStorage_getItem( "sceneCopy" );
			if ( this.sceneCopyItem ) this.sceneCopyItem = JSON.parse( this.sceneCopyItem );
		} catch ( e ) { console.log( e ); }
	},
	
	/* callbacks */
	onWillAdd: function () {
		$( window ).on( 'resize.editScene', this.onResized.bind( this ) );
	},
	onAdded: function () {
		this.addUI();
		
		editScene.enableCanvasInteractions( true );
		
		document.addEventListener( "contextmenu", function ( e ) {
			if ( editScene.ctrl || e.ctrlKey || $( e.target ).hasClass( 'object-label' ) ) {
				e.preventDefault();
				//editScene.mouseDown(e);
				//e.stopPropagation();
				if ( !$( e.target ).hasClass( 'object-label' ) ) $( e.target ).trigger( 'click' );
			}
			return false;
		}, false );
		
		// ready to display scene
		var data = localStorage_getItem( 'holdScene' );
		if ( data ) {
			var scene = JSON.parse( data );
			console.log( scene );
			this.newDocFromData( scene );
		} else {
			this.newDoc( true );
		}
		this.resetZoom();
	},
	
	onWillRemove: function () {
		this.removeUI();
		$( window ).off( '.editor' );
		editScene.disableKeyboardShortcuts();
	},
	onRemoved: function () {
		this.controls.panEnabled = this.controls.rotateEnabled = this.controls.zoomEnabled = false;
		$( window ).off( '.editor' );
	},
	
	render: function ( delta, rtt ) {
		renderer.webgl.setClearColor( this.clearColor, 1 );
		if ( rtt ) renderer.webgl.render( this.scene, this.camera, this.fbo, true );
		else renderer.webgl.render( this.scene, this.camera );
		
		this.updateTextLabels( this.container, 0 );
		if ( this.updateLights ) {
			THREE.PixelBoxUtil.updateLights( this.scene, true );
			this.updateLights = false;
		}
		
		if ( this.placeHolderLights ) {
			while ( this.placeHolderLights.length ) {
				var sun = this.placeHolderLights[ 0 ];
				this.scene.remove( sun );
				this.placeHolderLights.splice( 0, 1 );
				sun.shadowMap.dispose();
			}
		}
	},
	
	onResized: function ( e ) {
		if ( !e ) return;
		if ( $( e.target ).hasClass( 'floating-panel' ) ) return;
		
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();
		var renderTargetParameters = {
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			format: THREE.RGBFormat,
			stencilBuffer: false
		};
		this.fbo = new THREE.WebGLRenderTarget( window.innerWidth * renderer.scale, window.innerHeight * renderer.scale, renderTargetParameters );
		
		localStorage_setItem( 'windowWidth', window.outerWidth );
		localStorage_setItem( 'windowHeight', window.outerHeight );
	},
};

editScene = new EditSceneScene();

/* scene serializing */
THREE.Object3D.prototype.getReferenceName = function () {
	var nameString = (this.isAnchor ? '$' : '') + this.name;
	if ( this.parent && this.parent.name && this.parent.name.length && !this.parent.isTemplate ) {
		return this.parent.getReferenceName() + '.' + nameString;
	}
	return nameString;
};

THREE.Object3D.prototype.propByName = function ( n ) {
	if ( !this.props ) return {};
	for ( var i = 0; i < this.props.length; i++ ) {
		if ( this.props[ i ].name == n ) return this.props[ i ];
	}
	return {};
};

THREE.Object3D.prototype.serialize = function ( templates ) {
	var def = {
		name: this.name
	};
	// common props
	var radToDeg = 180 / Math.PI;
	if ( this.position.x || this.position.y || this.position.z ) def.position = [ this.position.x, this.position.y, this.position.z ];
	if ( this.rotation.x || this.rotation.y || this.rotation.z ) def.rotation = [ this.rotation.x * radToDeg, this.rotation.y * radToDeg, this.rotation.z * radToDeg ];
	if ( this.scale.x != 1.0 || this.scale.y != 1.0 || this.scale.z != 1.0 ) {
		if ( this.scale.x != this.scale.y || this.scale.y != this.scale.z || this.scale.y != this.scale.x ) {
			def.scale = [ this.scale.x, this.scale.y, this.scale.z ];
		} else {
			def.scale = this.scale.x;
		}
	}
	if ( this.castShadow !== undefined ) def.castShadow = this.castShadow;
	if ( this.receiveShadow !== undefined ) def.receiveShadow = this.receiveShadow;
	if ( !this.visible ) def.visible = false;
	if ( this.children.length ) def.layers = [];
	if ( this.isTemplate ) def.isTemplate = true;
	if ( this.physics ) def.physics = true;
	
	var myTemplate = undefined;
	
	var addPhysicsInfo = function () {
		
		if ( this.def.bodyType !== undefined && this.def.bodyType.toString() != "0" ) def.bodyType = this.def.bodyType;
		
		if ( this.def.velocity != undefined &&
			(this.def.velocity[ 0 ] != 0 || this.def.velocity[ 1 ] != 0 || this.def.velocity[ 2 ] != 0) ) {
			def.velocity = this.def.velocity.concat();
		}
		
		if ( this.def.angularVelocity != undefined &&
			(this.def.angularVelocity[ 0 ] != 0 || this.def.angularVelocity[ 1 ] != 0 || this.def.angularVelocity[ 2 ] != 0) ) {
			def.angularVelocity = this.def.angularVelocity.concat();
		}
		
		if ( this.def.mass ) def.mass = this.def.mass;
		if ( this.def.fixedRotation ) def.fixedRotation = true;
		if ( this.def.sensor ) def.sensor = true;
		if ( this.def.sleep ) def.sleep = true;
		if ( this.def.damping ) def.damping = this.def.damping;
		if ( this.def.collisionGroup !== undefined && this.def.collisionGroup != 1 ) def.collisionGroup = this.def.collisionGroup;
		if ( this.def.collisionMask !== undefined && this.def.collisionMask != 1 ) def.collisionMask = this.def.collisionMask;
		if ( this.def.friction != 0.3 ) def.friction = this.def.friction;
		if ( this.def.restitution != 0.3 ) def.restitution = this.def.restitution;
		
	}.bind( this );
	
	// types
	if ( this.isInstance ) {
		def.asset = 'Instance';
		def.template = this.def.template;
		
	} else if ( this instanceof THREE.Camera ) {
		if ( this instanceof THREE.PerspectiveCamera ) {
			def.asset = 'Camera';
			def.fov = this.fov;
		} else {
			def.asset = 'OrthographicCamera';
			def.zoom = this.zoom;
		}
		def.near = this.near;
		def.far = this.far;
		def.isDefault = !!this.isDefault;
	} else if ( this instanceof THREE.DirectionalLight ) {
		def.asset = 'DirectionalLight';
		if ( this.shadowCameraRight != 128 ) def.shadowVolumeWidth = this.shadowCameraRight * 2;
		if ( this.shadowCameraTop != 128 ) def.shadowVolumeHeight = this.shadowCameraTop * 2;
		def.shadowNear = this.shadowCameraNear;
		def.shadowFar = this.shadowCameraFar;
		def.shadowBias = this.shadowBias;
		def.color = this.color.getHexString();
		def.intensity = this.intensity;
		def.shadowMapWidth = Math.max( this.shadowMapWidth, this.shadowMapHeight );
		var myTemplate = this.nearestTemplate();
		var targetTemplate = this.target.nearestTemplate();
		if ( myTemplate != targetTemplate || !this.target.parent || !this.target.name ) {
			this.target.updateMatrixWorld( true );
			var p = new THREE.Vector3();
			this.target.localToWorld( p );
			def.target = [ p.x, p.y, p.z ];
		} else {
			def.target = '#' + this.target.getReferenceName();
		}
	} else if ( this instanceof THREE.SpotLight ) {
		def.asset = 'SpotLight';
		def.shadowBias = this.shadowBias;
		def.shadowMapWidth = Math.max( this.shadowMapWidth, this.shadowMapHeight );
		def.color = this.color.getHexString();
		def.intensity = this.intensity;
		def.distance = this.distance;
		def.exponent = this.exponent;
		def.shadowNear = this.shadowCameraNear;
		def.shadowFar = this.shadowCameraFar;
		def.angle = this.angle * radToDeg;
		// target is under the same parent/anchor
		var myTemplate = this.nearestTemplate();
		var targetTemplate = this.target.nearestTemplate();
		if ( myTemplate != targetTemplate || !this.target.parent || !this.target.name ) {
			this.target.updateMatrixWorld( true );
			var p = new THREE.Vector3();
			this.target.localToWorld( p );
			def.target = [ p.x, p.y, p.z ];
		} else {
			def.target = '#' + this.target.getReferenceName();
		}
	} else if ( this instanceof THREE.PointLight ) {
		def.asset = 'PointLight';
		def.color = this.color.getHexString();
		def.intensity = this.intensity;
		def.distance = this.distance;
		
	} else if ( this instanceof THREE.HemisphereLight ) {
		def.asset = 'HemisphereLight';
		def.colors = [ this.color.getHexString(), this.groundColor.getHexString() ];
		def.intensity = this.intensity;
		
	} else if ( this instanceof THREE.Mesh ) {
		def.asset = 'Geometry';
		def.mesh = this.geometryType;
		var props = [];
		switch ( this.geometryType ) {
			case 'Plane':
				if ( this.collisionShape ) props = [ 'width', 'height' ];
				else props = [ 'width', 'height', 'widthSegments', 'heightSegments' ];
				break;
			case 'Box':
				if ( this.collisionShape ) props = [ 'width', 'height', 'depth' ];
				else props = [ 'width', 'height', 'depth', 'widthSegments', 'heightSegments', 'depthSegments' ];
				break;
			case 'Sphere':
				if ( this.collisionShape ) props = [ 'radius' ];
				else props = [ 'radius', 'widthSegments', 'heightSegments', 'phiStart', 'phiLength', 'thetaStart', 'thetaLength' ];
				break;
			case 'Cylinder':
				if ( this.collisionShape ) props = [ 'radiusTop', 'radiusBottom', 'height', 'radiusSegments' ];
				else props = [ 'radiusTop', 'radiusBottom', 'height', 'radiusSegments', 'heightSegments', 'openEnded' ];
				break;
			default:
				break;
		}
		if ( this.textureMap ) def.textureMap = this.textureMap;
		if ( this.sliceName ) def.sliceName = this.sliceName;

		for ( var p in props ) {
			var prop = props[ p ]
			def[ prop ] = this.def[ prop ];
		}
		
		if ( this.collisionShape ) {
			def.collisionShape = true;
		} else if ( this.constraint ) {
			def.constraint = true;
			if ( this.target ) def.target = '#' + this.target.getReferenceName();
			if ( this.collideConnected != undefined ) def.collideConnected = this.collideConnected;
			if ( this.motorTargetVelocity != undefined ) def.motorTargetVelocity = this.motorTargetVelocity;
		} else {
			def.inverted = !!this.def.inverted;
			def.tint = this.material.tint.getHexString();
			def.addColor = this.material.addColor.getHexString();
			
			addPhysicsInfo();
			if ( this.material.alpha != 1.0 ) def.alpha = this.material.alpha;
			if ( this.material.alphaThresh != 0 ) def.alphaThresh = this.material.alphaThresh;
			if ( this.material.brightness != 0 ) def.brightness = this.material.brightness;
			if ( this.material.stipple != 0 ) def.stipple = this.material.stipple;
		}
	} else if ( this.isContainer ) {
		def.asset = 'Object3D';
		addPhysicsInfo();
	} else if ( this instanceof THREE.FxSprite ) {

		def.asset = 'FxSprite';
		def.textureMap = this.textureMap;
		def.fxData = this.fxData;

		def.tint = this.material.tint.getHexString();
		def.addColor = this.material.addColor.getHexString();

		addPhysicsInfo();
		if ( this.material.alpha != 1.0 ) def.alpha = this.material.alpha;
		if ( this.material.alphaThresh != 0 ) def.alphaThresh = this.material.alphaThresh;
		if ( this.material.brightness != 0 ) def.brightness = this.material.brightness;
		if ( this.material.stipple != 0 ) def.stipple = this.material.stipple;

		if ( this.scaleX != 1.0 ) def.scaleX = this.scaleX;
		if ( this.scaleY != 1.0 ) def.scaleY = this.scaleY;
		if ( this.angle != 0 ) def.angle = this.angle;

		if ( this.animSpeed != 1.0 ) def.animSpeed = this.animSpeed;
		if ( this.def.animName != undefined ) def.animName = this.def.animName;
		if ( this.def.animOption != undefined ) def.animOption = this.def.animOption;
		if ( this.def.animFrame != undefined ) def.animFrame = this.def.animFrame;

	} else if ( this.pixelBox || this.isPlaceholder ) {
		if ( this.isPlaceholder ) {
			def.asset = this.def.asset;
			if ( this.def.pointSize != undefined ) def.pointSize = this.def.pointSize;
			if ( this.def.alpha != undefined ) def.alpha = this.def.alpha;
			if ( this.def.cullBack != undefined ) def.cullBack = this.def.cullBack;
			if ( this.def.occlusion != undefined ) def.occlusion = this.def.occlusion;
			if ( this.def.tint != undefined ) def.tint = this.def.tint;
			if ( this.def.add != undefined ) def.add = this.def.add;
			if ( this.def.stipple != undefined ) def.stipple = this.def.stipple;
			if ( this.def.animSpeed != undefined ) def.animSpeed = this.def.animSpeed;
			
			// process anchored children
			for ( var i = 0; i < this.children.length; i++ ) {
				// skip anchors
				var child = this.children[ i ];
				if ( child.anchored ) {
					var cdef = child.serialize( templates );
					cdef.anchor = child.anchored;
					if ( child.isTemplate && templates ) {
						//delete cdef.name;
						templates[ child.name ] = cdef;
						if ( !def.containsTemplates ) { def.containsTemplates = [ child.name ]; }
						else def.containsTemplates.push( child.name );
					} else {
						def.layers.push( cdef );
					}
				}
			}
		} else {
			def.asset = this.geometry.data.name;
			def.pointSize = this.pointSize;
			if ( this.alpha != 1.0 ) def.alpha = this.alpha;
			if ( !this.cullBack ) def.cullBack = false;
			if ( this.occlusion != 1.0 ) def.occlusion = this.occlusion;
			if ( this.tint.getHex() != 0xffffff ) def.tint = this.tint.getHexString();
			if ( this.addColor.getHex() != 0 ) def.add = this.addColor.getHexString();
			if ( this.stipple ) def.stipple = this.stipple;
			if ( this.animSpeed != 1.0 ) def.animSpeed = this.animSpeed;
			
			// add anchored children
			for ( var aname in this.anchors ) {
				var anchor = this.anchors[ aname ];
				for ( var i = 0; i < anchor.children.length; i++ ) {
					var child = anchor.children[ i ];
					child.anchored = aname;
					var cdef = child.serialize( templates );
					cdef.anchor = aname;
					if ( child.isTemplate && templates ) {
						//delete cdef.name;
						templates[ child.name ] = cdef;
						if ( !def.containsTemplates ) { def.containsTemplates = [ child.name ]; }
						else def.containsTemplates.push( child.name );
					} else {
						def.layers.push( cdef );
					}
				}
			}
		}
		addPhysicsInfo();
		if ( this.def.staticGroup != undefined ) def.staticGroup = this.def.staticGroup;
		if ( this.def.animName != undefined ) def.animName = this.def.animName;
		if ( this.def.animOption != undefined ) def.animOption = this.def.animOption;
		if ( this.def.animFrame != undefined ) def.animFrame = this.def.animFrame;
		
		// paths
	} else if ( this instanceof THREE.LinePath ) {
		
		def.asset = 'LinePath';
		def.segments = [];
		for ( var i = 0; i < this.path.curves.length; i++ ) {
			var curve = this.path.curves[ i ];
			var o = { v0: curve.v0.toArray(), v1: curve.v1.toArray(), v2: curve.v2.toArray(), v3: curve.v3.toArray() };
			var p = this.getObjectByName( 'P' + i );
			if ( p.lockTangents ) o.v0.push( 1 );
			if ( p.meta && p.meta.length ) o.metaStart = p.meta;
			p = this.getObjectByName( 'P' + (i + 1) );
			if ( p.lockTangents ) o.v3.push( 1 );
			if ( p.meta && p.meta.length ) o.metaEnd = p.meta;
			def.segments.push( o );
		}
		
	} else {
		//console.log("Serializing an unknown type", this);
		def.asset = 'Object3D';
	}
	
	// process children
	if ( !this.isInstance && !(this instanceof THREE.LinePath) && !(this instanceof THREE.FxSprite)) {
		for ( var i = 0; i < this.children.length; i++ ) {
			// skip anchors
			var child = this.children[ i ];
			if ( child.isAnchor || (child.anchored && this.isAnchor) ) continue;
			var cdef = child.serialize( templates );
			if ( child.isTemplate && templates ) {
				// delete cdef.name;
				templates[ child.name ] = cdef;
				if ( !def.containsTemplates ) { def.containsTemplates = [ child.name ]; }
				else def.containsTemplates.push( child.name );
			} else {
				def.layers.push( cdef );
			}
		}
	}
	
	// save properties
	if ( this.props && this.props.length ) {
		if ( myTemplate === undefined ) myTemplate = this.nearestTemplate();
		for ( var i = 0, l = this.props.length; i < l; i++ ) {
			var prop = this.props[ i ];
			if ( !def.props ) def.props = {};
			if ( prop.type == 'Object3D' ) {
				var targ = prop.value;
				def.props[ prop.name ] = null;
				if ( targ ) {
					var targetTemplate = targ.nearestTemplate();
					if ( myTemplate != targetTemplate || !targ.parent ) {
						//console.log("Warning: custom property ",prop.name," points to an object inside "
						// outside hierarchy
					} else {
						def.props[ prop.name ] = '#' + targ.getReferenceName();
					}
				}
			} else {
				// try number first
				var pn = parseFloat( prop.value );
				var val;
				if ( !isNaN( pn ) && pn.toString() == prop.value ) {
					val = pn;
					// try json encode
				} else {
					try {
						val = JSON.parse( prop.value );
					} catch ( e ) {
						val = prop.value;
					}
				}
				def.props[ prop.name ] = val;
			}
		}
	}
	
	if ( def.layers && !def.layers.length ) delete def.layers;
	
	// update and return
	return def;
};

function fake0 ( v ) { if ( Math.abs( v ) < 0.01 ) return 0; else return v; }
function not0 ( v ) { if ( Math.abs( v ) < 0.01 || isNaN( v ) ) return 0.001; else return v; }
function notNaN ( v ) { if ( isNaN( v ) ) return 0; else return v; }


/* called on document load */
function documentReady () {
	// init renderer
	if ( !renderer.init() ) {
		var err = "Your browser doesn't support WebGL";
		alert( err );
		console.error( err );
		return;
	} else {
		console.log( "WebGL initialized" );
	}
	
	/* stop / resume render on window focus */
	$( window ).focus( function () {
		renderer.pause( false );
	} ).blur( function () {
		renderer.pause( true );
	} );
	
	// init localstorage, then start
	localStorage_init( function () {
		editScene.init();
		renderer.setScene( editScene );
		
		// browser warning
		if ( !window[ 'chrome' ] || window[ 'chrome' ][ 'storage' ] == undefined ) {
			alert( "Running PixelBox scene editor in the browser.\n\nPlease note that scene editor was designed to run as Chrome extension. Running it in the browser window should work, but some features, especially those having to do with local storage and file saving / export may not always work correctly. If you're planning to sink production time in using the editor, I recommend running it as Chrome app. For more info visit https://github.com/kirilledelman/pixelbox" );
		}
	} );
	
}

/* frustum ext for marquee selection */

THREE.Frustum.prototype.containsBox = function () {
	
	var p1 = new THREE.Vector3(),
		p2 = new THREE.Vector3();
	
	return function ( box ) {
		
		var planes = this.planes;
		
		for ( var i = 0; i < 6; i++ ) {
			
			var plane = planes[ i ];
			
			p1.x = plane.normal.x > 0 ? box.min.x : box.max.x;
			p2.x = plane.normal.x > 0 ? box.max.x : box.min.x;
			p1.y = plane.normal.y > 0 ? box.min.y : box.max.y;
			p2.y = plane.normal.y > 0 ? box.max.y : box.min.y;
			p1.z = plane.normal.z > 0 ? box.min.z : box.max.z;
			p2.z = plane.normal.z > 0 ? box.max.z : box.min.z;
			
			var d1 = plane.distanceToPoint( p1 );
			var d2 = plane.distanceToPoint( p2 );
			
			// if either outside plane, no intersection
			
			if ( d1 < 0 || d2 < 0 ) {
				
				return false;
				
			}
		}
		
		return true;
	};
	
}();


/* global helper functions */
function localStorage_init ( onReady ) {
	if ( window[ 'chrome' ] && chrome.storage ) {
		chrome.storage.local.get( null, function ( obj ) {
			window.storageShadow = obj;
			onReady();
		} );
	} else onReady();
}

function localStorage_setItem ( key, val ) {
	if ( window[ 'chrome' ] && chrome.storage ) {
		var kv = {};
		window.storageShadow[ key ] = kv[ key ] = val.toString();
		chrome.storage.local.set( kv );
	} else {
		localStorage.setItem( key, val );
	}
}

function localStorage_getItem ( key ) {
	if ( window[ 'chrome' ] && chrome.storage ) {
		return (window.storageShadow[ key ] !== undefined) ? window.storageShadow[ key ] : null;
	} else {
		return localStorage.getItem( key );
	}
	return null;
}

function localStorage_clear () {
	if ( window[ 'chrome' ] && chrome.storage ) {
		chrome.storage.local.clear();
		window.storageShadow = {};
	} else {
		localStorage.clear();
	}
}

/* cookies */
function createCookie ( name, value, days ) {
	var expires;
	
	if ( days ) {
		var date = new Date();
		date.setTime( date.getTime() + (days * 24 * 60 * 60 * 1000) );
		expires = "; expires=" + date.toGMTString();
	} else {
		expires = "";
	}
	document.cookie = encodeURIComponent( name ) + "=" + encodeURIComponent( value ) + expires + "; path=/";
}

function readCookie ( name ) {
	var nameEQ = encodeURIComponent( name ) + "=";
	var ca = document.cookie.split( ';' );
	for ( var i = 0; i < ca.length; i++ ) {
		var c = ca[ i ];
		while ( c.charAt( 0 ) === ' ' ) c = c.substring( 1, c.length );
		if ( c.indexOf( nameEQ ) === 0 ) return decodeURIComponent( c.substring( nameEQ.length, c.length ) );
	}
	return null;
}

function eraseCookie ( name ) {
	createCookie( name, "", -1 );
}

function dataURItoBlob ( dataURI ) {
	// convert base64/URLEncoded data component to raw binary data held in a string
	var byteString;
	if ( dataURI.split( ',' )[ 0 ].indexOf( 'base64' ) >= 0 )
		byteString = atob( dataURI.split( ',' )[ 1 ] );
	else
		byteString = unescape( dataURI.split( ',' )[ 1 ] );

	// separate out the mime component
	var mimeString = dataURI.split( ',' )[ 0 ].split( ':' )[ 1 ].split( ';' )[ 0 ];

	// write the bytes of the string to a typed array
	var ia = new Uint8Array( byteString.length );
	for ( var i = 0; i < byteString.length; i++ ) {
		ia[ i ] = byteString.charCodeAt( i );
	}

	return new Blob( [ ia ], { type: mimeString } );
}

$( document ).ready( documentReady );
