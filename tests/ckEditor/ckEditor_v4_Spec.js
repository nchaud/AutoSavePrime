
//TODO: MULTI INSTANCE of IDENTICAL ELEMENTS that are provided different containers/selectors

describe("AutoSaveJS+CKEditor", function() {
	
	function setSelected(elem, isChecked){
		
		$(elem).prop("selected",true);

		//Fire native change event
		var elem = $(elem).get(0);
		
		sendEvent(elem, "change");
	}
	
	function setChecked(elem, isChecked){
		
		$(elem).prop("checked",true);

		//Fire native change event
		var elem = $(elem).get(0);
		
		sendEvent(elem, "change");
	}
	
	function setValue(elem, value, eventType){
		
		//Set value
		$(elem).val(value);

		//Fire native change event
		var elem = $(elem).get(0);
		
		if (eventType === null){
			
			return;//don't fire event
		}
		else if (eventType === undefined){ //calculate it

			if(elem.nodeName == "SELECT" ||
			   elem.nodeName == "INPUT")
				eventType = "change";
			else
				throw "Unknown form type !";
		}
		
		sendEvent(elem, eventType);
	}
	
	function sendEvent(element, evType){
		
		if ("createEvent" in document) {
			var evt = document.createEvent("HTMLEvents");
			evt.initEvent(evType, false, true);
			element.dispatchEvent(evt);
		}
		else {
			if (evType == "change")
				evType = "onchange";
			
			element.fireEvent(evType);
		}
	}
	
	function resetSandbox(){
		$("#sandbox").remove();
		$("body").append("<div id='sandbox'></div>");
	}
	
	function addToSandbox(elem){
		$(elem).appendTo('#sandbox');
	}

    _currTestAutoSave=null;
    function createAutoSave(parent, opts){
	  
		if(_currTestAutoSave) {
			
			_currTestAutoSave.dispose(); //detach all listeners
			_currTestAutoSave = null;
		}
		
	  _currTestAutoSave = new AutoSave(parent, opts);
	  return _currTestAutoSave;
    }

	beforeEach(function(done){
				
		jasmine.clock().install();		
		
		//Initialise path to templates directory
		jasmine.getFixtures().fixturesPath = "./tests/ckEditor";
		
		//Load CKEditor scripts
		$.getScript("lib/ckeditor/ckeditor.js", function(){
			
			//resume tests
			done();
		});
		
		//Destroy all instances from previous tests incase CKEDITOR is already loaded
		if ( typeof( CKEDITOR ) != "undefined" )
			for( var i in CKEDITOR.instances )
				CKEDITOR.instances[ i ].destroy();
	});

	afterEach(function(){

		jasmine.clock().uninstall();
		
		//Reset all elements in container
		resetSandbox();
	});

	function resetSandbox(){
		
		$("#jasmine-fixtures").remove();
	}

	function saveCKEditors(){
		
		//Update the underlying textarea for all CKEditor instances
		for( var i in CKEDITOR.instances )
			CKEDITOR.instances[ i ].updateElement();
	}
	
	function loadCKEditors(){
		
		//Create all CKEditors if they havent already been. We're using the whole document but you could selectively change this
		var elems = document.querySelectorAll( "textarea" );
		
		var newlyCreatedIds = [];
		for( var i=0 ; i<elems.length ; i++ ){
			
			var elemName = elems[ i ].name;
			
			//In this demo fragment, all areas need a name but can be changed as per your needs
			if ( !elemName )
				throw new Error( "All textarea elements must have a name" );
			
			if ( !CKEDITOR.instances[ elemName ] ) {
				
				newlyCreatedIds.push( elemName );
				
				CKEDITOR.replace( elems[ i ],{
					uiColor: '#d9edf7', //Light blue
					on: {
							change: function( evt ) {
							
								evt.editor.updateElement();//This will update the textarea, triggering a (debounced) auto-save
							}
						}
				});
			}
			//already created
		}
		
		//Update all existing CKEDITOR instances from <textarea> inputs, incase user has requested a .load() with perhaps updated serialised data
		for( var i in CKEDITOR.instances ) {	
			
			if ( newlyCreatedIds.indexOf( i ) == -1 ){
			
				//Update the UI based on the textarea initial value
				CKEDITOR.instances[ i ].setData();
			}
			//else do nothing as we just created this element from the textarea so its up to date
		}
	}
	
	
	//TODO: Multiple instances !
  
  describe('ckEditor v4 hook', function(){
	

	it('initialises CKEditor instances during load', function(){
	
		jasmine.getFixtures().load("ckEditor_v4_Fragment.html");

		var fullName = document.querySelector("[name='fullName']");
		var address = document.querySelector("[name='address']");
		var hobbies = document.querySelector("[name='hobbies']");

		//Deserialize all values
		var szString = "fullName=Oscar+Nash&address=20+Downing+Street%2C+London%2C+NW1+7FJ&hobbies=Rugby%2C+Cricket+and+Swimming";
		var aSave = createAutoSave(null,{
			
			//ckEditor hooks for custom controls
			onPreSerialize: saveCKEditors,
			onPostDeserialize: loadCKEditors,
				
			//Test data-store
			dataStore: {
				save: function(key, data, callback){},
				load: function(key, callback){
					
					callback(szString);
				}
			}
		});

		//Act
		aSave.load();
		
		//Ensure both underlying inputs are good...
		expect( $( fullName ).val() ).toEqual( "Oscar Nash" );
		expect( $( address ).val()  ).toEqual( "20 Downing Street, London, NW1 7FJ" );
		expect( $( hobbies ).val()  ).toEqual( "Rugby, Cricket and Swimming" );

		//... and also the CKEditor UI
		expect( CKEDITOR.instances["address"].getData() ).toEqual( "20 Downing Street, London, NW1 7FJ" );
		expect( CKEDITOR.instances["hobbies"].getData() ).toEqual( "Rugby, Cricket and Swimming" );
	});	
	
	
	it('multiple loads dont rebuild ck editors but do re-load data', function(){
		
		jasmine.getFixtures().load("ckEditor_v4_Fragment.html");

		var address = document.querySelector("[name='address']");

		//Deserialize all values
		var szString = "address=10+Downing+Street";
		var aSave = createAutoSave(null,{
			
			//ckEditor hooks for custom controls
			onPreSerialize: saveCKEditors,
			onPostDeserialize: loadCKEditors,
				
			//Test data-store
			dataStore: {
				save: function(key, data, callback){},
				load: function(key, callback){
					
					callback(szString);
				}
			}
		});

		//Act
		aSave.load();
		
		//Sanity checks
		expect( $( address ).val()  ).toEqual( "10 Downing Street" );
		expect( CKEDITOR.instances["address"].getData() ).toEqual( "10 Downing Street" );

		szString = "address=30+Downing+Street";

		//When we load again, 
		//1) should not throw 'CKEDITOR instance already attached'
		//2) should reload data into the textarea
		//3) should reload data into CKEditor UI
		aSave.load();
		
		//Sanity checks
		expect( $( address ).val()  ).toEqual( "30 Downing Street" );
		expect( CKEDITOR.instances["address"].getData() ).toEqual( "30 Downing Street" );
	});
	
	it('serialises values from CKEditor widgets', function(){
	
		jasmine.getFixtures().load("ckEditor_v4_Fragment.html");
		
		var szString;
		var aSave = createAutoSave( null,{
			
			//CKEditor hooks for custom logic
			onPreSerialize: saveCKEditors,	  //Before serializing controls, ensure underlying textarea is updated from CKEditor UI
			onPostDeserialize: loadCKEditors, //After data is loaded, create CKEditor UI which'll read the data from the textarea's
			
			//Test data-store
			dataStore: {
				load: function( key, callback ){ callback( null ) }, //Initially, no data to load => null
				save: function( key, stringValue, callback ){
					
					szString = stringValue;
					callback();
				}
			}
		});

		//Normal/Control
		var fullName = document.querySelector("[name='fullName']");
		$( fullName ).val( "Oscar Wilde" );
		
		//Load CKEditors and set the value on the CKEditor itself rather than underlying input
		CKEDITOR.instances["address"].setData( "10 Downing Street, London, NW1 7FJ" );
		CKEDITOR.instances["hobbies"].setData( "Football, Cricket and Swimming" );

		aSave.save();
		expect(szString).toEqual("fullName=Oscar+Wilde&address=10+Downing+Street%2C+London%2C+NW1+7FJ&hobbies=Football%2C+Cricket+and+Swimming");
	});

	//CKEditor doesnt update the underlying textarea normally but we'll do so manually regularly to trigger auto-saves
	it('autosave is triggered whilst typing in CKEditor', function(){
	
		jasmine.getFixtures().load("ckEditor_v4_Fragment.html");
		
		var szString;
		var aSave = createAutoSave( null,{
			
			//CKEditor hooks for custom logic
			onPreSerialize: saveCKEditors,	  //Before serializing controls, ensure underlying textarea is updated from CKEditor UI
			onPostDeserialize: loadCKEditors, //After data is loaded, create CKEditor UI which'll read the data from the textarea's
			
			//Test data-store
			dataStore: {
				load: function( key, callback ){ callback( null ) }, //Initially, no data to load => null
				save: function( key, stringValue, callback ){
					
					szString = stringValue;
					callback();
				}
			}
		});
		
		//Set a value
		CKEDITOR.instances["address"].setData( "10 Downing Street, London, NW1 7FJ" );

		//TODO: We cant test whether the save kicked in as it requires the full blown UI to be running in order to fire change events
	});
  });
});

