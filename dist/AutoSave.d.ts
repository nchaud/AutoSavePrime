/*
* Typings for AutoSavePrime - https://github.com/nchaud/AutoSavePrime
* Targeting AutoSavePrime Version: 1.0.2
* Copyright (c) 2019 Numaan Chaudhry
* Licensed under the ISC license
*/

//This will be exported as both a class (so can be new's up) and a namespace (which has typed interfaces)
export as namespace AutoSave;
export = AutoSave;

//Here just to hint where a jQuery instance can be supplied in AutoSave
type jQueryHint = any;

declare namespace AutoSave {

	//Type alias for element control definitions we support
	export type InputControls = HTMLElement|HTMLElement[]|string;

	export interface InitOptions {

		/**
		 * Set to null to disable auto-save behaviour.
		 */
		autoSaveTrigger?: null | 
			{ 
				/**
				 * How long to wait - in milliseconds - since an input changes before saving.
				 * 
				 * Default is 3000.
				 */
				debounceInterval: number
			};
	
		/**
		 * Set to null to disable auto-loading all controls.
		 */
		autoLoadTrigger?: null;
		
		/**
		 * Whether to seek elements elsewhere in the document that may be linked to forms under the scope set.
		 * 
		 * Default is true.
		 */
		seekExternalFormElements?: boolean;
	
		/**
		 * Set to null to prevent the 'Saving...' indicator showing.
		 */
		saveNotification?: null |
			{
				/**
				 * A HTML fragment to completely replace the default template.
				 */
				template?: string,
				
				/**
				 * A string to show the text inside the default notification template.
				 */
				message?: string,
				
				/**
				  * The minimum duration the notification should show for, in milliseconds.
				 * 
				 * Default is 500.
				  */
				minShowDuration?: number
			};
	
		/**
		 * Set to null to prevent the 'Auto-Save is not enabled...' message showing.
		 */
		noStorageNotification?: null |
			{
				/**
				 * A HTML fragment to completely replace the default template.
				 */
				template?: string,
				
				/**
				 * A string to show the text inside the default notification template.
				 */
				message?: string,
				
				/**
				  * The duration the notification should show for, in milliseconds. Will only show once on initial load.
				 * 
				 * Default is 5000.
				  */
				showDuration?: number
			};
	
		/**
		 * Options for where to store or load the data from. Set to null to disable datastore altogether.
		 */
		dataStore?: null |
			{
				/**
				 * Will prefer using cookies over local storage, if cookies are available.
				 * 
				 * Default is false.
				 */
				preferCookies?: boolean,
	
				/**
				 * Clears out input controls if the corresponding value is blank in the input.
				 * 
				 * Default is true.
				 */
				clearEmptyValuesOnLoad?: boolean,
				
				/**
				 * The unique key for this AutoSave instance (as we can have multiple instances on a single page).
				 */
				key?: string | (()=>string),
				
				/**
				 * Custom save function to save data to your own store. ENSURE you invoke the callback when done.
				 * 
				 * Default is to save to the browser's HTML5 local storage or cookies
				 */
				save?: (key:string, data:string, callback:()=>void) => void,
				
				/**
				 * Custom load function to load data from your own store. ENSURE you invoke the callback when done.
				 * 
				 * Default is to load from the browser's HTML5 local storage or cookies
				 */
				load?: (key:string, callback:(data:string)=>void) => void
			};
	
			
		/**
		 * Callback that's invoked when AutoSave is initialised. This includes after the initial data load is complete.
		 * 
		 * Will not be invoked if there's any exceptions.
		 */
		onInitialised?:	()=>void;
		
		/**
		 * Callback invoked just before data is fetched from the datastore.
		 * 
		 * Return false to cancel the load (you can invoke manually yourself at any time with autoSave.load()).
		 * 
		 * Return a string (or null) payload override, which will be used instead.
		 */
		onPreLoad?: ()=>void|boolean|string|null;
		
		/**
		 * Callback invoked after the data is fetched from the datastore but before deserialised into the controls.
		 * 
		 * Return false to cancel the load (you can invoke manually yourself at any time with autoSave.load()).
		 * 
		 * Return null or a string payload override, which will be used instead.
		 */
		onPostLoad?: (serialisedData: string)=>void|boolean|string|null;
		
		/**
		 * Callback invoked after controls have been loaded with data.
		 */
		onPostDeserialize?: ()=>void;
		
		/**
		 * Callback invoked before all the controls are serialised into a x-www-form-urlencoded encoded string, ready for saving.
		 * 
		 * Return false to cancel the save.
		 * 
		 * Return a custom set of input controls to serialise those instead.
		 */
		onPreSerialize?: (controlsArray: HTMLElement[])=>void|boolean|InputControls;
		
		/**
		 * Callback invoked after controls have been serialised into a x-www-form-urlencoded encoded string but before saving.
		 * 
		 * Return false to cancel the save.
		 * 
		 * Return a custom string to store that instead to the datastore.
		 */
		onPreStore?: (serialisedData: string)=>void|boolean|string;
		
		/**
		 * Callback invoked after the save operation is complete
		 */
		onPostStore?: ()=>void;
		
