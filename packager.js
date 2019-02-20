/*
* AutoSavePrime packaging script - https://github.com/nchaud/AutoSavePrime
* Takens input file from src/, minifies & generates sourcemaps and outputs to dist/
* Written using older Node APIs to becompatible with the earliest Node versions
* 
* Copyright (c) 2019 Numaan Chaudhry
* Licensed under the ISC license
*/

var fs = require('fs');
var UglifyJS = require("uglify-js");

//Ensure dist exists
if (!fs.existsSync("dist"))
	fs.mkdirSync("dist");

//Minify and copy the file and sourcemap to /dist
var code = fs.readFileSync("src/AutoSave.js", "utf8");
var result = UglifyJS.minify(code, {
	    sourceMap: {
			filename: "AutoSave.js",
			url: "AutoSave.js.map"
    }
});

if (result.error) 
	throw result.error;

fs.writeFileSync("dist/AutoSave.min.js", result.code);
fs.writeFileSync("dist/AutoSave.min.js.map", result.map);

//Also copy the original un-minified file over
var rawFile = fs.readFileSync("src/AutoSave.js", "utf8");
fs.writeFileSync("dist/AutoSave.js", rawFile);

//Also copy the typings file over
var typingsFile = fs.readFileSync("typings/AutoSave.d.ts", "utf8");
fs.writeFileSync("dist/AutoSave.d.ts", typingsFile);
