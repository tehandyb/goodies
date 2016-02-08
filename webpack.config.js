//config for webpack build
var path = require('path');
var webpack = require('webpack');
var glob = require('glob');

var sourcePath = path.join(__dirname, 'src');
var jsBundlePath = path.join(sourcePath, "/bundle/javascripts/");

var entryPoints = {};
glob.sync( "*.entry.js", {cwd: jsBundlePath}).forEach(function(entry){
    entryPoints[entry.replace('.entry.js', '')] = jsBundlePath + entry;
});
var outPutFileName = '[name].js';

module.exports = {
    context: sourcePath,
    entry: entryPoints,
    output: {
        path: __dirname + "/build",
        filename: outPutFileName
    },
    module: {
        loaders: [
            { test: /\.css$/, loader: "style!css" },
            { test: /\.scss$/, loader: "style!css!sass"},
            {
                test: /\.woff(\?v=\d+\.\d+\.\d+)?$/,
                loader: "url?limit=10000&mimetype=application/font-woff"
            },
            {
                test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/,
                loader: "url?limit=10000&mimetype=application/font-woff"
            }, 
            {
                test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
                loader: "url?limit=10000&mimetype=application/octet-stream"
            }, 
            {
                test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
                loader: "file"
            }, 
            {
                test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
                loader: "url?limit=10000&mimetype=image/svg+xml"
            },
            {
                test: /\.png|\.jpg|\.gif$/,
                loader: "file"
            },
        ]
    }

};