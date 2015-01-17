/*
 * @author Kirill Edelman
 * @source https://github.com/kirilledelman/pixelbox
 * @documentation https://github.com/kirilledelman/pixelbox/wiki
 * @license MIT
*/

THREE.PixelBoxAssets = function () {

/*
	
	loadAssets(info) - loads and caches data
	
		(Object) info - specifies what to load (all params optional)
		
			(Array) info.textures - array of paths to images to load as THREE.Texture
			(Array) info.assets - array of paths to json or LZ-String-compressed PixelBox asset files
			(Array) info.scenes - array of paths to json or LZ-String-compressed PixelBox scene files
			(Array) info.json - array of paths to json files to load and parse
			
			(Function) info.progress(percent) - function called after each file is loaded
			(Function) info.done - function called after all assets have been loaded

*/

	this.loadAssets = function ( params, onLoaded ) {
	
		this.textures = params.textures ? params.textures : [];
		this.scenedata = params.scenes ? params.scenes : [];
		this.models = params.assets ? params.assets : [];
		this.json = params.json ? params.json : [];
		this.onprogress = params.progress;
		this.onloaded = params.done;
		
		this.totalLoaded = 0;
		this.totalAssets = this.textures.length + this.scenedata.length + this.models.length + this.json.length;
		
		// textures
		for ( var i = 0; i < this.textures.length; i++ ) {
		
			var url = this.textures[ i ];
			var reqObj = function ( url ) {
			
				return function () {
				
					assets.cache.add( url, new THREE.ImageUtils.loadTexture(url, undefined, assets.assetLoaded ) );
					
				};
				
			}( url );
			this.loadQueue.push( reqObj );
			
		}
		
		// scenes
		for ( var i = 0; i < this.scenedata.length; i++ ) {
		
			var url = this.scenedata[ i ];
			var reqObj = function ( url ) {
			
				return function () {
				
					var request = new XMLHttpRequest();
					request.open( 'GET', url, true );
					request.onload = function () {
					
						if ( request.status >= 200 && request.status < 400 ) {
						
							var data = request.responseText;
							var json;
							if ( data.substr(0,1) == '{' || data.substr(0,1) == '[' ){
							
								json = data;
								
							} else {
							
								json = LZString.decompressFromBase64( data ); // decompress if needed
								
							}
												
							// parse
							if ( !json ) {
							
								console.error( "Failed to LZString decompressFromBase64 " + url );
								
							} else {
							
								try {
								
									json = JSON.parse( json );
									
								} catch( e ) {
								
									console.error( "Failed to parse JSON for " + url, e, json );
									
								}
								
								assets.cache.add( json.name, json );
								
							}
							
							assets.assetLoaded();
							
						} else console.error( "Failed to load " + url );
						
					};
									
					request.onerror = function () {
					
						console.error( "Connection error while loading " + url );
						
					};
					
					request.send();
					
				};
				
			}( url );
			this.loadQueue.push( reqObj );
		}
		
		// models
		for ( var i = 0; i < this.models.length; i++ ) {
		
			var url = this.models[ i ];
			var reqObj = function ( url ) {
			
				return function () {
				
					var request = new XMLHttpRequest();
					request.open( 'GET', url, true );
					request.onload = function () {
					
						if ( request.status >= 200 && request.status < 400 ) {
						
							var time = new Date(), json;
							if ( data.substr(0,1) == '{' ) {
							
								json = data;
								
							} else {
							
								json = LZString.decompressFromBase64( data ); // decompress if needed
								
							}
							
							// parse
							if ( !json ){
							
								console.error( "Failed to LZString decompressFromBase64 " + url );
								
							} else {
							
								try {
								
									json = JSON.parse( json );
									
								} catch( e ) {
								
									console.error( "Failed to parse JSON for " + url, e, json );
									
								}								
								console.log( "[" + json.name + "] decompress+parse time:" + ( (new Date()).getTime() - time ) );
	
								// process
								time = new Date();
								THREE.PixelBoxUtil.processPixelBoxFrames( json );
								assets.cache.add( json.name, json );
								console.log( "[" + json.name + "] process time:" + ( (new Date()).getTime() - time ) );
								
							}
							assets.assetLoaded();
							
						} else console.error( "Failed to load " + url );
					};	
									
					request.onerror = function () {
					
						console.error("Connection error while loading " + url );
						
					};
					
					request.send();					
				};
			}( url );
			
			this.loadQueue.push( reqObj );
			
		}
		
		// json
		for ( var i = 0; i < this.json.length; i++ ) {
		
			var url = this.json[ i ];
			var reqObj = function ( url ) {
			
				return function () {
				
					var request = new XMLHttpRequest();
					request.open( 'GET', url, true );
					request.onload = function () {
						if ( request.status >= 200 && request.status < 400 ) {
						
							// decompress if needed
							var json;
							if ( data.substr(0,1) == '{' ) {
							
								json = data;
								
							} else {
							
								json = LZString.decompressFromBase64( data );
								
							}
							
							// parse
							if ( !json ) {
							
								console.error( "Failed to LZString decompressFromBase64 " + url );
								
							} else {
							
								try {
								
									json = JSON.parse( json );
									
								} catch( e ){
								
									console.error( "Failed to parse JSON for " + url, e, json );
									
								}
								
								assets.cache.add( url, json );
								
							}
							
							assets.assetLoaded();
							
						} else console.error( "Failed to load " + url );
						
					};
									
					request.onerror = function () {
					
						console.error( "Connection error while loading " + url );
						
					};
					
					request.send();	
					
				};
				
			}( url );
			this.loadQueue.push( reqObj );
			
		}
		
		// start
		if ( this.totalAssets ) this.loadQueue[ this.totalAssets - 1 ]();
		else if ( this.onloaded ) this.onloaded();
	};
	
	this.assetLoaded = function () { 
	
		assets.totalLoaded++;
		assets.loadQueue.pop();
		if ( assets.totalLoaded === assets.totalAssets ){
		
			if ( assets.onloaded ) assets.onloaded();
			
		} else {
		
			if ( assets.onprogress ) assets.onprogress( 100 * assets.totalLoaded / assets.totalAssets );
			setTimeout( assets.loadQueue[ assets.loadQueue.length - 1 ], 10 );
			
		}
		
	};

	this.unload = function () {
	
		for ( var key in this.cache.files ){
		
			var a = this.cache.files[ key ];
			
			// PixelBox
			if ( a.frameData || a.frames ) {
				
				THREE.PixelBox.prototype.dispose( a );
				
			} else if ( a instanceof THREE.Texture ) {
			
				a.dispose();
				
			}
			
		}
		
		this.cache.clear();
		console.log( "All assets unloaded" );
		
	};
	
	this.cache = new THREE.Cache();
	this.totalLoaded = 0;
	this.totalAssets = 0;
	this.loadQueue = [];
	
	this.objectLoader = new THREE.JSONLoader();
	
}

var assets = new THREE.PixelBoxAssets();

/*
 * @author Kirill Edelman
 * @source https://github.com/kirilledelman/pixelbox
 * @documentation https://github.com/kirilledelman/pixelbox/wiki
 * @license MIT
*/

THREE.LinePath = function () {
	
	THREE.Line.call( this, new THREE.Geometry(), THREE.LinePath.prototype.sharedMaterial );
	
	this.path = new THREE.CurvePath();
	this.type = THREE.LineStrip;
	
	return this;
	
};

THREE.LinePath.prototype = Object.create( THREE.Line.prototype );
THREE.LinePath.prototype.constructor = THREE.LinePath;

/* creates the segments from definition */
THREE.LinePath.prototype.initialize = function ( objDef ) {

	var lastPoint = null, srg, curve;
	for ( var i = 0, l = objDef.segments.length; i < l; i++ ) {
	
		seg = objDef.segments[ i ];

		curve = new THREE.CubicBezierCurve3(
			lastPoint ? lastPoint : (new THREE.Vector3()).fromArray( seg.v0 ),
			(new THREE.Vector3()).fromArray( seg.v1 ),
			(new THREE.Vector3()).fromArray( seg.v2 ),
			(new THREE.Vector3()).fromArray( seg.v3 )
		);

		curve.v0.lockTangents = (seg.v0.length > 3);
		curve.v3.lockTangents = (seg.v3.length > 3);
		curve.v0.meta = curve.v0.meta ? curve.v0.meta : seg.metaStart;
		curve.v3.meta = seg.metaEnd;

		lastPoint = curve.v3;

		this.path.add( curve );
	}
	
	this.isLoop = this.path.curves[ 0 ].v0.equals( this.path.curves[ this.path.curves.length - 1 ].v3 );

};

/* overridden, to save lastGetPointCurveIndex */
THREE.LinePath.prototype.getPoint = function ( t ) {

	var d = t * this.path.getLength();
	var curveLengths = this.path.getCurveLengths();
	var i = 0, diff, curve;
	while ( i < curveLengths.length ) {
	
		if ( curveLengths[ i ] >= d ) {
		
			diff = curveLengths[ i ] - d;
			curve = this.path.curves[ i ];
			var u = 1 - diff / curve.getLength();
			this.lastGetPointCurveIndex = i;
			return curve.getPointAt( u );
		}
		
		i++;
		
	}
	
	return null;
	
};

/* reverses path direction */
THREE.LinePath.prototype.reverse = function () {

	this.path.curves.reverse();
	for ( var i = 0, nc = this.path.curves.length; i < nc; i++ ) {
	
		var curve = this.path.curves[ i ];
		var temp = curve.v0;
		curve.v0 = curve.v3;
		curve.v3 = temp;
		temp = curve.v1;
		curve.v1 = curve.v2;
		curve.v2 = temp;
		
	}
	
	if ( this.path.cacheLengths ) this.path.cacheLengths.length = 0;
	
};

/* tweens */
THREE.LinePath.prototype.applyTween = function ( tweenObj ) {
	
	var valueChange = tweenObj.to - tweenObj.from;
	var t = tweenObj.easing( tweenObj.time, tweenObj.from, valueChange, tweenObj.duration );
	
	// global position at t
	var modt = t % 1.0;
	var pos = this.getPoint( modt );
	var delta = Math.sign( valueChange ) * 0.0001;
	this.localToWorld( pos );
	
	// detect curve change
	var meta1 = null;
	var meta2 = null;
	if ( this.lastGetPointCurveIndex != tweenObj.currentCurveIndex ) {
	
		var curve = this.path.curves[ this.lastGetPointCurveIndex ];
		var prevCurve = (tweenObj.currentCurveIndex !== undefined) ? this.path.curves[ tweenObj.currentCurveIndex ] : null;
		tweenObj.currentCurveIndex = this.lastGetPointCurveIndex;
		if ( valueChange > 0 ) {
		
			if ( curve.v0.meta ) meta1 = curve.v0.meta;
			if ( prevCurve && prevCurve.v3.meta && prevCurve.v3 != curve.v0 ) meta2 = prevCurve.v3.meta;
			
		} else {
		
			if ( curve.v3.meta ) meta1 = curve.v3.meta;
			if ( prevCurve && prevCurve.v0.meta && prevCurve.v0 != curve.v3 ) meta2 = prevCurve.v0.meta;
			
		}
	}
	
	if ( meta1 ) {
	
		if ( tweenObj.meta ) tweenObj.meta.call( this, tweenObj, meta1 );
		var ev = { type:'path-meta', tweenObject: tweenObj, meta: meta1 };
		tweenObj.target.dispatchEvent( ev );
		this.dispatchEvent( ev );
		
	}
	
	if ( meta2 ) {
	
		if ( tweenObj.meta ) tweenObj.meta.call( this, tweenObj, meta2 );
		var ev = { type:'path-meta', tweenObject: tweenObj, meta: meta2 };
		tweenObj.target.dispatchEvent( ev );
		this.dispatchEvent( ev );
		
	}
	
	var targetParent = tweenObj.target.parent;
	if ( targetParent ) {
	
		tweenObj.target.parent.worldToLocal( pos );
		
	}
	
	// set position
	tweenObj.target.position.copy( pos );
	
	// orient to path
	var incTime = modt + delta;
	if ( tweenObj.orientToPath && incTime > 0 && (this.isLoop || incTime <= 1.0) ) {
	
		var tangent = this.getPoint( incTime % 1.0 );
		this.localToWorld( tangent );
		
		if ( targetParent ) {
		
			targetParent.worldToLocal( tangent );
			
		}
		
		tweenObj.target.lookAt( tangent );
		
	}
	
};

