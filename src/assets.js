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
			(Array) info.other - array of urls to load, and invoke custom handler on (see docs)
			(Array) info.custom - array of urls to invoke custom loading with (see docs)
			
			(Function) info.progress(percent) - function called after each file is loaded
			(Function) info.done - function called after all assets have been loaded

*/

	this.loadAssets = function ( params, onLoaded ) {
	
		this.textures = params.textures ? params.textures : [];
		this.scenedata = params.scenes ? params.scenes : [];
		this.models = params.assets ? params.assets : [];
		this.json = params.json ? params.json : [];
		this.custom = params.custom ? params.custom : [];
		this.other = params.other ? params.other : [];
		this.onprogress = params.progress;
		this.onloaded = params.done;
		
		this.totalLoaded = 0;
		this.totalAssets = this.textures.length + this.scenedata.length + this.models.length + this.json.length + this.custom.length + this.other.length;
		
		// custom
		for ( var i = 0; i < this.custom.length; i++ ) {
		
			var cust = this.custom[ i ];
			var reqObj = function ( cust ) {
			
				return function () {
				
					if ( !cust[ 'start' ] ) throw "Assets custom loading object - .start( obj, callOnDone ) function not specified.";
					
					cust.start( cust, assets.assetLoaded );
					
				};
				
			}( cust );
			this.loadQueue.push( reqObj );
			
		}
		
		// other
		for ( var i = 0; i < this.other.length; i++ ) {
		
			var obj = this.other[ i ];
			var url, parse = null;
			
			if ( typeof( obj ) == 'object' ) { 
				
				if ( obj.url && obj.parse ) throw "Assets other loading object - .url and .parse are required.";
				
				url = obj.url;
				parse = obj.parse;
				
			} else {
				
				url = obj;
				
			}
			
			var reqObj = function ( url, parse ) {
			
				return function () {
				
					var request = new XMLHttpRequest();
					request.open( 'GET', url, true );
					request.onload = function () {
						if ( request.status >= 200 && request.status < 400 ) {
						
							var data = request.responseText;
							
							if ( parse ) data = parse( data );

							assets.add( url, data );
								
							assets.assetLoaded();
							
						} else console.error( "Failed to load " + url );
						
					};
									
					request.onerror = function () {
					
						console.error( "Connection error while loading " + url );
						
					};
					
					request.send();	
					
				};
				
			}( url, parse );
			this.loadQueue.push( reqObj );
			
		}
		
		// textures
		for ( var i = 0; i < this.textures.length; i++ ) {
		
			var url = this.textures[ i ];
			var reqObj = function ( url ) {
			
				return function () {
				
					assets.add( url, new THREE.ImageUtils.loadTexture(url, undefined, assets.assetLoaded ) );
					
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
								
								assets.add( json.name, json );
								
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
							var data = request.responseText;
							
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
								assets.add( json.name, json );
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
							var data = request.responseText;
							
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
								
								assets.add( url, json );
								
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
	
		for ( var key in this.files ){
		
			var a = this.files[ key ];
			
			// PixelBox
			if ( a.frameData || a.frames ) {
				
				THREE.PixelBox.prototype.dispose( a );
				
			} else if ( a instanceof THREE.Texture ) {
			
				a.dispose();
				
			}
			
		}
		
		this.clear();
		console.log( "All assets unloaded" );
		
	};
	
	this.totalLoaded = 0;
	this.totalAssets = 0;
	this.loadQueue = [];
	
	this.objectLoader = new THREE.JSONLoader();
	
	THREE.Cache.call(this);
	
}

THREE.PixelBoxAssets.prototype = Object.create( THREE.Cache.prototype );
THREE.PixelBoxAssets.prototype.constructor = THREE.PixelBoxAssets;

var assets = new THREE.PixelBoxAssets();