		/**
		 * Callback invoked just before the visibility of the 'Saving...' notification is toggled.
		 * 
		 * Return false to cancel showing(if toggleOn==true) or cancel hiding (if toggleOn==false)
		 */
		onSaveNotification?: (toggleOn: boolean)=>void|boolean;
		
		/**
		 * Callback invoked just before the visibility of the 'AutoSave is not enabled...' notification is toggled.
		 * 
		 * Return false to cancel showing(if toggleOn==true) or cancel hiding (if toggleOn==false)
		 */
		onNoStorageNotification?: (toggleOn: boolean)=>void |boolean;
		
		/**
		 * Either a 
		 * - callback, invoked when a log operation is raised or 
		 * - an object, which has handlers for each log level
		 */
		onLog?:	((logLevel:string, ...logArgs: any[])=>any) | 
			{
				debug?: (...any)=>void|boolean|any,
				info?:  (...any)=>void|boolean|any,
				warn?:  (...any)=>void|boolean|any,
				error?: (...any)=>void|boolean|any,
			};
	}
}



//TODO: WILL THIS CREATION ANOTHER AUTOSAVE DFEINITION !? interface or class in d.ts

declare class AutoSave {

	/**
	 * Initialises a new instance
	 *
	 * @param {AutoSave.InputControls} [scope] The elements to be observed, loaded into, saved etc.
	 * @param {AutoSave.InitOptions} [initOptions] Configuration options
	 */
	constructor(scope?: AutoSave.InputControls, initOptions?: AutoSave.InitOptions);

	/**
	 * Returns a string resulting from the serialisation of all the inputs in the scope of this instance in x-www-form-urlencoded format.
	 */
	getCurrentValue(): string;

	/**
 	 * Triggers a save of the input elements to the datastore. If there's already a save in progress, this will get queued to run after that's finished. See datastore for more details.
	 */
	save(): void;

	/**
	 * Manually triggers a load of the input elements from the datastore. Existing data may be wiped (see also clearEmptyValuesOnLoad).
	 */
	load(): void;

	/**
   * Empties the datastore for this instance. Specifically, for the key-value pair stored, it'll set value to null but will keep the key marked as in-use.
	 */
	resetStore(): void;

	/**
	 * Unhooks all listeners, removes notification elements, terminates all debounce-pending saves, releases the datastore key and generally cleans up after itself.
	 * 
	 * Will remove all data in local storage associated with this instance but set resetStore parameter to false to override this behaviour and preserve data in the datastore.
	 * @param {boolean} resetStore By default, set to true.
	 */
	dispose(resetStore?:boolean): void;
	
	/**
	 * Returns true if the browser has cookies enabled.
	 */
	static isCookieStorageAvailable(): boolean;
	
	/**
   * Returns true if the browser has the HTML5 Local Storage API and it's enabled.
	 */
	static isLocalStorageAvailable(): boolean;
	
	/**
	 * Given an array of elements, serializes the values of all the input elements at or underneath this set and returns it as a x-www-form-urlencoded string representation.
	 * 
	 * @param {HTMLElement[]} controlsArr The input controls whose values will be read
	 */
	static serialize(controlsArr: HTMLElement[]): string;
	
	/**
	 * Loads all the input elements provided with values from the data string. The data string must be in x-www-form-urlencoded encoding. If there are any empty parameters, like 'name=&...', then the name input field will be cleared out. Setting the clearEmpty parameter to false will prevent this behaviour.
	 * 
	 * @param {HTMLElement[]} controlsArr Input controls whose values will be updated
	 * @param {string} data Contains the data in key-value pairs in x-www-form-urlencoded encoding
	 * @param {boolean} clearEmpty True by default. When true, a blank value in the data source means the control's value will be cleared
	 */
	static deserialize(controlsArr:HTMLElement[], data:string, clearEmpty?:boolean): void;
	
	/**
	 * Removes all local storage and cookies generated by any AutoSave instances. Will remove everything on this domain*. Will not dispose currently active AutoSave instances.
	 * 
	 * *Except cookies that have been customised by custom domain or path parameters through the onPreStore callback.
	 */
	static resetAll(): void;
	
	/**
	 * Given an array-like object (i.e. any object with a length property and indexed properties), creates a first class javascript array from it.
	 * 
	 * You can optionally specify a numSkip number to skip a given number of entries at the start.
	 * 
	 * @param {any} arrayLike An array or a JS 'array-like' object to copy into a new array.
	 * @param {number} numSkip Number of entries in the array to skip from the start. By default, 0.
	 */
	static toArray(arrayLike:any, numSkip?:number): any[];
		
	/**
 	 * Will invoke myCallback when the document's readyState transitions to 'complete' - the equivalent of jQuery's $().
 	 * 
	 * @param {()=>void} myCallback Callback to invoke.
	 */
	static whenDocReady(myCallback: ()=>void): void;

	static LOG_DEBUG: string; // "debug"
	static LOG_INFO:  string; // "info"
	static LOG_WARN:  string; // "warn"
	static LOG_ERROR: string; // "error"
	static version:   string;
}
