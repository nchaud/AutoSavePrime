//todo: consistent open spacing
//license etc.

//All stateless

//TODO: Encapsulate it inside !

var AutoSave = function( rootControls, opts ){

	this.__callbacks;
	this.__theStore;
	this.__getRootControlsFunc; //Never null after init | Function invoked will return an array of top-level controls requested by user
	this.__debounceInterval;
	this.__debounceTimeoutHandle;
	this.__dataStoreKeyFunc; 	//Never null after init
	
	
	
	this.__logSink;	//TODO: How do other libraries do this? allow obj or a single method ? if none, console it?
	//TODO: Also want to use this for notifications in future though ? Events?
	
	
	this._initialise = function( parentElement, opts ) {
	
		opts = opts || {};

		var allowedOpts = [ "dataStore", "autoSaveTrigger", "autoLoadTrigger",	
							"onPreLoad", "onPostLoad", "onPostDeserialize",
							"onPreSerialize", "onPreStore", "onPostStore" ];
		
		try {
			
			this._ensureOptIn( opts, allowedOpts, "top level" );
			
			this.__callbacks = opts;		//TODO: Means it can be dynamic ?? But should be set explicitly for future compatability!
			
			//Sequencing is important here :-
			
			this._updateRootControls( parentElement );
			
			//Do this after updating root controls as we require the names of the top-level forms
			this._updateDataStore( opts.dataStore );
			
			//Do this after updating root controls as we hook need to hook listeners to them
			this._updateAutoSaveStrategy( opts.autoSaveTrigger );
			
			//Load values into controls on start
			this._updateLoadStrategy( opts.autoLoadTrigger );
		}
		catch (e) {
			
			//TODO: Investigate what could remain if this instance is set to null? Will timers fire? etc.
			
			//Clean up listeners, free up keys allocated etc.
			this.dispose();
			
			throw e;
		}
	}
	
	this._updateLoadStrategy = function( autoLoadTrigger ) {
		
		var that = this;
				
		if ( autoLoadTrigger === null ) {
			
			//User does not want to auto-load
			return;
		}
		else if ( autoLoadTrigger === undefined ){
			
			if ( document.readyState == "complete" ){ //TODO: Somehow delay loading to test the looping logic below
				
				that.load();
			}
			else {
				
				//Keep looping until it's ready - compromise between code-size, x-browser compatability
				var loadIntervalHandle = setInterval( function(){
			
					if ( document.readyState == "complete" ){
					
						clearInterval( loadIntervalHandle );
						that.load();
					}
				}, AutoSave.DEFAULT_LOAD_CHECK_INTERVAL );
			}
		}
		else {
			
			throw new Error( "Unexpected type for parameter 'autoLoadtrigger'" );
		}
	}
	
	//Runs a manual save
	this.save = function() {
		
		//if (log.debug) User requested save() but...
		this._executeSave();
	}
	
	//Forces a full load of supplied data
	this.load = function() {
		
		var cb = null; //Callback

		//Load string value from control
		cb = this.__callbacks.onPreLoad;
		
		if ( cb ) {
			
			var rawUserInput = cb();
		
			//See @FUN Semantics
			if (rawUserInput === false) {
				
				return; //Cancel the load
			}
			else if (rawUserInput === undefined) { 
				
				//Do nothing - continue with the load
			}
			else  //Assume it's a custom override
			{
				//We already have the data, run callback
				this._loadCallbackHandler( rawUserInput );
				
				return;
			}
		}
		
		//May execute asynchronously - e.g. fetching from service
		this.__theStore.load( this._loadCallbackHandler.bind( this ) );
	}
	
	this._loadCallbackHandler = function( szData ) {
	
		cb = this.__callbacks.onPostLoad;
		
		if ( cb ) {
			
			var rawUserInput = cb( szData );
		
			//See @FUN Semantics
			if (rawUserInput === false) {
				
				return; //Cancel the load
			}
			else if (rawUserInput === undefined) { 
				
				//Do nothing - continue with the load
			}
			else  //Assume it's a custom override - even if null
			{
				szData = rawUserInput;
			}
		}
		
		this.deserialize( szData );

		cb = this.__callbacks.onPostDeserialize;
		if ( cb )
			cb();
	}
	
	this._executeSave = function() {
		
		var cb = null; //Callback
		
		//Get controls to serialize - guaranteed to be an array
		var controlsArr = this.__getRootControlsFunc();
		
		//Serialize all control values
		cb = this.__callbacks.onPreSerialize;
		
		if ( cb ) {
			
			var rawUserInput = cb( controlsArr );

			//See @FUN Semantics
			if (rawUserInput === false) {
				
				return; //Cancel the save
			}
			else if (rawUserInput === undefined) { 
			
				//Do nothing - continue with the save
			}
			else if (rawUserInput === null) { //User override
			
				//Treat as empty - blank out user controls
				controlsArr = [];
			}
			else {
			
				//Expect a valid definition of controls
				controlsArr = this._getControlsFromUserInput( rawUserInput );
			}
		}
		
		var szData = this.serialize( controlsArr );
		
		//Mould it to output-specific format before passing it to onPreStore hook
		//So, for example, cookies can be modified
		szData = this.__theStore.mouldForOutput( szData );
		
		//Hook before saving to store
		cb = this.__callbacks.onPreStore;

		if ( cb ) {
			
			var rawUserInput = cb( szData );
			
			//See @FUN Semantics
			if (rawUserInput === false) {
				
				return; //Cancel the save
			}
			else if (rawUserInput === undefined) { 
			
				//Do nothing - continue with the save
			}
			else { 
			
				//User input is a valid override string - null implies clearing out local storage
				szData = rawUserInput;
			}
		}
		
		this.__theStore.save( szData, this._onSaveCompleted.bind(this) );
	}

	this._onSaveCompleted = function() {

		//Inspection hook for what was sent - should be invoked asychronously after return from store
		var callback = this.__callbacks.onPostStore;
		
		if ( callback ){
			
			callback();
		}		
	}
	
	//TODO: All hooks should be proper events and listenable to via 'addEventListener' etc. (?)

	//Parameter should NOT be falsy here - should be handled beforehand by caller based on context
	//Always returns a non-null array
	this._getControlsFromUserInput = function( rawUserInput ){
		
		var elems;
		
		if (typeof ( rawUserInput ) == "string") {//selector
		
			var elemsNodeList = document.querySelectorAll( rawUserInput );
			elems = Array.from( elemsNodeList ); //TODO: NOT SUPPORTED IN IE. Remove from here and all others
		}
		else if ( rawUserInput.length !== undefined ) { 
		
			//Note: This also works for instanceof jQuery. TODO: Ensure doesn't accidentally work on controls like CKEditor
			
			elems = this._tryConvertToArray( rawUserInput ); //TODO: Is 'this' bound correctly here to work?
			
			if( !elems ) {
				
				throw new Error( "Supplied array-like parent couldn't be converted to an array of elements" );
			}
		}
		else { //It's a single control - TODO: Check this .isDOMElement? (should work even if detached)
		
			elems = [ rawUserInput ];
		}

		return elems;
	}
	
	this._getKeyFunc = function( parentElems, rawUserOption ){
		
		//User-supplied option takes precedence - we dont validate uniqueness etc. but trust what they're doing
		if ( rawUserOption !== undefined ){
		
			if ( typeof rawUserOption == "string" ){
				
				var fullKey = AutoSave.DEFAULT_KEY_PREFIX + rawUserOption;
				
				return function(){
					
					return fullKey;
				}
			}
			else if ( typeof rawUserOption === "function" ){
				
				return function(){
					
					//Dynamically recalc every time
					return AutoSave.DEFAULT_KEY_PREFIX + rawUserOption();
				}
			}
			else{
				
				throw new Error("Unexpected type of parameter 'dataStore.key'");
			}
		}
		else {
			
			var keyValue = null;
			
			//If form supplied as the parameter
			if ( parentElems.nodeName == "FORM" ){
				
				keyValue = parentElems.name;
			}
			else if ( parentElems.length == 1 && //If form supplied as the only parameter in a jQuery or [], use that
					  parentElems[0].nodeName == "FORM" ){
				
				keyValue = parentElems[0].name;
			}
			
			//Non-form element or form without name, default the key
			if ( keyValue ){
				
				keyValue = AutoSave.DEFAULT_KEY_PREFIX + keyValue;
			}
			else{
				
				keyValue = AutoSave.DEFAULT_KEY_PREFIX;
			}
			
			if ( AutoSave.__keysInUse.indexOf(keyValue) != -1 ){
				
				throw new Error("There is already an AutoSave instance with the storage key of '"+keyValue+"'. See the documentation for solutions.")
			}
			
			AutoSave.__keysInUse.push(keyValue);
			
			return function(){
				
				return keyValue;
			}
		}
	}
	
	//This function sets up where to save the data
	this._updateDataStore = function( dataStore ){
		
		var hasLocalStorage = AutoSave.isLocalStorageAvailable();
		
		var elems = this.__getRootControlsFunc();
		
		this.__dataStoreKeyFunc = this._getKeyFunc( elems, !dataStore ? undefined : dataStore.key );
			
		//If not set at all, default it 
		if ( dataStore === undefined ){
			
			if ( !hasLocalStorage )
				this.__theStore = new _CookieStore( this.__dataStoreKeyFunc );
			else
				this.__theStore = new _LocalStore( this.__dataStoreKeyFunc );

		}
		//If expicitly null, don't load or store anywhere
		else if (dataStore === null){

			//Do nothing
			this.__theStore = new _NoStore();
		}
		else if (typeof(dataStore) == "object"){ // Url-based / custom
			
			//TODO: cookieOptions here? OR check if user specified an expiry time - if not, then make it infinite.
			
			var allowedOpts = [ "save", "load", "key", "preferCookies" ];
			
			this._ensureOptIn( dataStore, allowedOpts, "dataStore" );

			var storeToCookies = dataStore.preferCookies === true || !hasLocalStorage;
			
			//TODO: Raise error if cookies not supported (DEMO: How to ask user to enable cookies)
			
			if (dataStore.load === undefined && dataStore.save === undefined) {
				
				//Unset by user - use default
				if (storeToCookies)
					this.__theStore = new _CookieStore( this.__dataStoreKeyFunc );
				else
					this.__theStore = new _LocalStore( this.__dataStoreKeyFunc );
			}
			else if (dataStore.load === null && dataStore.save === null) {
				
				//User explicitly does not want to load from anywhere
				this.__theStore = new _NoStore();
			}
			else if (typeof dataStore.load != "function" || typeof dataStore.save != "function") {
				
				throw new Error("The dataStore.load and dataStore.save parameters must 1) both be set or both be unset and 2) must be functions.");
			}
			else {
				
				this.__theStore = new _CustomStore( this.__dataStoreKeyFunc, dataStore.save, dataStore.load );
			}
				
			//TODO: URL OPTIONS ; POST/GET, headers etc. - GET is default and UPDATE is custom maybe
		}
		else {
			
			throw new Error( "Unexpected type of parameter 'dataStore'");
		}
	}
	
		
	//This function sets up when to save the state
	this._updateAutoSaveStrategy = function(saveTrigger){
					
		//TODO: Dispose existing ones
		
		if (saveTrigger === null){
			
			//Only when invoked - i.e. do nothing
			return;
		}
		else if (saveTrigger === undefined) {

			this.__debounceInterval = AutoSave.DEFAULT_DEBOUNCE_INTERVAL;
		}
		else if (typeof(saveTrigger) == "object") {

			var allowedOpts = [ "debounceInterval" ];
			
			this._ensureOptIn( saveTrigger, allowedOpts, "autoSaveTrigger" );
		
			//At regular intervals in milliseconds
			var debounceInterval = saveTrigger.debounceInterval;
			
			if (typeof debounceInterval == "number") {
			
				if (debounceInterval < 50){ //Must be a mistake
				
					throw new Error( "The 'debounceInterval' must be specified in milliseconds" );
				}
				else {
					
					this.__debounceInterval = debounceInterval;
				}
			}
			else{
				
				throw new Error( "Unexpected non-numeric type for parameter 'debounceInterval'" );
			}
		}	
		else{
		
			throw new Error( "Unexpected type for parameter 'autoSaveTrigger'");
		}
			
		//Default strategy - on control leave, select change etc.
		this._hookListeners(true);
	}

	this._updateRootControls = function( parentElement ) {
	
		if ( !parentElement ) { //Both undefined (so they neednt specify) and null (so they can skip over to set opts)
		
			debug("No parentElement parameter specified - will check whole document for changes")
			parentElement = document.body;	//TODO: Will this capture all? In Node too?
		}
		
		if ( typeof ( parentElement ) == "function" ){
		
			//Customise the set of controls used - calculated dynamically from user's function
			//TODO: What about un-hooking/re-hooking listeners when this set changes?
			this.__getRootControlsFunc = function() {
			
				var rawUserInput = parentElement();	//TODO: Context in which this is invoked?
				
				if (!rawUserInput){
					
					return []; //Always standardise to an array
				}
				else{
					
					var elemsArr = this._getControlsFromUserInput( rawUserInput );
					return elemsArr;
				}
			};
		}
		else {
		
			//Static - so calculate it just once beforehand and return the same set every time

			
			//TODO: What if like $(":input") and input added late?

			//TODO: Example with loading and unloading of HTML content / dynamic content - e.g. flicking through tabs. jQuery UI tabs?
			
			
			var elems = this._getControlsFromUserInput( parentElement );
			
			//Validation - TODO: Test if something an array and not a jQuery array or dom-like ?
			//If user-supplied parameter didn't resolve to any elements, throw, as there will be nothing to listen to.
			//Except if explicitly specified an empty [] so continue 
			if ( !Array.isArray(parentElement) && elems.length == 0){
				
				throw new Error("'rootControls' parameter resolved to zero elements - maybe your selector(s) werent right?");
			}
			
			this.__getRootControlsFunc = function() {
			
				return elems;
			};
		}
	}

	
	this._hookListeners = function(hookOn){ //TODO: If controls have changed since hook on was called - through user func etc.

		//controlsArr is never null by post-condition of _updateRootControls
		var controlsArr = this.__getRootControlsFunc();

		//Let browser know we only listen passively
		//TODO: Test: If control change triggers another? Should be captured by timeout
		var listenOpts = {passive:true, capture:true};
		
		//TODO: Support for options object? - https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
		for(var ctrlIdx=0; ctrlIdx<controlsArr.length; ctrlIdx++){
			
			var child = controlsArr[ctrlIdx];
			//TODO: These are only user-initiated changes - what about programmatic/code changes?			
			
			// var eventName = null;
			// if (child.nodeName == "INPUT"){
			
				// //Due to browser support / 'historic reasons', we switch to change event here
			    // if (child.type == "radio" || child.type == "checkbox") {

					// eventName = "change";
				// }
				// else {
					
					// eventName = "input";
				// }
			// }
			// else {
				
				// eventName = "change";
			// }
				
			// console.log(">>hooking into ", child, eventName)
				
			
			if (hookOn) {
				
				//'change' event is primarily for checkboxes and radios for browsers - 'historical reasons'
				//But we can hook both as we'll debounce changes anyway
				child.addEventListener( "input",  this, listenOpts );
				child.addEventListener( "change", this, listenOpts );
			}
			else {
				
				child.removeEventListener( "input",  this, listenOpts );
				child.removeEventListener( "chnage", this, listenOpts );
			}
			//TODO: What about whilst typing? Neither of these will fire...
			
		}
	}
		
	this.handleEvent = function(ev){
		
		//Pseudocode
		//	- If a timer exists, ignore (OR calc delta based on inputs rather than going through all to find deltas?)
		//	- Else kick off a timer
		//		- If another event is triggered before timer elapses, reset timer
		//		- We keep resetting the timer until MAX interval has elapsed, in which case we stop resetting it
		//		- On timer elapse, reset the event
		
		//console.log(">>Handling event", ev, this);
		
		//If already have a timer running, return
		if (this.__debounceTimeoutHandle){
			
			return;
		}
				
		this.__debounceTimeoutHandle = setTimeout( this._handleDebouncedEvent.bind( this ), this.__debounceInterval );
	}
	
	this._handleDebouncedEvent = function() {
		
		this.__debounceTimeoutHandle = null;
		
		//console.log(">>DEBOUNCED", this)
		
		this._executeSave();
	}
	
	this.dispose = function( deleteDataStore ) {
		
		//Detach listeners
		try {
			
			this._hookListeners( false );
		}
		catch(e){
			
			warn("Error unhooking listeners", e);
		}

		//Free this key to be re-used by another AutoSave instance
		try {
			
			if ( this.__dataStoreKeyFunc ) {
				
				var key = this.__dataStoreKeyFunc();
				var keyIdx = AutoSave.__keysInUse.indexOf(key);
				
				if (keyIdx != -1){
					
					AutoSave.__keysInUse.splice( keyIdx, 1 );
				}
			}
		}
		catch(e){
			
			warn("Error freeing key", e);
		}

		
		if ( this.__debounceTimeoutHandle ) {
			
			clearTimeout( this.__debounceTimeoutHandle );
			this.__debounceTimeoutHandle = null;
		}
		
		//We don't clear the store by default
		try {

			if ( deleteDataStore === true ){
				
				this.resetStore();
			}
		}
		catch(e){
			
			warn("Error resettting all stores", e);
		}
	}
	
	this.resetStore = function() {
		
		//TODO - add test with public API.
		//TODO - add test that ONLY THIS object gets disposed !
		//TODO - add static method that clears all storage?
		//TODO - Out of cookies storage strategy ?
		
		var clearCallback = function(){};
		
		this.__theStore.resetStore( clearCallback );
	}
	
	this._deserializeSingleControl = function( child, fieldData ){

		var fieldValue = null;
		
		var runStd = false;
		
		if (child.nodeName == "INPUT"){
		
		   if (child.type == "radio" || child.type == "checkbox") {

				//For these, we need to check not only that the names exists but the value corresponds to this element
				for (var fieldIdx = 0 ; fieldIdx < fieldData.length ; ++fieldIdx) {
				
					var fieldValue = fieldData[fieldIdx][child.name];
					
					if (fieldValue == child.value) {
					
						child.checked = true;
						break;
					}
				}
			}
			else {
				runStd = true;
			}
		}
		else if (child.nodeName == "SELECT") {
		
			if (child.type == "select-one") {
			
				runStd = true;
			}
			else { //Implicitly select-multiple
			
				var sChildren = child.options;
				
				for (var childIdx = 0; childIdx < sChildren.length; ++childIdx){	//TODO: NOT optimal - inner looping 
					
					var opt = sChildren[childIdx];
					
					for (var fieldIdx = 0 ; fieldIdx < fieldData.length ; ++fieldIdx) {
					
						var fieldValue = fieldData[fieldIdx][child.name];
						
						if (fieldValue == opt.value) {
						
							opt.selected = true;
							break;
						}
					}						
				}
			}
		}
		else if (child.nodeName == "TEXTAREA") { //All other :inputs types - textarea, HTMLSelect etc.

			runStd = true;
		}
		
		//TODO: Button, Std etc.
		
		
		else {
									
			//May be, e.g., a form or div so go through all children
			var sChildren = child.children;
			for( var sIdx = 0 ; sIdx < sChildren.length ; sIdx++ ){
				
				this._deserializeSingleControl( sChildren[ sIdx ], fieldData );
			}
		}
		
		if (runStd) {
			
			for (var fieldIdx = 0 ; fieldIdx < fieldData.length ; ++fieldIdx ) {
			
				var fieldValue = fieldData[fieldIdx][child.name];
		
				if (fieldValue)
					child.value = fieldValue;
			}
		}	
	}
	
	//TODO: Make this static?
	this.deserialize = function( fieldDataStr ){
		
		if ( !fieldDataStr )
			return; //Nothing to do
			
		//Find all children
		//controlsArr is never null by post-condition of _updateRootControls
		var controlsArr = this.__getRootControlsFunc();
		
		var fieldData = AutoSave._decodeFieldDataFromString( fieldDataStr );
		
		//Multiple values for one non-multi-select input?
		//sort first?
		//TODO: Multiple radio groups with same name
		//Warn on serializing?
		
		for(var idx=0;idx<controlsArr.length;++idx) {

			var child = controlsArr[ idx ];
			
			this._deserializeSingleControl( child, fieldData );
		}
	}
	
	
	//Looks at a single control and it's children and returns an array of serialised object strings
	this._serializeSingleControl = function( child, fieldData ){
	
		var nameKey = child.name;
		var value = child.value;
		
		var obj = {};
		obj[ nameKey ] = value;	//TODO: just one object type @ V8. OR 2 arrays? what's faster?

		//TODO: Don't create this object  until we actually reach an input !! Wasteful...
			
			
		if ( child.nodeName == "INPUT" ) {
		
			//We only serialise controls with names (else we'll get, e.g., '=Oscar&=Mozart')
			if ( !nameKey ) {
				
				debug("Ignored INPUT node as no name was present", child);
				return;
			}
			
		   if ( child.type == "radio" || child.type == "checkbox" ){
			
				if ( child.checked ) {
					
					//warn_if(!!fieldData[child.name] && child.name==, 
					//    "You have multiple checked radio inputs with the same name. \
					//     Only the last will be taken");
					
					fieldData.push( obj )//] += child.value;
				}
			}
			else{ //Implicitly an <input type=text|button|password|hidden...>
			
				fieldData.push( obj );
			}
		}
		else if ( child.nodeName == "SELECT" ){
		
			//We only serialise controls with names (else we'll get, e.g., '=Oscar&=Mozart')
			if ( !nameKey ) {
				
				debug("Ignored SELECT node as no name was present", child);
				return;
			}
		
			if ( child.type == "select-one" ){
			
				fieldData.push(obj);
			}
			else { //Must be of type == 'select-multiple'
			
				var sChildren = child.options;
				for( var sIdx = 0 ; sIdx < sChildren.length ; ++sIdx ){
				
					if ( sChildren[sIdx].selected ) {
					
						var sObj = {};	//TODO: re-use obj from above
						sObj[ nameKey ] = sChildren[ sIdx ].value;
						fieldData.push( sObj );
					}
				}
			}
		}
		else if ( child.nodeName == "TEXTAREA" ) {
		
			//We only serialise controls with names (else we'll get, e.g., '=Oscar&=Mozart')
			if ( !nameKey ) {
				
				debug("Ignored TEXTAREA node as no name was present", child);
				return;
			}
		
			fieldData.push( obj );
		}
		
		
		//TODO: Button,  etc.
		
		
		else{
		
			//May be, e.g., a form or div so go through all children
			var sChildren = child.children;
			for( var sIdx = 0 ; sIdx < sChildren.length ; sIdx++ ){
				
				this._serializeSingleControl( sChildren[ sIdx ], fieldData );
			}
		}
	}
	
	//TODO: Make this static?
	//	For any forms in this set, find any forms (Phase II)
	//		Find all controls associated to these forms globally
	
	//Returns the serialized string in the standard format(?) - 
	//Must return a string instance - even if empty - as callback hooks assume it
	this.serialize = function(rootControlsArr){
		
		var fieldData = [];	//TODO: Make it a [ [,], [,]] where first element is keys, second is values
		
		for(var idx=0;idx<rootControlsArr.length;++idx) {
		
			this._serializeSingleControl(rootControlsArr[idx], fieldData);
		}
		
		var fieldDataStr = AutoSave._encodeFieldDataToString( fieldData );
		
		//TODO: Put in sort order for efficient search afterwards?
		return fieldDataStr;
	}
	
	
	//TODO: setOpt("", "...") for dynamic parameter modification - just pass in a modified options object as before? What if callbacks REMOVED?
	
	

	//
	//Some Default functions
	//
	this._noOp = function(){}
	this._noOpCallback1 = function(cb){cb();} 	//Callback parameter @Arg1
	this._noOpCallback2 = function(_,cb){cb();} //Callback parameter @Arg2
	

	
	//optObj must not be null
	this._ensureOptIn = function( optObj, allowedValues, optDesc ){
		
		//Only verify level of options, not base members
		var optKeys = Object.keys( optObj ); //todo: will this get parent values if inherited object? x-browser support?
		
		for( var idx in optKeys ) {
			
			 var optKey = optKeys[ idx ];

			 if ( allowedValues.indexOf( optKey ) == -1 ) {
				
				  throw new Error( "Unexpected parameter '" + optKey + "' in " + optDesc + " options object");
			 }
		}
	}
	
	this._tryConvertToArray = function( obj ){
	
		//Checks if it's an array of array-like object and returns the array if so
		//TODO: Should check if it's an Array or array-like and hence iterable etc.
		if ( Object.hasOwnProperty("length") )
			return obj;
		else
			return null;
	}
	
	function warn_if( shouldWarn, __variadic_hint__ ){
		
		if ( shouldWarn )
			console.warn( arguments ); //TOOD: splice first arg
	}
	
	function warn(__variadic_hint__){
		console.warn(arguments);
	}
	
	function error(__variadic_hint__){
		console.error(arguments);
	}
	
	function debug(__variadic_hint__){
		console.log(arguments);
	}

	//Helper function incase user forgets to return our data from a callback
	//If they really want to clear out a value, they can pass null
	this._ifUndef = function(retValue, originalValue){
	
		if  (retValue === undefined)
			return originalValue;
		else
			return retValue;
	}

	

	/* Additional 'classes'  - TODO: Best way whilst encapsulating ?*/
	var _CookieStore = function( keyFunc ){
		
		if ( !navigator.cookieEnabled ){
			
			warn("Cookie Store requested but cookies not enabled.");
		}

		this.__currStoreKeyFunc = keyFunc;
		
		this.load = function( loadCompleted ){
			
			//AutoSaveJS-specific prefix
			//If wasn't previously saved and is null, continue loading so all hooks get invoked
			var key = this.__currStoreKeyFunc();
			
			//From MDN
			var regex = new RegExp("(?:(?:^|.*;)\\s*" + 
					   encodeURIComponent(key).replace(/[\-\.\+\*]/g, "\\$&") + 
					   "\\s*\\=\\s*([^;]*).*$)|^.*$");
			
			var ct = document.cookie.replace( regex, "$1" );
			
			var szString = ct || null;
			
			loadCompleted( szString );
		}

		//TODO: error handling for callbacks? invoke with an Error object / string ?

		this.save = function ( data, saveCompleted ){
			
			var key = this.__currStoreKeyFunc();
			
			//Could be specified in the preStoreHook or the resetStore() to clear it out
			if ( data === null ){
				
				data = AutoSave._buildFullCookieStr( key, "", { expireNow: true});
			}
				
			//We know data has been moulded to a cookie format already so save straight down
			document.cookie = data;
			
			saveCompleted( );		
		}
		
		this.mouldForOutput = function( data ) {
			
			var key = this.__currStoreKeyFunc();

			var cookieParamsStr = AutoSave._buildFullCookieStr( key, data, { neverExpire: true});
			
			debug( "Created cookie params string: " + cookieParamsStr );
			
			return cookieParamsStr;
		}
		
		this.resetStore = function( clearCompleted ){
			
			return this.save( null, clearCompleted );
		}
	}

	var _LocalStore = function( keyFunc ){
		
		this.__currStoreKeyFunc = keyFunc;
		
		this.load = function ( loadCompleted ){

			var key = this.__currStoreKeyFunc();

			var data = localStorage.getItem( key );
			
			loadCompleted( data );
		}
		
		this.save = function ( data, saveCompleted ) {

			//AutoSaveJS-specific prefix
			var key = this.__currStoreKeyFunc();

			if ( !key ){
				
				throw new Error( "No key specified for saving to local storage" );
			}
			
			//Could be specified in the preStoreHook or the resetStore() to clear it out
			if ( data === null ){
				
				localStorage.removeItem( key );
			}
			else {
				
				localStorage.setItem( key, data );
			}
			
			saveCompleted( );
			
			//TODO: ** Clear cookie when page saved so doesn't auto-populate next time - if using cookies/local storage instead of ajax! **
		}
	
		this.mouldForOutput = function( data ){
			
			return data;
		}
		
		this.resetStore = function( clearCompleted ){
			
			return this.save( null, clearCompleted );
		}
	}

	var _NoStore = function( ){
		
		this.load = function ( loadCompleted ){
			
			loadCompleted( null );
		}
		
		this.save = function ( data, saveCompleted ){
			
			saveCompleted();
		}
	
		this.mouldForOutput = function( data ){
			
			return data;
		}
		
		this.resetStore = function(){
			
			//No-op
		}
	}
	
	//Assumes save and load parameters are valid functions
	var _CustomStore = function( keyFunc, userSaveFunc, userLoadFunc ){
		
		if ( userLoadFunc.length != 2 ) {
			
			throw new Error("dataStore.load function must take 2 parameters.");
		}
		
		if ( userSaveFunc.length != 3 ) {
			
			throw new Error("dataStore.save function must take 3 parameters.");
		}

		this.__currStoreKeyFunc = keyFunc;
		this.__userLoadFunc = userLoadFunc;
		this.__userSaveFunc = userSaveFunc;
				
		this.load = function ( loadCompleted ){

			var key = this.__currStoreKeyFunc();
			
			return this.__userLoadFunc( key, loadCompleted );
		}
		
		this.save = function ( data, saveCompleted ) {

			//AutoSaveJS-specific prefix
			var key = this.__currStoreKeyFunc();

			return this.__userSaveFunc( key, data, saveCompleted );
		}
	
		this.mouldForOutput = function( data ){
			
			return data;
		}
		
		this.resetStore = function( clearCompleted ){
			
			return this.save( null, clearCompleted );
		}
	}
	
	this._initialise(rootControls, opts);
};

