describe("AutoSaveJS", function() {

    _currTestAutoSave=null;
	_noOpLoad = function( key, loadCompleted){};
	_noOpSave = function( key, data, saveCompleted){};
	
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
			key = "AutoSaveJS_";
	
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

    function createAutoSave(parent, opts){
	  
		if(_currTestAutoSave) {
			
			_currTestAutoSave.dispose( true ); //detach all listeners, reset store
			_currTestAutoSave = null;
		}

		AutoSave.resetAll(); //Clear from previous instances of test runs
		
		_currTestAutoSave = new AutoSave(parent, opts);
		return _currTestAutoSave;
    }
	
	beforeEach(function(){
		
		//Make sure it's there for the first one
		resetSandbox();

		jasmine.clock().install();
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
	 
	it('input_text_entry_is_restored_with_text_value', function(){
		
		internal_run_input_serialise_and_deserialise_test('text');
    });
	
	it('input_hidden_entry_is_restored_with_text_value', function(){
		
		internal_run_input_serialise_and_deserialise_test('hidden');
    });
	 
	it('input_password_entry_is_restored_with_text_value', function(){
		
		internal_run_input_serialise_and_deserialise_test('password');
    });
	 
	it('select_entry_is_restored_with_selected_option',function(){
		 
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
	
	it('select_entry_with_multiple_selections_is_restored',function(){
		 
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
	
	it('select_single_options_with_no_name_attribute_should_still_select_correct_option',function(){ //As per spec #...
		
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
		expect(Array.from($("option:selected"))).toEqual(
			Array.from(document.querySelectorAll("#toChoose")));
	});
	
	it('input_text_entry_can_handle_special_characters_and_unicode', function(){
					
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

	it('input_radio_entry_is_restored_with_radio_selection', function(){
		
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
		expect(Array.from(document.querySelectorAll("input[type='radio']:checked")))
		.toEqual([elem]);
	});
	
	it('input_checkbox_entry_is_restored_with_checkbox_selection', function(){
		
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

		//Assert - exactly 2 selected and correct one -- TODO: Test cases
		expect(Array.from(document.querySelectorAll("input[type='checkbox']:checked")))
		.toEqual([elem1,elem2]);
	});

	it('autosave_and_reinstate_to_cookies_works', function(){ //etc same for endpoint etc.
	
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
			
			aSave.dispose(); //Should NOT clear local storage
		}
		
		//In 'another' session, load it
		{
			resetSandbox();
			addToSandbox(testFragment);
			
			//Sanity check
			expect(getOne("[name='frmMusician']").val()).toBeFalsy();
			
			//Create it explicitly so storage isn't wiped out
			var aSave = new AutoSave(null,  {
							autoLoadTrigger: null,
							autoSaveTrigger: null //Control it manually for the purpose of this test
						});
			
			aSave.load();
			
			expect(getOne("[name='frmMusician']").val()).toEqual("Mozart");
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
			expect(Array.from(document.querySelectorAll("input[type='checkbox']:checked")))
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
	
	it('autosave_loads_controls_on_page_load', function(){
		
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
	
	it('_INTEGRATION_TEST_: uses local storage by default if available otherwise cookies', function(){ //x-browser test
		
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
		
		var valSaved = getLocalStorageElseCookie("AutoSaveJS_");
			
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

		expect(getBrowserCookie("AutoSaveJS_")).toBeFalsy(); //Sanity check
		
		//Trigger it manually for this test
		aSave.save();
		
		expect(localStorage.getItem("AutoSaveJS_")).toBeFalsy(); //Must not end up in localStorage
		
		expect(getBrowserCookie("AutoSaveJS_")).toEqual( "fullName=John+Wayne&description=~Green%40ways~" );
	})

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
		
		expect( localStorage.getItem("AutoSaveJS_225758493995") ).toEqual( "fullName=John+Wayne&description=~Green%40fields~" );
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
		
		expect( getBrowserCookie("AutoSaveJS_225758493995") ).toEqual( "fullName=Jill+Wayne&description=~Blue%40cows~" );
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
		
		expect( localStorage.getItem("AutoSaveJS_12345") ).toEqual( "fullName=Wayne+Stein" );		
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
		
		expect( getBrowserCookie("AutoSaveJS_12345") ).toEqual( "fullName=John+Blaine" );
		
	});
	
  	it('values_are_set_on_all_controls_in_watch_range_on_page_load', function(){
		
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
	

	it('input_controls_without_a_name_are_not_serialised', function(){ //so we don't end up with '=' being serialised !

		//Arrange - Create and set a value on the input text box
		var testFragment = "<div>\
								<input type='text'>\
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
		var testFragment = "<input type='radio' name='0' value='0'></div>";
		addToSandbox(testFragment);	
		
		setChecked("input", true);
		
		//Act - Store all field data as a string
		var szString = testSerialize();

		var expectedStr = "0=0";
		expect(szString).toEqual(expectedStr);	
	});
	
	it('input:checkbox controls with a name & key of 0 are serialized correctly', function(){ //And not skipped, like blanks and nulls
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<input type='checkbox' name='0' value='0'></div>";
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
	
	it('select_multiple_options_with_no_name_attribute_should_use_inner_text_for_serialising',function(){ //TODO: As per spec #...

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
			
	it('spaces_are_converted_to_plus_symbol_on_serialising', function(){
	
		//Arrange - Set some test fields
		addToSandbox("<input name='frmNameEntry'>");
		setValue("input", "In HTML %20 is used to represent spaces"); //Ensure a raw %20 is not converted !

		//Act - Store all field data as a string
		var szString = testSerialize();

		//Assert  - Ensure the string is as expected - %25 is a %
		var expectedStr = "frmNameEntry=In+HTML+%2520+is+used+to+represent+spaces";
		expect(szString).toEqual(expectedStr);
	});

	it('serialised_string_with_special_chars_are_encoded',function(){
	
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
		
	it('autosave_does_not_serialise_controls_outside_of_parentElement', function(){

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
		
		if(_currTestAutoSave) {
			
			_currTestAutoSave.dispose( true ); //detach all listeners, reset store
		}
		
		resetSandbox();
		addToSandbox(testFragment);

		//Multiple non-overlapping instances, create explicitly so no disposal
		var inst1 = new AutoSave(gParam(parentParam1, pType), opts1);
		var inst2 = new AutoSave(gParam(parentParam2, pType), opts2);
		
		//inst1
		setChecked ($("#d1 [value='JayZ']"), true);
		setSelected($("#d1 [value='Classical']"), true);
		setValue   ($("#d1 [name='Reason']"), "Its really good");

		//inst2
		setChecked ($("#d2 [value='Mozart']"));
		setSelected($("#d2 [value='Hip Hop']"));
		setValue   ($("#d2 [name='Reason']"), "I like it a lot");

		jasmine.clock().tick(60*1000); //Let the auto-save debounce elapse
		
		inst1.dispose();
		inst2.dispose();
				
		//Recreate the default state HTML
		resetSandbox();
		addToSandbox(testFragment);
		
		//Rehydrate to round-trip the test
		inst1 = new AutoSave(gParam(parentParam1, pType), opts1);
		inst2 = new AutoSave(gParam(parentParam2, pType), opts2);
		
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
		
		//TODO: For all errors like this one, have a FAQ page with examples
		var errMsg = "There is already an AutoSave instance with the storage key of 'AutoSaveJS_'. See the documentation for solutions.";
		
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
		
		//TODO: For all errors like this one, have a FAQ page with examples
		var errMsg = "There is already an AutoSave instance with the storage key of 'AutoSaveJS_group1'. See the documentation for solutions.";
		
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
		
		var inst1 = new AutoSave("[name='some']");
		var inst2 = new AutoSave(".some_other");

		expect(function(){
			var inst3 = new AutoSave("[name='some']");
		}).toThrowError("There is already an AutoSave instance with the storage key of 'AutoSaveJS_some'. See the documentation for solutions.");
		
		expect(function(){
			var inst4 = new AutoSave(".some_other");
		}).toThrowError("There is already an AutoSave instance with the storage key of 'AutoSaveJS_'. See the documentation for solutions.");

		//Dispose first, should be able to create new
		inst1.dispose();
		var inst3 = new AutoSave("[name='some']");
		
		//Dispose 2nd - ''
		inst2.dispose();
		var inst4 = new AutoSave(".some_other");
	});
	
	it('multiple non-form elements will throw an error', function(){
		
		//Arrange - Create and set a value on the input text box
		var testFragment = "<div class='other'><div id='d1'>"+groupFragment+"</div></div>"+
						   "<div class='some_other'><div id='d2'>"+groupFragment+"</div></div>";
		
		var errMsg = "There is already an AutoSave instance with the storage key of 'AutoSaveJS_'. See the documentation for solutions.";
		
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
		
		//Create with a default key
		var aSave1 = createAutoSave("[name='Reason']",{
			dataStore:{
				preferCookies: true
			}
		});
		
		//Create with a custom key
		var aSave2 = createAutoSave("[name='Cause']",{
			dataStore:{
				key: "myCustomKey",
				preferCookies: true
			}
		});
		
		setValue("[name='Reason']", "So Good");
		setValue("[name='Cause']", "Just Cause");
		
		//Wait for auto-save to kick in and save
		jasmine.clock().tick(60*1000);

		expect(getBrowserCookie("AutoSaveJS_")).toEqual("Reason=So+Good");
		expect(getBrowserCookie("AutoSaveJS_myCustomKey")).toEqual("Cause=Just+Cause");
		
		AutoSave.resetAll();

		expect(getBrowserCookie("AutoSaveJS_")).toBeFalsy();
		expect(getBrowserCookie("AutoSaveJS_myCustomKey")).toBeFalsy();
		
		/* Now do with local storage if available */
		
		if ( !AutoSave.isLocalStorageAvailable )
			return;
		
		//Create with a default key - notice how we can create with same key as it's been reset
		var aSave1 = createAutoSave("[name='Reason']",);
		
		//Create with a custom key
		var aSave2 = createAutoSave("[name='Cause']",{
			dataStore:{
				key: "myCustomKey"
			}
		});		

		setValue("[name='Reason']", "So Good");
		setValue("[name='Cause']", "Just Cause");
		
		//Wait for auto-save to kick in and save
		jasmine.clock().tick(60*1000);

		expect(getLocalStorageElseCookie("AutoSaveJS_")).toEqual("Reason=So+Good");
		expect(getLocalStorageElseCookie("AutoSaveJS_myCustomKey")).toEqual("Cause=Just+Cause");
		
		AutoSave.resetAll();

		expect(getLocalStorageElseCookie("AutoSaveJS_")).toBeFalsy();
		expect(getLocalStorageElseCookie("AutoSaveJS_myCustomKey")).toBeFalsy();
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
  
	it('parentElement_parameter_need_not_be_a_form', function(){
	
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

	it('parentElement_parameter_when_null_causes_whole_document_serialisation', function(){
	
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

	it('parentElement_parameter_when_missing_causes_whole_document_serialisation', function(){
		
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

	it('parentElement_parameter_can_be_an_empty_parameter_causing_no_serialisation', function(){
		
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
		
	it('parentElement_parameter_can_take_a_jQuery', function(){
		
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
		
	it('autosave_parentElement_parameter_can_take_an_array_like_object', function(){
		
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
		
	it('autosave parentElement parameter will throw if string, DOM element or jQuery elements not found', function(){
		
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
		
		var errMsg = "'rootControls' parameter resolved to zero elements - maybe your selector(s) werent right?";
		
		expect(function(){
			testSerialize("group1") //Forgot the #
		}).toThrowError(errMsg);
		
		expect(function(){
			testSerialize($("group1")) //Forgot the #
		}).toThrowError(errMsg);
		
		expect(function(){
			testSerialize(document.querySelectorAll("group1")) //Forgot the #
		}).toThrowError(errMsg);
		
		testSerialize([]); //Explicit empty array is fine - assume user's hook will provide at runtime.
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
		.toEqual("AutoSaveJS_=frmNameEntry=Nash&frmGenderEntry=&frmAddressEntry=&frmAgeEntry=10; expires=Fri, 31 Dec 9999 23:59:59 GMT; ");
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
		document.cookie = "AutoSaveJS_ = RESET; expires=Sat, 23 Mar 2050 00:00:00;";
		aSave.save();
		var cookieValue = getBrowserCookie();
		expect( cookieValue ).toEqual("frmNameEntry=Jonathan+%2F+Nash&frmGenderEntry=&frmAddressEntry=&frmAgeEntry=10");
		
		//On second invocation, should get nothing serialised
		document.cookie = "AutoSaveJS_ = RESET; expires=Sat, 23 Mar 2050 00:00:00;";
		aSave.save();
		var cookieValue = getBrowserCookie();
		expect( cookieValue ).toBeFalsy();
	
		//On third invocation, should get cancelled out and preserve existing one
		document.cookie = "AutoSaveJS_ = RESET;";
		aSave.save();
		var cookieValue = getBrowserCookie();
		expect( cookieValue ).toEqual("RESET"); //i.e. unchanged
		
		//On fourth invocation, should get changed altogether
		document.cookie = "AutoSaveJS_ = RESET; expires=Sat, 23 Mar 2050 00:00:00;";
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
		localStorage.setItem("AutoSaveJS_", "RESET");
		aSave.save();
		var dataValue = localStorage.getItem("AutoSaveJS_");
		expect( dataValue ).toEqual("frmNameEntry=Jonathan+%2F+Nash&frmGenderEntry=&frmAddressEntry=&frmAgeEntry=10");
		
		//On second invocation, should get nothing serialised
		localStorage.setItem("AutoSaveJS_", "RESET");
		aSave.save();
		var dataValue = localStorage.getItem("AutoSaveJS_");
		expect( dataValue ).toBeFalsy();
	
		//On third invocation, should get cancelled out and preserve existing one
		localStorage.setItem("AutoSaveJS_", "RESET");
		aSave.save();
		var dataValue = localStorage.getItem("AutoSaveJS_");
		expect( dataValue ).toEqual("RESET"); //i.e. unchanged
		
		//On fourth invocation, should get changed altogether
		localStorage.setItem("AutoSaveJS_", "RESET");
		aSave.save();
		var dataValue = localStorage.getItem("AutoSaveJS_");
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
		
	it('autosave_trigger_of_interval_throws_error_if_seconds_accidentally_used', function(){
		
		expect(function(){
			var aSave = createAutoSave(null,{
				autoSaveTrigger: {
					debounceInterval: 1.5, //Should actually be 1500 - i.e. in milliseconds
				}
			});
		}).toThrowError("The 'debounceInterval' must be specified in milliseconds");
		
	});

	it('autosave_trigger_of_interval_throws_error_if_its_non_numeric', function(){
		
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
	
	
	it('autosave_trigger_sends_data_on_radio_change', function(){
		
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

	it('autosave_trigger_sends_data_on_checkbox_change', function(){
		
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

	it('autosave_trigger_sends_data_on_textarea_input_and_change', function(){
		
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
	
	it('autosave_trigger_of_default_sends_data_on_select_changed', function(){

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
	it('autosave_trigger_of_default_sends_data_whilst_typing_in_text_input', function(){ 

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
	
	
	it('autosave_trigger_with_custom_debounce_interval_fires_event_at_right_time', function(){

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

	it('autosave_trigger_waits_for_interval_elapse_from_first_select_change_regardless_of_subsequent_changes', function(){

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

	it('save_event_only_fires_once_in_given_interval_even_after_multiple_updates', function(){
	
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

	
	it('autosave_is_not_generally_triggered_by_inputs_outside_the_watch_range', function(){

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
	
	it('inputs_outside_the_watch_range_trigger_and_get_saved_if_they_belong_to_a_top_level_form_being_watched', function(){
			
		//TODO: If element is within the current form? Assume nws
		//opt { seekExternalFormElements : false }
		//TODO: nested_level_form too - get as we're traversing
		
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
		expect(szString).toEqual("fullName=Oscar+Wilde&description=I+like+descriptions");
		
		//Now set non-nested external elements
		setValue("[name='fullAddress']", "1 The Wilderness");

		//Let trigger elapse
		jasmine.clock().tick(60*1000);
		expect(szString).toEqual("fullName=Oscar+Wilde&description=I+like+descriptions&fullAddress=1+The+Wilderness");

		//Set nested external elements
		setValue("[name='age']", "7");
		setValue("[name='blood_group']", "O");
		
		//Let trigger elapse
		jasmine.clock().tick(60*1000);
		expect(szString).toEqual("fullName=Oscar+Wilde&description=I+like+descriptions&fullAddress=1+The+Wilderness&age=7&blood_group=O");
		
		//Sanity - set external, NON-FORM element
		setValue("[name='shoeSize']", "5");
		
		//Let trigger elapse - should NOT contain the new element's value
		jasmine.clock().tick(60*1000);
		expect(szString).toEqual("fullName=Oscar+Wilde&description=I+like+descriptions&fullAddress=1+The+Wilderness&age=7&blood_group=O");
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
	
	//'PROGRAMATIC CHANGES HANDLING? DIFF FEATURE? V2?
	// button serialisation! ALL other inputs covered?
	 // "Some data was not saved. Are you sure you want to navigate away...?"

	//todo: for each event type, hook different events?
	//TODO: Many of these in browser for browser-based integration tests OR send native key-press/mouse-moves
	//todo: allow intercepting autosave ? or just cancel on the pre-serialisation?
	//	autosaveTrigger: { ..., preChangeTriggered: function(){} }
	//TODO: Changes due to .Load() should not call .Save() 
	//TODO: *** 'on' string if no name for checkbox/radio *** (as per spec?)
	//ensure name is available on NPM - e.g. AutoSavePrime
	// TODO: Unselected select remains unselected 
	//check jQuery implementation of :input selector
	// TODO: Check all options of all controls in MDN - e.g. select.multiselect
	// loadStrategy should wait for all controls to be loaded and fire event on loading
	// If 'value' is missing on all options? Use text instead?
	//Post-* method should always be called, even for failure(?) with finally
	// Failure reporting/propagation/handling ??
	// If string selector provided for parent-element, should re-calculate on each invocation (how works on loading then?)
	// Hook for opt-in to jQuery-UI / CKEditor etc. if they're expensive
	// ensure tests work across all versions of jQuery old and new - when supplied as the parameter        
	// if radio has no name?
	// TOOD: ensure ALL form control types are covered wrt triggering an event
	// TODO: multiple input radio group
	// TODO: Test with dynamically added or removed controls after serializing + before deserializing
	
	 // Without IDs, server-side or client-side auto-saving, jQuery-UI + CKEditor etc. tests,
	 // If element has value, deserialize over it?
	 // Way to revert to local storage if no connectivity with my ajax service?
	 // AutoSave.Serialize, AutoSave.Deserialize, AutoSave.FindControls all static 
	 // Integrity - won't restore any state if found dodgy? mode=strict|relaxes
	 // Github-integrated tests
	 // If [type='radio'] has now value attribute, chrome uses 'on'. Do? X-browser support?
	 // Serious attempt and will be maintained, no Gung-ho rewrites
	 // TODO: Google "Reading/writing to cookies with full unicode support" and ensure we cover too
	 // Have a diagram of the hooks and where functionality belongs (e.g. AutoSave.Load)
	 // Custom control serialisation/deserialisation
	 // addEventListener / removeEventListener not supported by pre-IE8 - make it compatible there too!! (?)
		// Adding support for older browsers via hooks - 
		// https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
	 // Never break backwards compatability in future versions : never-break-backwards-compat.com - compatpact.com
	 // Doesn't require jQuery, doesn't require a form, handles nested forms (illegal?)
	 // Never write password fields to debug log
	 // Documentation for how you would deal with multi-user scenario
	 // perf test across browsers
	 // d.ts file
	 // Works with jQuery UI, CKEditor, etc.
	 // Retain focus when serialising/deserialising
	 // How you would add a hook to ensure data only sent when form is validated
	 // Following settings are mutable and can be changed, following are not and will throw on mutation
	 // Intermittent connectivity
	 // Saves data if they try navigate away
	 // jQuery won't do this : $("body").serialize() - see GitHub discussion for why needs a form
	 // Dynamically added controls/panels, dynamically expanded etc. - add hooks?
	 // NodeJS? Using document property :/ ...
	 // Multi-user scenario? Timestamp each request?
	// incorporate JSON2.js !!
	//TODO: Document if custom path, domains etc are set, will not get cleared out
	//TODO: What to do if cookie storage is running out?	 
	 // As we're using event handlers, test if us throwing doesn't invoke the remaining handles. If so, try-catch and pipe to errorHandler 
	 //(by default throws an Error with code)
	 // Unhook events on elements removed from DOM (?)


//TODO: Localisation
//TODO: get control values just for controls that've changed?
//TODO: test dispose() causes no more save invocations
//TODO: If any errors, pipe them somewhere...? Catch errors in callback functions?


/** DEMO / DOCS **/
	 // Demo - regular interval saving, custom events
	 // Demo - how to customise string with metadata by hooking into preSend, postLoad
//TODO: Demo for custom hook where load can be delayed
	 // Demo for doing control diff to send only changes or using angular is-pristine flag
	//Demo where can cancel a serialisation where validation fails
//TODO: Demo showing its use for undo-semantics
//TODO: Demo for initial load value
	 // Documentation - if you want to cache the controls used, store the onPreSerialize value, change parentElement?
	 // Demo - send on regular interval by autoSaveTrigger: null and call save() myself every X seconds
//TODO: Demo showing versioning of serialisation so old ones can be discarded
//TODO: Demo showing multiple identical forms/divs in 1 page
//TODO: Docs - "Not overly-strict on checking etc., trust your overrides. E.g. uniqueness of key in keyFunc"
//TODO: Docs - Wrt multiple instances, 1-1 relation between AutoSave and data-store key. Identical items? Need multiple ASJ's.
	 //demo where some controls loaded on demand
	//'hook can be used for inspection without modifying' - no return value

  	 
	 // incognito session? no cookies?
	 // datastorage method of local-storage else cookies
	 // If panels are lazy-loaded? Basically, bunch of tests for dynamically loaded controls to append/splice on save/load
	 // TODO: JSLint it.
	 // When value cleared, should be sent to server - difference from a normal sz() and save() ajax call
	 // Full fidelity - round tripping
	 // First class events? multiple can hook? but then becomes highly order dependant ?
	 // Example/demo - only complete text entries to be sent back
	 // Undocumented documentation. You can actually change most option parameters at run-time but take no liability for behaviour ! 
								 // Behaviour *NOT* supported
	 // IE7+, It's fast - performance tests... 
	 
		// JSFiddle with various examples
		//Link to perf test vs jquery Serialize/Deserialize
		//Demo using hooks to show a 'loading...' and 'saving...' indicator
		//Add to NPM/Bower etc.
	//TODO: Some way of clearing __keysInUse ? AutoSave.disposeAllInstances()? AutoSave.reset({keys:true, localStorage: true, cookies:true})

	//TODO: Demo with diffing logic
	 // As a cheap hosted-service plugin? Over SSL?
	 // WP plugin wrapper? Give "Free" to top theme authors
	 // Create fiddle - starter code for server-side
	 
			 
  });
});



