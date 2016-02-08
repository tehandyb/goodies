var gulp = require("gulp");
var gutil = require("gulp-util");
var webpack = require("webpack");
var WebpackDevServer = require("webpack-dev-server");
var webpackConfig = require("./webpack.config.js"); //require our base config
var fileinclude = require("gulp-file-include"); // template includes
var include = require("gulp-include"); // gulp js includes
var sass = require("gulp-sass"); 
var data = require("gulp-data");
var swig = require("gulp-swig");
var merge = require("merge");
var clone = require("clone");
var fm = require("front-matter");
var path = require("path");
var rename = require("gulp-rename");
var rev = require("gulp-rev");
var revCollector = require("gulp-rev-collector");
var rimraf = require("gulp-rimraf");
var runSequence = require("run-sequence"); // allow syncronous task running
var s3 = require("gulp-s3");
var fs = require("fs");
var livereload = require('gulp-livereload');
var embedLr = require("gulp-embedlr");
var awsCredentials = require('./config/secret-settings').aws;
var gzip = require("gulp-gzip");

var paths = {
  build: './build/',
  templates: './src/templates/',
  sass: './src/static/stylesheets/',
  js: './src/static/javascripts/',
  webpack_js: './src/bundle/javascripts/',
  webpack_staging: './webpack-staging/',
  img: './src/static/images/',
  fonts: './node_modules/font-awesome/fonts/',
  datafiles: './src/data/',
  docs: './src/docs/',
  deploymentKey: '/Users/jackcompton/.ssh/amazon.pem',
  deploymentHost: '107.22.190.138'
};

// buildpages: grab partials from templates, consume front-matter data, run swig processing, and render out html files
// ==========================================
gulp.task('buildpages', function() {
  return  gulp.src(path.join(paths.templates, '*.tpl.html'))
    .pipe(fileinclude())
    .pipe(data(function(file){
      var content = fm(String(file.contents));
      file.contents = new Buffer(content.body);
      return content.attributes;
    }))
    .pipe(swig({defaults: {cache: false}}))
    .pipe(rename({
      extname: ""
     }))
    .pipe(rename({
      extname: ".html"
     }))
    .pipe(gulp.dest('./build/'));
});
//templates-build-replace: Executed every time a template gets updated
gulp.task('templates-build-replace', function() {
  runSequence('buildpages', 'inject-live-reload', 'replace-assets-rev');
});
//inject-live-reload: Add live reload script to html page so browser extension isn't needed
gulp.task('inject-live-reload', function() {
  return gulp.src('./build/*.html')
    .pipe(embedLr())
    .pipe(gulp.dest('./build/'))
    .pipe(livereload());
});

//Clean all the revs, this is mainly to remove the webpack rev reference after production build 
//gulp cant rev the webpack bundle because its created/served from webpack dev server
//so development doesnt use a reved webpack bundle
gulp.task('clean-webpack-rev', function() {
  return gulp.src('./build/rev/webpack-bundles/*.*', {read: false})
    .pipe(rimraf());
});

//replace-assets-rev: Replace assets in html templates with the reved version name
// ==========================================
gulp.task('replace-assets-rev', function () {
  return gulp.src(['./build/rev/**/*.json', './build/*.html'])
    .pipe(revCollector({
      replaceReved: true
    }))
    .pipe(gulp.dest('./build/'));
});

gulp.task('clean-images', function() {
  return gulp.src('./build/static/images/*', {read: false})
    .pipe(rimraf());
});

//images: Move images to build folder
gulp.task('images', ['clean-images'], function() {
  return gulp.src(path.join(paths.img, '*.*'))
    .pipe(gulp.dest('./build/static/images'));

});

gulp.task('clean-data', function() {
  return gulp.src('./build/data/*', {read: false})
    .pipe(rimraf());
});

//datafiles: Move datafiles to build folder
gulp.task('datafiles', ['clean-data'], function() {
  return gulp.src(path.join(paths.datafiles, '*.*'))
  //.pipe(rev())
  .pipe(gulp.dest('./build/data'))
  //.pipe(rev.manifest())
  //.pipe(gulp.dest('./build/rev/data'));

});

gulp.task('clean-docs', function() {
  return gulp.src('./build/docs/*', {read: false})
    .pipe(rimraf());
});