AutoSave._encodeFieldDataToString = function _encodeFieldDataToString(fieldData){
		
	var fieldDataStr = "";
	for(var fieldIdx=0;fieldIdx<fieldData.length;++fieldIdx){
		
		var obj = fieldData[fieldIdx];
		var props = Object.getOwnPropertyNames(obj);
		
		if(props.length != 1)
			console.warn("Expected exactly 1 entry in "+obj); //KILL this after we switch to dual-array based impl. Also, warn()?
			
		fieldDataStr += encodeURIComponent(props[0])+"="+encodeURIComponent(obj[props[0]]);
		
		if (fieldIdx != fieldData.length-1)
			fieldDataStr += "&";

	}

	//Convert %20 to + as per x-www-form-urlencoded protocol
	//TODO: Sub optimal?
	var prev = null;
	var curr = fieldDataStr;
	do{
		prev = curr;
		curr = prev.replace("%20","+");
	}while(curr != prev)
	
	fieldDataStr = curr;

	return fieldDataStr;
}

//TODO: clear up all whitespace in file

AutoSave._decodeFieldDataFromString = function _decodeFieldDataFromString( fieldDataStr ){
	
	//Convert + back to %20 as per x-www-form-urlencoded protocol
	//TODO: Sub optimal? Regex !
	var prev = null;
	var curr = fieldDataStr;
	do{
		prev = curr;
		curr = prev.replace("+","%20");
	}while(curr != prev)
	
	fieldDataStr = curr;
	
	//Reconstruct a field data object from the string
	var fieldData = [];
	var pairs = fieldDataStr.split("&");
	for(var pairIdx in pairs){
		
		var pair = pairs[pairIdx];
		var items = pair.split("=");
		
		if (items.length != 2) {
			
			console.warn("Expected a pair of items separated by '=' in "+pair+". Got "+items.length+". Ignoring...")
		}
		else{
			
			var obj = {};
			var key = decodeURIComponent(items[0]);
			var value = decodeURIComponent(items[1]);
			obj[key] = value;
			fieldData.push(obj);
		}
	}
		
	return fieldData;
}


