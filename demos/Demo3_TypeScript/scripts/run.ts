/*
* Demo project using AutoSavePrime - https://github.com/nchaud/AutoSavePrime
* Copyright (c) 2019 Numaan Chaudhry
* Licensed under the ISC license
*/

import AutoSave = require("../node_modules/autosave-prime/dist/AutoSave");

export class FormManager {

    private _autoSave: AutoSave;

    constructor(){

        var opts: AutoSave.InitOptions = {

            //Lets disable all non-error logging
            onLog: (level)=>level == AutoSave.LOG_ERROR,
        };
     
        //Instantiate an instance, the first null parameter implies the whole document is in scope (see docs)
        this._autoSave = new AutoSave(null, opts);
        
        //Set the version on an element to show that it loaded successfully
        (document.getElementById("autosave_version")).innerHTML = AutoSave.version;
    }
}

new FormManager();