//docs: Move documents to build folder
gulp.task('docs', ['clean-docs'], function() {
  return gulp.src(path.join(paths.docs, '*.*'))
    .pipe(gulp.dest('./build/docs'));
});

//javascripts: Move static javascripts(alternative to using webpack bundles)
// ==========================================
gulp.task('javascripts', ['clean-javascripts'], function() {
  return gulp.src(path.join(paths.js, '*.js'))
    .pipe(include())
    .pipe(rev())
    .pipe(gulp.dest('./build/static/javascripts'))
    .pipe(rev.manifest())
    .pipe(gulp.dest('./build/rev/javascripts'))
    .pipe(livereload());

});
//javascripts-build-replace: Executed every time static javascripts get updated
gulp.task('javascripts-build-replace', function() {
  runSequence('javascripts', 'replace-assets-rev');
});

gulp.task('clean-javascripts', function() {
  return gulp.src('./build/static/javascripts/*', {read: false})
    .pipe(rimraf());
});

//fonts: Move fontawesome fonts from node_modules to build directory
gulp.task('fonts', function() {
  return gulp.src(path.join(paths.fonts,'*.*'))
    .pipe(gulp.dest('./build/static/fonts/'));
});

//sass: move static scss 
// ==========================================
gulp.task('sass', ['clean-sass'], function() {
  return gulp.src(path.join(paths.sass, '*.scss'))
    .pipe(include())
    .pipe(sass({ }))
    .pipe(rev())
    .pipe(gulp.dest('./build/static/stylesheets'))
    .pipe(rev.manifest())
    .pipe(gulp.dest('./build/rev/stylesheets'))
    .pipe(livereload());

});
//sass-build-replace: Executed every time a scss file is updated
gulp.task('sass-build-replace', function() {
  runSequence('sass', 'replace-assets-rev');
});

gulp.task('clean-sass', function() {
  return gulp.src('./build/static/stylesheets/*', {read: false})
    .pipe(rimraf());
});

//webpack: build the webpack bundle(only used in production build)
gulp.task("webpack", ['clean-webpack'], function(callback) {
    var baseConfig = Object.create(webpackConfig);
    if(!baseConfig.plugins) {
      baseConfig.plugins = [];
    }
    baseConfig.output.path = paths.webpack_staging;
    baseConfig.output.filename = "[name].js";
    baseConfig.plugins = baseConfig.plugins.concat([
      new webpack.DefinePlugin({
        "process.env" : {
          //Production environment variable
          "NODE_ENV": JSON.stringify("production")
        }
      }),
      new webpack.optimize.DedupePlugin(),
      new webpack.optimize.UglifyJsPlugin()
    ]);
    //run webpack
    webpack(baseConfig, function(err, stats) {
        if(err) throw new gutil.PluginError("webpack build error", err);
        gutil.log("[webpack]", stats.toString({
            //output options
            colors: true
        }));
        callback(); //tell gulp the task is done
    });

});
//webpack-dev-server: serve the webpack bundle from webpack dev server(only used in default build)
gulp.task("webpack-dev-server", function(callback) {
	// modify some of our original webpack.config.js settings
	var baseConfig = Object.create(webpackConfig);
	baseConfig.devtool = "source-map";
	baseConfig.debug = true;
  if(!baseConfig.plugins) {
    baseConfig.plugins = [];
  }
  //still need to replace revved hash file in the html files that use the bundle
  baseConfig.plugins = baseConfig.plugins.concat([new webpack.HotModuleReplacementPlugin()]);

  //use dev server to server each entry point for hot reloading
  Object.keys(baseConfig.entry).forEach(function(e) {
    var entryPath = baseConfig.entry[e];
    baseConfig.entry[e] = ["webpack-dev-server/client?http://localhost:8080", "webpack/hot/dev-server", entryPath];
  })

	// Start the webpack-dev-server
	// NOTE: webpackdevserver config is separate from the webpack baseConfig
	var server = new WebpackDevServer(webpack(baseConfig), {
		stats: {
			colors: true
		},
		hot: true,
		contentBase: "./build",
	});
	server.listen(8080, "localhost", function(err) {
		if(err) throw new gutil.PluginError("webpack-dev-server", err);
		gutil.log("[webpack-dev-server]", "http://localhost:8080/webpack-dev-server/index.html");

    callback(); //tell gulp the task is done
	});
});