//TODO: AutoSaveJS should also use this method
AutoSave.addSerialisedValue = function addSerialisedValue( szString, key, value ){
	
	if (!key) {
		
		throw new Error("No key specified");
	}
	
	if (value === null || value === undefined) { //Preserve 0 in output string 
		
		value = "";
	}
	
	if (!szString) {
		
		szString = ""; //Initialise if required
	}
		
	if (szString.length) {
		
		szString += "&";
	}
	
	var obj = {};
	obj[key]=value;
	var encoded = AutoSave._encodeFieldDataToString([obj]);
	
	szString += encoded;
	
	return szString;
}


//Will ALWAYS return a non-null array
AutoSave.getSerialisedValues = function getSerialisedValues(szString, key){
	
	if (!key) {
		
		throw new Error("No key specified");
	}
	
	if (!szString) {
		
		return [];
	}

	var decoded = AutoSave._decodeFieldDataFromString(szString);
	
	var ret = [];
	for(var i in decoded) {

		var obj = decoded[i];
		
		if ( obj.hasOwnProperty(key) ) { //TODO: INHERITED ONES? Keys?
			
			ret.push( obj[key] );
		}
	}

	return ret;
}

//From MDN - @https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API#Feature-detecting_localStorage
//Even though local storage is supported in browsers AutoSaveJS supports, still need to check for Safari
AutoSave.isLocalStorageAvailable = function isLocalStorageAvailable() {
	
	if ( AutoSave.__cachedLocalStorageAvailable === undefined) {
	
		try {
			
			var storage = window['localStorage'];
			var x = '__ASJS_test__';
			storage.setItem(x, "_");
			storage.removeItem(x);
			
			AutoSave.__cachedLocalStorageAvailable = true;
		}
		catch(e) {
			
			AutoSave.__cachedLocalStorageAvailable =
				(
				e instanceof DOMException && (
				// everything except Firefox
				e.code === 22 ||
				// Firefox
				e.code === 1014 ||
				// test name field too, because code might not be present
				// everything except Firefox
				e.name === 'QuotaExceededError' ||
				// Firefox
				e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
				// acknowledge QuotaExceededError only if there's something already stored
				storage.length !== 0) ;
		}
	}
	
	return AutoSave.__cachedLocalStorageAvailable;
}

//Stateless helper
AutoSave._buildFullCookieStr = function( key, data, opts ) {
	
	if ( !key ){
		
		throw new Error("No key specified for saving to cookie");
	}
	
	//This regex is from MDN - @https://developer.mozilla.org/en-US/docs/Web/API/Document/cookie/Simple_document.cookie_framework
	if ( /^(?:expires|max\-age|path|domain|secure)$/i.test( key ) ) {

		throw new Error( "Parameters to cookie must not be specified as part of the key (e.g. path=, domain= etc.)" );
	}
	
	opts = opts || {};
	
	var never = opts.neverExpire;
	var now = opts.expireNow;

	var encodedKey = encodeURIComponent( key );
	var cookieParamsStr = encodedKey + "=" + data + "; ";
	
	//Never expires
	if ( never )
		cookieParamsStr += "expires=Fri, 31 Dec 9999 23:59:59 GMT; ";
	else if ( now )
		cookieParamsStr += "expires=Sat, 23 Mar 1889 23:59:59 GMT; ";
	
	return cookieParamsStr;
}

//Clears AutoSaveJS state from all data stores
AutoSave.resetAll = function(){
	
	//TODO: Unhook listeners too?
	
	//Remove reserved keys
	AutoSave._keysInUse = [];
	
	
	//Remove all items -- TODO: Unit Test
	
		
	//Iterate and remove all AutoSaveJS local storage
	if ( AutoSave.isLocalStorageAvailable() ) {
		
		for (var i = localStorage.length - 1; i >= 0; i--) {
			
			var key = localStorage.key(i);
			
			if (key && key.indexOf(AutoSave.DEFAULT_KEY_PREFIX) === 0){
				
				localStorage.removeItem(key);
			}
		}
	}
	
	//Iterate and delete all AutoSaveJS cookies - regex from MDN
	var aKeys = document.cookie.replace(/((?:^|\s*;)[^\=]+)(?=;|$)|^\s*|\s*(?:\=[^;]*)?(?:\1|$)/g, "").split(/\s*(?:\=[^;]*)?;\s*/);
	
	for (var nIdx = 0; nIdx < aKeys.length; nIdx++) { 
	
		var key = decodeURIComponent(aKeys[nIdx]);
		
		if (key.indexOf(AutoSave.DEFAULT_KEY_PREFIX) === 0) {
			
			var str = AutoSave._buildFullCookieStr( key, "", { expireNow: true});
			
			document.cookie = str;
		}
	}
}




//todo: be consistent wrt usage of null vs constants, sample code shouldnt break on upgrades from null to constant parameters
AutoSave.DEFAULT_LOAD_CHECK_INTERVAL = 100;    //Every 100 seconds, check if it's loaded
AutoSave.DEFAULT_DEBOUNCE_INTERVAL   = 3*1000; //By default, autosave every 3 seconds
AutoSave.DEFAULT_KEY_PREFIX = "AutoSaveJS_";
AutoSave.__keysInUse = [];
AutoSave.__cachedLocalStorageAvailable;
AutoSave.Version = "1.0.0";