THREE.LinePath.prototype.tween = function ( obj ) {

	var objs;
	if ( !_.isArray( obj ) ) objs = [ obj ];
	else objs = obj.concat();
	
	for ( var i = objs.length - 1; i >= 0; i-- ) {
	
		var tweenObj = objs[ i ];
		
		if ( tweenObj.target === undefined ) {
		
			console.log( "tween object \'target\' parameter is missing: ", tweenObj );
			objs.splice( i, 1 );
			continue;
			
		} else if ( !(tweenObj.target instanceof THREE.Object3D) ) {
		
			console.log( "tween object \'target\' must be a descendant of THREE.Object3D: ", tweenObj );
			objs.splice( i, 1 );
			continue;
			
		} if ( this.isDescendantOf( tweenObj.target ) ) {
		
			console.log( "tween object \'target\' must not be a parent/ascendant of this THREE.LinePath instance: ", tweenObj );
			objs.splice( i, 1 );
			continue;
			
		}

	}	
	
	return THREE.Object3D.prototype.tween.call( this, objs );
	
};
// Copyright (c) 2013 Pieroxy <pieroxy@pieroxy.net>
// This work is free. You can redistribute it and/or modify it
// under the terms of the WTFPL, Version 2
// For more information see LICENSE.txt or http://www.wtfpl.net/
//
// For more information, the home page:
// http://pieroxy.net/blog/pages/lz-string/testing.html
//
// LZ-based compression algorithm, version 1.3.3
var LZString = {
  
  
  // private property
  _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
  _f : String.fromCharCode,
  
  compressToBase64 : function (input) {
    if (input == null) return "";
    var output = "";
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;
    
    input = LZString.compress(input);
    
    while (i < input.length*2) {
      
      if (i%2==0) {
        chr1 = input.charCodeAt(i/2) >> 8;
        chr2 = input.charCodeAt(i/2) & 255;
        if (i/2+1 < input.length) 
          chr3 = input.charCodeAt(i/2+1) >> 8;
        else 
          chr3 = NaN;
      } else {
        chr1 = input.charCodeAt((i-1)/2) & 255;
        if ((i+1)/2 < input.length) {
          chr2 = input.charCodeAt((i+1)/2) >> 8;
          chr3 = input.charCodeAt((i+1)/2) & 255;
        } else 
          chr2=chr3=NaN;
      }
      i+=3;
      
      enc1 = chr1 >> 2;
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      enc4 = chr3 & 63;
      
      if (isNaN(chr2)) {
        enc3 = enc4 = 64;
      } else if (isNaN(chr3)) {
        enc4 = 64;
      }
      
      output = output +
        LZString._keyStr.charAt(enc1) + LZString._keyStr.charAt(enc2) +
          LZString._keyStr.charAt(enc3) + LZString._keyStr.charAt(enc4);
      
    }
    
    return output;
  },
  
  decompressFromBase64 : function (input) {
    if (input == null) return "";
    var output = "",
        ol = 0, 
        output_,
        chr1, chr2, chr3,
        enc1, enc2, enc3, enc4,
        i = 0, f=LZString._f;
    
    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
    
    while (i < input.length) {
      
      enc1 = LZString._keyStr.indexOf(input.charAt(i++));
      enc2 = LZString._keyStr.indexOf(input.charAt(i++));
      enc3 = LZString._keyStr.indexOf(input.charAt(i++));
      enc4 = LZString._keyStr.indexOf(input.charAt(i++));
      
      chr1 = (enc1 << 2) | (enc2 >> 4);
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      chr3 = ((enc3 & 3) << 6) | enc4;
      
      if (ol%2==0) {
        output_ = chr1 << 8;
        
        if (enc3 != 64) {
          output += f(output_ | chr2);
        }
        if (enc4 != 64) {
          output_ = chr3 << 8;
        }
      } else {
        output = output + f(output_ | chr1);
        
        if (enc3 != 64) {
          output_ = chr2 << 8;
        }
        if (enc4 != 64) {
          output += f(output_ | chr3);
        }
      }
      ol+=3;
    }
    
    return LZString.decompress(output);
    
  },

  compressToUTF16 : function (input) {
    if (input == null) return "";
    var output = "",
        i,c,
        current,
        status = 0,
        f = LZString._f;
    
    input = LZString.compress(input);
    
    for (i=0 ; i<input.length ; i++) {
      c = input.charCodeAt(i);
      switch (status++) {
        case 0:
          output += f((c >> 1)+32);
          current = (c & 1) << 14;
          break;
        case 1:
          output += f((current + (c >> 2))+32);
          current = (c & 3) << 13;
          break;
        case 2:
          output += f((current + (c >> 3))+32);
          current = (c & 7) << 12;
          break;
        case 3:
          output += f((current + (c >> 4))+32);
          current = (c & 15) << 11;
          break;
        case 4:
          output += f((current + (c >> 5))+32);
          current = (c & 31) << 10;
          break;
        case 5:
          output += f((current + (c >> 6))+32);
          current = (c & 63) << 9;
          break;
        case 6:
          output += f((current + (c >> 7))+32);
          current = (c & 127) << 8;
          break;
        case 7:
          output += f((current + (c >> 8))+32);
          current = (c & 255) << 7;
          break;
        case 8:
          output += f((current + (c >> 9))+32);
          current = (c & 511) << 6;
          break;
        case 9:
          output += f((current + (c >> 10))+32);
          current = (c & 1023) << 5;
          break;
        case 10:
          output += f((current + (c >> 11))+32);
          current = (c & 2047) << 4;
          break;
        case 11:
          output += f((current + (c >> 12))+32);
          current = (c & 4095) << 3;
          break;
        case 12:
          output += f((current + (c >> 13))+32);
          current = (c & 8191) << 2;
          break;
        case 13:
          output += f((current + (c >> 14))+32);
          current = (c & 16383) << 1;
          break;
        case 14:
          output += f((current + (c >> 15))+32, (c & 32767)+32);
          status = 0;
          break;
      }
    }
    
    return output + f(current + 32);
  },
  

  decompressFromUTF16 : function (input) {
    if (input == null) return "";
    var output = "",
        current,c,
        status=0,
        i = 0,
        f = LZString._f;
    
    while (i < input.length) {
      c = input.charCodeAt(i) - 32;
      
      switch (status++) {
        case 0:
          current = c << 1;
          break;
        case 1:
          output += f(current | (c >> 14));
          current = (c&16383) << 2;
          break;
        case 2:
          output += f(current | (c >> 13));
          current = (c&8191) << 3;
          break;
        case 3:
          output += f(current | (c >> 12));
          current = (c&4095) << 4;
          break;
        case 4:
          output += f(current | (c >> 11));
          current = (c&2047) << 5;
          break;
        case 5:
          output += f(current | (c >> 10));
          current = (c&1023) << 6;
          break;
        case 6:
          output += f(current | (c >> 9));
          current = (c&511) << 7;
          break;
        case 7:
          output += f(current | (c >> 8));
          current = (c&255) << 8;
          break;
        case 8:
          output += f(current | (c >> 7));
          current = (c&127) << 9;
          break;
        case 9:
          output += f(current | (c >> 6));
          current = (c&63) << 10;
          break;
        case 10:
          output += f(current | (c >> 5));
          current = (c&31) << 11;
          break;
        case 11:
          output += f(current | (c >> 4));
          current = (c&15) << 12;
          break;
        case 12:
          output += f(current | (c >> 3));
          current = (c&7) << 13;
          break;
        case 13:
          output += f(current | (c >> 2));
          current = (c&3) << 14;
          break;
        case 14:
          output += f(current | (c >> 1));
          current = (c&1) << 15;
          break;
        case 15:
          output += f(current | c);
          status=0;
          break;
      }
      
      
      i++;
    }
    
    return LZString.decompress(output);
    //return output;
    
  },


  
  compress: function (uncompressed) {
    if (uncompressed == null) return "";
    var i, value,
        context_dictionary= {},
        context_dictionaryToCreate= {},
        context_c="",
        context_wc="",
        context_w="",
        context_enlargeIn= 2, // Compensate for the first entry which should not count
        context_dictSize= 3,
        context_numBits= 2,
        context_data_string="", 
        context_data_val=0, 
        context_data_position=0,
        ii,
        f=LZString._f;
    
    for (ii = 0; ii < uncompressed.length; ii += 1) {
      context_c = uncompressed.charAt(ii);
      if (!Object.prototype.hasOwnProperty.call(context_dictionary,context_c)) {
        context_dictionary[context_c] = context_dictSize++;
        context_dictionaryToCreate[context_c] = true;
      }
      
      context_wc = context_w + context_c;
      if (Object.prototype.hasOwnProperty.call(context_dictionary,context_wc)) {
        context_w = context_wc;
      } else {
        if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)) {
          if (context_w.charCodeAt(0)<256) {
            for (i=0 ; i<context_numBits ; i++) {
              context_data_val = (context_data_val << 1);
              if (context_data_position == 15) {
                context_data_position = 0;
                context_data_string += f(context_data_val);
                context_data_val = 0;
              } else {
                context_data_position++;
              }
            }
            value = context_w.charCodeAt(0);
            for (i=0 ; i<8 ; i++) {
              context_data_val = (context_data_val << 1) | (value&1);
              if (context_data_position == 15) {
                context_data_position = 0;
                context_data_string += f(context_data_val);
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          } else {
            value = 1;
            for (i=0 ; i<context_numBits ; i++) {
              context_data_val = (context_data_val << 1) | value;
              if (context_data_position == 15) {
                context_data_position = 0;
                context_data_string += f(context_data_val);
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = 0;
            }
            value = context_w.charCodeAt(0);
            for (i=0 ; i<16 ; i++) {
              context_data_val = (context_data_val << 1) | (value&1);
              if (context_data_position == 15) {
                context_data_position = 0;
                context_data_string += f(context_data_val);
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          }
          context_enlargeIn--;
          if (context_enlargeIn == 0) {
            context_enlargeIn = Math.pow(2, context_numBits);
            context_numBits++;
          }
          delete context_dictionaryToCreate[context_w];
        } else {
          value = context_dictionary[context_w];
          for (i=0 ; i<context_numBits ; i++) {
            context_data_val = (context_data_val << 1) | (value&1);
            if (context_data_position == 15) {
              context_data_position = 0;
              context_data_string += f(context_data_val);
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
          
          
        }
        context_enlargeIn--;
        if (context_enlargeIn == 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        // Add wc to the dictionary.
        context_dictionary[context_wc] = context_dictSize++;
        context_w = String(context_c);
      }
    }
    
    // Output the code for w.
    if (context_w !== "") {
      if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)) {
        if (context_w.charCodeAt(0)<256) {
          for (i=0 ; i<context_numBits ; i++) {
            context_data_val = (context_data_val << 1);
            if (context_data_position == 15) {
              context_data_position = 0;
              context_data_string += f(context_data_val);
              context_data_val = 0;
            } else {
              context_data_position++;
            }
          }
          value = context_w.charCodeAt(0);
          for (i=0 ; i<8 ; i++) {
            context_data_val = (context_data_val << 1) | (value&1);
            if (context_data_position == 15) {
              context_data_position = 0;
              context_data_string += f(context_data_val);
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        } else {
          value = 1;
          for (i=0 ; i<context_numBits ; i++) {
            context_data_val = (context_data_val << 1) | value;
            if (context_data_position == 15) {
              context_data_position = 0;
              context_data_string += f(context_data_val);
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = 0;
          }
          value = context_w.charCodeAt(0);
          for (i=0 ; i<16 ; i++) {
            context_data_val = (context_data_val << 1) | (value&1);
            if (context_data_position == 15) {
              context_data_position = 0;
              context_data_string += f(context_data_val);
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        }
        context_enlargeIn--;
        if (context_enlargeIn == 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        delete context_dictionaryToCreate[context_w];
      } else {
        value = context_dictionary[context_w];
        for (i=0 ; i<context_numBits ; i++) {
          context_data_val = (context_data_val << 1) | (value&1);
          if (context_data_position == 15) {
            context_data_position = 0;
            context_data_string += f(context_data_val);
            context_data_val = 0;
          } else {
            context_data_position++;
          }
          value = value >> 1;
        }
        
        
      }
      context_enlargeIn--;
      if (context_enlargeIn == 0) {
        context_enlargeIn = Math.pow(2, context_numBits);
        context_numBits++;
      }
    }
    
    // Mark the end of the stream
    value = 2;
    for (i=0 ; i<context_numBits ; i++) {
      context_data_val = (context_data_val << 1) | (value&1);
      if (context_data_position == 15) {
        context_data_position = 0;
        context_data_string += f(context_data_val);
        context_data_val = 0;
      } else {
        context_data_position++;
      }
      value = value >> 1;
    }
    
    // Flush the last char
    while (true) {
      context_data_val = (context_data_val << 1);
      if (context_data_position == 15) {
        context_data_string += f(context_data_val);
        break;
      }
      else context_data_position++;
    }
    return context_data_string;
  },
  
  decompress: function (compressed) {
    if (compressed == null) return "";
    if (compressed == "") return null;
    var dictionary = [],
        next,
        enlargeIn = 4,
        dictSize = 4,
        numBits = 3,
        entry = "",
        result = "",
        i,
        w,
        bits, resb, maxpower, power,
        c,
        f = LZString._f,
        data = {string:compressed, val:compressed.charCodeAt(0), position:32768, index:1};
    
    for (i = 0; i < 3; i += 1) {
      dictionary[i] = i;
    }
    
    bits = 0;
    maxpower = Math.pow(2,2);
    power=1;
    while (power!=maxpower) {
      resb = data.val & data.position;
      data.position >>= 1;
      if (data.position == 0) {
        data.position = 32768;
        data.val = data.string.charCodeAt(data.index++);
      }
      bits |= (resb>0 ? 1 : 0) * power;
      power <<= 1;
    }
    
    switch (next = bits) {
      case 0: 
          bits = 0;
          maxpower = Math.pow(2,8);
          power=1;
          while (power!=maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = 32768;
              data.val = data.string.charCodeAt(data.index++);
            }
            bits |= (resb>0 ? 1 : 0) * power;
            power <<= 1;
          }
        c = f(bits);
        break;
      case 1: 
          bits = 0;
          maxpower = Math.pow(2,16);
          power=1;
          while (power!=maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = 32768;
              data.val = data.string.charCodeAt(data.index++);
            }
            bits |= (resb>0 ? 1 : 0) * power;
            power <<= 1;
          }
        c = f(bits);
        break;
      case 2: 
        return "";
    }
    dictionary[3] = c;
    w = result = c;
    while (true) {
      if (data.index > data.string.length) {
        return "";
      }
      
      bits = 0;
      maxpower = Math.pow(2,numBits);
      power=1;
      while (power!=maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position == 0) {
          data.position = 32768;
          data.val = data.string.charCodeAt(data.index++);
        }
        bits |= (resb>0 ? 1 : 0) * power;
        power <<= 1;
      }

      switch (c = bits) {
        case 0: 
          bits = 0;
          maxpower = Math.pow(2,8);
          power=1;
          while (power!=maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = 32768;
              data.val = data.string.charCodeAt(data.index++);
            }
            bits |= (resb>0 ? 1 : 0) * power;
            power <<= 1;
          }

          dictionary[dictSize++] = f(bits);
          c = dictSize-1;
          enlargeIn--;
          break;
        case 1: 
          bits = 0;
          maxpower = Math.pow(2,16);
          power=1;
          while (power!=maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = 32768;
              data.val = data.string.charCodeAt(data.index++);
            }
            bits |= (resb>0 ? 1 : 0) * power;
            power <<= 1;
          }
          dictionary[dictSize++] = f(bits);
          c = dictSize-1;
          enlargeIn--;
          break;
        case 2: 
          return result;
      }
      
      if (enlargeIn == 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }
      
      if (dictionary[c]) {
        entry = dictionary[c];
      } else {
        if (c === dictSize) {
          entry = w + w.charAt(0);
        } else {
          return null;
        }
      }
      result += entry;
      
      // Add w+entry[0] to the dictionary.
      dictionary[dictSize++] = w + entry.charAt(0);
      enlargeIn--;
      
      w = entry;
      
      if (enlargeIn == 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }
      
    }
  }
};

if( typeof module !== 'undefined' && module != null ) {
  module.exports = LZString
}
/*
 * @author Kirill Edelman
 * @source https://github.com/kirilledelman/pixelbox
 * @documentation https://github.com/kirilledelman/pixelbox/wiki
 * @license MIT
*/

THREE.Object3D.prototype.nearestParentWithProperty = function ( prop, val ) {

	if ( this.parent ) {
	
		if ( this.parent[ prop ] && (val === undefined || this.parent[ prop ] === val) ) return this.parent;
		
		return this.parent.nearestParentWithProperty( prop, val );
		
	}
	
	return null;
	
}

THREE.Object3D.prototype.isVisibleRecursive = function () {

	if ( !this.visible ) return false;
	
	if ( this.parent ) return this.parent.isVisibleRecursive();
	
	return this.visible;	
}

/* another can be an array or a single object */
THREE.Object3D.prototype.isDescendantOf = function ( another ) {

	if ( !this.parent ) return false;
	
	if ( _.isArray( another ) ) {
	
		for ( var i = 0, l = another.length; i < l; i++ ) {
		
			var ai = another[ i ];
			if ( this.parent == ai ) return true;
			var p = this.parent.isDescendantOf( ai );
			if ( p ) return true;
			
		}
		
		return false;
		
	} else {
	
		if ( this.parent == another ) return true;
		return this.parent.isDescendantOf( another );
		
	}
}

/* if object is a descendent of an instance, returns that instance */
THREE.Object3D.prototype.parentInstance = function () {

	if ( this.isInstance ) return this;
	
	if ( !this.parent ) return null;
	
	return this.parent.parentInstance();
	
};

/* if object is a descendent of a template, returns that template */
THREE.Object3D.prototype.nearestTemplate = function () {

	if ( this.isTemplate ) return this;
	
	return this.nearestParentWithProperty( 'isTemplate', true );
	
};

/* 
   removes / dismantles object hierarchy (skips objects in omit array and doesn't remove anchors)
   returns all objects affected
   
   used when recycling objects
*/

THREE.Object3D.prototype.recursiveRemoveChildren = function ( omit ) {

	var removedChildren = [];
	
	for ( var i = this.children.length - 1; i >= 0; i-- ) {
	
		var child = this.children[ i ];
		
		if ( omit && omit.indexOf( child ) !== -1) continue;
		
		removedChildren = removedChildren.concat(child.recursiveRemoveChildren( omit ));
		if ( child.stopTweens ) child.stopTweens();
		if ( child.stopAnim ) child.stopAnim();
		if ( child['name'] ) {
		
			if ( child.anchored && this.parent[ child.name ] && this.parent[ child.name ] == child ) {
			
				delete this.parent[child.name];
				
			} else if ( this[ child.name ] == child ) {
			
				delete this[ child.name ];
				
			}
			
		}
		
		if ( !child.isAnchor ) {
		
			this.remove( child );
			removedChildren.push( child );
			
		}
		
	}
	
	return removedChildren;
	
};

THREE.Object3D.prototype.getObjectByUUID = function ( uuid, recursive ) {

	if ( this.uuid === uuid ) return this;

	for ( var i = 0, l = this.children.length; i < l; i ++ ) {
		var child = this.children[ i ];
		var object = child.getObjectByUUID( uuid, recursive );
		if ( object !== undefined ) {
		
			return object;
			
		}
		
	}
	
	return undefined;
	
};

THREE.Object3D.prototype.removeFromParent = function () {

	if ( !this.parent ) return false;
	this.parent.remove( this );
	return true;
	
};

THREE.Object3D.prototype.lookAtObject = function ( other ) {

	var objWorldPosition = other.parent ? other.parent.localToWorld( other.position.clone() ) : other.position.clone();
	this.lookAt( this.parent ? this.parent.worldToLocal( objWorldPosition ) : objWorldPosition );
	
};

THREE.Object3D.prototype.transplant = function ( newParent ) {

	if ( newParent.isDescendantOf( this ) ) {
	
		console.error( "Can't transplant this object to its descendant." );
		return;
		
	}
	
	// convert transform to world
	this.matrix.copy( this.matrixWorld );
	this.matrix.decompose( this.position, this.quaternion, this.scale );
	this.rotation.setFromQuaternion( this.quaternion );
	
	// parent to new parent
	var inv = new THREE.Matrix4();
	inv.getInverse( newParent.matrixWorld );
	inv.multiply( this.matrix );
	this.matrix.copy( inv );
	
	// refresh pos/rot/sc
	this.matrix.decompose( this.position, this.quaternion, this.scale );
	this.rotation.setFromQuaternion( this.quaternion );
	
	newParent.add( this );
	
};

/* 
	Tweening functions:
	
	Tweens are implemented using setTimeout, and are automatically paused/resumed when renderer.pause(bPause) is called
	Tweening is done at .tweenFps rate (default is 30 frames per second)
	If you wish to stop tweens, keep a reference to the object you passed to tween(obj) function, and call stopTween(obj) later
	
	Example use:
	
	potato.tween({ prop:"alpha", from: 1, to: 0, duration: 1.0 })
	potato.tween({ target: potato.position, from: potato.position, to: vec3, duration: 1.0, done: someFunc })
	parameters:
	(Object) target - 	if target is not given, it defaults to this PixelBox instance
						if is THREE.Vector3 or THREE.Euler or THREE.Color - tween will interpolate target to "to" param
						if target is another object, property "prop" is also required and will be interpolated
	
	(Number) duration - (optional) duration of interpolation, defaults to 1 sec
	(INT) fps - tween FPS
	(same type as target property) from - (optional) starting value, defaults to current value
	(Function) done - (optional) on complete function
	(Function) easing - (optional) easing func of form: function (t, b, c, d), where t = current time, b = start value, c = change in value, d = duration
	(more functions at http://gizma.com/easing) There are a few Math.* after the tween functions
	
*/

THREE.Object3D.prototype.applyTween = function ( tweenObj ) {

	if ( tweenObj.target instanceof THREE.Color ) {
	
		tweenObj.target.r = tweenObj.easing( tweenObj.time, tweenObj.from.r, tweenObj.to.r - tweenObj.from.r, tweenObj.duration );
		tweenObj.target.g = tweenObj.easing( tweenObj.time, tweenObj.from.g, tweenObj.to.g - tweenObj.from.g, tweenObj.duration );
		tweenObj.target.b = tweenObj.easing( tweenObj.time, tweenObj.from.b, tweenObj.to.b - tweenObj.from.b, tweenObj.duration );
		
	} else if ( tweenObj.target instanceof THREE.Vector3 ) {
	
		tweenObj.target.set(
			tweenObj.easing( tweenObj.time, tweenObj.from.x, tweenObj.to.x - tweenObj.from.x, tweenObj.duration ),
			tweenObj.easing( tweenObj.time, tweenObj.from.y, tweenObj.to.y - tweenObj.from.y, tweenObj.duration ),
			tweenObj.easing( tweenObj.time, tweenObj.from.z, tweenObj.to.z - tweenObj.from.z, tweenObj.duration )
		);
		
	} else if ( tweenObj.target instanceof THREE.Euler ) {
	
		tweenObj.target.set(
			tweenObj.easing( tweenObj.time, tweenObj.from.x, tweenObj.to.x - tweenObj.from.x, tweenObj.duration ),
			tweenObj.easing( tweenObj.time, tweenObj.from.y, tweenObj.to.y - tweenObj.from.y, tweenObj.duration ),
			tweenObj.easing( tweenObj.time, tweenObj.from.z, tweenObj.to.z - tweenObj.from.z, tweenObj.duration ), 'XYZ'
		);
		
	} else if ( tweenObj.prop ) {
	
		tweenObj.target[ tweenObj.prop ] = 
			tweenObj.easing( tweenObj.time, tweenObj.from, tweenObj.to - tweenObj.from, tweenObj.duration );
			
	}
	
}

THREE.Object3D.prototype.advanceTweenFrame = function () {

	if ( this._tweenInterval ) clearTimeout( this._tweenInterval );
	
	var nextFrameIn = 1.0 / this.tweenFps;
	var keepGoing = true;
	
	if ( !renderer.paused ) {
		this._tweenInterval = 0;
		for ( var i = this._tweens.length - 1; i >= 0; i-- ) {
		
			var tweenObj = this._tweens[ i ];
			
			tweenObj.time = Math.min( tweenObj.time + nextFrameIn, tweenObj.duration );
			
			this.applyTween( tweenObj );
			
			if ( tweenObj.time >= tweenObj.duration ) {
				
				// loop
				if ( tweenObj.numLoops > 0 ) {
				
					tweenObj.numLoops--;
					if ( tweenObj.autoReverse ) {
					
						var temp = tweenObj.to;
						tweenObj.to = tweenObj.from;
						tweenObj.from = temp;
						
					}
					
					if ( tweenObj.loop !== undefined ) tweenObj.loop.call( this, tweenObj );
					tweenObj.time = 0;
					
				// finish tween
				} else {
				
					if ( tweenObj.done !== undefined ) tweenObj.done.call( this, tweenObj );
					this._tweens.splice( i, 1 );
					
				}
				
			}
					
		}
		
		keepGoing = this._tweens.length > 0;
		
	}
	
	// set up next time
	if ( keepGoing ) {
	
		this._tweenInterval = setTimeout( this.advanceTweenFrame, nextFrameIn * 1000 );
		
	}
	
};

THREE.Object3D.prototype.tween = function ( obj ) {

	var objs;
	if ( !_.isArray( obj ) ) objs = [ obj ];
	else objs = obj;
	
	// first time
	if ( !this.hasOwnProperty( 'advanceTweenFrame' ) ) {
	
		this._tweens = [];
		this.advanceTweenFrame = this.advanceTweenFrame.bind( this );
		this.tweenFps = (this.tweenFps !== undefined ? this.tweenFps : 30);
		
	}
	
	for ( var i = objs.length - 1; i >= 0; i-- ) {
	
		var tweenObj = objs[ i ];
		tweenObj.time = 0;
		
		// validate
		if ( tweenObj.duration === undefined ) tweenObj.duration = 1.0;
		
		if ( tweenObj.target === undefined ) tweenObj.target = this;
		
		if ( tweenObj.easing === undefined ) tweenObj.easing = Math.linearTween;
		
		if ( tweenObj.numLoops === undefined ) tweenObj.numLoops = 0;
		
		if ( tweenObj.from === undefined ) {
		
			if ( tweenObj.target instanceof THREE.Color || tweenObj.target instanceof THREE.Vector3 || tweenObj.target instanceof THREE.Euler ) {
			
				tweenObj.from = tweenObj.target.clone();
				
			} else if ( tweenObj.prop && tweenObj.target[ tweenObj.prop ] ) {
			
				tweenObj.from = _deepClone( tweenObj.target[ tweenObj.prop ] );
				
			} else {
			
				tweenObj.from = 0;
				
			}
			
		}
		
		if ( tweenObj.to === undefined ) {
		
			console.log( "tween object \'to\' parameter is missing: ", tweenObj );
			objs.splice( i, 1 );
			continue;
			
		}
		
	}
	
	this._tweens = this._tweens.concat( objs );
	
	if ( !this._tweenInterval && this._tweens.length ) setTimeout( this.advanceTweenFrame, 1000 / this.tweenFps );
	
	return objs;
	
};

/* stops all tweens */
THREE.Object3D.prototype.stopTweens = function ( snapToFinish, callDone ) {

	if ( !this._tweens ) return;
	if ( snapToFinish ) {
	
		for ( var i = 0, l = this._tweens.length; i < l; i++ ) {
		
			var tweenObj = this._tweens[ i ];
			tweenObj.time = tweenObj.duration;
			this.applyTween( tweenObj );
			if ( callDone && tweenObj.done !== undefined ) tweenObj.done.call( this, tweenObj ); 
		}
		
	}
	
	this._tweens.length = 0;
	delete this._tweens;
	this._tweens = [];
	if ( this._tweenInterval ) clearTimeout( this._tweenInterval );
	this._tweenInterval = 0;
	
};

/* stops specific tween */
THREE.Object3D.prototype.stopTween = function ( obj, snapToFinish, callDone ) {

	if ( !this._tweens ) return;
	var index = this._tweens.indexOf( obj );
	if ( index !== -1 ) {
	
		if ( snapToFinish ) {
		
			var tweenObj = this._tweens[ index ];
			tweenObj.time = tweenObj.duration;
			this.applyTween( tweenObj );
			if ( callDone && tweenObj.done !== undefined ) tweenObj.done.call( this, tweenObj );
			
		}
		this._tweens.splice( index, 1 );
		if ( !this._tweens.length && this._tweenInterval ) { 
		
			clearTimeout( this._tweenInterval );
			this._tweenInterval = 0;
			
		}
		
	}
	
};

/* ================================================================================ Util */

/* easing: t = current time, b = start value, c = change in value, d = duration */
Math.easeInOutSine = function ( t, b, c, d ) { return -c * 0.5 * (Math.cos( Math.PI * t / d ) - 1) + b; };

Math.easeInSine = function ( t, b, c, d ) { return -c * Math.cos( t / d * Math.PI * 0.5 ) + c + b; };

Math.easeOutSine = function ( t, b, c, d ) { return c * Math.sin( t / d * Math.PI * 0.5 ) + b; };

Math.linearTween = function ( t, b, c, d ) { return c * t / d + b; };

/* pseudo - random number */
Math.seededRandom = function ( seed ) {

	var x = Math.sin( seed + 1 ) * 10000;
	return x - Math.floor( x );
	
};

/* deep clone */
function _deepClone( obj, depth ) {

	if ( typeof obj !== 'object' ) return obj;
	if ( obj === null) return null;
	if ( _.isString( obj ) ) return obj.splice();
	if ( _.isDate( obj ) ) return new Date( obj.getTime() );
	if ( _.isFunction ( obj.clone ) ) return obj.clone();
	var clone = _.isArray( obj ) ? obj.slice() : _.extend( {}, obj );
	// clone array's extended props
	if ( _.isArray( obj ) ) {
	
		for ( var p in obj ) {
		
			if ( obj.hasOwnProperty( p ) && _.isUndefined( clone[ p ] ) && isNaN( p ) ) clone[ p ] = obj[ p ];
			
		}
		
	}
	if ( !_.isUndefined( depth ) && ( depth > 0 ) ) {
	
	  for ( var key in clone ) {
	  
	    clone[ key ] = _deepClone( clone[ key ], depth - 1 );
	    
	  }
	  
	}
	
	return clone;
	
};


/*
 * @author Kirill Edelman
 * @source https://github.com/kirilledelman/pixelbox
 * @documentation https://github.com/kirilledelman/pixelbox/wiki
 * @license MIT
*/

THREE.PixelBoxDepthShader = {
	uniforms: {
		tintAlpha: 	{ type: "f", value: 1.0 },
		pointSize: 	{ type: 'f', value: 1.0 },
	},
	
	vertexShader: [
		"attribute vec4 color;",
	
		"uniform float pointSize;",
		"uniform float tintAlpha;",
		
		"varying vec4 vColor;",
		
		"void main() {",
		"	vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
		
		"	vColor = vec4(color.rgb, color.a * tintAlpha);",
		"	gl_Position = projectionMatrix * mvPosition;",
		"	float pointScaleMult = max(length(vec3(modelMatrix[0][0],modelMatrix[1][0],modelMatrix[2][0] )),",
		"		max(length(vec3(modelMatrix[0][1],modelMatrix[1][1],modelMatrix[2][1] )),",
		"		length(vec3(modelMatrix[0][2],modelMatrix[1][2],modelMatrix[2][2] ))));",
		"	if (projectionMatrix[3][3] == 0.0) {",// perspective
		"		float fov = 2.0 * atan(1.0 / projectionMatrix[1][1]);",
		"		gl_PointSize = pointScaleMult * pointSize * 600.0 * fov / pow(gl_Position.w, 1.0 + fov * 0.25);",
		"	} else {", // ortho
		"		gl_PointSize = pointScaleMult * pointSize * 6.0;",
		"	} ",
		"}"	].join( "\n" ),

	fragmentShader: [
		"varying vec4 vColor;",
		"float rand(vec2 co) {",
		"	float a = 12.9898;",
		"	float b = 78.233;",
		"   float c = 43758.5453;",
		"   float dt= dot(co.xy ,vec2(a,b));",
		"   float sn= mod(dt,3.14);",
		"   return fract(sin(sn) * c);",
		"}",
		"vec4 pack_depth( const in float depth ) {",
		"	const vec4 bit_shift = vec4( 256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0 );",
		"	const vec4 bit_mask = vec4( 0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0 );",
		"	vec4 res = mod( depth * bit_shift * vec4( 255 ), vec4( 256 ) ) / vec4( 255 );",
		"	res -= res.xxyz * bit_mask;",
		"	return res;",
		"}",
		"void main() {",
		"	if (vColor.a < 1.0) {",
		"		float a = rand(gl_FragCoord.xy);",
		"		a = 1.0 - step(vColor.a, a);",
		"		if (a == 0.0) discard;",
		"	}",
		"	gl_FragData[ 0 ] = pack_depth(gl_FragCoord.z);",
		"}"
	].join( "\n" )

};

THREE.PixelBoxShader = {
	uniforms: {
		// tint color
		tintColor:	{ type: "c", value: new THREE.Color( 0xffffff ) }, // multiply tint 
		addColor:	{ type: "c", value: new THREE.Color( 0x0 ) }, // add tint
		tintAlpha: 	{ type: "f", value: 1.0 },
		
		// point scale
		pointSize: 	{ type: "f", value: 1.0 },
		
		// ambient occlusion effect
		occlusion: 	{ type: "f", value: 1.0 },
		
		// back facing cull mode
		cullBack: { type:"i", value: 1 },
		
		// fog color
		fogColor:    { type: "c", value: new THREE.Color( 0xFFFFFF ) },
	    fogNear:     { type: "f", value: 100 },
	    fogFar:      { type: "f", value: 1000 },
	    
	    // stipple
	    stipple: { type: "f", value: 0 },
	    
	    // shared uniforms
		viewPortScale: { type: "f", value: 0.0 },// viewport size
		actualHemiLights: { type: "i", value: 0 },	    
		actualPointLights: { type: "i", value: 0 },
		actualDirLights: { type: "i", value: 0 },
		directionalLightShadowMap: { type: "iv1", value: [] },
		actualSpotLights: { type: "i", value: 0 },
		spotLightShadowMap: { type: "iv1", value: [] }
		
	},

	attributes: {
		color:		{	type: "v4", value: null },
		normal: 	{	type: "v3", value: null },
		occlude:	{	type: "f", value: null },
		position:	{	type: "v3", value: null },
	},

	vertexShader: [
		"attribute vec4 color;",
		"attribute float occlude;",
		
		"uniform float pointSize;",
		"uniform float viewPortScale;",
		"uniform float tintAlpha;",
		"uniform vec3 tintColor;",
		"uniform vec3 addColor;",

		"uniform vec3 fogColor;",
		"uniform float fogNear;",
		"uniform float fogFar;",
		
		"uniform vec3 ambientLightColor;",
		"uniform float occlusion;",

		"uniform int actualHemiLights;",
		"uniform int actualDirLights;",
		"uniform int actualPointLights;",
		"uniform int actualSpotLights;",

		"uniform int cullBack;",

		"varying vec4 vColor;",
		
		"#ifdef USE_SHADOWMAP",
		"	uniform mat4 shadowMatrix[ MAX_SHADOWS ];",
		
		"	uniform sampler2D shadowMap[ MAX_SHADOWS ];",
		"	uniform vec2 shadowMapSize[ MAX_SHADOWS ];",
		"	uniform float shadowBias[ MAX_SHADOWS ];",
		
		"	float unpackDepth( const in vec4 rgba_depth ) {",		
		"		const vec4 bit_shift = vec4( 1.0 / ( 256.0 * 256.0 * 256.0 ), 1.0 / ( 256.0 * 256.0 ), 1.0 / 256.0, 1.0 );",
		"		float depth = dot( rgba_depth, bit_shift );",
		"		return depth;",
		"	}",
		
		"	vec3 getShadowColor(int shIndex, vec4 mPosition) {",
		"		float fDepth;",
		"		vec3 shadowColor = vec3( 1.0 );",
		
		"		vec4 shadowCoord4 = shadowMatrix[ shIndex ] * mPosition;",
		"		vec3 shadowCoord = shadowCoord4.xyz / shadowCoord4.w;",
		"		bvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );",
		"		bool inFrustum = all( inFrustumVec );",
		"		bvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );",
		"		bool frustumTest = all( frustumTestVec );",
		
		"		if ( frustumTest ) {",
		"			vec4 rgbaDepth;",
		"			if (shIndex == 0) {",
		"				rgbaDepth = texture2D( shadowMap[ 0 ], shadowCoord.xy );",
		"			}",
		"#if MAX_SHADOWS >= 2",
		"			else if (shIndex == 1) {",
		"				rgbaDepth = texture2D( shadowMap[ 1 ], shadowCoord.xy );",
		"			}",
		"#endif",
		"#if MAX_SHADOWS >= 3",
		"			else if (shIndex == 2) {",
		"				rgbaDepth = texture2D( shadowMap[ 2 ], shadowCoord.xy );",
		"			}",
		"#endif",
		"#if MAX_SHADOWS >= 4",
		"			else if (shIndex == 3) {",
		"				rgbaDepth = texture2D( shadowMap[ 3 ], shadowCoord.xy );",
		"			}",
		"#endif",
		"#if MAX_SHADOWS >= 5",
		"			else if (shIndex == 4) {",
		"				rgbaDepth = texture2D( shadowMap[ 4 ], shadowCoord.xy );",
		"			}",
		"#endif",
		"#if MAX_SHADOWS >= 6",
		"			else if (shIndex == 5) {",
		"				rgbaDepth = texture2D( shadowMap[ 5 ], shadowCoord.xy );",
		"			}",
		"#endif",
		"#if MAX_SHADOWS >= 7",
		"			else if (shIndex == 6) {",
		"				rgbaDepth = texture2D( shadowMap[ 6 ], shadowCoord.xy );",
		"			}",
		"#endif",
		"#if MAX_SHADOWS >= 8",
		"			else if (shIndex == 7) {",
		"				rgbaDepth = texture2D( shadowMap[ 7 ], shadowCoord.xy );",
		"			}",
		"#endif",
		"			float fDepth = unpackDepth( rgbaDepth );",
		"			shadowCoord.z += shadowBias[ shIndex ];",
		"			if ( fDepth < shadowCoord.z ) {",
		"				shadowColor = vec3(0.0);",
		"			}",
		
		"		}",
		
		"		return shadowColor;",		
		"	}",
		
		
		"#endif",
		
		"#if MAX_DIR_LIGHTS > 0",
		"uniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];",
		"uniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];",
		"uniform int directionalLightShadowMap[ MAX_DIR_LIGHTS ];",
		"#endif",
		
		"#if MAX_SPOT_LIGHTS > 0",
		"uniform vec3 spotLightColor[ MAX_SPOT_LIGHTS ];",
		"uniform vec3 spotLightPosition[ MAX_SPOT_LIGHTS ];",
		"uniform vec3 spotLightDirection[ MAX_SPOT_LIGHTS ];",
		"uniform float spotLightAngleCos[ MAX_SPOT_LIGHTS ];",
		"uniform float spotLightExponent[ MAX_SPOT_LIGHTS ];",
		"uniform float spotLightDistance[ MAX_SPOT_LIGHTS ];",
		"uniform int spotLightShadowMap[ MAX_SPOT_LIGHTS ];",
		"#endif",
		
		"#if MAX_HEMI_LIGHTS > 0",
		"uniform vec3 hemisphereLightSkyColor[ MAX_HEMI_LIGHTS ];",
		"uniform vec3 hemisphereLightGroundColor[ MAX_HEMI_LIGHTS ];",
		"uniform vec3 hemisphereLightDirection[ MAX_HEMI_LIGHTS ];",
		"#endif",
		
		"#if MAX_POINT_LIGHTS > 0",
		"uniform vec3 pointLightColor[ MAX_POINT_LIGHTS ];",
		"uniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];",
		"uniform float pointLightDistance[ MAX_POINT_LIGHTS ];",
		"#endif",
		
		"void main() {",
		"	vec3 diffuse = color.xyz;",
		"	diffuse *= tintColor;",
		
		"	vec3 totalAmbient = diffuse * ambientLightColor;",
		"	vec3 totalDirect = vec3(0.0);",
		"	vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
		"	vec4 mPosition = modelMatrix * vec4( position, 1.0 );",
		"	float normalLength = length(normal);",
		"	float brightness = normalLength - 1.0;",
		"	vec3 vertexNormal = normalize(normalMatrix * normal);",		
		
		"	if (cullBack != 0 && vertexNormal.z <= -0.5) { ",
		"		vColor = vec4(0.0);",
		"	} else { ",
		
		// point
		"#if MAX_POINT_LIGHTS > 0",
		"vec3 pointDiffuse = vec3( 0.0 );",
		"for ( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {",	//
		"	if (i < actualPointLights) {",
		"	vec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );",
		"	vec3 lVector = lPosition.xyz - mvPosition.xyz;",
		"	float lDistance = 1.0;",
		"	if ( pointLightDistance[ i ] > 0.0 )",
		"		lDistance = 1.0 - min( ( length( lVector ) / pointLightDistance[ i ] ), 1.0 );",
		"	lVector = normalize( lVector );",
		"	float dotProduct = dot( vertexNormal, lVector );",
		"	if (occlude < 0.0) dotProduct = (1.0 + max(dotProduct, 0.0) + occlude) * 0.5;",
		"	#ifdef WRAP_AROUND",
		"		float pointDiffuseWeightFull = max( dotProduct, 0.0 );",
		"		float pointDiffuseWeightHalf = max( 0.5 * dotProduct + 0.5, 0.0 );",
		"		vec3 pointDiffuseWeight = mix( vec3( pointDiffuseWeightFull ), vec3( pointDiffuseWeightHalf ), wrapRGB );",
		"	#else",
		"		float pointDiffuseWeight = max( dotProduct, 0.0 );",
		"	#endif",
		"	pointDiffuse += diffuse * pointLightColor[ i ] * pointDiffuseWeight * lDistance;",
		"	}",
		"}",
		"totalDirect += pointDiffuse;",
		"#endif",
	
		// temp vars used in shadows
		"	vec3 thisLight;",
		"	int shadowMapIndex;",
	
		// directional
		"#if MAX_DIR_LIGHTS > 0",
		"vec3 dirDiffuse = vec3( 0.0 );",
	
		"for ( int i = 0; i < MAX_DIR_LIGHTS; i ++ ) {", //
		"	if (i < actualDirLights) {",		
		"	vec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );",
		"	vec3 dirVector = normalize( lDirection.xyz);",
		"	float dotProduct = dot(vertexNormal, dirVector);",
		"	if (occlude < 0.0) dotProduct = (1.0 + max(dotProduct, 0.0) + occlude) * 0.5;",
		"	#ifdef WRAP_AROUND",
		"		float dirDiffuseWeightFull = max( dotProduct, 0.0 );",
		"		float dirDiffuseWeightHalf = max( 0.5 * dotProduct + 0.5, 0.0 );",
		"		vec3 dirDiffuseWeight = mix( vec3( dirDiffuseWeightFull ), vec3( dirDiffuseWeightHalf ), wrapRGB );",
		"	#else",
		"		float dirDiffuseWeight = max( dotProduct, 0.0 );",
		"	#endif",
		"	thisLight = diffuse * directionalLightColor[ i ] * dirDiffuseWeight;",
		"#ifdef USE_SHADOWMAP",
		"	shadowMapIndex = directionalLightShadowMap[ i ];",
		"	if (shadowMapIndex != 0) {",
		"		thisLight = thisLight * getShadowColor(shadowMapIndex - 1, mPosition);",
		"	}",
		"#endif",
		"	dirDiffuse += thisLight;",
		"	}",
		"}",
		"totalDirect += dirDiffuse;",
		"#endif",
	
		"#if MAX_SPOT_LIGHTS > 0",
		"vec3 spotDiffuse = vec3( 0.0 );",
		"for ( int i = 0; i < MAX_SPOT_LIGHTS; i ++ ) {", //
		"	if (i < actualSpotLights) {",		
		"	vec4 lPosition = viewMatrix * vec4( spotLightPosition[ i ], 1.0 );",
		"	vec3 lVector = lPosition.xyz - mvPosition.xyz;//lPosition.xyz + vViewPosition.xyz;",
		"	float lDistance = 1.0;",
		"	if ( spotLightDistance[ i ] > 0.0 )",
		"		lDistance = 1.0 - min( ( length( lVector ) / spotLightDistance[ i ] ), 1.0 );",
		"	lVector = normalize( lVector );",
		"	float spotEffect = dot( spotLightDirection[ i ], normalize( spotLightPosition[ i ] - mPosition.xyz ) );",
		"	if ( spotEffect > spotLightAngleCos[ i ] ) {",
		"		spotEffect = max( pow( max( spotEffect, 0.0 ), spotLightExponent[ i ] * 0.25 ), 0.0 );",
				// diffuse
		"		float dotProduct = dot( vertexNormal, lVector );",
		"		if (occlude < 0.0) dotProduct = (1.0 + max(dotProduct, 0.0) + occlude) * 0.5;",
		"		#ifdef WRAP_AROUND",
		"			float spotDiffuseWeightFull = max( dotProduct, 0.0 );",
		"			float spotDiffuseWeightHalf = max( 0.5 * dotProduct + 0.5, 0.0 );",
		"			vec3 spotDiffuseWeight = mix( vec3( spotDiffuseWeightFull ), vec3( spotDiffuseWeightHalf ), wrapRGB );",
		"		#else",
		"			float spotDiffuseWeight = max( dotProduct, 0.0 );",
		"		#endif",
		"		thisLight = diffuse * spotLightColor[ i ] * spotDiffuseWeight * lDistance * spotEffect;",
		"#ifdef USE_SHADOWMAP",
		"		shadowMapIndex = spotLightShadowMap[ i ];",
		"		if (shadowMapIndex != 0) {",
		"			thisLight = thisLight * getShadowColor(shadowMapIndex - 1, mPosition);",
		"		}",			
		"#endif",
		"		spotDiffuse += thisLight;",
		"	}",
		"	}",
		"}",
		"totalDirect += spotDiffuse;",
		"#endif",
	
		// hemi
		"#if MAX_HEMI_LIGHTS > 0",
		"vec3 hemiDiffuse = vec3( 0.0 );",
		"for ( int i = 0; i < MAX_HEMI_LIGHTS; i ++ ) {", //
		"	if (i < actualHemiLights) {",		
		"	vec4 lDirection = viewMatrix * vec4( hemisphereLightDirection[ i ], 0.0 );",
		"	vec3 lVector = normalize( lDirection.xyz );",
		"	float dotProduct = dot( vertexNormal, lVector );",
		"	if (occlude < 0.0) dotProduct = (1.0 + max(dotProduct, 0.0) + occlude) * 0.5;",
		"	float hemiDiffuseWeight = 0.5 * dotProduct + 0.5;",
		"	vec3 hemiColor = mix( hemisphereLightGroundColor[ i ], hemisphereLightSkyColor[ i ], hemiDiffuseWeight );",
		"	hemiDiffuse += diffuse * hemiColor;",
		"	}",
		"}",
		"totalAmbient += hemiDiffuse;",
		"#endif",
		
		"totalAmbient = totalAmbient * clamp(1.0 - occlusion * abs(occlude), 0.0, 1.0);",
		"vec3 totalDiffuse = mix(totalAmbient + totalDirect, diffuse, brightness);",
	
		// fog
		"	float depth = distance(mvPosition.xyz, cameraPosition);",
		"	vColor = vec4(addColor + mix(totalDiffuse, fogColor, smoothstep( fogNear, fogFar, depth )), color.a * tintAlpha);",
		
		"	} // end if cullBack ",
		
		"	gl_Position = projectionMatrix * mvPosition;",
		"	float pointScaleMult = max(length(vec3(modelMatrix[0][0],modelMatrix[1][0],modelMatrix[2][0] )),",
		"		max(length(vec3(modelMatrix[0][1],modelMatrix[1][1],modelMatrix[2][1] )),",
		"		length(vec3(modelMatrix[0][2],modelMatrix[1][2],modelMatrix[2][2] ))));",
		"	gl_PointSize = pointScaleMult * viewPortScale * pointSize / gl_Position.w;",
		"}"	].join( "\n" ),
		
	fragmentShader: [
		"varying vec4 vColor;",
		"uniform float stipple;",
		
		"float rand(vec2 co) {",
		"	float a = 12.9898;",
		"	float b = 78.233;",
		"   float c = 43758.5453;",
		"   float dt= dot(co.xy ,vec2(a,b));",
		"   float sn= mod(dt,3.14);",
		"   return fract(sin(sn) * c);",
		"}",
		"void main() {",
		"	float s = 1.0; ",
		"	if (stipple != 0.0) { ",
		"		vec2 stip = fract( vec2(gl_FragCoord.x + stipple, gl_FragCoord.y) * 0.5);",
		"		s = step(0.25,abs(stip.x-stip.y));",
		"	}",
		"	if (vColor.a == 0.0 || s == 0.0) discard;",
		"	else if (vColor.a < 1.0) {",
		"		float a = rand(gl_FragCoord.xy);",
		"		a = s * (1.0 - step(vColor.a, a));",
		"		if (a == 0.0) discard;",
		"	}",		
		"	gl_FragColor = vec4(vColor.rgb, 1.0);",
		"}"
	].join( "\n" )

};

THREE.PixelBoxMeshShader = {
	uniforms: {
		// tint color
		tintColor:	{ type: "c", value: new THREE.Color( 0xffffff ) },
		addColor:	{ type: "c", value: new THREE.Color( 0x0 ) },
		tintAlpha: 	{ type: "f", value: 1.0 },
		brightness: { type: "f", value: 0.0 },
		
		// fog color
		fogColor:    { type: "c", value: new THREE.Color( 0xFFFFFF ) },
	    fogNear:     { type: "f", value: 100 },
	    fogFar:      { type: "f", value: 1000 },
	    
	    // stipple
	    stipple: { type: "f", value: 0 },
	    
	    // shared uniforms
		actualHemiLights: { type: "i", value: 0 },	    
		actualPointLights: { type: "i", value: 0 },
		actualDirLights: { type: "i", value: 0 },
		directionalLightShadowMap: { type: "iv1", value: [] },
		actualSpotLights: { type: "i", value: 0 },
		spotLightShadowMap: { type: "iv1", value: [] }
	},

	attributes: {},

	vertexShader: [
	"varying vec3 vViewPosition;",
	"varying vec3 vNormal;",
	"varying vec4 vWorldPosition;",

	"void main() {",
	"#ifdef FLIP_SIDED",
	"	vNormal = normalize( normalMatrix * (-normal) );",
	"#else",
	"	vNormal = normalize( normalMatrix * normal );",
	"#endif",
	
	"	vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
	"	vViewPosition = -mvPosition.xyz;",
	"	vWorldPosition = modelMatrix * vec4( position, 1.0 );",
	
	"	gl_Position = projectionMatrix * mvPosition;",
	"}"
	].join( "\n" ),
	
	fragmentShader: [
	"uniform vec3 tintColor;",
	"uniform vec3 addColor;",
	"uniform float tintAlpha;",
	"uniform float stipple;",
	"uniform float brightness;",

	"uniform vec3 ambientLightColor;",

	"uniform int actualHemiLights;",
	"uniform int actualDirLights;",
	"uniform int actualPointLights;",
	"uniform int actualSpotLights;",

	"varying vec3 vViewPosition;",
	"varying vec3 vNormal;",
	"varying vec4 vWorldPosition;",
	
	"uniform vec3 fogColor;",
	"uniform float fogNear;",
	"uniform float fogFar;",

	"#ifdef USE_SHADOWMAP",
	"	uniform mat4 shadowMatrix[ MAX_SHADOWS ];",	
	"	uniform sampler2D shadowMap[ MAX_SHADOWS ];",
	"	uniform vec2 shadowMapSize[ MAX_SHADOWS ];",
	"	uniform float shadowBias[ MAX_SHADOWS ];",
	
	"	float unpackDepth( const in vec4 rgba_depth ) {",		
	"		const vec4 bit_shift = vec4( 1.0 / ( 256.0 * 256.0 * 256.0 ), 1.0 / ( 256.0 * 256.0 ), 1.0 / 256.0, 1.0 );",
	"		float depth = dot( rgba_depth, bit_shift );",
	"		return depth;",
	"	}",
	
	"	vec3 getShadowColor(int shadowIndex, vec4 mPosition) {",
	"		vec3 shadowColor = vec3(1.0);",
	"		float fDepth;",
	
	"		if (shadowIndex == 0) {",
	"			vec4 sm = shadowMatrix[ 0 ] * mPosition;",
	"			vec3 shadowCoord = sm.xyz / sm.w;",
	"			bvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );",
	"			bool inFrustum = all( inFrustumVec );",
	"			bvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );",
	"			bool frustumTest = all( frustumTestVec );",
	"			if ( frustumTest ) {",
	"				shadowCoord.z += shadowBias[ 0 ];",
	"				float fDepth = unpackDepth( texture2D( shadowMap[ 0 ], shadowCoord.xy ) );",
	"				if ( fDepth < shadowCoord.z ) {",
	"					shadowColor = vec3(0.0);",
	"				}",
	"			}",
	"		} ",
	"#if MAX_SHADOWS >= 2",
	"		else ",
	"		if (shadowIndex == 1) {",
	"			vec4 sm = shadowMatrix[ 1 ] * mPosition;",
	"			vec3 shadowCoord = sm.xyz / sm.w;",
	"			bvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );",
	"			bool inFrustum = all( inFrustumVec );",
	"			bvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );",
	"			bool frustumTest = all( frustumTestVec );",
	"			if ( frustumTest ) {",
	"				shadowCoord.z += shadowBias[ 1 ];",
	"				float fDepth = unpackDepth( texture2D( shadowMap[ 1 ], shadowCoord.xy ) );",
	"				if ( fDepth < shadowCoord.z ) {",
	"					shadowColor = vec3(0.0);",
	"				}",
	"			}",
	"		} ",
	"#endif",
	"#if MAX_SHADOWS >= 3",
	"		else ",
	"		if (shadowIndex == 2) {",
	"			vec4 sm = shadowMatrix[ 2 ] * mPosition;",
	"			vec3 shadowCoord = sm.xyz / sm.w;",
	"			bvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );",
	"			bool inFrustum = all( inFrustumVec );",
	"			bvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );",
	"			bool frustumTest = all( frustumTestVec );",
	"			if ( frustumTest ) {",
	"				shadowCoord.z += shadowBias[ 2 ];",
	"				float fDepth = unpackDepth( texture2D( shadowMap[ 2 ], shadowCoord.xy ) );",
	"				if ( fDepth < shadowCoord.z ) {",
	"					shadowColor = vec3(0.0);",
	"				}",
	"			}",
	"		} ",
	"#endif",
	"#if MAX_SHADOWS >= 4",
	"		else ",
	"		if (shadowIndex == 3) {",
	"			vec4 sm = shadowMatrix[ 3 ] * mPosition;",
	"			vec3 shadowCoord = sm.xyz / sm.w;",
	"			bvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );",
	"			bool inFrustum = all( inFrustumVec );",
	"			bvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );",
	"			bool frustumTest = all( frustumTestVec );",
	"			if ( frustumTest ) {",
	"				shadowCoord.z += shadowBias[ 3 ];",
	"				float fDepth = unpackDepth( texture2D( shadowMap[ 3 ], shadowCoord.xy ) );",
	"				if ( fDepth < shadowCoord.z ) {",
	"					shadowColor = vec3(0.0);",
	"				}",
	"			}",
	"		}",
	"#endif",
	"#if MAX_SHADOWS >= 5",
	"		else ",
	"		if (shadowIndex == 4) {",
	"			vec4 sm = shadowMatrix[ 4 ] * mPosition;",
	"			vec3 shadowCoord = sm.xyz / sm.w;",
	"			bvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );",
	"			bool inFrustum = all( inFrustumVec );",
	"			bvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );",
	"			bool frustumTest = all( frustumTestVec );",
	"			if ( frustumTest ) {",
	"				shadowCoord.z += shadowBias[ 4 ];",
	"				float fDepth = unpackDepth( texture2D( shadowMap[ 4 ], shadowCoord.xy ) );",
	"				if ( fDepth < shadowCoord.z ) {",
	"					shadowColor = vec3(0.0);",
	"				}",
	"			}",
	"		}",
	"#endif",
	"#if MAX_SHADOWS >= 6",
	"		else ",
	"		if (shadowIndex == 5) {",
	"			vec4 sm = shadowMatrix[ 5 ] * mPosition;",
	"			vec3 shadowCoord = sm.xyz / sm.w;",
	"			bvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );",
	"			bool inFrustum = all( inFrustumVec );",
	"			bvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );",
	"			bool frustumTest = all( frustumTestVec );",
	"			if ( frustumTest ) {",
	"				shadowCoord.z += shadowBias[ 5 ];",
	"				float fDepth = unpackDepth( texture2D( shadowMap[ 5 ], shadowCoord.xy ) );",
	"				if ( fDepth < shadowCoord.z ) {",
	"					shadowColor = vec3(0.0);",
	"				}",
	"			}",
	"		}",
	"#endif",
	"#if MAX_SHADOWS >= 7",
	"		else ",
	"		if (shadowIndex == 6) {",
	"			vec4 sm = shadowMatrix[ 6 ] * mPosition;",
	"			vec3 shadowCoord = sm.xyz / sm.w;",
	"			bvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );",
	"			bool inFrustum = all( inFrustumVec );",
	"			bvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );",
	"			bool frustumTest = all( frustumTestVec );",
	"			if ( frustumTest ) {",
	"				shadowCoord.z += shadowBias[ 6 ];",
	"				float fDepth = unpackDepth( texture2D( shadowMap[ 6 ], shadowCoord.xy ) );",
	"				if ( fDepth < shadowCoord.z ) {",
	"					shadowColor = vec3(0.0);",
	"				}",
	"			}",
	"		}",
	"#endif",
	"#if MAX_SHADOWS >= 8",
	"		else ",
	"		if (shadowIndex == 7) {",
	"			vec4 sm = shadowMatrix[ 7 ] * mPosition;",
	"			vec3 shadowCoord = sm.xyz / sm.w;",
	"			bvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );",
	"			bool inFrustum = all( inFrustumVec );",
	"			bvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );",
	"			bool frustumTest = all( frustumTestVec );",
	"			if ( frustumTest ) {",
	"				shadowCoord.z += shadowBias[ 7 ];",
	"				float fDepth = unpackDepth( texture2D( shadowMap[ 7 ], shadowCoord.xy ) );",
	"				if ( fDepth < shadowCoord.z ) {",
	"					shadowColor = vec3(0.0);",
	"				}",
	"			}",
	"		}",
	"#endif",
	"		return shadowColor;",
	"	}",
	
	
	"#endif",
	
	"#if MAX_DIR_LIGHTS > 0",
	"uniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];",
	"uniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];",
	"uniform int directionalLightShadowMap[ MAX_DIR_LIGHTS ];",
	"#endif",
	
	"#if MAX_SPOT_LIGHTS > 0",
	"uniform vec3 spotLightColor[ MAX_SPOT_LIGHTS ];",
	"uniform vec3 spotLightPosition[ MAX_SPOT_LIGHTS ];",
	"uniform vec3 spotLightDirection[ MAX_SPOT_LIGHTS ];",
	"uniform float spotLightAngleCos[ MAX_SPOT_LIGHTS ];",
	"uniform float spotLightExponent[ MAX_SPOT_LIGHTS ];",
	"uniform float spotLightDistance[ MAX_SPOT_LIGHTS ];",
	"uniform int spotLightShadowMap[ MAX_SPOT_LIGHTS ];",
	"#endif",
	
	"#if MAX_HEMI_LIGHTS > 0",
	"uniform vec3 hemisphereLightSkyColor[ MAX_HEMI_LIGHTS ];",
	"uniform vec3 hemisphereLightGroundColor[ MAX_HEMI_LIGHTS ];",
	"uniform vec3 hemisphereLightDirection[ MAX_HEMI_LIGHTS ];",
	"#endif",
	
	"#if MAX_POINT_LIGHTS > 0",
	"uniform vec3 pointLightColor[ MAX_POINT_LIGHTS ];",
	"uniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];",
	"uniform float pointLightDistance[ MAX_POINT_LIGHTS ];",
	"#endif",

	"float rand(vec2 co) {",
	"	float a = 12.9898;",
	"	float b = 78.233;",
	"   float c = 43758.5453;",
	"   float dt = dot(co.xy ,vec2(a,b));",
	"   float sn = mod(dt,3.14);",
	"   return fract(sin(sn) * c);",
	"}",
	
	"void main() {",
	//	stipple and alpha
	"	float s = 1.0; ",
	"	if (stipple != 0.0) { ",
	"		vec2 stip = fract( vec2(gl_FragCoord.x + stipple, gl_FragCoord.y) * 0.5);",
	"		s = step(0.25,abs(stip.x-stip.y));",
	"	}",
	"	if (tintAlpha == 0.0 || s == 0.0) discard;",
	"	else if (tintAlpha < 1.0) {",
	"		float a = rand(gl_FragCoord.xy);",
	"		a = s * (1.0 - step(tintAlpha, a));",
	"		if (a == 0.0) discard;",
	"	}",
	
	"	vec3 diffuse = tintColor;",
	
	"	vec3 totalAmbient = diffuse * ambientLightColor;",
	"	vec3 totalDirect = vec3(0.0);",
	"	vec4 mvPosition = vec4(-vViewPosition.xyz, 1.0 );",
	"	vec4 mPosition = vWorldPosition;",
	"	vec3 vertexNormal = normalize(vNormal);",
	
	// point
	"#if MAX_POINT_LIGHTS > 0",
	"vec3 pointDiffuse = vec3( 0.0 );",
	"for ( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {",	//
	"	if (i < actualPointLights) {",
	"	vec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );",
	"	vec3 lVector = lPosition.xyz - mvPosition.xyz;",
	"	float lDistance = 1.0;",
	"	if ( pointLightDistance[ i ] > 0.0 )",
	"		lDistance = 1.0 - min( ( length( lVector ) / pointLightDistance[ i ] ), 1.0 );",
	"	lVector = normalize( lVector );",
	"	float dotProduct = dot( vertexNormal, lVector );",
	"	#ifdef WRAP_AROUND",
	"		float pointDiffuseWeightFull = max( dotProduct, 0.0 );",
	"		float pointDiffuseWeightHalf = max( 0.5 * dotProduct + 0.5, 0.0 );",
	"		vec3 pointDiffuseWeight = mix( vec3( pointDiffuseWeightFull ), vec3( pointDiffuseWeightHalf ), wrapRGB );",
	"	#else",
	"		float pointDiffuseWeight = max( dotProduct, 0.0 );",
	"	#endif",
	"	pointDiffuse += diffuse * pointLightColor[ i ] * pointDiffuseWeight * lDistance;",
	"	}",
	"}",
	"totalDirect += pointDiffuse;",
	"#endif",

	// temp vars used in shadows
	"	vec3 thisLight;",
	"	int shadowMapIndex;",

	// directional
	"#if MAX_DIR_LIGHTS > 0",
	"vec3 dirDiffuse = vec3( 0.0 );",

	"for ( int i = 0; i < MAX_DIR_LIGHTS; i ++ ) {", //
	"	if (i < actualDirLights) {",		
	"	vec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );",
	"	vec3 dirVector = normalize( lDirection.xyz);",
	"	float dotProduct = dot(vertexNormal, dirVector);",
	"	#ifdef WRAP_AROUND",
	"		float dirDiffuseWeightFull = max( dotProduct, 0.0 );",
	"		float dirDiffuseWeightHalf = max( 0.5 * dotProduct + 0.5, 0.0 );",
	"		vec3 dirDiffuseWeight = mix( vec3( dirDiffuseWeightFull ), vec3( dirDiffuseWeightHalf ), wrapRGB );",
	"	#else",
	"		float dirDiffuseWeight = max( dotProduct, 0.0 );",
	"	#endif",
	"	thisLight = diffuse * directionalLightColor[ i ] * dirDiffuseWeight;",
	"#ifdef USE_SHADOWMAP",
	"	shadowMapIndex = directionalLightShadowMap[ i ];",
	"	if (shadowMapIndex != 0) {",
	"		thisLight = thisLight * getShadowColor(shadowMapIndex - 1, mPosition);",
	"	}",
	"#endif",
	"	dirDiffuse += thisLight;",
	"	}",
	"}",
	"totalDirect += dirDiffuse;",
	"#endif",

	"#if MAX_SPOT_LIGHTS > 0",
	"vec3 spotDiffuse = vec3( 0.0 );",
	"for ( int i = 0; i < MAX_SPOT_LIGHTS; i ++ ) {", //
	"	if (i < actualSpotLights) {",		
	"	vec4 lPosition = viewMatrix * vec4( spotLightPosition[ i ], 1.0 );",
	"	vec3 lVector = lPosition.xyz - mvPosition.xyz;//lPosition.xyz + vViewPosition.xyz;",
	"	float lDistance = 1.0;",
	"	if ( spotLightDistance[ i ] > 0.0 )",
	"		lDistance = 1.0 - min( ( length( lVector ) / spotLightDistance[ i ] ), 1.0 );",
	"	lVector = normalize( lVector );",
	"	float spotEffect = dot( spotLightDirection[ i ], normalize( spotLightPosition[ i ] - mPosition.xyz ) );",
	"	if ( spotEffect > spotLightAngleCos[ i ] ) {",
	"		spotEffect = max( pow( max( spotEffect, 0.0 ), spotLightExponent[ i ] ), 0.0 );",
			// diffuse
	"		float dotProduct = dot( vertexNormal, lVector );",
	"		#ifdef WRAP_AROUND",
	"			float spotDiffuseWeightFull = max( dotProduct, 0.0 );",
	"			float spotDiffuseWeightHalf = max( 0.5 * dotProduct + 0.5, 0.0 );",
	"			vec3 spotDiffuseWeight = mix( vec3( spotDiffuseWeightFull ), vec3( spotDiffuseWeightHalf ), wrapRGB );",
	"		#else",
	"			float spotDiffuseWeight = max( dotProduct, 0.0 );",
	"		#endif",
	"		thisLight = diffuse * spotLightColor[ i ] * spotDiffuseWeight * lDistance * spotEffect;",
	"#ifdef USE_SHADOWMAP",
	"		shadowMapIndex = spotLightShadowMap[ i ];",
	"		if (shadowMapIndex != 0) {",
	"			thisLight = thisLight * getShadowColor(shadowMapIndex - 1, mPosition);",
	"		}",			
	"#endif",
	"		spotDiffuse += thisLight;",
	"	}",
	"	}",
	"}",
	"totalDirect += spotDiffuse;",
	"#endif",

	// hemi
	"#if MAX_HEMI_LIGHTS > 0",
	"vec3 hemiDiffuse = vec3( 0.0 );",
	"for ( int i = 0; i < MAX_HEMI_LIGHTS; i ++ ) {", //
	"	if (i < actualHemiLights) {",		
	"	vec4 lDirection = viewMatrix * vec4( hemisphereLightDirection[ i ], 0.0 );",
	"	vec3 lVector = normalize( lDirection.xyz );",
	"	float dotProduct = dot( vertexNormal, lVector );",
	"	float hemiDiffuseWeight = 0.5 * dotProduct + 0.5;",
	"	vec3 hemiColor = mix( hemisphereLightGroundColor[ i ], hemisphereLightSkyColor[ i ], hemiDiffuseWeight );",
	"	hemiDiffuse += diffuse * hemiColor;",
	"	}",
	"}",
	"totalAmbient += hemiDiffuse;",
	"#endif",
	
	"vec3 totalDiffuse = mix(totalAmbient + totalDirect, diffuse, brightness);",

	"float depth = gl_FragCoord.z / gl_FragCoord.w;",
	"float fogFactor = smoothstep( fogNear, fogFar, depth );",
	
	// fog
	"gl_FragColor = vec4(mix(totalDiffuse + addColor, fogColor, fogFactor), 1.0);",
	"}"
	].join( "\n" )	
};

THREE.MeshPixelBoxMaterial = function ( params ) {

	var material = new THREE.ShaderMaterial( {
		uniforms:       THREE.UniformsUtils.merge( [ THREE.UniformsLib[ 'shadowmap' ], THREE.UniformsLib[ 'lights' ], THREE.PixelBoxMeshShader.uniforms ] ),
		attributes:     THREE.PixelBoxMeshShader.attributes,
		vertexShader:   THREE.PixelBoxMeshShader.vertexShader,
		fragmentShader: THREE.PixelBoxMeshShader.fragmentShader,
		transparent: false,
		lights: true,
		fog: true
	});
	
	function param ( pname, defaultValue ) { if ( params && params[ pname ] != undefined ) return params[ pname ]; return defaultValue; }
	
	var uniforms = material.uniforms;
	uniforms.tintColor.value.set( param( 'tint', 0xffffff ) );
	uniforms.addColor.value.set( param( 'addColor', 0x0 ) );
	uniforms.tintAlpha.value = param( 'alpha', 1.0 );
	uniforms.brightness.value = param( 'brightness', 0.0 );
	
	// share uniforms with prototype
	uniforms.actualHemiLights = THREE.PixelBoxUtil.material.uniforms.actualHemiLights;
	uniforms.actualDirLights = THREE.PixelBoxUtil.material.uniforms.actualDirLights;
	uniforms.actualPointLights = THREE.PixelBoxUtil.material.uniforms.actualPointLights;
	uniforms.actualSpotLights = THREE.PixelBoxUtil.material.uniforms.actualSpotLights;
	uniforms.directionalLightShadowMap = THREE.PixelBoxUtil.material.uniforms.directionalLightShadowMap;
	uniforms.spotLightShadowMap = THREE.PixelBoxUtil.material.uniforms.spotLightShadowMap;
	
	Object.defineProperty( material, 'tint', {
		get: function () { return this.uniforms.tintColor.value; },
		set: function ( v ) { this.uniforms.tintColor.value.copy( v ); },
	} );
	Object.defineProperty( material, 'addColor', {
		get: function () { return this.uniforms.addColor.value; },
		set: function ( v ) { this.uniforms.addColor.value.copy( v ); },
	} );
	Object.defineProperty( material, 'alpha', {
		get: function () { return this.uniforms.tintAlpha.value; },
		set: function ( v ) { this.uniforms.tintAlpha.value = v; },
	} );
	Object.defineProperty( material, 'brightness', {
		get: function () { return this.uniforms.brightness.value; },
		set: function ( v ) { this.uniforms.brightness.value = v; },
	} );
	Object.defineProperty( material, 'stipple', {
		get: function () { return this.uniforms.stipple.value; },
		set: function ( v ) { this.uniforms.stipple.value = v; },
	} );
	
	return material;
		
};

THREE.PixelBox = function ( data ) {

	function param ( pname, defaultValue ) { if ( data[ pname ] != undefined ) return data[ pname ]; return defaultValue; }

	// clone base materials
	var material = THREE.PixelBoxUtil.material.clone();
	var depthMaterial = THREE.PixelBoxUtil.depthMaterial.clone();
	
	// share uniforms with prototype
	material.uniforms.viewPortScale = THREE.PixelBoxUtil.material.uniforms.viewPortScale;
	material.uniforms.actualHemiLights = THREE.PixelBoxUtil.material.uniforms.actualHemiLights;
	material.uniforms.actualDirLights = THREE.PixelBoxUtil.material.uniforms.actualDirLights;
	material.uniforms.actualPointLights = THREE.PixelBoxUtil.material.uniforms.actualPointLights;
	material.uniforms.actualSpotLights = THREE.PixelBoxUtil.material.uniforms.actualSpotLights;
	material.uniforms.directionalLightShadowMap = THREE.PixelBoxUtil.material.uniforms.directionalLightShadowMap;
	material.uniforms.spotLightShadowMap = THREE.PixelBoxUtil.material.uniforms.spotLightShadowMap;
			
	// share unforms with depth material
	depthMaterial.uniforms.viewPortScale = THREE.PixelBoxUtil.material.uniforms.viewPortScale;
	depthMaterial.uniforms.tintAlpha = material.uniforms.tintAlpha;
	depthMaterial.uniforms.pointSize = material.uniforms.pointSize;
	
	// these uniforms' defaults come from data object
	material.uniforms.occlusion.value = param( 'occlusion', 1.0 );
	material.uniforms.pointSize.value = param( 'pointSize', 1.0 );
	material.uniforms.cullBack.value = param( 'cullBack', true );
		
	// create geometry
	var geometry = new THREE.BufferGeometry();
	
	// create pivot
	this._pivot = new THREE.Vector3( data.width * 0.5, data.height * 0.5, data.depth * 0.5 );
	
	// bounding sphere respect pivot
	geometry.computeBoundingSphere = function () {
	
		if ( this.geometry.boundingSphere === null ) {
		
			this.geometry.boundingSphere = new THREE.Sphere();
			
		}
		
		this.geometry.boundingSphere.center.set(
			this.geometry.data.width * 0.5 - this._pivot.x,
			this.geometry.data.height * 0.5 - this._pivot.y,
			this.geometry.data.depth * 0.5 - this._pivot.z
		);
		
		this.geometry.boundingSphere.radius = 0.5 * Math.max( this.geometry.data.width, this.geometry.data.depth, this.geometry.data.height );
		
	}.bind( this );

	// bounding box respect pivot
	geometry.computeBoundingBox = function () {
	
		if ( this.geometry.boundingBox === null ) this.geometry.boundingBox = new THREE.Box3();

		this.geometry.boundingBox.min.set( 0,0,0 );
		this.geometry.boundingBox.max.set( this.geometry.data.width, this.geometry.data.height, this.geometry.data.depth );
		this.geometry.boundingBox.translate( this._pivot.clone().multiplyScalar( -1 ) );
		
	}.bind( this );
	
	// process data
	THREE.PixelBoxUtil.processPixelBoxFrames( data );
	
	// init as PointCloud
	THREE.PointCloud.call( this, geometry, material );

	this.customDepthMaterial = depthMaterial;
	this.castShadow = true;
	this.pixelBox = true;
	
	// create anchors
	this.anchors = {};
	if ( data.anchors ) {
	
		for ( var aname in data.anchors ) {
		
			if ( aname == 'PIVOT' ) { 
			
				this._pivot.set( data.anchors[ aname ][ 0 ].x, data.anchors[ aname ][ 0 ].y, data.anchors[ aname ][ 0 ].z );
				continue;
				
			}
			
			var obj3d = new THREE.Object3D();
			obj3d.isContainer = true;
			obj3d.detached = false;
			obj3d.isAnchor = true;
			obj3d.name = aname;
			obj3d.visible = false;
			this.add( obj3d );
			this.anchors[ aname ] = obj3d;
			
		}
		
	} else {
	
		data.anchors = {};
		
	}
	
	// create frame setter on pointcloud
	geometry.data = data;
	geometry._frame = -1;
	
	Object.defineProperty( this, 'frame', {
		get: (function () { return this.geometry._frame; }),
		set: (function ( f ) {
		
			var geom = this.geometry;
			var data = geom.data;
			 
			// validate frame
			if ( f == geom._frame || !data.frameData.length ) return;
			if ( f < 0 ) f = data.frameData.length + ( f % data.frameData.length );
			f = f % data.frameData.length;
			geom._frame = f;
			
			// init buffer if needed
			var fd = data.frameData[ f ];
			
			if ( fd.p ) {
			
				// add attributes
				geom.addAttribute( 'position', fd.p );
				geom.addAttribute( 'color', fd.c );
				geom.addAttribute( 'normal', fd.n );
				geom.addAttribute( 'occlude', fd.o );
				
				// create buffers if needed
				if ( !fd.p.buffer ) {
				
					var _gl = renderer.webgl.context;
					
					for ( var name in geom.attributes ) {
					
						var bufferType = ( name === 'index' ) ? _gl.ELEMENT_ARRAY_BUFFER : _gl.ARRAY_BUFFER;
						var attribute = geom.attributes[ name ];
						
						if ( !attribute.buffer ) {
						
							attribute.buffer = _gl.createBuffer();
							var res = _gl.bindBuffer( bufferType, attribute.buffer );
							_gl.bufferData( bufferType, attribute.array, _gl.STATIC_DRAW );
							
						}
						
					}
					
				}
				
			}
			
			// set offset/length
			// regular frame
			if ( fd.s != undefined ) {
			
				geom.offsets = [ { index: fd.s, count: fd.l } ];
				
			// no offsets stored, use full range (editor)
			} else if ( fd.o ) {
			
				geom.offsets = [];
				
			}
			
			var ev = { type:'frame', frame: f };
			this.dispatchEvent( ev );
			
			var degToRad = Math.PI / 180.0;
			
			// update anchors
			for ( var aname in this.anchors ) {
			
				var anchor = this.anchors[ aname ];
				var adata = data.anchors[ aname ][ f ];
				
				if ( !anchor.detached ) {
				
					anchor.visible = !!adata.on;
					anchor.position.set( adata.x - this._pivot.x, adata.y - this._pivot.y, adata.z - this._pivot.z );
					anchor.rotation.set( adata.rx * degToRad, adata.ry * degToRad, adata.rz * degToRad );
					anchor.scale.set( adata.sx || 0.00001, adata.sy || 0.00001, adata.sz || 0.00001 );
					anchor.updateMatrixWorld( true );
					
					if ( adata.meta.length ) {
					
						var ev = { type:'anchor-meta', frame:f, anchor: anchor, meta:adata.meta };
						this.dispatchEvent( ev );
						
					}
					
				}
				
			}
		
		} )
		
	} );	
	
	// set frame / anim params
	this.vertexBufferStart = 0;
	this.vertexBufferLength = 0;
	this.frame = 0;
	this.totalFrames = data.frameData.length;

	// dispose function
	this.dispose = function ( unloadAsset ) {
	
		if ( this.geometry ) {
		
			if ( unloadAsset ) {
			
				if ( this.geometry.data ) {
				
					THREE.PixelBoxUtil.dispose( this.geometry.data );
					delete this.geometry.data;
					
				}
				
				this.geometry.dispose();
				
			}
			
			delete this.geometry;
			this.material.dispose();
			
		}
		
	};
	
	// add animation functions
	this.currentAnimation = null;
	this._animSpeed = 1.0;
	
	Object.defineProperty( this, 'animSpeed', {
		get: function () { return this._animSpeed; },
		set: function ( v ) {
		
			this._animSpeed = v;
			
			// reset timer
			if ( this._animationInterval && this.currentAnimation ) {
			
				var nextFrameIn = 1.0 / (Math.abs( v ? v : 0.001 ) * this.currentAnimation.fps);
				clearTimeout( this._animationInterval );
				this._animationInterval = setTimeout( this.advanceAnimationFrame, nextFrameIn * 1000 );
				
			}
			
		}
		
	} );
	
	this._animationInterval = 0;
	this._animLoops = -1;
	this._currentAnimationPosition = 0;
	
	Object.defineProperty( this, 'currentAnimationPosition', {
		get: function () { return this._currentAnimationPosition; },
		set: function ( v ) { // set frame according to anim position
		
			v = Math.min( 1, Math.max( 0, v ) );
			var f =  Math.min( this.currentAnimation.length - 1, Math.floor( v * this.currentAnimation.length ) );
			
			if ( this.animSpeed < 0 ) { // backwards
			
				f = this.currentAnimation.length - 1 - f;
				
			}
			
			this._currentAnimationPosition = v;
			this.frame = f + this.currentAnimation.start;
			
		}
		
	} );
	
	// pre-bind
	this.advanceAnimationFrame = THREE.PixelBox.prototype.advanceAnimationFrame.bind( this );
	
	this.addEventListener( 'removed', this.stopAnim );
	
	// add shorthand accessors
	Object.defineProperty( this, 'asset', {
		get: function () { return this.geometry.data; }
	} );
	
	Object.defineProperty( this, 'alpha', {
		get: function () { return this.material.uniforms.tintAlpha.value; },
		set: function ( v ) { this.material.uniforms.tintAlpha.value = v; }
	} );
	
	Object.defineProperty( this, 'tint', {
		get: function () { return this.material.uniforms.tintColor.value; },
		set: function ( v ) { this.material.uniforms.tintColor.value.copy( v ); }
	} );

	Object.defineProperty( this, 'addColor', {
		get: function () { return this.material.uniforms.addColor.value; },
		set: function ( v ) { this.material.uniforms.addColor.value.copy( v ); }
	} );

	Object.defineProperty( this, 'occlusion', {
		get: function () { return this.material.uniforms.occlusion.value; },
		set: function ( v ) { this.material.uniforms.occlusion.value = v; }
	} );

	Object.defineProperty( this, 'pointSize', {
		get: function () { return this.material.uniforms.pointSize.value; },
		set: function ( v ) { this.material.uniforms.pointSize.value = v; }
	} );
	
	Object.defineProperty( this, 'stipple', {
		get: function () { return this.material.uniforms.stipple.value; },
		set: function ( v ) { this.material.uniforms.stipple.value = v; }
	} );
	
	Object.defineProperty( this, 'cullBack', {
		get: function () { return !!this.material.uniforms.cullBack.value; },
		set: function ( v ) { this.material.uniforms.cullBack.value = v ? 1 : 0; }
	} );
	
	this.fasterRaycast = true; // raycast just tests for an intersection (returns first match)
	
	// create particles
	if ( data.particles !== undefined ) {
	
		var pos = new Array();
		var clr = new Array();
		var nrm = new Array();
		var occ = new Array();
		
		for ( var i = 0; i < data.particles; i++ ) {
		
			pos.push( 0, 0, 0 );
			clr.push( 1, 1, 1, 1 );
			nrm.push( 0, 1, 0 );
			occ.push( 0 );
			
		}
			
		data.frameData.push( { 	p: new THREE.BufferAttribute( new Float32Array( pos ), 3 ),
								c: new THREE.BufferAttribute( new Float32Array( clr ), 4 ),
								n: new THREE.BufferAttribute( new Float32Array( nrm ), 3 ),
								o: new THREE.BufferAttribute( new Float32Array( occ ), 1 ) } );
								
		this.geometry._frame = -1; // invalidate
		this.frame = 0; // refresh
		this.geometry.computeBoundingSphere();
		
	}
	
	return this;
	
}

THREE.PixelBox.prototype = Object.create( THREE.PointCloud.prototype );
THREE.PixelBox.prototype.constructor = THREE.PixelBox;

/* 
	Animation functions 

	Animations are implemented using setTimeout, and are automatically paused/resumed when renderer.pause(bPause) is called
	Animation is stopped when this PixelBox is removed from parent
	Animations have intrinsic FPS propery, which is multiplied by this PixelBox's .animSpeed (which can be negative for reverse animations)
		
	Functions:

		playAnim(animname, [ BOOL fromCurrentFrame ]) - plays animation once. fromCurrentFrame is true to start animation from current position
		loopAnim(animName, [ INT numLoops | Infinity, [BOOL fromCurrentFrame] ] ) - plays animation numLoops times. Specify Infinity constant 
																					to play forever. fromCurrentFrame is true to start animation 
																					from current position
		gotoAndStop(animname, [ FLOAT PosWithinAnim | INT frameNumber]) - seeks position within animation and stops. Position can be a float between
																		  0.0 and <1.0 or an integer frame number.
																		  
    Animation functions emit events (subscribe to events by calling obj.addEventListener(eventType, func) - see THREE.EventDispatcher)
    
	    frame			- dispatched each time a frame is changed
		anchor-meta 	- dispatched whenever anchor has meta data on current frame
		anim-meta		- dispatched when an animation with meta data starts playing
		anim-stop		- dispatched whenever animation is stopped
		anim-start		- dispatched whenever animation is started
		anim-loop		- dispatched when animation loops around
		anim-finish		- dispatched when an animation completes

*/

THREE.PixelBox.prototype.advanceAnimationFrame = function () {

	if ( this._animationInterval ) clearTimeout( this._animationInterval );
	
	var nextFrameIn = 1.0 / ( Math.abs( this.animSpeed ? this.animSpeed : 0.001 ) * this.currentAnimation.fps);
	var keepGoing = true;
	
	if ( !renderer.paused ) {
	
		var step = this.currentAnimation.length > 1 ? (1.0 / (this.currentAnimation.length - 1)) : 1;
		this.currentAnimationPosition += step;
		this._animationInterval = 0;
		
		// end of anim
		if ( this.currentAnimationPosition == 1 ) {
		
			// was looping
			if ( this._animLoops > 0 ) {
			
				var ev = { type:'anim-loop', anim:this.currentAnimation, loop: this._animLoops };
				this.dispatchEvent( ev );
				this._animLoops--;
				this._currentAnimationPosition = -step;
				
			// end of animation
			} else {
			
				keepGoing = false;
				var ev = { type:'anim-finish', anim:this.currentAnimation };
				this.dispatchEvent( ev );
				
			}
			
		}
		
	}
	
	// set up next time
	if (keepGoing) {
	
		this._animationInterval = setTimeout( this.advanceAnimationFrame, nextFrameIn * 1000 );
		
	}
};

THREE.PixelBox.prototype.playAnim = function ( animName, fromCurrentFrame ) {

	this.loopAnim( animName, 0, fromCurrentFrame );
	
};

THREE.PixelBox.prototype.loopAnim = function ( animName, numLoops, fromCurrentFrame ) {

	var anim = this.geometry.data.anims[ animName ];
	
	if ( !anim ) {
	 
		console.log( "Animation " + animName + " not found in ", this.data );
		return;
		
	}
	
	if ( this._animationInterval ) {
	
		// same anim, from current frame	
		if ( this.currentAnimation == anim && this._animLoops > 0 ) { 
		
			this._animLoops = numLoops;
			return;
			
		}
		
		this.stopAnim();
		
	}
	
	// current anim
	this.currentAnimation = anim;
	this._animLoops = (numLoops === undefined ? Infinity : numLoops);
	
	// set up first frame
	if ( fromCurrentFrame && this.frame >= anim.start && this.frame < anim.start + anim.length ) {
	
		if ( this.animSpeed >= 0 ) {
		
			this.currentAnimationPosition = (this.frame - anim.start) / anim.length;
			
		} else {
		
			this.currentAnimationPosition = 1.0 - (this.frame - anim.start) / anim.length;
		}
		
	} else {
	
		this.currentAnimationPosition = 0;
		
	}
	
	var ev = { type:'anim-start', anim:this.currentAnimation };
	this.dispatchEvent( ev );
	
	// anim meta
	if ( this.currentAnimation.meta.length ) {
	
		ev = { type:'anim-meta', anim:this.currentAnimation, meta:anim.meta };
		this.dispatchEvent(ev);
		
	}
	
	// set up timeout
	var nextFrameIn = 1.0 / (Math.abs( this.animSpeed ) * anim.fps);
	this._animLoops--;
	this._animationInterval = setTimeout( this.advanceAnimationFrame, nextFrameIn * 1000 );
	
};

THREE.PixelBox.prototype.gotoAndStop = function ( animName, positionWithinAnimation ) {

	var anim = this.geometry.data.anims[ animName ];
	var diff = (this.currentAnimation != anim);
	positionWithinAnimation = (positionWithinAnimation === undefined ? 0 : positionWithinAnimation);
	
	if ( !anim ) { 
	
		console.log( "Animation " + animName + " not found in ", this.data ); 
		return;
		
	}
	
	if ( this._animationInterval ) {
	
		this.stopAnim();
		
	}
	
	// stop
	if ( diff ) {
	
		var ev = { type:'anim-stop', anim:this.currentAnimation };
		this.dispatchEvent( ev );
		
	}
	
	// current anim
	this.currentAnimation = anim;
	this.currentAnimationPosition = (positionWithinAnimation < 1.0 ? positionWithinAnimation : ((positionWithinAnimation / anim.length) % 1.0));
	this._animLoops = -1;	

	// anim meta
	if ( diff && anim.meta.length ) {
	
		var ev = { type:'anim-meta', anim:anim, meta:anim.meta };
		this.dispatchEvent( ev );
		
	}
	
};

THREE.PixelBox.prototype.animNamed = function ( animName ) {

	return this.geometry.data.anims[ animName ];
	
};

THREE.PixelBox.prototype.stopAnim = function () {
	
	if ( this._animationInterval ) {
	
		clearTimeout( this._animationInterval );
		this._animationInterval = 0;
		
	}
	
	if ( this.currentAnimation ) {
	
		var ev = { type:'anim-stop', anim:this.currentAnimation };
		this.dispatchEvent( ev );
		this.currentAnimation = null;
		
	}
	
};

/* 
	Particle effects
	
	callBack(pobj) is called for each point
	
	pobj is:
	{ i: particleIndex, p: position, n: normal, c: color, a: alpha, o: occlusion, b: brightness }
	
	set values in pobj to update particle
	
	this can be used to generate snow, rain, etc.
	Example:
	
	snow = new THREE.PixelBox( { particles: 1000, width: 100, depth: 100, height: 100, pointSize: 0.3 } );
	snow.updateFrameWithCallback(this.updateSnow, { timePassed: timePassed } );
	
*/

THREE.PixelBox.prototype.updateFrameWithCallback = function ( callBack, extraParam ) {

	var geometry = this.geometry;
	var dataObject = geometry.data;
	var frameBuffers = dataObject.frameData[ 0 ];
	var addr = 0;
	var pobj = {
		p: new THREE.Vector3(),
		n: new THREE.Vector3(),	
		c: new THREE.Color(),
		a: 0.0,
		b: 1.0, 
		o: 0.0
	};
	
	var numParticles = dataObject.particles;
	for ( addr = 0; addr < numParticles; addr++ ) {
	
		pobj.i = addr;
		pobj.p.set( frameBuffers.p.array[ addr * 3 ], frameBuffers.p.array[ addr * 3 + 1 ], frameBuffers.p.array[ addr * 3 + 2 ] );
		pobj.n.set( frameBuffers.n.array[ addr * 3 ], frameBuffers.n.array[ addr * 3 + 1 ], frameBuffers.n.array[ addr * 3 + 2 ] );
		pobj.b = pobj.n.length() - 1.0;
		pobj.n.normalize();
		pobj.o = frameBuffers.o.array[ addr ];
		pobj.c.setRGB( frameBuffers.c.array[ addr * 4 ], frameBuffers.c.array[ addr * 4 + 1 ], frameBuffers.c.array[ addr * 4 + 2 ] );
		pobj.a = frameBuffers.c.array[ addr * 4 + 3 ];

		// call
		callBack( pobj, extraParam );
		
		// copy back
		frameBuffers.p.array[ addr * 3 ] = pobj.p.x;
		frameBuffers.p.array[ addr * 3 + 1 ] = pobj.p.y;
		frameBuffers.p.array[ addr * 3 + 2 ] = pobj.p.z;
		
		frameBuffers.o.array[ addr ] = pobj.o;
		
		pobj.n.multiplyScalar( 1.0 + pobj.b );
		frameBuffers.n.array[ addr * 3 ] = pobj.n.x;
		frameBuffers.n.array[ addr * 3 + 1 ] = pobj.n.y;
		frameBuffers.n.array[ addr * 3 + 2 ] = pobj.n.z;
		
		frameBuffers.c.array[ addr * 4 ] = pobj.c.r;
		frameBuffers.c.array[ addr * 4 + 1 ] = pobj.c.g;
		frameBuffers.c.array[ addr * 4 + 2 ] = pobj.c.b;
		frameBuffers.c.array[ addr * 4 + 3 ] = pobj.a;
		
	}
	
	frameBuffers.c.needsUpdate = true;
	frameBuffers.n.needsUpdate = true;
	frameBuffers.o.needsUpdate = true;
	frameBuffers.p.needsUpdate = true;
	
};

/* 

	PixelBoxUtil namespace
	
*/

THREE.PixelBoxUtil = {};

THREE.PixelBoxUtil.material = new THREE.ShaderMaterial( {
	uniforms:       THREE.UniformsUtils.merge( [ THREE.UniformsLib[ 'shadowmap' ], THREE.UniformsLib[ 'lights' ], THREE.PixelBoxShader.uniforms ] ),
	attributes:     THREE.PixelBoxShader.attributes,
	vertexShader:   THREE.PixelBoxShader.vertexShader,
	fragmentShader: THREE.PixelBoxShader.fragmentShader,
	transparent: false,
	lights: true,
	fog: true
} );

THREE.PixelBoxUtil.depthMaterial = new THREE.ShaderMaterial( {
	uniforms:       THREE.PixelBoxDepthShader.uniforms,
	vertexShader:   THREE.PixelBoxDepthShader.vertexShader,
	fragmentShader: THREE.PixelBoxDepthShader.fragmentShader
});

THREE.PixelBoxUtil.depthMaterial._shadowPass = true;

THREE.PixelBoxUtil.updateViewPortUniform = function ( optCamera ) {

	// get cam scale	
	var camWorldScale = new THREE.Vector3();
	
	// viewPortScale is based on the camera
	function getValueForCam ( cam ) {
	
		camWorldScale.setFromMatrixScale( cam.matrixWorld );
		
		// perspective camera
		if ( cam instanceof THREE.PerspectiveCamera ) {
		
			return (renderer.webgl.domElement.height / (2 * Math.tan( 0.5 * cam.fov * Math.PI / 180.0 ))) / camWorldScale.x;
			
		// ortho
		} else {
		
			return (cam.zoom * renderer.webgl.domElement.height / (cam.top * 2)) / camWorldScale.x;
			
		}
		
	}
	
	var val = 1;
	
	if ( renderer.scene instanceof THREE.PixelBoxSceneTransition && renderer.scene.sceneA instanceof THREE.PixelBoxScene ) {
	
		var t = renderer.scene.smoothTime;
		var val1 = getValueForCam( renderer.scene.sceneB.camera );
		val = getValueForCam( renderer.scene.sceneA.camera );
		val = val + (val1 - val) * t;
		
	} else if ( optCamera ) {
	
		val = getValueForCam( optCamera );
		
	} else if ( renderer.currentScene && renderer.currentScene.camera ) {
	
		val = getValueForCam( renderer.currentScene.camera );
		
	}
	
	THREE.PixelBoxUtil.material.uniforms.viewPortScale.value = val;
	
};

THREE.PixelBoxUtil.dispose = function ( data ) {

	if ( data && data.frameData ) {
	
		var _gl = renderer.webgl.context;
		
		for ( var f = 0; f < data.frameData.length; f++ ) {
		
			if ( !data.frameData[ f ][ 'p' ] ) continue; // skip empty
			
			for ( var key in data.frameData[ f ] ) {
			
				if ( data.frameData[ f ][ key ].buffer !== undefined ) {
				
					_gl.deleteBuffer( data.frameData[ f ][ key ].buffer );
					delete data.frameData[ f ][ key ];
					
				}
				
			}
			
		}
		
		delete data.frameData;
		
	}
	
};

/*
	Decodes & processes frames if frames haven't been processed yet
	Alters data object itself
*/

THREE.PixelBoxUtil.processPixelBoxFrames = function ( data ) {

	if ( data.frames === null || data.particles !== undefined ) {
	
		// special case for PixelBox editor or particle systems
		data.frameData = [];
		return true;
		
	// parse data for the first time (modifies data object)
	} else if ( data.frames ) {
	
		if ( !data.frames.length ) return false;
	
		// pivot
		var pivot = new THREE.Vector3();
		
		if ( data.anchors && data.anchors[ 'PIVOT' ] ) {
		
			pivot.set( data.anchors[ 'PIVOT' ][ 0 ].x, data.anchors[ 'PIVOT' ][ 0 ].y, data.anchors[ 'PIVOT' ][ 0 ].z );
			
		} else {
		
			pivot.set( data.width * 0.5, data.height * 0.5, data.depth * 0.5 );
			
		}		
	
		// decode frames
		if ( !data.frameData ) {
		
			data.frameData = new Array( data.frames.length );
			
			for ( var f = 0; f < data.frames.length; f++ ) {
			
				data.frameData[ f ] = THREE.PixelBoxUtil.decodeFrame( data, f );
				
			}
			
			THREE.PixelBoxUtil.finalizeFrames( data, pivot );
			
		}
		
		// change anims to an object
		if ( _.isArray( data.anims ) ) {
		
			var anims = {};
			for ( var i = 0; i < data.anims.length; i++ ) {
			
				anims[ data.anims[ i ].name ] = data.anims[ i ];
				
			}
			
			data.anims = anims;
			
		}
		
		// clean up
		delete data.frames;
		return true;
		
	}
	
	return false;
	
};

/* 	
	Updates shared light uniforms
	call when the number of lights, or number of lights casting shadows has changed 
	
	Shader uses directionalLightShadowMap & spotLightShadowMap to tell which shadow map belongs to which light
	to generate better shadows
*/

THREE.PixelBoxUtil.updateLights = function ( scene, updateAllMaterials ) {	
	
	var uniforms = THREE.PixelBoxUtil.material.uniforms;
	uniforms.actualHemiLights.value = 0;
	uniforms.actualDirLights.value = 0;
	uniforms.actualPointLights.value = 0;
	uniforms.actualSpotLights.value = 0;
	uniforms.directionalLightShadowMap.value.length = 0;
	uniforms.spotLightShadowMap.value.length = 0;

	var shadowMapIndex = 0;
	
	scene.traverse( function ( obj ) {
	
		if ( obj.visible ) {
		
			if ( obj instanceof THREE.SpotLight ) {
			
				uniforms.actualSpotLights.value++;
				
				if ( obj.castShadow && renderer.webgl.shadowMapEnabled ) {
				
					uniforms.spotLightShadowMap.value.push( ++shadowMapIndex );
					
				} else uniforms.spotLightShadowMap.value.push( 0 );
				
			} else if ( obj instanceof THREE.DirectionalLight ) {
			
				uniforms.actualDirLights.value++;
				
				if ( obj.castShadow && renderer.webgl.shadowMapEnabled ) { 
				
					uniforms.directionalLightShadowMap.value.push( ++shadowMapIndex );
					
				} else uniforms.directionalLightShadowMap.value.push( 0 );
				
			} else if ( obj instanceof THREE.HemisphereLight ) {
			
				uniforms.actualHemiLights.value++;
				
			} else if ( obj instanceof THREE.PointLight ) {
			
				uniforms.actualPointLights.value++;
				
			}
			
		}
		
		if ( updateAllMaterials && obj.material ) obj.material.needsUpdate = true;
		
	} );
	
	if ( !uniforms.directionalLightShadowMap.value.length ) {
	
		uniforms.spotLightShadowMap.value.push( 0 );
		
	}
	
	if ( !uniforms.spotLightShadowMap.value.length ) {
	
		uniforms.spotLightShadowMap.value.push( 0 );
		
	}
	
};

/* 
	Decodes a single frame for PixelBox from dataObject
	
	dataObject format:
	{ 	
		name, 						name to add to assets.cache or null to not cache
		width, height, depth,		fixed dimensions
		optimize,					true to carve out pixels inside model
		smoothNormals,				0.0 - 1.0 normal averaging factor (1.0 is default)
		frames						array
	}
	
	first frame is the following format:
		
		FULL FRAME format is string of (width * height * depth) concatenated values as follows
		
			RRGGBBab where 
				RRGGBB is hex color
				a is hex for alpha (0 = 0.0, F = 1.0)
				b is hex for self-illumination (same)
	
	consecutive frames are in the following format:
	
		DELTA format is relative to previous frame, meant to only replace pixels that 
			have changed from previous frame. Any number of concatenated values as follows
				
			IIIIIIRRGGBBab where 
				I is a hex number - index of the pixel that is different from previous frame
				the rest of the values are the same as FULL FRAME
	
	during decoding, each frame will be replaced with an array of (width * height * depth) for faster lookups
	of elements { c: hexcolor, a: floatAlpha, b: floatBrightness }
		
*/

THREE.PixelBoxUtil.decodeFrame = function ( dataObject, frameIndex ) {

	var smoothNormals = dataObject.smoothNormals != undefined ? dataObject.smoothNormals : 1.0;
	var floor = dataObject.floor != undefined ? dataObject.floor : false;
	var optimize = dataObject.optimize != undefined ? dataObject.optimize : true;

	var positions = new Array();
	var colors = new Array();
	var normals = new Array();
	var occlusion = new Array();
	var width = dataObject.width, height = dataObject.height, depth = dataObject.depth;
	var hw = width * 0.5, hh = height * 0.5, hd = depth * 0.5;

	var frameData = dataObject.frames[ frameIndex ];
	var prevFrameData = null;
	var assembledFrameData = [];
	var isRaw = (typeof( dataObject.frames[ 0 ] ) == 'object' && dataObject.frames[ 0 ][ 'p' ] != undefined);
	var isDeltaFormat = frameIndex > 0;
	
	if ( isRaw ) {
	
		positions = frameData.p;
		colors = frameData.c;
		normals = frameData.n;
		occlusion = frameData.o;
		
	} else {
	
		if ( isDeltaFormat ) {
		
			frameData = frameData.match( /.{14}/g );
			var pi = frameIndex - 1;
			
			while ( !prevFrameData ) {
			
				prevFrameData = dataObject.frames[ pi ];
				pi--;
				
			}
			
		} else {
		
			frameData = frameData.match( /.{8}/g );
			
		}
		
		// no changes from prev frame 
		var sameAsLast = false;
		
		if ( frameData === null ) { 
		
			frameData = [];
			sameAsLast = true;
			
		}
		var chunk, temp, pixel, optimizeRemoved = 0, index = 0;
		var colorObj = new THREE.Color();
		var perp = new THREE.Vector3(), normal = new THREE.Vector3(), tilted = new THREE.Vector3();
	
		// decode and assemble current frame
		for ( var x = 0; x < width; x++ ) {
		for ( var y = 0; y < height; y++ ) {
		for ( var z = 0; z < depth; z++ ) {
		
			// delta
			if ( isDeltaFormat ) {
			
				pixel = prevFrameData[ index ];
				pixel = { c: pixel.c, a: pixel.a, b: pixel.b }; // copied
				assembledFrameData.push( pixel );
				
			// full format	
			} else {
			
				// parse pixel
				chunk = frameData[ index ];
				pixel = { 
					c: parseInt( chunk.substr( 0, 6 ), 16 ), 
					a: parseInt( chunk.substr( 6, 1 ), 16 ) / 15.0, 
					b: parseInt( chunk.substr( 7, 1 ), 16 ) / 15.0
				};
				assembledFrameData.push( pixel );
				
			}
		
			index++;
			
		}}}
		
		if ( isDeltaFormat ) {
		
			for ( index = 0; index < frameData.length; index++ ) {
			
				chunk = frameData[ index ];
				temp = parseInt( chunk.substr( 0,6 ), 16 );
				assembledFrameData[ temp ] = {
					c: parseInt( chunk.substr( 6,6 ), 16 ),
					a: parseInt( chunk.substr( 12,1 ), 16 ) / 15.0,
					b: parseInt( chunk.substr( 13,1 ), 16 ) / 15.0
				};
				
			}
			
		}
		
		// update dataObject with decoded frame data
		if ( !sameAsLast ) dataObject.frames[ frameIndex ] = assembledFrameData;
		
		if (sameAsLast) return null;
	
		// helper
		function getNorm ( x, y, z, dx, dy, dz ) {
		
			x += dx; y += dy; z += dz;
			var oobxz = (x < 0 || z < 0 || x >= width || z >= depth);
			var ooby = (y < 0 || y >= height);
			if ( floor && oobxz ) return new THREE.Vector3( 0, 0, 0 );
			if ( oobxz || ooby || assembledFrameData[ (x * depth * height) + (y * depth) + z ].a == 0.0 ) return new THREE.Vector3( dx, dy, dz );
			return new THREE.Vector3( 0, 0, 0 );
		}
	
		// helper
		function getAlpha ( x, y, z ) {
		
			var ii = (x * depth * height) + (y * depth) + z;
			
			if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) return 0;
			
			return assembledFrameData[ ii ].a;
			
		}
		
		// ready to populate buffers
		index = 0;
		var neighbors;
		
		for ( var x = 0; x < width; x++ ) {
		for ( var y = 0; y < height; y++ ) {
		for ( var z = 0; z < depth; z++ ) {
		
			if ( assembledFrameData[ index ].a == 0.0 ) { 
			
				index++;
				continue;
				
			}
			
			// collect nearest neighbors
			neighbors = [ getAlpha( x - 1, y, z ), getAlpha( x + 1, y, z ), getAlpha( x, y - 1, z ), getAlpha( x, y + 1, z ), getAlpha( x, y, z - 1 ), getAlpha( x, y, z + 1 ) ];
			var numNeighbors = 	Math.floor( neighbors[ 0 ] ) + Math.floor( neighbors[ 1 ] ) + Math.floor( neighbors[ 2 ] ) +
								Math.floor( neighbors[ 3 ] ) + Math.floor( neighbors[ 4 ] ) + Math.floor( neighbors[ 5 ] );
								
			// optimize - discard pixel if can't be seen inside the cloud
			if ( optimize && numNeighbors == 6 && // <- nearest neighbors
				getAlpha( x - 2, y, z ) + getAlpha( x + 2, y, z ) + getAlpha( x, y - 2, z ) +
				getAlpha( x, y + 2, z ) + getAlpha( x, y, z - 2 ) + getAlpha( x, y, z + 2 ) == 6 // <- extended neighbors
			) {
			
				// if pixel is surrounded by completely opaque pixels, it can be discarded
				optimizeRemoved++;
				index++;
				continue;
				
			}
			
			// start normal
			if ( numNeighbors > 2 ) {
			
				normal = !floor ? (new THREE.Vector3( x - hw, y - hh, z - hd )) : (new THREE.Vector3( 0, 1, 0 ));
				normal.normalize().multiplyScalar( 0.1 );
				
			} else {
			
				normal = new THREE.Vector3( 0, 1, 0 );
				
			}
			
			// direct
			normal.add( getNorm( x, y, z, 1, 0, 0 ) );
			normal.add( getNorm( x, y, z, -1, 0, 0 ) );
			normal.add( getNorm( x, y, z, 0, 1, 0 ) );
			normal.add( getNorm( x, y, z, 0, -1, 0 ) );
			normal.add( getNorm( x, y, z, 0, 0, 1 ) );
			normal.add( getNorm( x, y, z, 0, 0, -1 ) );
			
			var weight;
			
			if ( smoothNormals > 0.0 ) {
			
				// two over
				weight = 0.25 * smoothNormals;
				normal.add(getNorm( x, y, z, 2, 0, 0 ).multiplyScalar( weight ) );
				normal.add(getNorm( x, y, z, -2, 0, 0 ).multiplyScalar( weight ) );
				normal.add(getNorm( x, y, z, 0, 2, 0 ).multiplyScalar( weight ) );
				normal.add(getNorm( x, y, z, 0, -2, 0 ).multiplyScalar( weight ) );
				normal.add(getNorm( x, y, z, 0, 0, 2 ).multiplyScalar( weight ) );
				normal.add(getNorm( x, y, z, 0, 0, -2 ).multiplyScalar( weight ) );
		
				// diagonals
				weight = 0.4 * smoothNormals;
				normal.add(getNorm( x, y, z, 1, 1, 0 ).multiplyScalar( weight ) );
				normal.add(getNorm( x, y, z, 0, 1, 1 ).multiplyScalar( weight ) );
				normal.add(getNorm( x, y, z, 1, 1, 1 ).multiplyScalar( weight ) );
				normal.add(getNorm( x, y, z, -1, -1, 0 ).multiplyScalar( weight ) );
				normal.add(getNorm( x, y, z, 0, -1, -1 ).multiplyScalar( weight ) );
				normal.add(getNorm( x, y, z, -1, -1, -1 ).multiplyScalar( weight ) );
				
			}
			
			// normalize
			if ( normal.length() == 0 ) normal.set( 0, 1, 0 );
			else normal.normalize();
			
			// occlusion
			// sample neighbors first
			var occ = 0.0;
			
			if ( numNeighbors > 2 ) {
			
				weight = 0.125;
				
				// add direct neighbors
				for ( var n = 0; n < 6; n++ ) occ += neighbors[ n ];
				occ *= 0.25 / 6.0;
				
				// sample in direction of the normal		
				occ += 1.0 * getAlpha( Math.round( x + normal.x ), Math.round( y + normal.y ), Math.round( z + normal.z ) );
				
				// find a perpendicular vector
				ax = Math.abs( normal.x ); ay = Math.abs( normal.y ); az = Math.abs( normal.z );
				mv = Math.min( ax, ay, az );
				if ( mv == ax ) {
				
					perp.set( 1, 0, 0 );
					
				} else if ( mv == ay ) {
				
					perp.set( 0, 1, 0 );
					
				} else {
				
					perp.set( 0, 0, 1 );
					
				}
				
				perp.cross( normal ).normalize();
				
				// narrow cone
				tilted.copy( normal ).applyAxisAngle( perp, Math.PI * 0.2 ).normalize().multiplyScalar( 2 );
				occ += weight * getAlpha( Math.round( x + tilted.x ), Math.round( y + tilted.y ), Math.round( z + tilted.z ) );
				tilted.applyAxisAngle( normal, Math.PI * 0.25 );
				occ += weight * getAlpha( Math.round( x + tilted.x ), Math.round( y + tilted.y ), Math.round( z + tilted.z ) );
				tilted.applyAxisAngle( normal, Math.PI * 0.25 );
				occ += weight * getAlpha( Math.round( x + tilted.x ), Math.round( y + tilted.y ), Math.round( z + tilted.z ) );
				tilted.applyAxisAngle( normal, Math.PI * 0.25 );
				occ += weight * getAlpha( Math.round( x + tilted.x ), Math.round( y + tilted.y ), Math.round( z + tilted.z ) );
				tilted.applyAxisAngle( normal, Math.PI * 0.25 );
				occ += weight * getAlpha( Math.round( x + tilted.x ), Math.round( y + tilted.y ), Math.round( z + tilted.z ) );
				tilted.applyAxisAngle( normal, Math.PI * 0.25 );
				occ += weight * getAlpha( Math.round( x + tilted.x ), Math.round( y + tilted.y ), Math.round( z + tilted.z ) );
				tilted.applyAxisAngle( normal, Math.PI * 0.25 );
				occ += weight * getAlpha( Math.round( x + tilted.x ), Math.round( y + tilted.y ), Math.round( z + tilted.z ) );
				tilted.applyAxisAngle( normal, Math.PI * 0.25 );
				occ += weight * getAlpha( Math.round( x + tilted.x ), Math.round( y + tilted.y ), Math.round( z + tilted.z ) );
	
				// wider cone
				tilted.copy(normal).applyAxisAngle(perp, Math.PI * 0.35).normalize().multiplyScalar(3.5);
				occ += weight * 0.5 * getAlpha( Math.round( x + tilted.x ), Math.round( y + tilted.y ), Math.round( z + tilted.z ) );
				tilted.applyAxisAngle( normal, Math.PI * 0.25 );
				occ += weight * 0.5 * getAlpha( Math.round( x + tilted.x ), Math.round( y + tilted.y ), Math.round( z + tilted.z ) );
				tilted.applyAxisAngle( normal, Math.PI * 0.25 );
				occ += weight * 0.5 * getAlpha( Math.round( x + tilted.x ), Math.round( y + tilted.y ), Math.round( z + tilted.z ) );
				tilted.applyAxisAngle( normal, Math.PI * 0.25 );
				occ += weight * 0.5 * getAlpha( Math.round( x + tilted.x ), Math.round( y + tilted.y ), Math.round( z + tilted.z ) );
				tilted.applyAxisAngle( normal, Math.PI * 0.25 );
				occ += weight * 0.5 * getAlpha( Math.round( x + tilted.x ), Math.round( y + tilted.y ), Math.round( z + tilted.z ) );
				tilted.applyAxisAngle( normal, Math.PI * 0.25 );
				occ += weight * 0.5 * getAlpha( Math.round( x + tilted.x ), Math.round( y + tilted.y ), Math.round( z + tilted.z ) );
				tilted.applyAxisAngle( normal, Math.PI * 0.25 );
				occ += weight * 0.5 * getAlpha( Math.round( x + tilted.x ), Math.round( y + tilted.y ), Math.round( z + tilted.z ) );
				tilted.applyAxisAngle( normal, Math.PI * 0.25 );
				occ += weight * 0.5 * getAlpha( Math.round( x + tilted.x ), Math.round( y + tilted.y ), Math.round( z + tilted.z ) );
	
				occ /= 3;
				
			} else {
			
				occ = -numNeighbors * 0.25;
				
			}
			
			occlusion.push( occ );
		
			// store brightness in normal length, after occlusion step
			normal.multiplyScalar( 1.0 + assembledFrameData[ index ].b );
				
			// color
			colorObj.set( assembledFrameData[ index ].c );
			colors.push( colorObj.r, colorObj.g, colorObj.b, assembledFrameData[ index ].a );
			
			// position
			positions.push( x, y, z );
			
			// normal
			normals.push( normal.x, normal.y, normal.z ); 
					
			index++;
			
		}}}

	}
	
	return { p: positions, c: colors, n: normals, o: occlusion };
	
};

/*
	Finalizes loaded frames by concatenating frameData entries and creating BufferAttribute 
	objects in first frame + storing frame offsets.
	
	Called after all decodeFrame have been completed.
	
	end result - dataObject.frameData[] contains
	{p:posAttr, c:colorAttr, n:normAttr, o:occlusionAttr, s:startOffset, l:length }; (all BufferAttributes)
	for the first frame and { s:startOffset, l:length } for consecutive frames (referring to 0 frame)

*/

THREE.PixelBoxUtil.finalizeFrames = function ( dataObject, pivot ) {

	var ffd = dataObject.frameData[ 0 ];
	var curOffset = 0;
	var lastNonEmpty = 0;
	for ( var f = 0; f < dataObject.frameData.length; f++ ) {
	
		var fd = dataObject.frameData[ f ];
		
		// store offset
		// non-empty
		if ( fd ) {
		
			lastNonEmpty = f;
			fd.s = curOffset;
			fd.l = fd.o.length;
			curOffset += fd.o.length;
			
		// empty (same as previous)
		} else {
		
			dataObject.frameData[ f ] = dataObject.frameData[ lastNonEmpty ];
			
		}
		
		// concat arrays
		if ( f && fd ) {
		
			ffd.p = ffd.p.concat( fd.p );
			ffd.c = ffd.c.concat( fd.c );
			ffd.n = ffd.n.concat( fd.n );
			ffd.o = ffd.o.concat( fd.o );
			delete fd.p;
			delete fd.c;
			delete fd.n;
			delete fd.o;
			
		}
		
	}
	
	// offset by pivot
	for ( var i = 0, l = ffd.p.length; i < l; i += 3 ) {
	
		ffd.p[ i ] -= pivot.x;
		ffd.p[ i + 1 ] -= pivot.y;
		ffd.p[ i + 2 ] -= pivot.z;
		
	}
	
	// create buffers
	ffd.p = new THREE.BufferAttribute( new Float32Array( ffd.p ), 3 );
	ffd.c = new THREE.BufferAttribute( new Float32Array( ffd.c ), 4 );
	ffd.n = new THREE.BufferAttribute( new Float32Array( ffd.n ), 3 );
	ffd.o = new THREE.BufferAttribute( new Float32Array( ffd.o ), 1 );
	
};

/* 
	Encodes/appends a single frame into dataObject
	
	dataObject must have the following fields 
	{ 	
		width, height, depth,		fixed dimensions
		frames						array
	}
	
	frameData must be an array of width * height * depth elements of the following form
	{ c: hexcolor, a: floatAlpha, b: floatBrightness } or null for empty pixels
	
	if there are already frames in frames array, it will use DELTA, otherwise FULL FRAME format
	
	after finishing encoding all frames, delete dataObject.assembledFrames property (used while encoding for delta lookups)
*/

THREE.PixelBoxUtil.encodeFrame = function ( frameData, dataObject ) {

	// current frame number
	var frameIndex = dataObject.frames.length;

	// add assembledFrame
	if ( dataObject.assembledFrames === undefined ) dataObject.assembledFrames = [];
	
	dataObject.assembledFrames.push( frameData );
	
	var combine = [];
	var prevFramePixel;
	
	// begin encode	
	var index = 0;	
	for ( var x = 0; x < dataObject.width; x++ ) {
	for ( var y = 0; y < dataObject.height; y++ ) {
	for ( var z = 0; z < dataObject.depth; z++ ) {
	
		// pixel
		var fd = frameData[ index ];
		fd = fd ? fd : { c:0, a:0, b:0 };
		var c = ('00000' + (new Number( fd.c )).toString( 16 )).substr( -6 );
		var a = (new Number(Math.floor( fd.a * 15.0 ))).toString( 16 );
		var b = (new Number(Math.floor( fd.b * 15.0 ))).toString( 16 );
		
		// delta
		if ( frameIndex ) {
		
			// compare with previous
			prevFramePixel = dataObject.assembledFrames[ frameIndex - 1 ][ index ];
			prevFramePixel = prevFramePixel ? prevFramePixel : { c:0, a:0, b:0 };
			
			if ( prevFramePixel.c != fd.c || prevFramePixel.a != fd.a || prevFramePixel.b != fd.b ) {
			
				combine.push( ('00000' + (new Number( index )).toString( 16 )).substr( -6 ) + c + a + b );
				
			}
			
		// full
		} else {
		
			combine.push( c + a + b );
			
		}
		
		index++;
		
	}}}
	
	dataObject.frames.push( combine.join( '' ) );
	
};


/*
 * @author Kirill Edelman
 * @source https://github.com/kirilledelman/pixelbox
 * @documentation https://github.com/kirilledelman/pixelbox/wiki
 * @license MIT
*/


THREE.PixelBoxRenderer = function () {

	this.scene = null;
	this.webgl = null;
	this.clock = new THREE.Clock();
	this.paused = false;
	
	/* init */
	this.init = function ( scale, stats ) {
		// check webgl support
		var webgl = false;
		var canvas;
		try {
		
			canvas = document.createElement( 'canvas' );
			webgl = !!window.WebGLRenderingContext && (canvas.getContext( 'webgl' ) || canvas.getContext( 'experimental-webgl' ));
			
		} catch( e ) {};
		
		if ( !webgl ) return false;
	
		this.scale = 1.0 / (scale != undefined ? scale : 1.0);
		
		// create renderer
		this.webgl = webgl = new THREE.WebGLRenderer( {	devicePixelRatio: 1.0, antialias: false, autoClear: false, 
														alpha: false, maxLights: 16, preserveDrawingBuffer: false, precision: 'highp' } );
														
		document.body.insertBefore( webgl.domElement, document.body.firstChild );
		webgl.updateStyle = false;
		webgl.setSize( window.innerWidth * this.scale, window.innerHeight * this.scale );
		
	    // shadowing
	    webgl.shadowMapEnabled = true;
	    webgl.sortObjects = false;
	    webgl.shadowMapSoft = false;
		webgl.shadowMapType = THREE.BasicShadowMap;
		
		// default transition params
		this.transitionParams = {
			textureThreshold: 0.5,
			transitionDuration: 1,
			useTexture: false
		}
		
		// stats
		if ( stats ) {
		
			var stats = this.stats = new Stats();
			stats.domElement.style.position = 'absolute';
			stats.domElement.style.bottom = '0px';
			stats.domElement.style.right = '0px';
			stats.domElement.style.zIndex = 100;
			document.body.appendChild( stats.domElement );
			this.stats = stats;
			
		}
		
		// window resized listener
		window.addEventListener( 'resize', this._windowResized );
		canvas.style.width = window.innerWidth + 'px';
		canvas.style.height = window.innerHeight + 'px';
			
		// start render loop
		this._render();
		
		return true;
		
	}

	/* 
		setScene(newScene [, transType [, duration]]);
	
		parameters:
			
			(PixelBoxScene) newScene - new scene to make current
			
			(*) transType - (optional) transition type.
							Omit this parameter for instant scene switch.
							Specify (THREE.Texture) texture for image transition.
							Specify (BOOL) true for blend transition.
							
			(Number) duration - (optional) duration of the transition - default is 1 sec
	*/
	this.setScene = function ( newScene, transType, duration ) {
	
		this.currentScene = newScene;
		
		// ignore if the same scene
		if ( transType != undefined && (((this.scene instanceof THREE.PixelBoxSceneTransition) && this.scene.sceneB == newScene && transType != 0) || this.scene == newScene) ) { 
		
			console.log( "Same scene" );
			return;
			
		}
	
		// check if size changed
		if ( newScene.fbo && 
			(newScene.fbo.width != window.innerWidth * this.scale || newScene.fbo.height != window.innerHeight * this.scale) &&
			newScene.onResized ) { 
				
				newScene.onResized();
				
		}
	
		// with transition
		if ( transType != undefined && transType !== 0 ) {
		
			if ( newScene[ 'addResizeListener' ] ) newScene.addResizeListener();
			if ( newScene[ 'onWillAdd' ] ) newScene.onWillAdd();
			
			// add a blank scene if was empty
			if ( !this.scene ) this.scene = new THREE.PixelBoxEmptyScene( newScene.clearColor );
			
			// if transition is in progress finish current first
			else if ( this.scene instanceof THREE.PixelBoxSceneTransition ) {
			
				this.setScene( this.scene.sceneB, 0 );
				
			}
			
			// notify scene that it will be removed
			if ( this.scene[ 'onWillRemove' ] ) {
			
				this.scene.onWillRemove();
				
			}
			
			// do a transition
			if ( this.transitionScene ) {
			
				this.transitionScene.init( this.scene, newScene );
				
			} else {
			
				this.transitionScene = new THREE.PixelBoxSceneTransition( this.scene, newScene );
				
			}
			
			if ( duration != undefined ) this.transitionParams.transitionDuration = duration;
			else this.transitionParams.transitionDuration = 1;
			
			if ( transType instanceof THREE.Texture ) {
			
				this.transitionScene.setTexture( transType );
				this.transitionScene.useTexture( true );
				
			} else {
			
				this.transitionScene.useTexture( false );
				
			}
			
			this.transitionScene.setTextureThreshold( this.transitionParams.textureThreshold );
			this.transitionScene.onTransitionComplete = function ( s ) { renderer.setScene( s, 0 ); }
			this.scene = this.transitionScene;
			
		// without transition
		} else {
		
			// notify old scene that it's removed
			if ( (this.scene instanceof THREE.PixelBoxSceneTransition) && this.scene.sceneA && this.scene.sceneA[ 'onRemoved' ] ) {
			
				if ( this.scene.sceneA[ 'removeResizeListener' ]) this.scene.sceneA.removeResizeListener();
				this.scene.sceneA.onRemoved();
				this.scene.sceneA = undefined;
				
			} else if ( this.scene && this.scene[ 'onRemoved' ] ) {
			
				if ( transType == undefined && this.scene[ 'onWillRemove' ] ) this.scene.onWillRemove();
				if ( this.scene[ 'removeResizeListener' ] ) this.scene.removeResizeListener();
				this.scene.onRemoved();
				
			}
		
			// set new scene
			this.scene = newScene;
			
			// callback when scene transition is complete
			if ( transType == undefined ) { 
			
				if ( newScene[ 'addResizeListener' ] ) newScene.addResizeListener();
				if ( newScene[ 'onWillAdd' ] ) newScene.onWillAdd();
				
			}
			if ( newScene[ 'onAdded' ] ) newScene.onAdded();
		}
		
		window.dispatchEvent( new Event( 'resize' ) );
		
	}

	/* render */
	this._render = function () {
	
		if ( !renderer.paused ) requestAnimationFrame( renderer._render );
		
		var deltaTime = renderer.clock.getDelta();
		
		if ( renderer.scene ) { // assumes Transition or Scene
		
			renderer.scene.render( deltaTime );
			
		}
		
		if ( renderer.stats ) renderer.stats.update();
		
	}

	/* window resized callback */
	this._windowResized = function () {
	
		// notify the renderer of the size change
		renderer.webgl.setSize( window.innerWidth * renderer.scale, window.innerHeight * renderer.scale );
		
		// fill screen
		renderer.webgl.domElement.style.width = window.innerWidth + 'px';
		renderer.webgl.domElement.style.height = window.innerHeight + 'px';

		// update PixelBox viewport uniform
		THREE.PixelBoxUtil.updateViewPortUniform();
		
	};

	/* pause rendering when app is inactive */
	this.pause = function ( p ) {
	
		this.paused = p;
		this.clock.getDelta();
		this._render();
		
	};
	
}

/* empty generic scene for transition */
THREE.PixelBoxEmptyScene = function ( clearColor ) {

	this.clearColor = clearColor != undefined ? clearColor : 0x0;
	this.camera = new THREE.PerspectiveCamera( 70, 1.0, 0.1, 10000 );
	
	// setup scene
	this.scene = new THREE.Scene();
	
	// create render target
	var renderTargetParameters = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBFormat, stencilBuffer: false };
	this.fbo = new THREE.WebGLRenderTarget( renderer.webgl.domElement.width, renderer.webgl.domElement.height, renderTargetParameters );
	
}

THREE.PixelBoxEmptyScene.prototype = {
	constructor: THREE.PixelBoxEmptyScene,
	onWillAdd: function () {},
	onAdded: function () {},
	onWillRemove: function () {}, // called before this scene will be transitioned away
	onRemoved: function () {}, // called before the scene is destroyed
	onResized: function () {},// called by renderer's window resize callback
	render: function ( delta, rtt ) {
	
		renderer.webgl.setClearColor( this.clearColor, 1 );
		if ( rtt ) renderer.webgl.render( this.scene, this.camera, this.fbo, true );
		else renderer.webgl.render( this.scene, this.camera );
		
	}
};

/* transition scene, adopted from three.js examples */
THREE.PixelBoxSceneTransition = function ( sa, sb ) {

	this.scene = new THREE.Scene();
	
	this.cameraOrtho = new THREE.OrthographicCamera( renderer.webgl.domElement.width / -2, renderer.webgl.domElement.width / 2,
													 renderer.webgl.domElement.height / 2, renderer.webgl.domElement.height / -2, -1, 1 );
	
	this.quadmaterial = new THREE.ShaderMaterial( {

		uniforms: {
			tScale: { type: "v2", value: new THREE.Vector2( 1, 1 ) },
			
			tDiffuse1: {
				type: "t",
				value: null
			},
			tDiffuse2: {
				type: "t",
				value: null
			},
			mixRatio: {
				type: "f",
				value: 0.0
			},
			threshold: {
				type: "f",
				value: 0.1
			},
			useTexture: {
				type: "i",
				value: 1,
			},
			tMixTexture: {
				type: "t",
				value: null
			}
		},
		
		vertexShader: [

			"varying vec2 vUv;",

			"void main() {",

			"vUv = vec2( uv.x, uv.y );",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

			"}"

		].join( "\n" ),
		
		fragmentShader: [

			"uniform float mixRatio;",
			"uniform vec2 tScale;",

			"uniform sampler2D tDiffuse1;",
			"uniform sampler2D tDiffuse2;",
			"uniform sampler2D tMixTexture;",
			
			"uniform int useTexture;",
			"uniform float threshold;",

			"varying vec2 vUv;",

			"void main() {",

			"vec4 texel1 = texture2D( tDiffuse1, vUv );",
			"vec4 texel2 = texture2D( tDiffuse2, vUv );",
			
			"if (useTexture==1) {",
				
				"vec4 transitionTexel = texture2D( tMixTexture, vec2(0.5 + (vUv.x - 0.5) * tScale.x, 0.5 + (vUv.y - 0.5) * tScale.y) );",
				"float r = mixRatio * (1.0 + threshold * 2.0) - threshold;",
				"float mixf=clamp((transitionTexel.r - r)*(1.0/threshold), 0.0, 1.0);",
				
				"gl_FragColor = mix( texel2, texel1, mixf );",
			"} else {",
				
				"gl_FragColor = mix( texel1, texel2, mixRatio );",
				
			"}",
		"}"

		].join( "\n" )

	} );		

	quadgeometry = new THREE.PlaneBufferGeometry( renderer.webgl.domElement.width, renderer.webgl.domElement.height );
	
	this.quad = new THREE.Mesh( quadgeometry, this.quadmaterial );
	this.scene.add( this.quad );

	this.init = function ( fromScene, toScene ) {
	
		this.onTransitionComplete = null;
		this.smoothTime = this.time = 0;
		
		// Link both scenes and their FBOs
		this.sceneA = fromScene;
		this.sceneB = toScene;
	
		this.quadmaterial.uniforms.tDiffuse1.value = fromScene.fbo;
		this.quadmaterial.uniforms.tDiffuse2.value = toScene.fbo;
		
		var ww = renderer.webgl.domElement.width;
		var hh = renderer.webgl.domElement.height;
		this.quadmaterial.uniforms.tScale.value.set(
			Math.min( ww / hh, 1 ),
			Math.min( hh / ww, 1 )			
		);
		
	}
	
	this.init(sa, sb);
	
	this.setTextureThreshold = function ( value ) {
	
		this.quadmaterial.uniforms.threshold.value = value;
		
	}
	
	this.useTexture = function ( value ) {
	
		this.quadmaterial.uniforms.useTexture.value = value ? 1 : 0;
		
	}
	
	this.setTexture = function ( tex ) {
	
		this.quadmaterial.uniforms.tMixTexture.value = tex;
		
	}
	
	this.render = function (  delta ) {
	
		var transitionParams = renderer.transitionParams;
		
		// Transition animation
		this.time += delta;
		this.smoothTime = THREE.Math.smoothstep( this.time, 0, transitionParams.transitionDuration );
		this.quadmaterial.uniforms.mixRatio.value = this.smoothTime;

		if ( this.smoothTime == 0 ) {
		
			this.sceneA.render( delta, false );
			
		} else if ( this.smoothTime == 1 ) {
		
			this.sceneB.render( delta, false );
			
			// on complete
			if ( this.onTransitionComplete ) {
			
				this.onTransitionComplete( this.sceneB );
				
			}
			
		} else {
			
			// When 0<transition<1 render transition between two scenes
			this.quadmaterial.uniforms.tDiffuse1.value = this.sceneA.fbo;
			this.quadmaterial.uniforms.tDiffuse2.value = this.sceneB.fbo;

			this.sceneA.render( delta, true );
			this.sceneB.render( delta, true );
			
			THREE.PixelBoxUtil.updateViewPortUniform();
			
			renderer.webgl.render( this.scene, this.cameraOrtho, null, true );
			
		}

	}
	
}

var renderer = new THREE.PixelBoxRenderer();

/*
 * @author Kirill Edelman
 * @source https://github.com/kirilledelman/pixelbox
 * @documentation https://github.com/kirilledelman/pixelbox/wiki
 * @license MIT
*/

/* scene constructor */
THREE.PixelBoxScene = function () {
	
	THREE.Scene.call( this );

	// setup scene
	this.clearColor = 0x0;
	this.scene = this; // compat. with editor
	
	// add fog
	this.fog = new THREE.Fog( 0x0, 100000, 10000000 );
	
	// add ambient
	this.ambientLight = new THREE.AmbientLight( 0x0 );
	this.add( this.ambientLight );
	
	// flag to call PixelBoxUtil.updateLights
	this.updateLights = true;
	
	// when updating lights, also recompile materials
	this.updateMaterials = true; 
	
	// default camera
	this._camera = new THREE.PerspectiveCamera( 60, renderer.webgl.domElement.width / renderer.webgl.domElement.height, 1, 2000000 );
	this._camera.name = 'camera';
	this._camera.position.set( 70, 70, 70 );
	this._camera.lookAt( 0, 0, 0 );
	this.add( this._camera );

	Object.defineProperty( this, 'camera', {
		get: function () { return this._camera; },
		set: function ( v ) { 
		
			this._camera = v;
			
			// switch camera in renderPass of composer
			if ( this.useComposer && this.composer && this.composer.renderPass ) {
			
				this.composer.renderPass.camera = v;
				
			}
			
		}
	} );	
	
	// create render target / frame buffer
	var renderTargetParameters = { 
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBFormat, 
		stencilBuffer: false 
	};
	
	this.fbo = new THREE.WebGLRenderTarget( renderer.webgl.domElement.width, renderer.webgl.domElement.height, renderTargetParameters );
	
	// create composer if necessary
	if ( this.useComposer ) {
	
		/* 
			Composer requires the following classes / includes:
			<script src="js/postprocessing/CopyShader.js"></script>
			<script src="js/postprocessing/EffectComposer.js"></script>
			<script src="js/postprocessing/RenderPass.js"></script>
			<script src="js/postprocessing/ShaderPass.js"></script>
			<script src="js/postprocessing/MaskPass.js"></script>
			<script src="js/postprocessing/ScreenShader.js"></script>
		*/			
	
		// composer
		this.composer =  new THREE.EffectComposer( renderer.webgl, this.fbo );
		
		// render pass
	    this.composer.renderPass = new THREE.RenderPass( this, this.camera );
	    this.composer.addPass( this.composer.renderPass );	    
	    
	    // last pass - ScreenPass is an example shader in js/lib/screenShader.js
	    this.composer.screenPass = new THREE.ScreenPass();
		this.composer.addPass( this.composer.screenPass );
		
	}
	
	// raycaster for mouse picking
	this.raycaster = new THREE.Raycaster( new THREE.Vector3(), new THREE.Vector3(), 0.01, this.camera.far ) ;
	this.floorPlane = new THREE.Plane( new THREE.Vector3( 0, 1, 0 ), 0 );
	
	// object recycling pool
	this.objectPool = {};
	
	return this;
}

THREE.PixelBoxScene.prototype = Object.create( THREE.Scene.prototype );
THREE.PixelBoxScene.prototype.constructor = THREE.PixelBoxScene;

/* ================================================================================ THREE.PixelBoxRenderer callbacks */
	
/* called by THREE.PixelBoxRenderer after scene transition has finished */
THREE.PixelBoxScene.prototype.onAdded = function () {};

/* 	called by THREE.PixelBoxRenderer before scene transition begins  */	
THREE.PixelBoxScene.prototype.onWillAdd = function () {};

/* 	called by THREE.PixelBoxRenderer after transition has finished */	
THREE.PixelBoxScene.prototype.onWillRemove = function () {};

/* 	called by THREE.PixelBoxRenderer after scene has been removed */
THREE.PixelBoxScene.prototype.onRemoved = function () {};
	
/* ================================================================================ Scene tick */

/* scene think function */
THREE.PixelBoxScene.prototype.tick = function ( delta ) {};

/* ================================================================================ Instantiate a template */

/* 
	instantiate an object as defined in scene template 

		(String) templateName - name of the template from scene definition
		(Object) options - (optional) object to pass to populateObject function (see populateObject function for info)
*/

THREE.PixelBoxScene.prototype.instantiate = function ( templateName, options ) {

	var def = this.templates[ templateName ];
	
	if ( def ) {
	
		options = options ? options : {};
		options.templates = this.templates;
		
		var objs = this.populateObject( null, [ def ], options );
		
		if ( objs.length ) {
		
			var obj = objs[ 0 ];
			this.linkObjects( objs, obj );
			return obj;
			
		}
		
		console.log( "Instantiate " + templateName + " failed" );
		return null;
		
	}
	
	console.log( "Template " + templateName + " not found in scene definiton" );
	
};
	
/* ================================================================================ Object recycling */

/* 	
	recycle(objectOrArray) - removes object(s) from parent, and recycles it
	
	this is the preferred method of removing objects in THREE.PixelBoxScene
	
	recycling dismantles object's hierarchy and stores each object in scene's objectPool ordered
	by object type and asset name.
	
	recycled objects can later be upcycled (retrieved from the pool) by object type (and reinitialized)
	
	if an object's type is not one of these, it will not be stored in the pool after removal from its parent
	
	supported object types are
		PixelBox, DirectionalLight, HemisphereLight, PointLight, SpotLight, Mesh, PerspectiveCamera, OrthographicCamera, Object3D
		(if it was created by populateObject and thus has .isContainer == true)
		Line (for representing paths)

*/

THREE.PixelBoxScene.prototype.recycle = function ( scrap ) {

	// accept object or an array of objects
	if ( !_.isArray( scrap ) ) scrap = [ scrap ];
	
	var objs, obj, containsLights = false;
	for ( var si = 0, sl = scrap.length; si < sl; si++ ) {
	
		var obj = scrap[ si ];
		objs = obj.recursiveRemoveChildren();
		
		if ( obj.parent ) { 
		
			if ( obj[ 'name' ] ) {
			
				if ( obj.anchored && obj.parent.parent && obj.parent.parent[ obj.name ] == obj ) {
				
					delete obj.parent.parent[ obj.name ];
					
				} else if ( obj.parent[ obj.name ] == obj ) {
				
					delete obj.parent[ obj.name ];
					
				}
				
			}
			
			obj.parent.remove( obj );
			
		}
		
		objs.push( obj );
	
		for ( var i = 0, l = objs.length; i < l; i++ ) {
		
			obj = objs[ i ];
			var typeName = null;
			
			if ( obj instanceof THREE.PixelBox ) {
			
				typeName = obj.geometry.data.name;
				
			} else if ( obj instanceof THREE.DirectionalLight ) {
			
				typeName = 'DirectionalLight'; containsLights = true;
				
			} else if ( obj instanceof THREE.HemisphereLight ) {
			
				typeName = 'HemisphereLight'; containsLights = true;
				
			} else if ( obj instanceof THREE.PointLight ) {
			
				typeName = 'PointLight'; containsLights = true;
				
			} else if ( obj instanceof THREE.SpotLight ) {
			
				typeName = 'SpotLight'; containsLights = true;
				
			} else if ( obj instanceof THREE.Mesh ) {
			
				typeName = 'Geometry';
				
			} else if ( obj instanceof THREE.PerspectiveCamera ) {
			
				typeName = 'Camera';
				
			} else if ( obj instanceof THREE.OrthographicCamera ) {
			
				typeName = 'OrthographicCamera';
				
			} else if ( obj instanceof THREE.LinePath ) {
			
				typeName = 'LinePath';
				
			} else if ( obj instanceof THREE.Object3D && obj.isContainer ) {
			
				typeName = 'Object3D';
				
			}
			
			if ( typeName ) {
			
				// store
				if ( !this.objectPool[ typeName ] ) { 
				
					this.objectPool[ typeName ] = [ obj ];
					
				} else {
				
					this.objectPool[ typeName ].push( obj );
					
				}
				
			}
			
		}
		
	}
	
	if ( containsLights ) this.updateLights = true;
	
};

/* 
	retrieves an object of objType from objectPool
	
	used by populateObject function	
*/

THREE.PixelBoxScene.prototype.upcycle = function ( objType ) {

	var obj = null;
	
	if ( this.objectPool[ objType ] && this.objectPool[ objType ].length ) {
	
		obj = this.objectPool[ objType ][ this.objectPool[ objType ].length - 1 ];
		this.objectPool[ objType ].pop();
		
	}
	
	return obj;
	
};

/* ================================================================================ Scene loading / populating */

/* 	
	populateWith(sceneDef [, options]) - populate scene with definition object
	
		(Object) sceneDef - scene definition as generated by PixelBox Scene editor
		
		(Object) options - (optional) object to pass to populateObject function (see populateObject function for info)
	
*/

THREE.PixelBoxScene.prototype.populateWith = function ( sceneDef, options ) {

	if ( !sceneDef ) {
	
		console.log( "PixelBoxScene.populateWith called with sceneDef = ", sceneDef );
		console.log( "Make sure that the name of scene in sceneDef matches the name of the file loaded with PixelBoxAssets.loadAssets(...)\nCurrently loaded assets: ", assets.cache.files );
		return;
		
	}

	function value( obj, name, defaultVal ) { if ( !obj || obj[ name ] === undefined) return defaultVal; return obj[ name ]; }

	// config
	this.clearColor = parseInt( value( sceneDef, 'clearColor', '0' ), 16 );
	
	this.fog.color.set( parseInt( value( sceneDef, 'fogColor', '0' ), 16 ) );
	this.fog.near = value( sceneDef, 'fogNear', 100000 );
	this.fog.far = value( sceneDef, 'fogFar', 10000000 );
	
	this.ambientLight.color.set( parseInt( value( sceneDef, 'ambient', '0' ), 16 ) );
	
	// add assets to cache if needed
	for ( var i in sceneDef.assets ) {
	
		var asset = sceneDef.assets[ i ];
		
		// compressed PixelBox asset
		if ( typeof( asset ) == 'string' ) {
		
			var json = LZString.decompressFromBase64( asset );
			
			if ( !json ) {
			
				console.error( "Failed to LZString decompressFromBase64: ", asset );
				continue;
				
			}
			
			try {
			
				asset = JSON.parse( json );
				
			} catch( e ) {
			
				console.error( "Failed to parse JSON ", e, json );
				
			}
			
		} else {
		
			asset = _deepClone( asset, 100 );
			
		}
		
		// already loaded
		if ( assets.cache.get( asset.name ) ) continue;
		
		// save reference
		asset.includedWithScene = this;
		
		// add asset to cache if needed
		assets.cache.add( asset.name, asset );
		
	}
	
	options = options ? options : {};
	this.templates = options.templates = sceneDef.templates;

	// populate scene
	var addedObjects = this.populateObject( this, sceneDef.layers ? sceneDef.layers : [], options );

	// prepare maxShadows placeholders
	var numShadows = 0;
	for ( var i = 0, l = addedObjects.length; i < l; i++ ) {
	
		var obj = addedObjects[ i ];
		if ( (obj instanceof THREE.DirectionalLight || obj instanceof THREE.SpotLight) && obj.castShadow ) numShadows++;
		
	}
	
	var maxShadows = Math.max( 0, sceneDef.maxShadows - numShadows );
	this.placeHolderLights = [];
	
	var light;
	
	while ( maxShadows ) {
	
		if ( this.placeHolderLights.length ) light = new THREE.SpotLight( 0x0, 1 );
		else light = new THREE.DirectionalLight( 0x0, 1 );
		
		light.castShadow = true;
		light.shadowMapWidth = light.shadowMapHeight = 128;
		this.add( light );
		this.placeHolderLights.push( light );
		maxShadows--;
		
	}
	
	// link up objects targets
	this.linkObjects( addedObjects, this );
	
};

/* 
	
	populateObject(object, layers [, options]) - populates object from layers definition
	
	returns an array of all objects created
	
	parameters:
	
	(Object3D) object - parent to add generated objects to or null
	(Array) layers - definitions of child objects to add
	(Object) options - (optional) object specifying options
		
			(Function) makeObject(objDef) - (optional callback)
				called before every object is created, or upcycled.
				* Return an Object3D to override this object with your own 
					(note that populateObject will still populate/initialize according to the definiton)
				* Return null to let object be created normally (default behavior)
				* Return -1 to skip creating this object altogether

			(Function) initObject(obj3d, objDef) - (optional callback)
				called after an object has been created and initialized with the definition.
				You can do additional initialization for the object in this callback.
			
			(Object) templates - templates used in the scene to create Instances from

		Additional options used by scene editor:
		
			(BOOL) helpers - create THREE.*Helper for lights and camera
			(BOOL) keepSceneCamera - don't override scene's camera with one in sceneDef
			(BOOL) wrapTemplates - wraps instances in Object3D container
			(BOOL) noNameReferences - don't create object[name] references in parent
			(BOOL) skipProps - passes skipProps parameter to linkObjects call to skip def.props parsing 
	
*/

THREE.PixelBoxScene.prototype.populateObject = function ( object, layers, options ) {

	var degToRad = Math.PI / 180;
	var objectsCreated = [];
	options = options ? options : {};
	
	// create layers
	for ( var i = 0; i < layers.length; i++ ) {
	
		var layer = layers[ i ];
		
		// construct object
		var obj3d = null;
		var helper = null;
		
		// try to get an object of the same type from pool
		if ( options.makeObject ) obj3d = options.makeObject( layer );
		if ( obj3d === -1 ) continue;
		if ( !obj3d && layer.asset != 'Instance' ) obj3d = this.upcycle( layer.asset );
		
		// Layer types
		switch( layer.asset ) {
		
		case 'Instance':
		
			if ( !obj3d ) {
			
				// no helpers in instances
				options = _.clone( options );
				options.helpers = false;

				if ( options.templates && options.templates[ layer.template ] ) {
				
					var objs;
					var templateDef = options.templates[ layer.template ];
					
					if ( options.wrapTemplates ) {
					
						obj3d = new THREE.Object3D();
						obj3d.isInstance = true;
						obj3d.isTemplate = false;
						objs = this.populateObject( obj3d, [ templateDef ], options );
						var topmost = objs[ 0 ];
						this.linkObjects( objs, topmost, !!options.skipProps );
						topmost.omit = true;
						topmost.position.set( 0, 0, 0 );
						topmost.rotation.set( 0, 0, 0 );
						topmost.scale.set( 1, 1, 1 );
						topmost.visible = true;							
						objectsCreated = objectsCreated.concat( objs );
						
					} else {
					
						objs = this.populateObject( object, [ templateDef ], options );
						obj3d = objs[ 0 ];
						obj3d.isInstance = true;
						obj3d.isTemplate = false;
						objs.splice( 0, 1 );
						this.linkObjects( objs, obj3d, !!options.skipProps );
						objectsCreated = objectsCreated.concat( objs );
						
					}
					
					// copy some props from template
					obj3d.castShadow = (templateDef.castShadow != undefined ? templateDef.castShadow : true);
					obj3d.receiveShadow = (templateDef.receiveShadow != undefined ? templateDef.receiveShadow : true);
					
				} else {
				
					console.log( "Template " + layer.template + " not found" );
					if ( !obj3d ) obj3d = new THREE.Object3D();
					
				}
				
			}
			
			break;
			
		case 'Camera':
		
			if ( !obj3d ) obj3d = new THREE.PerspectiveCamera( 60, 1, 1, 1000 );
			if ( layer.fov != undefined ) obj3d.fov = layer.fov;
			if ( layer.near != undefined ) obj3d.near = layer.near;
			if ( layer.far != undefined ) obj3d.far = layer.far;
			obj3d.isDefault = layer.isDefault ? true : false;
			
			if ( !options.keepSceneCamera && obj3d.isDefault ) {
			
				if ( this.camera && this.camera.parent ) this.camera.parent.remove( this.camera );
				this.camera = obj3d;
				
			}
			
			if ( options.helpers ) {
			
				helper = new THREE.CameraHelper( obj3d );
				
			}
			
			break;
			
		case 'OrthographicCamera':
		
			var sz = 64;
			if ( options.keepSceneCamera ) { // inside editor
			
				obj3d = new THREE.OrthographicCamera( -sz, sz, sz, -sz, 1, 1000 );
				
			} else {
			
				var w = renderer.webgl.domElement.width * 0.22;
				var h = renderer.webgl.domElement.height * 0.22;
				if ( !obj3d ) obj3d = new THREE.OrthographicCamera( -w, w, h, -h, 1, 1000 );
				
			}
			
			if ( layer.zoom != undefined ) {
			
				obj3d.zoom = layer.zoom;
				obj3d.updateProjectionMatrix();
				
			}
			
			if ( layer.isDefault && (this instanceof THREE.PixelBoxScene) && !this.camera.def ) { 
			
				this.camera.parent.remove( this.camera );
				this.camera = obj3d;
				
			}
			
			obj3d.isDefault = layer.isDefault ? true : false;
			
			if ( !options.keepSceneCamera && obj3d.isDefault ) {
			
				if ( this.camera && this.camera.parent ) this.camera.parent.remove( this.camera );
				this.camera = obj3d;
				
			}
			
			if ( options.helpers ) {
			
				helper = new THREE.CameraHelper( obj3d );
				
			}
			
			break;
			
		case 'DirectionalLight':
		
			if ( !obj3d ) obj3d = new THREE.DirectionalLight( 0xffffff, 1.0 );
		    obj3d.shadowMapWidth = obj3d.shadowMapHeight = 1024;
		    obj3d.shadowCameraNear = (layer.shadowNear != undefined ? layer.shadowNear : 1);
			obj3d.shadowCameraFar = (layer.shadowFar != undefined ? layer.shadowFar : 10000);
			obj3d.shadowCameraRight = (layer.shadowVolumeWidth != undefined ? layer.shadowVolumeWidth : 256) * 0.5;
		    obj3d.shadowCameraLeft = -obj3d.shadowCameraRight;
			obj3d.shadowCameraTop = (layer.shadowVolumeHeight != undefined ? layer.shadowVolumeHeight : (obj3d.shadowCameraRight * 2)) * 0.5;
			obj3d.shadowCameraBottom = -obj3d.shadowCameraTop;
			obj3d.shadowBias = (layer.shadowBias != undefined ? layer.shadowBias : -0.0005);
			if ( obj3d.shadowMap ) {
			
				obj3d.shadowMap.dispose();
				obj3d.shadowMap = null;
				
			}				
			if ( obj3d.shadowCamera ) {
			
				if ( obj3d.shadowCamera.parent ) {
				
					obj3d.shadowCamera.parent.remove( obj3d.shadowCamera );
					
				}
				
				obj3d.shadowCamera = null;
				
			}
			if ( layer.color != undefined ) obj3d.color.set( parseInt( layer.color, 16 ) );
			if ( layer.intensity != undefined ) obj3d.intensity = layer.intensity;
			if ( layer.shadowMapWidth != undefined ) obj3d.shadowMapWidth = obj3d.shadowMapHeight = layer.shadowMapWidth;
			if ( layer.shadowMapHeight != undefined ) obj3d.shadowMapHeight = layer.shadowMapHeight;
			if ( layer.target != undefined && _.isArray( layer.target ) && layer.target.length == 3 ) {// array of world pos
			
				obj3d.target = new THREE.Object3D();
				obj3d.target.position.fromArray( layer.target );
				
			}
			if ( options.helpers ) {
			
		    	helper = new THREE.DirectionalLightHelper( obj3d, 5 );
		    	
		    }
		    
			break;
			
		case 'SpotLight':
		
			if ( !obj3d ) obj3d = new THREE.SpotLight( 0xffffff, 1.0, 100, Math.PI / 3, 70 );
		    obj3d.shadowMapWidth = obj3d.shadowMapHeight = 1024;
		    obj3d.shadowCameraNear = (layer.shadowNear != undefined ? layer.shadowNear : 1);
			obj3d.shadowCameraFar = (layer.shadowFar != undefined ? layer.shadowFar : obj3d.distance);
			obj3d.shadowBias = (layer.shadowBias != undefined ? layer.shadowBias : -0.0005);
			if ( obj3d.shadowMap ) {
			
				obj3d.shadowMap.dispose();
				obj3d.shadowMap = null;
				
			}					
			if ( obj3d.shadowCamera ) {
			
				if ( obj3d.shadowCamera.parent ) {
				
					obj3d.shadowCamera.parent.remove( obj3d.shadowCamera );
					
				}
				
				obj3d.shadowCamera = null;
				
			}
			if ( layer.color != undefined ) obj3d.color.set( parseInt( layer.color, 16 ) );
			if ( layer.intensity != undefined ) obj3d.intensity = layer.intensity;
			if ( layer.distance != undefined ) obj3d.distance = layer.distance;
			if ( layer.exponent != undefined ) obj3d.exponent = layer.exponent;
			if ( layer.angle != undefined ) {
			
				obj3d.angle = layer.angle * degToRad;
				obj3d.shadowCameraFov = layer.angle * 2;
				
			}
			if ( layer.shadowMapWidth != undefined ) obj3d.shadowMapWidth = obj3d.shadowMapHeight = layer.shadowMapWidth;
			if ( layer.shadowMapHeight != undefined ) obj3d.shadowMapHeight = layer.shadowMapHeight;
			if ( layer.target != undefined && _.isArray( layer.target ) && layer.target.length == 3 ) {// array of world pos
			
				obj3d.target = new THREE.Object3D();
				obj3d.target.position.fromArray( layer.target );
				
			}
			
			if ( options.helpers ) { 
			
		    	helper = new THREE.SpotLightHelper( obj3d, 5 );
		    	
		    }
			
			break;
			
		case 'PointLight':
		
			if ( !obj3d ) obj3d = new THREE.PointLight( 0xffffff, 1.0 );
			if ( layer.color != undefined ) obj3d.color.set(parseInt( layer.color, 16 ) );
			if ( layer.intensity != undefined ) obj3d.intensity = layer.intensity;
			if ( layer.distance != undefined ) obj3d.distance = layer.distance;
			if ( options.helpers ) {
			
				helper = new THREE.PointLightHelper( obj3d, 5 );
				
			}
			break;
			
		case 'HemisphereLight':
		
			if ( !obj3d ) obj3d = new THREE.HemisphereLight( 0xffffff, 0x003366, 0.5 );
			
			if ( layer.colors ) { 
			
				obj3d.color.set( parseInt( layer.colors[ 0 ], 16 ) );
				obj3d.groundColor.set( parseInt( layer.colors[ 1 ], 16 ) );
				
			}
				
			if ( layer.intensity != undefined ) obj3d.intensity = layer.intensity;
			
			break;
			
		case 'Object3D':
		
			if ( !obj3d ) obj3d = new THREE.Object3D();
			obj3d.isContainer = true;
			
			break;
			
		case 'LinePath':
		
			if ( !obj3d ) obj3d = new THREE.LinePath();
			obj3d.initialize( layer, options );
				
			break;
			
		case 'Geometry':
		
			var geom = this.makeGeometryObject( layer );
			var mat;
			
			if ( obj3d ) {
			
				obj3d.geometry.dispose();
				obj3d.geometry = geom;
				mat = obj3d.material;
				
				var _gl = renderer.webgl.context;
				for ( var name in geom.attributes ) {
				
					var bufferType = ( name === 'index' ) ? _gl.ELEMENT_ARRAY_BUFFER : _gl.ARRAY_BUFFER;
					var attribute = geom.attributes[ name ];
					if ( !attribute.buffer ) {
					
						attribute.buffer = _gl.createBuffer();
						var res = _gl.bindBuffer( bufferType, attribute.buffer );
						_gl.bufferData( bufferType, attribute.array, _gl.STATIC_DRAW );
						
					}
					
				}
				
			} else {
			
				mat = new THREE.MeshPixelBoxMaterial();
				obj3d = new THREE.Mesh( geom, mat );
				
			}
			
			obj3d.geometryType = layer.mesh;
			
			//material
			mat.tint.set( layer.tint != undefined ? parseInt( layer.tint, 16 ) : 0xffffff );
			mat.addColor.set( layer.addColor != undefined ? parseInt( layer.addColor, 16 ) : 0x0 );
			mat.alpha = (layer.alpha != undefined ? layer.alpha : 1.0);
			mat.brightness = (layer.brightness != undefined ? layer.brightness : 0.0);
			mat.stipple = (layer.stipple != undefined ? layer.stipple : 0.0);
			break;
		
		// lookup asset by name
		default:
			var asset = assets.cache.get( layer.asset );
			if ( asset ) {
			
				if ( !obj3d ) obj3d = new THREE.PixelBox( asset );
				
			} else {
			
				console.log( "Deferred loading of " + layer.asset );
				
				if ( !obj3d ) { 
				
					// asset will be loaded later
					// create placeholder
					obj3d = new THREE.Object3D();
					obj3d.isPlaceholder = true;
					var a = new THREE.AxisHelper( 1 );
					a.isHelper = true;
					obj3d.add( a );
					
				}
				
			}
			
			break;	
			
		}					
		
		// store definition
		obj3d.def = _deepClone( layer, 100 );
		
		// set name
		if ( layer.name ) {
		
			obj3d.name = layer.name;
			
		}
		
		// add as a child
		if ( !obj3d.parent && object ) { 
		
			// add to anchor, if specified
			if ( layer.anchor && object.anchors ) {
			
				object.anchors[ layer.anchor ].add( obj3d );
				
			// otherwise to object itself
			} else {
			
				object.add( obj3d );
				
			}
			
			obj3d.anchored = layer.anchor ? layer.anchor : false;
			
		}			
		
		// assign common values
		if ( layer.position ) {
		
			obj3d.position.fromArray( layer.position );
			
		} else if ( !(obj3d instanceof THREE.HemisphereLight) ) { // damnit!
		
			obj3d.position.set( 0, 0, 0 );
			
		}
		
		if ( layer.rotation ) {
		
			obj3d.rotation.set( layer.rotation[ 0 ] * degToRad, layer.rotation[ 1 ] * degToRad, layer.rotation[ 2 ] * degToRad );
			
		} else {
		
			obj3d.rotation.set( 0, 0, 0 );
			
		}
		if ( layer.scale ) { 
		
			if ( _.isArray( layer.scale ) ) obj3d.scale.fromArray( layer.scale );
			else obj3d.scale.set( layer.scale, layer.scale, layer.scale );
			
		} else {
		
			obj3d.scale.set( 1, 1, 1 );
			
		}
		
		if ( layer.castShadow != undefined ) obj3d.castShadow = layer.castShadow;
		if ( layer.receiveShadow != undefined ) obj3d.receiveShadow = layer.receiveShadow;
		
		if ( helper ) { 
		
			this.scene.add( helper );
			obj3d.helper = helper;
			helper.isHelper = true;
			helper.update();
			helper.visible = false;
			
		}
		
		if ( layer.visible != undefined ) {
		
			obj3d.visible = layer.visible;
			
		} else obj3d.visible = true;
		
		// PixelBox specific
		if ( !obj3d.isInstance && obj3d instanceof THREE.PixelBox ) {
		
			if ( layer.pointSize != undefined ) { 
			
				obj3d.pointSize = layer.pointSize;
				
			}
			
			if ( layer.alpha != undefined ) { 
			
				obj3d.alpha = layer.alpha;
				
			} else {
			
				obj3d.alpha = 1;
				
			}
					
			if ( layer.cullBack != undefined ) obj3d.cullBack = layer.cullBack;
			if ( layer.occlusion != undefined ) obj3d.occlusion = layer.occlusion;
			if ( layer.tint != undefined ) { 
			
				obj3d.tint.set( parseInt( layer.tint, 16 ) );
				
			} else {
			
				obj3d.tint.set( 0xffffff );
				
			}
			if ( layer.add != undefined ) { 
			
				obj3d.addColor.set( parseInt( layer.add, 16 ) );
				
			} else {
			
				obj3d.addColor.set( 0x0 );
				
			}
			if ( layer.stipple != undefined ) { 
			
				obj3d.stipple = layer.stipple;
				
			} else {
			
				obj3d.stipple = 0;
				
			}
			
			if ( layer.animSpeed != undefined ) obj3d.animSpeed = layer.animSpeed;
			
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
				
			} else if ( layer.animFrame != undefined ) {
			
				obj3d.stopAnim();
				obj3d.frame = layer.animFrame;
				
			}
			
			// re-add anchors if removed
			for ( var a in obj3d.anchors ) {
			
				if ( !obj3d.anchors[a].parent ) {
				
					obj3d.add( obj3d.anchors[ a ] );
					
				}
				
			}
						
		}
		
		// add as a name reference
		if ( layer.name && !options.noNameReferences && object ) {
		
			if ( !object[ layer.name ] ) {
			
				object[ layer.name ] = obj3d;
				
			// if already have one with that name
			} else {
			
				if ( layer.name != 'camera' || (layer.name == 'camera' && !(obj3d instanceof THREE.Camera)) ) { 
				
					console.log( "Warning: ", object, "[" + layer.name + "] already exists. Overwriting." );
					
				}
				
				object[ layer.name ] = obj3d;
			}
			
		}
		
		objectsCreated.splice( 0, 0, obj3d );
		
		if ( !obj3d.isInstance && !obj3d.parentInstance() ) {
					
			if ( layer.isTemplate ) obj3d.isTemplate = layer.isTemplate;
			
			// add templates for editor
			if ( layer.containsTemplates && options.templates ) {
			
				for ( var ti = 0; ti < layer.containsTemplates.length; ti++ ) {
				
					var td = options.templates[ layer.containsTemplates[ ti ] ];
					var addedTemplates = [];
					
					if ( td ) {
					
						var nc = obj3d.children.length;
						addedTemplates = addedTemplates.concat( this.populateObject( obj3d, [ options.templates[ layer.containsTemplates[ ti ] ] ], options ) );
						this.linkObjects( addedTemplates, obj3d.children[ nc ], !!options.skipProps );
						objectsCreated = objectsCreated.concat( addedTemplates );
						
					}
					
				}
				
			}
			
		}
		
		// recursively process children
		if ( layer.layers ) {
		
			objectsCreated = objectsCreated.concat( this.populateObject( obj3d, layer.layers, options ) );
			
		}

		// callback
		if ( options.initObject ) options.initObject( obj3d, layer );
		
	}
	
	return objectsCreated;
	
};

/* generates geometry for 'Geometry' object during populateObject */
THREE.PixelBoxScene.prototype.makeGeometryObject = function ( layer ) {

	function param( p, def, min, max ) { 
	
		var val;
		if ( layer[ p ] !== undefined ) val = layer[ p ]; 
		else val = def; 
		if ( min !== undefined ) val = Math.max( min, val );
		if ( max !== undefined ) val = Math.min( max, val );
		return val;
		
	}
	
	var degToRad = Math.PI / 180;
	var geom;
	
	switch( layer.mesh ) {
	
	case 'Sphere':
	
		layer.radius = param( 'radius', 5 );
		layer.widthSegments = param( 'widthSegments', 8, 3 );
		layer.heightSegments = param( 'heightSegments', 6, 2 );
		layer.phiStart = param( 'phiStart', 0 );
		layer.phiLength = param( 'phiLength', 360 );
		layer.thetaStart = param( 'thetaStart', 0 );
		layer.thetaLength = param( 'thetaLength', 180 );
		geom = new THREE.SphereGeometry(
						layer.radius, 
						layer.widthSegments, layer.heightSegments,
						layer.phiStart * degToRad, layer.phiLength * degToRad,
						layer.thetaStart * degToRad, layer.thetaLength * degToRad );
		break;
		
	case 'Box':
	
		layer.widthSegments = param( 'widthSegments', 1, 1 );
		layer.heightSegments = param( 'heightSegments', 1, 1 );
		layer.depthSegments = param( 'depthSegments', 1, 1 );
		layer.width = param( 'width', 10 );
		layer.height = param( 'height', 10 );
		layer.depth = param( 'depth', 10 );
		geom = new THREE.BoxGeometry( layer.width, layer.height, layer.depth, layer.widthSegments, layer.heightSegments, layer.depthSegments );
		break;

	case 'Plane':
	default:
	
		layer.widthSegments = param( 'widthSegments', 1, 1 );
		layer.heightSegments = param( 'heightSegments', 1, 1 );
		layer.width = param( 'width', 10 );
		layer.height = param( 'height', 10 );
		if ( !layer.inverted )
			geom = new THREE.PlaneBufferGeometry( layer.width, layer.height,layer.widthSegments, layer.heightSegments );
		else
			geom = new THREE.PlaneGeometry( layer.width, layer.height,layer.widthSegments, layer.heightSegments );

		break;
	}
	
	// flip normals
	if ( layer.inverted ) {
	
		for ( var i = 0; i < geom.faces.length; i++ ) {
		
		    var face = geom.faces[ i ];
		    var temp = face.a;
		    face.a = face.c;
		    face.c = temp;
		    
		}
		
		geom.computeFaceNormals();
		geom.computeVertexNormals();
		
		var faceVertexUvs = geom.faceVertexUvs[ 0 ];
		for ( var i = 0; i < faceVertexUvs.length; i ++ ) {
		
		    var temp = faceVertexUvs[ i ][ 0 ];
		    faceVertexUvs[ i ][ 0 ] = faceVertexUvs[ i ][ 2 ];
		    faceVertexUvs[ i ][ 2 ] = temp;
		    
		}
		
	}
	
	return geom;
};

/* 
	links "#targetName.$anchorname.targetName" style references to objects in the hierarchy
	Used by Spot and Direct lights 
*/
THREE.PixelBoxScene.prototype.linkObjects = function ( objs, top, skipProps ) {
	
	function dereferenceObject( nameFragments, currentLevel ) {
	
		// start
		if ( typeof( nameFragments ) == 'string' ) {
		
			nameFragments = nameFragments.split( '.' );
			if ( !nameFragments.length ) return top;
			return dereferenceObject( nameFragments, currentLevel );
			
		// descend
		} else if ( nameFragments.length ) {
		
			var first = nameFragments[ 0 ];
			nameFragments.splice( 0, 1 );
			var obj = null;
			
			if ( first.substr( 0, 1 ) == '$' ) { 
			
				if ( currentLevel.anchors ) obj = currentLevel.anchors[ first.substr( 1 ) ];
				else first = first.substr( 1 );
				
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
	
	// link
	for ( var i = 0, l = objs.length; i < l; i++ ) {
	
		var obj = objs[ i ];
		
		// do .target prop first (for lights)
		var propVal;
		var found;
		var nearestTemplate = undefined;
		this.updateMaterials = this.updateLights = this.updateLights || (obj instanceof THREE.Light);
		
		if ( obj instanceof THREE.SpotLight || obj instanceof THREE.DirectionalLight ) {
		
			propVal = obj.def.target;
			if ( typeof( propVal ) == 'string' && propVal.substr( 0, 1 ) == '#' ) {
			
				nearestTemplate = obj.nearestTemplate();
				found = dereferenceObject( propVal.substr( 1 ), nearestTemplate ? nearestTemplate : top );
				
				if ( found ) { 
				
					obj.target = found;
					obj.def.target = true;
					
				}
				
			}
			
		}
		
		if ( obj.def.props && !skipProps ) {
		
			for ( var propName in obj.def.props ) {
			
				propVal = obj.def.props[ propName ];
				
				if ( typeof( propVal ) == 'string' && propVal.substr( 0, 1 ) == '#' ) {
				
					if ( nearestTemplate === undefined ) nearestTemplate = obj.nearestTemplate();
					found = dereferenceObject( propVal.substr( 1 ), nearestTemplate ? nearestTemplate : top);
					if ( found ) obj[ propName ] = found;
					
				} else {
				
					obj[ propName ] = propVal;
					
				}
				
			}
			
		}
		
	}
	
};

/* ================================================================================ Scene unloading */

/* 
	Prepares the scene to be garbage collected.
	
	Clears object recycle pool and unloads assets that were loaded with the scene definition.
	
	Assets that persist between scenes should be loaded with assets.loadAssets,
	and assets that only exist in a scene as part of scene definition should be part of sceneDef
	
*/	
	
THREE.PixelBoxScene.prototype.dispose = function ( unloadAssets ) {

	// remove all children
	this.recycle( this.children.concat() );
	
	// clear object pool
	for ( var otype in this.objectPool ) {
	
		var objects = this.objectPool[ otype ];
		
		for ( var i = 0, l = objects.length; i < l; i++ ) {
		
			var obj = objects[ i ];
			if ( obj[ 'dispose' ] ) obj.dispose();
			
		}
		
		delete this.objectPool[ otype ];
		
	}
	
	if ( unloadAssets) {
	
		// clean up assets that were loaded with this scene
		for ( var aname in assets.cache.files ) {
			var asset = assets.cache.files[ aname ];
			
			if ( asset.frameData && asset.includedWithScene == this ) {
			
				THREE.PixelBoxUtil.dispose( asset );
				delete assets.cache.files[ aname ];
				
			}
			
		}
		
	}
	
};

/* ================================================================================ THREE.PixelBoxRenderer callbacks */

THREE.PixelBoxScene.prototype.addResizeListener = function () {

	this._boundOnResized = this.onResized.bind( this );
	window.addEventListener( 'resize', this._boundOnResized );
	
};

THREE.PixelBoxScene.prototype.removeResizeListener = function () {

	window.removeEventListener( 'resize', this._boundOnResized );
	this._boundOnResized = null;
	
};

/* render callback */
THREE.PixelBoxScene.prototype.render = function ( delta, rtt ) {

	this.tick( delta );
	
	// remove maxShadows placeholders
	if ( this.placeHolderLights ) {
	
		for ( var i = 0; i < this.placeHolderLights.length; i++ ) {
		
			this.remove(this.placeHolderLights[i]);
			
		}
		
		this.recycle( this.placeHolderLights );
		this.placeHolderLights = null;
		this.updateLights = true;
		
	}
	
	if ( this.updateLights || this.updateMaterials ) {
	
		THREE.PixelBoxUtil.updateLights( this, this.updateMaterials );
		this.updateLights = false;
		this.updateMaterials = false;
		
	}
	
	renderer.webgl.setClearColor( this.clearColor, 1 );
	
	if ( this.useComposer ) {
	
		this.composer.screenPass.renderToScreen = !rtt;
		this.composer.render( delta );
		
	} else {
	
		if ( rtt ) renderer.webgl.render( this, this.camera, this.fbo, true );
		else renderer.webgl.render( this, this.camera );
	}
	
};

/* resize callback */
THREE.PixelBoxScene.prototype.onResized = function () {

	this.camera.aspect = renderer.webgl.domElement.width / renderer.webgl.domElement.height;
	this.camera.updateProjectionMatrix();
	
	var renderTargetParameters = { 
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBFormat, 
		stencilBuffer: false 
	};
	
	this.fbo = new THREE.WebGLRenderTarget( renderer.webgl.domElement.width, renderer.webgl.domElement.height, renderTargetParameters );
	
	if ( this.useComposer ) {
	
		this.composer.screenPass.onResized();	
		this.composer.reset( this.fbo );
		
	}
	
};
//     Underscore.js 1.7.0
//     http://underscorejs.org
//     (c) 2009-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    concat           = ArrayProto.concat,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.7.0';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var createCallback = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  _.iteratee = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return createCallback(value, context, argCount);
    if (_.isObject(value)) return _.matches(value);
    return _.property(value);
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    if (obj == null) return obj;
    iteratee = createCallback(iteratee, context);
    var i, length = obj.length;
    if (length === +length) {
      for (i = 0; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    if (obj == null) return [];
    iteratee = _.iteratee(iteratee, context);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length),
        currentKey;
    for (var index = 0; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  var reduceError = 'Reduce of empty array with no initial value';

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = function(obj, iteratee, memo, context) {
    if (obj == null) obj = [];
    iteratee = createCallback(iteratee, context, 4);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        index = 0, currentKey;
    if (arguments.length < 3) {
      if (!length) throw new TypeError(reduceError);
      memo = obj[keys ? keys[index++] : index++];
    }
    for (; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      memo = iteratee(memo, obj[currentKey], currentKey, obj);
    }
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = function(obj, iteratee, memo, context) {
    if (obj == null) obj = [];
    iteratee = createCallback(iteratee, context, 4);
    var keys = obj.length !== + obj.length && _.keys(obj),
        index = (keys || obj).length,
        currentKey;
    if (arguments.length < 3) {
      if (!index) throw new TypeError(reduceError);
      memo = obj[keys ? keys[--index] : --index];
    }
    while (index--) {
      currentKey = keys ? keys[index] : index;
      memo = iteratee(memo, obj[currentKey], currentKey, obj);
    }
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var result;
    predicate = _.iteratee(predicate, context);
    _.some(obj, function(value, index, list) {
      if (predicate(value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    if (obj == null) return results;
    predicate = _.iteratee(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(_.iteratee(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    if (obj == null) return true;
    predicate = _.iteratee(predicate, context);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        index, currentKey;
    for (index = 0; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    if (obj == null) return false;
    predicate = _.iteratee(predicate, context);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        index, currentKey;
    for (index = 0; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    if (obj == null) return false;
    if (obj.length !== +obj.length) obj = _.values(obj);
    return _.indexOf(obj, target) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      return (isFunc ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matches(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matches(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = obj.length === +obj.length ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = _.iteratee(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = obj.length === +obj.length ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = _.iteratee(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = obj && obj.length === +obj.length ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (obj.length !== +obj.length) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = _.iteratee(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = _.iteratee(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = _.iteratee(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = low + high >>> 1;
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (obj.length === +obj.length) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return obj.length === +obj.length ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = _.iteratee(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    if (n < 0) return [];
    return slice.call(array, 0, n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return slice.call(array, Math.max(array.length - n, 0));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, output) {
    if (shallow && _.every(input, _.isArray)) {
      return concat.apply(output, input);
    }
    for (var i = 0, length = input.length; i < length; i++) {
      var value = input[i];
      if (!_.isArray(value) && !_.isArguments(value)) {
        if (!strict) output.push(value);
      } else if (shallow) {
        push.apply(output, value);
      } else {
        flatten(value, shallow, strict, output);
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (array == null) return [];
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = _.iteratee(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = array.length; i < length; i++) {
      var value = array[i];
      if (isSorted) {
        if (!i || seen !== value) result.push(value);
        seen = value;
      } else if (iteratee) {
        var computed = iteratee(value, i, array);
        if (_.indexOf(seen, computed) < 0) {
          seen.push(computed);
          result.push(value);
        }
      } else if (_.indexOf(result, value) < 0) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true, []));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    if (array == null) return [];
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = array.length; i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(slice.call(arguments, 1), true, true, []);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function(array) {
    if (array == null) return [];
    var length = _.max(arguments, 'length').length;
    var results = Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(arguments, i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    if (list == null) return {};
    var result = {};
    for (var i = 0, length = list.length; i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, length = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = isSorted < 0 ? Math.max(0, length + isSorted) : isSorted;
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    for (; i < length; i++) if (array[i] === item) return i;
    return -1;
  };

  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var idx = array.length;
    if (typeof from == 'number') {
      idx = from < 0 ? idx + from + 1 : Math.min(idx, from + 1);
    }
    while (--idx >= 0) if (array[idx] === item) return idx;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Reusable constructor function for prototype setting.
  var Ctor = function(){};

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    var args, bound;
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    args = slice.call(arguments, 2);
    bound = function() {
      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
      Ctor.prototype = func.prototype;
      var self = new Ctor;
      Ctor.prototype = null;
      var result = func.apply(self, args.concat(slice.call(arguments)));
      if (_.isObject(result)) return result;
      return self;
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    return function() {
      var position = 0;
      var args = boundArgs.slice();
      for (var i = 0, length = args.length; i < length; i++) {
        if (args[i] === _) args[i] = arguments[position++];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return func.apply(this, args);
    };
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = hasher ? hasher.apply(this, arguments) : key;
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last > 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed before being called N times.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      } else {
        func = null;
      }
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    if (!_.isObject(obj)) return obj;
    var source, prop;
    for (var i = 1, length = arguments.length; i < length; i++) {
      source = arguments[i];
      for (prop in source) {
        if (hasOwnProperty.call(source, prop)) {
            obj[prop] = source[prop];
        }
      }
    }
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj, iteratee, context) {
    var result = {}, key;
    if (obj == null) return result;
    if (_.isFunction(iteratee)) {
      iteratee = createCallback(iteratee, context);
      for (key in obj) {
        var value = obj[key];
        if (iteratee(value, key, obj)) result[key] = value;
      }
    } else {
      var keys = concat.apply([], slice.call(arguments, 1));
      obj = new Object(obj);
      for (var i = 0, length = keys.length; i < length; i++) {
        key = keys[i];
        if (key in obj) result[key] = obj[key];
      }
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(concat.apply([], slice.call(arguments, 1)), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    if (!_.isObject(obj)) return obj;
    for (var i = 1, length = arguments.length; i < length; i++) {
      var source = arguments[i];
      for (var prop in source) {
        if (obj[prop] === void 0) obj[prop] = source[prop];
      }
    }
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }
    // Objects with different constructors are not equivalent, but `Object`s
    // from different frames are.
    var aCtor = a.constructor, bCtor = b.constructor;
    if (
      aCtor !== bCtor &&
      // Handle Object.create(x) cases
      'constructor' in a && 'constructor' in b &&
      !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
        _.isFunction(bCtor) && bCtor instanceof bCtor)
    ) {
      return false;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size, result;
    // Recursively compare objects and arrays.
    if (className === '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size === b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      size = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      result = _.keys(b).length === size;
      if (result) {
        while (size--) {
          // Deep compare each member
          key = keys[size];
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj) || _.isArguments(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around an IE 11 bug.
  if (typeof /./ !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = function(key) {
    return function(obj) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of `key:value` pairs.
  _.matches = function(attrs) {
    var pairs = _.pairs(attrs), length = pairs.length;
    return function(obj) {
      if (obj == null) return !length;
      obj = new Object(obj);
      for (var i = 0; i < length; i++) {
        var pair = pairs[i], key = pair[0];
        if (pair[1] !== obj[key] || !(key in obj)) return false;
      }
      return true;
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = createCallback(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return void 0;
    var value = object[property];
    return _.isFunction(value) ? object[property]() : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));