
//TODO: MULTI INSTANCE of IDENTICAL ELEMENTS that are provided different containers/selectors

describe("AutoSaveJS+uniform", function() {
	
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
		jasmine.getFixtures().fixturesPath = "./tests/jQuery.uniform";
		
		//Load jQuery-UI scripts
		$.getScript("lib/uniform/jquery.uniform.js", function(){
			
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
	
	//TODO: Multiple instances !
  
  describe('jQuery uniform integration', function(){
	
	it('styles after load completes', function( done ){
	
		jasmine.getFixtures().load("uniform_Fragment.html");

		//Deserialize all values
		var aSave = createAutoSave(null,{
			
			//Even if there was no data to load, this hook by default always 
			//gets invoked to signal the end of the deserialisation process so style after load.
			
			onPostLoad: function ( data ){
			
				return "location=london&checkbox-nested-4=on";
			},
			
			onPostDeserialize: function( loadedData ){
				
				$( "input, textarea, select" ).uniform();

				//Check the uniform wrapper to indicate checked state is now present
				expect($("[value='london']").closest(".checked").length).toEqual(1);
				
				done();
			}
		});
	});	
  });
});