//rev-webpack: Rev webpack bundle(only done for production build)
gulp.task('rev-webpack', ['webpack'], function() {
  return gulp.src(path.join(paths.webpack_staging, '*.js'))
    .pipe(rev())
    .pipe(gulp.dest('./build'))
    .pipe(rev.manifest())
    .pipe(gulp.dest('./build/rev/webpack-bundles'));
});

gulp.task('webpack-fonts', function() {
  return gulp.src(path.join(paths.webpack_staging, '*.+(woff|woff2|ttf|png|eot|gif|jpg|svg)'))
    .pipe(gulp.dest('./build'));
});

gulp.task('clean-webpack', function() {
  return gulp.src(path.join(paths.webpack_staging, '*.*'))
    .pipe(rimraf());
});

gulp.task('clean-all', function() {
  return gulp.src('./build/*', {read: false})
    .pipe(rimraf());
});

//compress files
gulp.task('clean-compress-js', function(){
  return gulp.src('build/static/javascripts/*.gz')
    .pipe(rimraf());
});
gulp.task('compress-js',['clean-compress-js'], function(){
  return gulp.src('build/static/javascripts/*')
    .pipe(gzip())
    .pipe(gulp.dest('build/static/javascripts/'));
});

gulp.task('clean-compress-data', function(){
  return gulp.src('build/data/*.gz')
    .pipe(rimraf());
});
gulp.task('compress-data',['clean-compress-data'], function(){
  return gulp.src('build/data/*')
    .pipe(gzip())
    .pipe(gulp.dest('build/data/'));
});

gulp.task('clean-compress-styles', function(){
  return gulp.src('build/static/stylesheets/*.gz')
    .pipe(rimraf());
});
gulp.task('compress-styles',['clean-compress-styles'], function(){
  return gulp.src('build/static/stylesheets/*')
    .pipe(gzip())
    .pipe(gulp.dest('build/static/stylesheets/'));
});

gulp.task('clean-compress-webpack-bundle', function() {
  return gulp.src('build/*.gz')
    .pipe(rimraf());
});

gulp.task('compress-webpack-bundle', ['clean-compress-webpack-bundle'], function() {
  return gulp.src('build/*.js')
    .pipe(gzip())
    .pipe(gulp.dest('build/'));
});

gulp.task('compress-all', ['compress-styles', 'compress-js', 'compress-data', 'compress-webpack-bundle'], function() {

});

//upload: Upload the build folder contents into the S3 bucket
gulp.task('upload', function() {
  return gulp.src('build/**')
    .pipe(s3(awsCredentials, {
      uploadPath: "/", 
      headers: {
        'x-amz-acl': 'public-read'
      }
    }));
});

//watch-static-assets: Watch for file changes in the static folder and live reload when file changes happen.
gulp.task('watch-static-assets', function() {
  watchStaticAssets();
});

function watchStaticAssets() {
    // livereload listens on port 35729
    livereload.listen();
  
    //Watch task for sass
    gulp.watch(path.join(paths.sass, '**/*.scss'), ['sass-build-replace']);
  
    // watch task for gulp-includes
    gulp.watch(path.join(paths.templates, '**/*.html'), ['templates-build-replace']);
    
    //watch task for JS
    gulp.watch(path.join(paths.js, '**/*.js'), ['javascripts-build-replace']);
 
}



//**********Main tasks***********
//default: The 'development' build. Bundle webpack, move static assets, use webpack dev server for hot reloading javascript/scss bundles and livereload for reloading static assets
gulp.task("default", function(callback) {
  runSequence('clean-all', ['buildpages', 'images', 'datafiles', 'docs', 'javascripts', 'sass', 'fonts'], 'inject-live-reload', 'replace-assets-rev', 'webpack-dev-server', 'watch-static-assets', callback);
});

//build: The 'production' build. Bundle webpack in production mode, and move static assets.
gulp.task("build", function(callback) {
  runSequence('clean-all', ['buildpages', 'images', 'datafiles', 'docs', 'javascripts', 'sass', 'fonts'], ['rev-webpack', 'webpack-fonts'], 'replace-assets-rev', callback);
});

//deploy: Make the build and then upload to Amazon S3 bucket. 
gulp.task("deploy", function(callback) {
  runSequence("build", "upload");
});