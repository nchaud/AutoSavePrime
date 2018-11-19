describe("AutoSaveJS", function() {

	_defaultCookieKey = "AutoSaveJS_MOCK/PATH/1";
	
	_allCurrAutoSaves = [];
	_noOpLoad = function( key, loadCompleted){ loadCompleted() };
	_noOpSave = function( key, data, saveCompleted){ saveCompleted() };
	
	/* Helper functions */
	function testSerialize(parentParameter){
	
		if (parentParameter === undefined) //Nulls are ok and can go straight through to AutoSave() and does all elements !
			parentParameter = document.body;
		
		var szString;
		
		var aSave = createAutoSave(parentParameter,{
			
			dataStore: null, //No storage required for this test
			onPreStore: function(str){szString = str;return str;}
		});
		
		aSave.save();
		
		return szString;
	}
	
	function getLocalStorageElseCookie(key){
		
		var valSaved;
		if (AutoSave.isLocalStorageAvailable)
			valSaved = localStorage.getItem(key);
		else
			valSaved = getBrowserCookie(key);

		return valSaved;
	}
	

	function getBrowserCookie( key ){

		if ( !key )
			key = _defaultCookieKey;
	
		//From MDN
		var regex = new RegExp("(?:(?:^|.*;)\\s*" + 
				   encodeURIComponent(key).replace(/[\-\.\+\*]/g, "\\$&") + 
				   "\\s*\\=\\s*([^;]*).*$)|^.*$");
		
		var cookieValue = document.cookie.replace( regex, "$1" );
		
		return cookieValue;
	}
	
	function createMockDataStore( szString, opts ){
		
		var defaultOpt = 
		{
			save: function(_, __, cb){ cb() }, //No-op save
			load: function( key, loadCompleteCallback ){
				loadCompleteCallback( szString )
			}
		};
		
		var mergedOpts = $.extend({}, defaultOpt, opts);
		
		return mergedOpts;
	}
	
	//Any custom opts will overwrite top-level options, not do a deep merge
	function testDeserialize(szString, opts){

		var defaultOpt = {
			dataStore: createMockDataStore(szString)
		};
		
		if (opts ===  null)
			var mergedOpts = null; //Explicit clear requested
		else
			var mergedOpts = $.extend({}, defaultOpt, opts);
		
		var aSave = createAutoSave($("body"), mergedOpts);
		
		aSave.load();
	}
	
	//Gets a jQuery-wrapped element and throws if it doesn't exist - useful to ensure no bugs in selector
	function getOne(elem){
		
		var jQ = $(elem);
		
		if (jQ.length != 1)
			throw "Failed to find exactly 1 element with selector " + elem;
		
		return jQ;
	}
	
	function setSelected(elem, isChecked){
		
		var $elem = $(elem);
		$elem.prop("selected",true);

		//Fire native change event
		for(var i=0;i<$elem.length;i++)
			sendEvent($elem[i], "change");
	}
	
	function setChecked(elem, isChecked){
		
		var $elem = $(elem);
		$elem.prop("checked",true);

		//Fire native change event
		for(var i=0;i<$elem.length;i++)
			sendEvent($elem[i], "change");
	}
	
	//Fires just the input event
	function setPartValue(elem, value){

		//Set value
		$(elem).val(value);

		//Fire native change event
		var elem = $(elem).get(0);
		
		sendEvent(elem, "input");
	}
	
	function getValue(elem){
		return $(elem).val();
	}

	//Fires the change event by default
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
			   elem.nodeName == "INPUT" ||
			   elem.nodeName == "TEXTAREA" ||
			   elem.nodeName == "METER" ||
			   elem.nodeName == "PROGRESS")
				eventType = "change";
			else
				throw "TEST SPEC: Unknown form type !";
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
		
		var $sb = $("#sandbox");
		
		if ( !$sb.length )
			$( "body" ).append( "<div id='sandbox'></div>" );
		else
			$sb.empty();
	}
	
	function addToSandbox(elem){
		$(elem).appendTo('#sandbox');
	}

    function createAutoSave(parent, opts, clearPrev){
	  
		if (clearPrev === undefined || clearPrev === true) {
			
			for(var i=0; i< _allCurrAutoSaves.length; i++) {
									
				_allCurrAutoSaves[i].dispose( true ); //detach all listeners, reset store
			}
				
			_allCurrAutoSaves.length = 0;
			AutoSave.resetAll(); //Clear from previous instances of test runs
		}
		
		var a = new AutoSave(parent, opts);
		_allCurrAutoSaves.push(a);
		
		return a;
    }
	
	beforeEach(function(){
		
		//Make sure it's there for the first one
		resetSandbox();

		jasmine.clock().install();
		
		//Simulate URL path
		AutoSave.getUrlPath = function(){ return "MOCK/PATH/1"; };
	})

	afterEach(function(){
		
		//Clean up after the last one
		resetSandbox();
		
		jasmine.clock().uninstall();
	});
		
  describe('round-tripping: ', function(){
	 
	 /* Helper to run a test on a type of <input> */
	internal_run_input_serialise_and_deserialise_test = function(inputType){
		 
		//Arrange - Create and set a value on the input text box
		var testFragment = "<input type='"+inputType+"' name='frmNameEntry'>";
		addToSandbox(testFragment);
		setValue("[name='frmNameEntry']", "Oscar");

		//Act - Store all field data as a string
		var szString = testSerialize();

		//Recreate the default state HTML
		resetSandbox();
		addToSandbox(testFragment);
		var elem = document.querySelector("[name='frmNameEntry']");
		
		//Sanity check element has no initial value and is indeed recreated
		expect(elem.value).toEqual("");

		//Act - load the inputs
		testDeserialize(szString);

		//Assert
		expect(elem.value).toEqual("Oscar");
	}
	 
	it('input text entry is restored with text value', function(){
		
		internal_run_input_serialise_and_deserialise_test('text');
    });
	
	it('input hidden entry is restored with text value', function(){
		
		internal_run_input_serialise_and_deserialise_test('hidden');
    });
	 
	it('input password entry is restored with text value', function(){
		
		internal_run_input_serialise_and_deserialise_test('password');
    });
	 
	it('select entry is restored with selected option',function(){
		 
		//Arrange - Create and set a value on the input text box
		var testFragment = "<select name='frmNameEntry'>\
								<option value=''>(None)</option>\
								<option value='B'>Blue</option>\
								<option value='G'>Green</option>\
								<option value='R'>Red</option>\
						   </select>";
		addToSandbox(testFragment);
		setValue("[name='frmNameEntry']", "G");

		//Act - Store all field data as a string
		var fieldData = testSerialize();

		//Recreate the default state HTML
		resetSandbox();
		addToSandbox(testFragment);
		var elem = document.querySelector("[name='frmNameEntry']");
		
		//Sanity check element has no initial value and is indeed recreated
		expect(elem.value).toEqual("");

		//Act - load the inputs
		testDeserialize(fieldData);

		//Assert
		expect(elem.value).toEqual("G");
	});
	
	it('select entry with multiple selections is restored',function(){
		 
		//Arrange - Create and set a value on the input text box - put None at bottom to ensure it's not working coincidentally !
		var testFragment = "<select multiple name='frmNameEntry'>\
								<option value='B'>Blue</option>\
								<option value='G'>Green</option>\
								<option value='R'>Red</option>\
								<option>(None)</option>\
						   </select>";
		addToSandbox(testFragment);
		
		//Select 2 options
		setSelected("[value='R'],[value='G']", true);
		
		//Act - Store all field data as a string
		var fieldData = testSerialize();

		//Recreate the default state HTML
		resetSandbox();
		addToSandbox(testFragment);
		
		//Act - load the inputs
		testDeserialize(fieldData);

		//Assert
		expect($("[value='R']").prop("selected")).toEqual(true);
		expect($("[value='G']").prop("selected")).toEqual(true);
		expect($("[value='B']").prop("selected")).toEqual(false); //sanity check this should not be selected
	});
	
	//As per whatwg spec 4.10.10, should use the element's text IDL attribute if no option specified
	it('select entry with multiple selections without option values is restored',function(){
		 
		//Arrange - Create and set a value on the input text box - put None at bottom to ensure it's not working coincidentally !
		var testFragment = "<select multiple name='frmNameEntry'>\
								<option id='B'>Blue</option>\
								<option id='G'>Green</option>\
								<option id='R'>Red</option>\
								<option>(None)</option>\
						   </select>";
		addToSandbox(testFragment);
		
		//Select 2 options
		setSelected("#R,#G", true);
		
		//Act - Store all field data as a string
		var fieldData = testSerialize();

		//Recreate the default state HTML
		resetSandbox();
		addToSandbox(testFragment);
		
		//Act - load the inputs
		testDeserialize(fieldData);

		//Assert
		expect($("#R").prop("selected")).toEqual(true);
		expect($("#G").prop("selected")).toEqual(true);
		expect($("#B").prop("selected")).toEqual(false); //sanity check this should not be selected
	});
	
	//As per whatwg spec 4.10.10, should use the element's text IDL attribute if no option specified
	it('select single options with no option values should still select correct option',function(){ 
		
		//Arrange - Create and set a value on the input text box - check special characters preserved
		var testFragment = "<select name='frmNameEntry'>\
								<option>Blue</option>\
								<option id='toChoose'>Green & Black+Pistachio</option>\
								<option>Red</option>\
						   </select>";
		addToSandbox(testFragment);
		setSelected("#toChoose", true);
		
		//Act - Store all field data as a string
		var fieldData = testSerialize();

		//Recreate the default state HTML
		resetSandbox();
		addToSandbox(testFragment);
		var elem = document.querySelector("[name='frmNameEntry']");
		
		//Act - load the inputs
		testDeserialize(fieldData);

		//Assert
		expect(elem.value).toEqual("Green & Black+Pistachio");
		expect(AutoSave.toArray($("option:selected"))).toEqual(
			AutoSave.toArray(document.querySelectorAll("#toChoose")));
	});
	
	//As per whatwg spec 4.10.10, should use the element's text IDL attribute if no option specified
	it('select single options with no option values and optgroup should still select correct option',function(){
		
		//Arrange - Create and set a value on the input text box - check special characters preserved
		var testFragment = "<select name='frmNameEntry'>\
								<optgroup>\
									<option>Blue</option>\
									<option id='toChoose'>Green & Black+Pistachio</option>\
								</optgroup>\
								<option>Red</option>\
						   </select>";
		addToSandbox(testFragment);
		setSelected("#toChoose", true);
		
		//Act - Store all field data as a string
		var fieldData = testSerialize();

		//Recreate the default state HTML
		resetSandbox();
		addToSandbox(testFragment);
		var elem = document.querySelector("[name='frmNameEntry']");
		
		//Act - load the inputs
		testDeserialize(fieldData);

		//Assert
		expect(elem.value).toEqual("Green & Black+Pistachio");
		expect(AutoSave.toArray($("option:selected"))).toEqual(
			AutoSave.toArray(document.querySelectorAll("#toChoose")));
	});
	
	//As per whatwg spec #2.7.2.2, if radio has no value, should be "on", so ensure sz/dsz works in this case
	it('input:radio+checkbox controls with no value should be set to "on" if relevant and reinstated', function(){
		
		//Arrange - Create and set a value on the input
		var testFragment = "<input type='radio' name='test_1' value='is_employed'>\
							<input type='radio' name='test_2' value=''>\
							<input type='radio' name='test_3'>\
							<input type='radio' name='test_4' value='is_student'>\
							<input type='radio' name='test_5' value=''>\
							<input type='radio' name='test_6'>";
		addToSandbox(testFragment);	
		
		setChecked("input", true);
		
		//Act - Store all field data as a string
		var szString = testSerialize();

		var expectedStr = "test_1=is_employed&test_2=&test_3=on&test_4=is_student&test_5=&test_6=on";
		expect(szString).toEqual(expectedStr);
		
		//Recreate the default state HTML
		resetSandbox();
		addToSandbox(testFragment);
		
		//Act - load the inputs
		testDeserialize(expectedStr);

		//Assert - all inputs should be selected
		expect(AutoSave.toArray($("input:checked"))).toEqual(
			AutoSave.toArray(document.querySelectorAll("input")));
	});
	
	it('input:radio+checkbox controls should not become checked without the correct string matching their value', function(){
		
		//Arrange - Create and set a value on the input
		var testFragment = "<input type='radio' name='test_1' value='is_employed'>\
							<input type='radio' name='test_2' value=''>\
							<input type='radio' name='test_3'>\
							<input type='radio' name='test_4' value='is_student'>\
							<input type='radio' name='test_5' value=''>\
							<input type='radio' name='test_6'>";
		addToSandbox(testFragment);	

		//Act - load the inputs
		testDeserialize("");

		//Assert - nothing checked
		expect(AutoSave.toArray($("input:selected"))).toEqual([]);
		
		//Assert - if it have a value, dsz string must match the value
		testDeserialize("test_1=is_student&test_1=&test_1=on");
		expect(AutoSave.toArray($("input:selected"))).toEqual([]);
		testDeserialize("test_4=is_other&test_4=&test_4=on");
		expect(AutoSave.toArray($("input:selected"))).toEqual([]);
		
		//Assert - if value is blank, dsz string must be blank too
		testDeserialize("test_2=is_student&test_2=null&test_2=on");
		expect(AutoSave.toArray($("input:selected"))).toEqual([]);
		testDeserialize("test_5=is_student&test_5=null&test_5=on");
		expect(AutoSave.toArray($("input:selected"))).toEqual([]);

		//Assert - if value attribute is missing altogether, dsz string must have 'on' in it
		testDeserialize("test_3=is_student&test_3=null&test_3=");
		expect(AutoSave.toArray($("input:selected"))).toEqual([]);
		testDeserialize("test_6=is_student&test_6=null&test_6=");
		expect(AutoSave.toArray($("input:selected"))).toEqual([]);
	});
	
	it('input text entry can handle special characters and unicode', function(){
		
		var testStr = "mailto:someone@example.com&subject='Dont forget %20 is used to represent spaces!.-_.!~*()'";
		
		//Make both the name and value have special characters
		var testFragment = "<input type='text' name='"+testStr+"'frmNameEntry'>";
		addToSandbox(testFragment);
		
		//Enter text with symbols and also check all radios to ensure ampsersand is tested in (de)serialisation
		setValue("input", testStr);

		//Act - Store all field data as a string
		var fieldData = testSerialize();
		
		//Recreate the default state HTML
		resetSandbox();
		addToSandbox(testFragment);
		var elem = document.querySelector("input");
		
		//Sanity check element has no initial value and is indeed recreated
		expect(elem.value).toEqual("");
		
		//Act - load the inputs
		testDeserialize(fieldData);

		//Assert
		expect(elem.value).toEqual(testStr); //Should find original element and even the %20 should be as original
	});

	it('input radio entry is restored with radio selection', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<h3>Please state your gender:</h3>\
							<input type='radio' name='frmGender' value='Male'>Male\
							<input type='radio' name='frmGender' value='Female'>Female\
							<input type='radio' name='frmGender' value='NoSay'>Prefer Not To Say";
		
		addToSandbox(testFragment);
		setChecked("[value='Male']", true);

		//Act - Store all field data as a string
		var fieldData = testSerialize();

		//Recreate the default state HTML
		resetSandbox();
		addToSandbox(testFragment);
		var elem = document.querySelector("[value='Male']");

		//Sanity check - no inputs should be selected
		expect(document.querySelectorAll("input[type='radio']:checked").length).toEqual(0);

		//Act - load the :input's from the string
		testDeserialize(fieldData);

		//Assert - exactly 1 selected and correct one
		expect(AutoSave.toArray(document.querySelectorAll("input[type='radio']:checked")))
		.toEqual([elem]);
	});
	
	it('input checkbox entry is restored with checkbox selection', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<h3>Please choose your preferred musicians:</h3>\
							<input type='checkbox' name='frmMusician' value='Mozart'>Mozart Van...\
							<input type='checkbox' name='frmMusician' value='JayZ'>JayZ\
							<input type='checkbox' name='frmMusician' value='Sipa'>Sipa";
		
		addToSandbox(testFragment);
		setChecked("[value='JayZ']", true);
		setChecked("[value='Sipa']", true);

		//Act - Store all field data as a string
		var fieldData = testSerialize();
		
		//Recreate the default state HTML
		resetSandbox();
		addToSandbox(testFragment);
		var elem1 = document.querySelector("[value='JayZ']");
		var elem2 = document.querySelector("[value='Sipa']");

		//Sanity check - no inputs should be selected
		expect(document.querySelectorAll("input[type='checkbox']:checked").length).toEqual(0);

		//Act - load the :input's from the string
		testDeserialize(fieldData);

		//Assert - exactly 2 selected and correct one
		expect(AutoSave.toArray(document.querySelectorAll("input[type='checkbox']:checked")))
		.toEqual([elem1,elem2]);
	});

	it('autosave and reinstate to cookies works', function(){ //etc same for endpoint etc.
	
		var testFragment = "<input type='text' name='frmMusician'>";

		//In 1 session, save it
		{
			//Arrange - Create and set a value on the input text box
			addToSandbox(testFragment);

			var aSave = createAutoSave(null,  {
							autoLoadTrigger: null,
							autoSaveTrigger: null //Control it manually for the purpose of this test
						});
			
			setValue("[name='frmMusician']", "Mozart");
			
			aSave.save(); //Should save to cookie
			
			aSave.dispose(false); //Should NOT clear local storage
		}
		
		//In 'another' session, load it
		{
			resetSandbox();
			addToSandbox(testFragment);
			
			//Sanity check
			expect(getOne("[name='frmMusician']").val()).toBeFalsy();
			
			//Create it with no-reset so storage isn't wiped out
			var aSave = createAutoSave(null, {
							autoLoadTrigger: null,
							autoSaveTrigger: null //Control it manually for the purpose of this test
						}, false);
			
			aSave.load();
			
			expect(getOne("[name='frmMusician']").val()).toEqual("Mozart");
			
			aSave.dispose();
		}
	});
  });
  
  describe('dataStore: ', function(){
  	
	var clearDzString = "frmNameEntry=&frmColorEntry=&description=&frmMusician=";

	//Helper method
	var internalTestClearEmptyValues = function(dzString, dataStoreOpts, shouldPreserve){
		 
		//Arrange - Create and set a value on the input text box
		var testFragment = "<input name='frmNameEntry'>\
							<select name='frmColorEntry'>\
								<option value=''>(None)</option>\
								<option value='B'>Blue</option>\
								<option value='G'>Green</option>\
								<option value='R'>Red</option>\
						   </select>\
						   <textarea name='description'></textarea>\
						   <h3>Please choose your preferred musicians:</h3>\
							<input type='checkbox' name='frmMusician' value='Mozart'>Mozart Van...\
							<input type='checkbox' name='frmMusician' value='JayZ'>JayZ\
							<input type='checkbox' name='frmMusician' value='Sipa'>Sipa"
		
		resetSandbox();
		addToSandbox( testFragment );
		var $textElem 	= $( "[name='frmNameEntry']" );
		var $textArea 	= $( "textarea" );
		
		var elem1 = document.querySelector( "[value='Mozart']" );
		var elem2 = document.querySelector( "[value='Sipa']" );
		
		setValue( $textElem, "Oscar" );
		setValue( $textArea, "Because they make me feel good" );
		setChecked( $( "[value='Mozart'], [value='Sipa']" ), true );
		setSelected( $( "[value='B']" ), true );

		//Ensure deserialising with empty values does nothing
		var mockDataStore = createMockDataStore( dzString, dataStoreOpts );
		testDeserialize( null, {dataStore: mockDataStore} );
		
		//Assert
		if (shouldPreserve){
			expect( $textElem.val() ).toBe("Oscar");
			expect( $textArea.val() ).toBe("Because they make me feel good");
			expect(AutoSave.toArray(document.querySelectorAll("input[type='checkbox']:checked")))
				.toEqual([elem1,elem2]);		
			expect( $("[name='frmColorEntry']").val()).toBe("B");
		}
		else{
			expect( $textElem.val() ).toBeFalsy();
			expect( $textArea.val() ).toBeFalsy();
			expect($(document.querySelectorAll("input[type='checkbox']:checked")).length)
					.toEqual(0);
			expect( $("[name='frmColorEntry']").val() ).toBeFalsy();
		}
	};

	it('will throw an error if option is unrecognised', function(){
		
		expect(function(){
			var aSave = createAutoSave(null,{
				dataStore:{
					save: function( data, callback ){},
					Load: function( callback ){} //Should be load
				}
			});
		}).toThrowError("Unexpected parameter 'Load' in dataStore options object");
	});	
	
	it('clearEmptyValuesOnLoad option - when true, clears blank values', function(){

		internalTestClearEmptyValues(
			clearDzString,
			{clearEmptyValuesOnLoad:true},
			false
		);
	});
	
	it('clearEmptyValuesOnLoad option - when unset, clears blank values', function(){

		internalTestClearEmptyValues(
			clearDzString,
			{clearEmptyValuesOnLoad:undefined}, //Explicitly set to undefined so not defaulted by test helper code in future
			false
		);
	});
	
	it('clearEmptyValuesOnLoad option - when false, preserves blank values', function(){

		internalTestClearEmptyValues(
			clearDzString,
			{clearEmptyValuesOnLoad:false},
			true
		);
	});
	
	it('clearEmptyValuesOnLoad option - has no effect when values are missing from data set', function(){
		
		internalTestClearEmptyValues(
			"",
			{clearEmptyValuesOnLoad:true},
			true
		);
		
		internalTestClearEmptyValues(
			"",
			{clearEmptyValuesOnLoad:false},
			true
		);
		
		internalTestClearEmptyValues(
			"",
			null,
			true
		);
	});
		
	it('custom load function must have arity 2', function(){
				
		expect(function(){
			var aSave = createAutoSave(null, {
				dataStore:{
					save: _noOpSave,
					load: function(){}
				}
			})
		}).toThrowError("dataStore.load function must take 2 parameters.");

		expect(function(){
			var aSave = createAutoSave(null, {
				dataStore:{
					save: _noOpSave,
					load: function( arg1 ){}
				}
			})
		}).toThrowError("dataStore.load function must take 2 parameters.");		
		
		expect(function(){
			var aSave = createAutoSave(null, {
				dataStore:{
					save: _noOpSave,
					load: function( arg1, arg2, arg3 ){}
				}
			})
		}).toThrowError("dataStore.load function must take 2 parameters.");

		//This should not throw
		var aSave = createAutoSave(null, {
			dataStore:{
				save: _noOpSave,
				load: function( key, callback ){}
			}
		});
		
		//This next one ensure that the 'bind' function in the current browser this is being tested in preserved function arity
		var aSave = createAutoSave(null, {
			dataStore:{
				save: _noOpSave,
				load: function( key, callback ){}.bind({})
			}
		});
	});
	
	it('custom save function must have arity 3', function(){
				
		expect(function(){
			var aSave = createAutoSave(null, {
				dataStore:{
					load:_noOpLoad,
					save: function( ){}
				}
			})
		}).toThrowError("dataStore.save function must take 3 parameters.");
		
		expect(function(){
			var aSave = createAutoSave(null, {
				dataStore:{
					load:_noOpLoad,
					save: function( arg1 ){}
				}
			})
		}).toThrowError("dataStore.save function must take 3 parameters.");
		
		expect(function(){
			var aSave = createAutoSave(null, {
				dataStore:{
					load:_noOpLoad,
					save: function( arg1, arg2 ){}
				}
			})
		}).toThrowError("dataStore.save function must take 3 parameters.");

		
		expect(function(){
			var aSave = createAutoSave(null, {
				dataStore:{
					load:_noOpLoad,
					save: function( arg1, arg2, arg3, arg4 ){}
				}
			})
		}).toThrowError("dataStore.save function must take 3 parameters.");

		//This should not throw
		var aSave = createAutoSave(null, {
			dataStore:{
				load:_noOpLoad,
				save: function( key, data, callback ){}
			}
		});
	});
	
	it('both load and store functions must be set or neither', function(){
			
		expect(function(){
			var aSave = createAutoSave(null, {
				dataStore:{
					save: _noOpSave,
				}
			})
		}).toThrowError("The dataStore.load and dataStore.save parameters must 1) both be set or both be unset and 2) must be functions.");
		
		expect(function(){
			var aSave = createAutoSave(null, {
				dataStore:{
					save: _noOpSave,
					load: null		//Invalid - must be specified
				}
			})
		}).toThrowError("The dataStore.load and dataStore.save parameters must 1) both be set or both be unset and 2) must be functions.");
		
		expect(function(){
			var aSave = createAutoSave(null, {
				dataStore:{
					load: _noOpLoad
				}
			})
		}).toThrowError("The dataStore.load and dataStore.save parameters must 1) both be set or both be unset and 2) must be functions.");
		
		//Both null is valid - means no-op load/save
		var aSave = createAutoSave(null, {
			dataStore:{
				load: null,
				save: null
			}
		});
		
	})
	
	it('autosave loads controls on page load', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<div>\
								<input name='fullName'>\
								<textarea name='description'></textarea>\
								<input type='radio' name='isMusician'></input>\
								<select name='frmMusician'><option value='Mozart'>M</option>\
									<option value='JayZ'>J</option><option value='Sipa'>S</option>\
								</select>\
							</div>";
		addToSandbox(testFragment);

		//Only the fullName 
		var valuesStr = "fullName=Oscar+Wilde&frmMusician=JayZ&description=Some+Description";

		//Custom load function should be invoked on page load
		var aSave = createAutoSave(null, {
			dataStore:{
				save: function( key, data, saveComplete ){},
				load: function( key, loadComplete ){
					loadComplete(valuesStr);
				}
			}
		});
		
		//Assert
		var $descElem = getOne("[name='description']");
		expect($descElem.val()).toEqual("Some Description");
		
		var $fullNameElem = getOne("[name='fullName']");
		expect($fullNameElem.val()).toEqual("Oscar Wilde");
		
		var $selectOption = getOne("[value='JayZ']");
		expect($selectOption.prop("selected")).toEqual(true);
	});
	
	it('_INTEGRATION_TEST_: uses local storage by default if available otherwise cookies', function(){ //TODO: x-browser test
		
		//TODO: Make isLocalStorageAvailable a helper just like .getUrlPath, mock it out and break this into 2 tests
		
		var isLocalStorageAvailable = AutoSave.isLocalStorageAvailable; //Should save to cookies instead
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<input name='fullName'>\
							<textarea name='description'></textarea>";
		addToSandbox(testFragment);
		
		//Custom static postfix 
		var aSave = createAutoSave(); //No parent or customisation options

		getOne("input").val("John Wayne");
		getOne("textarea").val("~Green@fields~");
		
		//Trigger it manually for this test
		aSave.save();
		
		var valSaved = getLocalStorageElseCookie(_defaultCookieKey);
			
		expect( valSaved ).toEqual( "fullName=John+Wayne&description=~Green%40fields~" );
	});
	
	it('can be explicitly overridden to use cookies', function(){
		
		var isLocalStorageAvailable = AutoSave.isLocalStorageAvailable;
		
		if (!isLocalStorageAvailable) //Not relevant here
			return;
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<input name='fullName'>\
							<textarea name='description'></textarea>";
		addToSandbox(testFragment);
		
		//Custom static postfix 
		var aSave = createAutoSave(null,  {
						dataStore:{
								preferCookies: true
						}
					}); //No parent or customisation options

		getOne("input").val("John Wayne");
		getOne("textarea").val("~Green@ways~");

		expect(getBrowserCookie()).toBeFalsy(); //Sanity check
		
		//Trigger it manually for this test
		aSave.save();
		
		expect(localStorage.getItem("AutoSaveJS_MOCK/PATH/1")).toBeFalsy(); //Must not end up in localStorage
		
		expect(getBrowserCookie()).toEqual( "fullName=John+Wayne&description=~Green%40ways~" );
	})

	it('works across multi-page on the same domain by uniquely identifying storage key based on path', function(){
				
		//Arrange - Create and set a value on the input text box
		var testFragment = "<input name='fullName'>\
							<textarea name='description'></textarea>";
		addToSandbox(testFragment);
		
		var aSave = createAutoSave();

		getOne("input").val("John Wayne");
		getOne("textarea").val("~Green@fields~");
		
		aSave.save();
		
		expect( localStorage.getItem("AutoSaveJS_MOCK/PATH/1") ).toEqual( "fullName=John+Wayne&description=~Green%40fields~" );
		aSave.dispose( false ); //Keep the storage

		//Mock out (again) the location path temporarily to simulate another page
		var original = AutoSave.getUrlPath;
		try {

			//Assume we're on a different page now
			AutoSave.getUrlPath = function(){ return "MOCK/PATH/2"; };
			var aSave2 = createAutoSave(null, null, false);

			getOne("input").val("Bill Wagner");
			getOne("textarea").val("Blue days");
			
			aSave2.save();
			expect( localStorage.getItem("AutoSaveJS_MOCK/PATH/2") ).toEqual( "fullName=Bill+Wagner&description=Blue+days" );
			aSave2.dispose( false ); //Keep the storage
		}finally{
			
			AutoSave.getUrlPath = original;
		}
		
		//Now load the original auto-save and expect the inputs to be restored
		var aSave = createAutoSave(null, null, false);
		
		expect(getOne("input").val()).toEqual("John Wayne");
		expect(getOne("textarea").val()).toEqual("~Green@fields~");
	});

	it('can set a custom static string as the local storage key postfix', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<input name='fullName'>\
							<textarea name='description'></textarea>";
		addToSandbox(testFragment);
		
		//Custom static postfix 
		var aSave = createAutoSave(null, {
			dataStore:{
				key: "225758493995" //Some ID unique to this page
	
			}
		});

		getOne("input").val("John Wayne");
		getOne("textarea").val("~Green@fields~");		
		
		//Trigger it manually for this test
		aSave.save();
		
		expect( localStorage.getItem("AutoSaveJS_MOCK/PATH/1_225758493995") ).toEqual( "fullName=John+Wayne&description=~Green%40fields~" );
	});
	
	it('can set a custom static string as the cookie key postfix', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<input name='fullName'>\
							<textarea name='description'></textarea>";
		addToSandbox(testFragment);
		
		//Custom static postfix 
		var aSave = createAutoSave(null, {
			dataStore:{
				preferCookies: true, //Switch to cookies
				key: "225758493995" //Some ID unique to this page
	
			}
		});

		getOne("input").val("Jill Wayne");
		getOne("textarea").val("~Blue@cows~");		
		
		//Trigger it manually for this test
		aSave.save();
		
		expect( getBrowserCookie(_defaultCookieKey+"_225758493995") ).toEqual( "fullName=Jill+Wayne&description=~Blue%40cows~" );
	});
	
	it('can set a custom function as the local storage key provider', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<input name='fullName'>";
		addToSandbox(testFragment);
		
		//Custom static postfix
		var aSave = createAutoSave(null, {
			dataStore:{
				key: function(){ return "12345" } //Some ID unique to this page
			}
		});

		getOne("input").val("Wayne Stein");
		
		//Trigger it manually for this test
		aSave.save();
		
		expect( localStorage.getItem("AutoSaveJS_MOCK/PATH/1_12345") ).toEqual( "fullName=Wayne+Stein" );		
	});
	
	it('can set a custom function as the cookie key provider', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<input name='fullName'>";
		addToSandbox(testFragment);
		
		//Custom static postfix
		var aSave = createAutoSave(null, {
			dataStore:{
				preferCookies: true,
				key: function(){ return "12345" } //Some ID unique to this page
			}
		});

		getOne("input").val("John Blaine");
		
		//Trigger it manually for this test
		aSave.save();
		
		expect( getBrowserCookie(_defaultCookieKey+"_12345") ).toEqual( "fullName=John+Blaine" );
		
	});
	
  	it('values are set on all controls in watch range on page load', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<div id='unwatched'>\
								<input name='fullName'>\
								<textarea name='description'></textarea>\
								<input type='radio' name='isMusician'></input>\
								<select name='frmMusician'><option value='Mozart'>M</option>\
									<option value='JayZ'>J</option><option value='Sipa'>S</option>\
								</select>\
							</div>\
							<div id='watched'>\
								<input name='fullName'>\
							</div>";
		addToSandbox(testFragment);

		//Only the fullName 
		var valuesStr = "fullName=Oscar+Wilde&frmMusician=JayZ&description=Some+Description";
		
		var as = createAutoSave("#watched", {
			dataStore:{
				save: _noOpSave,
				load: function( key, onLoadComplete ){
					onLoadComplete( valuesStr )
				}
			}
		});
		
		//Note the duplicate input name 'fullName', but it should be set in the *2nd* div container as it's watched.
		//The 'frmMusician' should also NOT be set.
		var $descElem = getOne("[name='description']");
		expect($descElem.val()).toBeFalsy();
		
		var $fullNameElem = getOne("#unwatched [name='fullName']");
		expect($fullNameElem.val()).toBeFalsy();
		
		var $selectOption = getOne("[value='JayZ']");
		expect($selectOption.prop("selected")).toBeFalsy();
		
		//Should be set
		$fullNameElem = getOne("#watched [name='fullName']");
		expect($fullNameElem.val()).toEqual("Oscar Wilde");
	});

  });
  
  describe('serialisation: ', function(){

    it('should be correct for text entry inputs', function(){
		
		//Arrange - Set some test fields
		addToSandbox("<input name='frmNameEntry'>");
		setValue("[name='frmNameEntry']", "Nash");

		//Act - Store all field data as a string
		var szString = testSerialize();

		//Assert  - Ensure the string is as expected
		var expectedStr = "frmNameEntry=Nash";
		
		expect(szString).toEqual(expectedStr);
	});

    it('should be correct for multiple checkboxes', function(){

		//Arrange - Set some test fields
		addToSandbox("<input type='checkbox' name='color' value='Blue'><input type='checkbox' name='color' value='Red'><input type='checkbox' name='color' value='Green'>");
		
		//Toggle 2 radio buttons
		setChecked("input[value='Blue'], input[value='Green']", true);

		//Act - Store all field data as a string
		var szString = testSerialize();

		//Assert  - Ensure the string is as expected
		var expectedStr = "color=Blue&color=Green";
		expect(szString).toEqual(expectedStr);
    });
	

	it('input controls without a name are not serialised', function(){ //so we don't end up with '=' being serialised !

		//Arrange - Create and set a value on the input text box
		var testFragment = "<div>\
								<input type='text'>\
								<select>\
									<option value='x'>First</option><option value='y'>Second</option>\
								</select>\
								<textarea name=''></textarea>\
								<input type='radio'></input>\
							</div>";
		addToSandbox(testFragment);	
		
		getOne("input[type='text']").val("Oscar");
		getOne("textarea").val("Wilde");
		getOne("input[type='radio']").prop("checked", true);
		
		//Act - Store all field data as a string
		var szString = testSerialize();

		var expectedStr = "";
		expect(szString).toEqual(expectedStr);		
	});

	it('input:radio controls with a name & key of 0 are serialized correctly', function(){ //And not skipped, like blanks and nulls
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<input type='radio' name='0' value='0'>";
		addToSandbox(testFragment);	
		
		setChecked("input", true);
		
		//Act - Store all field data as a string
		var szString = testSerialize();

		var expectedStr = "0=0";
		expect(szString).toEqual(expectedStr);	
	});
	
	it('input:checkbox controls with a name & key of 0 are serialized correctly', function(){ //And not skipped, like blanks and nulls
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<input type='checkbox' name='0' value='0'>";
		addToSandbox(testFragment);	
		
		setChecked("input", true);
		
		//Act - Store all field data as a string
		var szString = testSerialize();

		var expectedStr = "0=0";
		expect(szString).toEqual(expectedStr);	
	});
		
	it('input:text controls with a name & key of 0 are serialized correctly', function(){ //And not skipped, like blanks and nulls
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<input type='text' name='0'>";
		addToSandbox(testFragment);	
		
		setValue("input", 0);
		
		//Act - Store all field data as a string
		var szString = testSerialize();

		var expectedStr = "0=0";
		expect(szString).toEqual(expectedStr);	
	});

	it('select controls with a name & key of 0 are serialized correctly', function(){ //And not skipped, like blanks and nulls
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<select multiple name='0'>\
								<option id='zero' value='0'>Zero</option>\
								<option id='one' value='1'>One</option> \
								<option>Red</option>\
						   </select>";
		addToSandbox(testFragment);
		setSelected("#zero,#one", true);
		
		//Act - Store all field data as a string 
		var szString = testSerialize();

		//Assert  - Ensure the string has zeroes
		var expectedStr = "0=0&0=1";
		expect(szString).toEqual(expectedStr);
	});
	
	it('textarea controls with a name & key of 0 are serialized correctly', function(){ //And not skipped, like blanks and nulls
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<textarea name='0'>";
		addToSandbox(testFragment);	
		
		setValue("textarea", 0);
		
		//Act - Store all field data as a string
		var szString = testSerialize();

		var expectedStr = "0=0";
		expect(szString).toEqual(expectedStr);	
	});

	//As per whatwg spec 4.10.10, should use the element's text IDL attribute if no option specified	
	it('select multiple options with no name attribute should use inner text for serialising',function(){

		//Arrange - Create and set a value on the input text box - check special characters preserved
		var testFragment = "<select multiple name='frmNameEntry'>\
								<option id='toChoose2'>0</option>\
								<option id='toChoose'>Green & Black+Pistachio</option>\
								<option>Red</option>\
						   </select>";
		addToSandbox(testFragment);
		setSelected("#toChoose,#toChoose2", true);
		
		//Act - Store all field data as a string
		var szString = testSerialize();

		//Assert  - Ensure the string is as expected - %25 is a %
		var expectedStr = "frmNameEntry=0&frmNameEntry=Green+%26+Black%2BPistachio"; //%2b->'+', %26->'&'
		expect(szString).toEqual(expectedStr);
	});

	it('spaces are converted to plus symbol on serialising', function(){
	
		//Arrange - Set some test fields
		addToSandbox("<input name='frmNameEntry'>");
		setValue("input", "In HTML %20 is used to represent spaces"); //Ensure a raw %20 is not converted !

		//Act - Store all field data as a string
		var szString = testSerialize();

		//Assert  - Ensure the string is as expected - %25 is a %
		var expectedStr = "frmNameEntry=In+HTML+%2520+is+used+to+represent+spaces";
		expect(szString).toEqual(expectedStr);
	});

	it('serialised string with special chars are encoded',function(){
	
		//Arrange - Create and set a value on the input text box
		var testFragment = "<input type='text' name='frmNameEntry'><input type='checkbox' name='frmColours' value='Blue'><input type='checkbox' name='frmColours' value='Red'>";
		addToSandbox(testFragment);
		
		//Enter text with symbols and also check all radios to ensure ampsersand is tested in (de)serialisation
		setValue("[name='frmNameEntry']", "mailto:someone@example.com&subject='Dont forget %20 is used to represent spaces!.-_.!~*()'");
		setChecked("[name='frmColours']", true);

		//Act - Store all field data as a string
		var fieldData = testSerialize();
		
		//Ensure serialised string is correct
		expect(fieldData).toEqual("frmNameEntry=mailto%3Asomeone%40example.com%26subject%3D'Dont+forget+%2520+is+used+to+represent+spaces!.-_.!~*()'&frmColours=Blue&frmColours=Red");
	});
		
	it('autosave does not serialise controls outside of parentElement', function(){

		//Arrange - Create and set a value on the input text box
		var testFragment = "<h3>Please choose your preferred musicians:</h3>\
							<div id='group1'>\
								<input type='checkbox' name='frmMusician' value='Mozart'>Mozart Van...\
								<input type='checkbox' name='frmMusician' value='JayZ'>JayZ\
								<input type='checkbox' name='frmMusician' value='Sipa'>Sipa\
								<input type='text' name='Reason'>"
							+
							"</div><div id='group2'>"+
								"<input type='text' name='frmAddress'></input>"+
							"</div>";
		
		addToSandbox(testFragment);
		setChecked("[value='JayZ']", true);
		setValue("[name='Reason']", "No Reason");
		setValue("[name='frmAddress']", "Because they make me feel good!");

		var sentDataValue = testSerialize(document.querySelector("#group1"));
		
		expect(sentDataValue).toEqual("frmMusician=JayZ&Reason=No+Reason");
	});
	

    it('AutoSave.getSerialisedValues returns all values if multiple', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<h3>Please choose your preferred musicians:</h3>\
							<div id='group1'>\
								<input type='checkbox' name='frmMusician' value='0'>Zero\
								<input type='checkbox' name='frmMusician' value='1'>One\
								<input type='checkbox' name='frmMusician' value='2'>Two\
								<input type='text' name='frmAddress'></input>\
							</div>";
		
		addToSandbox(testFragment);
		setChecked("[value='2']", true);
		setChecked("[value='0']", true);
		setValue("[name='frmAddress']", "Because they make me feel good!");

		var sentDataValue = testSerialize();

		expect(["0","2"]).toEqual(AutoSave.getSerialisedValues(sentDataValue, "frmMusician"));
		expect(["Because they make me feel good!"]).toEqual(AutoSave.getSerialisedValues(sentDataValue, "frmAddress"));
		expect([]).toEqual(AutoSave.getSerialisedValues(sentDataValue, "FAKE")); //Non-null always
	});
  });

  describe('multi instance: ', function(){
  
    var groupFragment = "	<input type='checkbox' name='frmMusician' value='Mozart'>Mozart...\
							<input type='checkbox' name='frmMusician' value='JayZ'>JayZ\
							<input type='checkbox' name='frmMusician' value='Sipa'>Sipa\
							<input type='text' name='Reason'>\
							<select name='Type'>\
								<option value='Drum&Bass'>Drum&Bass</option>\
								<option value='Classical'>Classical</option>\
								<option value='Hip Hop'>Hip Hop</option>\
							</select>\
						";
	
	//Runs parameter function at right time once elems are in DOM
	gParam = function(param, type){
		if (type == 0)
			return param;
		else if (type == 1)
			return $(param);
		else if (type == 2)
			return document.querySelector(param);
		else
			throw "Unexpected type";
	}
	
	internal_run_multi_instance_test = function(testFragment, parentParam1, parentParam2, pType, opts1, opts2){
		
		resetSandbox();
		addToSandbox(testFragment);

		//Multiple non-overlapping instances, create with no-reset arg so no disposal
		var inst1 = createAutoSave(gParam(parentParam1, pType), opts1);
		var inst2 = createAutoSave(gParam(parentParam2, pType), opts2, false);
		
		//inst1
		setChecked ($("#d1 [value='JayZ']"), true);
		setSelected($("#d1 [value='Classical']"), true);
		setValue   ($("#d1 [name='Reason']"), "Its really good");

		//inst2
		setChecked ($("#d2 [value='Mozart']"));
		setSelected($("#d2 [value='Hip Hop']"));
		setValue   ($("#d2 [name='Reason']"), "I like it a lot");

		jasmine.clock().tick(60*1000); //Let the auto-save debounce elapse
		
		inst1.dispose(false);
		inst2.dispose(false);
				
		//Recreate the default state HTML
		resetSandbox();
		addToSandbox(testFragment);
		
		//Rehydrate to round-trip the test
		inst1 = createAutoSave(gParam(parentParam1, pType), opts1, false);
		inst2 = createAutoSave(gParam(parentParam2, pType), opts2, false);
		
		//inst1
		expect ($("#d1 [value='JayZ']").prop("checked")).toBeTruthy();
		expect ($("#d1 [value='Classical']").prop("selected")).toBeTruthy();
		expect ($("#d1 [name='Reason']").val()).toBe("Its really good");

		//inst2
		expect ($("#d2 [value='Mozart']").prop("checked")).toBeTruthy();
		expect ($("#d2 [value='Hip Hop']").prop("selected")).toBeTruthy();
		expect ($("#d2 [name='Reason']").val()).toBe("I like it a lot");
		
		//Dispose but this time clear out all stores
		inst1.dispose(true);
		inst2.dispose(true);		
	};
	
	it('uses the form name if form supplied - hence can distinguish multiple form instances on the same page', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<form name='group1'><div id='d1'>"+groupFragment+"</div></form>"+
						   "<form name='group2'><div id='d2'>"+groupFragment+"</div></form>";
						   
		//Supply selector string
		internal_run_multi_instance_test(testFragment, "[name='group1']", "[name='group2']", 0);
		
		//Supply jQuery elements
		internal_run_multi_instance_test(testFragment, "[name='group1']", "[name='group2']", 1);
		
		//Supply native elements
		internal_run_multi_instance_test(testFragment, "[name='group1']", "[name='group2']", 2);
	});
	
	it('form name can be 0', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<form name='0'><div id='d1'>"+groupFragment+"</div></form>"+
						   "<form class='some_other'><div id='d2'>"+groupFragment+"</div></form>"; //should use default
		
		//Supply plain string selector
		internal_run_multi_instance_test(testFragment, "[name='0']", ".some_other", 0);
	});
	
	it('1 form name can be missing when distinguishing multiple instance on the same page', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<form class='other'><div id='d1'>"+groupFragment+"</div></form>"+
						   "<form name='group2'><div id='d2'>"+groupFragment+"</div></form>";
						   
		//Supply selector string
		internal_run_multi_instance_test(testFragment, ".other", "[name='group2']", 0);
		
		//Supply jQuery elements
		internal_run_multi_instance_test(testFragment, ".other", "[name='group2']", 1);
		
		//Supply native elements
		internal_run_multi_instance_test(testFragment, ".other", "[name='group2']", 2);
	});
	
	it('multiple form names missing will throw an error', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<form class='other'><div id='d1'>"+groupFragment+"</div></form>"+
						   "<form class='some_other'><div id='d2'>"+groupFragment+"</div></form>";
		
		var errMsg = "There is already an AutoSave instance with the storage key of 'AutoSaveJS_MOCK/PATH/1'. See the documentation for solutions.";
		
		//Supply selector string
		expect(function(){
			internal_run_multi_instance_test(testFragment, ".other", ".some_other", 0);
		}).toThrowError(errMsg);
		
		//Supply jQuery elements
		expect(function(){
			internal_run_multi_instance_test(testFragment, ".other", ".some_other", 1);
		}).toThrowError(errMsg);
		
		//Supply native elements
		expect(function(){
			internal_run_multi_instance_test(testFragment, ".other", ".some_other", 2);
		}).toThrowError(errMsg);
	});
	
	it('multiple forms with identical names will throw an error', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<form name='group1' class='other'><div id='d1'>"+groupFragment+"</div></form>"+
						   "<form name='group1' class='some_other'><div id='d2'>"+groupFragment+"</div></form>";
		
		var errMsg = "There is already an AutoSave instance with the storage key of 'AutoSaveJS_MOCK/PATH/1_group1'. See the documentation for solutions.";
		
		//Supply selector string
		expect(function(){
			internal_run_multi_instance_test(testFragment, ".other", ".some_other", 0);
		}).toThrowError(errMsg);
		
		//Supply jQuery elements
		expect(function(){
			internal_run_multi_instance_test(testFragment, ".other", ".some_other", 1);
		}).toThrowError(errMsg);
		
		//Supply native elements
		expect(function(){
			internal_run_multi_instance_test(testFragment, ".other", ".some_other", 2);
		}).toThrowError(errMsg);
	});

	it('multiple forms with identical keys are allowed if previous instance is disposed', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<form name='some'><div id='d1'>"+groupFragment+"</div></form>"+
						   "<form class='some_other'><div id='d2'>"+groupFragment+"</div></form>"; //should use default
		
		addToSandbox(testFragment);
		
		var inst1 = createAutoSave("[name='some']", null, false);
		var inst2 = createAutoSave(".some_other",   null, false);

		expect(function(){
			var inst3 = createAutoSave("[name='some']", null, false);
		}).toThrowError("There is already an AutoSave instance with the storage key of 'AutoSaveJS_MOCK/PATH/1_some'. See the documentation for solutions.");
		
		expect(function(){
			var inst4 = createAutoSave(".some_other", null, false);
		}).toThrowError("There is already an AutoSave instance with the storage key of 'AutoSaveJS_MOCK/PATH/1'. See the documentation for solutions.");

		//Dispose first, should be able to create new
		inst1.dispose();
		var inst3 = createAutoSave("[name='some']", null, false);
		
		//Dispose 2nd - ''
		inst2.dispose();
		var inst4 = createAutoSave(".some_other", null, false);
		
		inst3.dispose();
		inst4.dispose();
	});
	
	it('multiple non-form elements will throw an error', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<div class='other'><div id='d1'>"+groupFragment+"</div></div>"+
						   "<div class='some_other'><div id='d2'>"+groupFragment+"</div></div>";
		
		var errMsg = "There is already an AutoSave instance with the storage key of 'AutoSaveJS_MOCK/PATH/1'. See the documentation for solutions.";
		
		//Supply selector string
		expect(function(){
			internal_run_multi_instance_test(testFragment, ".other", ".some_other", 0);
		}).toThrowError(errMsg);
		
		//Supply jQuery elements
		expect(function(){
			internal_run_multi_instance_test(testFragment, ".other", ".some_other", 1);
		}).toThrowError(errMsg);
		
		//Supply native elements
		expect(function(){
			internal_run_multi_instance_test(testFragment, ".other", ".some_other", 2);
		}).toThrowError(errMsg);
	});

	it('multiple instances can be given different keys', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<div class='other'><div id='d1'>"+groupFragment+"</div></div>"+
						   "<div class='some_other'><div id='d2'>"+groupFragment+"</div></div>";
			
		//Supply selector string
		internal_run_multi_instance_test(testFragment, ".other", ".some_other", 0,
			{dataStore:{key:"O1"}}, {dataStore:{key:"O2"}});
		
		//Supply jQuery elements
		internal_run_multi_instance_test(testFragment, ".other", ".some_other", 1,
			{dataStore:{key:"O1"}}, {dataStore:{key:"O2"}});
		
		//Supply native elements
		internal_run_multi_instance_test(testFragment, ".other", ".some_other", 2,
			{dataStore:{key:"O1"}}, {dataStore:{key:"O2"}});
	});

	it('AutoSave.resetAll resets custom-keyed stores', function(){
				
		//Arrange - Create and set a value on the input text box
		var testFragment = "<input type='text' name='Reason'><input type='text' name='Cause'>";
		
		addToSandbox(testFragment);
		
		/* First set on cookies */
		
		//Create with a default key - create with no-reset arg so no dispose previous instance
		var aSave1 = createAutoSave("[name='Reason']",{
			dataStore:{
				preferCookies: true
			}
		}, false);
		
		//Create with a custom key
		var aSave2 = createAutoSave("[name='Cause']",{
			dataStore:{
				key: "myCustomKey",
				preferCookies: true
			}
		}, false);
		
		setValue("[name='Reason']", "So Good");
		setValue("[name='Cause']", "Just Cause");
		
		//Wait for auto-save to kick in and save
		jasmine.clock().tick(60*1000);

		expect(getBrowserCookie(_defaultCookieKey)).toEqual("Reason=So+Good");
		expect(getBrowserCookie(_defaultCookieKey+"_myCustomKey")).toEqual("Cause=Just+Cause");
		
		AutoSave.resetAll();

		expect(getBrowserCookie(_defaultCookieKey)).toBeFalsy();
		expect(getBrowserCookie(_defaultCookieKey+"_myCustomKey")).toBeFalsy();
		
		aSave1.dispose( true );
		aSave2.dispose( true );
		
		/* Now do with local storage if available */
		
		if ( !AutoSave.isLocalStorageAvailable )
			return;
		
		//Create with a default key - notice how we can create with same key as it's been reset
		var aSave1 = createAutoSave("[name='Reason']", null, false);
		
		//Create with a custom key
		var aSave2 = createAutoSave("[name='Cause']",{
			dataStore:{
				key: "myCustomKey"
			}
		}, false);

		setValue("[name='Reason']", "So Good");
		setValue("[name='Cause']", "Just Cause");
		
		//Wait for auto-save to kick in and save
		jasmine.clock().tick(60*1000);

		expect(getLocalStorageElseCookie("AutoSaveJS_MOCK/PATH/1")).toEqual("Reason=So+Good");
		expect(getLocalStorageElseCookie("AutoSaveJS_MOCK/PATH/1_myCustomKey")).toEqual("Cause=Just+Cause");
		
		AutoSave.resetAll();

		expect(getLocalStorageElseCookie("AutoSaveJS_MOCK/PATH/1")).toBeFalsy();
		expect(getLocalStorageElseCookie("AutoSaveJS_MOCK/PATH/1_myCustomKey")).toBeFalsy();

		aSave1.dispose( true );
		aSave2.dispose( true );
	});
  });
  
  describe('top level parameters: ', function(){  

	it('will throw an error if option is unrecognised', function(){
		
		expect(function(){
			var aSave = createAutoSave(null,{
				datastore:{} //Should be dataStore
			});
		}).toThrowError("Unexpected parameter 'datastore' in top level options object");
	});
  
	it('onLog handler can override default behaviour of logging', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<h3>Please enter your preferred musician:</h3>\
							<input type='text' name='musician'>";
		
		addToSandbox(testFragment);
		
		//Watch the console for messages
		var spy = spyOn( console, "info" );
				
		var defaultOpt = {
			onLog:function( level, msg ){
				
				if ( msg != 'Executing save: after element(s) changed' )
					return; //Some other irrelevant log message
				
				expect( level ).toEqual( AutoSave.LOG_INFO );
				
				if(ctr == 0)
					return; //Leave as undefined, which shouldn't change anything
				else if (ctr == 1)
					return false; //Should cancel the logging altogther
				else if (ctr == 2)
					return "Override Test";
				else if (ctr == 3)
					return  ["Some", {obj:12345}];
			}
		};
		
		var ctr = 0;
		var autoSave = createAutoSave(null, defaultOpt);
		
		//Setting a value should trigger an auto-save which should log information msg about the same
		setValue("[name='musician']", "Mozart");
		jasmine.clock().tick(60*1000);
		expect(console.info).toHaveBeenCalledWith( 'Executing save: after element(s) changed' );
		
		spy.calls.reset();
		
		ctr = 1;
		setValue("[name='musician']", "Beethoven");
		jasmine.clock().tick(60*1000);
		expect(console.info).not.toHaveBeenCalledWith( 'Executing save: after element(s) changed' );
		
		spy.calls.reset();
		
		ctr = 2;
		setValue("[name='musician']", "Debussy");
		jasmine.clock().tick(60*1000);
		expect(console.info).not.toHaveBeenCalledWith( 'Executing save: after element(s) changed' );
		
		spy.calls.reset();
		
		ctr = 3;
		setValue("[name='musician']", "Debussy");
		jasmine.clock().tick(60*1000);
		expect(console.info).not.toHaveBeenCalledWith( 'Executing save: after element(s) changed' );
		expect(console.info).toHaveBeenCalledWith("Some", {obj:12345});
	});

	it('onLog handler set to false will disable all logging', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<h3>Please enter your preferred musician:</h3>\
							<input type='text' name='musician'>";
		
		addToSandbox(testFragment);
		
		//Watch the console for messages
		var spy = spyOn( console, "info" );
				
		var defaultOpt = {
			onLog:function(){return false}
		};
		
		var autoSave = createAutoSave(null, defaultOpt);
		
		//Setting a value should trigger an auto-save which should log information msg about the same
		setValue("[name='musician']", "Mozart");
		jasmine.clock().tick(60*1000);
		expect(console.info).not.toHaveBeenCalled();
	});

	
	it('onLog callback option behaviour is correct - debug level will revert to \'log\' if debug not available', function(){

		var level = console.debug ? "debug" : "info";
		
		//Watch the console for messages
		var spy = spyOn( console, level );
		
		var autoSave = createAutoSave(null, {autoLoadTrigger: null}); //Will trigger a debug/info msg
		
		//Setting a value should trigger an auto-save which should log information msg about the same
		expect(console[level]).toHaveBeenCalledWith( 'User requested no auto-load. Skipping...' );
	});
	
	it('onLog callback option channels log messages to correct AutoSave instance when multiple are present', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<h3>Please enter your preferred musician:</h3>\
							<input type='text' name='musician'>";
		
		addToSandbox(testFragment);
		
		var num1Called = false, num2Called = false;
		
		var autoSave_1 = createAutoSave("#Bad_Selector", 
			{
				dataStore:{key:"KEY_1"},
				
				onLog:function( level, msg ){
					
					//There'll be a lot of log messages so avoid false negatives by checking our expected behaviour wrt particular messages
					if ( msg == 'Executing save: after element(s) changed' )
						throw new Exception("Log message appeared in wrong instance");
					
					if (msg == "RootControls parameter resolved to zero elements - maybe your selector(s) werent right?"){
						
						num1Called = true;
						expect( level ).toEqual( AutoSave.LOG_WARN );
					}
				}
			}, false);
			
		var autoSave_2 = createAutoSave(null, 
			{
				dataStore:{key:"KEY_2"},
				
				onLog:function( level, msg ){
					
					//There'll be a lot of log messages so avoid false negatives by checking our expected behaviour wrt particular messages
					if ( msg == "RootControls parameter resolved to zero elements - maybe your selector(s) werent right?" )
						throw new Exception("Log message appeared in wrong instance");
					
					if ( msg == 'Executing save: after element(s) changed' ){
						
						num2Called = true;
						expect( level ).toEqual( AutoSave.LOG_INFO );
					}
				}
			}, false);

		setValue("[name='musician']", "Beethoven");
		jasmine.clock().tick(60*1000);
		
		expect( num1Called ).toBe(true);
		expect( num2Called ).toBe(true);
		
		autoSave_1.dispose( true );
		autoSave_2.dispose( true );
	});
  
	//NB: Error level is hard to test as normally an exception is thrown at the time
	it('onLog callback option behaviour is correct - warn level', function(){
	
		//Watch the console for messages
		var spy = spyOn( console, "warn" );
				
		var defaultOpt = {
			onLog:function( level, msg ){
				
				if ( msg != "RootControls parameter resolved to zero elements - maybe your selector(s) werent right?" )
					return;
				
				expect( level ).toEqual( AutoSave.LOG_WARN );
				
				if(ctr == 0)
					return; //Leave as undefined, which shouldn't change anything
				else if (ctr == 1)
					return false; //Should cancel the logging altogther
				else if (ctr == 2)
					return "Warn Override Test";
			}
		};
		
		var ctr = 0;
		
		//Setting a value should trigger an auto-save which should log information msg about the same
		createAutoSave("#NON_EXISTENT", defaultOpt);
		expect(console.warn).toHaveBeenCalledWith( "RootControls parameter resolved to zero elements - maybe your selector(s) werent right?" );
		
		spy.calls.reset();
		
		ctr = 1;
		createAutoSave("#NON_EXISTENT", defaultOpt);
		expect(console.warn).not.toHaveBeenCalledWith( "RootControls parameter resolved to zero elements - maybe your selector(s) werent right?" );
		
		spy.calls.reset();
		
		ctr = 2;
		createAutoSave("#NON_EXISTENT", defaultOpt);
		expect(console.warn).not.toHaveBeenCalledWith( "RootControls parameter resolved to zero elements - maybe your selector(s) werent right?" );
		expect(console.warn).toHaveBeenCalledWith('Warn Override Test');
	});

	it('onLog callback option with object args gets invoked correctly', function(){
	
		var debugArgs=[], infoArgs=[], warnArgs=[], errorArgs=[];
		
		var defaultOpt = {
			onLog:{
				debug:function(){
					debugArgs.push(AutoSave.toArray(arguments));
				},
				info:function(){
					infoArgs.push(AutoSave.toArray(arguments));
				},
				warn:function(msg){
					warnArgs.push(AutoSave.toArray(arguments));
				},
				error:function(){
					errorArgs.push(AutoSave.toArray(arguments));
				},
				
				ignorable_other:{} //should not complain about other keys
			}
		};
		
		createAutoSave("#NON_EXISTENT", defaultOpt);
		
		//Debug level messages should only be sent to correct handler
		var debugMsg = "Hooking listeners. Seeking external controls for hooking: true";
		expect(infoArgs.filter(function(x){return x[0]==debugMsg}).length).toEqual(0);
		expect(debugArgs.filter(function(x){return x[0]==debugMsg}).length).toEqual(1);
		expect(warnArgs.filter(function(x){return x[0]==debugMsg}).length).toEqual(0);
		expect(errorArgs.filter(function(x){return x[0]==debugMsg}).length).toEqual(0);
			
		//Warn level messages should only be sent to correct handler
		var warnMsg = "RootControls parameter resolved to zero elements - maybe your selector(s) werent right?";
		expect(infoArgs.filter(function(x){return x[0]==warnMsg}).length).toEqual(0);
		expect(debugArgs.filter(function(x){return x[0]==warnMsg}).length).toEqual(0);
		expect(warnArgs.filter(function(x){return x[0]==warnMsg}).length).toEqual(1);
		expect(errorArgs.filter(function(x){return x[0]==warnMsg}).length).toEqual(0);
			
		//Info level messages should only be sent to correct handler
		var infoMsg = "Auto-Save trigger was initialised with default interval";
		expect(infoArgs.filter(function(x){return x[0]==infoMsg&&x[1]==3000}).length).toEqual(1);
		expect(debugArgs.filter(function(x){return x[0]==infoMsg}).length).toEqual(0);
		expect(warnArgs.filter(function(x){return x[0]==infoMsg}).length).toEqual(0);
		expect(errorArgs.filter(function(x){return x[0]==infoMsg}).length).toEqual(0);
	});
	
	it('onLog callback option object can override message', function(){
	
		//Watch the console for messages
		var spy = spyOn( console, "warn" );
				
		var ctr = 0;
		
		var defaultOpt = {
			onLog:{
				warn:function(msg){
					
					if ( msg != "RootControls parameter resolved to zero elements - maybe your selector(s) werent right?" )
						return;
					
					warnArgs = AutoSave.toArray(arguments);
					
					if(ctr == 0)
						return; //Leave as undefined, which shouldn't change anything
					else if (ctr == 1)
						return false; //Should cancel the logging altogther
					else if (ctr == 2)
						return "Warn Override Test";
				},
			}
		};
		
		//Setting a value should trigger an auto-save which should log information msg about the same
		createAutoSave("#NON_EXISTENT", defaultOpt);
		expect(console.warn).toHaveBeenCalledWith( "RootControls parameter resolved to zero elements - maybe your selector(s) werent right?" );
		
		spy.calls.reset();
		
		ctr = 1;
		createAutoSave("#NON_EXISTENT", defaultOpt);
		expect(console.warn).not.toHaveBeenCalledWith( "RootControls parameter resolved to zero elements - maybe your selector(s) werent right?" );
		
		spy.calls.reset();
		
		ctr = 2;
		createAutoSave("#NON_EXISTENT", defaultOpt);
		expect(console.warn).not.toHaveBeenCalledWith( "RootControls parameter resolved to zero elements - maybe your selector(s) werent right?" );
		expect(console.warn).toHaveBeenCalledWith('Warn Override Test');
	});

	
	it('custom autosave element gets set back to inline-display style', function(){

		var testFragment = "<h3>Please enter your preferred musician:</h3>\
							<input type='text' name='musician'>";
		
		addToSandbox(testFragment);
		
		var _currCallback = null; //This is what the save function is expecting to be called to complete the save operation
		
		var defaultOpt = {
			
			saveNotification: {
				template: "<h1 class='my_save_msg' style='display:inline-block'>My template override saving msg...</h1>"
			},
			dataStore:{
				load: _noOpLoad,
				save: function( key, data, callback ){
					
					_currCallback = callback;
				}
			}
		};
		
		var autoSave = createAutoSave(null, defaultOpt);
		
		//Setting a value should trigger an auto-save which should trigger showing the save banner
		setValue("[name='musician']", "Mozart");
		jasmine.clock().tick(60*1000);
		expect($(".my_save_msg").css("display")).toEqual("inline-block");
		
		//Complete save operation
		_currCallback();
	});
	
	it('bound callbacks are invoked in original context', function(){

		var testFragment = "<h3>Please enter your preferred musician:</h3>\
							<input type='text' name='musician'>";
		
		addToSandbox(testFragment);
		
		var testContext = {
			
			someContextValue: 199
		};
		
		var onInitPassed, onPreLoadPassed, loadPassed, savePassed, logPassed;
		var defaultOpt = {
			
			onInitialised: function(){
				
				onInitPassed = this.someContextValue==199;
			}.bind(testContext),
			
			onPreLoad: function(){
				
				onPreLoadPassed = this.someContextValue==199;
			}.bind(testContext),
			
			dataStore: {
				load: function(key, callback){
					
					loadPassed = this.someContextValue==199;
					callback();
				}.bind(testContext),
				save: function( key, data, callback ){
					
					savePassed = this.someContextValue==199;
					callback();
				}.bind(testContext)
			},
			
			onLog: function(){
				
				logPassed = this.someContextValue==199;
			}.bind(testContext)
		};
		
		var autoSave = createAutoSave(null, defaultOpt);
		
		//Setting a value should trigger an auto-save which should trigger showing the save banner
		setValue("[name='musician']", "Mozart");
		jasmine.clock().tick(60*1000);

		expect(onInitPassed).toEqual(true);
		expect(onPreLoadPassed).toEqual(true);
		expect(loadPassed).toEqual(true);
		expect(savePassed).toEqual(true);
		expect(logPassed).toEqual(true);
	});

	
	it('a custom object can be specified as the log data', function(){
		
		//Watch the console for messages
		var spy = spyOn( console, "warn" );
				
		var defaultOpt = {
			onLog:function( level, msg ){
				
				//Override the msg with a custom
				if ( msg == "RootControls parameter resolved to zero elements - maybe your selector(s) werent right?" )
					return {nested:{object:100}}

				//Dont return anything so it logs to console so we can verify console args too
			}
		};
		
		//Setting a value should trigger an auto-save which should log information msg about the same
		createAutoSave("#NON_EXISTENT", defaultOpt);
		expect(console.warn).toHaveBeenCalledWith( {nested:{object:100}} );
	});
	
	it('logging can take any number of parameters', function(){

		//Watch the console for messages
		var spy = spyOn( console, "info" );
		
		var wasCalled = false;
		var defaultOpt = {
			onLog:function( level, msg, extraArg ){
				
				if ( msg == "Min duration initialised with custom interval" ) {
					expect(extraArg).toEqual(2700)
					wasCalled = true;
				}
				
				//Dont return anything so it logs to console so we can verify console args too
			},
			saveNotification:{
				minShowDuration: 2700
			}			
		};

		var autoSave = createAutoSave(null, defaultOpt);
		
		expect(console.info).toHaveBeenCalledWith( "Saving Min duration initialised with custom interval", 2700 );
	});
	
	it('save notification min show time can be configured with minShowDuration option', function(){

		var testFragment = "<h3>Please enter your preferred musician:</h3>\
							<input type='text' name='musician'>";
		
		addToSandbox(testFragment);
		
		var defaultOpt = {
			
			dataStore:{
				load: _noOpLoad,
				save: _noOpSave
			},
			saveNotification:{
				minShowDuration: 3000
			}
		};
		
		var autoSave = createAutoSave(null, defaultOpt);
		
		//Setting a value should show the auto-save banner until we invoke the callback
		setValue("[name='musician']", "Mozart");
		
		//Let debounce interval elapse
		jasmine.clock().tick(AutoSave.DEFAULT_AUTOSAVE_INTERVAL + 1);

		//Should show when save kicks off
		expect($(".autosave-saving").css("display")).not.toEqual("none");
			
		//After ~2.9s, should not hide
		jasmine.clock().tick(2900);
		expect($(".autosave-saving").css("display")).not.toEqual("none");
		
		jasmine.clock().tick(200);

		//Ensure after ~3s it does hide
		expect($(".autosave-saving").css("display")).toEqual("none");
	});
	
	it('save notification shows for a mininum of half a second by default', function(){
	
		var testFragment = "<h3>Please enter your preferred musician:</h3>\
							<input type='text' name='musician'>";
		
		addToSandbox(testFragment);
		
		var defaultOpt = {
			
			dataStore:{
				load: _noOpLoad,
				save: _noOpSave
			}
		};
		
		var autoSave = createAutoSave(null, defaultOpt);
		
		//Initially should not be showing
		expect($(".autosave-saving").css("display")).toEqual("none");
		
		//Setting a value should show the auto-save banner until we invoke the callback
		setValue("[name='musician']", "Mozart");
		
		let INTERVAL = 50;
		
		let showCtr=0;
		
		//Wait for banner to show after debouncing
		while($(".autosave-saving").css("display")=="none") {
			
			jasmine.clock().tick(INTERVAL);
			
			if (AutoSave.DEFAULT_AUTOSAVE_INTERVAL - showCtr*INTERVAL < 0)
				throw new Error("AutoSave notification didnt show");
			
			showCtr++;
		}
		
		let hideCtr=0;
		while($(".autosave-saving").css("display")!="none") {

			jasmine.clock().tick(INTERVAL);
			
			if (AutoSave.DEFAULT_AUTOSAVE_SHOW_DURATION - hideCtr*INTERVAL < 0)
				throw new Error("AutoSave notification didnt hide");
			
			hideCtr++;
		}
		
		//Check intervals taking our ticking into account
		expect(hideCtr).toBeGreaterThanOrEqual((500-INTERVAL-INTERVAL)/INTERVAL);
		expect(hideCtr).toBeLessThanOrEqual((500+INTERVAL+INTERVAL)/INTERVAL);
	});
	
	it('onToggleSaveNotification fires at correct time even if save is async', function(){
		
		var testFragment = "<h3>Please enter your preferred musician:</h3>\
							<input type='text' name='musician'>";
		
		addToSandbox(testFragment);
		
		var _currCallback = null; //This is what the save function is expecting to be called to complete the save operation
		
		var defaultOpt = {
			
			dataStore:{
				load: _noOpLoad,
				save: function( key, data, callback ){
					
					_currCallback = callback;
				}
			}
		};
		
		var autoSave = createAutoSave(null, defaultOpt);
		
		//Setting a value should show the auto-save banner until we invoke the callback
		setValue("[name='musician']", "Mozart");
		jasmine.clock().tick(60*1000);
		expect($(".autosave-saving").length).toEqual(1);
		expect($(".autosave-saving").css("display")).not.toEqual("none");
		
		//Complete save operation 'async'
		_currCallback();
		
		//Should only now get hidden 
		expect($(".autosave-saving").css("display")).toEqual("none");
	});
	
	it('Save notification by default shows an auto-saving banner', function(){

		var testFragment = "<h3>Please enter your preferred musician:</h3>\
							<input type='text' name='musician'>";
		
		addToSandbox(testFragment);
		
		var _currCallback = null; //This is what the save function is expecting to be called to complete the save operation
		
		var defaultOpt = {
			
			dataStore:{
				load: _noOpLoad,
				save: function( key, data, callback ){
					
					_currCallback = callback;
				}
			}
		};
		
		var autoSave = createAutoSave(null, defaultOpt);
		
		//Setting a value should trigger an auto-save which should trigger showing the save banner
		setValue("[name='musician']", "Mozart");
		jasmine.clock().tick(60*1000);
		expect($(".autosave-saving").length).toEqual(1);
		expect($(".autosave-saving").css("display")).not.toEqual("none");
		expect($(".autosave-saving .autosave-msg").text()).toEqual("Saving..."); //Default text
		
		//Complete save operation
		_currCallback();
		
		//Should get hidden
		expect($(".autosave-saving").css("display")).toEqual("none");
	});
	
	it('Save notification can be customised to not show anything by setting null', function(){
				
		var testFragment = "<h3>Please enter your preferred musician:</h3>\
							<input type='text' name='musician'>";
		
		addToSandbox(testFragment);
		
		var _currCallback = null; //This is what the save function is expecting to be called to complete the save operation
		
		var defaultOpt = {
			
			saveNotification: null,
			dataStore:{
				load: _noOpLoad,
				save: function( key, data, callback ){
					
					_currCallback = callback;
				}
			}
		};
		
		var autoSave = createAutoSave(null, defaultOpt);
		
		//Setting a value should trigger an auto-save which should trigger showing the save banner
		setValue("[name='musician']", "Mozart");
		jasmine.clock().tick(60*1000);
		expect($(".autosave-saving").length).toEqual(0);
	});
	
	it('Save notification can be customised with a specific message', function(){

		var testFragment = "<h3>Please enter your preferred musician:</h3>\
							<input type='text' name='musician'>";
		
		addToSandbox(testFragment);
		
		var _currCallback = null; //This is what the save function is expecting to be called to complete the save operation
		
		var defaultOpt = {
			
			saveNotification: {
				message: "Save override..."
			},
			dataStore:{
				load: _noOpLoad,
				save: function( key, data, callback ){
					
					_currCallback = callback;
				}
			}
		};
		
		var autoSave = createAutoSave(null, defaultOpt);
		
		//Setting a value should trigger an auto-save which should trigger showing the save banner
		setValue("[name='musician']", "Mozart");
		jasmine.clock().tick(60*1000);
		expect($(".autosave-saving").length).toEqual(1);
		expect($(".autosave-saving").css("display")).not.toEqual("none");
		expect($(".autosave-saving .autosave-msg").text()).toEqual("Save override..."); //Default text
		
		//Complete save operation
		_currCallback();
		
		//Should get hidden
		expect($(".autosave-saving").css("display")).toEqual("none");
	});
	
	it('Save notification can be customised with a specific template', function(){

		var testFragment = "<h3>Please enter your preferred musician:</h3>\
							<input type='text' name='musician'>";
		
		addToSandbox(testFragment);
		
		var _currCallback = null; //This is what the save function is expecting to be called to complete the save operation
		
		var defaultOpt = {
			
			saveNotification: {
				template: "<h1 class='my_save_msg'>My template override saving msg...</h1>"
			},
			dataStore:{
				load: _noOpLoad,
				save: function( key, data, callback ){
					
					_currCallback = callback;
				}
			}
		};
		
		var autoSave = createAutoSave(null, defaultOpt);
		
		//Setting a value should trigger an auto-save which should trigger showing the save banner
		setValue("[name='musician']", "Mozart");
		jasmine.clock().tick(60*1000);
		expect($(".autosave-saving").length).toEqual(0); //Neither sould exist as customiesd
		expect($(".my_save_msg").css("display")).not.toEqual("none");
		expect($(".my_save_msg").text()).toEqual("My template override saving msg..."); //Default text
		
		//Complete save operation
		_currCallback();
		
		//Should get hidden
		expect($(".my_save_msg").css("display")).toEqual("none");
	});
	
	it('onSaveNotification callback can modify the default behaviour of save notification', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<h3>Please enter your preferred musician:</h3>\
							<input type='text' name='musician'>";
		
		addToSandbox(testFragment);
		
		var _currCallback = null; //This is what the save function is expecting to be called to complete the save operation
		
		var defaultOpt = {
			
			onSaveNotification:function( toggleOn ){
				
				//See @FUN semantics
				if(ctr == 0)
					return; //Leave as undefined, which shouldn't change anything
				else if (ctr == 1)
					return false; //Should cancel the show altogther
				else if (ctr == 2)
					return "Override saving text..."; //Will throw
			},
			dataStore:{
				load: _noOpLoad,
				save: function( key, data, callback ){
					
					_currCallback = callback;
				}
			}
		};
		
		var ctr = 0;
		var autoSave = createAutoSave(null, defaultOpt);
		
		//Case #1: Setting a value should trigger an auto-save which should trigger showing the save banner
		setValue("[name='musician']", "Mozart");
		jasmine.clock().tick(60*1000);
		expect($(".autosave-saving").css("display")).not.toEqual("none");
		
		//Continue save to reset showing the banner and sanity check
		_currCallback();
		_currCallback = null;
		expect($(".autosave-saving").css("display")).toEqual("none");
		
		//Case #2: Notification display should get cancelled
		ctr = 1;
		setValue("[name='musician']", "Beethoven");
		jasmine.clock().tick(60*1000);
		expect($(".autosave-saving").css("display")).toEqual("none");
		
		//Continue save to reset showing the banner and sanity check
		_currCallback();
		_currCallback = null;

		//Case #3: Notification display's inner text should get changed
		ctr = 2;
		setValue("[name='musician']", "Debussy");
		expect(function(){
			jasmine.clock().tick(60*1000);
		}).toThrowError( "Unexpected return type from callback 'onSaveNotification'" );
	});
	
	
	it('No-Storage notification never shows if a custom store is provided', function(){
		
		var testFragment = "<h3>Please enter your preferred musician:</h3>\
							<input type='text' name='musician'>";
		
		addToSandbox(testFragment);

		//Mock not having local data stores
		var spy = spyOn( AutoSave, "isLocalStorageAvailable" ).and.returnValue(false);
		var spy2 = spyOn( AutoSave, "isCookieStorageAvailable" ).and.returnValue(false);
		
		var autoSave = createAutoSave();
		
		//Sanity
		expect($(".autosave-noStore").length).toEqual(1);
		
		var opt = {
			
			dataStore:{
				load: _noOpLoad,
				save: _noOpSave
			}
		};

		var autoSave = createAutoSave(null, opt);
		
		expect($(".autosave-noStore").length).toEqual(0);
	});
	
	it('No-Storage notification can be customised with a message', function(){
		
		var testFragment = "<h3>Please enter your preferred musician:</h3>\
							<input type='text' name='musician'>";
		
		addToSandbox(testFragment);

		//Mock not having local data stores
		var spy = spyOn( AutoSave, "isLocalStorageAvailable" ).and.returnValue(false);
		var spy2 = spyOn( AutoSave, "isCookieStorageAvailable" ).and.returnValue(false);
		
		var opt = {
			
			noStorageNotification:{
				message: "This is a custom override message"
			}
		};

		var autoSave = createAutoSave(null, opt);
		
		expect($(".autosave-noStore .autosave-msg").html()).toEqual("This is a custom override message");
	});
	
	it('No-Storage notification can be customised with a template', function(){
		
		var testFragment = "<h3>Please enter your preferred musician:</h3>\
							<input type='text' name='musician'>";
		
		addToSandbox( testFragment );

		//Mock not having local data stores
		var spy = spyOn( AutoSave, "isLocalStorageAvailable" ).and.returnValue(false);
		var spy2 = spyOn( AutoSave, "isCookieStorageAvailable" ).and.returnValue(false);
		
		var opt = {
			
			noStorageNotification:{
				template: "<h1 id='my_msg'><div>This is a custom override template</div></h1>"
			}
		};

		var autoSave = createAutoSave( null, opt );
		
		expect( $( ".autosave-noStore" ).length ).toEqual( 0 );//Default shouldnt exist
		expect( $( "#my_msg" ).html() ).toEqual( "<div>This is a custom override template</div>" );
	});
	
	it('No-Storage notification callback can customise the behaviour of the notification', function(){
		
		var testFragment = "<h3>Please enter your preferred musician:</h3>\
							<input type='text' name='musician'>";
		
		addToSandbox( testFragment );

		//Mock not having local data stores
		var spy = spyOn( AutoSave, "isLocalStorageAvailable" ).and.returnValue(false);
		var spy2 = spyOn( AutoSave, "isCookieStorageAvailable" ).and.returnValue(false);
		
		var defaultOpt = {
			
			onNoStorageNotification:function( toggleOn ){
				
				//See @FUN semantics
				if(ctr == 0)
					return; //Leave as undefined, which shouldn't change anything
				else if (ctr == 1)
					return false; //Should cancel the show altogther
				else if (ctr == 2)
					return "Override no-store text..."; //Will throw
			}
		};
		
		var ctr = 0;
		var autoSave = createAutoSave(null, defaultOpt);
		expect($(".autosave-noStore").css("display")).not.toEqual("none");
		
		
		++ctr;
		autoSave = createAutoSave(null, defaultOpt);
		expect($(".autosave-noStore").css("display")).toEqual("none");
		
		++ctr;
		expect(function(){
			autoSave = createAutoSave(null, defaultOpt);
		}).toThrowError( "Unexpected return type from callback 'onNoStorageNotification'" );
	});
	
	it('No-Storage notification show time can be customised with showDuration option', function(){
		
		var testFragment = "<h3>Please enter your preferred musician:</h3>\
							<input type='text' name='musician'>";
		
		addToSandbox( testFragment );

		//Mock not having local data stores
		var spy = spyOn( AutoSave, "isLocalStorageAvailable" ).and.returnValue(false);
		var spy2 = spyOn( AutoSave, "isCookieStorageAvailable" ).and.returnValue(false);
		
		var opt = {
			
			noStorageNotification:{
				showDuration: 30*1000 //extend from 5s to 30s
			}
		};

		var autoSave = createAutoSave( null, opt );

		//After 29 secs should still be showing
		jasmine.clock().tick(29*1000);
		expect($(".autosave-noStore").css("display")).not.toEqual("none");
		
		//At 31s, should hide
		jasmine.clock().tick(2*1000);
		expect($(".autosave-noStore").css("display")).toEqual("none");
	});

	it('No-Storage notification by default shows a banner for 5 seconds', function(done){

		var testFragment = "<h3>Please enter your preferred musician:</h3>\
							<input type='text' name='musician'>";
		
		addToSandbox(testFragment);

		//Mock not having local data stores
		var spy = spyOn( AutoSave, "isLocalStorageAvailable" ).and.returnValue(false);
		var spy2 = spyOn( AutoSave, "isCookieStorageAvailable" ).and.returnValue(false);
		
		var defaultOpt = {
			onInitialised: function(){
				runChecks();
				done();
			}
		};
		
		var autoSave = createAutoSave(null, defaultOpt);
		
		function runChecks(){
			
			for(var i=0;i<2;i++) {
								
				expect($(".autosave-noStore").length).toEqual(1);
				expect($(".autosave-noStore").css("display")).not.toEqual("none");
				expect($(".autosave-noStore .autosave-msg").text())
					.toEqual("AutoSave is turned off - no datastore available to store input data."); //Default text

				//After 4.9s, should still show
				if (i==0)
					jasmine.clock().tick(4.9*1000);
			}
			
			//At 5.1s should be hidden - either removed or with style.display
			jasmine.clock().tick(200);
			expect($(".autosave-noStore").length == 0 ||
				   $(".autosave-noStore").css("display") == "none")
			.toEqual(true);
		};
	});
	
	it('parentElement parameter need not be a form', function(){
	
		//Arrange - Create and set a value on the input text box
		var testFragment = "<h3>Please choose your preferred musicians:</h3>\
							<input type='checkbox' name='frmMusician' value='Mozart'>Mozart Van...\
							<input type='checkbox' name='frmMusician' value='JayZ'>JayZ\
							<input type='checkbox' name='frmMusician' value='Sipa'>Sipa\
							<input type='text' name='Reason'>";
		
		addToSandbox(testFragment);
		
		setChecked("[value='JayZ']", true);
		setChecked("[value='Sipa']", true);
		setValue("[name='Reason']", "Because they make me feel good!");

		var sentDataValue = testSerialize(document.body);
		
		expect(sentDataValue).toEqual("frmMusician=JayZ&frmMusician=Sipa&Reason=Because+they+make+me+feel+good!");
	});

	it('parentElement parameter when null causes whole document serialisation', function(){
	
		//Arrange
		var testFragment = "<h3>Please choose your preferred musicians:</h3>\
							<input type='checkbox' name='frmMusician' value='Mozart'>Mozart Van...\
							<input type='checkbox' name='frmMusician' value='JayZ'>JayZ\
							<input type='checkbox' name='frmMusician' value='Sipa'>Sipa\
							<input type='text' name='Reason'>";
		
		addToSandbox(testFragment);
		setChecked("[value='JayZ']", true);
		setChecked("[value='Sipa']", true);
		setValue("[name='Reason']", "Because they make me feel good!");

		//Act - i.e. user has done new AutoSave(null)
		var sentDataValue = testSerialize(null);
		
		//Asserts
		expect(sentDataValue).toEqual("frmMusician=JayZ&frmMusician=Sipa&Reason=Because+they+make+me+feel+good!");	
	});

	it('parentElement parameter when missing causes whole document serialisation', function(){
		
		//Arrange
		var testFragment = "<h3>Please choose your preferred musicians:</h3>\
							<input type='checkbox' name='frmMusician' value='Mozart'>Mozart Van...\
							<input type='checkbox' name='frmMusician' value='JayZ'>JayZ\
							<input type='checkbox' name='frmMusician' value='Sipa'>Sipa\
							<input type='text' name='Reason'>";
		
		addToSandbox(testFragment);
		setChecked("[value='JayZ']", true);
		setChecked("[value='Sipa']", true);
		setValue("[name='Reason']", "Because they make me feel good!");

		//Act - undefined is essentially parameter left out - i.e. user has done new AutoSave()
		var sentDataValue = testSerialize(undefined);
		
		//Assert
		expect(sentDataValue).toEqual("frmMusician=JayZ&frmMusician=Sipa&Reason=Because+they+make+me+feel+good!");
	});

	it('parentElement parameter can be an empty parameter causing no serialisation', function(){
		
		//Arrange
		var testFragment = "<h3>Please choose your preferred musicians:</h3>\
							<input type='checkbox' name='frmMusician' value='Mozart'>Mozart Van...\
							<input type='checkbox' name='frmMusician' value='JayZ'>JayZ\
							<input type='checkbox' name='frmMusician' value='Sipa'>Sipa\
							<input type='text' name='Reason'>";
		
		addToSandbox(testFragment);
		setChecked("[value='JayZ']", true);
		setChecked("[value='Sipa']", true);
		setValue("[name='Reason']", "Because they make me feel good!");

		//Act - undefined is essentially parameter left out - i.e. user has done new AutoSave()
		var sentDataValue = testSerialize([]);
		
		//Asserts
		expect(sentDataValue).toBeFalsy();
	});
		
	it('parentElement parameter can take a jQuery instance', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<h3>Please choose your preferred musicians:</h3>\
							<div id='group1'>\
								<input type='checkbox' name='frmMusician' value='Mozart'>Mozart Van...\
								<input type='checkbox' name='frmMusician' value='JayZ'>JayZ\
								<input type='checkbox' name='frmMusician' value='Sipa'>Sipa\
								<input type='text' name='Reason'>"
							+
							"</div><div id='group2'>"+
								"<input type='text' name='frmAddress'></input>"+
							"</div>";
		
		addToSandbox(testFragment);
		setChecked("[value='JayZ']", true);
		setValue("[name='Reason']", "No Reason");
		setValue("[name='frmAddress']", "Because they make me feel good!");

		var sentDataValue = testSerialize($("#group1"));
		
		expect(sentDataValue).toEqual("frmMusician=JayZ&Reason=No+Reason");
	});
		
	it('autosave parentElement parameter can take an array like object', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<h3>Please choose your preferred musicians:</h3>\
							<div id='group1'>\
								<input type='checkbox' name='frmMusician' value='Mozart'>Mozart Van...\
								<input type='checkbox' name='frmMusician' value='JayZ'>JayZ\
								<input type='checkbox' name='frmMusician' value='Sipa'>Sipa\
								<input type='text' name='Reason'>"
							+
							"</div><div id='group2'>"+
								"<input type='text' name='frmAddress'></input>"+
							"</div>";
		
		addToSandbox(testFragment);
		setChecked("[value='JayZ']", true);
		setValue("[name='Reason']", "No Reason");
		setValue("[name='frmAddress']", "Because they make me feel good!");

		var sentDataValue = testSerialize(document.querySelectorAll("#group1 input"));
		
		expect(sentDataValue).toEqual("frmMusician=JayZ&Reason=No+Reason");
	});
		
	it('autosave parentElement parameter can be a string', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<h3>Please choose your preferred musicians:</h3>\
							<div id='group1'>\
								<input type='checkbox' name='frmMusician' value='Mozart'>Mozart Van...\
								<input type='checkbox' name='frmMusician' value='JayZ'>JayZ\
								<input type='checkbox' name='frmMusician' value='Sipa'>Sipa\
								<input type='text' name='Reason'>"
							+
							"</div><div id='group2'>"+
								"<input type='text' name='frmAddress'></input>"+
							"</div>";
		
		addToSandbox(testFragment);
		setChecked("[value='JayZ']", true);
		setValue("[name='Reason']", "No Reason");
		setValue("[name='frmAddress']", "Because they make me feel good!");

		var sentDataValue = testSerialize("#group1");
		
		expect(sentDataValue).toEqual("frmMusician=JayZ&Reason=No+Reason");	});
  });
  
  describe('autosave hooks', function(){
	
	beforeEach(function(){

		//Arrange - Set some test fields
		addToSandbox("<div id='section-1'><input name='frmNameEntry'><input name='frmGenderEntry'><input name='frmAddressEntry'></div>\
					  <div id='section-2'><input name='frmAgeEntry'></div>");
	});	
	
	it('onPreStore hook contains cookie string if storage is cookie', function(){
		
		setValue("[name='frmNameEntry']", "Nash");
		setValue("[name='frmAgeEntry']",  10);
		
		var szString;
		var aSave = createAutoSave(null,{
			autoSaveTrigger: null, //Control it manually for the purpose of this test
			dataStore:{
				preferCookies: true	//NOTE: Switch to cookies here
			},
			onPreStore: function(stringValue){
				
				szString = stringValue;
			}
		});
		
		aSave.save();

		//Should contain cookie prefix, expiry time etc.
		expect(szString)
		.toEqual(
			encodeURIComponent(_defaultCookieKey)+
			"=frmNameEntry=Nash&frmGenderEntry=&frmAddressEntry=&frmAgeEntry=10; expires=Fri, 31 Dec 9999 23:59:59 GMT; "
		);
	});
	
	it('onPreStore hook contains sz string only if storage is local storage', function(){
		
		setValue("[name='frmNameEntry']", "Nash");
		setValue("[name='frmAgeEntry']",  10);
		
		//Use default data store here
		var szString;
		var aSave = createAutoSave(null,{
			autoSaveTrigger: null, //Control it manually for the purpose of this test
			onPreStore: function(stringValue){
				
				szString = stringValue;
			}
		});
		
		aSave.save();

		//Should contain cookie prefix, expiry time etc.
		expect(szString)
		.toEqual("frmNameEntry=Nash&frmGenderEntry=&frmAddressEntry=&frmAgeEntry=10");
	});
	
	it('onPreStore hook contains sz string only, if storage-save is a custom save function', function(){ //should not contain cookie-specific info
		
		setValue("[name='frmNameEntry']", "Nash");
		setValue("[name='frmAgeEntry']",  10);
		
		var szString;
		var storeSaveString;
		var aSave = createAutoSave(null,{
			autoSaveTrigger: null, //Control it manually for the purpose of this test
			dataStore:{
				load: _noOpLoad,
				save: function( key, saveStr, callback ){ storeSaveString = saveStr; callback(); }
			},
			onPreStore: function(stringValue){
				
				szString = stringValue;
			}
		});
		
		aSave.save();

		//Should NOT contain cookie prefix, expiry time etc.
		expect(storeSaveString).toEqual("frmNameEntry=Nash&frmGenderEntry=&frmAddressEntry=&frmAgeEntry=10");
		expect(szString).toEqual("frmNameEntry=Nash&frmGenderEntry=&frmAddressEntry=&frmAgeEntry=10");
	});
	
	it('onPreStore hook contains sz string only, if dataStore is cleared out and not required', function(){ //should not contain cookie-specific info
		
		setValue("[name='frmNameEntry']", "Nash");
		setValue("[name='frmAgeEntry']",  10);
		
		var szString;
		//var storeSaveString;
		var aSave = createAutoSave(null,{
			autoSaveTrigger: null, //Control it manually for the purpose of this test
			dataStore:null,
			onPreStore: function(stringValue){
				
				szString = stringValue;
			}
		});
		
		aSave.save();

		//Should NOT contain cookie prefix, expiry time etc.
		expect(szString).toEqual("frmNameEntry=Nash&frmGenderEntry=&frmAddressEntry=&frmAgeEntry=10");
	});
	
	
	it('onPreSerialize hook can customise the behaviour by its return value', function(){
					  
		setValue("[name='frmNameEntry']", "Nash");
		setValue("[name='frmAgeEntry']",  10);
		
		var ctr = -1;
		var szString;
		var aSave = createAutoSave("#section-1 input",{
			autoSaveTrigger: null, //Control it manually for the purpose of this test
			dataStore: null,	   //No dataStore-specific extra things in strings - cookie expiry time etc.
			onPreSerialize: function(controlsArr){
				
				//Should be the 3 native inputs in #section-1
				expect(controlsArr).toEqual(
						[document.querySelector("[name='frmNameEntry']"),
						 document.querySelector("[name='frmGenderEntry']"),
						 document.querySelector("[name='frmAddressEntry']")]);
				
				ctr++;
				
				if(ctr == 0)
					return; //Leave as undefined, which shouldn't change anything
				else if (ctr == 1)
					return null; //Should serialise NO controls
				else if (ctr == 2)
					return false; //Should cancel the serialisation altogther
				
				//The remaining wil return the same control from section-2 but in different formats
				else if (ctr == 3)
					return document.querySelector("#section-2"); //Single native element
				else if (ctr == 4)
					return document.querySelectorAll("#section-2"); //Array-like object
				else if (ctr == 5)
					return $("#section-2"); //jQuery object
				else
					throw "Unexpected number of saves";
				
			},
			onPreStore: function(str){szString = str;return str;}
		});

		//Sanity - Ensure first time round the string is from section-1
		szString = "_RESET_";
		aSave.save();
		expect(szString).toEqual("frmNameEntry=Nash&frmGenderEntry=&frmAddressEntry=");
		
		//On second invocation, should get nothing serialised
		szString = "_RESET_";
		aSave.save()
		expect(szString).toBeFalsy();
		
		//On third invocation, sould get cancelled out
		szString = "_RESET_";
		aSave.save()
		expect(szString).toEqual("_RESET_"); //i.e. unchanged
		
		//All remaining invocations should be for section-2
		for(var i=0;i<3;i++) {
			szString = "_RESET_";
			aSave.save();
			expect(szString).toEqual("frmAgeEntry=10");
		}
	});
	
	
	it('onPreLoad hook can customise the behaviour by its return value', function(){
		
		var ctr = -1;
		var szString = "frmNameEntry=Nash&frmGenderEntry=&frmAddressEntry=&frmAgeEntry=10";
		var aSave = createAutoSave(null,{
			autoSaveTrigger: null, //Control it manually for the purpose of this test
			autoLoadTrigger: null,
			dataStore: {
				save: _noOpSave,
				load: function(key, callback){
					
					callback(szString);
				}
			},
			onPreLoad: function(){
					
				ctr++;
				
				if(ctr == 0)
					return; //Leave as undefined, which shouldn't change anything
				else if (ctr == 1)
					return null; //Should load nothing/blank out
				else if (ctr == 2)
					return false; //Should cancel the load altogther
				else if (ctr == 3)
					return "frmAddressEntry=Winterland"; //Customised it completely
				else
					throw "Unexpected number of loads";
				
			}
		});

		//Sanity - Ensure first time round the control is populated
		getOne("[name='frmNameEntry']").val("_RESET_");
		aSave.load();
		expect( getOne("[name='frmNameEntry']").val() ).toEqual("Nash");
		
		//On next invocation, should get nothing serialised but post-load operation etc will continue.
		getOne("[name='frmNameEntry']").val("_RESET_");
		aSave.load();
		expect( getOne("[name='frmNameEntry']").val() ).toEqual("_RESET_");
		
		//On next invocation, should get cancelled out
		getOne("[name='frmNameEntry']").val("_RESET_");
		aSave.load()
		expect( getOne("[name='frmNameEntry']").val() ).toEqual("_RESET_"); //i.e. unchanged
		
		//On next invocation, customise it altogether
		getOne("[name='frmNameEntry']").val("_RESET_");
		aSave.load();
		expect( getOne("[name='frmNameEntry']").val() ).toEqual("_RESET_");
		expect( getOne("[name='frmAddressEntry']").val() ).toEqual("Winterland");
	});
	
	it('onPostLoad hook can customise the behaviour by its return value', function(){

		var ctr = -1;
		var szString = "frmNameEntry=Nash&frmGenderEntry=&frmAddressEntry=Willowbrook&frmAgeEntry=10";
		var aSave = createAutoSave(null,{
			autoSaveTrigger: null, //Control it manually for the purpose of this test
			autoLoadTrigger: null,
			dataStore: {
				save: _noOpSave,
				load: function(key, callback){
					
					callback(szString);
				}
			},
			onPostLoad: function( szData ){
					
				ctr++;
				
				if(ctr == 0)
					return; //Leave as undefined, which shouldn't change anything
				else if (ctr == 1)
					return null; //Should load nothing/blank out
				else if (ctr == 2)
					return false; //Should cancel the load altogther
				else if (ctr == 3)
					return szData.replace("Nash", "Jonathan"); //Customise it
				else
					throw "Unexpected number of loads";
				
			}
		});

		//Sanity - Ensure first time round the control is populated
		getOne("[name='frmNameEntry']").val("_RESET_");
		aSave.load();
		expect( getOne("[name='frmNameEntry']").val() ).toEqual("Nash");
		
		//On next invocation, should get nothing serialised but post-load operation etc will continue.
		getOne("[name='frmNameEntry']").val("_RESET_");
		aSave.load();
		expect( getOne("[name='frmNameEntry']").val() ).toEqual("_RESET_");
		
		//On next invocation, should get cancelled out
		getOne("[name='frmNameEntry']").val("_RESET_");
		aSave.load()
		expect( getOne("[name='frmNameEntry']").val() ).toEqual("_RESET_"); //i.e. unchanged
		
		//On next invocation, customise it altogether
		getOne("[name='frmNameEntry']").val("_RESET_");
		aSave.load();
		expect( getOne("[name='frmNameEntry']").val() ).toEqual("Jonathan");
		expect( getOne("[name='frmAddressEntry']").val() ).toEqual("Willowbrook");	
	});
	
	it('onPreStore hook with cookies can customise the behaviour by its return value', function(){

		setValue("[name='frmNameEntry']", "Jonathan / Nash"); //This will also ensure the encoding is working before saving to cookie
		setValue("[name='frmAgeEntry']",  10);
		
		var ctr = -1;
		var aSave = createAutoSave(null,{
			autoSaveTrigger: null, //Control it manually for the purpose of this test
			autoLoadTrigger: null, //Don't load from cookies - just testing save here
			dataStore: {
				preferCookies: true
			},
			onPreStore: function( cookieData ){
				
				ctr++;
				
				if(ctr == 0)
					return; //Leave as undefined, which shouldn't change anything
				else if (ctr == 1)
					return null; //Should load nothing/blank it out
				else if (ctr == 2)
					return false; //Should cancel the save altogther
				else if (ctr == 3) {
					cookieData = cookieData.replace("Nash", "Oscar");
					return cookieData;// We can append parameters too - e.g. cookieData+= "domain="+location.host;
				}
				else
					throw "Unexpected number of loads";
				
			}
		});
		
		//Sanity - Ensure first time round the cookie is populated correctly
		document.cookie = encodeURIComponent(_defaultCookieKey)+" = RESET; expires=Sat, 23 Mar 2050 00:00:00;";
		aSave.save();
		var cookieValue = getBrowserCookie();
		expect( cookieValue ).toEqual("frmNameEntry=Jonathan+%2F+Nash&frmGenderEntry=&frmAddressEntry=&frmAgeEntry=10");
		
		//On second invocation, should get nothing serialised
		document.cookie = encodeURIComponent(_defaultCookieKey)+" = RESET; expires=Sat, 23 Mar 2050 00:00:00;";
		aSave.save();
		var cookieValue = getBrowserCookie();
		expect( cookieValue ).toBeFalsy();
	
		//On third invocation, should get cancelled out and preserve existing one
		document.cookie = encodeURIComponent(_defaultCookieKey)+" = RESET;";
		aSave.save();
		var cookieValue = getBrowserCookie();
		expect( cookieValue ).toEqual("RESET"); //i.e. unchanged
		
		//On fourth invocation, should get changed altogether
		document.cookie = encodeURIComponent(_defaultCookieKey)+" = RESET; expires=Sat, 23 Mar 2050 00:00:00;";
		aSave.save();
		var cookieValue = getBrowserCookie();
		expect( cookieValue ).toEqual("frmNameEntry=Jonathan+%2F+Oscar&frmGenderEntry=&frmAddressEntry=&frmAgeEntry=10");
	});

	it('onPreStore hook with local storage can customise the behaviour by its return value', function(){
	
		if ( ! AutoSave.isLocalStorageAvailable() )
			return; //Not relevant here

		//TODO: UNICODE/CHINESE etc. tests with cookies + local storage. UTF8?

		setValue("[name='frmNameEntry']", "Jonathan / Nash"); //This will also ensure the local storage correctly stores special chars
		setValue("[name='frmAgeEntry']",  10);
		
		var ctr = -1;
		var aSave = createAutoSave(null,{
			autoSaveTrigger: null, //Control it manually for the purpose of this test
			autoLoadTrigger: null, //Don't load from storage - just testing save here
			onPreStore: function( szData ){
					
				ctr++;
				
				if(ctr == 0)
					return; //Leave as undefined, which shouldn't change anything
				else if (ctr == 1)
					return null; //Should load nothing/blank it out
				else if (ctr == 2)
					return false; //Should cancel the load altogther
				else if (ctr == 3) {
					szData = szData.replace("Nash", "Oscar");
					return szData;
				}
				else
					throw "Unexpected number of loads";
			}
		});
		
		//Sanity - Ensure first time round the cookie is populated correctly
		localStorage.setItem("AutoSaveJS_MOCK/PATH/1", "RESET");
		aSave.save();
		var dataValue = localStorage.getItem("AutoSaveJS_MOCK/PATH/1");
		expect( dataValue ).toEqual("frmNameEntry=Jonathan+%2F+Nash&frmGenderEntry=&frmAddressEntry=&frmAgeEntry=10");
		
		//On second invocation, should get nothing serialised
		localStorage.setItem("AutoSaveJS_MOCK/PATH/1", "RESET");
		aSave.save();
		var dataValue = localStorage.getItem("AutoSaveJS_MOCK/PATH/1");
		expect( dataValue ).toBeFalsy();
	
		//On third invocation, should get cancelled out and preserve existing one
		localStorage.setItem("AutoSaveJS_MOCK/PATH/1", "RESET");
		aSave.save();
		var dataValue = localStorage.getItem("AutoSaveJS_MOCK/PATH/1");
		expect( dataValue ).toEqual("RESET"); //i.e. unchanged
		
		//On fourth invocation, should get changed altogether
		localStorage.setItem("AutoSaveJS_MOCK/PATH/1", "RESET");
		aSave.save();
		var dataValue = localStorage.getItem("AutoSaveJS_MOCK/PATH/1");
		expect( dataValue ).toEqual("frmNameEntry=Jonathan+%2F+Oscar&frmGenderEntry=&frmAddressEntry=&frmAgeEntry=10");

	});
	
	it('onPostStore hook gets invoked after the save operation completes, even if async', function(done){

		//We want actual async behaviour here so uninstall jasmine clock
		jasmine.clock().uninstall();
	
		setValue("[name='frmNameEntry']", "Nash");
		
		var saveInvoked = false;
		var onPostStoreInvoked = false;
		var aSave = createAutoSave(null,{
			autoSaveTrigger: null, //Control it manually for the purpose of this test
			dataStore: {
				load: _noOpLoad,
				save: function(key, stringValue, callback){
					
					saveInvoked = true;
					
					//Simulate call to service
					setTimeout(function(){
						
						//Callback to say done
						callback();
					}, 50);
				}
			},
			onPostStore: function(){
				onPostStoreInvoked = true;
			}
		});
		
		aSave.save();

		//onPostStore is not invoked synchronously...
		expect(saveInvoked).toEqual(true);
		expect(onPostStoreInvoked).toEqual(false);
		
		//but only when async op is complete
		setTimeout(function(){
			
			expect(onPostStoreInvoked).toEqual(true);
			done();
			
		}, 60);
	});
	
	it('onPostDeserialize hook gets invoked after the deserialisation is complete', function(){
		
		var szString = "frmNameEntry=Nash&frmGenderEntry=&frmAddressEntry=&frmAgeEntry=10";
		var onPostDeserializeInvoked = false;
		var loadInvoked = false;
		
		var aSave = createAutoSave(null,{
			autoSaveTrigger: null, //Control it manually for the purpose of this test
			autoLoadTrigger: null,
			dataStore: {
				save: _noOpSave,
				load: function(key, callback){
					
					loadInvoked = true;
					
					//Simulate call to service
					setTimeout(function(){
						
						//Callback to say done
						callback(szString);
					}, 50);
				}
			},
			onPostDeserialize: function(){
					
				onPostDeserializeInvoked = true;
			}
		});

		aSave.load();

		//onPostDeserializeInvoked is not invoked synchronously...
		expect(loadInvoked).toEqual(true);
		expect(onPostDeserializeInvoked).toEqual(false);
		
		//but only when async op is complete
		setTimeout(function(){
			
			expect(onPostDeserializeInvoked).toEqual(true);
			done();
			
		}, 60);
	});
  });
  
  describe('autosave trigger options', function(){
		
	it('autosave trigger of interval throws error if seconds accidentally used', function(){
		
		expect(function(){
			var aSave = createAutoSave(null,{
				autoSaveTrigger: {
					debounceInterval: 1.5, //Should actually be 1500 - i.e. in milliseconds
				}
			});
		}).toThrowError("The 'debounceInterval' must be specified in milliseconds");
		
	});

	it('autosave trigger of interval throws error if its non numeric', function(){
		
		expect(function(){
			var aSave = createAutoSave(null,{
				autoSaveTrigger: {
					debounceInterval: "1000" //string won't work
				}
			});
		}).toThrowError("Unexpected non-numeric type for parameter 'debounceInterval'");
		
	});	

	it('will throw an error if autoSaveTrigger option is unrecognised', function(){
		
		expect(function(){
			var aSave = createAutoSave(null,{
				autoSaveTrigger: {
					DebounceInterval: 1500 // Should be debounceInterval
				}
			});
		}).toThrowError("Unexpected parameter 'DebounceInterval' in autoSaveTrigger options object");
		
	});		

	
	it('will throw an error if autoSaveTrigger object type is unrecognised', function(){
		
		expect(function(){
			var aSave = createAutoSave(null,{
				autoSaveTrigger: function(){} //Not allowed
			});
		}).toThrowError("Unexpected type for parameter 'autoSaveTrigger'");
		
	});	
	
	it('autosave trigger of none only sends data when manually invoked', function(){
	
		//Arrange - Create and set a value on the input text box
		var testFragment = "<input type='text' name='frmNameEntry'>";
		addToSandbox(testFragment);

		var szString = null;
		var aSave = createAutoSave(null,{
			autoSaveTrigger: null, //Different from the default of leaving it undefined
			dataStore: null,       //Dont want format-specific output in the string 
			onPreStore: function(str){szString = str;return str;}
		});
		
		//Set value
		setValue("[name='frmNameEntry']", "Oscar");
		
		//Expect no save requests - wait 1 min to ensure this
		jasmine.clock().tick(60*1000);
		expect(szString).toBeFalsy();
			
		aSave.save();
		
		expect(szString).toEqual("frmNameEntry=Oscar");		
	});
	
	
	it('autosave trigger sends data on radio change', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<input type='radio' name='frmMusician' value='JayZ'>JayZ</input>\
							<input type='radio' name='frmMusician' value='Mozart'>Mozart</input>";
		addToSandbox(testFragment);

		var szString = null;
		var aSave = createAutoSave(null,{
			dataStore: null,       //Dont want format-specific output in the string 			
			onPreStore: function(str){szString = str;return str;}
		});
		
		//Expect no save requests as no changes - wait 1 min to ensure this
		jasmine.clock().tick(60*1000);
		expect(szString).toBeFalsy();
		
		//Set value
		setChecked("[value='Mozart']", true);

		//Wait x secs (where x is just over the default debounce interval to wait after a change)
		jasmine.clock().tick(3.5*1000);

		expect(szString).toEqual("frmMusician=Mozart");	
	});

	it('autosave trigger sends data on checkbox change', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<input type='checkbox' name='frmMusician' value='JayZ'>JayZ</input>\
							<input type='checkbox' name='frmMusician' value='Mozart'>Mozart</input>";
		addToSandbox(testFragment);

		var szString = null;
		var aSave = createAutoSave(null,{
			dataStore: null,       //Dont want format-specific output in the string 			
			onPreStore: function(str){szString = str;return str;}
		});
		
		//Expect no save requests as no changes - wait 1 min to ensure this
		jasmine.clock().tick(60*1000);
		expect(szString).toBeFalsy();
		
		//Set value
		setChecked("[value='JayZ']", true);
		setChecked("[value='Mozart']", true);

		//Wait x secs (where x is just over the default debounce interval to wait after a change)
		jasmine.clock().tick(3.5*1000);

		expect(szString).toEqual("frmMusician=JayZ&frmMusician=Mozart");	
	});	

	it('autosave trigger sends data on textarea input and change', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<textarea name='frmMusician'></textarea>";
		addToSandbox(testFragment);

		var szString = null;
		var aSave = createAutoSave(null,{
			dataStore: null,       //Dont want format-specific output in the string 
			onPreStore: function(str){szString = str;return str;}
		});
		
		//Expect no save requests as no changes - wait 1 min to ensure this
		jasmine.clock().tick(60*1000);
		expect(szString).toBeFalsy();
		
		//Set a partial value first to trigger a number of 'input' events
		setPartValue("[name='frmMusician']", "My favourite musician is");
		setPartValue("[name='frmMusician']", "My favourite musician is Mozart");
		setPartValue("[name='frmMusician']", "My favourite musician is Mozart because");

		//Wait x secs (where x is just over the default debounce interval to wait after a change)
		jasmine.clock().tick(3.5*1000);
		expect(szString).toEqual("frmMusician=My+favourite+musician+is+Mozart+because");
		
		//Now trigger a change event
		setValue("[name='frmMusician']", "My favourite musician is Mozart because he is relaxing");
		jasmine.clock().tick(3.5*1000);
		expect(szString).toEqual("frmMusician=My+favourite+musician+is+Mozart+because+he+is+relaxing");
	});	
	
	it('autosave trigger of default sends data on select changed', function(){

		//Arrange - Create and set a value on the input text box
		var testFragment = "<select name='frmMusician'><option value='Mozart'>M</option>\
							<option value='JayZ'>J</option><option value='Sipa'>S</option></select>";
		addToSandbox(testFragment);

		var szString = null;
		var aSave = createAutoSave(null,{
			dataStore: null,       //Dont want format-specific output in the string 
			onPreStore: function(str){szString = str;return str;}
		});
		
		//Expect no save requests as no changes - wait 1 min to ensure this
		jasmine.clock().tick(60*1000);
		expect(szString).toBeFalsy();
		
		//Set value
		setValue("[name='frmMusician']", "Mozart");

		//Wait x secs (where x is just over the default debounce interval to wait after a change)
		jasmine.clock().tick(3.5*1000);

		expect(szString).toEqual("frmMusician=Mozart");	
	});
	
	
	//here, we're checking for correct implementation of input event and not just on-change event hooking
	it('autosave trigger of default sends data whilst typing in text input', function(){ 

		//Arrange - Create and set a value on the input text box
		var testFragment = "<input type='text' name='frmMusician'>";
		addToSandbox(testFragment);

		var szString = null;
		var aSave = createAutoSave(null,{
			dataStore: null,       //Dont want format-specific output in the string 
			autoSaveTrigger: {
				debounceInterval: 10*1000 //Control it precisely ourself
			},			
			onPreStore: function(str){szString = str;return str;}
		});
		
		//Set values but fire an 'input' event and wait 0.5s between keypresses
		setPartValue("[name='frmMusician']", "M");

		jasmine.clock().tick(0.5*1000);
		setPartValue("[name='frmMusician']", "Mo");
		
		jasmine.clock().tick(0.5*1000);
		setPartValue("[name='frmMusician']", "Moz");
		
		jasmine.clock().tick(0.5*1000);
		setPartValue("[name='frmMusician']", "Mozart");

		//@9.5s, expect no triggers
		jasmine.clock().tick(8*1000);
		expect(szString).toBeFalsy();
		
		//@10.5s, expect 1 trigger
		jasmine.clock().tick(1*1000);
		expect(szString).toEqual("frmMusician=Mozart");	
		
		//60s, don't expect any more
		szString = null;
		jasmine.clock().tick(49.5*1000);
		expect(szString).toBeFalsy();	
	});
	
	
	it('autosave trigger with custom debounce interval fires event at right time', function(){

		//Arrange - Create and set a value on the input text box
		var testFragment = "<select name='frmMusician'><option value='Mozart'>M</option>\
							<option value='JayZ'>J</option><option value='Sipa'>S</option></select>";
		addToSandbox(testFragment);

		var szString = null;
		var aSave = createAutoSave(null,{
			dataStore: null,       //Dont want format-specific output in the string 
			autoSaveTrigger: {
				debounceInterval: 60*1000 //60 seconds to be sure 
			},
			onPreStore: function(str){szString = str;return str;}
		});

		//Set value
		setValue("[name='frmMusician']", "Mozart");
		
		//At 59 seconds, no save
		jasmine.clock().tick(59*1000);
		expect(szString).toBeFalsy();
		
		//After 61 seconds, should've invoked
		jasmine.clock().tick(2*1000);

		expect(szString).toEqual("frmMusician=Mozart");
	});

	it('autosave trigger waits for interval elapse from first select change regardless of subsequent changes', function(){

		//Arrange - Create and set a value on the input text box
		var testFragment = "<select name='frmMusician'><option value='Mozart'>M</option>\
							<option value='JayZ'>J</option><option value='Sipa'>S</option></select>";
		addToSandbox(testFragment);

		var szString = null;
		var aSave = createAutoSave(null,{
			dataStore: null,       //Dont want format-specific output in the string 
			autoSaveTrigger: {
				debounceInterval: 10*1000 //Control it precisely ourself
			},
			onPreStore: function(str){szString = str;return str;}
		});

		//Set value
		setValue("[name='frmMusician']", "Mozart");
		
		expect(szString).toBeFalsy();
		
		//@9.5s, trigger another update
		jasmine.clock().tick(9.5*1000);
		setValue("[name='frmMusician']", "JayZ");

		//1 second later @10.5s, we should've got a save due to original change
		jasmine.clock().tick(1*1000);

		expect(szString).toEqual("frmMusician=JayZ");
	});

	it('save event only fires once in given interval even after multiple updates', function(){
	
		//Arrange - Create and set a value on the input text box
		var testFragment = "<select name='frmMusician'><option value='Mozart'>M</option>\
							<option value='JayZ'>J</option><option value='Sipa'>S</option></select>";
		addToSandbox(testFragment);

		var szCount = 0;
		var aSave = createAutoSave(null,{
			dataStore: null,       //Dont want format-specific output in the string 
			autoSaveTrigger: {
				debounceInterval: 10*1000 //Control it precisely ourself
			},
			onPreStore: function(str){++szCount}
		});
	
		//@0s, @2.5s, @5s, @7.5s trigger updates
		setValue("[name='frmMusician']", "Mozart");
		jasmine.clock().tick(2.5*1000);
		setValue("[name='frmMusician']", "JayZ");
		jasmine.clock().tick(2.5*1000);
		setValue("[name='frmMusician']", "Mozart");
		jasmine.clock().tick(2.5*1000);
		setValue("[name='frmMusician']", "JayZ");

		expect(0).toEqual(szCount);

		//@11s, expect 1 save
		jasmine.clock().tick(3.5*1000);
		expect(1).toEqual(szCount);
		
		//@1m11, still no more saves expected
		jasmine.clock().tick(60*1000);
		expect(1).toEqual(szCount);
	});

	it('saving won\'t run multiple times if 1 is already in progress', function(){
			
		//Arrange - Create and set a value on the input text box
		var testFragment = "<select name='frmMusician'><option value='Mozart'>M</option>\
							<option value='JayZ'>J</option><option value='Sipa'>S</option></select>";
		addToSandbox(testFragment);

		var currSaveCallback = null;
		var saveCount = 0;
		var aSave = createAutoSave(null,{
			dataStore: {
				load: _noOpLoad,
				save: function(key, data, saveCompleteCallback){
					
					++saveCount;
					currSaveCallback = saveCompleteCallback
				}
			},
		});

		//Sanity
		jasmine.clock().tick(60*1000);
		expect(0).toEqual(saveCount);

		//Simulate save completed instantly
		setValue("[name='frmMusician']", "Mozart");
		jasmine.clock().tick(60*1000);
		currSaveCallback();
		expect(1).toEqual(saveCount);

		//Make another save which takes a long time
		setValue("[name='frmMusician']", "Beethoven");
		jasmine.clock().tick(60*1000);
		expect(2).toEqual(saveCount);

		//Another 3 update comes through (even after debounce interval elapsed)
		setValue("[name='frmMusician']", "Debussy");
		jasmine.clock().tick(60*1000);
		setValue("[name='frmMusician']", "Jay Z");
		jasmine.clock().tick(60*1000);
		setValue("[name='frmMusician']", "U2");
		jasmine.clock().tick(60*1000);
		expect(2).toEqual(saveCount); //Should NOT increment as it's pending a save

		//Long running save completes
		currSaveCallback();
		
		//Now the subsequent updates (the Debussy one) should come through but only as ONE batch
		jasmine.clock().tick(60*1000);
		expect(3).toEqual(saveCount); //Should NOT increment as it's pending a save
		
		//Completes instantly
		currSaveCallback();
		
		//Sanity
		jasmine.clock().tick(60*1000);
		expect(3).toEqual(saveCount); //No more updates expected
	});
	
	it('autosave is not normally triggered by inputs outside the watch range', function(){

		//Arrange - Create and set a value on the input text box
		var testFragment = "<div id='unwatched'>\
								<input name='fullName'>\
								<textarea name='description'></textarea>\
								<input type='radio' name='isMusician'></input>\
								<select name='frmMusician'><option value='Mozart'>M</option>\
									<option value='JayZ'>J</option><option value='Sipa'>S</option>\
								</select>\
							</div>\
							<div id='watched'>\
								<input name='fullAddress'>\
							</div>";
		addToSandbox(testFragment);

		var szString = null;
		var aSave = createAutoSave("#watched",{
			dataStore: null,       //Dont want format-specific output in the string 
			onPreStore: function(str){szString = str;return str;}
		});

		//Set values outside the watched range
		setValue("[name='fullName']", "Oscar");
		setValue("[name='description']", "I like descriptions");
		setChecked("[name='isMusician']", true);
		setSelected("[value='JayZ']", "Mozart");
		
		//Wait a clear 60 seconds - we don't care about the actual debounce interval
		jasmine.clock().tick(60*1000);
		expect(szString).toBeFalsy();
		
		//Sanity - set value inside the watched range
		setValue("[name='fullAddress']", "1 The Wilderness, OB6 1PO");
		
		//Clear the debounce interval
		jasmine.clock().tick(60*1000);

		expect(szString).toEqual("fullAddress=1+The+Wilderness%2C+OB6+1PO");
	});
		
	it('external-form-inputs do not trigger a save if seekExternalFormElements option is turned off', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<div id='top_level'>\
								<input name='fullName'>\
								<form id='internal1'>\
									<textarea name='description'></textarea>\
								</form>\
								<form id='internal2'>\
									<textarea name='places'></textarea>\
								</form>\
							</div>\
							<div id='external'>\
								<div form='internal1'>\
									<input name='age'>\
									<input name='blood_group'>\
								</div>\
								<input name='fullAddress' form='internal2'>\
								<input name='shoeSize'>\
							</div>";
		addToSandbox(testFragment);
		
		//Sainty first - do a control test to ensure by default this fragment will cause a save from an external input
		var szString = null;
		var aSave = createAutoSave("#top_level",{
			dataStore: null,       //Dont want format-specific output in the string
			onPreStore: function(str){szString = str;return str;}
		});

		//Sanity - set values inside the form 
		setValue("[name='age']", "17");
		
		//Wait a clear 60 seconds for these triggers to be run
		jasmine.clock().tick(60*1000);
		expect(szString).toEqual("fullName=&description=&places=&age=17&blood_group=&fullAddress=");

		//Now create an identical one but with the option switched off
		szString = "_RESET_";
		aSave = createAutoSave("#top_level",{ //Will cause previous to get disposed
			dataStore: null,
			seekExternalFormElements: false, //Option under test
			onPreStore: function(str){szString = str;return str;}
		});
		
		//Set the external control value
		setValue("[name='age']", "18");
		
		//Wait a clear 60 seconds for these triggers to be run
		jasmine.clock().tick(60*1000);
		expect(szString).toEqual("_RESET_"); //No save occurred
		
		//Now set a value in the watch range and ensure external control is not in the serialised string either
		setValue("[name='fullName']", "Oscar Wilde");
		
		//Wait a clear 60 seconds for these triggers to be run
		jasmine.clock().tick(60*1000);
		expect(szString).toEqual("fullName=Oscar+Wilde&description=&places="); //No age field
	});
	
	it('deserialise into external form controls', function(){
				
		//Arrange - Create and set a value on the input text box
		var testFragment = "<form id='internal'>\
								<input name='fullName'>\
								<textarea name='description'></textarea>\
							</form>\
							<div id='external'>\
								<div form='internal'>\
									<input name='age'>\
									<input name='blood_group'>\
								</div>\
								<input name='fullAddress' form='internal'>\
								<input name='shoeSize'>\
							</div>";
		addToSandbox(testFragment);
		
		var szString = "fullName=Oscar+Wilde&description=I+like+descriptions&age=7&blood_group=O&fullAddress=1+The+Wilderness&shoeSize=9";
		var aSave = createAutoSave("#internal",{
			dataStore: createMockDataStore(szString)
		});

		//Check internal controls
		expect(getValue("[name='fullName']")).toEqual("Oscar Wilde");
		expect(getValue("[name='description']")).toEqual("I like descriptions");

		//External controls
		expect(getValue("[name='age']")).toEqual("7");
		expect(getValue("[name='blood_group']")).toEqual("O");
		expect(getValue("[name='fullAddress']")).toEqual("1 The Wilderness");
		expect(getValue("[name='shoeSize']")).toEqual(""); //Although set in the serialised string, doesnt belong to this control set

		//Now test with seekExternalFormElements option off
		resetSandbox();
		addToSandbox(testFragment);

		var aSave = createAutoSave("#internal",{
			dataStore: createMockDataStore(szString),
			seekExternalFormElements: false
		});

		//Check internal controls
		expect(getValue("[name='fullName']")).toEqual("Oscar Wilde");
		expect(getValue("[name='description']")).toEqual("I like descriptions");

		//External controls - all should be blank
		expect(getValue("[name='age']")).toEqual("");
		expect(getValue("[name='blood_group']")).toEqual("");
		expect(getValue("[name='fullAddress']")).toEqual("");
		expect(getValue("[name='shoeSize']")).toEqual("");
	});
	
	it('external-form-inputs trigger save and get serialised if they belong to a top-level form being watched', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<form id='internal'>\
								<input name='fullName'>\
								<textarea name='description'></textarea>\
							</form>\
							<div id='external'>\
								<div form='internal'>\
									<input name='age'>\
									<input name='blood_group'>\
								</div>\
								<input name='fullAddress' form='internal'>\
								<input name='shoeSize'>\
							</div>";
		addToSandbox(testFragment);
		
		var szString = null;
		var aSave = createAutoSave("#internal",{
			dataStore: null,       //Dont want format-specific output in the string
			onPreStore: function(str){szString = str;return str;}
		});

		//Set values inside the form 
		setValue("[name='fullName']", "Oscar Wilde");
		setValue("[name='description']", "I like descriptions");
		
		//Wait a clear 60 seconds for these triggers to be run
		jasmine.clock().tick(60*1000);
		expect(szString).toEqual("fullName=Oscar+Wilde&description=I+like+descriptions&age=&blood_group=&fullAddress=");
		
		//Now set non-nested external elements - should trigger a save
		setValue("[name='fullAddress']", "1 The Wilderness");

		//Let trigger elapse
		jasmine.clock().tick(60*1000);
		expect(szString).toEqual("fullName=Oscar+Wilde&description=I+like+descriptions&age=&blood_group=&fullAddress=1+The+Wilderness");

		//Set nested external elements
		setValue("[name='age']", "7");
		setValue("[name='blood_group']", "O");
		
		//Let trigger elapse
		jasmine.clock().tick(60*1000);
		expect(szString).toEqual("fullName=Oscar+Wilde&description=I+like+descriptions&age=7&blood_group=O&fullAddress=1+The+Wilderness");
		
		//Sanity - set external, NON-FORM element
		szString = "_RESET_";
		setValue("[name='shoeSize']", "5");
		
		//Let trigger elapse - should NOT contain the new element's value
		jasmine.clock().tick(60*1000);
		expect(szString).toEqual("_RESET_"); //i.e. unchanged
	});
	
	it('external-form-inputs trigger save and get serialised if they belong to a nested form being watched', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<div id='top_level'>\
								<input name='fullName'>\
								<form id='internal1'>\
									<textarea name='description'></textarea>\
								</form>\
								<form id='internal2'>\
									<textarea name='places'></textarea>\
								</form>\
							</div>\
							<div id='external'>\
								<div form='internal1'>\
									<input name='age'>\
									<input name='blood_group'>\
								</div>\
								<input name='fullAddress' form='internal2'>\
								<input name='shoeSize'>\
							</div>";
		addToSandbox(testFragment);
		
		var szString = null;
		var aSave = createAutoSave("#top_level",{
			dataStore: null,       //Dont want format-specific output in the string
			onPreStore: function(str){szString = str;return str;}
		});

		//Set values inside the form 
		setValue("[name='fullName']", "Oscar Wilde");
		setValue("[name='description']", "I like descriptions");
		
		//Wait a clear 60 seconds for these triggers to be run
		jasmine.clock().tick(60*1000);
		expect(szString).toEqual("fullName=Oscar+Wilde&description=I+like+descriptions&places=&age=&blood_group=&fullAddress=");

		//Set nested external elements
		setValue("[name='age']", "17");
		setValue("[name='fullAddress']", "1 The Wilderness");
		setValue("[name='shoeSize']", "9"); //Should NOT get saved
		
		//Let trigger elapse
		jasmine.clock().tick(60*1000);
		expect(szString).toEqual("fullName=Oscar+Wilde&description=I+like+descriptions&places=&age=17&blood_group=&fullAddress=1+The+Wilderness");
	});

	it('all load hooks invoked even if no data to load', function(){

		//Custom load function should be invoked on page load
		var onPreLoad = false, onPostLoad = false, onPostDeserialize = false, onInitialised = false;
		var aSave = createAutoSave(null, {
			
			dataStore:{
				save: function( key, data, saveComplete ){},
				load: function( key, loadComplete ){
					loadComplete( null );
				}
			},
			
			onPreLoad: function(){onPreLoad = true},
			onPostLoad: function(){onPostLoad = true},
			onPostDeserialize: function(){onPostDeserialize = true},
			onInitialised: function(){onInitialised = true}
		});
		
		expect(onPreLoad).toBe(true);
		expect(onPostLoad).toBe(true);
		expect(onPostDeserialize).toBe(true);
		expect(onInitialised).toBe(true);
	});
	
	it( 'onInitialised hook invoked even if autoload trigger is off', function(){

		//Custom load function should be invoked on page load
		var onInitialised = false;
		var aSave = createAutoSave( null, {
			
			autoLoadTrigger: null,	//switch offf
			dataStore: {
				save: function( key, data, saveComplete ){},
				load: function( key, loadComplete ){
					
					throw "Sanity check - load should not be attempted";
				}
			},
			
			onInitialised: function(){ onInitialised = true }
		});
		
		expect ( onInitialised ).toBe ( true );
	});

	
	it( 'onInitialised hook only invoked when async load is complete', function(){

		//Custom load function should be invoked on page load
		var onInitialised = false;
		var aSave = createAutoSave( null, {
			
			dataStore: {
				save: function( key, data, saveComplete ){},
				load: function( key, loadComplete ){
					
					//Make it 'async'
					setTimeout(function(){
						
						//Simulate load completed
						loadComplete( null );
					}, 1000);
				}
			},
			
			onInitialised: function(){ onInitialised = true }
		});
		
		expect ( onInitialised ).toBe ( false );

		//After 1 second, load should complete, init should fire
		jasmine.clock().tick(1000);
		expect( onInitialised ).toBe( true );
	});
	
	//'PROGRAMATIC CHANGES HANDLING? DIFF FEATURE? V2?
	// button serialisation! ALL other inputs covered? toggle button a reason to do button?

	//TODO: If logging not available initially and only available after a while?
	
	//Many of these in browser for browser-based integration tests OR send native key-press/mouse-moves
	//Changes due to .Load() should not call .Save() 
	//ensure name is available on NPM - e.g. AutoSavePrime
	// Unselected select remains unselected 
	//check jQuery implementation of :input selector
	// multiple input radio group

		//Demo using multiple instances on same domain
	 // Without IDs, server-side or client-side auto-saving, jQuery-UI + CKEditor etc. tests,
	 // Github-integrated tests

	 // TODO: Google "Reading/writing to cookies with full unicode support" and ensure we cover too
	 // TODO: Test all browsers on browser-stack
	 // Have a diagram of the hooks and where functionality belongs (e.g. AutoSave.Load)
	 // addEventListener / removeEventListener not supported by pre-IE8 - make it compatible there too!! (?)
		// Adding support for older browsers via hooks - 
		// https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
	 // perf test across browsers
	 // d.ts file
	 // Retain focus when serialising/deserialising
	 // Following settings are mutable and can be changed, following are not and will throw on mutation
	 // jQuery won't do this : $("body").serialize() - see GitHub discussion for why needs a form
	 //	jQuery also wont respect HTML5 new form attribute
	 // Dynamically added controls/panels, dynamically expanded etc. - add hooks?
	 // NodeJS? Using document property :/ ...
	// incorporate JSON2.js !!
	//TODO: Document if custom path, domains etc are set, will not get cleared out
	//TODO: What to do if cookie storage is running out?	 
	 // As we're using event handlers, test if us throwing doesn't invoke the remaining handles. If so, try-catch and pipe to errorHandler 
	 //(by default throws an Error with code)
	 // Unhook events on elements removed from DOM (?)

