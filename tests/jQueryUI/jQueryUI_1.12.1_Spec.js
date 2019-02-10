describe("AutoSaveJS+jQueryUI", function() {
	
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
	  
	  _currTestAutoSave = new AutoSave(parent, opts);
	  return _currTestAutoSave;
    }

	beforeEach(function(done){
		
		jasmine.clock().install();		
		
		//Initialise path to templates directory
		jasmine.getFixtures().fixturesPath = "./jQueryUI";
		
		//Load jQuery-UI scripts
		$.getScript("../lib/jquery-ui-1.12.1/jquery-ui.js", function(){
			
			//resume tests
			done();
		});
		
	});

	afterEach(function(){

		jasmine.clock().uninstall();
		
		//Reset all elements in container
		resetSandbox();

		if(_currTestAutoSave) {
			
			_currTestAutoSave.dispose();
			_currTestAutoSave = null;
		}		
	});

	function resetSandbox(){
		
		$("#jasmine-fixtures").remove();
	}
	

	//Guaranteed to get an instance of a string, even if empty
	function savejQWidgets(szString){
		
		//We just need to deal with the jQuery UI widgets that don't have a backing :input
		//as all other widgets update the underlying control
		$(".ui-slider, .hasDatepicker").each(function(idx,widgetElem){
			
			var $widget = $( widgetElem );
			
			//We don't have to use the ID attribute as the key, could just as easily use data-*
			var name = $widget.attr( "id" );
			
			if ( !name ) {
				
				throw new Error( "jQuery UI Element must have an 'id' attribute in order to be serialised" );
			}
			
			if ($widget.hasClass("ui-slider")){
			
				var value = $widget.slider( "option", "value" );

				szString = AutoSave.addSerialisedValue(szString, name, value);
			}
			else if ($widget.hasClass("hasDatepicker")){
			
				var dateValue = $widget.datepicker( "getDate" );
				
				var strValue = $.datepicker.formatDate( "yy-mm-dd", dateValue );
				
				szString = AutoSave.addSerialisedValue(szString, name, strValue);
			}
			else {
				
				throw new Error("Added a custom class but did not add serialization logic for it !");
			}
		});
		
		return szString;
	}
	
	function loadjQWidgets(szString){
		
		//We just need to deal with the jQuery UI widgets that don't have a backing :input
		//as all other widgets will be set based on the underlying control
		$(".ui-slider, .hasDatepicker").each(function(idx,widgetElem){
			
			var $widget = $( widgetElem );
			
			//We don't have to use the ID attribute as the key, could just as easily use data-*
			var name = $widget.attr( "id" );
			
			if ($widget.hasClass("ui-slider")){
			
				//Read value from serialised string
				var values = AutoSave.getSerialisedValues(szString, name);
				
				//Set it on the slider - TODO: If it's 0 ?
				$widget.slider( "option", "value", values[ 0 ] );
			}
			else if ($widget.hasClass("hasDatepicker")){
			
				var values = AutoSave.getSerialisedValues(szString, name);

				var dateValue = $.datepicker.parseDate( "yy-mm-dd", values[0] );
				
				$widget.datepicker( "setDate", dateValue );
			}
			else {
				
				throw new Error("Added a custom class but did not add serialization logic for it !")
			}
		});
		
		return szString;
		
		//szString += encodeURI...
		//We could also strip out the jQuery-UI specific elements here and return a modified string
		//but not really necessary
	}
  
  describe('jQueryUI 1.12.1 hook', function(){
	
	it('serialises jQuery widgets into string', function(){
	
		jasmine.getFixtures().load("jQueryUI_1.12.1_Fragment.html");

		//Initialise all jQuery-UI widgets
	    $( "#checkboxradio_group input" ).checkboxradio();
		$( "#Period" ).slider();
		$( "#TransactionDate" ).datepicker();
		$( "#language-autocomplete" ).autocomplete({
		  source: [ "c++", "java", "c++ & java!", "coldfusion", "javascript", "asp", "ruby" ]
		});

		
		//Set test values on all widgets
		$( "#Period" ).slider( "option", "value", "11" );
		
		$( "#TransactionDate" ).datepicker( "setDate", "12/31/2012" );
		
		$("#location-london").prop("checked", true);
		
		$( "#language-autocomplete" ).val("c++ & java!");

		var szString;
		var aSave = createAutoSave(null,{
			
			//jQuery UI Widget hooks for custom controls
			onPreStore: savejQWidgets,
			onPostLoad: loadjQWidgets,
			
			autoLoadTrigger: null, //Manually control
				
			//Test data-store
			dataStore: {
				load: function(key, callback){},
				save: function(key, stringValue, callback){
					
					szString = stringValue;
					callback();
				}
			}
		});

		//Sanity - Ensure first time round the string is from section-1
		aSave.save();
		expect(szString).toEqual("location=london&language=c%2B%2B+%26+java!&Period=11&TransactionDate=2012-12-31");
	});
	
	it('deserialises jQuery widgets from string', function(){
	
		jasmine.getFixtures().load("jQueryUI_1.12.1_Fragment.html");

		//Initialise all jQuery-UI widgets
	    $( "#checkboxradio_group input" ).checkboxradio();
		$( "#Period" ).slider();
		$( "#TransactionDate" ).datepicker();
		$( "#language-autocomplete" ).autocomplete({
		  source: [ "c++", "java", "c++ & java!", "coldfusion", "javascript", "asp", "ruby" ]
		});

		//Deserialize all values
		var szString = "location=london&language=c%2B%2B+%26+java!&Period=11&TransactionDate=2012-12-31";
		var aSave = createAutoSave(null,{
			
			//jQuery UI Widget hooks for custom controls
			onPreStore: savejQWidgets,
			onPostLoad: loadjQWidgets,
			
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
		
		//Test values on all widgets
		expect( $( "#Period" ).slider( "option", "value" )).toEqual("11");
		expect( $( "#TransactionDate" ).datepicker( "getDate")).toEqual(new Date("2012-12-31"));
		expect( $( "#location-london" ).prop("checked")).toEqual(true);
		expect( $( "#language-autocomplete" ).val()).toEqual("c++ & java!");
	});	
  });
});

