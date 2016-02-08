# goodies
This site makes use of the Node.js build tool Gulp.js for moving assets and compiling html templates. For the front end, webpack is used to compile javascript and scss together. Deployment is done with Gulp.js to Amazon S3. 

####Development environment
Gulp is used to move assets to the build folder. Webpack is used to build javascript and scss into a bundle at the root of the build folder.
```sh
#install the packages
npm install
#run gulp in development mode, go to localhost:8080 to see the app
gulp
```

####Deploy to Amazon S3
```sh
#use gulp to build assets to the build directory and then upload the contents to the mrr S3 bucket
gulp deploy
```