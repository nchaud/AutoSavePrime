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
	this.__onInitialiseInvoked;
	this.__invokeExtBound;
	
	// this.__onWarnNoStorageFunc;
	
	this.__clearEmptyValuesOnLoad; //When keys dont have a value in the data store (e.g....&name=&...), clear out those elements on load
			//TODO: On reconnect with internet, it'll kick off a reload? Could trash all the users changes !!
			//		If new fields are added in the meantime, should be handled fine as ignored
			//		If value cleared out server-side though, should clear out client-side? Or with other users' machines?
			//		Plus provides for useful "reset" ability
			//		TODO: Demo with above reset 
			//		Workaround if this is a problem : Just remove all empty values coming from server-side. TODO: Sample.

	
	// this.__onWarnNoStorage = function (){
		
		// //You can specify css or completely override the JS by specifying a HTML string
		// //or just return false and do your own thing. Same with above method.
	// }
		
	this._initialise = function( parentElement, opts ) {
	
		opts = opts || {};

		var allowedOpts = [ "dataStore", "autoSaveTrigger", "autoLoadTrigger", "seekExternalFormElements",
							"onInitialised", 
							"onLog", "onToggleSaveNotification", "onWarnNoStorage",
							"onPreLoad", "onPostLoad", "onPostDeserialize",
							"onPreSerialize", "onPreStore", "onPostStore" ];
		
		try {
			
			//Set this very first as if there's an initialisation error, startup routine may dispose and may need to log
			this.__callbacks = opts;		//TODO: Means it can be dynamic ?? But should be set explicitly for future compatability!
			
			this._ensureOptIn( opts, allowedOpts, "top level" );
						
			//Sequencing is important here :-
			
			var seekExternalFormElements = this._parseExternalElemsArg( opts.seekExternalFormElements );
			
			this._updateRootControls( parentElement, seekExternalFormElements );
			
			//Do this after updating root controls as we require the names of the top-level forms
			this._updateDataStore( opts.dataStore );
			
			//Do this after updating root controls as we hook need to hook listeners to them
			this._updateAutoSaveStrategy( opts.autoSaveTrigger, seekExternalFormElements );
			
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
						
		if ( autoLoadTrigger === null ) {
			
			//User does not want to auto-load
			this.__sendLog( AutoSave.LOG_DEBUG, "User requested no auto-load. Skipping..." );
			this._loadStepFinally();
			return;
		}
		else if ( autoLoadTrigger === undefined ){
			
			//We know document is loaded as initialisation is only run when document is ready
			this.load();
		}
		else {
			
			throw new Error( "Unexpected type for parameter 'autoLoadtrigger'" );
		}
	}
	
	//Runs a manual save
	this.save = function() {

		this.__sendLog( AutoSave.LOG_INFO, "Executing save : explicitly triggered" );
		this._executeSave();
	}
	
	//Forces a full load of supplied data
	this.load = function() {
				
		var cb = null; //Callback

		//Load string value from control
		cb = this.__callbacks.onPreLoad;
		
		if ( cb ) {
			
			this.__sendLog( AutoSave.LOG_DEBUG, "Invoking callback onPreLoad" );
			var rawUserInput = cb();
		
			//See @FUN Semantics
			if (rawUserInput === false) {
				
				this.__sendLog( AutoSave.LOG_INFO, "User aborted the load in the onPreLoad handler" );
				this._loadStepFinally();
				return; //Cancel the load
			}
			else if (rawUserInput === undefined) { 
				
				//Do nothing - continue with the load
			}
			else  //Assume it's a custom override
			{
				//We already have the data, run callback
				this.__sendLog( AutoSave.LOG_INFO, "User supplied custom payload for loading in the onPreLoad handler" );
				this.__sendLog( AutoSave.LOG_DEBUG, "Custom payload", rawUserInput );
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
			
			this.__sendLog( AutoSave.LOG_DEBUG, "Invoking callback onPostLoad" );
			
			var rawUserInput = cb( szData );
		
			//See @FUN Semantics
			if (rawUserInput === false) {
				
				this.__sendLog( AutoSave.LOG_INFO, "User aborted the load in the onPostLoad handler" );
				this._loadStepFinally();
				return; //Cancel the load
			}
			else if (rawUserInput === undefined) { 
				
				//Do nothing - continue with the load
			}
			else  //Assume it's a custom override - even if null
			{
				this.__sendLog( AutoSave.LOG_INFO, "User overwrote loading payload with custom one for loading in the onPostLoad handler" );
				this.__sendLog( AutoSave.LOG_DEBUG, "Custom load payload", rawUserInput );
				szData = rawUserInput;
			}
		}
		
		this.deserialize( szData, this.__clearEmptyValuesOnLoad );

		cb = this.__callbacks.onPostDeserialize;
		if ( cb ) {
			
			this.__sendLog( AutoSave.LOG_DEBUG, "Invoking callback onPostDeserialize" );
			cb();
		}
		
		this._loadStepFinally();
	}
	
	//ALWAYS called at some time after the load step is invoked
	//Regardless of whether it completed, got cancelled, came through callback, some time later after an async call etc.
	this._loadStepFinally = function(){
		
		//Call the initialisation callback once after the load step
		if ( !this.__onInitialiseInvoked ) {
			
			try {
				
				var cb = this.__callbacks.onInitialised;
				if (cb) {
					
					this.__sendLog( AutoSave.LOG_DEBUG, "Invoking callback onInitialised" );
					cb();
				}
			}
			finally{
				
				this.__onInitialiseInvoked = true;
			}
		}
	}
	
	//AlWAYS called after a save is invoked
	this._saveStepFinally = function(){
		
		this._toggleSavingNotification( false );
	}
	
	this.__currSaveNotificationElement;
	this._toggleSavingNotification = function( toggleOn ){
		
		var cb = this.__callbacks.onToggleSaveNotification;
		
		var currElement = this.__currSaveNotificationElement;
		
		if ( cb ){
			
			var rawUserInput = cb( toggleOn );
			
			//See @FUN Semantics
			if (rawUserInput === false) {

				this.__sendLog( AutoSave.LOG_INFO, "User aborted toggle save bar" );
				return; //Cancel toggling it
			}
			else if (rawUserInput === undefined) { 
			
				//Do nothing - continue with toggling as normal
			}
			else if ( typeof( rawUserInput ) === string ){
				
				if ( !toggleOn ){
					
					throw new Exception( "Unexpected type 'string' in onToggleSaveNotification when toggleOn=false " );
				}
				
				if ( !currElement ){
					
					currElement = createElement( AutoSave.DEFAULT_HTML_SAVE_NOTIFICATION );
				}
				
				currElement.querySelector(".msg").value( rawUserInput );
				//TODO: If first char is a tag, warn to supply element instead
				//TODO: If just plain string, replace text
				//TODO: How will we hide something custom user supplied? Keep hold of the HTML fragment?
			}
			else if ( rawUserInput === typeof(Element) ) { //TODO: If it's a DOM element
			
				currElement = rawUserInput;
				
				//TODO: Wrap it in autosave-notification so we can bring it to top
				//TODO: Where css styles? AutoSave.DEFAULT_NOTIFICATION_CSS_STYLES ? Ensure Overridable
			}
			else {
			
				throw new Exception( "Unexpected type of parameter onToggleSaveNotification." );
			}
		}
		
		if ( !toggleOn ){
			
			if ( !currElement ){
				
				log.warn( "No element was initially shown for autosave notification - can't hide." )
			}
			else{
				
				currElement.style.display = "none"
			}
		}
		else{
		
			//Create default control if not already created
			if ( !currElement ) {
				
				currElement = createElement( AutoSave.DEFAULT_HTML_SAVE_NOTIFICATION );
			}
			else
			{
				//If it was already created from previously, ensure it's now visible
				currElement.style.display = "block"; //TODO: 'Reset' this so display is block or whatever it was before
			}
				
			this.__currSaveNotificationElement = currElement;
		}
	}
	
	this._executeSave = function() {
	
		this._toggleSavingNotification( true );
	
		var cb = null; //Callback
		
		//Get controls to serialize - guaranteed to be an array
		var controlsArr = this.__getRootControlsFunc();
		
		//Serialize all control values
		cb = this.__callbacks.onPreSerialize;
		
		if ( cb ) {
			
			this.__sendLog( AutoSave.LOG_DEBUG, "Invoking callback onPreSerialize" );
			var rawUserInput = cb( controlsArr );

			//See @FUN Semantics
			if (rawUserInput === false) {

				this.__sendLog( AutoSave.LOG_INFO, "User aborted the save in the onPreSerialize handler" );
				this._saveStepFinally();
				return; //Cancel the save
			}
			else if (rawUserInput === undefined) { 
			
				//Do nothing - continue with the save
			}
			else if (rawUserInput === null) { //User override
			
				//Treat as empty - blank out user controls
				this.__sendLog( AutoSave.LOG_WARN, "User specified an empty override payload for save in the onPreSerialize handler" );
				controlsArr = [];
			}
			else {
			
				//Expect a valid definition of controls
				this.__sendLog( AutoSave.LOG_INFO, "User overwrote saving payload with custom one in the onPreSerialize handler" );
				this.__sendLog( AutoSave.LOG_DEBUG, "Custom save payload in onPreSerialize handler", rawUserInput );
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
			
			this.__sendLog( AutoSave.LOG_DEBUG, "Invoking callback onPreStore" );
			var rawUserInput = cb( szData );
			
			//See @FUN Semantics
			if (rawUserInput === false) {
				
				this.__sendLog( AutoSave.LOG_INFO, "User aborted the save in the onPreStore handler" );
				this._saveStepFinally();
				return; //Cancel the save
			}
			else if (rawUserInput === undefined) { 
			
				//Do nothing - continue with the save
			}
			else { 
			
				//User input is a valid override string - null implies clearing out local storage
				this.__sendLog( AutoSave.LOG_INFO, "User overwrote saving payload with custom one in the onPreStore handler" );
				this.__sendLog( AutoSave.LOG_DEBUG, "Custom save payload in onPreStore handler", rawUserInput );
				szData = rawUserInput;
			}
		}
		
		this.__theStore.save( szData, this._onSaveCompleted.bind(this) );
	}

	this._onSaveCompleted = function() {

		//Inspection hook for what was sent - should be invoked asychronously after return from store
		var cb = this.__callbacks.onPostStore;
		
		if ( cb ){
			
			this.__sendLog( AutoSave.LOG_DEBUG, "Invoking callback onPostStore" );
			cb();
		}
		
		this._saveStepFinally();
	}
	
	
	//This function sets up where to save the data
	this._updateDataStore = function( dataStore ){
		
		var hasLocalStorage = AutoSave.isLocalStorageAvailable();
		
		this.__sendLog( AutoSave.LOG_DEBUG, "Has local storage was calculated", hasLocalStorage );
		
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
			
			var allowedOpts = [ "save", "load", "key", "preferCookies", "clearEmptyValuesOnLoad" ];
			
			this._ensureOptIn( dataStore, allowedOpts, "dataStore" );

			this.__clearEmptyValuesOnLoad = dataStore.clearEmptyValuesOnLoad;
			
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
				
				this.__theStore = this.__invokeExt( AutoSave.getCtor ( _CustomStore, this.__dataStoreKeyFunc, dataStore.save, dataStore.load ) );
			}
		}
		else {
			
			throw new Error( "Unexpected type of parameter 'dataStore'");
		}
	}
	
	this.__invokeExt = function( funcToRun ){
	
		var prevLogger = AutoSave.log;
		
		try{
			
			if ( !this.__invokeExtBound )
				this.__invokeExtBound = this.__sendLog.bind(this);
			
			AutoSave.log = this.__invokeExtBound;
			
			return funcToRun();
		}
		finally{
			
			AutoSave.log = prevLogger;
		}
	}
	
	this.__sendLog = function ( level, msg ){

		 var cb = this.__callbacks.onLog;
		 if ( cb )
		 {
			 var ret = cb( level, msg );
			 
			 //See @FUN semantics
			 if ( ret === false ) {
				 
				 //Abort
				 return
			 }
			 else if ( ret === undefined ){
				 
				 //continue
			 }
			 else {//could be string, object, anything user specifies take as-is
				 
				 msg = ret;
			 }
		 }
		 
 		 //TODO: Log Levels should correspond to popular logging libraries
		 AutoSave._logToConsole( level, msg );
	}
	
	//This function sets up when to save the state
	this._updateAutoSaveStrategy = function( saveTrigger, seekExternalFormElements ){
		
		if ( saveTrigger === null ){
			
			//Only when invoked - i.e. do nothing

			this.__sendLog( AutoSave.LOG_INFO, "Save trigger was disabled");
			return;
		}
		else if ( saveTrigger === undefined ) {

			this.__debounceInterval = AutoSave.DEFAULT_AUTOSAVE_INTERVAL;
			this.__sendLog( AutoSave.LOG_INFO, "Save trigger was initialised at default interval", this.__debounceInterval);
		}
		else if ( typeof( saveTrigger ) == "object" ) {

			var allowedOpts = [ "debounceInterval" ];
			
			this._ensureOptIn( saveTrigger, allowedOpts, "autoSaveTrigger" );
		
			//At regular intervals in milliseconds
			var debounceInterval = saveTrigger.debounceInterval;
			
			if ( typeof debounceInterval == "number" ) {
			
				if ( debounceInterval <= 60 ){ //Must be a mistake
				
					throw new Error( "The 'debounceInterval' must be specified in milliseconds" );
				}
				else {
					
					this.__debounceInterval = debounceInterval;
					this.__sendLog( AutoSave.LOG_INFO, "Save trigger was initialised at custom interval", this.__debounceInterval);
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
		this._hookListeners( true, seekExternalFormElements );
	}

	this._updateRootControls = function( parentElement, seekExternalFormElements ) {
	
		if ( !parentElement ) { //Both undefined (so they neednt specify) and null (so they can skip over to set opts)
		
		 	this.__sendLog( AutoSave.LOG_DEBUG, "No parent element specified - will use whole document" );
			
			parentElement = document.body;	//TODO: Will this capture all? In Node too?
		}
		
		if ( typeof ( parentElement ) == "function" ){
		
			//Customise the set of controls used - calculated dynamically from user's function
			//TODO: What about un-hooking/re-hooking listeners when this set changes?
			this.__getRootControlsFunc = function() {
			
				var rawUserInput = parentElement();	//TODO: Context in which this is invoked?
				
				if ( !rawUserInput ){
					
					this.__sendLog( AutoSave.LOG_INFO, "User specified custom function returned empty set of elements");
					return []; //Always standardise to an array
				}
				else{
					
					var elems = this._getControlsFromUserInput( rawUserInput );
					
					this.__sendLog( AutoSave.LOG_INFO, "Extracted "+elems.length+" root level controls from user specified input");
					
					if ( seekExternalFormElements ){
						
						var externalElems = AutoSave.getExternalFormControls( elems );
						this.__sendLog( AutoSave.LOG_INFO, "Found "+externalElems.length+" external form-linked controls");
						
						for( var idx = 0; idx < externalElems.length; idx++ ){
							
							elems.push( externalElems[ idx ] );
						}
					}
					
					return elems;
				}
			};
		}
		else {
		
			//Static - so calculate it just once beforehand and return the same set every time
			//TODO: SHOULD BE DYNAMIC IF STRING
			var elems = this._getControlsFromUserInput( parentElement );
			
			//Validation - TODO: Test if something an array and not a jQuery array or dom-like ?
			//If user-supplied parameter didn't resolve to any elements, throw, as there will be nothing to listen to.
			//Except if explicitly specified an empty [] so continue 
			if ( !Array.isArray(parentElement) && elems.length == 0){
				
				this.__sendLog( AutoSave.LOG_WARN, "RootControls parameter resolved to zero elements - maybe your selector(s) werent right?");
			}
			else{
				
				this.__sendLog( AutoSave.LOG_INFO, "Extracted "+elems.length+" root level controls");
			}
		
			//Find all elements that use a 'form=...' attribute explicitly and assume they're outside the root control set so capture them
			if ( seekExternalFormElements ) {
				
				var externalElems = AutoSave.getExternalFormControls( elems );
				this.__sendLog( AutoSave.LOG_INFO, "Found "+externalElems.length+" external form-linked controls");
				
				for( var idx = 0; idx < externalElems.length; idx++ ){
					
					elems.push( externalElems[ idx ] );
				}
			}
		
			this.__getRootControlsFunc = function() {
			
				return elems;
			};
		}
	}

	
	this._hookListeners = function ( hookOn, seekExternalFormElements ){ 

		this.__sendLog( AutoSave.LOG_DEBUG, 
						(hookOn?"Hooking":"Unhooking")+
						" listeners. Seeking external controls for hooking: "+seekExternalFormElements);
				
		//controlsArr is never null by post-condition of _updateRootControls
		var controlsArr = this.__getRootControlsFunc();

		//TODO: Test: If control change triggers another? Should be captured by timeout
		
		for( var ctrlIdx=0; ctrlIdx<controlsArr.length; ctrlIdx++ ){
			
			var child = controlsArr[ ctrlIdx ];
			
			this._hookSingleControl ( child, hookOn );
		}
	}
	
	this._hookSingleControl = function ( child, hookOn ){

		//TODO: What about whilst typing? Neither of these will fire ?
		if (hookOn) {
			
			//'change' event is primarily for checkboxes and radios for browsers - 'historical reasons'
			//But we can hook both as we'll debounce changes anyway
			child.addEventListener( "input",  this, AutoSave.__defaultListenOpts );
			child.addEventListener( "change", this, AutoSave.__defaultListenOpts );
		}
		else {
			
			child.removeEventListener( "input",  this, AutoSave.__defaultListenOpts );
			child.removeEventListener( "change", this, AutoSave.__defaultListenOpts );
		}
	}
		
	this.handleEvent = function (ev){
		
		this.__sendLog( AutoSave.LOG_DEBUG, "Handling raw control input event", ev );
		
		//If already have a timer running, return
		if (this.__debounceTimeoutHandle){
			
			return;
		}
				
		this.__debounceTimeoutHandle = setTimeout( this._handleDebouncedEvent.bind( this ), this.__debounceInterval );
	}
	
	this._handleDebouncedEvent = function() {
		
		this.__sendLog( AutoSave.LOG_DEBUG, "Handling debounced control input event" );
		
		this.__debounceTimeoutHandle = null;

		this.__sendLog( AutoSave.LOG_INFO, "Executing save: after element changed" );
		this._executeSave();
	}
	//Parameter should NOT be falsy here - should be handled beforehand by caller based on context
	//Always returns a non-null array
	this._getControlsFromUserInput = function( rawUserInput ){
		
		var elems;
		
		if (typeof ( rawUserInput ) == "string") {//selector
		
			var elemsNodeList = document.querySelectorAll( rawUserInput );
			elems = [];
			for( var idx=0; idx < elemsNodeList.length; idx++ )
				elems.push( elemsNodeList[ idx ] );
		}
		else if ( rawUserInput.length !== undefined ) { //Array-like of elements
		
			//Note: This also works for instanceof jQuery.
			
			elems = rawUserInput;
		}
		else if ( rawUserInput.nodeType > 0 ){ //Single element
			
			elems = [ rawUserInput ];
		}
		else {
		
			throw new Error( 
				"Unrecognized type of HTML element(s) supplied. Expected a selector, array-like object or a single Node.", 
				rawUserInput );
		}

		return elems;
	}
	
	this._getKeyFunc = function( parentElems, rawUserOption ){
		
		//User-supplied option takes precedence - we dont validate uniqueness etc. but trust what they're doing
		if ( rawUserOption !== undefined ){
		
			if ( typeof rawUserOption == "string" ){
				
				var fullKey = AutoSave.DEFAULT_KEY_PREFIX + rawUserOption;
				
				this.__sendLog( AutoSave.LOG_INFO, "Using static provided value for datastore key", fullKey );
		
				return function(){
					
					return fullKey;
				}
			}
			else if ( typeof rawUserOption === "function" ){
				
				this.__sendLog( AutoSave.LOG_DEBUG, "Using user-supplied function for generating datastore key when required" );
				
				var that = this;
				return function(){
					
					//Dynamically recalc every time
					var val = AutoSave.DEFAULT_KEY_PREFIX + rawUserOption();

					that.__sendLog( AutoSave.LOG_DEBUG, "Calculated dynamic datastore key to use", val );
					
					return val;
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
			
			this.__sendLog( AutoSave.LOG_INFO, "Using calculated value for datastore key", keyValue);
				
			if ( AutoSave.__keysInUse.indexOf(keyValue) != -1 ){
				
				throw new Error("There is already an AutoSave instance with the storage key of '"+keyValue+"'. See the documentation for solutions.")
			}
			
			AutoSave.__keysInUse.push(keyValue);
			
			this.__sendLog( AutoSave.LOG_DEBUG, "Updated set of keys in use", AutoSave.__keysInUse );
			
			return function(){
				
				return keyValue;
			}
		}
	}
	
	//Returns the value got from invoking the user's onMessage handler
	// this._sendMsg = function( msgCode, data ){
		
		// var cb = this.__callbacks.onMessage;
		
		// if ( !cb )
			// return; //User doesnt want any messages
	// }
	
	this._parseExternalElemsArg = function( seekExternalFormElements ){
		
		//Default hook external controls to true
		if ( seekExternalFormElements === undefined )
			seekExternalFormElements = true;
		else if ( seekExternalFormElements === false ||
				  seekExternalFormElements === true)
		{ /* Valid */ }
		else
			throw new Error( "Unexpected type for parameter 'seekExternalFormElements'" );

		return seekExternalFormElements;
	}
	
	this.dispose = function( deleteDataStore ) {
		
		//Detach listeners
		try {
			
			this._hookListeners( false, null );
		}
		catch(e){
			
			this.__sendLog( AutoSave.LOG_WARN, "Error unhooking listeners", e);
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
			
			this.__sendLog( AutoSave.LOG_WARN, "Error freeing key", e);
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
			
			this.__sendLog( AutoSave.LOG_WARN, "Error resetting store", e);
		}
	}
	
	this.resetStore = function() {
		
		var clearCallback = function(){};
		
		this.__theStore.resetStore( clearCallback );
	}
	
	this._deserializeSingleControl = function( child, fieldData, clearEmpty ){

		var fieldValue = null;
		
		var runStd = false;
		
		if (child.nodeName == "INPUT"){
		
		   if (child.type == "radio" || child.type == "checkbox") {

				//For these, we need to check not only that the names exists but the value corresponds to this element.
				//If it corresponds, we need to 
				//	- If clearEmpty = true, also uncheck all those items with the same name that aren't in the field data.
				//	- Else leave the element's value intact
				//If theres no kvp that corresponds to this name, always leave the elements intact.
				
				var foundField = null;
				
				for (var fieldIdx in fieldData[ 0 ] ) {
				
					if ( fieldData[ 0 ][ fieldIdx ] == child.name ) {
						
						if ( fieldData[ 1 ][ fieldIdx ] == child.value ) {
						
							foundField = true;
							break;
						}
						else{
							
							foundField = false;
							
							//Continue searching
						}
					}
				}
					
				if ( foundField === true )
					child.checked = true;
				else if ( foundField === false && clearEmpty ) //Was of the form ...&fieldName=&...
					child.checked = false;
				//else missing altogether in the field data so leave untouched
			}
			else {
				runStd = true;
			}
		}
		else if ( child.nodeName == "SELECT" ) {
		
			if ( child.type == "select-one" ) {
			
				runStd = true;
			}
			else { //Implicitly select-multiple
			
				var sChildren = child.options;
				
				for ( var childIdx = 0 ; childIdx < sChildren.length ; childIdx++ ) {
					
					var opt = sChildren[ childIdx ];
					
					for ( var fieldIdx in fieldData[ 0 ] ) {
					
						if ( fieldData[ 0 ][ fieldIdx ] == child.name) {
							
							if ( fieldData[ 1 ][ fieldIdx ] == opt.value ) {
							
								opt.selected = true;
								break;
							}
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
			for( var sIdx = 0; sIdx < sChildren.length; sIdx++ ){
				
				this._deserializeSingleControl( sChildren[ sIdx ], fieldData, clearEmpty );
			}
		}
		
		if (runStd) {
			
			for ( var fieldIdx in fieldData[ 0 ] ) {
			
				var fieldName = fieldData[ 0 ][ fieldIdx ];
				
				if ( fieldName === child.name ){
				
					var fieldValue = fieldData[ 1 ][ fieldIdx ];
						
					if ( fieldValue !== "" || clearEmpty )
						child.value = fieldValue;
					
					break;
				}
				//else was missing altogether from field data
			}
		}
	}
	
	this.deserialize = function( fieldDataStr, clearEmpty ){
		
		if ( !fieldDataStr )
			return; //Nothing to do

		//By default, we clear elements with empty values in the dataset. This is so
		//	- Reset behaviour can be mimic'd so all fields are cleared
		//	- Concurrent screen editing behaviour is as expected - i.e. incase another user clears a field
		if ( clearEmpty === undefined )
			clearEmpty = true;
			
		//Find all children
		//controlsArr is never null by post-condition of _updateRootControls
		var controlsArr = this.__getRootControlsFunc();
		
		var fieldData = AutoSave._decodeFieldDataFromString( fieldDataStr );
		
		for( var idx = 0; idx < controlsArr.length ; idx++ ) {

			var child = controlsArr[ idx ];
			
			this._deserializeSingleControl( child, fieldData, clearEmpty );
		}
	}
	
	//Looks at a single control and it's children and returns an array of serialised object strings
	this._serializeSingleControl = function( child, fieldData ){
	
		var nameKey = child.name;
		var value = child.value;
		
		if ( child.nodeName == "INPUT" ) {
		
			//We only serialise controls with names (else we'll get, e.g., '=Oscar&=Mozart')
			if ( !nameKey ) {

				this.__sendLog( AutoSave.LOG_DEBUG, "Ignored INPUT node as no name was present", child );
				return;
			}
			
		   if ( child.type == "radio" || child.type == "checkbox" ){
			
				if ( child.checked ) {
					
					fieldData[0].push( nameKey );
					fieldData[1].push( value );
				}
			}
			else{ //Implicitly an <input type=text|button|password|hidden...>
			
				fieldData[0].push( nameKey );
				fieldData[1].push( value );
			}
		}
		else if ( child.nodeName == "SELECT" ){
		
			//We only serialise controls with names (else we'll get, e.g., '=Oscar&=Mozart')
			if ( !nameKey ) {

				this.__sendLog( AutoSave.LOG_DEBUG, "Ignored SELECT node as no name was present", child );
				return;
			}
		
			if ( child.type == "select-one" ){
			
				fieldData[0].push( nameKey );
				fieldData[1].push( value );
			}
			else { //Must be of type == 'select-multiple'
			
				var sChildren = child.options;
				for( var sIdx = 0 ; sIdx < sChildren.length ; ++sIdx ){
				
					if ( sChildren[sIdx].selected ) {
					
						fieldData[0].push( nameKey );
						fieldData[1].push( sChildren[ sIdx ].value );
					}
				}
			}
		}
		else if ( child.nodeName == "TEXTAREA" ) {
		
			//We only serialise controls with names (else we'll get, e.g., '=Oscar&=Mozart')
			if ( !nameKey ) {

				this.__sendLog( AutoSave.LOG_DEBUG,"Ignored TEXTAREA node as no name was present", child );
				return;
			}
		
			fieldData[0].push( nameKey );
			fieldData[1].push( value );
		}
		
		
		//TODO: Button,  etc.
		
		
		else {
		
			//May be, e.g., a form or div so go through all children
			var sChildren = child.children;
			for( var sIdx = 0 ; sIdx < sChildren.length ; sIdx++ ){
				
				this._serializeSingleControl( sChildren[ sIdx ], fieldData );
			}
		}
	}
	
	//Returns the serialized string in the standard format(?) - 
	//Must return a string instance - even if empty - as callback hooks assume it
	this.serialize = function( rootControlsArr ){
		
		var fieldData = [[],[]];
		var formNames = [];
		
		for( var idx=0 ; idx<rootControlsArr.length ; ++idx ) {
		
			this._serializeSingleControl( rootControlsArr[ idx ], fieldData );
		}
		
		var fieldDataStr = AutoSave._encodeFieldDataToString( fieldData );
		
		return fieldDataStr;
	}
	
	
	//TODO: setOpt("", "...") for dynamic parameter modification - just pass in a modified options object as before? What if callbacks REMOVED?
	
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
		
		AutoSave.log( AutoSave.LOG_INFO, "Using cookie storage as local store" );
		
		if ( !navigator.cookieEnabled ){
			
			AutoSave.log( AutoSave.LOG_WARN, "Cookie Store requested but cookies not enabled.");
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
			
			AutoSave.log( AutoSave.LOG_DEBUG, "Created cookie params string", cookieParamsStr );
			
			return cookieParamsStr;
		}
		
		this.resetStore = function( clearCompleted ){
			
			return this.save( null, clearCompleted );
		}
	}

	var _LocalStore = function( keyFunc ){
		
		AutoSave.log( AutoSave.LOG_INFO, "Using Browser Local Storage as local store" );
		
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
		
		AutoSave.log( AutoSave.LOG_INFO, "Using a no-op data store" );
		
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
		
		AutoSave.log( AutoSave.LOG_INFO, "Using a custom store as the local store" );
		
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

	AutoSave.whenInitialized( this._initialise.bind(this, rootControls, opts) );
};

AutoSave.whenInitialized = function whenInitialized( funcToRun ){

	if ( document.readyState == "complete" ){
		
		AutoSave.log( AutoSave.LOG_DEBUG, "Document is ready - beginning AutoSave initialisation sequence..." );
		funcToRun();
	}
	else {
		
		AutoSave.log( AutoSave.LOG_DEBUG, "Document is not ready - polling until ready" );
		
		//Keep looping until it's ready - compromise between code-size, x-browser compatability
		var loadIntervalHandle = setInterval( function(){
	
			if ( document.readyState == "complete" ){
			
				clearInterval( loadIntervalHandle );
				
				AutoSave.log( AutoSave.LOG_DEBUG, "Document now ready - beginning AutoSave initialisation sequence..." );
				funcToRun();
			}
		}, AutoSave.DEFAULT_LOAD_CHECK_INTERVAL );
	}
}

AutoSave._encodeFieldDataToString = function _encodeFieldDataToString( fieldData ){
		
	var fieldDataStr = "";
	for( var fieldIdx in fieldData[0] ){
		
		var name  = fieldData[0][fieldIdx];
		var value = fieldData[1][fieldIdx];
		
		fieldDataStr += encodeURIComponent(name)+"="+encodeURIComponent(value);
		
		if ( fieldIdx != fieldData[0].length-1 )
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
	var fieldData = [[],[]];
	var pairs = fieldDataStr.split("&");
	for(var pairIdx in pairs){
		
		var pair = pairs[ pairIdx ];
		var items = pair.split( "=" );
		
		if ( items.length != 2 ) {
			
			AutoSave.log( AutoSave.LOG_WARN, "Expected a pair of items separated by '=' in "+pair+". Got "+items.length+". Ignoring...")
		}
		else{
			
			var key = decodeURIComponent( items[ 0 ] );
			var value = decodeURIComponent( items[ 1 ] );
			fieldData[ 0 ].push( key );
			fieldData[ 1 ].push( value  );
		}
	}
		
	return fieldData;
}


//TODO: AutoSaveJS should also use this method
AutoSave.addSerialisedValue = function addSerialisedValue( szString, key, value ){
	
	if ( !key ) {
		
		throw new Error( "No key specified" );
	}
	
	if ( value === null || value === undefined ) { //Preserve 0 in output string 
		
		value = "";
	}
	
	if ( !szString ) {
		
		szString = ""; //Initialise if required
	}
		
	if ( szString.length ) {
		
		szString += "&";
	}
	
	var ret=[ [key],[value] ];
	var encoded = AutoSave._encodeFieldDataToString(ret);
	szString += encoded;
	
	return szString;
}


//Will ALWAYS return a non-null array
AutoSave.getSerialisedValues = function getSerialisedValues( szString, key ){
	
	if ( !key ) {
		
		throw new Error( "No key specified" );
	}
	
	if ( !szString ) {
		
		return [];
	}

	var decoded = AutoSave._decodeFieldDataFromString( szString );
	
	var ret = [];
	for( var i in decoded[ 0 ] ) {
		
		if ( decoded[ 0 ][ i ] == key ) { //TODO: INHERITED ONES? Keys?
			
			ret.push( decoded[ 1 ][ i ] );
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

AutoSave._uniq = function( value, index, self ) {

	return self.indexOf(value) === index;
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

// AutoSave.calloutInContext = function( funcToRun, logger ){
	
	// var prevLogger = AutoSave.__currentLogger;
	
	// try{
		
		// AutoSave.__currentLogger = logger;
		
		// funcToRun();
	// }
	// finally{
		
		// AutoSave.__currentLogger = prevLogger;
	// }
// }

AutoSave.getExternalFormControls = function( elems ){

	var formNames = [];
	
	for( var idx = 0; idx < elems.length; idx++ ){
		
		var elem = elems[ idx ];
		
		if ( elem.nodeName == "FORM" ){
			
			var id = elem.getAttribute( "id" );			//TODO: Make get prop here and below ??
			if ( id ){
				
				formNames.push( id );
			}
		}
		else
		{
			var nestedForms = elem.querySelectorAll( "form" );
			
			for(var nIdx = 0; nIdx < nestedForms.length; nIdx++){
				
				var nElem = nestedForms[ nIdx ];
				
				if ( nElem.nodeName == "FORM" ){
					
					var id = nElem.getAttribute( "id" );
					if ( id ){
						
						formNames.push( id );
					}
				}
			}
		}
	}

	//Distinct form names used
	formNames = formNames.filter( AutoSave._uniq );
	
	//Find all elements that use a 'form=...' attribute explicitly and assume they're outside the root control set so capture them
	if ( formNames.length ){
		
		var selector = "[form='"+formNames.join("'],[form='")+"']";
		var externalElems = document.querySelectorAll( selector );
	}
	else{
		
		externalElems = [];
	}
	
	return externalElems;
}


AutoSave.getCtor = function ( constructor , __variadic_args__ ){
	
	var currArgs = Array.from(arguments).slice(1); //Bypass constructor argument -- TODO: CHECK SUPPORT OF NEW ARRAY like this
	
	return function(){
		
		var args = [null].concat(currArgs);
		var factoryFunction = constructor.bind.apply(constructor, args);
		return new factoryFunction();
	}
}

AutoSave._logToConsole = function ( logLevel, msg ){
	
	if ( logLevel == AutoSave.LOG_DEBUG )
	{
		if (console.debug) 
			console.debug( msg );
		else
			console.log( msg ); //Distinguish from info level incase users need it
	}
	else if ( logLevel == AutoSave.LOG_INFO )
		console.info( msg );
	else if ( logLevel == AutoSave.LOG_WARN )
		console.warn( msg );
	else if ( logLevel == AutoSave.LOG_ERROR )
		console.error( msg );
	else
		throw new Error( "Unknown log level: " + logLevel );
}

//todo: be consistent wrt usage of null vs constants, sample code shouldnt break on upgrades from null to constant parameters
AutoSave.LOG_DEBUG = 100;
AutoSave.LOG_INFO = 101;
AutoSave.LOG_WARN = 102;
AutoSave.LOG_ERROR = 103;
// AutoSave.MSG_STORAGE_SUPPORT = 104;
// AutoSave.MSG_STORAGE_WARNING = 105; /* When about to show user a message that they have no support for autosave */
// AutoSave.MSG_SAVING_STARTED = 106;
// AutoSave.MSG_SAVING_COMPLETED = 107;
AutoSave.DEFAULT_HTML_SAVE_NOTIFICATION = "<div class='autosave-notification'><span class='msg'>Saving...</span></div>";
AutoSave.DEFAULT_LOAD_CHECK_INTERVAL = 100;    //Every 100 seconds, check if it's loaded
AutoSave.DEFAULT_AUTOSAVE_INTERVAL   = 3*1000; //By default, autosave every 3 seconds
AutoSave.DEFAULT_KEY_PREFIX = "AutoSaveJS_";
AutoSave.log = AutoSave._logToConsole; //By default, log to console.
AutoSave.__keysInUse = [];
AutoSave.__defaultListenOpts = { passive:true, capture:true };		//Let browser know we only listen passively so it can optimise
AutoSave.__cachedLocalStorageAvailable;
AutoSave.Version = "1.0.0";