//FIRST PRIORITY FOR LIBRARY IS WORKING IN ALL SCENARIOS, OUT OF BOX - THEN ALLOW THEM TO TWEAK PARAMTERS FOR PERFORMANCE
	 
//TODO: Localisation
//TODO: test dispose() causes no more save invocations
//TODO: If any errors, pipe them somewhere...? Catch errors in callback functions?


/** DEMO / DOCS **/
//TODO: Demo for custom hook where load can be delayed
	 // Demo for doing control diff to send only changes or using angular is-pristine flag
//TODO: Demo for initial load value
	 // Documentation - if you want to cache the controls used, store the onPreSerialize value, change parentElement?
	 // Demo - send on regular interval by autoSaveTrigger: null and call save() myself every X seconds
//TODO: Docs - "Not overly-strict on checking etc., trust your overrides. E.g. uniqueness of key in keyFunc"
//TODO: Docs - Wrt multiple instances, 1-1 relation between AutoSave and data-store key. Identical items? Need multiple ASJ's.
	 //demo where some controls loaded on demand
		
	 // incognito session? no cookies? (safari?)
	 // If panels are lazy-loaded? Basically, bunch of tests for dynamically loaded controls to append/splice on save/load
	 // TODO: JSLint it.
	 // When value cleared, should be sent to server - difference from a normal sz() and save() ajax call
	 // First class events? multiple can hook? but then becomes highly order dependant ?
	 // Example/demo - only complete text entries to be sent back
	 // Undocumented documentation. You can actually change most option parameters at run-time but take no liability for behaviour ! 
								 // Behaviour *NOT* supported
	 // IE7+, It's fast - performance tests... 
	 
	//TODO: Do a demo for skipping log levels, wiring into winston/simple logging 
		//TODO: For all errors like this one, have a FAQ page with examples. IF you get "...", do...
	//TODO: Bower
	//TODO: Package.json
	//TODO: Demo of calling store.resetStore() when page saved to server so doesn't auto-populate next time - if using cookies/local storage instead of ajax! **
			
	 //Have version, along with minified file has version at top. see ckEditor top.
	 //Document: IF you suply a custom function for root control set - wont be re-hooked wrt listeners, no external form elems will work etc
		// JSFiddle with various examples
		//Link to perf test vs jquery Serialize/Deserialize
		//Demo using hooks to show a 'loading...' and 'saving...' indicator
		//Add to NPM/Bower etc.

		//TOOD: Test renaming AutoSave to another lib when importing?
		//TODO: Test with local storage and cookies disabled
		//TODO: Example with loading and unloading of HTML content / dynamic content - e.g. flicking through tabs. jQuery UI tabs?

	//TODO: Demo with diffing logic
	 // As a cheap hosted-service plugin? Over SSL?
	 // WP plugin wrapper? Give "Free" to top theme authors
	 // Create fiddle - starter code for server-side
			 
  });
});

