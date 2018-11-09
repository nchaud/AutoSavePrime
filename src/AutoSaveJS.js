/*
* AutoSaveJS - https://github.com/nchaud/AutoSaveJS
*
* Copyright (c) 2018 Numaan Chaudhry
* Licensed under the MIT license.
*/

// Module-loader compatability prelude
(function (root, definition) {
    if (typeof define === 'function' && define.amd) {
        define(definition);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = definition();
    } else {
        root.AutoSave = definition();
    }
}(this, function () {

	"use strict";

	function AutoSave( rootControls, opts ){

		this.__callbacks 			= undefined;
		this.__theStore 			= undefined;
		this.__getRootControlsFunc 	= undefined; //Never null after init | Function invoked will return an array of top-level controls requested by user
		this.__debounceInterval 	= undefined;
		this.__debounceTimeoutHandle= undefined;
		this.__dataStoreKeyFunc 	= undefined; //Never null after init
		this.__onInitialiseInvoked	= undefined;
		this.__pendingInitRoutines	= 0;

		//Cached, bound functions
		this.__invokeExtBound		= undefined;
		this.__resetNotificationDisplayBound 		= undefined;
		this.__handleDebouncedEventBound 	 		= undefined;
		this.__onUnloadingBound		= undefined;
		
		//Saving & Notifications
		this.__minShowDuration		= undefined;		//Minimum duration to show the 'Saving...' notification for
		this.__warnMsgShowDuration	= undefined; 		//Duration to show the 'No Storage Warning' notification for
		this.__currSaveNotificationElement			= undefined; //May be null if user does not want to show anything
		this.__currWarnStorageNotificationElement	= undefined; //May be null if user does not want to show anything
		this.__saveInProgress		= undefined;
		this.__isPendingSave		= undefined;
		this.__autoToggleState		= undefined; 	//Null => interval not elapsed, true => auto toggle will run, false => interval elapsed + toggle will not run
		this.__warnNoStore			= undefined; 	//Will be true if a store was expected but wasn't present
		this.__clearEmptyValuesOnLoad				= undefined; //When keys dont have a value in the data store (e.g....&name=&...), clear out those elements on load
		
		//InvokeExtBound is not initialised yet so can't use __invokeExt
		AutoSave.whenDocReady ( this._initialise.bind( this, rootControls, opts ) );		
	}
	
	AutoSave.prototype._initialise = function( parentElement, opts ) {
	
		opts = opts || {};

		var allowedOpts = [ "dataStore", "autoSaveTrigger", "autoLoadTrigger", "seekExternalFormElements",
							"saveNotification", "noStorageNotification",
							
							//Callbacks
							"onSaveNotification", "onNoStorageNotification", "onLog", "onInitialised", 
							"onPreLoad", "onPostLoad", "onPostDeserialize",
							"onPreSerialize", "onPreStore", "onPostStore" ];
		
		try {
			
			//Set this very first as if there's an initialisation error, startup routine may dispose and may need to log
			this.__callbacks = opts;		
			//TODO: Means it can be dynamic ?? But should be set explicitly for future compatability! And other opts in general?

			this.__resetNotificationDisplayBound = this._resetNotificationDisplay.bind( this );
			this.__handleDebouncedEventBound = this._handleDebouncedEvent.bind( this );
			this.__invokeExtBound = this.__sendLog.bind( this );
			this.__onUnloadingBound = this._onUnloading.bind( this );
			
			AutoSave._ensureOptIn( opts, allowedOpts, "top level" );
			
			//Sequencing is important here :-

			//Mark that registration is happening
			this._registerInitQueue( 1 );

			var seekExternalFormElements = AutoSave._parseExternalElemsArg( opts.seekExternalFormElements );

			this._updateRootControls( parentElement, seekExternalFormElements );

			//Do this after updating root controls as we require the names of the top-level forms
			this._updateDataStore( opts.dataStore );

			//Do this after updating root controls as we hook need to hook listeners to them
			this._updateAutoSaveStrategy( opts.autoSaveTrigger, seekExternalFormElements );

			//Load values into controls on start
			this._updateLoadStrategy( opts.autoLoadTrigger );

			this._updateSaveNotification( opts.saveNotification );

			//Show warning banner if there's no storage
			if ( this.__warnNoStore ) {

				//Lazy create banner state only if needed
				this._updateNoStorageNotification( opts.noStorageNotification );

				//Toggle it
				this._toggleNoStorageNotification( this.__warnNoStore );
			}

			this._hookUnloadListener( true );

			//Kick off init callback if everything else complete
			this._registerInitQueue( -1 );
		}
		catch ( e ) {
						
			//Clean up listeners, free up keys allocated etc.
			this.dispose();				
			
			throw e;
		}
	};

	//Runs a save on-demand
	AutoSave.prototype.save = function(){

		this.__sendLog( AutoSave.LOG_INFO, "Executing save : explicitly triggered" );
		this._executeSave();
	};
	
	//Forces a full load of supplied data
	AutoSave.prototype.load = function(){
				
		var cb = null; //Callback

		//Load string value from control
		cb = this.__callbacks.onPreLoad;
		
		if ( cb ) {
			
			this.__sendLog( AutoSave.LOG_DEBUG, "Invoking callback onPreLoad" );
			var rawUserInput = cb();
		
			//See @FUN Semantics
			if ( rawUserInput === false ) {
				
				this.__sendLog( AutoSave.LOG_INFO, "User aborted the load in the onPreLoad handler" );
				return; //Cancel the load
			}
			else if ( rawUserInput === undefined || rawUserInput === true ) { 
				
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
		this._registerInitQueue( 1 );
		this.__theStore.load( this._loadCallbackHandler.bind( this ) );
	};

	//Clears up this instance.
	//Parameter 'deleteDataStore' : To remove all data stored with this AutoSave instance too
	AutoSave.prototype.dispose = function( deleteDataStore ) {
		
		//Detach listeners
		try {
			
			this._hookListeners( false, null );

			this._hookUnloadListener( false );			
		}
		catch( e ){
			
			this.__sendLog( AutoSave.LOG_WARN, "Error unhooking listeners", e );
		}

		//Clear any pending saves
		if ( this.__debounceTimeoutHandle ) {
			
			clearTimeout( this.__debounceTimeoutHandle );
			this.__debounceTimeoutHandle = null;
		}

		//We always clear the key as this instance is now useless and another instance may want to attach to this root control set
		//Otherwise, if someone disposes this instances but decides to keep the data, they cant do anything with it
		try {
				
			if ( this.__dataStoreKeyFunc ) {
				
				var key = this.__dataStoreKeyFunc();
				var keyIdx = AutoSave.__keysInUse.indexOf( key );
				
				if ( keyIdx != -1 ){
					
					AutoSave.__keysInUse.splice( keyIdx, 1 );
				}
			}
		}
		catch( e ){
			
			this.__sendLog( AutoSave.LOG_WARN, "Error resetting store", e );
		}
	
		//We clear the store by default
		try {

			if ( deleteDataStore !== false ){
				
				//Empty what's in the store currently
				this.resetStore();	
			}
		}
		catch( e ){
			
			this.__sendLog( AutoSave.LOG_WARN, "Error resetting store", e );
		}
		
		//Remove the "Saving..." html element from DOM
		var notifyElem = this.__currSaveNotificationElement;
		if ( notifyElem && notifyElem.parentNode ) {
			
			notifyElem.parentNode.removeChild ( notifyElem );
		}
		
		//Remove the "No Local Storage warning..." html element from DOM
		var warnElem = this.__currWarnStorageNotificationElement;
		if ( warnElem && warnElem.parentNode ) {
			
			warnElem.parentNode.removeChild ( warnElem );
		}
	};
	
	AutoSave.prototype.resetStore = function(){
		
		var clearCallback = function(){};
		
		this.__theStore.resetStore( clearCallback );
	};

	/** End Public Api **/
	
	AutoSave.prototype._updateLoadStrategy = function( autoLoadTrigger ) {
						
		if ( autoLoadTrigger === null ) {
			
			//User does not want to auto-load
			this.__sendLog( AutoSave.LOG_DEBUG, "User requested no auto-load. Skipping..." );
			return;
		}
		else if ( autoLoadTrigger === undefined ){
			
			//We know document is loaded as initialisation is only run when document is ready
			this.load();
		}
		else {
			
			throw new Error( "Unexpected type for parameter 'autoLoadtrigger'" );
		}
	};
	
	AutoSave.prototype._loadCallbackHandler = function( szData ) {
	
		var cb = this.__callbacks.onPostLoad;
		
		if ( cb ) {
			
			this.__sendLog( AutoSave.LOG_DEBUG, "Invoking callback onPostLoad" );
			
			var rawUserInput = cb( szData );
		
			//See @FUN Semantics
			if ( rawUserInput === false ) {
				
				this.__sendLog( AutoSave.LOG_INFO, "User aborted the load in the onPostLoad handler" );
				this._registerInitQueue( -1 );
				return; //Cancel the load
			}
			else if ( rawUserInput === undefined || rawUserInput === true ) { 
				
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
		
		this._registerInitQueue( -1 );
	};
	
	//ALWAYS called at some time after the initial sequence of construction
	//May even be after an async call later etc.
	AutoSave.prototype._registerInitQueue = function( numOfRoutines ){
		
		this.__pendingInitRoutines += numOfRoutines;
		
		//Call the initialisation callback once after the load step
		if ( this.__pendingInitRoutines == 0 ) {
			
			var cb = this.__callbacks.onInitialised;
			if (cb) {
				
				this.__sendLog( AutoSave.LOG_DEBUG, "Invoking callback onInitialised" );
				cb();
			}
		}
	};
	
	
	//AlWAYS called before and after a save is invoked
	AutoSave.prototype._saveStartFinally = function( toggleOn ){
		
		this._toggleSavingNotification( toggleOn );
		
		this.__saveInProgress = toggleOn;

		//If a save has completed but another save is pending, kick it off
		if ( !toggleOn && this.__isPendingSave ){
			
			this.__isPendingSave = false;
			
			this._executeSave();
		}		
	};
		
	AutoSave.prototype._toggleNoStorageNotification = function( toggleOn ){
		
		var cb = this.__callbacks.onNoStorageNotification;
		
		if ( cb ){
			
			var rawUserInput = cb( toggleOn );
			
			//See @FUN Semantics
			if ( rawUserInput === false ) {

				this.__sendLog( AutoSave.LOG_INFO, "User aborted toggle no-storage bar" );
				return; //Cancel toggling it
			}
			else if ( rawUserInput === undefined || rawUserInput === true) { 
			
				//Do nothing - continue with toggling as normal
			}
			else {
			
				throw new Error( "Unexpected return type from callback 'onNoStorageNotification'" );
			}
		}
			
		if ( !toggleOn ){
			
			this._toggleSaveElementVisibility( this.__currWarnStorageNotificationElement, false );
		}
		else{
		
			this._toggleSaveElementVisibility( this.__currWarnStorageNotificationElement, true );
			
			//Switch off after a specific time
			setTimeout( this._toggleNoStorageNotification.bind( this, false ), 
						this.__warnMsgShowDuration );
		}
	};
	
	AutoSave.prototype._toggleSavingNotification = function( toggleOn ){
		
		var cb = this.__callbacks.onSaveNotification;
		
		if ( cb ){
			
			var rawUserInput = cb( toggleOn );
			
			//See @FUN Semantics
			if ( rawUserInput === false ) {

				this.__sendLog( AutoSave.LOG_INFO, "User aborted toggle save bar" );
				return; //Cancel toggling it
			}
			else if ( rawUserInput === undefined || rawUserInput === true) { 
			
				//Do nothing - continue with toggling as normal
			}
			else {
			
				throw new Error( "Unexpected return type from callback 'onSaveNotification'" );
			}
		}
			
		if ( !toggleOn ){
			
			//If it was already created from previously, ensure it's now visible
			if ( this.__autoToggleState === null ){
			
				//Interval has not yet elapsed, flag that auto toggle visibility should run after elapsed
				this.__autoToggleState = true;
			}
			else { //Interval has elapsed earlier, we need to toggle visibility ourself
			
				this._toggleSaveElementVisibility( this.__currSaveNotificationElement, false );
			}
		}
		else{
		
			this._toggleSaveElementVisibility( this.__currSaveNotificationElement, true );
			this.__autoToggleState = null;
			setTimeout( this.__resetNotificationDisplayBound, this.__minShowDuration );
		}
	};
	
	AutoSave.prototype._resetNotificationDisplay = function(){
		
		if ( this.__autoToggleState == true ){
			
			this._toggleSaveElementVisibility( this.__currSaveNotificationElement, false );
		}
		else { //Save is taking a bit of time - flag that normal flow should toggle visibility
			
			this.__autoToggleState = false;
		}
	};
	
	AutoSave.prototype._toggleSaveElementVisibility = function( currElement, toggleOn ){
		
		if ( !currElement ) {

			this.__sendLog( AutoSave.LOG_DEBUG, "No element found to toggle notification element visibility. Notification will not show/hide." );
			return;
			//else User probably cleared out showing notification through setting opts.saveNotification=null/opts.noStoreNotification=null
		}
		
		//Toggle display value
		var newStyle = toggleOn ? ( currElement.getAttribute("autosave-od") || "block" ) : "none";

		currElement.style.display = newStyle;
	};

		
	AutoSave.prototype._updateNoStorageNotification = function( noStorageNotification ){
		
		var renderOpts = AutoSave.cloneObj( AutoSave.DEFAULT_AUTOSAVE_WARN ); //clone for modifications
		
		if ( noStorageNotification === null ) {
			
			//Implies dont show notification
			this.__sendLog( AutoSave.LOG_DEBUG, "User requested no storage-warning notification bar. Skipping creation..." );
			this.__currWarnStorageNotificationElement = null;
		}
		else if ( noStorageNotification === undefined ){
			
			//Default behaviour
			this.__currWarnStorageNotificationElement = AutoSave._createNotification( renderOpts, null );
			this.__warnMsgShowDuration = renderOpts.duration;
		}
		else {
			
			var allowedOpts = [ "template", "message", "showDuration" ];
			AutoSave._ensureOptIn( noStorageNotification, allowedOpts, "noStorageNotification" );

			var template = noStorageNotification.template;
			var msg = noStorageNotification.message;
			var showDuration = noStorageNotification.showDuration;
			
			if ( showDuration !== undefined ){
				
				if ( typeof( showDuration ) == "number" ) {
				
					if ( showDuration <= 60 ){ //Must be a mistake
					
						throw new Error( "The 'showDuration' must be specified in milliseconds" );
					}
					else {
						
						this.__warnMsgShowDuration = showDuration;
						this.__sendLog( AutoSave.LOG_INFO, "Warning notification duration initialised with custom interval", 
							this.__warnMsgShowDuration);
					}
				}
				else{
					
					throw new Error( "Unexpected non-numeric type for parameter 'showDuration'" );
				}
			}
			else{
				
				this.__warnMsgShowDuration = renderOpts.duration;
			}

			if ( template && msg )
				throw new Error( "Only 1 of noStorageNotification.template or noStorageNotification.message can be set - not both" );
				
			if ( msg ) {
				
				renderOpts.msg = msg;
				this.__sendLog( AutoSave.LOG_DEBUG, "Warn Storage Notification bar with customised msg created." );
				this.__currWarnStorageNotificationElement = AutoSave._createNotification( renderOpts, null );
			}
			else if ( template ){
				
				renderOpts.msg = null;
				this.__sendLog( AutoSave.LOG_DEBUG, "Warn Storage Notification bar with customised template created." );
				this.__currWarnStorageNotificationElement = AutoSave._createNotification( renderOpts, template );
			} else {
				
				//Just the default
				this.__currWarnStorageNotificationElement = AutoSave._createNotification( renderOpts, null );
			}
		}
	};
	
	AutoSave.prototype._updateSaveNotification = function( saveNotificationOpts ){

		var renderOpts = AutoSave.cloneObj( AutoSave.DEFAULT_AUTOSAVE_SHOW ); //clone for modifications
					
		if ( saveNotificationOpts === null ) {
			
			//Implies dont show notification
			this.__sendLog( AutoSave.LOG_DEBUG, "User requested no saving notification bar. Skipping creation..." );
			this.__currSaveNotificationElement = null;
		}
		else if ( saveNotificationOpts === undefined ){
			
			//Default behaviour
			this.__currSaveNotificationElement = AutoSave._createNotification( renderOpts, null );
			this.__minShowDuration = renderOpts.duration;
		}
		else {
			
			var allowedOpts = [ "template", "message", "minShowDuration" ];
			AutoSave._ensureOptIn( saveNotificationOpts, allowedOpts, "saveNotification" );

			var template = saveNotificationOpts.template;
			var msg = saveNotificationOpts.message;
			var minShowDuration = saveNotificationOpts.minShowDuration;
			
			if ( minShowDuration !== undefined ){
				
				if ( typeof( minShowDuration ) == "number" ) {
				
					if ( minShowDuration <= 60 ){ //Must be a mistake
					
						throw new Error( "The 'minShowDuration' must be specified in milliseconds" );
					}
					else {
						
						this.__minShowDuration = minShowDuration;
						this.__sendLog( AutoSave.LOG_INFO, "Saving Min duration initialised with custom interval", this.__minShowDuration);
					}
				}
				else{
					
					throw new Error( "Unexpected non-numeric type for parameter 'minShowDuration'" );
				}
			}
			else{
				
				this.__minShowDuration = renderOpts.duration;
			}

			if ( template && msg )
				throw new Error( "Only 1 of saveNotification.template or saveNotification.message can be set - not both" );
				
			if ( msg ) {
				
				renderOpts.msg = msg;
				this.__sendLog( AutoSave.LOG_DEBUG, "Saving Notification bar with customised msg created." );
				this.__currSaveNotificationElement = AutoSave._createNotification( renderOpts, null );
			}
			else if ( template ){
				
				renderOpts.msg = null;
				this.__sendLog( AutoSave.LOG_DEBUG, "Saving Notification bar with customised template created." );
				this.__currSaveNotificationElement = AutoSave._createNotification( renderOpts, template );
			} else {
				
				//Just the default
				this.__currSaveNotificationElement = AutoSave._createNotification( renderOpts, null );
			}
		}
	};

	AutoSave.prototype._executeSave = function(){
	
		if ( this.__saveInProgress ){
			
			this.__sendLog( AutoSave.LOG_WARN, 
			"Save was postponed as one already in progress. (Did you remember to invoke the saveComplete callback?)" );
			
			this.__isPendingSave = true;
			
			return;
		}
		
		this._saveStartFinally( true );
	
		//Get controls to serialize - guaranteed to be an array
		var controlsArr = this.__getRootControlsFunc();
		
		//Serialize all control values
		var cb = this.__callbacks.onPreSerialize;
		
		if ( cb ) {
			
			this.__sendLog( AutoSave.LOG_DEBUG, "Invoking callback onPreSerialize" );
			var rawUserInput = cb( controlsArr );

			//See @FUNC Semantics
			if ( rawUserInput === false ) {

				this.__sendLog( AutoSave.LOG_INFO, "User aborted the save in the onPreSerialize handler" );
				this._saveStartFinally( false );
				return; //Cancel the save
			}
			else if ( rawUserInput === undefined || rawUserInput === true ) { 
			
				//Do nothing - continue with the save
			}
			else if ( rawUserInput === null ) { //User override
			
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
			if ( rawUserInput === false ) {
				
				this.__sendLog( AutoSave.LOG_INFO, "User aborted the save in the onPreStore handler" );
				this._saveStartFinally( false );
				return; //Cancel the save
			}
			else if ( rawUserInput === undefined || rawUserInput === true ) { 
			
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
	};

	AutoSave.prototype._onSaveCompleted = function(){

		//Inspection hook for what was sent - should be invoked asychronously after return from store
		var cb = this.__callbacks.onPostStore;
		
		if ( cb ){
			
			this.__sendLog( AutoSave.LOG_DEBUG, "Invoking callback onPostStore" );
			cb();
		}
		
		this._saveStartFinally( false );
	};
	
	//This function sets up where to save the data
	AutoSave.prototype._updateDataStore = function( dataStore ){
		
		var hasLocalStorage = AutoSave.isLocalStorageAvailable();
		var hasCookieStorage = AutoSave.isCookieStorageAvailable();
		
		this.__sendLog( AutoSave.LOG_DEBUG, "Has Local Storage: ", hasLocalStorage, ", Has Cookie Storage: ", hasCookieStorage );
		
		var elems = this.__getRootControlsFunc();
		
		this.__dataStoreKeyFunc = this.__invokeExt( AutoSave._getKeyFunc, elems, !dataStore ? undefined : dataStore.key );
			
		//If not set at all, default it 
		if ( dataStore === undefined ){
			
			if ( hasLocalStorage )
				this.__theStore = new _LocalStore( this.__dataStoreKeyFunc, this.__invokeExtBound );
			else if ( hasCookieStorage )
				this.__theStore = new _CookieStore( this.__dataStoreKeyFunc, this.__invokeExtBound );
			else {
				
				this.__warnNoStore = true;
				this.__theStore = new _NoStore( this.__invokeExtBound );
			}
		}
		//If expicitly null, don't load or store anywhere
		else if ( dataStore === null ){

			//Do nothing
			this.__theStore = new _NoStore( this.__invokeExtBound );
		}
		else if ( typeof( dataStore ) == "object" ){ // Url-based / custom
			
			var allowedOpts = [ "save", "load", "key", "preferCookies", "clearEmptyValuesOnLoad" ];
			
			AutoSave._ensureOptIn( dataStore, allowedOpts, "dataStore" );

			this.__clearEmptyValuesOnLoad = dataStore.clearEmptyValuesOnLoad;
						
			//DEMO: How to ask user to enable cookies
			
			if ( dataStore.load === undefined && dataStore.save === undefined ) {
				
				//Take user's preference into account first
				if ( hasCookieStorage && dataStore.preferCookies === true ) {
					
					this.__theStore = new _CookieStore( this.__dataStoreKeyFunc, this.__invokeExtBound );
				}
				else if ( hasLocalStorage ) {
					
					this.__theStore = new _LocalStore( this.__dataStoreKeyFunc, this.__invokeExtBound );
				}
				else if ( hasCookieStorage ) {
					
					this.__theStore = new _CookieStore( this.__dataStoreKeyFunc, this.__invokeExtBound );
				}
				else {
					
					this.__warnNoStore = true;
					this.__theStore = new _NoStore( this.__invokeExtBound );
				}
			}
			else if ( dataStore.load === null && dataStore.save === null ) {
				
				//User explicitly does not want to load from anywhere
				this.__theStore = new _NoStore( this.__invokeExtBound );
			}
			else if ( typeof( dataStore.load ) != "function" || typeof( dataStore.save ) != "function" ) {

				throw new Error( "The dataStore.load and dataStore.save parameters must 1) both be set or both be unset and 2) must be functions." );
			}
			else {
				
				this.__theStore = 
					this.__invokeExt( 
						AutoSave.getCtor ( 
							_CustomStore, this.__dataStoreKeyFunc, dataStore.save, dataStore.load, this.__invokeExtBound ) );
			}
		}
		else {
			
			throw new Error( "Unexpected type of parameter 'dataStore'" );
		}
	};
	
	AutoSave.prototype.__invokeExt = function( funcToRun, __variadic_args__ ){
	
		//Temporary redirect the AutoSave.log call while invoking external callers so logging knows our context
		//and hence our callbacks
		var prevLogger = AutoSave.log;
		
		try{
			
			AutoSave.log = this.__invokeExtBound;
			
			var args = AutoSave.toArray( arguments, 1 );
			
			return funcToRun.apply( null, args );
		}
		finally{
			
			AutoSave.log = prevLogger;
		}
	};
	
	AutoSave.prototype.__sendLog = function( level, __variadic_args__ ){

		 var cb = this.__callbacks.onLog;
		 
		 var args;
		 
		 if ( cb ) {
			 
			 var funcToCall;
			 var funcArgs;
			 if ( typeof cb == "function" ){
				 
				 funcToCall = cb;
				 funcArgs = arguments;
			 }
			 else if ( typeof cb == "object" ){
				 
				 funcToCall = cb[ level ];
				 
				 if ( !funcToCall ){
					 
					 //Match for this log level not found, skip the message, assume user doesnt want to log at this level
					 
					 return;
				 }
					 
				 funcArgs = AutoSave.toArray( arguments, 1 ); //Excluding the level
			 }
			 else{
				 
				throw new Error( "Unexpected type of callback parameter 'dataStore'" );
			 }
		 
			 var ret = funcToCall.apply( this, funcArgs );
			 
			 //See @FUN semantics
			 if ( ret === false ) {
				 
				 //Abort
				 return;
			 }
			 else if ( ret === undefined || ret === true ){
				 
				 //continue
				 args = arguments;
			 }
			 else {//could be string, object, anything user specifies take as-is
				 
				 //Preserve the level and treat array specially
				 if ( ret && ret.length )
					args = [ level ].concat( ret );
				 else
					args = [ level, ret ];
			 }
		 }
		 else {
			
			 args = arguments;
		 }
		 
		 AutoSave._logToConsole.apply( this, args );
	};
	
	AutoSave.prototype._onUnloading = function( event ){
	
	  //As user is about to leave page, just save any pending changes
	  if ( this.__debounceTimeoutHandle ) {
		  
		  this._handleDebouncedEvent();
	  }
	};
	
	//This function sets up when to save the state
	AutoSave.prototype._updateAutoSaveStrategy = function( saveTrigger, seekExternalFormElements ){
		
		if ( saveTrigger === null ){
			
			//Only when invoked - i.e. do nothing

			this.__sendLog( AutoSave.LOG_INFO, "Auto-Save trigger was disabled" );
			return;
		}
		else if ( saveTrigger === undefined ) {

			this.__debounceInterval = AutoSave.DEFAULT_AUTOSAVE_INTERVAL;
			this.__sendLog( AutoSave.LOG_INFO, "Auto-Save trigger was initialised with default interval", this.__debounceInterval );
		}
		else if ( typeof( saveTrigger ) == "object" ) {

			var allowedOpts = [ "debounceInterval" ];
			
			AutoSave._ensureOptIn( saveTrigger, allowedOpts, "autoSaveTrigger" );
		
			//At regular intervals in milliseconds
			var debounceInterval = saveTrigger.debounceInterval;
			
			if ( typeof( debounceInterval ) == "number" ) {
			
				if ( debounceInterval <= 60 ){ //Must be a mistake
				
					throw new Error( "The 'debounceInterval' must be specified in milliseconds" );
				}
				else {
					
					this.__debounceInterval = debounceInterval;
					this.__sendLog( AutoSave.LOG_INFO, "Auto-Save trigger was initialised with custom interval", this.__debounceInterval );
				}
			}
			else{
				
				throw new Error( "Unexpected non-numeric type for parameter 'debounceInterval'" );
			}
		}	
		else{
		
			throw new Error( "Unexpected type for parameter 'autoSaveTrigger'" );
		}
			
		//Default strategy - on control leave, select change etc.
		this._hookListeners( true, seekExternalFormElements );
	};

	AutoSave.prototype._updateRootControls = function( parentElement, seekExternalFormElements ) {
	
		if ( !parentElement ) { //Both undefined (so they neednt specify) and null (so they can skip over to set opts)
		
			this.__sendLog( AutoSave.LOG_DEBUG, "No parent element specified - will use whole document" );
			
			parentElement = document.body;
		}
		
		if ( typeof( parentElement ) == "function" ){
		
			//Customise the set of controls used - calculated dynamically from user's function
			this.__getRootControlsFunc = function() {
			
				var rawUserInput = parentElement();
				
				if ( !rawUserInput ){
					
					this.__sendLog( AutoSave.LOG_INFO, "User specified custom function returned empty set of elements" );
					return []; //Always standardise to an array
				}
				else{
					
					var elems = this._getControlsFromUserInput( rawUserInput );
					
					this.__sendLog( AutoSave.LOG_INFO, "Extracted "+elems.length+" root level controls from user specified input" );
					
					if ( seekExternalFormElements ){
						
						var externalElems = this.__invokeExt( AutoSave.getExternalFormControls, elems );
						this.__sendLog( AutoSave.LOG_INFO, "Found "+externalElems.length+" external form-linked controls" );
						
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
			var elems = this._getControlsFromUserInput( parentElement );
			
			//If user-supplied parameter didn't resolve to any elements, throw, as there will be nothing to listen to.
			//Except if explicitly specified an empty [] so continue 
			if ( !Array.isArray(parentElement) && elems.length == 0 ){
				
				this.__sendLog( AutoSave.LOG_WARN, "RootControls parameter resolved to zero elements - maybe your selector(s) werent right?" );
			}
			else{
				
				this.__sendLog( AutoSave.LOG_INFO, "Extracted "+elems.length+" root level controls" );
			}
		
			//Find all elements that use a 'form=...' attribute explicitly and assume they're outside the root control set so capture them
			if ( seekExternalFormElements ) {
				
				var externalElems = this.__invokeExt( AutoSave.getExternalFormControls, elems );
				this.__sendLog( AutoSave.LOG_INFO, "Found "+externalElems.length+" external form-linked controls" );
				
				for( var idx = 0; idx < externalElems.length; idx++ ){
					
					elems.push( externalElems[ idx ] );
				}
			}
		
			this.__getRootControlsFunc = function() {
			
				return elems;
			};
		}
	};

	AutoSave.prototype._hookUnloadListener = function( hookOn ){
		
		if ( hookOn )
			window.addEventListener("beforeunload", this.__onUnloadingBound );
		else
			window.removeEventListener("beforeunload", this.__onUnloadingBound );
	};
	
	AutoSave.prototype._hookListeners = function( hookOn, seekExternalFormElements ){ 

		this.__sendLog( AutoSave.LOG_DEBUG, 
						( hookOn?"Hooking":"Unhooking")+
						" listeners. Seeking external controls for hooking: "+seekExternalFormElements );
		
		//controlsArr is never null by post-condition of _updateRootControls
		var controlsArr = this.__getRootControlsFunc();
		
		for( var ctrlIdx=0; ctrlIdx<controlsArr.length; ctrlIdx++ ){
			
			var child = controlsArr[ ctrlIdx ];
			
			this._hookSingleControl ( child, hookOn );
		}
	};
	
	AutoSave.prototype._hookSingleControl = function( child, hookOn ){

		if ( hookOn ) {
			
			//'change' event is primarily for checkboxes and radios for browsers - 'historical reasons'
			//But we can hook both as we'll debounce changes anyway
			child.addEventListener( "input",  this, AutoSave.__defaultListenOpts );
			child.addEventListener( "change", this, AutoSave.__defaultListenOpts );
		}
		else {
			
			child.removeEventListener( "input",  this, AutoSave.__defaultListenOpts );
			child.removeEventListener( "change", this, AutoSave.__defaultListenOpts );
		}
	};
	
	//Standard name for event handler
	AutoSave.prototype.handleEvent = function( ev ){
		
		this.__sendLog( AutoSave.LOG_DEBUG, "Handling raw control input event", ev );
		
		//If already have a timer running, return
		if ( this.__debounceTimeoutHandle ){
			
			return;
		}
				
		this.__debounceTimeoutHandle = setTimeout( this.__handleDebouncedEventBound, this.__debounceInterval );
	};
		
	AutoSave.prototype._handleDebouncedEvent = function() {
		
		this.__sendLog( AutoSave.LOG_DEBUG, "Handling debounced control input event" );
		this.__sendLog( AutoSave.LOG_INFO, "Executing save: after element(s) changed" );
		
		this.__debounceTimeoutHandle = null;

		this._executeSave();
	};
	
	//Parameter should NOT be falsy here - should be handled beforehand by caller based on context
	//Always returns a non-null array
	AutoSave.prototype._getControlsFromUserInput = function( rawUserInput ){
		
		var elems;
		
		if ( typeof( rawUserInput ) == "string" ) {//selector
		
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
	};
	
	AutoSave.prototype.deserialize = function( fieldDataStr, clearEmpty ){
		
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
		
		var fieldData = this.__invokeExt( AutoSave._decodeFieldDataFromString,  fieldDataStr );
		
		for( var idx = 0; idx < controlsArr.length ; idx++ ) {

			var child = controlsArr[ idx ];
			
			this.__invokeExt( AutoSave._deserializeSingleControl, child, fieldData, clearEmpty );
		}
	};
		
	//Returns the serialized string in the standard format(?) - 
	//Must return a string instance - even if empty - as callback hooks assume it
	
	//TODO: make into a static?
	
	AutoSave.prototype.serialize = function( rootControlsArr ){
		
		var fieldData = [[],[]];
		
		for( var idx=0 ; idx<rootControlsArr.length ; ++idx ) {
		
			this.__invokeExt( AutoSave._serializeSingleControl, rootControlsArr[ idx ], fieldData );
		}
		
		var fieldDataStr = this.__invokeExt( AutoSave._encodeFieldDataToString, fieldData );
		
		return fieldDataStr;
	};
	
	/* Additional 'classes' */
	function _CookieStore( keyFunc, logSink ){
		
		this._logSink = logSink;
		this._logSink( AutoSave.LOG_INFO, "Using cookie storage as local store" );
		
		if ( !navigator.cookieEnabled ){
			
			this._logSink( AutoSave.LOG_WARN, "Cookie Store requested but cookies not enabled." );
		}

		this.__currStoreKeyFunc = keyFunc;
	}
		
	_CookieStore.prototype.load = function( loadCompleted ){
		
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
	};

	_CookieStore.prototype.save = function( data, saveCompleted ){
		
		var key = this.__currStoreKeyFunc();
		
		//Could be specified in the preStoreHook or the resetStore() to clear it out
		if ( data === null ){
			
			data = AutoSave._buildFullCookieStr( key, "", { expireNow: true} );
		}
		
		//We know data has been moulded to a cookie format already so save straight down
		document.cookie = data;
		
		saveCompleted();
	};
		
	_CookieStore.prototype.mouldForOutput = function( data ) {
		
		var key = this.__currStoreKeyFunc();

		var cookieParamsStr = AutoSave._buildFullCookieStr( key, data, { neverExpire: true} );
		
		this._logSink( AutoSave.LOG_DEBUG, "Created cookie params string", cookieParamsStr );
		
		return cookieParamsStr;
	};
		
	_CookieStore.prototype.resetStore = function( clearCompleted ){
		
		return this.save( null, clearCompleted );
	};

	function _LocalStore( keyFunc, logSink ){
		
		this._logSink = logSink;
		this._logSink( AutoSave.LOG_INFO, "Using Browser Local Storage as local store" );
		
		this.__currStoreKeyFunc = keyFunc;
	}
		
	_LocalStore.prototype.load = function( loadCompleted ){

		var key = this.__currStoreKeyFunc();

		var data = localStorage.getItem( key );
		
		loadCompleted( data );
	};
		
	_LocalStore.prototype.save = function( data, saveCompleted ) {

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
	};
	
	_LocalStore.prototype.mouldForOutput = function( data ){
		
		return data;
	};
	
	_LocalStore.prototype.resetStore = function( clearCompleted ){
		
		return this.save( null, clearCompleted );
	};

	function _NoStore( logSink ){
		
		this._logSink = logSink;
		this._logSink( AutoSave.LOG_INFO, "Using a no-op data store" );
	}
	
	_NoStore.prototype.load = function( loadCompleted ){
		
		loadCompleted( null );
	};
	
	_NoStore.prototype.save = function( data, saveCompleted ){
		
		saveCompleted();
	};

	_NoStore.prototype.mouldForOutput = function( data ){
		
		return data;
	};
	
	_NoStore.prototype.resetStore = function(){
		
		//No-op
	};
	
	//Assumes save and load parameters are valid functions
	function _CustomStore( keyFunc, userSaveFunc, userLoadFunc, logSink ){
		
		this._logSink = logSink;
		
		this._logSink( AutoSave.LOG_INFO, "Using a custom store as the local store" );
		
		if ( userLoadFunc.length != 2 ) {
			
			throw new Error( "dataStore.load function must take 2 parameters." );
		}
		
		if ( userSaveFunc.length != 3 ) {
			
			throw new Error( "dataStore.save function must take 3 parameters." );
		}

		this.__currStoreKeyFunc = keyFunc;
		this.__userLoadFunc = userLoadFunc;
		this.__userSaveFunc = userSaveFunc;
	}
				
	_CustomStore.prototype.load = function( loadCompleted ){

		var key = this.__currStoreKeyFunc();
		
		return this.__userLoadFunc( key, loadCompleted );
	};
	
	_CustomStore.prototype.save = function( data, saveCompleted ) {

		//AutoSaveJS-specific prefix
		var key = this.__currStoreKeyFunc();

		return this.__userSaveFunc( key, data, saveCompleted );
	};

	_CustomStore.prototype.mouldForOutput = function( data ){
		
		return data;
	};
	
	_CustomStore.prototype.resetStore = function( clearCompleted ){
		
		return this.save( null, clearCompleted );
	};

	//optObj must not be null
	AutoSave._ensureOptIn = function( optObj, allowedValues, optDesc ){
		
		//Only verify level of options, not base members
		var optKeys = Object.keys( optObj );
		
		for( var idx in optKeys ) {
			
			 var optKey = optKeys[ idx ];

			 if ( allowedValues.indexOf( optKey ) == -1 ) {
				
				  throw new Error( "Unexpected parameter '" + optKey + "' in " + optDesc + " options object" );
			 }
		}
	};
		
	AutoSave.whenDocReady = function( funcToRun ){

		//We can't log too prematurely as onLog handling will not be in place yet
		if ( document.readyState == "complete" ){
			
			funcToRun();
		}
		else {
					
			//Keep looping until it's ready - compromise between code-size, x-browser compatability
			var loadIntervalHandle = setInterval( function(){
		
				if ( document.readyState == "complete" ){
				
					clearInterval( loadIntervalHandle );
					
					funcToRun();
					
					AutoSave.log( AutoSave.LOG_DEBUG, "Document was late initialised - completed AutoSave initialisation sequence" );
				}
			}, AutoSave.DEFAULT_LOAD_CHECK_INTERVAL );
		}
	};

	AutoSave._getKeyFunc = function( parentElems, rawUserOption ){
		
		//Create a prefix so we can uniquely identify storage by AutoSaveJS and for this particular page
		var mandatedPrefix = AutoSave.DEFAULT_KEY_PREFIX + AutoSave.getUrlPath();
		
		//User-supplied option takes precedence - we dont validate uniqueness etc. but trust what they're doing
		if ( rawUserOption !== undefined ){
		
			if ( typeof( rawUserOption ) == "string" ){
				
				var fullKey = mandatedPrefix + "_" + rawUserOption;
				
				AutoSave.log( AutoSave.LOG_INFO, "Using static provided value for datastore key", fullKey );
		
				return function(){
					
					return fullKey;
				};
			}
			else if ( typeof( rawUserOption ) === "function" ){
				
				AutoSave.log( AutoSave.LOG_DEBUG, "Using user-supplied function for generating datastore key when required" );
				
				return function(){
					
					//Dynamically recalc every time
					var val = mandatedPrefix + "_" + rawUserOption();

					AutoSave.log( AutoSave.LOG_DEBUG, "Calculated dynamic datastore key to use", val );
					
					return val;
				};
			}
			else{
				
				throw new Error( "Unexpected type of parameter 'dataStore.key'" );
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
				
				keyValue = mandatedPrefix + "_" + keyValue;
			}
			else{
				
				keyValue = mandatedPrefix;
			}
			
			AutoSave.log( AutoSave.LOG_INFO, "Using calculated value for datastore key", keyValue );
				
			if ( AutoSave.__keysInUse.indexOf( keyValue ) != -1 ){
				
				throw new Error( "There is already an AutoSave instance with the storage key of '"+keyValue+
				"'. See the documentation for solutions." );
			}
			
			AutoSave.__keysInUse.push( keyValue );
			
			AutoSave.log( AutoSave.LOG_DEBUG, "Updated set of keys in use", AutoSave.__keysInUse );
			
			return function(){
				
				return keyValue;
			};
		}
	};

	//Looks at a single control and it's children and returns an array of serialised object strings
	AutoSave._serializeSingleControl = function( child, fieldData ){

		var nameKey = child.name;
		var value = child.value;
		
		if ( child.nodeName == "INPUT" ) {
		
			//We only serialise controls with names (else we'll get, e.g., '=Oscar&=Mozart')
			if ( !nameKey ) {

				AutoSave.log( AutoSave.LOG_DEBUG, "Ignored INPUT node as no name was present", child );
				return;
			}
			
		   if ( child.type == "radio" || child.type == "checkbox" ){
			
				if ( child.checked ) {
					
					fieldData[ 0 ].push( nameKey );
					fieldData[ 1 ].push( value );
				}
			}
			else{ //Implicitly an <input type=text|button|password|hidden...>
			
				fieldData[ 0 ].push( nameKey );
				fieldData[ 1 ].push( value );
			}
		}
		else if ( child.nodeName == "SELECT" ){
		
			//We only serialise controls with names (else we'll get, e.g., '=Oscar&=Mozart')
			if ( !nameKey ) {

				AutoSave.log( AutoSave.LOG_DEBUG, "Ignored SELECT node as no name was present", child );
				return;
			}
		
			if ( child.type == "select-one" ){
			
				fieldData[ 0 ].push( nameKey );
				fieldData[ 1 ].push( value );
			}
			else { //Must be of type == 'select-multiple'
			
				var sChildren = child.options;
				for( var sIdx = 0 ; sIdx < sChildren.length ; ++sIdx ){
				
					if ( sChildren[sIdx].selected ) {
					
						fieldData[ 0 ].push( nameKey );
						fieldData[ 1 ].push( sChildren[ sIdx ].value );
					}
				}
			}
		}
		else if ( child.nodeName == "TEXTAREA" ) {
		
			//We only serialise controls with names (else we'll get, e.g., '=Oscar&=Mozart')
			if ( !nameKey ) {

				AutoSave.log( AutoSave.LOG_DEBUG,"Ignored TEXTAREA node as no name was present", child );
				return;
			}
		
			fieldData[ 0 ].push( nameKey );
			fieldData[ 1 ].push( value );
		}
		else {
		
			//May be, e.g., a form or div so go through all children
			var sChildren = child.children;
			for( var sIdx = 0 ; sIdx < sChildren.length ; sIdx++ ){
				
				AutoSave._serializeSingleControl( sChildren[ sIdx ], fieldData );
			}
		}
	};

	AutoSave._encodeFieldDataToString = function( fieldData ){
			
		var fieldDataStr = "";
		for( var fieldIdx in fieldData[ 0 ] ){
			
			var name  = fieldData[ 0 ][ fieldIdx ];
			var value = fieldData[ 1 ][ fieldIdx ];
			
			fieldDataStr += encodeURIComponent( name ) + "=" + encodeURIComponent( value );
			
			if ( fieldIdx != fieldData[ 0 ].length - 1 )
				fieldDataStr += "&";
		}

		fieldDataStr = fieldDataStr.replace( /%20/g,"+" );

		return fieldDataStr;
	};

	AutoSave._decodeFieldDataFromString = function( fieldDataStr ){
		
		fieldDataStr = fieldDataStr.replace( /\+/g,"%20" );
		
		//Reconstruct a field data object from the string
		var fieldData = [ [],[] ];
		var pairs = fieldDataStr.split( "&" );
		
		for( var pairIdx in pairs ){
			
			var pair = pairs[ pairIdx ];
			var items = pair.split( "=" );
			
			if ( items.length != 2 ) {
				
				AutoSave.log( AutoSave.LOG_WARN, "Expected a pair of items separated by '=' in "+pair+". Got "+items.length+". Ignoring..." );
			}
			else{
				
				var key = decodeURIComponent( items[ 0 ] );
				var value = decodeURIComponent( items[ 1 ] );
				fieldData[ 0 ].push( key );
				fieldData[ 1 ].push( value  );
			}
		}
			
		return fieldData;
	};

	AutoSave.addSerialisedValue = function( szString, key, value ){
		
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
		var encoded = AutoSave._encodeFieldDataToString( ret );
		szString += encoded;
		
		return szString;
	};

	//Will ALWAYS return a non-null array
	AutoSave.getSerialisedValues = function( szString, key ){
		
		if ( !key ) {
			
			throw new Error( "No key specified" );
		}
		
		if ( !szString ) {
			
			return [];
		}

		var decoded = AutoSave._decodeFieldDataFromString( szString );
		
		var ret = [];
		for( var i in decoded[ 0 ] ) {
			
			if ( decoded[ 0 ][ i ] == key ) {
				
				ret.push( decoded[ 1 ][ i ] );
			}
		}

		return ret;
	};

	AutoSave._deserializeSingleControl = function( child, fieldData, clearEmpty ){

		var fieldValue = null;
		var runStd = false;
		
		if ( child.nodeName == "INPUT" ){
		
		   if ( child.type == "radio" || child.type == "checkbox" ) {
		   
				//For these, we need to check not only that the names exists but the value corresponds to this element.
				//If it corresponds, we need to 
				//	- If clearEmpty = true, also uncheck all those items with the same name that aren't in the field data.
				//	- Else leave the element's value intact
				//If theres no kvp that corresponds to this name, always leave the elements intact.
				
				var foundField = null;
				
				for ( var fieldIdx in fieldData[ 0 ] ) {
				
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
		
			var sChildren = child.options;
			
			outer:
			for ( var childIdx = 0 ; childIdx < sChildren.length ; childIdx++ ) {
				
				var opt = sChildren[ childIdx ];
				
				for ( var fieldIdx in fieldData[ 0 ] ) {
				
					if ( fieldData[ 0 ][ fieldIdx ] == child.name ) { //Data field with this select's name
						
						var fieldValue = fieldData[ 1 ][ fieldIdx ];
						
						if ( fieldValue == opt.value ) { //Data field with this option's value
						
							if ( fieldValue !== "" || clearEmpty ) //Only change selected option to blank if allowed
								opt.selected = true;
							
							if ( child.type == "select-one" )
								break outer; //Only one option can be selected for this select, we found it, bail
							else
								break; //There may be more options for this select, keep going through all data fields
						}
					}
				}
			}
		}
		else if ( child.nodeName == "TEXTAREA" ) { //All other :inputs types - textarea, HTMLSelect etc.

			runStd = true;
		}
		else {
									
			//May be, e.g., a form or div so go through all children
			var sChildren = child.children;
			for( var sIdx = 0; sIdx < sChildren.length; sIdx++ ){
				
				AutoSave._deserializeSingleControl( sChildren[ sIdx ], fieldData, clearEmpty );
			}
		}
		
		if ( runStd ) {
			
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
	};

	AutoSave._parseExternalElemsArg = function( seekExternalFormElements ){
		
		//Default hook external controls to true
		if ( seekExternalFormElements === undefined )
			seekExternalFormElements = true;
		else if ( seekExternalFormElements === false ||
				  seekExternalFormElements === true)
		{ /* Valid */ }
		else
			throw new Error( "Unexpected type for parameter 'seekExternalFormElements'" );

		return seekExternalFormElements;
	};

	//From MDN - @https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API#Feature-detecting_localStorage
	//Even though local storage is supported in browsers AutoSaveJS supports, still need to check for Safari
	AutoSave.isLocalStorageAvailable = function() {
		
		if ( AutoSave.__cachedLocalStorageAvailable === undefined ) {
		
			var storage;
			
			try {
				
				storage = window.localStorage;
				var x = '__ASJS_test__';
				storage.setItem( x, "_" );
				storage.removeItem( x );
				
				AutoSave.__cachedLocalStorageAvailable = true;
			}
			catch( e ) {
				
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
					e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ) &&
					// acknowledge QuotaExceededError only if there's something already stored
					storage && storage.length !== 0 ) ;
			}
		}
		
		return AutoSave.__cachedLocalStorageAvailable;
	};

	//From Modernizr
	AutoSave.isCookieStorageAvailable = function(){
		
		if ( AutoSave.__cachedCookiesAvailable === undefined ) {
		
			//This property works in all but IE<11
			if ( navigator.cookieEnabled ){
				
				AutoSave.__cachedCookiesAvailable = true;
			}
			else {
				// Create and test cookie
				document.cookie = "AutoSave_cookietest=1";
				AutoSave.__cachedCookiesAvailable = document.cookie.indexOf( "AutoSave_cookietest=" ) != -1;
				
				// Delete cookie
				document.cookie = "AutoSave_cookietest=1; expires=Thu, 01-Jan-1970 00:00:01 GMT";
			}
		}
		
		return AutoSave.__cachedCookiesAvailable;
	};

	AutoSave._uniq = function( value, index, self ) {

		return self.indexOf( value ) === index;
	};

	AutoSave._buildFullCookieStr = function( key, data, opts ) {
		
		if ( !key ){
			
			throw new Error( "No key specified for saving to cookie" );
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
	};

	//Clears AutoSaveJS state from all data stores as this may be a pain to clear up otherwise (as will persist across page refreshes etc)
	//Dont unhook listeners etc as dispose will do that + refresh can always be done.
	AutoSave.resetAll = function(){
		
		//Remove reserved keys
		AutoSave.__keysInUse = [];
			
		//Iterate and remove all AutoSaveJS local storage
		if ( AutoSave.isLocalStorageAvailable() ) {
			
			for (var i = localStorage.length - 1; i >= 0; i--) {
				
				var key = localStorage.key( i );
				
				if (key && key.indexOf( AutoSave.DEFAULT_KEY_PREFIX ) === 0){
					
					localStorage.removeItem( key );
				}
			}
		}
		
		//Iterate and delete all AutoSaveJS cookies - regex from MDN
		var aKeys = document.cookie.replace( /((?:^|\s*;)[^\=]+)(?=;|$)|^\s*|\s*(?:\=[^;]*)?(?:\1|$)/g, "" ).split( /\s*(?:\=[^;]*)?;\s*/ );
		
		for (var nIdx = 0; nIdx < aKeys.length; nIdx++) { 
		
			var key = decodeURIComponent( aKeys[ nIdx ] );
			
			if ( key.indexOf(AutoSave.DEFAULT_KEY_PREFIX) === 0 ) {
				
				var str = AutoSave._buildFullCookieStr( key, "", { expireNow: true} );
				
				document.cookie = str;
			}
		}
	};

	AutoSave.getExternalFormControls = function( elems ){

		var formNames = [];
		
		for( var idx = 0; idx < elems.length; idx++ ){
			
			var elem = elems[ idx ];
			
			if ( elem.nodeName == "FORM" ){
				
				var id = elem.id;
				if ( id ){
					
					formNames.push( id );
				}
			}
			else
			{
				var nestedForms = elem.querySelectorAll( "form" );
				
				for( var nIdx = 0; nIdx < nestedForms.length; nIdx++ ){
					
					var nElem = nestedForms[ nIdx ];
					
					if ( nElem.nodeName == "FORM" ){
						
						var id = nElem.id;
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
		var externalElems;
		if ( formNames.length ){
			
			var selector = "[form='" + formNames.join( "'],[form='" ) + "']";
			
			AutoSave.log( AutoSave.LOG_DEBUG, "Querying for external form controls with selector", selector );
			externalElems = document.querySelectorAll( selector );
		}
		else{
			
			externalElems = [];
		}
		
		return externalElems;
	};

	AutoSave.getCtor = function( constructor , __variadic_args__ ){
		
		var currArgs = AutoSave.toArray( arguments, 1 ); //Bypass constructor argument
		
		return function(){
			
			var args = [ null ].concat( currArgs );
			var factoryFunction = constructor.bind.apply( constructor, args );
			return new factoryFunction();
		};
	};

	AutoSave.toArray = function( arrayLike, skipStartEntries ){
		
		var currArgs = [];
		
		for( var i=0; i<arrayLike.length; i++ )
			currArgs.push( arrayLike[ i ] );
		
		if ( skipStartEntries )
			currArgs = currArgs.slice( skipStartEntries );
		
		return currArgs;
	};

	AutoSave._logToConsole = function( logLevel, __variadic_args__ ){

		var args = AutoSave.toArray( arguments, 1 ); //Skip logLevel

		if ( logLevel == AutoSave.LOG_DEBUG )
		{
			if ( console.debug ) 
				console.debug.apply( console, args );
			else
				console.log.apply( console, args ); //Distinguish from info level incase users need it
		}
		else if ( logLevel == AutoSave.LOG_INFO )
			console.info.apply( console, args );
		else if ( logLevel == AutoSave.LOG_WARN )
			console.warn.apply( console, args );
		else if ( logLevel == AutoSave.LOG_ERROR )
			console.error.apply( console, args );
		else
			throw new Error( "Unknown log level: " + logLevel );
	};

	//Exactly 1 of renderOpts.msg or entireHtml must be non-null
	AutoSave._createNotification = function( renderOpts, entireHtml ){
		
		var elem;
		if ( entireHtml ) {
		
			var tempContainer = document.createElement( "div" );
			
			tempContainer.innerHTML = entireHtml;
			
			if ( tempContainer.children.length != 1 )
				throw new Error( "Expected exactly 1 top-level element in saveNotification.template" );
			
			elem = tempContainer.children[ 0 ];
		}
		else {
			
			elem = document.createElement( "div" );
			elem.classList.add( "autosave-ctr" );
			elem.classList.add( "autosave-" + renderOpts.type );
			AutoSave._styleNotificationElem( elem );
			
			if ( renderOpts.bg )
				elem.style.backgroundColor = renderOpts.bg;
			
			if ( renderOpts.marginLeft )
				elem.style.marginLeft = renderOpts.marginLeft;
			
			elem.innerHTML = "<span class='autosave-msg'>" + renderOpts.msg + "</span>";
		}
		
		if ( elem.style.display == "none" ) {
			
			AutoSave.log( AutoSave.LOG_WARN, "Notification HTML template should not have a display style of 'none' or it'll never show" );
		}
		
		//Preserve the user's original display style for when we're toggling
		elem.setAttribute( "autosave-od", elem.style.display );

		//Initially hidden
		elem.style.display = "none";
		
		document.body.appendChild( elem );
		
		return elem;
	};

	AutoSave._styleNotificationElem = function(elem){
		
		var s = elem.style;
		
		s.position = "fixed";
		s.top = "5px";
		s.left = "50%"; //Needs to be used in conjunction with margin-left
		s.border = "1px solid #adabab";
		s.padding = "3px 30px";
		s.borderRadius = "2px";
		s.color = "#484848";
	};

	//IE doesnt support Object.assign so implement ourself. Assumes a shallow clone.
	AutoSave.cloneObj = function( obj ){
		
		var ret = {};
		for(var key in obj){
			ret[ key ] = obj[ key ];
		}
		return ret;
	};
	
	AutoSave.getUrlPath = function(){
		
		return window.location.pathname;
	}

	AutoSave.LOG_DEBUG	= "debug";
	AutoSave.LOG_INFO	= "info";
	AutoSave.LOG_WARN	= "warn";
	AutoSave.LOG_ERROR	= "error";

	AutoSave.DEFAULT_LOAD_CHECK_INTERVAL      = 100;    	//Every 100 ms, check if it's loaded
	AutoSave.DEFAULT_AUTOSAVE_INTERVAL   	  = 3*1000; 	//By default, autosave every 3 seconds

	AutoSave.DEFAULT_AUTOSAVE_SHOW = {
		duration: 	500,
		msg: 		"Saving...",
		type: 		"saving",
		bg: 		"#ecebeb",
		marginLeft:	"-20px"
	};
	AutoSave.DEFAULT_AUTOSAVE_WARN = {
		duration: 	5*1000, 	//By default, show no-local-storage warning msg for 5 secs
		msg: 		"AutoSave is turned off - no datastore available to store input data.",
		type: 		"noStore",
		bg: 		"#ff9b74",
		marginLeft:	"-240px"
	};
	AutoSave.DEFAULT_KEY_PREFIX				= "AutoSaveJS_";
	AutoSave.log							= AutoSave._logToConsole;	//For callers outside of AutoSaveJS
	AutoSave.__keysInUse					= [];
	AutoSave.__defaultListenOpts = { passive:true, capture:true };	//Let browser know we only listen passively so it can optimise
	AutoSave.__cachedLocalStorageAvailable	= undefined;
	AutoSave.__cachedCookiesAvailable		= undefined;
	AutoSave.version						= "1.0.0";

	return AutoSave;
})); //End of cross-module compatability
